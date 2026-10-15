import { describe, expect, it } from 'vitest';
import { filingProfileDefaults } from './vatFilingDefaults';

describe('existing user details as editable filing suggestions', () => {
  it('prefills identity, payer status and a structured Czech address including orientation', () => {
    expect(
      filingProfileDefaults({
        name: ' Jana Nováková ',
        email: 'jana@example.com',
        company_dic: 'cz 9001010007',
        company_address: 'Dlouhá 123/4a, 110 00 Praha 1',
        vat_payer: true,
      }),
    ).toEqual({
      firstName: 'Jana',
      lastName: 'Nováková',
      email: 'jana@example.com',
      vatId: 'CZ9001010007',
      status: 'payer',
      street: 'Dlouhá',
      houseNumber: '123',
      houseOrientation: '4a',
      postcode: '11000',
      city: 'Praha 1',
    });
  });
  it('leaves unstructured addresses and tax decisions unknown', () => {
    const result = filingProfileDefaults({
      name: 'Alex',
      company_address: 'somewhere abroad',
    });
    expect(result.firstName).toBe('Alex');
    expect(result.lastName).toBe('');
    for (const key of [
      'street',
      'taxOffice',
      'activityCode',
      'effectiveFrom',
      'frequency',
    ])
      expect(result).not.toHaveProperty(key);
  });
});
