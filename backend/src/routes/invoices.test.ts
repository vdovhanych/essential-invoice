import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { invoiceRouter } from './invoices';
import * as db from '../db/init';
import * as emailSender from '../services/emailSender';

const mockClient = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn()
}));

vi.mock('../db/init.js', () => ({
  query: vi.fn(),
  pool: {
    connect: vi.fn(async () => mockClient)
  }
}));

vi.mock('../services/emailSender.js', () => ({
  sendInvoiceEmail: vi.fn()
}));

vi.mock('../services/pdfGenerator.js', () => ({
  generateInvoicePDF: vi.fn(async () => Buffer.from('pdf'))
}));

vi.mock('../services/cnbExchangeRate.js', () => ({
  convertEurToCzk: vi.fn()
}));

const mockAuthMiddleware = (req: any, _res: any, next: any) => {
  req.userId = 'test-user-id';
  next();
};

function invoiceRow(status: string) {
  return {
    id: 'invoice-123',
    user_id: 'test-user-id',
    status,
    total: '141900.00',
    currency: 'CZK',
    invoice_number: 'F20260101',
    primary_email: 'faktury@example.com',
    secondary_email: null,
    client_name: 'Trezor Company s.r.o.'
  };
}

function mockQueryResult(rows: any[]) {
  return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] } as any;
}

describe('Invoice Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);
    app.use('/invoices', invoiceRouter);
    vi.clearAllMocks();
  });

  describe('POST /invoices/:id/send', () => {
    it('refuses to send a paid invoice and sends no email', async () => {
      vi.mocked(db.query).mockResolvedValueOnce(mockQueryResult([invoiceRow('paid')]));

      const response = await request(app).post('/invoices/invoice-123/send').send({}).expect(400);

      expect(response.body).toEqual({ error: 'Cannot send an invoice that is already paid' });
      expect(emailSender.sendInvoiceEmail).not.toHaveBeenCalled();
      // the guard must return before any status write
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('refuses to send a cancelled invoice and sends no email', async () => {
      vi.mocked(db.query).mockResolvedValueOnce(mockQueryResult([invoiceRow('cancelled')]));

      const response = await request(app).post('/invoices/invoice-123/send').send({}).expect(400);

      expect(response.body).toEqual({ error: 'Cannot send cancelled invoice' });
      expect(emailSender.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('returns 404 for an invoice that does not belong to the user', async () => {
      vi.mocked(db.query).mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app).post('/invoices/invoice-123/send').send({}).expect(404);

      expect(response.body).toEqual({ error: 'Invoice not found' });
      expect(emailSender.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('still sends a draft invoice', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce(mockQueryResult([invoiceRow('draft')]))
        .mockResolvedValueOnce(mockQueryResult([]));
      vi.mocked(emailSender.sendInvoiceEmail).mockResolvedValueOnce({
        success: true,
        sentTo: ['faktury@example.com']
      } as any);

      const response = await request(app).post('/invoices/invoice-123/send').send({}).expect(200);

      expect(response.body.message).toBe('Invoice sent successfully');
      expect(emailSender.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    });

    it('still sends an already-sent invoice (resend of an unpaid invoice)', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce(mockQueryResult([invoiceRow('sent')]))
        .mockResolvedValueOnce(mockQueryResult([]));
      vi.mocked(emailSender.sendInvoiceEmail).mockResolvedValueOnce({
        success: true,
        sentTo: ['faktury@example.com']
      } as any);

      await request(app).post('/invoices/invoice-123/send').send({}).expect(200);

      expect(emailSender.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    });

    it('still sends an overdue invoice', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce(mockQueryResult([invoiceRow('overdue')]))
        .mockResolvedValueOnce(mockQueryResult([]));
      vi.mocked(emailSender.sendInvoiceEmail).mockResolvedValueOnce({
        success: true,
        sentTo: ['faktury@example.com']
      } as any);

      await request(app).post('/invoices/invoice-123/send').send({}).expect(200);

      expect(emailSender.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    });
  });
});
