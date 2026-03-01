import i18n from '../i18n/i18n';

function getLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'cs-CZ';
}

export function formatCurrency(amount: number, currency: string = 'CZK'): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(getLocale());
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString(getLocale());
}

export function getStatusLabel(status: string): string {
  return i18n.t(`common:status.${status}`, { defaultValue: status });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'badge-draft',
    sent: 'badge-sent',
    paid: 'badge-paid',
    overdue: 'badge-overdue',
    cancelled: 'badge-cancelled',
  };
  return colors[status] || 'badge-draft';
}

export function getExpenseStatusLabel(status: string): string {
  return i18n.t(`common:expenseStatus.${status}`, { defaultValue: status });
}

export function getExpenseStatusColor(status: string): string {
  const colors: Record<string, string> = {
    unpaid: 'badge-overdue',
    paid: 'badge-paid',
  };
  return colors[status] || 'badge-draft';
}
