import { validateIco } from './validation';
// Structural checks only. Registration and transaction eligibility require user review.
export function validCzechVatId(value: string): boolean {
  if (!/^CZ\d{8,10}$/.test(value)) return false;
  const number = value.slice(2);
  if (number.length === 8) return validateIco(number).valid;
  // Assigned nine-digit IDs and older personal identifiers are checked by EPO.
  return !/^0+$/.test(number);
}
// Form 25 5525, instructions version 7 (2026), pp. 3–4. Country is explicit,
// independent of the prefix. XI is deliberately excluded: it does not cover services.
const patterns: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^\d{10}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  ES: /^(?:[A-Z]\d{8}|\d{8}[A-Z]|[A-Z]\d{7}[A-Z])$/,
  FI: /^\d{8}$/,
  FR: /^[0-9A-HJ-NP-Z]{2}\d{9}$/,
  GR: /^\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^(?:\d{7}[A-Z]|\d[A-Z]\d{5}[A-Z]|\d{7}[A-Z]{2})$/,
  IT: /^\d{11}$/,
  LT: /^(?:\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^(?:\d{9}B(?:0[1-9]|[1-9]\d)|[0-9A-Z+*]{10}(?:0[2-9]|[1-8]\d|9[0-8]))$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};
export function validEuServiceVatId(country: string, value: string): boolean {
  const prefix = country === 'GR' ? 'EL' : country;
  return value.startsWith(prefix) && !!patterns[country]?.test(value.slice(2));
}
