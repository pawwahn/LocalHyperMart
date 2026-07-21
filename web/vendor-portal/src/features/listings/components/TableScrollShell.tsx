import type { CSSProperties, ReactNode } from 'react';

type Props = {
  label: string;
  maxHeight?: string;
  children: ReactNode;
};

/** Horizontally scrollable table region with sticky-column support. */
export function TableScrollShell({ label, maxHeight = 'min(62vh, 640px)', children }: Props) {
  return (
    <div
      style={{ ...styles.wrap, maxHeight }}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    overflowX: 'auto',
    overflowY: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    touchAction: 'pan-x pan-y',
    minWidth: 0,
    /* Keeps sticky header/columns in one paint layer while scrolling */
    transform: 'translateZ(0)',
    scrollbarGutter: 'stable',
  },
};
