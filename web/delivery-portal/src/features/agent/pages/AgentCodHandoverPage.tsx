import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ConfirmCodHandoverDialog } from '../components/ConfirmCodHandoverDialog';
import { AgentShell } from '../layout/AgentShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import {
  declareCodHandover,
  fetchAgentCodHandoverSummary,
  type CodHandoverSummary,
} from '../api/codHandoverApi';

type PendingOrder = CodHandoverSummary['orders'][number];

function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

/** IST calendar day for grouping (YYYY-MM-DD). */
function deliveredIstDateKey(iso?: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatDayHeading(dateKey: string): string {
  if (dateKey === 'unknown') return 'Delivery date unknown';
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function custodianLabel(type?: string | null): string {
  return type === 'VENDOR' ? 'Shop' : 'Hub';
}

export function AgentCodHandoverPage() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<CodHandoverSummary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentCodHandoverSummary(session.accessToken);
      setSummary(data);
      setSelected(new Set(data.orders.map((o) => o.orderId)));
    } catch (err) {
      setSummary(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD handover');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingOrders = summary?.orders ?? [];

  const ordersByDay = useMemo(() => {
    const map = new Map<string, PendingOrder[]>();
    for (const o of pendingOrders) {
      const key = deliveredIstDateKey(o.deliveredAt);
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pendingOrders]);

  const selectedTotal = useMemo(() => {
    if (!summary) return 0;
    return summary.orders
      .filter((o) => selected.has(o.orderId))
      .reduce((s, o) => s + Number(o.collectAmount ?? 0), 0);
  }, [summary, selected]);

  async function onDeclare() {
    if (!session) return;
    const orderIds = [...selected];
    if (orderIds.length === 0) {
      setError('Select at least one COD order to hand over');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await declareCodHandover(session.accessToken, { handoverDate: todayIst(), orderIds });
      setConfirmOpen(false);
      setNotice(`Declared handover of ${money(selectedTotal)} — wait for hub or shop to confirm receipt.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Declare failed');
    } finally {
      setBusy(false);
    }
  }

  const hubTotal = Number(summary?.pendingHubTotal ?? 0);
  const vendorTotal = Number(summary?.pendingVendorTotal ?? 0);

  return (
    <AgentShell
      title="Hand over COD"
      subtitle="Total cash to remit, then orders grouped by delivery day (IST)"
      onRefresh={() => void reload()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.summaryBlock}>
        <p style={styles.summaryEyebrow}>Total COD to hand over</p>
        <p style={styles.summaryTotal}>{loading ? '…' : money(summary?.pendingCollectTotal ?? 0)}</p>
        <p style={styles.summaryMeta}>
          {loading ? '' : `${summary?.pendingOrderCount ?? 0} order(s) · undeclared cash still with you`}
        </p>
        {!loading && pendingOrders.length > 0 ? (
          <div style={styles.splitRow}>
            <span style={styles.splitChip}>
              To hub <strong>{money(hubTotal)}</strong>
            </span>
            <span style={styles.splitChip}>
              To shop <strong>{money(vendorTotal)}</strong>
            </span>
          </div>
        ) : null}
      </Card>

      {loading ? (
        <Card style={styles.card}>
          <p style={styles.muted}>Loading orders…</p>
        </Card>
      ) : pendingOrders.length === 0 ? (
        <Card style={styles.card}>
          <p style={styles.muted}>Nothing pending — all declared or no COD deliveries yet.</p>
        </Card>
      ) : (
        ordersByDay.map(([dateKey, dayOrders]) => {
          const dayTotal = dayOrders.reduce((s, o) => s + Number(o.collectAmount ?? 0), 0);
          return (
            <Card key={dateKey} style={styles.dayCard}>
              <div style={styles.dayHead}>
                <p style={styles.dayTitle}>{formatDayHeading(dateKey)}</p>
                <p style={styles.dayTotal}>
                  {money(dayTotal)} · {dayOrders.length} order{dayOrders.length === 1 ? '' : 's'}
                </p>
              </div>
              <ul style={styles.list}>
                {dayOrders.map((o) => (
                  <li key={o.orderId} style={styles.row}>
                    <label style={styles.check}>
                      <input
                        type="checkbox"
                        checked={selected.has(o.orderId)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(o.orderId)) next.delete(o.orderId);
                            else next.add(o.orderId);
                            return next;
                          });
                        }}
                      />
                      <span>
                        <strong>{o.orderNumber}</strong>
                        <span style={styles.muted}> · {money(o.collectAmount)}</span>
                        <span style={styles.custodianTag}> · {custodianLabel(o.custodianType)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}

      {pendingOrders.length > 0 ? (
        <Card style={styles.card}>
          <p style={styles.selectedTotal}>Selected for this handover: {money(selectedTotal)}</p>
          <Button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => {
              if (selected.size === 0) {
                setError('Select at least one COD order to hand over');
                return;
              }
              setConfirmOpen(true);
            }}
          >
            I handed over this cash
          </Button>
        </Card>
      ) : null}

      <ConfirmCodHandoverDialog
        open={confirmOpen}
        amountLabel={money(selectedTotal)}
        orderCount={selected.size}
        handoverDate={todayIst()}
        busy={busy}
        onClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={() => void onDeclare()}
      />

      {summary && summary.handovers.length > 0 ? (
        <Card style={styles.card}>
          <p style={styles.sectionTitle}>Recent declarations</p>
          <ul style={styles.list}>
            {summary.handovers.map((h) => (
              <li key={h.handoverId} style={styles.declRow}>
                <strong>{money(h.declaredAmount)}</strong>
                <span style={styles.muted}>
                  {h.status} · {h.custodianType === 'VENDOR' ? 'to shop' : 'to hub'} · {h.lines.length} order(s) ·{' '}
                  {h.handoverDate}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </AgentShell>
  );
}

const styles: Record<string, CSSProperties> = {
  summaryBlock: {
    padding: '0.85rem 0.95rem',
    background: 'var(--warning-soft, #fffbeb)',
    border: '1.5px solid #fbbf24',
    display: 'grid',
    gap: '0.35rem',
  },
  summaryEyebrow: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#92400e' },
  summaryTotal: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 900,
    color: '#92400e',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
  },
  summaryMeta: { margin: 0, fontSize: '0.75rem', fontWeight: 650, color: '#b45309' },
  splitRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.15rem' },
  splitChip: {
    fontSize: '0.78rem',
    fontWeight: 650,
    color: '#78350f',
    background: 'rgba(255,255,255,0.55)',
    borderRadius: 8,
    padding: '0.25rem 0.45rem',
  },
  dayCard: { padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' },
  dayHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.35rem',
    paddingBottom: '0.35rem',
    borderBottom: '1px solid var(--border)',
  },
  dayTitle: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  dayTotal: { margin: 0, fontWeight: 750, fontSize: '0.8rem', color: 'var(--text-muted)' },
  card: { padding: '0.65rem 0.75rem', display: 'grid', gap: '0.5rem' },
  sectionTitle: { margin: 0, fontWeight: 800, fontSize: '0.92rem' },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  row: { borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' },
  check: { display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.85rem' },
  muted: { color: 'var(--text-muted)', fontWeight: 650 },
  custodianTag: { color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' },
  selectedTotal: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  declRow: { display: 'grid', gap: '0.1rem', fontSize: '0.85rem' },
};
