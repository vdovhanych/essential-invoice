import { describe, it, expect } from 'vitest';
import { parseAirBankEmail, isIncomingPayment, BANK_TYPE, EXPECTED_SENDER } from './airbank';

describe('Air Bank Email Parser', () => {
  // Sample incoming payment email from the requirements
  const sampleIncomingEmail = `Dobrý den,
zůstatek na účtu DOVH číslo 2752089019/3030 se zvýšil o částku 141 900,00 CZK.
Dostupný zůstatek k 09.01.2026 v 02:21 je 141 900,00 CZK.
Pro úplnost uvádíme detaily této úhrady:
Příchozí úhrada z účtu Trezor Company s.r.o číslo 2501309857/2010
Částka: 141 900,00 CZK
Datum zaúčtování: 09.01.2026
Variabilní symbol: 202601
Zpráva pro příjemce: F202601 Vitalij Dovhanyč
Kód transakce: 146872844642`;

  // Sample outgoing payment email (should be ignored)
  const sampleOutgoingEmail = `Dobrý den,
zůstatek na účtu DOVH číslo 2752089019/3030 se snížil o částku 130 706,00 CZK.
Dostupný zůstatek k 08.01.2026 v 14:30 je 0,00 CZK.
Pro úplnost uvádíme detaily této úhrady:
Odchozí úhrada na účet Supplier s.r.o číslo 1234567890/0800
Částka: 130 706,00 CZK
Datum zaúčtování: 08.01.2026
Variabilní symbol: 123456
Kód transakce: 146872844641`;

  describe('Constants', () => {
    it('should export correct bank type', () => {
      expect(BANK_TYPE).toBe('airbank');
    });

    it('should export correct expected sender', () => {
      expect(EXPECTED_SENDER).toBe('info@airbank.cz');
    });
  });

  describe('isIncomingPayment', () => {
    it('should return true for incoming payment emails', () => {
      expect(isIncomingPayment(sampleIncomingEmail)).toBe(true);
    });

    it('should return false for outgoing payment emails', () => {
      expect(isIncomingPayment(sampleOutgoingEmail)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isIncomingPayment('')).toBe(false);
    });

    it('should return false for unrelated email content', () => {
      expect(isIncomingPayment('Hello, this is a random email')).toBe(false);
    });
  });

  describe('parseAirBankEmail', () => {
    const testDate = new Date('2026-01-09');

    it('should correctly parse a full incoming payment email', () => {
      const result = parseAirBankEmail(sampleIncomingEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(141900.00);
      expect(result!.currency).toBe('CZK');
      expect(result!.variableSymbol).toBe('202601');
      expect(result!.senderName).toBe('Trezor Company s.r.o');
      expect(result!.senderAccount).toBe('2501309857/2010');
      expect(result!.message).toBe('F202601 Vitalij Dovhanyč');
      expect(result!.transactionCode).toBe('146872844642');
      expect(result!.transactionDate).toEqual(new Date(2026, 0, 9)); // January 9, 2026
      expect(result!.rawEmail).toBe(sampleIncomingEmail);
    });

    it('should return null for outgoing payment emails', () => {
      const result = parseAirBankEmail(sampleOutgoingEmail, testDate);
      expect(result).toBeNull();
    });

    it('should handle EUR currency', () => {
      const eurEmail = `Dobrý den,
zůstatek na účtu DOVH číslo 2752089019/3030 se zvýšil o částku 1 234,56 EUR.
Příchozí úhrada z účtu Test Company číslo 1234567890/0800
Částka: 1 234,56 EUR
Datum zaúčtování: 15.06.2025
Variabilní symbol: 202502
Kód transakce: 123456789012`;

      const result = parseAirBankEmail(eurEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(1234.56);
      expect(result!.currency).toBe('EUR');
    });

    it('should handle amounts with spaces (thousands separator)', () => {
      const largeAmountEmail = `Dobrý den,
zůstatek na účtu TEST číslo 1234567890/3030 se zvýšil o částku 1 234 567,89 CZK.
Příchozí úhrada z účtu Big Company číslo 9876543210/0100
Částka: 1 234 567,89 CZK
Variabilní symbol: 999999
Kód transakce: 999888777666`;

      const result = parseAirBankEmail(largeAmountEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(1234567.89);
    });

    it('should handle missing optional fields', () => {
      const minimalEmail = `Dobrý den,
zůstatek na účtu TEST číslo 1234567890/3030 se zvýšil o částku 500,00 CZK.
Příchozí úhrada z účtu Someone číslo 1111111111/0800`;

      const result = parseAirBankEmail(minimalEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(500.00);
      expect(result!.currency).toBe('CZK');
      expect(result!.variableSymbol).toBeNull();
      expect(result!.message).toBeNull();
      expect(result!.transactionCode).toBeNull();
      expect(result!.transactionDate).toEqual(testDate); // Fallback to email date
    });

    it('should return null when amount cannot be extracted', () => {
      const noAmountEmail = `Dobrý den,
zůstatek na účtu TEST se zvýšil o částku.
Příchozí úhrada z účtu Someone číslo 1111111111/0800`;

      const result = parseAirBankEmail(noAmountEmail, testDate);
      expect(result).toBeNull();
    });

    it('should handle small amounts', () => {
      const smallAmountEmail = `Dobrý den,
zůstatek na účtu TEST číslo 1234567890/3030 se zvýšil o částku 0,50 CZK.
Příchozí úhrada z účtu Someone číslo 1111111111/0800`;

      const result = parseAirBankEmail(smallAmountEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(0.50);
    });

    it('should correctly parse transaction date', () => {
      const dateTestEmail = `Dobrý den,
zůstatek na účtu TEST číslo 1234567890/3030 se zvýšil o částku 100,00 CZK.
Příchozí úhrada z účtu Someone číslo 1111111111/0800
Datum zaúčtování: 31.12.2025
Kód transakce: 123456`;

      const result = parseAirBankEmail(dateTestEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.transactionDate).toEqual(new Date(2025, 11, 31)); // December 31, 2025
    });

    it('should extract variable symbol with different formats', () => {
      const vsEmail = `Dobrý den,
zůstatek na účtu TEST číslo 1234567890/3030 se zvýšil o částku 100,00 CZK.
Příchozí úhrada z účtu Someone číslo 1111111111/0800
Variabilní symbol: 1234567890`;

      const result = parseAirBankEmail(vsEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.variableSymbol).toBe('1234567890');
    });

    it('should handle sender names with special characters', () => {
      const specialNameEmail = `Dobrý den,
zůstatek na účtu TEST číslo 1234567890/3030 se zvýšil o částku 100,00 CZK.
Příchozí úhrada z účtu Česká Spořitelna, a.s. číslo 1111111111/0800`;

      const result = parseAirBankEmail(specialNameEmail, testDate);

      expect(result).not.toBeNull();
      expect(result!.senderName).toBe('Česká Spořitelna, a.s.');
    });
  });
});
