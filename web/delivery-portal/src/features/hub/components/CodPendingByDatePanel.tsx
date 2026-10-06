import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Button, Card } from '@/shared/ui';
import { CallPhoneLink } from '@/shared/ui/CallPhoneLink';

import { confirmCodHandover, type CodCustodianPendingDetail } from '../api/codApi';
import { codMoney, formatDeliveredIst, formatIsoDateRange } from '../lib/codFormat';

const PIN_PATTERN = /^\d{4,6}$/;

type Props = {
  data: CodCustodianPendingDetail | null;
  loading?: boolean;
  custodianLabel: string;
  /** When set, only this IST day (YYYY-MM-DD) is shown. */
  filterDate?: string | null;
  onAfterConfirm?: () => void;
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
};

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

function formatDayHeading(dateKey: string): string {
  if (dateKey === 'unknown') return 'Delivery date unknown';
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type Row = {
  key: string;
  handoverId?: string;
  handoverDeclaredAmount?: number;
  agentName: string;
  agentPhone?: string | null;
  orderNumber: string;
  amount: number;
  status: 'With agent' | 'Declared';
  deliveredAt?: string | null;
};

export function CodPendingByDatePanel({
  data,
  loading,
  custodianLabel,
  filterDate,
  onAfterConfirm,
  onNotice,
  onError,
}: Props) {
  const { session } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pinNeedsAttention, setPinNeedsAttention] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => {
    if (!data?.days) return [];
    if (!filterDate) return data.days;
    return data.days.filter((d) => d.date === filterDate);
  }, [data, filterDate]);

  const dayBucket = filterDate && days.length === 1 ? days[0] : null;

  const handoverById = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of days) {
      for (const agent of day.agents) {
        for (const h of agent.declaredAwaiting) {
          map.set(h.handoverId, Number(h.declaredAmount ?? 0));
        }
      }
    }
    return map;
  }, [days]);

  const hasAny = useMemo(() => {
    if (dayBucket) {
      return (
        (dayBucket.stillWithAgentsOrderCount ?? 0) + (dayBucket.declaredAwaitingOrderCount ?? 0) > 0
      );
    }
    return (data?.ordersStillWithAgents ?? 0) > 0 || (data?.handoversAwaitingConfirm ?? 0) > 0;
  }, [data, dayBucket]);

  const confirmDeclared = useCallback(
    async (handoverIds: string[]) => {
      if (!session) return;
      const pin = confirmPin.trim();
      if (!PIN_PATTERN.test(pin)) {
        setPinNeedsAttention(true);
        pinInputRef.current?.focus();
        onError?.('Enter your hub PIN (4–6 digits) in the field above, then tap I received again.');
        return;
      }
      setPinNeedsAttention(false);
      const unique = [...new Set(handoverIds.filter(Boolean))];
      if (unique.length === 0) return;

      setConfirmBusy(true);
      try {
        let lastMatched = true;
        for (const handoverId of unique) {
          const received = handoverById.get(handoverId);
          if (received == null) continue;
          const result = await confirmCodHandover(session.accessToken, {
            handoverId,
            receivedAmount: received,
            pin,
          });
          lastMatched = result.status === 'MATCHED';
        }
        setSelected(new Set());
        onNotice?.(
          unique.length === 1
            ? lastMatched
              ? 'Confirmed — cash received at hub.'
              : 'Recorded with amount discrepancy — check close-day details.'
            : `Confirmed ${unique.length} handover${unique.length === 1 ? '' : 's'}.`,
        );
        onAfterConfirm?.();
      } catch (err) {
        onError?.(err instanceof ApiError || err instanceof Error ? err.message : 'Confirm failed');
      } finally {
        setConfirmBusy(false);
      }
    },
    [session, confirmPin, handoverById, onAfterConfirm, onNotice, onError],
  );

  if (loading) {
    return (
      <Card style={styles.card}>
        <p style={styles.title}>Hub agent COD</p>
        <p style={styles.muted}>Loading pending COD…</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card style={styles.card}>
        <p style={styles.title}>Hub agent COD</p>
        <p style={styles.muted}>Could not load pending COD. Use refresh or check the error above.</p>
      </Card>
    );
  }

  const stillTotal = dayBucket
    ? Number(dayBucket.stillWithAgentsAmount ?? 0)
    : Number(data.totalStillWithAgents ?? 0);
  const stillCount = dayBucket ? dayBucket.stillWithAgentsOrderCount : data.ordersStillWithAgents;
  const declaredTotal = dayBucket
    ? Number(dayBucket.declaredAwaitingAmount ?? 0)
    : Number(data.totalDeclaredAwaitingConfirm ?? 0);
  const declaredCount = dayBucket ? dayBucket.declaredAwaitingOrderCount : data.handoversAwaitingConfirm;

  return (
    <Card style={styles.card}>
      <header style={styles.header}>
        <div>
          <p style={styles.title}>Hub agent COD</p>
          <p style={styles.lead}>
            {filterDate ? (
              <>
                {formatDayHeading(filterDate)} · {custodianLabel}
              </>
            ) : (
              <>
                By delivery day · {formatIsoDateRange(data.lookbackFrom, data.lookbackTo)} (IST) ·{' '}
                {custodianLabel}
              </>
            )}
          </p>
        </div>
        {filterDate ? <span style={styles.dateBadge}>{filterDate}</span> : null}
      </header>

      <div style={styles.stats}>
        <div style={{ ...styles.metric, ...(stillTotal > 0 ? styles.metricCollect : styles.metricNeutral) }}>
          <p style={styles.metricLabel}>With agents</p>
          <p style={styles.metricValue}>{money(stillTotal)}</p>
          <p style={styles.metricHint}>
            {stillCount > 0 ? `${stillCount} order${stillCount === 1 ? '' : 's'} to collect` : 'Nothing out with agents'}
          </p>
        </div>
        <div style={{ ...styles.metric, ...(declaredTotal > 0 ? styles.metricDeclared : styles.metricNeutral) }}>
          <p style={styles.metricLabel}>Declared</p>
          <p style={styles.metricValue}>{money(declaredTotal)}</p>
          <p style={styles.metricHint}>
            {declaredCount > 0
              ? `${declaredCount} order${declaredCount === 1 ? '' : 's'} to confirm`
              : 'No declarations waiting'}
          </p>
        </div>
      </div>

      {!hasAny ? (
        <p style={styles.muted}>
          {filterDate ? `No pending COD on ${filterDate}.` : 'No pending hub COD in this window.'}
        </p>
      ) : days.length === 0 ? (
        <p style={styles.muted}>No pending COD on {filterDate}.</p>
      ) : (
        days.map((day) => {
          const rows: Row[] = [];
          for (const agent of day.agents) {
            for (const o of agent.stillWithAgentOrders) {
              rows.push({
                key: `s-${o.orderId}`,
                agentName: agent.agentName || 'Agent',
                agentPhone: agent.agentPhone,
                orderNumber: o.orderNumber,
                amount: Number(o.collectAmount ?? 0),
                status: 'With agent',
                deliveredAt: o.deliveredAt,
              });
            }
            for (const h of agent.declaredAwaiting) {
              for (const line of h.lines) {
                rows.push({
                  key: `d-${h.handoverId}-${line.orderId}`,
                  handoverId: h.handoverId,
                  handoverDeclaredAmount: Number(h.declaredAmount ?? 0),
                  agentName: agent.agentName || h.agentName || 'Agent',
                  agentPhone: agent.agentPhone ?? h.agentPhone,
                  orderNumber: line.orderNumber,
                  amount: Number(line.collectAmount ?? 0),
                  status: 'Declared',
                  deliveredAt: line.deliveredAt,
                });
              }
            }
          }

          const declaredRows = rows.filter((r) => r.status === 'Declared' && r.handoverId);
          const declaredKeys = declaredRows.map((r) => r.key);
          const allDeclaredSelected =
            declaredKeys.length > 0 && declaredKeys.every((k) => selected.has(k));
          const someDeclaredSelected = declaredKeys.some((k) => selected.has(k));

          const selectedHandoverIds = [
            ...new Set(
              declaredRows.filter((r) => selected.has(r.key)).map((r) => r.handoverId as string),
            ),
          ];

          return (
            <div key={day.date} style={styles.listBlock}>
              {!filterDate ? (
                <div style={styles.dayHead}>
                  <h3 style={styles.dayTitle}>{formatDayHeading(day.date)}</h3>
                  <p style={styles.dayMeta}>
                    {money(day.stillWithAgentsAmount + day.declaredAwaitingAmount)} ·{' '}
                    {day.stillWithAgentsOrderCount + day.declaredAwaitingOrderCount} order(s)
                  </p>
                </div>
              ) : null}

              {declaredRows.length > 0 ? (
                <div style={styles.listToolbar}>
                  <label style={styles.selectAll}>
                    <input
                      type="checkbox"
                      checked={allDeclaredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someDeclaredSelected && !allDeclaredSelected;
                      }}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (allDeclaredSelected) {
                            for (const k of declaredKeys) next.delete(k);
                          } else {
                            for (const k of declaredKeys) next.add(k);
                          }
                          return next;
                        });
                      }}
                      aria-label="Select all declared orders"
                    />
                    <span>Select declared</span>
                  </label>
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Hub PIN (4–6 digits)"
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value);
                      setPinNeedsAttention(false);
                    }}
                    style={{
                      ...styles.pinInput,
                      ...(pinNeedsAttention ? styles.pinInputAttention : null),
                    }}
                    aria-label="Hub PIN for confirm"
                    aria-invalid={pinNeedsAttention}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmBusy || selectedHandoverIds.length === 0}
                    onClick={() => void confirmDeclared(selectedHandoverIds)}
                  >
                    {confirmBusy ? 'Saving…' : 'I received'}
                    {selectedHandoverIds.length > 1 ? ` (${selectedHandoverIds.length})` : ''}
                  </Button>
                </div>
              ) : null}

              <ul style={styles.list}>
                {rows.map((r) => {
                  const isDeclared = r.status === 'Declared' && r.handoverId;
                  const checked = selected.has(r.key);
                  return (
                    <li key={r.key} style={styles.listItem}>
                      {isDeclared ? (
                        <input
                          type="checkbox"
                          style={styles.rowCheck}
                          checked={checked}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.key)) next.delete(r.key);
                              else next.add(r.key);
                              return next;
                            });
                          }}
                          aria-label={`Select ${r.orderNumber}`}
                        />
                      ) : (
                        <span style={styles.checkSpacer} aria-hidden />
                      )}
                      <div style={styles.listMain}>
                        <div style={styles.listPrimary}>
                          <span style={styles.orderNum}>{r.orderNumber}</span>
                          <span style={styles.amount}>{money(r.amount)}</span>
                          <span style={r.status === 'Declared' ? styles.badgeDeclared : styles.badgeWithAgent}>
                            {r.status}
                          </span>
                        </div>
                        <div style={styles.listSecondary}>
                          <span style={styles.agentName}>{r.agentName}</span>
                          {r.agentPhone ? (
                            <>
                              <span style={styles.dot}>·</span>
                              <CallPhoneLink phone={r.agentPhone} label={r.agentPhone} style={styles.phoneLink} />
                            </>
                          ) : null}
                          {r.deliveredAt ? (
                            <>
                              <span style={styles.dot}>·</span>
                              <span style={styles.delivered}>{formatDeliveredIst(r.deliveredAt)}</span>
                            </>
                          ) : null}
                        </div>
                        {isDeclared && r.handoverDeclaredAmount != null && r.handoverDeclaredAmount !== r.amount ? (
                          <p style={styles.handoverNote}>
                            Part of {codMoney(r.handoverDeclaredAmount, true)} handover — confirming marks the full
                            declaration received.
                          </p>
                        ) : null}
                      </div>
                      {isDeclared ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={confirmBusy}
                          onClick={() => void confirmDeclared([r.handoverId!])}
                          style={styles.rowAction}
                        >
                          I received
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '0.65rem 0.75rem', display: 'grid', gap: '0.55rem' },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  title: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  lead: { margin: '0.12rem 0 0', fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-muted)', fontWeight: 650 },
  dateBadge: {
    fontSize: '0.68rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.45rem',
  },
  metric: {
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    display: 'grid',
    gap: '0.08rem',
  },
  metricNeutral: { background: 'var(--bg)' },
  metricCollect: {
    background: 'var(--warning-soft)',
    borderColor: 'color-mix(in srgb, var(--warning) 35%, var(--border))',
  },
  metricDeclared: {
    background: 'var(--success-soft)',
    borderColor: 'color-mix(in srgb, var(--success) 35%, var(--border))',
  },
  metricLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  metricValue: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },
  metricHint: { margin: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' },
  muted: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 650 },
  dayHead: {
    padding: '0.35rem 0 0.45rem',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.35rem',
    borderBottom: '1px solid var(--border)',
    marginBottom: '0.35rem',
  },
  dayTitle: { margin: 0, fontSize: '0.88rem', fontWeight: 800 },
  dayMeta: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  listBlock: { display: 'grid', gap: '0.4rem' },
  listToolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem 0.55rem',
    padding: '0.35rem 0.4rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  selectAll: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  pinInput: {
    flex: '1 1 5.5rem',
    minWidth: '5.5rem',
    maxWidth: '8.5rem',
    padding: '0.35rem 0.45rem',
    fontSize: '0.78rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  pinInputAttention: {
    borderColor: 'var(--danger)',
    boxShadow: '0 0 0 2px color-mix(in srgb, var(--danger) 25%, transparent)',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.4rem',
    padding: '0.4rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  rowCheck: { marginTop: '0.15rem', flexShrink: 0 },
  checkSpacer: { width: '1rem', flexShrink: 0 },
  listMain: { flex: 1, minWidth: 0, display: 'grid', gap: '0.12rem' },
  listPrimary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.5rem',
  },
  orderNum: { fontWeight: 800, fontSize: '0.8rem' },
  amount: { fontWeight: 800, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' },
  listSecondary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.2rem 0.35rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 650,
  },
  agentName: { fontWeight: 700, color: 'var(--text)' },
  dot: { opacity: 0.45 },
  phoneLink: { fontWeight: 650 },
  delivered: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  handoverNote: {
    margin: '0.15rem 0 0',
    fontSize: '0.65rem',
    fontWeight: 600,
    lineHeight: 1.35,
    color: 'var(--text-muted)',
  },
  rowAction: { flexShrink: 0, alignSelf: 'center' },
  badgeWithAgent: {
    display: 'inline-block',
    padding: '0.1rem 0.35rem',
    borderRadius: 6,
    background: 'var(--warning-soft)',
    border: '1px solid color-mix(in srgb, var(--warning) 45%, var(--border))',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
  badgeDeclared: {
    display: 'inline-block',
    padding: '0.1rem 0.35rem',
    borderRadius: 6,
    background: 'var(--success-soft)',
    border: '1px solid color-mix(in srgb, var(--success) 45%, var(--border))',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
};
