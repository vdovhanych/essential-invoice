import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import PWAUpdatePrompt from './components/PWAUpdatePrompt'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AIProvider } from './context/AIContext'
import './i18n/i18n'
import './index.css'

function ToasterWithTheme() {
  // Toasts are dark in both skins by design (§17). On mobile they sit at the top:
  // the bottom of the viewport belongs to the tab bar, and a bottom-anchored toast
  // covers its buttons. Desktop has no such conflict and keeps bottom-right.
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <Toaster
      theme="dark"
      position={isMobile ? 'top-center' : 'bottom-right'}
      offset={isMobile ? 'calc(env(safe-area-inset-top) + 16px)' : undefined}
      closeButton
      toastOptions={{
        style: {
          background: '#16181f',
          border: 'none',
          borderRadius: '12px',
          padding: '13px 16px',
          color: '#f4f5f9',
          fontSize: '14px',
          boxShadow: '0 16px 32px -16px rgba(20,22,40,.6)',
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AIProvider>
            <App />
            <PWAUpdatePrompt />
            <ToasterWithTheme />
          </AIProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('sw-update-available'));
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
});

(window as any).__updateSW = updateSW;
