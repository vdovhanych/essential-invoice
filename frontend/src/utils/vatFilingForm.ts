import type { FilingProfile } from '../types/vatFiling';

export const blankFilingProfile: FilingProfile = {
  status: 'nonpayer',
  personType: 'individual',
  frequency: 'monthly',
  vatId: '',
  firstName: '',
  lastName: '',
  street: '',
  houseNumber: '',
  houseOrientation: '',
  city: '',
  postcode: '',
  taxOffice: '',
  taxOfficeBranch: '',
  activityCode: '',
  email: '',
  effectiveFrom: '',
};
export function prefillFilingProfile(
  saved: FilingProfile | null,
  defaults: Partial<FilingProfile> = {},
): FilingProfile {
  const result = { ...blankFilingProfile, ...defaults, ...saved };
  for (const [key, value] of Object.entries(defaults)) {
    if (
      typeof value === 'string' &&
      !String(result[key as keyof FilingProfile] || '').trim()
    ) {
      Object.assign(result, { [key]: value });
    }
  }
  return result;
}
export function defaultFilingPeriod(
  frequency: string = 'monthly',
  now = new Date(),
): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const end = new Date(
    year,
    frequency === 'quarterly' ? Math.floor(month / 3) * 3 : month,
    0,
  );
  const supportedYear = 2026;
  const lastMonth =
    end.getFullYear() < supportedYear
      ? 0
      : end.getFullYear() > supportedYear
        ? 11
        : end.getMonth();
  return frequency === 'quarterly'
    ? `2026-Q${Math.floor(lastMonth / 3) + 1}`
    : `2026-${String(lastMonth + 1).padStart(2, '0')}`;
}
export const filingPeriods = (frequency: string = 'monthly') =>
  frequency === 'quarterly'
    ? [1, 2, 3, 4].map((q) => `2026-Q${q}`)
    : Array.from(
        { length: 12 },
        (_, i) => `2026-${String(i + 1).padStart(2, '0')}`,
      );
