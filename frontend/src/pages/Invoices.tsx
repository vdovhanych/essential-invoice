import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import { Plus, Search, Filter, FileText, Download } from 'lucide-react';
import RecurringInvoices from './RecurringInvoices';

interface Invoice {
  id: string;
  invoiceNumber: string;
  variableSymbol: string;
  status: string;
  currency: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  total: number;
  createdAt: string;
}

export default function Invoices() {
  const { t } = useTranslation('invoices');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'recurring' ? 'recurring' : 'invoices';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices();
    }
  }, [statusFilter, activeTab]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const result = await api.get(`/invoices?${params}`);
      setInvoices(result);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    invoice.clientName.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDownloadPDF(invoiceId: string, invoiceNumber: string) {
    try {
      await api.download(`/invoices/${invoiceId}/pdf`, `${invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  }

  function setTab(tab: 'invoices' | 'recurring') {
    if (tab === 'recurring') {
      setSearchParams({ tab: 'recurring' });
    } else {
      setSearchParams({});
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <Link
          to={activeTab === 'recurring' ? '/recurring/new' : '/invoices/new'}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>{activeTab === 'recurring' ? t('newRecurring') : t('newInvoice')}</span>
        </Link>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setTab('invoices')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invoices'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            {t('tabs.invoices')}
          </button>
          <button
            onClick={() => setTab('recurring')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'recurring'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            {t('tabs.recurring')}
          </button>
        </nav>
      </div>

      {activeTab === 'recurring' ? (
        <RecurringInvoices />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('list.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-auto"
              >
                <option value="">{t('list.allStatuses')}</option>
                <option value="draft">{t('common:status.draft')}</option>
                <option value="sent">{t('common:status.sent')}</option>
                <option value="paid">{t('common:status.paid')}</option>
                <option value="overdue">{t('common:status.overdue')}</option>
                <option value="cancelled">{t('common:status.cancelled')}</option>
              </select>
            </div>
          </div>

          {/* Invoice list */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {filteredInvoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnNumber')}</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnContact')}</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnIssueDate')}</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnDueDate')}</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnAmount')}</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnStatus')}</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('list.columnActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="py-3 px-4">
                            <Link
                              to={`/invoices/${invoice.id}`}
                              className="font-medium text-indigo-600 hover:underline"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              to={`/clients/${invoice.clientId}`}
                              className="text-gray-900 dark:text-gray-100 hover:underline"
                            >
                              {invoice.clientName}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{formatDate(invoice.issueDate)}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{formatDate(invoice.dueDate)}</td>
                          <td className="py-3 px-4 text-right font-medium">
                            {formatCurrency(invoice.total, invoice.currency)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`badge ${getStatusColor(invoice.status)}`}>
                              {getStatusLabel(invoice.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDownloadPDF(invoice.id, invoice.invoiceNumber)}
                              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                              title={t('list.downloadPdf')}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">{t('list.emptyState')}</p>
                  <Link to="/invoices/new" className="btn btn-primary mt-4 inline-flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>{t('list.createFirst')}</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
