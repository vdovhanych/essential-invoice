import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLineItems, emptyLineItem } from './useLineItems';

describe('useLineItems', () => {
  it('starts with a single empty item', () => {
    const { result } = renderHook(() => useLineItems(21));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(emptyLineItem());
  });

  it('updates a single field of an item', () => {
    const { result } = renderHook(() => useLineItems(21));
    act(() => result.current.handleItemChange(0, 'description', 'Consulting'));
    act(() => result.current.handleItemChange(0, 'unitPrice', 1000));
    expect(result.current.items[0].description).toBe('Consulting');
    expect(result.current.items[0].unitPrice).toBe(1000);
  });

  it('adds and removes items', () => {
    const { result } = renderHook(() => useLineItems(21));
    act(() => result.current.addItem());
    expect(result.current.items).toHaveLength(2);
    act(() => result.current.removeItem(1));
    expect(result.current.items).toHaveLength(1);
  });

  it('does not remove the last remaining item', () => {
    const { result } = renderHook(() => useLineItems(21));
    act(() => result.current.removeItem(0));
    expect(result.current.items).toHaveLength(1);
  });

  it('calculates subtotal, VAT and total', () => {
    const { result } = renderHook(() => useLineItems(21));
    act(() => result.current.handleItemChange(0, 'quantity', 2));
    act(() => result.current.handleItemChange(0, 'unitPrice', 500));
    expect(result.current.subtotal).toBe(1000);
    expect(result.current.vatAmount).toBe(210);
    expect(result.current.total).toBe(1210);
  });

  it('accepts vatRate as a string (select values)', () => {
    const { result } = renderHook(() => useLineItems('12'));
    act(() => result.current.handleItemChange(0, 'quantity', 1));
    act(() => result.current.handleItemChange(0, 'unitPrice', 100));
    expect(result.current.vatAmount).toBe(12);
    expect(result.current.total).toBe(112);
  });

  it('treats empty quantity/unitPrice inputs as zero', () => {
    const { result } = renderHook(() => useLineItems(21));
    act(() => result.current.handleItemChange(0, 'quantity', '' as unknown as number));
    expect(result.current.subtotal).toBe(0);
    expect(result.current.vatAmount).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it('sums across multiple items', () => {
    const { result } = renderHook(() => useLineItems(0));
    act(() => result.current.handleItemChange(0, 'quantity', 1));
    act(() => result.current.handleItemChange(0, 'unitPrice', 100));
    act(() => result.current.addItem());
    act(() => result.current.handleItemChange(1, 'quantity', 3));
    act(() => result.current.handleItemChange(1, 'unitPrice', 50));
    expect(result.current.subtotal).toBe(250);
    expect(result.current.vatAmount).toBe(0);
    expect(result.current.total).toBe(250);
  });
});
