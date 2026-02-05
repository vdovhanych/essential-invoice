import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, AlertCircle } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    companyName: '',
    companyIco: '',
    companyDic: '',
    companyAddress: '',
    bankAccount: '',
    bankCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Hesla se neshodují');
      return;
    }

    if (formData.password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků');
      return;
    }

    setLoading(true);

    try {
      await register(formData);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Registrace selhala');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">essentialInvoice</h1>
          <p className="text-gray-600 mt-2">Vytvořte si účet</p>
        </div>

        <div className="card">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-700 rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className="label">Jméno *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="email" className="label">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Heslo *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Potvrzení hesla *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
            </div>

            <hr className="my-6" />
            <h3 className="font-medium text-gray-900">Firemní údaje (volitelné)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="companyName" className="label">Název firmy</label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="companyIco" className="label">IČO</label>
                <input
                  type="text"
                  id="companyIco"
                  name="companyIco"
                  value={formData.companyIco}
                  onChange={handleChange}
                  className="input"
                  maxLength={8}
                />
              </div>

              <div>
                <label htmlFor="companyDic" className="label">DIČ</label>
                <input
                  type="text"
                  id="companyDic"
                  name="companyDic"
                  value={formData.companyDic}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="companyAddress" className="label">Adresa</label>
                <textarea
                  id="companyAddress"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                  className="input"
                  rows={2}
                />
              </div>

              <div>
                <label htmlFor="bankAccount" className="label">Číslo účtu</label>
                <input
                  type="text"
                  id="bankAccount"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  className="input"
                  placeholder="1234567890"
                />
              </div>

              <div>
                <label htmlFor="bankCode" className="label">Kód banky</label>
                <input
                  type="text"
                  id="bankCode"
                  name="bankCode"
                  value={formData.bankCode}
                  onChange={handleChange}
                  className="input"
                  placeholder="0100"
                  maxLength={4}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-6"
            >
              {loading ? 'Registruji...' : 'Registrovat se'}
            </button>
          </form>

          <p className="text-center text-gray-600 mt-4">
            Již máte účet?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              Přihlásit se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
