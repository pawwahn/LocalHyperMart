import type { CSSProperties } from 'react';
import { visualForCategory } from '../lib/aisles';

type Props = {
  label: string;
  emoji?: string;
  imageUrl?: string | null;
  onClick: () => void;
};

/** Rounded pastel tile + caption — Zepto / Instamart home grid. */
export function CategoryTile({ label, emoji, imageUrl, onClick }: Props) {
  const visual = visualForCategory(label);
  const icons = visual.icons.length ? visual.icons : [emoji ?? '🛒'];

  return (
    <button type="button" style={styles.btn} onClick={onClick}>
      <span
        style={{ ...styles.tile, background: visual.tint }}
        className="hlm-aisle-tile"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" style={styles.img} />
        ) : (
          <span style={styles.collage} aria-hidden>
            {icons.map((icon, i) => (
              <span
                key={`${icon}-${i}`}
                style={{
                  ...styles.icon,
                  fontSize: icons.length === 1 ? '1.85rem' : i === 0 ? '1.55rem' : '1.15rem',
                  zIndex: icons.length - i,
                  transform:
                    icons.length === 1
                      ? 'none'
                      : i === 0
                        ? 'translate(-6px, 4px)'
                        : i === 1
                          ? 'translate(10px, -8px)'
                          : 'translate(4px, 12px)',
                }}
              >
                {icon}
              </span>
            ))}
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
    gap: '0.32rem',
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
    borderRadius: 18,
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
  collage: {
    position: 'relative',
    width: '78%',
    height: '78%',
    display: 'grid',
    placeItems: 'center',
  },
  icon: {
    position: 'absolute',
    lineHeight: 1,
    filter: 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.12))',
  },
  label: {
    fontSize: '0.68rem',
    fontWeight: 700,
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
