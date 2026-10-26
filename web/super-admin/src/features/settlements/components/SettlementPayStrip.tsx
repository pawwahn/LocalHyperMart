import type { CSSProperties, ReactNode } from 'react';

export type SettlementPayStripTone = 'pay-out' | 'collect';

type Props = {
  tone?: SettlementPayStripTone;
  amountLabel: string;
  amount: ReactNode;
  amountMeta?: ReactNode;
  txnFields?: ReactNode;
  action: ReactNode;
  hint?: ReactNode;
};

export function SettlementPayStrip({
  tone = 'pay-out',
  amountLabel,
  amount,
  amountMeta,
  txnFields,
  action,
  hint,
}: Props) {
  const toneClass = tone === 'collect' ? 'sps-tone-collect' : 'sps-tone-payout';
  return (
    <div className={`sps-root ${toneClass}`} style={styles.root}>
      <div className="sps-hero" style={styles.hero}>
        <span style={styles.heroLabel}>{amountLabel}</span>
        <strong className="sps-hero-amount" style={styles.heroAmount}>
          {amount}
        </strong>
        {amountMeta ? <span style={styles.heroMeta}>{amountMeta}</span> : null}
      </div>
      <div className="sps-pay" style={styles.pay}>
        <div style={styles.payHead}>
          <span style={styles.payTitle}>Payment details</span>
          <span style={styles.paySub}>UTR / reference required</span>
        </div>
        {txnFields}
        <div className="sps-action" style={styles.actionRow}>
          <div className="sps-action-btn">{action}</div>
          {hint ? <p className="sps-hint" style={styles.hint}>{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

type ScopeHeaderProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

/** Title + short description + optional control (e.g. Refresh). */
export function SettlementScopeHeader({ title, description, action }: ScopeHeaderProps) {
  return (
    <div style={headerStyles.row}>
      <div style={headerStyles.text}>
        <p style={headerStyles.title}>{title}</p>
        <p style={headerStyles.muted}>{description}</p>
      </div>
      {action ? <div style={headerStyles.action}>{action}</div> : null}
    </div>
  );
}

export const settlementPayStripCss = `
.sps-root {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12.75rem), 1fr));
  gap: 0.55rem;
  align-items: stretch;
}
.sps-hero {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.18rem;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  min-height: 100%;
}
.sps-tone-payout .sps-hero {
  background: linear-gradient(145deg, #fff 0%, #ecfdf5 100%);
  border: 1px solid #bbf7d0;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.85) inset, 0 2px 8px rgba(5, 150, 105, 0.06);
}
.sps-tone-collect .sps-hero {
  background: linear-gradient(145deg, #fff 0%, #ffedd5 100%);
  border: 1px solid #fed7aa;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.06);
}
.sps-hero-amount {
  letter-spacing: -0.02em;
}
.sps-pay {
  display: grid;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}
.sps-tone-payout .sps-pay {
  border-color: color-mix(in srgb, #a7f3d0 50%, var(--border));
}
.sps-tone-collect .sps-pay {
  border-color: color-mix(in srgb, #fed7aa 55%, var(--border));
}
.sps-pay .ptf-grid {
  grid-template-columns: minmax(4.75rem, 0.32fr) minmax(0, 1fr);
  grid-template-areas:
    "ptf-mode ptf-notes"
    "ptf-ref ptf-ref";
  gap: 0.4rem 0.45rem;
  align-items: end;
}
.sps-pay .ptf-mode { grid-area: ptf-mode; }
.sps-pay .ptf-ref { grid-area: ptf-ref; }
.sps-pay .ptf-notes {
  grid-area: ptf-notes;
  grid-column: auto;
}
.sps-action {
  display: grid;
  gap: 0.4rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.sps-action-btn button {
  min-height: 2.35rem;
  padding-left: 1rem;
  padding-right: 1rem;
  font-weight: 800;
}
@media (max-width: 480px) {
  .sps-hero {
    justify-items: center;
    text-align: center;
  }
  .sps-pay .ptf-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "ptf-mode"
      "ptf-ref"
      "ptf-notes";
  }
  .sps-action-btn,
  .sps-action-btn button {
    width: 100%;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  root: { width: '100%', marginTop: '0.1rem' },
  hero: {},
  heroLabel: {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  heroAmount: {
    fontSize: '1.65rem',
    fontWeight: 900,
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums',
    color: '#0f172a',
  },
  heroMeta: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  pay: {},
  payHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.2rem 0.5rem',
    paddingBottom: '0.05rem',
  },
  payTitle: { fontSize: '0.76rem', fontWeight: 800, color: '#1e293b' },
  paySub: { fontSize: '0.65rem', fontWeight: 650, color: '#94a3b8' },
  actionRow: {},
  hint: {
    margin: 0,
    padding: '0.38rem 0.5rem',
    borderRadius: 8,
    background: 'linear-gradient(180deg, #fff5f5 0%, #fef2f2 100%)',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.72rem',
    fontWeight: 650,
    lineHeight: 1.4,
    maxWidth: '100%',
  },
};

const headerStyles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.45rem 0.65rem',
  },
  text: { flex: '1 1 14rem', display: 'grid', gap: '0.22rem', minWidth: 0 },
  title: { margin: 0, fontWeight: 900, fontSize: '0.95rem', color: '#0f172a', letterSpacing: '-0.01em' },
  muted: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  action: { flex: '0 0 auto', alignSelf: 'flex-start' },
};
