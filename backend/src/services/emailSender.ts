import nodemailer from 'nodemailer';
import { query } from '../db/init';
import { generateInvoicePDF } from './pdfGenerator';
import { decrypt } from '../utils/encryption';
import { t, formatDateLocale, formatCurrencyLocale } from '../i18n/translations';

interface SendResult {
  success: boolean;
  sentTo?: string[];
  error?: string;
}

export async function sendInvoiceEmail(
  invoiceId: string,
  userId: string,
  primaryEmail: string,
  secondaryEmail: string | null,
  customMessage?: string
): Promise<SendResult> {
  try {
    // Get user settings
    const settingsResult = await query(
      'SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure, smtp_from_email, smtp_from_name, email_template FROM settings WHERE user_id = $1',
      [userId]
    );

    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].smtp_host) {
      return { success: false, error: 'SMTP not configured' };
    }

    const settings = settingsResult.rows[0];

    // Get user language
    const userResult = await query('SELECT language FROM users WHERE id = $1', [userId]);
    const language = userResult.rows[0]?.language || 'cs';
    const tr = t(language).email;

    // Get invoice details
    const invoiceResult = await query(
      `SELECT i.invoice_number, i.total, i.currency, i.due_date, c.company_name as client_name
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1`,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      return { success: false, error: 'Invoice not found' };
    }

    const invoice = invoiceResult.rows[0];

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceId, userId);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: {
        user: settings.smtp_user,
        pass: decrypt(settings.smtp_password)
      }
    });

    // Build email content
    const template = customMessage || settings.email_template || tr.defaultTemplate;
    const emailBody = template
      .replace(/\{\{invoiceNumber\}\}/g, invoice.invoice_number)
      .replace(/\{\{total\}\}/g, formatCurrencyLocale(parseFloat(invoice.total), invoice.currency, language))
      .replace(/\{\{dueDate\}\}/g, formatDateLocale(invoice.due_date, language))
      .replace(/\{\{clientName\}\}/g, invoice.client_name)
      .replace(/\{\{senderName\}\}/g, settings.smtp_from_name || tr.supplierFallback);

    const subject = tr.invoiceSubject.replace('{{number}}', invoice.invoice_number);
    const sentTo: string[] = [];

    // Send to primary email
    await transporter.sendMail({
      from: settings.smtp_from_name
        ? `"${settings.smtp_from_name}" <${settings.smtp_from_email}>`
        : settings.smtp_from_email,
      to: primaryEmail,
      subject,
      text: emailBody,
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
    sentTo.push(primaryEmail);

    // Log email
    await query(
      `INSERT INTO email_logs (user_id, invoice_id, email_type, recipient_email, subject, status, sent_at)
       VALUES ($1, $2, 'invoice_sent', $3, $4, 'sent', CURRENT_TIMESTAMP)`,
      [userId, invoiceId, primaryEmail, subject]
    );

    // Send to secondary email if provided
    if (secondaryEmail) {
      await transporter.sendMail({
        from: settings.smtp_from_name
          ? `"${settings.smtp_from_name}" <${settings.smtp_from_email}>`
          : settings.smtp_from_email,
        to: secondaryEmail,
        subject,
        text: emailBody,
        attachments: [
          {
            filename: `${invoice.invoice_number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
      sentTo.push(secondaryEmail);

      // Log secondary email
      await query(
        `INSERT INTO email_logs (user_id, invoice_id, email_type, recipient_email, subject, status, sent_at)
         VALUES ($1, $2, 'invoice_sent', $3, $4, 'sent', CURRENT_TIMESTAMP)`,
        [userId, invoiceId, secondaryEmail, subject]
      );
    }

    return { success: true, sentTo };
  } catch (error: any) {
    console.error('Send email error:', error);

    // Log failed attempt
    try {
      await query(
        `INSERT INTO email_logs (user_id, invoice_id, email_type, recipient_email, status, error_message)
         VALUES ($1, $2, 'invoice_sent', $3, 'failed', $4)`,
        [userId, invoiceId, primaryEmail, error.message]
      );
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }

    return { success: false, error: error.message };
  }
}
