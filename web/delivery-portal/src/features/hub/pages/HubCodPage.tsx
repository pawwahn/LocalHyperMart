import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { requestCodPinResetOtp } from '@/shared/api/codPinOtpApi';
import {
  fetchCodCustodianOutstanding,
  fetchCodCustodianPendingDetail,
  fetchCodCustodianPendingDetailByAgent,
  fetchCodHubLedger,
  type CodCustodianOutstanding,
  type CodCustodianPendingDetail,
  type CodHubLedger,
} from '../api/codApi';
import { CodHubCompanyAccountPanel } from '../components/CodHubCompanyAccountPanel';
import { CodPendingByDatePanel } from '../components/CodPendingByDatePanel';
import { CodOutstandingSummary } from '../components/CodOutstandingSummary';
import { CodReceivableCalendar } from '../components/CodReceivableCalendar';
import { CodPendingByAgentPanel } from '../components/CodPendingByAgentPanel';
import { todayIstIso } from '../lib/codFormat';
import type { TransferHistoryPreset } from '@hlm-dates/istReportPresets';

const PIN_PATTERN = /^\d{4,6}$/;

type CodView = 'calendar' | 'day' | 'agent' | 'account';

export function HubCodPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<CodView>(() => {
    const v = searchParams.get('view');
    if (v === 'account' || v === 'agent' || v === 'calendar' || v === 'day') return v;
    return 'day';
  });
  const [date, setDate] = useState(todayIstIso);
  const [hubId, setHubId] = useState<string | null>(() => session?.hubId ?? null);
  const [townId, setTownId] = useState<string | null>(() => session?.townId ?? null);
  const [hubName, setHubName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinResetOtp, setPinResetOtp] = useState('');
  const [pinStatus, setPinStatus] = useState<HubPinStatusDto | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [requestingPinOtp, setRequestingPinOtp] = useState(false);
  const [pinOtpNotice, setPinOtpNotice] = useState<string | null>(null);
  const [outstanding, setOutstanding] = useState<CodCustodianOutstanding | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [pendingDetail, setPendingDetail] = useState<CodCustodianPendingDetail | null>(null);
  const [pendingDetailLoading, setPendingDetailLoading] = useState(false);
  const [agentRangeDetail, setAgentRangeDetail] = useState<CodCustodianPendingDetail | null>(null);
  const [agentRangeLoading, setAgentRangeLoading] = useState(false);
  const [hubAgents, setHubAgents] = useState<AgentDto[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [ledger, setLedger] = useState<CodHubLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerPreset, setLedgerPreset] = useState<TransferHistoryPreset>('all');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOutstanding = useCallback(async (tid: string, hid: string) => {
    if (!session) return;
    setOutstandingLoading(true);
    setOutstandingError(null);
    try {
      const data = await fetchCodCustodianOutstanding(session.accessToken, { townId: tid, hubId: hid });
      setOutstanding(data);
    } catch (err) {
      setOutstanding(null);
      setOutstandingError(
        err instanceof ApiError || err instanceof Error ? err.message : 'Could not load overall COD summary',
      );
    } finally {
      setOutstandingLoading(false);
    }
  }, [session]);

  const loadDayData = useCallback(
    async (tid: string, hid: string, day: string) => {
      if (!session) return;
      setPendingDetailLoading(true);
      setError(null);
      try {
        const [detail, status] = await Promise.all([
          fetchCodCustodianPendingDetail(session.accessToken, { townId: tid, hubId: hid, from: day, to: day }),
          fetchHubPinStatus(session.accessToken).catch(() => null),
        ]);
        setPendingDetail(detail);
        setPinStatus(status);
      } catch (err) {
        setPendingDetail(null);
        setError(
          err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD for this day',
        );
      } finally {
        setPendingDetailLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        const me = await fetchMyHub(session.accessToken);
        setHubId(me.hubId);
        setTownId(me.townId);
        setHubName(me.hubName);
        await loadOutstanding(me.townId, me.hubId);
        const agents = await fetchHubAgents(session.accessToken, me.hubId).catch(() => [] as AgentDto[]);
        setHubAgents(agents);
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load hub COD');
      }
    })();
  }, [session, loadOutstanding]);

  const loadLedger = useCallback(
    async (tid: string, hid: string, from: string, to: string) => {
      if (!session) return;
      setLedgerLoading(true);
      setLedgerError(null);
      try {
        const data = await fetchCodHubLedger(session.accessToken, {
          townId: tid,
          hubId: hid,
          from: from || undefined,
          to: to || undefined,
        });
        setLedger(data);
      } catch (err) {
        setLedger(null);
        setLedgerError(
          err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD account',
        );
      } finally {
        setLedgerLoading(false);
      }
    },
    [session],
  );

  const loadAgentRange = useCallback(
    async (tid: string, hid: string) => {
      if (!session) return;
      setAgentRangeLoading(true);
      try {
        const detail = await fetchCodCustodianPendingDetailByAgent(session.accessToken, { townId: tid, hubId: hid });
        setAgentRangeDetail(detail);
      } catch {
        setAgentRangeDetail(null);
      } finally {
        setAgentRangeLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (view !== 'day' || !townId || !hubId) return;
    void loadDayData(townId, hubId, date);
  }, [view, date, townId, hubId, loadDayData]);

  useEffect(() => {
    if (view !== 'agent' || !townId || !hubId) return;
    void loadAgentRange(townId, hubId);
  }, [view, townId, hubId, loadAgentRange]);

  useEffect(() => {
    if (view !== 'account' || !townId || !hubId) return;
    void loadLedger(townId, hubId, ledgerFrom, ledgerTo);
  }, [view, townId, hubId, ledgerFrom, ledgerTo, loadLedger]);

  useEffect(() => {
    if (view !== 'agent' || selectedAgentId || !agentRangeDetail?.days?.length) return;
    for (const day of agentRangeDetail.days) {
      for (const agent of day.agents) {
        const n = (agent.stillWithAgentOrderCount ?? 0) + (agent.declaredAwaitingOrderCount ?? 0);
        if (n > 0) {
          setSelectedAgentId(agent.agentId);
          return;
        }
      }
    }
  }, [view, agentRangeDetail, selectedAgentId]);

  const reloadCodData = useCallback(async () => {
    if (!session) return;
    try {
      const me = await fetchMyHub(session.accessToken);
      setHubId(me.hubId);
      setTownId(me.townId);
      setHubName(me.hubName);
      await Promise.all([
        loadOutstanding(me.townId, me.hubId),
        view === 'day' ? loadDayData(me.townId, me.hubId, date) : Promise.resolve(),
        view === 'agent' ? loadAgentRange(me.townId, me.hubId) : Promise.resolve(),
        view === 'account' ? loadLedger(me.townId, me.hubId, ledgerFrom, ledgerTo) : Promise.resolve(),
      ]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load hub COD');
    }
  }, [session, date, view, ledgerFrom, ledgerTo, loadDayData, loadOutstanding, loadAgentRange, loadLedger]);

  async function onRequestPinOtp() {
    if (!session) return;
    setRequestingPinOtp(true);
    setError(null);
    setPinOtpNotice(null);
    try {
      await requestCodPinResetOtp(session.accessToken);
      setPinOtpNotice('OTP sent to your registered phone. Pilot/dev: use 111111.');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setRequestingPinOtp(false);
    }
  }

  async function onSavePin(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const next = newPin.trim();
    const otp = pinResetOtp.trim();
    if (!PIN_PATTERN.test(next)) {
      setError('PIN must be 4–6 digits');
      return;
    }
    if (!otp) {
      setError('Enter the OTP sent to your phone');
      return;
    }
    setSavingPin(true);
    setError(null);
    setNotice(null);
    try {
      await setHubPin(session.accessToken, next, otp);
      setPinStatus({ configured: true, defaultPinActive: false });
      setNewPin('');
      setPinResetOtp('');
      setNotice('Hub PIN saved. Share it with counter staff who confirm cash.');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not set PIN');
    } finally {
      setSavingPin(false);
    }
  }

  return (
    <HubShell
      title="COD from agents"
      subtitle={hubName ? `${hubName} · hub cash` : undefined}
      onRefresh={() => void reloadCodData()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <p style={styles.intro}>
        Confirm cash when agents declare handover. Company account shows what you received and what you still owe KoyaKart.
      </p>

      <div style={styles.viewTabs} role="tablist" aria-label="COD views">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'calendar'}
          style={view === 'calendar' ? styles.viewTabActive : styles.viewTab}
          onClick={() => setView('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'day'}
          style={view === 'day' ? styles.viewTabActive : styles.viewTab}
          onClick={() => setView('day')}
        >
          Day detail
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'agent'}
          style={view === 'agent' ? styles.viewTabActive : styles.viewTab}
          onClick={() => setView('agent')}
        >
          By agent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'account'}
          style={view === 'account' ? styles.viewTabActive : styles.viewTab}
          onClick={() => setView('account')}
        >
          Company account
        </button>
      </div>

      {view === 'calendar' && session && townId && hubId ? (
        <CodReceivableCalendar
          token={session.accessToken}
          townId={townId}
          hubId={hubId}
          selectedDate={date}
          onSelectDate={(iso) => {
            setDate(iso);
            setView('day');
          }}
        />
      ) : null}

      {view === 'account' ? (
        <CodHubCompanyAccountPanel
          data={ledger}
          loading={ledgerLoading}
          error={ledgerError}
          preset={ledgerPreset}
          rangeFrom={ledgerFrom}
          rangeTo={ledgerTo}
          onPresetChange={setLedgerPreset}
          onRangeFromChange={setLedgerFrom}
          onRangeToChange={setLedgerTo}
        />
      ) : null}

      {view === 'agent' ? (
        <CodPendingByAgentPanel
          data={agentRangeDetail}
          roster={hubAgents}
          selectedAgentId={selectedAgentId}
          onSelectAgentId={setSelectedAgentId}
          loading={agentRangeLoading}
        />
      ) : null}

      {view === 'day' ? (
        <>
          <div style={styles.toolbar}>
            <label style={styles.dateField}>
              <span style={styles.dateLabel}>Day (IST)</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={styles.dateInput}
              />
            </label>
            <CodOutstandingSummary
              data={outstanding}
              loading={outstandingLoading}
              error={outstandingError}
              onRetry={() => townId && hubId && void loadOutstanding(townId, hubId)}
            />
          </div>

          <CodPendingByDatePanel
            data={pendingDetail}
            loading={pendingDetailLoading}
            custodianLabel={hubName || 'this hub'}
            filterDate={date}
            onAfterConfirm={() => {
              if (townId && hubId) {
                void Promise.all([
                  loadOutstanding(townId, hubId),
                  loadDayData(townId, hubId, date),
                  loadLedger(townId, hubId, ledgerFrom, ledgerTo),
                ]);
              }
            }}
            onNotice={(message) => {
              setNotice(message);
              setError(null);
            }}
            onError={(message) => {
              if (!message) return;
              setError(message);
              setNotice(null);
            }}
          />

          <Card style={styles.card}>
            <p style={styles.sectionTitle}>Hub PIN</p>
            {pinStatus?.defaultPinActive ? (
              <p style={styles.hint}>
                Pilot default PIN is <strong>1234</strong>. Set your own PIN below.
              </p>
            ) : (
              <p style={styles.hint}>Required when you confirm cash from agents. Reset needs OTP on your login phone.</p>
            )}
            {pinOtpNotice ? <p style={styles.hint}>{pinOtpNotice}</p> : null}
            <form onSubmit={onSavePin} style={styles.form}>
              <Button type="button" variant="ghost" disabled={requestingPinOtp} onClick={() => void onRequestPinOtp()}>
                {requestingPinOtp ? 'Sending…' : 'Send OTP to my phone'}
              </Button>
              <TextField
                label="OTP from SMS"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pinResetOtp}
                onChange={(e) => setPinResetOtp(e.target.value)}
              />
              <TextField
                label="New PIN (4–6 digits)"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
              <Button type="submit" variant="ghost" disabled={savingPin || !newPin.trim() || !pinResetOtp.trim()}>
                {savingPin ? 'Saving…' : 'Save PIN'}
              </Button>
            </form>
          </Card>

          <p style={styles.hint}>
            Use checkboxes and <strong>I received</strong> in the list above (hub PIN required). Set PIN below if
            needed.
          </p>
        </>
      ) : null}

      <p style={styles.footerNote}>
        Shop-route COD (vendor delivery) is collected in the vendor portal, not here.
      </p>
    </HubShell>
  );
}

const styles: Record<string, CSSProperties> = {
  intro: { margin: 0, fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.45, color: 'var(--text-muted)' },
  viewTabs: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  viewTab: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.4rem 0.85rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  viewTabActive: {
    border: '1px solid var(--accent)',
    borderRadius: 999,
    padding: '0.4rem 0.85rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontSize: '0.82rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '0.45rem 0.65rem',
  },
  dateField: { display: 'grid', gap: '0.22rem', minWidth: 0 },
  dateLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  },
  dateInput: {
    padding: '0.42rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    boxShadow: 'var(--shadow-card)',
    maxWidth: '100%',
  },
  card: { marginBottom: '0.75rem', padding: '0.65rem 0.75rem', display: 'grid', gap: '0.5rem' },
  sectionTitle: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  hint: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  muted: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  confirmSection: { display: 'grid', gap: '0.4rem', marginTop: '0.15rem' },
  confirmHeading: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  confirmLead: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  confirmEmpty: {
    textAlign: 'center',
    padding: '1rem 0.75rem',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '0.75rem',
  },
  emptyTitle: { margin: 0, fontWeight: 800, fontSize: '0.9rem' },
  emptyHint: { margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  handoverBlock: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.65rem',
    display: 'grid',
    gap: '0.45rem',
    background: 'var(--bg-elevated)',
    marginBottom: '0.75rem',
  },
  handoverAgentRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.35rem 0.75rem',
  },
  handoverAgent: { margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' },
  handoverPhone: { fontSize: '0.78rem', fontWeight: 700 },
  handoverTitle: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  orderList: {
    margin: 0,
    paddingLeft: '1.1rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    display: 'grid',
    gap: '0.2rem',
  },
  form: { display: 'grid', gap: '0.55rem' },
  formActions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  footerNote: {
    margin: '0.25rem 0 1rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 650,
  },
};
