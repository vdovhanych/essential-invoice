import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const languages = [
  { code: 'cs', flag: '🇨🇿', label: 'Čeština' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation('common');
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    setLangOpen(false);
  };

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('theme.light') },
    { value: 'dark' as const, icon: Moon, label: t('theme.dark') },
    { value: 'system' as const, icon: Monitor, label: t('theme.system') },
  ];

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      <div className="relative" ref={langRef}>
        <button
          type="button"
          onClick={() => setLangOpen(!langOpen)}
          className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {currentLang.flag} {currentLang.label}
          <ChevronDown className={`h-3 w-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
        </button>
        {langOpen && (
          <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 min-w-[140px]">
            {languages.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => selectLanguage(lang.code)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors ${
                  lang.code === currentLang.code
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-1 shadow border border-gray-200 dark:border-gray-700">
        {themeOptions.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`p-2 rounded-md text-xs flex items-center gap-1 transition-colors ${
              theme === value
                ? 'bg-gray-100 dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
