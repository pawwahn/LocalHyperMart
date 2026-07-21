import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { LoginThemeCorner } from '@hlm-theme';
import { Banner, Button, TextField } from '@/shared/ui';
import { useAuthForms } from '../hooks/useAuthForms';

export function LoginPage() {
  const f = useAuthForms();

  return (
    <div style={styles.shell}>
      <LoginThemeCorner />
      <div style={styles.panel}>
        <div style={styles.hero}>
          <p style={styles.brand}>HyperLocalMart</p>
          <h1 style={styles.heroTitle}>Fresh from your town</h1>
          <p style={styles.heroSub}>Neighborhood vendors · same-day delivery · pay on delivery</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>{f.mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p style={styles.sub}>Shop local from Narsaraopet vendors.</p>

          {f.mode === 'register' ? (
            <div style={styles.row}>
              <TextField
                label="First name"
                value={f.firstName}
                onChange={(e) => f.setFirstName(e.target.value)}
              />
              <TextField label="Last name" value={f.lastName} onChange={(e) => f.setLastName(e.target.value)} />
            </div>
          ) : null}

          <TextField label="Phone" value={f.phone} onChange={(e) => f.setPhone(e.target.value)} />
          <TextField
            label="Password"
            type="password"
            value={f.password}
            onChange={(e) => f.setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void f.submit();
            }}
          />

          {f.error ? <Banner tone="danger">{f.error}</Banner> : null}

          <Button size="lg" fullWidth disabled={f.submitting} onClick={() => void f.submit()}>
            {f.submitting ? 'Please wait…' : f.mode === 'login' ? 'Sign in' : 'Register & shop'}
          </Button>

          <button
            type="button"
            style={styles.linkBtn}
            onClick={() => f.setMode(f.mode === 'login' ? 'register' : 'login')}
          >
            {f.mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </button>

          <Link to="/shop" style={styles.browse}>
            Continue browsing as guest →
          </Link>

          <p style={styles.hint}>
            Register once if needed. New password needs upper + lower + digit + special (e.g.{' '}
            <code>Buyer@123</code>). Seeded buyer may use <code>password</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '1.5rem',
  },
  panel: {
    width: 'min(920px, 100%)',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
    alignItems: 'stretch',
  },
  hero: {
    background:
      'linear-gradient(155deg, var(--accent) 0%, #146B3A 55%, #0f5132 100%)',
    color: 'var(--text-inverse)',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem 1.75rem',
    display: 'grid',
    alignContent: 'end',
    gap: '0.55rem',
    minHeight: 280,
    boxShadow: 'var(--shadow-elevated)',
  },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.5rem',
    letterSpacing: '-0.02em',
  },
  heroTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
    fontWeight: 800,
    lineHeight: 1.15,
  },
  heroSub: { margin: 0, opacity: 0.92, maxWidth: 280 },
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
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.65rem', fontWeight: 800 },
  sub: { margin: 0, color: 'var(--text-muted)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    fontWeight: 600,
  },
  browse: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.92rem',
  },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
};
