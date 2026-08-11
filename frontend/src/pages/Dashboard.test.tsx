import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockGet = vi.fn();
vi.mock('../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon" />,
  FilePlus: () => <span data-testid="fileplus-icon" />,
  CheckCircle: () => <span data-testid="checkcircle-icon" />,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Jan Novák', companyIco: '12345678' } }),
}));

const year = new Date().getFullYear();

const baseData = {
  stats: {
    draftCount: 1,
    sentCount: 4,
    paidCount: 34,
    overdueCount: 2,
    cancelledCount: 0,
    outstandingAmount: 255000,
    overdueAmount: 76000,
    paidAmount: 842300,
    paidThisMonth: 118000,
  },
  recentInvoices: [
    {
      id: 'inv-1',
      invoiceNumber: '2026-041',
      status: 'sent',
      currency: 'CZK',
      total: 38000,
      issueDate: `${year}-08-01`,
      dueDate: `${year}-08-15`,
      clientName: 'Ateliér Vlna',
    },
  ],
  monthlyRevenue: [{ month: `${year}-07-01`, revenue: 120000, invoiceCount: 3 }],
  monthlyExpenses: [{ month: `${year}-07-01`, expenses: 9600, expenseCount: 4 }],
  yearlyExpenses: 84200,
  unmatchedPayments: 3,
  pausalniDan: {
    enabled: true,
    tier: 1,
    limit: 1500000,
    invoicedThisYear: 842300,
    remaining: 657700,
  },
};

function renderPage() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(baseData);
  });

  it('renders the hero outstanding figure with the awaiting sub-line', async () => {
    renderPage();
    expect(await screen.findByText(/255\s?000/)).toBeInTheDocument();
    expect(screen.getByText(/6 faktur čeká na zaplacení/)).toBeInTheDocument();
    expect(screen.getByText(/2 po splatnosti/)).toBeInTheDocument();
  });

  it('renders the three secondary tiles including the unmatched match link', async () => {
    renderPage();
    await screen.findByText(/255\s?000/);
    expect(screen.getByText('Zaplaceno tento měsíc')).toBeInTheDocument();
    expect(screen.getByText(/76\s?000/)).toBeInTheDocument();
    expect(screen.getByText('Nespárováno')).toBeInTheDocument();
    const matchLink = screen.getByText('spárovat');
    expect(matchLink.closest('a')).toHaveAttribute('href', '/payments');
  });

  it('shows the tier footnote inside the tier when pace is under the limit', async () => {
    renderPage();
    await screen.findByText(/255\s?000/);
    // 842 300 over 8 months → ~1 263 450 projected, inside the 1 500 000 limit
    expect(screen.getByText(/v pásmu 1/)).toBeInTheDocument();
    expect(screen.getByText(/657\s?700.*rezerva|rezerva/)).toBeInTheDocument();
    expect(screen.getByTestId('pace-marker').className).toContain('bg-text-faint');
  });

  it('switches the pace caption and marker to danger when projection crosses the limit', async () => {
    mockGet.mockResolvedValue({
      ...baseData,
      pausalniDan: { ...baseData.pausalniDan, limit: 900000, remaining: 57700 },
    });
    renderPage();
    await screen.findByText(/255\s?000/);
    expect(screen.getByText(/překročí pásmo 1/)).toBeInTheDocument();
    expect(screen.getByTestId('pace-marker').className).toContain('bg-danger');
  });

  it('hides the tier footnote when paušální daň is disabled', async () => {
    mockGet.mockResolvedValue({
      ...baseData,
      pausalniDan: { ...baseData.pausalniDan, enabled: false },
    });
    renderPage();
    await screen.findByText(/255\s?000/);
    expect(screen.queryByTestId('pace-marker')).not.toBeInTheDocument();
  });

  it('shows the first-run empty state describing what will appear', async () => {
    mockGet.mockResolvedValue({
      ...baseData,
      stats: {
        ...baseData.stats,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0,
        overdueCount: 0,
        cancelledCount: 0,
      },
      recentInvoices: [],
    });
    renderPage();
    expect(await screen.findByText('Zatím žádné faktury')).toBeInTheDocument();
    // Describes the reward rather than just saying the list is empty
    expect(screen.getByText(/graf tržeb za rok/)).toBeInTheDocument();
    expect(screen.getByText('Vystavit první fakturu')).toBeInTheDocument();
    // The hero figure is not rendered in the empty state
    expect(screen.queryByTestId('pace-marker')).not.toBeInTheDocument();
  });

  it('shows the setup checklist with completed items struck through', async () => {
    mockGet.mockResolvedValue({
      ...baseData,
      stats: {
        ...baseData.stats,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0,
        overdueCount: 0,
        cancelledCount: 0,
      },
      recentInvoices: [],
    });
    renderPage();
    // The mocked user has companyIco set but no bank account or logo → 1 of 3
    expect(await screen.findByText('Nastavení · 1 z 3')).toBeInTheDocument();

    const doneItem = screen.getByText('Firemní údaje');
    expect(doneItem.className).toContain('line-through');

    const openItem = screen.getByText('Bankovní účet pro platby');
    expect(openItem.className).not.toContain('line-through');
    // Open items carry an action link
    expect(screen.getAllByText('Doplnit').length).toBe(2);
  });

  it('renders recent invoices with initials avatar and due date', async () => {
    renderPage();
    await screen.findByText(/255\s?000/);
    expect(screen.getByText('AV')).toBeInTheDocument();
    expect(screen.getByText('Ateliér Vlna')).toBeInTheDocument();
    expect(screen.getByText(/2026-041 · splatnost/)).toBeInTheDocument();
  });
});
