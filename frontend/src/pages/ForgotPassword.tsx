import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, CheckCircle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { api } from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Nepodařilo se odeslat email pro obnovení hesla');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 relative">
      <ThemeToggle />
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">essentialInvoice</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Obnovení hesla</p>
        </div>

        <div className="card">
          {success ? (
            <div>
              <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span>Pokud účet s tímto emailem existuje, byl odeslán odkaz pro obnovení hesla.</span>
              </div>
              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">
                  Zpět na přihlášení
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Zadejte svůj email a my vám pošleme odkaz pro obnovení hesla.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full"
                >
                  {loading ? 'Odesílám...' : 'Odeslat odkaz pro obnovení'}
                </button>
              </form>

              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">
                  Zpět na přihlášení
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
