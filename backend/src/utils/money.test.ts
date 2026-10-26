import { describe, it, expect } from 'vitest';
import { roundMoney, calculateLineTotal, calculateInvoiceTotals, calculateInvoiceTax, summarizeStoredTax } from './money';

describe('roundMoney', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1.0);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('handles negative values', () => {
    expect(roundMoney(-1.005)).toBe(-1.0);
    expect(roundMoney(-2.499)).toBe(-2.5);
  });
});

describe('calculateLineTotal', () => {
  it('rounds quantity * unitPrice', () => {
    expect(calculateLineTotal({ quantity: 3, unitPrice: 0.1 })).toBe(0.3);
    expect(calculateLineTotal({ quantity: 1.5, unitPrice: 999.99 })).toBe(1499.99);
  });
});

describe('calculateInvoiceTotals', () => {
  it('computes subtotal, VAT and total for a simple invoice', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 2, unitPrice: 500 }, { quantity: 1, unitPrice: 250 }],
      21
    );
    expect(totals).toEqual({ subtotal: 1250, vatAmount: 262.5, total: 1512.5 });
  });

  it('keeps total exactly equal to subtotal + vatAmount with awkward floats', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 0.3, unitPrice: 3333.33 },
        { quantity: 1.7, unitPrice: 123.45 },
        { quantity: 3, unitPrice: 0.1 }
      ],
      21
    );
    // Independently calculated: 1000.00 + 209.87 + 0.30, then 21% VAT.
    expect(totals).toEqual({ subtotal: 1210.17, vatAmount: 254.14, total: 1464.31 });
  });

  it('handles 0% VAT (non-VAT payer)', () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 1000 }], 0);
    expect(totals).toEqual({ subtotal: 1000, vatAmount: 0, total: 1000 });
  });

  it('sums line totals consistently with per-item rounding', () => {
    const items = [
      { quantity: 1, unitPrice: 0.015 },
      { quantity: 1, unitPrice: 0.015 }
    ];
    const totals = calculateInvoiceTotals(items, 0);
    // Each 0.015 line rounds to 0.02; rounding the unrounded sum would give 0.03.
    expect(totals).toEqual({ subtotal: 0.04, vatAmount: 0, total: 0.04 });
  });
});


describe('per-line VAT', () => {
  it('separates standard zero, exempt, and reverse-charge groups', () => {
    const result = calculateInvoiceTax([
      { quantity: 1, unitPrice: 100, vatRate: 21 },
      { quantity: 1, unitPrice: 100, vatRate: 12 },
      { quantity: 1, unitPrice: 100, vatRate: 0 },
      { quantity: 1, unitPrice: 100, vatTreatment: 'exempt', vatReason: 'Law' },
      { quantity: 1, unitPrice: 100, vatTreatment: 'reverse_charge', vatRate: 21 },
    ], 21);
    expect(result).toMatchObject({ subtotal: 500, vatAmount: 33, total: 533 });
    expect(result.breakdown).toHaveLength(5);
    expect(result.lines.map(line => line.vatAmount)).toEqual([21, 12, 0, 0, 0]);
  });
  it('allocates sub-cent tax so lines reconcile with the rate total', () => {
    const result = calculateInvoiceTax(Array.from({ length: 100 }, () => ({ quantity: 1, unitPrice: 0.03, vatRate: 21 })), 0);
    expect(result.vatAmount).toBe(0.63);
    expect(roundMoney(result.lines.reduce((sum, item) => sum + item.vatAmount, 0))).toBe(0.63);
    expect(result.total).toBe(3.63);
  });
  it('retains legacy invoice-level rounding for omitted per-line rates', () => {
    const items = [{ quantity: 1, unitPrice: 0.03 }, { quantity: 1, unitPrice: 0.03 }];
    expect(calculateInvoiceTotals(items, 21)).toEqual({ subtotal: 0.06, vatAmount: 0.01, total: 0.07 });
  });
});


describe('stored invoice VAT', () => {
  it('keeps recorded amounts, including explicit zero, instead of recalculating historical invoices', () => {
    expect(summarizeStoredTax([
      { quantity: 1, unitPrice: 100, vatRate: 21, total: 100, vatAmount: 21.01 },
      { quantity: 1, unitPrice: 100, vatRate: 21, total: 0, vatAmount: 0 },
      { quantity: 1, unitPrice: 200, vatRate: 12, total: 200, vatAmount: 24 },
    ], 21)).toEqual([
      { vatRate: 21, vatTreatment: 'standard', base: 100, vatAmount: 21.01 },
      { vatRate: 12, vatTreatment: 'standard', base: 200, vatAmount: 24 },
    ]);
  });

  it('allocates each interleaved rate independently and preserves non-taxable treatments', () => {
    const result = calculateInvoiceTax([
      { quantity: 1, unitPrice: 0.03, vatRate: 21 },
      { quantity: 1, unitPrice: 0.03, vatRate: 12 },
      { quantity: 1, unitPrice: 0.03, vatRate: 21 },
      { quantity: 1, unitPrice: 0.03, vatRate: 12 },
      { quantity: 1, unitPrice: 100, vatRate: 21, vatTreatment: 'eu_service' },
      { quantity: 1, unitPrice: 100, vatRate: 21, vatTreatment: 'reverse_charge' },
    ], 21);
    expect(result.lines.map(line => line.vatAmount)).toEqual([0.01, 0, 0, 0.01, 0, 0]);
    expect(result.breakdown).toEqual([
      { vatRate: 21, vatTreatment: 'standard', base: 0.06, vatAmount: 0.01 },
      { vatRate: 12, vatTreatment: 'standard', base: 0.06, vatAmount: 0.01 },
      { vatRate: 0, vatTreatment: 'eu_service', base: 100, vatAmount: 0 },
      { vatRate: 21, vatTreatment: 'reverse_charge', base: 100, vatAmount: 0 },
    ]);
    expect(result).toMatchObject({ subtotal: 200.12, vatAmount: 0.02, total: 200.14 });
  });
});
