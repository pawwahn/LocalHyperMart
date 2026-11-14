import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Toast } from '@/shared/ui';
import {
  getTownConfig,
  listTowns,
  saveTownDiagnosticsFees,
  setTownDiagnosticsEnabled,
  type TownVm,
} from '@/features/towns/api/townsApi';
import { DiagnosticsCatalogPanel, packageSaveIssue, resolvePackageTestIds } from '@hlm-diagnostics';
import {
  adminUpsertDiagnosticsPackage,
  adminUpsertDiagnosticsTest,
  fetchDiagnosticsLabDetail,
  fetchTownDiagnosticsLabs,
  saveTownDiagnosticsLab,
  type DiagnosticsLabAdmin,
  type DiagnosticsLabDetail,
} from '../api/diagnosticsApi';

function payloadFromLab(lab: DiagnosticsLabAdmin, enabled: boolean) {
  return {
    enabled,
    bookable: enabled,
    homeCollectionFee: Number(lab.homeCollectionFee ?? 0),
  };
}

export function DiagnosticsAdminPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [diagnosticsOn, setDiagnosticsOn] = useState(false);
  const [platformFee, setPlatformFee] = useState('');
  const [codEnabled, setCodEnabled] = useState(true);
  const [codSurcharge, setCodSurcharge] = useState('');
  const [townBusy, setTownBusy] = useState(false);
  const [townFeesBusy, setTownFeesBusy] = useState(false);
  const [labs, setLabs] = useState<DiagnosticsLabAdmin[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [labEnabled, setLabEnabled] = useState(false);
  const [homeFee, setHomeFee] = useState('');
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [labDetail, setLabDetail] = useState<DiagnosticsLabDetail | null>(null);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogTick, setCatalogTick] = useState(0);
  const townIdRef = useRef(townId);
  townIdRef.current = townId;

  useEffect(() => {
    if (!token) return;
    void listTowns(token)
      .then((rows) => {
        setTowns(rows);
        setTownId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load towns'));
  }, [token]);

  useEffect(() => {
    if (!token || !townId) return;
    const loadForTown = townId;
    let cancelled = false;
    setError(null);
    void Promise.all([
      getTownConfig(token, loadForTown),
      fetchTownDiagnosticsLabs(token, loadForTown),
    ])
      .then(([cfg, rows]) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setDiagnosticsOn(cfg.diagnosticsEnabled === true);
        setPlatformFee(cfg.diagnosticsPlatformFeeFlat > 0 ? String(cfg.diagnosticsPlatformFeeFlat) : '');
        setCodEnabled(cfg.diagnosticsCodEnabled !== false);
        setCodSurcharge(cfg.diagnosticsCodSurchargeAmount > 0 ? String(cfg.diagnosticsCodSurchargeAmount) : '');
        setLabs(rows);
        setVendorId((prev) => (rows.some((l) => l.vendorId === prev) ? prev : rows[0]?.vendorId ?? ''));
        setError(null);
      })
      .catch((err) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setLabs([]);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load diagnostics setup');
      });

    return () => {
      cancelled = true;
    };
  }, [token, townId]);

  useEffect(() => {
    const lab = labs.find((l) => l.vendorId === vendorId);
    if (!lab) return;
    setLabEnabled(lab.enabled);
    setHomeFee(lab.homeCollectionFee > 0 ? String(lab.homeCollectionFee) : '');
  }, [labs, vendorId]);

  useEffect(() => {
    if (!token || !vendorId) {
      setLabDetail(null);
      return;
    }
    const loadForVendor = vendorId;
    setLabDetail(null);
    let cancelled = false;
    void fetchDiagnosticsLabDetail(token, loadForVendor)
      .then((detail) => {
        if (cancelled || detail.vendorId !== loadForVendor) return;
        setLabDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setLabDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, vendorId, catalogTick]);

  async function setTownDiagnostics(next: boolean) {
    if (!token || !townId || townBusy) return;
    const targetTownId = townId;
    setTownBusy(true);
    setError(null);
    try {
      const cfg = await setTownDiagnosticsEnabled(token, targetTownId, next);
      if (townIdRef.current === targetTownId) {
        setDiagnosticsOn(cfg.diagnosticsEnabled === true);
      }
      setToast(
        cfg.diagnosticsEnabled
          ? 'Diagnostics bookings enabled for this town'
          : 'Diagnostics turned off for buyers',
      );
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update town');
    } finally {
      setTownBusy(false);
    }
  }

  async function saveTownFees() {
    if (!token || !townId || townFeesBusy) return;
    setTownFeesBusy(true);
    setError(null);
    try {
      const cfg = await saveTownDiagnosticsFees(token, townId, {
        diagnosticsPlatformFeeFlat: Math.max(0, Number(platformFee) || 0),
        diagnosticsCodEnabled: codEnabled,
        diagnosticsCodSurchargeAmount: Math.max(0, Number(codSurcharge) || 0),
      });
      setPlatformFee(cfg.diagnosticsPlatformFeeFlat > 0 ? String(cfg.diagnosticsPlatformFeeFlat) : '');
      setCodSurcharge(cfg.diagnosticsCodSurchargeAmount > 0 ? String(cfg.diagnosticsCodSurchargeAmount) : '');
      setCodEnabled(cfg.diagnosticsCodEnabled !== false);
      setToast('Diagnostics fees saved for this town');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save fees');
    } finally {
      setTownFeesBusy(false);
    }
  }

  async function setLabVisible(targetVendorId: string, next: boolean) {
    if (!token || visibilityBusyId) return;
    const lab = labs.find((row) => row.vendorId === targetVendorId);
    if (!lab) return;
    const body =
      targetVendorId === vendorId
        ? {
            enabled: next,
            bookable: next,
            homeCollectionFee: Math.max(0, Number(homeFee) || 0),
          }
        : payloadFromLab(lab, next);
    setVisibilityBusyId(targetVendorId);
    setError(null);
    const previousEnabled = lab.enabled;
    setLabs((prev) => prev.map((row) => (row.vendorId === targetVendorId ? { ...row, enabled: next, bookable: next } : row)));
    if (targetVendorId === vendorId) setLabEnabled(next);
    try {
      const saved = await saveTownDiagnosticsLab(token, targetVendorId, body);
      setLabs((prev) => prev.map((row) => (row.vendorId === saved.vendorId ? saved : row)));
      if (targetVendorId === vendorId) setLabEnabled(saved.enabled);
      setToast(`${saved.businessName}: ${saved.enabled ? 'visible to buyers' : 'hidden from buyers'}`);
    } catch (err) {
      setLabs((prev) =>
        prev.map((row) => (row.vendorId === targetVendorId ? { ...row, enabled: previousEnabled, bookable: previousEnabled } : row)),
      );
      if (targetVendorId === vendorId) setLabEnabled(previousEnabled);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setVisibilityBusyId(null);
    }
  }

  async function saveLabProfile() {
    if (!token || !vendorId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveTownDiagnosticsLab(token, vendorId, {
        enabled: labEnabled,
        bookable: labEnabled,
        homeCollectionFee: Math.max(0, Number(homeFee) || 0),
      });
      setLabs((prev) => prev.map((l) => (l.vendorId === saved.vendorId ? saved : l)));
      setToast('Lab home collection fee saved');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save lab');
    } finally {
      setSaving(false);
    }
  }

  const townName = towns.find((town) => town.id === townId)?.displayName ?? 'this town';
  const selectedLab = labs.find((row) => row.vendorId === vendorId);

  return (
    <PortalShell title="Koya Diagnostics — town setup">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Toast open={Boolean(toast)} message={toast ?? ''} tone="success" placement="center" durationMs={3500} onClose={() => setToast(null)} />

      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>How diagnostics works</h2>
        <ol style={styles.steps}>
          <li>
            <strong>Vendors</strong> — Register with service <em>Diagnostics &amp; Lab</em> (
            <Link to="/vendors" style={styles.link}>
              Vendors
            </Link>
            ).
          </li>
          <li>
            <strong>Lab</strong> — In the vendor portal (Diagnostics), they manage branches, tests, slots, and sample
            collection.
          </li>
          <li>
            <strong>You (here)</strong> — Turn diagnostics on for the town, set buyer-visible fees, and choose which labs
            buyers can book.
          </li>
        </ol>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>1</span>
          <div>
            <h3 style={styles.cardTitle}>Town</h3>
            <p style={styles.cardSub}>When off, buyers never see Diagnostics in {townName}.</p>
          </div>
        </div>
        <div style={styles.row}>
          <label style={styles.field}>
            Town
            <select style={styles.input} value={townId} onChange={(e) => setTownId(e.target.value)}>
              {towns.map((town) => (
                <option key={town.id} value={town.id}>
                  {town.displayName}
                </option>
              ))}
            </select>
          </label>
          <div style={styles.switchBlock}>
            <span style={styles.switchLabel}>Allow diagnostics bookings</span>
            <button
              type="button"
              disabled={townBusy}
              style={diagnosticsOn ? styles.switchOn : styles.switchOff}
              aria-pressed={diagnosticsOn}
              onClick={() => void setTownDiagnostics(!diagnosticsOn)}
            >
              <span style={styles.knob} data-on={diagnosticsOn ? '1' : '0'} />
              {townBusy ? 'Saving…' : diagnosticsOn ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        {diagnosticsOn ? (
          <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.35rem' }}>
            <p style={styles.hint}>
              Platform fee and COD surcharge are shown to buyers at checkout (diagnostics orders only).
            </p>
            <div style={styles.row}>
              <label style={styles.field}>
                Platform fee flat ₹ / order
                <input
                  style={styles.narrow}
                  inputMode="decimal"
                  placeholder="e.g. 29"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </label>
              <div style={styles.switchBlock}>
                <span style={styles.switchLabel}>COD at doorstep</span>
                <button
                  type="button"
                  style={codEnabled ? styles.switchOn : styles.switchOff}
                  aria-pressed={codEnabled}
                  onClick={() => setCodEnabled(!codEnabled)}
                >
                  <span style={styles.knob} data-on={codEnabled ? '1' : '0'} />
                  {codEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <label style={styles.field}>
                COD surcharge ₹
                <input
                  style={styles.narrow}
                  inputMode="decimal"
                  placeholder="e.g. 20"
                  value={codSurcharge}
                  onChange={(e) => setCodSurcharge(e.target.value.replace(/[^\d.]/g, ''))}
                  disabled={!codEnabled}
                />
              </label>
              <button type="button" style={styles.primary} disabled={townFeesBusy} onClick={() => void saveTownFees()}>
                {townFeesBusy ? 'Saving…' : 'Save fees'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>2</span>
          <div>
            <h3 style={styles.cardTitle}>Diagnostics lab</h3>
            <p style={styles.cardSub}>
              Only vendors assigned to Diagnostics &amp; Lab appear here (not glam, laundry, or grocery).
            </p>
          </div>
        </div>
        {labs.length === 0 ? (
          <p style={styles.muted}>
            No diagnostics labs in this town yet.{' '}
            <Link to="/vendors" style={styles.link}>
              Add or edit a vendor
            </Link>{' '}
            and set Service to <strong>Diagnostics &amp; Lab</strong>.
          </p>
        ) : (
          <div style={styles.fieldGrow}>
            <span>Lab ({labs.length}) — tap a name to edit; use Visible on each card for buyers.</span>
            <div style={styles.vendorPickRow} role="tablist" aria-label="Diagnostics labs">
              {labs.map((lab) => {
                const selected = lab.vendorId === vendorId;
                const busy = visibilityBusyId === lab.vendorId;
                return (
                  <div
                    key={lab.vendorId}
                    role="tab"
                    aria-selected={selected}
                    style={selected ? styles.vendorPickOn : styles.vendorPickOff}
                  >
                    <button type="button" style={styles.vendorPickSelect} onClick={() => setVendorId(lab.vendorId)}>
                      {lab.businessName}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(visibilityBusyId)}
                      style={lab.enabled ? styles.vendorVisOn : styles.vendorVisOff}
                      aria-pressed={lab.enabled}
                      title="Show or hide this lab on buyer Diagnostics"
                      onClick={() => void setLabVisible(lab.vendorId, !lab.enabled)}
                    >
                      <span style={styles.knob} data-on={lab.enabled ? '1' : '0'} />
                      {busy ? 'Saving…' : lab.enabled ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!diagnosticsOn && labs.length > 0 ? (
          <p style={styles.warn}>Town diagnostics is off — buyers still cannot book even if the lab is visible.</p>
        ) : null}
      </section>

      {vendorId && selectedLab ? (
        <>
          <section style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.stepNum}>3</span>
              <div style={{ flex: 1 }}>
                <h3 style={styles.cardTitle}>Tests &amp; packages (template per lab)</h3>
                <p style={styles.cardSub}>
                  Same default test &amp; package menu as groceries master catalog — each lab gets its own copy when you
                  save rates here or when they edit in <strong>Vendor portal → Diagnostics</strong>. Switching labs
                  loads that lab&apos;s prices only. Use <strong>Hidden</strong> until ready for buyers.
                </p>
              </div>
            </div>
            {labDetail && labDetail.vendorId === vendorId ? (
              <DiagnosticsCatalogPanel
                key={vendorId}
                catalogKey={vendorId}
                tests={labDetail.tests}
                packages={labDetail.packages}
                canEdit
                saving={catalogSaving}
                onSave={(testRows, packageRows) => {
                  if (!token || !vendorId || labDetail.vendorId !== vendorId) return;
                  setCatalogSaving(true);
                  void (async () => {
                    try {
                      let detail = labDetail;
                      for (const row of testRows) {
                        detail = await adminUpsertDiagnosticsTest(token, vendorId, {
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
                        detail.tests.filter((t) => t.code).map((t) => [t.code!.toUpperCase(), t.id]),
                      );
                      const packageIssues: string[] = [];
                      for (const row of packageRows) {
                        const memberCodes = row.memberCodes ?? [];
                        const testIds =
                          row.testIds.length > 0
                            ? row.testIds
                            : resolvePackageTestIds(memberCodes, testIdByCode);
                        if (row.active !== false) {
                          const issue = packageSaveIssue(row.name, memberCodes, testIds);
                          if (issue) {
                            packageIssues.push(issue);
                            continue;
                          }
                        } else if (testIds.length === 0) {
                          continue;
                        }
                        detail = await adminUpsertDiagnosticsPackage(token, vendorId, {
                          id: row.id,
                          code: row.code ?? undefined,
                          name: row.name,
                          description: row.description,
                          price: row.price,
                          active: row.active,
                          testIds,
                        });
                      }
                      setLabDetail(detail);
                      if (packageIssues.length > 0) {
                        setError(packageIssues.join(' '));
                        setToast('Tests saved; some packages need member tests before patients can see them');
                      } else {
                        setError(null);
                        setToast('Lab catalog saved');
                      }
                      setCatalogTick((n) => n + 1);
                    } catch (err) {
                      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save catalog');
                    } finally {
                      setCatalogSaving(false);
                    }
                  })();
                }}
              />
            ) : (
              <p style={styles.muted}>Loading lab catalog…</p>
            )}
          </section>
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Home collection fee</h3>
            <p style={styles.meta}>
              {selectedLab.phone} · {selectedLab.vendorStatus}
              {selectedLab.branchCount != null ? ` · ${selectedLab.branchCount} branch(es)` : ''}
            </p>
            <div style={styles.row}>
              <label style={styles.field}>
                Home collection fee ₹
                <input
                  style={styles.narrow}
                  inputMode="decimal"
                  placeholder="0"
                  value={homeFee}
                  onChange={(e) => setHomeFee(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </label>
              <button type="button" style={styles.primary} disabled={saving} onClick={() => void saveLabProfile()}>
                {saving ? 'Saving…' : 'Save lab fee'}
              </button>
            </div>
          </section>
        </>
      ) : null}

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Bookings in {townName}</h3>
        <p style={styles.muted}>
          <Link to="/orders" style={styles.link}>
            Open Orders
          </Link>{' '}
          and filter by town to track sample collection and reports. (Diagnostics order list coming soon.)
        </p>
      </section>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    padding: '0.85rem 1rem',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #ecfeff 0%, #fff 50%, #ecfdf5 100%)',
    border: '1px solid var(--border, #e5e7eb)',
    marginBottom: '0.55rem',
  },
  heroTitle: { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 900 },
  steps: { margin: 0, paddingLeft: '1.15rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  link: { color: '#0f766e', fontWeight: 800, textDecoration: 'none' },
  card: {
    padding: '0.75rem 0.85rem',
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-elevated, #fff)',
    marginBottom: '0.55rem',
    display: 'grid',
    gap: '0.55rem',
  },
  cardHead: { display: 'flex', gap: '0.55rem', alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#0f766e',
    color: '#fff',
    fontWeight: 900,
    fontSize: '0.85rem',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  cardTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 900 },
  cardSub: { margin: '0.15rem 0 0', fontSize: '0.72rem', lineHeight: 1.4, color: 'var(--text-muted)', fontWeight: 600 },
  row: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' },
  field: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700 },
  fieldGrow: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700, flex: '1 1 14rem', minWidth: 180 },
  vendorPickRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  vendorPickOn: {
    flex: '1 1 11rem',
    maxWidth: '100%',
    borderRadius: 10,
    border: '2px solid #0f766e',
    background: 'linear-gradient(135deg, #ccfbf1, #fff)',
    padding: '0.35rem 0.45rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    justifyContent: 'space-between',
  },
  vendorPickOff: {
    flex: '1 1 11rem',
    maxWidth: '100%',
    borderRadius: 10,
    border: '1px solid var(--border, #ddd)',
    background: '#fff',
    padding: '0.35rem 0.45rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    justifyContent: 'space-between',
  },
  vendorPickSelect: {
    border: 0,
    background: 'transparent',
    padding: 0,
    margin: 0,
    fontSize: '0.82rem',
    fontWeight: 900,
    color: 'var(--text, #111)',
    cursor: 'pointer',
    textAlign: 'left',
    flex: '1 1 6rem',
    minHeight: 36,
  },
  vendorVisOn: {
    minHeight: 36,
    minWidth: 84,
    borderRadius: 999,
    border: '1px solid #0f766e',
    background: 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
    fontWeight: 900,
    fontSize: '0.72rem',
    color: '#115e59',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
    flexShrink: 0,
  },
  vendorVisOff: {
    minHeight: 36,
    minWidth: 84,
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    fontWeight: 800,
    fontSize: '0.72rem',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
    flexShrink: 0,
  },
  input: { minHeight: 40, border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '0 0.5rem', background: '#fff' },
  narrow: { minHeight: 40, width: '5.5rem', border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '0 0.45rem' },
  switchBlock: { display: 'grid', gap: '0.2rem' },
  switchLabel: { fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' },
  switchOn: {
    minHeight: 40,
    minWidth: 88,
    borderRadius: 999,
    border: '1px solid #0f766e',
    background: 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
    fontWeight: 900,
    fontSize: '0.78rem',
    color: '#115e59',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0 0.55rem',
  },
  switchOff: {
    minHeight: 40,
    minWidth: 88,
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    fontWeight: 800,
    fontSize: '0.78rem',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0 0.55rem',
  },
  knob: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: 'currentColor',
    opacity: 0.35,
  },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  meta: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  hint: { margin: '0 0 0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.4 },
  warn: { margin: 0, fontSize: '0.72rem', color: '#b45309', fontWeight: 700 },
  primary: { minHeight: 38, border: 0, borderRadius: 10, background: '#0f766e', color: '#fff', fontWeight: 800, padding: '0 0.9rem', cursor: 'pointer' },
};
