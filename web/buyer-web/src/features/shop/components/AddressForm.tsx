import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
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
  mode?: 'create' | 'edit';
  initial?: Partial<AddressFormValues>;
  /** Server / parent error shown above the actions. */
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: AddressFormValues) => void | Promise<void>;
};

export function AddressForm({
  phone,
  busy,
  mode = 'create',
  initial,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [values, setValues] = useState<AddressFormValues>({
    label: initial?.label ?? 'Home',
    recipientName: initial?.recipientName ?? '',
    recipientPhone: initial?.recipientPhone ?? phone,
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    landmark: initial?.landmark ?? '',
    pincode: initial?.pincode ?? '522601',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function update<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
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
    await onSubmit({
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
    <form ref={formRef} style={styles.form} onSubmit={handleSubmit}>
      <h3 style={styles.title}>{mode === 'edit' ? 'Edit delivery address' : 'Add delivery address'}</h3>
      {localError || error ? <p style={styles.error}>{localError || error}</p> : null}

      <TextField
        label="Label"
        value={values.label}
        onChange={(e) => update('label', e.target.value)}
        placeholder="Home / Work"
      />
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
      <TextField
        label="Pincode"
        value={values.pincode}
        onChange={(e) => update('pincode', e.target.value)}
        placeholder="522601"
        inputMode="numeric"
      />

      <div style={styles.actions}>
        <Button type="submit" disabled={busy} fullWidth>
          {busy ? 'Saving…' : mode === 'edit' ? 'Update address' : 'Save address'}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel} fullWidth>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: 'grid',
    gap: '0.75rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    padding: '0.9rem',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  actions: {
    display: 'grid',
    gap: '0.55rem',
    marginTop: '0.35rem',
    paddingBottom: '0.25rem',
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600 },
};
