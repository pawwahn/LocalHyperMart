import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { displayPayeeLabel } from '@/shared/display/displayNames';
import { Banner, Button, ConfirmDialog } from '@/shared/ui';
import { listHubs } from '@/features/hubs/api/hubsApi';
import {
  confirmSubscriptionPayment,
  confirmVendorBillPayment,
  formatMoney,
  listSettlements,
  markSettlementPaid,
  rejectSubscriptionPayment,
  rejectVendorBillPayment,
  type SettlementVm,
} from '@/features/settlements/api/settlementsApi';
import {
  fetchHubPaymentSubmissions,
  rejectHubPaymentSubmission,
  verifyHubPaymentSubmission,
  type HubPaymentSubmission,
} from '@/features/settlements/api/hubPaymentApi';
import { listTowns } from '@/features/towns/api/townsApi';
import { listRegistrationRequests, type VendorRegistrationVm } from '@/features/vendors/api/vendorsApi';

type Kind = 'confirm' | 'pay' | 'collect' | 'signup';
type Filter = 'all' | Kind;

type InboxItem = {
  id: string;
  kind: Kind;
  who: string;
  role: string;
  title: string;
  amount: number;
  detail: string;
  at?: string | null;
  settlement?: SettlementVm;
  hub?: HubPaymentSubmission;
  signupId?: string;
};

type Ask =
  | { type: 'confirm-bill' | 'reject-bill' | 'pay'; item: InboxItem }
  | { type: 'confirm-hub' | 'reject-hub'; item: InboxItem };

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'confirm', label: 'Confirm or reject' },
  { id: 'pay', label: 'You pay' },
  { id: 'collect', label: 'You collect' },
  { id: 'signup', label: 'New shops' },
];

function isSubscription(s: SettlementVm): boolean {
  return (s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'SUBSCRIPTION');
}

function isFranchise(s: SettlementVm): boolean {
  return (s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'FRANCHISE');
}

function whenLabel(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function waitingDays(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

function fromSettlement(s: SettlementVm): InboxItem | null {
  if ((s.status ?? '').toUpperCase() === 'PAID') return null;
  const collection = (s.direction ?? '').toUpperCase() === 'COLLECTION';
  const who = displayPayeeLabel(s.payeeName, s.payeeId, s.payeeType);
  const role = s.payeeType === 'AGENT' ? 'Agent' : s.payeeType === 'HUB' ? 'Hub' : 'Vendor';
  const period = `${s.periodStart} → ${s.periodEnd}`;
  if (collection && s.vendorPaidAt) {
    const plan = isSubscription(s);
    return {
      id: `bill-${s.id}`,
      kind: 'confirm',
      who,
      role,
      title: plan ? 'Subscription payment to confirm' : 'Fee payment to confirm',
      amount: Number(s.netAmount ?? 0),
      detail: `${s.vendorPaymentMethod ?? 'UPI'} · UTR ${s.vendorPaymentReference || '—'} · ${period}`,
      at: s.vendorPaidAt,
      settlement: s,
    };
  }
  if (collection) {
    const plan = isSubscription(s);
    const franchise = isFranchise(s);
    return {
      id: `collect-${s.id}`,
      kind: 'collect',
      who,
      role,
      title: plan
        ? s.billSentAt
          ? 'Subscription bill sent — waiting for payment'
          : 'Subscription bill not sent yet'
        : franchise
          ? 'Hub franchise still to collect'
          : s.billSentAt
            ? 'Fee bill sent — waiting for payment'
            : 'Money to collect — bill not sent',
      amount: Number(s.netAmount ?? 0),
      detail: `${s.serviceInvoiceNumber ? `${s.serviceInvoiceNumber} · ` : ''}${period}`,
      at: s.billSentAt ?? s.createdAt,
      settlement: s,
    };
  }
  return {
    id: `pay-${s.id}`,
    kind: 'pay',
    who,
    role,
    title: role === 'Agent' ? 'Pay delivery agent' : role === 'Hub' ? 'Pay hub' : 'Pay vendor for goods',
    amount: Number(s.netAmount ?? 0),
    detail: period,
    at: s.createdAt ?? s.periodEnd,
    settlement: s,
  };
}

function fromHub(row: HubPaymentSubmission, hubName: string): InboxItem | null {
  if (row.status !== 'PENDING_VERIFICATION') return null;
  const kinds = [...new Set((row.lines ?? []).map((l) => l.lineType))].join(', ') || 'Payment';
  return {
    id: `hub-${row.submissionId}`,
    kind: 'confirm',
    who: hubName,
    role: 'Hub',
    title: 'Hub payment to confirm',
    amount: Number(row.totalAmount ?? 0),
    detail: `${kinds} · UTR ${row.paymentReference || '—'}${row.hubNotes ? ` · “${row.hubNotes}”` : ''}`,
    at: row.submittedAt ?? row.paymentDate,
    hub: row,
  };
}

function fromSignup(r: VendorRegistrationVm): InboxItem {
  return {
    id: `signup-${r.id}`,
    kind: 'signup',
    who: r.shopName || r.businessName,
    role: 'New shop',
    title: 'Registration waiting for approval',
    amount: 0,
    detail: [r.ownerName, r.phone].filter(Boolean).join(' · '),
    at: r.createdAt,
    signupId: r.id,
  };
}

export function OpsInbox({ refreshTick = 0 }: { refreshTick?: number }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [reason, setReason] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const open = (payeeType: string, status: string) =>
        listSettlements(token, { payeeType, status }).catch(() => [] as SettlementVm[]);
      const [vendor, hubSettlements, agent, towns, hubs, signups] = await Promise.all([
        Promise.all([open('VENDOR', 'DRAFT'), open('VENDOR', 'FINALIZED')]).then((parts) => parts.flat()),
        Promise.all([open('HUB', 'DRAFT'), open('HUB', 'FINALIZED')]).then((parts) => parts.flat()),
        Promise.all([open('AGENT', 'DRAFT'), open('AGENT', 'FINALIZED')]).then((parts) => parts.flat()),
        listTowns(token),
        listHubs(token).catch(() => []),
        listRegistrationRequests(token, 'PENDING').catch(() => []),
      ]);
      const hubName = new Map(hubs.map((h) => [h.hubId, h.name]));
      const submissions = (
        await Promise.all(
          towns.map((t) => fetchHubPaymentSubmissions(token, t.id).catch(() => [] as HubPaymentSubmission[])),
        )
      ).flat();
      const next: InboxItem[] = [];
      for (const s of [...vendor, ...hubSettlements, ...agent]) {
        const row = fromSettlement(s);
        if (row) {
          if (s.payeeType === 'HUB' && hubName.has(s.payeeId)) {
            row.who = hubName.get(s.payeeId) || row.who;
          }
          next.push(row);
        }
      }
      for (const row of submissions) {
        const item = fromHub(row, hubName.get(row.hubId) || 'Delivery hub');
        if (item) next.push(item);
      }
      for (const r of signups) next.push(fromSignup(r));
      next.sort((a, b) => {
        const rank = (k: Kind) => (k === 'confirm' ? 0 : k === 'pay' ? 1 : k === 'collect' ? 2 : 3);
        const byKind = rank(a.kind) - rank(b.kind);
        if (byKind !== 0) return byKind;
        return (a.at ?? '').localeCompare(b.at ?? '');
      });
      setItems(next);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load pending work');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const counts = useMemo(() => {
    const sum = (kind: Kind) => items.filter((i) => i.kind === kind).reduce((n, i) => n + i.amount, 0);
    const n = (kind: Kind) => items.filter((i) => i.kind === kind).length;
    return {
      confirm: n('confirm'),
      pay: n('pay'),
      payAmount: sum('pay'),
      collect: n('collect'),
      collectAmount: sum('collect'),
      signup: n('signup'),
    };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== 'all' && i.kind !== filter) return false;
      if (!q) return true;
      return `${i.who} ${i.title} ${i.detail} ${i.role}`.toLowerCase().includes(q);
    });
  }, [items, filter, query]);

  function openAsk(next: Ask) {
    setReason('');
    setPayMethod('UPI');
    setPayRef('');
    setAsk(next);
  }

  async function runAsk() {
    if (!ask || !token) return;
    setBusy(true);
    setError(null);
    try {
      if (ask.type === 'confirm-bill' && ask.item.settlement) {
        const s = ask.item.settlement;
        if (isSubscription(s)) await confirmSubscriptionPayment(token, s.id);
        else await confirmVendorBillPayment(token, s.id);
      } else if (ask.type === 'reject-bill' && ask.item.settlement) {
        const why = reason.trim();
        if (!why) {
          setError('Write why you are rejecting, so they know what to fix.');
          setBusy(false);
          return;
        }
        const s = ask.item.settlement;
        if (isSubscription(s)) await rejectSubscriptionPayment(token, s.id, why);
        else await rejectVendorBillPayment(token, s.id, why);
      } else if (ask.type === 'confirm-hub' && ask.item.hub) {
        await verifyHubPaymentSubmission(token, ask.item.hub.submissionId);
      } else if (ask.type === 'reject-hub' && ask.item.hub) {
        const why = reason.trim();
        if (!why) {
          setError('Write why you are rejecting, so the hub knows what to fix.');
          setBusy(false);
          return;
        }
        await rejectHubPaymentSubmission(token, ask.item.hub.submissionId, why);
      } else if (ask.type === 'pay' && ask.item.settlement) {
        const ref = payRef.trim();
        if (!ref) {
          setError('Enter the UTR or reference from your bank.');
          setBusy(false);
          return;
        }
        await markSettlementPaid(token, ask.item.settlement.id, {
          payoutMethod: payMethod,
          transactionReference: ref,
        });
      }
      setAsk(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const shown = visible.slice(0, 80);

  return (
    <section style={styles.wrap}>
      <div style={styles.head}>
        <div>
          <h2 style={styles.title}>Pending work</h2>
          <p style={styles.sub}>
            Across every vendor, hub, and agent. Confirm what they already paid, then what you still have to send or collect.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div style={styles.stats}>
        <Stat label="Confirm or reject" value={String(counts.confirm)} hint="They already paid" hot={counts.confirm > 0} />
        <Stat label="You pay" value={formatMoney(counts.payAmount)} hint={`${counts.pay} open payout${counts.pay === 1 ? '' : 's'}`} />
        <Stat label="You collect" value={formatMoney(counts.collectAmount)} hint={`${counts.collect} still unpaid`} />
        <Stat label="New shops" value={String(counts.signup)} hint="Waiting for approval" />
      </div>

      <div style={styles.tools}>
        <div style={styles.filters} role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              style={filter === f.id ? styles.chipOn : styles.chip}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          style={styles.search}
          value={query}
          placeholder="Find a shop, hub, or agent"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && items.length === 0 ? (
        <p style={styles.muted}>Loading pending work…</p>
      ) : shown.length === 0 ? (
        <p style={styles.empty}>
          Nothing is waiting. This list is every payment someone already started, every open payout, and every bill already sent — across all shops, hubs, and agents.
        </p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Waiting</th>
                <th style={styles.th}>Who</th>
                <th style={styles.th}>What</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const days = waitingDays(item.at);
                return (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <div>{whenLabel(item.at)}</div>
                      {days >= 2 ? <div style={styles.late}>{days} days</div> : null}
                    </td>
                    <td style={styles.td}>
                      <strong>{item.who}</strong>
                      <div style={styles.meta}>{item.role}</div>
                    </td>
                    <td style={styles.td}>
                      <div>{item.title}</div>
                      <div style={styles.meta}>{item.detail}</div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>
                      {item.kind === 'signup' ? '—' : formatMoney(item.amount)}
                    </td>
                    <td style={styles.tdActions}>
                      {item.kind === 'confirm' && item.settlement ? (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => openAsk({ type: 'confirm-bill', item })}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => openAsk({ type: 'reject-bill', item })}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {item.kind === 'confirm' && item.hub ? (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => openAsk({ type: 'confirm-hub', item })}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => openAsk({ type: 'reject-hub', item })}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {item.kind === 'pay' ? (
                        <Button size="sm" disabled={busy} onClick={() => openAsk({ type: 'pay', item })}>
                          Record payment
                        </Button>
                      ) : null}
                      {item.kind === 'signup' ? (
                        <Link to="/vendors" style={styles.linkBtn}>
                          Review
                        </Link>
                      ) : null}
                      {item.kind === 'collect' ? <span style={styles.meta}>Waiting on them</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visible.length > shown.length ? (
        <p style={styles.muted}>Showing {shown.length} of {visible.length}. Search to narrow the list.</p>
      ) : null}

      <ConfirmDialog
        open={ask != null}
        danger={ask?.type === 'reject-bill' || ask?.type === 'reject-hub'}
        busy={busy}
        title={
          ask?.type === 'pay'
            ? 'Record payment'
            : ask?.type === 'reject-bill' || ask?.type === 'reject-hub'
              ? 'Reject this payment'
              : 'Confirm money received'
        }
        confirmLabel={
          ask?.type === 'pay' ? (payRef.trim() ? 'Mark paid' : 'Enter UTR') : ask?.type?.startsWith('reject') ? 'Reject' : 'Confirm'
        }
        cancelLabel="Cancel"
        description={
          ask ? (
            <div style={styles.dialog}>
              <strong>{ask.item.who}</strong>
              <div>
                {ask.item.title} · {ask.item.kind === 'signup' ? '' : formatMoney(ask.item.amount)}
              </div>
              <div style={styles.meta}>{ask.item.detail}</div>
              {ask.type === 'reject-bill' || ask.type === 'reject-hub' ? (
                <label style={styles.field}>
                  Reason they will see
                  <input style={styles.input} value={reason} maxLength={500} autoFocus onChange={(e) => setReason(e.target.value)} />
                </label>
              ) : null}
              {ask.type === 'pay' ? (
                <div style={styles.payRow}>
                  <label style={styles.field}>
                    Mode
                    <select style={styles.input} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </label>
                  <label style={styles.field}>
                    UTR / reference
                    <input
                      style={styles.input}
                      value={payRef}
                      maxLength={128}
                      autoFocus
                      placeholder="e.g. 427812345678"
                      onChange={(e) => setPayRef(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null
        }
        onConfirm={() => void runAsk()}
        onClose={() => {
          if (!busy) setAsk(null);
        }}
      />
    </section>
  );
}

function Stat({ label, value, hint, hot }: { label: string; value: string; hint: string; hot?: boolean }) {
  return (
    <div style={hot ? styles.statHot : styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
      <span style={styles.meta}>{hint}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  sub: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '40rem' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.4rem' },
  stat: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.4rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  statHot: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.4rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #c4b5fd',
    background: '#f5f3ff',
  },
  statLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  statValue: { fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' },
  tools: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center', justifyContent: 'space-between' },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  chip: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.28rem 0.6rem',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  chipOn: {
    border: '1px solid var(--accent)',
    borderRadius: 999,
    padding: '0.28rem 0.6rem',
    background: 'var(--accent-soft)',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.78rem',
  },
  search: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.55rem',
    minWidth: '14rem',
    font: 'inherit',
  },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' },
  th: {
    textAlign: 'left',
    padding: '0.4rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  td: { padding: '0.4rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdActions: {
    padding: '0.35rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    textAlign: 'right',
  },
  meta: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.1rem' },
  late: { color: '#9a3412', fontSize: '0.72rem', fontWeight: 800 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  empty: { margin: 0, padding: '0.8rem', color: 'var(--text-muted)' },
  linkBtn: { fontWeight: 800, fontSize: '0.82rem', color: 'var(--accent-hover, var(--accent))' },
  dialog: { display: 'grid', gap: '0.35rem', minWidth: '16rem' },
  field: { display: 'grid', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 700 },
  input: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.5rem', font: 'inherit' },
  payRow: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.45rem' },
};
