import type { CSSProperties, FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTown } from '@/shared/town/TownContext';
import type { TownVm } from '@/features/towns/api/townsApi';
import { Button } from '@/shared/ui';

export type AddressFormValues = {
  label: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
};

type Props = {
  /** @deprecated Town comes from TownContext dropdown; kept for call-site compat. */
  townLabel?: string;
  phone: string;
  busy: boolean;
  mode?: 'create' | 'edit';
  initial?: Partial<AddressFormValues>;
  /** Server / parent error shown above the actions. */
  error?: string | null;
  /** @deprecated Town change is handled in-form via dropdown + confirm. */
  onChangeTown?: () => void;
  onCancel: () => void;
  onSubmit: (values: AddressFormValues) => void | Promise<void>;
};

function CompactField({
  label,
  style,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const inputId =
    id ?? (typeof label === 'string' ? `addr-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <label style={styles.field} htmlFor={inputId}>
      {label ? <span style={styles.fieldLabel}>{label}</span> : null}
      <input id={inputId} style={{ ...styles.input, ...style }} {...rest} />
    </label>
  );
}

export function AddressForm({
  phone,
  busy,
  mode = 'create',
  initial,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const { towns, townId, townLabel, hasTown, selectTown, loading: townsLoading } = useTown();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [values, setValues] = useState<AddressFormValues>({
    label: initial?.label ?? 'Home',
    recipientName: initial?.recipientName ?? '',
    recipientPhone: initial?.recipientPhone ?? phone,
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    landmark: initial?.landmark ?? '',
    pincode: initial?.pincode ?? '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingTown, setPendingTown] = useState<TownVm | null>(null);
  const [townBusy, setTownBusy] = useState(false);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  function update<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onTownSelectChange(nextId: string) {
    if (!nextId) {
      setLocalError('Town is required');
      return;
    }
    if (nextId === townId) return;
    const town = towns.find((t) => t.id === nextId);
    if (!town) return;
    if (!town.acceptingOrders) {
      setLocalError('That town is not accepting orders yet.');
      return;
    }
    setLocalError(null);
    setPendingTown(town);
  }

  async function confirmTownSwitch() {
    if (!pendingTown) return;
    setTownBusy(true);
    setLocalError(null);
    try {
      await selectTown(pendingTown);
      setPendingTown(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not switch town');
    } finally {
      setTownBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!hasTown || !townId.trim()) {
      setLocalError('Select a town — delivery address must belong to a town.');
      return;
    }
    if (!values.recipientName.trim()) {
      setLocalError('Recipient name is required');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(values.recipientPhone.trim())) {
      setLocalError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!values.line1.trim()) {
      setLocalError('Address line 1 is required');
      return;
    }
    if (!values.landmark.trim()) {
      setLocalError('Landmark is required');
      return;
    }
    const pin = values.pincode.trim();
    if (pin && !/^\d{6}$/.test(pin)) {
      setLocalError('Enter a valid 6-digit pincode, or leave it blank');
      return;
    }
    setLocalError(null);
    await onSubmit({
      ...values,
      label: values.label.trim() || 'Home',
      recipientName: values.recipientName.trim(),
      recipientPhone: values.recipientPhone.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim(),
      landmark: values.landmark.trim(),
      pincode: pin,
    });
  }

  const formLocked = busy || townBusy || Boolean(pendingTown);

  return (
    <form ref={formRef} style={styles.form} onSubmit={handleSubmit}>
      <div style={styles.head}>
        <h3 style={styles.title}>{mode === 'edit' ? 'Edit address' : 'Add address'}</h3>
        {localError || error ? <p style={styles.error}>{localError || error}</p> : null}
      </div>

      <label style={styles.field} htmlFor="address-town">
        <span style={styles.fieldLabel}>Town *</span>
        <select
          id="address-town"
          style={styles.select}
          value={townId}
          disabled={formLocked || townsLoading}
          required
          onChange={(e) => onTownSelectChange(e.target.value)}
        >
          <option value="" disabled>
            {townsLoading ? 'Loading…' : 'Select town'}
          </option>
          {towns.map((town) => (
            <option key={town.id} value={town.id} disabled={!town.acceptingOrders}>
              {town.displayName}
              {!town.acceptingOrders ? ' (soon)' : ''}
            </option>
          ))}
        </select>
      </label>

      <div style={styles.row}>
        <CompactField
          label="Label"
          value={values.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="Home"
          disabled={formLocked}
        />
        <CompactField
          label="Phone *"
          value={values.recipientPhone}
          onChange={(e) => update('recipientPhone', e.target.value)}
          inputMode="numeric"
          disabled={formLocked}
        />
      </div>

      <CompactField
        label="Recipient name *"
        value={values.recipientName}
        onChange={(e) => update('recipientName', e.target.value)}
        placeholder="Your name"
        autoFocus
        disabled={formLocked}
      />
      <CompactField
        label="Address line 1 *"
        value={values.line1}
        onChange={(e) => update('line1', e.target.value)}
        placeholder="House no, street"
        disabled={formLocked}
      />
      <CompactField
        label="Line 2"
        value={values.line2}
        onChange={(e) => update('line2', e.target.value)}
        placeholder="Area, colony"
        disabled={formLocked}
      />

      <div style={styles.row}>
        <CompactField
          label="Landmark *"
          value={values.landmark}
          onChange={(e) => update('landmark', e.target.value)}
          placeholder="Near temple"
          required
          disabled={formLocked}
        />
        <CompactField
          label="Pincode"
          value={values.pincode}
          onChange={(e) => update('pincode', e.target.value)}
          placeholder="Optional"
          inputMode="numeric"
          disabled={formLocked}
        />
      </div>

      <div style={styles.actions}>
        <Button type="submit" disabled={formLocked || !hasTown} style={styles.primaryBtn}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" disabled={formLocked} onClick={onCancel} style={styles.ghostBtn}>
          Cancel
        </Button>
      </div>

      {pendingTown ? (
        <div style={styles.confirmBackdrop} role="presentation">
          <div
            style={styles.confirmSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-town-title"
          >
            <h4 id="confirm-town-title" style={styles.confirmTitle}>
              Switch town?
            </h4>
            <p style={styles.confirmBody}>
              Change from <strong>{townLabel || 'current town'}</strong> to{' '}
              <strong>{pendingTown.displayName}</strong>?
              {hasTown ? ' Previous-town cart items will be cleared.' : ''}
            </p>
            <div style={styles.confirmActions}>
              <Button type="button" disabled={townBusy} onClick={() => void confirmTownSwitch()} fullWidth>
                {townBusy ? 'Switching…' : 'Yes, switch'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={townBusy}
                onClick={() => setPendingTown(null)}
                fullWidth
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: 'grid',
    gap: '0.45rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.65rem 0.7rem',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
    position: 'relative',
  },
  head: { display: 'grid', gap: '0.2rem' },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  field: {
    display: 'grid',
    gap: '0.18rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: 0,
  },
  fieldLabel: {
    lineHeight: 1.2,
  },
  input: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '0.45rem 0.6rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    outline: 'none',
    minWidth: 0,
    fontSize: '0.9rem',
    lineHeight: 1.25,
  },
  select: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    outline: 'none',
    fontWeight: 700,
    fontSize: '0.88rem',
    minWidth: 0,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.45rem',
    minWidth: 0,
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '0.4rem',
    marginTop: '0.2rem',
  },
  primaryBtn: {
    minHeight: 40,
    padding: '0.45rem 0.75rem',
  },
  ghostBtn: {
    minHeight: 40,
    padding: '0.45rem 0.75rem',
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600 },
  confirmBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(2, 6, 12, 0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  confirmSheet: {
    width: '100%',
    maxWidth: 360,
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    padding: '0.9rem',
    display: 'grid',
    gap: '0.55rem',
    boxShadow: '0 16px 40px rgba(2, 6, 12, 0.22)',
  },
  confirmTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
  },
  confirmBody: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  confirmActions: { display: 'grid', gap: '0.4rem' },
};
