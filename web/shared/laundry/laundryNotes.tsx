import type { CSSProperties } from 'react';

/** Shown while booking — saved once on the order (special instructions). */
export function LaundryBookingNote({
  shopName,
  value,
  onChange,
}: {
  shopName: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section style={styles.bookingShell} aria-label="Note for shop">
      <div style={styles.bookingHead}>
        <span style={styles.avatar} aria-hidden>{shopName.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong style={styles.bookingTitle}>Note for {shopName}</strong>
          <p style={styles.bookingSub}>Optional · add before you place the request. The shop sees this on your order.</p>
        </div>
      </div>
      <textarea
        style={styles.bookingInput}
        rows={3}
        maxLength={400}
        value={value}
        placeholder="e.g. Iron sherwani carefully, call before pickup"
        onChange={(e) => onChange(e.target.value)}
      />
    </section>
  );
}

/** Read-only note on order detail (buyer + vendor). */
export function LaundryCustomerNote({ note }: { note?: string | null }) {
  const text = note?.trim();
  if (!text) return null;
  return (
    <section style={styles.noteShell} aria-label="Customer note">
      <span style={styles.noteLabel}>Customer note</span>
      <p style={styles.noteBody}>{text}</p>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  bookingShell: {
    display: 'grid',
    gap: '0.45rem',
    padding: '0.65rem 0.7rem',
    borderRadius: 14,
    border: '1px solid color-mix(in srgb, var(--accent, #166534) 20%, var(--border, #e5e7eb))',
    background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent, #166534) 7%, #fff), var(--bg-elevated, #fff))',
  },
  bookingHead: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 900,
    fontSize: '0.9rem',
    color: 'var(--accent-hover, #14532d)',
    background: 'color-mix(in srgb, var(--accent, #166534) 16%, #fff)',
    flexShrink: 0,
  },
  bookingTitle: { fontSize: '0.88rem', fontWeight: 800 },
  bookingSub: { margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.35 },
  bookingInput: {
    minHeight: 72,
    borderRadius: 12,
    border: '1px solid var(--border, #e5e7eb)',
    padding: '0.5rem 0.6rem',
    font: 'inherit',
    resize: 'vertical',
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
  },
  noteShell: {
    padding: '0.55rem 0.65rem',
    borderRadius: 12,
    borderLeft: '3px solid var(--accent, #166534)',
    background: 'color-mix(in srgb, var(--accent, #166534) 8%, var(--bg-elevated, #fff))',
    display: 'grid',
    gap: '0.25rem',
  },
  noteLabel: { fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #64748b)' },
  noteBody: { margin: 0, fontSize: '0.86rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', fontWeight: 650 },
};
