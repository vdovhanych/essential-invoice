import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';

// Never use the ordinary application DB for integration tests.
const urlString = process.env.DASHBOARD_TEST_DATABASE_URL;
describe.skipIf(!urlString)('Dashboard on PostgreSQL', () => {
  it('returns refreshed overdue statistics and recent invoices on the first request, scoped to the user', async () => {
    const url = new URL(urlString!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/essential_dashboard_test') {
      throw new Error('Use a disposable localhost essential_dashboard_test database');
    }
    Object.assign(process.env, {
      DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_NAME: 'essential_dashboard_test',
      DB_USER: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
    });
    const { pool, initializeDatabase } = await import('../db/init');
    const { dashboardRouter } = await import('./dashboard');
    const owner = randomUUID();
    const other = randomUUID();
    try {
      await initializeDatabase();
      for (const id of [owner, other]) {
        await pool.query('INSERT INTO users(id,email,password_hash,name) VALUES ($1,$2,$3,$4)', [id, `${id}@example.invalid`, 'unused', 'Synthetic']);
        await pool.query('INSERT INTO clients(id,user_id,company_name,primary_email) VALUES ($1,$1,$2,$3)', [id, 'Synthetic client', 'client@example.invalid']);
      }
      const add = async (user: string, number: string, status: string, dueOffset: number, total: number, currency = 'CZK', czk: number | null = null) => {
        await pool.query(`INSERT INTO invoices(user_id,client_id,invoice_number,variable_symbol,status,currency,issue_date,due_date,total,total_czk)
          VALUES ($1,$1,$2,$2,$3,$4,CURRENT_DATE-30,CURRENT_DATE+$5::integer,$6,$7)`, [user,number,status,currency,dueOffset,total,czk]);
      };
      await add(owner, 'late-czk', 'sent', -1, 100);
      await add(owner, 'late-eur', 'sent', -1, 10, 'EUR', 250);
      await add(owner, 'due-today', 'sent', 0, 200);
      await add(owner, 'future', 'sent', 1, 300);
      await add(owner, 'already-overdue', 'overdue', -2, 50);
      await add(owner, 'draft', 'draft', -1, 400);
      await add(owner, 'paid', 'paid', -1, 500);
      await add(owner, 'cancelled', 'cancelled', -1, 600);
      await add(other, 'other-late', 'sent', -1, 9000);
      const app = express();
      app.use((req, _res, next) => { (req as any).userId = owner; next(); });
      app.use('/dashboard', dashboardRouter);
      const first = await request(app).get('/dashboard');
      expect(first.status).toBe(200);
      expect(first.body.stats).toMatchObject({
        sentCount: 2, overdueCount: 3, draftCount: 1, paidCount: 1, cancelledCount: 1,
        outstandingAmount: 900, overdueAmount: 400, paidAmount: 500,
      });
      const statuses = Object.fromEntries(first.body.recentInvoices.map((i: any) => [i.invoiceNumber, i.status]));
      expect(statuses).toMatchObject({ 'late-czk': 'overdue', 'late-eur': 'overdue', 'due-today': 'sent', future: 'sent', draft: 'draft', paid: 'paid', cancelled: 'cancelled' });
      expect(statuses).not.toHaveProperty('other-late');
      expect((await pool.query('SELECT status FROM invoices WHERE user_id=$1', [other])).rows[0].status).toBe('sent');
      const second = await request(app).get('/dashboard');
      expect(second.body.stats).toEqual(first.body.stats);
    } finally {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[owner, other]]);
      await pool.end();
    }
  }, 30000);
});
