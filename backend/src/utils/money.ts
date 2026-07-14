// Monetary values are computed in JS floats before landing in DECIMAL columns.
// Round every intermediate value to 2 decimals so line totals sum exactly to
// the subtotal and total === subtotal + vatAmount (no haléř drift).

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface LineItem {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
}

export function calculateLineTotal(item: LineItem): number {
  return roundMoney(item.quantity * item.unitPrice);
}

export function calculateInvoiceTotals(items: LineItem[], vatRate: number): InvoiceTotals {
  let subtotal = 0;
  for (const item of items) {
    subtotal = roundMoney(subtotal + calculateLineTotal(item));
  }
  const vatAmount = roundMoney(subtotal * (vatRate / 100));
  const total = roundMoney(subtotal + vatAmount);
  return { subtotal, vatAmount, total };
}
