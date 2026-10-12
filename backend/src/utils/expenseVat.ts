import { roundMoney } from './money';
export function expenseVatBreakdown(
  value: unknown,
): { rate: number; base: number; tax: number }[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50)
    throw new Error('Invalid VAT breakdown');
  return value.map((b) => {
    if (
      !b ||
      ![b.rate, b.base, b.tax].every(
        (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
      ) ||
      b.rate > 100 ||
      roundMoney(b.rate) !== b.rate ||
      b.base > 9999999999 ||
      b.tax > 9999999999 ||
      roundMoney(b.base) !== b.base ||
      roundMoney(b.tax) !== b.tax
    )
      throw new Error('Invalid VAT breakdown');
    return { rate: b.rate, base: b.base, tax: b.tax };
  });
}
export function expenseVatTotals(
  buckets: ReturnType<typeof expenseVatBreakdown>,
) {
  const amount = roundMoney(buckets.reduce((sum, b) => sum + b.base, 0));
  const vatAmount = roundMoney(buckets.reduce((sum, b) => sum + b.tax, 0));
  return { amount, vatAmount, total: roundMoney(amount + vatAmount) };
}
