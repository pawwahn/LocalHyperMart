import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { fetchPaymentGateways } from '../api/shopApi';
import {
  gatewayDisplayName,
  gatewayLogoTileStyle,
  PaymentGatewayLogo,
} from './PaymentGatewayBrand';

export type GatewayOption = { id: string; label: string };

const C = {
  ink: '#101828',
  inkSoft: '#344054',
  inkMuted: '#667085',
  line: '#D0D5DD',
  lineStrong: '#98A2B3',
  brand: '#009111',
  brandSoft: '#E5F5E7',
  brandBorder: '#009111',
  surface: '#FFFFFF',
} as const;

export function gatewayOptionCopy(option: GatewayOption, recommended: boolean) {
  const title = gatewayDisplayName(option.id, option.label);
  return {
    title,
    subtitle: 'UPI · Credit & debit cards · Net banking',
    hint: recommended ? 'Usually faster checkout' : 'Same secure payment methods',
  };
}

function normalizeGatewayRows(rows: unknown): GatewayOption[] {
  return Array.isArray(rows) ? rows.filter((row) => row?.id && row?.label) : [];
}

export function usePaymentGateways(token?: string | null) {
  const [options, setOptions] = useState<GatewayOption[]>([]);
  const [gateway, setGateway] = useState('RAZORPAY');
  const [loading, setLoading] = useState(false);

  const refreshGateways = useCallback(async (): Promise<GatewayOption[]> => {
    if (!token) {
      setOptions([]);
      return [];
    }
    setLoading(true);
    try {
      const rows = await fetchPaymentGateways(token);
      const next = normalizeGatewayRows(rows);
      setOptions(next);
      setGateway((current) => (next.some((row) => row.id === current) ? current : next[0]?.id || 'RAZORPAY'));
      return next;
    } catch {
      setOptions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshGateways();
  }, [refreshGateways]);

  return { options, gateway, setGateway, loading, refreshGateways };
}

type ListProps = {
  value: string;
  options: GatewayOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
};

/** Grocery-style gateway rows — brand logos + names (shared by basket, Glam, Laundry). */
export function PaymentGatewayOptionList({ value, options, onChange, disabled }: ListProps) {
  if (options.length < 1) return null;

  return (
    <ul style={listStyles.list} role="radiogroup" aria-label="Online payment provider">
      {options.map((option, index) => {
        const on = option.id === value;
        const recommended = options.length > 1 && index === 0;
        const copy = gatewayOptionCopy(option, recommended);
        return (
          <li key={option.id}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${copy.title}. ${copy.subtitle}`}
              disabled={disabled}
              style={{
                ...listStyles.row,
                ...(on ? listStyles.rowOn : listStyles.rowOff),
                ...(disabled ? listStyles.rowDisabled : null),
              }}
              onClick={() => onChange(option.id)}
            >
              <span
                style={{
                  ...listStyles.logoTile,
                  ...gatewayLogoTileStyle(option.id, on),
                }}
                aria-hidden
              >
                <PaymentGatewayLogo gatewayId={option.id} size={38} />
              </span>
              <span style={listStyles.rowText}>
                <span style={listStyles.rowTitle}>
                  {copy.title}
                  {recommended ? <span style={listStyles.badge}>Recommended</span> : null}
                </span>
                <span style={listStyles.rowSub}>{copy.subtitle}</span>
                <span style={listStyles.rowHint}>{copy.hint}</span>
              </span>
              <span style={{ ...listStyles.radio, ...(on ? listStyles.radioOn : null) }} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function PaymentGatewayChoices({
  value,
  options,
  onChange,
  disabled,
}: ListProps) {
  if (options.length < 1) return null;
  return (
    <div style={wrapStyles.wrap}>
      <PaymentGatewayOptionList value={value} options={options} onChange={onChange} disabled={disabled} />
    </div>
  );
}

const wrapStyles: Record<string, CSSProperties> = {
  wrap: { marginTop: '0.55rem', minWidth: 0 },
};

const listStyles: Record<string, CSSProperties> = {
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' },
  row: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.72rem 0.78rem',
    borderRadius: 14,
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 'var(--touch-min, 48px)',
    color: C.ink,
  },
  rowOff: {
    border: `2px solid ${C.line}`,
    background: C.surface,
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
  },
  rowOn: {
    border: `2px solid ${C.brandBorder}`,
    background: C.brandSoft,
    boxShadow: '0 0 0 1px rgba(18, 183, 106, 0.25)',
  },
  rowDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  logoTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  rowText: { flex: 1, minWidth: 0, display: 'grid', gap: '0.12rem' },
  rowTitle: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.32rem',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: C.ink,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
  },
  badge: {
    fontSize: '0.58rem',
    fontWeight: 700,
    padding: '0.12rem 0.38rem',
    borderRadius: 999,
    background: '#D1FADF',
    color: '#027A48',
    border: `1px solid ${C.brandBorder}`,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  rowSub: { fontSize: '0.72rem', color: C.inkSoft, fontWeight: 500, lineHeight: 1.35 },
  rowHint: { fontSize: '0.66rem', color: C.inkMuted, fontWeight: 600, lineHeight: 1.3 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: `2px solid ${C.lineStrong}`,
    background: C.surface,
    flexShrink: 0,
  },
  radioOn: {
    borderColor: C.brand,
    background: C.brand,
    boxShadow: `inset 0 0 0 4px ${C.surface}`,
  },
};
