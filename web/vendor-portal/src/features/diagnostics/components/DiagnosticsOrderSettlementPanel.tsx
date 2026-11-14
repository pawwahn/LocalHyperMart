import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { DiagnosticsVendorOrder } from '../api/diagnosticsApi';
import {
  diagnosticsLabGmv,
  estimateDiagnosticsCommission,
  isDiagnosticsOnlinePayment,
  type DiagnosticsBillingTerms,
} from '../lib/diagnosticsVendorFees';
import { money } from './DiagnosticsDispatchOrderCards';

type Props = {
  order: DiagnosticsVendorOrder;
  billing?: DiagnosticsBillingTerms | null;
  /** Samples at lab — same clock as payout. */
  payoutEligible: boolean;
};

export function DiagnosticsOrderSettlementPanel({ order, billing, payoutEligible }: Props) {
  const gmv = diagnosticsLabGmv(order);
  const commission = estimateDiagnosticsCommission(billing, order);
  const platform = Number(order.platformFeeAmount || 0);
  const cod = Number(order.codFee || 0);
  const online = isDiagnosticsOnlinePayment(order);
  const billToKk = Math.round((commission + (online ? 0 : platform + cod)) * 100) / 100;
  const kkPays = Math.round((gmv - commission) * 100) / 100;

  if (gmv <= 0 && commission <= 0) return null;

  return (
    <div style={styles.wrap} aria-label="Settlement breakdown">
      <div style={styles.head}>
        <span style={styles.headTitle}>Your money on this booking</span>
        <Link to="/payouts" style={styles.payoutsLink}>
          Payouts →
        </Link>
      </div>
      <table style={styles.table}>
        <tbody>
          <tr>
            <td style={styles.label}>Lab GMV (tests + home collection)</td>
            <td style={styles.value}>{money(gmv)}</td>
          </tr>
          {commission > 0 ? (
            <tr>
              <td style={styles.label}>− KoyaKart commission</td>
              <td style={{ ...styles.value, color: 'var(--danger, #dc2626)' }}>− {money(commission)}</td>
            </tr>
          ) : null}
          {online ? (
            <>
              {platform > 0 ? (
                <tr>
                  <td style={styles.labelMuted}>Buyer platform fee (with KoyaKart)</td>
                  <td style={styles.valueMuted}>{money(platform)}</td>
                </tr>
              ) : null}
              <tr style={styles.totalRow}>
                <td style={styles.totalLabel}>KoyaKart pays you (est.)</td>
                <td style={styles.totalValue}>{money(Math.max(0, kkPays))}</td>
              </tr>
            </>
          ) : (
            <>
              {!online && platform > 0 ? (
                <tr>
                  <td style={styles.label}>+ Platform fee (remit)</td>
                  <td style={styles.value}>{money(platform)}</td>
                </tr>
              ) : null}
              {!online && cod > 0 ? (
                <tr>
                  <td style={styles.label}>+ COD charge (remit)</td>
                  <td style={styles.value}>{money(cod)}</td>
                </tr>
              ) : null}
              <tr style={styles.totalRow}>
                <td style={styles.totalLabel}>Bill to KoyaKart (est.)</td>
                <td style={{ ...styles.totalValue, color: 'var(--danger, #dc2626)' }}>{money(billToKk)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      <p style={styles.note}>
        {payoutEligible
          ? online
            ? 'Commission is cut from your payout — same as grocery online bags. Full buyer receipt may include platform fee.'
            : 'You held COD cash — pay KoyaKart commission + app fees on Payouts.'
          : 'Clock starts when samples are received at the lab bench (not when the report is finalized).'}
      </p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    margin: '0.35rem 0 0.2rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, var(--border) 80%, #0f766e)',
    background: 'color-mix(in srgb, var(--bg-elevated) 92%, #ecfdf5)',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.35rem',
  },
  headTitle: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  payoutsLink: {
    fontSize: '0.68rem',
    fontWeight: 750,
    color: 'var(--accent)',
    textDecoration: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.72rem',
  },
  label: { padding: '0.12rem 0', color: 'var(--text)', fontWeight: 600 },
  labelMuted: { padding: '0.12rem 0', color: 'var(--text-muted)', fontWeight: 600 },
  value: {
    padding: '0.12rem 0',
    textAlign: 'right',
    fontWeight: 750,
    fontVariantNumeric: 'tabular-nums',
  },
  valueMuted: {
    padding: '0.12rem 0',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  totalRow: {
    borderTop: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
  },
  totalLabel: { padding: '0.22rem 0 0', fontWeight: 800, color: 'var(--text)' },
  totalValue: {
    padding: '0.22rem 0 0',
    textAlign: 'right',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    color: 'color-mix(in srgb, var(--success) 75%, #000)',
  },
  note: {
    margin: '0.35rem 0 0',
    fontSize: '0.64rem',
    lineHeight: 1.35,
    color: 'var(--text-muted)',
  },
};
