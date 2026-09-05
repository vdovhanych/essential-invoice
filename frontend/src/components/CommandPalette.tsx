import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { formatCurrency, getStatusLabel, getStatusColor, getInitials } from '../utils/format';
import { Search, FileText, FilePlus, Users, UserPlus, Receipt, Settings, LayoutDashboard } from 'lucide-react';

interface PaletteInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  status: string;
  currency: string;
  total: number;
}

interface PaletteClient {
  id: string;
  companyName: string;
  ico: string | null;
  openBalance?: number;
}

interface PaletteItem {
  key: string;
  group: 'invoices' | 'contacts' | 'actions';
  run: () => void;
  render: (selected: boolean) => React.ReactNode;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [invoices, setInvoices] = useState<PaletteInvoice[]>([]);
  const [clients, setClients] = useState<PaletteClient[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch data when the palette opens; local filtering afterwards
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    Promise.all([
      api.get('/invoices').catch(() => []),
      api.get('/clients').catch(() => []),
    ]).then(([inv, cli]) => {
      setInvoices(inv);
      setClients(cli);
    });
    // Focus after the dialog renders
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const go = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [onClose, navigate]
  );

  const items = useMemo<PaletteItem[]>(() => {
    const commandsOnly = query.startsWith('>');
    const q = (commandsOnly ? query.slice(1) : query).trim().toLowerCase();

    const result: PaletteItem[] = [];

    const rowClass = (selected: boolean) =>
      `flex items-center gap-3 px-[18px] py-2.5 cursor-pointer ${selected ? 'bg-canvas' : ''}`;
    const iconClass = (selected: boolean) =>
      `h-4 w-4 shrink-0 ${selected ? 'text-accent' : 'text-text-faint'}`;

    if (!commandsOnly) {
      const matchedInvoices = (q
        ? invoices.filter(
            (inv) =>
              inv.invoiceNumber.toLowerCase().includes(q) ||
              inv.clientName.toLowerCase().includes(q)
          )
        : invoices
      ).slice(0, q ? 5 : 4);

      for (const inv of matchedInvoices) {
        result.push({
          key: `inv-${inv.id}`,
          group: 'invoices',
          run: () => go(`/invoices/${inv.id}`),
          render: (selected) => (
            <div className={rowClass(selected)}>
              <FileText className={iconClass(selected)} />
              <span className="flex-1 min-w-0 text-sm text-text truncate">
                {inv.invoiceNumber}
                <span className="text-text-muted"> · {inv.clientName}</span>
              </span>
              <span className="text-[13px] text-text-muted tabular-nums shrink-0">
                {formatCurrency(inv.total, inv.currency)}
              </span>
              <span className={`badge shrink-0 ${getStatusColor(inv.status)}`}>
                {getStatusLabel(inv.status)}
              </span>
            </div>
          ),
        });
      }

      const matchedClients = q
        ? clients
            .filter(
              (c) =>
                c.companyName.toLowerCase().includes(q) || (c.ico && c.ico.includes(q))
            )
            .slice(0, 4)
        : [];

      for (const client of matchedClients) {
        result.push({
          key: `cli-${client.id}`,
          group: 'contacts',
          run: () => go(`/clients/${client.id}`),
          render: (selected) => (
            <div className={rowClass(selected)}>
              <span
                className={`flex items-center justify-center h-6 w-6 rounded-lg text-[10px] font-semibold shrink-0 ${
                  selected ? 'bg-accent-soft text-accent' : 'bg-surface-sunken text-text-secondary'
                }`}
              >
                {getInitials(client.companyName)}
              </span>
              <span className="flex-1 min-w-0 text-sm text-text truncate">{client.companyName}</span>
              {client.openBalance != null && client.openBalance > 0 && (
                <span className="text-[13px] text-danger tabular-nums shrink-0">
                  {formatCurrency(client.openBalance, 'CZK')}
                </span>
              )}
            </div>
          ),
        });
      }
    }

    // Actions — static plus contextual per matched contact
    const actionRow = (
      key: string,
      Icon: typeof FileText,
      label: React.ReactNode,
      path: string
    ): PaletteItem => ({
      key,
      group: 'actions',
      run: () => go(path),
      render: (selected) => (
        <div className={rowClass(selected)}>
          <Icon className={iconClass(selected)} />
          <span className="flex-1 min-w-0 text-sm text-text truncate">{label}</span>
        </div>
      ),
    });

    const staticActions = [
      actionRow('act-new-invoice', FilePlus, t('palette.newInvoice'), '/invoices/new'),
      actionRow('act-new-expense', Receipt, t('palette.newExpense'), '/expenses/new'),
      actionRow('act-contacts', Users, t('palette.goContacts'), '/clients'),
      actionRow('act-dashboard', LayoutDashboard, t('palette.goDashboard'), '/'),
      actionRow('act-settings', Settings, t('palette.goSettings'), '/settings'),
    ];

    // Contextual: new invoice for a matched contact
    if (q && !commandsOnly) {
      for (const client of clients
        .filter((c) => c.companyName.toLowerCase().includes(q))
        .slice(0, 2)) {
        result.push(
          actionRow(
            `act-new-invoice-${client.id}`,
            UserPlus,
            <>
              {t('palette.newInvoiceFor')} <strong className="font-semibold">{client.companyName}</strong>
            </>,
            `/invoices/new?client=${client.id}`
          )
        );
      }
    }

    const matchedActions = q
      ? staticActions.filter((a) => {
          const labels = [
            t('palette.newInvoice'),
            t('palette.newExpense'),
            t('palette.goContacts'),
            t('palette.goDashboard'),
            t('palette.goSettings'),
          ];
          const idx = staticActions.indexOf(a);
          return labels[idx].toLowerCase().includes(q);
        })
      : staticActions.slice(0, commandsOnly ? staticActions.length : 4);

    result.push(...(commandsOnly && !q ? staticActions : matchedActions));

    return result;
  }, [query, invoices, clients, go, t]);

  // Clamp selection when the list changes
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [items]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[selectedIndex]?.run();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [items, selectedIndex, onClose]
  );

  // Keep the selected row in view
  useEffect(() => {
    const row = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    // scrollIntoView is missing in jsdom
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const groups: Array<{ key: PaletteItem['group']; label: string }> = [
    { key: 'invoices', label: t('palette.groupInvoices') },
    { key: 'contacts', label: t('palette.groupContacts') },
    { key: 'actions', label: t('palette.groupActions') },
  ];

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/40 flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[580px] bg-surface border border-border-strong rounded-[18px] shadow-[0_30px_60px_-20px_rgba(27,29,41,.35)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-[18px] py-4 border-b border-hairline">
          <Search className="h-[17px] w-[17px] text-text-faint shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t('palette.placeholder')}
            className="flex-1 bg-transparent text-base text-text placeholder-text-faint focus:outline-hidden"
            aria-label={t('palette.placeholder')}
          />
          <kbd className="text-[10px] font-mono text-text-faint border border-border rounded-sm px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-[18px] py-6 text-sm text-text-muted text-center">
              {t('palette.noResults')}
            </p>
          ) : (
            groups.map(({ key, label }) => {
              const groupItems = items.filter((item) => item.group === key);
              if (groupItems.length === 0) return null;
              return (
                <div key={key}>
                  <p className="px-[18px] pt-2 pb-1.5 text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint">
                    {label}
                  </p>
                  {groupItems.map((item) => {
                    flatIndex += 1;
                    const index = items.indexOf(item);
                    return (
                      <div
                        key={item.key}
                        data-index={index}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => item.run()}
                      >
                        {item.render(index === selectedIndex)}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-[18px] py-2.5 bg-row-hover border-t border-hairline text-[11px] text-text-faint">
          <span className="font-mono">↑↓ {t('palette.navigate')} · ↵ {t('palette.open')}</span>
          <span>{t('palette.commandsHint')}</span>
        </div>
      </div>
    </div>
  );
}
