import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { fetchScratchGiftReport, type ScratchGiftReport } from '../api/scratchGiftApi';
import {
  TRANSFER_HISTORY_PRESET_OPTIONS,
  rangeForTransferHistoryPreset,
  type TransferHistoryPreset,
} from '@hlm-dates/istReportPresets';

function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

/** Super-admin only: wallet credit gifted via scratch cards, by town. */
export function ScratchGiftReportPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const initialRange = rangeForTransferHistoryPreset('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [preset, setPreset] = useState<TransferHistoryPreset>('week');
  const [from, setFrom] = useState(initialRange?.from ?? '');
  const [to, setTo] = useState(initialRange?.to ?? '');
  const [report, setReport] = useState<ScratchGiftReport | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const townNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const town of towns) map.set(town.id, town.displayName);
    return map;
  }, [towns]);

  useEffect(() => {
    if (!token) return;
    void listTowns(token)
      .then(setTowns)
      .catch(() => setTowns([]));
  }, [token]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScratchGiftReport(token, {
        townId: townId || undefined,
        from: from && to ? from : undefined,
        to: from && to ? to : undefined,
      });
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [token, townId, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function applyPreset(next: TransferHistoryPreset) {
    setPreset(next);
    const range = rangeForTransferHistoryPreset(next);
    setFrom(range?.from ?? '');
    setTo(range?.to ?? '');
  }

  const lines = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = report?.lines ?? [];
    if (!needle) return all;
    return all.filter((row) =>
      [row.buyerPhone, row.orderNumber, row.townName, row.status].some((v) => (v ?? '').toLowerCase().includes(needle)),
    );
  }, [report, q]);

  function exportCsv() {
    if (!report) return;
    const linesOut = [
      ['Gifted (burned)', Number(report.giftedAmount ?? 0).toFixed(2)].join(','),
      ['Scratched', report.scratched].join(','),
      ['Issued', report.issued].join(','),
      ['Unopened now', report.unopened].join(','),
      ['Pending min', Number(report.pendingMin ?? 0).toFixed(2)].join(','),
      ['Pending max', Number(report.pendingMax ?? 0).toFixed(2)].join(','),
      ['Avg gift', Number(report.avgGift ?? 0).toFixed(2)].join(','),
      '',
      ['TOWNS'].join(','),
      ['Town', 'Issued', 'Scratched', 'Gifted', 'Unopened'].join(','),
      ...(report.towns ?? []).map((row) =>
        [
          csvEscape(row.townName || townNameById.get(row.townId) || row.townId),
          row.issued,
          row.scratched,
          Number(row.giftedAmount ?? 0).toFixed(2),
          row.unopened,
        ].join(','),
      ),
      '',
      ['CARDS'].join(','),
      ['Issued', 'Revealed', 'Status', 'Town', 'Order', 'Buyer', 'Gifted', 'Band min', 'Band max'].join(','),
      ...(report.lines ?? []).map((row) =>
        [
          row.issuedAt,
          row.revealedAt ?? '',
          row.status,
          csvEscape(row.townName || ''),
          csvEscape(row.orderNumber || ''),
          csvEscape(row.buyerPhone || ''),
          Number(row.companySpent ?? 0).toFixed(2),
          Number(row.rewardMin ?? 0).toFixed(2),
          Number(row.rewardMax ?? 0).toFixed(2),
        ].join(','),
      ),
    ];
    const blob = new Blob([linesOut.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koyakart-scratch-${from || 'all'}-${to || isoDateInIst()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const periodLabel =
    from && to ? `${from} → ${to}` : 'All time';

  return (
    <PortalShell title="Scratch card gifts" onRefresh={() => void reload()}>
      <style>{`
        @media (max-width: 760px) {
          .scratch-gift-filters { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card>
        <div className="scratch-gift-filters" style={styles.filterRow}>
          <label style={styles.label}>
            Town
            <select style={styles.select} value={townId} onChange={(e) => setTownId(e.target.value)}>
              <option value="">All towns</option>
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            From
            <input
              style={styles.select}
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('all');
                setFrom(e.target.value);
              }}
            />
          </label>
          <label style={styles.label}>
            To
            <input
              style={styles.select}
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('all');
                setTo(e.target.value);
              }}
            />
          </label>
          <div style={styles.presetCol}>
            <span style={styles.presetLabel}>Range</span>
            <div style={styles.presets}>
              {TRANSFER_HISTORY_PRESET_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  style={preset === id ? styles.presetOn : styles.presetOff}
                  onClick={() => applyPreset(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.csvWrap}>
            <Button variant="secondary" disabled={!report} onClick={exportCsv}>
              CSV
            </Button>
          </div>
        </div>
        <p style={styles.hint}>
          Gifted ₹ is wallet credit after scratch ({periodLabel}). Unopened is still waiting — not burned yet.
          Pending is the min–max band still sitting on unopened cards.
        </p>
      </Card>

      <div style={styles.kpis}>
        <span>
          <strong>{loading && !report ? '…' : money(report?.giftedAmount ?? 0)}</strong> gifted
        </span>
        <span>
          <strong>{loading && !report ? '…' : report?.scratched ?? 0}</strong> scratched
        </span>
        <span>
          <strong>{loading && !report ? '…' : report?.issued ?? 0}</strong> issued
        </span>
        <span>
          <strong>{loading && !report ? '…' : report?.unopened ?? 0}</strong> unopened
        </span>
        <span>
          <strong>
            {loading && !report
              ? '…'
              : `${money(report?.pendingMin ?? 0)}–${money(report?.pendingMax ?? 0)}`}
          </strong>{' '}
          pending
        </span>
        <span>
          <strong>{loading && !report ? '…' : money(report?.avgGift ?? 0)}</strong> avg gift
        </span>
      </div>

      <Card>
        {loading && !report ? (
          <p style={styles.muted}>Loading last 7 days…</p>
        ) : (report?.towns?.length ?? 0) === 0 ? (
          <p style={styles.muted}>No scratch cards in this range.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Town</th>
                  <th style={styles.thRight}>Issued</th>
                  <th style={styles.thRight}>Scratched</th>
                  <th style={styles.thRight}>Gifted</th>
                  <th style={styles.thRight}>Unopened</th>
                </tr>
              </thead>
              <tbody>
                {report!.towns.map((row) => (
                  <tr key={row.townId}>
                    <td style={styles.td}>
                      <strong>{row.townName || townNameById.get(row.townId) || row.townId}</strong>
                    </td>
                    <td style={styles.tdRight}>{row.issued}</td>
                    <td style={styles.tdRight}>{row.scratched}</td>
                    <td style={styles.tdRight}>{money(row.giftedAmount)}</td>
                    <td style={styles.tdRight}>{row.unopened}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div style={styles.lineHead}>
          <h2 style={styles.h2}>Cards</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Phone, order or town"
            style={styles.search}
          />
        </div>
        {lines.length === 0 ? (
          <p style={styles.muted}>No cards in this range.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Issued</th>
                  <th style={styles.th}>Buyer</th>
                  <th style={styles.th}>Order</th>
                  <th style={styles.th}>Town</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.thRight}>Gifted</th>
                  <th style={styles.thRight}>Band</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row) => (
                  <tr key={row.cardId}>
                    <td style={styles.td}>{row.issuedAt}</td>
                    <td style={styles.td}>{row.buyerPhone || '—'}</td>
                    <td style={styles.td}>{row.orderNumber || '—'}</td>
                    <td style={styles.td}>{row.townName || townNameById.get(row.townId) || '—'}</td>
                    <td style={styles.td}>{row.status === 'REVEALED' ? 'Scratched' : 'Unopened'}</td>
                    <td style={styles.tdRight}>
                      {row.status === 'REVEALED' ? money(row.companySpent) : '—'}
                    </td>
                    <td style={styles.tdRight}>
                      {money(row.rewardMin)}–{money(row.rewardMax)}
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
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(120px, 1fr) minmax(120px, 1fr) auto auto',
    gap: '0.45rem',
    alignItems: 'end',
  },
  label: { display: 'grid', gap: 2, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 },
  select: {
    padding: '0.45rem 0.55rem',
    minHeight: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  presetCol: { display: 'grid', gap: 2 },
  presetLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  presets: { display: 'flex', gap: '0.25rem', flexWrap: 'wrap' },
  presetOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    fontSize: '0.75rem',
    borderRadius: 999,
    padding: '0.35rem 0.55rem',
    minHeight: 36,
    cursor: 'pointer',
  },
  presetOff: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '0.75rem',
    borderRadius: 999,
    padding: '0.35rem 0.55rem',
    minHeight: 36,
    cursor: 'pointer',
  },
  csvWrap: { alignSelf: 'end' },
  lineHead: { display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' },
  h2: { margin: 0, fontSize: '0.92rem', fontWeight: 800, flex: 1 },
  search: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.3rem 0.5rem',
    minHeight: 34,
    minWidth: 180,
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  hint: { margin: '0.45rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 },
  kpis: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.85rem 1.25rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  muted: { margin: 0, color: 'var(--text-muted)' },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: {
    padding: '0.4rem 0.5rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  thRight: {
    padding: '0.4rem 0.5rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  td: { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' },
  tdRight: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
};
