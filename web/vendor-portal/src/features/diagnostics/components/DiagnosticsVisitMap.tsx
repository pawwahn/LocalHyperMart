import type { CSSProperties } from 'react';

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function mapsEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;
}

export function DiagnosticsVisitMap({
  address,
  height = 132,
  compact = false,
}: {
  address: string;
  height?: number;
  compact?: boolean;
}) {
  const trimmed = address.trim();
  if (!trimmed) return null;

  return (
    <div style={styles.wrap}>
      <iframe
        title="Patient location"
        src={mapsEmbedUrl(trimmed)}
        style={{ ...styles.frame, height }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div style={styles.links}>
        <a href={mapsDirectionsUrl(trimmed)} target="_blank" rel="noreferrer" style={styles.link}>
          Navigate
        </a>
        <a href={mapsSearchUrl(trimmed)} target="_blank" rel="noreferrer" style={styles.link}>
          Open maps
        </a>
        {compact ? null : <span style={styles.hint}>{trimmed}</span>}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.28rem', minWidth: 0 },
  frame: {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: '#f8fafc',
  },
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.45rem',
  },
  link: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: '#0f766e',
    textDecoration: 'none',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
  },
  hint: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    lineHeight: 1.3,
    flex: '1 1 8rem',
    minWidth: 0,
  },
};
