import { useState, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, getInitials } from '../utils/format';
import { Plus, FilePlus, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  // Tapping a month pins its tooltip open — on touch there is no hover to hold it
  // there. A pin outranks the pointer, so moving across the chart afterwards does
  // not steal the tooltip away from the month you asked about.
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  // Index of the newest year in the visible slice of the year picker; null tracks
  // the latest year, so it only becomes a number once you page back through history
  const [yearWindowEnd, setYearWindowEnd] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [tooltipWidth, setTooltipWidth] = useState(0);

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
    years.add(new Date().getFullYear());
    // Oldest first so the picker reads left-to-right into the present
    return Array.from(years).sort((a, b) => a - b);
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

  // The tooltip is anchored in pixels so it can be clamped inside the card
  useEffect(() => {
    const element = chartRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setChartWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxMonth]);

  // A pinned month wins over whatever the pointer is currently over
  const activeMonth = pinnedMonth ?? hoveredMonth;

  // Tooltip width varies with the amounts in it, so re-measure per month
  useLayoutEffect(() => {
    setTooltipWidth(tooltipRef.current?.offsetWidth ?? 0);
  }, [activeMonth, chartData]);

  // A pinned tooltip is dismissed by tapping away from the chart or pressing
  // Escape. Taps landing inside the chart are left alone — the column's own
  // handler toggles the pin, and unpinning here first would just undo it.
  useEffect(() => {
    if (pinnedMonth === null) return;

    const onPointerDown = (e: PointerEvent) => {
      if (chartRef.current?.contains(e.target as Node)) return;
      setPinnedMonth(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinnedMonth(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinnedMonth]);

  // Switching years would otherwise leave a tooltip pinned to a month of the
  // year you just navigated away from
  useEffect(() => {
    setPinnedMonth(null);
    setHoveredMonth(null);
  }, [selectedYear]);

  // The flat-rate tax footnote follows the year picker. For the running year that
  // means a pace projection (invoiced-to-date ÷ elapsed months × 12); for a year
  // that has already closed the total is final, so it just reports the outcome.
  // Note the tier limit is the user's current setting applied to every year.
  const projection = useMemo(() => {
    if (!data?.pausalniDan?.enabled) return null;
    const limit = data.pausalniDan.limit;
    const now = new Date();
    const fillPct = Math.min(100, (yearlyIncome / limit) * 100);

    if (selectedYear < now.getFullYear()) {
      return {
        closed: true,
        crosses: yearlyIncome > limit,
        fillPct,
        headroom: Math.max(0, limit - yearlyIncome),
        overage: Math.max(0, yearlyIncome - limit),
      };
    }

    const elapsedMonths = now.getMonth() + 1;
    const projected = (yearlyIncome / elapsedMonths) * 12;
    return {
      closed: false,
      projected,
      crosses: projected > limit,
      fillPct,
      pacePct: Math.min(100, (projected / limit) * 100),
      headroom: Math.max(0, limit - yearlyIncome),
    };
  }, [data, selectedYear, yearlyIncome]);

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
      { key: 'business', done: !!user?.companyIco, to: '/profile/company' },
      { key: 'bank', done: !!user?.bankAccount, to: '/profile/bank' },
      { key: 'logo', done: !!user?.hasLogo, to: '/profile/logo' },
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

  // Centre the tooltip on a month's bar pair, then pull it back inside the plot if
  // it would hang off the card — it is far wider than the ~2% column, so January's
  // and December's would otherwise overflow. Falls back to a percentage anchor
  // until the plot and the tooltip have been measured.
  function anchorMonth(index: number, width: number): CSSProperties {
    const centerPct = ((index + 0.5) / 12) * 100;
    if (!chartWidth || !width) {
      return { left: `${centerPct}%`, transform: 'translateX(-50%)' };
    }
    const center = (chartWidth * centerPct) / 100;
    return { left: `${Math.min(Math.max(center - width / 2, 0), Math.max(chartWidth - width, 0))}px` };
  }

  const tooltipMonth = activeMonth === null ? null : chartData[activeMonth];

  // Year picker: show the newest few years as pills and page further back with the
  // chevrons, so a long history stays reachable without widening the card header
  const YEAR_WINDOW = 3;
  const windowEnd = Math.min(
    yearWindowEnd ?? availableYears.length - 1,
    availableYears.length - 1
  );
  const windowStart = Math.max(0, windowEnd - (YEAR_WINDOW - 1));
  const visibleYears = availableYears.slice(windowStart, windowEnd + 1);

  const tierFootnote = data.pausalniDan?.enabled && projection && (
    <div className="mt-4 pt-3.5 border-t border-hairline">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {t('pausalniDan.label', { tier: data.pausalniDan.tier })}
        </span>
        <span className="text-xs text-text-faint tabular-nums">
          {t('pausalniDan.ofLimit', {
            invoiced: formatCurrency(yearlyIncome),
            limit: formatCurrency(data.pausalniDan.limit),
          })}
        </span>
      </div>
      <div className="relative mt-2">
        <div className="h-[6px] rounded-[3px] bg-hairline overflow-hidden">
          <div
            className={`h-full rounded-[3px] ${projection.closed && projection.crosses ? 'bg-danger' : 'bg-accent-quiet'}`}
            style={{ width: `${projection.fillPct}%` }}
          />
        </div>
        {/* Pace marker: projected year-end at the current run rate. A closed year
            has no pace left to project — its bar is the final figure. */}
        {!projection.closed && (
          <div
            className={`absolute top-[-3px] w-[1.5px] h-3 ${projection.crosses ? 'bg-danger' : 'bg-text-faint'}`}
            style={{ left: `${projection.pacePct}%` }}
            data-testid="pace-marker"
          />
        )}
      </div>
      <div
        className={`flex items-center justify-between mt-2 text-[11px] ${
          projection.crosses ? 'text-danger' : 'text-text-faint'
        }`}
      >
        <span className="tabular-nums">
          {projection.closed
            ? t(projection.crosses ? 'pausalniDan.closedCrossed' : 'pausalniDan.closedInside', {
                year: selectedYear,
                tier: data.pausalniDan.tier,
              })
            : `${t('pausalniDan.pace', { amount: formatCurrency(projection.projected!) })} ${
                projection.crosses
                  ? t('pausalniDan.crosses', { tier: data.pausalniDan.tier })
                  : t('pausalniDan.inside', { tier: data.pausalniDan.tier })
              }`}
        </span>
        <span className="tabular-nums">
          {projection.closed && projection.crosses
            ? t('pausalniDan.exceededBy', { amount: formatCurrency(projection.overage!) })
            : t('pausalniDan.headroom', { amount: formatCurrency(projection.headroom) })}
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
                <div className="flex items-center bg-surface border border-border rounded-[10px] p-[3px]">
                  {windowStart > 0 && (
                    <button
                      onClick={() => setYearWindowEnd(windowEnd - 1)}
                      aria-label={t('chart.olderYears')}
                      className="flex items-center justify-center h-[22px] w-[22px] rounded-lg text-text-faint transition-colors hover:bg-surface-sunken hover:text-text"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {visibleYears.map(year => (
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
                  {windowEnd < availableYears.length - 1 && (
                    <button
                      onClick={() => setYearWindowEnd(windowEnd + 1)}
                      aria-label={t('chart.newerYears')}
                      className="flex items-center justify-center h-[22px] w-[22px] rounded-lg text-text-faint transition-colors hover:bg-surface-sunken hover:text-text"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* select-none / touch-callout on the plot: reading a month means resting
              a finger on it, which iOS otherwise takes as a long-press and answers
              with a text selection and the Copy/Look Up callout over the chart */}
          {maxMonth > 0 ? (
            <div
              className="relative mt-5 select-none [-webkit-touch-callout:none]"
              ref={chartRef}
            >
              <div className="flex items-end h-[190px]">
                {chartData.map((month, index) => (
                  <button
                    key={month.key}
                    type="button"
                    aria-label={`${month.name} ${selectedYear} — ${t('chart.income')} ${formatCurrency(month.income)}, ${t('chart.expenses')} ${formatCurrency(month.expenses)}`}
                    aria-pressed={pinnedMonth === index}
                    onPointerEnter={() => setHoveredMonth(index)}
                    onPointerLeave={() => setHoveredMonth(current => (current === index ? null : current))}
                    onClick={() => setPinnedMonth(current => (current === index ? null : index))}
                    data-testid={`month-column-${index}`}
                    className={`flex-1 flex items-end justify-center gap-[3px] h-full rounded-[8px] transition-colors duration-150 ${
                      activeMonth === index ? 'bg-row-hover' : ''
                    }`}
                  >
                    <span
                      className="w-[10px] rounded-[4px] bg-accent"
                      style={{ height: `${(month.income / maxMonth) * 100}%`, transition: 'height .2s' }}
                    />
                    <span
                      className="w-[10px] rounded-[4px] bg-chart-secondary"
                      style={{ height: `${(month.expenses / maxMonth) * 100}%`, transition: 'height .2s' }}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex">
                {chartData.map((month, index) => (
                  <span
                    key={month.key}
                    className={`flex-1 text-center text-[11px] transition-colors duration-150 ${
                      activeMonth === index ? 'font-semibold text-text' : 'text-text-faint'
                    }`}
                  >
                    {month.name}
                  </span>
                ))}
              </div>

              {tooltipMonth && activeMonth !== null && (
                <div
                  ref={tooltipRef}
                  role="tooltip"
                  data-testid="month-tooltip"
                  // bg-text / text-canvas invert together, so the tooltip stays a
                  // high-contrast slab in both themes without any dark: variants
                  className="absolute bottom-[214px] z-10 pointer-events-none w-max rounded-[10px] bg-text px-2.5 py-[7px] text-canvas whitespace-nowrap shadow-[0_8px_20px_-8px_rgba(27,29,41,.5)]"
                  style={anchorMonth(activeMonth, tooltipWidth)}
                >
                  <p className="text-[11px] font-semibold tracking-[.02em] opacity-[.65]">
                    {tooltipMonth.name} {selectedYear}
                  </p>
                  <div className="mt-0.5 flex flex-col gap-[3px]">
                    {([
                      { key: 'income', label: t('chart.income'), swatch: '#6d63f7', value: tooltipMonth.income },
                      { key: 'expenses', label: t('chart.expenses'), swatch: '#8b90a8', value: tooltipMonth.expenses },
                    ] as const).map(row => (
                      <div key={row.key} className="flex items-center justify-between gap-[14px]">
                        <span className="flex items-center gap-1.5 text-[11px] opacity-80">
                          <span
                            className="h-[7px] w-[7px] rounded-[2px]"
                            style={{ backgroundColor: row.swatch }}
                          />
                          {row.label}
                        </span>
                        <span className="text-[12px] font-semibold tabular-nums">
                          {formatCurrency(row.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className="block h-px mt-[7px] bg-current opacity-20" />
                  <div className="mt-[7px] flex items-center justify-between gap-[14px]">
                    <span className="text-[11px] opacity-80">{t('chart.netLabel')}</span>
                    <span className="text-[12px] font-bold tabular-nums">
                      {formatCurrency(tooltipMonth.income - tooltipMonth.expenses)}
                    </span>
                  </div>
                </div>
              )}
            </div>
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
