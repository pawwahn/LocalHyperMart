import type { CSSProperties } from 'react';

export const PAYOUT_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'] as const;

type Props = {
  payoutMethod: string;
  onPayoutMethodChange: (value: string) => void;
  transactionReference: string;
  onTransactionReferenceChange: (value: string) => void;
  transactionNotes: string;
  onTransactionNotesChange: (value: string) => void;
};

export function PayoutTxnFields({
  payoutMethod,
  onPayoutMethodChange,
  transactionReference,
  onTransactionReferenceChange,
  transactionNotes,
  onTransactionNotesChange,
}: Props) {
  const txnReady = transactionReference.trim().length > 0;
  return (
    <div className="ptf-grid" style={styles.grid}>
      <label style={styles.label} className="ptf-mode">
        <span style={styles.labelText}>Mode</span>
        <select
          className="ptf-input ptf-select"
          style={styles.input}
          value={payoutMethod}
          onChange={(e) => onPayoutMethodChange(e.target.value)}
        >
          {PAYOUT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label style={styles.label} className="ptf-ref">
        <span style={styles.labelText}>
          Txn ref <span style={styles.req} aria-hidden>*</span>
        </span>
        <input
          className={`ptf-input ptf-ref-input${txnReady ? ' ptf-ref-ok' : ''}`}
          style={styles.input}
          value={transactionReference}
          onChange={(e) => onTransactionReferenceChange(e.target.value)}
          placeholder="UTR / UPI / cheque number"
          required
          aria-required
        />
      </label>
      <label style={styles.label} className="ptf-notes">
        <span style={styles.labelText}>Notes</span>
        <input
          className="ptf-input"
          style={styles.input}
          value={transactionNotes}
          onChange={(e) => onTransactionNotesChange(e.target.value)}
          placeholder="Optional remark"
        />
      </label>
    </div>
  );
}

export const payoutTxnFieldsCss = `
.ptf-grid {
  display: grid;
  grid-template-columns: minmax(5.25rem, 0.34fr) minmax(8.5rem, 1fr) minmax(6.5rem, 0.52fr);
  gap: 0.35rem 0.4rem;
  align-items: end;
}
.ptf-input {
  width: 100%;
  padding: 0.44rem 0.52rem;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, #94a3b8);
  font-size: 0.82rem;
  font-family: inherit;
  min-width: 0;
  background: #fff;
  color: #0f172a;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.ptf-input:hover {
  border-color: color-mix(in srgb, var(--border) 45%, #64748b);
}
.ptf-input:focus {
  outline: none;
  border-color: #059669;
  box-shadow: 0 0 0 3px color-mix(in srgb, #059669 20%, transparent);
}
.ptf-ref-input {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.ptf-ref-ok {
  border-color: #86efac;
  background: linear-gradient(180deg, #fff 0%, #f0fdf4 100%);
}
.ptf-select {
  cursor: pointer;
  font-weight: 650;
}
@media (max-width: 720px) {
  .ptf-grid {
    grid-template-columns: 1fr 1fr;
  }
  .ptf-notes {
    grid-column: 1 / -1;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  grid: { width: '100%' },
  label: { display: 'grid', gap: '0.22rem', minWidth: 0 },
  labelText: { fontSize: '0.68rem', fontWeight: 750, color: '#475569', letterSpacing: '0.02em' },
  input: {},
  req: { color: '#dc2626', fontWeight: 900 },
};
