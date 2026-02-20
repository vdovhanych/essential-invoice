import { Router, Response } from 'express';
import { query } from '../db/init';
import { AuthRequest } from '../middleware/auth';
import {
  isPerplexityConfigured,
  matchPaymentToInvoice,
  getCzechTaxAdvice,
} from '../services/perplexityAI';

export const aiRouter: ReturnType<typeof Router> = Router();

// Check if AI features are available
aiRouter.get('/status', async (req: AuthRequest, res: Response) => {
  const configured = await isPerplexityConfigured(req.userId!);
  res.json({
    available: configured,
    features: {
      paymentMatching: true,
      taxAdvisor: true,
    },
  });
});

// AI-powered payment matching
aiRouter.post('/match-payment', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isPerplexityConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your Perplexity API key in Settings.' });
    }

    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    // Get payment details
    const paymentResult = await query(
      `SELECT * FROM payments 
       WHERE id = $1 AND user_id = $2 AND invoice_id IS NULL`,
      [paymentId, req.userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found or already matched' });
    }

    const payment = paymentResult.rows[0];

    // Get potential matching invoices (unpaid, same currency)
    const invoicesResult = await query(
      `SELECT i.id, i.invoice_number, i.total, i.due_date, i.issue_date, c.company_name as client_name
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.user_id = $1 
         AND i.status IN ('sent', 'overdue')
         AND i.currency = $2
         AND i.total BETWEEN $3 * 0.95 AND $3 * 1.05
       ORDER BY ABS(i.total - $3) ASC
       LIMIT 10`,
      [req.userId, payment.currency, payment.amount]
    );

    if (invoicesResult.rows.length === 0) {
      return res.json({ match: null, message: 'No potential matching invoices found' });
    }

    const invoices = invoicesResult.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientName: row.client_name,
      total: parseFloat(row.total),
      dueDate: new Date(row.due_date),
      issueDate: new Date(row.issue_date),
    }));

    const match = await matchPaymentToInvoice(
      req.userId!,
      {
        amount: parseFloat(payment.amount),
        senderName: payment.sender_name,
        message: payment.message,
        variableSymbol: payment.variable_symbol,
        transactionDate: new Date(payment.transaction_date),
      },
      invoices
    );

    res.json({ match });
  } catch (error) {
    console.error('AI payment matching error:', error);
    res.status(500).json({ error: 'Failed to match payment' });
  }
});

// Czech tax advisor chat
aiRouter.post('/tax-advisor', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isPerplexityConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your Perplexity API key in Settings.' });
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
