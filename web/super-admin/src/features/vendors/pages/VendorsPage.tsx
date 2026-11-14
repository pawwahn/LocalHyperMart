import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ConfigWriteBanner } from '@/shared/auth/ConfigWriteBanner';
import { usePlatformAdminAccess } from '@/shared/auth/usePlatformAdminAccess';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField, SearchSelect, ConfirmDialog } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listServices, type ServiceOffering } from '@/features/services/api/servicesApi';
import { Link } from 'react-router-dom';
import { TermsAcceptBlock } from '@hlm-legal';
import {
  VENDOR_DIAGNOSTICS_LAB_TYPE_OPTIONS,
  VENDOR_SERVICE_FOR_OPTIONS,
  isBeautyServiceName,
  isDiagnosticsLabType,
  isDiagnosticsServiceName,
  normalizeDiagnosticsLabType,
  normalizeServiceFor,
  serviceForAudienceLabel,
  serviceForLabel,
  vendorNameWithServiceFor,
} from '@hlm-vendor';
import type { VendorServiceFor } from '@hlm-vendor';
import {
  approveRegistration,
  createRegistrationRequest,
  listRegistrationRequests,
  listVendors,
  rejectRegistration,
  resetVendorLoginPassword,
  updateVendorProfile,
  updateVendorStatus,
  type VendorRegistrationVm,
  type VendorVm,
} from '../api/vendorsApi';

type Tab = 'pending' | 'vendors' | 'history';

function townLabel(t: TownVm): string {
  const place = t.displayName || t.townCode;
  const bits = [place, t.townCode && t.townCode !== place ? t.townCode : null, t.countryCode]
    .filter(Boolean);
  return bits.join(' · ');
}

function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function VendorsPage() {
  const { session } = useAuth();
  const { canWriteConfig } = usePlatformAdminAccess();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [tab, setTab] = useState<Tab>('vendors');
  const [showAdd, setShowAdd] = useState(false);
  const [requests, setRequests] = useState<VendorRegistrationVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [serviceFor, setServiceFor] = useState<VendorServiceFor | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [disableId, setDisableId] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [pendingEnable, setPendingEnable] = useState<VendorVm | null>(null);
  const [approveTarget, setApproveTarget] = useState<VendorRegistrationVm | null>(null);
  const [approvePassword, setApprovePassword] = useState('');
  const [resetLoginTarget, setResetLoginTarget] = useState<VendorVm | null>(null);
  const [resetLoginPassword, setResetLoginPassword] = useState('');
  const [resetLoginBusy, setResetLoginBusy] = useState(false);
  const [resetLoginError, setResetLoginError] = useState<string | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editShopName, setEditShopName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGstNumber, setEditGstNumber] = useState('');
  const [editFssaiNumber, setEditFssaiNumber] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editIfsc, setEditIfsc] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editServiceFor, setEditServiceFor] = useState<VendorServiceFor | ''>('');
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [vendorTermsAcknowledged, setVendorTermsAcknowledged] = useState(false);
  const [acknowledgedLegalVersion, setAcknowledgedLegalVersion] = useState(1);

  const townById = useMemo(() => {
    const map = new Map<string, TownVm>();
    for (const t of towns) map.set(t.id, t);
    return map;
  }, [towns]);

  const pendingForTown = useMemo(
    () => (townId ? requests.filter((r) => r.townId === townId) : requests),
    [requests, townId],
  );

  const filteredPending = useMemo(() => {
    return pendingForTown.filter((r) =>
      matchesQuery(
        [r.shopName, r.businessName, r.ownerName, r.phone, r.address, r.serviceName].filter(Boolean).join(' '),
        listQuery,
      ),
    );
  }, [pendingForTown, listQuery]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) =>
      matchesQuery(
        [v.shopName, v.businessName, v.ownerName, v.phone, v.status, v.serviceName].filter(Boolean).join(' '),
        listQuery,
      ),
    );
  }, [vendors, listQuery]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const problems: string[] = [];

    let townList: TownVm[] = [];
    try {
      townList = await listTowns(token);
      setTowns(townList);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : 'Could not load towns');
      setTowns([]);
    }

    const selectedTownId = townList.some((t) => t.id === townId) ? townId : (townList[0]?.id ?? '');
    if (selectedTownId && selectedTownId !== townId) {
      setTownId(selectedTownId);
    }

    try {
      setRequests(await listRegistrationRequests(token, 'PENDING'));
    } catch (err) {
      problems.push(err instanceof Error ? err.message : 'Could not load registration requests');
      setRequests([]);
    }

    try {
      setServices(await listServices(token));
    } catch (err) {
      problems.push(err instanceof Error ? err.message : 'Could not load services');
      setServices([]);
    }

    if (selectedTownId) {
      try {
        setVendors(await listVendors(token, selectedTownId));
      } catch (err) {
        problems.push(err instanceof Error ? err.message : 'Could not load vendors');
        setVendors([]);
      }
    } else {
      setVendors([]);
    }

    if (problems.length > 0) {
      setError([...new Set(problems)].join(' · '));
    }
    setLoading(false);
  }, [token, townId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmitRequest() {
    if (!townId) {
      setError('Select a town first');
      return;
    }
    const normalizedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setError('Phone must be a 10-digit Indian mobile number');
      return;
    }
    if (!serviceId) {
      setError('Select a service');
      return;
    }
    const selectedServiceName = serviceNameById.get(serviceId);
    const needsServiceFor = isBeautyServiceName(selectedServiceName);
    const needsDiagnosticsLabType = isDiagnosticsServiceName(selectedServiceName);
    if (needsServiceFor && !serviceFor) {
      setError('Select who this service is for (Male, Female, or Unisex)');
      return;
    }
    if (needsDiagnosticsLabType && !isDiagnosticsLabType(serviceFor)) {
      setError('Select lab type (Private Lab or Hospital Lab)');
      return;
    }
    if (!vendorTermsAcknowledged) {
      setError('Confirm vendor was shown and agrees to platform policies');
      return;
    }
    const gst = gstNumber.trim().toUpperCase();
    if (gst && (!bankAccount.trim() || !ifsc.trim())) {
      setError('Bank account and IFSC are required when GST number is provided');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createRegistrationRequest(token, {
        townId,
        serviceId,
        serviceFor:
          needsServiceFor && serviceFor
            ? serviceFor
            : needsDiagnosticsLabType && isDiagnosticsLabType(serviceFor)
              ? serviceFor
              : 'UNISEX',
        businessName: businessName.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: normalizedPhone,
        shopName: shopName.trim(),
        address: address.trim() || undefined,
        gstNumber: gst || undefined,
        fssaiNumber: fssaiNumber.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        ifsc: ifsc.trim() || undefined,
        vendorTermsAcknowledged: true,
        acknowledgedLegalVersion,
      });
      setNotice('Request submitted — approve it under Pending');
      setBusinessName('');
      setOwnerName('');
      setPhone('');
      setShopName('');
      setAddress('');
      setGstNumber('');
      setFssaiNumber('');
      setBankAccount('');
      setIfsc('');
      setServiceId('');
      setServiceFor('');
      setVendorTermsAcknowledged(false);
      setShowAdd(false);
      setTab('pending');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function onApproveConfirm() {
    if (!approveTarget) return;
    if (!canWriteConfig) {
      setApproveError('You need config write access to approve vendors.');
      return;
    }
    setApproveBusy(true);
    setApproveError(null);
    setError(null);
    setNotice(null);
    try {
      const custom = approvePassword.trim();
      const approved = await approveRegistration(
        token,
        approveTarget.id,
        custom.length >= 8 ? custom : undefined,
      );
      const pwd = approved.temporaryPassword?.trim();
      setNotice(
        pwd
          ? `Approved. Share once — ${approved.phone} / ${pwd}`
          : 'Vendor approved',
      );
      setApproveTarget(null);
      setApprovePassword('');
      setTab('vendors');
      await reload();
    } catch (err) {
      setApproveError(err instanceof ApiError || err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setApproveBusy(false);
    }
  }

  async function onResetLoginConfirm() {
    if (!resetLoginTarget) return;
    if (!canWriteConfig) {
      setResetLoginError('You need config write access to reset vendor logins.');
      return;
    }
    const next = resetLoginPassword.trim();
    if (next.length < 8) {
      setResetLoginError('Password must be at least 8 characters');
      return;
    }
    const phone = resetLoginTarget.phone;
    setResetLoginBusy(true);
    setResetLoginError(null);
    setError(null);
    setNotice(null);
    try {
      await resetVendorLoginPassword(token, resetLoginTarget.id, next);
      setNotice(`Portal password updated for ${phone}. Share once with the shop owner.`);
      setResetLoginTarget(null);
      setResetLoginPassword('');
      setResetLoginError(null);
    } catch (err) {
      const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Could not reset password';
      setResetLoginError(
        msg.includes('404') || /not found/i.test(msg)
          ? `${msg} If you just deployed, restart vendor-service and hard-refresh this page.`
          : msg,
      );
    } finally {
      setResetLoginBusy(false);
    }
  }

  function defaultVendorTempPassword(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const tail = digits.length >= 4 ? digits.slice(-4) : '????';
    return `HlM@${tail}`;
  }

  async function onRejectConfirm() {
    if (!rejectId || !rejectReason.trim()) {
      setError('Enter a reject reason');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await rejectRegistration(token, rejectId, rejectReason.trim());
      setNotice('Request rejected');
      setRejectId(null);
      setRejectReason('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDisableConfirm() {
    if (!disableId || !disableReason.trim()) {
      setError('Enter a disable reason');
      return;
    }
    setStatusBusyId(disableId);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVendorStatus(token, disableId, 'DISABLED', disableReason.trim());
      setNotice(`${updated.shopName ?? updated.businessName} disabled`);
      setDisableId(null);
      setDisableReason('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Disable failed');
    } finally {
      setStatusBusyId(null);
    }
  }

  function openEdit(vendor: VendorVm) {
    setEditSaveError(null);
    setEditId(vendor.id);
    setEditBusinessName(vendor.businessName ?? '');
    setEditOwnerName(vendor.ownerName ?? '');
    setEditShopName(vendor.shopName ?? vendor.businessName ?? '');
    setEditAddress(vendor.address ?? '');
    setEditGstNumber(vendor.gstNumber ?? '');
    setEditFssaiNumber(vendor.fssaiNumber ?? '');
    setEditBankAccount(vendor.bankAccount ?? '');
    setEditIfsc(vendor.ifsc ?? '');
    setEditServiceId(vendor.serviceId ?? '');
    const vendorServiceName = vendor.serviceName ?? serviceNameById.get(vendor.serviceId ?? '');
    setEditServiceFor(
      isBeautyServiceName(vendorServiceName)
        ? (normalizeServiceFor(vendor.serviceFor) ?? 'UNISEX')
        : isDiagnosticsServiceName(vendorServiceName)
          ? (normalizeDiagnosticsLabType(vendor.serviceFor) ?? '')
          : '',
    );
    setDisableId(null);
    setDisableReason('');
    setRejectId(null);
  }

  function closeEdit() {
    setEditId(null);
    setEditSaveError(null);
  }

  function offeringNameForService(serviceId: string, vendorRecord?: VendorVm | null): string | undefined {
    const fromCatalog = serviceNameById.get(serviceId);
    if (fromCatalog?.trim()) return fromCatalog;
    const fromVendor = vendorRecord?.serviceName?.trim();
    return fromVendor || undefined;
  }

  async function onSaveEdit() {
    if (!editId) return;
    const gst = editGstNumber.trim().toUpperCase();
    if (gst && (!editBankAccount.trim() || !editIfsc.trim())) {
      setError('Bank account and IFSC are required when GST number is provided');
      return;
    }
    if (!editBusinessName.trim() || !editShopName.trim()) {
      setError('Business and shop name are required');
      return;
    }
    if (!editServiceId) {
      setError('Select a service');
      return;
    }
    const editingVendor = vendors.find((v) => v.id === editId) ?? null;
    const editSelectedServiceName = offeringNameForService(editServiceId, editingVendor);
    const needsServiceFor = isBeautyServiceName(editSelectedServiceName);
    const needsDiagnosticsLabType = isDiagnosticsServiceName(editSelectedServiceName);
    if (needsServiceFor && !editServiceFor) {
      setError('Select who this service is for (Male, Female, or Unisex)');
      return;
    }
    if (needsDiagnosticsLabType && !isDiagnosticsLabType(editServiceFor)) {
      setError('Select lab type (Private Lab or Hospital Lab)');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setEditSaveError(null);
    try {
      const updated = await updateVendorProfile(token, editId, {
        businessName: editBusinessName.trim(),
        ownerName: editOwnerName.trim() || undefined,
        shopName: editShopName.trim(),
        serviceId: editServiceId,
        serviceFor:
          needsServiceFor && editServiceFor
            ? editServiceFor
            : needsDiagnosticsLabType && isDiagnosticsLabType(editServiceFor)
              ? editServiceFor
              : 'UNISEX',
        address: editAddress.trim() || undefined,
        gstNumber: gst || undefined,
        fssaiNumber: editFssaiNumber.trim() || undefined,
        bankAccount: editBankAccount.trim() || undefined,
        ifsc: editIfsc.trim() || undefined,
      });
      const savedFor = normalizeServiceFor(updated.serviceFor);
      if (needsServiceFor && savedFor && savedFor !== editServiceFor) {
        setError(
          `Service for did not stick (saved as ${savedFor}). Restart vendor-service after migration V25.`,
        );
        return;
      }
      if (needsDiagnosticsLabType && !isDiagnosticsLabType(updated.serviceFor)) {
        const stuckMsg =
          `Lab type did not save (server returned ${serviceForLabel(updated.serviceFor) || 'Unisex'}). ` +
          'Rebuild vendor-service and restart it (e.g. mvn -DskipTests package, then docker compose up -d --build vendor-service).';
        setEditSaveError(stuckMsg);
        setError(stuckMsg);
        return;
      }
      setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setNotice(`Updated ${updated.shopName ?? updated.businessName}`);
      setEditId(null);
      try {
        await reload();
      } catch (reloadErr) {
        setError(
          reloadErr instanceof ApiError || reloadErr instanceof Error
            ? `Saved, but refresh failed: ${reloadErr.message}`
            : 'Saved, but refresh failed — use Refresh',
        );
      }
    } catch (err) {
      const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Update failed';
      setEditSaveError(msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function requestEnable(vendor: VendorVm) {
    setPendingEnable(vendor);
  }

  async function onEnableConfirm() {
    if (!pendingEnable) return;
    const vendor = pendingEnable;
    setStatusBusyId(vendor.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVendorStatus(token, vendor.id, 'ACTIVE');
      setNotice(`${updated.shopName ?? updated.businessName} re-enabled`);
      setPendingEnable(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Enable failed');
    } finally {
      setStatusBusyId(null);
    }
  }

  const selectedTown = townById.get(townId);
  const pendingCount = pendingForTown.length;
  const vendorCount = vendors.length;

  const townOptions = useMemo(
    () =>
      towns.map((t) => ({
        value: t.id,
        label: `${townLabel(t)}${t.status !== 'ENABLED' ? ' · DISABLED' : ''}`,
        searchText: [t.displayName, t.townCode, t.state, t.stateCode, t.country, t.countryCode, t.status]
          .filter(Boolean)
          .join(' '),
      })),
    [towns],
  );

  const serviceOptions = useMemo(
    () => services.map((service) => ({ value: service.id, label: service.name })),
    [services],
  );

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const service of services) map.set(service.id, service.name);
    return map;
  }, [services]);

  const editingVendor = useMemo(
    () => (editId ? vendors.find((v) => v.id === editId) ?? null : null),
    [editId, vendors],
  );

  const addNeedsServiceFor = isBeautyServiceName(serviceNameById.get(serviceId));
  const addNeedsDiagnosticsLabType = isDiagnosticsServiceName(serviceNameById.get(serviceId));
  const editNeedsServiceFor = isBeautyServiceName(offeringNameForService(editServiceId, editingVendor));
  const editNeedsDiagnosticsLabType = isDiagnosticsServiceName(offeringNameForService(editServiceId, editingVendor));

  function onAddServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId);
    const nextName = serviceNameById.get(nextServiceId);
    if (!isBeautyServiceName(nextName) && !isDiagnosticsServiceName(nextName)) {
      setServiceFor('');
    }
  }

  function onEditServiceChange(nextServiceId: string) {
    setEditServiceId(nextServiceId);
    const nextName = serviceNameById.get(nextServiceId);
    if (!isBeautyServiceName(nextName) && !isDiagnosticsServiceName(nextName)) {
      setEditServiceFor('');
    }
  }

  return (
    <PortalShell title="Vendors" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      <ConfigWriteBanner noun="vendors" />

      <Card elevated style={styles.toolbar}>
        <div style={styles.toolbarRow}>
          <SearchSelect
            label="Town"
            value={townId}
            options={townOptions}
            onChange={setTownId}
            disabled={towns.length === 0}
            placeholder={loading ? 'Loading towns…' : 'Search by name, code, or state…'}
            emptyMessage={towns.length === 0 ? 'No towns yet' : 'No towns match your search'}
          />
          <div style={styles.toolbarActions}>
            <Button
              size="sm"
              variant={showAdd ? 'secondary' : 'primary'}
              disabled={!canWriteConfig || !townId}
              title={canWriteConfig ? undefined : 'Write access required'}
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? 'Close' : 'Add vendor'}
            </Button>
            <Link to="/services" style={styles.textLink}>
              Services
            </Link>
          </div>
        </div>
        {selectedTown ? (
          <p style={styles.townHint}>
            Managing <strong>{selectedTown.displayName}</strong>
            {selectedTown.country ? ` · ${selectedTown.country}` : ''}
          </p>
        ) : null}
      </Card>

      {showAdd ? (
        <Card style={styles.addCard}>
          <div style={styles.addHead}>
            <h2 style={styles.sectionTitle}>New registration</h2>
            <p style={styles.subtle}>Approve later to create login + shop.</p>
          </div>
          <div style={styles.formGrid}>
            <SearchSelect
              label="Service"
              value={serviceId}
              options={serviceOptions}
              onChange={onAddServiceChange}
              placeholder={services.length === 0 ? 'Add a service first' : 'Select service'}
              emptyMessage="No services yet"
            />
            {addNeedsServiceFor ? (
              <SearchSelect
                label="Service for"
                value={serviceFor}
                options={VENDOR_SERVICE_FOR_OPTIONS}
                onChange={(v) => setServiceFor(v as VendorServiceFor)}
                placeholder="Male / Female / Unisex"
                emptyMessage="No options"
              />
            ) : null}
            {addNeedsDiagnosticsLabType ? (
              <SearchSelect
                label="Lab type"
                value={serviceFor}
                options={VENDOR_DIAGNOSTICS_LAB_TYPE_OPTIONS}
                onChange={(v) => setServiceFor(v as VendorServiceFor)}
                placeholder="Private Lab / Hospital Lab"
                emptyMessage="No options"
              />
            ) : null}
            <TextField label="Business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <TextField label="Shop" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            <TextField label="Owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="10 digits"
            />
            <div style={styles.fullWidth}>
              <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <TextField
              label="GST number (optional)"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="15-char GSTIN"
              maxLength={15}
            />
            <TextField
              label="FSSAI number (optional)"
              value={fssaiNumber}
              onChange={(e) => setFssaiNumber(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="14 digits"
              inputMode="numeric"
              maxLength={14}
            />
            <TextField
              label="Bank account (if GST)"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Required when GST is set"
            />
            <TextField
              label="IFSC (if GST)"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              placeholder="Required when GST is set"
              maxLength={11}
            />
          </div>
          <p style={styles.subtle}>
            GST and FSSAI are optional. Fee / subscription model is configured later under Billing (per vendor).
          </p>
          <TermsAcceptBlock
            accepted={vendorTermsAcknowledged}
            onAcceptedChange={setVendorTermsAcknowledged}
            onVersion={setAcknowledgedLegalVersion}
          />
          <p style={styles.subtle}>
            Tick only after the shop owner has read Terms, Privacy and Refund (onboarding attestation).
          </p>
          <div style={styles.formActions}>
            <Button
              disabled={
                !canWriteConfig ||
                busy ||
                !townId ||
                !serviceId ||
                (addNeedsServiceFor && !serviceFor) ||
                (addNeedsDiagnosticsLabType && !isDiagnosticsLabType(serviceFor)) ||
                !businessName.trim() ||
                !shopName.trim() ||
                !phone.trim() ||
                !vendorTermsAcknowledged
              }
              onClick={() => void onSubmitRequest()}
            >
              {busy ? 'Submitting…' : 'Submit'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card style={styles.mainCard}>
        <div style={styles.listHeader}>
          <div style={styles.tabs}>
            <button
              type="button"
              style={tab === 'pending' ? styles.tabActive : styles.tab}
              onClick={() => setTab('pending')}
            >
              Pending
              <span style={pendingCount > 0 ? styles.badgeHot : styles.badge}>{pendingCount}</span>
            </button>
            <button
              type="button"
              style={tab === 'vendors' ? styles.tabActive : styles.tab}
              onClick={() => setTab('vendors')}
            >
              Vendors
              <span style={styles.badge}>{vendorCount}</span>
            </button>
            <button
              type="button"
              style={tab === 'history' ? styles.tabActive : styles.tab}
              onClick={() => setTab('history')}
            >
              History
            </button>
          </div>
          {tab === 'history' ? null : (
            <input
              style={styles.listSearch}
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={tab === 'pending' ? 'Filter pending…' : 'Filter vendors…'}
              aria-label={tab === 'pending' ? 'Filter pending' : 'Filter vendors'}
            />
          )}
        </div>

        {tab === 'history' && token ? (
          <AdminHistoryPanel
            embedded
            tall
            token={token}
            screen="vendors"
            townId={townId || undefined}
            refreshTick={notice ? notice.length : 0}
            searchPlaceholder="Search shop, field, or status…"
            emptyHint="Each save lists the previous value and the new value for every field that changed."
          />
        ) : tab === 'pending' ? (
          <div style={styles.list}>
            {loading && pendingForTown.length === 0 ? (
              <p style={styles.empty}>Loading…</p>
            ) : pendingForTown.length === 0 ? (
              <div style={styles.emptyBox}>
                <p style={styles.emptyTitle}>Nothing pending</p>
                <p style={styles.subtle}>Add a vendor to create a request for this town.</p>
              </div>
            ) : filteredPending.length === 0 ? (
              <p style={styles.empty}>No matches for “{listQuery.trim()}”.</p>
            ) : (
              filteredPending.map((req) => (
                <div key={req.id} style={styles.item}>
                  <div style={styles.avatar}>{initials(req.shopName || req.businessName)}</div>
                  <div style={styles.itemBody}>
                    <div style={styles.itemTitleRow}>
                      <strong style={styles.itemName}>
                        {vendorNameWithServiceFor(req.shopName, req.serviceFor, req.serviceName)}
                      </strong>
                      <span style={styles.pillWarn}>Pending</span>
                    </div>
                    <p style={styles.meta}>
                      {req.businessName}
                      {req.serviceName ? ` · ${req.serviceName}` : ''}
                      {req.ownerName ? ` · ${req.ownerName}` : ''} · {req.phone}
                      {req.gstNumber ? ` · GST ${req.gstNumber}` : ''}
                      {req.fssaiNumber ? ` · FSSAI ${req.fssaiNumber}` : ''}
                    </p>
                    {rejectId === req.id ? (
                      <div style={styles.inlineForm}>
                        <TextField
                          label="Reject reason"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Required"
                        />
                        <div style={styles.actions}>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!canWriteConfig || busy}
                            onClick={() => void onRejectConfirm()}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              setRejectId(null);
                              setRejectReason('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.actions}>
                        <Button
                          size="sm"
                          disabled={!canWriteConfig || busy}
                          onClick={() => {
                            setApprovePassword('');
                            setApproveError(null);
                            setApproveTarget(req);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canWriteConfig || busy}
                          onClick={() => {
                            setRejectId(req.id);
                            setRejectReason('');
                            setDisableId(null);
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={styles.list}>
            {loading && vendors.length === 0 ? (
              <p style={styles.empty}>Loading…</p>
            ) : vendors.length === 0 ? (
              <div style={styles.emptyBox}>
                <p style={styles.emptyTitle}>No vendors yet</p>
                <p style={styles.subtle}>Approve a pending request or add a new registration.</p>
              </div>
            ) : filteredVendors.length === 0 ? (
              <p style={styles.empty}>No matches for “{listQuery.trim()}”.</p>
            ) : (
              filteredVendors.map((v) => {
                const statusBusy = statusBusyId === v.id;
                const disabling = disableId === v.id;
                const editing = editId === v.id;
                const disabled = v.status === 'DISABLED';
                return (
                  <div key={v.id} style={styles.item}>
                    <div style={disabled ? styles.avatarMuted : styles.avatar}>
                      {initials(v.shopName || v.businessName)}
                    </div>
                    <div style={styles.itemBody}>
                      <div style={styles.itemTitleRow}>
                        <strong style={styles.itemName}>
                          {vendorNameWithServiceFor(
                            v.shopName ?? v.businessName,
                            v.serviceFor,
                            v.serviceName,
                          )}
                        </strong>
                        <span style={disabled ? styles.pillDanger : styles.pillOk}>
                          {disabled ? 'Disabled' : 'Active'}
                        </span>
                      </div>
                      <p style={styles.meta}>
                        {v.businessName}
                        {v.serviceName ? ` · ${v.serviceName}` : ''}
                        {serviceForAudienceLabel(v.serviceName, v.serviceFor)
                          ? ` · ${serviceForAudienceLabel(v.serviceName, v.serviceFor)}`
                          : ''}
                        {v.ownerName ? ` · ${v.ownerName}` : ''} · {v.phone}
                        {v.gstNumber ? ` · GST ${v.gstNumber}` : ' · No GST'}
                        {v.fssaiNumber ? ` · FSSAI ${v.fssaiNumber}` : ''}
                      </p>
                      {disabled && v.disabledReason ? (
                        <p style={styles.reason}>Reason: {v.disabledReason}</p>
                      ) : null}
                      {editing ? (
                        <div style={styles.inlineForm}>
                          <div style={styles.formGrid}>
                            <SearchSelect
                              label="Service"
                              value={editServiceId}
                              options={serviceOptions}
                              onChange={onEditServiceChange}
                              placeholder={services.length === 0 ? 'Add a service first' : 'Select service'}
                              emptyMessage="No services yet"
                            />
                            {editNeedsServiceFor ? (
                              <SearchSelect
                                label="Service for"
                                value={editServiceFor}
                                options={VENDOR_SERVICE_FOR_OPTIONS}
                                onChange={(v) => setEditServiceFor(v as VendorServiceFor)}
                                placeholder="Male / Female / Unisex"
                                emptyMessage="No options"
                              />
                            ) : null}
                            {editNeedsDiagnosticsLabType ? (
                              <SearchSelect
                                label="Lab type"
                                value={editServiceFor}
                                options={VENDOR_DIAGNOSTICS_LAB_TYPE_OPTIONS}
                                onChange={(v) => setEditServiceFor(v as VendorServiceFor)}
                                placeholder="Private Lab / Hospital Lab"
                                emptyMessage="No options"
                              />
                            ) : null}
                            <TextField
                              label="Business"
                              value={editBusinessName}
                              onChange={(e) => setEditBusinessName(e.target.value)}
                            />
                            <TextField
                              label="Shop"
                              value={editShopName}
                              onChange={(e) => setEditShopName(e.target.value)}
                            />
                            <TextField
                              label="Owner"
                              value={editOwnerName}
                              onChange={(e) => setEditOwnerName(e.target.value)}
                            />
                            <TextField label="Phone" value={v.phone} disabled />
                            <div style={styles.fullWidth}>
                              <TextField
                                label="Address"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                              />
                            </div>
                            <TextField
                              label="GST number (optional)"
                              value={editGstNumber}
                              onChange={(e) => setEditGstNumber(e.target.value.toUpperCase())}
                              placeholder="15-char GSTIN"
                              maxLength={15}
                            />
                            <TextField
                              label="FSSAI number (optional)"
                              value={editFssaiNumber}
                              onChange={(e) =>
                                setEditFssaiNumber(e.target.value.replace(/\D/g, '').slice(0, 14))
                              }
                              placeholder="14 digits"
                              inputMode="numeric"
                              maxLength={14}
                            />
                            <TextField
                              label="Bank account (if GST)"
                              value={editBankAccount}
                              onChange={(e) => setEditBankAccount(e.target.value)}
                            />
                            <TextField
                              label="IFSC (if GST)"
                              value={editIfsc}
                              onChange={(e) => setEditIfsc(e.target.value.toUpperCase())}
                              maxLength={11}
                            />
                          </div>
                          {editSaveError ? <p style={styles.editSaveError}>{editSaveError}</p> : null}
                          <div style={styles.actions}>
                            <Button size="sm" disabled={!canWriteConfig || busy} onClick={() => void onSaveEdit()}>
                              {busy ? 'Saving…' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={closeEdit}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : disabling ? (
                        <div style={styles.inlineForm}>
                          <TextField
                            label="Disable reason"
                            value={disableReason}
                            onChange={(e) => setDisableReason(e.target.value)}
                            placeholder="Required"
                          />
                          <div style={styles.actions}>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={!canWriteConfig || statusBusy}
                              onClick={() => void onDisableConfirm()}
                            >
                              {statusBusy ? '…' : 'Confirm'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={statusBusy}
                              onClick={() => {
                                setDisableId(null);
                                setDisableReason('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div style={styles.actions}>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!canWriteConfig || statusBusy || busy}
                            onClick={() => openEdit(v)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canWriteConfig || statusBusy || busy}
                            onClick={() => {
                              setResetLoginPassword('');
                              setResetLoginError(null);
                              setResetLoginTarget(v);
                            }}
                          >
                            Reset login
                          </Button>
                          {disabled ? (
                            <Button
                              size="sm"
                              disabled={!canWriteConfig || statusBusy || busy}
                              onClick={() => requestEnable(v)}
                            >
                              {statusBusy ? '…' : 'Enable'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!canWriteConfig || statusBusy || busy}
                              onClick={() => {
                                setDisableId(v.id);
                                setDisableReason('');
                                setRejectId(null);
                                setEditId(null);
                              }}
                            >
                              Disable
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingEnable)}
        title={`Re-enable ${pendingEnable?.shopName ?? pendingEnable?.businessName}?`}
        description="Buyers will see this shop again in the town catalog."
        confirmLabel="Enable shop"
        cancelLabel="Cancel"
        danger={false}
        busy={Boolean(statusBusyId)}
        onConfirm={() => void onEnableConfirm()}
        onClose={() => {
          if (!statusBusyId) setPendingEnable(null);
        }}
      />

      <ConfirmDialog
        open={approveTarget != null}
        title="Approve vendor?"
        description={
          approveTarget ? (
            <div style={styles.resetDlg}>
              <p style={styles.resetHint}>
                Create portal login for <strong>{approveTarget.phone}</strong> (
                {approveTarget.shopName || approveTarget.businessName}).
              </p>
              {approveError ? <Banner tone="danger">{approveError}</Banner> : null}
              <TextField
                label="Portal password (optional)"
                type="password"
                value={approvePassword}
                onChange={(e) => setApprovePassword(e.target.value)}
                autoComplete="new-password"
                placeholder={`Default ${defaultVendorTempPassword(approveTarget.phone)}`}
              />
              <p style={styles.resetHint}>
                Leave blank to use the default{' '}
                <strong>{defaultVendorTempPassword(approveTarget.phone)}</strong>. Min 8 characters if you set your own.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Approve & create login"
        busy={approveBusy}
        danger={false}
        confirmDisabled={
          !canWriteConfig || (approvePassword.trim().length > 0 && approvePassword.trim().length < 8)
        }
        onClose={() => {
          if (!approveBusy) {
            setApproveTarget(null);
            setApprovePassword('');
            setApproveError(null);
          }
        }}
        onConfirm={() => void onApproveConfirm()}
      />

      <ConfirmDialog
        open={resetLoginTarget != null}
        title="Reset vendor portal password?"
        description={
          resetLoginTarget ? (
            <div style={styles.resetDlg}>
              <p style={styles.resetHint}>
                Set a new password for <strong>{resetLoginTarget.phone}</strong> (
                {resetLoginTarget.shopName ?? resetLoginTarget.businessName}).
              </p>
              {resetLoginError ? <Banner tone="danger">{resetLoginError}</Banner> : null}
              <TextField
                label="New password"
                type="password"
                value={resetLoginPassword}
                onChange={(e) => setResetLoginPassword(e.target.value)}
                autoComplete="new-password"
                disabled={resetLoginBusy}
              />
            </div>
          ) : null
        }
        confirmLabel="Update password"
        busy={resetLoginBusy}
        danger={false}
        confirmDisabled={!canWriteConfig || resetLoginPassword.trim().length < 8}
        onClose={() => {
          if (!resetLoginBusy) {
            setResetLoginTarget(null);
            setResetLoginPassword('');
            setResetLoginError(null);
          }
        }}
        onConfirm={() => void onResetLoginConfirm()}
      />
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbar: {
    display: 'grid',
    gap: '0.55rem',
    overflow: 'visible',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--bg-elevated)), var(--bg-elevated))',
  },
  toolbarRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'end',
    justifyContent: 'space-between',
  },
  textLink: {
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.86rem',
    alignSelf: 'center',
    textDecoration: 'none',
  },
  toolbarActions: { display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' },
  townHint: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.86rem',
  },
  addCard: {
    display: 'grid',
    gap: '0.85rem',
    borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
  },
  addHead: { display: 'grid', gap: '0.2rem' },
  sectionTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  subtle: { margin: 0, color: 'var(--text-muted)', fontSize: '0.86rem' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
    gap: '0.7rem',
  },
  fullWidth: { gridColumn: '1 / -1', minWidth: 0 },
  formActions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  mainCard: { display: 'grid', gap: '0.85rem', paddingTop: '0.85rem' },
  listHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listSearch: {
    flex: '1 1 160px',
    minWidth: 0,
    maxWidth: 280,
    boxSizing: 'border-box',
    padding: '0.55rem 0.8rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  tabs: {
    display: 'flex',
    gap: '0.3rem',
    padding: '0.2rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    width: 'fit-content',
    maxWidth: '100%',
    flexWrap: 'wrap',
  },
  tab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.9rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 'calc(var(--radius-md) - 2px)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  tabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.9rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 'calc(var(--radius-md) - 2px)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    boxShadow: 'var(--shadow-card)',
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 800,
    minWidth: '1.35rem',
    padding: '0.1rem 0.4rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'color-mix(in srgb, var(--text-muted) 16%, transparent)',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  badgeHot: {
    fontSize: '0.75rem',
    fontWeight: 800,
    minWidth: '1.35rem',
    padding: '0.1rem 0.4rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    color: 'var(--accent)',
    textAlign: 'center',
  },
  list: { display: 'grid', gap: '0.55rem' },
  item: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    padding: '0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '12px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    color: 'var(--text-inverse, #fff)',
    background: 'var(--accent)',
  },
  avatarMuted: {
    width: 40,
    height: 40,
    borderRadius: '12px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    color: 'var(--text-muted)',
    background: 'color-mix(in srgb, var(--text-muted) 14%, transparent)',
  },
  itemBody: { display: 'grid', gap: '0.35rem', flex: 1, minWidth: 0 },
  itemTitleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'center',
  },
  itemName: {
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
  },
  meta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.86rem' },
  reason: { margin: 0, color: 'var(--danger, #b42318)', fontSize: '0.82rem' },
  editSaveError: {
    margin: '0.35rem 0 0',
    color: 'var(--danger, #b42318)',
    fontSize: '0.84rem',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  pillOk: {
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '0.18rem 0.5rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    color: 'var(--accent)',
  },
  pillWarn: {
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '0.18rem 0.5rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'color-mix(in srgb, #b45309 14%, transparent)',
    color: '#b45309',
  },
  pillDanger: {
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '0.18rem 0.5rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'var(--danger-soft, #fee2e2)',
    color: 'var(--danger, #b42318)',
  },
  actions: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' },
  inlineForm: { display: 'grid', gap: '0.5rem', marginTop: '0.25rem' },
  empty: { margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' },
  emptyBox: {
    display: 'grid',
    gap: '0.25rem',
    placeItems: 'center',
    textAlign: 'center',
    padding: '1.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--border)',
    background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
  },
  emptyTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1rem',
  },
  resetDlg: { display: 'flex', flexDirection: 'column', gap: '0.55rem', textAlign: 'left' },
  resetHint: { margin: 0, fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--text)' },
};
