import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { PageLoader } from '../components/Spinner';
import { toast } from 'sonner';

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
  const { t } = useTranslation('calculator');
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
        // Straight to the switch that turns it back on
        navigate('/settings/calculator');
        return;
      }
      setEnabled(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error(t('common:errors.loadFailed'));
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
    return <PageLoader />;
  }

  if (!enabled) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-[900px] space-y-5">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">{t('title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 lg:gap-5">
        {/* Inputs */}
        <div className="card">
          <h2 className="text-[15px] font-semibold text-text mb-4">{t('inputs.heading')}</h2>
          <div className="space-y-3">
            <div>
              <label className="label">{t('inputs.hourlyRate')}</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="input text-right tabular-nums"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">{t('inputs.hoursWorked')}</label>
              <input
                type="number"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="input text-right tabular-nums"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">{t('inputs.kpiBonusPercent')}</label>
              <input
                type="number"
                value={kpiBonusPercent}
                onChange={(e) => setKpiBonusPercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="input text-right tabular-nums"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
              />
            </div>
          </div>

          {/* Formulas — a quiet footnote, not a boxed alert */}
          <div className="mt-4 pt-4 border-t border-hairline">
            <p className="text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint mb-2">
              {t('formulas.heading')}
            </p>
            <ul className="space-y-1 text-xs text-text-faint">
              <li>{t('formulas.kpiBonusHours')}</li>
              <li>{t('formulas.kpiBonusAmount')}</li>
              <li>{t('formulas.hoursTotal')}</li>
              <li>{t('formulas.grandTotal')}</li>
            </ul>
          </div>
        </div>

        {/* Results — the total is the hero */}
        <div className="card">
          <h2 className="text-[15px] font-semibold text-text mb-4">{t('results.heading')}</h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-baseline">
              <dt className="text-[13px] text-text-muted">{t('results.kpiBonusHours')}</dt>
              <dd className="text-sm text-text tabular-nums">
                {calculations.kpiBonusHours.toLocaleString('cs-CZ', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })} {t('results.hoursUnit')}
              </dd>
            </div>
            <div className="flex justify-between items-baseline">
              <dt className="text-[13px] text-text-muted">{t('results.kpiBonusAmount')}</dt>
              <dd className="text-sm text-text tabular-nums">{formatCurrency(calculations.kpiBonusAmount)}</dd>
            </div>
            <div className="flex justify-between items-baseline">
              <dt className="text-[13px] text-text-muted">{t('results.hoursTotal')}</dt>
              <dd className="text-sm text-text tabular-nums">{formatCurrency(calculations.hoursTotal)}</dd>
            </div>
            <div className="flex justify-between items-baseline pt-3 border-t border-hairline">
              <dt className="text-sm font-semibold text-text">{t('results.grandTotal')}</dt>
              <dd className="text-[28px] leading-tight font-bold tracking-[-0.02em] text-accent tabular-nums">
                {formatCurrency(calculations.grandTotal)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
