import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { HubShell } from '../layout/HubShell';
import {
  fetchHubAgents,
  fetchHubPinStatus,
  fetchMyHub,
  setHubPin,
  type AgentDto,
  type HubPinStatusDto,
} from '../api/hubApi';
import {
  closeCodDay,
  fetchCodCandidates,
  fetchCodCloses,
  fetchCodSummary,
  type CodCandidateItem,
  type CodCloseDayResponse,
  type CodSummaryResponse,
} from '../api/codApi';

const PIN_PATTERN = /^\d{4,6}$/;

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

export function HubCodPage() {
  const { session } = useAuth();
  const [hubId, setHubId] = useState<string | null>(null);
  const [townId, setTownId] = useState<string | null>(null);
  const [hubName, setHubName] = useState('');
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [agentId, setAgentId] = useState('');
  const [date, setDate] = useState(todayIso);
  const [candidates, setCandidates] = useState<CodCandidateItem[]>([]);
  const [agentFilterApplied, setAgentFilterApplied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receivedAmount, setReceivedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState<HubPinStatusDto | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [summary, setSummary] = useState<CodSummaryResponse | null>(null);
  const [closes, setCloses] = useState<CodCloseDayResponse[]>([]);
  const [lastResult, setLastResult] = useState<CodCloseDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    if (!session) return;
    const me = await fetchMyHub(session.accessToken);
    setHubId(me.hubId);
    setTownId(me.townId);
    setHubName(me.hubName);
    const [list, status] = await Promise.all([
      fetchHubAgents(session.accessToken, me.hubId),
      fetchHubPinStatus(session.accessToken).catch(() => null),
    ]);
    setPinStatus(status);
    setAgents(list.filter((a) => a.status === 'ACTIVE' || a.status === 'INACTIVE'));
    setAgentId((prev) => {
      if (prev && list.some((a) => a.agentId === prev)) return prev;
      const firstActive = list.find((a) => a.status === 'ACTIVE');
      return firstActive?.agentId ?? list[0]?.agentId ?? '';
    });
  }, [session]);

  const loadData = useCallback(async () => {
    if (!session || !hubId || !townId || !agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [cand, sum, closeList] = await Promise.all([
        fetchCodCandidates(session.accessToken, { townId, hubId, agentId, date }),
        fetchCodSummary(session.accessToken, { townId, hubId, date }),
        fetchCodCloses(session.accessToken, { townId, hubId, from: date, to: date }),
      ]);
      setCandidates(cand.items ?? []);
      setAgentFilterApplied(cand.agentFilterApplied);
      setSummary(sum);
      setCloses(closeList);
      setSelected(new Set((cand.items ?? []).filter((i) => !i.alreadyClosed).map((i) => i.orderId)));
    } catch (err) {
      setCandidates([]);
      setSummary(null);
      setCloses([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD data');
    } finally {
      setLoading(false);
    }
  }, [session, hubId, townId, agentId, date]);

  useEffect(() => {
    void loadHub().catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load hub'),
    );
  }, [loadHub]);

  useEffect(() => {
    if (hubId && townId && agentId) void loadData();
  }, [hubId, townId, agentId, loadData]);

  const openCandidates = useMemo(
    () => candidates.filter((c) => !c.alreadyClosed),
    [candidates],
  );

  const expectedSelected = useMemo(() => {
    return openCandidates
      .filter((c) => selected.has(c.orderId))
      .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
  }, [openCandidates, selected]);

  function toggleOrder(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function selectAllOpen() {
    setSelected(new Set(openCandidates.map((c) => c.orderId)));
  }

  async function onSavePin(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const next = newPin.trim();
    if (!PIN_PATTERN.test(next)) {
      setError('New PIN must be 4–6 digits');
      return;
    }
    setSavingPin(true);
    setError(null);
    setNotice(null);
    try {
      await setHubPin(session.accessToken, next);
      setPinStatus({ configured: true, defaultPinActive: false });
      setNewPin('');
      setNotice('Hub PIN updated. Use it for COD close-day.');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not set PIN');
    } finally {
      setSavingPin(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !hubId || !townId || !agentId) return;
    const orderIds = [...selected];
    if (orderIds.length === 0) {
      setError('Select at least one COD order');
      return;
    }
    const received = Number(receivedAmount);
    if (!Number.isFinite(received) || received < 0) {
      setError('Enter a valid received amount');
      return;
    }
    const hubPin = pin.trim();
    if (!PIN_PATTERN.test(hubPin)) {
      setError('Hub PIN is required (4–6 digits)');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    setLastResult(null);
    try {
      const result = await closeCodDay(session.accessToken, {
        agentId,
        hubId,
        townId,
        receivedAmount: received,
        orderIds,
        notes: notes.trim() || undefined,
        pin: hubPin,
        closeDate: date,
      });
      setLastResult(result);
      setNotice(
        result.status === 'MATCHED'
          ? `Close-day MATCHED — expected ${money(result.expectedAmount)}, received ${money(result.receivedAmount)}`
          : `Close-day DISCREPANCY — expected ${money(result.expectedAmount)}, received ${money(result.receivedAmount)}`,
      );
      setReceivedAmount('');
      setNotes('');
      setPin('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Close-day failed');
    } finally {
      setSubmitting(false);
    }
  }

  const agentName = agents.find((a) => a.agentId === agentId)?.name ?? '';

  return (
    <HubShell title="COD close-day" subtitle={hubName || undefined} onRefresh={() => void loadData()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.card}>
        <p style={styles.sectionTitle}>1. Agent & date</p>
        <div style={styles.row}>
          <label style={styles.field}>
            Delivery boy
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              style={styles.select}
            >
              {agents.length === 0 ? <option value="">No boys</option> : null}
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            Close date (IST)
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.select}
            />
          </label>
        </div>
        {!agentFilterApplied && agentId ? (
          <p style={styles.hint}>
            Agent filter soft: showing town COD delivered for the day when LAST_MILE assignment data is
            unavailable.
          </p>
        ) : null}
      </Card>

      {summary ? (
        <Card style={styles.card}>
          <p style={styles.sectionTitle}>Today&apos;s summary</p>
          <div style={styles.stats}>
            <Stat label="Closes" value={String(summary.closeCount)} />
            <Stat label="Orders" value={String(summary.orderCount)} />
            <Stat label="Expected" value={money(summary.expectedAmount)} />
            <Stat label="Received" value={money(summary.receivedAmount)} />
            <Stat label="Matched" value={String(summary.matchedCount)} />
            <Stat label="Discrepancy" value={String(summary.discrepancyCount)} />
          </div>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <div style={styles.sectionHead}>
          <p style={styles.sectionTitle}>2. COD candidates</p>
          <Button type="button" variant="ghost" onClick={selectAllOpen} disabled={openCandidates.length === 0}>
            Select all open
          </Button>
        </div>
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : openCandidates.length === 0 ? (
          <p style={styles.muted}>No open COD deliveries for {agentName || 'this boy'} on {date}.</p>
        ) : (
          <ul style={styles.list}>
            {candidates.map((item) => (
              <li key={item.orderId} style={styles.listItem}>
                <label style={styles.checkRow}>
                  <input
                    type="checkbox"
                    disabled={item.alreadyClosed}
                    checked={item.alreadyClosed || selected.has(item.orderId)}
                    onChange={() => toggleOrder(item.orderId)}
                  />
                  <span style={styles.orderMeta}>
                    <strong>{item.orderNumber}</strong>
                    <span style={styles.muted}>
                      {item.alreadyClosed ? 'Already closed' : money(item.amount)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p style={styles.expected}>Expected from selection: {money(expectedSelected)}</p>
      </Card>

      <Card style={styles.card}>
        <p style={styles.sectionTitle}>3. Hub PIN</p>
        {pinStatus?.defaultPinActive ? (
          <p style={styles.hint}>
            Default pilot PIN is <strong>1234</strong> until you set your own.
          </p>
        ) : (
          <p style={styles.hint}>Enter your hub PIN to close the day.</p>
        )}
        <form onSubmit={onSavePin} style={styles.form}>
          <TextField
            label={pinStatus?.defaultPinActive ? 'Set your hub PIN (4–6 digits)' : 'Change hub PIN (optional)'}
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            autoComplete="off"
          />
          <Button type="submit" variant="ghost" disabled={savingPin || !newPin.trim()}>
            {savingPin ? 'Saving…' : 'Save PIN'}
          </Button>
        </form>
      </Card>

      <Card style={styles.card}>
        <p style={styles.sectionTitle}>4. Cash received</p>
        <form onSubmit={onSubmit} style={styles.form}>
          <TextField
            label="Received amount (₹)"
            type="number"
            step="0.01"
            min="0"
            value={receivedAmount}
            onChange={(e) => setReceivedAmount(e.target.value)}
            required
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <TextField
            label="Hub PIN (required)"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="off"
            required
          />
          <Button type="submit" disabled={submitting || selected.size === 0 || !pin.trim()}>
            {submitting ? 'Closing…' : 'Close day'}
          </Button>
        </form>
        {lastResult ? (
          <p
            style={{
              ...styles.result,
              color: lastResult.status === 'MATCHED' ? 'var(--success, #0a7a3e)' : 'var(--danger, #b42318)',
            }}
          >
            Last result: {lastResult.status}
          </p>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <p style={styles.sectionTitle}>Closes for {date}</p>
        {closes.length === 0 ? (
          <p style={styles.muted}>No closes yet for this date.</p>
        ) : (
          <ul style={styles.list}>
            {closes.map((c) => (
              <li key={c.id} style={styles.closeItem}>
                <div style={styles.closeHead}>
                  <strong>{c.status}</strong>
                  <span style={styles.muted}>{c.orderCount} orders</span>
                </div>
                <div style={styles.muted}>
                  Expected {money(c.expectedAmount)} · Received {money(c.receivedAmount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </HubShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { marginBottom: '0.85rem' },
  sectionTitle: { margin: '0 0 0.65rem', fontWeight: 800, fontSize: '0.95rem' },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.35rem',
  },
  row: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' },
  field: { display: 'grid', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' },
  select: {
    minHeight: 'var(--touch-min)',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    padding: '0.45rem 0.65rem',
    fontWeight: 600,
  },
  hint: { margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
    gap: '0.55rem',
  },
  stat: {
    display: 'grid',
    gap: '0.15rem',
    padding: '0.55rem',
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  statLabel: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 },
  statValue: { fontSize: '0.95rem' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' },
  listItem: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.65rem',
    background: 'var(--bg)',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  orderMeta: { display: 'grid', gap: '0.1rem' },
  muted: { color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 },
  expected: { margin: '0.75rem 0 0', fontWeight: 800 },
  form: { display: 'grid', gap: '0.75rem' },
  result: { margin: '0.75rem 0 0', fontWeight: 800 },
  closeItem: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.65rem',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.2rem',
  },
  closeHead: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' },
};
