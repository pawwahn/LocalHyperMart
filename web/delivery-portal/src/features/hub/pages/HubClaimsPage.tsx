import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { HubShell } from '../layout/HubShell';
import {
  fetchHubClaims,
  fetchMyHub,
  resolveHubClaim,
  type ClaimDto,
} from '../api/hubApi';

type ClaimFilter = 'OPEN' | 'RESOLVED' | 'REJECTED' | 'ALL';

function claimTypeLabel(type: string): string {
  switch (type) {
    case 'WRONG_ITEM':
      return 'Wrong item / qty';
    case 'DAMAGED':
      return 'Damaged';
    case 'MISSING':
      return 'Missing';
    default:
      return type;
  }
}

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

function statusPill(status: string): { label: string; style: CSSProperties } {
  if (status === 'RESOLVED') {
    return {
      label: 'CREDITED',
      style: {
        ...styles.pillBase,
        color: '#047857',
        background: 'rgba(16, 185, 129, 0.14)',
      },
    };
  }
  if (status === 'REJECTED') {
    return {
      label: 'REJECTED',
      style: {
        ...styles.pillBase,
        color: '#b91c1c',
        background: 'rgba(239, 68, 68, 0.12)',
      },
    };
  }
  return {
    label: 'OPEN',
    style: {
      ...styles.pillBase,
      color: 'var(--warning)',
      background: 'rgba(255, 183, 77, 0.18)',
    },
  };
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const FILTERS: Array<{ id: ClaimFilter; label: string }> = [
  { id: 'OPEN', label: 'Open' },
  { id: 'RESOLVED', label: 'Credited' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
];

const REJECT_PRESETS = [
  'Item was delivered correctly (buyer confirmed)',
  'Photo / evidence does not support claim',
  'Outside claim window / policy',
  'Duplicate claim — already credited',
  'Other',
];

export function HubClaimsPage() {
  const { session } = useAuth();
  const [townId, setTownId] = useState(session?.townId ?? '');
  const [hubName, setHubName] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>('OPEN');
  const [claims, setClaims] = useState<ClaimDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'credit' | 'reject'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [rejectPreset, setRejectPreset] = useState(REJECT_PRESETS[0]);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMyHub(session.accessToken);
      const resolvedTown = me.townId || session.townId || townId;
      setTownId(resolvedTown);
      setHubName(me.hubName || '');
      const page = await fetchHubClaims(session.accessToken, resolvedTown, {
        status: filter === 'ALL' ? undefined : filter,
        size: 50,
      });
      setClaims(page.items ?? []);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [session, townId, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  function openResolve(claim: ClaimDto, nextMode: 'credit' | 'reject') {
    setResolveId(claim.claimId);
    setMode(nextMode);
    setError(null);
    setNotice(null);
    const suggested = Number(claim.suggestedCreditAmount ?? 0);
    setAmount(suggested > 0 ? suggested.toFixed(2) : '');
    setNote('');
    setRejectPreset(REJECT_PRESETS[0]);
  }

  async function creditClaim(claim: ClaimDto) {
    if (!session || !townId) return;
    const value = Number(amount);
    const max = Number(claim.suggestedCreditAmount ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a credit amount greater than 0');
      return;
    }
    if (max > 0 && value > max + 0.001) {
      setError(`Credit cannot exceed the item total (${money(max)})`);
      return;
    }
    setBusyId(claim.claimId);
    setError(null);
    setNotice(null);
    try {
      await resolveHubClaim(session.accessToken, townId, claim.claimId, {
        resolution: 'WALLET_CREDIT',
        amount: value,
        note: note.trim() || undefined,
      });
      setResolveId(null);
      setAmount('');
      setNote('');
      setNotice(
        `Credited ${money(value)} for ${claim.itemName ?? 'item'} on ${claim.orderNumber ?? 'order'}`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not resolve');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectClaim(claim: ClaimDto) {
    if (!session || !townId) return;
    const detail = note.trim();
    const reason =
      rejectPreset === 'Other'
        ? detail
        : detail
          ? `${rejectPreset} — ${detail}`
          : rejectPreset;
    if (!reason) {
      setError('Choose or type a reject reason for the buyer');
      return;
    }
    setBusyId(claim.claimId);
    setError(null);
    setNotice(null);
    try {
      await resolveHubClaim(session.accessToken, townId, claim.claimId, {
        resolution: 'NONE',
        note: reason,
      });
      setResolveId(null);
      setAmount('');
      setNote('');
      setNotice(`Rejected claim on ${claim.itemName ?? claim.orderNumber ?? 'order'}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not reject');
    } finally {
      setBusyId(null);
    }
  }

  const subtitle =
    filter === 'OPEN'
      ? hubName
        ? `${hubName} · open buyer issues`
        : 'Open buyer issues'
      : hubName
        ? `${hubName} · claim history`
        : 'Claim history';

  const emptyTitle =
    filter === 'OPEN'
      ? 'No open claims'
      : filter === 'RESOLVED'
        ? 'No credited claims yet'
        : filter === 'REJECTED'
          ? 'No rejected claims yet'
          : 'No claims yet';

  const emptyHint =
    filter === 'OPEN'
      ? 'When a buyer reports missing / wrong / damaged items, they show up here with a suggested wallet credit.'
      : 'Closed claims (credited or rejected) appear in Credited / Rejected / All.';

  return (
    <HubShell title="Claims" subtitle={subtitle} onRefresh={() => void reload()}>
      <div style={styles.stack}>
        <div style={styles.filters} role="tablist" aria-label="Claim filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              style={filter === f.id ? styles.filterActive : styles.filter}
              onClick={() => {
                setFilter(f.id);
                setResolveId(null);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <Banner tone="danger" style={styles.banner}>
            {error}
          </Banner>
        ) : null}
        {notice ? (
          <Banner tone="success" style={styles.banner}>
            {notice}
          </Banner>
        ) : null}

        {loading ? (
          <p style={styles.muted}>Loading claims…</p>
        ) : claims.length === 0 ? (
          <Card padding="sm" style={styles.empty}>
            <p style={styles.emptyTitle}>{emptyTitle}</p>
            <p style={styles.muted}>{emptyHint}</p>
          </Card>
        ) : (
          claims.map((claim) => {
            const isOpen = claim.status === 'OPEN';
            const editing = resolveId === claim.claimId;
            const busy = busyId === claim.claimId;
            const suggested = Number(claim.suggestedCreditAmount ?? 0);
            const pill = statusPill(claim.status);
            return (
              <Card key={claim.claimId} padding="sm" style={styles.card}>
                <div style={styles.head}>
                  <div style={styles.headText}>
                    <p style={styles.orderNo}>{claim.orderNumber ?? claim.orderId}</p>
                    <p style={styles.meta}>
                      {claimTypeLabel(claim.claimType)}
                      {claim.itemName ? ` · ${claim.quantity ?? ''}× ${claim.itemName}` : ''}
                      {claim.shopName ? ` · ${claim.shopName}` : ''}
                    </p>
                  </div>
                  <span style={pill.style}>{pill.label}</span>
                </div>
                <p style={styles.reason}>{claim.reason}</p>

                {isOpen ? (
                  <>
                    <p style={styles.suggest}>
                      Suggested credit: <strong>{suggested > 0 ? money(suggested) : '—'}</strong>
                      <span style={styles.suggestHint}> · max = item line total</span>
                    </p>
                    <p style={styles.vendorNote}>
                      Crediting the buyer also deducts the same amount from this shop’s next vendor
                      payout.
                    </p>
                    {!editing ? (
                      <div style={styles.actions}>
                        <Button size="sm" disabled={busy} onClick={() => openResolve(claim, 'credit')}>
                          Credit wallet
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => openResolve(claim, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : mode === 'credit' ? (
                      <div style={styles.resolve}>
                        <TextField
                          label={`Credit amount (max ${money(suggested)})`}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          inputMode="decimal"
                        />
                        <TextField
                          label="Note to buyer (optional)"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Spoke with buyer — full line credited"
                        />
                        <div style={styles.actions}>
                          <Button size="sm" disabled={busy} onClick={() => void creditClaim(claim)}>
                            {busy ? '…' : `Credit ${amount ? money(Number(amount)) : ''}`}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setResolveId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.resolve}>
                        <label style={styles.label}>
                          Reject reason (shown to buyer)
                          <select
                            value={rejectPreset}
                            disabled={busy}
                            onChange={(e) => setRejectPreset(e.target.value)}
                            style={styles.select}
                          >
                            {REJECT_PRESETS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>
                        <TextField
                          label={
                            rejectPreset === 'Other'
                              ? 'Explain why (required)'
                              : 'Extra detail (optional)'
                          }
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Short note for the buyer"
                        />
                        <div style={styles.actions}>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void rejectClaim(claim)}
                          >
                            {busy ? '…' : 'Confirm reject'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setResolveId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={styles.historyBox}>
                    {claim.status === 'RESOLVED' ? (
                      <p style={styles.historyLine}>
                        Credited <strong>{money(claim.resolvedAmount)}</strong> to buyer wallet
                        {claim.resolvedAt ? ` · ${formatWhen(claim.resolvedAt)}` : ''}
                      </p>
                    ) : (
                      <p style={styles.historyLine}>
                        Rejected{claim.resolvedAt ? ` · ${formatWhen(claim.resolvedAt)}` : ''}
                      </p>
                    )}
                    {claim.status === 'RESOLVED' && claim.resolvedAmount != null ? (
                      <p style={styles.historyNote}>
                        Vendor payout −{money(claim.resolvedAmount)}
                        {claim.shopName ? ` (${claim.shopName})` : ''} — deducted on next settlement
                      </p>
                    ) : null}
                    {claim.resolutionNote ? (
                      <p style={styles.historyNote}>Hub note: {claim.resolutionNote}</p>
                    ) : null}
                    {claim.createdAt ? (
                      <p style={styles.meta}>Filed {formatWhen(claim.createdAt)}</p>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </HubShell>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.65rem', paddingBottom: '1rem', alignContent: 'start' },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  filter: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  filterActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 800,
  },
  banner: { padding: '0.55rem 0.75rem', fontSize: '0.88rem' },
  card: { display: 'grid', gap: '0.5rem' },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.65rem', alignItems: 'flex-start' },
  headText: { minWidth: 0, flex: 1 },
  orderNo: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '0.98rem' },
  meta: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.35 },
  reason: { margin: 0, fontSize: '0.92rem', lineHeight: 1.4, fontWeight: 700, color: 'var(--text)' },
  suggest: {
    margin: 0,
    padding: '0.45rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontSize: '0.84rem',
  },
  suggestHint: { fontWeight: 500, opacity: 0.85 },
  vendorNote: {
    margin: 0,
    fontSize: '0.8rem',
    lineHeight: 1.35,
    color: 'var(--text-muted)',
  },
  historyBox: {
    display: 'grid',
    gap: '0.25rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-muted, #f8fafc)',
    border: '1px solid var(--border)',
  },
  historyLine: { margin: 0, fontSize: '0.88rem', fontWeight: 700 },
  historyNote: { margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  pillBase: {
    flexShrink: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    borderRadius: '999px',
    padding: '0.2rem 0.5rem',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  resolve: { display: 'grid', gap: '0.55rem' },
  label: { display: 'grid', gap: '0.3rem', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' },
  select: {
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.9rem',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.4 },
  empty: { textAlign: 'left' },
  emptyTitle: { margin: '0 0 0.25rem', fontWeight: 800, fontSize: '0.98rem' },
};
