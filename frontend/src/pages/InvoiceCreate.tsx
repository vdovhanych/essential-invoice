import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  secondaryEmail: string | null;
  address: string;
  ico: string;
  dic: string;
}

export default function InvoiceCreate() {
  const { t } = useTranslation('invoices');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const duplicateId = searchParams.get('duplicate');

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'CZK',
    vatRate: 21,
    notes: '',
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
      // Load clients and settings in parallel
      const [clientsData, settings] = await Promise.all([
        api.get('/clients'),
        api.get('/settings')
      ]);
      setClients(clientsData);

      if (isEdit) {
        const invoice = await api.get(`/invoices/${id}`);
        setFormData({
          clientId: invoice.clientId,
          issueDate: invoice.issueDate.split('T')[0],
          dueDate: invoice.dueDate.split('T')[0],
          currency: invoice.currency,
          vatRate: invoice.vatRate,
          notes: invoice.notes || '',
        });
        setItems(invoice.items.map((item: LineItem) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })));
      } else if (duplicateId) {
        // Duplicate an existing invoice with fresh dates
        const paymentTerms = settings.defaultPaymentTerms ?? 14;
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const invoice = await api.get(`/invoices/${duplicateId}`);
        setFormData({
          clientId: invoice.clientId,
          issueDate: today,
          dueDate,
          currency: invoice.currency,
          vatRate: invoice.vatRate,
          notes: invoice.notes || '',
        });
        setItems(invoice.items.map((item: LineItem) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })));
      } else {
        // Apply default settings for new invoices
        const paymentTerms = settings.defaultPaymentTerms ?? 14;
        const dueDate = new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setFormData(prev => ({
          ...prev,
          vatRate: settings.defaultVatRate ?? 21,
          dueDate,
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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!formData.clientId) {
      toast.error(t('create.validationSelectContact'));
      return;
    }

    if (items.some(item => !item.description || item.unitPrice <= 0)) {
      toast.error(t('create.validationFillItems'));
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        vatRate: Number(formData.vatRate),
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };

      if (isEdit) {
        await api.put(`/invoices/${id}`, payload);
      } else {
        await api.post('/invoices', payload);
      }

      navigate('/invoices');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('create.saveError'));
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
          onClick={() => navigate('/invoices')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? t('create.titleEdit') : t('create.title')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('create.contactSection')}</h2>
          <div>
            <label htmlFor="clientId" className="label">{t('create.selectContact')}</label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="">{t('create.selectContactPlaceholder')}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.companyName} ({client.primaryEmail})
                </option>
              ))}
            </select>
            {clients.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {t('create.noContacts')}{' '}
                <Link to="/clients" className="text-indigo-600 hover:underline">{t('create.addContact')}</Link>
              </p>
            )}
          </div>
        </div>

        {/* Invoice details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('create.detailsSection')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="issueDate" className="label">{t('create.issueDate')}</label>
              <input
                type="date"
                id="issueDate"
                name="issueDate"
                value={formData.issueDate}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="label">{t('create.dueDate')}</label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="currency" className="label">{t('create.currency')}</label>
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
          keyPrefix="create"
        />

        {/* Notes */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('create.notesSection')}</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
            rows={3}
            maxLength={300}
            placeholder={t('create.notesPlaceholder')}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('create.notesCharCount', { count: formData.notes.length })}
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="btn btn-secondary"
          >
            {t('create.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? t('create.saving') : (isEdit ? t('create.saveChanges') : t('create.createInvoice'))}
          </button>
        </div>
      </form>
    </div>
  );
}
