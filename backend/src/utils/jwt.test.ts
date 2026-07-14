import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getJwtSecret, validateJwtSecret } from './jwt';

describe('jwt utils', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('returns the secret when properly configured', () => {
    process.env.JWT_SECRET = 'a-sufficiently-long-secret-value';
    expect(getJwtSecret()).toBe('a-sufficiently-long-secret-value');
  });

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('validateJwtSecret passes with a valid secret', () => {
    process.env.JWT_SECRET = 'a-sufficiently-long-secret-value';
    expect(() => validateJwtSecret()).not.toThrow();
  });
});
