import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ACCENT_PRESETS, useTheme } from '@hlm-theme';
import { formatLegalStamp } from '@hlm-legal';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import {
  getPlatformSettings,
  patchPlatformSettings,
  resetLegalDefaults,
  type PlatformSettingsVm,
} from '../api/settingsApi';

type LegalTab = 'termsText' | 'privacyText' | 'refundText';

const EMPTY: PlatformSettingsVm = {
  mapsEnabled: false,
  maintenanceMode: false,
  termsUrl: '',
  privacyUrl: '',
  refundUrl: '',
  termsText: '',
  privacyText: '',
  refundText: '',
  legalVersion: 1,
  legalUpdatedAt: '',
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
  const [legalTab, setLegalTab] = useState<LegalTab>('termsText');
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

  async function onResetLegal() {
    if (!token) return;
    if (!window.confirm('Replace Terms, Privacy and Refund with the shipped HyperLocalMart rules?')) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setSettings(await resetLegalDefaults(token));
      setNotice('Legal copy reset to shipped rules. Version bumped.');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Reset failed');
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
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>Legal copy (shown to users)</h2>
            <span style={styles.hintInline}>
              {formatLegalStamp({
                legalVersion: settings.legalVersion,
                legalUpdatedAt: settings.legalUpdatedAt,
              })}
            </span>
            <Link to="/legal/terms" style={styles.previewLink}>
              Preview
            </Link>
          </div>
          <div style={styles.tabs}>
            {(
              [
                ['termsText', 'Terms'],
                ['privacyText', 'Privacy'],
                ['refundText', 'Refund / wallet'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                style={legalTab === key ? styles.tabOn : styles.tab}
                onClick={() => setLegalTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={settings[legalTab]}
            onChange={(e) => setSettings((s) => ({ ...s, [legalTab]: e.target.value }))}
            rows={12}
            style={styles.legalArea}
            spellCheck
          />
          <div style={styles.legalMeta}>
            <span style={styles.charCount}>{settings[legalTab].length.toLocaleString('en-IN')} chars</span>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void onResetLegal()}>
              Reset to shipped rules
            </Button>
          </div>
        </Card>

        <Card padding="sm" style={styles.card}>
          <h2 style={styles.sectionTitle}>Legal & support</h2>
          <div style={styles.formGrid}>
            <TextField
              label="Terms URL (optional extra)"
              value={settings.termsUrl}
              onChange={(e) => setSettings((s) => ({ ...s, termsUrl: e.target.value }))}
            />
            <TextField
              label="Privacy URL (optional extra)"
              value={settings.privacyUrl}
              onChange={(e) => setSettings((s) => ({ ...s, privacyUrl: e.target.value }))}
            />
            <TextField
              label="Refund URL (optional extra)"
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
        {token ? <AdminHistoryPanel token={token} screen="settings" refreshTick={notice ? notice.length : 0} /> : null}
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
  tabs: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  tab: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.25rem 0.7rem',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
  },
  tabOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.25rem 0.7rem',
    fontSize: '0.76rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 32,
  },
  legalArea: {
    width: '100%',
    minHeight: 220,
    maxHeight: '42vh',
    resize: 'vertical',
    boxSizing: 'border-box',
    padding: '0.5rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    lineHeight: 1.4,
  },
  legalMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  previewLink: {
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.78rem',
    textDecoration: 'none',
  },
};
