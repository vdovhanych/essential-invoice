import { Router, Response } from 'express';
import { query } from '../db/init.js';
import { AuthRequest } from '../middleware/auth.js';
import { triggerPoll } from '../services/emailPoller.js';

export const paymentRouter: ReturnType<typeof Router> = Router();

// Get all payments
paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { matched } = req.query;

    let sql = `
      SELECT p.*, i.invoice_number
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE p.user_id = $1
    `;
    const params: any[] = [req.userId];

    if (matched === 'true') {
      sql += ' AND p.invoice_id IS NOT NULL';
    } else if (matched === 'false') {
      sql += ' AND p.invoice_id IS NULL';
    }

    sql += ' ORDER BY p.transaction_date DESC, p.created_at DESC';

    const result = await query(sql, params);

    const payments = result.rows.map(row => ({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      amount: parseFloat(row.amount),
      currency: row.currency,
      variableSymbol: row.variable_symbol,
      senderName: row.sender_name,
      senderAccount: row.sender_account,
      message: row.message,
      transactionCode: row.transaction_code,
      transactionDate: row.transaction_date,
      bankType: row.bank_type,
      matchedAt: row.matched_at,
      matchMethod: row.match_method,
      createdAt: row.created_at
    }));

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Get unmatched payments
paymentRouter.get('/unmatched', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT p.*
      FROM payments p
      WHERE p.user_id = $1 AND p.invoice_id IS NULL
      ORDER BY p.transaction_date DESC
    `, [req.userId]);

    const payments = result.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      variableSymbol: row.variable_symbol,
      senderName: row.sender_name,
      senderAccount: row.sender_account,
      message: row.message,
      transactionCode: row.transaction_code,
      transactionDate: row.transaction_date,
      createdAt: row.created_at
    }));

    res.json(payments);
  } catch (error) {
    console.error('Get unmatched payments error:', error);
    res.status(500).json({ error: 'Failed to get unmatched payments' });
  }
});

// Get potential matches for a payment
paymentRouter.get('/:id/matches', async (req: AuthRequest, res: Response) => {
  try {
    // Get the payment
    const paymentResult = await query(
      'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    // Find potential matches
    // 1. Exact variable symbol match
    // 2. Amount match with unpaid invoices
    // 3. Similar dates
    const matchesResult = await query(`
      SELECT i.*, c.company_name as client_name,
        CASE
          WHEN i.variable_symbol = $1 THEN 100
          WHEN i.total = $2 THEN 80
          WHEN ABS(i.total - $2) < 1 THEN 60
          ELSE 40
        END as match_score,
        CASE
          WHEN i.variable_symbol = $1 THEN 'variable_symbol'
          WHEN i.total = $2 THEN 'exact_amount'
          WHEN ABS(i.total - $2) < 1 THEN 'approximate_amount'
          ELSE 'other'
        END as match_reason
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.user_id = $3
        AND i.status IN ('sent', 'overdue')
        AND (
          i.variable_symbol = $1
          OR ABS(i.total - $2) < 10
        )
      ORDER BY match_score DESC, i.issue_date DESC
      LIMIT 10
    `, [payment.variable_symbol, payment.amount, req.userId]);

    const matches = matchesResult.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      variableSymbol: row.variable_symbol,
      clientName: row.client_name,
      total: parseFloat(row.total),
      currency: row.currency,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      matchScore: row.match_score,
      matchReason: row.match_reason
    }));

    res.json(matches);
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// Manually match payment to invoice
paymentRouter.post('/:id/match', async (req: AuthRequest, res: Response) => {
  const { invoiceId } = req.body;

  if (!invoiceId) {
    return res.status(400).json({ error: 'Invoice ID required' });
  }

  try {
    // Verify payment belongs to user
    const paymentCheck = await query(
      'SELECT id FROM payments WHERE id = $1 AND user_id = $2 AND invoice_id IS NULL',
      [req.params.id, req.userId]
    );

    if (paymentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found or already matched' });
    }

    // Verify invoice belongs to user and is unpaid
    const invoiceCheck = await query(
      'SELECT id FROM invoices WHERE id = $1 AND user_id = $2 AND status IN (\'sent\', \'overdue\')',
      [invoiceId, req.userId]
    );

    if (invoiceCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid invoice or invoice not awaiting payment' });
    }

    // Match payment to invoice
    await query(`
      UPDATE payments
      SET invoice_id = $1, matched_at = CURRENT_TIMESTAMP, match_method = 'manual'
      WHERE id = $2
    `, [invoiceId, req.params.id]);

    // Update invoice status to paid
    await query(`
      UPDATE invoices
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [invoiceId]);

    res.json({ message: 'Payment matched successfully' });
  } catch (error) {
    console.error('Match payment error:', error);
    res.status(500).json({ error: 'Failed to match payment' });
  }
});

// Unmatch payment from invoice
paymentRouter.post('/:id/unmatch', async (req: AuthRequest, res: Response) => {
  try {
    // Get payment and its invoice
    const paymentResult = await query(
      'SELECT invoice_id FROM payments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const invoiceId = paymentResult.rows[0].invoice_id;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Payment is not matched to any invoice' });
    }

    // Unmatch payment
    await query(`
      UPDATE payments
      SET invoice_id = NULL, matched_at = NULL, match_method = NULL
      WHERE id = $1
    `, [req.params.id]);

    // Revert invoice status to sent or overdue
    await query(`
      UPDATE invoices
      SET status = CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'sent' END,
          paid_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [invoiceId]);

    res.json({ message: 'Payment unmatched successfully' });
  } catch (error) {
    console.error('Unmatch payment error:', error);
    res.status(500).json({ error: 'Failed to unmatch payment' });
  }
});

// Delete payment (only unmatched)
paymentRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM payments WHERE id = $1 AND user_id = $2 AND invoice_id IS NULL RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found or is matched to an invoice' });
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// Check for new payments from email
paymentRouter.post('/check-emails', async (req: AuthRequest, res: Response) => {
  try {
    const result = await triggerPoll(req.userId!);
    
    if (result.error) {
      return res.status(400).json({ 
        error: result.error,
        processed: result.processed 
      });
    }

    res.json({ 
      message: 'Email check completed',
      processed: result.processed 
    });
  } catch (error) {
    console.error('Check emails error:', error);
    res.status(500).json({ error: 'Failed to check emails' });
  }
});
