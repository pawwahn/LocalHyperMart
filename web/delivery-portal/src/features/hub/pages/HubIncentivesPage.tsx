import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { HubShell } from '../layout/HubShell';
import { fetchMyHub } from '../api/hubApi';
import {
  estimateTownPayout,
  getTownPayoutConfig,
  patchTownAgentRates,
  type PayoutPartyConfig,
  type TownPayoutConfig,
} from '../api/payoutApi';

function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

function onOff(v: boolean): string {
  return v ? 'On' : 'Off';
}

export function HubIncentivesPage() {
  const { session } = useAuth();
  const isMobile = useIsMobile();
  const [townId, setTownId] = useState<string | null>(null);
  const [hubName, setHubName] = useState('');
  const [cfg, setCfg] = useState<TownPayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMyHub(session.accessToken);
      const id = me.townId || session.townId;
      setHubName(me.hubName);
      if (!id) throw new Error('Town not found for this hub');
      setTownId(id);
      setCfg(await getTownPayoutConfig(session.accessToken, id));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load incentives');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchAgent(next: PayoutPartyConfig) {
    setCfg((prev) => (prev ? { ...prev, agent: next } : prev));
  }

  async function onSave() {
    if (!session || !townId || !cfg) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await patchTownAgentRates(session.accessToken, townId, cfg.agent);
      setCfg(saved);
      setNotice('Agent rates saved for this town.');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    if (!session || !townId || !cfg) return;
    setBusy(true);
    setError(null);
    try {
      if (cfg.canEditAgentRates) {
        await patchTownAgentRates(session.accessToken, townId, cfg.agent);
      }
      const result = await estimateTownPayout(session.accessToken, townId, {
        completedOrders: 40,
        pickups: 40,
        lastMiles: 40,
        qualifyingDays: 20,
      });
      setNotice(`If 40 orders / 20 days: agent ${money(result.agentTotal)} · hub ${money(result.hubTotal)}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Estimate failed');
    } finally {
      setBusy(false);
    }
  }

  const canEdit = Boolean(cfg?.canEditAgentRates);

  return (
    <HubShell title="Pay rates" subtitle={hubName || 'Town incentives'} onRefresh={() => void load()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {loading || !cfg ? (
        <p style={styles.muted}>Loading…</p>
      ) : (
        <div style={styles.stack}>
          {!canEdit ? (
            <p style={styles.lock}>
              Super admin has not allowed this hub to change agent ₹. You can view rates only.
            </p>
          ) : (
            <p style={styles.lock}>You can edit agent ₹. Hub share is set by super admin.</p>
          )}

          <div style={isMobile ? styles.gridMobile : styles.grid}>
            <Card>
              <h2 style={styles.h2}>Delivery agent {onOff(cfg.agent.enabled)}</h2>
              <RateRow
                label="Shop pickup"
                value={cfg.agent.perOrder.pickupAmount}
                disabled={!canEdit || !cfg.agent.perOrder.enabled}
                onChange={(n) =>
                  patchAgent({
                    ...cfg.agent,
                    perOrder: { ...cfg.agent.perOrder, pickupAmount: n },
                  })
                }
              />
              <RateRow
                label="Home delivery"
                value={cfg.agent.perOrder.lastMileAmount}
                disabled={!canEdit || !cfg.agent.perOrder.enabled}
                onChange={(n) =>
                  patchAgent({
                    ...cfg.agent,
                    perOrder: { ...cfg.agent.perOrder, lastMileAmount: n },
                  })
                }
              />
              <RateRow
                label="Full order"
                value={cfg.agent.perOrder.completedOrderAmount}
                disabled={!canEdit || !cfg.agent.perOrder.enabled}
                onChange={(n) =>
                  patchAgent({
                    ...cfg.agent,
                    perOrder: { ...cfg.agent.perOrder, completedOrderAmount: n },
                  })
                }
              />
              <RateRow
                label="Per day"
                extra={cfg.agent.perDay.enabled ? `min ${cfg.agent.perDay.minCompletedOrders} orders` : 'off'}
                value={cfg.agent.perDay.amount}
                disabled={!canEdit || !cfg.agent.perDay.enabled}
                onChange={(n) => patchAgent({ ...cfg.agent, perDay: { ...cfg.agent.perDay, amount: n } })}
              />
              <RateRow
                label="Per month"
                extra={cfg.agent.perMonth.enabled ? `min ${cfg.agent.perMonth.minCompletedOrders} orders` : 'off'}
                value={cfg.agent.perMonth.amount}
                disabled={!canEdit || !cfg.agent.perMonth.enabled}
                onChange={(n) => patchAgent({ ...cfg.agent, perMonth: { ...cfg.agent.perMonth, amount: n } })}
              />
              {cfg.agent.slabs.enabled ? (
                cfg.agent.slabs.tiers.map((tier, i) => (
                  <RateRow
                    key={i}
                    label={`Slab ${tier.minCount}–${tier.maxCount ?? '∞'}`}
                    extra={cfg.agent.slabs.payout === 'FLAT_BONUS' ? 'bonus' : 'each'}
                    value={tier.amount}
                    disabled={!canEdit}
                    onChange={(n) =>
                      patchAgent({
                        ...cfg.agent,
                        slabs: {
                          ...cfg.agent.slabs,
                          tiers: cfg.agent.slabs.tiers.map((t, idx) => (idx === i ? { ...t, amount: n } : t)),
                        },
                      })
                    }
                  />
                ))
              ) : (
                <p style={styles.muted}>Volume slab off</p>
              )}
            </Card>

            <Card>
              <h2 style={styles.h2}>Delivery hub {onOff(cfg.hub.enabled)}</h2>
              <p style={styles.muted}>Read only</p>
              <p style={styles.line}>Bag at hub {money(cfg.hub.perOrder.pickupAmount)}</p>
              <p style={styles.line}>Home delivery {money(cfg.hub.perOrder.lastMileAmount)}</p>
              <p style={styles.line}>Full order {money(cfg.hub.perOrder.completedOrderAmount)}</p>
              <p style={styles.line}>
                Day {cfg.hub.perDay.enabled ? money(cfg.hub.perDay.amount) : 'off'}
              </p>
              <p style={styles.line}>
                Month {cfg.hub.perMonth.enabled ? money(cfg.hub.perMonth.amount) : 'off'}
              </p>
              <p style={styles.line}>Slab {cfg.hub.slabs.enabled ? 'on' : 'off'}</p>
              <p style={styles.line}>
                Franchise{' '}
                {cfg.hub.franchise?.enabled
                  ? `${cfg.hub.franchise.cadence.toLowerCase()} ${money(cfg.hub.franchise.amount)} (hub pays platform)`
                  : 'off'}
              </p>
            </Card>
          </div>

          <div style={styles.actions}>
            {canEdit ? (
              <Button disabled={busy} onClick={() => void onSave()}>
                {busy ? 'Saving…' : 'Save agent ₹'}
              </Button>
            ) : null}
            <Button variant="ghost" disabled={busy} onClick={() => void onPreview()}>
              Estimate 40 orders
            </Button>
          </div>
        </div>
      )}
    </HubShell>
  );
}

function RateRow({
  label,
  extra,
  value,
  disabled,
  onChange,
}: {
  label: string;
  extra?: string;
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label style={styles.row}>
      <span>
        {label}
        {extra ? <span style={styles.extra}> · {extra}</span> : null}
      </span>
      <span style={styles.money}>
        <span>₹</span>
        <input
          style={styles.input}
          inputMode="decimal"
          disabled={disabled}
          value={Number.isFinite(value) ? String(value) : '0'}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </span>
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.55rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' },
  gridMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: '0.55rem' },
  h2: { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 800 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  lock: { margin: 0, fontSize: '0.85rem', fontWeight: 700 },
  line: { margin: '0.15rem 0', fontWeight: 700, fontSize: '0.88rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0.28rem 0',
    fontWeight: 700,
    fontSize: '0.85rem',
  },
  extra: { color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' },
  money: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0 0.4rem',
    minWidth: '6.5rem',
  },
  input: {
    border: 'none',
    background: 'transparent',
    width: '4.2rem',
    padding: '0.35rem 0',
    fontWeight: 800,
  },
  actions: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
};
