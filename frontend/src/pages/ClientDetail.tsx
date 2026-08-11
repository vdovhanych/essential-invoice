import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, getInitials } from '../utils/format';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { toast } from 'sonner';

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
  const { t } = useTranslation('clients');
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
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!client) {
    return <div className="text-center text-text-muted">{t('detail.notFound')}</div>;
  }

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0);

  const pendingAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.total, 0);

  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  return (
    <div>
      {/* Header bar */}
      <div className="hidden lg:flex items-center gap-4 -mx-7 -mt-7 mb-6 h-[60px] px-7 bg-surface border-b border-border">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('list.title')}
        </button>
        <div className="h-4 w-px bg-border-strong" />
        <span className="flex items-center justify-center h-7 w-7 rounded-[9px] bg-accent-soft text-accent text-[11px] font-semibold shrink-0">
          {getInitials(client.companyName)}
        </span>
        <h1 className="text-base font-semibold text-text">{client.companyName}</h1>
        {client.ico && (
          <span className="text-xs text-text-faint tabular-nums">{t('list.icoLabel', { ico: client.ico })}</span>
        )}
        <div className="ml-auto">
          <Link to={`/invoices/new?client=${client.id}`} className="btn btn-primary flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>{t('detail.newInvoice')}</span>
          </Link>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden space-y-3 mb-4">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('list.title')}
        </button>
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center h-[38px] w-[38px] rounded-[11px] bg-accent-soft text-accent text-[13px] font-semibold shrink-0">
            {getInitials(client.companyName)}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-[-0.02em] text-text truncate">{client.companyName}</h1>
            {client.ico && (
              <p className="text-xs text-text-faint tabular-nums">{t('list.icoLabel', { ico: client.ico })}</p>
            )}
          </div>
        </div>
        <Link to={`/invoices/new?client=${client.id}`} className="btn btn-primary w-full flex items-center justify-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('detail.newInvoice')}</span>
        </Link>
      </div>

      {/* Hero row — what this contact is worth, and what they owe */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div className="bg-surface border border-border rounded-[16px] px-4 py-3.5 min-w-0">
          <p className="text-xs text-text-muted">{t('detail.stats.totalRevenue')}</p>
          <p className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-text tabular-nums truncate">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-[16px] px-4 py-3.5 min-w-0">
          <p className="text-xs text-text-muted">{t('detail.stats.pendingAmount')}</p>
          <p
            className={`mt-1 text-[19px] font-semibold tracking-[-0.02em] tabular-nums truncate ${
              pendingAmount > 0 ? 'text-danger' : 'text-text-faint'
            }`}
          >
            {formatCurrency(pendingAmount)}
          </p>
          {overdueCount > 0 && (
            <p className="text-[11px] text-danger">{t('detail.stats.overdueCount', { count: overdueCount })}</p>
          )}
        </div>
        <div className="bg-surface border border-border rounded-[16px] px-4 py-3.5 min-w-0 col-span-2 lg:col-span-1">
          <p className="text-xs text-text-muted">{t('detail.stats.invoiceCount')}</p>
          <p className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-text tabular-nums">
            {invoices.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4 lg:gap-5">
        {/* Contact details */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-[15px] font-semibold text-text mb-4">{t('detail.contactInfo.title')}</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-text-faint">{t('detail.contactInfo.primaryEmail')}</dt>
                <dd>
                  <a href={`mailto:${client.primaryEmail}`} className="text-[13px] text-accent-link hover:underline">
                    {client.primaryEmail}
                  </a>
                </dd>
              </div>
              {client.secondaryEmail && (
                <div>
                  <dt className="text-xs text-text-faint">{t('detail.contactInfo.secondaryEmail')}</dt>
                  <dd>
                    <a href={`mailto:${client.secondaryEmail}`} className="text-[13px] text-accent-link hover:underline">
                      {client.secondaryEmail}
                    </a>
                  </dd>
                </div>
              )}
              {client.contactPerson && (
                <div>
                  <dt className="text-xs text-text-faint">{t('detail.contactInfo.contactPerson')}</dt>
                  <dd className="text-[13px] text-text-secondary">{client.contactPerson}</dd>
                </div>
              )}
              {client.contactPhone && (
                <div>
                  <dt className="text-xs text-text-faint">{t('detail.contactInfo.phone')}</dt>
                  <dd>
                    <a href={`tel:${client.contactPhone}`} className="text-[13px] text-accent-link hover:underline tabular-nums">
                      {client.contactPhone}
                    </a>
                  </dd>
                </div>
              )}
              {client.address && (
                <div>
                  <dt className="text-xs text-text-faint">{t('detail.contactInfo.address')}</dt>
                  <dd className="text-[13px] text-text-secondary whitespace-pre-wrap">{client.address}</dd>
                </div>
              )}
              {(client.ico || client.dic) && (
                <div className="pt-3 border-t border-hairline space-y-3">
                  {client.ico && (
                    <div className="flex justify-between">
                      <dt className="text-[13px] text-text-muted">{t('detail.taxInfo.ico')}</dt>
                      <dd className="text-[13px] font-medium text-text tabular-nums">{client.ico}</dd>
                    </div>
                  )}
                  {client.dic && (
                    <div className="flex justify-between">
                      <dt className="text-[13px] text-text-muted">{t('detail.taxInfo.dic')}</dt>
                      <dd className="text-[13px] font-medium text-text tabular-nums">{client.dic}</dd>
                    </div>
                  )}
                </div>
              )}
            </dl>
          </div>

          {client.notes && (
            <div className="card">
              <h2 className="text-[15px] font-semibold text-text mb-3">{t('detail.notes.title')}</h2>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="card">
          <h2 className="text-[15px] font-semibold text-text mb-3">{t('detail.invoices.title')}</h2>
          {invoices.length > 0 ? (
            <div>
              {invoices.map(invoice => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="flex items-center gap-3 py-2.5 border-b border-hairline-soft last:border-b-0 hover:bg-row-hover -mx-2 px-2 rounded-lg transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-text tabular-nums">
                      {invoice.invoiceNumber}
                    </span>
                    <span className="block text-xs text-text-faint tabular-nums">
                      {formatDate(invoice.issueDate)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-text tabular-nums shrink-0">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </span>
                  <span className={`badge shrink-0 ${getStatusColor(invoice.status)}`}>
                    {getStatusLabel(invoice.status)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-border-strong mx-auto mb-4" />
              <p className="text-sm text-text-muted">{t('detail.invoices.empty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
