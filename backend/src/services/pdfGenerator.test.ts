import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbInit from '../db/init';

// Mock database query
vi.mock('../db/init.js', () => ({
  query: vi.fn(),
}));

// Mock qrcode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  },
}));

const mockQuery = vi.mocked(dbInit.query);

function makeInvoiceRow(overrides: Record<string, any> = {}) {
  return {
    id: 'inv-1',
    invoice_number: 'FV2024001',
    variable_symbol: '2024001',
    status: 'sent',
    currency: 'CZK',
    issue_date: new Date('2024-01-15'),
    due_date: new Date('2024-02-15'),
    delivery_date: new Date('2024-01-15'),
    subtotal: '10000.00',
    vat_rate: '21',
    vat_amount: '2100.00',
    total: '12100.00',
    notes: null,
    qr_payment_data: 'SPD*1.0*ACC:CZ6508000000192000145399*AM:12100.00*CC:CZK*MSG:Faktura FV2024001*X-VS:2024001',
    client_name: 'Test Klient s.r.o.',
    client_address: 'Testovací 123, Praha 1',
    client_ico: '12345678',
    client_dic: 'CZ12345678',
    user_name: 'Jan Novák',
    user_company_name: 'Novák IT',
    user_address: 'Dodavatelská 456, Brno',
    user_ico: '87654321',
    user_dic: 'CZ87654321',
    user_bank_account: '192000145399',
    user_bank_code: '0800',
    user_logo_data: null,
    user_logo_mime_type: null,
    ...overrides,
  };
}

function makeItemRows() {
  return [
    {
      description: 'Vývoj webové aplikace',
      quantity: '40',
      unit: 'hod',
      unit_price: '200.00',
      total: '8000.00',
      sort_order: 1,
    },
    {
      description: 'Konzultace',
      quantity: '10',
      unit: 'hod',
      unit_price: '200.00',
      total: '2000.00',
      sort_order: 2,
    },
  ];
}

const mockQueryResult = (rows: any[]) => ({
  rows,
  rowCount: rows.length,
  command: 'SELECT' as const,
  oid: 0,
  fields: [],
});

describe('generateInvoicePDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a valid PDF buffer starting with %PDF', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow()]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF for CZK invoice with QR code', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow()]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF for EUR invoice without QR code', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({ currency: 'EUR', qr_payment_data: null })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF with notes', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({ notes: 'Děkujeme za spolupráci.' })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF with logo', async () => {
    // 1x1 transparent PNG as base64
    const logoPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({
        user_logo_data: logoPng,
        user_logo_mime_type: 'image/png',
      })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should throw when invoice is not found', async () => {
    mockQuery.mockResolvedValueOnce(mockQueryResult([]));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    await expect(generateInvoicePDF('missing', 'user-1')).rejects.toThrow('Invoice not found');
  });
});
