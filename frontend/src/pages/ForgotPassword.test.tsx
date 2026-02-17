import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="filetext-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  CheckCircle: () => <span data-testid="check-icon" />,
}));

const mockPost = vi.fn();
vi.mock('../utils/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

function renderForgotPassword() {
  return render(
    <BrowserRouter>
      <ForgotPassword />
    </BrowserRouter>
  );
}

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the forgot password form', () => {
    renderForgotPassword();

    expect(screen.getByRole('heading', { name: /essentialInvoice/ })).toBeInTheDocument();
    expect(screen.getByText(/Obnovení hesla/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odeslat odkaz pro obnovení/ })).toBeInTheDocument();
  });

  it('renders back to login link', () => {
    renderForgotPassword();

    expect(screen.getByText(/Zpět na přihlášení/)).toBeInTheDocument();
  });

  it('shows success message after submitting', async () => {
    mockPost.mockResolvedValueOnce({ message: 'OK' });
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Odeslat odkaz pro obnovení/ }));

    await waitFor(() => {
      expect(screen.getByText(/odkaz pro obnovení hesla/)).toBeInTheDocument();
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'test@example.com' });
  });

  it('shows error message on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Server error'));
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Odeslat odkaz pro obnovení/ }));

    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeInTheDocument();
    });
  });
});
