import type { CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import type { ListingFormState } from '../hooks/useVendorListings';
import type { MasterItemView } from '../api/listingsApi';

type Props = {
  form: ListingFormState;
  masterItems: MasterItemView[];
  saving: boolean;
  onChange: (next: ListingFormState) => void;
  onSubmit: () => void;
};

export function CreateListingForm({ form, masterItems, saving, onChange, onSubmit }: Props) {
  return (
    <Card elevated>
      <form
        style={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h3 style={styles.title}>Add listing</h3>

        <label style={styles.label}>
          Master item
          <select
            style={styles.input}
            value={form.masterItemId}
            onChange={(e) => onChange({ ...form, masterItemId: e.target.value })}
          >
            {masterItems.length === 0 ? <option value="">No master items</option> : null}
            {masterItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.mrpLabel ? ` · MRP ${item.mrpLabel}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.row}>
          <label style={styles.label}>
            Price
            <input
              style={styles.input}
              inputMode="decimal"
              value={form.price}
              onChange={(e) => onChange({ ...form, price: e.target.value })}
              placeholder="30.00"
            />
          </label>
          <label style={styles.label}>
            Discount price (optional)
            <input
              style={styles.input}
              inputMode="decimal"
              value={form.discountPrice}
              onChange={(e) => onChange({ ...form, discountPrice: e.target.value })}
              placeholder="28.00"
            />
          </label>
        </div>

        <label style={styles.label}>
          Vendor note (optional)
          <input
            style={styles.input}
            value={form.vendorNote}
            onChange={(e) => onChange({ ...form, vendorNote: e.target.value })}
            placeholder="Local farm fresh"
          />
        </label>

        <Button type="submit" disabled={saving || masterItems.length === 0}>
          {saving ? 'Saving…' : 'Create listing'}
        </Button>
      </form>
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  form: { display: 'grid', gap: '0.85rem' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 },
  input: {
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
};
