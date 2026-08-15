import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  fetchTownAdsEditor,
  saveTownAds,
  uploadAdImage,
  normalizeAdImages,
  SLOT_LABELS,
  SLOT_TITLES,
  ALL_AD_SLOTS,
  MAX_AD_IMAGES,
  type TownAdSlot,
  type TownAdVm,
  type TownAdImage,
  type UpsertTownAdInput,
} from '../api/adsApi';

type DraftAd = {
  slot: TownAdSlot;
  shopName: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
  images: TownAdImage[];
  enabled: boolean;
};

function toDraft(ad: TownAdVm): DraftAd {
  return {
    slot: ad.slot,
    shopName: ad.shopName ?? '',
    headline: ad.headline ?? '',
    bodyText: ad.bodyText ?? '',
    ctaLabel: ad.ctaLabel ?? '',
    images: normalizeAdImages(ad),
    enabled: ad.enabled,
  };
}

function emptyDraft(slot: TownAdSlot): DraftAd {
  return {
    slot,
    shopName: '',
    headline: '',
    bodyText: '',
    ctaLabel: '',
    images: [],
    enabled: false,
  };
}

export function AdsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [drafts, setDrafts] = useState<DraftAd[]>(ALL_AD_SLOTS.map(emptyDraft));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<TownAdSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTown = useMemo(() => towns.find((t) => t.id === townId) ?? null, [towns, townId]);

  const reloadTowns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const items = await listTowns(token);
      setTowns(items);
      setTownId((prev) => prev || items.find((t) => t.status === 'ENABLED')?.id || items[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const reloadAds = useCallback(async () => {
    if (!token || !townId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await fetchTownAdsEditor(token, townId);
      const bySlot = new Map(data.items.map((i) => [i.slot, i]));
      setDrafts(ALL_AD_SLOTS.map((slot) => (bySlot.has(slot) ? toDraft(bySlot.get(slot)!) : emptyDraft(slot))));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load ads');
    } finally {
      setBusy(false);
    }
  }, [token, townId]);

  useEffect(() => {
    void reloadTowns();
  }, [reloadTowns]);

  useEffect(() => {
    if (townId) void reloadAds();
  }, [townId, reloadAds]);

  function updateDraft(slot: TownAdSlot, patch: Partial<DraftAd>) {
    setDrafts((prev) => prev.map((d) => (d.slot === slot ? { ...d, ...patch } : d)));
  }

  async function onPickImage(slot: TownAdSlot, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !token) return;
    const draft = drafts.find((d) => d.slot === slot);
    const room = MAX_AD_IMAGES - (draft?.images.length ?? 0);
    if (room <= 0) {
      setError(`Each ad can have at most ${MAX_AD_IMAGES} images.`);
      return;
    }
    setUploadingSlot(slot);
    setError(null);
    try {
      const next: TownAdImage[] = [...(draft?.images ?? [])];
      for (const file of files.slice(0, room)) {
        const uploaded = await uploadAdImage(token, file);
        next.push({ url: uploaded.url, mediaId: uploaded.mediaId });
      }
      updateDraft(slot, { images: next });
      setNotice(
        next.length >= MAX_AD_IMAGES
          ? `${MAX_AD_IMAGES} images ready — save to publish.`
          : `Image uploaded (${next.length}/${MAX_AD_IMAGES}) — save to publish.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingSlot(null);
    }
  }

  function removeImage(slot: TownAdSlot, index: number) {
    const draft = drafts.find((d) => d.slot === slot);
    if (!draft) return;
    updateDraft(slot, { images: draft.images.filter((_, i) => i !== index) });
  }

  async function onSave() {
    if (!token || !townId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const items: UpsertTownAdInput[] = drafts.map((d) => ({
        slot: d.slot,
        shopName: d.shopName.trim(),
        headline: d.headline.trim(),
        bodyText: d.bodyText.trim(),
        ctaLabel: d.ctaLabel.trim(),
        images: d.images.slice(0, MAX_AD_IMAGES),
        enabled: d.enabled,
      }));
      const saved = await saveTownAds(token, townId, items);
      const bySlot = new Map(saved.items.map((i) => [i.slot, i]));
      setDrafts(ALL_AD_SLOTS.map((slot) => (bySlot.has(slot) ? toDraft(bySlot.get(slot)!) : emptyDraft(slot))));
      const missingLive = items.filter((i) => i.enabled && !bySlot.has(i.slot));
      if (missingLive.length) {
        setError(
          `Save incomplete — missing: ${missingLive.map((i) => SLOT_TITLES[i.slot]).join(', ')}. Try Save again.`,
        );
        setNotice(null);
      } else {
        setNotice('Ads saved for this town. Refresh buyer cart to see Ad 3.');
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Town ads" onRefresh={() => void reloadAds()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.toolbar}>
        <p style={styles.help}>
          Super admin only · 3 slots per town (home strip, mid-grid, cart/checkout) · up to{' '}
          {MAX_AD_IMAGES} images each (buyers swipe) · local media storage.
        </p>
        <label style={styles.field}>
          <span style={styles.label}>Town</span>
          <select
            style={styles.select}
            value={townId}
            disabled={loading || busy}
            onChange={(e) => setTownId(e.target.value)}
          >
            {towns.length === 0 ? <option value="">No towns</option> : null}
            {towns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
                {t.status !== 'ENABLED' ? ' (paused)' : ''}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {selectedTown ? (
        <div style={styles.grid}>
          {drafts.map((draft) => (
            <Card key={draft.slot} style={styles.adCard}>
              <div style={styles.adHead}>
                <div>
                  <p style={styles.slotEyebrow}>{SLOT_LABELS[draft.slot]}</p>
                  <h2 style={styles.slotTitle}>{SLOT_TITLES[draft.slot]}</h2>
                </div>
                <label style={styles.enable}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    disabled={busy}
                    onChange={(e) => updateDraft(draft.slot, { enabled: e.target.checked })}
                  />
                  Live
                </label>
              </div>

              <div style={styles.preview}>
                {draft.images[0] ? (
                  <img src={draft.images[0].url} alt="" style={styles.previewImg} />
                ) : (
                  <div style={styles.previewEmpty}>No image</div>
                )}
                <div style={styles.previewCopy}>
                  <p style={styles.previewShop}>{draft.shopName || 'Shop name'}</p>
                  <p style={styles.previewHeadline}>{draft.headline || 'Headline'}</p>
                  <p style={styles.previewBody}>{draft.bodyText || 'Supporting line'}</p>
                </div>
              </div>

              <div style={styles.thumbs}>
                {draft.images.map((img, index) => (
                  <div key={`${img.mediaId ?? img.url}-${index}`} style={styles.thumb}>
                    <img src={img.url} alt="" style={styles.thumbImg} />
                    <button
                      type="button"
                      style={styles.thumbRemove}
                      disabled={busy}
                      onClick={() => removeImage(draft.slot, index)}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      ×
                    </button>
                    <span style={styles.thumbBadge}>{index + 1}</span>
                  </div>
                ))}
                {draft.images.length < MAX_AD_IMAGES ? (
                  <label style={styles.thumbAdd}>
                    {uploadingSlot === draft.slot ? '…' : '+'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      hidden
                      disabled={busy || uploadingSlot !== null}
                      onChange={(e) => void onPickImage(draft.slot, e)}
                    />
                  </label>
                ) : null}
              </div>

              <TextField
                label="Shop name"
                value={draft.shopName}
                onChange={(e) => updateDraft(draft.slot, { shopName: e.target.value })}
                disabled={busy}
              />
              <TextField
                label="Headline"
                value={draft.headline}
                onChange={(e) => updateDraft(draft.slot, { headline: e.target.value })}
                disabled={busy}
              />
              <TextField
                label="Supporting text"
                value={draft.bodyText}
                onChange={(e) => updateDraft(draft.slot, { bodyText: e.target.value })}
                disabled={busy}
              />
              <TextField
                label="Button label"
                value={draft.ctaLabel}
                onChange={(e) => updateDraft(draft.slot, { ctaLabel: e.target.value })}
                disabled={busy}
                placeholder="Optional — leave empty for no button"
              />

              <p style={styles.hint}>
                Images {draft.images.length}/{MAX_AD_IMAGES} · enable needs shop name, headline, and ≥1
                image · button label optional.
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <div style={styles.actions}>
        <Button disabled={busy || !townId || loading} onClick={() => void onSave()}>
          {busy ? 'Saving…' : 'Save ads'}
        </Button>
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbar: { display: 'grid', gap: '0.65rem', padding: '0.85rem 1rem' },
  help: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 },
  field: { display: 'grid', gap: '0.3rem' },
  label: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' },
  select: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
  },
  grid: {
    display: 'grid',
    gap: '0.85rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  },
  adCard: { display: 'grid', gap: '0.55rem', padding: '0.85rem' },
  adHead: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' },
  slotEyebrow: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  slotTitle: { margin: '0.15rem 0 0', fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 800 },
  enable: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--text)',
  },
  preview: {
    display: 'grid',
    gridTemplateColumns: '88px 1fr',
    gap: '0.55rem',
    border: '1.5px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--bg-muted)',
    minHeight: 88,
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover', minHeight: 88 },
  previewEmpty: {
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    background: 'var(--bg)',
  },
  previewCopy: { padding: '0.55rem 0.55rem 0.55rem 0', display: 'grid', gap: '0.15rem', alignContent: 'center' },
  previewShop: { margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' },
  previewHeadline: { margin: 0, fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.25 },
  previewBody: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 },
  thumbs: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' },
  thumb: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1.5px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    border: 'none',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.85rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  },
  thumbBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#fff',
    background: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    padding: '0.05rem 0.35rem',
  },
  thumbAdd: {
    width: 64,
    height: 64,
    borderRadius: 10,
    border: '1.5px dashed var(--border)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--accent)',
    cursor: 'pointer',
    background: 'var(--bg-elevated)',
  },
  hint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' },
  actions: { display: 'flex', justifyContent: 'flex-end' },
};
