import type { CSSProperties } from 'react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

export type WorklistTab = {
  id: string;
  label: string;
  count?: number;
  /** Short plain-language help under the tab label */
  help?: string;
};

type Props = {
  tabs: WorklistTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  hint?: string;
};

export function WorklistToolbar({
  tabs,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Type order number…',
  hint,
}: Props) {
  const isMobile = useIsMobile();

  return (
    <div style={styles.wrap}>
      <div style={isMobile ? styles.tabsMobile : styles.tabs}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              style={active ? styles.tabActive : styles.tab}
              onClick={() => onTabChange(tab.id)}
            >
              <span style={styles.tabLabel}>
                {tab.label}
                {tab.count !== undefined ? (
                  <span style={active ? styles.countActive : styles.count}> {tab.count}</span>
                ) : null}
              </span>
              {tab.help && !isMobile ? <span style={styles.tabHelp}>{tab.help}</span> : null}
            </button>
          );
        })}
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        style={styles.search}
      />
      {hint ? <p style={styles.hint}>{hint}</p> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.9rem 1rem',
    boxShadow: 'var(--shadow-card)',
  },
  tabs: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' },
  tabsMobile: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.4rem',
  },
  tab: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.7rem 0.55rem',
    minHeight: 'var(--touch-min)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'grid',
    gap: '0.2rem',
  },
  tabActive: {
    border: '2px solid var(--accent)',
    borderRadius: 'var(--radius-md)',
    padding: '0.65rem 0.5rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'grid',
    gap: '0.2rem',
  },
  tabLabel: { fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.2 },
  tabHelp: { fontSize: '0.72rem', fontWeight: 600, opacity: 0.85, lineHeight: 1.25 },
  count: {
    display: 'inline-block',
    marginLeft: 4,
    minWidth: 22,
    padding: '0 6px',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontSize: '0.85rem',
    fontWeight: 800,
    textAlign: 'center',
  },
  countActive: {
    display: 'inline-block',
    marginLeft: 4,
    minWidth: 22,
    padding: '0 6px',
    borderRadius: 999,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 800,
    textAlign: 'center',
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-full)',
    padding: '0.75rem 1rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
};
