import { Link } from 'react-router-dom';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowRight, Check, Download, FileCheck2, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../utils/api';

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periods(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarterStart = Math.floor(month / 3) * 3;
  return [
    { key: 'lastMonth', from: localDate(new Date(year, month - 1, 1)), to: localDate(new Date(year, month, 0)) },
    { key: 'lastQuarter', from: localDate(new Date(year, quarterStart - 3, 1)), to: localDate(new Date(year, quarterStart, 0)) },
    { key: 'thisYear', from: localDate(new Date(year, 0, 1)), to: localDate(now) },
  ];
}
export default function AccountantExport() {
  const { t } = useTranslation('invoices');
  const { t: tVat } = useTranslation('vat');
  const id = useId();
  const [presets] = useState(() => periods(new Date()));
  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [basis, setBasis] = useState('issue');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const validRange = !!from && !!to && from <= to;
  const updateFrom = (value: string) => {
    setFrom(value);
    setError('');
  };
  const updateTo = (value: string) => {
    setTo(value);
    setError('');
  };
  async function download(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !validRange) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ from, to, basis });
      await api.download(`/exports/accountant?${params}`, `accountant-${from}-${to}.zip`);
      toast.success(t('export.success'));
    } catch (error) {
      setError(error instanceof Error ? error.message : t('export.error'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <div className="space-y-5">
    <section className="card border-accent/30" aria-labelledby={`${id}-vat-title`}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent-tint p-2.5 text-accent shrink-0"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-vat-title`} className="text-base font-semibold text-text">{tVat('title')}</h3>
          <p className="mt-1 text-sm text-text-muted">{t('export.vatDescription')}</p>
        </div>
        <span className="badge bg-accent-tint text-accent shrink-0">XML</span>
      </div>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-xs leading-relaxed text-text-muted flex-1">{t('export.vatHint')}</p>
        <Link className="btn btn-primary inline-flex min-h-11 w-full sm:w-auto shrink-0 items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" to="/vat-filings">
          {t('export.openVat')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>

    <section className="card" aria-labelledby={`${id}-zip-title`}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-surface-sunken p-2.5 text-text-secondary shrink-0"><Archive className="h-5 w-5" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-zip-title`} className="text-base font-semibold text-text">{t('export.title')}</h3>
          <p className="mt-1 text-sm text-text-muted">{t('export.description')}</p>
        </div>
        <span className="badge bg-surface-sunken text-text-secondary shrink-0">ZIP</span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-secondary" aria-label={t('export.contents')}>
        {['invoiceFiles', 'expenseFiles', 'dphFiles'].map(key => (
          <li key={key} className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-success shrink-0" aria-hidden="true" />
            {t(`export.${key}`)}
          </li>
        ))}
      </ul>
      <form onSubmit={download} className="mt-5 border-t border-border pt-5" aria-label={t('export.title')}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <legend className="text-sm font-semibold text-text mb-3">{t('export.period')}</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('export.quickPeriods')}>
            {presets.map(preset => {
              const selected = from === preset.from && to === preset.to;
              return (
                <button
                  type="button"
                  key={preset.key}
                  aria-pressed={selected}
                  className={`btn min-h-10 ${selected ? 'bg-accent-tint text-accent border border-accent/30' : 'btn-secondary'}`}
                  onClick={() => {
                    setFrom(preset.from);
                    setTo(preset.to);
                    setError('');
                  }}
                >
                  {t(`export.${preset.key}`)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="label min-w-0">{t('export.from')}
              <input className="input mt-1" type="date" required value={from} max={to || undefined} aria-invalid={!validRange} aria-describedby={!validRange ? `${id}-range-error` : undefined} onInput={e => updateFrom(e.currentTarget.value)} onChange={e => updateFrom(e.target.value)} />
            </label>
            <label className="label min-w-0">{t('export.to')}
              <input className="input mt-1" type="date" required value={to} min={from || undefined} aria-invalid={!validRange} aria-describedby={!validRange ? `${id}-range-error` : undefined} onInput={e => updateTo(e.currentTarget.value)} onChange={e => updateTo(e.target.value)} />
            </label>
          </div>
          {!validRange && <p id={`${id}-range-error`} role="alert" className="text-sm text-danger">{t('export.invalidRange')}</p>}
          <div>
            <label className="label" htmlFor={`${id}-basis`}>{t('export.basis')}</label>
            <select id={`${id}-basis`} className="input" aria-describedby={`${id}-period-help`} value={basis} onChange={e => {
              setBasis(e.target.value);
              setError('');
            }}>
              <option value="issue">{t('export.issueDate')}</option>
              <option value="tax">{t('export.taxPointDate')}</option>
            </select>
            <p id={`${id}-period-help`} className="mt-2 text-xs leading-relaxed text-text-muted">{t(basis === 'issue' ? 'export.dphIssueDateHint' : 'export.dphTaxDateHint')}</p>
          </div>
        </fieldset>
        <details className="mt-5 rounded-xl bg-surface-sunken p-3 text-xs leading-relaxed text-text-muted">
          <summary className="cursor-pointer font-medium text-text-secondary py-1">{t('export.details')}</summary>
          <div className="mt-3 space-y-2">
            <h4 className="text-sm font-medium text-text">{t('export.dphTitle')}</h4>
            <p>{t('export.dphDescription')}</p>
            <p>{t('export.dphScope')}</p>
            <p>{t('export.scope')}</p>
          </div>
        </details>
        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-sm text-danger">
            <p className="font-medium">{t('export.error')}</p>
            <p className="mt-1 break-words">{error}</p>
          </div>
        )}
        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-text-faint">{t('export.limit')}</p>
          <button className="btn btn-primary inline-flex min-h-11 items-center justify-center gap-2 w-full sm:w-auto scroll-mb-24 lg:scroll-mb-0" disabled={busy || !validRange} type="submit">
            {busy
              ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Download className="h-4 w-4" aria-hidden="true" />}
            {t(busy ? 'export.preparing' : error ? 'export.retry' : 'export.download')}
          </button>
        </div>
        {busy && <p role="status" className="mt-3 text-xs text-text-muted">{t('export.preparingHint')}</p>}
      </form>
    </section>
  </div>;
}
