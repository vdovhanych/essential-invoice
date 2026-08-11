import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, getInitials } from '../utils/format';
import { Plus, FilePlus, CheckCircle } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

interface DashboardData {
  stats: {
    draftCount: number;
    sentCount: number;
    paidCount: number;
    overdueCount: number;
    cancelledCount: number;
    outstandingAmount: number;
    overdueAmount: number;
    paidAmount: number;
    paidThisMonth: number;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    currency: string;
    total: number;
    issueDate: string;
    dueDate: string;
    clientName: string;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    invoiceCount: number;
  }>;
  monthlyExpenses: Array<{
    month: string;
    expenses: number;
    expenseCount: number;
  }>;
  yearlyExpenses: number;
  unmatchedPayments: number;
  pausalniDan: {
    enabled: boolean;
    tier: number;
    limit: number;
    invoicedThisYear: number;
    remaining: number;
  };
}

export default function Dashboard() {
  const { t, i18n } = useTranslation('dashboard');
  const { user } = useAuth();
  const locale = i18n.language === 'en' ? 'en-US' : 'cs-CZ';
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const result = await api.get('/dashboard');
      setData(result);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  const availableYears = useMemo(() => {
    if (!data) return [new Date().getFullYear()];
    const years = new Set<number>();
    data.monthlyRevenue.forEach(item => years.add(new Date(item.month).getFullYear()));
    data.monthlyExpenses.forEach(item => years.add(new Date(item.month).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(selectedYear, i, 1);
      return {
        key: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
        name: date.toLocaleDateString(locale, { month: 'short' }),
        income: 0,
        expenses: 0,
      };
    });

    const monthMap = new Map(months.map(m => [m.key, m]));

    data.monthlyRevenue.forEach(item => {
      const d = new Date(item.month);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthMap.get(key);
      if (entry) entry.income = item.revenue;
    });

    data.monthlyExpenses.forEach(item => {
      const d = new Date(item.month);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthMap.get(key);
      if (entry) entry.expenses = item.expenses;
    });

    return months;
  }, [data, selectedYear]);

  const yearlyIncome = useMemo(() => chartData.reduce((sum, m) => sum + m.income, 0), [chartData]);
  const yearlyExpensesTotal = useMemo(() => chartData.reduce((sum, m) => sum + m.expenses, 0), [chartData]);
  const maxMonth = useMemo(
    () => Math.max(...chartData.map(m => Math.max(m.income, m.expenses)), 0),
    [chartData]
  );

  // Pace projection: invoiced-to-date ÷ elapsed months × 12 (current year run rate)
  const projection = useMemo(() => {
    if (!data?.pausalniDan?.enabled) return null;
    const elapsedMonths = new Date().getMonth() + 1;
    const projected = (data.pausalniDan.invoicedThisYear / elapsedMonths) * 12;
    return {
      projected,
      crosses: projected > data.pausalniDan.limit,
      fillPct: Math.min(100, (data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) * 100),
      pacePct: Math.min(100, (projected / data.pausalniDan.limit) * 100),
      headroom: Math.max(0, data.pausalniDan.remaining),
    };
  }, [data]);

  if (loading) {
    return <PageLoader />;
  }

  if (!data) {
    return <div className="text-center text-text-muted">{t('loadError')}</div>;
  }

  const awaitingCount = data.stats.sentCount + data.stats.overdueCount;

  // First run: no invoices at all — describe the reward, don't just say the list is empty
  const isFirstRun =
    data.recentInvoices.length === 0 &&
    data.stats.draftCount + data.stats.sentCount + data.stats.paidCount +
      data.stats.overdueCount + data.stats.cancelledCount === 0;

  if (isFirstRun) {
    // Completed items get a check and a struck-through label; open ones carry the action
    const checklist = [
      { key: 'business', done: !!user?.companyIco, to: '/profile' },
      { key: 'bank', done: !!user?.bankAccount, to: '/profile' },
      { key: 'logo', done: !!user?.hasLogo, to: '/profile' },
    ];
    const doneCount = checklist.filter(item => item.done).length;

    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        <span className="flex items-center justify-center h-[46px] w-[46px] rounded-[14px] bg-accent-tint mb-5">
          <FilePlus className="h-5 w-5 text-accent" />
        </span>
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('empty.title')}</h2>
        <p className="mt-2 max-w-[380px] text-sm leading-relaxed text-text-muted">
          {t('empty.description')}
        </p>
        <Link to="/invoices/new" className="btn btn-primary mt-6 flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('empty.createFirst')}</span>
        </Link>

        {doneCount < checklist.length && (
          <div className="w-full max-w-[380px] mt-10 pt-6 border-t border-border text-left">
            <p className="text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint mb-3">
              {t('empty.checklistTitle', { done: doneCount, total: checklist.length })}
            </p>
            <ul className="space-y-2.5">
              {checklist.map(item => (
                <li key={item.key} className="flex items-center gap-2.5">
                  {item.done ? (
                    <CheckCircle className="h-[17px] w-[17px] text-success shrink-0" />
                  ) : (
                    <span className="h-[17px] w-[17px] rounded-full border-[1.5px] border-border-strong shrink-0" />
                  )}
                  <span
                    className={`flex-1 text-sm ${
                      item.done ? 'text-text-faint line-through' : 'text-text'
                    }`}
                  >
                    {t(`empty.checklist.${item.key}`)}
                  </span>
                  {!item.done && (
                    <Link to={item.to} className="text-[13px] font-medium text-accent-link hover:underline shrink-0">
                      {t('empty.checklistAction')}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const tierFootnote = data.pausalniDan?.enabled && projection && (
    <div className="mt-4 pt-3.5 border-t border-hairline">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {t('pausalniDan.label', { tier: data.pausalniDan.tier })}
        </span>
        <span className="text-xs text-text-faint tabular-nums">
          {t('pausalniDan.ofLimit', {
            invoiced: formatCurrency(data.pausalniDan.invoicedThisYear),
            limit: formatCurrency(data.pausalniDan.limit),
          })}
        </span>
      </div>
      <div className="relative mt-2">
        <div className="h-[6px] rounded-[3px] bg-hairline overflow-hidden">
          <div
            className="h-full rounded-[3px] bg-accent-quiet"
            style={{ width: `${projection.fillPct}%` }}
          />
        </div>
        {/* Pace marker: projected year-end at the current run rate */}
        <div
          className={`absolute -top-[3px] w-[1.5px] h-3 ${projection.crosses ? 'bg-danger' : 'bg-text-faint'}`}
          style={{ left: `${projection.pacePct}%` }}
          data-testid="pace-marker"
        />
      </div>
      <div
        className={`flex items-center justify-between mt-2 text-[11px] ${
          projection.crosses ? 'text-danger' : 'text-text-faint'
        }`}
      >
        <span className="tabular-nums">
          {t('pausalniDan.pace', { amount: formatCurrency(projection.projected) })}{' '}
          {projection.crosses
            ? t('pausalniDan.crosses', { tier: data.pausalniDan.tier })
            : t('pausalniDan.inside', { tier: data.pausalniDan.tier })}
        </span>
        <span className="tabular-nums">
          {t('pausalniDan.headroom', { amount: formatCurrency(projection.headroom) })}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('title')}</h1>
        <Link to="/invoices/new" className="btn btn-primary hidden lg:flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('newInvoice')}</span>
        </Link>
      </div>

      {/* Hero row */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="card lg:bg-transparent lg:border-0 lg:p-0 lg:rounded-none">
          <p className="text-[13px] text-text-muted">{t('stats.outstanding')}</p>
          <p className="mt-1 text-[34px] lg:text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-text tabular-nums">
            {formatCurrency(data.stats.outstandingAmount)}
          </p>
          <p className="mt-1.5 text-[13px] text-text-muted">
            {t('stats.awaiting', { count: awaitingCount })}
            {data.stats.overdueCount > 0 && (
              <> · {t('stats.overdueCount', { count: data.stats.overdueCount })}</>
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:w-[560px]">
          <div className="bg-surface border border-border rounded-[16px] px-4 py-3.5 min-w-0">
            <p className="text-xs text-text-muted">{t('stats.paidThisMonth')}</p>
            <p className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-text tabular-nums truncate">
              {formatCurrency(data.stats.paidThisMonth)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-[16px] px-4 py-3.5 min-w-0">
            <p className="text-xs text-text-muted">{t('stats.overdue')}</p>
            <p className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-danger tabular-nums truncate">
              {formatCurrency(data.stats.overdueAmount)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-[16px] px-4 py-3.5 min-w-0 col-span-2 lg:col-span-1">
            <p className="text-xs text-text-muted">{t('stats.unmatched')}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[19px] font-semibold tracking-[-0.02em] text-text tabular-nums">
                {data.unmatchedPayments}
              </span>
              {data.unmatchedPayments > 0 && (
                <Link to="/payments" className="text-xs font-semibold text-accent hover:text-accent-hover">
                  {t('stats.matchLink')}
                </Link>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 lg:gap-5">
        {/* Revenue card */}
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-text-muted">{t('chart.net', { year: selectedYear })}</p>
              <p className="text-2xl font-bold tracking-[-0.02em] text-text tabular-nums">
                {formatCurrency(yearlyIncome - yearlyExpensesTotal)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-[2px] bg-accent" />
                  <span className="text-xs text-text-muted">{t('chart.income')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-[2px] bg-chart-secondary" />
                  <span className="text-xs text-text-muted">{t('chart.expenses')}</span>
                </span>
              </div>
              {availableYears.length > 1 && (
                <div className="flex bg-surface border border-border rounded-[10px] p-[3px]">
                  {availableYears.map(year => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors tabular-nums ${
                        selectedYear === year
                          ? 'bg-surface-sunken text-text'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {maxMonth > 0 ? (
            <>
              <div className="mt-5 flex items-end h-[190px]">
                {chartData.map(month => (
                  <div key={month.key} className="flex-1 flex items-end justify-center gap-[3px] h-full">
                    <div
                      className="w-[10px] rounded-[4px] bg-accent"
                      style={{ height: `${maxMonth > 0 ? (month.income / maxMonth) * 100 : 0}%` }}
                      title={`${month.name}: ${formatCurrency(month.income)}`}
                    />
                    <div
                      className="w-[10px] rounded-[4px] bg-chart-secondary"
                      style={{ height: `${maxMonth > 0 ? (month.expenses / maxMonth) * 100 : 0}%` }}
                      title={`${month.name}: ${formatCurrency(month.expenses)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex">
                {chartData.map(month => (
                  <span key={month.key} className="flex-1 text-center text-[11px] text-text-faint">
                    {month.name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[190px] mt-5 flex items-center justify-center text-sm text-text-muted">
              {t('chart.noData')}
            </div>
          )}

          {tierFootnote}
        </div>

        {/* Recent invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-text">{t('recentInvoices.title')}</h2>
            <Link to="/invoices" className="text-[13px] text-accent-link hover:underline">
              {t('recentInvoices.viewAll')}
            </Link>
          </div>
          {data.recentInvoices.length > 0 ? (
            <div>
              {data.recentInvoices.slice(0, 5).map((invoice) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="flex items-center gap-3 py-2.5 border-b border-hairline-soft last:border-b-0 hover:bg-row-hover -mx-2 px-2 rounded-lg transition-colors"
                >
                  <span className="flex items-center justify-center h-[34px] w-[34px] rounded-[11px] bg-surface-sunken text-text-secondary text-xs font-semibold shrink-0">
                    {getInitials(invoice.clientName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text truncate">{invoice.clientName}</span>
                    <span className="block text-xs text-text-faint tabular-nums">
                      {invoice.invoiceNumber} · {t('recentInvoices.due')} {formatDate(invoice.dueDate)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-semibold text-text tabular-nums">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </span>
                    <span className={`badge ${getStatusColor(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-text-muted py-8">
              {t('recentInvoices.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
