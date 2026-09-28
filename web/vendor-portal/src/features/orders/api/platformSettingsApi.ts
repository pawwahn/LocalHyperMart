import { apiRequest } from '@/shared/api/http';

export type VendorAlertSettings = {
  vendorOrderAlertMessage: string;
};

type SettingsDto = Record<string, unknown>;

export type SupplierBillProfile = {
  legalName: string;
  gstin: string;
  address: string;
  stateName: string;
  gstStateCode: string;
  phone: string;
};

export async function fetchSupplierBillProfile(): Promise<SupplierBillProfile> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings/public');
  const text = (key: string, fallback = '') => {
    const raw = data?.[key];
    return typeof raw === 'string' ? raw.trim() : fallback;
  };
  return {
    legalName: text('supplierLegalName', 'HyperLocalMart') || 'HyperLocalMart',
    gstin: text('supplierGstin'),
    address: text('supplierAddress'),
    stateName: text('supplierState'),
    gstStateCode: text('supplierGstStateCode'),
    phone: text('supportPhone'),
  };
}

export async function fetchVendorAlertSettings(): Promise<VendorAlertSettings> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings/public');
  const raw = data?.vendorOrderAlertMessage;
  return {
    vendorOrderAlertMessage:
      typeof raw === 'string' && raw.trim() ? raw.trim() : 'Order received',
  };
}
