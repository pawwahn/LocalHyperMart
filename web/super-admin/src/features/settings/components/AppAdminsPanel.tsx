import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog, TextField } from '@/shared/ui';
import {
  inviteAppAdmin,
  listAppAdmins,
  patchAppAdminRole,
  revokeAppAdminAccess,
  resetAppAdminPassword,
  type AppAdminRole,
  type AppAdminUserVm,
} from '../api/appAdminsApi';

type Props = {
  token: string;
};

const ROLE_OPTIONS: { id: AppAdminRole; label: string }[] = [
  { id: 'APP_ADMIN_WRITE', label: 'Write — towns, hubs, vendors' },
  { id: 'APP_ADMIN_READ', label: 'Read — view + bills, no pays' },
];

function roleLabel(role: string): string {
  if (role === 'SUPER_ADMIN') return 'Super admin';
  if (role === 'APP_ADMIN_WRITE') return 'Write';
  if (role === 'APP_ADMIN_READ') return 'Read';
  return role;
}

export function AppAdminsPanel({ token }: Props) {
  const [items, setItems] = useState<AppAdminUserVm[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteRole, setInviteRole] = useState<AppAdminRole>('APP_ADMIN_READ');
  const [revokeTarget, setRevokeTarget] = useState<AppAdminUserVm | null>(null);
  const [resetTarget, setResetTarget] = useState<AppAdminUserVm | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listAppAdmins(token));
    } catch (err) {
      const raw = err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load app admins';
      const hint =
        err instanceof ApiError && err.status === 500
          ? `${raw} — rebuild and restart user-service (Flyway V16 app admin roles), then refresh.`
          : raw;
      setError(hint);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onInvite() {
    const p = phone.trim();
    if (!/^[6-9]\d{9}$/.test(p)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await inviteAppAdmin(token, {
        phone: p,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        password: password.trim() || undefined,
        role: inviteRole,
      });
      setNotice(`${created.phone} · ${roleLabel(created.platformRole)}`);
      setShowInvite(false);
      setPhone('');
      setFirstName('');
      setLastName('');
      setPassword('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRoleChange(user: AppAdminUserVm, role: AppAdminRole) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await patchAppAdminRole(token, user.userId, role);
      setNotice(`${user.phone} is now ${roleLabel(role)}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update role');
    } finally {
      setBusy(false);
    }
  }

  async function onResetConfirm() {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resetAppAdminPassword(token, resetTarget.userId, resetPassword.trim());
      setNotice(`Password updated for ${resetTarget.phone}. Share the new password once — they should change it after login.`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeConfirm() {
    if (!revokeTarget) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await revokeAppAdminAccess(token, revokeTarget.userId);
      setNotice(`Removed app admin access for ${revokeTarget.phone}`);
      setRevokeTarget(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.stack}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card padding="sm">
        <div style={styles.headRow}>
          <div>
            <h2 style={styles.title}>App admins</h2>
            <p style={styles.hint}>
              Super admin can invite read/write logins for this portal. Money actions stay super-admin only.
            </p>
          </div>
          <Button size="sm" variant={showInvite ? 'secondary' : 'primary'} disabled={busy} onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? 'Close' : 'Invite admin'}
          </Button>
        </div>
      </Card>

      {showInvite ? (
        <Card padding="sm" style={styles.inviteCard}>
          <p style={styles.hint}>
            New phone needs first name and password (min 8 chars). Existing users get the role; password is optional to reset.
          </p>
          <div style={styles.formGrid}>
            <TextField label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <TextField label="Last name (optional)" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label style={styles.field}>
              Role
              <select style={styles.select} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AppAdminRole)} disabled={busy}>
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={styles.inviteActions}>
            <Button disabled={busy} onClick={() => void onInvite()}>
              {busy ? 'Saving…' : 'Save login'}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card padding="sm">
        {loading ? (
          <p style={styles.hint}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={styles.hint}>No app admins yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Status</th>
                <th style={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.userId}>
                  <td style={styles.td}>{u.phone}</td>
                  <td style={styles.td}>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td style={styles.td}>
                    {u.manageable ? (
                      <select
                        style={styles.selectCompact}
                        value={u.platformRole}
                        disabled={busy}
                        onChange={(e) => void onRoleChange(u, e.target.value as AppAdminRole)}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      roleLabel(u.platformRole)
                    )}
                  </td>
                  <td style={styles.td}>{u.status ?? '—'}</td>
                  <td style={styles.tdRight}>
                    <div style={styles.actionRow}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setResetPassword('');
                          setError(null);
                          setResetTarget(u);
                        }}
                      >
                        Reset password
                      </Button>
                      {u.manageable ? (
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => setRevokeTarget(u)}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={resetTarget != null}
        title="Reset portal password?"
        description={
          resetTarget ? (
            <div style={styles.resetDlg}>
              <p style={styles.resetHint}>
                Set a new password for <strong>{resetTarget.phone}</strong> ({roleLabel(resetTarget.platformRole)}).
              </p>
              <TextField
                label="New password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          ) : null
        }
        confirmLabel="Update password"
        busy={busy}
        confirmDisabled={resetPassword.trim().length < 8}
        onClose={() => {
          setResetTarget(null);
          setResetPassword('');
        }}
        onConfirm={() => void onResetConfirm()}
      />

      <ConfirmDialog
        open={revokeTarget != null}
        title="Revoke app admin?"
        description={
          revokeTarget
            ? `${revokeTarget.phone} will lose read/write portal access. Other roles (buyer, vendor, etc.) are unchanged.`
            : ''
        }
        confirmLabel="Revoke"
        busy={busy}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void onRevokeConfirm()}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 700 },
  hint: { margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  inviteCard: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))',
    gap: '0.5rem 0.65rem',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 600 },
  select: {
    padding: '0.35rem 0.45rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: '0.82rem',
  },
  selectCompact: {
    padding: '0.25rem 0.35rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: '0.78rem',
    maxWidth: '100%',
  },
  inviteActions: { display: 'flex', gap: '0.5rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { textAlign: 'left', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 },
  thRight: { textAlign: 'right', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 },
  td: { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' },
  tdRight: { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', verticalAlign: 'middle' },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem' },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' },
  resetDlg: { display: 'flex', flexDirection: 'column', gap: '0.55rem', textAlign: 'left' },
  resetHint: { margin: 0, fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--text)' },
};
