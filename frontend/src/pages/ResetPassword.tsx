import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { api } from '../utils/api';
import { useTranslation } from 'react-i18next';

export default function ResetPassword() {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('resetPassword.errorPasswordMismatch'));
      return;
    }

    if (password.length < 8) {
      toast.error(t('resetPassword.errorPasswordLength'));
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(t(`common:errors.${error.message}`, { defaultValue: error.message }) || t('resetPassword.errorDefault'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 relative">
        <ThemeToggle />
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/favicon.svg" alt="essentialInvoice" className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">essentialInvoice</h1>
          </div>
          <div className="card">
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{t('resetPassword.invalidTokenMessage')}</span>
            </div>
            <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
              <Link to="/forgot-password" className="text-indigo-600 hover:underline">
                {t('resetPassword.requestNewLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
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
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('resetPassword.subtitle')}</p>
        </div>

        <div className="card">
          {success ? (
            <div>
              <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span>{t('resetPassword.successMessage')}</span>
              </div>
              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/login" className="text-indigo-600 hover:underline">
                  {t('resetPassword.loginLink')}
                </Link>
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">{t('resetPassword.newPasswordLabel')}</label>
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
                  <label htmlFor="confirmPassword" className="label">{t('resetPassword.confirmPasswordLabel')}</label>
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
                  {loading ? t('resetPassword.submittingButton') : t('resetPassword.submitButton')}
                </button>
              </form>

              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/forgot-password" className="text-indigo-600 hover:underline">
                  {t('resetPassword.requestNewLink')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
