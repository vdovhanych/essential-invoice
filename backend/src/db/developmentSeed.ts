import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import type { Pool, PoolClient } from 'pg';
import { calculateInvoiceTax, roundMoney, type LineItem } from '../utils/money';
import { generateSpayd } from '../utils/validation';
import { validDate, reviewFiling } from '../services/vatFiling';
import { fingerprint, loadFilingSnapshot } from '../services/vatFilingData';
import { generateFilingXml, validateFilingXml } from '../services/vatFilingXml';
import { filingTypes, type FilingMetadata, type FilingProfile } from '../services/vatFilingTypes';

export const seedScenarios = ['core', 'vat', 'identified'] as const;
export type SeedScenario = typeof seedScenarios[number];
export interface SeedOptions { email: string; password: string; date: string; scenarios: SeedScenario[] }

// Seeding is deliberately opt-in and local only, even with production credentials in .env.
export function assertLocalSeedEnvironment(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === 'production' || env.SEED_CONFIRM_LOCAL !== '1') {
    throw new Error('Seed requires SEED_CONFIRM_LOCAL=1 and a non-production environment');
  }
  const host = env.DB_HOST || '';
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !host.startsWith('/')) {
    throw new Error('Seed requires an explicit localhost DB_HOST or absolute Unix socket directory');
  }
  if (!env.DB_NAME?.trim()) throw new Error('Seed requires an explicit disposable development DB_NAME');
}

export function validateSeedOptions(options: SeedOptions) {
  if (!validDate(options.date)) throw new Error('Seed date must be YYYY-MM-DD');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email) || options.email.length > 240) throw new Error('Invalid seed email');
  if (options.password.length < 8) throw new Error('Seed password must have at least 8 characters');
  if (!options.scenarios.length || new Set(options.scenarios).size !== options.scenarios.length || options.scenarios.some(s => !seedScenarios.includes(s))) {
    throw new Error('Choose core, vat, identified, or all');
  }
}

export const seedEmail = (email: string, scenario: SeedScenario) => scenario === 'core' ? email : `${scenario}_${email}`;
// Match the registration/login sanitizer, including provider-specific aliases.
export async function normalizeSeedEmail(email: string): Promise<string> {
  const req = { body: { email } };
  await body('email').isEmail().normalizeEmail().run(req);
  if (!validationResult(req).isEmpty()) throw new Error('Invalid seed email');
  return req.body.email;
}

export function shiftSeedDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

type Item = LineItem & { description: string; unit: string };
type Invoice = {
  key: string; status: 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled'; issue: string; due: string;
  paid?: string; currency?: 'CZK' | 'EUR'; client?: 'customer' | 'consumer' | 'eu'; items: Item[];
  classification?: FilingMetadata['classification'];
};
const item = (description: string, unitPrice: number, quantity = 1, vatRate = 0, vatTreatment: LineItem['vatTreatment'] = 'standard'): Item => ({
  description, unitPrice, quantity, vatRate, vatTreatment, unit: 'ks',
  vatReason: vatTreatment === 'eu_service' ? '§ 9 odst. 1 ZDPH – daň odvede zákazník' : vatTreatment === 'reverse_charge' ? '§ 92e ZDPH – stavební práce' : '',
  ...(vatTreatment === 'reverse_charge' ? { vatCode: '4' } : {}),
});
const TAX_DATE = '2026-08-10';
const TAX_PERIOD = '2026-08';
const EUR_RATE = 25.125; // Fixed synthetic recorded rate; never fetched from CNB.

function coreInvoices(today: string): Invoice[] {
  const before = (days: number) => shiftSeedDate(today, -days);
  return [
    { key: 'paid-czk', status: 'paid', issue: before(7), due: shiftSeedDate(today, 7), paid: today, items: [item('Vývoj – syntetický příklad', 1500, 5.5)] },
    { key: 'paid-eur', status: 'paid', currency: 'EUR', issue: before(40), due: before(26), paid: before(28), items: [item('Consulting – synthetic', 80, 2.5)] },
    { key: 'previous-year', status: 'paid', issue: `${Number(today.slice(0, 4)) - 1}-12-01`, due: `${Number(today.slice(0, 4)) - 1}-12-15`, paid: `${Number(today.slice(0, 4)) - 1}-12-12`, items: [item('Minulý rok', 12000)] },
    { key: 'matchable-czk', status: 'sent', issue: today, due: shiftSeedDate(today, 14), items: [item('Faktura k ručnímu párování', 3456.78)] },
    { key: 'matchable-eur', status: 'sent', currency: 'EUR', issue: today, due: shiftSeedDate(today, 14), items: [item('EUR payment match', 65, 3)] },
    { key: 'due-today', status: 'sent', issue: before(14), due: today, items: [item('Splatnost dnes', 4500)] },
    { key: 'overdue', status: 'overdue', issue: before(30), due: before(16), items: [item('Po splatnosti', 6000)] },
    { key: 'draft', status: 'draft', issue: today, due: shiftSeedDate(today, 14), items: [item('Koncept: české znaky & <export>', 123.45, 1.25), item('Druhá položka', 9.99, 0.5)] },
    { key: 'cancelled', status: 'cancelled', issue: before(10), due: shiftSeedDate(today, 4), items: [item('Zrušená faktura', 7000)] },
    { key: 'rounding', status: 'paid', client: 'consumer', issue: today, due: today, paid: today, items: [item('Zaokrouhlení A', 0.01, 0.5), item('Zaokrouhlení B', 0.01, 0.5)] },
  ];
}

function taxInvoices(scenario: SeedScenario): Invoice[] {
  const invoice = (key: string, items: Item[], patch: Partial<Invoice> = {}): Invoice => ({
    key, items, status: 'paid', issue: TAX_DATE, due: '2026-08-24', paid: '2026-08-20', classification: 'domestic', ...patch,
  });
  const eu = invoice('eu-service', [item('EU B2B služba – syntetická', 100, 2.5, 0, 'eu_service')], { currency: 'EUR', client: 'eu', classification: 'eu_service' });
  if (scenario === 'identified') return [eu, invoice('nonpayer-domestic', [item('Tuzemská služba bez DPH', 3000)], { classification: 'nonpayer_domestic' })];
  return [
    invoice('mixed-domestic', [item('Základní sazba', 1000, 10, 21), item('Snížená sazba', 500, 2, 12)]),
    invoice('kh-exact-10000', [item('Přesně 10 000 Kč včetně DPH', 8264.46, 1, 21)]),
    invoice('kh-above-10000', [item('Nad hranicí KH', 8264.47, 1, 21)]),
    invoice('consumer-above-10000', [item('Spotřebitel nad hranicí KH', 10000, 1, 21)], { client: 'consumer' }),
    invoice('tax-rounding', [item('Haléř A', 0.03, 1, 21), item('Haléř B', 0.03, 1, 21)]),
    invoice('construction', [item('Stavební práce – kód 4', 15000, 1, 21, 'reverse_charge')], { classification: 'domestic_reverse_charge' }),
    eu,
  ];
}

const profile = (scenario: SeedScenario): FilingProfile => ({
  status: scenario === 'vat' ? 'payer' : 'identified', personType: 'individual', frequency: 'monthly',
  vatId: 'CZ9001010007', firstName: 'Test', lastName: 'Novák', street: 'Testovací', houseNumber: '1',
  city: 'Praha', postcode: '11000', taxOffice: '451', taxOfficeBranch: '2001', activityCode: '621000',
  email: 'vat-test@example.com', effectiveFrom: '2026-01-01',
});

async function insert(db: PoolClient, table: string, values: Record<string, unknown>): Promise<string> {
  // Table/column names are internal constants, never CLI input.
  const columns = Object.keys(values);
  const result = await db.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(values));
  return result.rows[0].id;
}

async function createScenario(db: PoolClient, scenario: SeedScenario, options: SeedOptions, passwordHash: string) {
  const email = seedEmail(options.email, scenario);
  const userId = await insert(db, 'users', {
    email, password_hash: passwordHash, name: `Test ${scenario}`, company_name: `Syntetický vývojář (${scenario})`,
    company_ico: '00000019', company_dic: scenario === 'core' ? null : profile(scenario).vatId,
    company_address: 'Testovací 1\n110 00 Praha', bank_account: '0000192000145399', bank_code: '0800',
    vat_payer: scenario === 'vat', onboarding_completed: true, pausalni_dan_enabled: scenario === 'core',
    pausalni_dan_tier: 1, pausalni_dan_limit: 1000000,
    vat_filing_profile: scenario === 'core' ? null : JSON.stringify(profile(scenario)),
  });
  await insert(db, 'settings', {
    user_id: userId, invoice_number_prefix: 'FV', invoice_number_format: 'YYYYMM##', default_vat_rate: scenario === 'vat' ? 21 : 0,
    default_payment_terms: 14, calculator_enabled: true, ai_enabled: false,
  });
  const clients: Record<string, string> = {};
  for (const [key, name, ico, dic] of [
    ['customer', 'Syntetický odběratel s.r.o.', '00000027', 'CZ00000027'],
    ['supplier', 'Syntetický dodavatel s.r.o.', '00000035', 'CZ00000035'],
    ['consumer', 'Testovací spotřebitel', null, null],
    ['eu', 'Synthetic EU services', null, 'DE123456789'],
  ]) {
    clients[key!] = await insert(db, 'clients', { user_id: userId, company_name: name, primary_email: `${key}@example.invalid`,
      secondary_email: key === 'customer' ? 'copy@example.invalid' : null,
      address: key === 'eu' ? 'Teststraße 1\n10115 Berlin' : 'Testovací 2\n110 00 Praha', ico, dic,
      notes: 'Syntetická data pro lokální vývoj. Neodesílat.',
    });
  }
  const invoiceRecords: Record<string, { id: string; total: number; currency: string; vs: string }> = {};
  const metadata = new Map<string, Partial<FilingMetadata>>();
  const monthCounts = new Map<string, number>();
  for (const fixture of scenario === 'core' ? coreInvoices(options.date) : taxInvoices(scenario)) {
    const currency = fixture.currency || 'CZK';
    const totals = calculateInvoiceTax(fixture.items, scenario === 'vat' ? 21 : 0);
    const month = fixture.issue.slice(0, 7).replace('-', '');
    const seq = (monthCounts.get(month) || 0) + 1;
    monthCounts.set(month, seq);
    const vs = `${month}${String(seq).padStart(2, '0')}`;
    const number = `FV${vs}`;
    const id = await insert(db, 'invoices', {
      user_id: userId, client_id: clients[fixture.client || 'customer'], invoice_number: number, variable_symbol: vs,
      status: fixture.status, currency, issue_date: fixture.issue, due_date: fixture.due, delivery_date: fixture.issue,
      subtotal: totals.subtotal, vat_rate: scenario === 'vat' ? 21 : 0, vat_amount: totals.vatAmount, total: totals.total,
      notes: `Seed: ${fixture.key}`, paid_at: fixture.paid || null,
      sent_at: fixture.status === 'draft' ? null : fixture.issue,
      exchange_rate: currency === 'EUR' ? EUR_RATE : null, total_czk: currency === 'EUR' ? roundMoney(totals.total * EUR_RATE) : null,
      qr_payment_data: currency === 'CZK' ? generateSpayd('0000192000145399', '0800', totals.total, currency, vs, `Faktura ${number}`) : null,
    });
    for (const [index, line] of totals.lines.entries()) await insert(db, 'invoice_items', {
      invoice_id: id, description: fixture.items[index].description, quantity: line.quantity, unit: fixture.items[index].unit, unit_price: line.unitPrice,
      total: line.total, sort_order: index, vat_rate: line.vatRate, vat_treatment: line.vatTreatment,
      vat_reason: line.vatReason, vat_code: line.vatCode || '', vat_amount: line.vatAmount,
    });
    invoiceRecords[fixture.key] = { id, total: totals.total, currency, vs };
    if (fixture.classification) metadata.set(id, { classification: fixture.classification, counterpartyType: fixture.client === 'consumer' ? 'consumer' : 'business',
      country: fixture.client === 'eu' ? 'DE' : 'CZ', vatId: fixture.client === 'eu' ? 'DE123456789' : fixture.client === 'consumer' ? '' : 'CZ00000027',
      reverseChargeCode: fixture.classification === 'domestic_reverse_charge' ? '4' : '',
    });
  }
  const expenseDate = scenario === 'core' ? shiftSeedDate(options.date, -5) : TAX_DATE;
  const expenses = scenario === 'core' ? [
    { key: 'hosting-paid', currency: 'CZK', paid: true, buckets: [{ rate: 0, base: 2500, tax: 0 }], classification: 'nonpayer_domestic' as const },
    { key: 'eur-unpaid', currency: 'EUR', paid: false, buckets: [{ rate: 0, base: 19.99, tax: 0 }], classification: 'nonpayer_domestic' as const },
  ] : scenario === 'vat' ? [
    { key: 'mixed-supplier-rounding', currency: 'CZK', paid: true, buckets: [{ rate: 21, base: 100, tax: 21.01 }, { rate: 12, base: 100, tax: 12 }], classification: 'domestic' as const },
    { key: 'supplier-no-deduction', currency: 'CZK', paid: true, buckets: [{ rate: 21, base: 10000, tax: 2100 }], classification: 'domestic' as const },
  ] : [
    { key: 'eu-service-received', currency: 'EUR', paid: true, buckets: [{ rate: 21, base: 100, tax: 0 }], classification: 'eu_service' as const },
  ];
  for (const [index, expense] of expenses.entries()) {
    const amount = roundMoney(expense.buckets.reduce((s, b) => s + b.base, 0));
    const tax = roundMoney(expense.buckets.reduce((s, b) => s + b.tax, 0));
    const total = roundMoney(amount + tax);
    const id = await insert(db, 'expenses', {
      user_id: userId, client_id: clients[expense.classification === 'eu_service' ? 'eu' : 'supplier'],
      expense_number: `N${expenseDate.replaceAll('-', '')}${index + 1}`, supplier_invoice_number: `SYNTHETIC-${index + 1}`,
      status: expense.paid ? 'paid' : 'unpaid', currency: expense.currency, issue_date: expenseDate, due_date: shiftSeedDate(expenseDate, 14), delivery_date: expenseDate,
      amount, vat_rate: expense.buckets[0].rate, vat_amount: tax, total, vat_breakdown: JSON.stringify(expense.buckets),
      paid_at: expense.paid ? shiftSeedDate(expenseDate, 2) : null, description: `Seed: ${expense.key}`,
      exchange_rate: expense.currency === 'EUR' ? EUR_RATE : null, total_czk: expense.currency === 'EUR' ? roundMoney(total * EUR_RATE) : null,
      // A genuine tiny PNG exercises attachment download and accountant ZIP inclusion offline.
      file_name: index === 0 ? 'synthetic-receipt.png' : null, file_mime_type: index === 0 ? 'image/png' : null,
      file_data: index === 0 ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwcPgPAAJDAYBXZRC4AAAAAElFTkSuQmCC' : null,
    });
    if (scenario !== 'core') metadata.set(id, {
      classification: expense.classification, country: expense.classification === 'eu_service' ? 'DE' : 'CZ',
      vatId: expense.classification === 'eu_service' ? 'DE123456789' : 'CZ00000035',
      deduction: expense.key === 'mixed-supplier-rounding' ? 'full' : 'none',
      deductibleTax: expense.key === 'mixed-supplier-rounding' ? tax : 0,
      claimPeriod: expense.key === 'mixed-supplier-rounding' ? TAX_PERIOD : '',
    });
  }
  if (scenario === 'core') {
    for (const key of ['paid-czk', 'paid-eur', 'matchable-czk', 'matchable-eur']) {
      const inv = invoiceRecords[key];
      const matched = key.startsWith('paid');
      await insert(db, 'payments', {
        user_id: userId, invoice_id: matched ? inv.id : null, amount: inv.total, currency: inv.currency,
        variable_symbol: inv.vs, sender_name: 'Syntetický odběratel', transaction_code: `SEED-${key}`,
        transaction_date: key === 'paid-eur' ? shiftSeedDate(options.date, -28) : options.date,
        bank_type: 'airbank', matched_at: matched ? (key === 'paid-eur' ? shiftSeedDate(options.date, -28) : options.date) : null,
        match_method: matched ? 'variable_symbol' : null,
      });
    }
    await insert(db, 'payments', { user_id: userId, amount: 777.77, currency: 'CZK', variable_symbol: '9999999999', sender_name: 'Neznámá syntetická platba', transaction_date: options.date, transaction_code: 'SEED-unmatched' });
    const recurringId = await insert(db, 'recurring_invoices', {
      user_id: userId, client_id: clients.customer, currency: 'CZK', vat_rate: 0, day_of_month: 1,
      start_date: options.date, next_generation_date: `${Number(options.date.slice(0, 4)) + 1}-01-01`,
      active: false, auto_send: false, notes: 'Seed: disabled-recurring (activate manually)',
    });
    await insert(db, 'recurring_invoice_items', { recurring_invoice_id: recurringId, description: 'Syntetický hosting', quantity: 1, unit: 'měs', unit_price: 2500, sort_order: 0, vat_rate: 0, vat_treatment: 'standard', vat_reason: '', vat_code: '' });
  } else {
    // Review actual stored values (including decimals and dates), not parallel fixture totals.
    let snapshot = await loadFilingSnapshot(db, userId);
    for (const doc of snapshot.documents) {
      const reviewed: FilingMetadata = {
        classification: 'domestic', country: 'CZ', vatId: '', counterpartyType: 'business', documentKind: 'ordinary',
        taxPoint: doc.deliveryDate, receivedDate: doc.direction === 'received' ? shiftSeedDate(doc.issueDate, 1) : '', reference: '',
        deduction: 'none', deductibleTax: 0, claimPeriod: '', reverseChargeCode: '', exchangeRate: doc.currency === 'EUR' ? EUR_RATE : 1,
        exchangeRateDate: doc.deliveryDate, exchangeRateSource: 'recorded', reviewedFingerprint: doc.fingerprint,
        ...metadata.get(doc.id),
      };
      await db.query(`UPDATE ${doc.direction === 'issued' ? 'invoices' : 'expenses'} SET vat_filing=$1 WHERE id=$2 AND user_id=$3`, [JSON.stringify(reviewed), doc.id, userId]);
    }
    snapshot = await loadFilingSnapshot(db, userId);
    for (const type of filingTypes) {
      const review = reviewFiling(snapshot, TAX_PERIOD, type);
      if (review.issues.some(i => i.severity === 'blocker')) throw new Error(`Seed ${scenario}/${type} has filing blockers: ${review.issues.map(i => i.code).join(', ')}`);
      if (!review.applicable) continue;
      const xml = generateFilingXml(review, snapshot.profile!, '2026-09-01');
      const xsd = await validateFilingXml(type, xml);
      if (!xsd.valid) throw new Error(`Seed ${scenario}/${type} failed offline XML validation`);
      await insert(db, 'vat_filing_versions', {
        user_id: userId, period: TAX_PERIOD, filing_type: type, filing_mode: 'original', schema_version: review.schemaVersion,
        snapshot: JSON.stringify(snapshot), snapshot_hash: fingerprint(snapshot), calculation: JSON.stringify(review),
        validation: JSON.stringify({ issues: review.issues, xsd, reconciliation: review.reconciliation, epoImportVerified: false }), xml,
      });
    }
  }
  return { scenario, email, userId };
}

/** One transaction for the entire requested set. Existing accounts are never changed. */
export async function seedDevelopmentData(pool: Pool, options: SeedOptions) {
  validateSeedOptions(options);
  options = { ...options, email: await normalizeSeedEmail(options.email) };
  // Underscore prefixes survive Gmail/Yahoo/Outlook login normalization.
  for (const scenario of options.scenarios) {
    const email = seedEmail(options.email, scenario);
    if (await normalizeSeedEmail(email) !== email) throw new Error('Scenario email is not stable under login normalization');
  }
  const passwordHash = await bcrypt.hash(options.password, 12);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const emails = options.scenarios.map(s => seedEmail(options.email, s));
    if ((await db.query('SELECT id FROM users WHERE email = ANY($1::text[])', [emails])).rowCount) {
      throw new Error('A requested seed account already exists. No data changed; choose another email or explicitly remove the disposable account first.');
    }
    const users = [];
    for (const scenario of options.scenarios) users.push(await createScenario(db, scenario, options, passwordHash));
    await db.query('COMMIT');
    return users;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
