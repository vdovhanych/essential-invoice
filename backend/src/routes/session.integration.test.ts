import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
vi.mock('../services/globalEmailSender', () => ({ isGlobalSmtpConfigured: () => false }));
const url = process.env.SESSION_TEST_DATABASE_URL;
describe.skipIf(!url)('Session revocation on real PostgreSQL', () => {
  it('migrates twice, revokes old tokens on change/reset, and consumes concurrent resets once', async () => {
    const config = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(config.hostname) || config.pathname !== '/essential_session_test')
      throw new Error('Use a disposable localhost essential_session_test database');
    Object.assign(process.env, { DB_HOST: config.hostname, DB_PORT: config.port, DB_NAME: 'essential_session_test', DB_USER: config.username, DB_PASSWORD: config.password, JWT_SECRET: 'synthetic-session-secret-only' });
    const { pool, initializeDatabase } = await import('../db/init');
    try {
      await initializeDatabase();
      await pool.query('ALTER TABLE users DROP COLUMN session_version');
      const hash = await bcrypt.hash('initial-password', 4);
      const user = (await pool.query("INSERT INTO users(email,password_hash,name) VALUES ('session@example.invalid',$1,'Synthetic') RETURNING id", [hash])).rows[0];
      await initializeDatabase();
      await initializeDatabase();
      expect((await pool.query('SELECT session_version FROM users WHERE id=$1', [user.id])).rows[0].session_version).toBe(0);
      const { authRouter } = await import('./auth');
      const app = express(); app.use(express.json()); app.use('/auth', authRouter);
      const legacy = jwt.sign({ userId: user.id, email: 'session@example.invalid' }, process.env.JWT_SECRET!);
      const me = (token: string) => request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
      const login = async (password: string) => {
        const result = await request(app).post('/auth/login').send({ email: 'session@example.invalid', password });
        expect(result.status).toBe(200); return result.body.token as string;
      };
      expect((await me(legacy)).status).toBe(200);
      const old = await login('initial-password');
      const invalid = await request(app).post('/auth/change-password').set('Authorization', `Bearer ${old}`).send({ currentPassword: 'wrong', newPassword: 'changed-password' });
      expect(invalid.status).toBe(401); expect((await me(old)).status).toBe(200);
      const changed = await request(app).post('/auth/change-password').set('Authorization', `Bearer ${old}`).send({ currentPassword: 'initial-password', newPassword: 'changed-password' });
      expect(changed.status).toBe(200);
      expect((await me(old)).status).toBe(401); expect((await me(legacy)).status).toBe(401);
      expect((await request(app).get('/auth/me/logo').query({ token: legacy })).status).toBe(401);
      const fresh = await login('changed-password'); expect((await me(fresh)).status).toBe(200);
      const reset = 'synthetic-reset-token';
      await pool.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES ($1,$2,CURRENT_TIMESTAMP + interval '1 hour')", [user.id, crypto.createHash('sha256').update(reset).digest('hex')]);
      const results = await Promise.all([1, 2].map(() => request(app).post('/auth/reset-password').send({ token: reset, password: 'reset-password' })));
      expect(results.map(r => r.status).sort()).toEqual([200, 400]);
      expect((await me(fresh)).status).toBe(401);
      expect((await pool.query('SELECT session_version FROM users WHERE id=$1', [user.id])).rows[0].session_version).toBe(2);
      const afterReset = await login('reset-password'); expect((await me(afterReset)).status).toBe(200);
      await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
      expect((await me(afterReset)).status).toBe(401);
    } finally { await pool.end(); }
  }, 30_000);
});
