import { expect, it } from 'vitest';
import {
  blankFilingProfile,
  defaultFilingPeriod,
  prefillFilingProfile,
} from './vatFilingForm';
it('uses existing profile details without overwriting reviewed filing values', () => {
  const result = prefillFilingProfile(
    { ...blankFilingProfile, firstName: 'Confirmed', status: 'identified' },
    {
      firstName: 'Suggested',
      lastName: 'Novák',
      status: 'payer',
      email: 'known@example.com',
    },
  );
  expect(result).toMatchObject({
    firstName: 'Confirmed',
    lastName: 'Novák',
    status: 'identified',
    email: 'known@example.com',
    effectiveFrom: '',
  });
});
it('selects the last completed month or quarter within the supported year', () => {
  expect(defaultFilingPeriod('monthly', new Date(2026, 8, 9))).toBe('2026-08');
  expect(defaultFilingPeriod('quarterly', new Date(2026, 8, 9))).toBe(
    '2026-Q2',
  );
  expect(defaultFilingPeriod('quarterly', new Date(2027, 0, 1))).toBe(
    '2026-Q4',
  );
});
