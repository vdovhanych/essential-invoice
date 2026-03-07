import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const themeOptions = [
  { value: 'light' as const, icon: Sun, label: 'Světlý' },
  { value: 'dark' as const, icon: Moon, label: 'Tmavý' },
  { value: 'system' as const, icon: Monitor, label: 'Systém' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="absolute top-4 right-4 flex items-center bg-white dark:bg-gray-800 rounded-lg p-1 shadow border border-gray-200 dark:border-gray-700">
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
  );
}
