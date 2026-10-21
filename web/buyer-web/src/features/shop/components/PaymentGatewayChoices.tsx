import { useEffect, useState, type CSSProperties } from 'react';
import { fetchPaymentGateways } from '../api/shopApi';

export type GatewayOption = { id: string; label: string };

export function usePaymentGateways(token?: string | null) {
  const [options, setOptions] = useState<GatewayOption[]>([]);
  const [gateway, setGateway] = useState('RAZORPAY');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchPaymentGateways(token)
      .then((rows) => {
        if (cancelled) return;
        const next = Array.isArray(rows) ? rows.filter((row) => row?.id && row?.label) : [];
        setOptions(next);
        setGateway((current) => (next.some((row) => row.id === current) ? current : next[0]?.id || 'RAZORPAY'));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { options, gateway, setGateway };
}

export function PaymentGatewayChoices({
  value,
  options,
  onChange,
}: {
  value: string;
  options: GatewayOption[];
  onChange: (id: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div style={styles.row} role="radiogroup" aria-label="Online payment provider">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            style={{ ...styles.chip, ...(on ? styles.chipOn : null) }}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', gap: '0.35rem', marginTop: '0.35rem' },
  chip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  chipOn: {
    border: '1.5px solid #0C831F',
    background: '#F3FBF5',
    color: '#0C831F',
  },
};
