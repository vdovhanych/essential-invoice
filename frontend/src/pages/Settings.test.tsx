import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from './Settings';

// Mock the API
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: vi.fn()
  }
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="mail-icon" />,
  Server: () => <span data-testid="server-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  CheckCircle: () => <span data-testid="check-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  Calculator: () => <span data-testid="calculator-icon" />
}));

const getVatSelect = () => document.querySelector('select[name="defaultVatRate"]') as HTMLSelectElement;

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and display defaultVatRate: 0 correctly', async () => {
    mockGet.mockResolvedValueOnce({
      smtpHost: null,
      smtpPort: 587,
      smtpUser: null,
      smtpPasswordSet: false,
      smtpSecure: true,
      smtpFromEmail: null,
      smtpFromName: null,
      imapHost: null,
      imapPort: 993,
      imapUser: null,
      imapPasswordSet: false,
      imapTls: true,
      bankNotificationEmail: null,
      emailPollingInterval: 300,
      invoiceNumberPrefix: '',
      invoiceNumberFormat: 'YYYYMM##',
      defaultVatRate: 0, // VAT rate is 0
      defaultPaymentTerms: 14,
      emailTemplate: null,
      calculatorEnabled: false
    });

    render(<Settings />);

    await waitFor(() => {
      const vatSelect = getVatSelect();
      expect(vatSelect).toBeTruthy();
      expect(vatSelect.value).toBe('0');
    });
  });

  it('should save defaultVatRate: 0 and reload correctly', async () => {
    // Initial load with VAT 21
    mockGet.mockResolvedValueOnce({
      smtpHost: null,
      smtpPort: 587,
      smtpUser: null,
      smtpPasswordSet: false,
      smtpSecure: true,
      smtpFromEmail: null,
      smtpFromName: null,
      imapHost: null,
      imapPort: 993,
      imapUser: null,
      imapPasswordSet: false,
      imapTls: true,
      bankNotificationEmail: null,
      emailPollingInterval: 300,
      invoiceNumberPrefix: '',
      invoiceNumberFormat: 'YYYYMM##',
      defaultVatRate: 21,
      defaultPaymentTerms: 14,
      emailTemplate: null,
      calculatorEnabled: false
    });

    mockPut.mockResolvedValueOnce({ message: 'Settings updated successfully' });

    // After save, backend returns with VAT 0
    mockGet.mockResolvedValueOnce({
      smtpHost: null,
      smtpPort: 587,
      smtpUser: null,
      smtpPasswordSet: false,
      smtpSecure: true,
      smtpFromEmail: null,
      smtpFromName: null,
      imapHost: null,
      imapPort: 993,
      imapUser: null,
      imapPasswordSet: false,
      imapTls: true,
      bankNotificationEmail: null,
      emailPollingInterval: 300,
      invoiceNumberPrefix: '',
      invoiceNumberFormat: 'YYYYMM##',
      defaultVatRate: 0, // Now 0 after save
      defaultPaymentTerms: 14,
      emailTemplate: null,
      calculatorEnabled: false
    });

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      const vatSelect = getVatSelect();
      expect(vatSelect).toBeTruthy();
      expect(vatSelect.value).toBe('21');
    });

    // Change VAT to 0%
    const vatSelect = getVatSelect();
    fireEvent.change(vatSelect, { target: { value: '0' } });

    expect(vatSelect.value).toBe('0');

    // Click save
    const saveButton = screen.getByRole('button', { name: /uložit nastavení/i });
    fireEvent.click(saveButton);

    // Wait for save and reload
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/settings', expect.objectContaining({
        defaultVatRate: 0
      }));
    });

    // After reload, VAT should still be 0
    await waitFor(() => {
      expect(getVatSelect().value).toBe('0');
    });
  });
});
