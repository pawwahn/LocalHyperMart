import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';
import { Button, TextField } from '@/shared/ui';

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
  phone: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: AddressFormValues) => void;
};

export function AddressForm({ phone, busy, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<AddressFormValues>({
    label: 'Home',
    recipientName: '',
    recipientPhone: phone,
    line1: '',
    line2: '',
    landmark: '',
    pincode: '522601',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  function update<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
    setLocalError(null);
    onSubmit({
      ...values,
      label: values.label.trim() || 'Home',
      recipientName: values.recipientName.trim(),
      recipientPhone: values.recipientPhone.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim(),
      landmark: values.landmark.trim(),
      pincode: values.pincode.trim(),
    });
  }

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      <h3 style={styles.title}>Add delivery address</h3>
      {localError ? <p style={styles.error}>{localError}</p> : null}

      <div style={styles.row}>
        <TextField
          label="Label"
          value={values.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="Home / Work"
        />
        <TextField
          label="Pincode"
          value={values.pincode}
          onChange={(e) => update('pincode', e.target.value)}
          placeholder="522601"
        />
      </div>

      <div style={styles.row}>
        <TextField
          label="Recipient name"
          value={values.recipientName}
          onChange={(e) => update('recipientName', e.target.value)}
          placeholder="Your name"
          autoFocus
        />
        <TextField
          label="Phone"
          value={values.recipientPhone}
          onChange={(e) => update('recipientPhone', e.target.value)}
          inputMode="numeric"
        />
      </div>

      <TextField
        label="Address line 1"
        value={values.line1}
        onChange={(e) => update('line1', e.target.value)}
        placeholder="House no, street"
      />
      <TextField
        label="Address line 2 (optional)"
        value={values.line2}
        onChange={(e) => update('line2', e.target.value)}
        placeholder="Area, colony"
      />
      <TextField
        label="Landmark (optional)"
        value={values.landmark}
        onChange={(e) => update('landmark', e.target.value)}
        placeholder="Near temple / school"
      />

      <div style={styles.actions}>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save address'}
        </Button>
      </div>
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: 'grid',
    gap: '0.85rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    padding: '1.15rem',
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  actions: { display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600 },
};
