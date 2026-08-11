import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { formatCurrency, getInitials } from '../utils/format';
import { Plus, Search, Users, Edit, Trash2, X, FilePlus, Check } from 'lucide-react';
import { PageLoader } from '../components/Spinner';

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
  invoiceCount: number;
  totalPaid: number;
  totalInvoiced: number;
  openBalance: number;
}


export default function Clients() {
  const { t } = useTranslation('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [aresLoading, setAresLoading] = useState(false);
  const [aresState, setAresState] = useState<'idle' | 'found' | 'notFound'>('idle');
  const [showSecondEmail, setShowSecondEmail] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    primaryEmail: '',
    secondaryEmail: '',
    address: '',
    ico: '',
    dic: '',
    contactPerson: '',
    contactPhone: '',
    notes: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const result = await api.get('/clients');
      setClients(result);
    } catch (error) {
      console.error('Failed to load clients:', error);
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'ico') setAresState('idle');
  }

  async function handleAresLookup() {
    if (!formData.ico || formData.ico.length !== 8) {
      toast.error(t('modal.ares.icoValidation'));
      return;
    }

    setAresLoading(true);
    setAresState('idle');
    try {
      const result = await api.get(`/ares/lookup/${formData.ico}`);
      setFormData(prev => ({
        ...prev,
        companyName: result.companyName || prev.companyName,
        address: result.address || prev.address,
        dic: result.dic || prev.dic,
      }));
      setAresState('found');
    } catch (err: unknown) {
      // Not an error state — typing the details by hand is legitimate
      setAresState('notFound');
    } finally {
      setAresLoading(false);
    }
  }

  function openCreateModal() {
    setEditingClient(null);
    setFormData({
      companyName: '',
      primaryEmail: '',
      secondaryEmail: '',
      address: '',
      ico: '',
      dic: '',
      contactPerson: '',
      contactPhone: '',
      notes: '',
    });
    setAresState('idle');
    setShowSecondEmail(false);
    setShowModal(true);
  }

  function openEditModal(client: Client) {
    setEditingClient(client);
    setFormData({
      companyName: client.companyName,
      primaryEmail: client.primaryEmail,
      secondaryEmail: client.secondaryEmail || '',
      address: client.address || '',
      ico: client.ico || '',
      dic: client.dic || '',
      contactPerson: client.contactPerson || '',
      contactPhone: client.contactPhone || '',
      notes: client.notes || '',
    });
    setAresState('idle');
    setShowSecondEmail(!!client.secondaryEmail);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, formData);
        toast.success(t('list.toast.updated'));
      } else {
        await api.post('/clients', formData);
        toast.success(t('list.toast.created'));
      }
      setShowModal(false);
      loadClients();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('list.toast.operationFailed'));
    }
  }

  async function handleDelete(client: Client) {
    if (!confirm(t('list.confirm.delete', { name: client.companyName }))) return;

    try {
      await api.delete(`/clients/${client.id}`);
      toast.success(t('list.toast.deleted'));
      loadClients();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('list.toast.deleteFailed'));
    }
  }

  const filteredClients = useMemo(
    () =>
      clients
        .filter(
          (client) =>
            client.companyName.toLowerCase().includes(search.toLowerCase()) ||
            client.primaryEmail.toLowerCase().includes(search.toLowerCase()) ||
            (client.ico && client.ico.includes(search))
        )
        // Ranked list: sorted by all-time revenue descending
        .sort((a, b) => b.totalInvoiced - a.totalInvoiced),
    [clients, search]
  );

  const totalInvoicedAll = useMemo(
    () => clients.reduce((sum, client) => sum + client.totalInvoiced, 0),
    [clients]
  );
  const maxInvoiced = filteredClients[0]?.totalInvoiced || 0;

  if (loading) {
    return <PageLoader />;
  }

  const columnHeader = 'text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint';

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('list.title')}</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t('list.summary', {
              count: clients.length,
              amount: formatCurrency(totalInvoicedAll, 'CZK'),
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              type="text"
              placeholder={t('list.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-sunken rounded-[9px] pl-9 pr-3 py-2 text-sm text-text placeholder-text-faint focus:outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,.12)]"
            />
          </div>
          <button onClick={openCreateModal} className="btn btn-primary flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>{t('list.newClient')}</span>
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className="relative sm:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
        <input
          type="text"
          placeholder={t('list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-sunken rounded-[9px] pl-9 pr-3 py-2 text-sm text-text placeholder-text-faint focus:outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,.12)]"
        />
      </div>

      {filteredClients.length > 0 ? (
        <>
          {/* Desktop: ranked table card */}
          <div className="hidden lg:block bg-surface border border-border rounded-[20px] overflow-hidden">
            <div className="grid grid-cols-[2.2fr_1.4fr_0.8fr_1.6fr_1fr_92px] gap-x-5 items-center px-5 py-2.5 border-b border-hairline">
              <span className={columnHeader}>{t('list.columnContact')}</span>
              <span className={columnHeader}>{t('list.columnPerson')}</span>
              <span className={`${columnHeader} text-right`}>{t('list.columnInvoices')}</span>
              <span className={columnHeader}>{t('list.columnRevenueShare')}</span>
              <span className={`${columnHeader} text-right`}>{t('list.columnOpen')}</span>
              <span />
            </div>
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="grid grid-cols-[2.2fr_1.4fr_0.8fr_1.6fr_1fr_92px] gap-x-5 items-center px-5 py-3 border-b border-hairline-soft last:border-b-0 hover:bg-row-hover transition-colors"
              >
                <Link to={`/clients/${client.id}`} className="flex items-center gap-3 min-w-0 group">
                  <span className="flex items-center justify-center h-8 w-8 rounded-[10px] bg-accent-soft text-accent text-xs font-semibold shrink-0">
                    {getInitials(client.companyName)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text truncate whitespace-nowrap group-hover:text-accent transition-colors">
                      {client.companyName}
                    </span>
                    {client.ico && (
                      <span className="block text-[11px] text-text-faint tabular-nums">
                        {t('list.icoLabel', { ico: client.ico })}
                      </span>
                    )}
                  </span>
                </Link>
                <span className="text-sm text-text-secondary truncate">{client.contactPerson || '—'}</span>
                <span className="text-sm text-text-secondary text-right tabular-nums">{client.invoiceCount}</span>
                <span className="flex items-center gap-3">
                  <span className="flex-1 h-1.5 rounded-full bg-hairline overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{
                        width: maxInvoiced > 0 ? `${(client.totalInvoiced / maxInvoiced) * 100}%` : '0%',
                      }}
                    />
                  </span>
                  <span className="text-[13px] text-text-secondary tabular-nums whitespace-nowrap">
                    {formatCurrency(client.totalInvoiced, 'CZK')}
                  </span>
                </span>
                <span
                  className={`text-sm text-right tabular-nums ${
                    client.openBalance > 0 ? 'text-danger font-medium' : 'text-text-faint'
                  }`}
                >
                  {formatCurrency(client.openBalance, 'CZK')}
                </span>
                <span className="flex items-center justify-end gap-1">
                  <Link
                    to={`/invoices/new?client=${client.id}`}
                    className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-nav-hover transition-colors"
                    title={t('list.newInvoiceFor')}
                  >
                    <FilePlus className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => openEditModal(client)}
                    className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-nav-hover transition-colors"
                    title={t('list.editContact')}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client)}
                    className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-nav-hover transition-colors"
                    title={t('list.deleteContact')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
            ))}
          </div>

          {/* Mobile: ranked cards */}
          <div className="lg:hidden space-y-2.5">
            {filteredClients.map((client) => (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="flex items-center gap-3 bg-surface border border-border rounded-[16px] px-4 py-3.5"
              >
                <span className="flex items-center justify-center h-[38px] w-[38px] rounded-[11px] bg-accent-soft text-accent text-[13px] font-semibold shrink-0">
                  {getInitials(client.companyName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-text truncate">
                    {client.companyName}
                  </span>
                  <span className="flex items-center gap-2 mt-1">
                    <span className="w-16 h-1.5 rounded-full bg-hairline overflow-hidden shrink-0">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{
                          width: maxInvoiced > 0 ? `${(client.totalInvoiced / maxInvoiced) * 100}%` : '0%',
                        }}
                      />
                    </span>
                    <span className="text-xs text-text-faint tabular-nums truncate">
                      {formatCurrency(client.totalInvoiced, 'CZK')}
                    </span>
                  </span>
                </span>
                <span
                  className={`text-sm text-right tabular-nums shrink-0 ${
                    client.openBalance > 0 ? 'text-danger font-medium' : 'text-text-faint'
                  }`}
                >
                  {formatCurrency(client.openBalance, 'CZK')}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <Users className="h-12 w-12 text-border-strong mx-auto mb-4" />
          <p className="text-sm text-text-muted">{t('list.empty')}</p>
          <button onClick={openCreateModal} className="btn btn-primary mt-4 inline-flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>{t('list.addFirst')}</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-[18px] shadow-[0_30px_60px_-20px_rgba(27,29,41,.35)] w-full max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-[22px] py-4 border-b border-hairline">
              <h2 className="text-[15px] font-semibold text-text">
                {editingClient ? t('modal.titleEdit') : t('modal.titleNew')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-nav-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-[22px] space-y-4">
              {/* IČO first — the register does the work */}
              <div>
                <label className="label">{t('modal.fields.ico')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      name="ico"
                      value={formData.ico}
                      onChange={handleChange}
                      className="input pr-28 tabular-nums"
                      maxLength={8}
                      placeholder={t('modal.fields.icoPlaceholder')}
                      autoFocus={!editingClient}
                    />
                    {aresState === 'found' && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 bg-success-bg text-success text-[11px] font-semibold rounded-full px-2 py-0.5">
                        <Check className="h-3 w-3" />
                        {t('modal.ares.foundInAres')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAresLookup}
                    disabled={aresLoading || formData.ico.length !== 8}
                    className="btn btn-secondary whitespace-nowrap"
                  >
                    {aresLoading ? t('modal.ares.loading') : t('modal.ares.lookup')}
                  </button>
                </div>
                {aresState === 'found' && (
                  <p className="text-xs text-text-faint mt-1.5">{t('modal.ares.filledNote')}</p>
                )}
                {aresState === 'notFound' && (
                  <p className="text-xs text-text-muted mt-1.5">{t('modal.ares.notFoundNote')}</p>
                )}
              </div>

              <div>
                <label className="label">{t('modal.fields.companyName')}</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">{t('modal.fields.primaryEmail')}</label>
                <input
                  type="email"
                  name="primaryEmail"
                  value={formData.primaryEmail}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              {showSecondEmail ? (
                <div>
                  <label className="label">{t('modal.fields.secondaryEmail')}</label>
                  <input
                    type="email"
                    name="secondaryEmail"
                    value={formData.secondaryEmail}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSecondEmail(true)}
                  className="text-[13px] font-medium text-accent-link hover:underline"
                >
                  {t('modal.fields.addSecondEmail')}
                </button>
              )}

              <div>
                <label className="label">{t('modal.fields.dic')}</label>
                <input
                  type="text"
                  name="dic"
                  value={formData.dic}
                  onChange={handleChange}
                  className="input"
                  placeholder={t('modal.fields.dicPlaceholder')}
                />
              </div>

              <div>
                <label className="label">{t('modal.fields.address')}</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('modal.fields.contactPerson')}</label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">{t('modal.fields.phone')}</label>
                  <input
                    type="text"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('modal.fields.notes')}</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="input"
                  rows={2}
                />
              </div>

            </form>

            <div className="flex items-center justify-end gap-2 px-[22px] py-3.5 bg-row-hover border-t border-hairline">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                {t('modal.buttons.cancel')}
              </button>
              <button type="submit" onClick={handleSubmit} className="btn btn-primary">
                {editingClient ? t('modal.buttons.saveChanges') : t('modal.buttons.createClient')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
