import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8 relative">
      <ThemeToggle />
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">essentialInvoice</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('register.subtitle')}</p>
        </div>

        <div className="card">
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
                  className="input"
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
                  className="input"
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
                  className="input"
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
                  className="input"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-6"
            >
              {loading ? t('register.submittingButton') : t('register.submitButton')}
            </button>
          </form>

          <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
            {t('register.hasAccountText')}{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              {t('register.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
