import { Router, Response } from 'express';
import { query } from '../db/init';
import { AuthRequest } from '../middleware/auth';
import {
  isAIConfigured,
  getCzechTaxAdvice,
  extractExpenseFromDocument,
  draftPaymentReminder,
} from '../services/aiProvider';

export const aiRouter: ReturnType<typeof Router> = Router();

// Check if AI features are available
aiRouter.get('/status', async (req: AuthRequest, res: Response) => {
  // Check if AI is enabled in settings
  const settingsResult = await query(
    'SELECT ai_enabled FROM settings WHERE user_id = $1',
    [req.userId]
  );
  const aiEnabled = settingsResult.rows.length > 0 ? (settingsResult.rows[0].ai_enabled ?? true) : true;

  const configured = aiEnabled && await isAIConfigured(req.userId!);
  res.json({
    available: configured,
    features: {
      taxAdvisor: true,
      expenseExtraction: true,
      reminderDrafting: true,
    },
  });
});

// Extract expense data from an uploaded document (received invoice / receipt)
aiRouter.post('/extract-expense', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isAIConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your API key in Settings.' });
    }

    const { fileData, fileMimeType, fileName } = req.body;

    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'File data is required' });
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(fileMimeType)) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Same 5MB limit as expense attachments (base64 is ~4/3 of raw size)
    if (fileData.length > 7 * 1024 * 1024) {
      return res.status(400).json({ error: 'File is too large (max 5MB)' });
    }

    const extracted = await extractExpenseFromDocument(req.userId!, fileData, fileMimeType, fileName);

    if (!extracted) {
      return res.status(422).json({ error: 'Could not extract data from the document' });
    }

    res.json({ extracted });
  } catch (error) {
    console.error('AI expense extraction error:', error);
    res.status(500).json({ error: 'Failed to extract expense data' });
  }
});

// Draft a payment reminder email for a sent/overdue invoice
aiRouter.post('/draft-reminder', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isAIConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your API key in Settings.' });
    }

    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const invoiceResult = await query(
      `SELECT i.invoice_number, i.total, i.currency, i.due_date, i.status,
              c.company_name as client_name
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.id = $1 AND i.user_id = $2`,
      [invoiceId, req.userId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    if (!['sent', 'overdue'].includes(invoice.status)) {
      return res.status(400).json({ error: 'Reminders can only be drafted for sent or overdue invoices' });
    }

    const userResult = await query('SELECT language FROM users WHERE id = $1', [req.userId]);
    const language = userResult.rows[0]?.language || 'cs';

    const settingsResult = await query('SELECT smtp_from_name FROM settings WHERE user_id = $1', [req.userId]);
    const senderName = settingsResult.rows[0]?.smtp_from_name || null;

    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));

    const draft = await draftPaymentReminder(
      req.userId!,
      {
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client_name,
        total: parseFloat(invoice.total),
        currency: invoice.currency,
        dueDate,
        daysOverdue,
      },
      language,
      senderName
    );

    res.json(draft);
  } catch (error) {
    console.error('AI reminder drafting error:', error);
    res.status(500).json({ error: 'Failed to draft reminder' });
  }
});

// Czech tax advisor chat
aiRouter.post('/tax-advisor', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isAIConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your API key in Settings.' });
    }

    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: 'Question is too long (max 500 characters)' });
    }

    const response = await getCzechTaxAdvice(req.userId!, question);
    res.json(response);
  } catch (error) {
    console.error('Tax advisor error:', error);
    res.status(500).json({ error: 'Failed to get tax advice' });
  }
});

export default aiRouter;
