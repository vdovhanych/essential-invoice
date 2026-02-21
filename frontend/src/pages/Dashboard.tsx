import { useState, useEffect } from 'react';
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
  Landmark
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  const chartData = data.monthlyRevenue.map(item => ({
    name: new Date(item.month).toLocaleDateString('cs-CZ', { month: 'short' }),
    revenue: item.revenue,
  }));

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
            <Link to="/settings" className="text-sm text-blue-600 hover:underline">
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
        {/* Monthly revenue chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Měsíční tržby</h2>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fill: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                  <YAxis tick={{ fill: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Měsíc: ${label}`}
                    contentStyle={resolvedTheme === 'dark' ? { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' } : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Zatím žádné tržby
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
