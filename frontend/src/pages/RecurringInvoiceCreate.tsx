import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency as formatCurrencyLocale } from '../utils/format';
import { useLineItems, LineItem } from '../hooks/useLineItems';
import InvoiceItemsEditor from '../components/InvoiceItemsEditor';
import { PageLoader } from '../components/Spinner';

interface Client {
  id: string;
  companyName: string;
  primaryEmail: string;
}

export default function RecurringInvoiceCreate() {
  const { t } = useTranslation('invoices');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    currency: 'CZK',
    vatRate: 21,
    notes: '',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    paymentTerms: 14,
    autoSend: false,
  });

  const {
    items, setItems, handleItemChange, addItem, removeItem,
    subtotal, vatAmount, total,
  } = useLineItems(formData.vatRate);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [clientsData, settings] = await Promise.all([
        api.get('/clients'),
        api.get('/settings')
      ]);
      setClients(clientsData);

      if (isEdit) {
        const template = await api.get(`/recurring-invoices/${id}`);
        setFormData({
          clientId: template.clientId,
          currency: template.currency,
          vatRate: template.vatRate,
          notes: template.notes || '',
          dayOfMonth: template.dayOfMonth,
          startDate: template.startDate?.split('T')[0] || '',
          endDate: template.endDate?.split('T')[0] || '',
          paymentTerms: template.paymentTerms,
          autoSend: template.autoSend,
        });
        setItems(template.items.map((item: LineItem) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })));
      } else {
        setFormData(prev => ({
          ...prev,
          vatRate: settings.defaultVatRate ?? 21,
          paymentTerms: settings.defaultPaymentTerms ?? 14,
        }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.clientId) {
      toast.error(t('recurring.create.validationSelectContact'));
      return;
    }

    if (items.some(item => !item.description || item.unitPrice <= 0)) {
      toast.error(t('recurring.create.validationFillItems'));
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        vatRate: Number(formData.vatRate),
        dayOfMonth: Number(formData.dayOfMonth),
        paymentTerms: Number(formData.paymentTerms),
        endDate: formData.endDate || undefined,
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };

      if (isEdit) {
        await api.put(`/recurring-invoices/${id}`, payload);
      } else {
        await api.post('/recurring-invoices', payload);
      }

      navigate('/invoices?tab=recurring');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('recurring.create.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  const formatCurrency = (amount: number) => {
    return formatCurrencyLocale(amount, formData.currency);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/invoices?tab=recurring')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? t('recurring.create.titleEdit') : t('recurring.create.title')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.create.contactSection')}</h2>
          <div>
            <label htmlFor="clientId" className="label">{t('recurring.create.selectContact')}</label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="">{t('recurring.create.selectContactPlaceholder')}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.companyName} ({client.primaryEmail})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.create.scheduleSection')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="dayOfMonth" className="label">{t('recurring.create.dayOfMonth')}</label>
              <select
                id="dayOfMonth"
                name="dayOfMonth"
                value={formData.dayOfMonth}
                onChange={handleChange}
                className="input"
                required
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}.</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startDate" className="label">{t('recurring.create.startDate')}</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="endDate" className="label">{t('recurring.create.endDate')}</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="input"
                placeholder={t('recurring.create.endDatePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="paymentTerms" className="label">{t('recurring.create.paymentTerms')}</label>
              <input
                type="number"
                id="paymentTerms"
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
                className="input"
                min="1"
                max="365"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="currency" className="label">{t('recurring.create.currency')}</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="input"
              >
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="autoSend"
                name="autoSend"
                checked={formData.autoSend}
                onChange={handleChange}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
              />
              <label htmlFor="autoSend" className="text-sm text-gray-700 dark:text-gray-300">
                {t('recurring.create.autoSend')}
              </label>
            </div>
          </div>
        </div>

        {/* Items */}
        <InvoiceItemsEditor
          items={items}
          onItemChange={handleItemChange}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          vatRate={formData.vatRate}
          onVatRateChange={handleChange}
          subtotal={subtotal}
          vatAmount={vatAmount}
          total={total}
          formatCurrency={formatCurrency}
          keyPrefix="recurring.create"
        />

        {/* Notes */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('recurring.create.notesSection')}</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
            rows={3}
            maxLength={300}
            placeholder={t('recurring.create.notesPlaceholder')}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('recurring.create.notesCharCount', { count: formData.notes.length })}
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/invoices?tab=recurring')}
            className="btn btn-secondary"
          >
            {t('recurring.create.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? t('recurring.create.saving') : (isEdit ? t('recurring.create.saveChanges') : t('recurring.create.createRecurring'))}
          </button>
        </div>
      </form>
    </div>
  );
}
