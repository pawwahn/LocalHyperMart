import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export type SearchSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

type Props = {
  label?: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
};

type MenuPos = { top: number; left: number; width: number };

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionHaystack(option: SearchSelectOption): string {
  return normalize(option.searchText ?? option.label);
}

function rankOption(option: SearchSelectOption, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const label = normalize(option.label);
  if (tokens.every((t) => label.startsWith(t) || label.split(' ').some((w) => w.startsWith(t)))) {
    return 0;
  }
  return 1;
}

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search…',
  disabled,
  emptyMessage = 'No matches',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const raw = query.trim();
    const searching = raw.length > 0;
    if (!searching) {
      return [...options].sort((a, b) => {
        if (a.value === value) return -1;
        if (b.value === value) return 1;
        return a.label.localeCompare(b.label);
      });
    }

    const tokens = normalize(raw).split(' ').filter(Boolean);
    return options
      .filter((o) => tokens.every((t) => optionHaystack(o).includes(t)))
      .sort((a, b) => {
        const rank = rankOption(a, tokens) - rankOption(b, tokens);
        if (rank !== 0) return rank;
        return a.label.localeCompare(b.label);
      });
  }, [options, query, value]);

  function updateMenuPos() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, left),
      width,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    function onReposition() {
      updateMenuPos();
    }
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeList();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function closeList() {
    setOpen(false);
    setQuery('');
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(next: string) {
    onChange(next);
    closeList();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeList();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.value);
    }
  }

  const searching = open && query.trim().length > 0;
  const displayValue = open ? query : (selected?.label ?? '');

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              ...styles.menu,
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <div style={styles.menuMeta}>
              {searching
                ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
                : `${filtered.length} town${filtered.length === 1 ? '' : 's'} · type to filter`}
            </div>
            <ul id={listId} role="listbox" style={styles.menuList}>
              {filtered.length === 0 ? (
                <li style={styles.empty}>{emptyMessage}</li>
              ) : (
                filtered.map((opt, index) => {
                  const active = opt.value === value;
                  const focused = index === highlight;
                  return (
                    <li key={opt.value} role="option" aria-selected={active}>
                      <button
                        type="button"
                        style={{
                          ...styles.option,
                          ...(focused ? styles.optionFocused : null),
                          ...(active ? styles.optionActive : null),
                        }}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(opt.value)}
                      >
                        <span>{opt.label}</span>
                        {active ? <span style={styles.check}>✓</span> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} style={styles.root}>
      {label ? <span style={styles.eyebrow}>{label}</span> : null}
      <div style={styles.control}>
        <input
          ref={inputRef}
          style={styles.input}
          value={displayValue}
          disabled={disabled}
          placeholder={open ? placeholder : selected ? selected.label : placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          onFocus={() => {
            if (!open) openList();
          }}
          onClick={() => {
            if (!open) openList();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          style={styles.chevronBtn}
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close list' : 'Open list'}
          onClick={() => (open ? closeList() : openList())}
        >
          <span style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
      </div>
      {menu}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: 'relative',
    display: 'grid',
    gap: '0.3rem',
    minWidth: 'min(100%, 280px)',
    flex: '1 1 280px',
    zIndex: 1,
  },
  eyebrow: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  control: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.7rem 2.1rem 0.7rem 0.9rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 600,
  },
  chevronBtn: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem 0.35rem',
    lineHeight: 1,
  },
  chevron: {
    display: 'inline-block',
    transition: 'transform 120ms ease',
    fontSize: '0.85rem',
  },
  menu: {
    position: 'fixed',
    zIndex: 9999,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
    overflow: 'hidden',
  },
  menuMeta: {
    padding: '0.45rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  menuList: {
    margin: 0,
    padding: '0.3rem',
    listStyle: 'none',
    maxHeight: 'min(50vh, 320px)',
    overflowY: 'auto',
  },
  option: {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    padding: '0.55rem 0.7rem',
    borderRadius: 'calc(var(--radius-md) - 2px)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  optionFocused: {
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
  },
  optionActive: {
    color: 'var(--accent)',
  },
  check: {
    color: 'var(--accent)',
    fontWeight: 800,
    flexShrink: 0,
  },
  empty: {
    padding: '0.7rem 0.75rem',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
  },
};
