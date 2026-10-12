import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { fingerprint } from '../services/vatFilingData';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  dbQuery: vi.fn(),
  release: vi.fn(),
  load: vi.fn(),
}));
vi.mock('../db/init', () => ({
  query: mocks.query,
  pool: {
    connect: async () => ({ query: mocks.dbQuery, release: mocks.release }),
  },
}));
vi.mock('../services/vatFilingData', async (original) => ({
  ...(await original<typeof import('../services/vatFilingData')>()),
  loadFilingSnapshot: mocks.load,
}));
import { vatFilingRouter } from './vatFilings';
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000003';
const profile = {
  status: 'payer',
  personType: 'individual',
  frequency: 'monthly',
  vatId: 'CZ9001010007',
  firstName: 'Test',
  lastName: 'Novák',
  street: 'Testovací',
  houseNumber: '1',
  city: 'Praha',
  postcode: '11000',
  taxOffice: '451',
  taxOfficeBranch: '2001',
  activityCode: '621000',
  email: 'vat-test@example.com',
  effectiveFrom: '2026-01-01',
};
const snapshot = { profile, vatPayer: true, documents: [] };
const app = express();
app.use(express.json());
app.use((req, _, next) => {
  (req as any).userId = req.headers['x-test-user'] || user;
  next();
});
app.use('/vat-filings', vatFilingRouter);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(structuredClone(snapshot));
  mocks.dbQuery.mockResolvedValue({ rows: [] });
});
describe('user-scoped immutable VAT exports', () => {
  it('stores the exact validated XML and a consistent snapshot in one transaction', async () => {
    mocks.dbQuery.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('INSERT') ? [{ id, created_at: '2026-09-08' }] : [],
    }));
    const r = await request(app)
      .post('/vat-filings/versions')
      .send({
        period: '2026-08',
        type: 'DPHDP3',
        snapshotHash: fingerprint(snapshot),
      });
    expect(r.status).toBe(201);
    expect(mocks.dbQuery.mock.calls[0][0]).toBe(
      'BEGIN ISOLATION LEVEL REPEATABLE READ',
    );
    const [sql, values] = mocks.dbQuery.mock.calls.find((c) =>
      c[0].startsWith('INSERT'),
    )!;
    expect(sql).toContain('snapshot_hash');
    expect(values[0]).toBe(user);
    expect(JSON.parse(values[5])).toEqual(snapshot);
    expect(values[9]).toContain('<DPHDP3');
    expect(JSON.parse(values[8]).epoImportVerified).toBe(false);
    expect(mocks.dbQuery.mock.calls.at(-1)![0]).toBe('COMMIT');
    expect(mocks.release).toHaveBeenCalled();
  });
  it('returns original bytes after settings change, with no regeneration', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<Pisemnost>Žluťoučký</Pisemnost>\n';
    mocks.query.mockResolvedValue({
      rows: [{ xml, period: '2026-08', filing_type: 'DPHDP3' }],
    });
    const r = await request(app).get(`/vat-filings/versions/${id}/xml`);
    expect(r.status).toBe(200);
    expect(r.text).toBe(xml);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('AND user_id = $2'),
      [id, user],
    );
  });
  it('returns 404 for another user’s XML and snapshot', async () => {
    mocks.query.mockImplementation(async (_sql: string, params: string[]) => ({
      rows: params[1] === user ? [{ xml: 'original' }] : [],
    }));
    for (const suffix of ['', '/xml']) {
      const r = await request(app)
        .get(`/vat-filings/versions/${id}${suffix}`)
        .set('x-test-user', other);
      expect(r.status).toBe(404);
    }
  });
  it('rejects stale review and unsupported filing modes without inserts', async () => {
    const r = await request(app)
      .post('/vat-filings/versions')
      .send({ period: '2026-08', type: 'DPHDP3', snapshotHash: 'old' });
    expect(r.status).toBe(409);
    expect(
      mocks.dbQuery.mock.calls.some((c) => c[0].startsWith('INSERT')),
    ).toBe(false);
    expect(
      (
        await request(app)
          .post('/vat-filings/versions')
          .send({
            period: '2026-08',
            type: 'DPHDP3',
            mode: 'supplementary',
            snapshotHash: fingerprint(snapshot),
          })
      ).status,
    ).toBe(400);
  });
  it('does not generate XML while identity or document blockers exist', async () => {
    const incomplete = { ...snapshot, profile: null };
    mocks.load.mockResolvedValue(incomplete);
    const r = await request(app)
      .post('/vat-filings/versions')
      .send({
        period: '2026-08',
        type: 'DPHDP3',
        snapshotHash: fingerprint(incomplete),
      });
    expect(r.status).toBe(422);
    expect(
      mocks.dbQuery.mock.calls.some((c) => c[0].startsWith('INSERT')),
    ).toBe(false);
  });
  it('rolls back and returns a generic error without leaking filing data', async () => {
    mocks.load.mockRejectedValue(new Error('sensitive VAT-ID'));
    const r = await request(app)
      .post('/vat-filings/review')
      .send({ period: '2026-08', type: 'DPHDP3' });
    expect(r.status).toBe(500);
    expect(r.text).not.toContain('sensitive');
    expect(mocks.dbQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.release).toHaveBeenCalled();
  });
  it('scope-checks document review edits before writing', async () => {
    const data = {
      classification: 'domestic',
      country: 'CZ',
      vatId: 'CZ00000027',
      counterpartyType: 'business',
      documentKind: 'ordinary',
      taxPoint: '2026-08-01',
      receivedDate: '2026-08-02',
      reference: '',
      deduction: 'none',
      deductibleTax: 0,
      claimPeriod: '',
      reverseChargeCode: '',
      exchangeRate: 1,
      exchangeRateDate: '2026-08-01',
      exchangeRateSource: 'recorded',
      fingerprint: 'x',
    };
    const r = await request(app)
      .put(`/vat-filings/documents/received/${id}`)
      .set('x-test-user', other)
      .send(data);
    expect(r.status).toBe(404);
    expect(mocks.dbQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND user_id = $2 FOR UPDATE'),
      [id, other],
    );
    expect(
      mocks.dbQuery.mock.calls.some((c) => c[0].startsWith('UPDATE')),
    ).toBe(false);
  });
});

it('returns owner-scoped profile suggestions without treating them as confirmed metadata', async () => {
  mocks.load.mockResolvedValue({ ...snapshot, profile: null });
  mocks.dbQuery.mockImplementation(async (sql: string, values: unknown[]) => ({
    rows: sql.startsWith('SELECT name')
      ? [
          {
            name: 'Jana Nováková',
            email: 'jana@example.com',
            company_dic: 'CZ9001010007',
            company_address: 'Dlouhá 123/4, 110 00 Praha',
            vat_payer: true,
          },
        ]
      : [],
  }));
  const response = await request(app).get('/vat-filings/workspace');
  expect(response.status).toBe(200);
  expect(response.body.profile).toBeNull();
  expect(response.body.profileDefaults).toMatchObject({
    firstName: 'Jana',
    lastName: 'Nováková',
    status: 'payer',
    houseOrientation: '4',
  });
  expect(mocks.dbQuery).toHaveBeenCalledWith(
    expect.stringContaining('WHERE id = $1'),
    [user],
  );
  expect(mocks.dbQuery.mock.calls.some((c) => c[0].startsWith('UPDATE'))).toBe(
    false,
  );
});
it('atomically saves an expense breakdown and its reviewed metadata against the updated source', async () => {
  const { doc } = await import('../test/fixtures/vatFiling');
  const before = doc({ id, direction: 'received' });
  const buckets = [
    { rate: 21, base: 8000, tax: 1680 },
    { rate: 12, base: 2000, tax: 420 },
  ];
  const after = { ...before, buckets, fingerprint: 'new-source' };
  mocks.load
    .mockResolvedValueOnce({ ...snapshot, documents: [before] })
    .mockResolvedValueOnce({ ...snapshot, documents: [after] });
  const response = await request(app)
    .put(`/vat-filings/documents/received/${id}`)
    .send({
      ...before.metadata,
      fingerprint: before.fingerprint,
      buckets,
      deduction: 'full',
      claimPeriod: '2026-08',
      deductibleTax: 2100,
    });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    reviewedFingerprint: 'new-source',
    deduction: 'full',
    claimPeriod: '2026-08',
  });
  const updates = mocks.dbQuery.mock.calls.filter((c) =>
    c[0].startsWith('UPDATE'),
  );
  expect(updates).toHaveLength(2);
  expect(updates[0][1]).toEqual([JSON.stringify(buckets), id, user]);
  expect(JSON.parse(updates[1][1][0])).toMatchObject({
    reviewedFingerprint: 'new-source',
    deduction: 'full',
  });
  expect(mocks.dbQuery.mock.calls.at(-1)![0]).toBe('COMMIT');
});
it('rejects breakdown edits that change historical totals without saving any tax metadata', async () => {
  const { doc } = await import('../test/fixtures/vatFiling');
  const before = doc({ id, direction: 'received' });
  mocks.load.mockResolvedValue({ ...snapshot, documents: [before] });
  const response = await request(app)
    .put(`/vat-filings/documents/received/${id}`)
    .send({
      ...before.metadata,
      fingerprint: before.fingerprint,
      buckets: [{ rate: 21, base: 1, tax: 0 }],
    });
  expect(response.status).toBe(422);
  expect(response.body.error).toBe('breakdown_totals');
  expect(mocks.dbQuery.mock.calls.some((c) => c[0].startsWith('UPDATE'))).toBe(
    false,
  );
});
