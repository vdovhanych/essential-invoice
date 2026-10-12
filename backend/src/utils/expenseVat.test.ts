import { expect, it } from 'vitest';
import { expenseVatBreakdown, expenseVatTotals } from './expenseVat';
it('preserves supplier-recorded rounding instead of recomputing tax from rate', () => {
  const b = expenseVatBreakdown([
    { rate: 21, base: 100.01, tax: 21.01 },
    { rate: 12, base: 50, tax: 6 },
  ]);
  expect(expenseVatTotals(b)).toEqual({
    amount: 150.01,
    vatAmount: 27.01,
    total: 177.02,
  });
});
it('rejects negative, missing, nonfinite and sub-cent recorded amounts', () => {
  for (const b of [
    [],
    [{ rate: 21, base: 1, tax: -1 }],
    [{ rate: 21, base: 1, tax: NaN }],
    [{ rate: 21, base: 1, tax: 0.001 }],
    [{ rate: 21, base: '1', tax: 0 }],
  ])
    expect(() => expenseVatBreakdown(b)).toThrow();
});
