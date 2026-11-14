import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { ApiError } from '@/shared/api/http';
import { Toast } from '@/shared/ui';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';
import {
  actOnDiagnosticsOrder,
  fetchDiagnosticsSession,
  fetchDiagnosticsStaffAudit,
  diagnosticsOwnerSessionFallback,
  fetchMyDiagnostics,
  fetchMyVisitsHistoryCount,
  fetchVendorDiagnosticsOrders,
  isVendorVisibleDiagnosticsBooking,
  resolveDiagnosticsWrites,
  upsertDiagnosticsBranch,
  upsertDiagnosticsStaff,
  upsertDiagnosticsPackage,
  upsertDiagnosticsTest,
  uploadDiagnosticsSamplePhoto,
  type DiagnosticsPortalProfile,
  type DiagnosticsStaffAuditRow,
  type DiagnosticsStaffSession,
  type DiagnosticsVendorOrder,
} from '../api/diagnosticsApi';
import { DiagnosticsCatalogPanel, packageSaveIssue, resolvePackageTestIds } from '@hlm-diagnostics';
import { DiagnosticsSlotsPanel } from '../components/DiagnosticsSlotsPanel';
import { DiagnosticsDispatchOrderCards } from '../components/DiagnosticsDispatchOrderCards';
import { DiagnosticsMyVisitsHistoryPanel } from '../components/DiagnosticsMyVisitsHistoryPanel';
import { DiagnosticsMyVisitsTabs } from '../components/DiagnosticsMyVisitsTabs';
import { DiagnosticsVisitActions } from '../components/DiagnosticsVisitActions';
import { filterOrdersAssignedToStaff, splitMyVisitOrders, type MyVisitsPane } from '../lib/diagnosticsMyVisits';

type DeskTab = 'overview' | 'visits' | 'staff' | 'branches' | 'slots' | 'tests' | 'audit';

const TABS: { id: DeskTab; label: string; emoji: string }[] = [
  { id: 'overview', label: 'Overview', emoji: '📋' },
  { id: 'visits', label: 'My visits', emoji: '📍' },
  { id: 'staff', label: 'Add staff', emoji: '➕' },
  { id: 'branches', label: 'Branches', emoji: '🏥' },
  { id: 'slots', label: 'Slots', emoji: '🕐' },
  { id: 'tests', label: 'Tests', emoji: '💉' },
  { id: 'audit', label: 'Audit', emoji: '📜' },
];

export function DiagnosticsDeskPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const narrow = useIsNarrow(767);
  const [tab, setTab] = useState<DeskTab>('tests');
  const [profile, setProfile] = useState<DiagnosticsPortalProfile | null>(null);
  const [staffSession, setStaffSession] = useState<DiagnosticsStaffSession | null>(null);
  const [orders, setOrders] = useState<DiagnosticsVendorOrder[]>([]);
  const [audit, setAudit] = useState<DiagnosticsStaffAuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [visitsPane, setVisitsPane] = useState<MyVisitsPane>('collect');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [catalogSaving, setCatalogSaving] = useState(false);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  usePortalChrome({ title: 'Diagnostics', onRefresh: reload });

  const writes = useMemo(() => resolveDiagnosticsWrites(staffSession ?? profile?.session), [staffSession, profile?.session]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void Promise.all([
      fetchMyDiagnostics(token),
      fetchDiagnosticsSession(token).catch(() => null),
      fetchVendorDiagnosticsOrders(token),
      fetchDiagnosticsStaffAudit(token).catch(() => null),
    ])
      .then(([me, sess, orderRows, auditRows]) => {
        if (cancelled) return;
        const effectiveSession = sess ?? me.session ?? diagnosticsOwnerSessionFallback();
        setProfile(me);
        setStaffSession(effectiveSession);
        setOrders(orderRows ?? []);
        setAudit(auditRows ?? me.audit ?? []);
        const writesNow = resolveDiagnosticsWrites(effectiveSession);
        if (writesNow.canManageCatalog) {
          setTab((prev) => (prev === 'tests' || prev === 'overview' ? 'tests' : prev));
        } else {
          setTab((prev) => (prev === 'tests' ? 'overview' : prev));
        }
        if (effectiveSession?.collectionCapable && orderRows.some((o) => o.assignedStaffId === effectiveSession.staffId && !/FINAL|COMPLET|CANCEL/i.test(o.status))) {
          setTab((prev) => (prev === 'tests' || prev === 'overview' ? 'visits' : prev));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setError('Session expired — log out from Settings and sign in again.');
          return;
        }
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load diagnostics desk');
      });
    return () => {
      cancelled = true;
    };
  }, [token, tick]);

  const myStaffId = staffSession?.staffId ?? null;
  const { toCollect, handedOver } = useMemo(() => {
    const assigned = filterOrdersAssignedToStaff(orders, myStaffId);
    return splitMyVisitOrders(assigned);
  }, [orders, myStaffId]);
  const visitsForPane = visitsPane === 'collect' ? toCollect : handedOver;

  useEffect(() => {
    setExpandedVisitId(null);
  }, [visitsPane]);

  useEffect(() => {
    if (!token || !writes.canCollection) return;
    void fetchMyVisitsHistoryCount(token)
      .then(setHistoryCount)
      .catch(() => setHistoryCount(0));
  }, [token, tick, writes.canCollection]);

  async function runAction(orderId: string, action: string, extra?: Record<string, unknown>) {
    if (!token) return false;
    try {
      const updated = await actOnDiagnosticsOrder(token, orderId, { action, ...extra });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (action === 'START_COLLECTION') {
        setExpandedVisitId(orderId);
      }
      setToast('Updated');
      return true;
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Action failed');
      return false;
    }
  }

  async function onSamplePhotos(orderId: string, files: File[]) {
    if (!token) return;
    try {
      for (const file of files) {
        const mediaId = await uploadDiagnosticsSamplePhoto(token, file);
        const ok = await runAction(orderId, 'ADD_SAMPLE_PHOTO', { mediaId });
        if (ok === false) break;
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload failed');
    }
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.id === 'visits') return writes.canCollection;
    if (t.id === 'staff' || t.id === 'branches' || t.id === 'slots' || t.id === 'tests') {
      return writes.canManageCatalog || writes.canManageStaff;
    }
    return true;
  });

  const openOrders = useMemo(
    () => orders.filter((o) => isVendorVisibleDiagnosticsBooking(o) && !/COMPLET|CANCEL/i.test(o.status)),
    [orders],
  );
  const showOverviewSetupHint = tab === 'overview' && openOrders.length === 0 && writes.canManageCatalog;

  return (
    <div style={styles.root}>
      <style>{TAB_CSS}</style>
      {error ? <p style={styles.error}>{error}</p> : null}
      <nav className="hlm-diag-desk-tabs" aria-label="Diagnostics sections">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'hlm-diag-desk-tab on' : 'hlm-diag-desk-tab'}
            onClick={() => setTab(item.id)}
          >
            <span aria-hidden>{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section style={styles.card}>
          <h2 style={styles.h2}>Open orders</h2>
          {showOverviewSetupHint ? (
            <p style={styles.emptyHint}>
              No bookings yet. Set prices on the{' '}
              <button type="button" style={styles.inlineLink} onClick={() => setTab('tests')}>
                Tests
              </button>{' '}
              tab so buyers can book home collection.
            </p>
          ) : null}
          <OrderList
            orders={openOrders}
            billing={profile}
            onAction={runAction}
            hideEmptyMessage={showOverviewSetupHint}
          />
        </section>
      ) : null}

      {tab === 'visits' && writes.canCollection ? (
        <section style={styles.card}>
          <h2 style={styles.h2}>My visits {narrow ? '' : '(mobile-friendly)'}</h2>
          <DiagnosticsMyVisitsTabs
            pane={visitsPane}
            onPaneChange={setVisitsPane}
            toCollectCount={toCollect.length}
            handedCount={handedOver.length}
            historyCount={historyCount}
          >
            {visitsPane === 'history' ? (
              <DiagnosticsMyVisitsHistoryPanel
                token={token}
                active={tab === 'visits' && visitsPane === 'history'}
                reloadToken={tick}
                selfStaffId={myStaffId}
                selfDisplayName={staffSession?.displayName}
                expandedVisitId={expandedVisitId}
                onExpandedVisitIdChange={setExpandedVisitId}
                idPrefix="desk-history"
              />
            ) : (
              <OrderList
                orders={visitsForPane}
                mode={visitsPane === 'collect' ? 'visit' : undefined}
                staff={profile?.staff ?? []}
                billing={profile}
                onAction={runAction}
                onPhotos={onSamplePhotos}
                expandedVisitId={expandedVisitId}
                onExpandedVisitIdChange={setExpandedVisitId}
                emptyHint={
                  visitsPane === 'collect'
                    ? 'No visits waiting for collection.'
                    : 'No bags handed over to the lab yet.'
                }
              />
            )}
          </DiagnosticsMyVisitsTabs>
        </section>
      ) : null}

      {tab === 'staff' && (writes.canManageStaff || writes.canManageCatalog) ? (
        <StaffPanel
          token={token}
          canManageStaff={writes.canManageStaff}
          onSaved={(me) => {
            setProfile(me);
            setToast('Staff added — see Agents in the menu');
            setError(null);
          }}
          onError={(message) => setError(message)}
        />
      ) : null}

      {tab === 'slots' && writes.canManageCatalog ? (
        <section style={styles.card}>
          <h2 style={styles.h2}>Collection slots</h2>
          {profile ? (
            <DiagnosticsSlotsPanel
              token={token}
              profile={profile}
              orders={orders}
              onSaved={(me) => {
                setProfile(me);
                setError(null);
              }}
              onError={(message) => setError(message)}
              onToast={(message) => setToast(message)}
            />
          ) : null}
        </section>
      ) : null}

      {tab === 'branches' && writes.canManageCatalog ? (
        <BranchesPanel
          profile={profile}
          token={token}
          onSaved={(me) => {
            setProfile(me);
            setToast('Branch saved');
            setError(null);
          }}
          onError={(message) => setError(message)}
        />
      ) : null}

      {tab === 'tests' && (writes.canManageCatalog || writes.canManageStaff) ? (
        <DiagnosticsCatalogPanel
          key={profile?.vendorId ?? 'lab'}
          catalogKey={profile?.vendorId ?? 'lab'}
          tests={profile?.tests ?? []}
          packages={profile?.packages ?? []}
          canEdit={writes.canManageCatalog}
          saving={catalogSaving}
          onSave={(testRows, packageRows) => {
            if (!token) return;
            setCatalogSaving(true);
            void (async () => {
              try {
                let me = profile!;
                for (const row of testRows) {
                  me = await upsertDiagnosticsTest(token, {
                    id: row.id,
                    code: row.code ?? undefined,
                    name: row.name,
                    price: row.price,
                    fastingNote: row.fastingNote,
                    active: row.active,
                    homeCollection: row.homeCollection,
                  });
                }
                const testIdByCode = new Map(
                  me.tests.filter((t) => t.id && t.code).map((t) => [t.code!.toUpperCase(), t.id!]),
                );
                const packageIssues: string[] = [];
                for (const row of packageRows) {
                  const memberCodes = row.memberCodes ?? [];
                  const testIds =
                    row.testIds.length > 0 ? row.testIds : resolvePackageTestIds(memberCodes, testIdByCode);
                  if (row.active !== false) {
                    const issue = packageSaveIssue(row.name, memberCodes, testIds);
                    if (issue) {
                      packageIssues.push(issue);
                      continue;
                    }
                  } else if (testIds.length === 0) {
                    continue;
                  }
                  me = await upsertDiagnosticsPackage(token, {
                    id: row.id,
                    code: row.code ?? undefined,
                    name: row.name,
                    description: row.description,
                    price: row.price,
                    active: row.active,
                    testIds,
                  });
                }
                setProfile(me);
                if (packageIssues.length > 0) {
                  setError(packageIssues.join(' '));
                  setToast('Tests saved; fix packages marked Not live for patients to see them');
                } else {
                  setError(null);
                  setToast('Tests & packages saved');
                }
                reload();
              } catch (err) {
                setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save catalog');
              } finally {
                setCatalogSaving(false);
              }
            })();
          }}
        />
      ) : null}

      {tab === 'audit' ? (
        <section style={styles.card}>
          <h2 style={styles.h2}>Audit history</h2>
          <ul style={styles.auditList}>
            {audit.map((row) => (
              <li key={row.id}>
                <strong>{row.eventType}</strong>
                <span>{new Date(row.createdAt).toLocaleString('en-IN')}</span>
              </li>
            ))}
            {audit.length === 0 ? <li style={styles.muted}>No audit entries yet.</li> : null}
          </ul>
        </section>
      ) : null}

      <Toast open={Boolean(toast)} message={toast ?? ''} onClose={() => setToast(null)} />
    </div>
  );
}

function OrderList({
  orders,
  mode,
  staff,
  billing,
  onAction,
  onPhotos,
  hideEmptyMessage,
  emptyHint,
  expandedVisitId,
  onExpandedVisitIdChange,
}: {
  orders: DiagnosticsVendorOrder[];
  mode?: 'visit';
  staff?: DiagnosticsPortalProfile['staff'];
  billing?: DiagnosticsPortalProfile | null;
  onAction: (orderId: string, action: string, extra?: Record<string, unknown>) => Promise<boolean | void> | void;
  onPhotos?: (orderId: string, files: File[]) => void;
  hideEmptyMessage?: boolean;
  emptyHint?: string;
  expandedVisitId?: string | null;
  onExpandedVisitIdChange?: (orderId: string | null) => void;
}) {
  if (orders.length === 0) {
    if (hideEmptyMessage) return null;
    return <p style={styles.muted}>{emptyHint ?? 'Nothing here right now.'}</p>;
  }

  return (
    <DiagnosticsDispatchOrderCards
      orders={orders}
      staff={staff}
      billing={billing}
      canDispatch={false}
      singleExpanded={mode === 'visit'}
      expandedOrderId={expandedVisitId}
      onExpandedOrderIdChange={onExpandedVisitIdChange}
      idPrefix={mode === 'visit' ? 'desk-visit' : 'desk-overview'}
      onRemovePhoto={async (id, mediaId) => onAction(id, 'REMOVE_SAMPLE_PHOTO', { mediaId })}
      renderFooter={
        mode === 'visit'
          ? (order) => (
              <DiagnosticsVisitActions
                order={order}
                staff={staff ?? []}
                onAction={async (id, action, extra) => onAction(id, action, extra)}
                onPhotos={onPhotos}
              />
            )
          : undefined
      }
    />
  );
}

function StaffPanel({
  token,
  canManageStaff,
  onSaved,
  onError,
}: {
  token: string;
  canManageStaff: boolean;
  onSaved: (p: DiagnosticsPortalProfile) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('COLLECTION_AGENT');
  const [collectionCapable, setCollectionCapable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function resetStaffForm() {
    setName('');
    setPhone('');
    setPassword('');
    setTitle('COLLECTION_AGENT');
    setCollectionCapable(true);
    setFieldError(null);
  }

  function onTitleChange(next: string) {
    setTitle(next);
    if (next === 'LAB_TECHNICIAN') {
      setCollectionCapable(false);
    } else if (next === 'COLLECTION_AGENT' || next === 'MANAGER') {
      setCollectionCapable(true);
    }
  }

  async function addStaff() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.replace(/\s/g, '').trim();
    if (!trimmedName || !trimmedPhone) {
      setFieldError('Name and phone are required.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setFieldError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (password.length < 6) {
      setFieldError('Set a login password (at least 6 characters).');
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const me = await upsertDiagnosticsStaff(token, {
        displayName: trimmedName,
        phone: trimmedPhone,
        password,
        title,
        collectionCapable,
        roleType: 'LAB_STAFF',
      });
      resetStaffForm();
      onSaved(me);
    } catch (err) {
      const raw = err instanceof ApiError || err instanceof Error ? err.message : 'Could not save staff';
      onError(/already registered/i.test(raw) ? 'That mobile is already in use for another account type.' : raw);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>Add portal staff</h2>
      <p style={styles.fieldHint}>
        Create lab technicians, collection agents, or managers here. View and manage them on the{' '}
        <strong>Agents</strong> screen in the main menu.
      </p>
      {canManageStaff ? (
        <div style={styles.formGrid}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
          <input
            placeholder="Phone (10 digits)"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            style={styles.input}
          />
          <input
            placeholder="Login password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <p style={styles.fieldHint}>Staff use this password to sign in to the vendor portal for visits and collection.</p>
          <select value={title} onChange={(e) => onTitleChange(e.target.value)} style={styles.input}>
            <option value="MANAGER">Manager</option>
            <option value="LAB_TECHNICIAN">Lab technician</option>
            <option value="COLLECTION_AGENT">Collection agent</option>
          </select>
          {title !== 'LAB_TECHNICIAN' ? (
            <label style={styles.check}>
              <input type="checkbox" checked={collectionCapable} onChange={(e) => setCollectionCapable(e.target.checked)} />
              Collection capable
            </label>
          ) : null}
          {fieldError ? <p style={styles.error}>{fieldError}</p> : null}
          <div style={styles.staffFormActions}>
            <button type="button" style={styles.btn} disabled={saving} onClick={() => void addStaff()}>
              {saving ? 'Saving…' : 'Add staff'}
            </button>
          </div>
        </div>
      ) : (
        <p style={styles.muted}>Staff changes require lab admin or manager.</p>
      )}
    </section>
  );
}

function BranchesPanel({
  profile,
  token,
  onSaved,
  onError,
}: {
  profile: DiagnosticsPortalProfile | null;
  token: string;
  onSaved: (p: DiagnosticsPortalProfile) => void;
  onError: (message: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState('5');
  const [saving, setSaving] = useState(false);
  const [busyBranchId, setBusyBranchId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRadius, setEditRadius] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function addBranch() {
    const trimmedLabel = label.trim();
    const trimmedAddress = address.trim();
    const radiusKm = Number(radius);
    if (!trimmedLabel || !trimmedAddress) {
      setFieldError('Branch name and address are required.');
      return;
    }
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      setFieldError('Enter a valid home collection radius in km (e.g. 5).');
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const me = await upsertDiagnosticsBranch(token, {
        label: trimmedLabel,
        addressLine: trimmedAddress,
        homeCollectionRadiusKm: radiusKm,
        active: true,
      });
      setLabel('');
      setAddress('');
      setRadius('5');
      setShowAddForm(false);
      onSaved(me);
    } catch (err) {
      onError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not add branch');
    } finally {
      setSaving(false);
    }
  }

  async function saveBranch(branch: DiagnosticsPortalProfile['branches'][number], patch: { active?: boolean; homeCollectionRadiusKm?: number }) {
    setBusyBranchId(branch.id);
    setFieldError(null);
    try {
      const me = await upsertDiagnosticsBranch(token, {
        id: branch.id,
        label: branch.label,
        addressLine: branch.addressLine,
        homeCollectionRadiusKm: patch.homeCollectionRadiusKm ?? branch.homeCollectionRadiusKm,
        active: patch.active ?? branch.active,
      });
      setEditingId(null);
      onSaved(me);
    } catch (err) {
      onError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update branch');
    } finally {
      setBusyBranchId(null);
    }
  }

  async function saveEditedRadius(branch: DiagnosticsPortalProfile['branches'][number]) {
    const radiusKm = Number(editRadius);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      setFieldError('Enter a valid radius in km.');
      return;
    }
    await saveBranch(branch, { homeCollectionRadiusKm: radiusKm });
  }

  if (!profile) return null;
  const branches = profile.branches;

  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>Branches</h2>
      <p style={styles.fieldHint}>
        Each branch is where collectors start home visits. Only <strong>Active</strong> branches appear to buyers. Radius
        is how far from the address you send staff (km).
      </p>

      {branches.length === 0 ? <p style={styles.muted}>No branches yet — add your first collection point below.</p> : null}

      <ul style={styles.branchList}>
        {branches.map((b) => {
          const busy = busyBranchId === b.id;
          const editing = editingId === b.id;
          return (
            <li key={b.id} style={{ ...styles.branchCard, ...(b.active ? null : styles.branchCardPaused) }}>
              <div style={styles.branchCardHead}>
                <div style={styles.branchCardTitle}>
                  <strong>{b.label}</strong>
                  <span style={b.active ? styles.statusOn : styles.statusOff}>{b.active ? 'Active' : 'Paused'}</span>
                </div>
                <button
                  type="button"
                  style={b.active ? styles.btnGhost : styles.btn}
                  disabled={busy}
                  onClick={() => void saveBranch(b, { active: !b.active })}
                >
                  {busy ? 'Saving…' : b.active ? 'Pause' : 'Activate'}
                </button>
              </div>
              <p style={styles.branchMeta}>{b.addressLine}</p>
              <p style={styles.branchMeta}>
                Home collection within <strong>{b.homeCollectionRadiusKm} km</strong>
                {!editing ? (
                  <>
                    {' · '}
                    <button
                      type="button"
                      style={styles.inlineLink}
                      disabled={busy}
                      onClick={() => {
                        setEditingId(b.id);
                        setEditRadius(String(b.homeCollectionRadiusKm));
                        setFieldError(null);
                      }}
                    >
                      Change radius
                    </button>
                  </>
                ) : null}
              </p>
              {editing ? (
                <div style={styles.branchEditRow}>
                  <label style={styles.labeledField}>
                    <span style={styles.fieldLabel}>Radius (km)</span>
                    <input
                      inputMode="decimal"
                      value={editRadius}
                      onChange={(e) => setEditRadius(e.target.value)}
                      style={styles.input}
                    />
                  </label>
                  <div style={styles.branchEditActions}>
                    <button type="button" style={styles.btnGhost} disabled={busy} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button type="button" style={styles.btn} disabled={busy} onClick={() => void saveEditedRadius(b)}>
                      {busy ? 'Saving…' : 'Save radius'}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {fieldError && !showAddForm && !editingId ? <p style={styles.error}>{fieldError}</p> : null}

      {showAddForm || branches.length === 0 ? (
        <div style={styles.formGrid}>
          <p style={styles.fieldLabel}>{branches.length === 0 ? 'New branch' : 'Add another branch'}</p>
          <label style={styles.labeledField}>
            <span style={styles.fieldLabel}>Branch name</span>
            <input placeholder="e.g. Clock Tower" value={label} onChange={(e) => setLabel(e.target.value)} style={styles.input} />
          </label>
          <label style={styles.labeledField}>
            <span style={styles.fieldLabel}>Address</span>
            <input placeholder="Full street address" value={address} onChange={(e) => setAddress(e.target.value)} style={styles.input} />
          </label>
          <label style={styles.labeledField}>
            <span style={styles.fieldLabel}>Home collection radius (km)</span>
            <input inputMode="decimal" placeholder="5" value={radius} onChange={(e) => setRadius(e.target.value)} style={styles.input} />
          </label>
          {fieldError ? <p style={styles.error}>{fieldError}</p> : null}
          <div style={styles.branchEditActions}>
            {branches.length > 0 ? (
              <button type="button" style={styles.btnGhost} onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            ) : null}
            <button type="button" style={styles.btn} disabled={saving} onClick={() => void addBranch()}>
              {saving ? 'Adding…' : 'Add branch'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" style={styles.btnGhost} onClick={() => setShowAddForm(true)}>
          + Add another branch
        </button>
      )}
    </section>
  );
}

const TAB_CSS = `
.hlm-diag-desk-tabs {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.15rem 0 0.55rem;
  -webkit-overflow-scrolling: touch;
}
.hlm-diag-desk-tab {
  flex: 0 0 auto;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 999px;
  padding: 0.38rem 0.72rem;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.hlm-diag-desk-tab.on {
  border-color: #0f766e;
  background: #ecfdf5;
  color: #065f46;
}
`;

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.5rem', minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' },
  error: { color: '#b91c1c', fontWeight: 700, margin: 0 },
  card: {
    borderRadius: 16,
    padding: '0.75rem',
    background: '#fff',
    border: '1px solid var(--border)',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  h2: { margin: '0 0 0.5rem', fontSize: '0.88rem' },
  emptyHint: { margin: '0 0 0.55rem', fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--text-muted)' },
  fieldHint: { margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  labeledField: { display: 'grid', gap: '0.2rem' },
  fieldLabel: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' },
  inlineLink: {
    border: 'none',
    padding: 0,
    background: 'none',
    color: '#0f766e',
    font: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '0.12em',
  },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem' },
  branchList: { listStyle: 'none', margin: '0 0 0.65rem', padding: 0, display: 'grid', gap: '0.45rem' },
  branchCard: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.55rem 0.65rem',
    background: '#fff',
  },
  branchCardPaused: { background: '#f8fafc', opacity: 0.92 },
  branchCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' },
  branchCardTitle: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' },
  branchMeta: { margin: '0.25rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  branchEditRow: { marginTop: '0.45rem', display: 'grid', gap: '0.35rem' },
  branchEditActions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  statusOn: {
    fontSize: '0.62rem',
    fontWeight: 800,
    background: '#ecfdf5',
    color: '#065f46',
    padding: '0.12rem 0.4rem',
    borderRadius: 999,
  },
  statusOff: {
    fontSize: '0.62rem',
    fontWeight: 800,
    background: '#f1f5f9',
    color: '#64748b',
    padding: '0.12rem 0.4rem',
    borderRadius: 999,
  },
  inlineField: { display: 'grid', gap: '0.2rem', fontSize: '0.72rem', marginTop: '0.35rem' },
  visitActions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' },
  btn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.45rem 0.65rem',
    background: 'linear-gradient(135deg, #064e3b, #0f766e)',
    color: '#ecfdf5',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  btnGhost: {
    border: '1px solid #0f766e',
    borderRadius: 10,
    padding: '0.45rem 0.65rem',
    background: '#fff',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  photoLabel: { fontSize: '0.72rem', fontWeight: 700 },
  auditList: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem', fontSize: '0.78rem' },
  compactList: { margin: '0 0 0.65rem', paddingLeft: '1rem', fontSize: '0.78rem' },
  staffList: { listStyle: 'none', margin: '0 0 0.65rem', padding: 0, display: 'grid', gap: '0.4rem' },
  staffRow: { border: '1px solid var(--border)', borderRadius: 12, padding: '0.5rem 0.6rem' },
  staffRowPaused: { background: '#f8fafc', opacity: 0.92 },
  staffRowHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  staffRowActions: { display: 'flex', gap: '0.35rem' },
  linkBtn: {
    border: 'none',
    background: 'none',
    padding: 0,
    color: 'var(--accent-hover)',
    fontWeight: 700,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  staffFormActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' },
  staffMeta: { margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' },
  formGrid: { display: 'grid', gap: '0.4rem' },
  input: { padding: '0.45rem 0.55rem', borderRadius: 10, border: '1px solid var(--border)', font: 'inherit' },
  check: { display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.72rem' },
};
