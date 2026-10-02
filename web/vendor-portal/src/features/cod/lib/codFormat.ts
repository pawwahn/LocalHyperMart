export function codMoney(v: number | null | undefined, compact = false): string {
  const n = Number(v ?? 0);
  if (compact && Number.isInteger(n)) {
    return `₹${n.toLocaleString('en-IN')}`;
  }
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** ISO date YYYY-MM-DD → readable IST label */
export function formatCodDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDeliveredIst(at?: string | null): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
