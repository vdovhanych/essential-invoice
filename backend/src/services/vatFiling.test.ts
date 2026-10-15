import { describe, it, expect } from 'vitest';
import { reviewFiling } from './vatFiling';
import { generateFilingXml, validateFilingXml } from './vatFilingXml';
import type {
  FilingDocument,
  FilingSnapshot,
  FilingType,
} from './vatFilingTypes';
import { profile, doc } from '../test/fixtures/vatFiling';
const snapshot = (documents: FilingDocument[]): FilingSnapshot => ({
  profile: { ...profile },
  vatPayer: true,
  documents,
});
const review = (documents: FilingDocument[], type: FilingType = 'DPHDP3') =>
  reviewFiling(snapshot(documents), '2026-08', type);
describe('VAT filing calculations', () => {
  it('maps domestic rows and statement with recorded tax', () => {
    const r = review([doc()]);
    expect(r.issues.filter((x) => x.severity === 'blocker')).toEqual([]);
    expect(r.rows[1].tax).toBe(2100);
    expect(r.rows[64].tax).toBe(2100);
    expect(r.statement[0].section).toBe('A4');
    expect(r.reconciliation.every((x) => x.passed)).toBe(true);
  });
  it('keeps 10000 inclusive in A5, business above it in A4, consumers in A5', () => {
    const d = doc({
      base: 8264.46,
      tax: 1735.54,
      total: 10000,
      buckets: [{ base: 8264.46, tax: 1735.54, rate: 21 }],
    });
    expect(review([d]).statement[0].section).toBe('A5');
    d.total = 10000.01;
    expect(review([d]).statement[0].section).toBe('A4');
    d.metadata!.counterpartyType = 'consumer';
    expect(review([d]).statement[0].section).toBe('A5');
  });
  it('never treats historical recorded VAT as a deduction', () => {
    const d = doc({ direction: 'received', metadata: null });
    const r = review([d]);
    expect(r.rows[63].tax).toBe(0);
    expect(r.issues.some((x) => x.code === 'review_document')).toBe(true);
  });
  it('claims mixed-rate recorded tax in the explicitly chosen period', () => {
    const d = doc({
      direction: 'received',
      base: 200,
      tax: 33.01,
      total: 233.01,
      buckets: [
        { base: 100, tax: 21.01, rate: 21 },
        { base: 100, tax: 12, rate: 12 },
      ],
    });
    Object.assign(d.metadata!, {
      deduction: 'full',
      deductibleTax: 33.01,
      claimPeriod: '2026-09',
    });
    expect(review([d]).rows[63].tax).toBe(0);
    const r = reviewFiling(snapshot([d]), '2026-09', 'DPHDP3');
    expect(r.rows[40].tax).toBe(21);
    expect(r.rows[41].tax).toBe(12);
    expect(r.statement[0].attributes.dan1).toBe(21.01);
  });
  it('blocks partial deductions, stale reviews, advances and unknown classifications', () => {
    for (const [key, value, code] of [
      ['deduction', 'partial', 'deduction_decision'],
      ['reviewedFingerprint', 'old', 'review_document'],
      ['documentKind', 'advance', 'special_document'],
      ['classification', 'unsupported', 'unsupported_classification'],
    ]) {
      const d = doc({ direction: 'received' });
      (d.metadata as any)[key] = value;
      expect(review([d]).issues.some((x) => x.code === code)).toBe(true);
    }
  });
  it('separates EU B2B services from domestic reverse charge', () => {
    const d = doc({
      base: 100.01,
      tax: 0,
      total: 100.01,
      buckets: [{ base: 100.01, tax: 0, rate: 0 }],
      lines: [
        { base: 100.01, tax: 0, rate: 0, treatment: 'eu_service', code: '' },
      ],
    });
    Object.assign(d.metadata!, {
      classification: 'eu_service',
      country: 'DE',
      vatId: 'DE123456789',
    });
    const r = review([d], 'DPHSHV');
    expect(r.rows[21].base).toBe(100);
    expect(r.statement[0].attributes.pln_hodnota).toBe(101);
    expect(r.statement[0].attributes.k_pln_eu).toBe(3);
    expect(r.issues.filter((x) => x.severity === 'blocker')).toEqual([]);
    d.lines[0].treatment = 'reverse_charge';
    expect(review([d]).issues.some((x) => x.code === 'eu_line_treatment')).toBe(
      true,
    );
  });
  it('converts EUR using reviewed tax-point rate, not the dashboard rate', () => {
    const d = doc({ currency: 'EUR', exchangeRate: 20 });
    Object.assign(d.metadata!, { exchangeRate: 25 });
    expect(review([d]).rows[1].base).toBe(250000);
  });
  it('self-assesses EU purchases and denies identified persons deductions and KH', () => {
    const d = doc({
      direction: 'received',
      base: 100,
      tax: 0,
      total: 100,
      buckets: [{ rate: 21, base: 100, tax: 0 }],
    });
    Object.assign(d.metadata!, {
      classification: 'eu_service',
      country: 'DE',
      vatId: 'DE123456789',
    });
    const s = snapshot([d]);
    s.profile!.status = 'identified';
    s.vatPayer = false;
    expect(reviewFiling(s, '2026-08', 'DPHDP3').rows[64].tax).toBe(21);
    expect(reviewFiling(s, '2026-08', 'DPHKH1').applicable).toBe(false);
  });
  it('rejects unsupported years and SH replacement requests', () => {
    expect(() => reviewFiling(snapshot([]), '2025-08', 'DPHDP3')).toThrow();
    expect(
      reviewFiling(
        snapshot([]),
        '2026-08',
        'DPHSHV',
        'replacement',
      ).issues.some((x) => x.code === 'correction_workflow'),
    ).toBe(true);
  });
});
describe('official EPO XSD validation', () => {
  for (const type of ['DPHDP3', 'DPHKH1', 'DPHSHV'] as const)
    it(`validates representative ${type} XML against the bundled official schema`, async () => {
      const d = doc();
      if (type === 'DPHSHV') {
        Object.assign(d, {
          base: 100,
          tax: 0,
          total: 100,
          buckets: [{ base: 100, tax: 0, rate: 0 }],
          lines: [
            { base: 100, tax: 0, rate: 0, treatment: 'eu_service', code: '' },
          ],
        });
        Object.assign(d.metadata!, {
          classification: 'eu_service',
          country: 'DE',
          vatId: 'DE123456789',
        });
      }
      const r = review([d], type);
      const xml = generateFilingXml(r, { ...profile }, '2026-09-08');
      const validation = await validateFilingXml(type, xml);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);
    });
  it('rejects invented XML attributes', async () => {
    const xml = generateFilingXml(
      review([doc()]),
      { ...profile },
      '2026-09-08',
    ).replace('<Veta1 ', '<Veta1 guessed="1" ');
    expect((await validateFilingXml('DPHDP3', xml)).valid).toBe(false);
  });
});
describe('filing scope and period regressions', () => {
  it('maps construction services to 25/A1 and acquisitions to 10/B1 and 43', async () => {
    for (const received of [false, true]) {
      const d = doc({
        direction: received ? 'received' : 'issued',
        tax: 0,
        total: 10000,
        buckets: [{ rate: 21, base: 10000, tax: 0 }],
        lines: [
          {
            rate: 21,
            base: 10000,
            tax: 0,
            treatment: 'reverse_charge',
            code: '4',
          },
        ],
      });
      Object.assign(d.metadata!, {
        classification: 'domestic_reverse_charge',
        reverseChargeCode: '4',
        ...(received
          ? { deduction: 'full', claimPeriod: '2026-08', deductibleTax: 2100 }
          : {}),
      });
      const r = review([d], 'DPHKH1');
      expect(r.issues.filter((i) => i.severity === 'blocker')).toEqual([]);
      expect(r.rows[received ? 10 : 25].base).toBe(10000);
      expect(r.statement[0].section).toBe(received ? 'B1' : 'A1');
      if (received) {
        expect(r.rows[43].tax).toBe(2100);
        expect(r.rows[64].tax).toBe(0);
      }
      expect(
        (
          await validateFilingXml(
            'DPHKH1',
            generateFilingXml(r, { ...profile }, '2026-09-08'),
          )
        ).valid,
      ).toBe(true);
    }
  });
  it('groups EU services by VAT ID and code, counts documents, rounds the group upward', () => {
    const a = doc({
      id: 'a',
      tax: 0,
      base: 100.1,
      total: 100.1,
      buckets: [{ base: 100.1, tax: 0, rate: 0 }],
      lines: [
        { base: 100.1, tax: 0, rate: 0, treatment: 'eu_service', code: '' },
      ],
    });
    Object.assign(a.metadata!, {
      classification: 'eu_service',
      country: 'DE',
      vatId: 'DE123456789',
    });
    const b = structuredClone(a);
    b.id = 'b';
    const r = review([a, b], 'DPHSHV');
    expect(r.statement).toHaveLength(1);
    expect(r.statement[0].attributes).toMatchObject({
      pln_pocet: 2,
      pln_hodnota: 201,
    });
    expect(r.rows[21].base).toBe(200);
    expect(r.reconciliation.every((c) => c.passed)).toBe(true);
  });
  it('keeps mixed rates together on one B2 row and only requires detail above 10000', () => {
    const d = doc({
      direction: 'received',
      base: 10000,
      tax: 1650.01,
      total: 11650.01,
      buckets: [
        { rate: 21, base: 5000, tax: 1050.01 },
        { rate: 12, base: 5000, tax: 600 },
      ],
    });
    Object.assign(d.metadata!, {
      deduction: 'full',
      deductibleTax: 1650.01,
      claimPeriod: '2026-08',
    });
    const r = review([d]);
    expect(r.statement).toHaveLength(1);
    expect(r.statement[0].section).toBe('B2');
    expect(r.statement[0].attributes).toMatchObject({
      zakl_dane1: 5000,
      dan1: 1050.01,
      zakl_dane2: 5000,
      dan2: 600,
    });
  });
  it('rejects claim periods before receipt, wrong frequency and delayed reverse-charge deductions', () => {
    const d = doc({ direction: 'received' });
    Object.assign(d.metadata!, {
      deduction: 'full',
      deductibleTax: 2100,
      claimPeriod: '2026-08',
      receivedDate: '2026-09-01',
    });
    expect(review([d]).issues.some((i) => i.code === 'claim_period')).toBe(
      true,
    );
    d.metadata!.claimPeriod = '2026-Q3';
    expect(review([d]).issues.some((i) => i.code === 'claim_period')).toBe(
      true,
    );
    Object.assign(d.metadata!, {
      classification: 'domestic_reverse_charge',
      reverseChargeCode: '4',
      claimPeriod: '2026-09',
    });
    expect(
      review([d]).issues.some((i) => i.code === 'reverse_claim_period'),
    ).toBe(true);
  });
  it('uses quarterly periods for individual payers and their service-only SH', () => {
    const s = snapshot([doc()]);
    s.profile!.frequency = 'quarterly';
    const r = reviewFiling(s, '2026-Q3', 'DPHKH1');
    expect(r.rows[1].base).toBe(10000);
    expect(r.issues.filter((i) => i.severity === 'blocker')).toEqual([]);
    expect(generateFilingXml(r, s.profile!, '2026-10-01')).toContain(
      'ctvrt="3"',
    );
  });
  it('blocks unknown prior records rather than dropping them from the review', () => {
    const d = doc({
      issueDate: '2026-07-01',
      deliveryDate: '2026-07-01',
      metadata: null,
    });
    expect(review([d]).issues.some((i) => i.code === 'review_document')).toBe(
      true,
    );
  });
  it('rejects inconsistent totals, invalid country combinations and wrong EU VAT-ID formats', () => {
    const d = doc({ total: 12000 });
    expect(review([d]).issues.some((i) => i.code === 'totals_mismatch')).toBe(
      true,
    );
    d.metadata!.country = 'DE';
    expect(review([d]).issues.some((i) => i.code === 'domestic_country')).toBe(
      true,
    );
    Object.assign(d.metadata!, {
      classification: 'eu_service',
      vatId: 'DEABC',
    });
    expect(review([d]).issues.some((i) => i.code === 'eu_identity')).toBe(true);
  });
  it('blocks §74b overdue-debt corrections when an earlier deduction remains unpaid', () => {
    const d = doc({
      direction: 'received',
      issueDate: '2026-01-01',
      deliveryDate: '2026-01-01',
      dueDate: '2026-01-15',
      status: 'unpaid',
    });
    Object.assign(d.metadata!, {
      taxPoint: '2026-01-01',
      receivedDate: '2026-01-01',
      deduction: 'full',
      deductibleTax: 2100,
      claimPeriod: '2026-01',
    });
    expect(review([d]).issues.some((i) => i.code === 'unpaid_adjustment')).toBe(
      true,
    );
  });
  it('validates mixed-rate Czech deductions and EU self-assessment XML', async () => {
    const d = doc({
      direction: 'received',
      tax: 0,
      total: 10000,
      buckets: [{ rate: 21, base: 10000, tax: 0 }],
    });
    Object.assign(d.metadata!, {
      classification: 'eu_service',
      country: 'DE',
      vatId: 'DE123456789',
      deduction: 'full',
      deductibleTax: 2100,
      claimPeriod: '2026-08',
    });
    for (const type of ['DPHDP3', 'DPHKH1'] as const) {
      const r = review([d], type);
      expect(r.issues.filter((i) => i.severity === 'blocker')).toEqual([]);
      expect(
        (
          await validateFilingXml(
            type,
            generateFilingXml(r, { ...profile }, '2026-09-08'),
          )
        ).valid,
      ).toBe(true);
    }
  });
});

it('blocks linked partial advance payments and payments with unknown dates', () => {
  for (const date of ['2026-07-31', '']) {
    const d = doc({ payments: [{ date, amount: 100 }] });
    expect(review([d]).issues.some((i) => i.code === 'advance_payment')).toBe(
      true,
    );
  }
});

describe('advance payment period selection', () => {
  function futureSupply(patch: Partial<FilingDocument> = {}) {
    const d = doc({ deliveryDate: '2026-10-01', ...patch });
    if (d.metadata) d.metadata.taxPoint = '2026-10-01';
    return d;
  }

  it.each(['DPHDP3', 'DPHKH1'] as const)('blocks %s in the receipt month for a future supply', (type) => {
    const d = futureSupply({ paidAt: '2026-08-15', status: 'paid' });
    const r = review([d], type);
    expect(r.documents.map(d => d.id)).toEqual([d.id]);
    expect(r.issues).toContainEqual(expect.objectContaining({ code: 'advance_payment', severity: 'blocker' }));
    expect(r.rows[1]?.tax || 0).toBe(0);
    expect(r.statement).toEqual([]);
  });

  it('includes a partial receipt even if final payment is in the supply month', () => {
    const d = futureSupply({ paidAt: '2026-10-15', status: 'paid', payments: [{ date: '2026-08-15', amount: 100 }] });
    expect(review([d]).issues).toContainEqual(expect.objectContaining({ code: 'advance_payment' }));
  });

  it('blocks the receipt quarter before a supply in the next quarter', () => {
    const d = futureSupply({ payments: [{ date: '2026-09-30', amount: 100 }] });
    const r = reviewFiling({ ...snapshot([d]), profile: { ...profile, frequency: 'quarterly' } }, '2026-Q3', 'DPHDP3');
    expect(r.issues).toContainEqual(expect.objectContaining({ code: 'advance_payment' }));
  });

  it.each(['', 'invalid'])('requires review of a future invoice with an unknown payment date (%s)', (date) => {
    const d = futureSupply({ payments: [{ date, amount: 100 }] });
    expect(review([d]).issues).toContainEqual(expect.objectContaining({ code: 'advance_payment' }));
  });

  it.each([
    { payments: [{ date: '2026-09-01', amount: 100 }] },
    { payments: [{ date: '2026-08-15', amount: 0 }] },
    { payments: [{ date: '2026-08-15', amount: -100 }] },
    { direction: 'received' as const, paidAt: '2026-08-15' },
  ])('does not pull unrelated future supplies into the period: %j', (patch) => {
    expect(review([futureSupply(patch)]).documents).toEqual([]);
  });

  it('still requires source review when the future supply has not been classified', () => {
    const d = futureSupply({ payments: [{ date: '2026-08-15', amount: 100 }], metadata: null });
    expect(review([d]).issues).toContainEqual(expect.objectContaining({ code: 'review_document' }));
  });
});

describe('overdue deduction payment timing', () => {
  function expense() {
    const d = doc({
      direction: 'received', issueDate: '2026-01-01', deliveryDate: '2026-01-01',
      dueDate: '2026-01-15', status: 'unpaid',
    });
    Object.assign(d.metadata!, {
      taxPoint: '2026-01-01', receivedDate: '2026-01-01',
      deduction: 'full', deductibleTax: 2100, claimPeriod: '2026-01',
    });
    return d;
  }

  it.each([
    ['2026-06', 'unpaid', '', false],
    ['2026-07', 'unpaid', '', true],
    ['2026-07', 'paid', '2026-07-31', false],
    ['2026-07', 'paid', '2026-08-10', true],
    ['2026-08', 'paid', '2026-08-10', true],
    ['2026-09', 'paid', '2026-08-10', false],
    ['2026-07', 'paid', '', true],
    ['2026-07', 'paid', 'invalid', true],
    ['2026-Q2', 'unpaid', '', false],
    ['2026-Q3', 'unpaid', '', true],
    ['2026-Q3', 'paid', '2026-08-10', false],
    ['2026-Q3', 'paid', '2026-09-30', false],
    ['2026-Q3', 'paid', '2026-10-01', true],
    ['2026-Q4', 'paid', '2026-10-01', true],
  ] as const)('checks %s with status %s and payment date "%s"', (period, status, paidAt, blocked) => {
    const d = expense();
    Object.assign(d, { status, paidAt });
    const s = snapshot([d]);
    if (period.includes('Q')) {
      s.profile!.frequency = 'quarterly';
      d.metadata!.claimPeriod = '2026-Q1';
    }
    const r = reviewFiling(s, period, 'DPHDP3');
    expect(r.issues.filter(i => i.severity === 'blocker').map(i => i.code))
      .toEqual(blocked ? ['unpaid_adjustment'] : []);
    if (blocked) expect(() => generateFilingXml(r, s.profile!, '2026-10-13')).toThrow('blocked');
  });

  it.each(['eu_service', 'domestic_reverse_charge'] as const)('excludes overdue %s purchases from §74b', classification => {
    const d = expense();
    Object.assign(d, { tax: 0, total: 10000, buckets: [{ rate: 21, base: 10000, tax: 0 }] });
    Object.assign(d.metadata!, {
      classification,
      ...(classification === 'eu_service'
        ? { country: 'DE', vatId: 'DE123456789' }
        : { reverseChargeCode: '4' }),
    });
    const s = snapshot([d]);
    const original = reviewFiling(s, '2026-01', 'DPHDP3');
    expect(original.issues.filter(i => i.severity === 'blocker')).toEqual([]);
    expect(original.rows[43].tax).toBe(2100);
    const later = reviewFiling(s, '2026-07', 'DPHDP3');
    expect(later.issues.filter(i => i.severity === 'blocker')).toEqual([]);
    expect(later.documents).toEqual([]);
  });
});
