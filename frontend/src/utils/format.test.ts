import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getStatusLabel,
  getStatusColor,
  getExpenseStatusLabel,
  getExpenseStatusColor
} from './format';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('should format CZK currency by default', () => {
      const result = formatCurrency(1000);
      expect(result).toContain('1');
      expect(result).toContain('000');
      expect(result).toMatch(/Kč|CZK/);
    });

    it('should format EUR currency', () => {
      const result = formatCurrency(1000, 'EUR');
      expect(result).toContain('1');
      expect(result).toContain('000');
      expect(result).toMatch(/€|EUR/);
    });

    it('should handle decimal values', () => {
      const result = formatCurrency(1234.56, 'CZK');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('should handle zero', () => {
      const result = formatCurrency(0, 'CZK');
      expect(result).toContain('0');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-500, 'CZK');
      expect(result).toContain('500');
    });
  });

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date('2025-06-15');
      const result = formatDate(date);
      expect(result).toContain('15');
      expect(result).toContain('6');
      expect(result).toContain('2025');
    });

    it('should format date string', () => {
      const result = formatDate('2025-12-31');
      expect(result).toContain('31');
      expect(result).toContain('12');
      expect(result).toContain('2025');
    });

    it('should format ISO date string', () => {
      const result = formatDate('2025-01-01T00:00:00.000Z');
      expect(result).toContain('1');
      expect(result).toContain('2025');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const dateTime = new Date('2025-06-15T14:30:00');
      const result = formatDateTime(dateTime);
      expect(result).toContain('15');
      expect(result).toContain('6');
      expect(result).toContain('2025');
    });

    it('should format date string with time', () => {
      const result = formatDateTime('2025-12-31T23:59:59');
      expect(result).toContain('31');
      expect(result).toContain('12');
      expect(result).toContain('2025');
    });
  });

  describe('getStatusLabel', () => {
    it('should return Czech label for draft', () => {
      expect(getStatusLabel('draft')).toBe('Koncept');
    });

    it('should return Czech label for sent', () => {
      expect(getStatusLabel('sent')).toBe('Odesláno');
    });

    it('should return Czech label for paid', () => {
      expect(getStatusLabel('paid')).toBe('Zaplaceno');
    });

    it('should return Czech label for overdue', () => {
      expect(getStatusLabel('overdue')).toBe('Po splatnosti');
    });

    it('should return Czech label for cancelled', () => {
      expect(getStatusLabel('cancelled')).toBe('Zrušeno');
    });

    it('should return original status for unknown status', () => {
      expect(getStatusLabel('unknown')).toBe('unknown');
    });
  });

  describe('getStatusColor', () => {
    it('should return badge class for draft', () => {
      expect(getStatusColor('draft')).toBe('badge-draft');
    });

    it('should return badge class for sent', () => {
      expect(getStatusColor('sent')).toBe('badge-sent');
    });

    it('should return badge class for paid', () => {
      expect(getStatusColor('paid')).toBe('badge-paid');
    });

    it('should return badge class for overdue', () => {
      expect(getStatusColor('overdue')).toBe('badge-overdue');
    });

    it('should return badge class for cancelled', () => {
      expect(getStatusColor('cancelled')).toBe('badge-cancelled');
    });

    it('should return default badge class for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('badge-draft');
    });
  });

  describe('getExpenseStatusLabel', () => {
    it('should return Czech label for unpaid', () => {
      expect(getExpenseStatusLabel('unpaid')).toBe('Nezaplaceno');
    });

    it('should return Czech label for paid', () => {
      expect(getExpenseStatusLabel('paid')).toBe('Zaplaceno');
    });

    it('should return original status for unknown status', () => {
      expect(getExpenseStatusLabel('unknown')).toBe('unknown');
    });
  });

  describe('getExpenseStatusColor', () => {
    it('should return badge class for unpaid', () => {
      expect(getExpenseStatusColor('unpaid')).toBe('badge-overdue');
    });

    it('should return badge class for paid', () => {
      expect(getExpenseStatusColor('paid')).toBe('badge-paid');
    });

    it('should return default badge class for unknown status', () => {
      expect(getExpenseStatusColor('unknown')).toBe('badge-draft');
    });
  });
});
