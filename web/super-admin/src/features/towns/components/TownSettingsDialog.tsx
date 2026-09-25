import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, TextField } from '@/shared/ui';
import { AdminHistoryPanel, LastChangeStrip } from '@/shared/audit/AdminHistoryPanel';
import {
  getTownConfig,
  updateTownConfig,
  type DeliverySlabVm,
  type TownVm,
} from '../api/townsApi';

type Props = {
  town: TownVm;
  token: string;
  platformDeliveryFee: number;
  onClose: () => void;
  onSaved: (message: string) => void;
};

const THEME_PRESETS = ['#0C831F', '#0D9488', '#2563EB', '#D97706', '#E11D48', '#7C3AED'];

const emptySlab = (): DeliverySlabVm => ({
  minOrderValue: 0,
  maxOrderValue: null,
  deliveryFee: 40,
});

function contrastInk(hex: string): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return '#fff';
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#111' : '#fff';
}

export function TownSettingsDialog({
  town,
  token,
  platformDeliveryFee,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minOrderValue, setMinOrderValue] = useState(199);
  const [deliveryMode, setDeliveryMode] = useState<'DEFAULT' | 'SLAB'>('DEFAULT');
  const [slabs, setSlabs] = useState<DeliverySlabVm[]>([emptySlab()]);
  const [themeColor, setThemeColor] = useState('#0C831F');
  const [bestDealsEnabled, setBestDealsEnabled] = useState(true);
  const [dealPrices, setDealPrices] = useState(['19', '29', '49', '99']);
  const [platformFee, setPlatformFee] = useState('0');
  const [scratchCardEnabled, setScratchCardEnabled] = useState(false);
  const [scratchRewardMin, setScratchRewardMin] = useState('10');
  const [scratchRewardMax, setScratchRewardMax] = useState('50');
  const [scratchMinGoodsAmount, setScratchMinGoodsAmount] = useState('499');
  const [buyerMembershipEnabled, setBuyerMembershipEnabled] = useState(true);
  const [codEnabled, setCodEnabled] = useState(true);
  const [upiEnabled, setUpiEnabled] = useState(true);
  const [codCharge, setCodCharge] = useState('0');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [panel, setPanel] = useState<'edit' | 'log'>('edit');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTownConfig(token, town.id)
      .then((cfg) => {
        if (cancelled) return;
        setMinOrderValue(cfg.minOrderValue);
        setDeliveryMode(cfg.deliveryMode);
        setSlabs(cfg.deliverySlabs.length > 0 ? cfg.deliverySlabs : [
          { minOrderValue: 0, maxOrderValue: 499, deliveryFee: platformDeliveryFee },
          { minOrderValue: 500, maxOrderValue: null, deliveryFee: 0 },
        ]);
        setThemeColor(cfg.themeColor);
        setBestDealsEnabled(cfg.bestDealsEnabled);
        setDealPrices(cfg.dealPrices.map((n) => String(n)));
        setPlatformFee(String(cfg.platformFee ?? 0));
        setScratchCardEnabled(Boolean(cfg.scratchCardEnabled));
        setScratchRewardMin(String(cfg.scratchRewardMin ?? 10));
        setScratchRewardMax(String(cfg.scratchRewardMax ?? 50));
        setScratchMinGoodsAmount(String(cfg.scratchMinGoodsAmount ?? 499));
        setBuyerMembershipEnabled(cfg.buyerMembershipEnabled !== false);
        setCodEnabled(cfg.codEnabled !== false);
        setUpiEnabled(cfg.upiEnabled !== false);
        setCodCharge(String(cfg.codCharge ?? 0));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load config');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, town.id, platformDeliveryFee]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [panel]);

  function updateSlab(index: number, patch: Partial<DeliverySlabVm>) {
    setSlabs((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function onSave() {
    const prices = dealPrices.map((raw) => Math.round(Number(raw)));
    if (prices.some((n) => !Number.isFinite(n) || n < 1)) {
      setError('Enter 4 deal prices as whole numbers of ₹1 or more.');
      return;
    }
    const fee = Math.round(Number(platformFee) * 100) / 100;
    if (!Number.isFinite(fee) || fee < 0) {
      setError('Platform fee must be ₹0 or more.');
      return;
    }
    const x = Math.round(Number(scratchRewardMin));
    const y = Math.round(Number(scratchRewardMax));
    const z = Math.round(Number(scratchMinGoodsAmount));
    if (scratchCardEnabled && (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || x < 1 || y < x || z < 1)) {
      setError('Scratch card needs reward min, max, and goods threshold. Max must be ≥ min.');
      return;
    }
    const codAmt = Math.round(Number(codCharge) * 100) / 100;
    if (!Number.isFinite(codAmt) || codAmt < 0) {
      setError('COD charge must be ₹0 or more.');
      return;
    }
    if (!codEnabled && !upiEnabled) {
      setError('Enable at least one payment method (COD or UPI).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateTownConfig(token, town.id, {
        minOrderValue,
        deliveryMode,
        deliverySlabs: deliveryMode === 'SLAB' ? slabs : [],
        themeColor,
        bestDealsEnabled,
        dealPrices: prices,
        platformFee: fee,
        scratchCardEnabled,
        scratchRewardMin: Number.isFinite(x) ? x : 10,
        scratchRewardMax: Number.isFinite(y) ? y : 50,
        scratchMinGoodsAmount: Number.isFinite(z) ? z : 499,
        buyerMembershipEnabled,
        codEnabled,
        upiEnabled,
        codCharge: codAmt,
      });
      setSavedNotice('Saved and logged.');
      setHistoryTick((n) => n + 1);
      setPanel('log');
      onSaved(`Town settings saved for ${town.displayName}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const ink = contrastInk(themeColor);

  return createPortal(
    <div style={styles.backdrop} role="presentation">
      <style>{PANEL_CSS}</style>
      <div
        className="town-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="town-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <div>
            <h2 id="town-settings-title" style={styles.title}>
              Town Settings
            </h2>
            <p style={styles.sub}>{town.displayName}</p>
          </div>
          <div style={styles.headRight}>
            <div style={styles.viewTabs} role="tablist" aria-label="Edit or change log">
              <button
                type="button"
                role="tab"
                aria-selected={panel === 'edit'}
                style={panel === 'edit' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPanel('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === 'log'}
                style={panel === 'log' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPanel('log')}
              >
                Change log
              </button>
            </div>
            <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {savedNotice ? <Banner tone="success">{savedNotice}</Banner> : null}
        {panel === 'edit' && token ? (
          <LastChangeStrip
            token={token}
            screen="town-settings"
            townId={town.id}
            refreshTick={historyTick}
            onSeeAll={() => setPanel('log')}
          />
        ) : null}
        {panel === 'edit' && loading ? <p style={styles.muted}>Loading…</p> : null}

        <div ref={bodyRef} className="town-settings-scroll">
        {panel === 'edit' && !loading ? (
          <div className="town-settings-grid">
            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>Appearance</h3>
              <div style={styles.fieldRow}>
                <div style={styles.fieldGrow}>
                  <p style={styles.label}>Theme color</p>
                  <div style={styles.swatchRow}>
                    {THEME_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Theme ${hex}`}
                        style={{
                          ...styles.swatch,
                          background: hex,
                          outline: themeColor.toUpperCase() === hex ? '2px solid var(--text)' : '2px solid transparent',
                        }}
                        onClick={() => setThemeColor(hex)}
                      />
                    ))}
                    <label style={styles.colorPick}>
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value.toUpperCase())}
                        aria-label="Custom theme color"
                      />
                    </label>
                    <input
                      style={styles.hexInput}
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value.toUpperCase())}
                      aria-label="Theme hex"
                    />
                  </div>
                </div>
                <div style={{ ...styles.previewTile, background: themeColor, color: ink }}>
                  <span style={styles.previewEyebrow}>Deals at</span>
                  <span style={{ ...styles.previewPill, color: themeColor }}>
                    ₹{dealPrices[0]?.trim() || '19'}
                  </span>
                </div>
              </div>

              <div style={styles.scratchBlock}>
                <div style={styles.scratchHead}>
                  <span>
                    <strong style={styles.toggleTitle}>Best deals in your town</strong>
                    <span style={styles.toggleHint}>
                      {bestDealsEnabled
                        ? 'Shown on the buyer basket between Pay on delivery and Place order'
                        : 'Hidden on the basket — prices stay saved, edit after you turn this on'}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bestDealsEnabled}
                    style={bestDealsEnabled ? styles.switchOn : styles.switchOff}
                    onClick={() => setBestDealsEnabled((v) => !v)}
                  >
                    <span style={bestDealsEnabled ? styles.knobOn : styles.knobOff} />
                  </button>
                </div>
                <div className="town-settings-deal-row">
                  {dealPrices.map((value, index) => (
                    <label
                      key={index}
                      style={bestDealsEnabled ? styles.dealField : { ...styles.dealField, ...styles.dealFieldOff }}
                    >
                      <span style={styles.dealPrefix}>₹</span>
                      <input
                        style={styles.dealInput}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        value={value}
                        disabled={!bestDealsEnabled}
                        aria-label={`Deal price ${index + 1}`}
                        onChange={(e) => {
                          const next = e.target.value.replace(/\D/g, '').slice(0, 5);
                          setDealPrices((prev) => prev.map((p, i) => (i === index ? next : p)));
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p style={styles.label}>Platform fee (₹)</p>
                <div className="town-settings-deal-row">
                  <label style={styles.dealField}>
                    <span style={styles.dealPrefix}>₹</span>
                    <input
                      style={styles.dealInput}
                      inputMode="decimal"
                      maxLength={6}
                      value={platformFee}
                      aria-label="Platform fee"
                      onChange={(e) => {
                        const next = e.target.value.replace(/[^\d.]/g, '');
                        const parts = next.split('.');
                        const clean =
                          parts.length > 1 ? `${parts[0].slice(0, 4)}.${parts.slice(1).join('').slice(0, 2)}` : parts[0].slice(0, 5);
                        setPlatformFee(clean);
                      }}
                    />
                  </label>
                </div>
                <p style={styles.hint}>Shown on the buyer basket below delivery fee</p>
              </div>

              <div style={styles.scratchBlock}>
              <h3 style={styles.sectionTitle}>Payments</h3>
              <div style={styles.toggleRow}>
                <span>
                  <strong style={styles.toggleTitle}>Cash on delivery (COD)</strong>
                  <span style={styles.toggleHint}>Buyer can pay at the door</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={codEnabled}
                  style={codEnabled ? styles.switchOn : styles.switchOff}
                  onClick={() => setCodEnabled((v) => !v)}
                >
                  <span style={codEnabled ? styles.knobOn : styles.knobOff} />
                </button>
              </div>
              {codEnabled ? (
                <div>
                  <p style={styles.label}>COD charge (₹)</p>
                  <div className="town-settings-deal-row">
                    <label style={styles.dealField}>
                      <span style={styles.dealPrefix}>₹</span>
                      <input
                        style={styles.dealInput}
                        inputMode="decimal"
                        maxLength={6}
                        value={codCharge}
                        aria-label="COD charge"
                        onChange={(e) => {
                          const next = e.target.value.replace(/[^\d.]/g, '');
                          const parts = next.split('.');
                          const clean =
                            parts.length > 1
                              ? `${parts[0].slice(0, 4)}.${parts.slice(1).join('').slice(0, 2)}`
                              : parts[0].slice(0, 5);
                          setCodCharge(clean);
                        }}
                      />
                    </label>
                  </div>
                  <p style={styles.hint}>Added to buyer total when they choose COD. Changes appear in the change log.</p>
                </div>
              ) : null}
              <div style={styles.toggleRow}>
                <span>
                  <strong style={styles.toggleTitle}>UPI / online pay</strong>
                  <span style={styles.toggleHint}>Razorpay checkout before order is placed</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={upiEnabled}
                  style={upiEnabled ? styles.switchOn : styles.switchOff}
                  onClick={() => setUpiEnabled((v) => !v)}
                >
                  <span style={upiEnabled ? styles.knobOn : styles.knobOff} />
                </button>
              </div>
              </div>

              <div style={styles.toggleRow}>
                <span>
                  <strong style={styles.toggleTitle}>Sell membership</strong>
                  <span style={styles.toggleHint}>Off = cannot buy here. Existing credits still work</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={buyerMembershipEnabled}
                  style={buyerMembershipEnabled ? styles.switchOn : styles.switchOff}
                  onClick={() => setBuyerMembershipEnabled((v) => !v)}
                >
                  <span style={buyerMembershipEnabled ? styles.knobOn : styles.knobOff} />
                </button>
              </div>

              <div style={styles.scratchBlock}>
                <div style={styles.scratchHead}>
                  <span>
                    <strong style={styles.toggleTitle}>Scratch card</strong>
                    <span style={styles.toggleHint}>
                      {scratchCardEnabled
                        ? 'Random wallet credit after delivery if goods (after coupon) ≥ Above'
                        : 'Off — no card after delivery'}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={scratchCardEnabled}
                    style={scratchCardEnabled ? styles.switchOn : styles.switchOff}
                    onClick={() => setScratchCardEnabled((v) => !v)}
                  >
                    <span style={scratchCardEnabled ? styles.knobOn : styles.knobOff} />
                  </button>
                </div>
                {scratchCardEnabled ? (
                  <div className="town-settings-scratch-row">
                    {[
                      { value: scratchRewardMin, set: setScratchRewardMin, label: 'Min' },
                      { value: scratchRewardMax, set: setScratchRewardMax, label: 'Max' },
                      { value: scratchMinGoodsAmount, set: setScratchMinGoodsAmount, label: 'Above' },
                    ].map((field) => (
                      <label key={field.label} style={styles.scratchField}>
                        <span style={styles.dealMiniLabel}>{field.label}</span>
                        <span style={styles.dealField}>
                          <span style={styles.dealPrefix}>₹</span>
                          <input
                            style={styles.dealInput}
                            inputMode="numeric"
                            maxLength={6}
                            value={field.value}
                            aria-label={field.label}
                            onChange={(e) => field.set(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>Delivery</h3>
              <div className="town-settings-delivery-row">
                <TextField
                  label="Min order value (₹)"
                  type="number"
                  min={0}
                  value={String(minOrderValue)}
                  onChange={(e) => setMinOrderValue(Math.max(0, Number(e.target.value) || 0))}
                />
                <div style={styles.modeBlock}>
                  <p style={styles.label}>Delivery fee mode</p>
                  <div style={styles.modeRow}>
                    <button
                      type="button"
                      style={deliveryMode === 'DEFAULT' ? styles.modeActive : styles.modeBtn}
                      onClick={() => setDeliveryMode('DEFAULT')}
                    >
                      Default (platform)
                    </button>
                    <button
                      type="button"
                      style={deliveryMode === 'SLAB' ? styles.modeActive : styles.modeBtn}
                      onClick={() => setDeliveryMode('SLAB')}
                    >
                      Slab-wise
                    </button>
                  </div>
                </div>
              </div>
              {deliveryMode === 'DEFAULT' ? (
                <p style={styles.hint}>
                  Uses delivery fee from Settings → Checkout: <strong>₹{platformDeliveryFee.toFixed(2)}</strong>
                </p>
              ) : (
                <p style={styles.hint}>Fee depends on cart value (items − coupon). Leave max blank for “and above”.</p>
              )}

              {deliveryMode === 'SLAB' ? (
                <div style={styles.slabs}>
                  <div className="town-settings-slab-head">
                    <span>Min ₹</span>
                    <span>Max ₹</span>
                    <span>Fee ₹</span>
                    <span />
                  </div>
                  {slabs.map((slab, index) => (
                    <div key={index} className="town-settings-slab-row">
                      <input
                        style={styles.slabInput}
                        type="number"
                        min={0}
                        value={slab.minOrderValue}
                        onChange={(e) =>
                          updateSlab(index, { minOrderValue: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                      <input
                        style={styles.slabInput}
                        type="number"
                        min={0}
                        placeholder="∞"
                        value={slab.maxOrderValue ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          updateSlab(index, {
                            maxOrderValue: raw === '' ? null : Math.max(0, Number(raw) || 0),
                          });
                        }}
                      />
                      <input
                        style={styles.slabInput}
                        type="number"
                        min={0}
                        value={slab.deliveryFee}
                        onChange={(e) =>
                          updateSlab(index, { deliveryFee: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                      <button
                        type="button"
                        style={styles.removeBtn}
                        disabled={slabs.length <= 1}
                        onClick={() => setSlabs((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSlabs((prev) => {
                        const last = prev[prev.length - 1];
                        const nextMin =
                          last?.maxOrderValue != null
                            ? Number(last.maxOrderValue) + 1
                            : (last?.minOrderValue ?? 0) + 500;
                        return [...prev, { minOrderValue: nextMin, maxOrderValue: null, deliveryFee: 0 }];
                      })
                    }
                  >
                    + Add slab
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {panel === 'log' && token ? (
          <AdminHistoryPanel
            token={token}
            screen="town-settings"
            townId={town.id}
            title="Change log"
            embedded
            tall
            refreshTick={historyTick}
          />
        ) : null}
        </div>

        {panel === 'edit' && !loading ? (
          <div style={styles.actions}>
            <Button disabled={busy} onClick={() => void onSave()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

const PANEL_CSS = `
  .town-settings-panel {
    width: min(920px, 100%);
    max-height: min(92vh, 860px);
    overflow: hidden;
    background: var(--bg-elevated);
    border-radius: 16px;
    padding: 1rem 1.05rem 1.05rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    box-shadow: 0 18px 48px rgba(2, 6, 12, 0.28);
  }
  .town-settings-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }
  .town-settings-panel input[type='color'] {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }
  .town-settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.7rem;
    align-items: start;
  }
  .town-settings-deal-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .town-settings-scratch-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .town-settings-delivery-row {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) minmax(200px, 1.3fr);
    gap: 0.55rem;
    align-items: end;
  }
  .town-settings-slab-head,
  .town-settings-slab-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 0.4rem;
    align-items: center;
  }
  .town-settings-slab-head {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
  }
  @media (max-width: 760px) {
    .town-settings-panel {
      width: 100%;
      max-height: 100vh;
      height: 100%;
      border-radius: 0;
      padding: 0.8rem 0.75rem 1rem;
    }
    .town-settings-grid,
    .town-settings-delivery-row,
    .town-settings-slab-head,
    .town-settings-slab-row {
      grid-template-columns: 1fr;
    }
    .town-settings-deal-row {
      grid-template-columns: 1fr 1fr;
    }
    .town-settings-scratch-row {
      grid-template-columns: 1fr 1fr 1fr;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(2, 6, 12, 0.5)',
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  headRight: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.78rem',
    padding: '0.28rem 0.6rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.28rem 0.6rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800 },
  sub: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  close: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    flexShrink: 0,
  },
  card: {
    display: 'grid',
    gap: '0.55rem',
    padding: '0.7rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--bg)',
    minWidth: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  muted: { margin: 0, color: 'var(--text-muted)' },
  label: { margin: '0 0 0.28rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' },
  fieldRow: { display: 'flex', gap: '0.55rem', alignItems: 'flex-end', flexWrap: 'wrap' },
  fieldGrow: { flex: '1 1 180px', minWidth: 0 },
  swatchRow: { display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' },
  swatch: {
    width: 26,
    height: 26,
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    padding: 0,
  },
  colorPick: {
    width: 26,
    height: 26,
    overflow: 'hidden',
    borderRadius: 999,
    border: '1px solid var(--border)',
  },
  hexInput: {
    width: 88,
    padding: '0.28rem 0.4rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  previewTile: {
    flex: '0 0 auto',
    width: 88,
    borderRadius: 10,
    padding: '0.4rem 0.35rem',
    display: 'grid',
    gap: '0.28rem',
    justifyItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.16)',
  },
  previewEyebrow: {
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  previewPill: {
    background: '#fff',
    borderRadius: 999,
    padding: '0.08rem 0.4rem',
    fontSize: '0.78rem',
    fontWeight: 800,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.7rem',
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
  },
  toggleTitle: { display: 'block', fontSize: '0.86rem' },
  toggleHint: { display: 'block', marginTop: 2, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.3 },
  scratchBlock: {
    display: 'grid',
    gap: '0.45rem',
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  scratchHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.7rem',
  },
  dealField: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.15rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    padding: '0 0.4rem',
    minHeight: 36,
  },
  dealPrefix: { fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)' },
  dealFieldOff: { opacity: 0.55, pointerEvents: 'none' },
  dealMiniLabel: {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginBottom: 2,
  },
  scratchField: { display: 'grid', gap: 0, minWidth: 0 },
  dealInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '0.9rem',
    fontWeight: 700,
    padding: '0.4rem 0',
    outline: 'none',
  },
  switchOn: {
    width: 42,
    height: 24,
    border: 'none',
    borderRadius: 999,
    background: 'var(--accent)',
    padding: 2,
    cursor: 'pointer',
    flexShrink: 0,
  },
  switchOff: {
    width: 42,
    height: 24,
    border: 'none',
    borderRadius: 999,
    background: 'var(--border)',
    padding: 2,
    cursor: 'pointer',
    flexShrink: 0,
  },
  knobOn: {
    display: 'block',
    width: 20,
    height: 20,
    borderRadius: 999,
    background: '#fff',
    marginLeft: 'auto',
  },
  knobOff: {
    display: 'block',
    width: 20,
    height: 20,
    borderRadius: 999,
    background: '#fff',
  },
  modeBlock: { display: 'grid', gap: '0.28rem', minWidth: 0 },
  modeRow: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  modeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 999,
    padding: '0.38rem 0.75rem',
    fontSize: '0.78rem',
    fontWeight: 650,
    cursor: 'pointer',
  },
  modeActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 999,
    padding: '0.38rem 0.75rem',
    fontSize: '0.78rem',
    fontWeight: 750,
    cursor: 'pointer',
  },
  hint: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  slabs: { display: 'grid', gap: '0.4rem' },
  slabInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.86rem',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger, #b91c1c)',
    fontWeight: 700,
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '0.25rem',
    justifySelf: 'start',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    flexShrink: 0,
    paddingTop: '0.15rem',
    borderTop: '1px solid var(--border)',
  },
};
