import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import type { DraftPricing, ListingView } from '../api/listingsApi';
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

type ListingStatusFilter = 'all' | 'live' | 'hidden';
type ListingSortKey = 'name' | 'unit' | 'status' | 'sell' | 'mrp' | 'note';

type Props = {
  listings: ListingView[];
  filteredListings: ListingView[];
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: ListingStatusFilter;
  onStatusFilterChange: (value: ListingStatusFilter) => void;
  actionId: string | null;
  onToggle: (listing: ListingView) => void;
  onSavePricing: (listing: ListingView, draft: DraftPricing) => Promise<boolean>;
};

const STATUS_FILTERS: Array<{ id: ListingStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'hidden', label: 'Hidden' },
];

function moneyValue(label: string | null | undefined): number | null {
  if (!label) return null;
  const n = Number(String(label).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function PublishedListings({
  listings,
  filteredListings,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  actionId,
  onToggle,
  onSavePricing,
}: Props) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<ListingSortKey>>({ key: 'name', dir: 'asc' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftPricing | null>(null);
  const liveCount = listings.filter((l) => l.active).length;
  const hiddenCount = listings.length - liveCount;

  function startEdit(listing: ListingView) {
    setEditingId(listing.id);
    setEditDraft({
      vendorMrp: listing.vendorMrp,
      price: listing.price,
      discountPrice: listing.discountPrice,
      vendorNote: listing.note,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(listing: ListingView) {
    if (!editDraft) return;
    const ok = await onSavePricing(listing, editDraft);
    if (ok) cancelEdit();
  }

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, pageSize, sort]);

  const sortedListings = useMemo(() => {
    const rows = [...filteredListings];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case 'name':
          cmp = compareText(a.name, b.name);
          break;
        case 'unit':
          cmp = compareText(a.unit, b.unit);
          break;
        case 'status':
          cmp = Number(a.active) - Number(b.active);
          break;
        case 'sell':
          cmp = compareNumber(
            moneyValue(a.effectiveLabel) ?? parseSortNumber(a.price),
            moneyValue(b.effectiveLabel) ?? parseSortNumber(b.price),
          );
          break;
        case 'mrp':
          cmp = compareNumber(
            moneyValue(a.mrpLabel) ?? parseSortNumber(a.vendorMrp),
            moneyValue(b.mrpLabel) ?? parseSortNumber(b.vendorMrp),
          );
          break;
        case 'note':
          cmp = compareText(a.note || '', b.note || '');
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = compareText(a.name, b.name);
      return cmp * dir;
    });
    return rows;
  }, [filteredListings, sort]);

  const { total, totalPages, safePage, from, to, pageItems } = useMemo(
    () => pageWindow(sortedListings, page, pageSize),
    [sortedListings, page, pageSize],
  );

  function onSort(column: ListingSortKey) {
    setSort((prev) => toggleSort(prev, column));
  }

  if (listings.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '1.25rem' }}>
        <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          Nothing in your town listing yet
        </p>
        <p style={styles.empty}>Select products above and publish them for your town buyers.</p>
      </Card>
    );
  }

  return (
    <Card elevated style={styles.card}>
      <div style={styles.head}>
        <h3 style={styles.title}>
          {listings.length} in town
          {liveCount > 0 || hiddenCount > 0
            ? ` · ${liveCount} live · ${hiddenCount} hidden`
            : ''}
        </h3>
      </div>

      <div style={styles.toolbar}>
        <input
          style={styles.search}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search listings…"
          aria-label="Search town listings"
        />
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as ListingStatusFilter)}
          aria-label="Listing status"
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

      {filteredListings.length === 0 ? (
        <p style={styles.empty}>No listings match your search or filters.</p>
      ) : (
        <TableScrollShell label="My listings table" maxHeight="min(68vh, 720px)">
          <table style={styles.table}>
            <thead>
              <tr>
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
                  label="Sell"
                  column="sell"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                  style={styles.thRight}
                />
                <SortableTh
                  label="MRP"
                  column="mrp"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                  style={styles.thRight}
                />
                <SortableTh label="Note" column="note" sort={sort} onSort={onSort} style={styles.th} />
                <th style={styles.thAction}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((listing) => {
                const busy = actionId === listing.id;
                const editing = editingId === listing.id && editDraft;
                const cellBg = {
                  background: editing ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  backgroundClip: 'padding-box' as const,
                };
                return (
                  <tr key={listing.id} style={styles.tr}>
                    <td style={{ ...styles.tdProduct, ...cellBg }} title={listing.name}>
                      <strong style={styles.name}>{listing.name}</strong>
                    </td>
                    <td style={{ ...styles.tdMuted, ...cellBg }}>{listing.unit}</td>
                    <td style={{ ...styles.td, ...cellBg }}>
                      <span style={listing.active ? styles.on : styles.off}>
                        {listing.active ? 'LIVE' : 'HIDDEN'}
                      </span>
                    </td>
                    <td style={{ ...styles.tdRight, ...cellBg }}>
                      {editing ? (
                        <input
                          style={styles.cellInput}
                          inputMode="decimal"
                          value={editDraft.price}
                          onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
                          aria-label={`${listing.name} sell price`}
                        />
                      ) : (
                        listing.priceLabel
                      )}
                    </td>
                    <td style={{ ...styles.tdRight, ...cellBg }}>
                      {editing ? (
                        <input
                          style={styles.cellInput}
                          inputMode="decimal"
                          value={editDraft.vendorMrp}
                          onChange={(e) => setEditDraft({ ...editDraft, vendorMrp: e.target.value })}
                          aria-label={`${listing.name} MRP`}
                        />
                      ) : (
                        listing.mrpLabel ?? '—'
                      )}
                    </td>
                    <td style={{ ...styles.tdMuted, ...cellBg }} title={listing.note || undefined}>
                      {editing ? (
                        <input
                          style={styles.cellInputWide}
                          value={editDraft.vendorNote}
                          onChange={(e) => setEditDraft({ ...editDraft, vendorNote: e.target.value })}
                          placeholder="Note"
                          aria-label={`${listing.name} note`}
                        />
                      ) : (
                        listing.note || '—'
                      )}
                    </td>
                    <td style={{ ...styles.tdAction, ...cellBg }}>
                      {editing ? (
                        <div style={styles.actionRow}>
                          <Button size="sm" disabled={busy} onClick={() => void saveEdit(listing)}>
                            {busy ? '…' : 'Save'}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div style={styles.actionRow}>
                          <Button variant="ghost" size="sm" disabled={busy || Boolean(editingId)} onClick={() => startEdit(listing)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy || Boolean(editingId)} onClick={() => onToggle(listing)}>
                            {listing.active ? 'Hide' : 'Show'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollShell>
      )}

      {filteredListings.length > 0 ? (
        <TablePager
          total={total}
          from={from}
          to={to}
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '1rem', display: 'grid', gap: '0.65rem' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 },
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
  thProduct: {
    position: 'sticky',
    top: 0,
    left: 0,
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
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    zIndex: 4,
    minWidth: 72,
  },
  thAction: {
    position: 'sticky',
    top: 0,
    right: 0,
    background: 'var(--bg-muted)',
    backgroundClip: 'padding-box',
    padding: '0.45rem 0.5rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 6,
    borderBottom: '1px solid var(--border)',
    minWidth: 88,
    boxShadow: '-4px 0 8px -4px rgba(15, 23, 42, 0.18)',
  },
  tr: { height: 48 },
  tdProduct: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    minWidth: 160,
    maxWidth: 200,
    height: 48,
    boxSizing: 'border-box',
    boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.18)',
  },
  name: {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 184,
  },
  td: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    height: 48,
    boxSizing: 'border-box',
  },
  tdMuted: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 90,
    maxWidth: 160,
    height: 48,
    boxSizing: 'border-box',
  },
  tdRight: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 600,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    minWidth: 72,
    height: 48,
    boxSizing: 'border-box',
  },
  tdAction: {
    position: 'sticky',
    right: 0,
    zIndex: 3,
    padding: '0.25rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    verticalAlign: 'middle',
    minWidth: 140,
    height: 48,
    boxSizing: 'border-box',
    boxShadow: '-4px 0 8px -4px rgba(15, 23, 42, 0.18)',
  },
  actionRow: { display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' },
  cellInput: {
    width: 72,
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
    minWidth: 80,
    height: 30,
    boxSizing: 'border-box',
    padding: '0.25rem 0.35rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.82rem',
  },
  on: {
    fontSize: '0.65rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  off: {
    fontSize: '0.65rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  empty: { margin: '0.35rem 0 0', color: 'var(--text-muted)' },
};
