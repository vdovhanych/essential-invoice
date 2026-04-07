import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function PWAUpdatePrompt() {
  const { t } = useTranslation('common');
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      toast(t('pwa.updateAvailable'), {
        duration: Infinity,
        action: {
          label: t('pwa.reload'),
          onClick: () => {
            (window as any).__updateSW?.(true);
          },
        },
      });
    };

    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    window.addEventListener('sw-update-available', handleUpdateAvailable);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [t]);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm py-1.5 font-medium">
      {t('pwa.offline')}
    </div>
  );
}
