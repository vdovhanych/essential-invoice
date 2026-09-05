import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getExpenseStatusLabel, getExpenseStatusColor } from '../utils/format';
import { Plus, Search, Receipt, FileImage, ImageOff, Info } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { toast } from 'sonner';

interface Expense {
  id: string;
  expenseNumber: string;
  supplierInvoiceNumber: string | null;
  status: string;
  currency: string;
  clientId: string | null;
  clientName: string | null;
  issueDate: string;
  dueDate: string;
  total: number;
  hasFile: boolean;
}

type Filter = '' | 'unpaid' | 'paid' | 'missing-receipt';

const BANNER_DISMISS_KEY = 'expenses-flatrate-banner-dismissed';

export default function Expenses() {
  const { t, i18n } = useTranslation('expenses');
  const locale = i18n.language === 'en' ? 'en-US' : 'cs-CZ';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('');
  const [flatRateEnabled, setFlatRateEnabled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISS_KEY) === '1';
    } catch {
      return false; // localStorage unavailable in test environment
    }
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      const [result, dashboard] = await Promise.all([
        api.get('/expenses'),
        api.get('/dashboard').catch(() => null),
      ]);
      setExpenses(result);
      setFlatRateEnabled(!!dashboard?.pausalniDan?.enabled);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function dismissBanner() {
    try { localStorage.setItem(BANNER_DISMISS_KEY, '1'); } catch { /* test env */ }
    setBannerDismissed(true);
  }

  const counts = useMemo(
    () => ({
      '': expenses.length,
      unpaid: expenses.filter((e) => e.status === 'unpaid').length,
      paid: expenses.filter((e) => e.status === 'paid').length,
      'missing-receipt': expenses.filter((e) => !e.hasFile).length,
    }),
    [expenses]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          (filter === '' ||
            (filter === 'missing-receipt' ? !expense.hasFile : expense.status === filter)) &&
          (expense.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
            (expense.clientName && expense.clientName.toLowerCase().includes(search.toLowerCase())) ||
            (expense.supplierInvoiceNumber &&
              expense.supplierInvoiceNumber.toLowerCase().includes(search.toLowerCase())))
      ),
    [expenses, filter, search]
  );

  // Grouped by month, newest first
  const monthGroups = useMemo(() => {
    const groups = new Map<string, { label: string; items: Expense[]; total: number }>();
    for (const expense of filteredExpenses) {
      const d = new Date(expense.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
          items: [],
          total: 0,
        });
      }
      const group = groups.get(key)!;
      group.items.push(expense);
      group.total += expense.total;
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => ({ key, ...group }));
  }, [filteredExpenses, locale]);

  const currentYear = new Date().getFullYear();
  const yearSummary = useMemo(() => {
    const inYear = expenses.filter((e) => new Date(e.issueDate).getFullYear() === currentYear);
    return { count: inYear.length, total: inYear.reduce((sum, e) => sum + e.total, 0) };
  }, [expenses, currentYear]);

  if (loading) {
    return <PageLoader />;
  }

  const chip = (value: Filter, label: string) => {
    const active = filter === value;
    const isDangerChip = value === 'missing-receipt';
    return (
      <button
        key={value || 'all'}
        onClick={() => setFilter(active ? '' : value)}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
          active
            ? isDangerChip
              ? 'bg-danger text-white'
              : 'bg-accent text-white'
            : isDangerChip
              ? 'bg-danger-bg text-danger'
              : 'bg-surface border border-border text-text-secondary'
        }`}
      >
        {label} {counts[value]}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('list.title')}</h1>
          <p className="mt-1 text-[13px] text-text-muted tabular-nums">
            {t('list.summary', {
              year: currentYear,
              amount: formatCurrency(yearSummary.total),
              count: yearSummary.count,
            })}
          </p>
        </div>
        <Link to="/expenses/new" className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('list.newExpense')}</span>
        </Link>
      </div>

      {/* The honest flat-rate banner */}
      {flatRateEnabled && !bannerDismissed && (
        <div className="flex items-start gap-3 bg-surface border border-border rounded-[16px] px-5 py-3.5">
          <Info className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
          <p className="flex-1 text-[13px] leading-normal text-text-secondary">
            {t('list.flatRateBanner')}
          </p>
          <button
            onClick={dismissBanner}
            className="shrink-0 text-[13px] text-accent-link hover:underline"
          >
            {t('list.hideBanner')}
          </button>
        </div>
      )}

      {/* Search + filter chips */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
          <input
            type="text"
            placeholder={t('list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-sunken rounded-[9px] pl-9 pr-3 py-2 text-sm text-text placeholder-text-faint focus:outline-hidden focus:shadow-[0_0_0_3px_rgba(79,70,229,.12)]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {chip('', t('list.statusAll'))}
          {chip('unpaid', t('list.unpaid'))}
          {chip('paid', t('list.paid'))}
          {chip('missing-receipt', t('list.noReceiptChip'))}
        </div>
      </div>

      {/* Grouped list */}
      {filteredExpenses.length > 0 ? (
        <div className="bg-surface border border-border rounded-[20px] overflow-hidden">
          {monthGroups.map((group) => (
            <div key={group.key}>
              {/* Month header */}
              <div className="flex items-center justify-between px-5 py-3 bg-row-hover border-b border-hairline-soft">
                <span className="text-xs uppercase font-semibold tracking-[.04em] text-text-faint">
                  {group.label}
                </span>
                <span className="text-xs tabular-nums">
                  <span className="text-text-muted">{group.items.length}</span>
                  <span className="text-text-muted"> · </span>
                  <span className="font-semibold text-text">{formatCurrency(group.total)}</span>
                </span>
              </div>
              {/* Rows */}
              {group.items.map((expense) => (
                <Link
                  key={expense.id}
                  to={`/expenses/${expense.id}`}
                  className="flex items-center gap-3.5 px-5 py-3 border-b border-hairline-soft last:border-b-0 hover:bg-row-hover transition-colors"
                >
                  {/* Receipt thumb — missing receipt is the only error state on this screen */}
                  <span
                    className={`flex items-center justify-center h-[34px] w-[34px] rounded-[9px] shrink-0 ${
                      expense.hasFile ? 'bg-surface-sunken text-text-faint' : 'bg-danger-bg text-danger'
                    }`}
                  >
                    {expense.hasFile ? <FileImage className="h-4 w-4" /> : <ImageOff className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text truncate">
                      {expense.clientName || expense.expenseNumber}
                    </span>
                    <span
                      className={`block text-xs truncate ${
                        expense.hasFile ? 'text-text-faint' : 'text-danger'
                      }`}
                    >
                      {expense.hasFile
                        ? expense.supplierInvoiceNumber || expense.expenseNumber
                        : t('list.receiptMissing')}
                    </span>
                  </span>
                  <span className="hidden sm:block text-[13px] text-text-faint tabular-nums shrink-0">
                    {formatDate(expense.issueDate)}
                  </span>
                  <span className="text-sm font-semibold text-text tabular-nums text-right shrink-0">
                    {formatCurrency(expense.total, expense.currency)}
                  </span>
                  <span className="hidden sm:inline-flex shrink-0">
                    <span className={`badge ${getExpenseStatusColor(expense.status)}`}>
                      {getExpenseStatusLabel(expense.status)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-hairline text-[13px] text-text-muted">
            <span>{t('list.shownOf', { shown: filteredExpenses.length, total: expenses.length })}</span>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          {filter !== '' || search !== '' ? (
            <>
              <p className="text-sm text-text-muted">{t('list.noMatch')}</p>
              <button
                onClick={() => {
                  setFilter('');
                  setSearch('');
                }}
                className="mt-2 text-sm font-medium text-accent-link hover:underline"
              >
                {t('list.clearFilters')}
              </button>
            </>
          ) : (
            <>
              <Receipt className="h-12 w-12 text-border-strong mx-auto mb-4" />
              <p className="text-sm text-text-muted">{t('list.empty')}</p>
              <Link to="/expenses/new" className="btn btn-primary mt-4 inline-flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>{t('list.addFirst')}</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
