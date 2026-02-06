import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Profile from './Profile';

const mockUpdateProfile = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Test', email: 'test@test.com', vatPayer: undefined, pausalniDanEnabled: false },
    token: 'test-token',
    updateProfile: mockUpdateProfile,
    refreshUser: mockRefreshUser,
  })
}));

vi.mock('../utils/api', () => ({
  api: {
    post: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
  }
}));

vi.mock('lucide-react', () => ({
  User: () => <span data-testid="user-icon" />,
  Building: () => <span data-testid="building-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  CheckCircle: () => <span data-testid="check-icon" />,
  Upload: () => <span data-testid="upload-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Image: () => <span data-testid="image-icon" />,
  Landmark: () => <span data-testid="landmark-icon" />,
}));

describe('Profile Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders paušální daň section with "Používám paušální daň" checkbox', () => {
    render(<Profile />);

    expect(screen.getByText('Paušální daň')).toBeInTheDocument();
    expect(screen.getByLabelText('Používám paušální daň')).toBeInTheDocument();
  });

  it('vatPayer defaults to false for user with undefined vatPayer', () => {
    render(<Profile />);

    const vatPayerCheckbox = screen.getByLabelText('Jsem plátce DPH') as HTMLInputElement;
    expect(vatPayerCheckbox.checked).toBe(false);

    // DIČ field should be disabled since vatPayer is false
    const dicInput = document.querySelector('input[name="companyDic"]') as HTMLInputElement;
    expect(dicInput.disabled).toBe(true);
  });

  it('paušální daň fields appear when checkbox is checked', () => {
    render(<Profile />);

    // Initially no tier/limit selects
    expect(document.querySelector('select[name="pausalniDanTier"]')).toBeNull();
    expect(document.querySelector('select[name="pausalniDanLimit"]')).toBeNull();

    // Check the paušální daň checkbox
    const pausalniCheckbox = screen.getByLabelText('Používám paušální daň');
    fireEvent.click(pausalniCheckbox);

    // Tier and limit selects should now appear
    expect(document.querySelector('select[name="pausalniDanTier"]')).toBeTruthy();
    expect(document.querySelector('select[name="pausalniDanLimit"]')).toBeTruthy();
    expect(screen.getByText('Pásmo paušální daně')).toBeInTheDocument();
    expect(screen.getByText('Limit příjmů')).toBeInTheDocument();
  });
});
