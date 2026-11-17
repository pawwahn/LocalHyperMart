import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  fetchFoodProfile,
  saveFoodHotelPhotos,
  uploadFoodHotelPhoto,
  type FoodHotelPhoto,
  type FoodProfileVm,
} from '../api/foodApi';

const MAX = 8;
const THUMB = 76;

type Props = {
  token: string;
  vendorId: string;
  onToast: (message: string) => void;
  onError: (message: string) => void;
  /** Full-width page on Hotel Images route; compact card when embedded. */
  layout?: 'embedded' | 'page';
};

function slotsFromPhotos(photos: FoodHotelPhoto[]): (FoodHotelPhoto | null)[] {
  const slots: (FoodHotelPhoto | null)[] = Array.from({ length: MAX }, () => null);
  photos.slice(0, MAX).forEach((photo, index) => {
    slots[index] = photo;
  });
  return slots;
}

function mediaIdsFromSlots(slots: (FoodHotelPhoto | null)[]): string[] {
  return slots.filter((row): row is FoodHotelPhoto => row != null).map((row) => row.mediaId);
}

/** Filled slots plus the next empty slot only — keeps the row compact. */
function visibleSlotIndexes(slots: (FoodHotelPhoto | null)[]): number[] {
  const lastFilled = slots.reduce((acc, p, i) => (p ? i : acc), -1);
  const showThrough = Math.min(MAX - 1, lastFilled + 1);
  return Array.from({ length: showThrough + 1 }, (_, i) => i);
}

export function FoodHotelPhotosCard({ token, vendorId, onToast, onError, layout = 'embedded' }: Props) {
  const page = layout === 'page';
  const thumb = page ? 92 : THUMB;
  const [profile, setProfile] = useState<FoodProfileVm | null>(null);
  const savedPhotos = profile?.hotelPhotos ?? [];
  const [slots, setSlots] = useState<(FoodHotelPhoto | null)[]>(() => slotsFromPhotos(savedPhotos));
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!token || !vendorId) return;
    setLoading(true);
    void fetchFoodProfile(token, vendorId)
      .then(setProfile)
      .catch((err) => onError(err instanceof Error ? err.message : 'Could not load food profile'))
      .finally(() => setLoading(false));
  }, [token, vendorId, onError]);

  useEffect(() => {
    setSlots(slotsFromPhotos(savedPhotos));
  }, [profile?.vendorId, savedPhotos.map((p) => p.mediaId).join('|')]);

  const dirty = useMemo(() => {
    const draft = mediaIdsFromSlots(slots).join('|');
    const saved = savedPhotos.map((p) => p.mediaId).join('|');
    return draft !== saved;
  }, [slots, savedPhotos]);

  const visible = useMemo(() => visibleSlotIndexes(slots), [slots]);

  function openPicker(index: number) {
    pendingIndex.current = index;
    inputRef.current?.click();
  }

  async function persist(nextSlots: (FoodHotelPhoto | null)[]) {
    if (!token || !vendorId) return;
    setSaving(true);
    try {
      const saved = await saveFoodHotelPhotos(token, vendorId, { mediaIds: mediaIdsFromSlots(nextSlots) });
      setProfile(saved);
      onToast('Hotel photos saved — customers will see these on Food');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not save hotel photos';
      const hint =
        /internal server error|hotel_photo|schema|migration/i.test(raw)
          ? 'Restart vendor-service (port 8083) so Flyway migration V34 runs, then try again.'
          : raw;
      onError(hint);
    } finally {
      setSaving(false);
    }
  }

  async function removeAt(index: number) {
    const next = [...slots];
    next[index] = null;
    const normalized = slotsFromPhotos(next.filter((row): row is FoodHotelPhoto => row != null));
    setSlots(normalized);
    await persist(normalized);
  }

  async function onFileSelected(file: File | undefined) {
    const index = pendingIndex.current;
    pendingIndex.current = null;
    if (!file || index == null || !token) return;
    setBusyIndex(index);
    try {
      const uploaded = await uploadFoodHotelPhoto(token, file);
      const next = [...slots];
      next[index] = uploaded;
      const normalized = slotsFromPhotos(next.filter((row): row is FoodHotelPhoto => row != null));
      setSlots(normalized);
      await persist(normalized);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setBusyIndex(null);
    }
  }

  const filledCount = slots.filter(Boolean).length;

  return (
    <section
      style={{ ...styles.card, ...(page ? styles.cardPage : null) }}
      aria-label={page ? 'Hotel Images' : 'Hotel photos'}
    >
      <div style={styles.head}>
        <div style={styles.headText}>
          <p style={{ ...styles.title, ...(page ? styles.titlePage : null) }}>
            {page ? 'Hotel Images' : 'Hotel photos'}
          </p>
          <p style={styles.sub}>
            Up to {MAX} square thumbnails for buyers ({filledCount}/{MAX}). Use landscape photos — we crop to square
            here.
          </p>
        </div>
        <button
          type="button"
          style={styles.saveBtn}
          disabled={!dirty || saving || busyIndex != null || loading}
          onClick={() => void persist(slots)}
        >
          {saving ? 'Saving…' : dirty ? 'Save order' : 'Saved'}
        </button>
      </div>
      {loading ? <p style={styles.muted}>Loading…</p> : null}
      <ThumbGrid page={page}>
        {visible.map((index) => (
          <PhotoSlot
            key={index}
            index={index}
            photo={slots[index]}
            thumb={thumb}
            busy={busyIndex === index}
            disabled={saving || busyIndex != null}
            onPick={() => openPicker(index)}
            onRemove={() => void removeAt(index)}
          />
        ))}
      </ThumbGrid>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void onFileSelected(file);
        }}
      />
    </section>
  );
}

function ThumbGrid({ children, page }: { children: ReactNode; page?: boolean }) {
  return <div style={{ ...styles.grid, ...(page ? styles.gridPage : null) }}>{children}</div>;
}

function PhotoSlot({
  index,
  photo,
  thumb,
  busy,
  disabled,
  onPick,
  onRemove,
}: {
  index: number;
  photo: FoodHotelPhoto | null;
  thumb: number;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const size = { width: thumb, height: thumb, maxWidth: thumb, maxHeight: thumb };
  if (photo) {
    return (
      <div style={{ ...styles.slotFilled, ...size }}>
        <img src={photo.url} alt="" style={{ ...styles.img, ...size }} loading="lazy" />
        <span style={styles.indexBadge}>{index + 1}</span>
        <button type="button" style={styles.remove} disabled={disabled} onClick={onRemove} aria-label="Remove photo">
          ×
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      style={{ ...styles.slotEmpty, ...size }}
      disabled={disabled || busy}
      onClick={onPick}
      aria-label={`Add photo ${index + 1}`}
    >
      {busy ? '…' : '+'}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    padding: '0.45rem 0.5rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    marginBottom: '0.35rem',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  cardPage: {
    padding: '0.75rem 0.85rem',
    borderRadius: 14,
    marginBottom: 0,
    boxShadow: 'var(--shadow-card)',
  },
  titlePage: { fontSize: '1.02rem' },
  gridPage: {
    gap: '0.5rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginBottom: '0.4rem',
  },
  headText: { minWidth: 0, flex: 1 },
  title: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  sub: { margin: '0.12rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  saveBtn: {
    flexShrink: 0,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.28rem 0.55rem',
    fontWeight: 700,
    fontSize: '0.75rem',
    background: 'var(--bg)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min, 40px)',
  },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  slotFilled: {
    position: 'relative',
    width: THUMB,
    height: THUMB,
    flexShrink: 0,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    background: '#0f172a',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    maxWidth: THUMB,
    maxHeight: THUMB,
  },
  indexBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#fff',
    background: 'rgba(15,23,42,0.65)',
    padding: '0.1rem 0.3rem',
    borderRadius: 4,
  },
  remove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 999,
    border: 'none',
    background: 'rgba(15,23,42,0.78)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: 1,
  },
  slotEmpty: {
    width: THUMB,
    height: THUMB,
    flexShrink: 0,
    borderRadius: 10,
    border: '1px dashed color-mix(in srgb, var(--accent) 40%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 4%, var(--bg-elevated))',
    fontWeight: 800,
    fontSize: '1.25rem',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: 0,
  },
};