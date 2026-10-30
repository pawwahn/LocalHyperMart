import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  saveBeautyWorkPhotos,
  uploadGlamWorkPhoto,
  type BeautyProfile,
  type BeautyWorkPhoto,
} from '../api/beautyApi';

const MAX = 10;

type Props = {
  token: string;
  profile: BeautyProfile | null;
  onSaved: (saved: BeautyProfile) => void;
  onError: (message: string) => void;
  onToast: (message: string) => void;
};

function slotsFromPhotos(photos: BeautyWorkPhoto[]): (BeautyWorkPhoto | null)[] {
  const slots: (BeautyWorkPhoto | null)[] = Array.from({ length: MAX }, () => null);
  photos.slice(0, MAX).forEach((photo, index) => {
    slots[index] = photo;
  });
  return slots;
}

function mediaIdsFromSlots(slots: (BeautyWorkPhoto | null)[]): string[] {
  return slots.filter((row): row is BeautyWorkPhoto => row != null).map((row) => row.mediaId);
}

export function GlamWorkPhotosCard({ token, profile, onSaved, onError, onToast }: Props) {
  const savedPhotos = profile?.workPhotos ?? [];
  const [slots, setSlots] = useState<(BeautyWorkPhoto | null)[]>(() => slotsFromPhotos(savedPhotos));
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingIndex = useRef<number | null>(null);

  useEffect(() => {
    setSlots(slotsFromPhotos(savedPhotos));
  }, [profile?.vendorId, savedPhotos.map((p) => p.mediaId).join('|')]);

  const dirty = useMemo(() => {
    const draft = mediaIdsFromSlots(slots).join('|');
    const saved = savedPhotos.map((p) => p.mediaId).join('|');
    return draft !== saved;
  }, [slots, savedPhotos]);

  function openPicker(index: number) {
    pendingIndex.current = index;
    inputRef.current?.click();
  }

  async function removeAt(index: number) {
    const next = [...slots];
    next[index] = null;
    const normalized = slotsFromPhotos(next.filter((row): row is BeautyWorkPhoto => row != null));
    setSlots(normalized);
    await persist(normalized);
  }

  async function persist(nextSlots: (BeautyWorkPhoto | null)[]) {
    if (!token) return;
    setSaving(true);
    try {
      const saved = await saveBeautyWorkPhotos(token, { mediaIds: mediaIdsFromSlots(nextSlots) });
      onSaved(saved);
      onToast('Our work photos saved');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save work photos');
    } finally {
      setSaving(false);
    }
  }

  async function onFileSelected(file: File | undefined) {
    const index = pendingIndex.current;
    pendingIndex.current = null;
    if (!file || index == null || !token) return;
    setBusyIndex(index);
    try {
      const uploaded = await uploadGlamWorkPhoto(token, file);
      const photo: BeautyWorkPhoto = { mediaId: uploaded.mediaId, url: uploaded.url };
      const next = [...slots];
      next[index] = photo;
      const normalized = slotsFromPhotos(
        next.filter((row): row is BeautyWorkPhoto => row != null),
      );
      setSlots(normalized);
      await persist(normalized);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <section style={styles.card} aria-label="Our work photos">
      <div style={styles.head}>
        <div>
          <p style={styles.title}>Our work</p>
          <p style={styles.sub}>Add up to {MAX} photos customers see when they tap Our work on Koya Glam.</p>
        </div>
        <button
          type="button"
          style={styles.saveBtn}
          disabled={!dirty || saving || busyIndex != null}
          onClick={() => void persist(slots)}
        >
          {saving ? 'Saving…' : dirty ? 'Save order' : 'Saved'}
        </button>
      </div>
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
      <div style={styles.grid}>
        {slots.map((photo, index) => {
          const loading = busyIndex === index;
          const isNextEmpty =
            photo == null && slots.slice(0, index).every((row) => row != null) && slots.slice(index + 1).every((row) => row == null);
          const canAdd = photo != null || isNextEmpty;
          return (
            <div key={index} style={styles.slot}>
              {photo ? (
                <>
                  <img src={photo.url} alt="" style={styles.img} />
                  <div style={styles.slotActions}>
                    <button type="button" style={styles.slotBtn} disabled={loading || saving} onClick={() => openPicker(index)}>
                      {loading ? '…' : 'Replace'}
                    </button>
                    <button
                      type="button"
                      style={styles.slotBtnDanger}
                      disabled={loading || saving}
                      onClick={() => void removeAt(index)}
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  style={{ ...styles.addBtn, ...(canAdd ? null : styles.addBtnDisabled) }}
                  disabled={!canAdd || loading || saving}
                  onClick={() => openPicker(index)}
                >
                  {loading ? 'Uploading…' : '+ Add'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: 16,
    border: '1px solid #fbcfe8',
    background: '#fff',
    padding: '0.85rem 0.85rem 0.95rem',
    display: 'grid',
    gap: '0.65rem',
    boxShadow: '0 6px 20px rgba(219, 39, 119, 0.08)',
  },
  head: { display: 'flex', gap: '0.65rem', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { margin: 0, fontSize: '0.88rem', fontWeight: 900, color: '#831843' },
  sub: { margin: '0.2rem 0 0', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', lineHeight: 1.35 },
  saveBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.45rem 0.65rem',
    background: '#fdf2f8',
    color: '#9d174d',
    fontWeight: 800,
    fontSize: '0.68rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
    gap: '0.4rem',
  },
  slot: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px dashed #f9a8d4',
    background: '#fffafb',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  slotActions: {
    position: 'absolute',
    inset: 'auto 0 0 0',
    display: 'flex',
    gap: '0.2rem',
    padding: '0.25rem',
    background: 'linear-gradient(180deg, transparent, rgba(15, 23, 42, 0.72))',
  },
  slotBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 6,
    padding: '0.2rem 0',
    fontSize: '0.55rem',
    fontWeight: 800,
    background: 'rgba(255,255,255,0.92)',
    color: '#831843',
    cursor: 'pointer',
  },
  slotBtnDanger: {
    flex: 1,
    border: 'none',
    borderRadius: 6,
    padding: '0.2rem 0',
    fontSize: '0.55rem',
    fontWeight: 800,
    background: 'rgba(254, 226, 226, 0.95)',
    color: '#b91c1c',
    cursor: 'pointer',
  },
  addBtn: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: '#db2777',
    fontWeight: 800,
    fontSize: '0.62rem',
    cursor: 'pointer',
  },
  addBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
};
