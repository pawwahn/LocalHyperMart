import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, TextField } from '@/shared/ui';
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

const emptySlab = (): DeliverySlabVm => ({
  minOrderValue: 0,
  maxOrderValue: null,
  deliveryFee: 40,
});

export function TownDeliveryConfigDialog({
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

  function updateSlab(index: number, patch: Partial<DeliverySlabVm>) {
    setSlabs((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await updateTownConfig(token, town.id, {
        minOrderValue,
        deliveryMode,
        deliverySlabs: deliveryMode === 'SLAB' ? slabs : [],
      });
      onSaved(
        deliveryMode === 'SLAB'
          ? `Delivery slabs saved for ${town.displayName}`
          : `${town.displayName} uses platform default delivery fee (₹${platformDeliveryFee})`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="town-delivery-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <div>
            <h2 id="town-delivery-title" style={styles.title}>
              Delivery charges
            </h2>
            <p style={styles.sub}>{town.displayName}</p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {loading ? <p style={styles.muted}>Loading…</p> : null}

        {!loading ? (
          <div style={styles.body}>
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
              {deliveryMode === 'DEFAULT' ? (
                <p style={styles.hint}>
                  Uses platform fee from Settings → Checkout: <strong>₹{platformDeliveryFee.toFixed(2)}</strong>
                </p>
              ) : (
                <p style={styles.hint}>
                  Fee depends on cart value (items − coupon). Leave max blank for “and above”.
                </p>
              )}
            </div>

            {deliveryMode === 'SLAB' ? (
              <div style={styles.slabs}>
                <div style={styles.slabHead}>
                  <span>Min ₹</span>
                  <span>Max ₹</span>
                  <span>Fee ₹</span>
                  <span />
                </div>
                {slabs.map((slab, index) => (
                  <div key={index} style={styles.slabRow}>
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
                        last?.maxOrderValue != null ? Number(last.maxOrderValue) + 1 : (last?.minOrderValue ?? 0) + 500;
                      return [...prev, { minOrderValue: nextMin, maxOrderValue: null, deliveryFee: 0 }];
                    })
                  }
                >
                  + Add slab
                </Button>
              </div>
            ) : null}

            <div style={styles.actions}>
              <Button disabled={busy} onClick={() => void onSave()}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(2, 6, 12, 0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  sheet: {
    width: 'min(520px, 100%)',
    maxHeight: 'min(88vh, 720px)',
    overflow: 'auto',
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    padding: '1rem',
    display: 'grid',
    gap: '0.75rem',
    boxShadow: '0 18px 48px rgba(2, 6, 12, 0.25)',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  sub: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  close: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
  },
  body: { display: 'grid', gap: '0.75rem' },
  muted: { margin: 0, color: 'var(--text-muted)' },
  modeBlock: { display: 'grid', gap: '0.4rem' },
  label: { margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' },
  modeRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  modeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 999,
    padding: '0.4rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: 650,
    cursor: 'pointer',
  },
  modeActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 999,
    padding: '0.4rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: 750,
    cursor: 'pointer',
  },
  hint: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  slabs: { display: 'grid', gap: '0.45rem' },
  slabHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr auto',
    gap: '0.4rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  slabRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr auto',
    gap: '0.4rem',
    alignItems: 'center',
  },
  slabInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger, #b91c1c)',
    fontWeight: 700,
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' },
};
