import { useRef, useState } from 'react';
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

  /* Drag-to-dismiss for the More sheet. The grabber promises the gesture, so the
     sheet has to follow the finger and close on a deliberate pull. Downward only
     — dragging up would leave a gap above the sheet. */
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);

  /* A pull past this closes outright; a shorter one still closes if it was
     flicked rather than crept, which is how the platform sheets behave. */
  const DISMISS_DISTANCE = 88;
  const FLICK_DISTANCE = 32;
  const FLICK_VELOCITY = 0.5; // px per ms

  function openMore() {
    setDragY(0);
    dragStart.current = null;
    setMoreOpen(true);
  }

  function closeMore() {
    setDragY(0);
    dragStart.current = null;
    setMoreOpen(false);
  }

  function handleDragStart(e: React.TouchEvent) {
    dragStart.current = { y: e.touches[0].clientY, t: Date.now() };
  }

  function handleDragMove(e: React.TouchEvent) {
    if (!dragStart.current) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current.y));
  }

  function handleDragEnd() {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const elapsed = Math.max(1, Date.now() - start.t);
    const velocity = dragY / elapsed;
    if (dragY > DISMISS_DISTANCE || (dragY > FLICK_DISTANCE && velocity > FLICK_VELOCITY)) {
      closeMore();
    } else {
      setDragY(0);
    }
  }

  const dragging = dragStart.current !== null;

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
    // No Profile entry — the settings index is the single way into it on mobile
    { path: '/settings', icon: Settings, label: t('nav.settings') },
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
            className="fixed inset-0 bg-black z-40 lg:hidden"
            /* The scrim lightens as the sheet is pulled away, so the gesture
               reads as dismissing rather than just moving something. */
            style={{
              opacity: Math.max(0, 0.5 - dragY / 600),
              transition: dragging ? 'none' : 'opacity 200ms ease-out',
            }}
            onClick={closeMore}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-surface rounded-t-2xl border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onTouchCancel={handleDragEnd}
            style={{
              transform: `translateY(${dragY}px)`,
              transition: dragging ? 'none' : 'transform 200ms ease-out',
              /* Without this the drag scrolls the page behind the sheet. Nothing
                 inside the sheet scrolls, so there is no gesture to give up. */
              touchAction: 'none',
            }}
          >
            <button
              type="button"
              onClick={closeMore}
              aria-label={t('buttons.close')}
              className="block mx-auto mb-3 py-2 -mt-2 px-6"
            >
              <span className="block h-1 w-10 rounded-full bg-border-strong" />
            </button>
            <div className="space-y-1">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMore}
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
                    closeMore();
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
                  closeMore();
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
                  closeMore();
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
        <div className="grid grid-cols-5 items-center h-(--mobile-nav-height)">
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
          <button onClick={openMore} className={tabClass(moreActive)}>
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t('nav.more')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
