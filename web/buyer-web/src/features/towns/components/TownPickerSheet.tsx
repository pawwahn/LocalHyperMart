import { useState, type CSSProperties } from 'react';
import { useTown } from '@/shared/town/TownContext';
import type { TownVm } from '@/features/towns/api/townsApi';
import { Button } from '@/shared/ui';

export function TownPickerSheet() {
  const {
    pickerOpen,
    closePicker,
    towns,
    townId,
    townLabel,
    hasTown,
    selectTown,
    loading,
    error,
    reloadTowns,
  } = useTown();
  const [pendingTown, setPendingTown] = useState<TownVm | null>(null);
  const [busy, setBusy] = useState(false);

  if (!pickerOpen) return null;

  function requestSelect(town: TownVm) {
    if (town.id === townId) {
      closePicker();
      return;
    }
    if (hasTown) {
      setPendingTown(town);
      return;
    }
    void selectTown(town);
  }

  async function confirmSwitch() {
    if (!pendingTown) return;
    setBusy(true);
    try {
      await selectTown(pendingTown);
      setPendingTown(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={styles.backdrop}
      role="presentation"
      onClick={() => {
        if (busy) return;
        if (pendingTown) {
          setPendingTown(null);
          return;
        }
        closePicker();
      }}
    >
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="town-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h2 id="town-picker-title" style={styles.title}>
            Choose town
          </h2>
          {hasTown ? (
            <button
              type="button"
              style={styles.closeLink}
              disabled={busy}
              onClick={() => {
                setPendingTown(null);
                closePicker();
              }}
            >
              Close
            </button>
          ) : null}
        </div>
        <p style={styles.sub}>
          {hasTown ? 'Shops & delivery are for one town at a time.' : 'Pick a town to start shopping.'}
        </p>

        {error ? (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>{error}</p>
            <Button size="sm" onClick={() => void reloadTowns()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading && towns.length === 0 ? <p style={styles.muted}>Loading…</p> : null}

        <ul style={styles.list} className="hlm-hide-scrollbar">
          {towns.map((town) => {
            const selected = town.id === townId;
            const disabled = !town.acceptingOrders || busy;
            return (
              <li key={town.id}>
                <button
                  type="button"
                  style={{
                    ...styles.townBtn,
                    ...(selected ? styles.townBtnSelected : null),
                    ...(disabled ? styles.townBtnDisabled : null),
                  }}
                  disabled={disabled}
                  onClick={() => requestSelect(town)}
                >
                  <span style={styles.townName}>{town.displayName}</span>
                  <span style={styles.townMeta}>
                    {town.stateCode}
                    {selected ? ' · ✓' : ''}
                    {!town.acceptingOrders ? ' · soon' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {!loading && towns.length === 0 && !error ? (
          <p style={styles.muted}>No towns open yet.</p>
        ) : null}
      </div>

      {pendingTown ? (
        <div
          style={styles.confirmBackdrop}
          role="presentation"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setPendingTown(null);
          }}
        >
          <div
            style={styles.confirmSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-town-switch-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-town-switch-title" style={styles.confirmTitle}>
              Switch town?
            </h3>
            <p style={styles.confirmBody}>
              Change from <strong>{townLabel}</strong> to{' '}
              <strong>{pendingTown.displayName}</strong>?
            </p>
            <p style={styles.confirmWarn}>
              Your cart for the previous town will be cleared. This cannot be undone.
            </p>
            <div style={styles.confirmActions}>
              <Button type="button" disabled={busy} onClick={() => void confirmSwitch()} fullWidth>
                {busy ? 'Switching…' : 'Yes, switch town'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setPendingTown(null)}
                fullWidth
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.4)',
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  sheet: {
    width: 'min(400px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    padding: '0.85rem 0.9rem 0.95rem',
    display: 'grid',
    gap: '0.45rem',
    boxShadow: 'var(--shadow-elevated)',
    maxHeight: 'min(72vh, 480px)',
    overflow: 'hidden',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  closeLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    padding: '0.15rem 0.25rem',
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.3 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.28rem',
    overflowY: 'auto',
    maxHeight: 'min(42vh, 320px)',
    WebkitOverflowScrolling: 'touch',
  },
  townBtn: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
    padding: '0.45rem 0.65rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    minHeight: 40,
  },
  townBtnSelected: {
    borderColor: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',
  },
  townBtnDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  townName: {
    fontWeight: 700,
    color: 'var(--text)',
    fontSize: '0.88rem',
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  },
  townMeta: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    flexShrink: 0,
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
  errorBox: {
    display: 'grid',
    gap: '0.35rem',
    padding: '0.5rem 0.6rem',
    borderRadius: 8,
    background: 'color-mix(in srgb, #b91c1c 10%, var(--bg))',
  },
  errorText: { margin: 0, color: '#b91c1c', fontSize: '0.78rem' },
  confirmBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    zIndex: 90,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  confirmSheet: {
    width: 'min(360px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    border: '1.5px solid var(--border)',
    padding: '1rem',
    display: 'grid',
    gap: '0.55rem',
    boxShadow: 'var(--shadow-elevated)',
  },
  confirmTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  confirmBody: {
    margin: 0,
    fontSize: '0.88rem',
    lineHeight: 1.4,
    color: 'var(--text)',
  },
  confirmWarn: {
    margin: 0,
    fontSize: '0.8rem',
    lineHeight: 1.4,
    fontWeight: 650,
    color: '#92400e',
    background: 'rgba(245, 158, 11, 0.14)',
    border: '1px solid rgba(245, 158, 11, 0.45)',
    borderRadius: 10,
    padding: '0.55rem 0.65rem',
  },
  confirmActions: { display: 'grid', gap: '0.4rem' },
};
