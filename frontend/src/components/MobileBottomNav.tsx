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
} from 'lucide-react';

interface MobileBottomNavProps {
  calculatorEnabled: boolean;
}

export default function MobileBottomNav({ calculatorEnabled }: MobileBottomNavProps) {
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
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


  const tabClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 py-2 min-w-[56px] min-h-[44px] ${
      active ? 'text-accent' : 'text-text-muted'
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
          <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-surface rounded-t-2xl border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
            <div className="space-y-1">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-[10px] text-sm transition-colors ${
                    isActive(item.path)
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:bg-nav-hover hover:text-text'
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
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-[10px] text-sm text-text-secondary hover:bg-nav-hover hover:text-text w-full"
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="font-medium">{t('ai.title')}</span>
                </button>
              )}
              <hr className="my-1 border-hairline" />
              {/* One-tap light/dark; the full three-way choice lives in Settings */}
              <button
                onClick={() => {
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                  setMoreOpen(false);
                }}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-[10px] text-sm text-text-secondary hover:bg-nav-hover hover:text-text w-full"
              >
                {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                <span className="font-medium">
                  {resolvedTheme === 'dark' ? t('userMenu.lightMode') : t('userMenu.darkMode')}
                </span>
              </button>
              <hr className="my-1 border-hairline" />
              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-[10px] text-sm text-danger hover:bg-nav-hover w-full"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">{t('userMenu.logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-center">
          {leftTabs.map((item) => (
            <Link key={item.path} to={item.path} className={tabClass(isActive(item.path))}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
          <div className="flex justify-center">
            <Link
              to="/invoices/new"
              aria-label={t('nav.newInvoice')}
              className="flex items-center justify-center h-11 w-11 -mt-4 rounded-[15px] bg-accent text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,.8)] hover:bg-accent-hover transition-colors"
            >
              <Plus className="h-5 w-5" />
            </Link>
          </div>
          {rightTabs.map((item) => (
            <Link key={item.path} to={item.path} className={tabClass(isActive(item.path))}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
          <button onClick={() => setMoreOpen(true)} className={tabClass(moreActive)}>
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t('nav.more')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
