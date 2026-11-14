import { Capacitor } from '@capacitor/core';
import { ApiError, apiRequest } from '@/shared/api/http';

export type DiagnosticsStaffSession = {
  staffId?: string | null;
  roleType: 'LAB_ADMIN' | 'LAB_STAFF' | string;
  title?: 'MANAGER' | 'LAB_TECHNICIAN' | 'COLLECTION_AGENT' | string | null;
  collectionCapable?: boolean;
  displayName?: string;
  canManageStaff?: boolean;
  canManageCatalog?: boolean;
  canDispatch?: boolean;
  canLabDesk?: boolean;
  canReadAudit?: boolean;
};

export type DiagnosticsBranchSlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  active: boolean;
};

export type DiagnosticsBranch = {
  id: string;
  label: string;
  addressLine: string;
  latitude?: number | null;
  longitude?: number | null;
  homeCollectionRadiusKm: number;
  active: boolean;
  sortOrder?: number;
  blockedSlotsByDate?: string | null;
  slots?: DiagnosticsBranchSlot[];
};

export type DiagnosticsTestRow = {
  id: string;
  code?: string | null;
  name: string;
  price: number;
  fastingNote?: string | null;
  prescriptionRequired?: boolean;
  homeCollection?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type DiagnosticsStaffRow = {
  id: string;
  displayName: string;
  phone: string;
  roleType: string;
  title?: string | null;
  collectionCapable: boolean;
  active: boolean;
};

export type DiagnosticsStaffAuditRow = {
  id: string;
  eventType: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
};

export type DiagnosticsPackageRow = {
  id?: string;
  code?: string | null;
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
  sortOrder?: number;
  testIds: string[];
};

export type DiagnosticsPortalProfile = {
  vendorId: string;
  businessName: string;
  enabled: boolean;
  bookable: boolean;
  homeCollectionFee: number;
  feeModel?: string | null;
  perPieceAmount?: number | null;
  perOrderFlatAmount?: number | null;
  monthlySubscriptionAmount?: number | null;
  branches: DiagnosticsBranch[];
  tests: DiagnosticsTestRow[];
  packages?: DiagnosticsPackageRow[];
  staff: DiagnosticsStaffRow[];
  audit?: DiagnosticsStaffAuditRow[];
  session?: DiagnosticsStaffSession | null;
};

export type DiagnosticsVendorOrder = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  servingBranchId?: string | null;
  patientName: string;
  addressText: string;
  contactPhone?: string | null;
  slotStart?: string | null;
  slotEnd?: string | null;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  receivedByStaffId?: string | null;
  receivedByStaffName?: string | null;
  testsSubtotal: number;
  homeCollectionFee?: number;
  platformFeeAmount?: number;
  codFee?: number | null;
  /** Payable total (tests + home + platform + COD surcharge when applicable). */
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  reportEta?: string | null;
  reportFinalizedAt?: string | null;
  samplesBenchConfirmedAt?: string | null;
  reportAttachments?: DiagnosticsReportAttachment[];
  placedAt?: string | null;
  allowedActions: string[];
  lines: Array<{ id: string; testName: string; unitPrice: number; resultValue?: string | null }>;
  samplePhotos?: Array<{ mediaId: string; url: string }>;
  events?: Array<{ eventType?: string; note?: string | null; createdAt?: string | null }>;
};

/**
 * Vendor queues show cash-on-delivery bookings and bookings already paid online.
 * Online payment still pending (or failed) stays with the buyer and is not listed.
 */
export function isVendorVisibleDiagnosticsBooking(
  order: Pick<DiagnosticsVendorOrder, 'paymentMethod' | 'paymentStatus'>,
): boolean {
  const method = String(order.paymentMethod ?? '').trim().toUpperCase();
  if (method === 'COD' || method === 'CASH') return true;
  const pay = String(order.paymentStatus ?? '').trim().toUpperCase();
  return pay === 'PAID' || pay === 'COLLECTED';
}

/** Sample at lab through report work, excluding cancel. */
export function isDiagnosticsLabPipelineOrder(order: Pick<DiagnosticsVendorOrder, 'status' | 'paymentMethod' | 'paymentStatus'>): boolean {
  if (!isVendorVisibleDiagnosticsBooking(order)) return false;
  const status = String(order.status ?? '').toUpperCase();
  if (/CANCEL/.test(status)) return false;
  return /RECEIVED_AT_LAB|REPORT_ETA_SET|REPORT_IN_PROGRESS|REPORT_FINALIZED|COMPLETED/.test(status);
}

export function diagnosticsOrderHasInterimReport(order: Pick<DiagnosticsVendorOrder, 'reportAttachments'>): boolean {
  return (order.reportAttachments ?? []).some((a) => String(a.kind ?? '').trim().toUpperCase() === 'INTERIM');
}

/** Finalized or completed — shown under Final reports. */
export function isDiagnosticsFinalReportsQueueOrder(order: Pick<DiagnosticsVendorOrder, 'status' | 'paymentMethod' | 'paymentStatus'>): boolean {
  if (!isDiagnosticsLabPipelineOrder(order)) return false;
  return /REPORT_FINALIZED|COMPLETED/.test(String(order.status ?? '').toUpperCase());
}

/** Interim file shared with patient; report not finalized yet. */
export function isDiagnosticsInterimReportsQueueOrder(
  order: Pick<DiagnosticsVendorOrder, 'status' | 'paymentMethod' | 'paymentStatus' | 'reportAttachments'>,
): boolean {
  if (!isDiagnosticsLabPipelineOrder(order)) return false;
  if (isDiagnosticsFinalReportsQueueOrder(order)) return false;
  return diagnosticsOrderHasInterimReport(order);
}

/** Bench queue: receive, confirm samples, ETA, uploads before interim is on file. */
export function isDiagnosticsLabBenchQueueOrder(
  order: Pick<DiagnosticsVendorOrder, 'status' | 'paymentMethod' | 'paymentStatus' | 'reportAttachments'>,
): boolean {
  if (!isDiagnosticsLabPipelineOrder(order)) return false;
  if (isDiagnosticsFinalReportsQueueOrder(order)) return false;
  return !diagnosticsOrderHasInterimReport(order);
}

export const MAX_DIAGNOSTICS_SAMPLE_PHOTOS = 5;
export const MAX_DIAGNOSTICS_REPORT_ATTACHMENTS = 5;

export type DiagnosticsReportAttachment = {
  mediaId: string;
  url: string;
  kind: 'INTERIM' | 'FINAL' | string;
  contentType?: string | null;
};

export function diagnosticsSamplePhotos(order: DiagnosticsVendorOrder): Array<{ mediaId: string; url: string }> {
  if (Array.isArray(order.samplePhotos)) {
    return order.samplePhotos.slice(0, MAX_DIAGNOSTICS_SAMPLE_PHOTOS);
  }
  const seen = new Set<string>();
  const fromEvents: Array<{ mediaId: string; url: string }> = [];
  for (const ev of order.events ?? []) {
    if (String(ev.eventType ?? '').toUpperCase() !== 'SAMPLE_PHOTO') continue;
    const id = String(ev.note ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    fromEvents.push({ mediaId: id, url: `/api/v1/media/${id}/content` });
  }
  return fromEvents.slice(0, MAX_DIAGNOSTICS_SAMPLE_PHOTOS);
}

export function resolveDiagnosticsWrites(session: DiagnosticsStaffSession | null | undefined) {
  const roleType = String(session?.roleType ?? '').toUpperCase();
  const title = String(session?.title ?? '').toUpperCase();
  const isAdmin = roleType === 'LAB_ADMIN';
  const isManager = title === 'MANAGER';
  const isTech = title === 'LAB_TECHNICIAN';
  const collectionCapable = Boolean(session?.collectionCapable);
  return {
    canManageCatalog: session?.canManageCatalog ?? (isAdmin || isManager),
    canDispatch: session?.canDispatch ?? (isAdmin || isManager),
    canLabDesk: session?.canLabDesk ?? (isAdmin || isManager || isTech),
    canManageStaff: session?.canManageStaff ?? isAdmin,
    canCollection: collectionCapable,
    canReadAudit: session?.canReadAudit ?? true,
    isAdmin,
    isManager,
    isTech,
    collectionCapable,
  };
}

/** Lab owner fallback when session API is not deployed yet. */
export function diagnosticsOwnerSessionFallback(): DiagnosticsStaffSession {
  return {
    roleType: 'LAB_ADMIN',
    collectionCapable: true,
    canManageCatalog: true,
    canManageStaff: true,
    canDispatch: true,
    canLabDesk: true,
    canReadAudit: true,
  };
}

export async function fetchDiagnosticsSession(token: string): Promise<DiagnosticsStaffSession> {
  try {
    return await apiRequest<DiagnosticsStaffSession>('/api/v1/vendors/me/diagnostics/session', { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return diagnosticsOwnerSessionFallback();
    }
    throw err;
  }
}

export async function fetchMyDiagnostics(token: string): Promise<DiagnosticsPortalProfile> {
  return apiRequest<DiagnosticsPortalProfile>('/api/v1/vendors/me/diagnostics', { token });
}

export async function saveDiagnosticsProfile(
  token: string,
  body: { enabled?: boolean; bookable?: boolean; homeCollectionFee?: number },
): Promise<DiagnosticsPortalProfile> {
  return apiRequest<DiagnosticsPortalProfile>('/api/v1/vendors/me/diagnostics/profile', { method: 'PUT', token, body });
}

export async function upsertDiagnosticsBranch(
  token: string,
  body: Partial<DiagnosticsBranch> & {
    label: string;
    addressLine: string;
    homeCollectionRadiusKm: number;
    slots?: Array<{
      id?: string;
      label: string;
      startTime: string;
      endTime: string;
      capacity?: number;
      active?: boolean;
    }>;
    blockedSlotDate?: string;
    blockedSlotIds?: string;
    blockedSlotsByDate?: string;
  },
): Promise<DiagnosticsPortalProfile> {
  const method = body.id ? 'PUT' : 'POST';
  const path = body.id
    ? `/api/v1/vendors/me/diagnostics/branches/${body.id}`
    : '/api/v1/vendors/me/diagnostics/branches';
  return apiRequest<DiagnosticsPortalProfile>(path, { method, token, body });
}

export async function upsertDiagnosticsTest(
  token: string,
  body: Partial<DiagnosticsTestRow> & { name: string; price: number },
): Promise<DiagnosticsPortalProfile> {
  const method = body.id ? 'PUT' : 'POST';
  const path = body.id ? `/api/v1/vendors/me/diagnostics/tests/${body.id}` : '/api/v1/vendors/me/diagnostics/tests';
  return apiRequest<DiagnosticsPortalProfile>(path, { method, token, body });
}

export async function upsertDiagnosticsPackage(
  token: string,
  body: Partial<DiagnosticsPackageRow> & { name: string; price: number; testIds: string[] },
): Promise<DiagnosticsPortalProfile> {
  const method = body.id ? 'PUT' : 'POST';
  const path = body.id
    ? `/api/v1/vendors/me/diagnostics/packages/${body.id}`
    : '/api/v1/vendors/me/diagnostics/packages';
  return apiRequest<DiagnosticsPortalProfile>(path, { method, token, body });
}

export async function upsertDiagnosticsStaff(
  token: string,
  body: {
    id?: string;
    displayName: string;
    phone: string;
    password?: string;
    roleType?: string;
    title?: string;
    collectionCapable?: boolean;
    active?: boolean;
  },
): Promise<DiagnosticsPortalProfile> {
  const method = body.id ? 'PUT' : 'POST';
  const path = body.id ? `/api/v1/vendors/me/diagnostics/staff/${body.id}` : '/api/v1/vendors/me/diagnostics/staff';
  return apiRequest<DiagnosticsPortalProfile>(path, { method, token, body });
}

export async function fetchDiagnosticsStaffAudit(token: string): Promise<DiagnosticsStaffAuditRow[]> {
  return apiRequest<DiagnosticsStaffAuditRow[]>('/api/v1/vendors/me/diagnostics/audit', { token });
}

export async function fetchVendorDiagnosticsOrders(token: string): Promise<DiagnosticsVendorOrder[]> {
  const rows = await apiRequest<DiagnosticsVendorOrder[]>('/api/v1/orders/vendor/diagnostics', { token });
  return rows.map((row) => ({ ...row, allowedActions: row.allowedActions ?? [] }));
}

export async function fetchMyVisitsHistoryCount(token: string): Promise<number> {
  const n = await apiRequest<number>('/api/v1/orders/vendor/diagnostics/my-visits/history/count', { token });
  return Number(n) || 0;
}

export async function fetchMyVisitsHistory(
  token: string,
  from: string,
  to: string,
  q?: string,
): Promise<DiagnosticsVendorOrder[]> {
  const params = new URLSearchParams({ from, to });
  if (q?.trim()) params.set('q', q.trim());
  const rows = await apiRequest<DiagnosticsVendorOrder[]>(
    `/api/v1/orders/vendor/diagnostics/my-visits/history?${params}`,
    { token },
  );
  return rows.map((row) => ({ ...row, allowedActions: row.allowedActions ?? [] }));
}

export async function actOnDiagnosticsOrder(
  token: string,
  orderId: string,
  body: Record<string, unknown>,
): Promise<DiagnosticsVendorOrder> {
  const updated = await apiRequest<DiagnosticsVendorOrder>(`/api/v1/orders/vendor/diagnostics/${orderId}/actions`, {
    method: 'POST',
    token,
    body,
  });
  return { ...updated, allowedActions: updated.allowedActions ?? [] };
}

function apiBase(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (Capacitor.isNativePlatform()) return 'http://10.0.2.2:8080';
  return '';
}

export async function uploadDiagnosticsSamplePhoto(token: string, file: File): Promise<string> {
  return uploadDiagnosticsMedia(token, file, 'DIAGNOSTICS_SAMPLE');
}

export async function uploadDiagnosticsReportFile(token: string, file: File): Promise<string> {
  return uploadDiagnosticsMedia(token, file, 'DIAGNOSTICS_REPORT');
}

async function uploadDiagnosticsMedia(token: string, file: File, context: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', context);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api/v1/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload timed out. Check media-service is running, then try again.');
    }
    throw new Error('Could not reach the server. Check your connection and retry.');
  } finally {
    clearTimeout(timer);
  }
  let payload: { message?: string; data?: { mediaId?: string } };
  try {
    payload = (await response.json()) as { message?: string; data?: { mediaId?: string } };
  } catch {
    throw new Error(response.ok ? 'Upload failed' : 'Upload failed — server returned an invalid response');
  }
  if (!response.ok || !payload.data?.mediaId) {
    throw new Error(payload.message || 'Upload failed');
  }
  return payload.data.mediaId;
}
