import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

import ThemeToggle from '../components/ThemeToggle';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(t(`common:errors.${error.message}`, { defaultValue: error.message }) || t('login.errorDefault'));
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
            <img src="/favicon.svg" alt="essentialInvoice" className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">essentialInvoice</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('login.subtitle')}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">{t('login.emailLabel')}</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">{t('login.passwordLabel')}</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
                {t('login.forgotPasswordLink')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? t('login.submittingButton') : t('login.submitButton')}
            </button>
          </form>

          <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
            {t('login.noAccountText')}{' '}
            <Link to="/register" className="text-indigo-600 hover:underline">
              {t('login.registerLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
