import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { sanitizeDishPhotos } from '../api/foodApi';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui';
import {
  resolveMediaContentUrl,
  uploadListingImage,
  type UploadedMedia,
} from '@/features/listings/api/listingsApi';

const MAX_PHOTOS = 3;

const INPUT: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.55rem',
  fontSize: '0.92rem',
  lineHeight: 1.25,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  minHeight: 'var(--touch-min, 44px)',
};

export type FoodDishForm = {
  name: string;
  price: string;
  veg: boolean | null;
  note: string;
  photos: UploadedMedia[];
};

type Props = {
  open: boolean;
  categoryName: string;
  mode: 'add' | 'edit';
  dishName?: string;
  form: FoodDishForm;
  busy: boolean;
  narrow: boolean;
  token: string;
  formError: string | null;
  photosLoading?: boolean;
  onChange: Dispatch<SetStateAction<FoodDishForm>>;
  onClose: () => void;
  onSave: () => void;
  onToast: (msg: string) => void;
};

export function FoodDishSheet({
  open,
  categoryName,
  mode,
  dishName,
  form,
  busy,
  narrow,
  token,
  formError,
  photosLoading = false,
  onChange,
  onClose,
  onSave,
  onToast,
}: Props) {
  const titleId = useId();
  const formFieldId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [uploading, setUploading] = useState(false);

  onCloseRef.current = onClose;

  /** Focus dish name when adding — keep edit view scrolled to photos/fields as opened. */
  useEffect(() => {
    if (!open || mode === 'edit') return;
    const t = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCloseRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  useEffect(() => {
    if (!open) return;
    onChange((prev) => {
      const cleaned = sanitizeDishPhotos(prev.photos);
      const dirty =
        cleaned.length !== prev.photos.length ||
        prev.photos.some((p) => !String(p?.mediaId ?? '').trim() || !String(p?.url ?? '').trim());
      return dirty ? { ...prev, photos: cleaned } : prev;
    });
  }, [open, onChange]);

  const visiblePhotos = useMemo(() => sanitizeDishPhotos(form.photos), [form.photos]);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!token) {
      onToast('Sign in again to upload photos');
      return;
    }
    setUploading(true);
    try {
      const media = await uploadListingImage(token, file);
      onChange((prev) => {
        const current = sanitizeDishPhotos(prev.photos);
        if (current.length >= MAX_PHOTOS) return prev;
        return { ...prev, photos: sanitizeDishPhotos([...current, media]) };
      });
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (!open || typeof document === 'undefined') return null;

  const heading =
    mode === 'edit' && dishName ? `Update “${dishName}”` : `New dish in ${categoryName}`;

  const panel = (
      <div
        style={narrow ? styles.sheet : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {narrow ? <div style={styles.grabber} aria-hidden /> : null}
        <header style={styles.head}>
          <div style={styles.headText}>
            <h2 id={titleId} style={styles.title}>
              {heading}
            </h2>
            <p style={styles.sub}>Customers see this under <strong>{categoryName}</strong></p>
          </div>
          <button type="button" style={styles.closeBtn} aria-label="Close" disabled={busy} onClick={onClose}>
            ✕
          </button>
        </header>

        <div style={narrow ? styles.bodyNarrow : styles.body}>
          <Field label="Dish name" hint="What you call it on the menu">
            <input
              ref={nameRef}
              id={`${formFieldId}-name`}
              name="dishName"
              style={INPUT}
              value={form.name}
              placeholder="Pepsi 300 ml, Egg fried rice…"
              autoComplete="off"
              onChange={(e) => onChange((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Field>

          <Field label="Price (₹)" hint="Amount customer pays">
            <input
              id={`${formFieldId}-price`}
              name="dishPrice"
              style={{ ...INPUT, maxWidth: narrow ? '100%' : '9rem' }}
              inputMode="decimal"
              placeholder="110"
              value={form.price}
              onChange={(e) => onChange((prev) => ({ ...prev, price: e.target.value }))}
            />
          </Field>

          <Field label="Veg or non-veg?" hint="Required — shown on customer menu">
            <TypeRow>
              <TypeChip
                active={form.veg === true}
                veg
                label="Veg"
                onSelect={() => onChange((prev) => ({ ...prev, veg: true }))}
              />
              <TypeChip
                active={form.veg === false}
                veg={false}
                label="Non-veg"
                onSelect={() => onChange((prev) => ({ ...prev, veg: false }))}
              />
            </TypeRow>
          </Field>

          <Field label="Note for customer" hint="Portion, spice level, serves how many…">
            <textarea
              id={`${formFieldId}-note`}
              name="dishNote"
              style={{ ...INPUT, resize: 'none', minHeight: 72 }}
              rows={3}
              maxLength={500}
              placeholder="Cooling drink · 300 ml bottle"
              value={form.note}
              onChange={(e) => onChange((prev) => ({ ...prev, note: e.target.value }))}
            />
          </Field>

          <Field
            label="Photo (optional)"
            hint={
              photosLoading
                ? 'Loading saved photos…'
                : `Up to ${MAX_PHOTOS} — tap × to remove, + Add to replace`
            }
          >
            <PhotoRow>
              {visiblePhotos.map((p) => (
                <PhotoTile
                  key={p.mediaId}
                  url={p.url}
                  onRemove={() =>
                    onChange((prev) => ({
                      ...prev,
                      photos: prev.photos.filter((x) => x.mediaId !== p.mediaId),
                    }))
                  }
                />
              ))}
              {visiblePhotos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  style={styles.photoAdd}
                  disabled={uploading || busy || photosLoading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? '…' : photosLoading ? '…' : '+ Add'}
                </button>
              ) : null}
            </PhotoRow>
            <input
              ref={fileRef}
              id={`${formFieldId}-photo`}
              name="dishPhoto"
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void onPickFile(file);
              }}
            />
          </Field>

          {formError ? (
            <p style={styles.formError} role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <footer style={narrow ? styles.footStack : styles.footRow}>
          <Button type="button" variant="ghost" fullWidth={narrow} disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" fullWidth={narrow} disabled={busy || uploading || photosLoading} onClick={onSave}>
            {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add to menu'}
          </Button>
        </footer>
      </div>
  );

  return createPortal(
    <div
      style={narrow ? styles.portalBottom : styles.portalCenter}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      {panel}
    </div>,
    document.body,
  );
}

function TypeRow({ children }: { children: ReactNode }) {
  return <div style={styles.typeRow}>{children}</div>;
}

function PhotoRow({ children }: { children: ReactNode }) {
  return <div style={styles.photoRow}>{children}</div>;
}

function PhotoTile({ url, onRemove }: { url: string; onRemove: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = resolveMediaContentUrl(url);
  return (
    <div style={styles.photoTile}>
      {broken ? (
        <div style={styles.photoBroken} aria-hidden>
          Photo
        </div>
      ) : (
        <img
          src={src}
          alt=""
          style={styles.photoImg}
          onError={() => setBroken(true)}
        />
      )}
      <button type="button" style={styles.photoRemove} onClick={onRemove} aria-label="Remove">
        ×
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {hint ? <span style={styles.fieldHint}>{hint}</span> : null}
      {children}
    </div>
  );
}

function TypeChip({
  active,
  veg,
  label,
  onSelect,
}: {
  active: boolean;
  veg: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      style={{
        ...styles.typeChip,
        ...(active ? (veg ? styles.typeVegOn : styles.typeNonVegOn) : null),
      }}
    >
      <VegDot veg={veg} />
      <span>{label}</span>
    </button>
  );
}

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        border: `2px solid ${veg ? '#16a34a' : '#dc2626'}`,
        borderRadius: 2,
        flexShrink: 0,
      }}
      aria-hidden
    />
  );
}

const styles: Record<string, CSSProperties> = {
  portalCenter: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.48)',
    backdropFilter: 'blur(3px)',
  },
  portalBottom: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    background: 'rgba(15, 23, 20, 0.48)',
    backdropFilter: 'blur(3px)',
  },
  dialog: {
    position: 'relative',
    zIndex: 1,
    width: 'min(22rem, 100%)',
    maxHeight: 'min(90vh, 640px)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-elevated)',
    overflow: 'hidden',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--text-muted) 35%, transparent)',
    margin: '0.45rem auto 0',
    flexShrink: 0,
  },
  sheet: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxHeight: 'min(92vh, 680px)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-elevated)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    border: '1px solid var(--border)',
    borderBottom: 'none',
    boxShadow: '0 -8px 32px rgba(15,23,42,0.18)',
    overflow: 'hidden',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.85rem 0.95rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headText: { minWidth: 0, flex: 1 },
  title: { margin: 0, fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.25 },
  sub: { margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 },
  closeBtn: {
    border: 'none',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 36,
    height: 36,
    cursor: 'pointer',
    fontSize: '1rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  body: {
    padding: '0.75rem 0.95rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    flex: 1,
    minHeight: 0,
  },
  bodyNarrow: {
    padding: '0.7rem 0.85rem',
    paddingBottom: 'calc(0.7rem + env(safe-area-inset-bottom, 0px))',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flex: 1,
    minHeight: 0,
  },
  field: { display: 'flex', flexDirection: 'column', gap: '0.28rem' },
  fieldLabel: { fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' },
  fieldHint: { fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.1rem' },
  typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' },
  typeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    minHeight: 44,
    padding: '0 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  typeVegOn: {
    borderColor: '#16a34a',
    background: 'color-mix(in srgb, #16a34a 12%, var(--bg))',
  },
  typeNonVegOn: {
    borderColor: '#dc2626',
    background: 'color-mix(in srgb, #dc2626 10%, var(--bg))',
  },
  photoRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
    minHeight: 64,
  },
  photoTile: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  photoBroken: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    background: 'var(--bg)',
  },
  photoRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 999,
    border: 'none',
    background: 'rgba(15, 23, 42, 0.78)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    lineHeight: 1,
  },
  photoAdd: {
    minWidth: 64,
    height: 64,
    borderRadius: 10,
    border: '1px dashed var(--accent, #16a34a)',
    background: 'var(--bg)',
    fontWeight: 800,
    fontSize: '0.72rem',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '0 0.35rem',
  },
  formError: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--danger, #b91c1c)',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--danger, #b91c1c) 8%, var(--bg))',
    border: '1px solid color-mix(in srgb, var(--danger, #b91c1c) 25%, var(--border))',
  },
  footRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.45rem',
    padding: '0.65rem 0.95rem',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--bg-elevated)',
  },
  footStack: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '0.4rem',
    padding: '0.65rem 0.85rem',
    paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom, 0px))',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
};