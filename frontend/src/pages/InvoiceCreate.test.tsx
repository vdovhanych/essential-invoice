import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvoiceCreate from './InvoiceCreate';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Jan Novák' } }),
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    ArrowLeft: icon('arrowleft'),
    QrCode: icon('qrcode'),
    Info: icon('info'),
    Plus: icon('plus'),
    X: icon('x'),
  };
});

const clients = [
  {
    id: 'client-1',
    companyName: 'Ateliér Vlna',
    primaryEmail: 'vlna@example.com',
    secondaryEmail: null,
    address: 'Dlouhá 12, Praha',
    ico: '12345678',
    dic: 'CZ12345678',
  },
];

const settings = { defaultVatRate: 21, defaultPaymentTerms: 14 };

const dashboard = {
  pausalniDan: { enabled: true, tier: 1, limit: 1500000, invoicedThisYear: 800000, remaining: 700000 },
};

function setupApi() {
  mockGet.mockImplementation((url: string) => {
    if (url === '/clients') return Promise.resolve(clients);
    if (url === '/settings') return Promise.resolve(settings);
    if (url === '/dashboard') return Promise.resolve(dashboard);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/invoices/new']}>
      <Routes>
        <Route path="/invoices/new" element={<InvoiceCreate />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvoiceCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockPost.mockReset();
    setupApi();
  });

  it('shows the Default pill while the VAT rate equals the settings default', async () => {
    renderPage();
    expect(await screen.findByText('Výchozí')).toBeInTheDocument();

    // Changing the rate away from the default drops the pill
    const vatSelects = screen.getAllByRole('combobox').filter(el => (el as HTMLSelectElement).name === 'vatRate');
    fireEvent.change(vatSelects[0], { target: { value: '12' } });
    expect(screen.queryByText('Výchozí')).not.toBeInTheDocument();

    // And back
    fireEvent.change(vatSelects[0], { target: { value: '21' } });
    expect(screen.getByText('Výchozí')).toBeInTheDocument();
  });

  it('shows the tier impact note recomputed from the items', async () => {
    renderPage();
    await screen.findByText('Výchozí');

    // Fill an item worth 100 000 → 121 000 with VAT → 921 000 of 1 500 000 = 61%
    fireEvent.change(screen.getAllByLabelText('Popis *')[0], { target: { value: 'Konzultace' } });
    fireEvent.change(screen.getAllByLabelText('Cena za jednotku *')[0], { target: { value: '100000' } });

    await waitFor(() => {
      expect(screen.getByText(/61\s?% limitu paušální daně/)).toBeInTheDocument();
    });
  });

  it('switches the tier note to the crossing warning when over the limit', async () => {
    renderPage();
    await screen.findByText('Výchozí');

    fireEvent.change(screen.getAllByLabelText('Popis *')[0], { target: { value: 'Velká zakázka' } });
    fireEvent.change(screen.getAllByLabelText('Cena za jednotku *')[0], { target: { value: '800000' } });

    await waitFor(() => {
      expect(screen.getByText(/nad limit paušální daně/)).toBeInTheDocument();
    });
  });

  it('adds a row when tabbing out of the last price field', async () => {
    renderPage();
    await screen.findByText('Výchozí');

    expect(screen.getAllByLabelText('Popis *')).toHaveLength(1);
    const priceInput = screen.getAllByLabelText('Cena za jednotku *')[0];
    fireEvent.keyDown(priceInput, { key: 'Tab' });
    expect(screen.getAllByLabelText('Popis *')).toHaveLength(2);
  });

  it('renders the QR always-included statement, not a toggle', async () => {
    renderPage();
    await screen.findByText('Výchozí');
    expect(screen.getByText('QR platební kód je vždy součástí PDF.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
