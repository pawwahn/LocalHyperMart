import { apiRequest } from '@/shared/api/http';

export type DiagnosticsLabAdmin = {
  vendorId: string;
  townId: string;
  businessName: string;
  phone: string;
  vendorStatus: string;
  enabled: boolean;
  bookable: boolean;
  homeCollectionFee: number;
  branchCount?: number;
  testCount?: number;
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
};

export type DiagnosticsPackageRow = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
  testIds: string[];
};

export type DiagnosticsLabDetail = {
  vendorId: string;
  townId: string;
  businessName: string;
  tests: DiagnosticsTestRow[];
  packages: DiagnosticsPackageRow[];
};

export async function fetchTownDiagnosticsLabs(token: string, townId: string): Promise<DiagnosticsLabAdmin[]> {
  return apiRequest<DiagnosticsLabAdmin[]>(`/api/v1/vendors/diagnostics?townId=${townId}`, { token });
}

export async function fetchDiagnosticsLabDetail(token: string, vendorId: string): Promise<DiagnosticsLabDetail> {
  const detail = await apiRequest<DiagnosticsLabDetail>(`/api/v1/vendors/diagnostics/${vendorId}`, { token });
  return {
    ...detail,
    tests: detail.tests ?? [],
    packages: detail.packages ?? [],
  };
}

export async function saveTownDiagnosticsLab(
  token: string,
  vendorId: string,
  body: {
    enabled: boolean;
    bookable?: boolean;
    homeCollectionFee?: number;
  },
): Promise<DiagnosticsLabAdmin> {
  return apiRequest<DiagnosticsLabAdmin>(`/api/v1/vendors/diagnostics/${vendorId}`, { method: 'PUT', token, body });
}

export async function adminUpsertDiagnosticsTest(
  token: string,
  vendorId: string,
  body: Partial<DiagnosticsTestRow> & { name: string; price: number },
): Promise<DiagnosticsLabDetail> {
  const method = body.id ? 'PUT' : 'POST';
  const path = body.id
    ? `/api/v1/vendors/diagnostics/${vendorId}/tests/${body.id}`
    : `/api/v1/vendors/diagnostics/${vendorId}/tests`;
  return apiRequest<DiagnosticsLabDetail>(path, { method, token, body });
}

export async function adminUpsertDiagnosticsPackage(
  token: string,
  vendorId: string,
  body: Partial<DiagnosticsPackageRow> & { name: string; price: number; testIds: string[] },
): Promise<DiagnosticsLabDetail> {
  const method = body.id ? 'PUT' : 'POST';
  const path = body.id
    ? `/api/v1/vendors/diagnostics/${vendorId}/packages/${body.id}`
    : `/api/v1/vendors/diagnostics/${vendorId}/packages`;
  return apiRequest<DiagnosticsLabDetail>(path, { method, token, body });
}
