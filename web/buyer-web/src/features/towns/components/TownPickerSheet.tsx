import type { CSSProperties } from 'react';
import { useTown } from '@/shared/town/TownContext';
import { Button } from '@/shared/ui';

export function TownPickerSheet() {
  const { pickerOpen, closePicker, towns, townId, selectTown, loading, error, reloadTowns } =
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
        <h2 id="town-picker-title" style={styles.title}>
          Choose your town
        </h2>
        <p style={styles.sub}>We show shops and delivery for one town at a time.</p>

        {error ? (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>{error}</p>
            <Button size="sm" onClick={() => void reloadTowns()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading && towns.length === 0 ? <p style={styles.muted}>Loading towns…</p> : null}

        <ul style={styles.list}>
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
                  onClick={() => selectTown(town)}
                >
                  <span style={styles.townName}>{town.displayName}</span>
                  <span style={styles.townMeta}>
                    {town.stateCode}
                    {selected ? ' · Selected' : ''}
                    {disabled ? ' · Coming soon' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {!loading && towns.length === 0 && !error ? (
          <p style={styles.muted}>No towns are open for orders yet.</p>
        ) : null}

        <Button variant="ghost" fullWidth onClick={closePicker}>
          Close
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: 80,
    display: 'grid',
    alignItems: 'end',
    justifyItems: 'center',
    padding: '0.75rem',
  },
  sheet: {
    width: 'min(480px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 1rem 1rem',
    padding: '0.75rem 1rem 1.1rem',
    display: 'grid',
    gap: '0.75rem',
    boxShadow: 'var(--shadow-elevated)',
    maxHeight: 'min(72vh, 560px)',
    overflow: 'auto',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    background: 'var(--border)',
    margin: '0 auto 0.15rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' },
  townBtn: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg)',
    padding: '0.85rem 1rem',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.2rem',
  },
  townBtnSelected: {
    borderColor: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',
  },
  townBtnDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  townName: { fontWeight: 800, color: 'var(--text)', fontSize: '1rem' },
  townMeta: { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 },
  muted: { margin: 0, color: 'var(--text-muted)' },
  errorBox: {
    display: 'grid',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    background: 'color-mix(in srgb, #b91c1c 10%, var(--bg))',
  },
  errorText: { margin: 0, color: '#b91c1c', fontSize: '0.88rem' },
};
