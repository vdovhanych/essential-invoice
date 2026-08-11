import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

const mockLogout = vi.fn();
const mockOpenAssistant = vi.fn();
const mockSetTheme = vi.fn();
let mockAIAvailable = true;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Test', email: 'test@test.com' },
    logout: mockLogout,
  })
}));

vi.mock('../context/AIContext', () => ({
  useAI: () => ({
    aiStatus: { available: mockAIAvailable },
    openAssistant: mockOpenAssistant,
  })
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: mockSetTheme,
  })
}));

vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <span data-testid="dashboard-icon" />,
  FileText: () => <span data-testid="filetext-icon" />,
  Users: () => <span data-testid="users-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
  MoreHorizontal: () => <span data-testid="more-icon" />,
  CreditCard: () => <span data-testid="creditcard-icon" />,
  Settings: () => <span data-testid="settings-icon" />,
  Receipt: () => <span data-testid="receipt-icon" />,
  Calculator: () => <span data-testid="calculator-icon" />,
  User: () => <span data-testid="user-icon" />,
  LogOut: () => <span data-testid="logout-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  Sun: () => <span data-testid="sun-icon" />,
  Moon: () => <span data-testid="moon-icon" />,
  Monitor: () => <span data-testid="monitor-icon" />,
}));

const renderNav = (props: { calculatorEnabled?: boolean } = {}, initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileBottomNav calculatorEnabled={props.calculatorEnabled ?? false} />
    </MemoryRouter>
  );

describe('MobileBottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAIAvailable = true;
  });

  it('renders the four tabs and the create button', () => {
    renderNav();

    expect(screen.getByText('Přehled')).toBeInTheDocument();
    expect(screen.getByText('Faktury')).toBeInTheDocument();
    expect(screen.getByText('Kontakty')).toBeInTheDocument();
    expect(screen.getByText('Více')).toBeInTheDocument();
    expect(screen.getByLabelText('Nová faktura')).toBeInTheDocument();
  });

  it('links the create button to the new invoice page', () => {
    renderNav();

    expect(screen.getByLabelText('Nová faktura')).toHaveAttribute('href', '/invoices/new');
  });

  it('opens the More sheet with secondary navigation and no calculator by default', () => {
    renderNav();

    fireEvent.click(screen.getByText('Více'));

    expect(screen.getByText('Náklady')).toBeInTheDocument();
    expect(screen.getByText('Platby')).toBeInTheDocument();
    expect(screen.getByText('Nastavení')).toBeInTheDocument();
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Odhlásit se')).toBeInTheDocument();
    expect(screen.queryByText('Kalkulačka')).not.toBeInTheDocument();
  });

  it('shows the calculator link in the More sheet when enabled', () => {
    renderNav({ calculatorEnabled: true });

    fireEvent.click(screen.getByText('Více'));

    expect(screen.getByText('Kalkulačka')).toBeInTheDocument();
  });

  it('closes the More sheet when a link is clicked', () => {
    renderNav();

    fireEvent.click(screen.getByText('Více'));
    fireEvent.click(screen.getByText('Náklady'));

    expect(screen.queryByText('Nastavení')).not.toBeInTheDocument();
  });

  it('opens the AI assistant from the More sheet and closes the sheet', () => {
    renderNav();

    fireEvent.click(screen.getByText('Více'));
    fireEvent.click(screen.getByText('AI Asistent'));

    expect(mockOpenAssistant).toHaveBeenCalled();
    expect(screen.queryByText('Nastavení')).not.toBeInTheDocument();
  });

  it('hides the AI assistant entry when AI is not available', () => {
    mockAIAvailable = false;
    renderNav();

    fireEvent.click(screen.getByText('Více'));

    expect(screen.queryByText('AI Asistent')).not.toBeInTheDocument();
  });

  it('shows the appearance toggle in the More sheet and switches theme', () => {
    renderNav();

    fireEvent.click(screen.getByText('Více'));

    expect(screen.getByText('Vzhled aplikace')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Tmavý'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls logout from the More sheet', () => {
    renderNav();

    fireEvent.click(screen.getByText('Více'));
    fireEvent.click(screen.getByText('Odhlásit se'));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('highlights the active tab based on the current path', () => {
    renderNav({}, '/invoices');

    const invoicesLink = screen.getByText('Faktury').closest('a');
    expect(invoicesLink?.className).toContain('text-accent');

    const dashboardLink = screen.getByText('Přehled').closest('a');
    expect(dashboardLink?.className).not.toContain('text-accent');
  });
});
