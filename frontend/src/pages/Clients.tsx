import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { Plus, Search, Users, Building, Edit, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';

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
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aresLoading, setAresLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleAresLookup() {
    if (!formData.ico || formData.ico.length !== 8) {
      setMessage({ type: 'error', text: 'IČO musí mít 8 číslic' });
      return;
    }

    setAresLoading(true);
    try {
      const result = await api.get(`/ares/lookup/${formData.ico}`);
      setFormData(prev => ({
        ...prev,
        companyName: result.companyName || prev.companyName,
        address: result.address || prev.address,
        dic: result.dic || prev.dic,
      }));
      setMessage({ type: 'success', text: 'Údaje načteny z ARES' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se načíst údaje z ARES' });
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
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, formData);
        setMessage({ type: 'success', text: 'Kontakt byl aktualizován' });
      } else {
        await api.post('/clients', formData);
        setMessage({ type: 'success', text: 'Kontakt byl vytvořen' });
      }
      setShowModal(false);
      loadClients();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Operace selhala' });
    }
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Opravdu chcete smazat kontakt "${client.companyName}"?`)) return;

    try {
      await api.delete(`/clients/${client.id}`);
      setMessage({ type: 'success', text: 'Kontakt byl smazán' });
      loadClients();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se smazat kontakt' });
    }
  }

  const filteredClients = clients.filter(client =>
    client.companyName.toLowerCase().includes(search.toLowerCase()) ||
    client.primaryEmail.toLowerCase().includes(search.toLowerCase()) ||
    (client.ico && client.ico.includes(search))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kontakty</h1>
        <button onClick={openCreateModal} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Nový kontakt</span>
        </button>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Hledat kontakty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Clients grid */}
      {filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <div key={client.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <Link
                      to={`/clients/${client.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {client.companyName}
                    </Link>
                    {client.ico && (
                      <p className="text-sm text-gray-500">ICO: {client.ico}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => openEditModal(client)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">{client.primaryEmail}</p>
                {client.contactPerson && (
                  <p className="text-gray-500">Kontakt: {client.contactPerson}</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">{client.invoiceCount} faktur</span>
                <span className="font-medium text-gray-900">{formatCurrency(client.totalPaid)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Žádné kontakty nenalezeny</p>
          <button onClick={openCreateModal} className="btn btn-primary mt-4 inline-flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Přidat první kontakt</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingClient ? 'Upravit kontakt' : 'Nový kontakt'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ICO with ARES lookup */}
              <div>
                <label className="label">ICO</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    name="ico"
                    value={formData.ico}
                    onChange={handleChange}
                    className="input flex-1"
                    maxLength={8}
                    placeholder="12345678"
                  />
                  <button
                    type="button"
                    onClick={handleAresLookup}
                    disabled={aresLoading || formData.ico.length !== 8}
                    className="btn btn-secondary whitespace-nowrap"
                  >
                    {aresLoading ? 'Načítám...' : 'Načíst z ARES'}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Název firmy *</label>
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
                <label className="label">Primární email *</label>
                <input
                  type="email"
                  name="primaryEmail"
                  value={formData.primaryEmail}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Sekundární email</label>
                <input
                  type="email"
                  name="secondaryEmail"
                  value={formData.secondaryEmail}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label className="label">DIC</label>
                <input
                  type="text"
                  name="dic"
                  value={formData.dic}
                  onChange={handleChange}
                  className="input"
                  placeholder="CZ12345678"
                />
              </div>

              <div>
                <label className="label">Adresa</label>
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
                  <label className="label">Kontaktní osoba</label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Telefon</label>
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
                <label className="label">Poznámky</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Zrušit
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClient ? 'Uložit změny' : 'Vytvořit kontakt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
