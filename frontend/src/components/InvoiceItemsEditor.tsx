import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { LineItem } from '../hooks/useLineItems';

interface InvoiceItemsEditorProps {
  items: LineItem[];
  onItemChange: (index: number, field: keyof LineItem, value: string | number) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  vatRate: number | string;
  onVatRateChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  subtotal: number;
  vatAmount: number;
  total: number;
  formatCurrency: (amount: number) => string;
  /** i18n key prefix within the invoices namespace, e.g. 'create' or 'recurring.create' */
  keyPrefix: string;
  /** Hide the inline totals block (InvoiceCreate renders totals in its own card) */
  showTotals?: boolean;
}

const columnHeader = 'text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint';

export default function InvoiceItemsEditor({
  items,
  onItemChange,
  onAddItem,
  onRemoveItem,
  vatRate,
  onVatRateChange,
  subtotal,
  vatAmount,
  total,
  formatCurrency,
  keyPrefix,
  showTotals = true,
}: InvoiceItemsEditorProps) {
  const { t } = useTranslation('invoices', { keyPrefix });

  // Keyboard-first entry: Tab out of the last row's price field adds a row
  function handlePriceKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Tab' && !e.shiftKey && index === items.length - 1) {
      onAddItem();
    }
  }

  return (
    <div className="card">
      <h2 className="text-[15px] font-semibold text-text mb-4">{t('itemsSection')}</h2>

      {/* Column headers (desktop) */}
      <div className="hidden md:grid grid-cols-[2.4fr_0.8fr_0.6fr_1fr_1fr_28px] gap-x-3 pb-2 border-b border-hairline">
        <span className={columnHeader}>{t('itemDescription')}</span>
        <span className={`${columnHeader} text-right`}>{t('itemQuantity')}</span>
        <span className={columnHeader}>{t('itemUnit')}</span>
        <span className={`${columnHeader} text-right`}>{t('itemUnitPrice')}</span>
        <span className={`${columnHeader} text-right`}>{t('itemTotal')}</span>
        <span />
      </div>

      <div className="divide-y divide-hairline-soft md:divide-y-0">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-2 md:grid-cols-[2.4fr_0.8fr_0.6fr_1fr_1fr_28px] gap-3 py-3 md:py-2 items-center"
          >
            <input
              type="text"
              value={item.description}
              onChange={(e) => onItemChange(index, 'description', e.target.value)}
              className="input col-span-2 md:col-span-1"
              placeholder={t('itemDescriptionPlaceholder')}
              aria-label={t('itemDescription')}
              maxLength={150}
              required
            />
            <input
              type="number"
              value={item.quantity}
              onChange={(e) =>
                onItemChange(index, 'quantity', e.target.value === '' ? ('' as unknown as number) : parseFloat(e.target.value))
              }
              className="input text-right tabular-nums"
              aria-label={t('itemQuantity')}
              min="0.01"
              step="0.01"
              required
            />
            <input
              type="text"
              value={item.unit}
              onChange={(e) => onItemChange(index, 'unit', e.target.value)}
              className="input"
              placeholder={t('itemUnitPlaceholder')}
              aria-label={t('itemUnit')}
            />
            <input
              type="number"
              value={item.unitPrice}
              onChange={(e) =>
                onItemChange(index, 'unitPrice', e.target.value === '' ? ('' as unknown as number) : parseFloat(e.target.value))
              }
              onKeyDown={(e) => handlePriceKeyDown(e, index)}
              className="input text-right tabular-nums"
              aria-label={t('itemUnitPrice')}
              min="0"
              step="0.01"
              required
            />
            <span className="hidden md:block text-sm font-semibold text-text text-right tabular-nums">
              {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
            </span>
            <button
              type="button"
              onClick={() => onRemoveItem(index)}
              disabled={items.length === 1}
              className="justify-self-end p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-nav-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t('removeItem')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onAddItem}
          className="flex items-center gap-1.5 bg-surface-sunken text-text text-sm font-medium rounded-[10px] px-3.5 py-2 hover:bg-nav-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{t('addItem')}</span>
        </button>
        <span className="hidden md:block text-xs text-text-faint">{t('addItemHint')}</span>
      </div>

      {showTotals && (
        <div className="mt-6 pt-6 border-t border-hairline">
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full max-w-xs">
              <span className="text-[13px] text-text-muted">{t('subtotal')}</span>
              <span className="text-sm font-medium text-text tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between w-full max-w-xs items-center">
              <div className="flex items-center space-x-2">
                <span className="text-[13px] text-text-muted">{t('vat')}</span>
                <select
                  name="vatRate"
                  value={vatRate}
                  onChange={onVatRateChange}
                  className="input w-20 py-1"
                >
                  <option value="0">0%</option>
                  <option value="12">12%</option>
                  <option value="21">21%</option>
                </select>
              </div>
              <span className="text-sm font-medium text-text tabular-nums">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between w-full max-w-xs items-baseline">
              <span className="text-sm font-semibold text-text">{t('total')}</span>
              <span className="text-xl font-bold text-accent tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
