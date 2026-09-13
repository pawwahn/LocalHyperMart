import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  compact?: boolean;
};

export function LegalLinks({ compact }: Props) {
  return (
    <div style={compact ? styles.compact : styles.row}>
      <Link to="/legal/terms" style={styles.link}>
        Terms
      </Link>
      <Link to="/legal/privacy" style={styles.link}>
        Privacy
      </Link>
      <Link to="/legal/refund" style={styles.link}>
        Refund
      </Link>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', flexWrap: 'wrap', gap: '0.65rem', fontSize: '0.82rem' },
  compact: { display: 'inline-flex', flexWrap: 'wrap', gap: '0.55rem', fontSize: '0.82rem' },
  link: { color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'underline' },
};
