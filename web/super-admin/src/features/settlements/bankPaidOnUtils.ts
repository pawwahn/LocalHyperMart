/** yyyy-MM-dd in Asia/Kolkata — must match the bank statement when confirming money in. */

export function todayIstDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function istDateFromIso(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function defaultBankPaidOn(input: {
  bankPaidOn?: string | null;
  vendorPaidAt?: string | null;
  paidAt?: string | null;
  paymentDate?: string | null;
}): string {
  const existing = (input.bankPaidOn ?? input.paymentDate ?? '').slice(0, 10);
  if (existing) return existing;
  return istDateFromIso(input.vendorPaidAt) || istDateFromIso(input.paidAt) || todayIstDate();
}

export function validateBankPaidOn(value: string): string | null {
  const day = value.trim();
  if (!day) return 'Bank statement date is required';
  if (day > todayIstDate()) return 'Bank date cannot be in the future';
  return null;
}
