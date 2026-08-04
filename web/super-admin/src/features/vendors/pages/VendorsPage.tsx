import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField, SearchSelect } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  approveRegistration,
  createRegistrationRequest,
  listRegistrationRequests,
  listVendors,
  rejectRegistration,
  updateVendorProfile,
  updateVendorStatus,
  type VendorRegistrationVm,
  type VendorVm,
} from '../api/vendorsApi';

type Tab = 'pending' | 'vendors';

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
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [tab, setTab] = useState<Tab>('vendors');
  const [showAdd, setShowAdd] = useState(false);
  const [requests, setRequests] = useState<VendorRegistrationVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editShopName, setEditShopName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGstNumber, setEditGstNumber] = useState('');
  const [editFssaiNumber, setEditFssaiNumber] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editIfsc, setEditIfsc] = useState('');

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
      matchesQuery([r.shopName, r.businessName, r.ownerName, r.phone, r.address].filter(Boolean).join(' '), listQuery),
    );
  }, [pendingForTown, listQuery]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) =>
      matchesQuery([v.shopName, v.businessName, v.ownerName, v.phone, v.status].filter(Boolean).join(' '), listQuery),
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
        businessName: businessName.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: normalizedPhone,
        shopName: shopName.trim(),
        address: address.trim() || undefined,
        gstNumber: gst || undefined,
        fssaiNumber: fssaiNumber.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        ifsc: ifsc.trim() || undefined,
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
      setShowAdd(false);
      setTab('pending');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const approved = await approveRegistration(token, id);
      const pwd = approved.temporaryPassword?.trim();
      setNotice(
        pwd
          ? `Approved. Share once — ${approved.phone} / ${pwd}`
          : 'Vendor approved',
      );
      setTab('vendors');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
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
    setEditId(vendor.id);
    setEditBusinessName(vendor.businessName ?? '');
    setEditOwnerName(vendor.ownerName ?? '');
    setEditShopName(vendor.shopName ?? vendor.businessName ?? '');
    setEditAddress(vendor.address ?? '');
    setEditGstNumber(vendor.gstNumber ?? '');
    setEditFssaiNumber(vendor.fssaiNumber ?? '');
    setEditBankAccount(vendor.bankAccount ?? '');
    setEditIfsc(vendor.ifsc ?? '');
    setDisableId(null);
    setDisableReason('');
    setRejectId(null);
  }

  function closeEdit() {
    setEditId(null);
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
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVendorProfile(token, editId, {
        businessName: editBusinessName.trim(),
        ownerName: editOwnerName.trim() || undefined,
        shopName: editShopName.trim(),
        address: editAddress.trim() || undefined,
        gstNumber: gst || undefined,
        fssaiNumber: editFssaiNumber.trim() || undefined,
        bankAccount: editBankAccount.trim() || undefined,
        ifsc: editIfsc.trim() || undefined,
      });
      setNotice(`Updated ${updated.shopName ?? updated.businessName}`);
      setEditId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onEnable(vendor: VendorVm) {
    if (!window.confirm(`Re-enable ${vendor.shopName ?? vendor.businessName}? Buyers will see this shop again.`)) {
      return;
    }
    setStatusBusyId(vendor.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVendorStatus(token, vendor.id, 'ACTIVE');
      setNotice(`${updated.shopName ?? updated.businessName} re-enabled`);
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

  return (
    <PortalShell title="Vendors" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

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
          <Button
            size="sm"
            variant={showAdd ? 'secondary' : 'primary'}
            disabled={!townId}
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? 'Close' : 'Add vendor'}
          </Button>
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
          <div style={styles.formActions}>
            <Button
              disabled={busy || !townId || !businessName.trim() || !shopName.trim() || !phone.trim()}
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
          </div>
          <input
            style={styles.listSearch}
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder={tab === 'pending' ? 'Filter pending…' : 'Filter vendors…'}
            aria-label={tab === 'pending' ? 'Filter pending' : 'Filter vendors'}
          />
        </div>

        {tab === 'pending' ? (
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
                      <strong style={styles.itemName}>{req.shopName}</strong>
                      <span style={styles.pillWarn}>Pending</span>
                    </div>
                    <p style={styles.meta}>
                      {req.businessName}
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
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => void onRejectConfirm()}>
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
                        <Button size="sm" disabled={busy} onClick={() => void onApprove(req.id)}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
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
                        <strong style={styles.itemName}>{v.shopName ?? v.businessName}</strong>
                        <span style={disabled ? styles.pillDanger : styles.pillOk}>
                          {disabled ? 'Disabled' : 'Active'}
                        </span>
                      </div>
                      <p style={styles.meta}>
                        {v.businessName}
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
                          <div style={styles.actions}>
                            <Button size="sm" disabled={busy} onClick={() => void onSaveEdit()}>
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
                              disabled={statusBusy}
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
                            disabled={statusBusy || busy}
                            onClick={() => openEdit(v)}
                          >
                            Edit
                          </Button>
                          {disabled ? (
                            <Button size="sm" disabled={statusBusy || busy} onClick={() => void onEnable(v)}>
                              {statusBusy ? '…' : 'Enable'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={statusBusy || busy}
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
};
