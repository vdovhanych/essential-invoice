import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Onboarding from './Onboarding';

const mockUpdateProfile = vi.fn();
const mockRefreshUser = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Test User', email: 'test@test.com' },
    token: 'test-token',
    updateProfile: mockUpdateProfile,
    refreshUser: mockRefreshUser,
  })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../utils/api', () => ({
  api: {
    uploadFile: vi.fn(),
    delete: vi.fn(),
  }
}));

vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="filetext-icon" />,
  Building: () => <span data-testid="building-icon" />,
  CreditCard: () => <span data-testid="creditcard-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  Upload: () => <span data-testid="upload-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  ChevronRight: () => <span data-testid="chevronright-icon" />,
  ChevronLeft: () => <span data-testid="chevronleft-icon" />,
  Landmark: () => <span data-testid="landmark-icon" />,
}));

function renderOnboarding() {
  return render(
    <BrowserRouter>
      <Onboarding />
    </BrowserRouter>
  );
}

describe('Onboarding Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it('renders step 1 initially with company fields', () => {
    renderOnboarding();

    expect(screen.getByText('Firemní a daňové údaje')).toBeInTheDocument();
    expect(screen.getByText('Název firmy')).toBeInTheDocument();

    const icoInput = document.querySelector('input[name="companyIco"]') as HTMLInputElement;
    expect(icoInput).toBeTruthy();

    const dicInput = document.querySelector('input[name="companyDic"]') as HTMLInputElement;
    expect(dicInput).toBeTruthy();

    const addressTextarea = document.querySelector('textarea[name="companyAddress"]') as HTMLTextAreaElement;
    expect(addressTextarea).toBeTruthy();
  });

  it('DIČ field is disabled when vatPayer is unchecked', () => {
    renderOnboarding();

    const dicInput = document.querySelector('input[name="companyDic"]') as HTMLInputElement;
    expect(dicInput.disabled).toBe(true);
    expect(screen.getByText('DIČ není potřeba pro neplátce DPH')).toBeInTheDocument();
  });

  it('DIČ field is enabled when vatPayer is checked', () => {
    renderOnboarding();

    const vatPayerCheckbox = screen.getByLabelText('Jsem plátce DPH');
    fireEvent.click(vatPayerCheckbox);

    const dicInput = document.querySelector('input[name="companyDic"]') as HTMLInputElement;
    expect(dicInput.disabled).toBe(false);
  });

  it('Paušální daň tier/limit selects appear when enabled', () => {
    renderOnboarding();

    // Initially no tier/limit selects
    expect(document.querySelector('select[name="pausalniDanTier"]')).toBeNull();
    expect(document.querySelector('select[name="pausalniDanLimit"]')).toBeNull();

    // Check the paušální daň checkbox
    const pausalniCheckbox = screen.getByLabelText('Používám paušální daň');
    fireEvent.click(pausalniCheckbox);

    // Now tier and limit selects should appear
    expect(document.querySelector('select[name="pausalniDanTier"]')).toBeTruthy();
    expect(document.querySelector('select[name="pausalniDanLimit"]')).toBeTruthy();
    expect(screen.getByText('Pásmo paušální daně')).toBeInTheDocument();
    expect(screen.getByText('Limit příjmů')).toBeInTheDocument();
  });

  it('clicking "Další" advances to step 2', () => {
    renderOnboarding();

    const nextButton = screen.getByText('Další');
    fireEvent.click(nextButton);

    // Step 2 heading should appear (use heading role to avoid matching progress indicator)
    expect(screen.getByRole('heading', { name: 'Bankovní údaje' })).toBeInTheDocument();
    // Bank fields should be present
    expect(document.querySelector('input[name="bankAccount"]')).toBeTruthy();
  });

  it('step 2 shows bank fields', () => {
    renderOnboarding();

    // Advance to step 2
    fireEvent.click(screen.getByText('Další'));

    const bankAccountInput = document.querySelector('input[name="bankAccount"]') as HTMLInputElement;
    expect(bankAccountInput).toBeTruthy();

    const bankCodeInput = document.querySelector('input[name="bankCode"]') as HTMLInputElement;
    expect(bankCodeInput).toBeTruthy();

    expect(screen.getByText('Číslo účtu')).toBeInTheDocument();
    expect(screen.getByText('Kód banky')).toBeInTheDocument();
    expect(screen.getByText('Logo firmy (volitelné)')).toBeInTheDocument();
  });

  it('clicking "Zpět" returns to step 1', () => {
    renderOnboarding();

    // Advance to step 2
    fireEvent.click(screen.getByText('Další'));
    expect(screen.getByRole('heading', { name: 'Bankovní údaje' })).toBeInTheDocument();

    // Go back to step 1
    fireEvent.click(screen.getByText('Zpět'));
    expect(screen.getByText('Firemní a daňové údaje')).toBeInTheDocument();
  });

  it('"Dokončit" calls updateProfile with onboardingCompleted: true', async () => {
    renderOnboarding();

    // Advance to step 2
    fireEvent.click(screen.getByText('Další'));

    // Click Dokončit
    fireEvent.click(screen.getByText('Dokončit'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingCompleted: true,
        })
      );
    });

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
