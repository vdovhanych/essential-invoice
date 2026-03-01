import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Hesla se neshodují');
      return;
    }

    if (password.length < 8) {
      toast.error('Heslo musí mít alespoň 8 znaků');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Nepodařilo se obnovit heslo');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <FileText className="h-12 w-12 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">essentialInvoice</h1>
          </div>
          <div className="card">
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>Neplatný odkaz pro obnovení hesla.</span>
            </div>
            <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
              <Link to="/forgot-password" className="text-blue-600 hover:underline">
                Požádat o nový odkaz
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">essentialInvoice</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Nastavení nového hesla</p>
        </div>

        <div className="card">
          {success ? (
            <div>
              <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span>Heslo bylo úspěšně změněno.</span>
              </div>
              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">
                  Přihlásit se
                </Link>
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">Nové heslo</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="label">Potvrzení hesla</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full"
                >
                  {loading ? 'Ukládám...' : 'Nastavit nové heslo'}
                </button>
              </form>

              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/forgot-password" className="text-blue-600 hover:underline">
                  Požádat o nový odkaz
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
