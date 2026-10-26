import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'hlm.cookie.notice.v1';

type Props = {
  privacyTo?: string;
};

/** India-first notice for essential storage; not a GDPR opt-in wall. */
export function CookieNotice({ privacyTo = '/legal/privacy' }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div style={styles.bar} role="dialog" aria-label="Storage notice">
      <p style={styles.text}>
        We use browser storage for login, your town, and cart — not ad tracking.{' '}
        <Link to={privacyTo} style={styles.link}>
          Privacy
        </Link>
      </p>
      <button type="button" style={styles.btn} onClick={dismiss}>
        OK
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    position: 'fixed',
    left: 'max(0.5rem, env(safe-area-inset-left))',
    right: 'max(0.5rem, env(safe-area-inset-right))',
    bottom: 'max(0.55rem, env(safe-area-inset-bottom))',
    zIndex: 9000,
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.7rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
  },
  text: { margin: 0, flex: 1, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' },
  link: { color: 'var(--accent)', fontWeight: 800 },
  btn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.35rem 0.75rem',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
