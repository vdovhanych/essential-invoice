import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CommandPalette from './CommandPalette';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGet = vi.fn();
vi.mock('../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    Search: icon('search'),
    FileText: icon('filetext'),
    FilePlus: icon('fileplus'),
    Users: icon('users'),
    UserPlus: icon('userplus'),
    Receipt: icon('receipt'),
    Settings: icon('settings'),
    LayoutDashboard: icon('dashboard'),
  };
});

const invoices = [
  {
    id: 'inv-1',
    invoiceNumber: '2026-041',
    clientName: 'Ateliér Vlna',
    status: 'sent',
    currency: 'CZK',
    total: 38000,
  },
  {
    id: 'inv-2',
    invoiceNumber: '2026-042',
    clientName: 'Modrý Jelen',
    status: 'paid',
    currency: 'CZK',
    total: 12000,
  },
];

const clients = [
  { id: 'client-1', companyName: 'Ateliér Vlna', ico: '12345678', openBalance: 38000 },
  { id: 'client-2', companyName: 'Modrý Jelen', ico: '87654321', openBalance: 0 },
];

function renderPalette(open = true) {
  const onClose = vi.fn();
  render(
    <BrowserRouter>
      <CommandPalette open={open} onClose={onClose} />
    </BrowserRouter>
  );
  return { onClose };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockGet.mockImplementation((url: string) => {
      if (url === '/invoices') return Promise.resolve(invoices);
      if (url === '/clients') return Promise.resolve(clients);
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it('renders nothing when closed', () => {
    renderPalette(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('loads invoices and contacts when opened', async () => {
    renderPalette();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/invoices');
      expect(mockGet).toHaveBeenCalledWith('/clients');
    });
    // Recent invoices show with an empty query
    expect(await screen.findByText(/2026-041/)).toBeInTheDocument();
    expect(screen.getByText('Akce')).toBeInTheDocument();
  });

  it('filters invoices and contacts by query', async () => {
    renderPalette();
    await screen.findByText(/2026-041/);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'jelen' } });

    expect(screen.getByText(/2026-042/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-041/)).not.toBeInTheDocument();
    // Contact group appears for a matching query
    expect(screen.getByText('Kontakty')).toBeInTheDocument();
  });

  it('offers a contextual new-invoice action for a matched contact', async () => {
    renderPalette();
    await screen.findByText(/2026-041/);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'vlna' } });

    const contextual = screen.getByText('Nová faktura pro');
    expect(contextual).toBeInTheDocument();
    fireEvent.click(contextual);
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/new?client=client-1');
  });

  it('navigates to the selected invoice on Enter', async () => {
    const { onClose } = renderPalette();
    await screen.findByText(/2026-041/);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/invoices/inv-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves the selection with arrow keys', async () => {
    renderPalette();
    await screen.findByText(/2026-041/);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/invoices/inv-2');
  });

  it('shows only actions when the query starts with >', async () => {
    renderPalette();
    await screen.findByText(/2026-041/);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '>' } });

    expect(screen.queryByText(/2026-041/)).not.toBeInTheDocument();
    expect(screen.getByText('Akce')).toBeInTheDocument();
    expect(screen.getByText('Nová faktura')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { onClose } = renderPalette();
    await screen.findByText(/2026-041/);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
