import type { CSSProperties } from 'react';
import { PickerDateField } from '@hlm-dates';

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: string;
};

/** Hub COD / settlement dates — picker only, no typing. */
export function HubDateInput({ value, onChange, max }: Props) {
  return (
    <PickerDateField
      value={value}
      max={max}
      onChange={onChange}
      style={styles.input}
    />
  );
}

const styles: Record<string, CSSProperties> = {
  input: {
    minWidth: '13.25rem',
    padding: '0.4rem 2.15rem 0.4rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    minHeight: 40,
    background: 'var(--bg)',
  },
};
