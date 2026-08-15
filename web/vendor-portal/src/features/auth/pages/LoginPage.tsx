import { useState, type CSSProperties } from 'react';
import { Banner, Button, TextField } from '@/shared/ui';
import { useLoginForm } from '../hooks/useLoginForm';
import { forgotPassword, resetPassword } from '../api/authApi';
import { ApiError } from '@/shared/api/http';

type Mode = 'login' | 'forgot' | 'reset';

export function LoginPage() {
  const { phone, setPhone, password, setPassword, error, submitting, submit } = useLoginForm();
  const [mode, setMode] = useState<Mode>('login');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  async function onForgot() {
    setResetError(null);
    setResetInfo(null);
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setResetError('Enter a valid 10-digit phone');
      return;
    }
    setResetBusy(true);
    try {
      await forgotPassword(phone.trim());
      setResetInfo('If this account exists, an OTP was sent. Check user-service logs in pilot.');
      setMode('reset');
    } catch (err) {
      setResetError(err instanceof ApiError || err instanceof Error ? err.message : 'Request failed');
    } finally {
      setResetBusy(false);
    }
  }

  async function onReset() {
    setResetError(null);
    setResetInfo(null);
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    setResetBusy(true);
    try {
      await resetPassword(phone.trim(), otp.trim(), newPassword);
      setResetInfo('Password updated. Sign in with your new password.');
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (err) {
      setResetError(err instanceof ApiError || err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.panel}>
        <div style={styles.hero}>
          <p style={styles.brand}>HyperLocalMart</p>
          <h1 style={styles.heroTitle}>Vendor workspace</h1>
          <p style={styles.heroSub}>Accept orders, mark ready for pickup, keep listings fresh.</p>
        </div>
        <div style={styles.card}>
          {mode === 'login' ? (
            <>
              <h2 style={styles.title}>Sign in</h2>
              <p style={styles.sub}>
                Manage orders and mark items ready for hub pickup. Order sound turns on when you sign
                in.
              </p>

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
              {resetInfo ? <Banner tone="success">{resetInfo}</Banner> : null}

              <Button size="lg" fullWidth disabled={submitting} onClick={() => void submit()}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>

              <button type="button" style={styles.linkBtn} onClick={() => setMode('forgot')}>
                Forgot password?
              </button>

              <p style={styles.hint}>
                Town: Narsaraopet (Andhra Pradesh)
                <br />
                Pilot: 9876500001 / password (Ravi Kirana)
              </p>
            </>
          ) : null}

          {mode === 'forgot' ? (
            <>
              <h2 style={styles.title}>Forgot password</h2>
              <p style={styles.sub}>We will send a 6-digit OTP to reset your password.</p>
              <TextField
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
              />
              {resetError ? <Banner tone="danger">{resetError}</Banner> : null}
              {resetInfo ? <Banner tone="success">{resetInfo}</Banner> : null}
              <Button size="lg" fullWidth disabled={resetBusy} onClick={() => void onForgot()}>
                {resetBusy ? 'Sending…' : 'Send OTP'}
              </Button>
              <button type="button" style={styles.linkBtn} onClick={() => setMode('login')}>
                Back to sign in
              </button>
            </>
          ) : null}

          {mode === 'reset' ? (
            <>
              <h2 style={styles.title}>Reset password</h2>
              <p style={styles.sub}>
                Enter the OTP and a new password (8+ chars, upper, lower, digit, special @$!%*?&).
              </p>
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField
                label="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
              />
              <TextField
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <TextField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {resetError ? <Banner tone="danger">{resetError}</Banner> : null}
              {resetInfo ? <Banner tone="success">{resetInfo}</Banner> : null}
              <Button size="lg" fullWidth disabled={resetBusy} onClick={() => void onReset()}>
                {resetBusy ? 'Updating…' : 'Reset password'}
              </Button>
              <button type="button" style={styles.linkBtn} onClick={() => setMode('forgot')}>
                Resend OTP
              </button>
              <button type="button" style={styles.linkBtn} onClick={() => setMode('login')}>
                Back to sign in
              </button>
            </>
          ) : null}
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
    background: 'linear-gradient(155deg, var(--accent) 0%, var(--accent-hover) 70%)',
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
  linkBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--accent-hover)',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
};
