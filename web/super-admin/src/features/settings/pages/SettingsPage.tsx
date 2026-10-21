import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@hlm-theme';
import { formatLegalStamp } from '@hlm-legal';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog, TextField } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import { usePlatformBrand } from '@hlm-brand';
import defaultMealPlannerIcon from '../meal-planner-icon.png';
import {
  getPlatformSettings,
  patchPlatformSettings,
  resetLegalDefaults,
  uploadPlatformBrandLogo,
  type PlatformSettingsVm,
} from '../api/settingsApi';

type LegalTab = 'termsText' | 'privacyText' | 'refundText';
type PageView = 'settings' | 'history';

const EMPTY: PlatformSettingsVm = {
  mapsEnabled: false,
  mapProvider: 'OSM',
  googleMapsApiKey: '',
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
  vendorTdsRatePercent: 0.1,
  vendorTdsExemptUpto: 500000,
  supplierLegalName: 'KoyaKart',
  supplierGstin: '',
  supplierAddress: '',
  supplierState: '',
  supplierGstStateCode: '',
  brandLogoUrl: '',
  brandLogoMediaId: '',
  mealPlannerIconUrl: '',
  mealPlannerIconMediaId: '',
};

export function SettingsPage() {
  const { session } = useAuth();
  const { preference, setMode } = useTheme();
  const { refresh: refreshBrand } = usePlatformBrand();
  const token = session?.accessToken ?? '';
  const [settings, setSettings] = useState<PlatformSettingsVm>(EMPTY);
  const [legalTab, setLegalTab] = useState<LegalTab>('termsText');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageView, setPageView] = useState<PageView>('settings');
  const [historyTick, setHistoryTick] = useState(0);
  const [logoUploadBusy, setLogoUploadBusy] = useState(false);
  const [mealIconBusy, setMealIconBusy] = useState(false);
  const [mapSwitchTo, setMapSwitchTo] = useState<'OSM' | 'GOOGLE' | null>(null);

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
    const tdsRate = Number(settings.vendorTdsRatePercent ?? 0);
    const tdsExempt = Number(settings.vendorTdsExemptUpto ?? 0);
    if (!Number.isFinite(tdsRate) || tdsRate < 0 || tdsRate > 100) {
      setError('Vendor TDS % must be between 0 and 100.');
      return;
    }
    if (!Number.isFinite(tdsExempt) || tdsExempt < 0) {
      setError('Vendor TDS exempt amount must be zero or more.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await patchPlatformSettings(token, settings);
      setSettings(saved);
      setNotice('Settings saved');
      setHistoryTick((n) => n + 1);
      await refreshBrand();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResetLegal() {
    if (!token) return;
    if (!window.confirm('Replace Terms, Privacy and Refund with the shipped KoyaKart rules?')) {
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
            <h2 style={styles.sectionTitle}>Company logo</h2>
            <span style={styles.hintInline}>Buyer, vendor, delivery &amp; admin apps</span>
          </div>
          <p style={styles.hintInline}>
            Upload PNG or JPG (square or wide). Shown in headers, login screens, and browser tab. Save settings after
            upload.
          </p>
          <div style={styles.logoRow}>
            {settings.brandLogoUrl ? (
              <img src={settings.brandLogoUrl} alt="Current logo" style={styles.logoPreview} />
            ) : (
              <div style={styles.logoEmpty}>No logo uploaded</div>
            )}
            <div style={styles.logoActions}>
              <label style={styles.logoUploadBtn}>
                {logoUploadBusy ? 'Uploading…' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  disabled={logoUploadBusy || !token}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file || !token) return;
                    void (async () => {
                      setLogoUploadBusy(true);
                      setError(null);
                      try {
                        const uploaded = await uploadPlatformBrandLogo(token, file);
                        setSettings((s) => ({
                          ...s,
                          brandLogoUrl: uploaded.url,
                          brandLogoMediaId: uploaded.mediaId,
                        }));
                        setNotice('Logo uploaded — click Save settings to apply everywhere.');
                      } catch (err) {
                        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload failed');
                      } finally {
                        setLogoUploadBusy(false);
                      }
                    })();
                  }}
                />
              </label>
              {settings.brandLogoUrl ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    setSettings((s) => ({ ...s, brandLogoUrl: '', brandLogoMediaId: '' }))
                  }
                >
                  Remove logo
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

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
            <p style={styles.hintInline}>KoyaKart green</p>
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
            <h2 style={styles.sectionTitle}>Vendor TDS</h2>
            <span style={styles.hintInline}>Audit estimate for every town. Not held back from the payout.</span>
          </div>
          <div style={styles.opsRow}>
            <div style={styles.feeWrap}>
              <TextField
                label="TDS %"
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
                value={String(settings.vendorTdsRatePercent ?? 0.1)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    vendorTdsRatePercent: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
            <div style={{ ...styles.feeWrap, width: '11rem' }}>
              <TextField
                label="Exempt up to (₹)"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={String(settings.vendorTdsExemptUpto ?? 500000)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    vendorTdsExemptUpto: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
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
          <div style={styles.mapHead}>
            <h2 style={styles.sectionTitle}>Delivery map</h2>
            <div style={styles.modeRow} role="group" aria-label="Active map">
              <button
                type="button"
                aria-pressed={settings.mapProvider !== 'GOOGLE'}
                style={{
                  ...(settings.mapProvider !== 'GOOGLE' ? styles.modeActive : styles.modeBtn),
                  minHeight: 44,
                }}
                onClick={() => {
                  if (settings.mapProvider !== 'GOOGLE') return;
                  setMapSwitchTo('OSM');
                }}
              >
                OpenStreetMap
              </button>
              <button
                type="button"
                aria-pressed={settings.mapProvider === 'GOOGLE'}
                style={{
                  ...(settings.mapProvider === 'GOOGLE' ? styles.modeActive : styles.modeBtn),
                  minHeight: 44,
                }}
                onClick={() => {
                  if (settings.mapProvider === 'GOOGLE') return;
                  setMapSwitchTo('GOOGLE');
                }}
              >
                Google
              </button>
            </div>
          </div>
          {settings.mapProvider === 'GOOGLE' ? (
            <TextField
              label="Google Maps key"
              value={settings.googleMapsApiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="Browser key"
              onChange={(e) => setSettings((s) => ({ ...s, googleMapsApiKey: e.target.value }))}
            />
          ) : null}
          <p style={styles.mapHint}>
            {settings.mapProvider === 'GOOGLE'
              ? 'Google is on. Paste a browser key restricted to this site, then save. OpenStreetMap stays idle.'
              : 'OpenStreetMap is on and free. Google stays idle until you switch and save.'}
          </p>
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
            <span style={styles.mealIconSlot}>
              <img
                src={settings.mealPlannerIconUrl || defaultMealPlannerIcon}
                alt=""
                style={styles.mealIconPreview}
              />
              <label style={styles.logoUploadBtn}>
                {mealIconBusy ? 'Uploading…' : 'Change icon'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  disabled={mealIconBusy || !token}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file || !token) return;
                    void (async () => {
                      setMealIconBusy(true);
                      setError(null);
                      try {
                        const uploaded = await uploadPlatformBrandLogo(token, file);
                        setSettings((s) => ({
                          ...s,
                          mealPlannerIconUrl: uploaded.url,
                          mealPlannerIconMediaId: uploaded.mediaId,
                        }));
                        setNotice('Icon uploaded — click Save settings to show it on the buyer cart bar.');
                      } catch (err) {
                        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload failed');
                      } finally {
                        setMealIconBusy(false);
                      }
                    })();
                  }}
                />
              </label>
              {settings.mealPlannerIconUrl ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    setSettings((s) => ({ ...s, mealPlannerIconUrl: '', mealPlannerIconMediaId: '' }))
                  }
                >
                  Use default
                </Button>
              ) : null}
            </span>
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
      <ConfirmDialog
        open={mapSwitchTo != null}
        danger={false}
        title={mapSwitchTo === 'OSM' ? 'Switch to OpenStreetMap?' : 'Switch to Google?'}
        description={
          mapSwitchTo === 'OSM'
            ? 'Delivery cards will show the OpenStreetMap pin after you save.'
            : 'Delivery cards will show the Google pin after you save.'
        }
        confirmLabel="Switch"
        cancelLabel={mapSwitchTo === 'OSM' ? 'Keep Google' : 'Keep OpenStreetMap'}
        onClose={() => setMapSwitchTo(null)}
        onConfirm={() => {
          if (mapSwitchTo) setSettings((s) => ({ ...s, mapProvider: mapSwitchTo }));
          setMapSwitchTo(null);
        }}
      />
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
  mapHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  mapHint: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.35,
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
  logoRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'center',
  },
  logoPreview: {
    maxHeight: 72,
    maxWidth: 200,
    objectFit: 'contain',
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: '0.35rem',
    background: 'var(--bg-elevated)',
  },
  logoEmpty: {
    minWidth: 120,
    minHeight: 56,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 10,
    border: '1px dashed var(--border)',
    fontSize: '0.75rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
  },
  logoActions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  logoUploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
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
  feeWrap: { width: '9.5rem', flex: '0 0 auto' },
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
  mealIconSlot: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  mealIconPreview: {
    width: 32,
    height: 32,
    objectFit: 'contain',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: '#fff',
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
