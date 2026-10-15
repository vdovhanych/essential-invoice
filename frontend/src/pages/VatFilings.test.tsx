import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VatFilings from './VatFilings';
import { api } from '../utils/api';
import i18n from '../i18n/i18n';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ refreshUser: async () => {} }),
}));
vi.mock('../utils/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), download: vi.fn() },
}));
const review = {
  period: '2026-08',
  type: 'DPHDP3',
  mode: 'original',
  applicable: true,
  reason: 'return_obligation',
  issues: [],
  rows: { 1: { base: 100, tax: 21, documents: [] } },
  statement: [],
  reconciliation: [],
  documents: [],
};
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('en');
  vi.mocked(api.get).mockImplementation(async (endpoint) =>
    endpoint.endsWith('/workspace')
      ? { profile: null, vatPayer: false, documents: [] }
      : endpoint.endsWith('/code-lists')
        ? { offices: [], branches: [], countries: [] }
        : [],
  );
});
it('blocks downloads until the review passes and invalidates review when the period changes', async () => {
  vi.mocked(api.post).mockResolvedValue({
    review: {
      ...review,
      issues: [{ severity: 'blocker', code: 'profile_required' }],
    },
    snapshotHash: 'hash',
    previousId: null,
  });
  render(
    <MemoryRouter initialEntries={['/vat-filings?section=review']}>
      <VatFilings />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Calculate and validate' }),
  );
  expect(
    await screen.findByRole('button', {
      name: 'Save new version and download XML',
    }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Period'), {
    target: { value: '2026-09' },
  });
  expect(
    screen.queryByRole('button', { name: 'Save new version and download XML' }),
  ).not.toBeInTheDocument();
});
it('creates a version from reviewed hash and downloads that version', async () => {
  vi.mocked(api.post)
    .mockResolvedValueOnce({
      review,
      snapshotHash: 'reviewed',
      previousId: null,
    })
    .mockResolvedValueOnce({ id: 'v1' });
  render(
    <MemoryRouter initialEntries={['/vat-filings?section=review']}>
      <VatFilings />
    </MemoryRouter>,
  );
  // Download metadata must come from the reviewed snapshot, not the current form.
  fireEvent.change(await screen.findByLabelText('Period'), {
    target: { value: '2026-09' },
  });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Calculate and validate' }),
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Save new version and download XML',
    }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/vat-filings/versions', {
      period: '2026-08',
      type: 'DPHDP3',
      mode: 'original',
      snapshotHash: 'reviewed',
    }),
  );
  expect(api.download).toHaveBeenCalledWith(
    '/vat-filings/versions/v1/xml',
    'DPHDP3-2026-08.xml',
  );
});
it('offers a saved version download without recalculating current documents', async () => {
  vi.mocked(api.get).mockImplementation(async (endpoint) =>
    endpoint.endsWith('/workspace')
      ? { profile: null, vatPayer: false, documents: [] }
      : endpoint.endsWith('/code-lists')
        ? { offices: [], branches: [], countries: [] }
        : [
            {
              id: 'v1',
              period: '2026-08',
              filing_type: 'DPHDP3',
              filing_mode: 'original',
              schema_version: '03.01.03',
              created_at: '2026-09-08',
            },
          ],
  );
  render(
    <MemoryRouter initialEntries={['/vat-filings?section=versions']}>
      <VatFilings />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Download XML' }));
  await waitFor(() =>
    expect(api.download).toHaveBeenCalledWith(
      '/vat-filings/versions/v1/xml',
      expect.any(String),
    ),
  );
  expect(api.post).not.toHaveBeenCalled();
});
it('renders Czech labels and allows URL navigation to the taxpayer form', async () => {
  await i18n.changeLanguage('cs');
  render(
    <MemoryRouter initialEntries={['/vat-filings?section=profile']}>
      <VatFilings />
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText('Registrace k DPH')).toBeInTheDocument();
  expect(screen.getByLabelText('Zdaňovací období')).toBeInTheDocument();
});

it('saves tax dates entered by native date-picker input events', async () => {
  vi.mocked(api.get).mockImplementation(async (endpoint) =>
    endpoint.endsWith('/workspace')
      ? {
          profile: null,
          vatPayer: true,
          documents: [
            {
              id: 'e1',
              direction: 'received',
              number: 'E1',
              clientName: 'Supplier',
              currency: 'CZK',
              total: 121,
              buckets: [{ rate: 21, base: 100, tax: 21 }],
              fingerprint: 'current',
              issueDate: '2026-08-01',
              metadata: null,
            },
          ],
        }
      : endpoint.endsWith('/code-lists')
        ? { offices: [], branches: [], countries: [] }
        : [],
  );
  render(
    <MemoryRouter
      initialEntries={['/vat-filings?section=documents&document=e1']}
    >
      <VatFilings />
    </MemoryRouter>,
  );
  const received = await screen.findByLabelText('Document receipt date');
  fireEvent.input(received, { target: { value: '2026-08-02' } });
  fireEvent.input(screen.getByLabelText('Tax point / duty to declare date'), {
    target: { value: '2026-08-01' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save reviewed tax data' }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      '/vat-filings/documents/received/e1',
      expect.objectContaining({
        receivedDate: '2026-08-02',
        taxPoint: '2026-08-01',
        fingerprint: 'current',
      }),
    ),
  );
});

it('opens first-time setup with existing user details and an enabled confirmation action', async () => {
  vi.mocked(api.get).mockImplementation(async (endpoint) =>
    endpoint.endsWith('/workspace')
      ? {
          profile: null,
          vatPayer: true,
          profileDefaults: {
            firstName: 'Jana',
            lastName: 'Nováková',
            vatId: 'CZ9001010007',
            email: 'jana@example.com',
            status: 'payer',
            street: 'Dlouhá',
            houseNumber: '123',
            houseOrientation: '4',
            postcode: '11000',
            city: 'Praha',
          },
          profileSourceAddress: 'Dlouhá 123/4, 110 00 Praha',
          documents: [],
        }
      : endpoint.endsWith('/code-lists')
        ? { offices: [], branches: [], countries: [] }
        : [],
  );
  render(
    <MemoryRouter>
      <VatFilings />
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText('First name')).toHaveValue('Jana');
  expect(screen.getByLabelText('VAT ID including country prefix')).toHaveValue(
    'CZ9001010007',
  );
  expect(screen.getByLabelText('VAT status')).toHaveValue('payer');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(api.put).not.toHaveBeenCalled();
});
it('saves edited expense buckets and classification together without losing either', async () => {
  vi.mocked(api.get).mockImplementation(async (endpoint) =>
    endpoint.endsWith('/workspace')
      ? {
          profile: null,
          vatPayer: true,
          documents: [
            {
              id: 'e1',
              direction: 'received',
              number: 'E1',
              clientName: 'Supplier',
              currency: 'CZK',
              total: 121,
              buckets: [{ rate: 21, base: 100, tax: 21 }],
              fingerprint: 'current',
              issueDate: '2026-08-01',
              metadata: null,
            },
          ],
        }
      : endpoint.endsWith('/code-lists')
        ? { offices: [], branches: [], countries: [] }
        : [],
  );
  render(
    <MemoryRouter
      initialEntries={['/vat-filings?section=documents&document=e1']}
    >
      <VatFilings />
    </MemoryRouter>,
  );
  fireEvent.change(await screen.findByLabelText('Transaction classification'), {
    target: { value: 'domestic' },
  });
  fireEvent.change(screen.getByLabelText('Rate % 1'), {
    target: { value: '12' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save reviewed tax data' }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      '/vat-filings/documents/received/e1',
      expect.objectContaining({
        classification: 'domestic',
        buckets: [{ rate: 12, base: 100, tax: 21 }],
        fingerprint: 'current',
      }),
    ),
  );
  expect(api.put).toHaveBeenCalledTimes(1);
});
it('lets a failed workspace load recover without a blank screen', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('vat_service_failed'));
  render(
    <MemoryRouter>
      <VatFilings />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Reload current data' }),
  );
  expect(await screen.findByLabelText('First name')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
