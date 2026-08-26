import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { fetchScratchGiftReport, type ScratchGiftReport } from '../api/scratchGiftApi';

type Preset = 'all' | 'today' | 'week' | 'month';

const IST = 'Asia/Kolkata';

function isoDateInIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function rangeFor(preset: Preset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const to = isoDateInIst();
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: isoDateInIst(from), to };
  }
  const [y, m] = to.split('-');
  return { from: `${y}-${m}-01`, to };
}

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
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<ScratchGiftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const townNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const town of towns) map.set(town.id, town.displayName);
    return map;
  }, [towns]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [townList, data] = await Promise.all([
        listTowns(token),
        fetchScratchGiftReport(token, {
          townId: townId || undefined,
          from: from && to ? from : undefined,
          to: from && to ? to : undefined,
        }),
      ]);
      setTowns(townList);
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

  function applyPreset(next: Preset) {
    setPreset(next);
    const range = rangeFor(next);
    setFrom(range?.from ?? '');
    setTo(range?.to ?? '');
  }

  function exportCsv() {
    const rows = report?.towns ?? [];
    const headers = ['Town', 'Issued', 'Scratched', 'GiftedAmount', 'Unopened'];
    const body = rows.map((row) =>
      [
        row.townName || townNameById.get(row.townId) || row.townId,
        row.issued,
        row.scratched,
        Number(row.giftedAmount ?? 0).toFixed(2),
        row.unopened,
      ]
        .map(csvEscape)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scratch-gifts-${isoDateInIst()}.csv`;
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
              {(['all', 'today', 'week', 'month'] as Preset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  style={preset === p ? styles.presetOn : styles.presetOff}
                  onClick={() => applyPreset(p)}
                >
                  {p === 'all' ? 'All' : p === 'today' ? 'Today' : p === 'week' ? '7d' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.csvWrap}>
            <Button
              variant="secondary"
              disabled={!report || (report.towns?.length ?? 0) === 0}
              onClick={exportCsv}
            >
              CSV
            </Button>
          </div>
        </div>
        <p style={styles.hint}>
          Gifted ₹ is wallet credit after scratch ({periodLabel}). Unopened is still waiting — not burned yet.
        </p>
      </Card>

      <div style={styles.kpis}>
        <span>
          <strong>{loading ? '…' : money(report?.giftedAmount ?? 0)}</strong> gifted
        </span>
        <span>
          <strong>{loading ? '…' : report?.scratched ?? 0}</strong> scratched
        </span>
        <span>
          <strong>{loading ? '…' : report?.issued ?? 0}</strong> issued
        </span>
        <span>
          <strong>{loading ? '…' : report?.unopened ?? 0}</strong> unopened
        </span>
      </div>

      <Card>
        {loading && !report ? (
          <p style={styles.muted}>Loading report…</p>
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
