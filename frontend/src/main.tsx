import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AIProvider } from './context/AIContext'
import './i18n/i18n'
import './index.css'

function ToasterWithTheme() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} richColors position="top-right" closeButton />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AIProvider>
            <App />
            <ToasterWithTheme />
          </AIProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
