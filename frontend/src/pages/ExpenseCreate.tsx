import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { toast } from 'sonner';
import { ArrowLeft, Upload, X, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { PageLoader } from '../components/Spinner';
import { useAI } from '../context/AIContext';
import { findSupplierClient } from '../utils/supplierMatch';
import { useObjectUrl, toPreviewMimeType } from '../hooks/useObjectUrl';

interface Client {
  id: string;
  companyName: string;
  primaryEmail: string;
  ico: string | null;
}

export default function ExpenseCreate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('expenses');
  const isEdit = !!id;

  const { aiStatus, extractExpense } = useAI();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

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
  const [flatRateEnabled, setFlatRateEnabled] = useState(false);

  // Images preview inline; a PDF shows the file icon instead. Narrowing to a
  // literal keeps the stored MIME string out of the URL entirely.
  const imageMimeType = (() => {
    const narrowed = toPreviewMimeType(fileMimeType);
    return narrowed === 'application/pdf' ? null : narrowed;
  })();
  const previewUrl = useObjectUrl(fileData, imageMimeType);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [clientsData, dashboard] = await Promise.all([
        api.get('/clients'),
        api.get('/dashboard').catch(() => null),
      ]);
      setFlatRateEnabled(!!dashboard?.pausalniDan?.enabled);
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
      toast.error(t('common:errors.loadFailed'));
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
      toast.error(t('create.attachment.allowedFormats'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('create.attachment.maxFileSize'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFileData(base64);
      setFileName(file.name);
      setFileMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }

  function removeFile() {
    setFileData(null);
    setFileName(null);
    setFileMimeType(null);
  }

  async function handleExtract() {
    if (!fileData || !fileMimeType) return;
    setExtracting(true);

    try {
      const extracted = await extractExpense(fileData, fileMimeType, fileName || undefined);
      const matchedSupplier = findSupplierClient(clients, extracted.supplierName, extracted.supplierIco);
      setFormData(prev => ({
        ...prev,
        clientId: matchedSupplier?.id ?? prev.clientId,
        supplierInvoiceNumber: extracted.supplierInvoiceNumber ?? prev.supplierInvoiceNumber,
        issueDate: extracted.issueDate ?? prev.issueDate,
        dueDate: extracted.dueDate ?? prev.dueDate,
        currency: extracted.currency === 'EUR' || extracted.currency === 'CZK' ? extracted.currency : prev.currency,
        amount: (extracted.amount ?? prev.amount) as number,
        vatRate: extracted.vatRate ?? prev.vatRate,
        description: extracted.description ?? extracted.supplierName ?? prev.description,
      }));
      toast.success(t('create.attachment.aiExtractSuccess'));
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('create.attachment.aiExtractFailed'));
    } finally {
      setExtracting(false);
    }
  }

  function calculateVatAmount(): number {
    return Number(formData.amount) * (Number(formData.vatRate) / 100);
  }

  function calculateTotal(): number {
    return Number(formData.amount) + calculateVatAmount();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (Number(formData.amount) <= 0) {
      toast.error(t('create.validation.enterAmount'));
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
      toast.error(error.message || t('create.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  const formatCurrencyLocal = (amount: number) => {
    return formatCurrency(amount, formData.currency);
  };

  const title = isEdit ? t('create.titleEdit') : t('create.titleNew');
  const submitLabel = saving
    ? t('create.buttons.saving')
    : isEdit
      ? t('create.buttons.saveChanges')
      : t('create.buttons.createExpense');

  return (
    <div className="pb-28 lg:pb-0">
      {/* Desktop header bar */}
      <div className="hidden lg:flex items-center gap-4 -mx-7 -mt-7 mb-6 h-[60px] px-7 bg-surface border-b border-border">
        <button
          onClick={() => navigate('/expenses')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('list.title')}
        </button>
        <div className="h-4 w-px bg-border-strong" />
        <h1 className="text-base font-semibold text-text">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => navigate('/expenses')} className="btn btn-secondary">
            {t('create.buttons.cancel')}
          </button>
          <button type="submit" form="expense-form" disabled={saving} className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/expenses')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('list.title')}
        </button>
        <h1 className="text-lg font-bold tracking-[-0.02em] text-text">{title}</h1>
      </div>

      <form id="expense-form" onSubmit={handleSubmit}>
        <div className="max-w-[980px] grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-5">
          {/* Left column */}
          <div className="space-y-4">
        {/* Supplier + details */}
        <div className="card">
          <h2 className="text-[15px] font-semibold text-text mb-4">{t('create.details.title')}</h2>
          <div className="mb-4">
            <label htmlFor="clientId" className="label">{t('create.supplier.label')}</label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="input"
            >
              <option value="">{t('create.supplier.noSupplier')}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="supplierInvoiceNumber" className="label">{t('create.details.supplierInvoiceNumber')}</label>
              <input
                type="text"
                id="supplierInvoiceNumber"
                name="supplierInvoiceNumber"
                value={formData.supplierInvoiceNumber}
                onChange={handleChange}
                className="input"
                maxLength={100}
                placeholder={t('create.details.supplierInvoiceNumberPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="issueDate" className="label">{t('create.details.issueDate')}</label>
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
              <label htmlFor="dueDate" className="label">{t('create.details.dueDate')}</label>
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
              <label htmlFor="currency" className="label">{t('create.details.currency')}</label>
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
          <h2 className="text-[15px] font-semibold text-text mb-4">{t('create.amount.title')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="amount" className="label">{t('create.amount.taxBase')}</label>
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
              <label htmlFor="vatRate" className="label">{t('create.amount.vatRate')}</label>
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

          <div className="mt-4 pt-4 border-t border-hairline">
            <div className="flex flex-col items-end space-y-2">
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-[13px] text-text-muted">{t('create.amount.taxBaseLabel')}</span>
                <span className="text-sm font-medium text-text tabular-nums">{formatCurrencyLocal(Number(formData.amount))}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-[13px] text-text-muted">{t('create.amount.vatLabel', { rate: formData.vatRate })}</span>
                <span className="text-sm font-medium text-text tabular-nums">{formatCurrencyLocal(calculateVatAmount())}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs items-baseline">
                <span className="text-sm font-semibold text-text">{t('create.amount.total')}</span>
                <span className="text-xl font-bold text-accent tabular-nums">{formatCurrencyLocal(calculateTotal())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description & notes */}
        <div className="card">
          <h2 className="text-[15px] font-semibold text-text mb-3">{t('create.description.title')}</h2>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input"
            rows={2}
            maxLength={300}
            placeholder={t('create.description.placeholder')}
          />
          <p className="text-xs text-text-faint mt-1">
            {t('create.description.charCount', { count: formData.description.length })}
          </p>
          <h2 className="text-[15px] font-semibold text-text mb-3 mt-4">{t('create.notes.title')}</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
            rows={2}
            maxLength={300}
            placeholder={t('create.notes.placeholder')}
          />
          <p className="text-xs text-text-faint mt-1">
            {t('create.notes.charCount', { count: formData.notes.length })}
          </p>
        </div>

        {/* The honest flat-rate one-liner */}
        {flatRateEnabled && (
          <p className="text-xs text-text-faint px-1">{t('create.flatRateNote')}</p>
        )}
          </div>

          {/* Right column — the receipt */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint">
                  {t('create.attachment.title')}
                </h2>
                {fileName && (
                  <button
                    type="button"
                    onClick={removeFile}
                    className="flex items-center gap-1 text-[13px] text-text-muted hover:text-danger transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('create.attachment.remove')}
                  </button>
                )}
              </div>
              {fileName ? (
                <div className="space-y-3">
                  <div className="bg-[#fdfdff] border border-hairline rounded-[12px] p-3">
                    <p className="text-[11px] font-mono text-text-faint truncate mb-2">{fileName}</p>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={fileName}
                        className="w-full max-h-[300px] object-contain rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-32">
                        <Upload className="h-8 w-8 text-[#8b90a8]" />
                      </div>
                    )}
                  </div>
                  {aiStatus?.available && (
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={extracting}
                      className="w-full flex items-center justify-center gap-2 text-[13px] font-medium text-accent bg-accent-tint rounded-[10px] px-3.5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{extracting ? t('create.attachment.aiExtracting') : t('create.attachment.aiExtract')}</span>
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border-strong rounded-[16px] cursor-pointer bg-surface hover:bg-row-hover transition-colors">
                  <Upload className="h-6 w-6 text-text-faint mb-2" />
                  <p className="text-sm text-text-secondary px-4 text-center">
                    {t('create.attachment.uploadPrompt')}
                  </p>
                  <p className="text-xs text-text-faint mt-1">{t('create.attachment.fileHint')}</p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Mobile sticky total bar */}
      <div className="lg:hidden fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] z-20 px-[18px] py-2.5 bg-surface border-t border-border flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-text-muted">{t('create.amount.total')}</p>
          <p className="text-xl font-bold text-text tabular-nums leading-tight">
            {formatCurrencyLocal(calculateTotal())}
          </p>
        </div>
        <button
          type="submit"
          form="expense-form"
          disabled={saving}
          className="btn btn-primary rounded-[12px] py-3 px-6"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
