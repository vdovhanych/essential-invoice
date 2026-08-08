import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAI } from '../context/AIContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  Plus,
  MoreHorizontal,
  CreditCard,
  Settings,
  Receipt,
  Calculator,
  User,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

interface MobileBottomNavProps {
  calculatorEnabled: boolean;
}

export default function MobileBottomNav({ calculatorEnabled }: MobileBottomNavProps) {
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { aiStatus, openAssistant } = useAI();
  const { t } = useTranslation('common');
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const leftTabs = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/invoices', icon: FileText, label: t('nav.invoices') },
  ];

  const rightTabs = [
    { path: '/clients', icon: Users, label: t('nav.clients') },
  ];

  const moreItems = [
    { path: '/expenses', icon: Receipt, label: t('nav.expenses') },
    { path: '/payments', icon: CreditCard, label: t('nav.payments') },
    ...(calculatorEnabled ? [{ path: '/calculator', icon: Calculator, label: t('nav.calculator') }] : []),
    { path: '/settings', icon: Settings, label: t('nav.settings') },
    { path: '/profile', icon: User, label: t('userMenu.profile') },
  ];

  const moreActive = moreItems.some((item) => isActive(item.path));

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('theme.light') },
    { value: 'dark' as const, icon: Moon, label: t('theme.dark') },
    { value: 'system' as const, icon: Monitor, label: t('theme.system') },
  ];

  const tabClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 py-2 ${
      active
        ? 'text-indigo-600 dark:text-indigo-400'
        : 'text-gray-500 dark:text-gray-400'
    }`;

  return (
    <>
      {/* More bottom sheet */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white dark:bg-gray-800 rounded-t-2xl border-t border-gray-200 dark:border-gray-700 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="space-y-1">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
              {aiStatus?.available && (
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    openAssistant();
                  }}
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 w-full"
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="font-medium">{t('ai.title')}</span>
                </button>
              )}
              <hr className="my-1 dark:border-gray-700" />
              <div className="px-3 py-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('userMenu.appearance')}</p>
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  {themeOptions.map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-md transition-colors ${
                        theme === value
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
              <hr className="my-1 dark:border-gray-700" />
              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">{t('userMenu.logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-center">
          {leftTabs.map((item) => (
            <Link key={item.path} to={item.path} className={tabClass(isActive(item.path))}>
              <item.icon className="h-6 w-6" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          ))}
          <div className="flex justify-center">
            <Link
              to="/invoices/new"
              aria-label={t('nav.newInvoice')}
              className="flex items-center justify-center h-12 w-12 -mt-4 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-6 w-6" />
            </Link>
          </div>
          {rightTabs.map((item) => (
            <Link key={item.path} to={item.path} className={tabClass(isActive(item.path))}>
              <item.icon className="h-6 w-6" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          ))}
          <button onClick={() => setMoreOpen(true)} className={tabClass(moreActive)}>
            <MoreHorizontal className="h-6 w-6" />
            <span className="text-[11px] font-medium">{t('nav.more')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
