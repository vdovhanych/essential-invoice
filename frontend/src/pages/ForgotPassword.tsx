import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 relative">
      <ThemeToggle />
      <div className="max-w-md w-full">
        <div className="mb-7">
          <div className="mb-4">
            <img src="/favicon.svg" alt="essentialInvoice" className="h-11 w-11 rounded-[12px]" />
          </div>
          
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-text mt-5">{t('forgotPassword.subtitle')}</h1>
        </div>

        <div>
          {success ? (
            <div>
              <div className="flex items-center space-x-2 p-3 bg-success-bg text-success rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span>{t('forgotPassword.successMessage')}</span>
              </div>
              <p className="text-center text-text-muted mt-4">
                <Link to="/login" className="text-accent-link hover:underline">
                  {t('forgotPassword.backToLoginLink')}
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-text-muted mb-4">
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
                    className="input-auth"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full py-3.5 rounded-[12px]"
                >
                  {loading ? t('forgotPassword.submittingButton') : t('forgotPassword.submitButton')}
                </button>
              </form>

              <p className="text-center text-text-muted mt-4">
                <Link to="/login" className="text-accent-link hover:underline">
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
