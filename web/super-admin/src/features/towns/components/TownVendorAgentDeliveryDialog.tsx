import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Banner, Button } from '@/shared/ui';
import { LastChangeStrip } from '@/shared/audit/AdminHistoryPanel';
import {
  getVendorAgentDeliveryConfig,
  saveVendorAgentDeliveryConfig,
  type VendorAgentDeliveryConfig,
} from '../api/vendorAgentDeliveryApi';
import type { TownVm } from '../api/townsApi';

export type VendorAgentDeliveryHandle = {
  save: () => void;
  cancel: () => void;
  startEdit: () => void;
};

export type VendorAgentEmbeddedState = {
  busy: boolean;
  loading: boolean;
  editing: boolean;
};

type Props = {
  town: TownVm;
  token: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  embedded?: boolean;
  onEmbeddedState?: (state: VendorAgentEmbeddedState) => void;
  onOpenChangeLog?: () => void;
};

function money(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export const TownVendorAgentDeliveryDialog = forwardRef<VendorAgentDeliveryHandle, Props>(
  function TownVendorAgentDeliveryDialog(
    { town, token, onClose, onSaved, embedded, onEmbeddedState, onOpenChangeLog },
    ref,
  ) {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedNotice, setSavedNotice] = useState<string | null>(null);
    const [historyTick, setHistoryTick] = useState(0);
    const [editing, setEditing] = useState(false);
    const [cfg, setCfg] = useState<VendorAgentDeliveryConfig>({
      enabled: false,
      vendorAgentPayoutAmount: 0,
      hubPayoutAmount: 0,
    });
    const baselineRef = useRef<VendorAgentDeliveryConfig>(cfg);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        setEditing(false);
        try {
          const data = await getVendorAgentDeliveryConfig(token, town.id);
          if (!cancelled) {
            setCfg(data);
            baselineRef.current = data;
          }
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load settings');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [token, town.id]);

    useEffect(() => {
      if (!embedded || !onEmbeddedState) return;
      onEmbeddedState({ busy, loading, editing });
    }, [embedded, onEmbeddedState, busy, loading, editing]);

    function startEdit() {
      baselineRef.current = { ...cfg };
      setEditing(true);
      setError(null);
      setSavedNotice(null);
    }

    function cancelEdit() {
      setCfg({ ...baselineRef.current });
      setEditing(false);
      setError(null);
    }

    async function onSave() {
      if (!editing) return;
      setBusy(true);
      setError(null);
      try {
        await saveVendorAgentDeliveryConfig(token, town.id, cfg);
        baselineRef.current = { ...cfg };
        setEditing(false);
        setSavedNotice('Saved.');
        setHistoryTick((n) => n + 1);
        onSaved(`Vendor-agent delivery updated for ${town.displayName}`);
        if (!embedded) onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save');
      } finally {
        setBusy(false);
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        save: () => void onSave(),
        cancel: cancelEdit,
        startEdit,
      }),
      [cfg, editing, token, town.id],
    );

    const content = loading ? (
      <p style={styles.muted}>Loading…</p>
    ) : editing ? (
      <section style={styles.card}>
        <label style={styles.row}>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
          />
          Enable “Delivery by my agent” for vendors in this town
        </label>
        {cfg.enabled ? (
          <div style={styles.grid}>
            <label style={styles.field}>
              Pay vendor&apos;s agent (₹)
              <input
                type="number"
                min={0}
                step={1}
                value={cfg.vendorAgentPayoutAmount}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    vendorAgentPayoutAmount: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
            <label style={styles.field}>
              Pay hub (₹)
              <input
                type="number"
                min={0}
                step={1}
                value={cfg.hubPayoutAmount}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    hubPayoutAmount: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
          </div>
        ) : null}
      </section>
    ) : (
      <section style={styles.card}>
        <dl style={styles.viewList}>
          <div style={styles.viewRow}>
            <dt style={styles.viewLabel}>Delivery by my agent</dt>
            <dd style={styles.viewValue}>{cfg.enabled ? 'Enabled' : 'Disabled'}</dd>
          </div>
          {cfg.enabled ? (
            <>
              <div style={styles.viewRow}>
                <dt style={styles.viewLabel}>Pay vendor&apos;s agent</dt>
                <dd style={styles.viewValue}>{money(cfg.vendorAgentPayoutAmount)}</dd>
              </div>
              <div style={styles.viewRow}>
                <dt style={styles.viewLabel}>Pay hub</dt>
                <dd style={styles.viewValue}>{money(cfg.hubPayoutAmount)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>
    );

    const body = (
      <div style={embedded ? styles.embedded : styles.panel} role={embedded ? undefined : 'dialog'}>
        {!embedded ? (
          <h2 style={styles.title}>Delivery by vendor agent — {town.displayName}</h2>
        ) : null}

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {savedNotice ? <Banner tone="success">{savedNotice}</Banner> : null}

        {embedded && !editing && token ? (
          <LastChangeStrip
            token={token}
            screen="town-vendor-agent-delivery"
            townId={town.id}
            refreshTick={historyTick}
            onSeeAll={() => onOpenChangeLog?.()}
          />
        ) : null}

        {content}

        {!embedded ? (
          <div style={styles.actions}>
            {editing ? (
              <>
                <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={() => void onSave()} disabled={busy || loading}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={onClose} disabled={busy}>
                  Close
                </Button>
                <Button onClick={startEdit} disabled={loading}>
                  Edit
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    );

    if (embedded) return body;

    return createPortal(
      <div style={styles.backdrop} role="presentation" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{body}</div>
      </div>,
      document.body,
    );
  },
);

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  panel: {
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    maxWidth: 420,
    width: '100%',
    display: 'grid',
    gap: '0.65rem',
  },
  title: { margin: 0, fontSize: '1.05rem', fontWeight: 800 },
  muted: { margin: 0, color: 'var(--text-muted)' },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' },
  grid: { display: 'grid', gap: '0.55rem', marginTop: '0.25rem' },
  field: { display: 'grid', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' },
  embedded: { display: 'grid', gap: '0.5rem' },
  card: {
    display: 'grid',
    gap: '0.5rem',
    padding: '0.7rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
  },
  viewList: { margin: 0, display: 'grid', gap: '0.5rem' },
  viewRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.75rem',
    alignItems: 'baseline',
  },
  viewLabel: { margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 },
  viewValue: { margin: 0, fontSize: '0.92rem', fontWeight: 800, textAlign: 'right' },
};
