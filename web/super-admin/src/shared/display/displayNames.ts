const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  return t.length > 0 && UUID_RE.test(t);
}

/** Prefer a real name; never show a bare UUID in UI. */
export function displayEntityLabel(
  name: string | null | undefined,
  fallback: string,
  id?: string | null,
): string {
  const n = name?.trim();
  if (n && !looksLikeUuid(n)) return n;
  if (id && looksLikeUuid(id)) return fallback;
  return n || fallback;
}

export function displayPayeeLabel(
  payeeName: string | null | undefined,
  payeeId: string | null | undefined,
  payeeType?: string | null,
): string {
  const role =
    payeeType === 'VENDOR'
      ? 'Vendor'
      : payeeType === 'AGENT'
        ? 'Delivery agent'
        : payeeType === 'HUB' || payeeType?.includes('HUB')
          ? 'Delivery hub'
          : 'Payee';
  return displayEntityLabel(payeeName, role, payeeId);
}

export function displayCounterparty(
  name: string | null | undefined,
  role: string | null | undefined,
  id?: string | null,
): string {
  const fallback =
    role === 'VENDOR'
      ? 'Vendor'
      : role === 'DELIVERY_AGENT' || role === 'AGENT'
        ? 'Delivery agent'
        : role === 'HUB'
          ? 'Delivery hub'
          : role === 'BUYER'
            ? 'Buyer'
            : 'Counterparty';
  return displayEntityLabel(name, fallback, id);
}
