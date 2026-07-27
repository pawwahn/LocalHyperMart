import type { CSSProperties } from 'react';

type Props = {
  value: number;
  onChange?: (stars: number) => void;
  size?: 'sm' | 'md';
  readOnly?: boolean;
  label?: string;
};

/** Interactive or read-only 1–5 star control. */
export function StarRating({ value, onChange, size = 'md', readOnly, label }: Props) {
  const stars = [1, 2, 3, 4, 5];
  const fontSize = size === 'sm' ? '0.95rem' : '1.25rem';
  return (
    <div style={styles.wrap} role={readOnly ? 'img' : 'group'} aria-label={label ?? `${value} of 5 stars`}>
      {stars.map((star) => {
        const filled = star <= value;
        if (readOnly || !onChange) {
          return (
            <span key={star} style={{ ...styles.star, fontSize, color: filled ? '#C47B17' : '#D1D5DB' }}>
              ★
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            style={{
              ...styles.btn,
              fontSize,
              color: filled ? '#C47B17' : '#D1D5DB',
            }}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            aria-pressed={filled}
            onClick={() => onChange(star)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: 2 },
  star: { lineHeight: 1 },
  btn: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    lineHeight: 1,
  },
};
