import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '@/features/vendors/api/vendorsApi';
import {
  createSettlement,
  fetchSettlementCandidates,
  formatMoney,
  listSettlements,
  type SettlementCandidate,
  type SettlementVm,
} from '../api/settlementsApi';

type PeriodPreset = 'day' | 'week' | 'month' | 'custom';

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeForPreset(preset: PeriodPreset): { from: string; to: string; periodType: 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM' } {
  const today = new Date();
  const to = isoDate(today);
  if (preset === 'day') return { from: to, to, periodType: 'DAY' };
  if (preset === 'week') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to, periodType: 'WEEK' };
  }
  if (preset === 'month') {
    return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to, periodType: 'MONTH' };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { from: isoDate(from), to, periodType: 'CUSTOM' };
}

const PAYOUT_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'];

export function SettlementsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const initial = rangeForPreset('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [townId, setTownId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [periodType, setPeriodType] = useState<'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>(initial.periodType);
  const [candidates, setCandidates] = useState<SettlementCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<SettlementVm[]>([]);
  const [payoutMethod, setPayoutMethod] = useState('UPI');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionNotes, setTransactionNotes] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  const openCandidates = useMemo(
    () => candidates.filter((c) => !c.alreadySettled),
    [candidates],
  );

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const c of candidates) {
      if (selected.has(c.subOrderId)) sum += Number(c.subtotal ?? 0);
    }
    return sum;
  }, [candidates, selected]);

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    const range = rangeForPreset(next);
    setFrom(range.from);
    setTo(range.to);
    setPeriodType(range.periodType);
  };

  const reloadMeta = useCallback(async () => {
    if (!token) return;
    const townList = await listTowns(token);
    setTowns(townList);
  }, [token]);

  const reloadCandidates = useCallback(async () => {
    if (!token || !townId || !vendorId) {
      setCandidates([]);
      setSelected(new Set());
      return;
    }
    const data = await fetchSettlementCandidates(token, { townId, vendorId, from, to });
    setCandidates(data.items ?? []);
    setSelected(new Set((data.items ?? []).filter((i) => !i.alreadySettled).map((i) => i.subOrderId)));
  }, [token, townId, vendorId, from, to]);

  const reloadHistory = useCallback(async () => {
    if (!token) return;
    const items = await listSettlements(token, {
      townId: townId || undefined,
      payeeId: vendorId || undefined,
    });
    setHistory(items);
  }, [token, townId, vendorId]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await reloadMeta();
      const vendorList = townId ? await listVendors(token, townId) : [];
      setVendors(vendorList);
      if (vendorId && !vendorList.some((v) => v.id === vendorId)) {
        setVendorId('');
      }
      await Promise.all([reloadCandidates(), reloadHistory()]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [token, townId, vendorId, reloadMeta, reloadCandidates, reloadHistory]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function toggleAllOpen(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(openCandidates.map((c) => c.subOrderId)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submitPayout() {
    if (!token || !townId || !vendorId || selected.size === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createSettlement(token, {
        townId,
        vendorId,
        vendorName: selectedVendor?.shopName || selectedVendor?.businessName,
        periodStart: from,
        periodEnd: to,
        periodType,
        subOrderIds: Array.from(selected),
        commissionAmount: Number(commissionAmount || 0),
        markPaid: true,
        payoutMethod,
        transactionReference: transactionReference.trim() || undefined,
        transactionNotes: transactionNotes.trim() || undefined,
      });
      setSuccess(
        `Paid ${formatMoney(created.netAmount)} to ${created.payeeName ?? 'vendor'} · ${created.payoutMethod} · ${created.transactionReference ?? 'no txn ref'}`,
      );
      setTransactionReference('');
      setTransactionNotes('');
      await Promise.all([reloadCandidates(), reloadHistory()]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to record payout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell title="Vendor payouts" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {success ? <Banner tone="success">{success}</Banner> : null}

      <Card elevated>
        <h2 style={styles.sectionTitle}>Record a payout</h2>
        <p style={styles.help}>
          Choose town, vendor, and period (day / week / month / custom). Select unpaid orders, enter
          payout mode and transaction details, then mark paid. Vendors see this against each order.
        </p>

        <div style={styles.presets}>
          {(
            [
              ['day', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['custom', 'Custom'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              style={preset === id ? styles.presetActive : styles.preset}
              onClick={() => applyPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={styles.filters}>
          <label style={styles.label}>
            Town
            <select
              style={styles.input}
              value={townId}
              onChange={(e) => {
                setTownId(e.target.value);
                setVendorId('');
              }}
            >
              <option value="">Select town</option>
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Vendor
            <select
              style={styles.input}
              value={vendorId}
              disabled={!townId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shopName || v.businessName} ({v.phone})
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            From
            <input
              style={styles.input}
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setPeriodType('CUSTOM');
                setFrom(e.target.value);
              }}
            />
          </label>
          <label style={styles.label}>
            To
            <input
              style={styles.input}
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setPeriodType('CUSTOM');
                setTo(e.target.value);
              }}
            />
          </label>
        </div>

        <div style={styles.filters}>
          <label style={styles.label}>
            Payout mode
            <select
              style={styles.input}
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
            >
              {PAYOUT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Transaction reference
            <input
              style={styles.input}
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="UTR / UPI ref / cheque no."
            />
          </label>
          <label style={styles.label}>
            Commission (optional)
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={commissionAmount}
              onChange={(e) => setCommissionAmount(e.target.value)}
            />
          </label>
          <label style={styles.label}>
            Notes
            <input
              style={styles.input}
              value={transactionNotes}
              onChange={(e) => setTransactionNotes(e.target.value)}
              placeholder="Optional bank / remark"
            />
          </label>
        </div>

        <div style={styles.actions}>
          <Button size="sm" variant="secondary" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh orders'}
          </Button>
          <Button
            size="sm"
            disabled={saving || selected.size === 0 || !townId || !vendorId}
            onClick={() => void submitPayout()}
          >
            {saving
              ? 'Saving…'
              : `Mark paid · ${selected.size} orders · ${formatMoney(selectedTotal)}`}
          </Button>
        </div>
      </Card>

      <Card>
        <div style={styles.tableHead}>
          <h2 style={styles.sectionTitle}>Orders in period</h2>
          <label style={styles.checkInline}>
            <input
              type="checkbox"
              checked={openCandidates.length > 0 && selected.size === openCandidates.length}
              onChange={(e) => toggleAllOpen(e.target.checked)}
              disabled={openCandidates.length === 0}
            />
            Select all unsettled
          </label>
        </div>
        {!townId || !vendorId ? (
          <p style={styles.muted}>Select a town and vendor to load orders.</p>
        ) : loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : candidates.length === 0 ? (
          <p style={styles.muted}>No eligible orders in this range.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th} />
                  <th style={styles.th}>Placed</th>
                  <th style={styles.th}>Order</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Buyer pay</th>
                  <th style={styles.thRight}>Amount</th>
                  <th style={styles.th}>Settlement</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((row) => (
                  <tr key={row.subOrderId}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        disabled={row.alreadySettled}
                        checked={selected.has(row.subOrderId)}
                        onChange={(e) => toggleOne(row.subOrderId, e.target.checked)}
                      />
                    </td>
                    <td style={styles.tdMuted}>
                      {row.placedAt ? new Date(row.placedAt).toLocaleString() : '—'}
                    </td>
                    <td style={styles.td}>
                      <strong>{row.orderNumber}</strong>
                      <div style={styles.sub}>{row.subOrderNumber}</div>
                    </td>
                    <td style={styles.tdMuted}>{row.status}</td>
                    <td style={styles.tdMuted}>{row.paymentStatus ?? '—'}</td>
                    <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
                    <td style={styles.td}>
                      {row.alreadySettled ? (
                        <span style={styles.settled}>Already settled</span>
                      ) : (
                        <span style={styles.open}>Open</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 style={styles.sectionTitle}>Payout history ({history.length})</h2>
        {history.length === 0 ? (
          <p style={styles.muted}>No payouts recorded yet for this filter.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Paid at</th>
                  <th style={styles.th}>Vendor</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Mode</th>
                  <th style={styles.th}>Txn</th>
                  <th style={styles.thRight}>Net</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.tdMuted}>
                      {s.paidAt ? new Date(s.paidAt).toLocaleString() : '—'}
                    </td>
                    <td style={styles.td}>{s.payeeName ?? s.payeeId}</td>
                    <td style={styles.tdMuted}>
                      {s.periodStart} → {s.periodEnd}
                      <div style={styles.sub}>{s.periodType} · {s.lines?.length ?? 0} orders</div>
                    </td>
                    <td style={styles.tdMuted}>{s.payoutMethod ?? '—'}</td>
                    <td style={styles.td}>
                      {s.transactionReference || '—'}
                      {s.transactionNotes ? <div style={styles.sub}>{s.transactionNotes}</div> : null}
                    </td>
                    <td style={styles.tdRight}>{formatMoney(s.netAmount)}</td>
                    <td style={styles.td}>
                      <span style={s.status === 'PAID' ? styles.settled : styles.open}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  sectionTitle: { margin: '0 0 0.65rem', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800 },
  help: { margin: '0 0 0.85rem', color: 'var(--text-muted)', fontSize: '0.88rem' },
  presets: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  preset: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.85rem',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  presetActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.85rem',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.65rem',
    marginBottom: '0.75rem',
  },
  label: { display: 'grid', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 },
  input: {
    padding: '0.55rem 0.7rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  tableHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '0.5rem',
  },
  checkInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(50vh, 520px)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.5rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.5rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdMuted: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  tdRight: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 600,
    verticalAlign: 'top',
  },
  sub: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 },
  settled: {
    fontSize: '0.68rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  open: {
    fontSize: '0.68rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  muted: { margin: 0, color: 'var(--text-muted)' },
};
