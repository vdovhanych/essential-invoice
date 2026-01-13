import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/init.js';
import { AuthRequest } from '../middleware/auth.js';

export const clientRouter: ReturnType<typeof Router> = Router();

// Get all clients
clientRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM invoices WHERE client_id = c.id) as invoice_count,
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE client_id = c.id AND status = 'paid') as total_paid
       FROM clients c
       WHERE c.user_id = $1
       ORDER BY c.company_name ASC`,
      [req.userId]
    );

    const clients = result.rows.map(row => ({
      id: row.id,
      companyName: row.company_name,
      primaryEmail: row.primary_email,
      secondaryEmail: row.secondary_email,
      address: row.address,
      ico: row.ico,
      dic: row.dic,
      contactPerson: row.contact_person,
      contactPhone: row.contact_phone,
      notes: row.notes,
      invoiceCount: parseInt(row.invoice_count),
      totalPaid: parseFloat(row.total_paid),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

// Get single client
clientRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM clients WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      companyName: row.company_name,
      primaryEmail: row.primary_email,
      secondaryEmail: row.secondary_email,
      address: row.address,
      ico: row.ico,
      dic: row.dic,
      contactPerson: row.contact_person,
      contactPhone: row.contact_phone,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to get client' });
  }
});

// Get client invoices
clientRouter.get('/:id/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT i.*, c.company_name as client_name
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.client_id = $1 AND i.user_id = $2
       ORDER BY i.issue_date DESC`,
      [req.params.id, req.userId]
    );

    const invoices = result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      variableSymbol: row.variable_symbol,
      status: row.status,
      currency: row.currency,
      clientName: row.client_name,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      total: parseFloat(row.total),
      createdAt: row.created_at
    }));

    res.json(invoices);
  } catch (error) {
    console.error('Get client invoices error:', error);
    res.status(500).json({ error: 'Failed to get client invoices' });
  }
});

// Create client
clientRouter.post('/',
  body('companyName').trim().notEmpty(),
  body('primaryEmail').isEmail().normalizeEmail(),
  body('secondaryEmail').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { companyName, primaryEmail, secondaryEmail, address, ico, dic, contactPerson, contactPhone, notes } = req.body;

    try {
      const result = await query(
        `INSERT INTO clients (user_id, company_name, primary_email, secondary_email, address, ico, dic, contact_person, contact_phone, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [req.userId, companyName, primaryEmail, secondaryEmail || null, address, ico, dic, contactPerson, contactPhone, notes]
      );

      const row = result.rows[0];
      res.status(201).json({
        id: row.id,
        companyName: row.company_name,
        primaryEmail: row.primary_email,
        secondaryEmail: row.secondary_email,
        address: row.address,
        ico: row.ico,
        dic: row.dic,
        contactPerson: row.contact_person,
        contactPhone: row.contact_phone,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({ error: 'Failed to create client' });
    }
  }
);

// Update client
clientRouter.put('/:id',
  body('companyName').optional().trim().notEmpty(),
  body('primaryEmail').optional().isEmail().normalizeEmail(),
  body('secondaryEmail').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { companyName, primaryEmail, secondaryEmail, address, ico, dic, contactPerson, contactPhone, notes } = req.body;

    try {
      const result = await query(
        `UPDATE clients SET
          company_name = COALESCE($1, company_name),
          primary_email = COALESCE($2, primary_email),
          secondary_email = $3,
          address = $4,
          ico = $5,
          dic = $6,
          contact_person = $7,
          contact_phone = $8,
          notes = $9,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 AND user_id = $11
         RETURNING *`,
        [companyName, primaryEmail, secondaryEmail || null, address, ico, dic, contactPerson, contactPhone, notes, req.params.id, req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        companyName: row.company_name,
        primaryEmail: row.primary_email,
        secondaryEmail: row.secondary_email,
        address: row.address,
        ico: row.ico,
        dic: row.dic,
        contactPerson: row.contact_person,
        contactPhone: row.contact_phone,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({ error: 'Failed to update client' });
    }
  }
);

// Delete client
clientRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Check if client has invoices
    const invoiceCheck = await query(
      'SELECT COUNT(*) FROM invoices WHERE client_id = $1',
      [req.params.id]
    );

    if (parseInt(invoiceCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete client with existing invoices' });
    }

    const result = await query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});
