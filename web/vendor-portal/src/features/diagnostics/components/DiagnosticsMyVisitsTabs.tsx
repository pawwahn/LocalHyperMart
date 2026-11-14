import type { CSSProperties, ReactNode } from 'react';
import type { MyVisitsPane } from '../lib/diagnosticsMyVisits';

export function DiagnosticsMyVisitsTabs({
  pane,
  onPaneChange,
  toCollectCount,
  handedCount,
  historyCount,
  children,
}: {
  pane: MyVisitsPane;
  onPaneChange: (next: MyVisitsPane) => void;
  toCollectCount: number;
  handedCount: number;
  historyCount: number;
  children: ReactNode;
}) {
  const tabStyle = (key: MyVisitsPane): CSSProperties =>
    pane === key ? { ...styles.paneBase, ...paneOnByKey[key] } : { ...styles.paneBase, ...styles.paneOff };

  return (
    <>
      <div style={styles.paneSwitch} role="tablist" aria-label="My visits">
        <button type="button" role="tab" aria-selected={pane === 'collect'} style={tabStyle('collect')} onClick={() => onPaneChange('collect')}>
          Yet to collect{toCollectCount > 0 ? ` (${toCollectCount})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={pane === 'handed'} style={tabStyle('handed')} onClick={() => onPaneChange('handed')}>
          Handed over{handedCount > 0 ? ` (${handedCount})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={pane === 'history'} style={tabStyle('history')} onClick={() => onPaneChange('history')}>
          History{historyCount > 0 ? ` (${historyCount})` : ''}
        </button>
      </div>
      {children}
    </>
  );
}

const paneOnByKey: Record<MyVisitsPane, CSSProperties> = {
  collect: {
    background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
    color: '#7f1d1d',
    boxShadow: '0 1px 0 color-mix(in srgb, #b91c1c 25%, transparent)',
  },
  handed: {
    background: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)',
    color: '#9a3412',
    boxShadow: '0 1px 0 color-mix(in srgb, #ea580c 25%, transparent)',
  },
  history: {
    background: 'linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)',
    color: '#064e3b',
    boxShadow: '0 1px 0 color-mix(in srgb, #059669 25%, transparent)',
  },
};

const styles: Record<string, CSSProperties> = {
  paneSwitch: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.2rem',
    padding: 2,
    marginBottom: '0.45rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--bg-muted) 70%, #fff)',
    border: '1px solid var(--border)',
  },
  paneBase: {
    flex: '1 1 5.5rem',
    border: 'none',
    borderRadius: 999,
    minHeight: 34,
    padding: '0.22rem 0.45rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  paneOff: {
    fontWeight: 750,
    background: 'transparent',
    color: 'var(--text-muted)',
  },
};
