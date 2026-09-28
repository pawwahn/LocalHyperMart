import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/shared/api/http';
import { Banner, Button } from '@/shared/ui';
import { listAgentRatings, type AgentDto, type AgentRatingListVm } from '../api/hubApi';

type Props = {
  agent: AgentDto;
  token: string;
  onClose: () => void;
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StarMarks({ value, size = 14 }: { value: number; size?: number }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span aria-label={`${n} of 5 stars`} style={{ ...styles.stars, fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= n ? '#D97706' : '#D1D5DB' }}>
          ★
        </span>
      ))}
    </span>
  );
}

export function HubAgentRatingsSheet({ agent, token, onClose }: Props) {
  const [data, setData] = useState<AgentRatingListVm | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listAgentRatings(token, agent.agentId, page)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load ratings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, agent.agentId, page]);

  const count = data?.ratingCount ?? 0;
  const avg = data?.averageStars ?? 0;

  return createPortal(
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Buyer ratings for ${agent.name}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <div style={styles.headText}>
            <h2 style={styles.title}>Buyer ratings</h2>
            <p style={styles.sub}>
              {agent.name}
              {agent.phone ? ` · ${agent.phone}` : ''}
            </p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}

        {loading && !data ? <p style={styles.muted}>Loading ratings…</p> : null}

        {data ? (
          <>
            <div style={styles.summary}>
              <div style={styles.scoreBox}>
                <span style={styles.scoreNum}>{count > 0 ? avg.toFixed(1) : '—'}</span>
                <span style={styles.scoreLbl}>avg</span>
              </div>
              <div style={styles.summaryCopy}>
                <StarMarks value={count > 0 ? avg : 0} size={16} />
                <p style={styles.muted}>
                  {count === 0
                    ? 'No buyer ratings yet'
                    : `${count} buyer rating${count === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>

            {data.items.length === 0 && !error ? (
              <p style={styles.empty}>Ratings appear here after a buyer rates a delivered order.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Order</th>
                      <th style={styles.th}>Rating</th>
                      <th style={styles.th}>Comment</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.ratingId}>
                        <td style={styles.tdOrder}>{row.orderNumber || row.orderId}</td>
                        <td style={styles.tdStars}>
                          <StarMarks value={row.stars} />
                          <span style={styles.starCount}>{row.stars}</span>
                        </td>
                        <td style={styles.tdComment}>{row.comment?.trim() ? row.comment : '—'}</td>
                        <td style={styles.tdWhen}>{formatWhen(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.totalPages > 1 ? (
              <div style={styles.pager}>
                <span style={styles.pageLabel}>
                  Page {page + 1} of {data.totalPages}
                </span>
                <Button size="sm" variant="ghost" disabled={page <= 0 || loading} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page + 1 >= data.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        ) : null}

        <div style={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(12, 18, 24, 0.55)',
  },
  dialog: {
    width: 'min(40rem, calc(100vw - 1.5rem))',
    maxHeight: 'min(86vh, 40rem)',
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '0.85rem 0.95rem 0.75rem',
    display: 'grid',
    alignContent: 'start',
    gap: '0.55rem',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' },
  headText: { minWidth: 0 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.15rem',
    lineHeight: 1.2,
  },
  sub: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  close: {
    appearance: 'none',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  scoreBox: {
    display: 'grid',
    justifyItems: 'center',
    minWidth: 52,
    padding: '0.2rem 0.45rem',
    borderRadius: 8,
    background: '#FEF3C7',
  },
  scoreNum: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.25rem',
    lineHeight: 1.1,
    color: '#92400E',
    fontVariantNumeric: 'tabular-nums',
  },
  scoreLbl: { fontSize: '0.62rem', fontWeight: 800, color: '#92400E', letterSpacing: '0.04em', textTransform: 'uppercase' },
  summaryCopy: { display: 'grid', gap: 2 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  empty: {
    margin: 0,
    padding: '0.7rem 0.75rem',
    borderRadius: 10,
    background: 'var(--bg-muted, var(--bg))',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  tableWrap: {
    minHeight: 0,
    maxHeight: 'min(48vh, 22rem)',
    overflow: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: {
    textAlign: 'left',
    padding: '0.38rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.66rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted, #F4F7FB)',
    whiteSpace: 'nowrap',
  },
  tdOrder: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  tdStars: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  tdComment: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text)',
    lineHeight: 1.35,
    maxWidth: '16rem',
  },
  tdWhen: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textAlign: 'right',
    fontSize: '0.75rem',
  },
  stars: { display: 'inline-flex', gap: 1, lineHeight: 1 },
  starCount: { marginLeft: 6, color: 'var(--text-muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  pager: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem' },
  pageLabel: { marginRight: 'auto', fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' },
  footer: { display: 'flex', justifyContent: 'flex-end' },
};
