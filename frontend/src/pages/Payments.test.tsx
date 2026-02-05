import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Payments from './Payments';

// Mock the API
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    put: vi.fn()
  }
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CreditCard: () => <span data-testid="creditcard-icon" />,
  Search: () => <span data-testid="search-icon" />,
  Link2: () => <span data-testid="link2-icon" />,
  Unlink: () => <span data-testid="unlink-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  CheckCircle: () => <span data-testid="check-icon" />,
  X: () => <span data-testid="x-icon" />,
  RefreshCw: () => <span data-testid="refresh-icon" />,
  Trash2: () => <span data-testid="trash-icon" />
}));

const mockPayments = [
  {
    id: 'payment-1',
    invoiceId: null,
    invoiceNumber: null,
    amount: 10000,
    currency: 'CZK',
    variableSymbol: '202601001',
    senderName: 'Test Client',
    senderAccount: '123456/0100',
    message: 'Payment for invoice',
    transactionCode: 'TRX123',
    transactionDate: '2026-01-15',
    matchedAt: null,
    matchMethod: null
  },
  {
    id: 'payment-2',
    invoiceId: 'invoice-1',
    invoiceNumber: '202601001',
    amount: 20000,
    currency: 'CZK',
    variableSymbol: '202601002',
    senderName: 'Another Client',
    senderAccount: '654321/0100',
    message: null,
    transactionCode: 'TRX456',
    transactionDate: '2026-01-20',
    matchedAt: '2026-01-20T10:00:00Z',
    matchMethod: 'automatic'
  }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Payments Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('should render payments list', async () => {
    mockGet.mockResolvedValueOnce(mockPayments);

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
      expect(screen.getByText('Another Client')).toBeInTheDocument();
    });
  });

  it('should show delete button for unmatched payments', async () => {
    mockGet.mockResolvedValueOnce(mockPayments);

    renderWithRouter(<Payments />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByTitle('Smazat platbu');
      // Only unmatched payment should have delete button
      expect(deleteButtons).toHaveLength(1);
    });
  });

  it('should not show delete button for matched payments', async () => {
    mockGet.mockResolvedValueOnce([mockPayments[1]]); // Only matched payment

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.queryByTitle('Smazat platbu')).not.toBeInTheDocument();
      expect(screen.getByTitle('Zrušit spárování')).toBeInTheDocument();
    });
  });

  it('should delete unmatched payment successfully', async () => {
    mockGet
      .mockResolvedValueOnce(mockPayments)
      .mockResolvedValueOnce([mockPayments[1]]); // After delete, only matched payment remains
    mockDelete.mockResolvedValueOnce({ message: 'Payment deleted successfully' });

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByTitle('Smazat platbu');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/payments/payment-1');
      expect(screen.getByText('Platba byla smazána')).toBeInTheDocument();
    });

    // Verify payments list is reloaded
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  it('should show confirmation dialog before deleting', async () => {
    const mockConfirm = vi.fn(() => false); // User cancels
    vi.stubGlobal('confirm', mockConfirm);

    mockGet.mockResolvedValueOnce(mockPayments);

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Smazat platbu');
    fireEvent.click(deleteButton);

    expect(mockConfirm).toHaveBeenCalledWith(
      'Opravdu chcete smazat tuto platbu? Tuto akci nelze vrátit zpět.'
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should handle delete error', async () => {
    mockGet.mockResolvedValueOnce(mockPayments);
    mockDelete.mockRejectedValueOnce(new Error('Failed to delete payment'));

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Smazat platbu');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete payment')).toBeInTheDocument();
    });
  });

  it('should unmatch a matched payment', async () => {
    mockGet
      .mockResolvedValueOnce([mockPayments[1]])
      .mockResolvedValueOnce([{ ...mockPayments[1], invoiceId: null, matchedAt: null }]);
    mockPost.mockResolvedValueOnce({ message: 'Payment unmatched successfully' });

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Another Client')).toBeInTheDocument();
    });

    const unmatchButton = screen.getByTitle('Zrušit spárování');
    fireEvent.click(unmatchButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/payments/payment-2/unmatch');
      expect(screen.getByText('Spárování bylo zrušeno')).toBeInTheDocument();
    });
  });

  it('should filter unmatched payments', async () => {
    mockGet
      .mockResolvedValueOnce(mockPayments)
      .mockResolvedValueOnce([mockPayments[0]]); // Only unmatched

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    const unmatchedFilterButton = screen.getByRole('button', { name: 'Nespárované' });
    fireEvent.click(unmatchedFilterButton);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/payments?matched=false');
    });
  });

  it('should filter matched payments', async () => {
    mockGet
      .mockResolvedValueOnce(mockPayments)
      .mockResolvedValueOnce([mockPayments[1]]); // Only matched

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    const matchedFilterButton = screen.getByRole('button', { name: 'Spárované' });
    fireEvent.click(matchedFilterButton);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/payments?matched=true');
    });
  });

  it('should search payments by sender name', async () => {
    mockGet.mockResolvedValueOnce(mockPayments);

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
      expect(screen.getByText('Another Client')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Hledat platby...');
    fireEvent.change(searchInput, { target: { value: 'Test Client' } });

    // Only first payment should be visible (sender name is "Test Client")
    expect(screen.getByText('Test Client')).toBeInTheDocument();
    expect(screen.queryByText('Another Client')).not.toBeInTheDocument();
  });

  it('should check for new payments via email', async () => {
    mockGet.mockResolvedValueOnce(mockPayments).mockResolvedValueOnce(mockPayments);
    mockPost.mockResolvedValueOnce({ message: 'Email check completed', processed: 2 });

    renderWithRouter(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    const checkEmailButton = screen.getByRole('button', { name: /zkontrolovat emaily/i });
    fireEvent.click(checkEmailButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/payments/check-emails');
      expect(screen.getByText(/kontrola emailů dokončena/i)).toBeInTheDocument();
    });
  });
});
