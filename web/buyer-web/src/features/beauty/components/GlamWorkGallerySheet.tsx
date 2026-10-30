import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BeautyWorkPhoto } from '../api/beautyApi';

type Props = {
  open: boolean;
  artistName: string;
  photos: BeautyWorkPhoto[];
  onClose: () => void;
};

export function GlamWorkGallerySheet({ open, artistName, photos, onClose }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setLightboxIndex(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIndex != null) setLightboxIndex(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightboxIndex, onClose]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: lightboxIndex * el.clientWidth, behavior: 'auto' });
  }, [lightboxIndex]);

  if (!open) return null;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const onLightboxScroll = () => {
    const el = scrollerRef.current;
    if (!el || photos.length <= 1) return;
    const idx = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    setLightboxIndex(Math.max(0, Math.min(photos.length - 1, idx)));
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setLightboxIndex(idx);
  };

  const activeIndex = lightboxIndex ?? 0;

  return (
    <>
      <div style={styles.backdrop} role="presentation" onClick={onClose}>
        <div style={styles.sheet} role="dialog" aria-label={`Our work — ${artistName}`} onClick={(e) => e.stopPropagation()}>
          <div style={styles.head}>
            <div>
              <h3 style={styles.title}>Our work</h3>
              <p style={styles.sub}>{artistName}</p>
            </div>
            <button type="button" style={styles.closeBtn} aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
          {photos.length === 0 ? (
            <p style={styles.empty}>This artist has not added portfolio photos yet.</p>
          ) : (
            <>
              <p style={styles.hint}>Tap a photo to view full screen · swipe to browse</p>
              <div style={styles.grid}>
                {photos.map((photo, index) => (
                  <button
                    key={photo.mediaId}
                    type="button"
                    style={styles.cell}
                    aria-label={`View photo ${index + 1} of ${photos.length}`}
                    onClick={() => openLightbox(index)}
                  >
                    <img src={photo.url} alt="" style={styles.img} loading="lazy" draggable={false} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {lightboxIndex != null && photos.length > 0 ? (
        <div
          style={styles.lightboxBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${activeIndex + 1} of ${photos.length}`}
          onClick={() => setLightboxIndex(null)}
        >
          <div style={styles.lightboxBar} onClick={(e) => e.stopPropagation()}>
            <button type="button" style={styles.lightboxBack} onClick={() => setLightboxIndex(null)}>
              ← Gallery
            </button>
            <span style={styles.lightboxCount}>
              {activeIndex + 1} / {photos.length}
            </span>
            <button type="button" style={styles.lightboxClose} aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div style={styles.lightboxStage} onClick={(e) => e.stopPropagation()}>
            <div
              ref={scrollerRef}
              className="hlm-hide-scrollbar"
              style={styles.lightboxScroller}
              onScroll={onLightboxScroll}
            >
              {photos.map((photo) => (
                <div key={photo.mediaId} style={styles.lightboxSlide}>
                  <img src={photo.url} alt="" style={styles.lightboxImg} draggable={false} />
                </div>
              ))}
            </div>
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  style={{ ...styles.lightboxNav, ...styles.lightboxNavPrev }}
                  disabled={activeIndex <= 0}
                  aria-label="Previous photo"
                  onClick={() => goTo(activeIndex - 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  style={{ ...styles.lightboxNav, ...styles.lightboxNavNext }}
                  disabled={activeIndex >= photos.length - 1}
                  aria-label="Next photo"
                  onClick={() => goTo(activeIndex + 1)}
                >
                  ›
                </button>
                <div style={styles.dots} role="tablist" aria-label="Photos">
                  {photos.map((photo, i) => (
                    <button
                      key={photo.mediaId}
                      type="button"
                      role="tab"
                      aria-selected={i === activeIndex}
                      aria-label={`Photo ${i + 1}`}
                      style={i === activeIndex ? styles.dotActive : styles.dot}
                      onClick={() => goTo(i)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: 65,
    display: 'grid',
    alignItems: 'end',
  },
  sheet: {
    background: 'linear-gradient(180deg, #fff 0%, #fdf2f8 100%)',
    borderRadius: '22px 22px 0 0',
    padding: '1rem 0.85rem calc(1rem + env(safe-area-inset-bottom))',
    display: 'grid',
    gap: '0.65rem',
    borderTop: '1px solid rgba(244, 114, 182, 0.35)',
    maxHeight: 'min(88vh, 640px)',
    overflow: 'auto',
  },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 900, color: '#831843' },
  sub: { margin: '0.15rem 0 0', fontSize: '0.72rem', fontWeight: 700, color: '#64748b' },
  closeBtn: {
    border: 'none',
    background: '#fce7f3',
    color: '#9d174d',
    borderRadius: 999,
    width: 32,
    height: 32,
    fontWeight: 900,
    cursor: 'pointer',
    flexShrink: 0,
  },
  hint: { margin: 0, fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' },
  empty: { margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.35rem',
  },
  cell: {
    display: 'block',
    padding: 0,
    borderRadius: 10,
    overflow: 'hidden',
    aspectRatio: '1',
    border: '1px solid rgba(244, 114, 182, 0.25)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
    cursor: 'pointer',
    background: '#fff',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  lightboxBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 70,
    background: 'rgba(15, 23, 42, 0.92)',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
  },
  lightboxBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.65rem 0.75rem',
    paddingTop: 'max(0.65rem, env(safe-area-inset-top))',
  },
  lightboxBack: {
    border: 'none',
    background: 'rgba(255,255,255,0.12)',
    color: '#fce7f3',
    borderRadius: 999,
    padding: '0.35rem 0.65rem',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  lightboxCount: { color: '#f9a8d4', fontWeight: 800, fontSize: '0.78rem' },
  lightboxClose: {
    border: 'none',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    borderRadius: 999,
    width: 34,
    height: 34,
    fontWeight: 900,
    cursor: 'pointer',
  },
  lightboxStage: {
    position: 'relative',
    minHeight: 0,
    display: 'grid',
    alignContent: 'center',
    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
  },
  lightboxScroller: {
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
    width: '100%',
    maxHeight: 'min(72vh, 520px)',
  },
  lightboxSlide: {
    flex: '0 0 100%',
    scrollSnapAlign: 'center',
    display: 'grid',
    placeItems: 'center',
    padding: '0 0.5rem',
  },
  lightboxImg: {
    maxWidth: '100%',
    maxHeight: 'min(72vh, 520px)',
    objectFit: 'contain',
    borderRadius: 8,
    userSelect: 'none',
  },
  lightboxNav: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    width: 40,
    height: 40,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: '1.5rem',
    lineHeight: 1,
    cursor: 'pointer',
    fontWeight: 300,
  },
  lightboxNavPrev: { left: '0.35rem' },
  lightboxNavNext: { right: '0.35rem' },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.65rem 0 0.25rem',
    flexWrap: 'wrap',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: '#f472b6',
    cursor: 'pointer',
    boxShadow: '0 0 0 2px rgba(244, 114, 182, 0.45)',
  },
};
