import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, SearchSelect, TextField } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  claimTypeLabel,
  formatWhen,
  listAdminClaims,
  money,
  resolveAdminClaim,
  shortOrderNo,
  type AdminClaim,
} from '../api/claimsApi';

type ClaimFilter = 'OPEN' | 'RESOLVED' | 'REJECTED' | 'ALL';

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

const PAGE_SIZE = 25;

function townLabel(t: TownVm): string {
  const place = t.displayName || t.townCode;
  const bits = [place, t.townCode && t.townCode !== place ? t.townCode : null].filter(Boolean);
  return bits.join(' · ');
}

function statusPill(status: string): { label: string; style: CSSProperties } {
  if (status === 'RESOLVED') {
    return {
      label: 'Credited',
      style: { ...styles.pillBase, color: '#047857', background: 'rgba(16, 185, 129, 0.14)' },
    };
  }
  if (status === 'REJECTED') {
    return {
      label: 'Rejected',
      style: { ...styles.pillBase, color: '#b91c1c', background: 'rgba(239, 68, 68, 0.12)' },
    };
  }
  return {
    label: 'Open',
    style: {
      ...styles.pillBase,
      color: '#92400e',
      background: 'color-mix(in srgb, var(--warning, #f59e0b) 22%, var(--bg-elevated))',
    },
  };
}

export function ClaimsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTownApplied = useRef(false);

  const [towns, setTowns] = useState<TownVm[]>([]);
  const townId = searchParams.get('townId') ?? '';
  const status = (searchParams.get('status') as ClaimFilter | null) ?? 'OPEN';
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);

  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [resolveId, setResolveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'credit' | 'reject'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [rejectPreset, setRejectPreset] = useState(REJECT_PRESETS[0]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const townOptions = useMemo(
    () =>
      towns.map((t) => ({
        value: t.id,
        label: townLabel(t),
        searchText: `${t.displayName} ${t.townCode} ${t.stateCode ?? ''}`,
      })),
    [towns],
  );

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listTowns(token);
        if (cancelled) return;
        setTowns(list);
        if (!defaultTownApplied.current && !searchParams.get('townId') && list.length > 0) {
          defaultTownApplied.current = true;
          patchParams({ townId: list[0].id, status: 'OPEN' });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, patchParams, searchParams]);

  const reload = useCallback(async () => {
    if (!token || !townId) {
      setClaims([]);
      setTotalPages(0);
      setTotalElements(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminClaims(token, townId, {
        status: status === 'ALL' ? undefined : status,
        page,
        size: PAGE_SIZE,
      });
      setClaims(data.items ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      setClaims([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [token, townId, status, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  function openResolve(claim: AdminClaim, nextMode: 'credit' | 'reject') {
    setResolveId(claim.claimId);
    setMode(nextMode);
    setError(null);
    setNotice(null);
    const suggested = Number(claim.suggestedCreditAmount ?? 0);
    setAmount(suggested > 0 ? suggested.toFixed(2) : '');
    setNote('');
    setRejectPreset(REJECT_PRESETS[0]);
  }

  async function creditClaim(claim: AdminClaim) {
    if (!token || !townId) return;
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
    try {
      await resolveAdminClaim(token, townId, claim.claimId, {
        resolution: 'WALLET_CREDIT',
        amount: value,
        note: note.trim() || undefined,
      });
      setResolveId(null);
      setNotice(`Credited ${money(value)} · ${claim.itemName ?? shortOrderNo(claim.orderNumber)}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not credit');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectClaim(claim: AdminClaim) {
    if (!token || !townId) return;
    const detail = note.trim();
    const reason =
      rejectPreset === 'Other'
        ? detail
        : detail
          ? `${rejectPreset} — ${detail}`
          : rejectPreset;
    if (!reason) {
      setError('Choose or type a reject reason');
      return;
    }
    setBusyId(claim.claimId);
    setError(null);
    try {
      await resolveAdminClaim(token, townId, claim.claimId, {
        resolution: 'NONE',
        note: reason,
      });
      setResolveId(null);
      setNotice(`Rejected · ${claim.itemName ?? shortOrderNo(claim.orderNumber)}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not reject');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalShell title="Claims" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.toolbar}>
        <div style={styles.townWrap}>
          <SearchSelect
            label="Town"
            value={townId}
            options={townOptions}
            onChange={(id) => {
              setResolveId(null);
              patchParams({ townId: id || null, page: null });
            }}
            placeholder="Select town…"
            emptyMessage="No towns"
          />
        </div>
      </div>

      <div style={styles.statusRow} role="tablist" aria-label="Claim status">
        {FILTERS.map((f) => {
          const active = status === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              style={active ? styles.statusActive : styles.statusBtn}
              onClick={() => {
                setResolveId(null);
                patchParams({ status: f.id, page: null });
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <p style={styles.meta}>
        {townId
          ? loading
            ? 'Loading…'
            : `${totalElements} claim${totalElements === 1 ? '' : 's'}`
          : 'Pick a town'}
      </p>

      {!townId ? null : loading && claims.length === 0 ? (
        <p style={styles.empty}>Loading claims…</p>
      ) : claims.length === 0 ? (
        <p style={styles.empty}>
          {status === 'OPEN'
            ? 'No open claims. Buyer missing / wrong / damaged reports show up here.'
            : 'No claims match this filter.'}
        </p>
      ) : (
        <div style={styles.stack}>
          {claims.map((claim) => {
            const open = claim.status === 'OPEN';
            const editing = resolveId === claim.claimId;
            const busy = busyId === claim.claimId;
            const suggested = Number(claim.suggestedCreditAmount ?? 0);
            const pill = statusPill(claim.status);
            return (
              <div key={claim.claimId} style={styles.card}>
                <div style={styles.head}>
                  <div>
                    <Link
                      to={`/orders/${claim.orderId}?townId=${encodeURIComponent(townId)}`}
                      style={styles.orderLink}
                      title={claim.orderNumber ?? undefined}
                    >
                      {shortOrderNo(claim.orderNumber)}
                    </Link>
                    <p style={styles.sub}>
                      {claimTypeLabel(claim.claimType)}
                      {claim.itemName
                        ? ` · ${claim.quantity ?? ''}× ${claim.itemName}${claim.unitCode ? ` (${claim.unitCode})` : ''}`
                        : ''}
                      {claim.shopName ? ` · ${claim.shopName}` : ''}
                    </p>
                  </div>
                  <span style={pill.style}>{pill.label}</span>
                </div>

                <p style={styles.reason}>{claim.reason}</p>
                <p style={styles.when}>Filed {formatWhen(claim.createdAt)}</p>

                {open ? (
                  <>
                    <p style={styles.suggest}>
                      Suggested credit (item total): <strong>{money(suggested)}</strong>
                    </p>
                    {!editing ? (
                      <div style={styles.actions}>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openResolve(claim, 'credit')}
                          disabled={busy}
                        >
                          Credit wallet
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openResolve(claim, 'reject')}
                          disabled={busy}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : mode === 'credit' ? (
                      <div style={styles.resolveBox}>
                        <p style={styles.resolveTitle}>Credit buyer wallet</p>
                        <TextField
                          label="Amount (₹)"
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                        <TextField
                          label="Note (optional)"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Shown in ops history"
                        />
                        <div style={styles.actions}>
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void creditClaim(claim)}
                          >
                            {busy ? 'Crediting…' : `Credit ${amount ? money(Number(amount)) : ''}`}
                          </Button>
                          <Button
                            type="button"
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
                      <div style={styles.resolveBox}>
                        <p style={styles.resolveTitle}>Reject claim</p>
                        <label style={styles.selectLabel}>
                          Reason
                          <select
                            style={styles.select}
                            value={rejectPreset}
                            onChange={(e) => setRejectPreset(e.target.value)}
                          >
                            {REJECT_PRESETS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>
                        <TextField
                          label={rejectPreset === 'Other' ? 'Details (required)' : 'Extra note (optional)'}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <div style={styles.actions}>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void rejectClaim(claim)}
                          >
                            {busy ? 'Rejecting…' : 'Reject'}
                          </Button>
                          <Button
                            type="button"
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
                  <p style={styles.closed}>
                    {claim.status === 'RESOLVED'
                      ? `Credited ${money(Number(claim.resolvedAmount ?? 0))}`
                      : 'Rejected'}
                    {claim.resolvedAt ? ` · ${formatWhen(claim.resolvedAt)}` : ''}
                    {claim.resolutionNote ? ` · ${claim.resolutionNote}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div style={styles.pager}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 0 || loading}
            onClick={() => patchParams({ page: String(page - 1) })}
          >
            Prev
          </Button>
          <span style={styles.pageLabel}>
            Page {page + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => patchParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbar: { marginBottom: '0.65rem' },
  townWrap: { minWidth: '14rem', maxWidth: '22rem' },
  statusRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.55rem' },
  statusBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  statusActive: {
    border: '1px solid color-mix(in srgb, var(--accent) 55%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 16%, var(--bg-elevated))',
    color: 'var(--text)',
    borderRadius: 'var(--radius-full)',
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  meta: { margin: '0 0 0.55rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  empty: { margin: '1rem 0', color: 'var(--text-muted)' },
  stack: { display: 'grid', gap: '0.55rem' },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    padding: '0.75rem 0.85rem',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    alignItems: 'flex-start',
  },
  orderLink: {
    color: 'var(--accent)',
    fontWeight: 800,
    textDecoration: 'none',
    fontSize: '0.95rem',
  },
  sub: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  reason: { margin: '0.45rem 0 0.2rem', fontSize: '0.88rem', lineHeight: 1.4 },
  when: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' },
  suggest: { margin: '0.45rem 0', fontSize: '0.84rem' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' },
  resolveBox: {
    marginTop: '0.45rem',
    padding: '0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--bg) 70%, var(--bg-elevated))',
    display: 'grid',
    gap: '0.45rem',
  },
  resolveTitle: { margin: 0, fontWeight: 800, fontSize: '0.86rem' },
  selectLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  closed: { margin: '0.45rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 },
  pillBase: {
    display: 'inline-block',
    padding: '0.12rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.72rem',
    fontWeight: 800,
    flexShrink: 0,
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  pageLabel: { color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
};
