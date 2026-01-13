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

  useEffect(() => {
    loadInvoice();
  }, [id]);

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
      await api.download(`/invoices/${id}/pdf`, `faktura-${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      setMessage({ type: 'error', text: 'Nepodařilo se stáhnout PDF' });
    }
  }

  async function handleSendInvoice() {
    setSending(true);
    try {
      await api.post(`/invoices/${id}/send`, { sendToSecondary });
      setMessage({ type: 'success', text: 'Faktura byla úspěšně odeslána' });
      setShowSendModal(false);
      loadInvoice();
    } catch (error: unknown) {
      const err = error as Error;
      setMessage({ type: 'error', text: err.message || 'Nepodařilo se odeslat fakturu' });
    } finally {
      setSending(false);
    }
  }

  async function handleMarkPaid() {
    try {
      await api.post(`/invoices/${id}/mark-paid`);
      setMessage({ type: 'success', text: 'Faktura byla označena jako zaplacená' });
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
    if (!confirm('Opravdu chcete smazat tuto fakturu? Tato akce je nevratna.')) return;
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
    return <div className="text-center text-gray-500">Faktura nenalezena</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
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
              <button onClick={handleMarkPaid} className="btn btn-success flex items-center space-x-2">
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
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Odběratel</h2>
            <div className="space-y-2">
              <p className="font-medium text-gray-900">{invoice.clientName}</p>
              {invoice.clientAddress && <p className="text-gray-600">{invoice.clientAddress}</p>}
              {invoice.clientIco && <p className="text-gray-600">ICO: {invoice.clientIco}</p>}
              {invoice.clientDic && <p className="text-gray-600">DIC: {invoice.clientDic}</p>}
              <p className="text-gray-600">Email: {invoice.clientEmail}</p>
              {invoice.clientSecondaryEmail && (
                <p className="text-gray-600">Sekundární email: {invoice.clientSecondaryEmail}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Položky</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-500">Popis</th>
                    <th className="text-right py-2 font-medium text-gray-500">Množství</th>
                    <th className="text-right py-2 font-medium text-gray-500">Cena/ks</th>
                    <th className="text-right py-2 font-medium text-gray-500">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-right">{item.quantity} {item.unit}</td>
                      <td className="py-3 text-right">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.total, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Poznámky</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Dates */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Údaje</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Variabilní symbol:</dt>
                <dd className="font-medium">{invoice.variableSymbol}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Datum vystavení:</dt>
                <dd className="font-medium">{formatDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Datum splatnosti:</dt>
                <dd className="font-medium">{formatDate(invoice.dueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">DUZP:</dt>
                <dd className="font-medium">{formatDate(invoice.deliveryDate)}</dd>
              </div>
              {invoice.sentAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Odesláno:</dt>
                  <dd className="font-medium">{formatDate(invoice.sentAt)}</dd>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Zaplaceno:</dt>
                  <dd className="font-medium">{formatDate(invoice.paidAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Akce</h2>
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
              {invoice.status === 'draft' && (
                <button
                  onClick={handleDelete}
                  className="btn btn-danger w-full flex items-center justify-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Smazat fakturu</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Odeslat fakturu</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Odeslat na: <strong>{invoice.clientEmail}</strong></p>
              </div>
              {invoice.clientSecondaryEmail && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={sendToSecondary}
                    onChange={(e) => setSendToSecondary(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">
                    Odeslat take na: {invoice.clientSecondaryEmail}
                  </span>
                </label>
              )}
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
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
      )}
    </div>
  );
}
