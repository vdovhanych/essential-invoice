import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, CheckCircle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { api } from '../utils/api';
import { useTranslation } from 'react-i18next';

export default function ForgotPassword() {
  const { t } = useTranslation('auth');
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
      toast.error(t(`common:errors.${error.message}`, { defaultValue: error.message }) || t('forgotPassword.errorDefault'));
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
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('forgotPassword.subtitle')}</p>
        </div>

        <div className="card">
          {success ? (
            <div>
              <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span>{t('forgotPassword.successMessage')}</span>
              </div>
              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">
                  {t('forgotPassword.backToLoginLink')}
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('forgotPassword.description')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">{t('forgotPassword.emailLabel')}</label>
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
                  {loading ? t('forgotPassword.submittingButton') : t('forgotPassword.submitButton')}
                </button>
              </form>

              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">
                  {t('forgotPassword.backToLoginLink')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
