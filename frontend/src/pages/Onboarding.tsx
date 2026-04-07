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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-8 px-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/favicon.svg" alt="essentialInvoice" className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('onboarding.welcomeTitle', { name: user?.name })}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('onboarding.subtitle')}</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 1 ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 1 ? 'bg-indigo-600 text-white' : step > 1 ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <span className="hidden sm:inline">{t('onboarding.step1Label')}</span>
            </div>
            <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />
            <div className={`flex items-center space-x-2 ${step === 2 ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                2
              </div>
              <span className="hidden sm:inline">{t('onboarding.step2Label')}</span>
            </div>
          </div>
        </div>

        {/* Step 1: Company & Tax Info */}
        {step === 1 && (
          <div className="card space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Building className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.companySection.title')}</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('onboarding.companySection.dicDisabledHint')}</p>
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

            <div className="flex items-start space-x-3 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <input
                type="checkbox"
                id="vatPayer"
                name="vatPayer"
                checked={formData.vatPayer}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div className="flex-1">
                <label htmlFor="vatPayer" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                  {t('onboarding.companySection.vatPayerLabel')}
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t('onboarding.companySection.vatPayerDescription')}
                </p>
              </div>
            </div>

            {/* Paušální daň section */}
            <hr className="dark:border-gray-700" />

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.pausalniDan.title')}</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('onboarding.pausalniDan.description')}
            </p>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="pausalniDanEnabled"
                checked={formData.pausalniDanEnabled}
                onChange={handleChange}
                className="rounded border-gray-300 text-indigo-600"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.pausalniDan.enabledLabel')}</span>
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
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.bankSection.title')}</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
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

            <hr className="dark:border-gray-700" />

            <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.logoSection.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('onboarding.logoSection.description')}
            </p>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                {logoUploaded || user?.hasLogo ? (
                  <img
                    src={logoUrl}
                    alt={t('onboarding.logoSection.logoAlt')}
                    className="w-48 h-24 object-contain border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 p-2"
                  />
                ) : (
                  <div className="w-48 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-400 text-sm">{t('onboarding.logoSection.noLogo')}</span>
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
