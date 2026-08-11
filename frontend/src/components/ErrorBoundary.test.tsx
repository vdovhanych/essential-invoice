import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
}));

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('kaboom');
  return <p>Page content</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors; keep the test output readable
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('shows the error state with a quotable reference instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Stránku se nepodařilo načíst')).toBeInTheDocument();
    // Reassures that nothing entered was lost
    expect(screen.getByText(/Nic z toho, co jste zadali, se neztratilo/)).toBeInTheDocument();
    // A 6-character reference code the user can quote to support
    expect(screen.getByText(/^[A-Z0-9]{6}$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

  it('recovers when the route changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/invoices">
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Stránku se nepodařilo načíst')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="/clients">
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('retries in place when the user asks', () => {
    function Flaky() {
      if (!(globalThis as Record<string, unknown>).__recovered) throw new Error('kaboom');
      return <p>Page content</p>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );
    expect(screen.getByText('Stránku se nepodařilo načíst')).toBeInTheDocument();

    (globalThis as Record<string, unknown>).__recovered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(screen.getByText('Page content')).toBeInTheDocument();
    delete (globalThis as Record<string, unknown>).__recovered;
  });
});
