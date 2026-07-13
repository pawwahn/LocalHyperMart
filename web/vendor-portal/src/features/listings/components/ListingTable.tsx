import type { CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import type { ListingView } from '../api/listingsApi';

type Props = {
  listings: ListingView[];
  actionId: string | null;
  onToggle: (listing: ListingView) => void;
  onEditPrice: (listing: ListingView) => void;
};

export function ListingTable({ listings, actionId, onToggle, onEditPrice }: Props) {
  if (listings.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '1.75rem' }}>
        <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-display)' }}>No listings yet</p>
        <p style={styles.empty}>Create one below to start selling in the town catalog.</p>
      </Card>
    );
  }

  return (
    <div style={styles.list}>
      {listings.map((listing) => {
        const busy = actionId === listing.id;
        return (
          <Card key={listing.id} elevated style={styles.row}>
            <div>
              <p style={styles.name}>
                {listing.name}{' '}
                <span style={listing.active ? styles.on : styles.off}>
                  {listing.active ? 'ACTIVE' : 'OFF'}
                </span>
              </p>
              <p style={styles.meta}>
                {listing.priceLabel}
                {listing.discountLabel ? ` · disc ${listing.discountLabel}` : ''} · {listing.unit}
              </p>
              {listing.note ? <p style={styles.meta}>{listing.note}</p> : null}
            </div>
            <div style={styles.actions}>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onEditPrice(listing)}>
                Edit price
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => onToggle(listing)}>
                {listing.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: 'grid', gap: '0.75rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  name: { margin: 0, fontWeight: 700 },
  meta: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' },
  on: {
    marginLeft: '0.4rem',
    fontSize: '0.7rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.15rem 0.5rem',
    fontWeight: 700,
  },
  off: {
    marginLeft: '0.4rem',
    fontSize: '0.7rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.15rem 0.5rem',
    fontWeight: 700,
  },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  empty: { margin: '0.35rem 0 0', color: 'var(--text-muted)' },
};
