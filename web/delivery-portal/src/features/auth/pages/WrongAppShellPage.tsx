import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { readDeliveryShell } from '@hlm-native';

/** Shown when APK shell (hub vs agent) does not match signed-in role. */
export function WrongAppShellPage() {
  const shell = readDeliveryShell();
  const expected =
    shell === 'hub' ? 'Hub admin' : shell === 'agent' ? 'Delivery agent' : 'This app';

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Wrong app</h1>
      <p style={styles.body}>
        This install is for <strong>{expected}</strong> accounts. Sign out and use the correct KoyaKart app, or
        sign in with the right role.
      </p>
      <Link to="/login" style={styles.link}>
        Back to sign in
      </Link>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    textAlign: 'center',
    gap: '0.75rem',
  },
  title: { margin: 0, fontSize: '1.35rem' },
  body: { margin: 0, maxWidth: 360, lineHeight: 1.5, color: 'var(--text-muted)' },
  link: { color: 'var(--accent)', fontWeight: 600 },
};
