import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Button, TextField } from '@/shared/ui';
import { useAuthForms } from '../hooks/useAuthForms';
import { useTown } from '@/shared/town/TownContext';
import { TownPickerSheet } from '@/features/towns/components/TownPickerSheet';

export function LoginPage() {
  const f = useAuthForms();
  const { townLabel, openPicker, towns, loading: townsLoading } = useTown();
  const settings = f.publicSettings;

  return (
    <div style={styles.shell}>
      <TownPickerSheet />
      <div style={styles.panel}>
        <div style={styles.hero}>
          <p style={styles.brand}>HyperLocalMart</p>
          <h1 style={styles.heroTitle}>Fresh from your town</h1>
          <p style={styles.heroSub}>Neighborhood vendors · same-day delivery · pay on delivery</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>{f.mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p style={styles.sub}>Choose your town, then shop from local vendors.</p>

          <button type="button" style={styles.townSelect} onClick={openPicker}>
            <span style={styles.townSelectLabel}>Your town</span>
            <span style={styles.townSelectValue}>
              {townsLoading && towns.length === 0 ? 'Loading…' : townLabel}
            </span>
            <span style={styles.townSelectHint}>Tap to change</span>
          </button>

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

          {f.mode === 'register' ? (
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={f.acceptedTerms}
                onChange={(e) => f.setAcceptedTerms(e.target.checked)}
              />
              <span>
                I agree to{' '}
                {settings?.termsUrl ? (
                  <a href={settings.termsUrl} target="_blank" rel="noreferrer" style={styles.inlineLink}>
                    Terms
                  </a>
                ) : (
                  'Terms'
                )}
                ,{' '}
                {settings?.privacyUrl ? (
                  <a href={settings.privacyUrl} target="_blank" rel="noreferrer" style={styles.inlineLink}>
                    Privacy
                  </a>
                ) : (
                  'Privacy'
                )}
                {' & '}
                {settings?.refundUrl ? (
                  <a href={settings.refundUrl} target="_blank" rel="noreferrer" style={styles.inlineLink}>
                    Refund policy
                  </a>
                ) : (
                  'Refund policy'
                )}
              </span>
            </label>
          ) : null}

          {settings?.supportPhone ? (
            <p style={styles.supportLine}>
              Need help? Call{' '}
              <a href={`tel:${settings.supportPhone}`} style={styles.inlineLink}>
                {settings.supportPhone}
              </a>
            </p>
          ) : null}

          {f.error ? <Banner tone="danger">{f.error}</Banner> : null}

          <Button
            size="lg"
            fullWidth
            disabled={f.submitting || (f.mode === 'register' && !f.acceptedTerms)}
            onClick={() => void f.submit()}
          >
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

          {(settings?.termsUrl || settings?.privacyUrl || settings?.refundUrl || settings?.grievanceOfficer) ? (
            <div style={styles.legalRow}>
              {settings.termsUrl ? (
                <a href={settings.termsUrl} target="_blank" rel="noreferrer" style={styles.legalLink}>
                  Terms
                </a>
              ) : null}
              {settings.privacyUrl ? (
                <a href={settings.privacyUrl} target="_blank" rel="noreferrer" style={styles.legalLink}>
                  Privacy
                </a>
              ) : null}
              {settings.refundUrl ? (
                <a href={settings.refundUrl} target="_blank" rel="noreferrer" style={styles.legalLink}>
                  Refund
                </a>
              ) : null}
              {settings.grievanceOfficer ? (
                <span style={styles.legalMuted}>Grievance: {settings.grievanceOfficer}</span>
              ) : null}
            </div>
          ) : null}

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
  townSelect: {
    display: 'grid',
    gap: '0.15rem',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
    padding: '0.75rem 0.9rem',
    cursor: 'pointer',
  },
  townSelectLabel: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' },
  townSelectValue: { fontWeight: 800, color: 'var(--text)', fontSize: '1rem' },
  townSelectHint: { fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  check: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  inlineLink: { color: 'var(--accent)', fontWeight: 700 },
  supportLine: {
    margin: 0,
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
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
  legalRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    fontSize: '0.82rem',
  },
  legalLink: {
    color: 'var(--text-muted)',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  legalMuted: {
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.82rem',
  },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
};
