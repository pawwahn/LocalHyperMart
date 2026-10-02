import { useState, type CSSProperties, type ReactNode } from 'react';
import { Card } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';

type Tab = 'history' | 'changelog';

export type SettlementChangeLogProps = {
  token: string;
  townId?: string;
  refreshTick?: number;
  actions?: string[];
  prefixes?: string[];
  emptyHint?: string;
};

type Props = {
  historyCount: number;
  historyEmpty: ReactNode;
  historyContent: ReactNode;
  changeLog: SettlementChangeLogProps;
};

export function SettlementAuditSection({
  historyCount,
  historyEmpty,
  historyContent,
  changeLog,
}: Props) {
  const [tab, setTab] = useState<Tab>('history');
  const [open, setOpen] = useState(true);

  return (
    <Card padding="sm" style={styles.card}>
      <div style={styles.head}>
        <button type="button" style={styles.collapseBtn} onClick={() => setOpen((v) => !v)}>
          <span style={styles.collapseIcon} aria-hidden>
            {open ? '▾' : '▸'}
          </span>
          <span style={styles.headTitle}>Records</span>
          <span style={styles.headHint}>Payout history &amp; audit log</span>
        </button>
        {open ? (
          <div style={styles.tabs} role="tablist" aria-label="Payout records">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              style={tab === 'history' ? styles.tabOn : styles.tabOff}
              onClick={() => setTab('history')}
            >
              Payout history
              <span style={styles.tabCount}>{historyCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'changelog'}
              style={tab === 'changelog' ? styles.tabOn : styles.tabOff}
              onClick={() => setTab('changelog')}
            >
              Change log
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <div style={styles.scrollPane}>
          {tab === 'history' ? (
            historyCount === 0 ? (
              <p style={styles.muted}>{historyEmpty}</p>
            ) : (
              historyContent
            )
          ) : (
            <AdminHistoryPanel
              token={changeLog.token}
              screen="settlements"
              townId={changeLog.townId}
              refreshTick={changeLog.refreshTick}
              actions={changeLog.actions}
              prefixes={changeLog.prefixes}
              emptyHint={changeLog.emptyHint}
              embedded
              compact
              inlineScroll
            />
          )}
        </div>
      ) : null}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.4rem', marginTop: '0.35rem' },
  head: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem 0.5rem',
  },
  collapseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
    color: 'var(--text)',
    textAlign: 'left',
  },
  collapseIcon: { fontSize: '0.85rem', opacity: 0.65, width: '0.85rem' },
  headTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.92rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  headHint: { fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)' },
  tabs: {
    display: 'inline-flex',
    gap: 3,
    padding: 3,
    borderRadius: 9,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  tabOff: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.72rem',
    padding: '0.28rem 0.55rem',
    borderRadius: 7,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  tabOn: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.72rem',
    padding: '0.28rem 0.55rem',
    borderRadius: 7,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  tabCount: {
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  scrollPane: {
    maxHeight: 'min(42vh, 420px)',
    overflow: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.35rem',
    background: 'var(--bg)',
  },
  muted: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 650 },
};
