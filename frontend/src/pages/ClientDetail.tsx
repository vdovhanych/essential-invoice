import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/format';
import { ArrowLeft, Building, Mail, Phone, FileText, MapPin, Plus } from 'lucide-react';

interface Client {
  id: string;
  companyName: string;
  primaryEmail: string;
  secondaryEmail: string | null;
  address: string;
  ico: string;
  dic: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  variableSymbol: string;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  total: number;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [clientData, invoicesData] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/clients/${id}/invoices`)
      ]);
      setClient(clientData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to load client:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!client) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Kontakt nenalezen</div>;
  }

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0);

  const pendingAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Building className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{client.companyName}</h1>
              {client.ico && <p className="text-gray-500 dark:text-gray-400">ICO: {client.ico}</p>}
            </div>
          </div>
        </div>
        <Link
          to={`/invoices/new?clientId=${client.id}`}
          className="btn btn-primary flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Nová faktura</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Kontaktní údaje</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Primární email</p>
                  <a href={`mailto:${client.primaryEmail}`} className="text-blue-600 hover:underline">
                    {client.primaryEmail}
                  </a>
                </div>
              </div>

              {client.secondaryEmail && (
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sekundární email</p>
                    <a href={`mailto:${client.secondaryEmail}`} className="text-blue-600 hover:underline">
                      {client.secondaryEmail}
                    </a>
                  </div>
                </div>
              )}

              {client.contactPerson && (
                <div className="flex items-start space-x-3">
                  <Building className="h-5 w-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Kontaktní osoba</p>
                    <p className="text-gray-900 dark:text-gray-100">{client.contactPerson}</p>
                  </div>
                </div>
              )}

              {client.contactPhone && (
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Telefon</p>
                    <a href={`tel:${client.contactPhone}`} className="text-blue-600 hover:underline">
                      {client.contactPhone}
                    </a>
                  </div>
                </div>
              )}

              {client.address && (
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Adresa</p>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{client.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {client.dic && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Daňové údaje</h2>
              <div className="space-y-2">
                {client.ico && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">ICO:</span>
                    <span className="font-medium">{client.ico}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">DIC:</span>
                  <span className="font-medium">{client.dic}</span>
                </div>
              </div>
            </div>
          )}

          {client.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Poznámky</h2>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Celkové tržby</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">K úhradě</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>

          {/* Invoice list */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Historie faktur</h2>
            {invoices.length > 0 ? (
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
                    {invoices.map(invoice => (
                      <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-600 dark:text-gray-300">{formatDate(invoice.issueDate)}</td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </td>
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
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Žádné faktury pro tento kontakt</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
