import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { CreditCard, Search, Link2, Unlink, X, RefreshCw, Trash2 } from 'lucide-react';
import { PageLoader, Spinner } from '../components/Spinner';

interface Payment {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  variableSymbol: string | null;
  senderName: string | null;
  senderAccount: string | null;
  message: string | null;
  transactionCode: string | null;
  transactionDate: string;
  matchedAt: string | null;
  matchMethod: string | null;
}

interface PotentialMatch {
  id: string;
  invoiceNumber: string;
  variableSymbol: string;
  clientName: string;
  total: number;
  currency: string;
  issueDate: string;
  matchScore: number;
  matchReason: string;
}

const REASON_CHIPS: Record<string, { key: string; className: string }> = {
  variable_symbol: { key: 'matchModal.reasonVariableSymbol', className: 'bg-success-bg text-success' },
  exact_amount: { key: 'matchModal.reasonExactAmount', className: 'bg-success-bg text-success' },
  approximate_amount: {
    key: 'matchModal.reasonApproximateAmount',
    className: 'bg-[#fdf2dd] text-[#8a5a00] dark:bg-[rgba(253,242,221,.14)] dark:text-[#e0b467]',
  },
  other: { key: 'matchModal.reasonOther', className: 'bg-neutral-chip-bg text-neutral-chip-fg' },
};

export default function Payments() {
  const { t } = useTranslation('payments');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [search, setSearch] = useState('');
  // Match modal state
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    try {
      const result = await api.get('/payments');
      setPayments(result);
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function openMatchModal(payment: Payment) {
    setSelectedPayment(payment);
    setShowMatchModal(true);
    setMatchLoading(true);

    try {
      const matches = await api.get(`/payments/${payment.id}/matches`);
      setPotentialMatches(matches);
    } catch (error) {
      console.error('Failed to load matches:', error);
      toast.error(t('common:errors.loadFailed'));
      setPotentialMatches([]);
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleMatch(invoiceId: string) {
    if (!selectedPayment) return;

    try {
      await api.post(`/payments/${selectedPayment.id}/match`, { invoiceId });
      toast.success(t('list.toast.matched'));
      setShowMatchModal(false);
      loadPayments();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('list.toast.matchFailed'));
    }
  }

  async function handleUnmatch(payment: Payment) {
    if (!confirm(t('list.confirm.unmatch'))) return;

    try {
      await api.post(`/payments/${payment.id}/unmatch`);
      toast.success(t('list.toast.unmatched'));
      loadPayments();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('list.toast.unmatchFailed'));
    }
  }

  async function handleDelete(payment: Payment) {
    if (!confirm(t('list.confirm.delete'))) return;

    try {
      await api.delete(`/payments/${payment.id}`);
      toast.success(t('list.toast.deleted'));
      loadPayments();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('list.toast.deleteFailed'));
    }
  }

  async function checkForNewPayments() {
    setCheckingEmails(true);

    try {
      await api.post('/payments/check-emails');
      toast.success(t('list.toast.checkSuccess'));
      loadPayments();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('list.toast.checkFailed'));
    } finally {
      setCheckingEmails(false);
    }
  }

  function clearFilters() {
    setFilter('all');
    setSearch('');
  }

  const counts = useMemo(
    () => ({
      all: payments.length,
      unmatched: payments.filter((p) => !p.invoiceId).length,
      matched: payments.filter((p) => p.invoiceId).length,
    }),
    [payments]
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (payment) =>
          (filter === 'all' ||
            (filter === 'matched' ? !!payment.invoiceId : !payment.invoiceId)) &&
          (payment.variableSymbol?.includes(search) ||
            payment.senderName?.toLowerCase().includes(search.toLowerCase()) ||
            payment.invoiceNumber?.includes(search))
      ),
    [payments, filter, search]
  );

  if (loading) {
    return <PageLoader />;
  }

  const columnHeader = 'text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint';

  const filterControl = (
    <div className="flex bg-surface border border-border rounded-[10px] p-[3px]">
      {(['all', 'unmatched', 'matched'] as const).map((value) => (
        <button
          key={value}
          onClick={() => setFilter(value)}
          className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
            filter === value ? 'bg-surface-sunken text-text' : 'text-text-muted hover:text-text'
          }`}
        >
          {t(`list.filters.${value}`)} {counts[value]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('list.title')}</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t('list.subline', { unmatched: counts.unmatched, matched: counts.matched })}
          </p>
        </div>
        <button
          onClick={checkForNewPayments}
          disabled={checkingEmails}
          className="btn btn-secondary flex items-center space-x-2"
          title={t('list.checkEmailsTooltip')}
        >
          <RefreshCw className={`w-4 h-4 ${checkingEmails ? 'animate-spin' : ''}`} />
          <span>{checkingEmails ? t('list.checkingEmails') : t('list.checkEmails')}</span>
        </button>
      </div>

      {/* Mobile: search + filter */}
      <div className="lg:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
          <input
            type="text"
            placeholder={t('list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-sunken rounded-[9px] pl-9 pr-3 py-2 text-sm text-text placeholder-text-faint focus:outline-hidden focus:shadow-[0_0_0_3px_rgba(79,70,229,.12)]"
          />
        </div>
        {filterControl}

        {filteredPayments.length > 0 ? (
          <div className="space-y-2.5">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-surface border border-border rounded-[16px] px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-text truncate">
                      {payment.senderName || '—'}
                    </p>
                    <p className="text-[11px] font-mono text-text-faint tabular-nums">
                      {formatDate(payment.transactionDate)}
                      {payment.variableSymbol && <> · VS {payment.variableSymbol}</>}
                    </p>
                  </div>
                  <p className="text-[15px] font-semibold text-success tabular-nums shrink-0">
                    +{formatCurrency(payment.amount, payment.currency)}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  {payment.invoiceId ? (
                    <>
                      <Link
                        to={`/invoices/${payment.invoiceId}`}
                        className="flex items-center gap-1 text-[13px] text-accent-link hover:underline tabular-nums"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {payment.invoiceNumber}
                      </Link>
                      <button
                        onClick={() => handleUnmatch(payment)}
                        className="text-[13px] text-text-muted"
                      >
                        {t('list.unmatchTooltip')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openMatchModal(payment)}
                        className="btn btn-secondary py-1.5 px-3 text-[13px]"
                      >
                        {t('list.matchButton')}
                      </button>
                      <button
                        onClick={() => handleDelete(payment)}
                        className="text-[13px] text-danger"
                      >
                        {t('list.deleteTooltip')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState t={t} filtered={filter !== 'all' || search !== ''} onClearFilters={clearFilters} />
        )}
      </div>

      {/* Desktop: table card */}
      <div className="hidden lg:block bg-surface border border-border rounded-[20px] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-hairline">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              type="text"
              placeholder={t('list.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-sunken rounded-[9px] pl-9 pr-3 py-2 text-sm text-text placeholder-text-faint focus:outline-hidden focus:shadow-[0_0_0_3px_rgba(79,70,229,.12)]"
            />
          </div>
          <div className="ml-auto">{filterControl}</div>
        </div>

        {filteredPayments.length > 0 ? (
          <>
            <div className="grid grid-cols-[0.9fr_1.7fr_0.9fr_1fr_1fr_90px] gap-x-4 items-center px-5 py-2.5 border-b border-hairline">
              <span className={columnHeader}>{t('list.table.date')}</span>
              <span className={columnHeader}>{t('list.table.sender')}</span>
              <span className={columnHeader}>{t('list.table.variableSymbol')}</span>
              <span className={`${columnHeader} text-right`}>{t('list.table.amount')}</span>
              <span className={columnHeader}>{t('list.table.invoice')}</span>
              <span />
            </div>
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="grid grid-cols-[0.9fr_1.7fr_0.9fr_1fr_1fr_90px] gap-x-4 items-center px-5 py-3 border-b border-hairline-soft last:border-b-0 hover:bg-row-hover transition-colors"
              >
                <span className="text-sm text-text-secondary tabular-nums">
                  {formatDate(payment.transactionDate)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text truncate">
                    {payment.senderName || '—'}
                  </span>
                  {payment.message && (
                    <span className="block text-[11px] font-mono text-text-faint truncate">
                      {payment.message}
                    </span>
                  )}
                </span>
                <span className="text-[13px] font-mono text-text-secondary tabular-nums">
                  {payment.variableSymbol || '—'}
                </span>
                <span className="text-sm font-semibold text-success text-right tabular-nums">
                  +{formatCurrency(payment.amount, payment.currency)}
                </span>
                <span>
                  {payment.invoiceId ? (
                    <Link
                      to={`/invoices/${payment.invoiceId}`}
                      className="flex items-center gap-1 text-[13px] text-accent-link hover:underline tabular-nums"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {payment.invoiceNumber}
                    </Link>
                  ) : (
                    <span className="text-text-faint">—</span>
                  )}
                </span>
                <span className="flex items-center justify-end gap-1">
                  {payment.invoiceId ? (
                    <button
                      onClick={() => handleUnmatch(payment)}
                      className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-nav-hover transition-colors"
                      title={t('list.unmatchTooltip')}
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => openMatchModal(payment)}
                        className="btn btn-secondary py-1 px-3 text-[13px]"
                      >
                        {t('list.matchButton')}
                      </button>
                      <button
                        onClick={() => handleDelete(payment)}
                        className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-nav-hover transition-colors"
                        title={t('list.deleteTooltip')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </>
        ) : (
          <EmptyState t={t} filtered={filter !== 'all' || search !== ''} onClearFilters={clearFilters} />
        )}
      </div>

      {/* Match modal */}
      {showMatchModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-[18px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text">{t('matchModal.title')}</h2>
              <button
                onClick={() => setShowMatchModal(false)}
                className="p-2 hover:bg-nav-hover rounded-lg text-text-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* The transaction — raw bank data in mono */}
            <div className="bg-canvas rounded-[12px] p-4 mb-6">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[22px] font-bold tracking-[-0.02em] text-success tabular-nums">
                  +{formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                </span>
                <span className="text-[13px] text-text-secondary tabular-nums">
                  {selectedPayment.senderName || '—'} · {formatDate(selectedPayment.transactionDate)}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-mono text-text-faint">
                {selectedPayment.variableSymbol && <>VS {selectedPayment.variableSymbol} · </>}
                {selectedPayment.senderAccount && <>{selectedPayment.senderAccount} · </>}
                {selectedPayment.message}
              </p>
            </div>

            {/* Potential matches */}
            <h3 className="text-[15px] font-semibold text-text mb-3">{t('matchModal.potentialMatches')}</h3>
            {matchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : potentialMatches.length > 0 ? (
              <div className="space-y-2">
                {potentialMatches.map((match) => {
                  const reason = REASON_CHIPS[match.matchReason] || REASON_CHIPS.other;
                  return (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-4 p-4 border border-border rounded-[12px] hover:border-accent hover:bg-row-hover transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-text tabular-nums">
                            {match.invoiceNumber}
                          </span>
                          <span className={`badge ${reason.className}`}>{t(reason.key)}</span>
                        </div>
                        <p className="text-sm text-text-secondary truncate">{match.clientName}</p>
                        <p className="text-[13px] text-text-muted tabular-nums">
                          VS {match.variableSymbol} · {formatDate(match.issueDate)} ·{' '}
                          {formatCurrency(match.total, match.currency)}
                        </p>
                      </div>
                      <button onClick={() => handleMatch(match.id)} className="btn btn-primary shrink-0">
                        {t('matchModal.matchButton')}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-text-muted">
                {t('matchModal.noMatches')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  t,
  filtered,
  onClearFilters,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  // A filtered miss is a different message from having no payments at all
  if (filtered) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-muted">{t('list.noMatch')}</p>
        <button
          onClick={onClearFilters}
          className="mt-2 text-sm font-medium text-accent-link hover:underline"
        >
          {t('list.clearFilters')}
        </button>
      </div>
    );
  }
  return (
    <div className="text-center py-12">
      <CreditCard className="h-12 w-12 text-border-strong mx-auto mb-4" />
      <p className="text-sm text-text-muted">{t('list.empty')}</p>
      <p className="text-[13px] text-text-faint mt-2">{t('list.emptyHint')}</p>
    </div>
  );
}
