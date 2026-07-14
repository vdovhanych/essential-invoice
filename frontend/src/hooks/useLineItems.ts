import { useState } from 'react';

export interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export function emptyLineItem(): LineItem {
  return { description: '', quantity: 1, unit: 'ks', unitPrice: '' as unknown as number };
}

/**
 * Shared state + calculations for invoice line items
 * (used by InvoiceCreate and RecurringInvoiceCreate).
 */
export function useLineItems(vatRate: number | string) {
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()]);

  function handleItemChange(index: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }

  function addItem() {
    setItems(prev => [...prev, emptyLineItem()]);
  }

  function removeItem(index: number) {
    setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const subtotal = items.reduce(
    (sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    0
  );
  const vatAmount = subtotal * ((Number(vatRate) || 0) / 100);
  const total = subtotal + vatAmount;

  return { items, setItems, handleItemChange, addItem, removeItem, subtotal, vatAmount, total };
}
