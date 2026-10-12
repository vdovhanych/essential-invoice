import { roundMoney } from '../utils/money';
import { createHash } from 'node:crypto';
import { documentDate } from './invoiceDocument';
import type { FilingDocument, FilingSnapshot } from './vatFilingTypes';

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const fingerprint = (value: unknown) =>
  createHash('sha256').update(stableJson(value)).digest('hex');
const date = (v: any) => (v ? documentDate(v) : '');
export function normalizeDocument(
  row: any,
  direction: 'issued' | 'received',
): FilingDocument {
  const lines = (row.lines || []).map((i: any) => ({
    treatment: i.vat_treatment,
    code: i.vat_code,
    base: Number(i.total),
    tax: Number(i.vat_amount),
    rate: Number(i.vat_rate),
  }));
  const grouped = new Map<
    number,
    { rate: number; base: number; tax: number }
  >();
  for (const line of lines) {
    const g = grouped.get(line.rate) || { rate: line.rate, base: 0, tax: 0 };
    g.base = roundMoney(g.base + line.base);
    g.tax = roundMoney(g.tax + line.tax);
    grouped.set(line.rate, g);
  }
  const buckets =
    direction === 'issued'
      ? [...grouped.values()]
      : (
          row.vat_breakdown || [
            { rate: row.vat_rate, base: row.amount, tax: row.vat_amount },
          ]
        ).map((b: any) => ({
          rate: Number(b.rate),
          base: Number(b.base),
          tax: Number(b.tax),
        }));
  const source = {
    id: row.id,
    direction,
    number: row.invoice_number || row.expense_number,
    sourceNumber:
      direction === 'issued'
        ? row.invoice_number
        : row.supplier_invoice_number || '',
    issueDate: date(row.issue_date),
    deliveryDate: date(row.delivery_date),
    dueDate: date(row.due_date),
    paidAt: date(row.paid_at),
    status: row.status,
    currency: row.currency,
    base: Number(row.subtotal ?? row.amount),
    tax: Number(row.vat_amount),
    total: Number(row.total),
    exchangeRate: row.exchange_rate ? Number(row.exchange_rate) : null,
    clientId: row.client_id,
    clientName: row.client_name || '',
    clientVatId: row.client_dic || '',
    buckets,
    lines,
    payments: (row.payments || []).map((p: any) => ({
      date: date(p.transaction_date),
      amount: Number(p.amount),
    })),
  };
  return {
    ...source,
    metadata: row.vat_filing || null,
    fingerprint: fingerprint(source),
  };
}
// A single repeatable-read transaction supplies both review and saved versions.
export async function loadFilingSnapshot(
  db: { query: Function },
  userId: string,
): Promise<FilingSnapshot> {
  const user = await db.query(
    'SELECT vat_filing_profile, vat_payer FROM users WHERE id = $1',
    [userId],
  );
  const invoices = await db.query(
    `SELECT i.*, c.company_name AS client_name, c.dic AS client_dic,
    COALESCE((SELECT jsonb_agg(ii ORDER BY ii.sort_order, ii.id) FROM invoice_items ii WHERE ii.invoice_id = i.id), '[]') AS lines,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('transaction_date', p.transaction_date, 'amount', p.amount) ORDER BY p.transaction_date, p.id) FROM payments p WHERE p.invoice_id = i.id AND p.user_id = i.user_id), '[]') AS payments
    FROM invoices i LEFT JOIN clients c ON c.id = i.client_id AND c.user_id = i.user_id
    WHERE i.user_id = $1 ORDER BY i.issue_date, i.id`,
    [userId],
  );
  const expenses = await db.query(
    `SELECT e.id, e.expense_number, e.supplier_invoice_number, e.issue_date, e.delivery_date,
    e.due_date, e.paid_at, e.status, e.currency, e.amount, e.vat_rate, e.vat_amount, e.total, e.exchange_rate,
    e.client_id, e.vat_breakdown, e.vat_filing, c.company_name AS client_name, c.dic AS client_dic
    FROM expenses e LEFT JOIN clients c ON c.id = e.client_id AND c.user_id = e.user_id
    WHERE e.user_id = $1 ORDER BY e.issue_date, e.id`,
    [userId],
  );
  return {
    profile: user.rows[0]?.vat_filing_profile || null,
    vatPayer: user.rows[0]?.vat_payer === true,
    documents: [
      ...invoices.rows.map((r: any) => normalizeDocument(r, 'issued')),
      ...expenses.rows.map((r: any) => normalizeDocument(r, 'received')),
    ],
  };
}
