import { apiRequest } from '@/shared/api/http';

export type VendorGstHsnRow = {
  hsn: string;
  gstPercent: number;
  lines: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  amount: number;
};

export type VendorGstB2cRow = {
  orderNumber: string;
  subOrderNumber: string;
  deliveredDate: string;
  paymentMethod: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  invoiceValue: number;
};

export type VendorGstLineRow = {
  orderNumber: string;
  subOrderNumber: string;
  deliveredDate: string;
  itemName: string;
  hsn: string;
  gstPercent: number;
  quantity: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  lineTotal: number;
};

export type VendorGstReport = {
  from: string;
  to: string;
  vendorId: string;
  deliveredBagCount: number;
  lineCount: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  taxTotal: number;
  invoiceValueTotal: number;
  gstByHsn: VendorGstHsnRow[];
  b2cDocuments: VendorGstB2cRow[];
  lineDetails: VendorGstLineRow[];
};

export async function fetchVendorGstReport(
  token: string,
  vendorId: string,
  filters: { from: string; to: string; includeLines: boolean },
): Promise<VendorGstReport> {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  params.set('includeLines', String(filters.includeLines));
  return apiRequest<VendorGstReport>(`/api/v1/orders/vendor/gst-report?${params.toString()}`, {
    token,
    vendorId,
    timeoutMs: 90_000,
  });
}
