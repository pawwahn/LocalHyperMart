import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@hlm-theme';
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
type PageView = 'settings' | 'history';

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
  supplierLegalName: 'KoYaKart',
  supplierGstin: '',
  supplierAddress: '',
  supplierState: '',
  supplierGstStateCode: '',
};

export function SettingsPage() {
  const { session } = useAuth();
  const { preference, setMode } = useTheme();
  const token = session?.accessToken ?? '';
  const [settings, setSettings] = useState<PlatformSettingsVm>(EMPTY);
  const [legalTab, setLegalTab] = useState<LegalTab>('termsText');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageView, setPageView] = useState<PageView>('settings');
  const [historyTick, setHistoryTick] = useState(0);

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
    const gstin = settings.supplierGstin.trim().toUpperCase();
    const stateCode = settings.supplierGstStateCode.trim();
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      setError('GSTIN must be 15 characters.');
      return;
    }
    if (stateCode && !/^[0-9]{2}$/.test(stateCode)) {
      setError('GST state code is 2 digits, for example 37 for Andhra Pradesh.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setSettings(await patchPlatformSettings(token, settings));
      setNotice('Settings saved');
      setHistoryTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResetLegal() {
    if (!token) return;
    if (!window.confirm('Replace Terms, Privacy and Refund with the shipped KoYaKart rules?')) {
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
        <Card padding="sm" style={styles.pageTabsCard}>
          <div style={styles.pageTabsRow}>
            <div style={styles.viewTabs} role="tablist" aria-label="Settings or change history">
              <button
                type="button"
                role="tab"
                aria-selected={pageView === 'settings'}
                style={pageView === 'settings' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPageView('settings')}
              >
                Settings
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pageView === 'history'}
                style={pageView === 'history' ? styles.viewTabActive : styles.viewTab}
                onClick={() => {
                  setPageView('history');
                  setHistoryTick((n) => n + 1);
                }}
              >
                Change history
              </button>
            </div>
            {pageView === 'settings' ? (
              <Button disabled={busy} onClick={() => void onSave()}>
                {busy ? 'Saving…' : 'Save settings'}
              </Button>
            ) : null}
          </div>
        </Card>

        {pageView === 'history' ? (
          token ? (
            <AdminHistoryPanel
              token={token}
              screen="settings"
              refreshTick={historyTick}
              tall
              emptyHint="Each save lists every field that changed (previous → new). Referral rewards, delivery fee, and legal version appear here."
            />
          ) : null
        ) : (
          <>
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
            <p style={styles.hintInline}>KoYaKart green</p>
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
            <h2 style={styles.sectionTitle}>Service bills</h2>
            <span style={styles.hintInline}>Printed on the vendor payout bill. Fee is GST-inclusive at 18%.</span>
          </div>
          <div style={styles.formGrid}>
            <TextField
              label="Legal name"
              value={settings.supplierLegalName}
              onChange={(e) => setSettings((s) => ({ ...s, supplierLegalName: e.target.value }))}
            />
            <TextField
              label="GSTIN"
              value={settings.supplierGstin}
              maxLength={15}
              placeholder="15 characters"
              onChange={(e) => setSettings((s) => ({ ...s, supplierGstin: e.target.value.toUpperCase() }))}
            />
            <TextField
              label="Address"
              value={settings.supplierAddress}
              onChange={(e) => setSettings((s) => ({ ...s, supplierAddress: e.target.value }))}
            />
            <TextField
              label="State"
              value={settings.supplierState}
              placeholder="Andhra Pradesh"
              onChange={(e) => setSettings((s) => ({ ...s, supplierState: e.target.value }))}
            />
            <TextField
              label="GST state code"
              value={settings.supplierGstStateCode}
              maxLength={2}
              placeholder="37"
              onChange={(e) =>
                setSettings((s) => ({ ...s, supplierGstStateCode: e.target.value.replace(/\D/g, '').slice(0, 2) }))
              }
            />
          </div>
        </Card>

        <Card padding="sm" style={styles.card}>
          <h2 style={styles.sectionTitle}>Referrals (orders)</h2>
          <p style={styles.hintInline}>
            Off by default. Referee wallet on signup/code apply; referrer wallet on first delivery.
          </p>
          <div style={styles.formGrid}>
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={settings.referralsEnabled ?? false}
                onChange={(e) => setSettings((s) => ({ ...s, referralsEnabled: e.target.checked }))}
              />
              Program enabled
            </label>
            <TextField
              label="Referrer reward (₹, on friend’s first delivery)"
              value={String(settings.referralReferrerRewardAmount ?? 0)}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  referralReferrerRewardAmount: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
            <TextField
              label="Referee reward (₹, on signup / code apply)"
              value={String(settings.referralRefereeRewardAmount ?? 0)}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  referralRefereeRewardAmount: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
            <TextField
              label="Share link base (e.g. buyer shop URL)"
              value={settings.referralShareBaseUrl ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, referralShareBaseUrl: e.target.value }))}
            />
            <TextField
              label="Share message ({code}, {link})"
              value={settings.referralShareMessageTemplate ?? ''}
              onChange={(e) =>
                setSettings((s) => ({ ...s, referralShareMessageTemplate: e.target.value }))
              }
            />
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
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={settings.mealPlannerEnabled ?? false}
                onChange={(e) => setSettings((s) => ({ ...s, mealPlannerEnabled: e.target.checked }))}
              />
              Meal planner (buyer)
            </label>
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={settings.hubAdminCanSeeAgentRatings ?? true}
                onChange={(e) => setSettings((s) => ({ ...s, hubAdminCanSeeAgentRatings: e.target.checked }))}
              />
              Hub admin can see delivery ratings
            </label>
          </div>
        </Card>
          </>
        )}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.55rem' },
  pageTabsCard: { padding: '0.45rem 0.55rem' },
  pageTabsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
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
