import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
vi.mock('../db/init', () => ({ query: vi.fn() }));
vi.mock('../services/globalEmailSender', () => ({
  isGlobalSmtpConfigured: vi.fn(), sendWelcomeEmail: vi.fn(), sendPasswordResetEmail: vi.fn(),
}));
import { query } from '../db/init';
import { authRouter } from './auth';
const app = express();
app.use('/auth', authRouter);
// Capture middleware errors without changing the production router's behavior.
app.use((err: Error & { code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.code || err.message });
});
const secret = 'synthetic-upload-test-secret-only';
const token = jwt.sign({ userId: 'synthetic-owner' }, secret);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
beforeEach(() => { process.env.JWT_SECRET = secret; vi.mocked(query).mockReset().mockResolvedValue({ rows: [] } as any); });
describe('logo upload dependency compatibility', () => {
  it('preserves authenticated owner and uploaded bytes', async () => {
    await request(app).post('/auth/me/logo').set('Authorization', `Bearer ${token}`)
      .attach('logo', png, { filename: 'logo.png', contentType: 'image/png' }).expect(200);
    expect(query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('UPDATE users'), [png.toString('base64'), 'image/png', 'synthetic-owner']);
  });
  it('rejects unauthenticated uploads before any database write', async () => {
    await request(app).post('/auth/me/logo').attach('logo', png, 'logo.png').expect(401);
    expect(query).not.toHaveBeenCalled();
  });
  it.each([
    ['wrong field', 'other', 'image/png', png, 'LIMIT_UNEXPECTED_FILE'],
    ['oversize', 'logo', 'image/png', Buffer.alloc(2 * 1024 * 1024 + 1), 'LIMIT_FILE_SIZE'],
    ['invalid type', 'logo', 'text/plain', png, 'Invalid file type. Only PNG, JPG, and SVG are allowed.'],
  ])('rejects %s without storing partial data', async (_name, field, contentType, bytes, error) => {
    const response = await request(app).post('/auth/me/logo').set('Authorization', `Bearer ${token}`)
      .attach(field as string, bytes as Buffer, { filename: 'logo', contentType: contentType as string });
    expect(response.status).toBe(500);
    expect(response.body.error).toBe(error);
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects an absent file without clearing the saved logo', async () => {
    await request(app).post('/auth/me/logo').set('Authorization', `Bearer ${token}`).expect(400);
    expect(query).not.toHaveBeenCalled();
  });
});
