import type { CSSProperties } from 'react';

import { Button } from '@/shared/ui';

import type { CodCustodianOutstanding } from '../api/codHandoverApi';

import { codMoney, formatIsoDateRange } from '../lib/codFormat';



type Props = {

  data: CodCustodianOutstanding | null;

  loading?: boolean;

  error?: string | null;

  onRetry?: () => void;

};



export function CodOutstandingSummary({ data, loading, error, onRetry }: Props) {

  if (loading) {

    return (

      <span style={styles.chip} role="status" aria-busy="true">

        <span style={styles.dot} aria-hidden />

        All dates

      </span>

    );

  }

  if (error) {

    return (

      <span style={{ ...styles.chip, ...styles.chipError }} role="alert">

        All dates — {error}

        {onRetry ? (

          <Button type="button" variant="ghost" onClick={onRetry} style={styles.retryBtn}>

            Retry

          </Button>

        ) : null}

      </span>

    );

  }

  if (!data) return null;



  const collectTotal = Number(data.totalStillWithAgents ?? 0);

  const declaredTotal = Number(data.totalDeclaredAwaitingConfirm ?? 0);

  const anyPending = collectTotal > 0 || declaredTotal > 0;



  return (

    <span

      style={{ ...styles.chip, ...(anyPending ? styles.chipActive : null) }}

      title={`${formatIsoDateRange(data.lookbackFrom, data.lookbackTo)} (IST)`}

    >

      <span style={styles.chipLabel}>All dates</span>

      {anyPending ? (

        <>

          <span style={styles.chipMetric}>

            Collect <strong>{codMoney(collectTotal, true)}</strong>

          </span>

          <span style={styles.chipSep} aria-hidden>

            ·

          </span>

          <span style={styles.chipMetric}>

            Declared <strong>{codMoney(declaredTotal, true)}</strong>

          </span>

        </>

      ) : (

        <span style={styles.chipMuted}>Clear</span>

      )}

    </span>

  );

}



const styles: Record<string, CSSProperties> = {

  chip: {

    display: 'inline-flex',

    flexWrap: 'wrap',

    alignItems: 'center',

    gap: '0.35rem 0.45rem',

    padding: '0.28rem 0.55rem',

    borderRadius: 'var(--radius-full)',

    border: '1px solid var(--border)',

    background: 'var(--bg-elevated)',

    fontSize: '0.72rem',

    fontWeight: 650,

    lineHeight: 1.2,

    boxShadow: 'var(--shadow-card)',

  },

  chipActive: {

    borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',

    background: 'color-mix(in srgb, var(--accent-soft) 55%, var(--bg-elevated))',

  },

  chipError: {

    borderColor: 'color-mix(in srgb, var(--danger) 40%, var(--border))',

    color: 'var(--danger)',

  },

  chipLabel: {

    fontWeight: 800,

    textTransform: 'uppercase',

    letterSpacing: '0.04em',

    fontSize: '0.62rem',

    color: 'var(--text-muted)',

  },

  chipMetric: { color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },

  chipSep: { color: 'var(--text-muted)', opacity: 0.6 },

  chipMuted: { color: 'var(--text-muted)', fontWeight: 600 },

  dot: {

    width: 6,

    height: 6,

    borderRadius: '50%',

    background: 'var(--accent)',

    opacity: 0.85,

  },

  retryBtn: { padding: '0 0.35rem', minHeight: 'unset', fontSize: '0.72rem' },

};


