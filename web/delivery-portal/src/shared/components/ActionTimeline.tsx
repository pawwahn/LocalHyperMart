import type { CSSProperties } from 'react';
import {
  actionEventLabel,
  formatPortalTime,
  type ActionEventView,
} from '@/shared/time/formatPortalTime';

type Props = {
  events?: ActionEventView[] | null;
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  compact?: boolean;
};

/** Shared action-time list for hub desk and delivery agent. */
export function ActionTimeline({
  events,
  assignedAt,
  startedAt,
  completedAt,
  compact = false,
}: Props) {
  const rows =
    events && events.length > 0
      ? events.map((e) => ({
          key: `${e.eventType}-${e.createdAt}`,
          label: actionEventLabel(e.eventType),
          at: e.createdAt,
        }))
      : fallbackRows(assignedAt, startedAt, completedAt);

  if (rows.length === 0) return null;

  return (
    <ul style={compact ? styles.listCompact : styles.list} aria-label="Action times">
      {rows.map((row) => (
        <li key={row.key} style={styles.item}>
          <span style={styles.label}>{row.label}</span>
          <time style={styles.time} dateTime={row.at}>
            {formatPortalTime(row.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function fallbackRows(
  assignedAt?: string | null,
  startedAt?: string | null,
  completedAt?: string | null,
): Array<{ key: string; label: string; at: string }> {
  const rows: Array<{ key: string; label: string; at: string }> = [];
  if (assignedAt) rows.push({ key: 'assigned', label: 'Assigned', at: assignedAt });
  if (startedAt) rows.push({ key: 'started', label: 'Boy started', at: startedAt });
  if (completedAt) rows.push({ key: 'completed', label: 'Finished', at: completedAt });
  return rows;
}

const styles: Record<string, CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: '0.55rem 0 0',
    padding: '0.55rem 0.65rem',
    display: 'grid',
    gap: '0.35rem',
    background: 'var(--bg-muted)',
    borderRadius: 10,
    border: '1px solid var(--border)',
  },
  listCompact: {
    listStyle: 'none',
    margin: '0.4rem 0 0',
    padding: 0,
    display: 'grid',
    gap: '0.25rem',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  label: { fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' },
  time: { fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent)', whiteSpace: 'nowrap' },
};
