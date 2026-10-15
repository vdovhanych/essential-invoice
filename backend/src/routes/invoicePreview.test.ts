import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { invoicePreviewRouter } from './invoicePreview';
import { query } from '../db/init';
import { renderInvoicePDF } from '../services/pdfGenerator';
import { convertEurToCzk } from '../services/cnbExchangeRate';

vi.mock('../db/init', () => ({ query: vi.fn() }));
vi.mock('../services/pdfGenerator', () => ({ renderInvoicePDF: vi.fn(async () => Buffer.from('%PDF-preview')) }));
vi.mock('../services/cnbExchangeRate', () => ({ convertEurToCzk: vi.fn() }));

const clientId = '12345678-1234-4234-8234-123456789abc';
const invoiceId = '12345678-1234-4234-8234-123456789def';
const user = { name: 'Supplier', company_name: 'Supplier Ltd', language: 'en', vat_payer: true, bank_account: '19-2000145399', bank_code: '0800' };
const result = (rows: unknown[]) => ({ rows } as any);
const draft = {
  issueDate: '2026-10-09', dueDate: '2026-10-23', currency: 'CZK', vatRate: 21,
  items: [{ description: 'Consulting', quantity: 3, unitPrice: 0.1, unit: 'h' }],
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).userId = 'owner'; next(); });
app.use('/preview', invoicePreviewRouter);

describe('unsaved invoice preview', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(query).mockReset(); });

  it('uses server totals and draft placeholders without allocating a number or writing invoices', async () => {
    vi.mocked(query).mockResolvedValueOnce(result([user]));
    const response = await request(app).post('/preview').send({ ...draft, total: 999, invoiceNumber: 'untrusted' }).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Buffer.from(response.body.pdfBase64, 'base64').toString()).toBe('%PDF-preview');
    expect(renderInvoicePDF).toHaveBeenCalledWith(expect.objectContaining({
      invoiceNumber: 'DRAFT', draftPreview: true, qrPaymentData: '', clientName: 'Select a customer',
      userCompanyName: 'Supplier Ltd', subtotal: 0.3, vatAmount: 0.06, total: 0.36,
    }));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), ['owner']);
  });

  it('allows incomplete drafts and keeps missing dates as placeholders', async () => {
    vi.mocked(query).mockResolvedValueOnce(result([{ ...user, vat_payer: false, language: 'cs' }]));
    await request(app).post('/preview').send({ clientId: '', issueDate: '', dueDate: '', vatRate: 0,
      items: [{ description: '', quantity: 0, unitPrice: 0 }] }).expect(200);
    expect(renderInvoicePDF).toHaveBeenCalledWith(expect.objectContaining({
      invoiceNumber: 'NÁVRH', issueDate: null, dueDate: null, userVatPayer: false, total: 0,
      items: [expect.objectContaining({ description: 'Popis položky' })],
    }));
  });

  it.each([
    { currency: 'USD' }, { issueDate: '2026-02-30' }, { clientId: 'bad' }, { invoiceId: 'bad' },
    { items: [{ description: 'Bad', quantity: -1, unitPrice: 10 }] },
    { items: [{ description: 'Bad', quantity: 1, unitPrice: 'Infinity' }] },
    { items: [{ description: 'Bad', quantity: 1, unitPrice: 1, vatTreatment: 'invalid' }] },
    { items: Array(501).fill(draft.items[0]) },
  ])('rejects invalid values before loading user data (case %#)', async (overrides) => {
    await request(app).post('/preview').send({ ...draft, ...overrides }).expect(400);
    expect(query).not.toHaveBeenCalled();
    expect(renderInvoicePDF).not.toHaveBeenCalled();
  });

  it('rejects another user’s client', async () => {
    vi.mocked(query).mockResolvedValueOnce(result([user])).mockResolvedValueOnce(result([]));
    await request(app).post('/preview').send({ ...draft, clientId }).expect(404);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('user_id = $2'), [clientId, 'owner']);
    expect(renderInvoicePDF).not.toHaveBeenCalled();
  });

  it('rejects another user’s invoice', async () => {
    vi.mocked(query).mockResolvedValueOnce(result([user])).mockResolvedValueOnce(result([]));
    await request(app).post('/preview').send({ ...draft, invoiceId }).expect(404);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('user_id = $2'), [invoiceId, 'owner']);
    expect(renderInvoicePDF).not.toHaveBeenCalled();
  });

  it('retains an owned invoice number and generates its QR with the updated total', async () => {
    vi.mocked(query).mockResolvedValueOnce(result([user]))
      .mockResolvedValueOnce(result([{ company_name: 'Customer' }]))
      .mockResolvedValueOnce(result([{ invoice_number: 'INV20261001', variable_symbol: '20261001' }]));
    await request(app).post('/preview').send({ ...draft, clientId, invoiceId }).expect(200);
    expect(renderInvoicePDF).toHaveBeenCalledWith(expect.objectContaining({
      invoiceNumber: 'INV20261001', draftPreview: false, clientName: 'Customer',
      qrPaymentData: expect.stringContaining('AM:0.36'),
    }));
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('uses mixed VAT treatments and the shared EUR conversion', async () => {
    vi.mocked(query).mockResolvedValueOnce(result([user]));
    vi.mocked(convertEurToCzk).mockResolvedValueOnce({ rate: 25, czkAmount: 14075, rateDate: '2026-10-09' });
    await request(app).post('/preview').send({ ...draft, currency: 'EUR', items: [
      { description: 'Standard', quantity: 1, unitPrice: 300, vatRate: 21 },
      { description: 'Exempt', quantity: 1, unitPrice: 200, vatTreatment: 'exempt', vatReason: 'Exempt reason' },
    ] }).expect(200);
    expect(convertEurToCzk).toHaveBeenCalledWith(563, '2026-10-09');
    expect(renderInvoicePDF).toHaveBeenCalledWith(expect.objectContaining({ total: 563, vatAmount: 63, exchangeRate: 25, totalCzk: 14075, qrPaymentData: '' }));
  });
});
