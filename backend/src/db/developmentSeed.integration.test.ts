import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { unzipSync, strFromU8 } from 'fflate';
import { validateXML } from 'xmllint-wasm';

const urlString = process.env.SEED_TEST_DATABASE_URL;
describe.skipIf(!urlString)('development scenarios on PostgreSQL', () => {
  let pool: Pool;
  let seed: typeof import('./developmentSeed').seedDevelopmentData;
  const email = `seed-${randomUUID()}@example.invalid`;
  const retryEmail = `retry-${randomUUID()}@example.invalid`;
  const secondEmail = `other-${randomUUID()}@example.invalid`;
  const options = { email: email.toUpperCase(), password: 'test-password-only', date: '2026-10-26', scenarios: ['core', 'vat', 'identified'] as ('core' | 'vat' | 'identified')[] };
  const emails = [email, `vat_${email}`, `identified_${email}`, retryEmail, `vat_${retryEmail}`, `identified_${retryEmail}`, secondEmail];
  beforeAll(async () => {
    const url = new URL(urlString!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/essential_seed_test') throw new Error('Use a disposable localhost essential_seed_test database');
    Object.assign(process.env, { DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_NAME: 'essential_seed_test', DB_USER: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password) });
    const db = await import('./init');
    pool = db.pool;
    await db.initializeDatabase();
    seed = (await import('./developmentSeed')).seedDevelopmentData;
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External network disabled in seed test'); }));
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if (pool) {
      await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
      await pool.end();
    }
  });

  it('creates consistent current fixtures, usable PDFs/ISDOC/ZIP, reviewed VAT history and safe local settings', async () => {
    const users = await seed(pool, options);
    expect(users.map(u => u.scenario)).toEqual(['core', 'vat', 'identified']);
    const core = users[0].userId;
    const vat = users[1].userId;
    const identified = users[2].userId;
    const ids = users.map(u => u.userId);
    const { validateIco } = await import('../utils/validation');
    const { loadInvoiceDocument } = await import('../services/invoiceDocument');
    const { generateInvoicePDF } = await import('../services/pdfGenerator');
    const { generateISDOC } = await import('../services/isdocGenerator');
    const { loadFilingSnapshot } = await import('../services/vatFilingData');
    const { reviewFiling } = await import('../services/vatFiling');
    const { validateFilingXml } = await import('../services/vatFilingXml');
    const { generateAccountantExport, validatePeriod } = await import('../services/accountantExport');
    const invoices = (await pool.query('SELECT * FROM invoices WHERE user_id=ANY($1::uuid[])', [ids])).rows;
    expect(invoices).toHaveLength(19);
    expect(invoices.filter(i => i.user_id === core)).toHaveLength(10);
    expect(new Set(invoices.filter(i => i.user_id === core).map(i => i.status))).toEqual(new Set(['paid', 'sent', 'overdue', 'draft', 'cancelled']));
    const ownerRows = (await pool.query('SELECT company_ico,password_hash FROM users WHERE id=ANY($1::uuid[])', [ids])).rows;
    for (const user of ownerRows) {
      expect(validateIco(user.company_ico).valid).toBe(true);
      expect(await bcrypt.compare(options.password, user.password_hash)).toBe(true);
    }
    for (const c of (await pool.query('SELECT ico FROM clients WHERE user_id=ANY($1::uuid[]) AND ico IS NOT NULL', [ids])).rows) expect(validateIco(c.ico).valid).toBe(true);
    for (const i of invoices) {
      const doc = await loadInvoiceDocument(i.id, i.user_id);
      expect(doc.items.reduce((s, l) => s + Math.round(l.total * 100), 0)).toBe(Math.round(Number(i.subtotal) * 100));
      expect(doc.items.reduce((s, l) => s + Math.round(l.vatAmount * 100), 0)).toBe(Math.round(Number(i.vat_amount) * 100));
      expect(Math.round((Number(i.subtotal) + Number(i.vat_amount)) * 100)).toBe(Math.round(Number(i.total) * 100));
      expect(i.currency === 'CZK' ? i.qr_payment_data.includes('*ACC:CZ6508000000192000145399*') : Number(i.total_czk) === Math.round(Number(i.total) * Number(i.exchange_rate) * 100) / 100).toBe(true);
    }
    const find = (key: string, uid = core) => invoices.find(i => i.user_id === uid && i.notes === `Seed: ${key}`)!;
    expect(find('rounding').total).toBe('0.02');
    expect(find('tax-rounding', vat).vat_amount).toBe('0.01');
    expect(find('kh-exact-10000', vat).total).toBe('10000.00');
    expect(find('kh-above-10000', vat).total).toBe('10000.01');
    const missing = (await pool.query(`SELECT count(*) FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE i.user_id=ANY($1::uuid[]) AND (ii.vat_rate IS NULL OR ii.vat_amount IS NULL)`, [ids])).rows[0];
    expect(missing.count).toBe('0');
    const expenses = (await pool.query('SELECT * FROM expenses WHERE user_id=ANY($1::uuid[])', [ids])).rows;
    expect(expenses).toHaveLength(5);
    for (const e of expenses) {
      expect(e.vat_breakdown.length).toBeGreaterThan(0);
      expect(Math.round(e.vat_breakdown.reduce((s: number, b: any) => s + b.base + b.tax, 0) * 100)).toBe(Math.round(Number(e.total) * 100));
      if (e.currency === 'EUR') expect(Number(e.total_czk)).toBe(Math.round(Number(e.total) * Number(e.exchange_rate) * 100) / 100);
    }
    for (const currency of ['CZK', 'EUR']) {
      const i = invoices.find(i => i.currency === currency && i.user_id === core)!;
      const pdf = await generateInvoicePDF(i.id, core);
      expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
      const { xml } = await generateISDOC(i.id, core);
      const schema = readFileSync(new URL('../test/fixtures/isdoc/isdoc-invoice-6.0.2.xsd', import.meta.url), 'utf8');
      expect((await validateXML({ xml: [{fileName: 'invoice.xml', contents: xml}], schema: [schema] })).valid).toBe(true);
    }
    const files = unzipSync(await generateAccountantExport(core, validatePeriod('2026-01-01', '2026-12-31', 'issue')));
    expect(Object.keys(files).some(f => f.startsWith('received/') && f.endsWith('synthetic-receipt.png'))).toBe(true);
    const csv = strFromU8(files['issued-invoices.csv']);
    expect(csv).not.toContain(find('draft').id);
    expect(csv).not.toContain(find('cancelled').id);
    expect(strFromU8(files['received-expenses.csv'])).toContain('Syntetický dodavatel');
    const vatSnapshot = await loadFilingSnapshot(pool, vat);
    const kh = reviewFiling(vatSnapshot, '2026-08', 'DPHKH1');
    expect(kh.issues.filter(i => i.severity === 'blocker')).toEqual([]);
    expect(kh.statement.find(r => r.documents.includes(find('kh-exact-10000', vat).id))?.section).toBe('A5');
    expect(kh.statement.find(r => r.documents.includes(find('kh-above-10000', vat).id))?.section).toBe('A4');
    const io = await loadFilingSnapshot(pool, identified);
    expect(reviewFiling(io, '2026-08', 'DPHKH1').applicable).toBe(false);
    expect(reviewFiling(io, '2026-08', 'DPHDP3').rows['5'].tax).toBeGreaterThan(0);
    const versions = (await pool.query('SELECT * FROM vat_filing_versions WHERE user_id=ANY($1::uuid[])', [ids])).rows;
    expect(versions).toHaveLength(5);
    for (const version of versions) {
      expect(version.validation.epoImportVerified).toBe(false);
      expect((await validateFilingXml(version.filing_type, version.xml)).valid).toBe(true);
    }
    await expect(pool.query("UPDATE vat_filing_versions SET xml='changed' WHERE id=$1", [versions[0].id])).rejects.toThrow('immutable');
    expect((await pool.query('SELECT count(*) FROM settings WHERE user_id=ANY($1::uuid[]) AND (smtp_host IS NOT NULL OR imap_host IS NOT NULL OR ai_enabled)', [ids])).rows[0].count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM recurring_invoices WHERE user_id=$1 AND (active OR auto_send)', [core])).rows[0].count).toBe('0');

    const { authRouter } = await import('../routes/auth');
    vi.stubEnv('JWT_SECRET', 'synthetic-seed-login-test-only-secret');
    const loginApp = express(); loginApp.use(express.json()); loginApp.use('/auth', authRouter);
    for (const user of users) {
      const response = await request(loginApp).post('/auth/login').send({ email: user.email.toUpperCase(), password: options.password });
      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(user.userId);
      expect(response.body.token).toEqual(expect.any(String));
    }
    const { paymentRouter } = await import('../routes/payments');
    const { invoiceRouter } = await import('../routes/invoices');
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { (req as any).userId = core; next(); });
    app.use('/payments', paymentRouter); app.use('/invoices', invoiceRouter);
    for (const key of ['matchable-czk', 'matchable-eur']) {
      const invoice = find(key);
      const p = (await pool.query('SELECT id FROM payments WHERE user_id=$1 AND variable_symbol=$2 AND invoice_id IS NULL', [core, invoice.variable_symbol])).rows[0];
      const candidates = await request(app).get(`/payments/${p.id}/matches`);
      expect(candidates.body.some((c: any) => c.id === invoice.id && c.matchReason === 'variable_symbol')).toBe(true);
      const matched = await request(app).post(`/payments/${p.id}/match`).send({ invoiceId: invoice.id });
      expect(matched.status).toBe(200);
    }
    expect((await request(app).get(`/invoices/${find('mixed-domestic', vat).id}`)).status).toBe(404);
    expect((await request(app).post(`/invoices/${find('draft').id}/mark-sent`)).status).toBe(200);
    expect((await request(app).post(`/invoices/${find('draft').id}/mark-paid`).send({ paidAt: '2026-10-26' })).status).toBe(200);
    expect((await request(app).post(`/invoices/${find('draft').id}/cancel`)).status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }, 60000);

  it('refuses existing identities without changes and creates another independent account', async () => {
    const before = (await pool.query('SELECT id FROM users WHERE email=ANY($1::text[]) ORDER BY email', [emails])).rows;
    await expect(seed(pool, options)).rejects.toThrow('already exists');
    expect((await pool.query('SELECT id FROM users WHERE email=ANY($1::text[]) ORDER BY email', [emails])).rows).toEqual(before);
    const [second] = await seed(pool, { ...options, email: secondEmail, scenarios: ['core'] });
    expect((await pool.query('SELECT count(*) FROM invoices WHERE user_id=$1', [second.userId])).rows[0].count).toBe('10');
    expect((await pool.query(`SELECT count(*) FROM invoices i JOIN clients c ON c.id=i.client_id WHERE i.user_id=$1 AND c.user_id<>i.user_id`, [second.userId])).rows[0].count).toBe('0');
  });

  it('rolls back a mid-seed SQL failure and allows the exact same request to succeed afterwards', async () => {
    // Scratch database only: fail in the second scenario, after core has finished.
    await pool.query("ALTER TABLE expenses ADD CONSTRAINT seed_test_failure CHECK(description <> 'Seed: mixed-supplier-rounding') NOT VALID");
    try {
      await expect(seed(pool, { ...options, email: retryEmail })).rejects.toThrow('seed_test_failure');
      expect((await pool.query('SELECT count(*) FROM users WHERE email=ANY($1::text[])', [[retryEmail, `vat_${retryEmail}`, `identified_${retryEmail}`]])).rows[0].count).toBe('0');
    } finally { await pool.query('ALTER TABLE expenses DROP CONSTRAINT seed_test_failure'); }
    const [created] = await seed(pool, { ...options, email: retryEmail });
    expect((await pool.query('SELECT count(*) FROM invoices WHERE user_id=$1', [created.userId])).rows[0].count).toBe('10');
  });
});
