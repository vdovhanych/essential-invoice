import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Mail, Server, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface Settings {
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPasswordSet: boolean;
  smtpSecure: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  imapHost: string | null;
  imapPort: number;
  imapUser: string | null;
  imapPasswordSet: boolean;
  imapTls: boolean;
  bankNotificationEmail: string | null;
  emailPollingInterval: number;
  invoiceNumberPrefix: string;
  invoiceNumberFormat: string;
  defaultVatRate: number;
  defaultPaymentTerms: number;
  emailTemplate: string | null;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'smtp' | 'imap' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState({ smtp: false, imap: false });

  const [formData, setFormData] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: true,
    smtpFromEmail: '',
    smtpFromName: '',
    imapHost: '',
    imapPort: 993,
    imapUser: '',
    imapPassword: '',
    imapTls: true,
    bankNotificationEmail: '',
    emailPollingInterval: 300,
    invoiceNumberPrefix: '',
    defaultVatRate: 21,
    defaultPaymentTerms: 14,
    emailTemplate: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const result = await api.get('/settings');
      setSettings(result);
      setFormData({
        smtpHost: result.smtpHost || '',
        smtpPort: result.smtpPort || 587,
        smtpUser: result.smtpUser || '',
        smtpPassword: '',
        smtpSecure: result.smtpSecure ?? true,
        smtpFromEmail: result.smtpFromEmail || '',
        smtpFromName: result.smtpFromName || '',
        imapHost: result.imapHost || '',
        imapPort: result.imapPort || 993,
        imapUser: result.imapUser || '',
        imapPassword: '',
        imapTls: result.imapTls ?? true,
        bankNotificationEmail: result.bankNotificationEmail || '',
        emailPollingInterval: result.emailPollingInterval || 300,
        invoiceNumberPrefix: result.invoiceNumberPrefix || '',
        defaultVatRate: result.defaultVatRate || 21,
        defaultPaymentTerms: result.defaultPaymentTerms || 14,
        emailTemplate: result.emailTemplate || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const numericFields = ['smtpPort', 'imapPort', 'emailPollingInterval', 'defaultVatRate', 'defaultPaymentTerms'];

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              (type === 'number' || numericFields.includes(name)) ? parseInt(value) || 0 : value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.put('/settings', formData);
      setMessage({ type: 'success', text: 'Nastavení bylo uloženo' });
      loadSettings();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se uložit nastavení' });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(type: 'smtp' | 'imap') {
    setTesting(type);
    setMessage(null);

    try {
      await api.post(`/settings/test-${type}`);
      setMessage({ type: 'success', text: `${type.toUpperCase()} připojení je funkční` });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || `Test ${type.toUpperCase()} selhal` });
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nastavení</h1>

      {/* Message */}
      {message && (
        <div className={`flex items-center space-x-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SMTP Settings */}
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Odesílání emailů (SMTP)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP server</label>
              <input
                type="text"
                name="smtpHost"
                value={formData.smtpHost}
                onChange={handleChange}
                className="input"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="label">Port</label>
              <input
                type="number"
                name="smtpPort"
                value={formData.smtpPort}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="label">Uživatel</label>
              <input
                type="text"
                name="smtpUser"
                value={formData.smtpUser}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="label">Heslo {settings?.smtpPasswordSet && '(nastaveno)'}</label>
              <div className="relative">
                <input
                  type={showPasswords.smtp ? 'text' : 'password'}
                  name="smtpPassword"
                  value={formData.smtpPassword}
                  onChange={handleChange}
                  className="input pr-10"
                  placeholder={settings?.smtpPasswordSet ? '••••••••' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(p => ({ ...p, smtp: !p.smtp }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.smtp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Email odesilatele</label>
              <input
                type="email"
                name="smtpFromEmail"
                value={formData.smtpFromEmail}
                onChange={handleChange}
                className="input"
                placeholder="faktury@example.com"
              />
            </div>
            <div>
              <label className="label">Jmeno odesilatele</label>
              <input
                type="text"
                name="smtpFromName"
                value={formData.smtpFromName}
                onChange={handleChange}
                className="input"
                placeholder="Moje Firma s.r.o."
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="smtpSecure"
                checked={formData.smtpSecure}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-600">Použít TLS/SSL</span>
            </label>
            <button
              type="button"
              onClick={() => testConnection('smtp')}
              disabled={testing === 'smtp' || !formData.smtpHost}
              className="btn btn-secondary"
            >
              {testing === 'smtp' ? 'Testuji...' : 'Otestovat připojení'}
            </button>
          </div>
        </div>

        {/* IMAP Settings */}
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Server className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Přijímání emailů (IMAP)</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Nastavte IMAP pro automatické načítání bankovních notifikací o platbách.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">IMAP server</label>
              <input
                type="text"
                name="imapHost"
                value={formData.imapHost}
                onChange={handleChange}
                className="input"
                placeholder="imap.example.com"
              />
            </div>
            <div>
              <label className="label">Port</label>
              <input
                type="number"
                name="imapPort"
                value={formData.imapPort}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="label">Uživatel</label>
              <input
                type="text"
                name="imapUser"
                value={formData.imapUser}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="label">Heslo {settings?.imapPasswordSet && '(nastaveno)'}</label>
              <div className="relative">
                <input
                  type={showPasswords.imap ? 'text' : 'password'}
                  name="imapPassword"
                  value={formData.imapPassword}
                  onChange={handleChange}
                  className="input pr-10"
                  placeholder={settings?.imapPasswordSet ? '••••••••' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(p => ({ ...p, imap: !p.imap }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.imap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Email bankovních notifikací (volitelné)</label>
              <input
                type="email"
                name="bankNotificationEmail"
                value={formData.bankNotificationEmail}
                onChange={handleChange}
                className="input"
                placeholder="noreply@airbank.cz"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pokud vyplníte, budou se načítat pouze emaily od této adresy
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="imapTls"
                checked={formData.imapTls}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-600">Použít TLS</span>
            </label>
            <button
              type="button"
              onClick={() => testConnection('imap')}
              disabled={testing === 'imap' || !formData.imapHost}
              className="btn btn-secondary"
            >
              {testing === 'imap' ? 'Testuji...' : 'Otestovat připojení'}
            </button>
          </div>
        </div>

        {/* Invoice defaults */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Výchozí hodnoty faktur</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Výchozí sazba DPH (%)</label>
              <select
                name="defaultVatRate"
                value={formData.defaultVatRate}
                onChange={handleChange}
                className="input"
              >
                <option value={0}>0%</option>
                <option value={12}>12%</option>
                <option value={21}>21%</option>
              </select>
            </div>
            <div>
              <label className="label">Výchozí splatnost (dny)</label>
              <input
                type="number"
                name="defaultPaymentTerms"
                value={formData.defaultPaymentTerms}
                onChange={handleChange}
                className="input"
                min={1}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Prefix čísla faktury</label>
              <input
                type="text"
                name="invoiceNumberPrefix"
                value={formData.invoiceNumberPrefix}
                onChange={handleChange}
                className="input"
                placeholder="Např. FV, INV"
              />
            </div>
          </div>
        </div>

        {/* Email template */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Šablona emailu</h2>
          <p className="text-sm text-gray-500 mb-4">
            Použijte proměnné: {'{{invoiceNumber}}'}, {'{{total}}'}, {'{{dueDate}}'}, {'{{clientName}}'}, {'{{senderName}}'}
          </p>
          <textarea
            name="emailTemplate"
            value={formData.emailTemplate}
            onChange={handleChange}
            className="input"
            rows={6}
            placeholder={`Dobrý den,

v příloze zasíláme fakturu č. {{invoiceNumber}} na částku {{total}}.

Datum splatnosti: {{dueDate}}

Děkujeme za spolupráci.

S pozdravem,
{{senderName}}`}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Ukládám...' : 'Uložit nastavení'}
          </button>
        </div>
      </form>
    </div>
  );
}
