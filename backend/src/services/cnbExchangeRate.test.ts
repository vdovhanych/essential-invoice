import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../db/init', () => ({
  query: vi.fn(),
}));

// Mock the logger
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { query } from '../db/init';

const mockedQuery = vi.mocked(query);

// Sample CNB response text
const CNB_RESPONSE = `28.03.2026 #62
země|měna|množství|kód|kurz
Austrálie|dolar|1|AUD|15,432
EMU|euro|1|EUR|25,123
Japonsko|jen|100|JPY|16,254
USA|dolar|1|USD|23,456`;

const CNB_RESPONSE_NO_EUR = `28.03.2026 #62
země|měna|množství|kód|kurz
Austrálie|dolar|1|AUD|15,432
USA|dolar|1|USD|23,456`;

describe('cnbExchangeRate', () => {
  let getEurCzkRate: typeof import('./cnbExchangeRate').getEurCzkRate;
  let convertEurToCzk: typeof import('./cnbExchangeRate').convertEurToCzk;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    // Re-import the module to reset in-memory cache
    vi.resetModules();
    const mod = await import('./cnbExchangeRate');
    getEurCzkRate = mod.getEurCzkRate;
    convertEurToCzk = mod.convertEurToCzk;
  });

  describe('getEurCzkRate', () => {
    it('returns cached rate from DB when available', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ rate: '25.1230' }],
      } as any);

      const result = await getEurCzkRate('2026-03-28');

      expect(result).toEqual({ rate: 25.123, rateDate: '2026-03-28' });
      expect(mockedQuery).toHaveBeenCalledWith(
        'SELECT rate FROM exchange_rates WHERE rate_date = $1 AND currency = $2',
        ['2026-03-28', 'EUR']
      );
    });

    it('fetches from CNB when not cached and stores in DB', async () => {
      // DB cache miss
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      // INSERT cache
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(CNB_RESPONSE),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getEurCzkRate('2026-03-28');

      expect(result).toEqual({ rate: 25.123, rateDate: '2026-03-28' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO exchange_rates'),
        ['2026-03-28', 'EUR', 25.123]
      );
    });

    it('falls back to previous days when CNB has no data (weekends)', async () => {
      // DB cache miss for original date
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const mockFetch = vi.fn()
        // First fetch (original date) - no EUR data
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(CNB_RESPONSE_NO_EUR),
        });

      // DB cache miss for fallback date
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      // Second fetch (day before) - has EUR data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(CNB_RESPONSE),
      });

      // INSERT cache for fallback date
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      // INSERT cache for original date
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      vi.stubGlobal('fetch', mockFetch);

      const result = await getEurCzkRate('2026-03-29');

      expect(result).not.toBeNull();
      expect(result!.rate).toBe(25.123);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('returns null when CNB is unreachable', async () => {
      // DB cache misses for all 6 attempts (original + 5 fallback days)
      for (let i = 0; i < 7; i++) {
        mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      }

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await getEurCzkRate('2026-03-28');

      expect(result).toBeNull();
    });
  });

  describe('convertEurToCzk', () => {
    it('converts EUR to CZK correctly', async () => {
      // DB cache hit
      mockedQuery.mockResolvedValueOnce({
        rows: [{ rate: '25.1230' }],
      } as any);

      const result = await convertEurToCzk(1300, '2026-02-10');

      expect(result).not.toBeNull();
      expect(result!.czkAmount).toBe(32659.90);
      expect(result!.rate).toBe(25.123);
    });

    it('returns null when rate is unavailable', async () => {
      // DB cache misses for all attempts
      for (let i = 0; i < 7; i++) {
        mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      }

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await convertEurToCzk(1300, '2026-02-10');

      expect(result).toBeNull();
    });

    it('rounds CZK amount to 2 decimal places', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ rate: '25.1235' }],
      } as any);

      const result = await convertEurToCzk(100.33, '2026-02-10');

      expect(result).not.toBeNull();
      // 100.33 * 25.1235 = 2520.59...
      const expected = Math.round(100.33 * 25.1235 * 100) / 100;
      expect(result!.czkAmount).toBe(expected);
    });
  });
});
