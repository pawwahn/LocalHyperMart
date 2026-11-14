import { useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ShopServiceBanner } from '../config/shopServiceBanners';
import {
  ServiceDiagnosticsIcon,
  ServiceGlamIcon,
  ServiceGroceryIcon,
  ServiceLaundryIcon,
} from './JumpCardIcons';

type Props = {
  open: boolean;
  services: ShopServiceBanner[];
  onClose: () => void;
};

function ServiceIcon({ id, accent }: { id: ShopServiceBanner['id']; accent: string }) {
  const wrap: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: `color-mix(in srgb, ${accent} 11%, var(--bg-muted))`,
    color: accent,
    flexShrink: 0,
  };
  return (
    <span style={wrap} aria-hidden>
      {id === 'grocery' ? (
        <ServiceGroceryIcon />
      ) : id === 'glam' ? (
        <ServiceGlamIcon />
      ) : id === 'diagnostics' ? (
        <ServiceDiagnosticsIcon />
      ) : (
        <ServiceLaundryIcon />
      )}
    </span>
  );
}

export function ServicesPickerSheet({ open, services, onClose }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function pickService(banner: ShopServiceBanner) {
    onClose();
    navigate(banner.to);
  }

  return (
    <div style={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="services-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.handle} aria-hidden />
        <div style={styles.header}>
          <h2 id="services-picker-title" style={styles.title}>
            Services in your town
          </h2>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close services">
            ×
          </button>
        </div>
        <p style={styles.sub}>Grocery delivery, glam, laundry, lab tests, and more.</p>
        <ul style={styles.list}>
          {services.map((banner) => (
            <li key={banner.id} style={styles.listItem}>
              <button
                type="button"
                style={styles.row}
                aria-label={banner.ariaLabel}
                onClick={() => pickService(banner)}
              >
                <ServiceIcon id={banner.id} accent={banner.accent} />
                <span style={styles.copy}>
                  <strong style={styles.rowTitle}>{banner.title}</strong>
                  <span style={styles.hint}>{banner.hint}</span>
                </span>
                <span style={{ ...styles.cta, color: banner.accent }}>{banner.cta}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    background: 'var(--bg-elevated)',
    borderRadius: '18px 18px 0 0',
    padding: '0.35rem var(--shell-pad) calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 0.65rem)',
    boxShadow: '0 -8px 32px rgba(16, 24, 40, 0.12)',
    animation: 'hlm-slide-up 220ms ease both',
    maxHeight: 'min(72dvh, 520px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--border) 90%, transparent)',
    margin: '0.15rem auto 0.55rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },
  closeBtn: {
    border: 'none',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    width: 32,
    height: 32,
    borderRadius: 10,
    fontSize: '1.25rem',
    lineHeight: 1,
    cursor: 'pointer',
    flexShrink: 0,
  },
  sub: {
    margin: '0.25rem 0 0.65rem',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.45rem',
  },
  listItem: { margin: 0, padding: 0 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    width: '100%',
    border: '1px solid color-mix(in srgb, var(--border) 85%, transparent)',
    borderRadius: 14,
    background: 'var(--bg)',
    padding: '0.55rem 0.6rem',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    minHeight: 'var(--touch-min)',
    boxSizing: 'border-box',
  },
  copy: {
    display: 'grid',
    gap: '0.12rem',
    flex: '1 1 auto',
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.92rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  hint: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  cta: {
    flexShrink: 0,
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
};
