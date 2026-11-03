import { beforeEach, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
vi.mock('../db/init', () => ({ query: vi.fn() }));
import { query } from '../db/init';
import { verifySessionToken } from './session';
const key = 'synthetic-session-test-secret';
beforeEach(() => { vi.resetAllMocks(); process.env.JWT_SECRET = key; });
it('fails closed when the session database is unavailable', async () => {
  vi.mocked(query).mockRejectedValue(new Error('offline'));
  await expect(verifySessionToken(jwt.sign({ userId: 'synthetic', sessionVersion: 0 }, key))).rejects.toThrow();
});
it.each([-1, '0', 1.2])('rejects invalid version %s without querying', async sessionVersion => {
  await expect(verifySessionToken(jwt.sign({ userId: 'synthetic', sessionVersion }, key))).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
});
