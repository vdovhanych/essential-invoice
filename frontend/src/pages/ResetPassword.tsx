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
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4 relative">
        <ThemeToggle />
        <div className="max-w-md w-full">
          <div className="mb-7">
            <div className="mb-4">
              <img src="/favicon.svg" alt="essentialInvoice" className="h-11 w-11 rounded-[12px]" />
            </div>
            
          </div>
          <div>
            <div className="flex items-center space-x-2 p-3 bg-danger-bg text-danger rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{t('resetPassword.invalidTokenMessage')}</span>
            </div>
            <p className="text-center text-text-muted mt-4">
              <Link to="/forgot-password" className="text-accent-link hover:underline">
                {t('resetPassword.requestNewLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 relative">
      <ThemeToggle />
      <div className="max-w-md w-full">
        <div className="mb-7">
          <div className="mb-4">
            <img src="/favicon.svg" alt="essentialInvoice" className="h-11 w-11 rounded-[12px]" />
          </div>
          
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-text mt-5">{t('resetPassword.subtitle')}</h1>
        </div>

        <div>
          {success ? (
            <div>
              <div className="flex items-center space-x-2 p-3 bg-success-bg text-success rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span>{t('resetPassword.successMessage')}</span>
              </div>
              <p className="text-center text-text-muted mt-4">
                <Link to="/login" className="text-accent-link hover:underline">
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
                    className="input-auth"
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
                    className="input-auth"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full py-3.5 rounded-[12px]"
                >
                  {loading ? t('resetPassword.submittingButton') : t('resetPassword.submitButton')}
                </button>
              </form>

              <p className="text-center text-text-muted mt-4">
                <Link to="/forgot-password" className="text-accent-link hover:underline">
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
