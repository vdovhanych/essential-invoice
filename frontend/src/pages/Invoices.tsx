import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import { Plus, Search, Filter, FileText, Download } from 'lucide-react';

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  async function loadInvoices() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Faktury</h1>
        <Link to="/invoices/new" className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Nová faktura</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat faktury..."
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
            <option value="">Všechny stavy</option>
            <option value="draft">Koncept</option>
            <option value="sent">Odesláno</option>
            <option value="paid">Zaplaceno</option>
            <option value="overdue">Po splatnosti</option>
            <option value="cancelled">Zrušeno</option>
          </select>
        </div>
      </div>

      {/* Invoice list */}
      <div className="card overflow-hidden">
        {filteredInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Číslo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Kontakt</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Datum vystavení</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Splatnost</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Částka</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Stav</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="font-medium text-blue-600 hover:underline"
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
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        title="Stáhnout PDF"
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
            <p className="text-gray-500 dark:text-gray-400">Žádné faktury nenalezeny</p>
            <Link to="/invoices/new" className="btn btn-primary mt-4 inline-flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Vytvořit první fakturu</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
