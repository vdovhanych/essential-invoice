import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudOff } from 'lucide-react';

/**
 * Offline is a normal state for this PWA, not a failure — the copy names
 * what still works rather than just reporting the loss of connection.
 */
export default function OfflineBanner() {
  const { t } = useTranslation('common');
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 bg-[#fdf2dd] text-[#8a5a00] text-[13px]">
      <CloudOff className="h-4 w-4 shrink-0" />
      <span>{t('offline.message')}</span>
    </div>
  );
}
