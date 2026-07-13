import type { CSSProperties } from 'react';
import { Banner, Button, TextField } from '@/shared/ui';
import { useLoginForm } from '../hooks/useLoginForm';

export function LoginPage() {
  const { phone, setPhone, password, setPassword, error, submitting, submit } = useLoginForm();

  return (
    <div style={styles.shell}>
      <div style={styles.panel}>
        <div style={styles.hero}>
          <p style={styles.brand}>HyperLocalMart</p>
          <h1 style={styles.heroTitle}>Vendor workspace</h1>
          <p style={styles.heroSub}>Accept orders, mark ready for pickup, keep listings fresh.</p>
        </div>
        <div style={styles.card}>
          <h2 style={styles.title}>Sign in</h2>
          <p style={styles.sub}>Manage orders and mark items ready for hub pickup.</p>

          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="username"
            inputMode="numeric"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />

          {error ? <Banner tone="danger">{error}</Banner> : null}

          <Button size="lg" fullWidth disabled={submitting} onClick={() => void submit()}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <p style={styles.hint}>Pilot: 9876500001 / password (Ravi Kirana)</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' },
  panel: {
    width: 'min(880px, 100%)',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
  },
  hero: {
    background: 'linear-gradient(155deg, var(--accent) 0%, #146B3A 60%, #0f5132 100%)',
    color: 'var(--text-inverse)',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem 1.75rem',
    display: 'grid',
    alignContent: 'end',
    gap: '0.5rem',
    minHeight: 260,
    boxShadow: 'var(--shadow-elevated)',
  },
  brand: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.35rem' },
  heroTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.7rem, 3.5vw, 2.2rem)',
    fontWeight: 800,
    lineHeight: 1.15,
  },
  heroSub: { margin: 0, opacity: 0.92 },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-soft)',
    padding: '1.75rem',
    display: 'grid',
    gap: '0.85rem',
    alignContent: 'start',
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.55rem', fontWeight: 800 },
  sub: { margin: 0, color: 'var(--text-muted)' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
};
