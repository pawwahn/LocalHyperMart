import type { CSSProperties } from 'react';
import { useTown } from '@/shared/town/TownContext';
import { Button } from '@/shared/ui';

export function TownPickerSheet() {
  const { pickerOpen, closePicker, towns, townId, hasTown, selectTown, loading, error, reloadTowns } =
    useTown();

  if (!pickerOpen) return null;

  return (
    <div style={styles.backdrop} role="presentation" onClick={closePicker}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="town-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.handle} aria-hidden />
        <div style={styles.head}>
          <h2 id="town-picker-title" style={styles.title}>
            Choose town
          </h2>
          {hasTown ? (
            <button type="button" style={styles.closeLink} onClick={closePicker}>
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
            const disabled = !town.acceptingOrders;
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
                  onClick={() => void selectTown(town)}
                >
                  <span style={styles.townName}>{town.displayName}</span>
                  <span style={styles.townMeta}>
                    {town.stateCode}
                    {selected ? ' · ✓' : ''}
                    {disabled ? ' · soon' : ''}
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
    alignItems: 'end',
    justifyItems: 'center',
    padding: '0.5rem',
  },
  sheet: {
    width: 'min(420px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: '14px 14px 10px 10px',
    padding: '0.45rem 0.65rem 0.7rem',
    display: 'grid',
    gap: '0.4rem',
    boxShadow: 'var(--shadow-elevated)',
    maxHeight: 'min(58vh, 420px)',
    overflow: 'hidden',
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 999,
    background: 'var(--border)',
    margin: '0 auto',
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
};
