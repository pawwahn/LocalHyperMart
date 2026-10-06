import type { CSSProperties } from 'react';
import { buildMoneyTransferPlan, type BuyerMoneyHeld } from './vendorMoneyFlow';

type Props = {
  held: BuyerMoneyHeld;
  gross: number;
  fees: number;
  netToVendor: number;
  collectFromVendor?: boolean;
  title?: string;
  footnote?: string | null;
  /** Vendor awaiting list has no fee quote — show custody only. */
  showSettleSteps?: boolean;
  style?: CSSProperties;
};

export function MoneyFlowSummary({
  held,
  gross,
  fees,
  netToVendor,
  collectFromVendor = false,
  title = 'Money map',
  footnote = null,
  showSettleSteps = true,
  style,
}: Props) {
  const { heldLines, steps } = buildMoneyTransferPlan({
    held,
    gross,
    fees,
    netToVendor,
    collectFromVendor,
  });

  if (heldLines.length === 0 && steps.length === 0) return null;

  return (
    <div style={{ ...box, ...style }}>
      <div style={headRow}>
        <strong style={titleStyle}>{title}</strong>
        <span style={muted}>Who holds buyer cash → who pays whom</span>
      </div>

      {heldLines.length > 0 ? (
        <div style={section}>
          <span style={sectionLabel}>Held now</span>
          {heldLines.map((line) => (
            <div key={line.label} style={row}>
              <span style={rowLeft}>
                {line.label}
                {line.hint ? <span style={hint}> · {line.hint}</span> : null}
              </span>
              <strong>{money(line.amount)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {showSettleSteps && steps.length > 0 ? (
        <div style={section}>
          <span style={sectionLabel}>{collectFromVendor ? 'Collect' : 'Settle'}</span>
          {steps.map((step, i) => (
            <div key={`${step.from}-${step.to}-${i}`} style={stepRow}>
              <span style={stepArrow}>
                <strong>{step.from}</strong>
                <span style={arrow}> → </span>
                <strong>{step.to}</strong>
                <span style={hint}> · {step.detail}</span>
              </span>
              <strong>{money(step.amount)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {footnote ? <p style={note}>{footnote}</p> : null}
    </div>
  );
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

const box: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
  padding: '0.55rem 0.65rem',
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border, #e2e8f0)',
  background: 'color-mix(in srgb, var(--bg-elevated, #fff) 92%, var(--accent-soft, #ecfdf5))',
  fontSize: '0.78rem',
  lineHeight: 1.35,
};

const headRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.35rem 0.65rem',
};

const titleStyle: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 800,
};

const muted: CSSProperties = {
  color: 'var(--text-muted, #64748b)',
  fontWeight: 600,
  fontSize: '0.72rem',
};

const section: CSSProperties = {
  display: 'grid',
  gap: '0.2rem',
};

const sectionLabel: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted, #64748b)',
};

const row: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.5rem',
  alignItems: 'flex-start',
};

const rowLeft: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const stepRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.5rem',
  alignItems: 'flex-start',
};

const stepArrow: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const arrow: CSSProperties = {
  color: 'var(--accent, #059669)',
  fontWeight: 800,
};

const hint: CSSProperties = {
  color: 'var(--text-muted, #64748b)',
  fontWeight: 600,
};

const note: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted, #64748b)',
  fontSize: '0.72rem',
  fontWeight: 600,
};
