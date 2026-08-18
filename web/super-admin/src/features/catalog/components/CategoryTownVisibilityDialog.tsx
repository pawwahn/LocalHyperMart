import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';
import { listTownsByIds, searchTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  getCategoryTownVisibility,
  setCategoryTownVisibility,
  type CategoryVm,
} from '../api/catalogApi';

type Props = {
  token: string;
  category: CategoryVm;
  busy: boolean;
  onClose: () => void;
  onSaved: (next: CategoryVm) => void;
  onError: (message: string) => void;
};

const PAGE_SIZE = 80;

export function CategoryTownVisibilityDialog({
  token,
  category,
  busy,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(category.status === 'INACTIVE');
  const [exceptionTowns, setExceptionTowns] = useState<TownVm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    getCategoryTownVisibility(token, category.id)
      .then(async (vis) => {
        if (cancelled) return;
        setPaused(vis.paused);
        setHiddenIds(new Set(vis.hiddenTownIds));
        setLiveIds(new Set(vis.liveTownIds));
        const exceptionIds = vis.paused ? vis.liveTownIds : vis.hiddenTownIds;
        const names = exceptionIds.length === 0 ? [] : await listTownsByIds(token, exceptionIds.slice(0, 200));
        if (!cancelled) setExceptionTowns(names);
      })
      .catch((err) => {
        if (!cancelled) onErrorRef.current(err instanceof Error ? err.message : 'Could not load towns');
      });
    return () => {
      cancelled = true;
    };
  }, [token, category.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchTowns(token, { q: debounced, page: 0, size: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setTowns(page.items);
        setTotal(page.total);
        setHasMore(page.hasMore);
      })
      .catch((err) => {
        if (!cancelled) onErrorRef.current(err instanceof Error ? err.message : 'Could not load towns');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, debounced]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const town of towns) next.add(town.id);
      return next;
    });
  }

  async function apply(visible: boolean) {
    const townIds = [...selected];
    if (townIds.length === 0) {
      onError('Select at least one town');
      return;
    }
    setSaving(true);
    try {
      const next = await setCategoryTownVisibility(token, category.id, visible, townIds);
      const vis = await getCategoryTownVisibility(token, category.id);
      setPaused(vis.paused);
      setHiddenIds(new Set(vis.hiddenTownIds));
      setLiveIds(new Set(vis.liveTownIds));
      const exceptionIds = vis.paused ? vis.liveTownIds : vis.hiddenTownIds;
      setExceptionTowns(exceptionIds.length === 0 ? [] : await listTownsByIds(token, exceptionIds.slice(0, 200)));
      setSelected(new Set());
      onSaved(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update towns');
    } finally {
      setSaving(false);
    }
  }

  const locked = busy || saving || loading;
  const exceptionCount = paused ? liveIds.size : hiddenIds.size;
  const exceptionVerb = paused ? 'live' : 'hidden';

  return (
    <div
      style={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div style={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="cat-towns-title">
        <div style={styles.head}>
          <h2 id="cat-towns-title" style={styles.title}>
            Towns · {category.name}
          </h2>
          <button type="button" style={styles.close} disabled={locked} onClick={onClose}>
            Close
          </button>
        </div>
        <p style={styles.hint}>
          {paused
            ? `Paused everywhere. New towns stay hidden. Exceptions live in ${liveIds.size} town${liveIds.size === 1 ? '' : 's'}.`
            : `Live everywhere. New towns stay live. Hidden in ${hiddenIds.size} town${hiddenIds.size === 1 ? '' : 's'}.`}
        </p>
        <div style={styles.toolbar}>
          <input
            aria-label="Search towns"
            placeholder="Search name, code, state"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.search}
          />
          <Button type="button" size="sm" variant="ghost" disabled={locked || towns.length === 0} onClick={selectVisible}>
            Select {towns.length}
          </Button>
        </div>
        <ul style={styles.list} className="hlm-hide-scrollbar">
          {loading ? (
            <li style={styles.muted}>Loading towns…</li>
          ) : towns.length === 0 ? (
            <li style={styles.muted}>No towns match.</li>
          ) : (
            towns.map((town) => {
              const exception = paused ? liveIds.has(town.id) : hiddenIds.has(town.id);
              return (
                <li key={town.id}>
                  <label style={styles.row}>
                    <input
                      type="checkbox"
                      checked={selected.has(town.id)}
                      disabled={locked}
                      onChange={() => toggle(town.id)}
                    />
                    <span style={styles.townName}>{town.displayName}</span>
                    <span style={styles.townMeta}>
                      {town.stateCode}
                      {exception ? ` · ${exceptionVerb}` : ''}
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
        <p style={styles.foot}>
          {selected.size} selected · {total} match{hasMore ? '+' : ''}
          {exceptionCount > 0
            ? ` · ${exceptionCount} ${exceptionVerb}`
            : ''}
          {exceptionTowns.length > 0
            ? ` · ${exceptionTowns
                .slice(0, 6)
                .map((t) => t.displayName)
                .join(', ')}${exceptionTowns.length > 6 ? '…' : ''}`
            : ''}
        </p>
        <div style={styles.actions}>
          <Button type="button" size="sm" disabled={locked || selected.size === 0} onClick={() => void apply(false)}>
            Hide in selected
          </Button>
          <Button type="button" size="sm" disabled={locked || selected.size === 0} onClick={() => void apply(true)}>
            Show in selected
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  dialog: {
    width: 'min(480px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    padding: '0.75rem 0.85rem',
    display: 'grid',
    gap: '0.4rem',
    boxShadow: 'var(--shadow-elevated)',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  close: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  hint: { margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.3 },
  toolbar: { display: 'flex', gap: '0.4rem', alignItems: 'center' },
  search: {
    flex: 1,
    minWidth: 0,
    padding: '0.4rem 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.08rem',
    maxHeight: 'min(42vh, 360px)',
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    minHeight: 36,
    padding: '0.12rem 0.2rem',
    cursor: 'pointer',
  },
  townName: { flex: 1, minWidth: 0, fontWeight: 700, fontSize: '0.85rem' },
  townMeta: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 },
  muted: { color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.4rem' },
  actions: { display: 'flex', gap: '0.4rem' },
  foot: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 },
};
