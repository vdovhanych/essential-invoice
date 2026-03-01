import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Register from './Register';

// Mock sonner
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockRegister = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
  })
}));

vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="filetext-icon" />,
}));

function renderRegister() {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
}

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only name, email, password, confirm password fields', () => {
    renderRegister();

    expect(screen.getByLabelText(/Jméno/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Heslo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Potvrzení hesla/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrovat se/i })).toBeInTheDocument();
  });

  it('does not render company fields', () => {
    renderRegister();

    expect(document.querySelector('input[name="companyName"]')).toBeNull();
    expect(document.querySelector('input[name="companyIco"]')).toBeNull();
    expect(document.querySelector('input[name="companyDic"]')).toBeNull();
    expect(document.querySelector('textarea[name="companyAddress"]')).toBeNull();
    expect(document.querySelector('input[name="bankAccount"]')).toBeNull();
    expect(document.querySelector('input[name="bankCode"]')).toBeNull();

    expect(screen.queryByText('Název firmy')).not.toBeInTheDocument();
    expect(screen.queryByText('IČO')).not.toBeInTheDocument();
    expect(screen.queryByText('DIČ')).not.toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText(/Jméno/), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/^Heslo/), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Potvrzení hesla/), { target: { value: 'different456' } });

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Hesla se neshodují');
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });
});
