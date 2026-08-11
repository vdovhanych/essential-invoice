import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Expenses from './Expenses';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockGet = vi.fn();
vi.mock('../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    Plus: icon('plus'),
    Search: icon('search'),
    Receipt: icon('receipt'),
    FileImage: icon('fileimage'),
    ImageOff: icon('imageoff'),
    Info: icon('info'),
  };
});

const year = new Date().getFullYear();

const expense = (over: Record<string, unknown>) => ({
  id: 'exp-1',
  expenseNumber: 'N-2026-001',
  supplierInvoiceNumber: 'FV-123',
  status: 'paid',
  currency: 'CZK',
  clientId: 'client-1',
  clientName: 'ALZA.CZ',
  issueDate: `${year}-07-18`,
  dueDate: `${year}-08-01`,
  total: 9490,
  hasFile: true,
  ...over,
});

const mockExpenses = [
  expense({}),
  expense({
    id: 'exp-2',
    expenseNumber: 'N-2026-002',
    clientName: 'Datart',
    status: 'unpaid',
    hasFile: false,
    issueDate: `${year}-06-05`,
    total: 2000,
  }),
];

function setupApi(flatRate = true) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/expenses') return Promise.resolve(mockExpenses);
    if (url === '/dashboard') return Promise.resolve({ pausalniDan: { enabled: flatRate } });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function renderPage() {
  return render(
    <BrowserRouter>
      <Expenses />
    </BrowserRouter>
  );
}

describe('Expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    setupApi();
  });

  it('groups expenses by month with totals', async () => {
    renderPage();
    expect(await screen.findByText('ALZA.CZ')).toBeInTheDocument();
    // Two different months → two group headers with counts
    expect(screen.getByText(/červenec|July/i)).toBeInTheDocument();
    expect(screen.getByText(/červen |June/i)).toBeInTheDocument();
  });

  it('marks missing receipts as the danger state', async () => {
    renderPage();
    await screen.findByText('ALZA.CZ');
    expect(screen.getByText('Chybí doklad')).toBeInTheDocument();
    expect(screen.getByTestId('imageoff-icon')).toBeInTheDocument();
    expect(screen.getByTestId('fileimage-icon')).toBeInTheDocument();
  });

  it('filters by the no-receipt chip with a live count', async () => {
    renderPage();
    await screen.findByText('ALZA.CZ');
    fireEvent.click(screen.getByRole('button', { name: /Bez dokladu 1/ }));
    expect(screen.queryByText('ALZA.CZ')).not.toBeInTheDocument();
    expect(screen.getByText('Datart')).toBeInTheDocument();
  });

  it('shows the flat-rate banner and hides it after dismissal', async () => {
    renderPage();
    await screen.findByText('ALZA.CZ');
    expect(screen.getByText(/paušální daň/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Skrýt'));
    expect(screen.queryByText(/Platíte paušální daň/)).not.toBeInTheDocument();
  });

  it('hides the banner when not on flat rate', async () => {
    setupApi(false);
    renderPage();
    await screen.findByText('ALZA.CZ');
    expect(screen.queryByText(/Platíte paušální daň/)).not.toBeInTheDocument();
  });
});
