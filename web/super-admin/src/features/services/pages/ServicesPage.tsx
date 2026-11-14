import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, ConfirmDialog, KpiCard } from '@/shared/ui';
import {
  createService,
  deleteService,
  listServices,
  updateService,
  type ServiceOffering,
} from '../api/servicesApi';

/** Laundry & glam always skip the grocery product catalog in the vendor portal. */
function catalogHiddenLocked(name: string): boolean {
  return /laundry|beauty|makeup|glam/i.test(name);
}

function catalogHiddenEffective(name: string, hidesListings: boolean): boolean {
  return hidesListings || catalogHiddenLocked(name);
}

function serviceMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  const t = name.trim();
  return (t.length >= 2 ? t.slice(0, 2) : t || '?').toUpperCase();
}

function monogramStyle(name: string): CSSProperties {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    background: `color-mix(in srgb, hsl(${hue} 52% 42%) 18%, var(--bg-elevated))`,
    color: `hsl(${hue} 48% 32%)`,
    border: `1px solid color-mix(in srgb, hsl(${hue} 52% 42%) 28%, var(--border))`,
  };
}

export function ServicesPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [serviceOnlyNew, setServiceOnlyNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listServices(token);
      setServices(rows);
      setNames(Object.fromEntries(rows.map((row) => [row.id, row.name])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load services');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const newNameLocked = catalogHiddenLocked(name);

  useEffect(() => {
    if (newNameLocked) setServiceOnlyNew(true);
  }, [newNameLocked]);

  async function onAdd() {
    const next = name.trim();
    if (!next) {
      setError('Service name is required');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const hide = catalogHiddenEffective(next, serviceOnlyNew);
      await createService(token, next, hide);
      setName('');
      setServiceOnlyNew(false);
      setNotice(`${next} added`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not add service');
    } finally {
      setBusy(false);
    }
  }

  async function saveRow(row: ServiceOffering, nextName: string, serviceOnly: boolean) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setError('Service name is required');
      setNames((prev) => ({ ...prev, [row.id]: row.name }));
      return;
    }
    const hideListings = catalogHiddenEffective(trimmed, serviceOnly);
    if (trimmed === row.name && hideListings === row.hidesListings) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateService(token, row.id, trimmed, hideListings);
      setNotice(`${trimmed} saved`);
      await reload();
    } catch (err) {
      setNames((prev) => ({ ...prev, [row.id]: row.name }));
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save service');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!removeId) return;
    const row = services.find((item) => item.id === removeId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteService(token, removeId);
      setNotice(`${row?.name ?? 'Service'} removed`);
      setRemoveId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not remove service');
    } finally {
      setBusy(false);
    }
  }

  const removing = services.find((item) => item.id === removeId);

  function canRemove(row: ServiceOffering): boolean {
    return (row.vendorCount ?? 0) === 0 && (row.pendingRegistrationCount ?? 0) === 0;
  }

  const sorted = useMemo(
    () => [...services].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [services],
  );

  const stats = useMemo(() => {
    let grocery = 0;
    let serviceOnly = 0;
    let vendors = 0;
    let pending = 0;
    for (const row of services) {
      const so = catalogHiddenEffective(row.name, row.hidesListings);
      if (so) serviceOnly += 1;
      else grocery += 1;
      vendors += row.vendorCount ?? 0;
      pending += row.pendingRegistrationCount ?? 0;
    }
    return { total: services.length, grocery, serviceOnly, vendors, pending };
  }, [services]);

  return (
    <PortalShell
      title="Vendor services"
      subtitle="Define service types, portal experience, and how vendors appear to buyers."
      onRefresh={() => void reload()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.page}>
        <div style={styles.kpiRow}>
          <KpiCard label="Service types" value={String(stats.total)} hint="On this platform" />
          <KpiCard
            label="Catalog mode"
            value={String(stats.grocery)}
            hint="Product listings enabled"
            tip="Vendors get Listings, pricing, and kirana-style catalog tools."
          />
          <KpiCard
            label="Operations mode"
            value={String(stats.serviceOnly)}
            hint="Bookings & desk flows"
            tip="Hides grocery Listings — laundry, glam, diagnostics-style workflows."
          />
          <KpiCard
            label="Active vendors"
            value={String(stats.vendors)}
            hint={stats.pending > 0 ? `${stats.pending} pending signup` : 'Across all types'}
          />
        </div>

        <div style={styles.workspace}>
          <header style={styles.workspaceHead}>
            <div style={styles.workspaceTitleBlock}>
              <h2 style={styles.workspaceTitle}>Service directory</h2>
              <p style={styles.workspaceSub}>
                Names save on blur. Portal mode saves immediately.{' '}
                <Link to="/vendors" style={styles.inlineLink}>
                  Assign on vendors
                </Link>
              </p>
            </div>
            <details style={styles.help}>
              <summary style={styles.helpSummary}>Portal modes</summary>
              <div style={styles.helpBody}>
                <p style={styles.helpPara}>
                  <strong>Product catalog</strong> — vendors manage SKUs, stock, and cart checkout.
                </p>
                <p style={styles.helpPara}>
                  <strong>Operations</strong> — job-based portals (laundry desk, glam calendar, lab orders) without a
                  grocery catalog. Laundry and glam names lock to this mode.
                </p>
              </div>
            </details>
          </header>

          <div style={styles.composer}>
            <label style={styles.composerField}>
              <span style={styles.composerLabel}>New service</span>
              <InlineNameInput
                framed
                id="new-service-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name, e.g. Groceries"
                maxLength={80}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim() && !busy) void onAdd();
                }}
              />
            </label>
            <div style={styles.composerMode}>
              <span style={styles.composerLabel}>Portal experience</span>
              <PortalModeSwitch
                serviceOnly={serviceOnlyNew || newNameLocked}
                locked={newNameLocked}
                disabled={busy}
                onChange={setServiceOnlyNew}
              />
            </div>
            <Button disabled={busy || !name.trim()} onClick={() => void onAdd()} style={styles.composerBtn}>
              {busy ? 'Saving…' : 'Create'}
            </Button>
          </div>

          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thName}>Service</th>
                  <th style={styles.thMode}>Portal experience</th>
                  <th style={styles.thAdopt}>Adoption</th>
                  <th style={styles.thActions} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {loading && services.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={styles.emptyCell}>
                      <span style={styles.skeleton}>Loading directory…</span>
                    </td>
                  </tr>
                ) : services.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={styles.emptyCell}>
                      <div style={styles.emptyBlock}>
                        <p style={styles.emptyTitle}>No services configured</p>
                        <p style={styles.emptySub}>Create Groceries and Laundry above to onboard your first vendors.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((row, index) => {
                    const displayName = names[row.id] ?? row.name;
                    const locked = catalogHiddenLocked(displayName);
                    const serviceOnly = catalogHiddenEffective(displayName, row.hidesListings);
                    const vendors = row.vendorCount ?? 0;
                    const pending = row.pendingRegistrationCount ?? 0;
                    const removable = canRemove(row);
                    return (
                      <tr key={row.id} style={index % 2 === 1 ? styles.rowAlt : undefined}>
                        <td style={styles.tdName}>
                          <div style={styles.nameCell}>
                            <span style={{ ...styles.monogram, ...monogramStyle(displayName) }} aria-hidden>
                              {serviceMonogram(displayName)}
                            </span>
                            <InlineNameInput
                              id={`service-name-${row.id}`}
                              value={displayName}
                              maxLength={80}
                              placeholder="Service name"
                              aria-label={`Name for ${row.name}`}
                              disabled={busy}
                              onChange={(e) => setNames((prev) => ({ ...prev, [row.id]: e.target.value }))}
                              onBlur={() => void saveRow(row, displayName, locked || row.hidesListings)}
                            />
                          </div>
                        </td>
                        <td style={styles.tdMode}>
                          <PortalModeSwitch
                            serviceOnly={serviceOnly}
                            locked={locked}
                            disabled={busy}
                            onChange={(next) => void saveRow(row, displayName, next)}
                          />
                          {locked ? <p style={styles.lockedHint}>Locked for laundry / glam naming</p> : null}
                        </td>
                        <td style={styles.tdAdopt}>
                          <AdoptionCell vendors={vendors} pending={pending} />
                        </td>
                        <td style={styles.tdActions}>
                          <button
                            type="button"
                            style={removable && !busy ? styles.removeBtn : styles.removeBtnDisabled}
                            disabled={busy || !removable}
                            title={
                              removable
                                ? 'Delete service'
                                : 'Reassign vendors or clear pending registrations first'
                            }
                            onClick={() => setRemoveId(row.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(removeId)}
        title={`Delete ${removing?.name ?? 'service'}?`}
        description={
          removing && !canRemove(removing)
            ? `${removing.vendorCount ?? 0} vendors · ${removing.pendingRegistrationCount ?? 0} pending`
            : 'No vendors use this service. This cannot be undone.'
        }
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => {
          if (removing && canRemove(removing)) void onRemove();
        }}
        onClose={() => setRemoveId(null)}
      />
    </PortalShell>
  );
}

function InlineNameInput({
  framed,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { framed?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        ...styles.inlineInput,
        ...(framed ? styles.inlineInputFramed : null),
        ...(focused ? styles.inlineInputFocus : null),
        ...style,
      }}
    />
  );
}

function AdoptionColumn({ children }: { children: ReactNode }) {
  return <div style={styles.adoptCol}>{children}</div>;
}

function AdoptionCell({ vendors, pending }: { vendors: number; pending: number }) {
  if (vendors === 0 && pending === 0) {
    return (
      <AdoptionColumn>
        <span style={styles.adoptUnused}>Unused</span>
        <span style={styles.adoptMeta}>No vendors yet</span>
      </AdoptionColumn>
    );
  }
  return (
    <AdoptionColumn>
      <span style={styles.adoptPrimary}>
        {vendors} <span style={styles.adoptUnit}>vendor{vendors === 1 ? '' : 's'}</span>
      </span>
      {pending > 0 ? (
        <span style={styles.adoptMeta}>
          {pending} pending registration{pending === 1 ? '' : 's'}
        </span>
      ) : null}
    </AdoptionColumn>
  );
}

function PortalModeSwitch({
  serviceOnly,
  locked,
  disabled,
  onChange,
}: {
  serviceOnly: boolean;
  locked: boolean;
  disabled?: boolean;
  onChange: (serviceOnly: boolean) => void;
}) {
  return (
    <div style={styles.switch} role="group" aria-label="Portal experience">
      <button
        type="button"
        disabled={disabled || locked}
        aria-pressed={!serviceOnly}
        style={{
          ...styles.switchOpt,
          ...(!serviceOnly ? styles.switchOptOn : styles.switchOptOff),
        }}
        onClick={() => onChange(false)}
      >
        Product catalog
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={serviceOnly}
        style={{
          ...styles.switchOpt,
          ...(serviceOnly ? styles.switchOptOn : styles.switchOptOff),
        }}
        onClick={() => onChange(true)}
      >
        Operations
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: '1rem', maxWidth: 1040 },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))',
    gap: '0.65rem',
  },
  workspace: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card)',
    overflow: 'hidden',
  },
  workspaceHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem 1.25rem',
    padding: '1rem 1.15rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    background: 'linear-gradient(180deg, var(--bg-muted) 0%, var(--bg-elevated) 100%)',
  },
  workspaceTitleBlock: { minWidth: 0, flex: '1 1 16rem' },
  workspaceTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.12rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  workspaceSub: { margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.45 },
  inlineLink: { color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' },
  help: {
    flex: '0 1 auto',
    minWidth: 'min(100%, 14rem)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--bg-elevated)',
    padding: '0.35rem 0.65rem',
  },
  helpSummary: {
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--text)',
    listStyle: 'none',
    userSelect: 'none',
  },
  helpBody: { padding: '0.5rem 0 0.15rem', display: 'grid', gap: '0.35rem' },
  helpPara: { margin: 0, fontSize: '0.76rem', lineHeight: 1.45, color: 'var(--text-muted)', fontWeight: 600 },
  composer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'flex-end',
    padding: '0.85rem 1.15rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  composerField: { display: 'grid', gap: '0.35rem', minWidth: 0, flex: '1 1 14rem' },
  composerMode: { display: 'grid', gap: '0.35rem', minWidth: 0, flex: '1 1 16rem', maxWidth: 340 },
  composerLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  composerBtn: { alignSelf: 'end', minWidth: 96 },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thName: {
    textAlign: 'left',
    padding: '0.65rem 1.15rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    width: '34%',
  },
  thMode: {
    textAlign: 'left',
    padding: '0.65rem 1rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    width: '36%',
  },
  thAdopt: {
    textAlign: 'left',
    padding: '0.65rem 1rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    width: '18%',
  },
  thActions: {
    padding: '0.65rem 1.15rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    width: '12%',
  },
  rowAlt: { background: 'color-mix(in srgb, var(--bg-muted) 35%, transparent)' },
  tdName: { padding: '0.7rem 1.15rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdMode: { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdAdopt: { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdActions: { padding: '0.7rem 1.15rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'right' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 },
  monogram: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    flexShrink: 0,
  },
  inlineInput: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: '1px solid transparent',
    borderRadius: 10,
    background: 'transparent',
    padding: '0.5rem 0.55rem',
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--text)',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
  },
  inlineInputFramed: {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  inlineInputFocus: {
    border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))',
    background: 'var(--bg-elevated)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)',
  },
  switch: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 2,
    padding: 3,
    borderRadius: 12,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    maxWidth: 320,
  },
  switchOpt: {
    minHeight: 38,
    padding: '0 0.65rem',
    borderRadius: 9,
    border: '1px solid transparent',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
    lineHeight: 1.2,
    transition: 'background 120ms ease, color 120ms ease, box-shadow 120ms ease',
  },
  switchOptOff: {
    background: 'transparent',
    color: 'var(--text-muted)',
  },
  switchOptOn: {
    background: 'var(--bg-elevated)',
    color: 'var(--accent-hover)',
    border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))',
    boxShadow: '0 1px 4px color-mix(in srgb, var(--accent) 12%, transparent)',
  },
  lockedHint: {
    margin: '0.35rem 0 0',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  adoptCol: { display: 'grid', gap: '0.1rem' },
  adoptPrimary: {
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  adoptUnit: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  adoptMeta: { fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' },
  adoptUnused: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger)',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '0.35rem 0.5rem',
    borderRadius: 8,
  },
  removeBtnDisabled: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'not-allowed',
    padding: '0.35rem 0.5rem',
    opacity: 0.55,
  },
  emptyCell: {
    padding: '2.5rem 1.15rem',
    textAlign: 'center',
    borderBottom: 'none',
  },
  emptyBlock: { maxWidth: '28rem', margin: '0 auto' },
  emptyTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  emptySub: { margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.45 },
  skeleton: { fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' },
};