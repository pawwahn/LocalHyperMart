export type AdCtaResolved = {
  label: string;
  href?: string;
  phoneDisplay?: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function looksLikePhone(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  const digits = digitsOnly(trimmed);
  if (digits.length < 10 || digits.length > 13) return false;
  return /^[\d\s+\-().]+$/.test(trimmed);
}

export function formatPhoneDisplay(digits: string): string {
  const d = digitsOnly(digits);
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 11 && d.startsWith('0')) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return d;
}

/** Turn admin CTA text into a short label + optional tel: link. */
export function resolveAdCta(raw: string): AdCtaResolved {
  const trimmed = raw.trim();
  if (!trimmed) return { label: '' };
  if (looksLikePhone(trimmed)) {
    const digits = digitsOnly(trimmed);
    return {
      label: 'Call',
      href: `tel:${digits}`,
      phoneDisplay: formatPhoneDisplay(digits),
    };
  }
  if (trimmed.length > 16) {
    return { label: `${trimmed.slice(0, 14)}…` };
  }
  return { label: trimmed };
}
