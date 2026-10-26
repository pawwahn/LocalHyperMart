import type { CSSProperties } from 'react';
import { PickerDateField } from '@hlm-dates';

const field: CSSProperties = {
  display: 'grid',
  gap: '0.15rem',
  fontSize: '0.68rem',
  fontWeight: 800,
  color: 'var(--text-muted)',
};

const input: CSSProperties = {
  minHeight: 36,
  padding: '0.35rem 0.45rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  font: 'inherit',
  fontSize: '0.82rem',
  fontWeight: 650,
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: string;
};

/** Bank statement date (IST) — required when admin confirms payment received. */
export function BankPaidOnField({ value, onChange, max }: Props) {
  return (
    <label style={field}>
      Bank statement date
      <PickerDateField value={value} max={max} required onChange={onChange} style={input} />
    </label>
  );
}
