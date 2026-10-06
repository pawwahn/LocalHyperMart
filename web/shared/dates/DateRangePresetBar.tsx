import type { CSSProperties, ReactNode } from 'react';

import {
  REPORT_DATE_PRESET_OPTIONS,
  applyReportDatePreset,
  type ReportDatePreset,
  type TransferHistoryPreset,
} from './istReportPresets';

export type DateRangePresetBarProps<P extends TransferHistoryPreset = ReportDatePreset> = {
  preset: P;
  from: string;
  to: string;
  onPresetChange: (preset: P) => void;
  onFromChange: (iso: string) => void;
  onToChange: (iso: string) => void;
  /** Defaults to standard KoyaKart report presets. */
  options?: { id: P; label: string }[];
  showDateInputs?: boolean;
  /** Show From/To even when a named preset is selected (hub/admin term pickers). */
  alwaysShowDateInputs?: boolean;
  toDisabled?: boolean;
  /** Stack date inputs on narrow layouts. */
  stackDateInputs?: boolean;
  maxDate?: string;
  ariaLabel?: string;
  trailing?: ReactNode;
  /** Tighter chips / date fields for toolbars. */
  dense?: boolean;
};

export function DateRangePresetBar<P extends TransferHistoryPreset = ReportDatePreset>({
  preset,
  from,
  to,
  onPresetChange,
  onFromChange,
  onToChange,
  options,
  showDateInputs = true,
  alwaysShowDateInputs = false,
  toDisabled = false,
  stackDateInputs = false,
  maxDate,
  ariaLabel = 'Date range',
  trailing,
  dense = false,
}: DateRangePresetBarProps<P>) {
  const pills = options ?? (REPORT_DATE_PRESET_OPTIONS as { id: P; label: string }[]);
  const chip = dense ? (presetId: P) => (preset === presetId ? styles.chipOnDense : styles.chipDense) : (presetId: P) =>
    preset === presetId ? styles.chipOn : styles.chip;

  function pick(next: P) {
    if (next === 'all') {
      onPresetChange(next);
      onFromChange('');
      onToChange('');
      return;
    }
    applyReportDatePreset(next, onPresetChange as (p: ReportDatePreset) => void, onFromChange, onToChange);
  }

  const showDates = showDateInputs && (alwaysShowDateInputs || preset === 'custom');
  const wrapStyle = dense ? styles.wrapDense : styles.wrap;
  const pillsStyle = dense ? styles.pillsScroll : styles.pills;

  return (
    <div style={wrapStyle}>
      <div style={pillsStyle} role="group" aria-label={ariaLabel}>
        {pills.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            style={chip(id)}
            aria-pressed={preset === id}
            onClick={() => pick(id)}
          >
            {label}
          </button>
        ))}
        {trailing}
      </div>
      {showDates ? (
        <div style={dense ? styles.dateRowDense : stackDateInputs ? styles.dateStack : styles.dateRow}>
          <label style={dense ? styles.dateLabelDense : styles.dateLabel}>
            From
            <input
              type="date"
              value={from}
              max={to || maxDate}
              onChange={(e) => {
                onPresetChange('custom' as P);
                onFromChange(e.target.value);
              }}
              style={dense ? styles.dateInputDense : styles.dateInput}
            />
          </label>
          <label style={dense ? styles.dateLabelDense : styles.dateLabel}>
            To
            <input
              type="date"
              value={to}
              min={from}
              max={maxDate}
              disabled={toDisabled}
              onChange={(e) => {
                onPresetChange('custom' as P);
                onToChange(e.target.value);
              }}
              style={dense ? styles.dateInputDense : styles.dateInput}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.45rem', width: '100%', minWidth: 0 },
  wrapDense: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    width: '100%',
    minWidth: 0,
  },
  pills: { display: 'flex', flexWrap: 'wrap', gap: '0.32rem', alignItems: 'center' },
  pillsScroll: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: '0.28rem',
    alignItems: 'center',
    overflowX: 'auto',
    minWidth: 0,
    flex: '1 1 12rem',
    paddingBottom: 2,
    scrollbarWidth: 'thin',
  },
  chip: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.38rem 0.72rem',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    fontWeight: 650,
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.25,
  },
  chipOn: {
    border: '1.5px solid var(--accent)',
    borderRadius: 999,
    padding: '0.38rem 0.72rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.25,
    boxShadow: '0 1px 3px color-mix(in srgb, var(--accent) 18%, transparent)',
  },
  chipDense: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.22rem 0.55rem',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.25,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  chipOnDense: {
    border: '1.5px solid var(--accent)',
    borderRadius: 999,
    padding: '0.22rem 0.55rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.25,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  dateRowDense: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: '0.35rem',
    alignItems: 'end',
    flex: '0 0 auto',
  },
  dateStack: { display: 'grid', gap: '0.45rem', width: '100%' },
  dateLabel: {
    display: 'grid',
    gap: '0.22rem',
    fontWeight: 700,
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    minWidth: 'min(100%, 11rem)',
    flex: '1 1 10rem',
  },
  dateLabelDense: {
    display: 'grid',
    gap: '0.1rem',
    fontWeight: 700,
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    minWidth: '8.5rem',
    flex: '0 0 auto',
  },
  dateInput: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.45rem 0.55rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    width: '100%',
    minHeight: 'var(--touch-min, 44px)',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  dateInputDense: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.28rem 0.4rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    width: '100%',
    minHeight: '1.9rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
};
