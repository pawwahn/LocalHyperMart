import { useEffect, useState, type CSSProperties } from 'react';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { changePassword } from '@/features/auth/api/authApi';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { useOrderAlert } from '@/features/orders/OrderAlertContext';
import { playOrderReceivedVoice, unlockOrderAlertAudio } from '@/features/orders/lib/orderAlertSound';

const compactInput: CSSProperties = { padding: '0.45rem 0.65rem', fontSize: '0.9rem' };

export function SettingsPage() {
  const { session, logout } = useAuth();
  const { shop, loading, busy, error: shopError, reload, saveProfile } = useVendorShop();
  const { notificationsReady, enableNotifications } = useOrderAlert();
  const [status, setStatus] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(
    null,
  );

  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setShopName(shop.shopName ?? '');
    setAddress(shop.address ?? '');
    setPincode(shop.pincode ?? '');
  }, [shop]);

  async function onSaveProfile() {
    setStatus(null);
    if (!shopName.trim()) {
      setStatus({ tone: 'danger', text: 'Shop name is required' });
      return;
    }
    if (pincode && !/^\d{6}$/.test(pincode.trim())) {
      setStatus({ tone: 'danger', text: 'Pincode must be 6 digits' });
      return;
    }
    const ok = await saveProfile({
      shopName: shopName.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
    });
    setStatus(
      ok
        ? { tone: 'success', text: 'Shop profile saved' }
        : { tone: 'danger', text: 'Could not save shop profile' },
    );
  }

  async function onChangePassword() {
    if (!session) return;
    setStatus(null);
    if (!currentPassword || !newPassword) {
      setStatus({ tone: 'danger', text: 'Enter current and new password' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ tone: 'danger', text: 'New passwords do not match' });
      return;
    }
    setPwdBusy(true);
    try {
      await changePassword(session.accessToken, currentPassword, newPassword);
      setStatus({ tone: 'success', text: 'Password changed — signing out…' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => logout(), 1000);
    } catch (err) {
      setStatus({
        tone: 'danger',
        text: err instanceof ApiError || err instanceof Error ? err.message : 'Could not change password',
      });
    } finally {
      setPwdBusy(false);
    }
  }

  usePortalChrome({ title: 'Settings', onRefresh: () => void reload() });

  return (
    <>
      {shopError ? <Banner tone="danger">{shopError}</Banner> : null}
      {status ? <Banner tone={status.tone}>{status.text}</Banner> : null}

      <div style={styles.grid}>
        <Card padding="sm" elevated style={styles.panel}>
          <div style={styles.head}>
            <h2 style={styles.heading}>Shop</h2>
            {loading && !shop ? <span style={styles.muted}>Loading…</span> : null}
          </div>
          <TextField
            label="Shop name"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            style={compactInput}
          />
          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={compactInput}
          />
          <div style={styles.row}>
            <TextField
              label="Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              inputMode="numeric"
              style={compactInput}
            />
            <TextField
              label="Phone"
              value={shop?.phone ?? session?.phone ?? ''}
              readOnly
              disabled
              style={compactInput}
            />
          </div>
          <Button size="sm" disabled={busy || loading} onClick={() => void onSaveProfile()}>
            {busy ? 'Saving…' : 'Save shop'}
          </Button>
        </Card>

        <div style={styles.stack}>
          <Card padding="sm" elevated style={styles.panel}>
            <h2 style={styles.heading}>Order alerts</h2>
            <p style={styles.hint}>Test once to unlock sound (works in other tabs). Notifications = Windows popup.</p>
            <div style={styles.btnRow}>
              <Button
                size="sm"
                onClick={() => {
                  void unlockOrderAlertAudio().then((ok) => {
                    playOrderReceivedVoice();
                    setStatus({
                      tone: ok ? 'success' : 'warning',
                      text: ok ? 'Playing “Order received”…' : 'Sound blocked — check volume / click again',
                    });
                  });
                }}
              >
                Test sound
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={notificationsReady}
                onClick={() => {
                  void enableNotifications().then((ok) => {
                    setStatus({
                      tone: ok ? 'success' : 'warning',
                      text: ok
                        ? 'Browser notifications on'
                        : 'Blocked — allow in the address bar, then retry',
                    });
                  });
                }}
              >
                {notificationsReady ? 'Notifications on' : 'Enable notifications'}
              </Button>
            </div>
          </Card>

          <Card padding="sm" elevated style={styles.panel}>
            <h2 style={styles.heading}>Password</h2>
            <p style={styles.hint}>8+ chars with upper, lower, digit, special (@$!%*?&). Signs you out after change.</p>
            <TextField
              label="Current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              style={compactInput}
            />
            <div style={styles.row}>
              <TextField
                label="New"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                style={compactInput}
              />
              <TextField
                label="Confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                style={compactInput}
              />
            </div>
            <Button size="sm" disabled={pwdBusy} onClick={() => void onChangePassword()}>
              {pwdBusy ? 'Updating…' : 'Update password'}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '0.75rem',
    alignItems: 'start',
  },
  stack: { display: 'grid', gap: '0.75rem' },
  panel: { display: 'grid', gap: '0.55rem' },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' },
  heading: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800 },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.35 },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
};
