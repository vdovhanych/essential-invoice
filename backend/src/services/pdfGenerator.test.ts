import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QRCode from 'qrcode';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
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

// Observe the renderer boundary without replacing document construction or PDF
// generation. Inspect a copy before pdfmake mutates its input during layout.
const pdfmake: { createPdf: (definition: TDocumentDefinitions) => { getBuffer: () => Promise<Uint8Array> } } = require('pdfmake/build/pdfmake.js');
// Select the promise overload (qrcode also exposes a callback overload).
const mockQRCode = vi.mocked(QRCode.toDataURL as (text: string, options: object) => Promise<string>);
let renderedContent: unknown;
function valuesForKey(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([name, child]) => [
    ...(name === key ? [child] : []), ...valuesForKey(child, key),
  ]);
}
function renderedText(): string {
  return valuesForKey(renderedContent, 'text').flat().join(' ').replace(/\s+/g, ' ');
}

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
    vi.resetAllMocks();
    mockQRCode.mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    renderedContent = undefined;
    const createPdf = pdfmake.createPdf.bind(pdfmake);
    vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition) => {
      renderedContent = JSON.parse(JSON.stringify(definition.content));
      return createPdf(definition);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('should return a valid PDF buffer starting with %PDF', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow()]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(renderedText()).toContain('FV2024001');
    expect(renderedText()).toContain('Test Klient s.r.o.');
    expect(renderedText()).toContain('Vývoj webové aplikace');
    expect(renderedText()).toContain('12 100,00');
    expect(renderedText()).toContain('192000145399/0800');
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringMatching(/WHERE i.id = \$1 AND i.user_id = \$2/), ['inv-1', 'user-1']);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF for CZK invoice with QR code', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow()]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(QRCode.toDataURL).toHaveBeenCalledExactlyOnceWith(makeInvoiceRow().qr_payment_data, expect.any(Object));
    expect(valuesForKey(renderedContent, 'image')).toHaveLength(1);
    expect(buffer.toString('latin1')).toContain('/Subtype /Image');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF for EUR invoice without QR code', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({ currency: 'EUR', qr_payment_data: 'stale-CZK-QR', exchange_rate: '25.1234', total_czk: '303993.14' })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(renderedText()).toContain('25.1234 CZK/EUR');
    expect(renderedText()).toContain('303 993,14');
    expect(QRCode.toDataURL).not.toHaveBeenCalled();
    expect(valuesForKey(renderedContent, 'image')).toEqual([]);
    expect(buffer.toString('latin1')).not.toContain('/Subtype /Image');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF with notes', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({ notes: 'Děkujeme za spolupráci.' })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(renderedText()).toContain('Děkujeme za spolupráci.');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should generate PDF with logo', async () => {
    // 1x1 transparent PNG as base64
    const logoPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({
        qr_payment_data: null,
        user_logo_data: logoPng,
        user_logo_mime_type: 'image/png',
      })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    const buffer = await generateInvoicePDF('inv-1', 'user-1');

    expect(valuesForKey(renderedContent, 'image')).toEqual([`data:image/png;base64,${logoPng}`]);
    expect(buffer.toString('latin1')).toContain('/Subtype /Image');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });


  it('omits supplier VAT identification and tax rows for a non-VAT payer', async () => {
    mockQuery
      .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow({
        user_vat_payer: false, vat_rate: '0', vat_amount: '0', total: '10000.00', qr_payment_data: null,
      })]))
      .mockResolvedValueOnce(mockQueryResult(makeItemRows()));
    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    await generateInvoicePDF('inv-1', 'user-1');
    expect(renderedText()).toContain('Neplátce DPH');
    expect(renderedText()).not.toContain('CZ87654321');
    expect(renderedText()).not.toContain('DPH (');
    expect(renderedText()).toContain('CZ12345678'); // customer's identification remains
    expect(renderedText()).toContain('10 000,00');
  });

  it('still renders payment details on QR failure and retries QR on the next invoice', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockQRCode.mockRejectedValueOnce(new Error('QR unavailable'));
    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    for (const qrAvailable of [false, true]) {
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([makeInvoiceRow()]))
        .mockResolvedValueOnce(mockQueryResult(makeItemRows()));
      const buffer = await generateInvoicePDF('inv-1', 'user-1');
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(renderedText()).toContain('192000145399/0800');
      expect(renderedText()).toContain('12 100,00');
      expect(valuesForKey(renderedContent, 'image')).toHaveLength(qrAvailable ? 1 : 0);
    }
    expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
  });

  it('should throw when invoice is not found', async () => {
    mockQuery.mockResolvedValueOnce(mockQueryResult([]));

    const { generateInvoicePDF } = await import('./pdfGenerator.js');
    await expect(generateInvoicePDF('missing', 'user-1')).rejects.toThrow('Invoice not found');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(pdfmake.createPdf).not.toHaveBeenCalled();
    expect(QRCode.toDataURL).not.toHaveBeenCalled();
  });
});
