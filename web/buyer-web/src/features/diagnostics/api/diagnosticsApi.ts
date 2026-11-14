import { Capacitor } from '@capacitor/core';
import { apiRequest } from '@/shared/api/http';

export type DiagnosticsLab = {
  vendorId: string;
  businessName: string;
  phone?: string;
  homeCollectionFee?: number;
  branchCount?: number;
  testCount?: number;
};

export type DiagnosticsSlot = {
  slotId: string;
  label: string;
  start: string;
  end: string;
  available?: number;
  capacity?: number;
};

export type DiagnosticsTest = {
  id: string;
  code?: string | null;
  name: string;
  price: number;
  fastingNote?: string | null;
  prescriptionRequired?: boolean;
  homeCollection?: boolean;
};

export type DiagnosticsPackage = {
  id: string;
  code?: string | null;
  name: string;
  /** What’s included / covered — from lab catalog. */
  description?: string | null;
  price: number;
  testIds?: string[];
};

export type DiagnosticsLabDetail = DiagnosticsLab & {
  eligible: boolean;
  ineligibleReason?: string | null;
  servingBranchId?: string | null;
  servingBranchLabel?: string | null;
  blockedSlotsByDate?: string | null;
  tests: DiagnosticsTest[];
  packages?: DiagnosticsPackage[];
  slots: DiagnosticsSlot[];
};

export type PatientProfile = {
  id: string;
  displayName: string;
  relation?: string | null;
  dateOfBirth?: string | null;
  ageYears?: number | null;
  gender?: string | null;
  isSelf?: boolean;
};

export type DiagnosticsOrderLine = {
  id: string;
  testId?: string | null;
  testName: string;
  unitPrice: number;
  resultValue?: string | null;
  resultUnit?: string | null;
  referenceRange?: string | null;
  resultFlag?: string | null;
};

export type DiagnosticsOrder = {
  id: string;
  orderNumber: string;
  shopName: string;
  status: string;
  statusLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  testsSubtotal: number;
  homeCollectionFee?: number;
  platformFeeAmount?: number;
  codFee?: number | null;
  /** Full payable amount (tests + home + platform + COD surcharge when applicable). */
  totalAmount?: number;
  amountCollected?: number;
  patientName: string;
  referenceType: string;
  referringDoctorName?: string | null;
  servingBranchLabel?: string | null;
  addressText: string;
  slotStart?: string | null;
  slotEnd?: string | null;
  reportEta?: string | null;
  reportFinalizedAt?: string | null;
  reportDownloadUrl?: string | null;
  reportAttachmentUrls?: string[];
  reportAttachments?: Array<{
    mediaId: string;
    url: string;
    kind: 'INTERIM' | 'FINAL' | string;
    contentType?: string | null;
  }>;
  samplesBenchConfirmedAt?: string | null;
  placedAt: string;
  allowedActions: string[];
  lines: DiagnosticsOrderLine[];
  events?: Array<{
    eventType: string;
    note?: string | null;
    createdAt: string;
    fromStatus?: string | null;
    toStatus?: string | null;
  }>;
  payment?: {
    paymentId?: string;
    checkout?: {
      keyId?: string | null;
      gatewayOrderId: string;
      amountPaise: number;
      currency: string;
      name: string;
      description?: string | null;
      prefillContact?: string | null;
      logoUrl?: string | null;
    } | null;
  } | null;
};

export async function fetchDiagnosticsLabs(token: string, townId: string): Promise<DiagnosticsLab[]> {
  return apiRequest<DiagnosticsLab[]>(`/api/v1/orders/diagnostics/shops?townId=${townId}`, { token });
}

export async function fetchDiagnosticsLabDetail(
  token: string,
  vendorId: string,
  townId: string,
  addressId: string,
): Promise<DiagnosticsLabDetail> {
  const params = new URLSearchParams({ townId, addressId });
  return apiRequest<DiagnosticsLabDetail>(`/api/v1/orders/diagnostics/shops/${vendorId}?${params}`, { token });
}

export async function fetchPatientProfiles(token: string): Promise<PatientProfile[]> {
  return apiRequest<PatientProfile[]>('/api/v1/users/me/patients', { token });
}

export async function createPatientProfile(
  token: string,
  body: {
    displayName: string;
    relation: string;
    gender: string;
    ageYears?: number;
    dateOfBirth?: string;
    notes?: string;
  },
): Promise<PatientProfile> {
  return apiRequest<PatientProfile>('/api/v1/users/me/patients', { method: 'POST', token, body });
}

export async function updatePatientProfile(
  token: string,
  patientId: string,
  body: {
    displayName: string;
    relation: string;
    gender: string;
    ageYears?: number;
    dateOfBirth?: string;
    notes?: string;
  },
): Promise<PatientProfile> {
  return apiRequest<PatientProfile>(`/api/v1/users/me/patients/${patientId}`, { method: 'PUT', token, body });
}

export async function placeDiagnosticsOrder(
  token: string,
  body: {
    townId: string;
    vendorId: string;
    addressId: string;
    patientProfileId: string;
    referenceType: 'SELF' | 'DOCTOR';
    referringDoctorName?: string;
    paymentMethod: string;
    paymentGateway?: string;
    contactPhone?: string;
    slotStart: string;
    slotEnd: string;
    slotTemplateId?: string;
    testIds: string[];
    packageIds?: string[];
    disclaimerAcknowledged: boolean;
  },
): Promise<DiagnosticsOrder> {
  return apiRequest<DiagnosticsOrder>('/api/v1/orders/diagnostics', {
    method: 'POST',
    token,
    body,
    timeoutMs: 25_000,
  });
}

export async function fetchMyDiagnosticsOrders(token: string, townId: string): Promise<DiagnosticsOrder[]> {
  return apiRequest<DiagnosticsOrder[]>(`/api/v1/orders/diagnostics?townId=${townId}`, { token });
}

export async function fetchDiagnosticsOrder(token: string, orderId: string): Promise<DiagnosticsOrder> {
  return apiRequest<DiagnosticsOrder>(`/api/v1/orders/diagnostics/${orderId}`, { token });
}

export async function downloadDiagnosticsReportPdf(token: string, orderId: string): Promise<Blob> {
  const url = `${apiBase()}/api/v1/orders/diagnostics/${orderId}/report.pdf`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
  });
  if (!response.ok) {
    throw new Error('Report PDF is not available yet');
  }
  return response.blob();
}

/** Lab-uploaded interim/final file (buyer-scoped URL from order API). */
export async function downloadDiagnosticsReportFile(token: string, pathOrUrl: string): Promise<Blob> {
  const path = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${apiBase()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Could not load this report file');
  }
  return response.blob();
}

export async function cancelDiagnosticsOrder(token: string, orderId: string): Promise<DiagnosticsOrder> {
  return apiRequest<DiagnosticsOrder>(`/api/v1/orders/diagnostics/${orderId}/cancel`, {
    method: 'POST',
    token,
    body: {},
  });
}

/** Same shape as order-service `PaymentInfoResponse` (not nested under `payment`). */
export type DiagnosticsPaymentRetryResponse = {
  paymentId?: string;
  status?: string;
  checkout?: unknown;
};

export async function retryDiagnosticsPayment(
  token: string,
  orderId: string,
  gateway?: string,
): Promise<DiagnosticsPaymentRetryResponse> {
  const query = gateway ? `?gateway=${encodeURIComponent(gateway)}` : '';
  return apiRequest<DiagnosticsPaymentRetryResponse>(
    `/api/v1/orders/diagnostics/${orderId}/payments/retry${query}`,
    {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': `diag-retry-${orderId}-${Date.now()}` },
    },
  );
}

function apiBase(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (Capacitor.isNativePlatform()) return 'http://10.0.2.2:8080';
  return '';
}

export async function uploadDiagnosticsPrescription(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'DIAGNOSTICS_PRESCRIPTION');
  const response = await fetch(`${apiBase()}/api/v1/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: form,
  });
  const payload = (await response.json()) as { message?: string; data?: { mediaId?: string } };
  if (!response.ok || !payload.data?.mediaId) {
    throw new Error(payload.message || 'Upload failed');
  }
  return payload.data.mediaId;
}
