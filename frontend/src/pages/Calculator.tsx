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
  return { hourlyRate: 0, hoursWorked: 0, kpiBonusPercent: 0 };
}

export default function Calculator() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  // Calculator inputs - load from localStorage
  const savedValues = loadSavedValues();
  const [hourlyRate, setHourlyRate] = useState<number>(savedValues.hourlyRate);
  const [hoursWorked, setHoursWorked] = useState<number>(savedValues.hoursWorked);
  const [kpiBonusPercent, setKpiBonusPercent] = useState<number>(savedValues.kpiBonusPercent);

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
    const kpiBonusHours = (hoursWorked * kpiBonusPercent) / 100;
    const kpiBonusAmount = hourlyRate * kpiBonusHours;
    const hoursTotal = hourlyRate * hoursWorked;
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
        <div className="p-2 bg-purple-100 rounded-lg">
          <CalculatorIcon className="h-6 w-6 text-purple-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Kalkulacka castky faktury</h1>
      </div>

      {/* Input Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vstupni hodnoty</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Hodinova sazba (Kc)</label>
            <input
              type="number"
              value={hourlyRate || ''}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              className="input"
              min="0"
              step="0.01"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Odpracovane hodiny</label>
            <input
              type="number"
              value={hoursWorked || ''}
              onChange={(e) => setHoursWorked(parseFloat(e.target.value) || 0)}
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
              value={kpiBonusPercent || ''}
              onChange={(e) => setKpiBonusPercent(parseFloat(e.target.value) || 0)}
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vypoctene hodnoty</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">KPI bonus (hodiny)</span>
            <span className="font-medium">
              {calculations.kpiBonusHours.toLocaleString('cs-CZ', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} hod
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">KPI bonus (castka)</span>
            <span className="font-medium">{formatCurrency(calculations.kpiBonusAmount)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Hodiny celkem (castka)</span>
            <span className="font-medium">{formatCurrency(calculations.hoursTotal)}</span>
          </div>
          <div className="flex justify-between items-center py-3 bg-blue-50 rounded-lg px-3 -mx-3">
            <span className="font-bold text-gray-900">Celkova castka</span>
            <span className="font-bold text-xl text-blue-600">
              {formatCurrency(calculations.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
        <AlertCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600">
          <p className="font-medium mb-1">Vzorce pro vypocet:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>KPI bonus (hodiny) = Odpracovane hodiny x KPI bonus % / 100</li>
            <li>KPI bonus (castka) = Hodinova sazba x KPI bonus (hodiny)</li>
            <li>Hodiny celkem (castka) = Hodinova sazba x Odpracovane hodiny</li>
            <li>Celkova castka = Hodiny celkem + KPI bonus (castka)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
