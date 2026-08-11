import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Invoices from './Invoices';

// Mock sonner
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Mock the API
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDownload = vi.fn();
vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    download: (...args: unknown[]) => mockDownload(...args),
  },
}));

// The recurring tab renders a separate page; keep it out of scope
vi.mock('./RecurringInvoices', () => ({
  default: () => <div data-testid="recurring-page" />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon" />,
  Search: () => <span data-testid="search-icon" />,
  FileText: () => <span data-testid="filetext-icon" />,
  Download: () => <span data-testid="download-icon" />,
  Check: () => <span data-testid="check-icon" />,
}));

const invoice = (over: Record<string, unknown>) => ({
  id: 'inv-1',
  invoiceNumber: '2026-001',
  variableSymbol: '2026001',
  status: 'sent',
  currency: 'CZK',
  clientId: 'client-1',
  clientName: 'Ateliér Vlna',
  clientEmail: 'vlna@example.com',
  issueDate: '2026-07-01',
  dueDate: '2026-07-15',
  total: 10000,
  totalCzk: null,
  createdAt: '2026-07-01T10:00:00Z',
  ...over,
});

const mockInvoices = [
  invoice({}),
  invoice({
    id: 'inv-2',
    invoiceNumber: '2026-002',
    clientName: 'Modrý Jelen',
    clientId: 'client-2',
    status: 'overdue',
    total: 5000,
  }),
  invoice({
    id: 'inv-3',
    invoiceNumber: '2026-003',
    clientName: 'Ateliér Vlna',
    status: 'paid',
    total: 20000,
  }),
];

function renderPage() {
  return render(
    <BrowserRouter>
      <Invoices />
    </BrowserRouter>
  );
}

describe('Invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(mockInvoices);
    mockPost.mockResolvedValue({});
  });

  it('renders invoice rows after loading', async () => {
    renderPage();
    expect(await screen.findAllByText('2026-001')).not.toHaveLength(0);
    expect(screen.getAllByText('Modrý Jelen').length).toBeGreaterThan(0);
    expect(mockGet).toHaveBeenCalledWith('/invoices');
  });

  it('shows the count summary with outstanding amount', async () => {
    renderPage();
    // 3 invoices, 10 000 (sent) + 5 000 (overdue) outstanding
    expect(await screen.findByText(/3 faktury ·/)).toBeInTheDocument();
  });

  it('shows live counts on the status segmented control', async () => {
    renderPage();
    await screen.findAllByText('2026-001');
    expect(screen.getByRole('button', { name: 'Vše 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Koncept 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Po splatnosti 1' })).toBeInTheDocument();
  });

  it('filters client-side by status without refetching', async () => {
    renderPage();
    await screen.findAllByText('2026-001');
    expect(mockGet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Po splatnosti 1' }));

    expect(screen.queryAllByText('2026-001')).toHaveLength(0);
    expect(screen.getAllByText('2026-002').length).toBeGreaterThan(0);
    expect(mockGet).toHaveBeenCalledTimes(1);
    // Counts stay based on the full list
    expect(screen.getByRole('button', { name: 'Vše 3' })).toBeInTheDocument();
  });

  it('filters by search across number and client name', async () => {
    renderPage();
    await screen.findAllByText('2026-001');

    const searchInputs = screen.getAllByPlaceholderText('Hledat faktury...');
    fireEvent.change(searchInputs[0], { target: { value: 'jelen' } });

    expect(screen.queryAllByText('2026-001')).toHaveLength(0);
    expect(screen.getAllByText('2026-002').length).toBeGreaterThan(0);
  });

  it('shows a filtered empty state with clear filters', async () => {
    renderPage();
    await screen.findAllByText('2026-001');

    const searchInputs = screen.getAllByPlaceholderText('Hledat faktury...');
    fireEvent.change(searchInputs[0], { target: { value: 'neexistuje' } });

    expect(screen.getAllByText('Žádné faktury neodpovídají filtrům').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('Zrušit filtry')[0]);
    expect(screen.getAllByText('2026-001').length).toBeGreaterThan(0);
  });

  it('shows the bulk bar when rows are selected and marks them paid', async () => {
    renderPage();
    await screen.findAllByText('2026-001');

    // Row checkboxes are labelled with the invoice number
    fireEvent.click(screen.getByRole('checkbox', { name: '2026-001' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '2026-002' }));

    expect(screen.getByText('Vybráno: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Označit jako zaplacené/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/invoices/inv-1/mark-paid', {});
      expect(mockPost).toHaveBeenCalledWith('/invoices/inv-2/mark-paid', {});
    });
    expect(mockToastSuccess).toHaveBeenCalled();
    // Selection cleared and list reloaded
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Vybráno: 2')).not.toBeInTheDocument();
  });

  it('select-all toggles every filtered row and skips paid invoices on mark paid', async () => {
    renderPage();
    await screen.findAllByText('2026-001');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Vybrat vše' }));
    expect(screen.getByText('Vybráno: 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Označit jako zaplacené/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(2); // inv-3 is already paid
    });
    expect(mockPost).not.toHaveBeenCalledWith('/invoices/inv-3/mark-paid', {});
  });

  it('shows the table footer with shown count', async () => {
    renderPage();
    await screen.findAllByText('2026-001');
    expect(screen.getByText('Zobrazeno 3 z 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Po splatnosti 1' }));
    expect(screen.getByText('Zobrazeno 1 z 3')).toBeInTheDocument();
  });
});
