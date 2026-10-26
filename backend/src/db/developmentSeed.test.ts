import { describe, expect, it } from 'vitest';
import { assertLocalSeedEnvironment, normalizeSeedEmail, seedEmail, shiftSeedDate, validateSeedOptions } from './developmentSeed';

describe('development seed safeguards', () => {
  const local = { SEED_CONFIRM_LOCAL: '1', DB_HOST: '127.0.0.1', DB_NAME: 'essential_seed_test' };
  it('requires explicit consent, host and database and refuses production/remote hosts', () => {
    for (const env of [{}, { ...local, SEED_CONFIRM_LOCAL: '' }, { ...local, NODE_ENV: 'production' }, { ...local, DB_HOST: 'db.example.com' }, { ...local, DB_HOST: '' }, { ...local, DB_NAME: '' }]) {
      expect(() => assertLocalSeedEnvironment(env)).toThrow();
    }
    for (const host of ['localhost', '127.0.0.1', '::1', '/tmp/seed-postgres']) {
      expect(() => assertLocalSeedEnvironment({ ...local, DB_HOST: host })).not.toThrow();
    }
  });
  it('validates CLI values before writes and distinguishes scenario identities', () => {
    const options = { email: 'local@example.invalid', password: 'scratch-password', date: '2026-10-26', scenarios: ['core', 'vat', 'identified'] as const };
    expect(() => validateSeedOptions({ ...options, scenarios: [...options.scenarios] })).not.toThrow();
    for (const patch of [{ date: '2026-02-30' }, { password: 'short' }, { email: 'invalid' }, { scenarios: [] }, { scenarios: ['core', 'core'] }, { scenarios: ['unknown'] }]) {
      expect(() => validateSeedOptions({ ...options, scenarios: [...options.scenarios], ...patch } as any)).toThrow();
    }
    expect(seedEmail(options.email, 'vat')).toBe('vat_local@example.invalid');
    expect(seedEmail(options.email, 'identified')).toBe('identified_local@example.invalid');
  });
  it('uses the same email identity as login, including provider aliases', async () => {
    for (const [input, expected] of [['Developer@example.invalid', 'developer@example.invalid'], ['Developer.Name+local@gmail.com', 'developername@gmail.com'], ['developer-local@yahoo.com', 'developer@yahoo.com']]) {
      const email = await normalizeSeedEmail(input);
      expect(email).toBe(expected);
      for (const scenario of ['core', 'vat', 'identified'] as const) {
        const address = seedEmail(email, scenario);
        expect(await normalizeSeedEmail(address)).toBe(address);
      }
    }
  });
  it('keeps relative dates deterministic over month, year and leap-day boundaries', () => {
    expect(shiftSeedDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftSeedDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftSeedDate('2028-03-01', -1)).toBe('2028-02-29');
  });
});
