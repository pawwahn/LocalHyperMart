import { useEffect, useState, type CSSProperties } from 'react';
import { visualForCategory } from '../lib/aisles';

function usableCategoryImage(url?: string | null): url is string {
  if (!url?.trim()) return false;
  const t = url.trim();
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/') || t.startsWith('data:image/');
}

type Props = {
  label: string;
  emoji?: string;
  imageUrl?: string | null;
  staggerIndex?: number;
  onClick: () => void;
};

export function CategoryTile({ label, emoji, imageUrl, onClick }: Props) {
  const visual = visualForCategory(label);
  const icons = visual.icons.length ? visual.icons : [emoji ?? '🛒'];
  const solo = icons.length === 1;
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => {
    setImgBroken(false);
  }, [imageUrl]);
  const showPhoto = usableCategoryImage(imageUrl) && !imgBroken;

  return (
    <button
      type="button"
      className="hlm-cat-tile"
      style={{ '--cat-tint': visual.tint } as CSSProperties}
      onClick={onClick}
    >
      <span className={`hlm-cat-tile-visual${showPhoto ? '' : ' hlm-cat-tile-visual--emoji'}`}>
        {showPhoto ? (
          <img
            src={imageUrl.trim()}
            alt=""
            className="hlm-cat-tile-photo"
            loading="lazy"
            decoding="async"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <span className="hlm-cat-tile-collage" aria-hidden>
            {icons.map((icon, i) => {
              const fontSize = solo ? '2.1rem' : i === 0 ? '1.65rem' : '1.2rem';
              const offset = solo
                ? 'translate(-50%, -50%)'
                : i === 0
                  ? 'translate(calc(-50% - 4px), calc(-50% + 2px))'
                  : i === 1
                    ? 'translate(calc(-50% + 7px), calc(-50% - 6px))'
                    : 'translate(calc(-50% + 2px), calc(-50% + 8px))';
              return (
                <span
                  key={`${icon}-${i}`}
                  className="hlm-cat-tile-emoji"
                  style={{ zIndex: icons.length - i, fontSize, transform: offset }}
                >
                  {icon}
                </span>
              );
            })}
          </span>
        )}
      </span>
      <span className="hlm-cat-tile-label">{label}</span>
    </button>
  );
}
