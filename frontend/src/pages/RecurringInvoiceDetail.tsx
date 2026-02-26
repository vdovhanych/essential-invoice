import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  Pause,
  Zap,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface RecurringItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface RecurringTemplate {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  vatRate: number;
  notes: string;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  nextGenerationDate: string;
  paymentTerms: number;
  autoSend: boolean;
  active: boolean;
  items: RecurringItem[];
}

interface GeneratedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  total: number;
  currency: string;
}

export default function RecurringInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<RecurringTemplate | null>(null);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [templateData, invoicesData] = await Promise.all([
        api.get(`/recurring-invoices/${id}`),
        api.get(`/invoices?recurringId=${id}`),
      ]);
      setTemplate(templateData);
      setGeneratedInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    try {
      const result = await api.post(`/recurring-invoices/${id}/toggle`);
      setTemplate(prev => prev ? { ...prev, active: result.active } : null);
      setMessage({ type: 'success', text: result.active ? 'Opakovaná faktura aktivována' : 'Opakovaná faktura pozastavena' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se změnit stav' });
    }
  }

  async function handleGenerateNow() {
    setGenerating(true);
    try {
      await api.post(`/recurring-invoices/${id}/generate-now`);
      setMessage({ type: 'success', text: 'Faktura byla vygenerována' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se vygenerovat fakturu' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Opravdu chcete smazat tuto opakovanou fakturu? Tato akce je nevratná.')) return;
    try {
      await api.delete(`/recurring-invoices/${id}`);
      navigate('/invoices?tab=recurring');
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se smazat opakovanou fakturu' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!template) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Opakovaná faktura nenalezena</div>;
  }

  const subtotal = template.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = subtotal * (template.vatRate / 100);
  const total = subtotal + vatAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices?tab=recurring')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Opakovaná faktura — {template.clientName}
            </h1>
            {template.active ? (
              <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Aktivní</span>
            ) : (
              <span className="badge bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Pozastaveno</span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleGenerateNow}
            disabled={generating}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Zap className="h-4 w-4" />
            <span>{generating ? 'Generuji...' : 'Vygenerovat nyní'}</span>
          </button>
          <Link to={`/recurring/${id}/edit`} className="btn btn-secondary flex items-center space-x-2">
            <Edit className="h-4 w-4" />
            <span>Upravit</span>
          </Link>
          <button
            onClick={handleToggle}
            className="btn btn-secondary flex items-center space-x-2"
          >
            {template.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{template.active ? 'Pozastavit' : 'Aktivovat'}</span>
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center space-x-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Položky</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Popis</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Množství</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Cena/ks</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {template.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-right">{item.quantity} {item.unit}</td>
                      <td className="py-3 text-right">{formatCurrency(item.unitPrice, template.currency)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice, template.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={3} className="py-2 text-right font-medium">Základ daně:</td>
                    <td className="py-2 text-right">{formatCurrency(subtotal, template.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-2 text-right font-medium">DPH ({template.vatRate}%):</td>
                    <td className="py-2 text-right">{formatCurrency(vatAmount, template.currency)}</td>
                  </tr>
                  <tr className="text-lg">
                    <td colSpan={3} className="py-2 text-right font-bold">Celkem:</td>
                    <td className="py-2 text-right font-bold text-blue-600">
                      {formatCurrency(total, template.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {template.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Poznámky</h2>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{template.notes}</p>
            </div>
          )}

          {/* Generated invoices */}
          {generatedInvoices.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vygenerované faktury</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Číslo</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Datum</th>
                      <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Částka</th>
                      <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3">
                          <Link to={`/invoices/${invoice.id}`} className="text-blue-600 hover:underline">
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-600 dark:text-gray-300">{formatDate(invoice.issueDate)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(invoice.total, invoice.currency)}</td>
                        <td className="py-3 text-center">
                          <span className={`badge ${getStatusColor(invoice.status)}`}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Plán</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Den v měsíci:</dt>
                <dd className="font-medium">{template.dayOfMonth}.</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Datum zahájení:</dt>
                <dd className="font-medium">{formatDate(template.startDate)}</dd>
              </div>
              {template.endDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Datum ukončení:</dt>
                  <dd className="font-medium">{formatDate(template.endDate)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Další generování:</dt>
                <dd className="font-medium">{formatDate(template.nextGenerationDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Splatnost:</dt>
                <dd className="font-medium">{template.paymentTerms} dní</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Auto-odeslání:</dt>
                <dd className="font-medium">{template.autoSend ? 'Ano' : 'Ne'}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Akce</h2>
            <div className="space-y-2">
              <button
                onClick={handleDelete}
                className="btn btn-danger w-full flex items-center justify-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Smazat opakovanou fakturu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
