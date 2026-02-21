import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import {
  ArrowLeft,
  Download,
  Send,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  variableSymbol: string;
  status: string;
  currency: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientSecondaryEmail: string | null;
  clientAddress: string;
  clientIco: string;
  clientDic: string;
  issueDate: string;
  dueDate: string;
  deliveryDate: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes: string;
  sentAt: string | null;
  paidAt: string | null;
  items: InvoiceItem[];
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendToSecondary, setSendToSecondary] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    subject: string;
    emailBody: string;
    pdfBase64: string;
    recipients: { primary: string; secondary: string | null };
  } | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [paidDate, setPaidDate] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [id]);

  useEffect(() => {
    if (showSendModal && id) {
      loadPreview();
    }
  }, [showSendModal, id]);

  async function loadPreview() {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const result = await api.get(`/invoices/${id}/preview`);
      setPreviewData(result);
      setCustomMessage(result.emailBody);
      setSecondaryEmail(result.recipients.secondary || '');
      setSendToSecondary(!!result.recipients.secondary);
    } catch (error) {
      console.error('Failed to load preview:', error);
      setMessage({ type: 'error', text: 'Nepodařilo se načíst náhled' });
      setShowSendModal(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadInvoice() {
    try {
      const result = await api.get(`/invoices/${id}`);
      setInvoice(result);
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!invoice) return;
    try {
      await api.download(`/invoices/${id}/pdf`, `${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se stáhnout PDF' });
    }
  }

  async function handleSendInvoice() {
    setSending(true);
    try {
      await api.post(`/invoices/${id}/send`, {
        sendToSecondary: sendToSecondary && secondaryEmail.trim() !== '',
        secondaryEmail: sendToSecondary && secondaryEmail.trim() !== '' ? secondaryEmail.trim() : undefined,
        customMessage: customMessage !== previewData?.emailBody ? customMessage : undefined
      });
      setMessage({ type: 'success', text: 'Faktura byla úspěšně odeslána' });
      setShowSendModal(false);
      setPreviewData(null);
      loadInvoice();
    } catch (error: unknown) {
      const err = error as Error;
      setMessage({ type: 'error', text: err.message || 'Nepodařilo se odeslat fakturu' });
    } finally {
      setSending(false);
    }
  }

  function openMarkPaidModal() {
    if (!invoice) return;
    setPaidDate(invoice.dueDate);
    setShowMarkPaidModal(true);
  }

  async function handleMarkPaid() {
    try {
      await api.post(`/invoices/${id}/mark-paid`, { paidAt: paidDate });
      setMessage({ type: 'success', text: 'Faktura byla označena jako zaplacená' });
      setShowMarkPaidModal(false);
      loadInvoice();
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se označit fakturu jako zaplacenou' });
    }
  }

  async function handleCancel() {
    if (!confirm('Opravdu chcete zrušit tuto fakturu?')) return;
    try {
      await api.post(`/invoices/${id}/cancel`);
      setMessage({ type: 'success', text: 'Faktura byla zrušena' });
      loadInvoice();
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se zrušit fakturu' });
    }
  }

  async function handleDelete() {
    if (!confirm('Opravdu chcete smazat tuto fakturu? Tato akce je nevratná.')) return;
    try {
      await api.delete(`/invoices/${id}`);
      navigate('/invoices');
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se smazat fakturu' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Faktura nenalezena</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Faktura {invoice.invoiceNumber}
            </h1>
            <span className={`badge ${getStatusColor(invoice.status)}`}>
              {getStatusLabel(invoice.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleDownloadPDF} className="btn btn-secondary flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>PDF</span>
          </button>
          {invoice.status === 'draft' && (
            <>
              <Link to={`/invoices/${id}/edit`} className="btn btn-secondary flex items-center space-x-2">
                <Edit className="h-4 w-4" />
                <span>Upravit</span>
              </Link>
              <button onClick={() => setShowSendModal(true)} className="btn btn-primary flex items-center space-x-2">
                <Send className="h-4 w-4" />
                <span>Odeslat</span>
              </button>
            </>
          )}
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <>
              <button onClick={() => setShowSendModal(true)} className="btn btn-secondary flex items-center space-x-2">
                <Send className="h-4 w-4" />
                <span>Odeslat znovu</span>
              </button>
              <button onClick={openMarkPaidModal} className="btn btn-success flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Zaplaceno</span>
              </button>
            </>
          )}
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

      {/* Invoice details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Odběratel</h2>
            <div className="space-y-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{invoice.clientName}</p>
              {invoice.clientAddress && <p className="text-gray-600 dark:text-gray-300">{invoice.clientAddress}</p>}
              {invoice.clientIco && <p className="text-gray-600 dark:text-gray-300">ICO: {invoice.clientIco}</p>}
              {invoice.clientDic && <p className="text-gray-600 dark:text-gray-300">DIC: {invoice.clientDic}</p>}
              <p className="text-gray-600 dark:text-gray-300">Email: {invoice.clientEmail}</p>
              {invoice.clientSecondaryEmail && (
                <p className="text-gray-600 dark:text-gray-300">Sekundární email: {invoice.clientSecondaryEmail}</p>
              )}
            </div>
          </div>

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
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-right">{item.quantity} {item.unit}</td>
                      <td className="py-3 text-right">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.total, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={3} className="py-2 text-right font-medium">Základ daně:</td>
                    <td className="py-2 text-right">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-2 text-right font-medium">DPH ({invoice.vatRate}%):</td>
                    <td className="py-2 text-right">{formatCurrency(invoice.vatAmount, invoice.currency)}</td>
                  </tr>
                  <tr className="text-lg">
                    <td colSpan={3} className="py-2 text-right font-bold">Celkem:</td>
                    <td className="py-2 text-right font-bold text-blue-600">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Poznámky</h2>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Dates */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Údaje</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Variabilní symbol:</dt>
                <dd className="font-medium">{invoice.variableSymbol}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Datum vystavení:</dt>
                <dd className="font-medium">{formatDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Datum splatnosti:</dt>
                <dd className="font-medium">{formatDate(invoice.dueDate)}</dd>
              </div>
              {invoice.sentAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Odesláno:</dt>
                  <dd className="font-medium">{formatDate(invoice.sentAt)}</dd>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Zaplaceno:</dt>
                  <dd className="font-medium">{formatDate(invoice.paidAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Akce</h2>
            <div className="space-y-2">
              {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary w-full flex items-center justify-center space-x-2"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Zrušit fakturu</span>
                </button>
              )}
              <button
                onClick={handleDelete}
                className="btn btn-danger w-full flex items-center justify-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Smazat fakturu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Send preview modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Náhled a odeslání faktury
              </h2>
              <button
                onClick={() => { setShowSendModal(false); setPreviewData(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={sending}
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            {previewLoading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : previewData ? (
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* PDF Preview */}
                <div className="lg:w-1/2 p-4 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-auto">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Náhled PDF</h3>
                  <object
                    data={`data:application/pdf;base64,${previewData.pdfBase64}`}
                    type="application/pdf"
                    className="w-full h-[400px] lg:h-[calc(100%-2rem)] rounded border border-gray-200 dark:border-gray-700"
                  >
                    <p className="p-4 text-gray-500 dark:text-gray-400 text-center">
                      Váš prohlížeč nepodporuje zobrazení PDF.{' '}
                      <a
                        href={`data:application/pdf;base64,${previewData.pdfBase64}`}
                        download={`${invoice.invoiceNumber}.pdf`}
                        className="text-blue-600 hover:underline"
                      >
                        Stáhnout PDF
                      </a>
                    </p>
                  </object>
                </div>

                {/* Email Editor */}
                <div className="lg:w-1/2 p-4 flex flex-col overflow-auto">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">E-mail</h3>

                  {/* Subject */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Předmět</label>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      {previewData.subject}
                    </div>
                  </div>

                  {/* Recipients */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Primární e-mail</label>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      {previewData.recipients.primary}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm text-gray-500 dark:text-gray-400">Sekundární e-mail</label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sendToSecondary}
                          onChange={(e) => setSendToSecondary(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Odeslat</span>
                      </label>
                    </div>
                    <input
                      type="email"
                      value={secondaryEmail}
                      onChange={(e) => setSecondaryEmail(e.target.value)}
                      className="input"
                      placeholder="sekundarni@email.cz"
                    />
                  </div>

                  {/* Message */}
                  <div className="flex-1 flex flex-col mb-4">
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Zpráva</label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="input flex-1 min-h-[200px] resize-none"
                      placeholder="Text e-mailu..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => { setShowSendModal(false); setPreviewData(null); }}
                      className="btn btn-secondary"
                      disabled={sending}
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleSendInvoice}
                      className="btn btn-primary flex items-center space-x-2"
                      disabled={sending}
                    >
                      <Send className="h-4 w-4" />
                      <span>{sending ? 'Odesílám...' : 'Odeslat'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Mark as paid modal */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Označit fakturu jako zaplacenou
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Datum zaplacení
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Výchozí datum je datum splatnosti faktury
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMarkPaidModal(false)}
                className="btn btn-secondary"
              >
                Zrušit
              </button>
              <button
                onClick={handleMarkPaid}
                className="btn btn-success flex items-center space-x-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Potvrdit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
