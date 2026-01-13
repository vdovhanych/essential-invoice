import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { User, Building, AlertCircle, CheckCircle } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      setMessage({ type: 'success', text: 'Profil byl aktualizovan' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodarilo se aktualizovat profil' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Hesla se neshoduji' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Heslo musi mit alespon 8 znaku' });
      return;
    }

    setChangingPassword(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setMessage({ type: 'success', text: 'Heslo bylo zmeneno' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodarilo se zmenit heslo' });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Muj profil</h1>

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
          <h2 className="text-lg font-semibold text-gray-900">Osobni udaje</h2>
        </div>

        <div>
          <label className="label">Jmeno *</label>
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
          <p className="text-xs text-gray-500 mt-1">Email nelze zmenit</p>
        </div>

        <hr />

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Building className="h-5 w-5 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Firemni udaje</h2>
        </div>

        <p className="text-sm text-gray-500">
          Tyto udaje se budou zobrazovat na vasich fakturach.
        </p>

        <div>
          <label className="label">Nazev firmy</label>
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
            <label className="label">Cislo uctu</label>
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
            {saving ? 'Ukladam...' : 'Ulozit zmeny'}
          </button>
        </div>
      </form>

      {/* Password change */}
      <form onSubmit={handlePasswordSubmit} className="card space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Zmena hesla</h2>

        <div>
          <label className="label">Soucasne heslo</label>
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
          <label className="label">Nove heslo</label>
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
          <label className="label">Potvrzeni noveho hesla</label>
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
            {changingPassword ? 'Menim heslo...' : 'Zmenit heslo'}
          </button>
        </div>
      </form>
    </div>
  );
}
