import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this resets the boundary — pass the route so navigating away recovers */
  resetKey?: string;
}

interface State {
  error: Error | null;
  reference: string | null;
}

/** Short, quotable reference so a user can point support at the right log line */
function makeReference(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ErrorScreen({ reference, onRetry }: { reference: string; onRetry: () => void }) {
  const { t } = useTranslation('common');
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <span className="flex items-center justify-center h-11 w-11 rounded-[14px] bg-danger-bg mb-5">
        <AlertTriangle className="h-5 w-5 text-danger" />
      </span>
      <h2 className="text-xl font-bold tracking-[-0.02em] text-text">{t('error.title')}</h2>
      {/* Name whose fault it is and reassure about unsaved work */}
      <p className="mt-2 max-w-[380px] text-sm leading-relaxed text-text-muted">
        {t('error.description')}
      </p>
      <div className="flex items-center gap-3 mt-6">
        <button onClick={onRetry} className="btn btn-primary">
          {t('error.tryAgain')}
        </button>
        <a href="/" className="text-[13px] font-medium text-text-muted hover:text-text">
          {t('error.backToDashboard')}
        </a>
      </div>
      <p className="mt-6 inline-flex items-center gap-2 bg-surface border border-border rounded-[7px] px-2.5 py-1.5 text-[11px] font-mono text-text-faint tabular-nums">
        <span>{reference}</span>
        <span>·</span>
        <span>{timestamp}</span>
      </p>
    </div>
  );
}

/**
 * Catches render errors so a broken page shows the app's own error state
 * instead of a blank screen (§17).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reference: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, reference: makeReference() };
  }

  componentDidUpdate(prevProps: Props) {
    // Navigating to another route clears a page-level failure
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, reference: null });
    }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.state.reference}] Render error:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          reference={this.state.reference!}
          onRetry={() => this.setState({ error: null, reference: null })}
        />
      );
    }
    return this.props.children;
  }
}
