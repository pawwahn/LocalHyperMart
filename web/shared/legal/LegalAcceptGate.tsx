import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { TermsAcceptBlock } from './TermsAcceptBlock';
import { fetchPublicLegal } from './legalApi';
import {
  fetchLegalUserProfile,
  isSessionExpiredError,
  needsLegalAcceptance,
  postAcceptLegal,
  type LegalUserProfile,
} from './legalUserApi';

type Props = {
  accessToken: string;
  children: ReactNode;
  portalLabel?: string;
  onSignOut?: () => void;
};

export function LegalAcceptGate({ accessToken, children, portalLabel, onSignOut }: Props) {
  const [profile, setProfile] = useState<LegalUserProfile | null>(null);
  const [currentLegalVersion, setCurrentLegalVersion] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [legalVersion, setLegalVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pub = await fetchPublicLegal();
      setCurrentLegalVersion(pub.legalVersion || 1);
      setLegalVersion(pub.legalVersion || 1);
      const prof = await fetchLegalUserProfile(accessToken);
      setProfile(prof);
    } catch (err: unknown) {
      if (isSessionExpiredError(err) && onSignOut) {
        onSignOut();
        return;
      }
      setProfile(null);
      setError(err instanceof Error ? err.message : 'Could not load legal status');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Loading policies…</p>
      </div>
    );
  }

  if (error && !profile) {
    const backendHint =
      error.includes('api-gateway') ||
      error.includes('user-service') ||
      error.includes('Network error') ||
      error.includes('unreachable') ||
      error.includes('timed out') ||
      error.includes('Server error');
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.title}>{backendHint ? 'Cannot open workspace' : 'Something went wrong'}</h1>
          <p style={styles.error}>{error}</p>
          {backendHint ? (
            <p style={styles.hint}>
              Delivery (5174) and Super Admin (5176) need <strong>api-gateway :8080</strong> and{' '}
              <strong>user-service :8080→8081</strong>. Start backend with{' '}
              <code style={styles.code}>.\scripts\start-dev.ps1</code> or restart user-service.
            </p>
          ) : (
            <p style={styles.hint}>If this keeps happening, sign out and sign in again.</p>
          )}
          <div style={styles.actions}>
            <button type="button" style={styles.btn} onClick={() => void load()}>
              Retry
            </button>
            {onSignOut ? (
              <button type="button" style={styles.ghost} onClick={onSignOut}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (profile && !needsLegalAcceptance(profile, currentLegalVersion)) {
    return <>{children}</>;
  }

  async function onContinue() {
    if (!accepted) return;
    setBusy(true);
    setError(null);
    try {
      await postAcceptLegal(accessToken, legalVersion);
      setProfile({
        ...(profile ?? { roles: [] }),
        termsVersion: legalVersion,
        termsAcceptedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <h1 style={styles.title}>Updated policies</h1>
        <p style={styles.sub}>
          {portalLabel ? `${portalLabel}: ` : ''}
          Please read and accept the current Terms, Privacy and Refund policies to continue.
        </p>
        <TermsAcceptBlock
          accepted={accepted}
          onAcceptedChange={setAccepted}
          onVersion={(v) => setLegalVersion(v)}
        />
        {error ? <p style={styles.error}>{error}</p> : null}
        <button type="button" style={styles.btn} disabled={!accepted || busy} onClick={() => void onContinue()}>
          {busy ? 'Saving…' : 'Continue to app'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', background: 'var(--bg)' },
  shell: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', background: 'var(--bg)' },
  card: {
    width: 'min(520px, 100%)',
    display: 'grid',
    gap: '0.65rem',
    padding: '1rem',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  title: { margin: 0, fontSize: '1.15rem', fontWeight: 800 },
  sub: { margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.4 },
  hint: { margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.4 },
  code: { fontSize: '0.78rem' },
  muted: { margin: 0, fontWeight: 700, color: 'var(--text-muted)' },
  error: { margin: 0, color: 'var(--danger, #b91c1c)', fontWeight: 700, fontSize: '0.85rem' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  btn: {
    minHeight: 44,
    border: 'none',
    borderRadius: 12,
    padding: '0 1rem',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  ghost: {
    minHeight: 44,
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0 1rem',
    background: 'transparent',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
