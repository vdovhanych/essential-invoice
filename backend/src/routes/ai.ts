import { Router, Response } from 'express';
import { query } from '../db/init.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  isPerplexityConfigured,
  categorizeInvoiceItems,
  matchPaymentToInvoice,
  getFinancialInsights,
  getCzechTaxAdvice,
} from '../services/perplexityAI.js';

export const aiRouter: ReturnType<typeof Router> = Router();

// Check if AI features are available
aiRouter.get('/status', async (req: AuthRequest, res: Response) => {
  const configured = await isPerplexityConfigured(req.userId!);
  res.json({
    available: configured,
    features: {
      invoiceCategorization: true,
      paymentMatching: true,
      financialInsights: true,
      taxAdvisor: true,
    },
  });
});

// Categorize invoice items
aiRouter.post('/categorize-invoice', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isPerplexityConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your Perplexity API key in Settings.' });
    }

    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    // Get invoice items
    const itemsResult = await query(
      `SELECT ii.description, ii.total 
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE ii.invoice_id = $1 AND i.user_id = $2
       ORDER BY ii.sort_order`,
      [invoiceId, req.userId]
    );

    if (itemsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found or has no items' });
    }

    const items = itemsResult.rows.map(row => ({
      description: row.description,
      total: parseFloat(row.total),
    }));

    const categories = await categorizeInvoiceItems(req.userId!, items);
    res.json({ categories });
  } catch (error) {
    console.error('AI categorization error:', error);
    res.status(500).json({ error: 'Failed to categorize invoice items' });
  }
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

// Get financial insights for dashboard
aiRouter.get('/financial-insights', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isPerplexityConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your Perplexity API key in Settings.' });
    }

    // Get financial data
    const revenueResult = await query(
      `SELECT 
         SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as total_revenue,
         SUM(CASE WHEN status = 'paid' AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
                       AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM CURRENT_DATE) 
              THEN total ELSE 0 END) as current_month,
         SUM(CASE WHEN status = 'paid' AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM CURRENT_DATE) - 1
                       AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM CURRENT_DATE)
              THEN total ELSE 0 END) as previous_month,
         currency
       FROM invoices 
       WHERE user_id = $1
       GROUP BY currency
       ORDER BY total_revenue DESC
       LIMIT 1`,
      [req.userId]
    );

    if (revenueResult.rows.length === 0) {
      return res.json({ insights: 'No revenue data available yet. Start creating and sending invoices!' });
    }

    const revenueData = revenueResult.rows[0];

    // Get top clients
    const topClientsResult = await query(
      `SELECT c.company_name, SUM(i.total) as revenue
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.user_id = $1 AND i.status = 'paid'
       GROUP BY c.company_name
       ORDER BY revenue DESC
       LIMIT 3`,
      [req.userId]
    );

    const topClients = topClientsResult.rows.map(row => ({
      name: row.company_name,
      revenue: parseFloat(row.revenue),
    }));

    const insights = await getFinancialInsights(req.userId!, {
      totalRevenue: parseFloat(revenueData.total_revenue || 0),
      currentMonth: parseFloat(revenueData.current_month || 0),
      previousMonth: parseFloat(revenueData.previous_month || 0),
      topClients,
      currency: revenueData.currency || 'CZK',
    });

    res.json({ insights });
  } catch (error) {
    console.error('Financial insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
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
