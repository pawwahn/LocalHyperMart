import type { CSSProperties } from 'react';
import { usePlatformBrand } from './PlatformBrandProvider';

type Variant = 'header' | 'sidebar' | 'login' | 'compact';

type Props = {
  variant?: Variant;
  /** Shown next to logo when no image (header/login). */
  tagline?: string | null;
  /** e.g. "Super Admin", "Delivery" */
  subtitle?: string | null;
  /** Override name when logo missing. */
  fallbackName?: string;
  className?: string;
  style?: CSSProperties;
};

export function BrandMark({
  variant = 'header',
  tagline,
  subtitle,
  fallbackName,
  className,
  style,
}: Props) {
  const { logoSrc, appName, loading } = usePlatformBrand();
  const name = fallbackName?.trim() || appName || 'KoyaKart';

  const imgHeight =
    variant === 'sidebar' ? 36 : variant === 'login' ? 52 : variant === 'compact' ? 28 : 32;

  const column = variant === 'sidebar' || Boolean(tagline);
  /** Login may show the uploaded mark. App chrome always uses the themed wordmark. */
  const showLogo = variant === 'login' && Boolean(logoSrc);

  return (
    <div
      className={className}
      style={{ ...styles.wrap(variant, column), ...style }}
    >
      <div style={styles.markRow}>
        {showLogo ? (
          <img
            src={logoSrc}
            alt={name}
            style={styles.img(imgHeight, variant)}
            decoding="async"
          />
        ) : loading && variant === 'login' ? (
          <span style={styles.placeholder(imgHeight)} aria-hidden />
        ) : (
          <span style={styles.textName(variant)}>{name}</span>
        )}
        {subtitle && !column ? <span style={styles.subtitle(variant)}>{subtitle}</span> : null}
      </div>
      {subtitle && column ? <span style={styles.subtitle(variant)}>{subtitle}</span> : null}
      {tagline ? <span style={styles.tagline}>{tagline}</span> : null}
    </div>
  );
}

const styles = {
  wrap: (variant: Variant, column: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: column ? 'column' : 'row',
    alignItems: column ? 'flex-start' : 'center',
    gap: column ? '0.15rem' : '0.45rem',
    minWidth: 0,
  }),
  markRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '0.45rem',
    minWidth: 0,
  } satisfies CSSProperties,
  img: (height: number, variant: Variant): CSSProperties => ({
    height,
    width: 'auto',
    maxWidth: variant === 'login' ? 220 : 160,
    objectFit: 'contain',
    display: 'block',
    flexShrink: 0,
  }),
  placeholder: (height: number): CSSProperties => ({
    display: 'inline-block',
    width: height * 2.2,
    height,
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--border, #ccc) 40%, transparent)',
  }),
  textName: (variant: Variant): CSSProperties => ({
    margin: 0,
    fontFamily: 'var(--font-display, system-ui)',
    fontWeight: 800,
    fontSize: variant === 'login' ? '1.35rem' : variant === 'sidebar' ? '1.05rem' : '1.02rem',
    letterSpacing: '-0.03em',
    /* Wordmark stays brand green on app chrome. Login heroes are green — inherit inverse white. */
    color: variant === 'login' ? 'inherit' : 'var(--brand, var(--accent, #0C831F))',
    lineHeight: 1.15,
  }),
  subtitle: (variant: Variant): CSSProperties => ({
    margin: 0,
    fontSize: variant === 'sidebar' ? '0.68rem' : '0.72rem',
    fontWeight: 700,
    opacity: 0.85,
    lineHeight: 1.2,
  }),
  tagline: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 650,
    opacity: 0.8,
    lineHeight: 1.25,
  } satisfies CSSProperties,
};
