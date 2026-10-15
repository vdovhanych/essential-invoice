import { describe, it, expect } from 'vitest';
// Opt-in integration test. Run only against a disposable localhost database.
const enabled = process.env.VAT_TEST_DATABASE_URL;
describe.skipIf(!enabled)('VAT filing migrations on real PostgreSQL', () => {
  it('initializes fresh schemas, upgrades legacy data twice, preserves totals and enforces immutable versions', async () => {
    const url = new URL(enabled!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/essential_vat_test'
    )
      throw new Error('Use a disposable localhost essential_vat_test database');
    process.env.DB_HOST = url.hostname;
    process.env.DB_PORT = url.port;
    process.env.DB_NAME = 'essential_vat_test';
    process.env.DB_USER = url.username;
    process.env.DB_PASSWORD = url.password;
    const { initializeDatabase, pool } = await import('./init');
    try {
      await initializeDatabase();
      const db = await pool.connect();
      try {
        // Reproduce pre-filing schema without modifying monetary fields or VAT lines.
        await db.query('DROP TABLE vat_filing_versions');
        await db.query(
          'ALTER TABLE users DROP COLUMN vat_filing_profile; ALTER TABLE invoices DROP COLUMN vat_filing; ALTER TABLE expenses DROP COLUMN vat_filing; ALTER TABLE expenses DROP COLUMN vat_breakdown',
        );
        await db.query(
          "INSERT INTO users(id,email,password_hash,name,vat_payer) VALUES ('00000000-0000-4000-8000-000000000001','migration@example.invalid','unused','Synthetic',true)",
        );
        await db.query(
          "INSERT INTO expenses(id,user_id,expense_number,issue_date,due_date,amount,vat_rate,vat_amount,total) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','LEGACY','2026-08-01','2026-08-15',100.01,21,21.01,121.02)",
        );
      } finally {
        db.release();
      }
      await initializeDatabase();
      await initializeDatabase();
      const { rows } = await pool.query(
        "SELECT amount,vat_amount,total,vat_breakdown,vat_filing FROM expenses WHERE expense_number='LEGACY'",
      );
      expect(rows[0]).toMatchObject({
        amount: '100.01',
        vat_amount: '21.01',
        total: '121.02',
        vat_filing: null,
        vat_breakdown: [{ rate: 21, base: 100.01, tax: 21.01 }],
      });
      expect(
        (await pool.query('SELECT vat_filing_profile FROM users')).rows[0]
          .vat_filing_profile,
      ).toBeNull();
      const version = await pool.query(
        "INSERT INTO vat_filing_versions(user_id,period,filing_type,filing_mode,schema_version,snapshot,snapshot_hash,calculation,validation,xml) VALUES ('00000000-0000-4000-8000-000000000001','2026-08','DPHDP3','original','03.01.03','{}','hash','{}','{}','original bytes') RETURNING id",
      );
      await expect(
        pool.query('UPDATE vat_filing_versions SET xml=$1 WHERE id=$2', [
          'changed',
          version.rows[0].id,
        ]),
      ).rejects.toThrow('immutable');
      expect(
        (
          await pool.query('SELECT xml FROM vat_filing_versions WHERE id=$1', [
            version.rows[0].id,
          ])
        ).rows[0].xml,
      ).toBe('original bytes');
    } finally {
      await pool.end();
    }
  }, 30000);
});
