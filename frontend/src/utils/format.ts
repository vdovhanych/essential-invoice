export function formatCurrency(amount: number, currency: string = 'CZK'): string {
  if (currency === 'EUR') {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('cs-CZ');
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('cs-CZ');
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Koncept',
    sent: 'Odesláno',
    paid: 'Zaplaceno',
    overdue: 'Po splatnosti',
    cancelled: 'Zrušeno',
  };
  return labels[status] || status;
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
