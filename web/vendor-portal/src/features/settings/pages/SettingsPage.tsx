import { useEffect, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { changePassword } from '@/features/auth/api/authApi';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { useOrderAlert } from '@/features/orders/OrderAlertContext';
import { playOrderReceivedVoice, unlockOrderAlertAudio } from '@/features/orders/lib/orderAlertSound';

export function SettingsPage() {
  const { session, logout } = useAuth();
  const { shop, loading, busy, error: shopError, reload, saveProfile } = useVendorShop();
  const { notificationsReady, enableNotifications } = useOrderAlert();
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [soundMsg, setSoundMsg] = useState<string | null>(null);

  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  useEffect(() => {
    if (!shop) return;
    setShopName(shop.shopName ?? '');
    setAddress(shop.address ?? '');
    setPincode(shop.pincode ?? '');
  }, [shop]);

  async function onSaveProfile() {
    setProfileMsg(null);
    setProfileErr(null);
    if (!shopName.trim()) {
      setProfileErr('Shop name is required');
      return;
    }
    if (pincode && !/^\d{6}$/.test(pincode.trim())) {
      setProfileErr('Pincode must be 6 digits');
      return;
    }
    const ok = await saveProfile({
      shopName: shopName.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
    });
    if (ok) setProfileMsg('Shop profile saved');
  }

  async function onChangePassword() {
    if (!session) return;
    setPwdMsg(null);
    setPwdErr(null);
    if (!currentPassword || !newPassword) {
      setPwdErr('Enter current and new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr('New passwords do not match');
      return;
    }
    setPwdBusy(true);
    try {
      await changePassword(session.accessToken, currentPassword, newPassword);
      setPwdMsg('Password changed. Please sign in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => logout(), 1200);
    } catch (err) {
      setPwdErr(err instanceof ApiError || err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <PortalShell title="Settings" onRefresh={() => void reload()}>
      {shopError ? <Banner tone="danger">{shopError}</Banner> : null}

      <Card elevated style={styles.card}>
        <h2 style={styles.heading}>Shop profile</h2>
        <p style={styles.sub}>Name and address shown to customers and hub staff.</p>
        {loading && !shop ? <p style={styles.muted}>Loading shop…</p> : null}
        <TextField label="Shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
        <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <TextField
          label="Pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          inputMode="numeric"
        />
        <TextField
          label="Phone"
          value={shop?.phone ?? session?.phone ?? ''}
          readOnly
          disabled
        />
        {profileErr ? <Banner tone="danger">{profileErr}</Banner> : null}
        {profileMsg ? <Banner tone="success">{profileMsg}</Banner> : null}
        <Button disabled={busy || loading} onClick={() => void onSaveProfile()}>
          {busy ? 'Saving…' : 'Save shop profile'}
        </Button>
      </Card>

      <Card elevated style={styles.card}>
        <h2 style={styles.heading}>Order alerts</h2>
        <p style={styles.sub}>
          While you are signed in, we check for new orders every few seconds. After you click Test
          once, “Order received” can play even if you are on another tab or the browser is
          minimized. Enable browser notifications for a Windows popup + system chime as a backup.
          Sound will not work if Chrome is fully closed — that needs SMS later.
        </p>
        {soundMsg ? <Banner tone="success">{soundMsg}</Banner> : null}
        {notifMsg ? <Banner tone={notificationsReady ? 'success' : 'warning'}>{notifMsg}</Banner> : null}
        <div style={styles.btnRow}>
          <Button
            onClick={() => {
              void unlockOrderAlertAudio().then((ok) => {
                playOrderReceivedVoice();
                setSoundMsg(ok ? 'Playing “Order received”…' : 'Could not unlock sound — check system volume');
              });
            }}
          >
            Test “Order received”
          </Button>
          <Button
            variant="secondary"
            disabled={notificationsReady}
            onClick={() => {
              void enableNotifications().then((ok) => {
                setNotifMsg(
                  ok
                    ? 'Browser notifications enabled'
                    : 'Notifications blocked — allow them in the browser address bar, then try again',
                );
              });
            }}
          >
            {notificationsReady ? 'Notifications on' : 'Enable browser notifications'}
          </Button>
        </div>
      </Card>

      <Card elevated style={styles.card}>
        <h2 style={styles.heading}>Change password</h2>
        <p style={styles.sub}>
          Use 8+ characters with upper, lower, digit, and special (@$!%*?&). You will be signed out after a
          successful change.
        </p>
        <TextField
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <TextField
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <TextField
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        {pwdErr ? <Banner tone="danger">{pwdErr}</Banner> : null}
        {pwdMsg ? <Banner tone="success">{pwdMsg}</Banner> : null}
        <Button disabled={pwdBusy} onClick={() => void onChangePassword()}>
          {pwdBusy ? 'Updating…' : 'Update password'}
        </Button>
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.75rem', maxWidth: 520 },
  heading: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
};
