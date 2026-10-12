import { filingProfileDefaults } from '../services/vatFilingDefaults';
import { expenseVatBreakdown, expenseVatTotals } from '../utils/expenseVat';
import { Router } from 'express';
import { pool, query } from '../db/init';
import type { AuthRequest } from '../middleware/auth';
import { loadFilingSnapshot, fingerprint } from '../services/vatFilingData';
import { periodBounds, reviewFiling, validDate } from '../services/vatFiling';
import { generateFilingXml, validateFilingXml } from '../services/vatFilingXml';
import { filingTypes, type FilingType } from '../services/vatFilingTypes';
import codeLists from '../services/vatSchemas/codeLists.json';
import { getEurCzkRate } from '../services/cnbExchangeRate';

export const vatFilingRouter: ReturnType<typeof Router> = Router();
const uuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const fail = (res: any) =>
  res.status(500).json({ error: 'vat_service_failed' });
async function transaction<T>(
  userId: string,
  work: (db: any) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const value = await work(db);
    await db.query('COMMIT');
    return value;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
const parameters = (body: any) => {
  if (
    !body ||
    typeof body.period !== 'string' ||
    !filingTypes.includes(body.type) ||
    !['original', 'replacement'].includes(body.mode || 'original')
  )
    throw new Error('parameters');
  periodBounds(body.period);
  return {
    period: body.period,
    type: body.type as FilingType,
    mode: body.mode || 'original',
  };
};
vatFilingRouter.get('/workspace', async (req: AuthRequest, res) => {
  try {
    res.json(
      await transaction(req.userId!, async (db) => {
        const snapshot = await loadFilingSnapshot(db, req.userId!);
        const { rows } = await db.query(
          'SELECT name, email, company_dic, company_address, vat_payer FROM users WHERE id = $1',
          [req.userId],
        );
        return {
          ...snapshot,
          profileDefaults: filingProfileDefaults(rows[0] || {}),
          profileSourceAddress: rows[0]?.company_address || '',
        };
      }),
    );
  } catch {
    fail(res);
  }
});
vatFilingRouter.get('/code-lists', (_req, res) =>
  res.json({
    offices: codeLists.ufo.rows,
    branches: codeLists.pracufo.rows,
    countries: codeLists.zeme.rows,
    activities: codeLists.okec.rows.filter(
      (r) =>
        r.d_pocpl <= '2026-12-31' && (!r.d_ukopl || r.d_ukopl >= '2026-01-01'),
    ),
  }),
);
vatFilingRouter.put('/profile', async (req: AuthRequest, res) => {
  const p = { ...req.body, houseOrientation: req.body?.houseOrientation ?? '' };
  const fields = [
    'vatId',
    'firstName',
    'lastName',
    'street',
    'houseNumber',
    'houseOrientation',
    'city',
    'postcode',
    'taxOffice',
    'taxOfficeBranch',
    'activityCode',
    'email',
    'effectiveFrom',
  ];
  if (
    !p ||
    !['payer', 'identified', 'nonpayer'].includes(p.status) ||
    !['individual', 'legal'].includes(p.personType) ||
    !['monthly', 'quarterly'].includes(p.frequency) ||
    fields.some((k) => typeof p[k] !== 'string' || p[k].length > 150) ||
    (p.effectiveFrom !== '' && !validDate(p.effectiveFrom))
  )
    return res.status(400).json({ error: 'profile_invalid' });
  const clean = Object.fromEntries(
    [...fields, 'status', 'personType', 'frequency'].map((k) => [k, p[k]]),
  );
  try {
    await query(
      'UPDATE users SET vat_filing_profile = $1, vat_payer = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [JSON.stringify(clean), p.status === 'payer', req.userId],
    );
    res.json(clean);
  } catch {
    fail(res);
  }
});
vatFilingRouter.put(
  '/documents/:direction/:id',
  async (req: AuthRequest, res) => {
    const { direction, id } = req.params;
    const m = req.body;
    if (!['issued', 'received'].includes(String(direction)) || !uuid(id))
      return res.status(400).json({ error: 'document_invalid' });
    const fields = [
      'country',
      'vatId',
      'taxPoint',
      'receivedDate',
      'reference',
      'claimPeriod',
      'reverseChargeCode',
      'exchangeRateDate',
    ];
    if (
      !m ||
      fields.some((k) => typeof m[k] !== 'string' || m[k].length > 150) ||
      ![
        'domestic',
        'domestic_reverse_charge',
        'eu_service',
        'nonpayer_domestic',
        'unsupported',
      ].includes(m.classification) ||
      !['business', 'consumer'].includes(m.counterpartyType) ||
      !['ordinary', 'advance', 'correction', 'other'].includes(
        m.documentKind,
      ) ||
      !['unknown', 'full', 'none', 'partial'].includes(m.deduction) ||
      !['cnb', 'recorded'].includes(m.exchangeRateSource) ||
      ![m.exchangeRate, m.deductibleTax].every(
        (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
      )
    )
      return res.status(400).json({ error: 'metadata_invalid' });
    if (
      ['taxPoint', 'receivedDate', 'exchangeRateDate'].some(
        (k) => m[k] && !validDate(m[k]),
      )
    )
      return res.status(400).json({ error: 'metadata_invalid' });
    if (m.claimPeriod) {
      try {
        periodBounds(m.claimPeriod);
      } catch {
        return res.status(400).json({ error: 'metadata_invalid' });
      }
    }
    let buckets: ReturnType<typeof expenseVatBreakdown> | undefined;
    if (m.buckets !== undefined) {
      try {
        if (direction !== 'received') throw new Error();
        buckets = expenseVatBreakdown(m.buckets);
      } catch {
        return res.status(400).json({ error: 'breakdown_invalid' });
      }
    }
    try {
      const saved = await transaction(req.userId!, async (db) => {
        const table = direction === 'issued' ? 'invoices' : 'expenses';
        await db.query(
          `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [id, req.userId],
        );
        const snapshot = await loadFilingSnapshot(db, req.userId!);
        let d = snapshot.documents.find(
          (d) => d.id === id && d.direction === direction,
        );
        if (!d) return null;
        if (m.fingerprint !== d.fingerprint) return false;
        if (buckets) {
          const totals = expenseVatTotals(buckets);
          if (
            totals.amount !== d.base ||
            totals.vatAmount !== d.tax ||
            totals.total !== d.total
          )
            return 'breakdown_totals';
          await db.query(
            'UPDATE expenses SET vat_breakdown = $1 WHERE id = $2 AND user_id = $3',
            [JSON.stringify(buckets), id, req.userId],
          );
          // Confirm metadata against the new source in the same transaction.
          d = (await loadFilingSnapshot(db, req.userId!)).documents.find(
            (doc) => doc.id === id && doc.direction === direction,
          )!;
        }
        const clean = Object.fromEntries(
          [
            ...fields,
            'classification',
            'counterpartyType',
            'documentKind',
            'deduction',
            'deductibleTax',
            'exchangeRate',
            'exchangeRateSource',
          ].map((k) => [k, m[k]]),
        );
        clean.reviewedFingerprint = d.fingerprint;
        await db.query(
          `UPDATE ${table} SET vat_filing = $1 WHERE id = $2 AND user_id = $3`,
          [JSON.stringify(clean), id, req.userId],
        );
        return clean;
      });
      if (saved === 'breakdown_totals')
        return res.status(422).json({ error: 'breakdown_totals' });
      if (saved === null) return res.status(404).json({ error: 'not_found' });
      if (saved === false)
        return res.status(409).json({ error: 'document_changed' });
      res.json(saved);
    } catch {
      fail(res);
    }
  },
);
vatFilingRouter.put(
  '/expenses/:id/breakdown',
  async (req: AuthRequest, res) => {
    if (!uuid(req.params.id))
      return res.status(404).json({ error: 'not_found' });
    let buckets: ReturnType<typeof expenseVatBreakdown> | undefined;
    try {
      buckets = expenseVatBreakdown(req.body.buckets);
    } catch {
      return res.status(400).json({ error: 'breakdown_invalid' });
    }
    try {
      const status = await transaction(req.userId!, async (db) => {
        await db.query(
          'SELECT id FROM expenses WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [req.params.id, req.userId],
        );
        const snapshot = await loadFilingSnapshot(db, req.userId!);
        const d = snapshot.documents.find(
          (d) => d.id === req.params.id && d.direction === 'received',
        );
        if (!d) return 404;
        if (d.fingerprint !== req.body.fingerprint) return 409;
        const totals = expenseVatTotals(buckets);
        if (
          totals.amount !== d.base ||
          totals.vatAmount !== d.tax ||
          totals.total !== d.total
        )
          return 422;
        await db.query(
          'UPDATE expenses SET vat_breakdown = $1 WHERE id = $2 AND user_id = $3',
          [JSON.stringify(buckets), d.id, req.userId],
        );
        return 200;
      });
      res.status(status).json(
        status === 200
          ? { saved: true }
          : {
              error:
                status === 422
                  ? 'breakdown_totals'
                  : status === 409
                    ? 'document_changed'
                    : 'not_found',
            },
      );
    } catch {
      fail(res);
    }
  },
);
vatFilingRouter.get('/exchange-rate', async (req: AuthRequest, res) => {
  if (!validDate(req.query.date))
    return res.status(400).json({ error: 'date_invalid' });
  try {
    res.json(await getEurCzkRate(req.query.date));
  } catch {
    fail(res);
  }
});
vatFilingRouter.post('/review', async (req: AuthRequest, res) => {
  let params;
  try {
    params = parameters(req.body);
  } catch {
    return res.status(400).json({ error: 'filing_parameters' });
  }
  try {
    const data = await transaction(req.userId!, async (db) => {
      const snapshot = await loadFilingSnapshot(db, req.userId!);
      const review = reviewFiling(
        snapshot,
        params.period,
        params.type,
        params.mode,
      );
      if (
        review.applicable &&
        !review.issues.some((i) => i.severity === 'blocker')
      ) {
        const today = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Europe/Prague',
        }).format(new Date());
        const xml = generateFilingXml(review, snapshot.profile!, today);
        const checked = await validateFilingXml(params.type, xml);
        if (!checked.valid)
          review.issues.push({ severity: 'blocker', code: 'xml_invalid' });
      }
      const hash = fingerprint(snapshot);
      const previous = await db.query(
        'SELECT id, snapshot_hash, snapshot FROM vat_filing_versions WHERE user_id = $1 AND period = $2 AND filing_type = $3 ORDER BY created_at DESC, id DESC LIMIT 1',
        [req.userId, params.period, params.type],
      );
      const old = previous.rows[0];
      const changes = old
        ? {
            profile:
              fingerprint(old.snapshot.profile) !==
              fingerprint(snapshot.profile),
            documents: [
              ...new Set(
                [...(old.snapshot.documents || []), ...snapshot.documents].map(
                  (d: any) => d.id,
                ),
              ),
            ].filter(
              (id) =>
                fingerprint(
                  (old.snapshot.documents || []).find((d: any) => d.id === id),
                ) !== fingerprint(snapshot.documents.find((d) => d.id === id)),
            ),
          }
        : null;
      return {
        review,
        applicability: filingTypes.map((type) => {
          const r = reviewFiling(snapshot, params.period, type, 'original');
          return { type, applicable: r.applicable, reason: r.reason };
        }),
        snapshotHash: hash,
        previousId: old?.id || null,
        changed: old ? old.snapshot_hash !== hash : null,
        changes,
      };
    });
    res.json(data);
  } catch {
    fail(res);
  }
});
vatFilingRouter.post('/versions', async (req: AuthRequest, res) => {
  let params;
  try {
    params = parameters(req.body);
  } catch {
    return res.status(400).json({ error: 'filing_parameters' });
  }
  if (typeof req.body.snapshotHash !== 'string')
    return res.status(400).json({ error: 'review_required' });
  try {
    const saved = await transaction(req.userId!, async (db) => {
      const snapshot = await loadFilingSnapshot(db, req.userId!);
      if (fingerprint(snapshot) !== req.body.snapshotHash)
        return { status: 409, error: 'review_changed' };
      const review = reviewFiling(
        snapshot,
        params.period,
        params.type,
        params.mode,
      );
      if (
        !review.applicable ||
        review.issues.some((i) => i.severity === 'blocker')
      )
        return { status: 422, error: 'filing_blocked', review };
      const today = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Prague',
      }).format(new Date());
      const xml = generateFilingXml(review, snapshot.profile!, today);
      const validation = await validateFilingXml(params.type, xml);
      if (!validation.valid)
        return { status: 422, error: 'xml_invalid', validation };
      const value = await db.query(
        `INSERT INTO vat_filing_versions(user_id,period,filing_type,filing_mode,schema_version,snapshot,snapshot_hash,calculation,validation,xml)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at`,
        [
          req.userId,
          params.period,
          params.type,
          params.mode,
          review.schemaVersion,
          JSON.stringify(snapshot),
          fingerprint(snapshot),
          JSON.stringify(review),
          JSON.stringify({
            issues: review.issues,
            xsd: validation,
            reconciliation: review.reconciliation,
            epoImportVerified: false,
          }),
          xml,
        ],
      );
      return { status: 201, ...value.rows[0] };
    });
    res.status(saved.status).json(saved);
  } catch {
    fail(res);
  }
});
vatFilingRouter.get('/versions', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT id, period, filing_type, filing_mode, schema_version, created_at, snapshot_hash FROM vat_filing_versions WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
      [req.userId],
    );
    res.json(result.rows);
  } catch {
    fail(res);
  }
});
vatFilingRouter.get('/versions/:id', async (req: AuthRequest, res) => {
  if (!uuid(req.params.id)) return res.status(404).json({ error: 'not_found' });
  try {
    const r = await query(
      'SELECT id, period, filing_type, filing_mode, schema_version, created_at, snapshot, calculation, validation FROM vat_filing_versions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(r.rows[0]);
  } catch {
    fail(res);
  }
});
vatFilingRouter.get('/versions/:id/xml', async (req: AuthRequest, res) => {
  if (!uuid(req.params.id)) return res.status(404).json({ error: 'not_found' });
  try {
    const r = await query(
      'SELECT xml, period, filing_type FROM vat_filing_versions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Cache-Control', 'private, no-store');
    res
      .type('application/xml')
      .attachment(
        `${r.rows[0].filing_type}-${r.rows[0].period}-${req.params.id}.xml`,
      )
      .send(Buffer.from(r.rows[0].xml, 'utf8'));
  } catch {
    fail(res);
  }
});
