import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { toast } from 'sonner';
import { Building, CreditCard, Upload, Trash2, ChevronRight, ChevronLeft, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Onboarding() {
  const { user, token, updateProfile, refreshUser } = useAuth();
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploaded, setLogoUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    companyIco: '',
    companyDic: '',
    companyAddress: '',
    vatPayer: false,
    pausalniDanEnabled: false,
    pausalniDanTier: 1,
    pausalniDanLimit: 1000000,
    bankAccount: '',
    bankCode: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = e.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormData({ ...formData, [target.name]: value });
  }

  function handleTierChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tier = parseInt(e.target.value);
    const defaultLimits: { [key: number]: number } = { 1: 1000000, 2: 1500000, 3: 2000000 };
    setFormData(prev => ({
      ...prev,
      pausalniDanTier: tier,
      pausalniDanLimit: defaultLimits[tier]
    }));
  }

  function handleNext() {
    setStep(2);
  }

  function handleBack() {
    setStep(1);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('onboarding.logoSection.errorInvalidType'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('onboarding.logoSection.errorFileSize'));
      return;
    }

    setUploadingLogo(true);

    try {
      await api.uploadFile('/auth/me/logo', file, 'logo');
      setLogoUploaded(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('onboarding.logoSection.errorUpload'));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleLogoDelete() {
    setUploadingLogo(true);

    try {
      await api.delete('/auth/me/logo');
      setLogoUploaded(false);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('onboarding.logoSection.errorDelete'));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleComplete() {
    setSaving(true);

    try {
      await updateProfile({
        ...formData,
        onboardingCompleted: true,
      } as any);
      await refreshUser();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('onboarding.errorComplete'));
    } finally {
      setSaving(false);
    }
  }

  const logoUrl = token ? `/api/auth/me/logo?token=${encodeURIComponent(token)}&v=${Date.now()}` : '';

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center py-8 px-4">
      <div className="max-w-2xl w-full">
        {/* Header — progress as bars, one decision per screen */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-5">
            <img src="/favicon.svg" alt="essentialInvoice" className="h-11 w-11 rounded-[12px]" />
            <div className="flex items-center gap-2">
              {[1, 2].map((n) => (
                <span
                  key={n}
                  className={`w-[22px] h-[3px] rounded-full ${step >= n ? 'bg-accent' : 'bg-border-strong'}`}
                />
              ))}
              <span className="ml-1 text-xs text-text-faint tabular-nums">
                {t('onboarding.stepOf', { current: step, total: 2 })}
              </span>
            </div>
          </div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-text">
            {t('onboarding.welcomeTitle', { name: user?.name })}
          </h1>
          <p className="text-sm text-text-muted mt-2">{t('onboarding.subtitle')}</p>
        </div>

        {/* Step 1: Company & Tax Info */}
        {step === 1 && (
          <div className="card space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success-bg rounded-lg">
                <Building className="h-5 w-5 text-success" />
              </div>
              <h2 className="text-lg font-semibold text-text">{t('onboarding.companySection.title')}</h2>
            </div>

            <p className="text-sm text-text-muted">
              {t('onboarding.companySection.description')}
            </p>

            <div>
              <label className="label">{t('onboarding.companySection.companyNameLabel')}</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('onboarding.companySection.icoLabel')}</label>
                <input
                  type="text"
                  name="companyIco"
                  value={formData.companyIco}
                  onChange={handleChange}
                  className="input"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="label">{t('onboarding.companySection.dicLabel')}</label>
                <input
                  type="text"
                  name="companyDic"
                  value={formData.companyDic}
                  onChange={handleChange}
                  className="input"
                  disabled={!formData.vatPayer}
                />
                {!formData.vatPayer && (
                  <p className="text-xs text-text-muted mt-1">{t('onboarding.companySection.dicDisabledHint')}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">{t('onboarding.companySection.addressLabel')}</label>
              <textarea
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleChange}
                className="input"
                rows={2}
              />
            </div>

            <div className="flex items-start space-x-3 p-4 bg-accent-tint rounded-lg border border-accent-soft">
              <input
                type="checkbox"
                id="vatPayer"
                name="vatPayer"
                checked={formData.vatPayer}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-accent border-border-strong rounded-sm focus:border-accent"
              />
              <div className="flex-1">
                <label htmlFor="vatPayer" className="text-sm font-medium text-text cursor-pointer">
                  {t('onboarding.companySection.vatPayerLabel')}
                </label>
                <p className="text-xs text-text-muted mt-1">
                  {t('onboarding.companySection.vatPayerDescription')}
                </p>
              </div>
            </div>

            {/* Paušální daň section */}
            <hr className="" />

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-text">{t('onboarding.pausalniDan.title')}</h2>
            </div>

            <p className="text-sm text-text-muted">
              {t('onboarding.pausalniDan.description')}
            </p>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="pausalniDanEnabled"
                checked={formData.pausalniDanEnabled}
                onChange={handleChange}
                className="rounded-sm border-border-strong text-accent"
              />
              <span className="text-sm text-text-muted">{t('onboarding.pausalniDan.enabledLabel')}</span>
            </label>

            {formData.pausalniDanEnabled && (
              <>
                <div>
                  <label className="label">{t('onboarding.pausalniDan.tierLabel')}</label>
                  <select
                    name="pausalniDanTier"
                    value={formData.pausalniDanTier}
                    onChange={handleTierChange}
                    className="input"
                  >
                    <option value={1}>{t('onboarding.pausalniDan.tier1')}</option>
                    <option value={2}>{t('onboarding.pausalniDan.tier2')}</option>
                    <option value={3}>{t('onboarding.pausalniDan.tier3')}</option>
                  </select>
                </div>

                <div>
                  <label className="label">{t('onboarding.pausalniDan.limitLabel')}</label>
                  <select
                    name="pausalniDanLimit"
                    value={formData.pausalniDanLimit}
                    onChange={handleChange}
                    className="input"
                  >
                    {formData.pausalniDanTier === 1 && (
                      <>
                        <option value={1000000}>{t('onboarding.pausalniDan.limit1M')}</option>
                        <option value={1500000}>{t('onboarding.pausalniDan.limit1_5M_60_80')}</option>
                        <option value={2000000}>{t('onboarding.pausalniDan.limit2M_80')}</option>
                      </>
                    )}
                    {formData.pausalniDanTier === 2 && (
                      <>
                        <option value={1500000}>{t('onboarding.pausalniDan.limit1_5M')}</option>
                        <option value={2000000}>{t('onboarding.pausalniDan.limit2M_pausal')}</option>
                      </>
                    )}
                    {formData.pausalniDanTier === 3 && (
                      <option value={2000000}>{t('onboarding.pausalniDan.limit2M')}</option>
                    )}
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary flex items-center space-x-2"
              >
                <span>{t('onboarding.nextButton')}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Bank Details & Logo */}
        {step === 2 && (
          <div className="card space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-accent-soft rounded-lg">
                <CreditCard className="h-5 w-5 text-accent" />
              </div>
              <h2 className="text-lg font-semibold text-text">{t('onboarding.bankSection.title')}</h2>
            </div>

            <p className="text-sm text-text-muted">
              {t('onboarding.bankSection.description')}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('onboarding.bankSection.accountNumberLabel')}</label>
                <input
                  type="text"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  className="input"
                  placeholder="1234567890"
                />
              </div>
              <div>
                <label className="label">{t('onboarding.bankSection.bankCodeLabel')}</label>
                <input
                  type="text"
                  name="bankCode"
                  value={formData.bankCode}
                  onChange={handleChange}
                  className="input"
                  placeholder="0100"
                  maxLength={4}
                />
              </div>
            </div>

            <hr className="" />

            <h3 className="text-md font-semibold text-text">{t('onboarding.logoSection.title')}</h3>
            <p className="text-sm text-text-muted">
              {t('onboarding.logoSection.description')}
            </p>

            <div className="flex items-start space-x-6">
              <div className="shrink-0">
                {logoUploaded || user?.hasLogo ? (
                  <img
                    src={logoUrl}
                    alt={t('onboarding.logoSection.logoAlt')}
                    className="w-48 h-24 object-contain border border-border rounded-lg bg-surface p-2"
                  />
                ) : (
                  <div className="w-48 h-24 border-2 border-dashed border-border-strong rounded-lg flex items-center justify-center bg-surface-sunken">
                    <span className="text-text-faint text-sm">{t('onboarding.logoSection.noLogo')}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <div className="flex space-x-2">
                  <label
                    htmlFor="logo-upload"
                    className={`btn btn-secondary flex items-center space-x-2 cursor-pointer ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>{uploadingLogo ? t('onboarding.logoSection.uploadingButton') : logoUploaded ? t('onboarding.logoSection.changeButton') : t('onboarding.logoSection.uploadButton')}</span>
                  </label>
                  {logoUploaded && (
                    <button
                      type="button"
                      onClick={handleLogoDelete}
                      disabled={uploadingLogo}
                      className="btn btn-danger flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{t('onboarding.logoSection.deleteButton')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t('onboarding.backButton')}</span>
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? t('onboarding.savingButton') : t('onboarding.completeButton')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
