import { validCzechVatId, validEuServiceVatId } from '../utils/filingVatId';
import { roundMoney } from '../utils/money';
import lists from './vatSchemas/codeLists.json';
import type {
  FilingDocument,
  FilingIssue,
  FilingMode,
  FilingReview,
  FilingSnapshot,
  FilingType,
  StatementRow,
} from './vatFilingTypes';

export const schemas = {
  DPHDP3: '03.01.03',
  DPHKH1: '03.01.14',
  DPHSHV: '02.01.04',
} as const;
export function periodBounds(period: string) {
  if (!/^2026-(0[1-9]|1[0-2]|Q[1-4])$/.test(period)) throw new Error('period');
  const year = Number(period.slice(0, 4));
  const quarter = period[5] === 'Q';
  const month = quarter
    ? (Number(period[6]) - 1) * 3 + 1
    : Number(period.slice(5));
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: new Date(Date.UTC(year, month - 1 + (quarter ? 3 : 1), 0))
      .toISOString()
      .slice(0, 10),
    year,
    month,
    quarter,
  };
}
export function validDate(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
const czVat = validCzechVatId;
const inPeriod = (date: string, b: { from: string; to: string }) =>
  date >= b.from && date <= b.to;
function needsOverdueDeductionReview(
  d: FilingDocument,
  b: { from: string; to: string; quarter: boolean },
): boolean {
  const m = d.metadata;
  if (
    d.direction !== 'received' || m?.classification !== 'domestic' ||
    m.deduction !== 'full' || !m.claimPeriod || !validDate(d.dueDate)
  ) return false;
  try {
    if (periodBounds(m.claimPeriod).to >= b.from) return false;
  } catch {
    return false;
  }
  // §74b applies to supplier-charged VAT, not self-assessed reverse charge.
  const deadline = new Date(`${d.dueDate}T00:00:00Z`);
  deadline.setUTCMonth(deadline.getUTCMonth() + 7, 0);
  // Quarterly payers can settle until the end of the quarter containing the cutoff.
  if (b.quarter)
    deadline.setUTCMonth(Math.floor(deadline.getUTCMonth() / 3) * 3 + 3, 0);
  const adjustmentDate = deadline.toISOString().slice(0, 10);
  if (adjustmentDate > b.to) return false;
  if (d.status !== 'paid' || !validDate(d.paidAt)) return true;
  // Later payment cannot erase a historical adjustment. The repayment period
  // also requires an unsupported correction; periods after repayment do not.
  return d.paidAt > adjustmentDate && d.paidAt >= b.from;
}
const add = (a: number, b: number) => roundMoney(a + b);
const sum = (values: number[]) => values.reduce(add, 0);
const EU = new Set(
  lists.zeme.rows
    .filter(
      (r) => r.d_pocpl_eu && (!r.d_ukopl_eu || r.d_ukopl_eu > '2026-12-31'),
    )
    .map((r) => r.kod2),
);
export function reviewFiling(
  snapshot: FilingSnapshot,
  period: string,
  type: FilingType,
  mode: FilingMode = 'original',
): FilingReview {
  const b = periodBounds(period);
  const p = snapshot.profile;
  const issues: FilingIssue[] = [];
  const issue = (
    code: string,
    d?: FilingDocument,
    field?: string,
    severity: 'blocker' | 'warning' = 'blocker',
  ) =>
    issues.push({
      code,
      severity,
      ...(d ? { documentId: d.id, direction: d.direction } : {}),
      ...(field ? { field } : {}),
    });
  const result: FilingReview = {
    period,
    type,
    mode,
    schemaVersion: schemas[type],
    applicable: false,
    reason: 'no_activity',
    issues,
    rows: {},
    statement: [],
    documents: [],
    reconciliation: [],
  };
  if (!p) {
    issue('profile_required');
    return result;
  }
  if (p.personType !== 'individual') issue('individual_only');
  if (!['payer', 'identified', 'nonpayer'].includes(p.status))
    issue('status_required');
  if ((p.status === 'payer') !== snapshot.vatPayer) issue('status_conflict');
  if (
    !['monthly', 'quarterly'].includes(p.frequency) ||
    (p.status === 'identified' && p.frequency !== 'monthly') ||
    b.quarter !== (p.frequency === 'quarterly')
  )
    issue('frequency');
  if (!validDate(p.effectiveFrom) || p.effectiveFrom > b.from)
    issue('registration_period');
  if (p.status !== 'nonpayer') {
    if (!czVat(p.vatId || '') || !/^CZ\d{9,10}$/.test(p.vatId || ''))
      issue('identity', undefined, 'vatId');
    for (const field of [
      'firstName',
      'lastName',
      'city',
      'houseNumber',
      'postcode',
    ] as const)
      if (!p[field]?.trim()) issue('identity', undefined, field);
    if (!/^\d{5}$/.test(p.postcode || ''))
      issue('identity', undefined, 'postcode');
    if (
      !lists.ufo.rows.some((r) => r.c_ufo === p.taxOffice) ||
      !lists.pracufo.rows.some(
        (r) => r.c_pracufo === p.taxOfficeBranch && r.c_ufo === p.taxOffice,
      )
    )
      issue('office');
    if (
      !lists.okec.rows.some(
        (r) =>
          r.c_nace === p.activityCode &&
          r.d_pocpl <= b.from &&
          (!r.d_ukopl || r.d_ukopl >= b.to),
      )
    )
      issue('activity');
    if (
      type === 'DPHKH1' &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || '') ||
        /\.(invalid|localhost|test)$/i.test(p.email || ''))
    )
      issue('identity', undefined, 'email');
  }
  if (
    !['original', 'replacement'].includes(mode) ||
    (mode === 'replacement' && type === 'DPHSHV')
  )
    issue('correction_workflow');
  if (mode === 'replacement') {
    const deadline = new Date(`${b.to}T00:00:00Z`);
    deadline.setUTCMonth(deadline.getUTCMonth() + 1, 25);
    while (
      [0, 6].includes(deadline.getUTCDay()) ||
      (deadline.getUTCMonth() === 11 &&
        [25, 26].includes(deadline.getUTCDate()))
    )
      deadline.setUTCDate(deadline.getUTCDate() + 1);
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Prague',
    }).format(new Date());
    issue(
      'replacement_deadline',
      undefined,
      undefined,
      today > deadline.toISOString().slice(0, 10) ? 'blocker' : 'warning',
    );
  }
  const row = (n: number, base: number, tax: number, id: string) => {
    const r = result.rows[n] ?? { base: 0, tax: 0, documents: [] };
    r.base = add(r.base, base);
    r.tax = add(r.tax, tax);
    if (!r.documents.includes(id)) r.documents.push(id);
    result.rows[n] = r;
  };
  const statement = (
    section: string,
    attributes: Record<string, string | number>,
    id: string,
    group = false,
  ) => {
    const previous = group
      ? result.statement.find((r) => r.section === section)
      : undefined;
    if (previous) {
      for (const [k, v] of Object.entries(attributes))
        previous.attributes[k] = add(
          Number(previous.attributes[k] || 0),
          Number(v),
        );
      previous.documents.push(id);
    } else result.statement.push({ section, attributes, documents: [id] });
  };
  for (const d of snapshot.documents) {
    const m = d.metadata;
    const approximate = validDate(m?.taxPoint)
      ? m.taxPoint
      : d.deliveryDate || d.issueDate;
    // Unknown older records remain in the queue until explicitly classified; no silent omission.
    const unresolved = !m || m.reviewedFingerprint !== d.fingerprint;
    const claimSelected =
      !!m?.claimPeriod &&
      (() => {
        try {
          const c = periodBounds(m.claimPeriod);
          return c.from >= b.from && c.to <= b.to;
        } catch {
          return false;
        }
      })();
    const taxSelected = inPeriod(approximate, b);
    const paymentDates = d.direction === 'issued'
      ? [
          ...(d.paidAt ? [d.paidAt] : []),
          ...(d.payments || []).filter((payment) => payment.amount > 0).map((payment) => payment.date),
        ]
      : [];
    const advanceDates = paymentDates.filter((date) => !validDate(date) || date < approximate);
    // Advances are unsupported, but must block the receipt period even when
    // the supply belongs to a later month/quarter. Unknown dates need review.
    const advanceSelected = advanceDates.some((date) => !validDate(date) || inPeriod(date, b));
    const backlog =
      unresolved &&
      approximate <= b.to &&
      approximate >= (p.effectiveFrom || '2026-01-01');
    const overdueDeduction = needsOverdueDeductionReview(d, b);
    if (!taxSelected && !claimSelected && !backlog && !overdueDeduction && !advanceSelected)
      continue;
    if (d.direction === 'issued' && d.status === 'draft') {
      if (taxSelected || advanceSelected) issue('draft_excluded', d, undefined, 'warning');
      continue;
    }
    result.documents.push(d);
    if (d.status === 'cancelled') {
      issue('cancelled_document', d);
      continue;
    }
    if (!m || unresolved) {
      issue('review_document', d);
      continue;
    }
    if (
      m.documentKind !== 'ordinary' ||
      m.reference ||
      d.base < 0 ||
      d.tax < 0
    ) {
      issue('special_document', d);
      continue;
    }
    if (!validDate(m.taxPoint) || m.taxPoint < p.effectiveFrom) {
      issue('tax_point', d, 'taxPoint');
      continue;
    }
    if (advanceDates.length > 0) issue('advance_payment', d);
    if (overdueDeduction) issue('unpaid_adjustment', d);
    const cls = m.classification;
    const received = d.direction === 'received';
    if (
      ![
        'domestic',
        'domestic_reverse_charge',
        'eu_service',
        'nonpayer_domestic',
      ].includes(cls)
    ) {
      issue('unsupported_classification', d);
      continue;
    }
    if (!['business', 'consumer'].includes(m.counterpartyType))
      issue('counterparty', d);
    if (cls === 'eu_service') {
      if (
        !EU.has(m.country) ||
        m.country === 'CZ' ||
        m.counterpartyType !== 'business' ||
        !validEuServiceVatId(m.country, m.vatId || '')
      )
        issue('eu_identity', d);
      if (p.status === 'nonpayer') issue('registration_required', d);
      if (!received && d.lines.some((l) => l.treatment !== 'eu_service'))
        issue('eu_line_treatment', d);
    } else if (m.country !== 'CZ') issue('domestic_country', d);
    if (cls === 'nonpayer_domestic') {
      if (
        p.status === 'payer' ||
        (!received && d.tax !== 0) ||
        m.deduction === 'full' ||
        m.deductibleTax > 0
      )
        issue('nonpayer_tax', d);
      continue;
    }
    if (cls === 'domestic_reverse_charge') {
      if (
        p.status !== 'payer' ||
        !czVat(m.vatId) ||
        m.counterpartyType !== 'business'
      )
        issue('reverse_identity', d);
      if (
        m.reverseChargeCode !== '4' ||
        (!received &&
          d.lines.some(
            (l) => l.treatment !== 'reverse_charge' || l.code !== '4',
          ))
      )
        issue('reverse_code', d);
    }
    if (cls === 'domestic' && !received && p.status !== 'payer')
      issue('nonpayer_tax', d);
    if (
      cls === 'domestic' &&
      !received &&
      d.lines.some((l) => l.treatment !== 'standard')
    )
      issue('domestic_line_treatment', d);
    if (cls !== 'domestic' && d.tax !== 0) issue('unexpected_recorded_tax', d);
    let rate = 1;
    if (d.currency === 'EUR') {
      if (
        !Number.isFinite(m.exchangeRate) ||
        m.exchangeRate <= 0 ||
        !validDate(m.exchangeRateDate) ||
        m.exchangeRateDate !== m.taxPoint ||
        !['cnb', 'recorded'].includes(m.exchangeRateSource)
      ) {
        issue('exchange_rate', d);
        continue;
      }
      rate = m.exchangeRate;
      issue('exchange_review', d, undefined, 'warning');
    } else if (d.currency !== 'CZK') {
      issue('currency', d);
      continue;
    }
    if (
      !d.buckets.length ||
      d.buckets.some(
        (v) =>
          ![0, 12, 21].includes(v.rate) ||
          ![v.base, v.tax].every((n) => Number.isFinite(n) && n >= 0),
      )
    ) {
      issue('breakdown', d);
      continue;
    }
    if (
      sum(d.buckets.map((x) => x.base)) !== d.base ||
      sum(d.buckets.map((x) => x.tax)) !== d.tax ||
      add(d.base, d.tax) !== d.total
    )
      issue('totals_mismatch', d);
    if (
      d.buckets.some((v) => v.base > 0 && ![12, 21].includes(v.rate)) &&
      cls !== 'eu_service'
    )
      issue('unsupported_rate', d);
    if (
      received &&
      cls === 'eu_service' &&
      d.buckets.some((v) => v.rate !== 21)
    )
      issue('eu_rate', d);
    if (received) {
      if (!validDate(m.receivedDate)) issue('receipt_date', d);
      if (!['full', 'none'].includes(m.deduction))
        issue('deduction_decision', d);
      if (m.deduction === 'full') {
        if (p.status !== 'payer') issue('deduction_status', d);
        try {
          const c = periodBounds(m.claimPeriod);
          if (
            c.quarter !== (p.frequency === 'quarterly') ||
            c.to < m.receivedDate ||
            c.to < m.taxPoint ||
            m.taxPoint.slice(0, 4) !== '2026'
          )
            issue('claim_period', d);
        } catch {
          issue('claim_period', d);
        }
        if (
          cls !== 'domestic' &&
          !inPeriod(
            m.taxPoint,
            (() => {
              try {
                return periodBounds(m.claimPeriod);
              } catch {
                return { from: '', to: '' };
              }
            })(),
          )
        )
          issue('reverse_claim_period', d);
      } else if (m.deductibleTax !== 0 || m.claimPeriod)
        issue('no_deduction', d);
    }
    const assessed = sum(
      d.buckets.map((v) =>
        cls === 'domestic'
          ? roundMoney(v.tax * rate)
          : roundMoney((roundMoney(v.base * rate) * v.rate) / 100),
      ),
    );
    if (
      received &&
      m.deduction === 'full' &&
      (!Number.isFinite(m.deductibleTax) ||
        roundMoney(m.deductibleTax) !== assessed)
    )
      issue('deductible_amount', d);
    const attrs: Record<string, string | number> = {};
    for (const bucket of d.buckets) {
      const base = roundMoney(bucket.base * rate);
      const tax =
        cls === 'domestic'
          ? roundMoney(bucket.tax * rate)
          : roundMoney((base * bucket.rate) / 100);
      const low = bucket.rate === 12;
      const suffix = low ? '2' : '1';
      attrs[`zakl_dane${suffix}`] = add(
        Number(attrs[`zakl_dane${suffix}`] || 0),
        base,
      );
      attrs[`dan${suffix}`] = add(Number(attrs[`dan${suffix}`] || 0), tax);
      if (!received && taxSelected) {
        if (cls === 'domestic') row(low ? 2 : 1, base, tax, d.id);
        if (cls === 'domestic_reverse_charge') row(25, base, 0, d.id);
        if (cls === 'eu_service' && p.status === 'payer')
          row(21, base, 0, d.id);
      }
      if (received) {
        if (taxSelected && cls === 'eu_service') row(5, base, tax, d.id);
        if (taxSelected && cls === 'domestic_reverse_charge')
          row(low ? 11 : 10, base, tax, d.id);
        if (claimSelected && m.deduction === 'full')
          row(
            cls === 'domestic' ? (low ? 41 : 40) : low ? 44 : 43,
            base,
            tax,
            d.id,
          );
      }
    }
    const dd = { c_evid_dd: d.sourceNumber, dppd: xmlDate(m.taxPoint) };
    if (!d.sourceNumber || d.sourceNumber.length > 60)
      issue('document_number', d);
    if (
      cls === 'domestic' &&
      ((!received && taxSelected) ||
        (received && claimSelected && m.deduction === 'full'))
    ) {
      const detailed =
        roundMoney(d.total * rate) > 10000 &&
        (received || m.counterpartyType === 'business');
      if (detailed && !czVat(m.vatId)) issue('cz_vat_required', d);
      if (received && m.vatId && !czVat(m.vatId)) issue('cz_vat_required', d);
      const section = received
        ? detailed
          ? 'B2'
          : 'B3'
        : detailed
          ? 'A4'
          : 'A5';
      statement(
        section,
        detailed
          ? {
              ...attrs,
              ...dd,
              [received ? 'dic_dod' : 'dic_odb']: m.vatId.slice(2),
              zdph_44: 'N',
              ...(received ? { pomer: 'N' } : { kod_rezim_pl: '0' }),
            }
          : attrs,
        d.id,
        !detailed,
      );
    }
    if (cls === 'domestic_reverse_charge' && taxSelected) {
      statement(
        received ? 'B1' : 'A1',
        received
          ? {
              ...attrs,
              dic_dod: m.vatId.slice(2),
              c_evid_dd: d.sourceNumber,
              duzp: xmlDate(m.taxPoint),
              kod_pred_pl: '4',
            }
          : {
              dic_odb: m.vatId.slice(2),
              c_evid_dd: d.sourceNumber,
              duzp: xmlDate(m.taxPoint),
              kod_pred_pl: '4',
              zakl_dane1: sum(d.buckets.map((x) => roundMoney(x.base * rate))),
            },
        d.id,
      );
    }
    if (cls === 'eu_service' && taxSelected) {
      if (received)
        statement(
          'A2',
          {
            ...attrs,
            ...dd,
            k_stat: m.country === 'GR' ? 'EL' : m.country,
            vatid_dod: m.vatId.slice(2),
          },
          d.id,
        );
      else {
        const existing = result.statement.find(
          (r) =>
            r.section === 'R' &&
            r.attributes.c_vat === m.vatId.slice(2) &&
            r.attributes.k_stat === (m.country === 'GR' ? 'EL' : m.country),
        );
        const value = sum(d.buckets.map((x) => roundMoney(x.base * rate)));
        if (existing) {
          existing.attributes.pln_hodnota = add(
            Number(existing.attributes.pln_hodnota),
            value,
          );
          existing.attributes.pln_pocet =
            Number(existing.attributes.pln_pocet) + 1;
          existing.documents.push(d.id);
        } else
          statement(
            'R',
            {
              k_stat: m.country === 'GR' ? 'EL' : m.country,
              c_vat: m.vatId.slice(2),
              k_pln_eu: 3,
              pln_pocet: 1,
              pln_hodnota: value,
            },
            d.id,
          );
      }
    }
  }
  const exactRows = structuredClone(result.rows);
  for (const r of Object.values(result.rows)) {
    r.base = Math.round(r.base);
    r.tax = Math.round(r.tax);
  }
  const output = sum([1, 2, 5, 10, 11].map((n) => result.rows[n]?.tax || 0));
  const deduction = sum([40, 41, 43, 44].map((n) => result.rows[n]?.tax || 0));
  const contributors = Object.values(result.rows).flatMap((r) => r.documents);
  for (const [n, tax] of [
    [46, deduction],
    [62, output],
    [63, deduction],
    [64, Math.max(0, output - deduction)],
    [65, Math.max(0, deduction - output)],
  ])
    result.rows[n] = { base: 0, tax, documents: [...new Set(contributors)] };
  const check = (
    code: string,
    expected: number,
    actual: number,
    tolerance = 0,
  ) => {
    const passed = Math.abs(roundMoney(expected - actual)) <= tolerance;
    result.reconciliation.push({ code, expected, actual, passed });
    if (!passed) issue('reconciliation');
  };
  const sectionSum = (sections: string[], attr: string) =>
    sum(
      result.statement
        .filter((r) => sections.includes(r.section))
        .map((r) => Number(r.attributes[attr] || 0)),
    );
  for (const [n, sections, suffix] of [
    [1, ['A4', 'A5'], '1'],
    [2, ['A4', 'A5'], '2'],
    [40, ['B2', 'B3'], '1'],
    [41, ['B2', 'B3'], '2'],
    [10, ['B1'], '1'],
    [11, ['B1'], '2'],
  ] as const) {
    check(
      `KH-${n}-base`,
      exactRows[n]?.base || 0,
      sectionSum([...sections], `zakl_dane${suffix}`),
    );
    check(
      `KH-${n}-tax`,
      exactRows[n]?.tax || 0,
      sectionSum([...sections], `dan${suffix}`),
    );
  }
  check('KH-25', exactRows[25]?.base || 0, sectionSum(['A1'], 'zakl_dane1'));
  check('KH-5', exactRows[5]?.base || 0, sectionSum(['A2'], 'zakl_dane1'));
  if (p.status === 'payer')
    check('SH-21', exactRows[21]?.base || 0, sectionSum(['R'], 'pln_hodnota'));
  for (const r of result.statement.filter((r) => r.section === 'R'))
    r.attributes.pln_hodnota = Math.ceil(Number(r.attributes.pln_hodnota));
  const hasKH = result.statement.some((r) => r.section !== 'R');
  const hasSH = result.statement.some((r) => r.section === 'R');
  result.applicable =
    type === 'DPHDP3'
      ? p.status === 'payer' || (p.status === 'identified' && output > 0)
      : type === 'DPHKH1'
        ? p.status === 'payer' && hasKH
        : p.status !== 'nonpayer' && hasSH;
  result.reason = result.applicable
    ? type === 'DPHDP3'
      ? 'return_obligation'
      : type === 'DPHKH1'
        ? 'domestic_or_acquisition'
        : 'eu_services'
    : p.status === 'nonpayer'
      ? 'nonpayer'
      : type === 'DPHKH1' && p.status === 'identified'
        ? 'identified_no_kh'
        : 'no_activity';
  issue('epo_check', undefined, undefined, 'warning');
  return result;
}
export function xmlDate(date: string) {
  return date.split('-').reverse().join('.');
}
