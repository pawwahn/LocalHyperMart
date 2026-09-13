import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPublicLegal,
  formatLegalStamp,
  legalBody,
  legalTitle,
  type LegalDocKey,
  type PublicLegal,
} from './legalApi';

type Props = {
  accepted: boolean;
  onAcceptedChange: (next: boolean) => void;
  onVersion: (version: number) => void;
};

const KEYS: LegalDocKey[] = ['terms', 'privacy', 'refund'];

export function TermsAcceptBlock({ accepted, onAcceptedChange, onVersion }: Props) {
  const [legal, setLegal] = useState<PublicLegal | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LegalDocKey>('terms');
  const [read, setRead] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchPublicLegal()
      .then((row) => {
        if (!alive) return;
        setLegal(row);
        onVersion(row.legalVersion || 1);
      })
      .catch(() => {
        if (alive) onVersion(1);
      });
    return () => {
      alive = false;
    };
    // Load once per mount; parent stores the version for register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openReader() {
    setTab('terms');
    setOpen(true);
  }

  function agreeFromReader() {
    setRead(true);
    onAcceptedChange(true);
    setOpen(false);
  }

  return (
    <div style={styles.wrap}>
      <button type="button" style={styles.readBtn} onClick={openReader}>
        Read Terms, Privacy & Refund
      </button>
      <label style={styles.check}>
        <input
          type="checkbox"
          checked={accepted}
          disabled={!read}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span>
          I have read and agree to the{' '}
          <Link to="/legal/terms" style={styles.inline} onClick={() => setRead(true)}>
            Terms
          </Link>
          ,{' '}
          <Link to="/legal/privacy" style={styles.inline} onClick={() => setRead(true)}>
            Privacy
          </Link>
          {' & '}
          <Link to="/legal/refund" style={styles.inline} onClick={() => setRead(true)}>
            Refund
          </Link>
          {legal ? ` (${formatLegalStamp(legal)})` : ''}
          {!read ? ' — open them first' : ''}
        </span>
      </label>

      {open ? (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="legal-reader-title">
          <div style={styles.sheet}>
            <div style={styles.sheetTop}>
              <strong id="legal-reader-title" style={styles.sheetTitle}>
                {legalTitle(tab)}
              </strong>
              <span style={styles.stamp}>{legal ? formatLegalStamp(legal) : ''}</span>
            </div>
            <div style={styles.tabs}>
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  style={k === tab ? styles.tabOn : styles.tab}
                  onClick={() => setTab(k)}
                >
                  {k === 'terms' ? 'Terms' : k === 'privacy' ? 'Privacy' : 'Refund'}
                </button>
              ))}
            </div>
            <pre style={styles.body}>{legal ? legalBody(legal, tab) : 'Loading…'}</pre>
            <div style={styles.actions}>
              <button type="button" style={styles.ghost} onClick={() => setOpen(false)}>
                Close
              </button>
              <button type="button" style={styles.agree} onClick={agreeFromReader}>
                I agree
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.35rem' },
  readBtn: {
    justifySelf: 'start',
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft, #E7F6EC)',
    color: 'var(--accent-hover, var(--accent))',
    fontWeight: 800,
    fontSize: '0.82rem',
    borderRadius: 999,
    padding: '0.35rem 0.75rem',
    minHeight: 36,
    cursor: 'pointer',
  },
  check: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'flex-start',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '0.84rem',
  },
  inline: { color: 'var(--accent)', fontWeight: 800 },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
    zIndex: 80,
  },
  sheet: {
    width: 'min(640px, 100%)',
    maxHeight: '92vh',
    background: 'var(--bg-elevated, #fff)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr auto',
    gap: '0.4rem',
    padding: '0.7rem 0.75rem',
  },
  sheetTop: { display: 'flex', justifyContent: 'space-between', gap: '0.4rem', alignItems: 'baseline' },
  sheetTitle: { fontSize: '1rem', fontWeight: 800 },
  stamp: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  tabs: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  tab: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 999,
    padding: '0.22rem 0.65rem',
    fontSize: '0.76rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minHeight: 32,
    cursor: 'pointer',
  },
  tabOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft, #E7F6EC)',
    borderRadius: 999,
    padding: '0.22rem 0.65rem',
    fontSize: '0.76rem',
    fontWeight: 800,
    color: 'var(--accent-hover, var(--accent))',
    minHeight: 32,
    cursor: 'pointer',
  },
  body: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    lineHeight: 1.42,
    overflow: 'auto',
    minHeight: 180,
    maxHeight: '58vh',
    padding: '0.55rem 0.6rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' },
  ghost: {
    border: '1px solid var(--border)',
    background: 'transparent',
    borderRadius: 10,
    minHeight: 44,
    padding: '0 0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--text)',
  },
  agree: {
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--text-inverse, #fff)',
    borderRadius: 10,
    minHeight: 44,
    padding: '0 1rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
