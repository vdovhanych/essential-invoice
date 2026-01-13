import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Client {
  id: string;
  companyName: string;
  primaryEmail: string;
  secondaryEmail: string | null;
  address: string;
  ico: string;
  dic: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export default function InvoiceCreate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clientId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    deliveryDate: new Date().toISOString().split('T')[0],
    currency: 'CZK',
    vatRate: 21,
    notes: '',
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit: 'ks', unitPrice: 0 }
  ]);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const clientsData = await api.get('/clients');
      setClients(clientsData);

      if (isEdit) {
        const invoice = await api.get(`/invoices/${id}`);
        setFormData({
          clientId: invoice.clientId,
          issueDate: invoice.issueDate.split('T')[0],
          dueDate: invoice.dueDate.split('T')[0],
          deliveryDate: invoice.deliveryDate.split('T')[0],
          currency: invoice.currency,
          vatRate: invoice.vatRate,
          notes: invoice.notes || '',
        });
        setItems(invoice.items.map((item: InvoiceItem) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handleItemChange(index: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }

  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: 1, unit: 'ks', unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  }

  function calculateSubtotal(): number {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  function calculateVat(): number {
    return calculateSubtotal() * (formData.vatRate / 100);
  }

  function calculateTotal(): number {
    return calculateSubtotal() + calculateVat();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.clientId) {
      setError('Vyberte klienta');
      return;
    }

    if (items.some(item => !item.description || item.unitPrice <= 0)) {
      setError('Vyplnte vsechny polozky');
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
      setError(error.message || 'Nepodarilo se ulozit fakturu');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    const symbol = formData.currency === 'CZK' ? 'Kc' : 'EUR';
    return `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/invoices')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Upravit fakturu' : 'Nova faktura'}
        </h1>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-4 bg-red-50 text-red-700 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Klient</h2>
          <div>
            <label htmlFor="clientId" className="label">Vyberte klienta *</label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="">-- Vyberte klienta --</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.companyName} ({client.primaryEmail})
                </option>
              ))}
            </select>
            {clients.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Zatim nemate zadne klienty.{' '}
                <a href="/clients" className="text-blue-600 hover:underline">Pridat klienta</a>
              </p>
            )}
          </div>
        </div>

        {/* Invoice details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Udaje faktury</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="issueDate" className="label">Datum vystaveni *</label>
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
              <label htmlFor="dueDate" className="label">Datum splatnosti *</label>
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
              <label htmlFor="deliveryDate" className="label">DUZP</label>
              <input
                type="date"
                id="deliveryDate"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="currency" className="label">Mena</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="input"
              >
                <option value="CZK">CZK (Kc)</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Polozky</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Pridat polozku</span>
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-12 md:col-span-5">
                  <label className="label">Popis *</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    className="input"
                    placeholder="Popis polozky"
                    required
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="label">Mnozstvi</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="input"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <label className="label">Jednotka</label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    className="input"
                    placeholder="ks"
                  />
                </div>
                <div className="col-span-4 md:col-span-3">
                  <label className="label">Cena za jednotku *</label>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="input"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="col-span-12 md:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="btn btn-secondary p-2 w-full"
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex flex-col items-end space-y-2">
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-gray-600">Zaklad dane:</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">DPH:</span>
                  <select
                    name="vatRate"
                    value={formData.vatRate}
                    onChange={handleChange}
                    className="input w-20 py-1"
                  >
                    <option value="0">0%</option>
                    <option value="12">12%</option>
                    <option value="21">21%</option>
                  </select>
                </div>
                <span className="font-medium">{formatCurrency(calculateVat())}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-lg">
                <span className="font-bold">Celkem:</span>
                <span className="font-bold text-blue-600">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Poznamky</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
            rows={3}
            placeholder="Volitelne poznamky k fakture..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="btn btn-secondary"
          >
            Zrusit
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Ukladam...' : (isEdit ? 'Ulozit zmeny' : 'Vytvorit fakturu')}
          </button>
        </div>
      </form>
    </div>
  );
}
