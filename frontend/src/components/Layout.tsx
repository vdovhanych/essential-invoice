import { useState, useEffect, Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AIAssistant from './AIAssistant';
import CommandPalette from './CommandPalette';
import MobileBottomNav from './MobileBottomNav';
import OfflineBanner from './OfflineBanner';
import ErrorBoundary from './ErrorBoundary';
import { PageLoader } from './Spinner';
import { api } from '../utils/api';
import { getInitials } from '../utils/format';
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Calculator,
  Receipt,
  Sun,
  Moon,
  Monitor,
  Search
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('common');
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [calculatorEnabled, setCalculatorEnabled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  // ⌘K / Ctrl+K opens the command palette anywhere
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    async function checkCalculatorEnabled() {
      try {
        const settings = await api.get('/settings');
        setCalculatorEnabled(settings.calculatorEnabled ?? false);
      } catch (error) {
        console.error('Failed to check calculator setting:', error);
      }
    }
    checkCalculatorEnabled();

    const handleSettingsUpdate = () => checkCalculatorEnabled();
    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, []);

  // Unmatched payments drive the sidebar badge; re-checked as the user moves around
  useEffect(() => {
    api
      .get('/dashboard')
      .then((data) => setUnmatchedCount(data?.unmatchedPayments ?? 0))
      .catch(() => setUnmatchedCount(0));
  }, [location.pathname]);

  // Build nav items dynamically based on calculator setting
  const baseNavItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/invoices', icon: FileText, label: t('nav.invoices') },
    { path: '/expenses', icon: Receipt, label: t('nav.expenses') },
    { path: '/clients', icon: Users, label: t('nav.clients') },
    { path: '/payments', icon: CreditCard, label: t('nav.payments'), badge: unmatchedCount },
  ];

  const navItems = [
    ...baseNavItems,
    ...(calculatorEnabled ? [{ path: '/calculator', icon: Calculator, label: t('nav.calculator') }] : []),
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('theme.light') },
    { value: 'dark' as const, icon: Moon, label: t('theme.dark') },
    { value: 'system' as const, icon: Monitor, label: t('theme.system') },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <OfflineBanner />

      {/* Sidebar (desktop only; mobile uses the bottom tab bar) */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 z-50 h-full w-[216px] bg-surface border-r border-border">
        <div className="flex items-center h-[60px] px-5 shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="essentialInvoice" className="h-6 w-6 rounded-[7px]" />
            <span className="text-[15px] font-semibold text-text">essentialInvoice</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-nav-hover hover:text-text'
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span className="flex-1 font-medium">{item.label}</span>
                {'badge' in item && !!item.badge && (
                  <span
                    className={`text-[11px] font-semibold rounded-full px-1.5 min-w-[20px] text-center tabular-nums ${
                      isActive ? 'bg-white/[.22] text-white' : 'bg-surface-sunken text-text-muted'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User — anchored to the bottom of the sidebar */}
        <div className="relative shrink-0 border-t border-hairline p-3">
          <button
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[10px] hover:bg-nav-hover transition-colors"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-accent-soft text-accent text-[11px] font-semibold shrink-0">
              {user?.name ? getInitials(user.name) : <User className="h-3.5 w-3.5" />}
            </span>
            <span className="flex-1 min-w-0 text-sm font-medium text-text-secondary truncate text-left">
              {user?.name}
            </span>
            <ChevronDown className={`h-4 w-4 text-text-faint shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              {/* Opens upward — there is no room below in the sidebar */}
              <div className="absolute bottom-full left-3 right-3 mb-1 bg-surface rounded-xl shadow-lg border border-border py-1 z-50">
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:bg-nav-hover hover:text-text"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  <span>{t('userMenu.profile')}</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:bg-nav-hover hover:text-text"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  <span>{t('nav.settings')}</span>
                </Link>
                <hr className="my-1 border-hairline" />
                <div className="px-4 py-2">
                  <p className="text-xs text-text-muted mb-2">{t('userMenu.appearance')}</p>
                  <div className="flex items-center bg-surface-sunken rounded-[9px] p-[3px]">
                    {themeOptions.map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-[7px] transition-colors ${
                          theme === value
                            ? 'bg-surface shadow-[0_1px_2px_rgba(20,22,40,.08)] text-text'
                            : 'text-text-faint hover:text-text-secondary'
                        }`}
                        title={label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="my-1 border-hairline" />
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-danger hover:bg-nav-hover w-full"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('userMenu.logout')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-[216px] overflow-x-hidden">
        {/* Header (desktop only; mobile navigation lives in the bottom tab bar) */}
        <header className="hidden lg:block sticky top-0 z-30 bg-surface border-b border-border">
          <div className="flex items-center h-[60px] px-5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 text-text-faint hover:text-text-secondary text-[13px] transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>{t('nav.search')}</span>
              <span className="ml-1 border border-border rounded px-1.5 py-px text-[10px] font-mono leading-4">
                ⌘K
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-[18px] lg:p-7 pb-24 lg:pb-7">
          {/* Keyed on the route so navigating away clears a page-level failure */}
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* AI Assistant */}
        <AIAssistant />
      </div>

      {/* ⌘K command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Mobile bottom navigation */}
      <MobileBottomNav calculatorEnabled={calculatorEnabled} />
    </div>
  );
}
