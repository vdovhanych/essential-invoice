import { useTranslation } from 'react-i18next';
export interface ExpenseTaxBucket {
  rate: number;
  base: number;
  tax: number;
}
export default function ExpenseVatEditor({
  buckets,
  onChange,
}: {
  buckets: ExpenseTaxBucket[];
  onChange: (b: ExpenseTaxBucket[]) => void;
}) {
  const { t } = useTranslation('vat');
  return (
    <fieldset className="space-y-3">
      <legend className="label">{t('breakdown')}</legend>
      <p className="text-sm text-text-muted">{t('recordedHint')}</p>
      {buckets.map((b, i) => (
        <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['rate', 'base', 'tax'] as const).map((k) => (
            <label key={k} className="label">
              {t(k)} {i + 1}
              <input
                className="input mt-1 tabular-nums"
                type="number"
                min="0"
                step="0.01"
                required
                value={b[k]}
                onChange={(e) =>
                  onChange(
                    buckets.map((v, n) =>
                      n === i ? { ...v, [k]: Number(e.target.value) } : v,
                    ),
                  )
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="btn btn-secondary self-end"
            disabled={buckets.length === 1}
            onClick={() => onChange(buckets.filter((_, n) => n !== i))}
          >
            {t('remove')}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onChange([...buckets, { rate: 21, base: 0, tax: 0 }])}
      >
        {t('addRate')}
      </button>
    </fieldset>
  );
}
