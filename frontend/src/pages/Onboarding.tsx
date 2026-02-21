import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { FileText, Building, CreditCard, AlertCircle, Upload, Trash2, ChevronRight, ChevronLeft, Landmark } from 'lucide-react';

export default function Onboarding() {
  const { user, token, updateProfile, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
    setStep(2);
  }

  function handleBack() {
    setError('');
    setStep(1);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('Pouze PNG, JPG a SVG soubory jsou povoleny');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Maximální velikost souboru je 2 MB');
      return;
    }

    setUploadingLogo(true);
    setError('');

    try {
      await api.uploadFile('/auth/me/logo', file, 'logo');
      setLogoUploaded(true);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Nepodařilo se nahrát logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleLogoDelete() {
    setUploadingLogo(true);
    setError('');

    try {
      await api.delete('/auth/me/logo');
      setLogoUploaded(false);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Nepodařilo se smazat logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    setError('');

    try {
      await updateProfile({
        ...formData,
        onboardingCompleted: true,
      } as any);
      await refreshUser();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Nepodařilo se dokončit nastavení');
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
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vítejte, {user?.name}!</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Nastavte si svůj profil pro fakturaci</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 1 ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <span className="hidden sm:inline">Firemní údaje</span>
            </div>
            <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />
            <div className={`flex items-center space-x-2 ${step === 2 ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                2
              </div>
              <span className="hidden sm:inline">Bankovní údaje</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Company & Tax Info */}
        {step === 1 && (
          <div className="card space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Building className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Firemní a daňové údaje</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tyto údaje se budou zobrazovat na vašich fakturách.
            </p>

            <div>
              <label className="label">Název firmy</label>
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
                <label className="label">IČO</label>
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
                <label className="label">DIČ</label>
                <input
                  type="text"
                  name="companyDic"
                  value={formData.companyDic}
                  onChange={handleChange}
                  className="input"
                  disabled={!formData.vatPayer}
                />
                {!formData.vatPayer && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">DIČ není potřeba pro neplátce DPH</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Adresa</label>
              <textarea
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleChange}
                className="input"
                rows={2}
              />
            </div>

            <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <input
                type="checkbox"
                id="vatPayer"
                name="vatPayer"
                checked={formData.vatPayer}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="vatPayer" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                  Jsem plátce DPH
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Pokud nejste plátce DPH, na fakturách se zobrazí "Neplátce DPH" místo DIČ
                </p>
              </div>
            </div>

            {/* Paušální daň section */}
            <hr className="dark:border-gray-700" />

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Paušální daň</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sledujte, kolik můžete ještě fakturovat v rámci limitu paušální daně.
            </p>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="pausalniDanEnabled"
                checked={formData.pausalniDanEnabled}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Používám paušální daň</span>
            </label>

            {formData.pausalniDanEnabled && (
              <>
                <div>
                  <label className="label">Pásmo paušální daně</label>
                  <select
                    name="pausalniDanTier"
                    value={formData.pausalniDanTier}
                    onChange={handleTierChange}
                    className="input"
                  >
                    <option value={1}>1. pásmo (9 984 Kč/měsíc)</option>
                    <option value={2}>2. pásmo (16 745 Kč/měsíc)</option>
                    <option value={3}>3. pásmo (27 139 Kč/měsíc)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Limit příjmů</label>
                  <select
                    name="pausalniDanLimit"
                    value={formData.pausalniDanLimit}
                    onChange={handleChange}
                    className="input"
                  >
                    {formData.pausalniDanTier === 1 && (
                      <>
                        <option value={1000000}>1 000 000 Kč (základní)</option>
                        <option value={1500000}>1 500 000 Kč (75% OSVČ, paušál 60%/80%)</option>
                        <option value={2000000}>2 000 000 Kč (75% OSVČ, paušál 80%)</option>
                      </>
                    )}
                    {formData.pausalniDanTier === 2 && (
                      <>
                        <option value={1500000}>1 500 000 Kč (základní)</option>
                        <option value={2000000}>2 000 000 Kč (75% OSVČ s paušálem)</option>
                      </>
                    )}
                    {formData.pausalniDanTier === 3 && (
                      <option value={2000000}>2 000 000 Kč</option>
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
                <span>Další</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Bank Details & Logo */}
        {step === 2 && (
          <div className="card space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bankovní údaje</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Bankovní účet pro příjem plateb za faktury.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Číslo účtu</label>
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
                <label className="label">Kód banky</label>
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

            <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">Logo firmy (volitelné)</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Logo se zobrazí na vašich fakturách. Podporované formáty: PNG, JPG, SVG. Max. velikost: 2 MB.
            </p>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                {logoUploaded || user?.hasLogo ? (
                  <img
                    src={logoUrl}
                    alt="Logo firmy"
                    className="w-48 h-24 object-contain border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 p-2"
                  />
                ) : (
                  <div className="w-48 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-400 text-sm">Žádné logo</span>
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
                    <span>{uploadingLogo ? 'Nahrávám...' : logoUploaded ? 'Změnit logo' : 'Nahrát logo'}</span>
                  </label>
                  {logoUploaded && (
                    <button
                      type="button"
                      onClick={handleLogoDelete}
                      disabled={uploadingLogo}
                      className="btn btn-danger flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Smazat</span>
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
                <span>Zpět</span>
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Ukládám...' : 'Dokončit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
