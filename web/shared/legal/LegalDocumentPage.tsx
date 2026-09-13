import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchPublicLegal,
  formatLegalStamp,
  legalBody,
  legalTitle,
  type LegalDocKey,
  type PublicLegal,
} from './legalApi';

const KEYS: LegalDocKey[] = ['terms', 'privacy', 'refund'];

function asKey(raw: string | undefined): LegalDocKey {
  if (raw === 'privacy' || raw === 'refund' || raw === 'terms') return raw;
  return 'terms';
}

type Props = {
  homeTo?: string;
};

export function LegalDocumentPage({ homeTo = '/' }: Props) {
  const { doc } = useParams();
  const key = asKey(doc);
  const [legal, setLegal] = useState<PublicLegal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPublicLegal()
      .then((row) => {
        if (alive) setLegal(row);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load policies');
      });
    return () => {
      alive = false;
    };
  }, []);

  const body = legal ? legalBody(legal, key) : '';

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <div style={styles.top}>
          <Link to={homeTo} style={styles.back}>
            ← Back
          </Link>
          <span style={styles.stamp}>{legal ? formatLegalStamp(legal) : '…'}</span>
        </div>
        <div style={styles.tabs}>
          {KEYS.map((k) => (
            <Link key={k} to={`/legal/${k}`} style={k === key ? styles.tabOn : styles.tab}>
              {k === 'terms' ? 'Terms' : k === 'privacy' ? 'Privacy' : 'Refund'}
            </Link>
          ))}
        </div>
        <h1 style={styles.title}>{legalTitle(key)}</h1>
        {error ? <p style={styles.error}>{error}</p> : null}
        <pre style={styles.body}>{body || (error ? '' : 'Loading…')}</pre>
        {legal?.supportPhone ? (
          <p style={styles.support}>
            Support{' '}
            <a href={`tel:${legal.supportPhone}`} style={styles.phone}>
              {legal.supportPhone}
            </a>
            {legal.grievanceOfficer ? ` · Grievance: ${legal.grievanceOfficer}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    padding: '0.75rem',
    background: 'var(--bg)',
  },
  card: {
    width: 'min(720px, 100%)',
    margin: '0 auto',
    display: 'grid',
    gap: '0.45rem',
  },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' },
  back: { color: 'var(--accent)', fontWeight: 800, textDecoration: 'none', fontSize: '0.88rem' },
  stamp: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 },
  tabs: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  tab: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    minHeight: 36,
    display: 'inline-grid',
    placeItems: 'center',
  },
  tabOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft, #E7F6EC)',
    borderRadius: 999,
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--accent-hover, var(--accent))',
    textDecoration: 'none',
    minHeight: 36,
    display: 'inline-grid',
    placeItems: 'center',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    fontWeight: 800,
  },
  error: { margin: 0, color: 'var(--danger, #b91c1c)', fontWeight: 700, fontSize: '0.85rem' },
  body: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'var(--font-sans, inherit)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
    color: 'var(--text)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.7rem 0.8rem',
    maxHeight: '70vh',
    overflow: 'auto',
  },
  support: { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' },
  phone: { color: 'var(--accent)', fontWeight: 800 },
};
