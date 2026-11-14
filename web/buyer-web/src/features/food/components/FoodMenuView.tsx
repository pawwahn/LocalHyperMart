import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { QuantityStepper } from '@/features/shop/components/QuantityStepper';
import { resolveMediaContentUrl } from '@/shared/media/resolveMediaContentUrl';
import type { FoodMenuCategory, FoodMenuItem } from '../api/foodApi';

const MENU_CSS = `
  .hlm-food-menu-shell {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-elevated);
    box-shadow: var(--shadow-soft);
  }
  .hlm-food-menu-split {
    display: grid;
    grid-template-columns: minmax(7.25rem, 36%) 1fr;
    gap: 0;
    min-height: min(58vh, 520px);
    border: none;
    border-radius: 0;
    overflow: hidden;
    background: var(--bg-elevated);
    box-shadow: none;
  }
  @media (min-width: 560px) {
    .hlm-food-menu-split {
      grid-template-columns: minmax(9.5rem, 200px) 1fr;
    }
  }
  .hlm-food-cat-col {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-right: 1px solid var(--border);
    background: var(--bg-muted);
    overflow-y: auto;
    max-height: min(58vh, 520px);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .hlm-food-cat-col::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
  .hlm-food-items-col {
    overflow-y: auto;
    max-height: min(58vh, 520px);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .hlm-food-items-col::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
`;

type Props = {
  sections: FoodMenuCategory[];
  activeItems: FoodMenuItem[];
  activeCatId: string | null;
  onActiveCatChange: (id: string) => void;
  quantityFor: (listingId: string) => number;
  busyListingId: string | null;
  onIncrease: (item: FoodMenuItem) => void;
  onDecrease: (item: FoodMenuItem) => void;
  loading: boolean;
  /** Back to town restaurant listing (e.g. `/food`). */
  backHref?: string;
  backLabel?: string;
};

export function FoodMenuView({
  sections,
  activeItems,
  activeCatId,
  onActiveCatChange,
  quantityFor,
  busyListingId,
  onIncrease,
  onDecrease,
  loading,
  backHref,
  backLabel = 'Restaurants',
}: Props) {
  const railCats = useMemo(
    () =>
      sections.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        count: c.items.length,
      })),
    [sections],
  );

  const selectedId = activeCatId ?? railCats[0]?.id ?? null;
  const selectedName = railCats.find((c) => c.id === selectedId)?.name ?? '';

  const backBar =
    backHref ? (
      <Link
        to={backHref}
        style={styles.backLink}
        aria-label={backLabel ? `Back to ${backLabel}` : 'Back to restaurants'}
      >
        <span aria-hidden>←</span> {backLabel}
      </Link>
    ) : null;

  if (loading) {
    return (
      <div className="hlm-food-menu-shell" style={styles.shell}>
        {backBar}
        <p style={styles.mutedPad}>Loading menu…</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="hlm-food-menu-shell" style={styles.shell}>
        {backBar}
        <p style={styles.mutedPad}>This hotel has not published a menu yet.</p>
      </div>
    );
  }

  return (
    <>
      <style>{MENU_CSS}</style>
      <div className="hlm-food-menu-shell" style={styles.shell}>
        {backBar}
      <div className="hlm-food-menu-split">
        <div className="hlm-food-cat-col" role="tablist" aria-label="Menu categories">
          {railCats.map((c) => {
            const on = selectedId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`food-panel-${c.id}`}
                style={on ? styles.catOn : styles.cat}
                onClick={() => onActiveCatChange(c.id)}
              >
                <span style={styles.catLabel}>{c.name}</span>
                <span style={on ? styles.catCountOn : styles.catCount}>{c.count}</span>
              </button>
            );
          })}
        </div>

        <div
          className="hlm-food-items-col"
          role="tabpanel"
          id={selectedId ? `food-panel-${selectedId}` : undefined}
          aria-labelledby={selectedId ? `food-cat-${selectedId}` : undefined}
        >
          {selectedName ? (
            <h2 style={styles.itemsHeading} id={selectedId ? `food-cat-${selectedId}` : undefined}>
              {selectedName}
            </h2>
          ) : null}
          {activeItems.length > 0 ? (
            <ul style={styles.list}>
              {activeItems.map((item) => (
                <DishRow
                  key={item.id}
                  item={item}
                  quantity={item.listingId ? quantityFor(item.listingId) : 0}
                  busy={Boolean(item.listingId && busyListingId === item.listingId)}
                  onIncrease={() => onIncrease(item)}
                  onDecrease={() => onDecrease(item)}
                />
              ))}
            </ul>
          ) : (
            <p style={styles.emptyPanel}>No dishes in this category.</p>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

function DishRow({
  item,
  quantity,
  busy,
  onIncrease,
  onDecrease,
}: {
  item: FoodMenuItem;
  quantity: number;
  busy: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const thumb = item.imageUrls?.[0];
  const unpublished = !item.listingId;
  return (
    <li style={styles.item}>
      <div style={styles.itemMain}>
        <span style={vegMark(item.veg)} aria-label={item.veg ? 'Vegetarian' : 'Non-vegetarian'} />
        <div style={styles.itemText}>
          <div style={styles.itemHead}>
            <strong style={styles.itemName}>{item.name}</strong>
            <span style={styles.price}>₹{item.price}</span>
          </div>
          {item.buyerNote ? <p style={styles.note}>{item.buyerNote}</p> : null}
          {item.description ? <p style={styles.desc}>{item.description}</p> : null}
        </div>
      </div>
      <div style={styles.itemActions}>
        {thumb ? (
          <img src={resolveMediaContentUrl(thumb)} alt="" style={styles.dishThumb} loading="lazy" />
        ) : null}
        {unpublished ? (
          <span style={styles.unpublished} title="Not available to order yet">
            Soon
          </span>
        ) : (
          <QuantityStepper
            quantity={quantity}
            disabled={busy}
            size="xs"
            onIncrease={onIncrease}
            onDecrease={onDecrease}
          />
        )}
      </div>
    </li>
  );
}

function vegMark(veg: boolean): CSSProperties {
  return {
    width: 11,
    height: 11,
    border: `2px solid ${veg ? '#16a34a' : '#b91c1c'}`,
    borderRadius: 2,
    flexShrink: 0,
    marginTop: 3,
  };
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: '100%',
    minWidth: 0,
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-soft)',
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.65rem',
    minHeight: 'var(--touch-min, 44px)',
    fontSize: '0.84rem',
    fontWeight: 800,
    color: 'var(--accent)',
    textDecoration: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mutedPad: { color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, padding: '0.65rem' },
  muted: { color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.35rem 0' },
  cat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.2rem',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    borderLeft: '3px solid transparent',
    background: 'transparent',
    padding: '0.55rem 0.5rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min, 44px)',
  },
  catOn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.2rem',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent)',
    background: 'var(--bg-elevated)',
    padding: '0.55rem 0.5rem',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--accent)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min, 44px)',
  },
  catLabel: {
    lineHeight: 1.25,
    wordBreak: 'break-word',
    width: '100%',
  },
  catCount: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  catCountOn: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  itemsHeading: {
    margin: 0,
    padding: '0.55rem 0.65rem 0.35rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    color: 'var(--text)',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-elevated)',
    zIndex: 1,
  },
  emptyPanel: {
    margin: 0,
    padding: '1rem 0.65rem',
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
  },
  list: { listStyle: 'none', margin: 0, padding: '0.15rem 0.65rem 0.65rem', display: 'flex', flexDirection: 'column', gap: 0 },
  item: {
    display: 'flex',
    gap: '0.55rem',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '0.55rem 0',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
  },
  itemMain: { display: 'flex', gap: '0.4rem', flex: 1, minWidth: 0 },
  itemText: { flex: 1, minWidth: 0 },
  itemHead: { display: 'flex', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'flex-start' },
  itemName: { fontSize: '0.92rem', lineHeight: 1.3, fontWeight: 700 },
  price: { fontWeight: 800, fontSize: '0.88rem', whiteSpace: 'nowrap' },
  note: { margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  desc: { margin: '0.12rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 },
  itemActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 },
  dishThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    objectFit: 'cover',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-soft)',
  },
  unpublished: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    padding: '0.25rem 0.4rem',
  },
};