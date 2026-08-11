import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvoiceDetail from './InvoiceDetail';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockGet = vi.fn();
vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    delete: vi.fn(),
    download: vi.fn(),
  },
}));

vi.mock('../context/AIContext', () => ({
  useAI: () => ({ aiStatus: { available: false }, draftReminder: vi.fn() }),
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    ArrowLeft: icon('arrowleft'),
    Download: icon('download'),
    Send: icon('send'),
    Edit: icon('edit'),
    Copy: icon('copy'),
    CheckCircle: icon('checkcircle'),
    XCircle: icon('xcircle'),
    ChevronDown: icon('chevrondown'),
    Mail: icon('mail'),
    Sparkles: icon('sparkles'),
  };
});

const baseInvoice = {
  id: 'inv-1',
  invoiceNumber: '2026-042',
  variableSymbol: '2026042',
  status: 'sent',
  currency: 'CZK',
  clientId: 'client-1',
  clientName: 'Ateliér Vlna',
  clientEmail: 'vlna@example.com',
  clientSecondaryEmail: null,
  clientAddress: 'Dlouhá 12\nPraha',
  clientIco: '12345678',
  clientDic: 'CZ12345678',
  issueDate: '2026-07-01',
  dueDate: '2026-07-15',
  deliveryDate: '2026-07-01',
  subtotal: 10000,
  vatRate: 21,
  vatAmount: 2100,
  total: 12100,
  notes: '',
  sentAt: '2026-07-01T12:00:00Z',
  paidAt: null,
  createdAt: '2026-07-01T10:00:00Z',
  exchangeRate: null,
  totalCzk: null,
  items: [
    { id: 'item-1', description: 'Konzultace', quantity: 6, unit: 'hod', unitPrice: 1000, total: 6000 },
  ],
};

function renderPage(invoice: Record<string, unknown>) {
  mockGet.mockResolvedValue(invoice);
  return render(
    <MemoryRouter initialEntries={['/invoices/inv-1']}>
      <Routes>
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvoiceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the timeline with created, sent and awaiting events for a sent invoice', async () => {
    renderPage(baseInvoice);
    expect(await screen.findByText('Průběh')).toBeInTheDocument();
    expect(screen.getByText('Vytvořeno')).toBeInTheDocument();
    // "Odesláno" appears as both the status badge and the timeline event
    expect(screen.getAllByText('Odesláno').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Čeká na zaplacení')).toBeInTheDocument();
    expect(screen.queryByText('Uplynula splatnost')).not.toBeInTheDocument();
    // Sent event carries the recipient (also appears in the client card)
    expect(screen.getAllByText(/vlna@example\.com/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the due-date-passed event and days-overdue pill for overdue invoices', async () => {
    const dueDate = new Date(Date.now() - 11 * 86400000).toISOString().slice(0, 10);
    renderPage({ ...baseInvoice, status: 'overdue', dueDate });
    expect(await screen.findByText('Uplynula splatnost')).toBeInTheDocument();
    expect(screen.getAllByText('11 dní po splatnosti').length).toBeGreaterThan(0);
  });

  it('renders a paid event and no mark-paid actions for paid invoices', async () => {
    renderPage({ ...baseInvoice, status: 'paid', paidAt: '2026-07-10T09:00:00Z' });
    expect(await screen.findByText('Průběh')).toBeInTheDocument();
    expect(screen.queryByText('Čeká na zaplacení')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Označit jako zaplacenou' })).not.toBeInTheDocument();
  });

  it('demotes cancel and delete to text links', async () => {
    renderPage(baseInvoice);
    const cancelLink = await screen.findByText('Zrušit fakturu');
    const deleteLink = screen.getByText('Smazat fakturu');
    expect(cancelLink.tagName).toBe('BUTTON');
    expect(cancelLink.className).not.toContain('btn');
    expect(deleteLink.className).toContain('text-danger');
  });
});
