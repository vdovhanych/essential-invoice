import { describe, it, expect } from 'vitest';
import { roundMoney, calculateLineTotal, calculateInvoiceTotals } from './money';

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
    expect(totals.total).toBe(roundMoney(totals.subtotal + totals.vatAmount));
    // every value has at most 2 decimals
    for (const value of Object.values(totals)) {
      expect(value).toBe(roundMoney(value));
    }
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
    const summedLines = items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
    expect(totals.subtotal).toBe(roundMoney(summedLines));
  });
});
