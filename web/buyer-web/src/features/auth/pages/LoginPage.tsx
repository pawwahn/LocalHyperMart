import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { LegalLinks, TermsAcceptBlock } from '@hlm-legal';
import { Banner, Button, TextField } from '@/shared/ui';
import { useAuthForms } from '../hooks/useAuthForms';
import { useTown } from '@/shared/town/TownContext';
import { TownPickerSheet } from '@/features/towns/components/TownPickerSheet';
import { BrandMark } from '@hlm-brand';
import { APP_NAME } from '@/shared/brand';

const HERO_CHIPS = ['Kirana', 'Fresh', 'Pharmacy', 'Home'];

const LOGIN_FIT_CSS = `
.hlm-login {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 100vh;
  min-height: 100dvh;
  min-height: 100svh;
  height: 100svh;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: max(0.55rem, env(safe-area-inset-top, 0px)) max(0.6rem, env(safe-area-inset-right, 0px)) max(0.55rem, env(safe-area-inset-bottom, 0px)) max(0.6rem, env(safe-area-inset-left, 0px));
}
.hlm-login.hlm-login--register {
  height: auto;
  min-height: 100svh;
}
.hlm-login-panel {
  position: relative;
  flex: 0 1 auto;
  width: 100%;
  max-width: 26.5rem;
  min-width: 0;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.hlm-login-hero {
  flex: 0 0 auto;
  min-height: 13rem;
  padding: 0.95rem 1rem 1rem;
  border-radius: 22px;
}
.hlm-login-brand {
  font-size: clamp(2.05rem, 9vw, 2.7rem) !important;
  font-weight: 800 !important;
  letter-spacing: -0.035em !important;
  line-height: 1.05 !important;
}
.hlm-login-hero h1 {
  font-family: var(--font-display) !important;
  font-size: clamp(1.45rem, 6.2vw, 1.85rem) !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
  line-height: 1.15 !important;
}
.hlm-login-hero-rest {
  display: block !important;
  margin-top: 0.12rem !important;
  font-family: var(--font-display) !important;
  font-size: clamp(0.98rem, 3.8vw, 1.12rem) !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  line-height: 1.3 !important;
}
.hlm-login-card {
  flex: 0 0 auto;
  border-radius: 22px !important;
}
.hlm-login-field { min-width: 0; }
.hlm-login-field input {
  min-width: 0 !important;
  min-height: 44px;
  padding: 0.62rem 0.8rem !important;
}
.hlm-login-cta { min-height: 46px !important; }
.hlm-login-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.45rem;
  min-width: 0;
}
@media (orientation: landscape) and (max-height: 500px) {
  .hlm-login-panel {
    max-width: 100%;
    flex-direction: row;
    align-items: stretch;
  }
  .hlm-login-hero,
  .hlm-login-card {
    flex: 1 1 0;
    min-height: 0;
  }
}
@media (min-width: 860px) and (min-height: 640px) {
  .hlm-login-panel {
    max-width: 920px;
    flex-direction: row;
    align-items: stretch;
    gap: 0.7rem;
  }
  .hlm-login-hero,
  .hlm-login-card {
    flex: 1 1 0;
    min-height: 0;
  }
  .hlm-login-hero h1 { font-size: clamp(1.55rem, 3.6vw, 1.95rem) !important; }
  .hlm-login-hero-rest { font-size: clamp(1.02rem, 2.2vw, 1.18rem) !important; }
}
`;

export function LoginPage() {
  const f = useAuthForms();
  const { townLabel, openPicker, towns, loading: townsLoading } = useTown();
  const settings = f.publicSettings;
  const login = f.mode === 'login';

  return (
    <div className={`hlm-login${login ? '' : ' hlm-login--register'}`} style={styles.shell}>
      <style>{LOGIN_FIT_CSS}</style>
      <TownPickerSheet />
      <div className="hlm-login-panel">
        <div className="hlm-login-hero" style={styles.hero}>
          <div style={styles.orbA} aria-hidden />
          <div style={styles.orbB} aria-hidden />
          <div style={styles.heroTop}>
            <BrandMark variant="login" fallbackName={APP_NAME} className="hlm-login-brand" style={styles.brand} />
            <span style={styles.heroChip}>Same-day</span>
          </div>
          <p style={styles.heroKicker}>Not just groceries</p>
          <h1 style={styles.heroTitle}>
            Everything
            <span className="hlm-login-hero-rest" style={styles.heroTitleRest}>
              from shops in your town
            </span>
          </h1>
          <p style={styles.heroSub}>Local vendors · COD or UPI · no dark-store markup</p>
          <div style={styles.chipRow}>
            {HERO_CHIPS.map((chip) => (
              <span key={chip} style={styles.pill}>
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="hlm-login-card" style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.title}>{login ? 'Welcome back' : 'Create account'}</h2>
            <p style={styles.sub}>{login ? 'Pick your town and jump in.' : 'One town. Local shops. Fast.'}</p>
          </div>

          <button type="button" style={styles.townSelect} onClick={openPicker}>
            <span style={styles.pin} aria-hidden>
              ◎
            </span>
            <span style={styles.townCopy}>
              <span style={styles.townSelectLabel}>Your town</span>
              <span style={styles.townSelectValue}>
                {townsLoading && towns.length === 0 ? 'Loading…' : townLabel}
              </span>
            </span>
            <span style={styles.townSelectHint}>Change</span>
          </button>

          {login ? null : (
            <div className="hlm-login-row">
              <div className="hlm-login-field">
                <TextField
                  label="First name"
                  value={f.firstName}
                  onChange={(e) => f.setFirstName(e.target.value)}
                />
              </div>
              <div className="hlm-login-field">
                <TextField label="Last name" value={f.lastName} onChange={(e) => f.setLastName(e.target.value)} />
              </div>
            </div>
          )}

          {!login && settings?.referralsEnabled ? (
            <div className="hlm-login-field">
              <TextField
                label="Friend’s referral code (optional)"
                value={f.referralCode}
                onChange={(e) => f.setReferralCode(e.target.value)}
                placeholder="e.g. HLM1A2B3C"
              />
            </div>
          ) : null}

          <div className="hlm-login-row">
            <div className="hlm-login-field">
              <TextField label="Phone" value={f.phone} onChange={(e) => f.setPhone(e.target.value)} inputMode="tel" />
            </div>
            <div className="hlm-login-field">
              <TextField
                label="Password"
                type="password"
                value={f.password}
                onChange={(e) => f.setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void f.submit();
                }}
              />
            </div>
          </div>

          {!login ? (
            <TermsAcceptBlock
              accepted={f.acceptedTerms}
              onAcceptedChange={f.setAcceptedTerms}
              onVersion={f.setLegalVersion}
            />
          ) : null}

          {f.error ? <Banner tone="danger">{f.error}</Banner> : null}

          <Button
            className="hlm-login-cta"
            size="lg"
            fullWidth
            disabled={f.submitting || (!login && !f.acceptedTerms)}
            onClick={() => void f.submit()}
            style={styles.cta}
          >
            {f.submitting ? 'Please wait…' : login ? 'Sign in' : 'Register & shop'}
          </Button>

          <div style={styles.actions}>
            <button type="button" style={styles.linkBtn} onClick={() => f.setMode(login ? 'register' : 'login')}>
              {login ? 'Need an account? Register' : 'Have an account? Sign in'}
            </button>
            <Link to="/shop" style={styles.browse}>
              Browse as guest →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    background:
      'radial-gradient(1200px 520px at 8% -10%, #D8F5DE 0%, transparent 55%), radial-gradient(900px 480px at 110% 10%, #FFF3B0 0%, transparent 46%), #F3F6F4',
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(160deg, #064E16 0%, #0C831F 48%, #149A2C 78%, #C9A227 130%)',
    color: '#fff',
    display: 'grid',
    alignContent: 'end',
    gap: '0.38rem',
    boxShadow: '0 18px 40px rgba(6, 78, 22, 0.28)',
  },
  orbA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: '50%',
    right: -40,
    top: -50,
    background: 'radial-gradient(circle, rgba(247,206,70,0.55) 0%, rgba(247,206,70,0) 70%)',
    pointerEvents: 'none',
  },
  orbB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: '50%',
    left: -36,
    bottom: -40,
    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
    pointerEvents: 'none',
  },
  heroTop: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.45rem',
    minWidth: 0,
  },
  heroChip: {
    flexShrink: 0,
    background: '#F7CE46',
    color: '#1A1C1A',
    fontSize: '0.66rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderRadius: 999,
    padding: '0.28rem 0.55rem',
    marginTop: '0.28rem',
  },
  brand: {
    margin: 0,
    minWidth: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 'clamp(2.05rem, 9vw, 2.7rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.035em',
    opacity: 1,
  },
  heroKicker: {
    position: 'relative',
    margin: '0.28rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#F7CE46',
  },
  heroTitle: {
    position: 'relative',
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.45rem, 6.2vw, 1.85rem)',
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
  },
  heroTitleRest: {
    display: 'block',
    marginTop: '0.12rem',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(0.98rem, 3.8vw, 1.12rem)',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    opacity: 0.94,
  },
  heroSub: {
    position: 'relative',
    margin: '0.55rem 0 0',
    fontFamily: 'var(--font-body)',
    opacity: 0.9,
    fontSize: '0.8rem',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0',
  },
  chipRow: { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.28rem' },
  pill: {
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.18rem 0.48rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.12)',
  },
  card: {
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid rgba(228,231,234,0.9)',
    boxShadow: '0 16px 40px rgba(16, 24, 16, 0.08)',
    padding: '0.9rem 0.95rem 0.85rem',
    display: 'grid',
    gap: '0.45rem',
    alignContent: 'start',
    minWidth: 0,
  },
  cardHead: { display: 'grid', gap: '0.1rem' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  townSelect: {
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '0.5rem',
    textAlign: 'left',
    border: '1px solid #D7E8DA',
    borderRadius: 14,
    background: 'linear-gradient(180deg, #F4FBF5 0%, #EEF6F0 100%)',
    padding: '0.45rem 0.65rem',
    cursor: 'pointer',
    minHeight: 48,
    minWidth: 0,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: 'grid',
    placeItems: 'center',
    background: '#0C831F',
    color: '#F7CE46',
    fontWeight: 800,
    fontSize: '0.95rem',
  },
  townCopy: { display: 'grid', gap: 1, minWidth: 0 },
  townSelectLabel: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  townSelectValue: {
    fontWeight: 800,
    color: 'var(--text)',
    fontSize: '0.95rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  townSelectHint: {
    fontSize: '0.72rem',
    color: '#0C831F',
    fontWeight: 800,
    background: '#E7F6EC',
    borderRadius: 999,
    padding: '0.22rem 0.5rem',
    flexShrink: 0,
  },
  cta: {
    boxShadow: '0 10px 22px rgba(12, 131, 31, 0.28)',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.3rem 0.75rem',
    alignItems: 'center',
    minWidth: 0,
  },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    fontWeight: 700,
    fontSize: '0.82rem',
  },
  browse: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: '0.82rem',
  },
};
