import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { apiRequest } from '@/shared/api/http';
import { fetchMyShop } from '@/features/shop/api/shopApi';
import { fetchSupplierBillProfile } from '@/features/orders/api/platformSettingsApi';
import {
  gstStateCodeFromGstin,
  gstStateCodeFromTown,
  stateNameFor,
  type BillParty,
} from '@/features/payouts/vendorBill';
import { listMySettlements, type VendorSettlement } from '@/features/reports/api/payoutsApi';
import { fetchVendorGstReport, type VendorGstReport } from '@/features/reports/api/gstReportsApi';
import {
  buildInputTaxRows,
  exportGstr1B2cCsv,
  exportVendorGstCsv,
  exportVendorGstExcel,
  exportVendorGstPdf,
  type GstFilingMeta,
  type InputTaxRow,
} from '@/features/reports/gstFilingExport';
import {
  applyReportDatePreset,
  rangeForReportPreset,
  type ReportDatePreset,
} from '@hlm-dates/istReportPresets';

export function useVendorGstFiling(active: boolean) {
  const { session } = useAuth();
  const initial = rangeForReportPreset('month');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [includeLines, setIncludeLines] = useState(true);
  const [gstReport, setGstReport] = useState<VendorGstReport | null>(null);
  const [settlements, setSettlements] = useState<VendorSettlement[]>([]);
  const [shopName, setShopName] = useState('');
  const [gstin, setGstin] = useState('');
  const [supplier, setSupplier] = useState<BillParty | null>(null);
  const [recipient, setRecipient] = useState<BillParty | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((next: ReportDatePreset) => {
    applyReportDatePreset(next, setPreset, setFrom, setTo);
  }, []);

  const reload = useCallback(async () => {
    if (!session || !active) return;
    setLoading(true);
    setError(null);
    try {
      const [gst, stl, shop, me, billProfile] = await Promise.all([
        fetchVendorGstReport(session.accessToken, session.vendorId, { from, to, includeLines }),
        listMySettlements(session.accessToken, session.vendorId),
        fetchMyShop(session.accessToken, session.vendorId).catch(() => null),
        apiRequest<{ gstNumber?: string | null; businessName?: string | null }>(
          '/api/v1/vendors/me',
          { token: session.accessToken, vendorId: session.vendorId },
        ).catch(() => null),
        fetchSupplierBillProfile().catch(() => null),
      ]);
      setGstReport(gst);
      setSettlements(stl ?? []);
      const name = shop?.name ?? me?.businessName ?? 'Shop';
      setShopName(name);
      const vendorGst = (me?.gstNumber ?? '').trim().toUpperCase();
      setGstin(vendorGst);
      const townCode = gstStateCodeFromTown(shop?.stateCode);
      const vendorCode = gstStateCodeFromGstin(vendorGst) || townCode;
      setRecipient({
        legalName: me?.businessName ?? name,
        gstin: vendorGst,
        address: shop?.addressLine ?? '',
        gstStateCode: vendorCode,
        stateName: stateNameFor(vendorCode, shop?.stateCode ?? undefined),
      });
      if (billProfile) {
        setSupplier({
          legalName: billProfile.supplierLegalName ?? 'KoyaKart',
          gstin: (billProfile.supplierGstin ?? '').trim().toUpperCase(),
          address: billProfile.supplierAddress ?? '',
          gstStateCode: billProfile.supplierGstStateCode ?? '',
          stateName: stateNameFor(billProfile.supplierGstStateCode ?? '', billProfile.supplierAddress),
        });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load GST report');
      setGstReport(null);
    } finally {
      setLoading(false);
    }
  }, [session, active, from, to, includeLines]);

  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);

  const meta: GstFilingMeta | null = useMemo(
    () =>
      gstReport && recipient
        ? {
            shopName,
            gstin,
            from,
            to,
            placeOfSupplyCode: recipient.gstStateCode || gstStateCodeFromGstin(gstin) || '',
            placeOfSupplyName:
              recipient.stateName ||
              stateNameFor(recipient.gstStateCode || gstStateCodeFromGstin(gstin) || ''),
            eCommerceGstin: supplier?.gstin ?? '',
          }
        : null,
    [gstReport, shopName, gstin, from, to, recipient, supplier],
  );

  const inputTaxRows: InputTaxRow[] = useMemo(() => {
    if (!supplier || !recipient || !gstReport) return [];
    return buildInputTaxRows(settlements, from, to, supplier, recipient);
  }, [settlements, from, to, supplier, recipient, gstReport]);

  function downloadExcel() {
    if (!meta || !gstReport) return;
    exportVendorGstExcel(meta, gstReport, inputTaxRows);
  }

  function downloadCsv() {
    if (!meta || !gstReport) return;
    exportVendorGstCsv(meta, gstReport, inputTaxRows);
  }

  function downloadPdf() {
    if (!meta || !gstReport) return;
    exportVendorGstPdf(meta, gstReport, inputTaxRows);
  }

  function downloadGstr1B2c() {
    if (!meta || !gstReport) return;
    exportGstr1B2cCsv(meta, gstReport);
  }

  return {
    preset,
    setPreset: applyPreset,
    from,
    setFrom,
    to,
    setTo,
    includeLines,
    setIncludeLines,
    gstReport,
    inputTaxRows,
    meta,
    loading,
    error,
    reload,
    downloadCsv,
    downloadExcel,
    downloadPdf,
    downloadGstr1B2c,
  };
}
