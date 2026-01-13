import { Router, Response } from 'express';
import { query } from '../db/init.js';
import { AuthRequest } from '../middleware/auth.js';

export const settingsRouter: ReturnType<typeof Router> = Router();

// Get settings
settingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM settings WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      // Create default settings
      await query('INSERT INTO settings (user_id) VALUES ($1)', [req.userId]);
      return res.json({
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpSecure: true,
        smtpFromEmail: null,
        smtpFromName: null,
        imapHost: null,
        imapPort: 993,
        imapUser: null,
        imapTls: true,
        bankNotificationEmail: null,
        emailPollingInterval: 300,
        invoiceNumberPrefix: '',
        invoiceNumberFormat: 'YYYYMM##',
        defaultVatRate: 21,
        defaultPaymentTerms: 14,
        emailTemplate: null
      });
    }

    const settings = result.rows[0];
    res.json({
      smtpHost: settings.smtp_host,
      smtpPort: settings.smtp_port,
      smtpUser: settings.smtp_user,
      smtpPasswordSet: !!settings.smtp_password,
      smtpSecure: settings.smtp_secure,
      smtpFromEmail: settings.smtp_from_email,
      smtpFromName: settings.smtp_from_name,
      imapHost: settings.imap_host,
      imapPort: settings.imap_port,
      imapUser: settings.imap_user,
      imapPasswordSet: !!settings.imap_password,
      imapTls: settings.imap_tls,
      bankNotificationEmail: settings.bank_notification_email,
      emailPollingInterval: settings.email_polling_interval,
      invoiceNumberPrefix: settings.invoice_number_prefix,
      invoiceNumberFormat: settings.invoice_number_format,
      defaultVatRate: parseFloat(settings.default_vat_rate),
      defaultPaymentTerms: settings.default_payment_terms,
      emailTemplate: settings.email_template
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
settingsRouter.put('/', async (req: AuthRequest, res: Response) => {
  const {
    smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, smtpFromEmail, smtpFromName,
    imapHost, imapPort, imapUser, imapPassword, imapTls,
    bankNotificationEmail, emailPollingInterval,
    invoiceNumberPrefix, invoiceNumberFormat,
    defaultVatRate, defaultPaymentTerms,
    emailTemplate
  } = req.body;

  try {
    // Build update query dynamically to only update provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const addUpdate = (field: string, value: any) => {
      if (value !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(value);
      }
    };

    addUpdate('smtp_host', smtpHost);
    addUpdate('smtp_port', smtpPort);
    addUpdate('smtp_user', smtpUser);
    if (smtpPassword) addUpdate('smtp_password', smtpPassword); // Only update if provided
    addUpdate('smtp_secure', smtpSecure);
    addUpdate('smtp_from_email', smtpFromEmail);
    addUpdate('smtp_from_name', smtpFromName);
    addUpdate('imap_host', imapHost);
    addUpdate('imap_port', imapPort);
    addUpdate('imap_user', imapUser);
    if (imapPassword) addUpdate('imap_password', imapPassword); // Only update if provided
    addUpdate('imap_tls', imapTls);
    addUpdate('bank_notification_email', bankNotificationEmail);
    addUpdate('email_polling_interval', emailPollingInterval);
    addUpdate('invoice_number_prefix', invoiceNumberPrefix);
    addUpdate('invoice_number_format', invoiceNumberFormat);
    addUpdate('default_vat_rate', defaultVatRate);
    addUpdate('default_payment_terms', defaultPaymentTerms);
    addUpdate('email_template', emailTemplate);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.userId);

    const sql = `
      UPDATE settings
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Test SMTP connection
settingsRouter.post('/test-smtp', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure, smtp_from_email FROM settings WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].smtp_host) {
      return res.status(400).json({ error: 'SMTP not configured' });
    }

    const settings = result.rows[0];

    // Dynamic import for nodemailer
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password
      }
    });

    await transporter.verify();
    res.json({ message: 'SMTP connection successful' });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    res.status(500).json({ error: `SMTP test failed: ${error.message}` });
  }
});

// Test IMAP connection
settingsRouter.post('/test-imap', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT imap_host, imap_port, imap_user, imap_password, imap_tls FROM settings WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].imap_host) {
      return res.status(400).json({ error: 'IMAP not configured' });
    }

    const settings = result.rows[0];

    const Imap = (await import('imap')).default;

    const imap = new Imap({
      user: settings.imap_user,
      password: settings.imap_password,
      host: settings.imap_host,
      port: settings.imap_port,
      tls: settings.imap_tls
    });

    await new Promise<void>((resolve, reject) => {
      imap.once('ready', () => {
        imap.end();
        resolve();
      });
      imap.once('error', reject);
      imap.connect();
    });

    res.json({ message: 'IMAP connection successful' });
  } catch (error: any) {
    console.error('IMAP test error:', error);
    res.status(500).json({ error: `IMAP test failed: ${error.message}` });
  }
});
