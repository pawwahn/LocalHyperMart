import type { CSSProperties } from 'react';

type Props = {
  label: string;
  emoji: string;
  imageUrl?: string | null;
  onClick: () => void;
};

/** Dark squircle tile + caption — Blinkit/Zepto home grid. */
export function CategoryTile({ label, emoji, imageUrl, onClick }: Props) {
  return (
    <button type="button" style={styles.btn} onClick={onClick}>
      <span style={styles.tile} className="hlm-aisle-tile">
        {imageUrl ? (
          <img src={imageUrl} alt="" style={styles.img} />
        ) : (
          <span style={styles.emoji} aria-hidden>
            {emoji}
          </span>
        )}
      </span>
      <span style={styles.label}>{label}</span>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  btn: {
    display: 'grid',
    justifyItems: 'center',
    gap: '0.35rem',
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    color: 'var(--text)',
    minWidth: 0,
    width: '100%',
  },
  tile: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 16,
    background: 'var(--bg-muted)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  img: {
    width: '86%',
    height: '86%',
    objectFit: 'contain',
    display: 'block',
  },
  emoji: { fontSize: '1.85rem', lineHeight: 1 },
  label: {
    fontSize: '0.68rem',
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: 'center',
    color: 'var(--text)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    minHeight: '1.65em',
  },
};
