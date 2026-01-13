import { Router, Response } from 'express';
import { query } from '../db/init.js';
import { AuthRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();

// Get dashboard statistics
dashboardRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // Get overall statistics
    const statsResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COALESCE(SUM(total) FILTER (WHERE status IN ('sent', 'overdue')), 0) as outstanding_amount,
        COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) as paid_amount,
        COALESCE(SUM(total) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)), 0) as paid_this_month
      FROM invoices
      WHERE user_id = $1
    `, [req.userId]);

    const stats = statsResult.rows[0];

    // Get recent invoices
    const recentResult = await query(`
      SELECT i.id, i.invoice_number, i.status, i.currency, i.total, i.issue_date, i.due_date,
             c.company_name as client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
      LIMIT 10
    `, [req.userId]);

    // Get monthly revenue for last 12 months
    const revenueResult = await query(`
      SELECT
        date_trunc('month', paid_at) as month,
        SUM(total) as revenue,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE user_id = $1
        AND status = 'paid'
        AND paid_at >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY date_trunc('month', paid_at)
      ORDER BY month ASC
    `, [req.userId]);

    // Check for overdue invoices and update status
    await query(`
      UPDATE invoices
      SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND status = 'sent' AND due_date < CURRENT_DATE
    `, [req.userId]);

    // Get unmatched payments
    const unmatchedPaymentsResult = await query(`
      SELECT COUNT(*) as count
      FROM payments
      WHERE user_id = $1 AND invoice_id IS NULL
    `, [req.userId]);

    res.json({
      stats: {
        draftCount: parseInt(stats.draft_count),
        sentCount: parseInt(stats.sent_count),
        paidCount: parseInt(stats.paid_count),
        overdueCount: parseInt(stats.overdue_count),
        cancelledCount: parseInt(stats.cancelled_count),
        outstandingAmount: parseFloat(stats.outstanding_amount),
        paidAmount: parseFloat(stats.paid_amount),
        paidThisMonth: parseFloat(stats.paid_this_month)
      },
      recentInvoices: recentResult.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        status: row.status,
        currency: row.currency,
        total: parseFloat(row.total),
        issueDate: row.issue_date,
        dueDate: row.due_date,
        clientName: row.client_name
      })),
      monthlyRevenue: revenueResult.rows.map(row => ({
        month: row.month,
        revenue: parseFloat(row.revenue),
        invoiceCount: parseInt(row.invoice_count)
      })),
      unmatchedPayments: parseInt(unmatchedPaymentsResult.rows[0].count)
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Get quick stats for header
dashboardRouter.get('/quick-stats', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent', 'overdue')) as unpaid_count,
        COALESCE(SUM(total) FILTER (WHERE status IN ('sent', 'overdue')), 0) as unpaid_amount
      FROM invoices
      WHERE user_id = $1
    `, [req.userId]);

    res.json({
      unpaidCount: parseInt(result.rows[0].unpaid_count),
      unpaidAmount: parseFloat(result.rows[0].unpaid_amount)
    });
  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({ error: 'Failed to get quick stats' });
  }
});
