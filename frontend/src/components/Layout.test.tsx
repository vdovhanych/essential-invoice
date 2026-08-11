import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

const mockLogout = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Jan Dvořák', email: 'jan@test.cz' },
    logout: mockLogout,
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}));

vi.mock('../context/AIContext', () => ({
  useAI: () => ({ aiStatus: { available: false }, openAssistant: vi.fn() }),
}));

const mockGet = vi.fn();
vi.mock('../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

// Child components pull their own data; out of scope here
vi.mock('./AIAssistant', () => ({ default: () => null }));
vi.mock('./CommandPalette', () => ({ default: () => null }));
vi.mock('./MobileBottomNav', () => ({ default: () => null }));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    LayoutDashboard: icon('dashboard'),
    FileText: icon('filetext'),
    Users: icon('users'),
    CreditCard: icon('creditcard'),
    Settings: icon('settings'),
    LogOut: icon('logout'),
    User: icon('user'),
    ChevronDown: icon('chevron'),
    Calculator: icon('calculator'),
    Receipt: icon('receipt'),
    Sun: icon('sun'),
    Moon: icon('moon'),
    Monitor: icon('monitor'),
    Search: icon('search'),
    CloudOff: icon('cloudoff'),
  };
});

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>
  );
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockGet.mockImplementation((url: string) => {
      if (url === '/settings') return Promise.resolve({ calculatorEnabled: false });
      if (url === '/dashboard') return Promise.resolve({ unmatchedPayments: 3 });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it('renders the user in the sidebar footer with initials', async () => {
    renderLayout();
    expect(await screen.findByText('Jan Dvořák')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('opens the user menu upward from the sidebar footer', async () => {
    renderLayout();
    fireEvent.click(await screen.findByText('Jan Dvořák'));

    const profileLink = screen.getByText('Profil').closest('a');
    expect(profileLink).toHaveAttribute('href', '/profile');
    // The panel is anchored above the trigger
    expect(profileLink?.parentElement?.className).toContain('bottom-full');

    fireEvent.click(screen.getByText('Odhlásit se'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows the unmatched count as a badge on Payments', async () => {
    renderLayout();
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    expect(screen.getByText('3').closest('a')).toHaveAttribute('href', '/payments');
  });

  it('hides the badge when nothing needs review', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/settings') return Promise.resolve({ calculatorEnabled: false });
      if (url === '/dashboard') return Promise.resolve({ unmatchedPayments: 0 });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    renderLayout();
    await screen.findByText('Jan Dvořák');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
