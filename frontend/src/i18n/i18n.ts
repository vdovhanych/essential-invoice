import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import csCommon from './locales/cs/common.json';
import csDashboard from './locales/cs/dashboard.json';
import csInvoices from './locales/cs/invoices.json';
import csExpenses from './locales/cs/expenses.json';
import csClients from './locales/cs/clients.json';
import csPayments from './locales/cs/payments.json';
import csSettings from './locales/cs/settings.json';
import csProfile from './locales/cs/profile.json';
import csAuth from './locales/cs/auth.json';
import csCalculator from './locales/cs/calculator.json';

import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enInvoices from './locales/en/invoices.json';
import enExpenses from './locales/en/expenses.json';
import enClients from './locales/en/clients.json';
import enPayments from './locales/en/payments.json';
import enSettings from './locales/en/settings.json';
import enProfile from './locales/en/profile.json';
import enAuth from './locales/en/auth.json';
import enCalculator from './locales/en/calculator.json';

function getSavedLanguage(): string {
  try {
    return localStorage.getItem('language') || 'cs';
  } catch {
    return 'cs';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    cs: {
      common: csCommon,
      dashboard: csDashboard,
      invoices: csInvoices,
      expenses: csExpenses,
      clients: csClients,
      payments: csPayments,
      settings: csSettings,
      profile: csProfile,
      auth: csAuth,
      calculator: csCalculator,
    },
    en: {
      common: enCommon,
      dashboard: enDashboard,
      invoices: enInvoices,
      expenses: enExpenses,
      clients: enClients,
      payments: enPayments,
      settings: enSettings,
      profile: enProfile,
      auth: enAuth,
      calculator: enCalculator,
    },
  },
  lng: getSavedLanguage(),
  fallbackLng: 'cs',
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
