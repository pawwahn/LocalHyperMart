import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog, TextField } from '@/shared/ui';
import {
  createService,
  deleteService,
  listServices,
  updateService,
  type ServiceOffering,
} from '../api/servicesApi';

function serviceEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('laundry')) return '🧺';
  if (lower.includes('beauty') || lower.includes('makeup') || lower.includes('glam')) return '💄';
  if (lower.includes('groc')) return '🛒';
  return '✨';
}

/** Laundry & glam always skip the grocery product catalog in the vendor portal. */
function catalogHiddenLocked(name: string): boolean {
  return /laundry|beauty|makeup|glam/i.test(name);
}

function catalogHiddenEffective(name: string, hidesListings: boolean): boolean {
  return hidesListings || catalogHiddenLocked(name);
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

  function usageBadge(row: ServiceOffering): { label: string; tone: 'ok' | 'busy' | 'warn' } {
    const vendors = row.vendorCount ?? 0;
    const pending = row.pendingRegistrationCount ?? 0;
    if (vendors === 0 && pending === 0) return { label: 'Unused', tone: 'ok' };
    const parts: string[] = [];
    if (vendors > 0) parts.push(`${vendors} vendor${vendors === 1 ? '' : 's'}`);
    if (pending > 0) parts.push(`${pending} pending`);
    return { label: parts.join(' · '), tone: vendors > 0 ? 'busy' : 'warn' };
  }

  const sorted = useMemo(
    () => [...services].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [services],
  );

  return (
    <PortalShell title="Vendor services" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.hero}>
        <div>
          <h2 style={styles.heroTitle}>What is a service?</h2>
          <p style={styles.heroText}>
            Each vendor belongs to one <strong>service type</strong> — Groceries, Laundry, Makeup &amp; Beauty, and so
            on. That choice drives which tools they see in the vendor portal and what buyers can book.
          </p>
          <p style={styles.heroText}>
            <Link to="/vendors" style={styles.link}>
              Assign services when adding or editing vendors →
            </Link>
          </p>
        </div>
        <div style={styles.legend}>
          <div style={styles.legendRow}>
            <span style={styles.legendIcon}>🛒</span>
            <div>
              <strong style={styles.legendHead}>Grocery shop</strong>
              <span style={styles.legendSub}>Vendor manages product Listings &amp; prices</span>
            </div>
          </div>
          <div style={styles.legendRow}>
            <span style={styles.legendIcon}>🧺</span>
            <div>
              <strong style={styles.legendHead}>Service-only</strong>
              <span style={styles.legendSub}>No product catalog — laundry desk or glam bookings instead</span>
            </div>
          </div>
        </div>
      </div>

      <Card style={styles.addCard}>
        <h3 style={styles.sectionTitle}>Add a service</h3>
        <div style={styles.addRow}>
          <TextField
            id="new-service-name"
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
            maxLength={80}
            style={styles.nameField}
          />
          <CatalogModeToggle
            serviceOnly={serviceOnlyNew || newNameLocked}
            locked={newNameLocked}
            disabled={busy}
            onChange={setServiceOnlyNew}
          />
          <Button disabled={busy || !name.trim()} onClick={() => void onAdd()}>
            {busy ? 'Saving…' : 'Add service'}
          </Button>
        </div>
      </Card>

      <Card style={styles.listCard}>
        <div style={styles.listHead}>
          <h3 style={styles.sectionTitle}>Your services</h3>
          <span style={styles.listMeta}>{sorted.length} total</span>
        </div>
        {loading && services.length === 0 ? (
          <p style={styles.muted}>Loading…</p>
        ) : services.length === 0 ? (
          <p style={styles.muted}>No services yet. Start with Groceries and Laundry.</p>
        ) : (
          <div style={styles.list}>
            {sorted.map((row) => {
              const displayName = names[row.id] ?? row.name;
              const locked = catalogHiddenLocked(displayName);
              const serviceOnly = catalogHiddenEffective(displayName, row.hidesListings);
              const badge = usageBadge(row);
              return (
                <article key={row.id} style={styles.serviceCard}>
                  <div style={styles.serviceTop}>
                    <span style={styles.emoji} aria-hidden>
                      {serviceEmoji(displayName)}
                    </span>
                    <TextField
                      id={`service-name-${row.id}`}
                      label="Name"
                      value={displayName}
                      maxLength={80}
                      style={styles.nameFieldGrow}
                      onChange={(e) => setNames((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      onBlur={() => void saveRow(row, displayName, locked || row.hidesListings)}
                    />
                    <span
                      style={
                        badge.tone === 'ok'
                          ? styles.badgeOk
                          : badge.tone === 'busy'
                            ? styles.badgeBusy
                            : styles.badgeWarn
                      }
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div style={styles.serviceMid}>
                    <CatalogModeToggle
                      serviceOnly={serviceOnly}
                      locked={locked}
                      disabled={busy}
                      onChange={(next) => void saveRow(row, displayName, next)}
                    />
                    <p style={styles.modeHint}>
                      {serviceOnly ? (
                        <>
                          <strong>Service-only</strong> — vendor portal hides grocery Listings. Use laundry, glam, or
                          other job-based flows.
                        </>
                      ) : (
                        <>
                          <strong>Grocery mode</strong> — vendor can list products and sell from catalog (kirana /
                          general store).
                        </>
                      )}
                    </p>
                  </div>
                  <div style={styles.serviceActions}>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || !canRemove(row)}
                      title={
                        canRemove(row)
                          ? 'Delete this service'
                          : 'Reassign vendors or clear pending registrations first'
                      }
                      onClick={() => setRemoveId(row.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(removeId)}
        title={`Delete ${removing?.name ?? 'service'}?`}
        description={
          removing && !canRemove(removing)
            ? usageBadge(removing).label
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

function CatalogModeToggle({
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
    <div style={styles.toggleWrap}>
      <span style={styles.toggleLabel}>Vendor portal</span>
      <div style={styles.toggleRow} role="group" aria-label="Vendor portal mode">
        <button
          type="button"
          disabled={disabled || locked}
          style={!serviceOnly ? styles.toggleOn : styles.toggleOff}
          onClick={() => onChange(false)}
        >
          🛒 Grocery catalog
        </button>
        <button
          type="button"
          disabled={disabled}
          style={serviceOnly ? styles.toggleOn : styles.toggleOff}
          onClick={() => onChange(true)}
        >
          ✨ Service-only
        </button>
      </div>
      {locked ? (
        <span style={styles.lockedNote}>Required for laundry &amp; glam names — cannot show product Listings.</span>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    padding: '0.85rem 1rem',
    borderRadius: 16,
    background:
      'linear-gradient(135deg, rgba(22, 101, 52, 0.08) 0%, rgba(255,255,255,0.95) 45%, rgba(219, 39, 119, 0.06) 100%)',
    border: '1px solid var(--border, #e5e7eb)',
    marginBottom: '0.5rem',
  },
  heroTitle: { margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 900 },
  heroText: { margin: '0 0 0.35rem', fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--text-muted, #4b5563)' },
  link: { color: 'var(--accent, #166534)', fontWeight: 800, textDecoration: 'none' },
  legend: { display: 'grid', gap: '0.5rem', alignContent: 'start' },
  legendRow: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start' },
  legendIcon: { fontSize: '1.35rem', lineHeight: 1 },
  legendHead: { display: 'block', fontSize: '0.78rem', fontWeight: 800 },
  legendSub: { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 },
  addCard: { display: 'grid', gap: '0.5rem', padding: '0.75rem 0.85rem' },
  listCard: { display: 'grid', gap: '0.55rem', padding: '0.75rem 0.85rem' },
  sectionTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 900 },
  listHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' },
  listMeta: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  addRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.55rem',
    alignItems: 'flex-end',
  },
  nameField: { flex: '1 1 200px', minWidth: 160, maxWidth: 320 },
  nameFieldGrow: { flex: '1 1 12rem', minWidth: 140 },
  list: { display: 'grid', gap: '0.55rem' },
  serviceCard: {
    display: 'grid',
    gap: '0.45rem',
    padding: '0.65rem 0.7rem',
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-elevated, #fff)',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
  },
  serviceTop: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'flex-end',
  },
  emoji: { fontSize: '1.5rem', lineHeight: 1, paddingBottom: 6 },
  badgeOk: {
    marginLeft: 'auto',
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.2rem 0.55rem',
    borderRadius: 999,
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    alignSelf: 'center',
  },
  badgeBusy: {
    marginLeft: 'auto',
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.2rem 0.55rem',
    borderRadius: 999,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    alignSelf: 'center',
  },
  badgeWarn: {
    marginLeft: 'auto',
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.2rem 0.55rem',
    borderRadius: 999,
    background: '#fffbeb',
    color: '#b45309',
    border: '1px solid #fde68a',
    alignSelf: 'center',
  },
  serviceMid: { display: 'grid', gap: '0.35rem' },
  modeHint: { margin: 0, fontSize: '0.72rem', lineHeight: 1.4, color: 'var(--text-muted)', fontWeight: 600 },
  serviceActions: { display: 'flex', justifyContent: 'flex-end' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  toggleWrap: { display: 'grid', gap: '0.25rem', minWidth: 0 },
  toggleLabel: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  toggleRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  toggleOff: {
    minHeight: 36,
    padding: '0 0.65rem',
    borderRadius: 999,
    border: '1px solid var(--border, #d1d5db)',
    background: 'transparent',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  toggleOn: {
    minHeight: 36,
    padding: '0 0.65rem',
    borderRadius: 999,
    border: '1px solid #166534',
    background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
    fontSize: '0.72rem',
    fontWeight: 900,
    cursor: 'pointer',
    color: '#14532d',
  },
  lockedNote: { fontSize: '0.68rem', fontWeight: 600, color: '#9d174d', maxWidth: 280, lineHeight: 1.35 },
};
