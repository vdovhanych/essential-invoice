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
    <div className="min-h-screen flex flex-col bg-canvas px-5 relative">
      <ThemeToggle />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[420px]">
          <img src="/favicon.svg" alt="essentialInvoice" className="h-11 w-11 rounded-[12px] mb-6" />
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-text">
            {t('login.subtitle')}
          </h1>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3.5">
            <div>
              <label htmlFor="email" className="label">{t('login.emailLabel')}</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-auth"
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
                className="input-auth"
                required
              />
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-[13px] text-accent-link hover:underline">
                {t('login.forgotPasswordLink')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3.5 rounded-[12px]"
            >
              {loading ? t('login.submittingButton') : t('login.submitButton')}
            </button>
          </form>
        </div>
      </div>

      <p className="text-center text-sm text-text-muted pb-8">
        {t('login.noAccountText')}{' '}
        <Link to="/register" className="font-medium text-accent-link hover:underline">
          {t('login.registerLink')}
        </Link>
      </p>
    </div>
  );
}
