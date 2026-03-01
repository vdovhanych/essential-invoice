import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, getStatusLabel, getStatusColor } from '../utils/format';
import { useTheme } from '../context/ThemeContext';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Plus,
  CreditCard,
  Landmark,
  ChevronDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardData {
  stats: {
    draftCount: number;
    sentCount: number;
    paidCount: number;
    overdueCount: number;
    cancelledCount: number;
    outstandingAmount: number;
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
  const { resolvedTheme } = useTheme();
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
        name: date.toLocaleDateString('cs-CZ', { month: 'short' }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Nepodařilo se načíst data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Přehled</h1>
        <Link to="/invoices/new" className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Nová faktura</span>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">K úhradě</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(data.stats.outstandingAmount)}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {data.stats.sentCount + data.stats.overdueCount} faktur čeká na platbu
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Zaplaceno tento měsíc</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(data.stats.paidThisMonth)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {data.stats.paidCount} zaplacených faktur celkem
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Po splatnosti</p>
              <p className="text-2xl font-bold text-red-600">
                {data.stats.overdueCount}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Faktury po datu splatnosti
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Celkem zaplaceno</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(data.stats.paidAmount)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Za celou dobu
          </p>
        </div>
      </div>

      {/* Unmatched payments alert */}
      {data.unmatchedPayments > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CreditCard className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-800 dark:text-yellow-300">
              Máte {data.unmatchedPayments} nespárovaných plateb
            </span>
          </div>
          <Link to="/payments" className="text-yellow-600 dark:text-yellow-400 hover:underline font-medium">
            Zobrazit platby
          </Link>
        </div>
      )}

      {/* Paušální daň widget */}
      {data.pausalniDan?.enabled && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Landmark className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Paušální daň - {data.pausalniDan.tier}. pásmo</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Limit {formatCurrency(data.pausalniDan.limit)} / rok
                </p>
              </div>
            </div>
            <Link to="/profile#pausalni-dan" className="text-sm text-blue-600 hover:underline">
              Nastavení
            </Link>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-300">Vyfakturováno letos</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(data.pausalniDan.invoicedThisYear)} z {formatCurrency(data.pausalniDan.limit)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  (data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) >= 0.9
                    ? 'bg-red-500'
                    : (data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) >= 0.75
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, (data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) * 100)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-500 dark:text-gray-400">
                {((data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) * 100).toFixed(1)}% využito
              </span>
              <span className={`font-medium ${
                data.pausalniDan.remaining <= 0
                  ? 'text-red-600'
                  : (data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) >= 0.9
                  ? 'text-red-600'
                  : 'text-emerald-600'
              }`}>
                Zbývá: {formatCurrency(data.pausalniDan.remaining)}
              </span>
            </div>
          </div>

          {/* Warning if close to limit */}
          {(data.pausalniDan.invoicedThisYear / data.pausalniDan.limit) >= 0.9 && (
            <div className={`flex items-center space-x-2 p-3 rounded-lg ${
              data.pausalniDan.remaining <= 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
            }`}>
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">
                {data.pausalniDan.remaining <= 0
                  ? 'Dosáhli jste limitu pro paušální daň. Další příjmy mohou vést k vyřazení z režimu.'
                  : 'Blížíte se k limitu paušální daně. Zvažte přechod do vyššího pásma.'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly revenue & expenses chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Celkové tržby</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(yearlyIncome - yearlyExpensesTotal)}
              </p>
            </div>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg px-3 py-1.5 pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Příjmy</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Výdaje</span>
            </div>
          </div>
          {chartData.some(d => d.income > 0 || d.expenses > 0) ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className={`rounded-lg px-3 py-2 shadow-lg text-sm ${resolvedTheme === 'dark' ? 'bg-gray-800 border border-gray-700 text-gray-100' : 'bg-white border border-gray-200 text-gray-900'}`}>
                          <p className="font-medium mb-1">{label}</p>
                          {payload.map((entry) => (
                            <p key={entry.dataKey} className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                              <span className="text-gray-500 dark:text-gray-400">{entry.dataKey === 'income' ? 'Příjmy' : 'Výdaje'}:</span>
                              <span className="font-medium">{formatCurrency(entry.value as number)}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill={resolvedTheme === 'dark' ? '#475569' : '#cbd5e1'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Zatím žádná data
            </div>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Poslední faktury</h2>
            <Link to="/invoices" className="text-blue-600 hover:underline text-sm">
              Zobrazit vše
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentInvoices.length > 0 ? (
              data.recentInvoices.slice(0, 5).map((invoice) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.clientName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </p>
                    <span className={`badge ${getStatusColor(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Zatím žádné faktury
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
