import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  Pause,
  Zap,
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
  const { t } = useTranslation('invoices');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<RecurringTemplate | null>(null);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
      toast.success(result.active ? t('recurring.detail.activatedSuccess') : t('recurring.detail.pausedSuccess'));
    } catch (error) {
      toast.error(t('recurring.detail.toggleError'));
    }
  }

  async function handleGenerateNow() {
    setGenerating(true);
    try {
      await api.post(`/recurring-invoices/${id}/generate-now`);
      toast.success(t('recurring.detail.generateSuccess'));
      loadData();
    } catch (error) {
      toast.error(t('recurring.detail.generateError'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('recurring.detail.confirmDelete'))) return;
    try {
      await api.delete(`/recurring-invoices/${id}`);
      navigate('/invoices?tab=recurring');
    } catch (error) {
      toast.error(t('recurring.detail.deleteError'));
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
    return <div className="text-center text-gray-500 dark:text-gray-400">{t('recurring.detail.notFound')}</div>;
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
              {t('recurring.detail.title', { clientName: template.clientName })}
            </h1>
            {template.active ? (
              <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t('recurring.detail.statusActive')}</span>
            ) : (
              <span className="badge bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">{t('recurring.detail.statusPaused')}</span>
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
            <span>{generating ? t('recurring.detail.generating') : t('recurring.detail.generateNow')}</span>
          </button>
          <Link to={`/recurring/${id}/edit`} className="btn btn-secondary flex items-center space-x-2">
            <Edit className="h-4 w-4" />
            <span>{t('recurring.detail.edit')}</span>
          </Link>
          <button
            onClick={handleToggle}
            className="btn btn-secondary flex items-center space-x-2"
          >
            {template.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{template.active ? t('recurring.detail.pause') : t('recurring.detail.activate')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.detail.itemsSection')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.columnDescription')}</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.columnQuantity')}</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.columnUnitPrice')}</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.columnTotal')}</th>
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
                    <td colSpan={3} className="py-2 text-right font-medium">{t('recurring.detail.subtotal')}</td>
                    <td className="py-2 text-right">{formatCurrency(subtotal, template.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-2 text-right font-medium">{t('recurring.detail.vatWithRate', { rate: template.vatRate })}</td>
                    <td className="py-2 text-right">{formatCurrency(vatAmount, template.currency)}</td>
                  </tr>
                  <tr className="text-lg">
                    <td colSpan={3} className="py-2 text-right font-bold">{t('recurring.detail.total')}</td>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.detail.notesSection')}</h2>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{template.notes}</p>
            </div>
          )}

          {/* Generated invoices */}
          {generatedInvoices.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.detail.generatedInvoicesSection')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.generatedColumnNumber')}</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.generatedColumnDate')}</th>
                      <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.generatedColumnAmount')}</th>
                      <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">{t('recurring.detail.generatedColumnStatus')}</th>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.detail.scheduleSection')}</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('recurring.detail.dayOfMonth')}</dt>
                <dd className="font-medium">{template.dayOfMonth}.</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('recurring.detail.startDate')}</dt>
                <dd className="font-medium">{formatDate(template.startDate)}</dd>
              </div>
              {template.endDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">{t('recurring.detail.endDate')}</dt>
                  <dd className="font-medium">{formatDate(template.endDate)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('recurring.detail.nextGeneration')}</dt>
                <dd className="font-medium">{formatDate(template.nextGenerationDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('recurring.detail.paymentTerms')}</dt>
                <dd className="font-medium">{t('recurring.detail.paymentTermsDays', { count: template.paymentTerms })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('recurring.detail.autoSend')}</dt>
                <dd className="font-medium">{template.autoSend ? t('recurring.detail.autoSendYes') : t('recurring.detail.autoSendNo')}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.detail.actionsSection')}</h2>
            <div className="space-y-2">
              <button
                onClick={handleDelete}
                className="btn btn-danger w-full flex items-center justify-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('recurring.detail.deleteRecurring')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
