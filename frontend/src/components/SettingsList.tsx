import { Children, Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';

/**
 * Native-style grouped settings list, used by the mobile Settings and Profile
 * indexes. Desktop keeps the two-column nav + panel layout, so everything here
 * is rendered inside `lg:hidden` wrappers.
 */

type Tint = 'accent' | 'success' | 'neutral' | 'danger';

const TINTS: Record<Tint, string> = {
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-bg text-success',
  neutral: 'bg-surface-sunken text-text-secondary',
  danger: 'bg-danger-bg text-danger',
};

interface GroupProps {
  caption?: string;
  children: ReactNode;
  /** Dividers align to the label: past the icon tile (58px) or the card padding (16px) */
  inset?: 'icon' | 'label';
  className?: string;
}

export function SettingsGroup({ caption, children, inset = 'icon', className = '' }: GroupProps) {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <div className={className}>
      {caption && (
        <div className="px-1.5 pb-2 text-[11px] font-semibold tracking-[.07em] uppercase text-text-faint">
          {caption}
        </div>
      )}
      <div className="bg-surface border border-border rounded-[20px] overflow-hidden">
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <div className={inset === 'icon' ? 'h-px bg-hairline ml-[58px]' : 'h-px bg-hairline ml-4'} />}
            {row}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  icon?: LucideIcon;
  tint?: Tint;
  label: string;
  /** Small muted label column, used by the Profile index's value rows */
  leadingLabel?: string;
  /** Right-hand summary: a string, or any node (toggle, thumbnail, status) */
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  /** Rows that only display (read-only email) or act in place (toggles) carry no chevron */
  chevron?: boolean;
  trailingIcon?: LucideIcon;
}

export function SettingsRow({
  icon: Icon,
  tint = 'neutral',
  label,
  leadingLabel,
  value,
  to,
  onClick,
  danger = false,
  chevron,
  trailingIcon: TrailingIcon,
}: RowProps) {
  const showChevron = chevron ?? Boolean(to || onClick);

  const content = (
    <>
      {Icon && (
        <span className={`flex items-center justify-center h-[30px] w-[30px] rounded-[9px] shrink-0 ${TINTS[tint]}`}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      {leadingLabel && <span className="w-[88px] shrink-0 text-[13px] font-medium text-text-muted">{leadingLabel}</span>}
      <span className={`flex-1 min-w-0 text-[15px] text-left truncate ${danger ? 'text-danger' : 'text-text'}`}>
        {label}
      </span>
      {typeof value === 'string' ? (
        <span className="text-[13px] text-text-faint truncate max-w-[45%]">{value}</span>
      ) : (
        value
      )}
      {TrailingIcon && <TrailingIcon className="h-3.5 w-3.5 text-text-faint shrink-0" />}
      {showChevron && <ChevronRight className={`h-[18px] w-[18px] shrink-0 ${danger ? 'text-danger/50' : 'text-text-faint'}`} />}
    </>
  );

  const className = `w-full flex items-center gap-3 px-4 py-[13px] min-h-[44px] text-left ${
    to || onClick ? 'active:bg-nav-hover transition-colors' : ''
  }`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

/** Green dot + label, for "Connected" style trailing values */
export function StatusValue({ label, connected }: { label: string; connected: boolean }) {
  if (!connected) return <span className="text-[13px] text-text-faint">{label}</span>;

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      {label}
    </span>
  );
}

/** Read-only copy of the toggle in `Settings.tsx`, for rows that toggle in place */
export function RowToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative inline-flex w-[34px] h-5 shrink-0"
    >
      <span
        className={`w-[34px] h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-strong'} after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:transition-transform ${
          checked ? 'after:translate-x-3.5' : ''
        }`}
      />
    </button>
  );
}

/** Mobile drill-in header: back affordance on the left, section title centred */
export function SettingsBackHeader({ to, backLabel, title }: { to: string; backLabel: string; title: string }) {
  return (
    <div className="lg:hidden -mx-[18px] -mt-[18px] mb-[18px] grid grid-cols-[1fr_auto_1fr] items-center h-12 px-1.5 bg-canvas border-b border-hairline">
      <Link
        to={to}
        className="justify-self-start inline-flex items-center gap-0.5 px-2 py-1.5 text-[15px] font-medium text-accent"
      >
        <ChevronLeft className="h-5 w-5" />
        {backLabel}
      </Link>
      <span className="text-[15px] font-semibold text-text">{title}</span>
      <span />
    </div>
  );
}
