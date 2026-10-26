import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { query } from '../db/init';
import { generateInvoicePDF } from './pdfGenerator';
import { sendInvoiceEmail } from './emailSender';

const smtp = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => smtp) } }));
vi.mock('../db/init', () => ({ query: vi.fn() }));
vi.mock('./pdfGenerator', () => ({ generateInvoicePDF: vi.fn() }));
vi.mock('../utils/encryption', () => ({ decrypt: vi.fn(() => 'decrypted-password') }));

const pdf = Buffer.from('%PDF-test-attachment');
const settings = {
  smtp_host: 'smtp.example.test', smtp_port: 587, smtp_secure: false,
  smtp_user: 'smtp-user', smtp_password: 'encrypted',
  smtp_from_email: 'supplier@example.test', smtp_from_name: 'Supplier',
  email_template: '{{clientName}}: {{invoiceNumber}} / {{invoiceNumber}} / {{total}} / {{dueDate}} / {{senderName}}',
};

// Exercise the real orchestration/template/attachment logic. Only I/O boundaries are mocked.
describe('invoice email delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    smtp.sendMail.mockResolvedValue({ messageId: 'accepted' });
    vi.mocked(generateInvoicePDF).mockResolvedValue(pdf);
    vi.mocked(query).mockImplementation(async sql => {
      if (sql.includes('FROM settings')) return { rows: [settings] } as any;
      if (sql.includes('FROM users')) return { rows: [{ language: 'en' }] } as any;
      if (sql.includes('FROM invoices')) return { rows: [{
        invoice_number: 'FV-42', total: '121.01', currency: 'EUR', due_date: new Date(2026, 8, 15), client_name: 'Client & Co',
      }] } as any;
      return { rows: [] } as any;
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('sends the actual generated attachment and substituted message separately to both recipients', async () => {
    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', 'secondary@example.test'))
      .resolves.toEqual({ success: true, sentTo: ['primary@example.test', 'secondary@example.test'] });
    expect(generateInvoicePDF).toHaveBeenCalledExactlyOnceWith('invoice-42', 'owner');
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test', port: 587, secure: false, auth: { user: 'smtp-user', pass: 'decrypted-password' },
    });
    expect(smtp.sendMail).toHaveBeenCalledTimes(2);
    for (const [index, recipient] of ['primary@example.test', 'secondary@example.test'].entries()) {
      expect(smtp.sendMail).toHaveBeenNthCalledWith(index + 1, {
        from: '"Supplier" <supplier@example.test>', to: recipient, subject: 'Invoice No. FV-42',
        text: 'Client & Co: FV-42 / FV-42 / 121.01 € / 9/15/2026 / Supplier',
        attachments: [{ filename: 'FV-42.pdf', content: pdf, contentType: 'application/pdf' }],
      });
    }
    const logs = vi.mocked(query).mock.calls.filter(([sql]) => sql.includes('INSERT INTO email_logs'));
    expect(logs.map(([, params]) => params)).toEqual([
      ['owner', 'invoice-42', 'primary@example.test', 'Invoice No. FV-42'],
      ['owner', 'invoice-42', 'secondary@example.test', 'Invoice No. FV-42'],
    ]);
  });

  it('uses the edited subject and message rather than silently reverting to the saved template', async () => {
    await sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', null, 'Edited {{invoiceNumber}} for {{clientName}}', 'Edited subject');
    expect(smtp.sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      subject: 'Edited subject', text: 'Edited FV-42 for Client & Co', to: 'primary@example.test',
    }));
  });

  it('does not render or send when SMTP is missing', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);
    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', null))
      .resolves.toEqual({ success: false, error: 'SMTP not configured' });
    expect(generateInvoicePDF).not.toHaveBeenCalled();
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('does not send or log success when PDF generation fails', async () => {
    vi.mocked(generateInvoicePDF).mockRejectedValueOnce(new Error('Invoice not found'));
    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', null))
      .resolves.toEqual({ success: false, error: 'Invoice not found' });
    expect(smtp.sendMail).not.toHaveBeenCalled();
    const logs = vi.mocked(query).mock.calls.filter(([sql]) => sql.includes('INSERT INTO email_logs'));
    expect(logs).toEqual([[expect.stringContaining("'failed'"), ['owner', 'invoice-42', 'primary@example.test', 'Invoice not found']]]);
  });

  it('stops on primary SMTP failure and can retry without leaking recipients from the failed attempt', async () => {
    smtp.sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', 'secondary@example.test'))
      .resolves.toEqual({ success: false, error: 'SMTP unavailable' });
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("'failed'"), ['owner', 'invoice-42', 'primary@example.test', 'SMTP unavailable']);

    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', 'secondary@example.test'))
      .resolves.toEqual({ success: true, sentTo: ['primary@example.test', 'secondary@example.test'] });
    expect(smtp.sendMail.mock.calls.map(([mail]) => mail.to)).toEqual(['primary@example.test', 'primary@example.test', 'secondary@example.test']);
    const successLogs = vi.mocked(query).mock.calls.filter(([sql]) => sql.includes("'sent', CURRENT_TIMESTAMP"));
    expect(successLogs).toHaveLength(2);
  });

  it('returns the delivery error even if writing its failure log also fails', async () => {
    smtp.sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const originalQuery = vi.mocked(query).getMockImplementation()!;
    vi.mocked(query).mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO email_logs')) throw new Error('Log database unavailable');
      return originalQuery(sql, params);
    });
    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', null))
      .resolves.toEqual({ success: false, error: 'SMTP unavailable' });
  });

  it('preserves the successful primary log and attributes a secondary SMTP failure to the secondary recipient', async () => {
    smtp.sendMail.mockResolvedValueOnce({ messageId: 'primary-accepted' }).mockRejectedValueOnce(new Error('Secondary rejected'));
    await expect(sendInvoiceEmail('invoice-42', 'owner', 'primary@example.test', 'secondary@example.test'))
      .resolves.toEqual({ success: false, error: 'Secondary rejected' });
    expect(smtp.sendMail).toHaveBeenCalledTimes(2);
    const logs = vi.mocked(query).mock.calls.filter(([sql]) => sql.includes('INSERT INTO email_logs'));
    expect(logs).toEqual([
      [expect.stringContaining("'sent', CURRENT_TIMESTAMP"), ['owner', 'invoice-42', 'primary@example.test', 'Invoice No. FV-42']],
      [expect.stringContaining("'failed'"), ['owner', 'invoice-42', 'secondary@example.test', 'Secondary rejected']],
    ]);
  });

});
