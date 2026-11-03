vi.mock('../utils/session', () => ({ verifySessionToken: async (token: string) => jwt.verify(token, process.env.JWT_SECRET!) }));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
vi.mock('../db/init', () => ({ query: vi.fn() }));
vi.mock('../services/globalEmailSender', () => ({ isGlobalSmtpConfigured: () => false }));
import { query } from '../db/init';
import { authRouter } from './auth';
const db = vi.mocked(query);
const app = express();
app.use('/auth', authRouter);
const secret = 'synthetic-logo-test-secret';
const token = () => jwt.sign({ userId: 'synthetic-user', email: 'logo@example.invalid' }, secret);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
beforeEach(() => { vi.resetAllMocks(); process.env.JWT_SECRET = secret; });
describe('raster-only logos', () => {
  it('does not authenticate a token in an image URL', async () => {
    expect((await request(app).get('/auth/me/logo').query({ token: token() })).status).toBe(401);
    expect(db).not.toHaveBeenCalled();
  });
  it.each(['image/svg+xml', 'image/png', 'text/html'])('does not serve legacy non-raster bytes labeled %s', async mime => {
    db.mockResolvedValue({ rows: [{ logo_data: svg.toString('base64'), logo_mime_type: mime }] } as any);
    const response = await request(app).get('/auth/me/logo').set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('rejects non-raster bytes even if upload MIME says PNG', async () => {
    const response = await request(app).post('/auth/me/logo').set('Authorization', `Bearer ${token()}`)
      .attach('logo', svg, { filename: 'synthetic.png', contentType: 'image/png' });
    expect(response.status).toBe(400);
    expect(db).not.toHaveBeenCalled();
  });
  it.each(['png', 'jpeg'] as const)('decodes and serves legitimate %s as a fresh PNG', async format => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).toFormat(format).toBuffer();
    db.mockResolvedValue({ rows: [] } as any);
    const upload = await request(app).post('/auth/me/logo').set('Authorization', `Bearer ${token()}`)
      .attach('logo', bytes, { filename: `logo.${format}`, contentType: `image/${format}` });
    expect(upload.status).toBe(200);
    expect(db.mock.calls[0][1]?.slice(1)).toEqual(['image/png', 'synthetic-user']);
    db.mockResolvedValue({ rows: [{ logo_data: bytes.toString('base64'), logo_mime_type: `image/${format}` }] } as any);
    const response = await request(app).get('/auth/me/logo').set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect((await sharp(response.body).metadata()).width).toBe(2);
    expect(db.mock.calls.at(-1)?.[1]).toEqual(['synthetic-user']);
  });
});
