import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Plus,
  CreditCard
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
}

export default function Dashboard() {
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
    return <div className="text-center text-gray-500">Nepodarilo se nacist data</div>;
  }

  const chartData = data.monthlyRevenue.map(item => ({
    name: new Date(item.month).toLocaleDateString('cs-CZ', { month: 'short' }),
    revenue: item.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/invoices/new" className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Nova faktura</span>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">K uhrade</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.stats.outstandingAmount)}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data.stats.sentCount + data.stats.overdueCount} faktur ceka na platbu
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Zaplaceno tento mesic</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.stats.paidThisMonth)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data.stats.paidCount} zaplacenych faktur celkem
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Po splatnosti</p>
              <p className="text-2xl font-bold text-red-600">
                {data.stats.overdueCount}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Faktury po datu splatnosti
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Celkem zaplaceno</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.stats.paidAmount)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Za celou dobu
          </p>
        </div>
      </div>

      {/* Unmatched payments alert */}
      {data.unmatchedPayments > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CreditCard className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-800">
              Mate {data.unmatchedPayments} nespárovaných plateb
            </span>
          </div>
          <Link to="/payments" className="text-yellow-600 hover:underline font-medium">
            Zobrazit platby
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly revenue chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mesicni trzby</h2>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Mesic: ${label}`}
                  />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Zatim zadne trzby
            </div>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Posledni faktury</h2>
            <Link to="/invoices" className="text-blue-600 hover:underline text-sm">
              Zobrazit vse
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentInvoices.length > 0 ? (
              data.recentInvoices.slice(0, 5).map((invoice) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">{invoice.clientName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </p>
                    <span className={`badge ${getStatusColor(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                Zatim zadne faktury
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
