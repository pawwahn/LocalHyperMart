export type VendorServiceFor = 'MALE' | 'FEMALE' | 'UNISEX' | 'PRIVATE_LAB' | 'HOSPITAL_LAB';

/** Platform service offering name (e.g. "Makeup & Beauty") — not a beauty treatment code. */
export function isBeautyServiceName(name: string | null | undefined): boolean {
  const lower = (name ?? '').trim().toLowerCase();
  return lower.includes('beauty') || lower.includes('makeup');
}

/** Platform service offering name (e.g. "Diagnostics & Lab"). */
export function isDiagnosticsServiceName(name: string | null | undefined): boolean {
  const lower = (name ?? '').trim().toLowerCase();
  return lower.includes('diagnostic') || lower.includes('lab');
}

export const VENDOR_SERVICE_FOR_OPTIONS: { value: VendorServiceFor; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'UNISEX', label: 'Unisex' },
];

export const VENDOR_DIAGNOSTICS_LAB_TYPE_OPTIONS: { value: VendorServiceFor; label: string }[] = [
  { value: 'PRIVATE_LAB', label: 'Private Lab' },
  { value: 'HOSPITAL_LAB', label: 'Hospital Lab' },
];

export type DiagnosticsLabType = 'PRIVATE_LAB' | 'HOSPITAL_LAB';

export function isDiagnosticsLabType(
  value: VendorServiceFor | string | null | undefined,
): value is DiagnosticsLabType {
  const normalized = normalizeServiceFor(value);
  return normalized === 'PRIVATE_LAB' || normalized === 'HOSPITAL_LAB';
}

export function normalizeDiagnosticsLabType(
  value: VendorServiceFor | string | null | undefined,
): DiagnosticsLabType | null {
  return isDiagnosticsLabType(value) ? normalizeServiceFor(value) : null;
}

export function normalizeServiceFor(
  value: VendorServiceFor | string | null | undefined,
): VendorServiceFor | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase().replace(/-/g, '_').replace(/\s+/g, '_') : '';
  if (
    raw === 'MALE' ||
    raw === 'FEMALE' ||
    raw === 'UNISEX' ||
    raw === 'PRIVATE_LAB' ||
    raw === 'PRIV_LAB' ||
    raw === 'PRIVATE' ||
    raw === 'HOSPITAL_LAB' ||
    raw === 'HOSP_LAB' ||
    raw === 'HOSPITAL'
  ) {
    if (raw === 'PRIVATE' || raw === 'PRIVATE_LAB' || raw === 'PRIV_LAB') return 'PRIVATE_LAB';
    if (raw === 'HOSPITAL' || raw === 'HOSPITAL_LAB' || raw === 'HOSP_LAB') return 'HOSPITAL_LAB';
    return raw as 'MALE' | 'FEMALE' | 'UNISEX';
  }
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
    case 'PRIVATE_LAB':
      return 'Private Lab';
    case 'HOSPITAL_LAB':
      return 'Hospital Lab';
    default:
      return '';
  }
}

/**
 * Tag shown beside a shop name — Makeup & Beauty (Male/Female/Unisex) or Diagnostics (Private/Hospital Lab).
 * Never shows "Unisex" for diagnostics/grocery; UNISEX without a service name only tags Male/Female explicitly.
 */
export function serviceForAudienceLabel(
  serviceName: string | null | undefined,
  serviceFor: VendorServiceFor | string | null | undefined,
): string {
  if (isDiagnosticsServiceName(serviceName)) {
    const labType = normalizeDiagnosticsLabType(serviceFor);
    return labType ? serviceForLabel(labType) : '';
  }
  if (isBeautyServiceName(serviceName)) {
    const audience = normalizeServiceFor(serviceFor);
    if (audience === 'MALE' || audience === 'FEMALE' || audience === 'UNISEX') {
      return serviceForLabel(audience);
    }
    return '';
  }
  if (serviceName != null && serviceName !== '') {
    return '';
  }
  if (isDiagnosticsLabType(serviceFor)) {
    return serviceForLabel(serviceFor);
  }
  const audience = normalizeServiceFor(serviceFor);
  if (audience === 'MALE' || audience === 'FEMALE') {
    return serviceForLabel(audience);
  }
  return '';
}

/** e.g. "Glow Studio (Female)" or "Sri Labs (Private Lab)". */
export function vendorNameWithServiceFor(
  name: string | null | undefined,
  serviceFor: VendorServiceFor | string | null | undefined,
  serviceName?: string | null,
): string {
  const base = name?.trim() ?? '';
  const tag = serviceForAudienceLabel(serviceName, serviceFor);
  if (!base) return tag;
  if (!tag) return base;
  return `${base} (${tag})`;
}
