import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { User, Building, AlertCircle, CheckCircle, Upload, Trash2, Image } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    companyName: user?.companyName || '',
    companyIco: user?.companyIco || '',
    companyDic: user?.companyDic || '',
    companyAddress: user?.companyAddress || '',
    bankAccount: user?.bankAccount || '',
    bankCode: user?.bankCode || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateProfile(formData);
      setMessage({ type: 'success', text: 'Profil byl aktualizován' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se aktualizovat profil' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Hesla se neshodují' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Heslo musí mít alespoň 8 znaků' });
      return;
    }

    setChangingPassword(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setMessage({ type: 'success', text: 'Heslo bylo změněno' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se změnit heslo' });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Pouze PNG, JPG a SVG soubory jsou povoleny' });
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Maximální velikost souboru je 2 MB' });
      return;
    }

    setUploadingLogo(true);
    setMessage(null);

    try {
      await api.uploadFile('/auth/me/logo', file, 'logo');
      await refreshUser();
      setMessage({ type: 'success', text: 'Logo bylo nahráno' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se nahrát logo' });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleLogoDelete() {
    if (!confirm('Opravdu chcete smazat logo?')) return;

    setUploadingLogo(true);
    setMessage(null);

    try {
      await api.delete('/auth/me/logo');
      await refreshUser();
      setMessage({ type: 'success', text: 'Logo bylo smazáno' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se smazat logo' });
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Můj profil</h1>

      {/* Message */}
      {message && (
        <div className={`flex items-center space-x-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile form */}
      <form onSubmit={handleSubmit} className="card space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Osobní údaje</h2>
        </div>

        <div>
          <label className="label">Jméno *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            className="input bg-gray-50"
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">Email nelze změnit</p>
        </div>

        <hr />

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Building className="h-5 w-5 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Firemní údaje</h2>
        </div>

        <p className="text-sm text-gray-500">
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
            <label className="label">ICO</label>
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
            <label className="label">DIC</label>
            <input
              type="text"
              name="companyDic"
              value={formData.companyDic}
              onChange={handleChange}
              className="input"
            />
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
            <label className="label">Kod banky</label>
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

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Ukládám...' : 'Uložit změny'}
          </button>
        </div>
      </form>

      {/* Logo upload */}
      <div className="card space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Image className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Logo firmy</h2>
        </div>

        <p className="text-sm text-gray-500">
          Logo se zobrazí na vašich fakturách místo firemních údajů v záhlaví. Podporované formáty: PNG, JPG, SVG. Max. velikost: 2 MB.
        </p>

        <div className="flex items-start space-x-6">
          {/* Logo preview */}
          <div className="flex-shrink-0">
            {user?.logoUrl ? (
              <div className="relative">
                <img
                  src={`/api${user.logoUrl}`}
                  alt="Logo firmy"
                  className="w-48 h-24 object-contain border border-gray-200 rounded-lg bg-white p-2"
                />
              </div>
            ) : (
              <div className="w-48 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                <span className="text-gray-400 text-sm">Žádné logo</span>
              </div>
            )}
          </div>

          {/* Upload controls */}
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
                <span>{uploadingLogo ? 'Nahrávám...' : user?.logoUrl ? 'Změnit logo' : 'Nahrát logo'}</span>
              </label>
              {user?.logoUrl && (
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
            <p className="text-xs text-gray-500">
              Doporučená velikost: 200x80 pixelů
            </p>
          </div>
        </div>
      </div>

      {/* Password change */}
      <form onSubmit={handlePasswordSubmit} className="card space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Změna hesla</h2>

        <div>
          <label className="label">Současné heslo</label>
          <input
            type="password"
            name="currentPassword"
            value={passwordData.currentPassword}
            onChange={handlePasswordChange}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label">Nové heslo</label>
          <input
            type="password"
            name="newPassword"
            value={passwordData.newPassword}
            onChange={handlePasswordChange}
            className="input"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="label">Potvrzení nového hesla</label>
          <input
            type="password"
            name="confirmPassword"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
            className="input"
            required
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={changingPassword} className="btn btn-primary">
            {changingPassword ? 'Měním heslo...' : 'Změnit heslo'}
          </button>
        </div>
      </form>
    </div>
  );
}
