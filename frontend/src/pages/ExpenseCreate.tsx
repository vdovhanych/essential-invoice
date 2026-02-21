import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { ArrowLeft, AlertCircle, Upload, X } from 'lucide-react';

interface Client {
  id: string;
  companyName: string;
  primaryEmail: string;
}

export default function ExpenseCreate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clientId: '',
    supplierInvoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'CZK',
    amount: '' as unknown as number,
    vatRate: 21,
    description: '',
    notes: '',
  });

  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const clientsData = await api.get('/clients');
      setClients(clientsData);

      if (isEdit) {
        const expense = await api.get(`/expenses/${id}`);
        setFormData({
          clientId: expense.clientId || '',
          supplierInvoiceNumber: expense.supplierInvoiceNumber || '',
          issueDate: expense.issueDate.split('T')[0],
          dueDate: expense.dueDate.split('T')[0],
          currency: expense.currency,
          amount: expense.amount,
          vatRate: expense.vatRate,
          description: expense.description || '',
          notes: expense.notes || '',
        });
        if (expense.fileData) {
          setFileData(expense.fileData);
          setFileName(expense.fileName);
          setFileMimeType(expense.fileMimeType);
        }
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Povolené formáty: PDF, JPEG, PNG');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Maximální velikost souboru je 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFileData(base64);
      setFileName(file.name);
      setFileMimeType(file.type);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  function removeFile() {
    setFileData(null);
    setFileName(null);
    setFileMimeType(null);
  }

  function calculateVatAmount(): number {
    return Number(formData.amount) * (Number(formData.vatRate) / 100);
  }

  function calculateTotal(): number {
    return Number(formData.amount) + calculateVatAmount();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (Number(formData.amount) <= 0) {
      setError('Zadejte částku');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        clientId: formData.clientId || null,
        supplierInvoiceNumber: formData.supplierInvoiceNumber || null,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        currency: formData.currency,
        amount: Number(formData.amount),
        vatRate: Number(formData.vatRate),
        description: formData.description || null,
        notes: formData.notes || null,
        fileData,
        fileName,
        fileMimeType,
      };

      if (isEdit) {
        await api.put(`/expenses/${id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }

      navigate('/expenses');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Nepodařilo se uložit náklad');
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

  const formatCurrencyLocal = (amount: number) => {
    const symbol = formData.currency === 'CZK' ? 'Kč' : 'EUR';
    return `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/expenses')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? 'Upravit náklad' : 'Nový náklad'}
        </h1>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supplier selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Dodavatel</h2>
          <div>
            <label htmlFor="clientId" className="label">Vyberte dodavatele</label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="input"
            >
              <option value="">-- Bez dodavatele --</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expense details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Údaje nákladu</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="supplierInvoiceNumber" className="label">Číslo faktury dodavatele</label>
              <input
                type="text"
                id="supplierInvoiceNumber"
                name="supplierInvoiceNumber"
                value={formData.supplierInvoiceNumber}
                onChange={handleChange}
                className="input"
                maxLength={100}
                placeholder="FV-2026001"
              />
            </div>
            <div>
              <label htmlFor="issueDate" className="label">Datum přijetí *</label>
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
              <label htmlFor="currency" className="label">Měna</label>
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

        {/* Amount */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Částka</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="amount" className="label">Základ daně *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="input"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div>
              <label htmlFor="vatRate" className="label">Sazba DPH</label>
              <select
                id="vatRate"
                name="vatRate"
                value={formData.vatRate}
                onChange={handleChange}
                className="input"
              >
                <option value="0">0%</option>
                <option value="12">12%</option>
                <option value="21">21%</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-end space-y-2">
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-gray-600 dark:text-gray-300">Základ daně:</span>
                <span className="font-medium">{formatCurrencyLocal(Number(formData.amount))}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-gray-600 dark:text-gray-300">DPH ({formData.vatRate}%):</span>
                <span className="font-medium">{formatCurrencyLocal(calculateVatAmount())}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-lg">
                <span className="font-bold">Celkem:</span>
                <span className="font-bold text-blue-600">{formatCurrencyLocal(calculateTotal())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* File attachment */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Příloha</h2>
          {fileName ? (
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300">{fileName}</span>
              <button
                type="button"
                onClick={removeFile}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Klikněte pro nahrání souboru (PDF, JPEG, PNG, max 5 MB)
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>

        {/* Description */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Popis</h2>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input"
            rows={2}
            maxLength={300}
            placeholder="Za co je náklad..."
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formData.description.length}/300 znaků
          </p>
        </div>

        {/* Notes */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Poznámky</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
            rows={2}
            maxLength={300}
            placeholder="Doplňující poznámky..."
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formData.notes.length}/300 znaků
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="btn btn-secondary"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Ukládám...' : (isEdit ? 'Uložit změny' : 'Vytvořit náklad')}
          </button>
        </div>
      </form>
    </div>
  );
}
