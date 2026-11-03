import jwt from 'jsonwebtoken';
import { query } from '../db/init';
import { getJwtSecret } from './jwt';

export async function verifySessionToken(token: string): Promise<{ userId: string; email?: string }> {
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || typeof decoded.userId !== 'string') throw new Error('Invalid session');
  // Pre-migration JWTs are version zero. They are revoked on the first password change.
  const version = decoded.sessionVersion ?? 0;
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid session');
  const result = await query('SELECT session_version FROM users WHERE id = $1', [decoded.userId]);
  if (!result.rows.length || result.rows[0].session_version !== version) throw new Error('Revoked session');
  return { userId: decoded.userId, email: decoded.email };
}
