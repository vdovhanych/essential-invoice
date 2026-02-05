import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/init.js';
import { AuthRequest } from '../middleware/auth.js';
import { generateInvoicePDF } from '../services/pdfGenerator.js';
import { sendInvoiceEmail } from '../services/emailSender.js';
import { generateSpayd } from '../utils/validation.js';

export const invoiceRouter: ReturnType<typeof Router> = Router();

// Generate invoice number based on issue date
async function generateInvoiceNumber(userId: string, issueDate: string): Promise<{ invoiceNumber: string; variableSymbol: string }> {
  const date = new Date(issueDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const datePrefix = `${year}${month}`;

  // Get user's invoice number prefix from settings
  const settingsResult = await query(
    'SELECT invoice_number_prefix FROM settings WHERE user_id = $1',
    [userId]
  );
  const userPrefix = settingsResult.rows[0]?.invoice_number_prefix || '';

  // Get count of invoices this month (match with or without user prefix)
  const result = await query(
    `SELECT COUNT(*) FROM invoices
     WHERE user_id = $1
     AND invoice_number LIKE $2`,
    [userId, `%${datePrefix}%`]
  );

  const count = parseInt(result.rows[0].count) + 1;
  const invoiceNumber = `${userPrefix}${datePrefix}${String(count).padStart(2, '0')}`;

  // Variable symbol should be numeric only for bank payments
  const variableSymbol = `${datePrefix}${String(count).padStart(2, '0')}`;

  return { invoiceNumber, variableSymbol };
}

// Get all invoices
invoiceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, clientId, from, to } = req.query;

    let sql = `
      SELECT i.*, c.company_name as client_name, c.primary_email as client_email
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.user_id = $1
    `;
    const params: any[] = [req.userId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND i.status = $${paramIndex++}`;
      params.push(status);
    }

    if (clientId) {
      sql += ` AND i.client_id = $${paramIndex++}`;
      params.push(clientId);
    }

    if (from) {
      sql += ` AND i.issue_date >= $${paramIndex++}`;
      params.push(from);
    }

    if (to) {
      sql += ` AND i.issue_date <= $${paramIndex++}`;
      params.push(to);
    }

    sql += ' ORDER BY i.issue_date DESC, i.created_at DESC';

    const result = await query(sql, params);

    const invoices = result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      variableSymbol: row.variable_symbol,
      status: row.status,
      currency: row.currency,
      clientId: row.client_id,
      clientName: row.client_name,
      clientEmail: row.client_email,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      deliveryDate: row.delivery_date,
      subtotal: parseFloat(row.subtotal),
      vatRate: parseFloat(row.vat_rate),
      vatAmount: parseFloat(row.vat_amount),
      total: parseFloat(row.total),
      notes: row.notes,
      sentAt: row.sent_at,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Get single invoice with items
invoiceRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const invoiceResult = await query(
      `SELECT i.*, c.company_name as client_name, c.primary_email as client_email,
              c.secondary_email as client_secondary_email, c.address as client_address,
              c.ico as client_ico, c.dic as client_dic, c.contact_person as client_contact
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [req.params.id, req.userId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const itemsResult = await query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
      [req.params.id]
    );

    const row = invoiceResult.rows[0];
    const invoice = {
      id: row.id,
      invoiceNumber: row.invoice_number,
      variableSymbol: row.variable_symbol,
      status: row.status,
      currency: row.currency,
      clientId: row.client_id,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientSecondaryEmail: row.client_secondary_email,
      clientAddress: row.client_address,
      clientIco: row.client_ico,
      clientDic: row.client_dic,
      clientContact: row.client_contact,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      deliveryDate: row.delivery_date,
      subtotal: parseFloat(row.subtotal),
      vatRate: parseFloat(row.vat_rate),
      vatAmount: parseFloat(row.vat_amount),
      total: parseFloat(row.total),
      notes: row.notes,
      paymentMethod: row.payment_method,
      qrPaymentData: row.qr_payment_data,
      sentAt: row.sent_at,
      paidAt: row.paid_at,
      primaryEmailSentAt: row.primary_email_sent_at,
      secondaryEmailSentAt: row.secondary_email_sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unit_price),
        total: parseFloat(item.total)
      }))
    };

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

// Create invoice
invoiceRouter.post('/',
  body('clientId').isUUID(),
  body('issueDate').isISO8601(),
  body('dueDate').isISO8601(),
  body('items').isArray({ min: 1 }),
  body('items.*.description').isLength({ max: 150 }).withMessage('Popis položky může mít maximálně 150 znaků'),
  body('notes').optional().isLength({ max: 300 }).withMessage('Poznámka může mít maximálně 300 znaků'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientId, issueDate, dueDate, deliveryDate, items, notes, currency = 'CZK', vatRate = 21 } = req.body;

    try {
      // Verify client belongs to user
      const clientCheck = await query(
        'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
        [clientId, req.userId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid client' });
      }

      // Generate invoice number based on issue date
      const { invoiceNumber, variableSymbol } = await generateInvoiceNumber(req.userId!, issueDate);

      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.quantity * item.unitPrice;
      }
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount;

      // Get user's bank details for QR code
      const userResult = await query(
        'SELECT bank_account, bank_code FROM users WHERE id = $1',
        [req.userId]
      );
      const user = userResult.rows[0];

      // Generate QR payment data (SPAYD format) for CZK invoices
      let qrPaymentData = null;
      if (currency === 'CZK' && user.bank_account && user.bank_code) {
        qrPaymentData = generateSpayd(
          user.bank_account,
          user.bank_code,
          total,
          currency,
          variableSymbol,
          `Faktura ${invoiceNumber}`
        );
      }

      // Create invoice
      const invoiceResult = await query(
        `INSERT INTO invoices (user_id, client_id, invoice_number, variable_symbol, status, currency, issue_date, due_date, delivery_date, subtotal, vat_rate, vat_amount, total, notes, qr_payment_data)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [req.userId, clientId, invoiceNumber, variableSymbol, currency, issueDate, dueDate, deliveryDate || issueDate, subtotal, vatRate, vatAmount, total, notes, qrPaymentData]
      );

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemTotal = item.quantity * item.unitPrice;
        await query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [invoice.id, item.description, item.quantity, item.unit || 'ks', item.unitPrice, itemTotal, i]
        );
      }

      res.status(201).json({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        variableSymbol: invoice.variable_symbol,
        status: invoice.status,
        currency: invoice.currency,
        total: parseFloat(invoice.total)
      });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }
);

// Update invoice
invoiceRouter.put('/:id',
  body('items').optional().isArray({ min: 1 }),
  body('items.*.description').optional().isLength({ max: 150 }).withMessage('Popis položky může mít maximálně 150 znaků'),
  body('notes').optional().isLength({ max: 300 }).withMessage('Poznámka může mít maximálně 300 znaků'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientId, issueDate, dueDate, deliveryDate, items, notes, currency, vatRate, status } = req.body;

    try {
      // Check invoice exists and is draft (can only edit drafts)
      const invoiceCheck = await query(
        'SELECT status FROM invoices WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );

      if (invoiceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      if (invoiceCheck.rows[0].status !== 'draft' && !status) {
        return res.status(400).json({ error: 'Can only edit draft invoices' });
      }

      // If only updating status
      if (status && !items) {
        await query(
          `UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
          [status, req.params.id, req.userId]
        );
        return res.json({ message: 'Invoice status updated' });
      }

      // Calculate totals if items provided
      let subtotal = 0;
      let vatAmount = 0;
      let total = 0;
      const actualVatRate = vatRate ?? 21;

      if (items) {
        for (const item of items) {
          subtotal += item.quantity * item.unitPrice;
        }
        vatAmount = subtotal * (actualVatRate / 100);
        total = subtotal + vatAmount;

        // Delete existing items
        await query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);

        // Create new items
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemTotal = item.quantity * item.unitPrice;
          await query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [req.params.id, item.description, item.quantity, item.unit || 'ks', item.unitPrice, itemTotal, i]
          );
        }
      }

      // Update invoice
      const result = await query(
        `UPDATE invoices SET
          client_id = COALESCE($1, client_id),
          issue_date = COALESCE($2, issue_date),
          due_date = COALESCE($3, due_date),
          delivery_date = COALESCE($4, delivery_date),
          currency = COALESCE($5, currency),
          vat_rate = COALESCE($6, vat_rate),
          subtotal = COALESCE($7, subtotal),
          vat_amount = COALESCE($8, vat_amount),
          total = COALESCE($9, total),
          notes = $10,
          status = COALESCE($11, status),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 AND user_id = $13
         RETURNING *`,
        [clientId, issueDate, dueDate, deliveryDate, currency, actualVatRate,
         items ? subtotal : null, items ? vatAmount : null, items ? total : null,
         notes, status, req.params.id, req.userId]
      );

      res.json({
        id: result.rows[0].id,
        invoiceNumber: result.rows[0].invoice_number,
        status: result.rows[0].status,
        total: parseFloat(result.rows[0].total)
      });
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }
);

// Delete invoice
invoiceRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const invoiceCheck = await query(
      'SELECT status FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
    await query('DELETE FROM invoices WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// Generate PDF
invoiceRouter.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const pdfBuffer = await generateInvoicePDF(req.params.id, req.userId!);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Preview invoice email before sending
invoiceRouter.get('/:id/preview', async (req: AuthRequest, res: Response) => {
  try {
    // Get invoice with client details
    const invoiceResult = await query(
      `SELECT i.invoice_number, i.total, i.currency, i.due_date, i.status,
              c.company_name as client_name, c.primary_email, c.secondary_email
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [req.params.id, req.userId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot preview cancelled invoice' });
    }

    // Get user settings for email template
    const settingsResult = await query(
      'SELECT smtp_from_name, email_template FROM settings WHERE user_id = $1',
      [req.userId]
    );

    const settings = settingsResult.rows[0] || {};

    // Format helpers
    const formatCurrency = (amount: number, currency: string) => {
      if (currency === 'CZK') {
        return `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč`;
      }
      return `€${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}`;
    };

    const formatDate = (date: Date) => new Date(date).toLocaleDateString('cs-CZ');

    // Default email template
    const defaultTemplate = `Dobrý den,

v příloze Vám zasílám fakturu č. {{invoiceNumber}} na částku {{total}}.

Datum splatnosti: {{dueDate}}

Děkuji za spolupráci.

S pozdravem,
{{senderName}}`;

    const template = settings.email_template || defaultTemplate;
    const emailBody = template
      .replace(/\{\{invoiceNumber\}\}/g, invoice.invoice_number)
      .replace(/\{\{total\}\}/g, formatCurrency(parseFloat(invoice.total), invoice.currency))
      .replace(/\{\{dueDate\}\}/g, formatDate(invoice.due_date))
      .replace(/\{\{clientName\}\}/g, invoice.client_name)
      .replace(/\{\{senderName\}\}/g, settings.smtp_from_name || 'Dodavatel');

    const subject = `Faktura č. ${invoice.invoice_number}`;

    // Generate PDF as base64
    const pdfBuffer = await generateInvoicePDF(req.params.id, req.userId!);
    const pdfBase64 = pdfBuffer.toString('base64');

    res.json({
      subject,
      emailBody,
      pdfBase64,
      recipients: {
        primary: invoice.primary_email,
        secondary: invoice.secondary_email
      }
    });
  } catch (error) {
    console.error('Preview invoice error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Send invoice via email
invoiceRouter.post('/:id/send', async (req: AuthRequest, res: Response) => {
  const { sendToSecondary = false, secondaryEmail, customMessage } = req.body;

  try {
    // Check invoice exists and is not draft
    const invoiceCheck = await query(
      `SELECT i.*, c.primary_email, c.secondary_email, c.company_name as client_name
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [req.params.id, req.userId]
    );

    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceCheck.rows[0];

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot send cancelled invoice' });
    }

    // Use provided secondary email or fall back to client's secondary email
    const effectiveSecondaryEmail = sendToSecondary
      ? (secondaryEmail || invoice.secondary_email)
      : null;

    // Send email
    const result = await sendInvoiceEmail(
      req.params.id,
      req.userId!,
      invoice.primary_email,
      effectiveSecondaryEmail,
      customMessage
    );

    if (result.success) {
      // Update invoice status to sent
      await query(
        `UPDATE invoices SET
          status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
          sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP),
          primary_email_sent_at = CURRENT_TIMESTAMP,
          secondary_email_sent_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE secondary_email_sent_at END,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [!!effectiveSecondaryEmail, req.params.id]
      );

      res.json({ message: 'Invoice sent successfully', sentTo: result.sentTo });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send invoice' });
    }
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// Mark invoice as paid manually
invoiceRouter.post('/:id/mark-paid',
  body('paidAt').optional().isISO8601(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paidAt } = req.body;

    try {
      const result = await query(
        `UPDATE invoices SET
          status = 'paid',
          paid_at = COALESCE($1, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3 AND status != 'cancelled'
         RETURNING *`,
        [paidAt, req.params.id, req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found or already cancelled' });
      }

      res.json({ message: 'Invoice marked as paid', invoice: result.rows[0] });
    } catch (error) {
      console.error('Mark paid error:', error);
      res.status(500).json({ error: 'Failed to mark invoice as paid' });
    }
  }
);

// Cancel invoice
invoiceRouter.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE invoices SET
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND status NOT IN ('paid')
       RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found or already paid' });
    }

    res.json({ message: 'Invoice cancelled', invoice: result.rows[0] });
  } catch (error) {
    console.error('Cancel invoice error:', error);
    res.status(500).json({ error: 'Failed to cancel invoice' });
  }
});
