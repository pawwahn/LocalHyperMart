import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import type { CategoryView, DraftPricing, ListingView, MasterItemView } from '../api/listingsApi';
import { TableScrollShell } from './TableScrollShell';
import { SortableTh } from './SortableTh';
import { TablePager } from './TablePager';
import {
  PAGE_SIZES,
  compareNumber,
  compareText,
  pageWindow,
  parseSortNumber,
  toggleSort,
  type SortState,
} from './tableControls';

type CatalogStatusFilter = 'all' | 'not_listed' | 'live' | 'hidden';
type CatalogSortKey = 'name' | 'unit' | 'status' | 'mrp' | 'sell' | 'discount' | 'note';

type Props = {
  categories: CategoryView[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: CatalogStatusFilter;
  onStatusFilterChange: (value: CatalogStatusFilter) => void;
  items: MasterItemView[];
  listedByMaster: Map<string, ListingView>;
  selected: Record<string, boolean>;
  drafts: Record<string, DraftPricing>;
  rowErrors?: Record<string, string>;
  saving: boolean;
  selectedCount: number;
  adminTotal: number;
  inMyListing: number;
  onToggle: (masterItemId: string, checked: boolean) => void;
  onDraftChange: (masterItemId: string, patch: Partial<DraftPricing>) => void;
  onPublish: () => void;
};

const STATUS_FILTERS: Array<{ id: CatalogStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'not_listed', label: 'Not listed' },
  { id: 'live', label: 'In town' },
  { id: 'hidden', label: 'Hidden' },
];

function catalogStatusRank(existing?: ListingView): number {
  if (!existing) return 0;
  return existing.active ? 2 : 1;
}

export function CatalogPicker({
  categories,
  categoryId,
  onCategoryChange,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  items,
  listedByMaster,
  selected,
  drafts,
  rowErrors = {},
  saving,
  selectedCount,
  adminTotal,
  inMyListing,
  onToggle,
  onDraftChange,
  onPublish,
}: Props) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<CatalogSortKey>>({ key: 'name', dir: 'asc' });

  useEffect(() => {
    setPage(0);
  }, [categoryId, query, statusFilter, pageSize, sort]);

  const sortedItems = useMemo(() => {
    const rows = [...items];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const draftA = drafts[a.id];
      const draftB = drafts[b.id];
      let cmp = 0;
      switch (sort.key) {
        case 'name':
          cmp = compareText(a.name, b.name);
          break;
        case 'unit':
          cmp = compareText(a.unit, b.unit);
          break;
        case 'status':
          cmp = catalogStatusRank(listedByMaster.get(a.id)) - catalogStatusRank(listedByMaster.get(b.id));
          break;
        case 'mrp':
          cmp = compareNumber(
            parseSortNumber(draftA?.vendorMrp) ?? a.mrp,
            parseSortNumber(draftB?.vendorMrp) ?? b.mrp,
          );
          break;
        case 'sell':
          cmp = compareNumber(parseSortNumber(draftA?.price), parseSortNumber(draftB?.price));
          break;
        case 'discount':
          cmp = compareNumber(
            parseSortNumber(draftA?.discountPrice),
            parseSortNumber(draftB?.discountPrice),
          );
          break;
        case 'note':
          cmp = compareText(draftA?.vendorNote ?? '', draftB?.vendorNote ?? '');
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = compareText(a.name, b.name);
      return cmp * dir;
    });
    return rows;
  }, [items, sort, drafts, listedByMaster]);

  const { total, totalPages, safePage, from, to, pageItems } = useMemo(
    () => pageWindow(sortedItems, page, pageSize),
    [sortedItems, page, pageSize],
  );

  const pageSelectedCount = pageItems.filter((item) => selected[item.id]).length;
  const allPageSelected = pageItems.length > 0 && pageSelectedCount === pageItems.length;

  function togglePage(checked: boolean) {
    for (const item of pageItems) {
      if (Boolean(selected[item.id]) !== checked) {
        onToggle(item.id, checked);
      }
    }
  }

  function onSort(column: CatalogSortKey) {
    setSort((prev) => toggleSort(prev, column));
  }

  return (
    <Card elevated style={styles.card}>
      <div style={styles.head}>
        <div>
          <h3 style={styles.title}>Admin catalog</h3>
          <p style={styles.hint}>
            {inMyListing} of {adminTotal} listed · pick, price, publish
          </p>
        </div>
      </div>

      <div style={styles.toolbar}>
        <input
          style={styles.search}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, category, unit…"
          aria-label="Search admin catalog"
        />
        <select
          style={styles.select}
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as CatalogStatusFilter)}
          aria-label="Status"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
        <select
          style={styles.select}
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p style={styles.empty}>No products match your search or filters.</p>
      ) : (
        <TableScrollShell label="Admin catalog table" maxHeight="min(68vh, 720px)">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thCheck}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(e) => togglePage(e.target.checked)}
                    aria-label="Select all on this page"
                  />
                </th>
                <SortableTh
                  label="Product"
                  column="name"
                  sort={sort}
                  onSort={onSort}
                  style={styles.thProduct}
                />
                <SortableTh label="Unit" column="unit" sort={sort} onSort={onSort} style={styles.th} />
                <SortableTh label="Status" column="status" sort={sort} onSort={onSort} style={styles.th} />
                <SortableTh
                  label="MRP"
                  column="mrp"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                  style={styles.thNum}
                />
                <SortableTh
                  label="Sell"
                  column="sell"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                  style={styles.thNum}
                />
                <SortableTh
                  label="Discount"
                  column="discount"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                  style={styles.thNum}
                />
                <SortableTh label="Note" column="note" sort={sort} onSort={onSort} style={styles.thNote} />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const checked = Boolean(selected[item.id]);
                const draft = drafts[item.id];
                const existing = listedByMaster.get(item.id);
                const rowError = rowErrors[item.id];
                const rowBg = rowError
                  ? 'var(--danger-soft)'
                  : checked
                    ? 'var(--accent-soft)'
                    : 'var(--bg-elevated)';
                const cellBg = { background: rowBg, backgroundClip: 'padding-box' as const };
                const subLabel = `${item.category}${item.mrpLabel ? ` · Admin MRP ${item.mrpLabel}` : ''}`;
                return (
                  <tr key={item.id} style={styles.tr}>
                    <td style={{ ...styles.tdCheck, ...cellBg }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggle(item.id, e.target.checked)}
                        aria-label={`Select ${item.name}`}
                      />
                    </td>
                    <td style={{ ...styles.tdProduct, ...cellBg }} title={`${item.name} · ${subLabel}`}>
                      <div style={styles.productCell}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" style={styles.productThumb} />
                        ) : (
                          <span style={styles.productThumbEmpty} aria-hidden>
                            📦
                          </span>
                        )}
                        <div style={styles.productText}>
                          <span style={styles.name}>{item.name}</span>
                          <span style={styles.sub}>{subLabel}</span>
                          {rowError ? <span style={styles.inlineError}>{rowError}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...styles.tdMuted, ...cellBg }}>{item.unit}</td>
                    <td style={{ ...styles.td, ...cellBg }}>
                      {existing?.active ? (
                        <span style={styles.live}>IN TOWN</span>
                      ) : existing ? (
                        <span style={styles.off}>HIDDEN</span>
                      ) : (
                        <span style={styles.mutedBadge}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.tdNum, ...cellBg }}>
                      {checked ? (
                        <input
                          style={{ ...styles.cellInput, ...(rowError ? styles.inputError : null) }}
                          inputMode="decimal"
                          value={draft?.vendorMrp ?? ''}
                          onChange={(e) => onDraftChange(item.id, { vendorMrp: e.target.value })}
                          placeholder="MRP"
                          aria-label={`${item.name} MRP`}
                        />
                      ) : (
                        <span style={styles.placeholder}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.tdNum, ...cellBg }}>
                      {checked ? (
                        <input
                          style={{ ...styles.cellInput, ...(rowError ? styles.inputError : null) }}
                          inputMode="decimal"
                          value={draft?.price ?? ''}
                          onChange={(e) => onDraftChange(item.id, { price: e.target.value })}
                          placeholder="Sell"
                          aria-label={`${item.name} selling price`}
                        />
                      ) : (
                        <span style={styles.placeholder}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.tdNum, ...cellBg }}>
                      {checked ? (
                        <input
                          style={styles.cellInput}
                          inputMode="decimal"
                          value={draft?.discountPrice ?? ''}
                          onChange={(e) => onDraftChange(item.id, { discountPrice: e.target.value })}
                          placeholder="—"
                          aria-label={`${item.name} discount`}
                        />
                      ) : (
                        <span style={styles.placeholder}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.tdNote, ...cellBg }}>
                      {checked ? (
                        <input
                          style={styles.cellInputWide}
                          value={draft?.vendorNote ?? ''}
                          onChange={(e) => onDraftChange(item.id, { vendorNote: e.target.value })}
                          placeholder="Note"
                          aria-label={`${item.name} note`}
                        />
                      ) : (
                        <span style={styles.placeholder}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollShell>
      )}

      {selectedCount > 0 ? (
        <div style={styles.publishBar}>
          <span style={styles.publishText}>{selectedCount} selected for publish</span>
          <Button size="sm" disabled={saving} onClick={onPublish}>
            {saving ? 'Publishing…' : 'Publish to town'}
          </Button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <TablePager
          total={total}
          from={from}
          to={to}
          page={safePage}
          totalPages={totalPages}
          selectedLabel={`${selectedCount} selected`}
          onPageChange={setPage}
        />
      ) : null}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '1rem', display: 'grid', gap: '0.65rem' },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800 },
  hint: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 560 },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  search: {
    padding: '0.55rem 0.7rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.9rem',
  },
  select: {
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  table: {
    width: 'max-content',
    minWidth: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: '0.85rem',
  },
  thCheck: {
    position: 'sticky',
    top: 0,
    left: 0,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    padding: '0.45rem 0.5rem',
    textAlign: 'center',
    width: 40,
    minWidth: 40,
    height: 40,
    zIndex: 6,
    borderBottom: '1px solid var(--border)',
  },
  thProduct: {
    position: 'sticky',
    top: 0,
    left: 40,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    zIndex: 6,
    minWidth: 160,
    maxWidth: 200,
    boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.18)',
  },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    zIndex: 4,
  },
  thNum: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    zIndex: 4,
    width: 88,
    minWidth: 88,
  },
  thNote: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    zIndex: 4,
    minWidth: 140,
  },
  tr: { height: 52 },
  tdCheck: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    padding: '0.4rem 0.5rem',
    textAlign: 'center',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    width: 40,
    minWidth: 40,
    height: 52,
    boxSizing: 'border-box',
  },
  tdProduct: {
    position: 'sticky',
    left: 40,
    zIndex: 3,
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    minWidth: 160,
    maxWidth: 200,
    height: 52,
    boxSizing: 'border-box',
    boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.18)',
  },
  td: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    height: 52,
    boxSizing: 'border-box',
  },
  tdMuted: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    height: 52,
    boxSizing: 'border-box',
  },
  tdNum: {
    padding: '0.4rem 0.35rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    verticalAlign: 'middle',
    minWidth: 88,
    height: 52,
    boxSizing: 'border-box',
  },
  tdNote: {
    padding: '0.4rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    minWidth: 140,
    height: 52,
    boxSizing: 'border-box',
  },
  productCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    minWidth: 0,
    maxWidth: 220,
  },
  productText: {
    display: 'grid',
    gap: 1,
    minWidth: 0,
    flex: 1,
  },
  productThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    objectFit: 'cover',
    border: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--bg-muted)',
  },
  productThumbEmpty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--bg-muted)',
    fontSize: '0.9rem',
  },
  name: {
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sub: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  inlineError: {
    color: 'var(--danger)',
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cellInput: {
    width: 76,
    height: 30,
    boxSizing: 'border-box',
    padding: '0.25rem 0.35rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    textAlign: 'right',
    fontSize: '0.82rem',
  },
  cellInputWide: {
    width: '100%',
    minWidth: 100,
    height: 30,
    boxSizing: 'border-box',
    padding: '0.25rem 0.35rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.82rem',
  },
  inputError: { borderColor: 'var(--danger)' },
  placeholder: { color: 'var(--text-muted)' },
  live: {
    fontSize: '0.65rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  off: {
    fontSize: '0.65rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  mutedBadge: { color: 'var(--text-muted)' },
  empty: { margin: '0.5rem 0', color: 'var(--text-muted)' },
  publishBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
  },
  publishText: { fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-hover)' },
};
