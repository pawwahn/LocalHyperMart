import type { CSSProperties } from 'react';

export function normalizeGatewayId(id: string): string {
  return id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function gatewayDisplayName(id: string, label?: string): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  const key = normalizeGatewayId(id);
  if (key === 'RAZORPAY') return 'Razorpay';
  if (key === 'CASHFREE') return 'Cashfree';
  if (key === 'PHONEPE') return 'PhonePe';
  return id;
}

type LogoProps = {
  gatewayId: string;
  /** Tile size in px (width & height of the logo box content). */
  size?: number;
};

const RAZORPAY_BLUE = '#072654';
const CASHFREE_VIOLET = '#6B3CF0';

/** Brand mark for checkout rows (Razorpay / Cashfree / fallback). */
export function PaymentGatewayLogo({ gatewayId, size = 36 }: LogoProps) {
  const key = normalizeGatewayId(gatewayId);
  const wrap: CSSProperties = {
    width: size,
    height: size,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  };

  if (key === 'RAZORPAY') {
    return (
      <span style={wrap} aria-hidden>
        <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} role="img" aria-label="Razorpay">
          <path
            fill={RAZORPAY_BLUE}
            d="M22.436 0 10.526 7.773 9.352 12.05l6.333-4.133-5.964 9.083v4.633l2.303 3.583L16.384 24h5.052L22.436 0zM14.19 12.127 5.016 24H.562l7.245-11.873 6.383-.001z"
          />
        </svg>
      </span>
    );
  }

  if (key === 'CASHFREE') {
    return (
      <span style={wrap} aria-hidden>
        <svg viewBox="0 0 40 40" width={size * 0.82} height={size * 0.82} role="img" aria-label="Cashfree">
          <rect width="40" height="40" rx="11" fill={CASHFREE_VIOLET} />
          <path
            fill="#fff"
            d="M11 14.2h7.2c2.1 0 3.5 1.2 3.5 3 0 1.2-.7 2.2-1.8 2.7 1.4.5 2.3 1.7 2.3 3.2 0 2.2-1.8 3.6-4.6 3.6H11V14.2zm3.1 2.8v3.4h3.5c1 0 1.6-.5 1.6-1.3 0-.8-.6-1.3-1.6-1.3h-3.5zm0 6.1v3.7h4.1c1.2 0 1.9-.6 1.9-1.6 0-1-.7-1.6-1.9-1.6h-4.1zM27.2 14.2h3v11.7h-3V14.2z"
          />
        </svg>
      </span>
    );
  }

  if (key === 'PHONEPE') {
    return (
      <span style={wrap} aria-hidden>
        <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} role="img" aria-label="PhonePe">
          <circle cx="12" cy="12" r="10" fill="#5F259F" />
          <path
            fill="#fff"
            d="M8.2 12.4h7.6v1.4H8.2v-1.4zm0-2.4h7.6V11H8.2V10zm3.8-3.2 4.2 7.2h-2.3l-.9-1.6H9.9l-.9 1.6H6.7l4.3-7.2z"
          />
        </svg>
      </span>
    );
  }

  const initial = gatewayDisplayName(gatewayId).charAt(0).toUpperCase();
  return (
    <span
      style={{
        ...wrap,
        borderRadius: 10,
        background: '#F2F4F7',
        color: '#344054',
        fontWeight: 800,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function gatewayLogoTileStyle(gatewayId: string, selected: boolean): CSSProperties {
  const key = normalizeGatewayId(gatewayId);
  if (key === 'RAZORPAY') {
    return {
      background: selected ? '#E8EEF9' : '#F4F7FD',
      border: `1px solid ${selected ? '#9EB0D4' : '#D5DFF0'}`,
    };
  }
  if (key === 'CASHFREE') {
    return {
      background: selected ? '#EDE8FE' : '#F7F4FF',
      border: `1px solid ${selected ? '#C4B5FD' : '#E4D9FD'}`,
    };
  }
  if (key === 'PHONEPE') {
    return {
      background: selected ? '#F0E8F8' : '#F8F4FC',
      border: `1px solid ${selected ? '#C4A8E0' : '#E8DCF4'}`,
    };
  }
  return {
    background: selected ? '#F2F4F7' : '#F9FAFB',
    border: `1px solid ${selected ? '#98A2B3' : '#D0D5DD'}`,
  };
}
