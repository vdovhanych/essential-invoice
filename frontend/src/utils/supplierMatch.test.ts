import { describe, it, expect } from 'vitest';
import { normalizeCompanyName, findSupplierClient } from './supplierMatch';

describe('normalizeCompanyName', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeCompanyName('Železářství Novák')).toBe('zelezarstvi novak');
  });

  it('strips legal-form suffixes and punctuation', () => {
    expect(normalizeCompanyName('Alza.cz a.s.')).toBe('alzacz');
    expect(normalizeCompanyName('Firma spol. s r.o.')).toBe('firma');
    expect(normalizeCompanyName('Test s.r.o.')).toBe('test');
  });

  it('does not strip suffix letters inside words', () => {
    expect(normalizeCompanyName('ASUS Computer')).toBe('asus computer');
  });
});

describe('findSupplierClient', () => {
  const clients = [
    { id: '1', companyName: 'Alza.cz a.s.', ico: '27082440' },
    { id: '2', companyName: 'Železářství Novák s.r.o.', ico: '12345678' },
    { id: '3', companyName: 'ACME', ico: null },
  ];

  it('matches by IČO first, even when names differ', () => {
    const match = findSupplierClient(clients, 'Completely Different Name', '27082440');
    expect(match?.id).toBe('1');
  });

  it('ignores non-digit characters in IČO', () => {
    const match = findSupplierClient(clients, null, '123 45 678');
    expect(match?.id).toBe('2');
  });

  it('matches by normalized exact name', () => {
    const match = findSupplierClient(clients, 'ŽELEZÁŘSTVÍ NOVÁK, s.r.o.', null);
    expect(match?.id).toBe('2');
  });

  it('matches by name containment', () => {
    const match = findSupplierClient(clients, 'Alza.cz', null);
    expect(match?.id).toBe('1');
  });

  it('returns undefined when nothing matches', () => {
    const match = findSupplierClient(clients, 'Unknown Supplier', '99999999');
    expect(match).toBeUndefined();
  });

  it('returns undefined for null inputs', () => {
    expect(findSupplierClient(clients, null, null)).toBeUndefined();
  });
});
