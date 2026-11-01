export type VendorServiceFor = 'MALE' | 'FEMALE' | 'UNISEX';

export const VENDOR_SERVICE_FOR_OPTIONS: { value: VendorServiceFor; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'UNISEX', label: 'Unisex' },
];

export function normalizeServiceFor(
  value: VendorServiceFor | string | null | undefined,
): VendorServiceFor | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'MALE' || raw === 'FEMALE' || raw === 'UNISEX') return raw;
  return null;
}

export function serviceForLabel(value: VendorServiceFor | string | null | undefined): string {
  switch (normalizeServiceFor(value)) {
    case 'MALE':
      return 'Male';
    case 'FEMALE':
      return 'Female';
    case 'UNISEX':
      return 'Unisex';
    default:
      return '';
  }
}

/** e.g. "Glow Studio (Female)" */
export function vendorNameWithServiceFor(
  name: string | null | undefined,
  serviceFor: VendorServiceFor | string | null | undefined,
): string {
  const base = name?.trim() ?? '';
  const tag = serviceForLabel(serviceFor);
  if (!base) return tag;
  if (!tag) return base;
  return `${base} (${tag})`;
}
