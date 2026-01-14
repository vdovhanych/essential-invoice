import { describe, it, expect } from 'vitest';
import { detectBank, parsePaymentEmail, getSupportedBanks } from './index.js';

describe('Bank Parser Factory', () => {
  const sampleIncomingEmail = `Dobrý den,
zůstatek na účtu DOVH číslo 2752089019/3030 se zvýšil o částku 1 000,00 CZK.
Příchozí úhrada z účtu Test Company číslo 1234567890/2010
Variabilní symbol: 123456
Kód transakce: 999888777`;

  const sampleOutgoingEmail = `Dobrý den,
zůstatek na účtu DOVH číslo 2752089019/3030 se snížil o částku 500,00 CZK.`;

  describe('detectBank', () => {
    it('should detect Air Bank by sender email', () => {
      const parser = detectBank('noreply@airbank.cz');
      expect(parser).not.toBeNull();
      expect(parser!.type).toBe('airbank');
    });

    it('should detect Air Bank with different case', () => {
      const parser = detectBank('NoReply@AirBank.CZ');
      expect(parser).not.toBeNull();
      expect(parser!.type).toBe('airbank');
    });

    it('should detect Air Bank with leading/trailing spaces', () => {
      const parser = detectBank('  noreply@airbank.cz  ');
      expect(parser).not.toBeNull();
    });

    it('should return null for unknown bank', () => {
      const parser = detectBank('notification@somebank.cz');
      expect(parser).toBeNull();
    });

    it('should return null for empty email', () => {
      const parser = detectBank('');
      expect(parser).toBeNull();
    });
  });

  describe('parsePaymentEmail', () => {
    const testDate = new Date('2025-06-15');

    it('should parse Air Bank incoming payment', () => {
      const result = parsePaymentEmail('noreply@airbank.cz', sampleIncomingEmail, testDate);

      expect(result.bankType).toBe('airbank');
      expect(result.payment).not.toBeNull();
      expect(result.payment!.amount).toBe(1000.00);
      expect(result.payment!.variableSymbol).toBe('123456');
    });

    it('should return null payment for outgoing transaction', () => {
      const result = parsePaymentEmail('noreply@airbank.cz', sampleOutgoingEmail, testDate);

      expect(result.bankType).toBe('airbank');
      expect(result.payment).toBeNull();
    });

    it('should return null for unknown bank', () => {
      const result = parsePaymentEmail('unknown@bank.com', sampleIncomingEmail, testDate);

      expect(result.bankType).toBeNull();
      expect(result.payment).toBeNull();
    });
  });

  describe('getSupportedBanks', () => {
    it('should return list of supported banks', () => {
      const banks = getSupportedBanks();

      expect(banks).toBeInstanceOf(Array);
      expect(banks.length).toBeGreaterThan(0);

      // Air Bank should be in the list
      const airBank = banks.find(b => b.type === 'airbank');
      expect(airBank).toBeDefined();
      expect(airBank!.sender).toBe('noreply@airbank.cz');
    });
  });
});
