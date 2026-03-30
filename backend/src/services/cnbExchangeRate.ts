import { query } from '../db/init';
import { log } from '../utils/logger';

const CNB_BASE_URL = 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';

// In-memory cache to avoid repeated DB lookups within the same process
const memoryCache = new Map<string, number>();

/**
 * Parse the CNB daily exchange rate text format.
 * Format:
 *   28.03.2026 #62
 *   země|měna|množství|kód|kurz
 *   EMU|euro|1|EUR|25,123
 *   ...
 */
function parseCnbRateText(text: string, currencyCode: string): number | null {
  const lines = text.split('\n');
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length === 5 && parts[3]?.trim() === currencyCode) {
      const amount = parseInt(parts[2]?.trim(), 10);
      const rate = parseFloat(parts[4]?.trim().replace(',', '.'));
      if (!isNaN(amount) && !isNaN(rate) && amount > 0) {
        return rate / amount;
      }
    }
  }
  return null;
}

/**
 * Format a date as DD.MM.YYYY for the CNB API.
 */
function formatDateForCnb(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format a date as YYYY-MM-DD for DB storage.
 */
function formatDateIso(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Check the DB cache for a stored rate.
 */
async function getCachedRate(rateDate: string, currency: string): Promise<number | null> {
  const result = await query(
    'SELECT rate FROM exchange_rates WHERE rate_date = $1 AND currency = $2',
    [rateDate, currency]
  );
  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].rate);
  }
  return null;
}

/**
 * Store a rate in the DB cache.
 */
async function cacheRate(rateDate: string, currency: string, rate: number): Promise<void> {
  await query(
    `INSERT INTO exchange_rates (rate_date, currency, rate)
     VALUES ($1, $2, $3)
     ON CONFLICT (rate_date, currency) DO NOTHING`,
    [rateDate, currency, rate]
  );
}

/**
 * Fetch the EUR/CZK exchange rate for a given date from CNB.
 * Falls back up to 5 days for weekends/holidays.
 * Returns { rate, rateDate } or null if unavailable.
 */
export async function getEurCzkRate(dateStr: string): Promise<{ rate: number; rateDate: string } | null> {
  const currency = 'EUR';

  // Check memory cache first
  const memKey = `${dateStr}:${currency}`;
  const memRate = memoryCache.get(memKey);
  if (memRate !== undefined) {
    return { rate: memRate, rateDate: dateStr };
  }

  // Check DB cache
  const cachedRate = await getCachedRate(dateStr, currency);
  if (cachedRate !== null) {
    memoryCache.set(memKey, cachedRate);
    return { rate: cachedRate, rateDate: dateStr };
  }

  // Fetch from CNB, walking back up to 5 days for weekends/holidays
  const startDate = new Date(dateStr + 'T12:00:00Z');
  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const tryDate = new Date(startDate);
    tryDate.setUTCDate(tryDate.getUTCDate() - dayOffset);
    const tryDateIso = formatDateIso(tryDate);

    // Check DB cache for fallback dates too
    if (dayOffset > 0) {
      const fallbackCached = await getCachedRate(tryDateIso, currency);
      if (fallbackCached !== null) {
        // Cache for the original date too
        await cacheRate(dateStr, currency, fallbackCached);
        memoryCache.set(memKey, fallbackCached);
        return { rate: fallbackCached, rateDate: tryDateIso };
      }
    }

    try {
      const url = `${CNB_BASE_URL}?date=${formatDateForCnb(tryDate)}`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const text = await response.text();
      const rate = parseCnbRateText(text, currency);
      if (rate !== null) {
        // Cache the rate for the actual CNB date
        await cacheRate(tryDateIso, currency, rate);
        // Also cache for the originally requested date
        if (dayOffset > 0) {
          await cacheRate(dateStr, currency, rate);
        }
        memoryCache.set(memKey, rate);
        return { rate, rateDate: tryDateIso };
      }
    } catch (err) {
      log.warn(`CNB rate fetch failed for ${formatDateForCnb(tryDate)}: ${err}`);
      continue;
    }
  }

  log.error(`Could not fetch EUR/CZK rate for ${dateStr} (tried 6 days back)`);
  return null;
}

/**
 * Convert an EUR amount to CZK using the CNB rate for the given date.
 * Returns { czkAmount, rate, rateDate } or null if rate unavailable.
 */
export async function convertEurToCzk(eurAmount: number, dateStr: string): Promise<{ czkAmount: number; rate: number; rateDate: string } | null> {
  const result = await getEurCzkRate(dateStr);
  if (!result) return null;

  const czkAmount = Math.round(eurAmount * result.rate * 100) / 100;
  return { czkAmount, rate: result.rate, rateDate: result.rateDate };
}
