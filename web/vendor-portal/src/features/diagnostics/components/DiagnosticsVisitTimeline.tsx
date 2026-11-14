import { useMemo, useState, type CSSProperties } from 'react';
import {
  eventDisplayLabel,
  formatVisitEventWhen,
  VISIT_LOG_PHASE_LABEL,
  visitEventPhase,
  type VisitLogPhase,
} from '../lib/diagnosticsVisitEventLog';

type LogEvent = { eventType?: string; note?: string | null; createdAt?: string | null };

type Props = {
  events: LogEvent[];
  handoffName?: string | null;
  /** Collapse long logs by default (booking + visit noise). */
  denseDefault?: boolean;
};

function latestSummary(events: LogEvent[], handoffName: string | null): string {
  const last = events[events.length - 1];
  if (!last) return 'No activity yet';
  const label = eventDisplayLabel(last, handoffName);
  const when = formatVisitEventWhen(last.createdAt, true);
  return when ? `${label} · ${when}` : label;
}

type RenderItem = { kind: 'phase'; phase: VisitLogPhase } | { kind: 'event'; ev: LogEvent; index: number };

function buildRenderList(events: LogEvent[]): RenderItem[] {
  const items: RenderItem[] = [];
  let lastPhase: VisitLogPhase | null = null;
  events.forEach((ev, index) => {
    const phase = visitEventPhase(String(ev.eventType ?? ''));
    if (phase !== lastPhase) {
      items.push({ kind: 'phase', phase });
      lastPhase = phase;
    }
    items.push({ kind: 'event', ev, index });
  });
  return items;
}

export function DiagnosticsVisitTimeline({ events, handoffName = null, denseDefault }: Props) {
  const handoff = handoffName?.trim() || null;
  const defaultExpanded = denseDefault === undefined ? events.length <= 8 : !denseDefault;
  const [expanded, setExpanded] = useState(defaultExpanded);

  const summary = useMemo(() => latestSummary(events, handoff), [events, handoff]);
  const renderItems = useMemo(() => buildRenderList(events), [events]);
  const lastIndex = events.length - 1;

  if (!events.length) return null;

  return (
    <section style={styles.section} aria-label="Visit log">
      <button
        type="button"
        style={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={styles.toggleText}>
          <span style={styles.toggleTitle}>Visit log</span>
          {!expanded ? <span style={styles.toggleSummary}>{summary}</span> : null}
        </div>
        <span style={styles.chevron} aria-hidden>
          {expanded ? '▴' : '▾'}
        </span>
      </button>

      {expanded ? (
        <ol style={styles.list} className="hlm-row-stripe-list">
          {renderItems.map((item, i) => {
            if (item.kind === 'phase') {
              return (
                <li key={`phase-${item.phase}-${i}`} style={styles.phaseRow}>
                  <span style={styles.phasePill}>{VISIT_LOG_PHASE_LABEL[item.phase]}</span>
                </li>
              );
            }
            const { ev, index } = item;
            const isLast = index === lastIndex;
            const type = String(ev.eventType ?? '').toUpperCase();
            const label = eventDisplayLabel(ev, handoff);
            const when = formatVisitEventWhen(ev.createdAt, true);
            const isMilestone =
              type === 'SAMPLES_COLLECTED' || type === 'RECEIVED_AT_LAB' || type === 'FINALIZE' || type === 'COMPLETE';

            return (
              <li
                key={`${type}-${ev.createdAt ?? ''}-${index}`}
                style={{
                  ...styles.eventRow,
                  ...(isLast ? styles.eventRowLast : null),
                  ...(isMilestone ? styles.eventRowMilestone : null),
                }}
                className="hlm-row-stripe"
              >
                <div style={styles.rail} aria-hidden>
                  <span
                    style={{
                      ...styles.dot,
                      ...(isLast ? styles.dotCurrent : styles.dotDone),
                      ...(isMilestone ? styles.dotMilestone : null),
                    }}
                  />
                  {!isLast ? <span style={{ ...styles.line, ...styles.lineDone }} /> : null}
                </div>
                <div style={styles.body}>
                  <p style={{ ...styles.label, ...(isLast ? styles.labelCurrent : null) }}>{label}</p>
                  {when ? <time dateTime={ev.createdAt ?? undefined} style={styles.when}>
                    {when}
                  </time> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { margin: '0.2rem 0 0.12rem', display: 'grid', gap: '0.28rem' },
  toggle: {
    appearance: 'none',
    border: '1px solid #64748b',
    borderRadius: 10,
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 92%, #fff) 0%, var(--bg-elevated) 100%)',
    padding: '0.38rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.45rem',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 1px 0 color-mix(in srgb, var(--border) 35%, transparent)',
  },
  toggleText: { display: 'grid', gap: '0.08rem', minWidth: 0, flex: 1 },
  toggleTitle: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--text-muted)',
  },
  toggleSummary: {
    margin: 0,
    fontSize: '0.76rem',
    fontWeight: 650,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    lineHeight: 1,
    color: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent-soft) 85%, #fff)',
    border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '0.35rem 0.42rem 0.2rem',
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    background: 'color-mix(in srgb, var(--bg-muted) 28%, var(--bg-elevated) 72%)',
    display: 'grid',
    gap: 0,
  },
  phaseRow: {
    listStyle: 'none',
    padding: '0.28rem 0 0.12rem 1.55rem',
  },
  phasePill: {
    display: 'inline-block',
    fontSize: '0.58rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'color-mix(in srgb, var(--accent) 72%, var(--text-muted))',
    background: 'color-mix(in srgb, var(--accent-soft) 55%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 16%, var(--border))',
    borderRadius: 999,
    padding: '0.12rem 0.38rem',
  },
  eventRow: {
    display: 'grid',
    gridTemplateColumns: '1.15rem 1fr',
    gap: '0.55rem',
    alignItems: 'start',
    padding: '0.28rem 0.32rem',
    borderRadius: 8,
    minHeight: '2.1rem',
  },
  eventRowLast: {
    background: 'color-mix(in srgb, var(--accent-soft) 45%, transparent)',
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent)',
  },
  rail: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '0.22rem',
    minHeight: '100%',
  },
  dot: {
    width: '0.55rem',
    height: '0.55rem',
    borderRadius: '50%',
    border: '2px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
  },
  dotDone: {
    borderColor: 'color-mix(in srgb, var(--accent) 55%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 35%, var(--bg-elevated))',
  },
  dotCurrent: {
    borderColor: 'var(--accent)',
    background: 'var(--accent)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  dotMilestone: {
    width: '0.62rem',
    height: '0.62rem',
  },
  line: {
    width: '2px',
    flex: 1,
    minHeight: '0.55rem',
    marginTop: '0.15rem',
    background: 'color-mix(in srgb, var(--border) 70%, transparent)',
    borderRadius: 1,
  },
  lineDone: {
    background: 'color-mix(in srgb, var(--accent) 40%, var(--border))',
  },
  body: { minWidth: 0, paddingBottom: '0.08rem' },
  label: {
    margin: 0,
    fontSize: '0.76rem',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.25,
  },
  labelCurrent: {
    color: 'color-mix(in srgb, var(--accent-hover, var(--accent)) 88%, var(--text))',
  },
  when: {
    display: 'block',
    margin: '0.1rem 0 0',
    fontSize: '0.66rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
};
