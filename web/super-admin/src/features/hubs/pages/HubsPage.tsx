import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, SearchSelect, TextField } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { HubDetailDialog } from '../components/HubDetailDialog';
import {
  GOVT_ID_OPTIONS,
  createHub,
  listHubs,
  type AdminHubVm,
  type GovtIdType,
} from '../api/hubsApi';

const PAGE_SIZE = 25;

function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

export function HubsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [hubs, setHubs] = useState<AdminHubVm[]>([]);
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [pageView, setPageView] = useState<'hubs' | 'history'>('hubs');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [historyHubId, setHistoryHubId] = useState('');
  const [historyTick, setHistoryTick] = useState(0);
  const [openHub, setOpenHub] = useState<AdminHubVm | null>(null);

  const [townId, setTownId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [govtIdType, setGovtIdType] = useState<GovtIdType>('AADHAAR');
  const [govtIdNumber, setGovtIdNumber] = useState('');
  const [reference1Name, setReference1Name] = useState('');
  const [reference1Phone, setReference1Phone] = useState('');
  const [reference2Name, setReference2Name] = useState('');
  const [reference2Phone, setReference2Phone] = useState('');

  const townById = useMemo(() => {
    const map = new Map<string, TownVm>();
    for (const t of towns) map.set(t.id, t);
    return map;
  }, [towns]);

  const townsWithoutHub = useMemo(() => {
    const taken = new Set(hubs.map((h) => h.townId));
    return towns.filter((t) => t.status === 'ENABLED' && !taken.has(t.id));
  }, [towns, hubs]);

  const filteredHubs = useMemo(() => {
    return hubs.filter((h) =>
      matchesQuery(
        [h.name, h.address, h.phone, h.status, h.adminPhone, townById.get(h.townId)?.displayName]
          .filter(Boolean)
          .join(' '),
        query,
      ),
    );
  }, [hubs, query, townById]);

  const totalPages = Math.max(1, Math.ceil(filteredHubs.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedHubs = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredHubs.slice(start, start + PAGE_SIZE);
  }, [filteredHubs, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const historyHub = hubs.find((h) => h.hubId === historyHubId) ?? null;
  const historyHubOptions = useMemo(
    () =>
      hubs.map((h) => ({
        value: h.hubId,
        label: `${h.name}${h.status === 'DISABLED' ? ' · DISABLED' : ''}`,
        searchText: [h.name, h.phone, h.address, townById.get(h.townId)?.displayName, h.status]
          .filter(Boolean)
          .join(' '),
      })),
    [hubs, townById],
  );

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [hubList, townList] = await Promise.all([listHubs(token), listTowns(token)]);
      setHubs(hubList);
      setTowns(townList);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load hubs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!townId && townsWithoutHub.length > 0) {
      setTownId(townsWithoutHub[0].id);
    }
    if (townId && !townsWithoutHub.some((t) => t.id === townId)) {
      setTownId(townsWithoutHub[0]?.id ?? '');
    }
  }, [townsWithoutHub, townId]);

  function resetForm() {
    setName('');
    setAddress('');
    setPhone('');
    setAdminPhone('');
    setAdminFirstName('');
    setAdminPassword('');
    setGovtIdType('AADHAAR');
    setGovtIdNumber('');
    setReference1Name('');
    setReference1Phone('');
    setReference2Name('');
    setReference2Phone('');
  }

  async function onCreate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    if (!townId) {
      setError('Select a town that does not already have a hub');
      setBusy(false);
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit hub phone');
      setBusy(false);
      return;
    }
    if (adminPhone.trim() && !/^[6-9]\d{9}$/.test(adminPhone.trim())) {
      setError('Enter a valid 10-digit admin phone (or leave blank to use hub phone)');
      setBusy(false);
      return;
    }
    const loginPhone = adminPhone.trim() || phone.trim();
    const r1 = reference1Phone.trim();
    const r2 = reference2Phone.trim();
    if (!/^[6-9]\d{9}$/.test(r1) || !/^[6-9]\d{9}$/.test(r2)) {
      setError('Enter valid 10-digit reference phones');
      setBusy(false);
      return;
    }
    if (r1 === loginPhone || r2 === loginPhone) {
      setError('Reference phones must be different from the admin login phone');
      setBusy(false);
      return;
    }
    if (r1 === r2) {
      setError('Reference 1 and reference 2 must use different phone numbers');
      setBusy(false);
      return;
    }
    const idDigits = govtIdNumber.replace(/\s/g, '').trim();
    if (govtIdType === 'AADHAAR' && !/^\d{12}$/.test(idDigits)) {
      setError('Aadhaar number must be 12 digits');
      setBusy(false);
      return;
    }
    if (!idDigits || idDigits.length < 4) {
      setError('Enter government ID number');
      setBusy(false);
      return;
    }
    if (!reference1Name.trim() || !reference2Name.trim()) {
      setError('Both references need a name');
      setBusy(false);
      return;
    }
    try {
      const created = await createHub(token, {
        townId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim(),
        adminPhone: adminPhone.trim() || undefined,
        adminFirstName: adminFirstName.trim() || undefined,
        adminPassword: adminPassword.trim() || undefined,
        govtIdType,
        govtIdNumber: idDigits,
        reference1Name: reference1Name.trim(),
        reference1Phone: r1,
        reference2Name: reference2Name.trim(),
        reference2Phone: r2,
      });
      const townLabel = townById.get(created.townId)?.displayName ?? 'town';
      const pwd = created.temporaryPassword?.trim();
      setNotice(
        pwd
          ? `Hub created for ${townLabel}. Share once — ${created.adminPhone ?? created.phone} / ${pwd}`
          : `Hub created for ${townLabel}`,
      );
      setShowAdd(false);
      resetForm();
      setHistoryTick((n) => n + 1);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !!name.trim() &&
    !!phone.trim() &&
    !!govtIdNumber.trim() &&
    !!reference1Name.trim() &&
    !!reference1Phone.trim() &&
    !!reference2Name.trim() &&
    !!reference2Phone.trim();

  const from = filteredHubs.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
  const to = Math.min(pageSafe * PAGE_SIZE, filteredHubs.length);

  return (
    <PortalShell
      title="Delivery hubs"
      onRefresh={() => {
        setHistoryTick((n) => n + 1);
        void reload();
      }}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card elevated style={styles.toolbar}>
        <div style={styles.toolbarRow}>
          <div>
            <p style={styles.eyebrow}>Operations</p>
            <p style={styles.summary}>
              <strong>{hubs.length}</strong> hubs
              {townsWithoutHub.length > 0 ? (
                <>
                  {' · '}
                  <strong>{townsWithoutHub.length}</strong> towns without a hub
                </>
              ) : null}
            </p>
          </div>
          <div style={styles.toolbarActions}>
            <div style={styles.viewTabs} role="tablist" aria-label="Hubs or history">
              <button
                type="button"
                role="tab"
                aria-selected={pageView === 'hubs'}
                style={pageView === 'hubs' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPageView('hubs')}
              >
                Hubs
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pageView === 'history'}
                style={pageView === 'history' ? styles.viewTabActive : styles.viewTab}
                onClick={() => {
                  setPageView('history');
                  setHistoryTick((n) => n + 1);
                }}
              >
                History
              </button>
            </div>
            {pageView === 'hubs' ? (
              <>
                <input
                  style={styles.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search hubs…"
                  aria-label="Search hubs"
                />
                <Button
                  size="sm"
                  variant={showAdd ? 'secondary' : 'primary'}
                  disabled={busy || townsWithoutHub.length === 0}
                  onClick={() => {
                    setShowAdd((v) => !v);
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {showAdd ? 'Close' : 'Add hub'}
                </Button>
              </>
            ) : (
              <div style={styles.historySearch}>
                <SearchSelect
                  compact
                  noun="hubs"
                  value={historyHubId}
                  options={historyHubOptions}
                  onChange={setHistoryHubId}
                  disabled={hubs.length === 0}
                  placeholder={loading ? 'Loading hubs…' : 'Search hub for history…'}
                  emptyMessage={hubs.length === 0 ? 'No hubs yet' : 'No hubs match'}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {pageView === 'hubs' && showAdd ? (
        <Card style={styles.addCard}>
          <div>
            <h2 style={styles.addTitle}>New hub</h2>
            <p style={styles.hint}>One hub per town. Creates the hub-admin login. Govt ID and 2 references required.</p>
          </div>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Town
              <select style={styles.select} value={townId} onChange={(e) => setTownId(e.target.value)} disabled={busy}>
                {townsWithoutHub.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName} ({t.townCode})
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Hub name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chirala Hub" />
            <div style={styles.span2}>
              <TextField
                label="Address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Main road, near bus stand"
              />
            </div>
            <TextField
              label="Hub contact phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876511111"
              inputMode="numeric"
            />
            <TextField
              label="Admin login phone (optional)"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="Same as hub phone if blank"
              inputMode="numeric"
            />
            <TextField
              label="Admin first name (optional)"
              value={adminFirstName}
              onChange={(e) => setAdminFirstName(e.target.value)}
              placeholder="Defaults to hub name"
            />
            <TextField
              label="Admin password (optional)"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Blank → HlM@ + last 4 digits"
              autoComplete="new-password"
            />
          </div>
          <p style={styles.sectionTitle}>Government proof (hub admin)</p>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              ID type
              <select
                style={styles.select}
                value={govtIdType}
                onChange={(e) => setGovtIdType(e.target.value as GovtIdType)}
                disabled={busy}
              >
                {GOVT_ID_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label={govtIdType === 'AADHAAR' ? 'Aadhaar (12 digits)' : 'ID number'}
              value={govtIdNumber}
              onChange={(e) => setGovtIdNumber(e.target.value)}
              inputMode="numeric"
              maxLength={govtIdType === 'AADHAAR' ? 12 : 40}
              placeholder={govtIdType === 'AADHAAR' ? 'XXXXXXXXXXXX' : 'ID number'}
            />
          </div>
          <p style={styles.sectionTitle}>Reference 1</p>
          <div style={styles.formGrid}>
            <TextField
              label="Name"
              value={reference1Name}
              onChange={(e) => setReference1Name(e.target.value)}
              placeholder="Relative / neighbour"
            />
            <TextField
              label="Phone"
              value={reference1Phone}
              onChange={(e) => setReference1Phone(e.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
            />
          </div>
          <p style={styles.sectionTitle}>Reference 2</p>
          <div style={styles.formGrid}>
            <TextField
              label="Name"
              value={reference2Name}
              onChange={(e) => setReference2Name(e.target.value)}
              placeholder="Relative / neighbour"
            />
            <TextField
              label="Phone"
              value={reference2Phone}
              onChange={(e) => setReference2Phone(e.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
            />
          </div>
          <div>
            <Button disabled={busy || !canSubmit} onClick={() => void onCreate()}>
              {busy ? 'Creating…' : 'Create hub + admin'}
            </Button>
          </div>
        </Card>
      ) : null}

      {pageView === 'hubs' ? (
        <Card style={styles.listCard}>
          <style>{`.hub-row:hover{background:color-mix(in srgb,var(--accent) 7%,transparent)}`}</style>
          {loading ? (
            <p style={styles.muted}>Loading…</p>
          ) : hubs.length === 0 ? (
            <p style={styles.muted}>No hubs yet. Add the first town hub above.</p>
          ) : filteredHubs.length === 0 ? (
            <p style={styles.muted}>No hubs match this search.</p>
          ) : (
            <>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Hub</th>
                      <th style={styles.th}>Town</th>
                      <th style={styles.th}>Phone</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHubs.map((h) => (
                      <tr
                        key={h.hubId}
                        className="hub-row"
                        style={styles.row}
                        tabIndex={0}
                        onClick={() => setOpenHub(h)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenHub(h);
                          }
                        }}
                      >
                        <td style={styles.td}>
                          <strong>{h.name}</strong>
                          {h.address ? <div style={styles.sub}>{h.address}</div> : null}
                        </td>
                        <td style={styles.td}>{townById.get(h.townId)?.displayName ?? h.townId.slice(0, 8)}</td>
                        <td style={styles.td}>{h.phone}</td>
                        <td style={styles.td}>{h.status === 'DISABLED' ? 'Disabled' : 'Active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={styles.pager}>
                <span style={styles.pageMeta}>
                  {from}–{to} of {filteredHubs.length.toLocaleString('en-IN')}
                </span>
                <Button size="sm" variant="ghost" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </Card>
      ) : token ? (
        <AdminHistoryPanel
          token={token}
          screen="hubs"
          title={historyHub ? `${historyHub.name} history` : 'Hub history'}
          townId={historyHub?.townId}
          requireTown={!historyHub}
          emptyHint="Search a hub above to see create and update history."
          townNames={Object.fromEntries(towns.map((t) => [t.id, t.displayName]))}
          refreshTick={historyTick}
          tall
        />
      ) : null}

      {openHub && token ? (
        <HubDetailDialog
          hub={openHub}
          townLabel={townById.get(openHub.townId)?.displayName ?? 'Town'}
          token={token}
          onClose={() => setOpenHub(null)}
          onSaved={(saved, message) => {
            setHubs((prev) => prev.map((h) => (h.hubId === saved.hubId ? saved : h)));
            setOpenHub(saved);
            setNotice(message);
            setError(null);
            setHistoryTick((n) => n + 1);
          }}
        />
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbar: {
    display: 'grid',
    gap: '0.55rem',
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
  toolbarActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    flex: '1 1 220px',
    justifyContent: 'flex-end',
  },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  summary: { margin: '0.2rem 0 0', color: 'var(--text)', fontSize: '0.95rem' },
  search: {
    flex: '1 1 160px',
    minWidth: 0,
    maxWidth: 280,
    boxSizing: 'border-box',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  historySearch: { minWidth: 240, flex: '1 1 240px', maxWidth: 360 },
  addCard: { display: 'grid', gap: '0.55rem' },
  addTitle: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 },
  hint: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.4 },
  muted: { margin: 0, color: 'var(--text-muted)' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))',
    gap: '0.45rem 0.75rem',
    alignItems: 'start',
  },
  span2: { gridColumn: '1 / -1', minWidth: 0 },
  sectionTitle: {
    margin: '0.2rem 0 0',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  label: {
    display: 'grid',
    gap: '0.25rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minWidth: 0,
  },
  select: {
    padding: '0.55rem 0.65rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    font: 'inherit',
    background: 'var(--bg-elevated)',
    width: '100%',
    boxSizing: 'border-box',
  },
  listCard: { display: 'grid', gap: '0.55rem' },
  tableWrap: {
    overflow: 'auto',
    maxHeight: 'min(62vh, 560px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th: {
    textAlign: 'left',
    padding: '0.45rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted, var(--bg))',
    zIndex: 1,
  },
  row: { cursor: 'pointer' },
  td: { padding: '0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  sub: { marginTop: 2, fontSize: '0.78rem', color: 'var(--text-muted)' },
  pager: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.4rem',
  },
  pageMeta: { marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 650 },
};
