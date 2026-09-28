import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Banner, Button } from '@/shared/ui';
import { QuantityStepper } from '@/features/shop/components/QuantityStepper';
import type { CatalogItemView } from '@/features/shop/api/shopApi';
import { fetchRecipePlan, recipeLineToCatalogItem, searchRecipes, type RecipeSummary } from '../api/mealPlannerApi';

type Props = {
  townId: string;
  quantityFor: (listingId: string) => number;
  busyKey: string | null;
  rememberItems: (next: CatalogItemView[], mode: 'replace' | 'append') => void;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
};

const HINTS = ['Chicken biryani', 'Dal tadka', 'Poha', 'Paneer butter masala'];

export function MealPlannerPanel({
  townId,
  quantityFor,
  busyKey,
  rememberItems,
  onIncrease,
  onDecrease,
}: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [suggestions, setSuggestions] = useState<RecipeSummary[]>([]);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof fetchRecipePlan>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const pickRecipeForHint = useCallback(async (hint: string) => {
    const items = await searchRecipes(hint);
    const exact = items.find((i) => i.name.toLowerCase() === hint.trim().toLowerCase());
    return exact ?? items[0] ?? null;
  }, []);

  const loadPlan = useCallback(
    async (recipe: RecipeSummary) => {
      setLoading(true);
      setError(null);
      setNotice(null);
      setQuery(recipe.name);
      try {
        const next = await fetchRecipePlan(recipe.id, townId);
        setPlan(next);
        rememberItems(
          next.ingredients.map(recipeLineToCatalogItem).filter((i): i is CatalogItemView => Boolean(i)),
          'append',
        );
      } catch (err) {
        setPlan(null);
        setError(err instanceof Error ? err.message : 'Could not load ingredients');
      } finally {
        setLoading(false);
      }
    },
    [townId, rememberItems],
  );

  useEffect(() => {
    let cancelled = false;
    if (!debounced) {
      setSuggestions([]);
      return undefined;
    }
    void searchRecipes(debounced)
      .then((items) => {
        if (!cancelled) {
          setSuggestions(items);
          setError(null);
          if (items.length === 1) {
            void loadPlan(items[0]);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSuggestions([]);
          setError(err instanceof Error ? err.message : 'Could not search recipes');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, loadPlan]);

  const availableLines = useMemo(
    () => (plan?.ingredients ?? []).filter((i) => i.available && i.listingId),
    [plan],
  );

  function addAllInStock() {
    const pending = availableLines.filter((l) => l.listingId && quantityFor(l.listingId) <= 0);
    if (!pending.length) {
      setNotice('All in-stock ingredients are already in your cart.');
      return;
    }
    rememberItems(
      pending.map(recipeLineToCatalogItem).filter((i): i is CatalogItemView => Boolean(i)),
      'append',
    );
    pending.forEach((l) => onIncrease(l.listingId!));
    setNotice(`Added ${pending.length} item${pending.length === 1 ? '' : 's'} to cart.`);
  }

  const allInCart = availableLines.length > 0 && availableLines.every((l) => quantityFor(l.listingId!) > 0);

  return (
    <section style={styles.wrap} aria-label="Meal planner">
      <div style={styles.head}>
        <div>
          <p style={styles.kicker}>Meal planner</p>
          <h2 style={styles.title}>What are you cooking today?</h2>
        </div>
      </div>
      <input
        style={styles.input}
        value={query}
        placeholder="Try chicken biryani…"
        onChange={(e) => {
          setQuery(e.target.value);
          if (plan) setPlan(null);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || plan || loading) return;
          e.preventDefault();
          const first = suggestions[0];
          if (first) void loadPlan(first);
        }}
        aria-label="Dish name"
      />
      <div style={styles.chips}>
        {HINTS.map((hint) => (
          <button
            key={hint}
            type="button"
            style={styles.chip}
            onClick={() => {
              setQuery(hint);
              setPlan(null);
              void pickRecipeForHint(hint)
                .then((recipe) => {
                  if (recipe) void loadPlan(recipe);
                  else setError(`No recipe found for “${hint}”.`);
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : 'Could not search recipes');
                });
            }}
          >
            {hint}
          </button>
        ))}
      </div>
      {debounced && !loading && !plan && suggestions.length === 0 && !error ? (
        <p style={styles.muted}>No matching dishes — try another name or tap a suggestion above.</p>
      ) : null}
      {suggestions.length > 0 && !plan ? (
        <div style={styles.suggestList}>
          {suggestions.map((s) => (
            <button key={s.id} type="button" style={styles.suggestRow} onClick={() => void loadPlan(s)}>
              <span>{s.name}</span>
              <span style={styles.servings}>{s.servings} servings</span>
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p style={styles.muted}>Finding ingredients…</p> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {plan ? (
        <>
          <p style={styles.planMeta}>
            <strong>{plan.name}</strong> · ~{plan.servings} servings · tap <strong>Add</strong>, then use − / + to
            adjust
          </p>
          <ul style={styles.list}>
            {plan.ingredients.map((line) => (
              <IngredientRow
                key={`${line.masterItemId}-${line.quantityLabel}`}
                line={line}
                quantity={line.listingId ? quantityFor(line.listingId) : 0}
                busy={Boolean(line.listingId && busyKey === line.listingId)}
                onIncrease={() => {
                  if (!line.listingId) return;
                  const catalog = recipeLineToCatalogItem(line);
                  if (catalog) rememberItems([catalog], 'append');
                  onIncrease(line.listingId);
                }}
                onDecrease={() => line.listingId && onDecrease(line.listingId)}
              />
            ))}
          </ul>
          {availableLines.length > 0 ? (
            <div style={styles.actions}>
              <Button disabled={allInCart || Boolean(busyKey)} onClick={addAllInStock}>
                Add all in stock
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function IngredientRow({
  line,
  quantity,
  busy,
  onIncrease,
  onDecrease,
}: {
  line: RecipeShopLine;
  quantity: number;
  busy: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <li>
      <div
        style={{
          ...styles.line,
          ...(line.available ? {} : styles.lineOff),
        }}
      >
        <span style={styles.lineMain}>
          <span style={styles.lineName}>{line.masterItemName}</span>
          <span style={styles.lineQty}>{line.quantityLabel}</span>
        </span>
        <span style={styles.lineMeta}>
          {line.available && line.effectivePrice != null ? `₹${line.effectivePrice}` : 'Not in town'}
        </span>
        {line.available && line.listingId ? (
          <div style={styles.stepWrap}>
            <QuantityStepper
              size="xs"
              quantity={quantity}
              disabled={busy}
              onIncrease={onIncrease}
              onDecrease={onDecrease}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    borderRadius: 14,
    padding: '0.55rem 0.65rem',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.4rem',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' },
  kicker: {
    margin: 0,
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  title: { margin: '0.1rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800 },
  input: {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.45rem 0.55rem',
    background: 'var(--bg)',
    fontWeight: 600,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  chip: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.2rem 0.55rem',
    background: 'var(--bg)',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  suggestList: { display: 'grid', gap: '0.25rem' },
  suggestRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.4rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.4rem 0.55rem',
    background: 'var(--bg)',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 700,
  },
  servings: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
  planMeta: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.28rem' },
  line: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.35rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.38rem 0.45rem',
    background: 'var(--bg)',
    textAlign: 'left',
  },
  lineOff: { opacity: 0.55 },
  lineMain: { display: 'grid', gap: '0.05rem', minWidth: 0, flex: '1 1 auto' },
  lineName: { fontWeight: 800, fontSize: '0.82rem' },
  lineQty: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  lineMeta: { fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 },
  stepWrap: { flexShrink: 0 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
};
