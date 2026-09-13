import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Banner, Button } from '@/shared/ui';
import { ApiError } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import {
  fetchMembershipCatalog,
  purchaseMembership,
  type MembershipCatalog,
  type MembershipSlabOffer,
} from '../api/membershipApi';

function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(0)}`;
}

function until(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function perDrop(slab: MembershipSlabOffer): string {
  if (!slab.credits) return '';
  return `₹${Math.max(1, Math.round(slab.price / slab.credits))}/drop`;
}

function bestValueCode(slabs: MembershipSlabOffer[]): string | null {
  const priced = slabs.filter((s) => s.purchasable && s.credits > 0 && s.price > 0);
  if (priced.length === 0) return null;
  return [...priced].sort((a, b) => a.price / a.credits - b.price / b.credits)[0]?.code ?? null;
}

type Props = {
  onBought?: () => void;
};

export function MembershipPlansPanel({ onBought }: Props) {
  const { session } = useAuth();
  const { townId } = useTown();
  const token = session?.accessToken ?? '';
  const [catalog, setCatalog] = useState<MembershipCatalog | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'ONLINE' | 'CASH' | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const next = await fetchMembershipCatalog(token, townId || undefined);
      setCatalog(next);
      setSelected((prev) => {
        if (prev && next.slabs.some((s) => s.code === prev)) return prev;
        const best = bestValueCode(next.slabs);
        return best ?? next.slabs.find((s) => s.purchasable)?.code ?? next.slabs[0]?.code ?? '';
      });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load plans');
    }
  }, [token, townId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const slabs = catalog?.slabs ?? [];
  const pick = useMemo(() => slabs.find((s) => s.code === selected) ?? null, [slabs, selected]);
  const best = useMemo(() => bestValueCode(slabs), [slabs]);
  const canBuy = Boolean(catalog?.canPurchase && pick?.purchasable);

  async function buy(channel: 'ONLINE' | 'CASH') {
    if (!townId) {
      setError('Select a town first');
      return;
    }
    if (!pick) return;
    setBusy(channel);
    setError(null);
    setNotice(null);
    try {
      const row = await purchaseMembership(token, { slab: pick.code, channel, townId });
      if (row.status === 'PENDING_CASH') {
        setNotice(`Pay ${money(row.price)} cash at the hub. Show your phone.`);
      } else {
        setNotice(`${row.creditsGranted} free deliveries added.`);
      }
      await reload();
      onBought?.();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBusy(null);
    }
  }

  const mine = catalog?.mine;

  return (
    <div style={styles.wrap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {mine?.active ? (
        <div style={styles.status}>
          <span style={styles.statusKicker}>Your plan</span>
          <strong>
            {mine.usableCredits} deliveries left
          </strong>
          <span style={styles.muted}>Till {until(mine.expiresAt)} · buy again to add more</span>
        </div>
      ) : mine?.pendingCashPurchaseId ? (
        <Banner tone="warning">Cash request is waiting at the hub.</Banner>
      ) : null}

      {catalog?.blockReason ? <p style={styles.block}>{catalog.blockReason}</p> : null}

      <div style={styles.list} role="radiogroup" aria-label="Choose a plan">
        {slabs.map((slab) => {
          const on = slab.code === selected;
          const highlight = slab.code === best;
          return (
            <button
              key={slab.code}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!slab.purchasable}
              onClick={() => setSelected(slab.code)}
              style={{
                ...styles.plan,
                ...(on ? styles.planOn : null),
                ...(slab.purchasable ? null : styles.planOff),
              }}
            >
              <span style={on ? styles.radioOn : styles.radio} aria-hidden>
                {on ? <span style={styles.radioDot} /> : null}
              </span>
              <span style={styles.planCopy}>
                <span style={styles.planTitleRow}>
                  <strong style={styles.planTitle}>{slab.label}</strong>
                  {highlight ? <span style={styles.badge}>Best value</span> : null}
                </span>
                <span style={styles.planMeta}>
                  {slab.credits} deliveries · {perDrop(slab)}
                </span>
              </span>
              <strong style={styles.planPrice}>{money(slab.price)}</strong>
            </button>
          );
        })}
      </div>

      <div style={styles.pay}>
        <Button
          size="lg"
          fullWidth
          disabled={!canBuy || Boolean(busy)}
          onClick={() => void buy('ONLINE')}
        >
          {busy === 'ONLINE' ? 'Paying…' : pick ? `Pay ${money(pick.price)} online` : 'Pay online'}
        </Button>
        <button
          type="button"
          style={styles.cash}
          disabled={!canBuy || Boolean(busy)}
          onClick={() => void buy('CASH')}
        >
          {busy === 'CASH' ? 'Saving…' : 'I’ll pay cash at the hub'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  status: {
    display: 'grid',
    gap: '0.08rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 12,
    background: '#E7F6EC',
    border: '1px solid #B7E4C4',
  },
  statusKicker: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#0C831F',
  },
  muted: { fontSize: '0.74rem', color: '#6B7280' },
  block: { margin: 0, fontSize: '0.78rem', color: '#6B7280', fontWeight: 600 },
  list: { display: 'grid', gap: '0.4rem' },
  plan: {
    display: 'grid',
    gridTemplateColumns: '22px 1fr auto',
    alignItems: 'center',
    gap: '0.55rem',
    width: '100%',
    padding: '0.7rem 0.75rem',
    minHeight: 64,
    borderRadius: 14,
    border: '1.5px solid #E4E7EA',
    background: '#fff',
    color: '#1A1C1A',
    textAlign: 'left',
    cursor: 'pointer',
  },
  planOn: {
    border: '1.5px solid #0C831F',
    background: '#F3FBF5',
    boxShadow: '0 0 0 3px rgba(12, 131, 31, 0.12)',
  },
  planOff: { opacity: 0.45, cursor: 'not-allowed' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: '2px solid #C5CBD1',
    background: '#fff',
    flexShrink: 0,
  },
  radioOn: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: '2px solid #0C831F',
    background: '#fff',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  radioDot: { width: 10, height: 10, borderRadius: 999, background: '#0C831F' },
  planCopy: { display: 'grid', gap: '0.12rem', minWidth: 0 },
  planTitleRow: { display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' },
  planTitle: { fontSize: '0.95rem', fontWeight: 800 },
  badge: {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    background: '#F7CE46',
    color: '#1A1C1A',
    borderRadius: 999,
    padding: '0.12rem 0.4rem',
  },
  planMeta: { fontSize: '0.74rem', color: '#6B7280', fontWeight: 600 },
  planPrice: { fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em' },
  pay: { display: 'grid', gap: '0.35rem', paddingTop: '0.15rem' },
  cash: {
    border: 'none',
    background: 'none',
    color: '#0C831F',
    fontWeight: 800,
    fontSize: '0.86rem',
    minHeight: 44,
    cursor: 'pointer',
  },
};
