import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
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
}

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
}: InvoiceItemsEditorProps) {
  const { t } = useTranslation('invoices', { keyPrefix });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('itemsSection')}</h2>
        <button
          type="button"
          onClick={onAddItem}
          className="btn btn-secondary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>{t('addItem')}</span>
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-12 md:col-span-5">
              <label className="label">{t('itemDescription')} <span className="text-gray-400 dark:text-gray-500 font-normal">({item.description.length}/150)</span></label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => onItemChange(index, 'description', e.target.value)}
                className="input"
                placeholder={t('itemDescriptionPlaceholder')}
                maxLength={150}
                required
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="label">{t('itemQuantity')}</label>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => onItemChange(index, 'quantity', e.target.value === '' ? '' as unknown as number : parseFloat(e.target.value))}
                className="input"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div className="col-span-4 md:col-span-1">
              <label className="label">{t('itemUnit')}</label>
              <input
                type="text"
                value={item.unit}
                onChange={(e) => onItemChange(index, 'unit', e.target.value)}
                className="input"
                placeholder={t('itemUnitPlaceholder')}
              />
            </div>
            <div className="col-span-4 md:col-span-3">
              <label className="label">{t('itemUnitPrice')}</label>
              <input
                type="number"
                value={item.unitPrice}
                onChange={(e) => onItemChange(index, 'unitPrice', e.target.value === '' ? '' as unknown as number : parseFloat(e.target.value))}
                className="input"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="col-span-12 md:col-span-1">
              <button
                type="button"
                onClick={() => onRemoveItem(index)}
                className="btn btn-secondary p-2 w-full"
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-end space-y-2">
          <div className="flex justify-between w-full max-w-xs">
            <span className="text-gray-600 dark:text-gray-300">{t('subtotal')}</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs items-center">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 dark:text-gray-300">{t('vat')}</span>
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
            <span className="font-medium">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs text-lg">
            <span className="font-bold">{t('total')}</span>
            <span className="font-bold text-indigo-600">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
