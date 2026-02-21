import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Calculator as CalculatorIcon, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/format';

const STORAGE_KEY = 'calculator_values';

function loadSavedValues() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load calculator values:', e);
  }
  return { hourlyRate: '', hoursWorked: '', kpiBonusPercent: '' };
}

export default function Calculator() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  // Calculator inputs - load from localStorage
  const savedValues = loadSavedValues();
  const [hourlyRate, setHourlyRate] = useState<number | string>(savedValues.hourlyRate);
  const [hoursWorked, setHoursWorked] = useState<number | string>(savedValues.hoursWorked);
  const [kpiBonusPercent, setKpiBonusPercent] = useState<number | string>(savedValues.kpiBonusPercent);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      hourlyRate,
      hoursWorked,
      kpiBonusPercent
    }));
  }, [hourlyRate, hoursWorked, kpiBonusPercent]);

  useEffect(() => {
    checkCalculatorEnabled();
  }, []);

  async function checkCalculatorEnabled() {
    try {
      const settings = await api.get('/settings');
      if (!settings.calculatorEnabled) {
        navigate('/settings');
        return;
      }
      setEnabled(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  // Real-time calculations using useMemo
  const calculations = useMemo(() => {
    const rate = Number(hourlyRate) || 0;
    const hours = Number(hoursWorked) || 0;
    const bonus = Number(kpiBonusPercent) || 0;
    const kpiBonusHours = (hours * bonus) / 100;
    const kpiBonusAmount = rate * kpiBonusHours;
    const hoursTotal = rate * hours;
    const grandTotal = hoursTotal + kpiBonusAmount;

    return {
      kpiBonusHours,
      kpiBonusAmount,
      hoursTotal,
      grandTotal
    };
  }, [hourlyRate, hoursWorked, kpiBonusPercent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!enabled) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <CalculatorIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kalkulačka fakturace</h1>
      </div>

      {/* Input Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vstupní hodnoty</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Hodinová sazba</label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input"
              min="0"
              step="0.01"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Odpracované hodiny</label>
            <input
              type="number"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input"
              min="0"
              step="0.01"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">KPI bonus (%)</label>
            <input
              type="number"
              value={kpiBonusPercent}
              onChange={(e) => setKpiBonusPercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input"
              min="0"
              max="100"
              step="0.1"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vypočtené hodnoty</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300">KPI bonus (hodiny)</span>
            <span className="font-medium">
              {calculations.kpiBonusHours.toLocaleString('cs-CZ', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} hod
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300">KPI bonus (částka)</span>
            <span className="font-medium">{formatCurrency(calculations.kpiBonusAmount)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300">Hodiny celkem (částka)</span>
            <span className="font-medium">{formatCurrency(calculations.hoursTotal)}</span>
          </div>
          <div className="flex justify-between items-center py-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg px-3 -mx-3">
            <span className="font-bold text-gray-900 dark:text-gray-100">Celková částka</span>
            <span className="font-bold text-xl text-blue-600">
              {formatCurrency(calculations.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <AlertCircle className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <p className="font-medium mb-1">Vzorce pro vypocet:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>KPI bonus (hodiny) = Odpracované hodiny x KPI bonus % / 100</li>
            <li>KPI bonus (částka) = Hodinová sazba x KPI bonus (hodiny)</li>
            <li>Hodiny celkem (částka) = Hodinová sazba x Odpracované hodiny</li>
            <li>Celková částka = Hodiny celkem + KPI bonus (částka)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
