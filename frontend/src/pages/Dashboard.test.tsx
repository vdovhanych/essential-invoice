import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  ChevronLeft: () => <span data-testid="chevronleft-icon" />,
  ChevronRight: () => <span data-testid="chevronright-icon" />,
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
      // The footnote follows the chart's selected year, so the crossing has to come
      // from the monthly series — 2 000 000 outruns the 900 000 limit in any month
      monthlyRevenue: [{ month: `${year}-01-01`, revenue: 2000000, invoiceCount: 1 }],
      pausalniDan: { ...baseData.pausalniDan, limit: 900000, remaining: 0 },
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

  describe('revenue chart', () => {
    // The mock data puts 120 000 income and 9 600 expenses in July (index 6)
    const JULY = 6;

    it('shows income, expenses and net in the tooltip on hover', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);
      expect(screen.queryByTestId('month-tooltip')).not.toBeInTheDocument();

      fireEvent.pointerEnter(screen.getByTestId(`month-column-${JULY}`));

      const tooltip = within(screen.getByTestId('month-tooltip'));
      expect(tooltip.getByText('Příjmy')).toBeInTheDocument();
      expect(tooltip.getByText(/120\s?000/)).toBeInTheDocument();
      expect(tooltip.getByText('Výdaje')).toBeInTheDocument();
      expect(tooltip.getByText(/9\s?600/)).toBeInTheDocument();
      // Net = 120 000 − 9 600
      expect(tooltip.getByText(/110\s?400/)).toBeInTheDocument();

      fireEvent.pointerLeave(screen.getByTestId(`month-column-${JULY}`));
      expect(screen.queryByTestId('month-tooltip')).not.toBeInTheDocument();
    });

    it('uses inverting tokens for the tooltip so it works in both themes', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);
      fireEvent.pointerEnter(screen.getByTestId(`month-column-${JULY}`));

      const className = screen.getByTestId('month-tooltip').className;
      expect(className).toContain('bg-text');
      expect(className).toContain('text-canvas');
      expect(className).not.toContain('text-white');
    });

    it('blocks text selection on the plot so a resting finger is not a long-press', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);

      // The plot is the column's grandparent: column -> bar row -> plot
      const plot = screen.getByTestId(`month-column-${JULY}`).parentElement?.parentElement;
      expect(plot?.className).toContain('select-none');
      expect(plot?.className).toContain('[-webkit-touch-callout:none]');
    });

    it('pins the tooltip open on tap and releases it on a second tap', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);
      const july = screen.getByTestId(`month-column-${JULY}`);

      fireEvent.click(july);
      expect(screen.getByTestId('month-tooltip')).toBeInTheDocument();
      expect(july).toHaveAttribute('aria-pressed', 'true');

      // The pointer leaving must not take a pinned tooltip with it — on touch the
      // finger is gone the moment the tap lands
      fireEvent.pointerLeave(july);
      expect(screen.getByTestId('month-tooltip')).toBeInTheDocument();

      fireEvent.click(july);
      expect(screen.queryByTestId('month-tooltip')).not.toBeInTheDocument();
    });

    it('keeps a pinned month while the pointer wanders over other months', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);

      fireEvent.click(screen.getByTestId(`month-column-${JULY}`));
      fireEvent.pointerEnter(screen.getByTestId('month-column-0'));

      // Still July's numbers, not January's
      const tooltip = within(screen.getByTestId('month-tooltip'));
      expect(tooltip.getByText(/120\s?000/)).toBeInTheDocument();
    });

    it('moves the pin to another month when that month is tapped', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);

      fireEvent.click(screen.getByTestId(`month-column-${JULY}`));
      fireEvent.click(screen.getByTestId('month-column-0'));

      expect(screen.getByTestId(`month-column-${JULY}`)).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('month-column-0')).toHaveAttribute('aria-pressed', 'true');
    });

    it('unpins when tapping away from the chart', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);

      fireEvent.click(screen.getByTestId(`month-column-${JULY}`));
      expect(screen.getByTestId('month-tooltip')).toBeInTheDocument();

      fireEvent.pointerDown(document.body);
      expect(screen.queryByTestId('month-tooltip')).not.toBeInTheDocument();
    });

    it('unpins on Escape', async () => {
      renderPage();
      await screen.findByText(/255\s?000/);

      fireEvent.click(screen.getByTestId(`month-column-${JULY}`));
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByTestId('month-tooltip')).not.toBeInTheDocument();
    });

    it('orders the year picker oldest to newest so the latest year sits on the right', async () => {
      mockGet.mockResolvedValue({
        ...baseData,
        monthlyRevenue: [
          { month: `${year - 1}-03-01`, revenue: 50000, invoiceCount: 1 },
          { month: `${year}-07-01`, revenue: 120000, invoiceCount: 3 },
        ],
      });
      renderPage();
      await screen.findByText(/255\s?000/);

      const years = screen.getAllByRole('button').filter(b => /^\d{4}$/.test(b.textContent ?? ''));
      expect(years.map(b => b.textContent)).toEqual([String(year - 1), String(year)]);
      // The current year is the selected one
      expect(years[1].className).toContain('bg-surface-sunken');
    });

    it('pages further back through history than the three visible years', async () => {
      mockGet.mockResolvedValue({
        ...baseData,
        monthlyRevenue: [year - 3, year - 2, year - 1, year].map(y => ({
          month: `${y}-03-01`,
          revenue: 50000,
          invoiceCount: 1,
        })),
      });
      renderPage();
      await screen.findByText(/255\s?000/);

      const visibleYears = () =>
        screen
          .getAllByRole('button')
          .filter(b => /^\d{4}$/.test(b.textContent ?? ''))
          .map(b => b.textContent);

      // Only the newest three fit; the oldest is reachable via the chevron
      expect(visibleYears()).toEqual([String(year - 2), String(year - 1), String(year)]);

      fireEvent.click(screen.getByLabelText('Starší roky'));
      expect(visibleYears()).toEqual([String(year - 3), String(year - 2), String(year - 1)]);

      fireEvent.click(screen.getByLabelText('Novější roky'));
      expect(visibleYears()).toEqual([String(year - 2), String(year - 1), String(year)]);
    });

    it('reports the final outcome instead of a pace projection for a closed year', async () => {
      mockGet.mockResolvedValue({
        ...baseData,
        monthlyRevenue: [{ month: `${year - 1}-03-01`, revenue: 1800000, invoiceCount: 1 }],
        monthlyExpenses: [],
      });
      renderPage();
      await screen.findByText(/255\s?000/);

      // Current year still projects
      expect(screen.getByTestId('pace-marker')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: String(year - 1) }));

      // 1 800 000 against the 1 500 000 limit — the year is over, so no pace marker
      expect(screen.queryByTestId('pace-marker')).not.toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Rok ${year - 1} uzavřen`))).toBeInTheDocument();
      expect(screen.getByText(/pásmo 1 překročeno/)).toBeInTheDocument();
      expect(screen.getByText(/překročeno o 300\s?000/)).toBeInTheDocument();
      // The limit line tracks the selected year, not the current one
      expect(screen.getByText(/1\s?800\s?000.*z.*1\s?500\s?000/)).toBeInTheDocument();
    });
  });

  it('renders recent invoices with initials avatar and due date', async () => {
    renderPage();
    await screen.findByText(/255\s?000/);
    expect(screen.getByText('AV')).toBeInTheDocument();
    expect(screen.getByText('Ateliér Vlna')).toBeInTheDocument();
    expect(screen.getByText(/2026-041 · splatnost/)).toBeInTheDocument();
  });
});
