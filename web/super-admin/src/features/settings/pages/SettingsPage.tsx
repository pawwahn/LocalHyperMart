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

  return (
    <PortalShell title="Platform settings" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card>
        <h2 style={styles.sectionTitle}>Your UI theme</h2>
        <p style={styles.themeHelp}>Saved in this browser. Choose light/dark and accent color.</p>
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
      </Card>

      <Card>
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
            label="Refund policy URL"
            value={settings.refundUrl}
            onChange={(e) => setSettings((s) => ({ ...s, refundUrl: e.target.value }))}
          />
          <TextField
            label="Grievance officer"
            value={settings.grievanceOfficer}
            onChange={(e) => setSettings((s) => ({ ...s, grievanceOfficer: e.target.value }))}
          />
        </div>
        <label style={styles.check}>
          <input
            type="checkbox"
            checked={settings.mapsEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, mapsEnabled: e.target.checked }))}
          />
          Maps enabled (Phase 2 toggle)
        </label>
        <label style={styles.check}>
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => setSettings((s) => ({ ...s, maintenanceMode: e.target.checked }))}
          />
          Maintenance mode
        </label>
        <Button disabled={busy} onClick={() => void onSave()}>
          Save settings
        </Button>
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  sectionTitle: { margin: '0 0 0.85rem', fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  themeHelp: { margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.88rem' },
  modeRow: { display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  modeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modeActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  swatches: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.75rem',
    marginBottom: '0.85rem',
  },
  check: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.65rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
};
