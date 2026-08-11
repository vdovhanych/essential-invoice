import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { Mail, Server, Eye, EyeOff, Calculator, Sparkles, FileText } from 'lucide-react';
import { PageLoader } from '../components/Spinner';

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
  calculatorEnabled: boolean;
  aiEnabled: boolean;
  aiApiKeySet: boolean;
  aiApiUrl: string | null;
  aiModel: string | null;
}

type SectionKey = 'invoiceDefaults' | 'emailSending' | 'bankMatching' | 'ai' | 'calculator';

const SECTIONS: Array<{ key: SectionKey; icon: typeof Mail; headingKey: string; descriptionKey: string }> = [
  { key: 'invoiceDefaults', icon: FileText, headingKey: 'invoiceDefaults.heading', descriptionKey: 'invoiceDefaults.description' },
  { key: 'emailSending', icon: Mail, headingKey: 'smtp.heading', descriptionKey: 'smtp.description' },
  { key: 'bankMatching', icon: Server, headingKey: 'imap.heading', descriptionKey: 'imap.description' },
  { key: 'ai', icon: Sparkles, headingKey: 'ai.heading', descriptionKey: 'ai.description' },
  { key: 'calculator', icon: Calculator, headingKey: 'calculator.heading', descriptionKey: 'calculator.description' },
];

export default function Settings() {
  const { t } = useTranslation('settings');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'smtp' | 'imap' | null>(null);
  const [showPasswords, setShowPasswords] = useState({ smtp: false, imap: false, ai: false });
  const [section, setSection] = useState<SectionKey>('invoiceDefaults');

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
    calculatorEnabled: false,
    aiEnabled: true,
    aiApiKey: '',
    aiApiUrl: '',
    aiModel: '',
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
        smtpPort: result.smtpPort ?? 587,
        smtpUser: result.smtpUser || '',
        smtpPassword: '',
        smtpSecure: result.smtpSecure ?? true,
        smtpFromEmail: result.smtpFromEmail || '',
        smtpFromName: result.smtpFromName || '',
        imapHost: result.imapHost || '',
        imapPort: result.imapPort ?? 993,
        imapUser: result.imapUser || '',
        imapPassword: '',
        imapTls: result.imapTls ?? true,
        bankNotificationEmail: result.bankNotificationEmail || '',
        emailPollingInterval: result.emailPollingInterval ?? 300,
        invoiceNumberPrefix: result.invoiceNumberPrefix || '',
        defaultVatRate: result.defaultVatRate ?? 21,
        defaultPaymentTerms: result.defaultPaymentTerms ?? 14,
        emailTemplate: result.emailTemplate || '',
        calculatorEnabled: result.calculatorEnabled ?? false,
        aiEnabled: result.aiEnabled ?? true,
        aiApiKey: '',
        aiApiUrl: result.aiApiUrl || '',
        aiModel: result.aiModel || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error(t('common:errors.loadFailed'));
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
              (type === 'number' || numericFields.includes(name)) ? (value === '' ? '' : parseInt(value)) : value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put('/settings', formData);
      toast.success(t('toast.saveSuccess'));
      loadSettings();
      window.dispatchEvent(new Event('settings-updated'));
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(type: 'smtp' | 'imap') {
    setTesting(type);

    try {
      await api.post(`/settings/test-${type}`);
      toast.success(t(`${type}.testSuccess`));
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t(`${type}.testFailed`));
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  const activeSection = SECTIONS.find(s => s.key === section)!;

  const passwordField = (
    name: 'smtpPassword' | 'imapPassword' | 'aiApiKey',
    toggleKey: 'smtp' | 'imap' | 'ai',
    isSet: boolean | undefined,
    placeholder?: string
  ) => (
    <div className="relative">
      <input
        type={showPasswords[toggleKey] ? 'text' : 'password'}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        className="input pr-10"
        placeholder={isSet ? '••••••••' : placeholder || ''}
      />
      <button
        type="button"
        onClick={() => setShowPasswords(p => ({ ...p, [toggleKey]: !p[toggleKey] }))}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-faint hover:text-text-secondary"
      >
        {showPasswords[toggleKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const toggleRow = (name: 'smtpSecure' | 'imapTls' | 'aiEnabled' | 'calculatorEnabled', label: string, description?: string) => (
    <div className="flex items-center justify-between gap-5 py-1">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        {description && <p className="text-xs text-text-faint mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          name={name}
          checked={formData[name] as boolean}
          onChange={handleChange}
          className="sr-only peer"
        />
        <span className="w-[34px] h-5 bg-border-strong rounded-full peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-3.5" />
      </label>
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('title')}</h1>

      {/* Mobile section chips */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map(({ key, icon: Icon, headingKey }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              section === key
                ? 'bg-accent text-white'
                : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(headingKey)}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-6 lg:items-start">
        {/* Secondary nav — surface-sunken active state, deliberately not indigo */}
        <nav className="hidden lg:block space-y-1">
          {SECTIONS.map(({ key, icon: Icon, headingKey }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm transition-colors text-left ${
                section === key
                  ? 'bg-surface-sunken text-text font-medium'
                  : 'text-text-secondary hover:bg-nav-hover hover:text-text'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(headingKey)}
            </button>
          ))}
        </nav>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          {/* Page head */}
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em] text-text">{t(activeSection.headingKey)}</h2>
            <p className="mt-1 text-[13px] text-text-muted">{t(activeSection.descriptionKey)}</p>
          </div>

          {section === 'invoiceDefaults' && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('invoiceDefaults.vatRate')}</label>
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
                  <p className="text-xs text-text-faint mt-1">{t('invoiceDefaults.vatRateHelp')}</p>
                </div>
                <div>
                  <label className="label">{t('invoiceDefaults.paymentTerms')}</label>
                  <input
                    type="number"
                    name="defaultPaymentTerms"
                    value={formData.defaultPaymentTerms}
                    onChange={handleChange}
                    className="input tabular-nums"
                    min={1}
                  />
                  <p className="text-xs text-text-faint mt-1">{t('invoiceDefaults.paymentTermsHelp')}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="label">{t('invoiceDefaults.invoiceNumberPrefix')}</label>
                  <input
                    type="text"
                    name="invoiceNumberPrefix"
                    value={formData.invoiceNumberPrefix}
                    onChange={handleChange}
                    className="input font-mono"
                    placeholder={t('invoiceDefaults.invoiceNumberPrefixPlaceholder')}
                  />
                </div>
              </div>
            </div>
          )}

          {section === 'emailSending' && (
            <>
              <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('smtp.server')}</label>
                    <input
                      type="text"
                      name="smtpHost"
                      value={formData.smtpHost}
                      onChange={handleChange}
                      className="input"
                      placeholder={t('smtp.serverPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="label">{t('smtp.port')}</label>
                    <input
                      type="number"
                      name="smtpPort"
                      value={formData.smtpPort}
                      onChange={handleChange}
                      className="input tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="label">{t('smtp.user')}</label>
                    <input
                      type="text"
                      name="smtpUser"
                      value={formData.smtpUser}
                      onChange={handleChange}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{t('smtp.password')} {settings?.smtpPasswordSet && t('smtp.passwordSet')}</label>
                    {passwordField('smtpPassword', 'smtp', settings?.smtpPasswordSet)}
                  </div>
                  <div>
                    <label className="label">{t('smtp.fromEmail')}</label>
                    <input
                      type="email"
                      name="smtpFromEmail"
                      value={formData.smtpFromEmail}
                      onChange={handleChange}
                      className="input"
                      placeholder={t('smtp.fromEmailPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="label">{t('smtp.fromName')}</label>
                    <input
                      type="text"
                      name="smtpFromName"
                      value={formData.smtpFromName}
                      onChange={handleChange}
                      className="input"
                      placeholder={t('smtp.fromNamePlaceholder')}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between gap-4">
                  <div className="flex-1">{toggleRow('smtpSecure', t('smtp.useTls'))}</div>
                  <button
                    type="button"
                    onClick={() => testConnection('smtp')}
                    disabled={testing === 'smtp' || !formData.smtpHost}
                    className="btn btn-secondary shrink-0"
                  >
                    {testing === 'smtp' ? t('smtp.testing') : t('smtp.testConnection')}
                  </button>
                </div>
              </div>

              <div className="card">
                <h3 className="text-[15px] font-semibold text-text mb-1">{t('emailTemplate.heading')}</h3>
                <p className="text-[13px] text-text-muted mb-3">{t('emailTemplate.variablesHelp')}</p>
                <textarea
                  name="emailTemplate"
                  value={formData.emailTemplate}
                  onChange={handleChange}
                  className="input"
                  rows={6}
                  placeholder={t('emailTemplate.placeholder')}
                />
              </div>
            </>
          )}

          {section === 'bankMatching' && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('imap.server')}</label>
                  <input
                    type="text"
                    name="imapHost"
                    value={formData.imapHost}
                    onChange={handleChange}
                    className="input"
                    placeholder={t('imap.serverPlaceholder')}
                  />
                </div>
                <div>
                  <label className="label">{t('imap.port')}</label>
                  <input
                    type="number"
                    name="imapPort"
                    value={formData.imapPort}
                    onChange={handleChange}
                    className="input tabular-nums"
                  />
                </div>
                <div>
                  <label className="label">{t('imap.user')}</label>
                  <input
                    type="text"
                    name="imapUser"
                    value={formData.imapUser}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">{t('imap.password')} {settings?.imapPasswordSet && t('imap.passwordSet')}</label>
                  {passwordField('imapPassword', 'imap', settings?.imapPasswordSet)}
                </div>
                <div className="md:col-span-2">
                  <label className="label">{t('imap.bankNotificationEmail')}</label>
                  <input
                    type="email"
                    name="bankNotificationEmail"
                    value={formData.bankNotificationEmail}
                    onChange={handleChange}
                    className="input"
                    placeholder={t('imap.bankNotificationEmailPlaceholder')}
                  />
                  <p className="text-xs text-text-faint mt-1">{t('imap.bankNotificationEmailHelp')}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between gap-4">
                <div className="flex-1">{toggleRow('imapTls', t('imap.useTls'))}</div>
                <button
                  type="button"
                  onClick={() => testConnection('imap')}
                  disabled={testing === 'imap' || !formData.imapHost}
                  className="btn btn-secondary shrink-0"
                >
                  {testing === 'imap' ? t('imap.testing') : t('imap.testConnection')}
                </button>
              </div>
            </div>
          )}

          {section === 'ai' && (
            <div className="card space-y-4">
              {toggleRow('aiEnabled', t('ai.enableAi'))}
              <div className="pt-4 border-t border-hairline space-y-4">
                <div>
                  <label className="label">{t('ai.apiKeyLabel')} {settings?.aiApiKeySet && t('ai.apiKeySet')}</label>
                  {passwordField('aiApiKey', 'ai', settings?.aiApiKeySet, t('ai.apiKeyPlaceholder'))}
                  <p className="text-xs text-text-faint mt-1">
                    {t('ai.apiKeyHelp')}{' '}
                    <a
                      href="https://openrouter.ai/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-link hover:underline"
                    >
                      {t('ai.apiKeyLink')}
                    </a>
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('ai.apiUrlLabel')}</label>
                    <input
                      type="text"
                      name="aiApiUrl"
                      value={formData.aiApiUrl}
                      onChange={handleChange}
                      className="input font-mono"
                      placeholder="https://openrouter.ai/api/v1"
                    />
                    <p className="text-xs text-text-faint mt-1">{t('ai.apiUrlHelp')}</p>
                  </div>
                  <div>
                    <label className="label">{t('ai.modelLabel')}</label>
                    <input
                      type="text"
                      name="aiModel"
                      value={formData.aiModel}
                      onChange={handleChange}
                      className="input font-mono"
                      placeholder="openai/gpt-5.6-luna"
                    />
                    <p className="text-xs text-text-faint mt-1">{t('ai.modelHelp')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'calculator' && (
            <div className="card">
              {toggleRow('calculatorEnabled', t('calculator.enable'), t('calculator.description'))}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? t('actions.saving') : t('actions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
