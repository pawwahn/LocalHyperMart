import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField, Toast } from '@/shared/ui';
import { listTowns, listTownsByIds, searchTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  fetchTownAdsEditor,
  saveTownAds,
  uploadAdImage,
  normalizeAdImages,
  AD_EDITOR_ITEMS,
  MID_GRID_COUNT,
  MAX_AD_IMAGES,
  adEditorKey,
  matchEditorAd,
  type AdEditorItem,
  type TownAdVm,
  type TownAdImage,
  type UpsertTownAdInput,
} from '../api/adsApi';

const PAGE_CSS = `
  .ads-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    padding: 0.28rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
    background: var(--bg-elevated);
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--motion-fast), border-color var(--motion-fast), color var(--motion-fast), box-shadow var(--motion-fast);
  }
  .ads-toggle:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    color: var(--text);
  }
  .ads-toggle--on {
    background: var(--accent-soft);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    color: var(--accent-hover);
    box-shadow: 0 1px 0 rgba(196, 123, 23, 0.12);
  }
  .ads-toggle--live.ads-toggle--on {
    background: var(--success-soft);
    border-color: color-mix(in srgb, var(--success) 40%, var(--border));
    color: #047857;
  }
  .ads-live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
    animation: ads-pulse 2s ease infinite;
  }
  @keyframes ads-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  .ads-card {
    transition: border-color var(--motion-normal), box-shadow var(--motion-normal);
  }
  .ads-card--live {
    border-color: color-mix(in srgb, var(--success) 35%, var(--border)) !important;
    box-shadow: 0 4px 18px rgba(16, 185, 129, 0.08) !important;
  }
  .ads-card--broadcast {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border)) !important;
    box-shadow: var(--shadow-elevated) !important;
  }
  .ads-town-btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
    background: var(--accent-soft);
  }
  .ads-thumb-add:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .ads-mid-scroll {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--accent) 50%, transparent) transparent;
  }
  .ads-mid-scroll::-webkit-scrollbar { height: 6px; }
  .ads-mid-scroll::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--accent) 55%, var(--border));
    border-radius: 999px;
  }
  .ads-save-bar {
    position: sticky;
    bottom: 0.65rem;
    z-index: 20;
    backdrop-filter: blur(10px);
  }
`;

type DraftAd = {
  key: string;
  slot: AdEditorItem['slot'];
  slotIndex: number;
  shopName: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
  images: TownAdImage[];
  enabled: boolean;
  allTowns: boolean;
  targetTownIds: string[];
};

function emptyDraft(item: AdEditorItem): DraftAd {
  return {
    key: adEditorKey(item.slot, item.slotIndex),
    slot: item.slot,
    slotIndex: item.slotIndex,
    shopName: '',
    headline: '',
    bodyText: '',
    ctaLabel: '',
    images: [],
    enabled: false,
    allTowns: false,
    targetTownIds: [],
  };
}

function toDraft(item: AdEditorItem, ad: TownAdVm): DraftAd {
  return {
    key: adEditorKey(item.slot, item.slotIndex),
    slot: item.slot,
    slotIndex: item.slotIndex,
    shopName: ad.shopName ?? '',
    headline: ad.headline ?? '',
    bodyText: ad.bodyText ?? '',
    ctaLabel: ad.ctaLabel ?? '',
    images: normalizeAdImages(ad),
    enabled: ad.enabled,
    allTowns: Boolean(ad.allTowns),
    targetTownIds: ad.targetTownIds?.length ? [...ad.targetTownIds] : [ad.townId],
  };
}

function isDraftReady(draft: DraftAd): boolean {
  return Boolean(draft.shopName.trim() && draft.headline.trim() && draft.images.length > 0);
}

function TogglePill({
  active,
  label,
  tone,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  tone?: 'live';
  disabled?: boolean;
  onClick: () => void;
}) {
  const cls = ['ads-toggle', active ? 'ads-toggle--on' : '', tone === 'live' && active ? 'ads-toggle--live' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} disabled={disabled} onClick={onClick}>
      {tone === 'live' && active ? <span className="ads-live-dot" aria-hidden /> : null}
      {label}
    </button>
  );
}

function SectionHeader({
  index,
  title,
  hint,
  badge,
}: {
  index: string;
  title: string;
  hint: string;
  badge?: string;
}) {
  return (
    <div style={styles.sectionHead}>
      <div style={styles.sectionIndex}>{index}</div>
      <div style={styles.sectionCopy}>
        <div style={styles.sectionTitleRow}>
          <h2 style={styles.sectionTitle}>{title}</h2>
          {badge ? <span style={styles.sectionBadge}>{badge}</span> : null}
        </div>
        <p style={styles.sectionHint}>{hint}</p>
      </div>
    </div>
  );
}

function AdTargetTownsPicker({
  token,
  currentTownId,
  selectedIds,
  disabled,
  onChange,
}: {
  token: string;
  currentTownId: string;
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<TownVm[]>([]);
  const [labels, setLabels] = useState<TownVm[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const extraCount = selectedIds.filter((id) => id !== currentTownId).length;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!token) return;
    const extra = selectedIds.filter((id) => id !== currentTownId);
    if (extra.length === 0) {
      setLabels([]);
      return;
    }
    let cancelled = false;
    void listTownsByIds(token, extra).then((items) => {
      if (!cancelled) setLabels(items);
    });
    return () => {
      cancelled = true;
    };
  }, [token, selectedIds, currentTownId]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoading(true);
    void searchTowns(token, { q: debounced, page: 0, size: 60 })
      .then((page) => {
        if (!cancelled) setResults(page.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, debounced]);

  function toggleTown(id: string) {
    if (id === currentTownId) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!next.has(currentTownId)) next.add(currentTownId);
    onChange([...next]);
  }

  return (
    <div style={styles.townPicker}>
      <button
        type="button"
        className="ads-town-btn"
        style={styles.townPickerToggle}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={styles.townPickerIcon}>📍</span>
        <span style={styles.townPickerLabel}>
          {extraCount === 0 ? 'This town only' : `${extraCount + 1} towns selected`}
        </span>
        <span style={styles.townPickerCaret}>{open ? '▾' : '▸'}</span>
      </button>
      {extraCount > 0 ? (
        <div style={styles.townChips}>
          {labels.map((t) => (
            <span key={t.id} style={styles.townChip}>
              {t.displayName}
              {t.id !== currentTownId ? (
                <button
                  type="button"
                  style={styles.townChipRemove}
                  disabled={disabled}
                  onClick={() => toggleTown(t.id)}
                  aria-label={`Remove ${t.displayName}`}
                >
                  ×
                </button>
              ) : (
                <span style={styles.townChipTag}>base</span>
              )}
            </span>
          ))}
        </div>
      ) : null}
      {open ? (
        <div style={styles.townPickerPanel}>
          <input
            style={styles.townSearch}
            value={query}
            disabled={disabled}
            placeholder="Search towns to add…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={styles.townList}>
            {loading ? <p style={styles.townListHint}>Loading…</p> : null}
            {!loading && results.length === 0 ? (
              <p style={styles.townListHint}>No towns match</p>
            ) : null}
            {results.map((t) => (
              <label key={t.id} style={styles.townRow}>
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  disabled={disabled || t.id === currentTownId}
                  onChange={() => toggleTown(t.id)}
                />
                <span>
                  {t.displayName}
                  {t.id === currentTownId ? ' · editing from here' : ''}
                  {t.status !== 'ENABLED' ? ' · paused' : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BuyerPreview({ draft }: { draft: DraftAd }) {
  const ready = isDraftReady(draft);
  return (
    <div style={styles.previewWrap}>
      <p style={styles.previewLabel}>Buyer preview</p>
      <div style={{ ...styles.preview, ...(ready ? styles.previewReady : {}) }}>
        <div style={styles.previewMedia}>
          {draft.images[0] ? (
            <img src={draft.images[0].url} alt="" style={styles.previewImg} />
          ) : (
            <div style={styles.previewEmpty}>
              <span style={styles.previewEmptyIcon}>🖼</span>
              <span>Add an image</span>
            </div>
          )}
        </div>
        <div style={styles.previewCopy}>
          <p style={styles.previewShop}>{draft.shopName.trim() || 'Shop name'}</p>
          <p style={styles.previewHeadline}>{draft.headline.trim() || 'Headline goes here'}</p>
          <p style={styles.previewBody}>{draft.bodyText.trim() || 'Supporting line for the offer'}</p>
          {draft.ctaLabel.trim() ? (
            <span style={styles.previewCta}>{draft.ctaLabel.trim()}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdEditorCard({
  meta,
  draft,
  busy,
  uploading,
  token,
  currentTownId,
  compact,
  onChange,
  onPickImage,
  onRemoveImage,
}: {
  meta: AdEditorItem;
  draft: DraftAd;
  busy: boolean;
  uploading: boolean;
  token: string;
  currentTownId: string;
  compact?: boolean;
  onChange: (patch: Partial<DraftAd>) => void;
  onPickImage: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
}) {
  const ready = isDraftReady(draft);
  const cardClass = [
    'ads-card',
    draft.enabled ? 'ads-card--live' : '',
    draft.allTowns ? 'ads-card--broadcast' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Card elevated style={styles.adCard} className={cardClass}>
      <div style={styles.adHead}>
        <div style={styles.adHeadLeft}>
          {meta.section === 'mid' ? (
            <span style={styles.slideBadge}>{meta.slotIndex}</span>
          ) : (
            <span style={styles.placementBadge}>{meta.section === 'hero' ? 'Strip' : 'Cart'}</span>
          )}
          <div>
            <p style={styles.slotEyebrow}>{meta.label}</p>
            <h3 style={styles.slotTitle}>{meta.title}</h3>
          </div>
        </div>
        <div style={styles.toggles}>
          <TogglePill
            active={draft.enabled}
            label="Live"
            tone="live"
            disabled={busy}
            onClick={() =>
              onChange(draft.enabled ? { enabled: false, allTowns: false } : { enabled: true })
            }
          />
          <TogglePill
            active={draft.allTowns}
            label="All towns"
            disabled={busy}
            onClick={() =>
              onChange(
                draft.allTowns
                  ? { allTowns: false }
                  : { allTowns: true, enabled: true, targetTownIds: [currentTownId] },
              )
            }
          />
        </div>
      </div>

      {!draft.allTowns ? (
        <AdTargetTownsPicker
          token={token}
          currentTownId={currentTownId}
          selectedIds={draft.targetTownIds.length ? draft.targetTownIds : [currentTownId]}
          disabled={busy}
          onChange={(targetTownIds) => onChange({ targetTownIds })}
        />
      ) : (
        <div style={styles.broadcastBanner}>Network-wide · shows in every town unless overridden locally</div>
      )}

      <BuyerPreview draft={draft} />

      <div style={styles.thumbs}>
        {draft.images.map((img, index) => (
          <div key={`${img.mediaId ?? img.url}-${index}`} style={styles.thumb}>
            <img src={img.url} alt="" style={styles.thumbImg} />
            <button
              type="button"
              style={styles.thumbRemove}
              disabled={busy}
              onClick={() => onRemoveImage(index)}
              aria-label={`Remove image ${index + 1}`}
            >
              ×
            </button>
            <span style={styles.thumbBadge}>{index + 1}</span>
          </div>
        ))}
        {draft.images.length < MAX_AD_IMAGES ? (
          <label className="ads-thumb-add" style={styles.thumbAdd}>
            <span style={styles.thumbAddIcon}>{uploading ? '…' : '+'}</span>
            <span style={styles.thumbAddText}>Upload</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              disabled={busy || uploading}
              onChange={onPickImage}
            />
          </label>
        ) : null}
      </div>

      <div style={{ ...styles.fields, ...(compact ? styles.fieldsCompact : {}) }}>
        <TextField
          label="Shop name"
          value={draft.shopName}
          onChange={(e) => onChange({ shopName: e.target.value })}
          disabled={busy}
        />
        <TextField
          label="Headline"
          value={draft.headline}
          onChange={(e) => onChange({ headline: e.target.value })}
          disabled={busy}
        />
        <TextField
          label="Supporting text"
          value={draft.bodyText}
          onChange={(e) => onChange({ bodyText: e.target.value })}
          disabled={busy}
        />
        <TextField
          label="Button label"
          value={draft.ctaLabel}
          onChange={(e) => onChange({ ctaLabel: e.target.value })}
          disabled={busy}
          placeholder="Optional"
        />
      </div>

      <div style={styles.cardFooter}>
        <span
          style={{
            ...styles.statusPill,
            ...(draft.enabled && ready
              ? styles.statusPillLive
              : draft.enabled
                ? styles.statusPillWarn
                : styles.statusPillDraft),
          }}
        >
          {draft.enabled && ready
            ? draft.allTowns
              ? 'Live · all towns'
              : 'Live · ready'
            : draft.enabled
              ? 'Live · missing content'
              : 'Draft'}
        </span>
        <span style={styles.hint}>
          {draft.images.length}/{MAX_AD_IMAGES} images
        </span>
      </div>
    </Card>
  );
}

export function AdsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [drafts, setDrafts] = useState<DraftAd[]>(AD_EDITOR_ITEMS.map(emptyDraft));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'info' } | null>(null);

  const selectedTown = useMemo(() => towns.find((t) => t.id === townId) ?? null, [towns, townId]);
  const heroItem = AD_EDITOR_ITEMS.find((i) => i.section === 'hero')!;
  const midItems = AD_EDITOR_ITEMS.filter((i) => i.section === 'mid');
  const cartItem = AD_EDITOR_ITEMS.find((i) => i.section === 'cart')!;

  const draftByKey = useMemo(() => {
    const map = new Map<string, DraftAd>();
    for (const d of drafts) map.set(d.key, d);
    return map;
  }, [drafts]);

  const liveCount = useMemo(() => drafts.filter((d) => d.enabled && isDraftReady(d)).length, [drafts]);
  const liveMidCount = midItems.filter(
    (item) => draftByKey.get(adEditorKey(item.slot, item.slotIndex))?.enabled,
  ).length;

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
      setDrafts(
        AD_EDITOR_ITEMS.map((item) => {
          const ad = data.items.find((row) => matchEditorAd(row, item));
          return ad ? toDraft(item, ad) : emptyDraft(item);
        }),
      );
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

  function updateDraft(key: string, patch: Partial<DraftAd>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function onPickImage(key: string, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !token) return;
    const draft = draftByKey.get(key);
    const room = MAX_AD_IMAGES - (draft?.images.length ?? 0);
    if (room <= 0) {
      setError(`Each ad can have at most ${MAX_AD_IMAGES} images.`);
      return;
    }
    setUploadingKey(key);
    setError(null);
    try {
      const next: TownAdImage[] = [...(draft?.images ?? [])];
      for (const file of files.slice(0, room)) {
        const uploaded = await uploadAdImage(token, file);
        next.push({ url: uploaded.url, mediaId: uploaded.mediaId });
      }
      updateDraft(key, { images: next });
      setToast({
        message: `Image uploaded (${next.length}/${MAX_AD_IMAGES}) — save to publish.`,
        tone: 'info',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingKey(null);
    }
  }

  async function onSave() {
    if (!token || !townId) return;
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const items: UpsertTownAdInput[] = drafts.map((d) => ({
        slot: d.slot,
        slotIndex: d.slotIndex,
        shopName: d.shopName.trim(),
        headline: d.headline.trim(),
        bodyText: d.bodyText.trim(),
        ctaLabel: d.ctaLabel.trim(),
        images: d.images.slice(0, MAX_AD_IMAGES),
        enabled: d.enabled,
        allTowns: d.allTowns,
        targetTownIds: d.allTowns ? [] : d.targetTownIds.length ? d.targetTownIds : [townId],
      }));
      await saveTownAds(token, townId, items);
      await reloadAds();
      setToast({ message: 'Ads saved successfully.', tone: 'success' });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Town ads" onRefresh={() => void reloadAds()}>
      <style>{PAGE_CSS}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card elevated style={styles.hero}>
        <div style={styles.heroTop}>
          <div style={styles.heroIntro}>
            <p style={styles.heroEyebrow}>Sponsored placements</p>
            <p style={styles.heroText}>
              Manage buyer-facing ads — home strip, mid-grid carousel ({MID_GRID_COUNT} slides), and cart upsell.
              Pick towns per ad or broadcast network-wide.
            </p>
          </div>
          <div style={styles.heroStats}>
            <div style={styles.statChip}>
              <span style={styles.statValue}>{liveCount}</span>
              <span style={styles.statLabel}>live slots</span>
            </div>
            <div style={styles.statChip}>
              <span style={styles.statValue}>{liveMidCount}</span>
              <span style={styles.statLabel}>carousel slides</span>
            </div>
          </div>
        </div>
        <div style={styles.heroTownRow}>
          <label style={styles.townField}>
            <span style={styles.townFieldLabel}>Editing from town</span>
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
          {selectedTown ? (
            <div style={styles.townMeta}>
              <span style={styles.townMetaPill}>{selectedTown.stateCode || selectedTown.state || '—'}</span>
              <span style={styles.townMetaText}>
                {selectedTown.status === 'ENABLED' ? 'Accepting orders' : 'Town paused'}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      {selectedTown ? (
        <div style={styles.sections}>
          <section style={styles.section}>
            <SectionHeader
              index="01"
              title="Home strip"
              hint="Top of buyer shop home, directly below search."
            />
            <AdEditorCard
              meta={heroItem}
              draft={draftByKey.get(adEditorKey(heroItem.slot, heroItem.slotIndex)) ?? emptyDraft(heroItem)}
              busy={busy}
              uploading={uploadingKey === adEditorKey(heroItem.slot, heroItem.slotIndex)}
              token={token}
              currentTownId={townId}
              onChange={(patch) => updateDraft(adEditorKey(heroItem.slot, heroItem.slotIndex), patch)}
              onPickImage={(e) => void onPickImage(adEditorKey(heroItem.slot, heroItem.slotIndex), e)}
              onRemoveImage={(index) => {
                const key = adEditorKey(heroItem.slot, heroItem.slotIndex);
                const draft = draftByKey.get(key);
                if (!draft) return;
                updateDraft(key, { images: draft.images.filter((_, i) => i !== index) });
              }}
            />
          </section>

          <section style={styles.section}>
            <SectionHeader
              index="02"
              title="Mid-grid carousel"
              hint={`Inserted after category row 4. Buyers swipe through up to ${MID_GRID_COUNT} sponsored slides.`}
              badge={`${liveMidCount} live`}
            />
            <div className="ads-mid-scroll" style={styles.midCarouselEditor}>
              {midItems.map((item) => {
                const key = adEditorKey(item.slot, item.slotIndex);
                const draft = draftByKey.get(key) ?? emptyDraft(item);
                return (
                  <AdEditorCard
                    key={key}
                    meta={item}
                    draft={draft}
                    busy={busy}
                    compact
                    uploading={uploadingKey === key}
                    token={token}
                    currentTownId={townId}
                    onChange={(patch) => updateDraft(key, patch)}
                    onPickImage={(e) => void onPickImage(key, e)}
                    onRemoveImage={(index) =>
                      updateDraft(key, { images: draft.images.filter((_, i) => i !== index) })
                    }
                  />
                );
              })}
            </div>
          </section>

          <section style={styles.section}>
            <SectionHeader index="03" title="Cart upsell" hint="Shown on buyer cart and checkout screens." />
            <AdEditorCard
              meta={cartItem}
              draft={draftByKey.get(adEditorKey(cartItem.slot, cartItem.slotIndex)) ?? emptyDraft(cartItem)}
              busy={busy}
              uploading={uploadingKey === adEditorKey(cartItem.slot, cartItem.slotIndex)}
              token={token}
              currentTownId={townId}
              onChange={(patch) => updateDraft(adEditorKey(cartItem.slot, cartItem.slotIndex), patch)}
              onPickImage={(e) => void onPickImage(adEditorKey(cartItem.slot, cartItem.slotIndex), e)}
              onRemoveImage={(index) => {
                const key = adEditorKey(cartItem.slot, cartItem.slotIndex);
                const draft = draftByKey.get(key);
                if (!draft) return;
                updateDraft(key, { images: draft.images.filter((_, i) => i !== index) });
              }}
            />
          </section>
        </div>
      ) : null}

      <div className="ads-save-bar" style={styles.saveBar}>
        <Card style={styles.saveBarInner}>
          <div style={styles.saveBarCopy}>
            <p style={styles.saveBarTitle}>{selectedTown?.displayName ?? 'Select a town'}</p>
            <p style={styles.saveBarHint}>
              {liveCount} of {AD_EDITOR_ITEMS.length} slots live · up to {MAX_AD_IMAGES} images each
            </p>
          </div>
          <Button disabled={busy || !townId || loading} onClick={() => void onSave()}>
            {busy ? 'Saving…' : 'Save all ads'}
          </Button>
        </Card>
      </div>

      <Toast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        bottom="5.75rem"
        onClose={() => setToast(null)}
      />
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    display: 'grid',
    gap: '0.75rem',
    padding: '1rem 1.1rem',
    background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--accent-soft) 120%)',
    borderColor: 'color-mix(in srgb, var(--accent) 22%, var(--border))',
  },
  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  heroIntro: { flex: '1 1 280px', display: 'grid', gap: '0.25rem' },
  heroEyebrow: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent-hover)',
  },
  heroText: { margin: 0, color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.45, maxWidth: 560 },
  heroStats: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  statChip: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.45rem 0.7rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))',
    minWidth: 88,
    textAlign: 'center',
  },
  statValue: { fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' },
  heroTownRow: {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    paddingTop: '0.15rem',
    borderTop: '1px solid color-mix(in srgb, var(--accent) 12%, var(--border))',
  },
  townField: { display: 'grid', gap: '0.28rem', flex: '1 1 220px', maxWidth: 360 },
  townFieldLabel: { fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' },
  select: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.52rem 0.7rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 700,
    boxShadow: 'var(--shadow-card)',
  },
  townMeta: { display: 'flex', alignItems: 'center', gap: '0.45rem', paddingBottom: '0.35rem' },
  townMetaPill: {
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.2rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
  },
  townMetaText: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  sections: { display: 'grid', gap: '1.1rem', paddingBottom: '4.5rem' },
  section: { display: 'grid', gap: '0.55rem' },
  sectionHead: { display: 'flex', gap: '0.65rem', alignItems: 'flex-start' },
  sectionIndex: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 'var(--radius-md)',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.78rem',
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
  },
  sectionCopy: { display: 'grid', gap: '0.12rem', minWidth: 0 },
  sectionTitleRow: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' },
  sectionTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.08rem',
    fontWeight: 800,
  },
  sectionBadge: {
    fontSize: '0.65rem',
    fontWeight: 800,
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--success-soft)',
    color: '#047857',
  },
  sectionHint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.35 },
  midCarouselEditor: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(272px, 300px)',
    gap: '0.65rem',
    overflowX: 'auto',
    padding: '0.15rem 0.1rem 0.45rem',
    scrollSnapType: 'x mandatory',
  },
  adCard: {
    display: 'grid',
    gap: '0.55rem',
    padding: '0.8rem',
    scrollSnapAlign: 'start',
    borderRadius: 'var(--radius-lg)',
  },
  adHead: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' },
  adHeadLeft: { display: 'flex', gap: '0.45rem', alignItems: 'flex-start', minWidth: 0 },
  slideBadge: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-full)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))',
  },
  placementBadge: {
    flexShrink: 0,
    padding: '0.22rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
    marginTop: '0.12rem',
  },
  slotEyebrow: {
    margin: 0,
    fontSize: '0.66rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    lineHeight: 1.2,
  },
  slotTitle: { margin: '0.08rem 0 0', fontSize: '0.92rem', fontFamily: 'var(--font-display)', fontWeight: 800 },
  toggles: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' },
  broadcastBanner: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    border: '1px dashed color-mix(in srgb, var(--accent) 35%, var(--border))',
    borderRadius: 'var(--radius-sm)',
    padding: '0.35rem 0.5rem',
  },
  previewWrap: { display: 'grid', gap: '0.28rem' },
  previewLabel: {
    margin: 0,
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  preview: {
    display: 'grid',
    gridTemplateColumns: '92px 1fr',
    gap: 0,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-muted))',
    minHeight: 92,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
  },
  previewReady: {
    borderColor: 'color-mix(in srgb, var(--success) 25%, var(--border))',
  },
  previewMedia: { minHeight: 92, background: 'var(--bg-muted)' },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 92 },
  previewEmpty: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.15rem',
    minHeight: 92,
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    background: 'repeating-linear-gradient(-45deg, var(--bg), var(--bg) 6px, var(--bg-muted) 6px, var(--bg-muted) 12px)',
  },
  previewEmptyIcon: { fontSize: '1rem', opacity: 0.65 },
  previewCopy: {
    padding: '0.5rem 0.55rem 0.5rem 0.45rem',
    display: 'grid',
    gap: '0.1rem',
    alignContent: 'center',
  },
  previewShop: { margin: 0, fontSize: '0.64rem', fontWeight: 800, color: 'var(--accent)' },
  previewHeadline: { margin: 0, fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.25 },
  previewBody: { margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 },
  previewCta: {
    marginTop: '0.15rem',
    justifySelf: 'start',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.18rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
  },
  thumbs: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' },
  thumb: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    boxShadow: 'var(--shadow-card)',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    border: 'none',
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  },
  thumbBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    fontSize: '0.58rem',
    fontWeight: 800,
    color: '#fff',
    background: 'rgba(15, 23, 42, 0.62)',
    borderRadius: 999,
    padding: '0.05rem 0.3rem',
  },
  thumbAdd: {
    width: 58,
    height: 58,
    borderRadius: 'var(--radius-sm)',
    border: '1.5px dashed color-mix(in srgb, var(--accent) 35%, var(--border))',
    display: 'grid',
    placeItems: 'center',
    gap: '0.02rem',
    cursor: 'pointer',
    background: 'var(--bg-elevated)',
    transition: 'border-color var(--motion-fast), background var(--motion-fast)',
  },
  thumbAddIcon: { fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 },
  thumbAddText: { fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1 },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.45rem',
  },
  fieldsCompact: {
    gridTemplateColumns: '1fr',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.45rem',
    paddingTop: '0.1rem',
    borderTop: '1px solid var(--border)',
  },
  statusPill: {
    fontSize: '0.66rem',
    fontWeight: 800,
    padding: '0.18rem 0.45rem',
    borderRadius: 'var(--radius-full)',
  },
  statusPillLive: { background: 'var(--success-soft)', color: '#047857' },
  statusPillWarn: { background: 'var(--warning-soft)', color: '#B45309' },
  statusPillDraft: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
  hint: { margin: 0, fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 },
  townPicker: { display: 'grid', gap: '0.35rem' },
  townPickerToggle: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.38rem 0.55rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.74rem',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'border-color var(--motion-fast), background var(--motion-fast)',
  },
  townPickerIcon: { fontSize: '0.82rem', lineHeight: 1 },
  townPickerLabel: { flex: 1 },
  townPickerCaret: { color: 'var(--text-muted)', fontSize: '0.68rem' },
  townChips: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem' },
  townChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.66rem',
    fontWeight: 700,
    padding: '0.14rem 0.38rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
  },
  townChipTag: {
    fontSize: '0.58rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
    textTransform: 'uppercase',
  },
  townChipRemove: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    fontSize: '0.85rem',
  },
  townPickerPanel: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.45rem',
    display: 'grid',
    gap: '0.35rem',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-soft)',
  },
  townSearch: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.38rem 0.5rem',
    fontSize: '0.78rem',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  townList: { maxHeight: 120, overflowY: 'auto', display: 'grid', gap: '0.15rem' },
  townListHint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' },
  townRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.74rem',
    fontWeight: 600,
    color: 'var(--text)',
    padding: '0.12rem 0.1rem',
    borderRadius: 'var(--radius-sm)',
  },
  saveBar: { marginTop: '0.35rem' },
  saveBarInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    padding: '0.65rem 0.85rem',
    background: 'color-mix(in srgb, var(--bg-elevated) 88%, transparent)',
    borderColor: 'color-mix(in srgb, var(--accent) 20%, var(--border))',
    boxShadow: 'var(--shadow-soft)',
  },
  saveBarCopy: { display: 'grid', gap: '0.08rem' },
  saveBarTitle: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  saveBarHint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' },
};
