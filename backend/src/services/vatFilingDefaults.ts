import type { FilingProfile } from './vatFilingTypes';

// Editing suggestions only: never use these as a confirmed filing snapshot.
export function filingProfileDefaults(user: {
  name?: string;
  email?: string;
  company_dic?: string;
  company_address?: string;
  vat_payer?: boolean;
}): Partial<FilingProfile> {
  const name = (user.name || '').trim().split(/\s+/).filter(Boolean);
  const defaults: Partial<FilingProfile> = {
    status: user.vat_payer ? 'payer' : 'nonpayer',
    vatId: (user.company_dic || '').replace(/\s/g, '').toUpperCase(),
    email: user.email || '',
    firstName: name[0] || '',
    lastName: name.slice(1).join(' '),
  };
  // Recognize the usual Czech address layout. Keep the original visible in the
  // editor when a free-form address cannot be split without inventing fields.
  const address = (user.company_address || '').trim();
  const match = address.match(
    /^(.+?)\s+(\d+)(?:\/(\d+[A-Za-z]?))?\s*[,\n]\s*(\d{3})\s?(\d{2})\s+([^,\n]+?)(?:\s*[,\n]\s*(?:Česká republika|Česko|Czech Republic|CZ))?$/i,
  );
  if (match)
    Object.assign(defaults, {
      street: match[1].trim(),
      houseNumber: match[2],
      houseOrientation: match[3] || '',
      postcode: match[4] + match[5],
      city: match[6].trim(),
    });
  return defaults;
}
