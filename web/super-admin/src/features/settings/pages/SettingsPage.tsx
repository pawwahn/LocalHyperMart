import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ACCENT_PRESETS, useTheme } from '@hlm-theme';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { getPlatformSettings, patchPlatformSettings, type PlatformSettingsVm } from '../api/settingsApi';

const EMPTY: PlatformSettingsVm = {
  mapsEnabled: false,
  maintenanceMode: false,
  termsUrl: '',
  privacyUrl: '',
  refundUrl: '',
  grievanceOfficer: '',
  supportPhone: '',
  deliveryFee: 40,
  vendorOrderAlertMessage: 'Order received',
};

export function SettingsPage() {
  const { session } = useAuth();
  const { preference, setMode, setAccent } = useTheme();
  const token = session?.accessToken ?? '';
  const [settings, setSettings] = useState<PlatformSettingsVm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setSettings(await getPlatformSettings(token));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load settings');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSave() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setSettings(await patchPlatformSettings(token, settings));
      setNotice('Settings saved');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  function testVendorAlertAudio() {
    const phrase = settings.vendorOrderAlertMessage.trim() || 'Order received';
    try {
      if (!window.speechSynthesis) {
        setError('This browser cannot play speech audio. Try Chrome or Edge.');
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      synth.resume();
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'en-IN';
      utter.rate = 1;
      utter.volume = 1;
      const voices = synth.getVoices();
      const preferred =
        voices.find((v) => /en-IN/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
      if (preferred) utter.voice = preferred;
      synth.speak(utter);
      setNotice(`Playing alert: “${phrase}”`);
    } catch {
      setError('Could not play alert audio in this browser.');
    }
  }

  return (
    <PortalShell title="Platform settings" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.stack}>
        <Card padding="sm" style={styles.card}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>UI theme</h2>
            <span style={styles.hintInline}>This browser only</span>
          </div>
          <div style={styles.themeRow}>
            <div style={styles.modeRow}>
              <button
                type="button"
                style={preference.mode === 'light' ? styles.modeActive : styles.modeBtn}
                onClick={() => setMode('light')}
              >
                Light
              </button>
              <button
                type="button"
                style={preference.mode === 'dark' ? styles.modeActive : styles.modeBtn}
                onClick={() => setMode('dark')}
              >
                Dark
              </button>
            </div>
            <div style={styles.swatches}>
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={preference.accent === preset.id}
                  onClick={() => setAccent(preset.id)}
                  style={{
                    ...styles.swatch,
                    background: preset.accent,
                    outline:
                      preference.accent === preset.id
                        ? `2px solid ${preset.accentHover}`
                        : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card padding="sm" style={styles.card}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>Ops (all towns)</h2>
            <span style={styles.hintInline}>Fee + vendor alert for every town</span>
          </div>
          <div style={styles.opsRow}>
            <div style={styles.feeWrap}>
              <TextField
                label="Delivery fee (₹)"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={String(settings.deliveryFee ?? 40)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    deliveryFee: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
            <div style={styles.alertWrap}>
              <TextField
                label="Vendor alert message"
                value={settings.vendorOrderAlertMessage}
                maxLength={120}
                placeholder="Order received"
                onChange={(e) =>
                  setSettings((s) => ({ ...s, vendorOrderAlertMessage: e.target.value }))
                }
              />
              <div style={styles.alertActions}>
                <span style={styles.charCount}>{settings.vendorOrderAlertMessage.length}/120</span>
                <Button type="button" variant="ghost" onClick={testVendorAlertAudio}>
                  Test audio
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="sm" style={styles.card}>
          <h2 style={styles.sectionTitle}>Legal & support</h2>
          <div style={styles.formGrid}>
            <TextField
              label="Terms URL"
              value={settings.termsUrl}
              onChange={(e) => setSettings((s) => ({ ...s, termsUrl: e.target.value }))}
            />
            <TextField
              label="Privacy URL"
              value={settings.privacyUrl}
              onChange={(e) => setSettings((s) => ({ ...s, privacyUrl: e.target.value }))}
            />
            <TextField
              label="Refund URL"
              value={settings.refundUrl}
              onChange={(e) => setSettings((s) => ({ ...s, refundUrl: e.target.value }))}
            />
            <TextField
              label="Grievance officer"
              value={settings.grievanceOfficer}
              onChange={(e) => setSettings((s) => ({ ...s, grievanceOfficer: e.target.value }))}
            />
            <TextField
              label="Support phone"
              value={settings.supportPhone}
              onChange={(e) => setSettings((s) => ({ ...s, supportPhone: e.target.value }))}
            />
          </div>
          <div style={styles.footerRow}>
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={settings.mapsEnabled}
                onChange={(e) => setSettings((s) => ({ ...s, mapsEnabled: e.target.checked }))}
              />
              Maps
            </label>
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings((s) => ({ ...s, maintenanceMode: e.target.checked }))}
              />
              Maintenance
            </label>
            <Button disabled={busy} onClick={() => void onSave()}>
              {busy ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.55rem' },
  card: { display: 'grid', gap: '0.45rem' },
  sectionHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.55rem',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
  },
  hintInline: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  themeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  modeRow: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  modeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.3rem 0.75rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 36,
  },
  modeActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.3rem 0.75rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
  },
  swatches: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  opsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem 0.65rem',
    alignItems: 'end',
  },
  feeWrap: { width: '8.5rem', flex: '0 0 auto' },
  alertWrap: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.4rem',
    alignItems: 'end',
    flex: '1 1 16rem',
    minWidth: 0,
  },
  alertActions: {
    display: 'grid',
    gap: '0.2rem',
    justifyItems: 'end',
    paddingBottom: '0.1rem',
  },
  charCount: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.4rem 0.55rem',
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginTop: '0.15rem',
  },
  check: {
    display: 'inline-flex',
    gap: '0.35rem',
    alignItems: 'center',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
};
