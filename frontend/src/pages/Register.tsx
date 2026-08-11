import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

import ThemeToggle from '../components/ThemeToggle';
import { useTranslation } from 'react-i18next';

export default function Register() {
  const { register } = useAuth();
  const { t, i18n } = useTranslation('auth');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('register.errorPasswordMismatch'));
      return;
    }

    if (formData.password.length < 8) {
      toast.error(t('register.errorPasswordLength'));
      return;
    }

    setLoading(true);

    try {
      await register({ email: formData.email, password: formData.password, name: formData.name, language: i18n.language });
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(t(`common:errors.${error.message}`, { defaultValue: error.message }) || t('register.errorDefault'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-8 relative">
      <ThemeToggle />
      <div className="max-w-lg w-full">
        <div className="mb-7">
          <div className="mb-4">
            <img src="/favicon.svg" alt="essentialInvoice" className="h-11 w-11 rounded-[12px]" />
          </div>
          
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-text mt-5">{t('register.subtitle')}</h1>
        </div>

        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className="label">{t('register.nameLabel')}</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-auth"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="email" className="label">{t('register.emailLabel')}</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-auth"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">{t('register.passwordLabel')}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input-auth"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">{t('register.confirmPasswordLabel')}</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-auth"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-6 py-3.5 rounded-[12px]"
            >
              {loading ? t('register.submittingButton') : t('register.submitButton')}
            </button>
          </form>

          <p className="text-center text-text-muted mt-4">
            {t('register.hasAccountText')}{' '}
            <Link to="/login" className="text-accent-link hover:underline">
              {t('register.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
