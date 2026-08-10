import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import {
  createTown,
  listCountries,
  listTowns,
  updateTownStatus,
  type GeoCountryVm,
  type TownVm,
} from '../api/townsApi';
import { getPlatformSettings } from '@/features/settings/api/settingsApi';
import { TownDeliveryConfigDialog } from '../components/TownDeliveryConfigDialog';

type Filter = 'all' | 'enabled' | 'disabled';

const PAGE_SIZE = 25;

function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

export function TownsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [countries, setCountries] = useState<GeoCountryVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [stateCode, setStateCode] = useState('AP');
  const [townCode, setTownCode] = useState('');
  const [pincodes, setPincodes] = useState('');
  const [radius, setRadius] = useState('10');
  const [configTown, setConfigTown] = useState<TownVm | null>(null);
  const [platformDeliveryFee, setPlatformDeliveryFee] = useState(40);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.code === countryCode) ?? null,
    [countries, countryCode],
  );
  const states = selectedCountry?.states ?? [];

  const enabledCount = useMemo(() => towns.filter((t) => t.status === 'ENABLED').length, [towns]);
  const disabledCount = useMemo(() => towns.filter((t) => t.status !== 'ENABLED').length, [towns]);

  const filteredTowns = useMemo(() => {
    return towns.filter((t) => {
      if (filter === 'enabled' && t.status !== 'ENABLED') return false;
      if (filter === 'disabled' && t.status === 'ENABLED') return false;
      return matchesQuery(
        [t.displayName, t.townCode, t.state, t.stateCode, t.country, t.countryCode, t.status]
          .filter(Boolean)
          .join(' '),
        query,
      );
    });
  }, [towns, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredTowns.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedTowns = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredTowns.slice(start, start + PAGE_SIZE);
  }, [filteredTowns, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [townList, countryList, platform] = await Promise.all([
        listTowns(token),
        listCountries(token),
        getPlatformSettings(token).catch(() => null),
      ]);
      setTowns(townList);
      setCountries(countryList);
      if (platform) setPlatformDeliveryFee(platform.deliveryFee);
      if (countryList.length > 0) {
        setCountryCode((prev) => (countryList.some((c) => c.code === prev) ? prev : countryList[0].code));
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedCountry) return;
    if (!selectedCountry.states.some((s) => s.code === stateCode)) {
      setStateCode(selectedCountry.states[0]?.code ?? '');
    }
  }, [selectedCountry, stateCode]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const pins = pincodes
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!countryCode) {
      setError('Select a country');
      setBusy(false);
      return;
    }
    if (!stateCode) {
      setError('Select a state / region');
      setBusy(false);
      return;
    }
    if (!pins.length) {
      setError('Add at least one pincode (comma-separated)');
      setBusy(false);
      return;
    }
    if (townCode.trim().length > 10) {
      setError('Town code must be at most 10 characters');
      setBusy(false);
      return;
    }
    try {
      await createTown(token, {
        name: name.trim().toUpperCase(),
        countryCode,
        stateCode,
        townCode: townCode.trim().toUpperCase(),
        pincodes: pins,
        coverageRadiusKm: Number(radius) || 10,
      });
      setNotice('Town created with default min-order config. Next: Hubs → Add hub for this town.');
      setName('');
      setTownCode('');
      setPincodes('');
      setShowAdd(false);
      setFilter('all');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(town: TownVm) {
    const next = town.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    if (next === 'DISABLED' && !window.confirm(`Disable ${town.displayName}? Buyers and vendors in this town will stop.`)) {
      return;
    }
    setBusyId(town.id);
    setError(null);
    setNotice(null);
    try {
      await updateTownStatus(token, town.id, next, next === 'DISABLED' ? 'Paused by super admin' : undefined);
      setNotice(`${town.displayName} ${next === 'ENABLED' ? 'enabled' : 'disabled'}`);
      if (next === 'DISABLED') setFilter('all');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalShell title="Towns" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card elevated style={styles.toolbar}>
        <div style={styles.toolbarRow}>
          <div>
            <p style={styles.eyebrow}>Operations</p>
            <p style={styles.summary}>
              <strong>{enabledCount}</strong> enabled
              {disabledCount > 0 ? (
                <>
                  {' · '}
                  <strong>{disabledCount}</strong> disabled
                </>
              ) : null}
            </p>
          </div>
          <div style={styles.toolbarActions}>
            <input
              style={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search towns…"
              aria-label="Search towns"
            />
            <Button size="sm" variant={showAdd ? 'secondary' : 'primary'} onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? 'Close' : 'Add town'}
            </Button>
          </div>
        </div>
      </Card>

      {showAdd ? (
        <Card style={styles.addCard}>
          <div style={styles.addHead}>
            <h2 style={styles.sectionTitle}>New town</h2>
            <p style={styles.subtle}>Creates an enabled town ready for vendors.</p>
          </div>
          <div style={styles.formStack}>
            <div style={styles.geoRow}>
              <label style={styles.field}>
                Country
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={styles.select}>
                  {countries.length === 0 ? <option value="">Loading…</option> : null}
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.field}>
                State / region
                <select
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  style={styles.select}
                  disabled={states.length === 0}
                >
                  {states.length === 0 ? <option value="">Select country first</option> : null}
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={styles.formGrid}>
              <TextField
                label="Town name"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z\s]/g, ''))}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <TextField
                label="Town code"
                value={townCode}
                onChange={(e) => setTownCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10))}
                maxLength={10}
                placeholder="Max 10 letters"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <TextField
                label="Coverage km"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <TextField
              label="Pincodes"
              value={pincodes}
              onChange={(e) => setPincodes(e.target.value)}
              placeholder="Comma-separated, required"
            />
          </div>
          <div style={styles.formActions}>
            <Button
              disabled={busy || !name.trim() || !townCode.trim() || !pincodes.trim() || !countryCode || !stateCode}
              onClick={() => void onCreate()}
            >
              {busy ? 'Creating…' : 'Create'}
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
            {(
              [
                { id: 'all', label: 'All', count: towns.length },
                { id: 'enabled', label: 'Enabled', count: enabledCount },
                { id: 'disabled', label: 'Disabled', count: disabledCount },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                style={filter === item.id ? styles.tabActive : styles.tab}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span style={item.id === 'disabled' && item.count > 0 ? styles.badgeHot : styles.badge}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>
          {filteredTowns.length > 0 ? (
            <p style={styles.pageMeta}>
              {filteredTowns.length} shown · page {pageSafe}/{totalPages}
            </p>
          ) : null}
        </div>

        {loading && towns.length === 0 ? (
          <p style={styles.empty}>Loading…</p>
        ) : towns.length === 0 ? (
          <div style={styles.emptyBox}>
            <p style={styles.emptyTitle}>No towns yet</p>
            <p style={styles.subtle}>Add a town to start onboarding vendors.</p>
          </div>
        ) : filteredTowns.length === 0 ? (
          <div style={styles.emptyBox}>
            <p style={styles.emptyTitle}>No matches</p>
            <p style={styles.subtle}>
              {filter === 'disabled'
                ? 'No disabled towns. Disabled towns stay listed here so you can enable them again.'
                : `Nothing matches “${query.trim() || filter}”.`}
            </p>
          </div>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Town</th>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>State</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.thRight}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTowns.map((town) => {
                    const disabled = town.status !== 'ENABLED';
                    const rowBusy = busyId === town.id;
                    return (
                      <tr key={town.id}>
                        <td style={styles.td}>
                          <button type="button" style={styles.townLink} onClick={() => setConfigTown(town)}>
                            <strong style={styles.townName}>{town.displayName}</strong>
                          </button>
                          <div style={styles.tdSub}>{town.country ?? 'India'}</div>
                        </td>
                        <td style={styles.tdMuted}>{town.townCode}</td>
                        <td style={styles.tdMuted}>{town.state ?? town.stateCode}</td>
                        <td style={styles.td}>
                          <span style={disabled ? styles.pillDanger : styles.pillOk}>
                            {disabled ? 'Disabled' : 'Enabled'}
                          </span>
                        </td>
                        <td style={styles.tdRight}>
                          <div style={styles.actionRow}>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfigTown(town)}>
                              Delivery
                            </Button>
                            {disabled ? (
                              <Button size="sm" disabled={rowBusy || busy} onClick={() => void toggleStatus(town)}>
                                {rowBusy ? '…' : 'Enable'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={rowBusy || busy}
                                onClick={() => void toggleStatus(town)}
                              >
                                {rowBusy ? '…' : 'Disable'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div style={styles.pager}>
                <Button size="sm" variant="ghost" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span style={styles.pageMeta}>
                  {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filteredTowns.length)} of{' '}
                  {filteredTowns.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {configTown ? (
        <TownDeliveryConfigDialog
          town={configTown}
          token={token}
          platformDeliveryFee={platformDeliveryFee}
          onClose={() => setConfigTown(null)}
          onSaved={(message) => {
            setNotice(message);
            setError(null);
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
  formStack: { display: 'grid', gap: '0.75rem' },
  geoRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: '0.7rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
    gap: '0.7rem',
  },
  field: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: 0,
  },
  select: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.7rem 0.9rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  formActions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  mainCard: { display: 'grid', gap: '0.75rem' },
  listHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    background: 'var(--danger-soft, #fee2e2)',
    color: 'var(--danger, #b42318)',
    textAlign: 'center',
  },
  tableWrap: {
    overflow: 'auto',
    maxHeight: 'min(62vh, 560px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: '0.9rem',
    minWidth: 560,
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'left',
    padding: '0.55rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'right',
    padding: '0.55rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  td: {
    padding: '0.5rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  },
  tdMuted: {
    padding: '0.5rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  tdRight: {
    padding: '0.35rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  tdSub: { marginTop: 2, color: 'var(--text-muted)', fontSize: '0.78rem' },
  townLink: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
  },
  townName: { fontFamily: 'var(--font-display)', fontWeight: 800 },
  actionRow: { display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  pillOk: {
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    color: 'var(--accent)',
  },
  pillDanger: {
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'var(--danger-soft, #fee2e2)',
    color: 'var(--danger, #b42318)',
  },
  pager: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageMeta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.84rem' },
  empty: { margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' },
  emptyBox: {
    display: 'grid',
    gap: '0.25rem',
    placeItems: 'center',
    textAlign: 'center',
    padding: '1.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--border)',
  },
  emptyTitle: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' },
};
