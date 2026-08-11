import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Clients from './Clients';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockGet = vi.fn();
vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    Plus: icon('plus'),
    Search: icon('search'),
    Users: icon('users'),
    Edit: icon('edit'),
    Trash2: icon('trash'),
    X: icon('x'),
    FilePlus: icon('fileplus'),
  };
});

const client = (over: Record<string, unknown>) => ({
  id: 'client-1',
  companyName: 'Ateliér Vlna',
  primaryEmail: 'vlna@example.com',
  secondaryEmail: null,
  address: 'Praha',
  ico: '12345678',
  dic: 'CZ12345678',
  contactPerson: 'Jana Nováková',
  contactPhone: '',
  notes: '',
  invoiceCount: 8,
  totalPaid: 400000,
  totalInvoiced: 500000,
  openBalance: 74700,
  ...over,
});

const mockClients = [
  client({}),
  client({
    id: 'client-2',
    companyName: 'Modrý Jelen',
    ico: '87654321',
    invoiceCount: 4,
    totalInvoiced: 1000000,
    openBalance: 0,
  }),
];

describe('Clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(mockClients);
  });

  function renderPage() {
    return render(
      <BrowserRouter>
        <Clients />
      </BrowserRouter>
    );
  }

  it('renders the summary sub-line with total invoiced', async () => {
    renderPage();
    expect(await screen.findByText(/2 kontakty ·/)).toBeInTheDocument();
  });

  it('ranks contacts by revenue descending', async () => {
    renderPage();
    await screen.findAllByText('Ateliér Vlna');
    const names = screen
      .getAllByText(/Ateliér Vlna|Modrý Jelen/)
      .map((el) => el.textContent);
    // Modrý Jelen has higher revenue, so it must come first in both layouts
    expect(names[0]).toBe('Modrý Jelen');
  });

  it('shows open balance in danger only when outstanding', async () => {
    renderPage();
    await screen.findAllByText('Ateliér Vlna');
    // Both desktop row and mobile card render the amount; check one of each
    const openAmounts = screen.getAllByText(/74\s?700/);
    expect(openAmounts.length).toBeGreaterThan(0);
    expect(openAmounts[0].className).toContain('text-danger');
  });

  it('links the new-invoice action to a preselected client', async () => {
    renderPage();
    await screen.findAllByText('Ateliér Vlna');
    const links = screen.getAllByTitle('Nová faktura pro tento kontakt');
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/invoices/new?client='));
  });

  it('renders initials avatars', async () => {
    renderPage();
    await screen.findAllByText('Ateliér Vlna');
    expect(screen.getAllByText('AV').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MJ').length).toBeGreaterThan(0);
  });
});
