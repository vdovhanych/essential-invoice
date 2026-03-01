import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import ResetPassword from './ResetPassword';

// Mock sonner
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="filetext-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  CheckCircle: () => <span data-testid="check-icon" />,
  Sun: () => <span data-testid="sun-icon" />,
  Moon: () => <span data-testid="moon-icon" />,
  Monitor: () => <span data-testid="monitor-icon" />,
  ChevronDown: () => <span data-testid="chevrondown-icon" />,
}));

const mockPost = vi.fn();
vi.mock('../utils/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

function renderResetPassword(token?: string) {
  const initialEntries = token
    ? [`/reset-password?token=${token}`]
    : ['/reset-password'];

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <ResetPassword />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('ResetPassword Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when no token is provided', () => {
    renderResetPassword();

    expect(screen.getByText(/Neplatný odkaz pro obnovení hesla/)).toBeInTheDocument();
    expect(screen.getByText(/Požádat o nový odkaz/)).toBeInTheDocument();
  });

  it('renders password form when token is provided', () => {
    renderResetPassword('valid-token');

    expect(screen.getByText(/Nastavení nového hesla/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nové heslo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Potvrzení hesla/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nastavit nové heslo/ })).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderResetPassword('valid-token');

    fireEvent.change(screen.getByLabelText(/Nové heslo/), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Potvrzení hesla/), { target: { value: 'different456' } });

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Hesla se neshodují');
    });

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    renderResetPassword('valid-token');

    fireEvent.change(screen.getByLabelText(/Nové heslo/), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Potvrzení hesla/), { target: { value: 'short' } });

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Heslo musí mít alespoň 8 znaků');
    });

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('submits successfully with valid token and matching passwords', async () => {
    mockPost.mockResolvedValueOnce({ message: 'OK' });
    renderResetPassword('valid-token');

    fireEvent.change(screen.getByLabelText(/Nové heslo/), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText(/Potvrzení hesla/), { target: { value: 'newpassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /Nastavit nové heslo/ }));

    await waitFor(() => {
      expect(screen.getByText(/Heslo bylo úspěšně změněno/)).toBeInTheDocument();
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'valid-token',
      password: 'newpassword123',
    });
  });

  it('shows error on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Token expired'));
    renderResetPassword('expired-token');

    fireEvent.change(screen.getByLabelText(/Nové heslo/), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText(/Potvrzení hesla/), { target: { value: 'newpassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /Nastavit nové heslo/ }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Token expired');
    });
  });
});
