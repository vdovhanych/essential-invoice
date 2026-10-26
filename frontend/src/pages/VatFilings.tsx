import {
  blankFilingProfile as blankProfile,
  prefillFilingProfile,
  defaultFilingPeriod,
  filingPeriods,
} from '../utils/vatFilingForm';
import { useAuth } from '../context/AuthContext';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import { SettingsGroup, SettingsRow } from '../components/SettingsList';
import StickySaveBar from '../components/StickySaveBar';
import ExpenseVatEditor from '../components/ExpenseVatEditor';
import type {
  FilingDocument,
  FilingMetadata,
  FilingProfile,
  FilingReview,
  FilingSnapshot,
  FilingType,
} from '../types/vatFiling';

const emptyMetadata: FilingMetadata = {
  classification: 'unsupported',
  country: '',
  vatId: '',
  counterpartyType: 'business',
  documentKind: 'ordinary',
  taxPoint: '',
  receivedDate: '',
  reference: '',
  deduction: 'unknown',
  deductibleTax: 0,
  claimPeriod: '',
  reverseChargeCode: '',
  exchangeRate: 0,
  exchangeRateDate: '',
  exchangeRateSource: 'recorded',
  reviewedFingerprint: '',
};
type ReviewData = {
  applicability?: { type: FilingType; applicable: boolean; reason: string }[];
  review: FilingReview;
  snapshotHash: string;
  previousId: string | null;
  changed: boolean | null;
  changes: { profile: boolean; documents: string[] } | null;
};
type Version = {
  id: string;
  period: string;
  filing_type: FilingType;
  filing_mode: string;
  schema_version: string;
  created_at: string;
};
type Lists = {
  activities?: { c_nace: string; naz_nace: string }[];
  offices: { c_ufo: string; nazu_ufo: string }[];
  branches: { c_ufo: string; c_pracufo: string; nazu_pracufo: string }[];
  countries: { kod2: string; naz_zeme_c25: string; naz_zeme_a25: string }[];
};
export default function VatFilings() {
  const { refreshUser } = useAuth();
  const periodInitialized = useRef(false);
  const actionPending = useRef(false);
  const { t, i18n } = useTranslation('vat');
  const [params, setParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<
    | (FilingSnapshot & {
        profileDefaults?: Partial<FilingProfile>;
        profileSourceAddress?: string;
      })
    | null
  >(null);
  const [lists, setLists] = useState<Lists>({
    offices: [],
    branches: [],
    countries: [],
  });
  const [profile, setProfile] = useState<FilingProfile>(blankProfile);
  const [versions, setVersions] = useState<Version[]>([]);
  const [period, setPeriod] = useState(() => defaultFilingPeriod());
  const [type, setType] = useState<FilingType>('DPHDP3');
  const [mode, setMode] = useState('original');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState<FilingMetadata>(emptyMetadata);
  const [buckets, setBuckets] = useState<FilingDocument['buckets']>([]);
  const [savedDetail, setSavedDetail] = useState<{
    calculation: FilingReview;
    snapshot: FilingSnapshot;
  } | null>(null);
  const requestedSection = params.get('section');
  const section =
    requestedSection &&
    ['review', 'documents', 'profile', 'versions'].includes(requestedSection)
      ? requestedSection
      : workspace && !workspace.profile
        ? 'profile'
        : 'review';
  const [documentSearch, setDocumentSearch] = useState('');
  const selected = workspace?.documents.find(
    (d) => d.id === params.get('document'),
  );
  const dirty =
    section === 'profile' &&
    (!workspace?.profile ||
      Object.keys(blankProfile).some(
        (key) =>
          profile[key as keyof FilingProfile] !==
          (workspace.profile?.[key as keyof FilingProfile] ??
            blankProfile[key as keyof FilingProfile]),
      ));
  const endpoint = '/vat-filings';
  const reportError = (e: unknown) => {
    const key = e instanceof Error ? e.message : 'vat_service_failed';
    setError(
      t(`errors.${key}`, { defaultValue: t('errors.vat_service_failed') }),
    );
  };
  async function load() {
    const [data, history, codes] = await Promise.all([
      api.get(`${endpoint}/workspace`),
      api.get(`${endpoint}/versions`),
      api.get(`${endpoint}/code-lists`),
    ]);
    setWorkspace(data);
    setProfile(prefillFilingProfile(data.profile, data.profileDefaults));
    setVersions(history);
    setLists(codes);
    if (!periodInitialized.current) {
      setPeriod(defaultFilingPeriod(data.profile?.frequency));
      periodInitialized.current = true;
    }
  }
  useEffect(() => {
    void load().catch(reportError);
  }, []);
  // Initialize before the editor becomes interactive; a passive effect can
  // overwrite a first edit made immediately after the document appears.
  useLayoutEffect(() => {
    if (selected) {
      setMetadata({
        ...emptyMetadata,
        taxPoint: selected.deliveryDate || selected.issueDate,
        vatId: selected.clientVatId,
        ...selected.metadata,
      });
      setBuckets(selected.buckets);
    }
  }, [selected]);
  async function action(work: () => Promise<void>) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      reportError(e);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  const choose = (value: string, id?: string) => {
    setError('');
    setSavedDetail(null);
    setParams({ section: value, ...(id ? { document: id } : {}) });
  };
  const field = (name: keyof FilingProfile, inputType = 'text') => (
    <label className="label" key={name}>
      {t(`fields.${name}`)}
      <input
        className="input mt-1 min-w-0"
        type={inputType}
        maxLength={name === 'houseOrientation' ? 4 : 150}
        list={name === 'activityCode' ? 'vat-activities' : undefined}
        value={profile[name] ?? ''}
        onInput={
          inputType === 'date'
            ? (e) => {
                const value = e.currentTarget.value;
                setProfile((previous) => ({ ...previous, [name]: value }));
              }
            : undefined
        }
        onChange={(e) => {
          const value = e.target.value;
          setProfile((previous) => ({ ...previous, [name]: value }));
        }}
      />
    </label>
  );
  const metaField = (name: keyof FilingMetadata, inputType = 'text') => (
    <label className="label" key={name}>
      {t(`fields.${name}`)}
      <input
        className="input mt-1 min-w-0"
        type={inputType}
        maxLength={150}
        step={inputType === 'number' ? '0.0001' : undefined}
        value={metadata[name]}
        onInput={
          inputType === 'date'
            ? (e) => {
                const value = e.currentTarget.value;
                setMetadata((previous) => ({ ...previous, [name]: value }));
              }
            : undefined
        }
        onChange={(e) =>
          setMetadata({
            ...metadata,
            [name]:
              inputType === 'number' ? Number(e.target.value) : e.target.value,
          })
        }
      />
    </label>
  );
  const metaSelect = (name: keyof FilingMetadata, values: string[]) => (
    <label className="label">
      {t(`fields.${name}`)}
      <select
        className="input mt-1 min-w-0"
        value={metadata[name]}
        onChange={(e) => {
          const value = e.target.value;
          setMetadata((previous) => ({
            ...previous,
            [name]: value,
            ...(name === 'deduction' && value === 'none'
              ? { deductibleTax: 0, claimPeriod: '' }
              : {}),
          }));
        }}
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {t(`options.${v}`)}
          </option>
        ))}
      </select>
    </label>
  );
  const documentLink = (id: string) => {
    const d = (savedDetail?.snapshot?.documents || workspace?.documents)?.find(
      (d) => d.id === id,
    );
    return (
      <button
        key={id}
        type="button"
        className="text-accent underline text-sm mr-3 py-1 break-all"
        onClick={() => choose('documents', id)}
      >
        {d?.number || id}
      </button>
    );
  };
  const showReview = (r: FilingReview) => (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">{t(`reasons.${r.reason}`)}</p>
      <ul className="space-y-2" aria-label={t('validation')}>
        {r.issues.map((issue, index) => (
          <li
            key={index}
            className={`rounded-lg p-3 text-sm ${issue.severity === 'blocker' ? 'bg-danger-bg text-danger' : 'bg-surface-sunken text-text-secondary'}`}
          >
            <strong>{t(issue.severity)}: </strong>
            {t(`issues.${issue.code}`)}{' '}
            {issue.field && <span>({t(`fields.${issue.field}`)})</span>}{' '}
            {issue.documentId
              ? documentLink(issue.documentId)
              : issue.severity === 'blocker' && (
                  <button
                    type="button"
                    className="underline ml-2"
                    onClick={() => choose('profile')}
                  >
                    {t('editTaxpayer')}
                  </button>
                )}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-text-muted">
              <th className="p-2">{t('row')}</th>
              <th className="p-2">{t('base')}</th>
              <th className="p-2">{t('tax')}</th>
              <th className="p-2">{t('documents')}</th>
            </tr>
          </thead>
          <tbody>
            {r.type === 'DPHDP3'
              ? Object.entries(r.rows).map(([n, row]) => (
                  <tr key={n} className="border-t border-border">
                    <th className="p-2 text-left">{n}</th>
                    <td className="p-2 whitespace-nowrap">
                      {formatCurrency(row.base)}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {formatCurrency(row.tax)}
                    </td>
                    <td className="p-2">{row.documents.map(documentLink)}</td>
                  </tr>
                ))
              : r.statement
                  .filter((s) =>
                    r.type === 'DPHSHV' ? s.section === 'R' : s.section !== 'R',
                  )
                  .map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <th className="p-2 text-left">{row.section}</th>
                      <td className="p-2" colSpan={2}>
                        {Object.entries(row.attributes).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-text-muted">
                              {t(`attributes.${k}`, { defaultValue: k })}:{' '}
                            </span>
                            {typeof v === 'number'
                              ? new Intl.NumberFormat(
                                  i18n.language === 'cs' ? 'cs-CZ' : 'en-US',
                                  { maximumFractionDigits: 2 },
                                ).format(v)
                              : v}
                          </div>
                        ))}
                      </td>
                      <td className="p-2">{row.documents.map(documentLink)}</td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary className="cursor-pointer py-2 text-sm">
          {t('reconciliation')}
        </summary>
        <ul className="text-sm tabular-nums">
          {r.reconciliation.map((c) => (
            <li key={c.code}>
              {c.code}: {formatCurrency(c.expected)} /{' '}
              {formatCurrency(c.actual)} — {t(c.passed ? 'passed' : 'failed')}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t('title')}</h1>
        <p className="mt-2 text-sm text-text-muted">{t('intro')}</p>
      </div>
      <nav
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        aria-label={t('title')}
      >
        {['review', 'documents', 'profile', 'versions'].map((s) => (
          <button
            key={s}
            className={`btn ${section === s ? 'btn-primary' : 'btn-secondary'}`}
            aria-current={section === s ? 'page' : undefined}
            disabled={busy}
            onClick={() => choose(s)}
          >
            {t(s)}
          </button>
        ))}
      </nav>
      {error && (
        <div
          role="alert"
          className="bg-danger-bg text-danger rounded-lg p-3 space-y-2"
        >
          <p>{error}</p>
          <button
            type="button"
            disabled={busy}
            className="btn btn-secondary"
            onClick={() => void action(load)}
          >
            {t('reload')}
          </button>
        </div>
      )}
      {!workspace && !error && <p role="status">{t('loading')}</p>}
      {workspace && section === 'profile' && (
        <form
          className="card space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await api.put(`${endpoint}/profile`, profile);
              await load();
              await refreshUser();
              if ((profile.frequency === 'quarterly') !== period.includes('Q'))
                setPeriod(defaultFilingPeriod(profile.frequency));
              setReview(null);
              toast.success(t('saved'));
            });
          }}
        >
          <div className="rounded-xl bg-surface-sunken p-4 space-y-2 text-sm text-text-secondary">
            <p>{t('prefillHint')}</p>
            {workspace.profileSourceAddress && (
              <p className="break-words">
                <strong>{t('sourceAddress')}: </strong>
                {workspace.profileSourceAddress}
              </p>
            )}
            <Link className="text-accent underline" to="/profile/company">
              {t('openProfile')}
            </Link>
          </div>
          <p className="text-sm text-text-muted">{t('profileHint')}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(['status', 'personType', 'frequency'] as const).map((k) => (
              <label key={k} className="label">
                {t(`fields.${k}`)}
                <select
                  className="input mt-1 min-w-0"
                  value={profile[k]}
                  onChange={(e) =>
                    setProfile({ ...profile, [k]: e.target.value })
                  }
                >
                  {(k === 'status'
                    ? ['nonpayer', 'payer', 'identified']
                    : k === 'personType'
                      ? ['individual', 'legal']
                      : ['monthly', 'quarterly']
                  ).map((v) => (
                    <option key={v} value={v}>
                      {t(`options.${v}`)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {(
              [
                'vatId',
                'firstName',
                'lastName',
                'street',
                'houseNumber',
                'houseOrientation',
                'city',
                'postcode',
                'activityCode',
                'email',
              ] as const
            ).map((k) => field(k))}
            {field('effectiveFrom', 'date')}
            <label className="label">
              {t('fields.taxOffice')}
              <select
                className="input mt-1 min-w-0"
                value={profile.taxOffice}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    taxOffice: e.target.value,
                    taxOfficeBranch: '',
                  })
                }
              >
                <option value="">{t('select')}</option>
                {lists.offices.map((o) => (
                  <option key={o.c_ufo} value={o.c_ufo}>
                    {o.nazu_ufo}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              {t('fields.taxOfficeBranch')}
              <select
                className="input mt-1 min-w-0"
                value={profile.taxOfficeBranch}
                onChange={(e) =>
                  setProfile({ ...profile, taxOfficeBranch: e.target.value })
                }
              >
                <option value="">{t('select')}</option>
                {lists.branches
                  .filter((o) => o.c_ufo === profile.taxOffice)
                  .map((o) => (
                    <option key={o.c_pracufo} value={o.c_pracufo}>
                      {o.nazu_pracufo}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <datalist id="vat-activities">
            {lists.activities?.map((a) => (
              <option key={a.c_nace} value={a.c_nace}>
                {a.naz_nace}
              </option>
            ))}
          </datalist>
          <StickySaveBar
            show={dirty}
            saving={busy}
            saveLabel={t('save')}
            savingLabel={t('saving')}
            message={t('unsaved')}
            discardLabel={t('discard')}
            onDiscard={() =>
              setProfile(
                prefillFilingProfile(
                  workspace.profile,
                  workspace.profileDefaults,
                ),
              )
            }
          />
        </form>
      )}
      {workspace && section === 'documents' && !selected && (
        <section className="space-y-3">
          <label className="label">
            {t('searchDocuments')}
            <input
              className="input mt-1"
              type="search"
              value={documentSearch}
              onChange={(e) => setDocumentSearch(e.target.value)}
            />
          </label>
          {workspace.documents.length === 0 && (
            <div className="card text-sm text-text-muted">
              {t('noDocuments')}
            </div>
          )}
          <SettingsGroup caption={t('documentHint')} inset="label">
            {workspace.documents
              .filter((d) =>
                `${d.number} ${d.clientName}`
                  .toLocaleLowerCase()
                  .includes(documentSearch.toLocaleLowerCase()),
              )
              .map((d) => (
                <SettingsRow
                  key={`${d.direction}-${d.id}`}
                  label={`${d.number} · ${d.clientName}`}
                  value={t(
                    d.metadata?.reviewedFingerprint === d.fingerprint
                      ? 'reviewed'
                      : 'needsReview',
                  )}
                  onClick={() => choose('documents', d.id)}
                />
              ))}
          </SettingsGroup>
          {workspace.documents.length > 0 &&
            !workspace.documents.some((d) =>
              `${d.number} ${d.clientName}`
                .toLocaleLowerCase()
                .includes(documentSearch.toLocaleLowerCase()),
            ) && <p className="text-sm text-text-muted">{t('noMatches')}</p>}
        </section>
      )}
      {workspace && section === 'documents' && selected && (
        <form
          className="card space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await api.put(
                `${endpoint}/documents/${selected.direction}/${selected.id}`,
                {
                  ...metadata,
                  fingerprint: selected.fingerprint,
                  ...(selected.direction === 'received' ? { buckets } : {}),
                },
              );
              await load();
              setReview(null);
              toast.success(t('saved'));
            });
          }}
        >
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-semibold">
              {selected.number} · {selected.clientName}
            </h2>
            <Link
              className="text-accent underline"
              to={`/${selected.direction === 'issued' ? 'invoices' : 'expenses'}/${selected.id}`}
            >
              {t('openDocument')}
            </Link>
          </div>
          <p className="text-sm text-text-muted">
            {t('metadataHint')}{' '}
            {formatCurrency(selected.total, selected.currency)}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metaSelect('classification', [
              'unsupported',
              'domestic',
              'domestic_reverse_charge',
              'eu_service',
              'nonpayer_domestic',
            ])}
            {metaSelect('documentKind', [
              'ordinary',
              'advance',
              'correction',
              'other',
            ])}
            {metaSelect('counterpartyType', ['business', 'consumer'])}
            <label className="label">
              {t('fields.country')}
              <select
                className="input mt-1 min-w-0"
                value={metadata.country}
                onChange={(e) =>
                  setMetadata({ ...metadata, country: e.target.value })
                }
              >
                <option value="">{t('select')}</option>
                {[...lists.countries]
                  .sort((a, b) =>
                    (i18n.language === 'en'
                      ? a.naz_zeme_a25
                      : a.naz_zeme_c25
                    ).localeCompare(
                      i18n.language === 'en' ? b.naz_zeme_a25 : b.naz_zeme_c25,
                      i18n.language,
                    ),
                  )
                  .map((c) => (
                    <option key={c.kod2} value={c.kod2}>
                      {i18n.language === 'en' ? c.naz_zeme_a25 : c.naz_zeme_c25}
                    </option>
                  ))}
              </select>
            </label>
            {metaField('vatId')}
            {metaField('taxPoint', 'date')}
            {metaField('reference')}
            {metadata.classification === 'domestic_reverse_charge' &&
              metaField('reverseChargeCode')}
            {selected.direction === 'received' && (
              <>
                {metaField('receivedDate', 'date')}
                {metaSelect('deduction', [
                  'unknown',
                  'full',
                  'none',
                  'partial',
                ])}
                {['full', 'partial'].includes(metadata.deduction) && (
                  <>
                    {metaField('deductibleTax', 'number')}
                    <label className="label">
                      {t('fields.claimPeriod')}
                      <select
                        className="input mt-1 min-w-0"
                        value={metadata.claimPeriod}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            claimPeriod: e.target.value,
                          })
                        }
                      >
                        <option value="">{t('select')}</option>
                        {filingPeriods(workspace.profile?.frequency).map(
                          (p) => (
                            <option key={p}>{p}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            {selected.currency === 'EUR' && (
              <>
                {metaField('exchangeRate', 'number')}
                {metaField('exchangeRateDate', 'date')}
                {metaSelect('exchangeRateSource', ['recorded', 'cnb'])}
                <button
                  type="button"
                  disabled={busy || !metadata.taxPoint}
                  className="btn btn-secondary self-end"
                  onClick={() =>
                    void action(async () => {
                      const r = await api.get(
                        `${endpoint}/exchange-rate?date=${metadata.taxPoint}`,
                      );
                      if (!r) throw new Error('rate_unavailable');
                      setMetadata({
                        ...metadata,
                        exchangeRate: r.rate,
                        exchangeRateDate: metadata.taxPoint,
                        exchangeRateSource: 'cnb',
                      });
                    })
                  }
                >
                  {t('getRate')}
                </button>
              </>
            )}
          </div>
          {selected.direction === 'received' && (
            <ExpenseVatEditor buckets={buckets} onChange={setBuckets} />
          )}
          <p className="text-sm text-text-muted">{t('scope')}</p>
          <button className="btn btn-primary" disabled={busy}>
            {t(busy ? 'saving' : 'saveReview')}
          </button>
        </form>
      )}
      {workspace && section === 'review' && (
        <section className="card space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="label">
              {t('period')}
              <select
                className="input mt-1 min-w-0"
                disabled={busy}
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setReview(null);
                }}
              >
                {filingPeriods(workspace.profile?.frequency).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="label">
              {t('filingType')}
              <select
                className="input mt-1 min-w-0"
                disabled={busy}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as FilingType);
                  if (e.target.value === 'DPHSHV') setMode('original');
                  setReview(null);
                }}
              >
                {(['DPHDP3', 'DPHKH1', 'DPHSHV'] as const).map((f) => (
                  <option key={f} value={f}>
                    {t(f)}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              {t('filingMode')}
              <select
                className="input mt-1 min-w-0"
                disabled={busy}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setReview(null);
                }}
              >
                <option value="original">{t('original')}</option>
                <option value="replacement" disabled={type === 'DPHSHV'}>
                  {t('replacement')}
                </option>
              </select>
            </label>
          </div>
          <details className="text-sm text-text-muted">
            <summary className="cursor-pointer">{t('supportedScope')}</summary>
            <p className="mt-2">{t('scope')}</p>
          </details>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                setReview(null);
                setReview(
                  await api.post(`${endpoint}/review`, { period, type, mode }),
                );
              })
            }
          >
            {t(busy ? 'loading' : 'calculate')}
          </button>
          {review && (
            <>
              {review.applicability && (
                <div className="grid sm:grid-cols-3 gap-3">
                  {review.applicability.map((f) => (
                    <div
                      key={f.type}
                      className="rounded-xl border border-border p-3"
                    >
                      <strong className="text-sm">{t(f.type)}</strong>
                      <p className="text-sm mt-1 text-text-muted">
                        {t(`reasons.${f.reason}`)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {showReview(review.review)}
              <p className="text-sm text-text-muted">
                {review.previousId
                  ? t(review.changed ? 'changed' : 'unchanged')
                  : t('firstVersion')}
              </p>
              {review.changes && (
                <div className="text-sm">
                  {review.changes.profile && <p>{t('profileChanged')}</p>}
                  {review.changes.documents.map(documentLink)}
                </div>
              )}
              <button
                className="btn btn-primary"
                disabled={
                  busy ||
                  !review.review.applicable ||
                  review.review.issues.some((i) => i.severity === 'blocker')
                }
                onClick={() =>
                  void action(async () => {
                    const saved = await api.post(`${endpoint}/versions`, {
                      period: review.review.period,
                      type: review.review.type,
                      mode: review.review.mode,
                      snapshotHash: review.snapshotHash,
                    });
                    await api.download(
                      `${endpoint}/versions/${saved.id}/xml`,
                      `${review.review.type}-${review.review.period}.xml`,
                    );
                    await load();
                    setReview(null);
                    toast.success(t('exportSaved'));
                  })
                }
              >
                {t('generate')}
              </button>
            </>
          )}
        </section>
      )}
      {workspace && section === 'versions' && (
        <section className="space-y-3">
          <p className="text-sm text-text-muted">{t('historyHint')}</p>
          {!versions.length && (
            <div className="card text-sm text-text-muted">
              {t('noVersions')}{' '}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => choose('review')}
              >
                {t('review')}
              </button>
            </div>
          )}
          {versions.map((v) => (
            <div key={v.id} className="card flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <strong>
                  {t(v.filing_type)} · {v.period}
                </strong>
                <p className="text-xs text-text-muted">
                  {formatDateTime(v.created_at)} · {t(v.filing_mode)} ·{' '}
                  {v.schema_version}
                </p>
              </div>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () =>
                    setSavedDetail(
                      await api.get(`${endpoint}/versions/${v.id}`),
                    ),
                  )
                }
              >
                {t('inspect')}
              </button>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  void action(() =>
                    api.download(
                      `${endpoint}/versions/${v.id}/xml`,
                      `${v.filing_type}-${v.period}-${v.id}.xml`,
                    ),
                  )
                }
              >
                {t('download')}
              </button>
            </div>
          ))}
          {savedDetail && (
            <div className="card space-y-4">
              <h2 className="font-semibold">{t('snapshot')}</h2>
              <p className="text-sm">
                {savedDetail.snapshot?.profile?.firstName}{' '}
                {savedDetail.snapshot?.profile?.lastName} ·{' '}
                {savedDetail.snapshot?.profile?.vatId}
              </p>
              {showReview(savedDetail.calculation)}
              <details>
                <summary className="cursor-pointer py-2">
                  {t('documents')}
                </summary>
                {savedDetail.snapshot?.documents?.map((d) => (
                  <div
                    key={d.id}
                    className="border-t border-border py-3 text-sm"
                  >
                    <strong>
                      {d.number} · {d.clientName}
                    </strong>
                    <p>
                      {formatCurrency(d.total, d.currency)} ·{' '}
                      {t(
                        `options.${d.metadata?.classification || 'unsupported'}`,
                      )}
                    </p>
                  </div>
                ))}
              </details>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
