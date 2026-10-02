import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/shared/api/http';
import { Banner, Button } from '@/shared/ui';
import { AdminHistoryPanel, LastChangeStrip } from '@/shared/audit/AdminHistoryPanel';
import {
  getTownPayoutConfig,
  saveTownPayoutConfig,
  type PayoutPartyConfig,
  type PerOrderIncentive,
  type TownPayoutConfig,
  type FranchiseTerms,
} from '../api/payoutApi';
import type { TownVm } from '../api/townsApi';

type Props = {
  town: TownVm;
  token: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Render inside Town Settings (no modal shell). */
  embedded?: boolean;
  onOpenChangeLog?: () => void;
};

type HubPlan = 'NONE' | 'FRANCHISE' | 'PER_ORDER' | 'BOTH';

function money(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function cadenceWord(c: string): string {
  switch (c) {
    case 'QUARTERLY':
      return 'every 3 months';
    case 'YEARLY':
      return 'once a year';
    case 'LIFETIME':
      return 'once forever';
    default:
      return 'every month';
  }
}

function hubPlanOf(party: PayoutPartyConfig): HubPlan {
  const fee = Boolean(party.franchise?.enabled);
  const perOrder = party.enabled && party.perOrder.enabled;
  if (fee && perOrder) return 'BOTH';
  if (fee) return 'FRANCHISE';
  if (perOrder) return 'PER_ORDER';
  return 'NONE';
}

function offRetainers(party: PayoutPartyConfig): PayoutPartyConfig {
  return {
    ...party,
    perDay: { ...party.perDay, enabled: false },
    perMonth: { ...party.perMonth, enabled: false },
    slabs: { ...party.slabs, enabled: false },
  };
}

function applyHubPlan(party: PayoutPartyConfig, plan: HubPlan): PayoutPartyConfig {
  const franchiseOn = plan === 'FRANCHISE' || plan === 'BOTH';
  const perOrderOn = plan === 'PER_ORDER' || plan === 'BOTH';
  return offRetainers({
    ...party,
    enabled: plan !== 'NONE',
    franchise: { ...(party.franchise ?? { cadence: 'MONTHLY', amount: 0, enabled: false }), enabled: franchiseOn },
    perOrder: { ...party.perOrder, enabled: perOrderOn },
  });
}

function perOrderUnit(p: PerOrderIncentive): number {
  if (!p.enabled) return 0;
  return Math.max(0, p.completedOrderAmount) + Math.max(0, p.pickupAmount) + Math.max(0, p.lastMileAmount);
}

export function TownIncentiveDialog({ town, token, onClose, onSaved, embedded, onOpenChangeLog }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<TownPayoutConfig | null>(null);
  const [previewOrders, setPreviewOrders] = useState('40');
  const [historyTick, setHistoryTick] = useState(0);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<'edit' | 'log'>('edit');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTownPayoutConfig(token, town.id)
      .then((data) => {
        if (!cancelled) setCfg(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load pay rules');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, town.id]);

  useEffect(() => {
    if (embedded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose, embedded]);

  const n = Math.max(0, Number(previewOrders) || 0);
  const math = useMemo(() => {
    if (!cfg) return null;
    const hubUnit = cfg.hub.enabled && cfg.hub.perOrder.enabled ? perOrderUnit(cfg.hub.perOrder) : 0;
    const agentUnit = cfg.agent.enabled && cfg.agent.perOrder.enabled ? perOrderUnit(cfg.agent.perOrder) : 0;
    const rent = cfg.hub.franchise?.enabled ? Math.max(0, cfg.hub.franchise.amount) : 0;
    return {
      rent,
      cadence: cfg.hub.franchise?.cadence ?? 'MONTHLY',
      hubUnit,
      agentUnit,
      hubPay: n * hubUnit,
      agentPay: n * agentUnit,
    };
  }, [cfg, n]);

  function patch(side: 'agent' | 'hub', next: PayoutPartyConfig) {
    setCfg((prev) => (prev ? { ...prev, [side]: offRetainers(next) } : prev));
  }

  async function onSave() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      await saveTownPayoutConfig(token, town.id, {
        ...cfg,
        hub: offRetainers(cfg.hub),
        agent: offRetainers(cfg.agent),
      });
      setSavedNotice('Saved and logged.');
      setHistoryTick((n) => n + 1);
      setPanel('log');
      onSaved(`Pay rules saved for ${town.displayName}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const inner = (
      <div
        role={embedded ? undefined : 'dialog'}
        aria-modal={embedded ? undefined : true}
        aria-labelledby="town-pay-title"
        style={embedded ? styles.embedded : styles.dialog}
        onMouseDown={embedded ? undefined : (e) => e.stopPropagation()}
      >
        <style>{`
          @media (max-width: 640px) {
            .pay-row3, .pay-math-grid { grid-template-columns: 1fr 1fr !important; }
          }
        `}</style>
        {!embedded ? (
          <div style={styles.head}>
            <div>
              <h2 id="town-pay-title" style={styles.title}>
                Hub & agent pay · {town.displayName}
              </h2>
              <p style={styles.sub}>Rules only. Cash is marked on Payouts → Hub / Agent.</p>
            </div>
            <div style={styles.headRight}>
              <div style={styles.viewTabs}>
                <button
                  type="button"
                  style={panel === 'edit' ? styles.viewTabActive : styles.viewTab}
                  onClick={() => setPanel('edit')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  style={panel === 'log' ? styles.viewTabActive : styles.viewTab}
                  onClick={() => setPanel('log')}
                >
                  Change log
                </button>
              </div>
              <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <p style={styles.subEmbed}>Rules only. Cash is marked on Payouts → Hub / Agent.</p>
        )}

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {savedNotice ? <Banner tone="success">{savedNotice}</Banner> : null}
        {(panel === 'edit' || embedded) && token ? (
          <div style={{ padding: embedded ? 0 : '0 0.85rem' }}>
            <LastChangeStrip
              token={token}
              screen="town-incentives"
              townId={town.id}
              refreshTick={historyTick}
              onSeeAll={() => (embedded ? onOpenChangeLog?.() : setPanel('log'))}
            />
          </div>
        ) : null}

        {panel === 'edit' || embedded ? (
        <>
        <div style={styles.body}>
          {loading || !cfg ? (
            <p style={styles.muted}>Loading…</p>
          ) : (
            <>
              <HubCard party={cfg.hub} onChange={(next) => patch('hub', next)} />
              <AgentCard
                party={cfg.agent}
                townAdminCanEdit={cfg.townAdminCanEditAgentRates}
                onChange={(next) => patch('agent', next)}
                onToggleTownAdmin={() =>
                  setCfg((prev) =>
                    prev ? { ...prev, townAdminCanEditAgentRates: !prev.townAdminCanEditAgentRates } : prev,
                  )
                }
              />

              <section style={styles.math}>
                <div style={styles.mathHead}>
                  <strong style={styles.blockTitle}>If {n} orders are delivered</strong>
                  <label style={styles.ordersLabel}>
                    Orders
                    <input
                      style={styles.ordersInput}
                      inputMode="numeric"
                      value={previewOrders}
                      onChange={(e) => setPreviewOrders(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    />
                  </label>
                </div>
                {math ? (
                  <div className="pay-math-grid" style={styles.mathGrid}>
                    <div>
                      <span style={styles.mathLabel}>Hub pays us</span>
                      <strong style={styles.mathValue}>
                        {math.rent > 0 ? `${money(math.rent)} ${cadenceWord(math.cadence)}` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span style={styles.mathLabel}>We pay hub</span>
                      <strong style={styles.mathValue}>
                        {math.hubUnit > 0 ? `${n} × ${money(math.hubUnit)} = ${money(math.hubPay)}` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span style={styles.mathLabel}>We pay agents</span>
                      <strong style={styles.mathValue}>
                        {math.agentUnit > 0 ? `${n} × ${money(math.agentUnit)} = ${money(math.agentPay)}` : '—'}
                      </strong>
                    </div>
                  </div>
                ) : null}
                <p style={styles.hint}>
                  Cancelled / not delivered = ₹0. Same order is never paid twice to the same hub or agent.
                </p>
              </section>
            </>
          )}
        </div>

        <div style={styles.footer}>
          {!embedded ? (
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Close
            </Button>
          ) : null}
          <Button disabled={busy || !cfg} onClick={() => void onSave()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
        </>
        ) : !embedded && token ? (
          <div style={{ padding: '0 0.85rem 0.75rem', minHeight: 0, display: 'grid' }}>
            <AdminHistoryPanel
              token={token}
              screen="town-incentives"
              townId={town.id}
              title="Change log"
              embedded
              tall
              refreshTick={historyTick}
            />
          </div>
        ) : null}
      </div>
  );

  if (embedded) return inner;

  return createPortal(
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      {inner}
    </div>,
    document.body,
  );
}

function HubCard({
  party,
  onChange,
}: {
  party: PayoutPartyConfig;
  onChange: (next: PayoutPartyConfig) => void;
}) {
  const plan = hubPlanOf(party);
  const fee = party.franchise ?? { enabled: false, cadence: 'MONTHLY' as const, amount: 0 };
  const showFee = plan === 'FRANCHISE' || plan === 'BOTH';
  const showPerOrder = plan === 'PER_ORDER' || plan === 'BOTH';

  return (
    <section style={styles.card}>
      <h3 style={styles.sectionTitle}>Hub</h3>
      <PillRow
        value={plan}
        options={[
          { id: 'NONE', label: 'Off' },
          { id: 'FRANCHISE', label: 'Hub pays us' },
          { id: 'PER_ORDER', label: 'We pay per order' },
          { id: 'BOTH', label: 'Both' },
        ]}
        onChange={(id) => onChange(applyHubPlan(party, id as HubPlan))}
      />

      {showFee ? (
        <div className="pay-row3" style={styles.row3}>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={styles.miniLabel}>How often hub pays us</span>
            <PillRow
              value={fee.cadence}
              options={[
                { id: 'MONTHLY', label: 'Month' },
                { id: 'QUARTERLY', label: '3 months' },
                { id: 'YEARLY', label: 'Year' },
                { id: 'LIFETIME', label: 'Once' },
              ]}
              onChange={(cadence) =>
                onChange({
                  ...party,
                  franchise: { ...fee, enabled: true, cadence: cadence as FranchiseTerms['cadence'] },
                })
              }
            />
          </div>
          <Money
            label="Hub pays ₹"
            value={fee.amount}
            onChange={(n) => onChange({ ...party, franchise: { ...fee, enabled: true, amount: n } })}
          />
        </div>
      ) : null}

      {showPerOrder ? (
        <PerOrderRow
          value={party.perOrder}
          onChange={(perOrder) => onChange({ ...party, enabled: true, perOrder: { ...perOrder, enabled: true } })}
        />
      ) : null}
    </section>
  );
}

function AgentCard({
  party,
  townAdminCanEdit,
  onChange,
  onToggleTownAdmin,
}: {
  party: PayoutPartyConfig;
  townAdminCanEdit: boolean;
  onChange: (next: PayoutPartyConfig) => void;
  onToggleTownAdmin: () => void;
}) {
  const on = party.enabled && party.perOrder.enabled;
  return (
    <section style={styles.card}>
      <div style={styles.switchRow}>
        <h3 style={styles.sectionTitle}>Agent</h3>
        <OnOff
          on={on}
          onClick={() =>
            onChange({
              ...party,
              enabled: !on,
              perOrder: { ...party.perOrder, enabled: !on },
            })
          }
        />
      </div>
      {on ? (
        <PerOrderRow
          value={party.perOrder}
          onChange={(perOrder) => onChange({ ...party, enabled: true, perOrder: { ...perOrder, enabled: true } })}
        />
      ) : (
        <p style={styles.hint}>Off — agents get ₹0 from Payouts.</p>
      )}
      <div style={styles.switchRow}>
        <span style={styles.hint}>Hub can edit agent ₹ only</span>
        <OnOff on={townAdminCanEdit} onClick={onToggleTownAdmin} />
      </div>
    </section>
  );
}

function PerOrderRow({
  value,
  onChange,
}: {
  value: PerOrderIncentive;
  onChange: (v: PerOrderIncentive) => void;
}) {
  return (
    <div className="pay-row3" style={styles.row3}>
      <Money
        label="To customer"
        value={value.completedOrderAmount}
        onChange={(n) => onChange({ ...value, completedOrderAmount: n })}
      />
      <Money
        label="Vendor → hub"
        value={value.pickupAmount}
        onChange={(n) => onChange({ ...value, pickupAmount: n })}
      />
      <Money
        label="Return → shop"
        value={value.lastMileAmount}
        onChange={(n) => onChange({ ...value, lastMileAmount: n })}
      />
    </div>
  );
}

function OnOff({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} style={on ? styles.switchOn : styles.switchOff} onClick={onClick}>
      <span style={on ? styles.knobOn : styles.knobOff} />
    </button>
  );
}

function Money({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label style={styles.moneyLabel}>
      <span style={styles.miniLabel}>{label}</span>
      <span style={styles.dealField}>
        <span style={styles.dealPrefix}>₹</span>
        <input
          style={styles.dealInput}
          inputMode="decimal"
          value={Number.isFinite(value) ? String(value) : '0'}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </span>
    </label>
  );
}

function PillRow({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div style={styles.modeRow}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          style={value === opt.id ? styles.modeActive : styles.modeBtn}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
    background: 'rgba(15, 23, 20, 0.5)',
  },
  dialog: {
    width: 'min(36rem, 100%)',
    maxHeight: 'min(90dvh, 44rem)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-elevated, 0 18px 50px rgba(0,0,0,0.18))',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  embedded: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    gap: '0.5rem',
  },
  subEmbed: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  headRight: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.75rem',
    padding: '0.26rem 0.55rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.75rem',
    padding: '0.26rem 0.55rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    alignItems: 'flex-start',
    padding: '0.75rem 0.85rem 0.45rem',
    flexShrink: 0,
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' },
  sub: { margin: '0.12rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  close: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 36,
    height: 36,
    cursor: 'pointer',
    fontWeight: 800,
    flexShrink: 0,
  },
  body: {
    padding: '0 0.85rem 0.65rem',
    display: 'grid',
    gap: '0.5rem',
    overflow: 'auto',
    minHeight: 0,
    flex: 1,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.45rem',
    padding: '0.55rem 0.85rem 0.75rem',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.5rem 0.6rem',
    display: 'grid',
    gap: '0.4rem',
    background: 'var(--bg)',
  },
  sectionTitle: { margin: 0, fontSize: '0.9rem', fontWeight: 800 },
  blockTitle: { fontSize: '0.8rem', fontWeight: 800 },
  switchRow: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.35 },
  row3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.35rem',
  },
  moneyLabel: { display: 'grid', gap: 2, minWidth: 0 },
  miniLabel: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  dealField: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    overflow: 'hidden',
  },
  dealPrefix: { padding: '0 0.35rem', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.78rem' },
  dealInput: {
    border: 'none',
    background: 'transparent',
    width: '100%',
    minWidth: 0,
    padding: '0.38rem 0.4rem 0.38rem 0',
    fontWeight: 700,
  },
  modeRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  modeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 999,
    padding: '0.2rem 0.5rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--text)',
  },
  modeActive: {
    border: '1px solid var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
    borderRadius: 999,
    padding: '0.2rem 0.5rem',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
    color: 'var(--accent)',
  },
  switchOn: {
    width: 42,
    height: 24,
    borderRadius: 999,
    border: 'none',
    background: 'var(--accent)',
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
  },
  switchOff: {
    width: 42,
    height: 24,
    borderRadius: 999,
    border: 'none',
    background: 'var(--border)',
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
  },
  knobOn: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff' },
  knobOff: { position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff' },
  math: {
    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
    background: 'var(--accent-soft)',
    borderRadius: 12,
    padding: '0.5rem 0.6rem',
    display: 'grid',
    gap: '0.35rem',
  },
  mathHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  mathGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' },
  mathLabel: { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  mathValue: { display: 'block', fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.3 },
  ordersLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' },
  ordersInput: {
    width: '4.2rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.28rem 0.4rem',
    fontWeight: 700,
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
};
