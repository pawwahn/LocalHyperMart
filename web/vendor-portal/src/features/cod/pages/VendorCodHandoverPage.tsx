import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import {
  confirmCodHandover,
  fetchCodCustodianOutstanding,
  fetchCodCustodianReceivables,
  fetchPendingCodHandovers,
  type CodCustodianOutstanding,
  type CodCustodianReceivables,
  type CodHandoverPending,
} from '../api/codHandoverApi';
import { CodOutstandingSummary } from '../components/CodOutstandingSummary';
import { CodReceivablesPanel } from '../components/CodReceivablesPanel';
import { CodReceivableCalendar } from '../components/CodReceivableCalendar';
import { codMoney, formatCodDate, todayIstIso } from '../lib/codFormat';
import { fetchVendorCodPinStatus, setVendorCodPin, type VendorCodPinStatus } from '../api/vendorCodPinApi';
import { requestCodPinResetOtp } from '@/shared/api/codPinOtpApi';

const PIN_PATTERN = /^\d{4,6}$/;

type CodView = 'day' | 'calendar';

export function VendorCodHandoverPage() {
  const { session } = useAuth();
  const { shop, loading: shopLoading, error: shopError } = useVendorShop();
  const [view, setView] = useState<CodView>('day');
  const [date, setDate] = useState(todayIstIso);
  const [receivables, setReceivables] = useState<CodCustodianReceivables | null>(null);
  const [receivablesLoading, setReceivablesLoading] = useState(false);
  const [outstanding, setOutstanding] = useState<CodCustodianOutstanding | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [pending, setPending] = useState<CodHandoverPending[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [received, setReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStatus, setPinStatus] = useState<VendorCodPinStatus | null>(null);
  const [newShopPin, setNewShopPin] = useState('');
  const [pinResetOtp, setPinResetOtp] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [requestingPinOtp, setRequestingPinOtp] = useState(false);
  const [pinOtpNotice, setPinOtpNotice] = useState<string | null>(null);

  const loadReceivables = useCallback(async () => {
    if (!session?.vendorId || !shop?.townId) return;
    setReceivablesLoading(true);
    try {
      const data = await fetchCodCustodianReceivables(session.accessToken, {
        townId: shop.townId,
        vendorId: session.vendorId,
        date,
      });
      setReceivables(data);
    } catch {
      setReceivables(null);
    } finally {
      setReceivablesLoading(false);
    }
  }, [session, shop?.townId, date]);

  const loadOutstanding = useCallback(async () => {
    if (!session?.vendorId || !shop?.townId) return;
    setOutstandingLoading(true);
    setOutstandingError(null);
    try {
      const data = await fetchCodCustodianOutstanding(session.accessToken, {
        townId: shop.townId,
        vendorId: session.vendorId,
      });
      setOutstanding(data);
    } catch (err) {
      setOutstanding(null);
      setOutstandingError(
        err instanceof ApiError || err instanceof Error ? err.message : 'Could not load overall COD summary',
      );
    } finally {
      setOutstandingLoading(false);
    }
  }, [session, shop?.townId]);

  const reload = useCallback(async () => {
    if (!session?.vendorId) {
      setPending([]);
      setError('Sign in to view COD handovers.');
      setLoading(false);
      return;
    }
    if (shopLoading) {
      return;
    }
    if (!shop?.townId) {
      setPending([]);
      setError(shopError ?? 'Shop town is not set — open Home and refresh shop profile.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPendingCodHandovers(session.accessToken, {
        townId: shop.townId,
        vendorId: session.vendorId,
        date,
      });
      setPending(rows);
    } catch (err) {
      setPending([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load handovers');
    } finally {
      setLoading(false);
    }
  }, [session, shop?.townId, shopLoading, shopError, date]);

  usePortalChrome(
    {
      title: 'COD from agents',
      onRefresh: () => {
        void loadOutstanding();
        void loadReceivables();
        void reload();
      },
    },
    true,
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!shopLoading && shop?.townId) {
      void loadOutstanding();
      void loadReceivables();
    }
  }, [loadReceivables, loadOutstanding, shopLoading, shop?.townId]);

  useEffect(() => {
    if (!session) return;
    void fetchVendorCodPinStatus(session.accessToken)
      .then(setPinStatus)
      .catch(() => setPinStatus(null));
  }, [session]);

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

  async function onSaveShopPin(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const pin = newShopPin.trim();
    const otp = pinResetOtp.trim();
    if (!PIN_PATTERN.test(pin)) {
      setError('PIN must be 4–6 digits');
      return;
    }
    if (!otp) {
      setError('Enter OTP from your phone');
      return;
    }
    setSavingPin(true);
    setError(null);
    try {
      await setVendorCodPin(session.accessToken, pin, otp);
      setPinStatus({ configured: true, defaultPinActive: false });
      setNewShopPin('');
      setPinResetOtp('');
      setNotice('Shop COD PIN saved. Share with staff who confirm agent cash.');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save PIN');
    } finally {
      setSavingPin(false);
    }
  }

  async function onConfirm(e: FormEvent, handover: CodHandoverPending) {
    e.preventDefault();
    if (!session?.vendorId) return;
    const amount = Number(received);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter valid received amount');
      return;
    }
    const pin = confirmPin.trim();
    if (!PIN_PATTERN.test(pin)) {
      setError('Shop COD PIN is required (4–6 digits)');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await confirmCodHandover(session.accessToken, {
        handoverId: handover.handoverId,
        receivedAmount: amount,
        vendorId: session.vendorId,
        pin,
        notes: notes.trim() || undefined,
      });
      setNotice(`Recorded ${codMoney(amount, true)} received from shop agent.`);
      setConfirmId(null);
      setReceived('');
      setNotes('');
      setConfirmPin('');
      await Promise.all([reload(), loadReceivables(), loadOutstanding()]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <p style={styles.intro}>
        Confirm cash when agents declare handover. Totals match buyer COD (after wallet credit).
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
      </div>

      {view === 'calendar' && session?.vendorId && shop?.townId ? (
        <CodReceivableCalendar
          token={session.accessToken}
          townId={shop.townId}
          vendorId={session.vendorId}
          selectedDate={date}
          onSelectDate={(iso) => {
            setDate(iso);
            setView('day');
          }}
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
          onRetry={() => void loadOutstanding()}
        />
      </div>

      <CodReceivablesPanel
        data={receivables}
        loading={receivablesLoading || shopLoading}
        custodianLabel={shop?.shopName ?? session?.shopName ?? 'your shop'}
      />

      <Card elevated padding="sm" style={styles.pinCard}>
        <p style={styles.confirmHeading}>Shop COD PIN</p>
        <p style={styles.confirmLead}>
          {pinStatus?.defaultPinActive
            ? 'Pilot default 1234 until you set your own. Reset requires OTP on owner phone.'
            : 'Staff use this PIN to confirm agent cash. Reset requires OTP on owner phone.'}
        </p>
        {pinOtpNotice ? <p style={styles.confirmLead}>{pinOtpNotice}</p> : null}
        <form onSubmit={onSaveShopPin} style={styles.form}>
          <Button type="button" variant="ghost" disabled={requestingPinOtp} onClick={() => void onRequestPinOtp()}>
            {requestingPinOtp ? 'Sending…' : 'Send OTP to my phone'}
          </Button>
          <div style={styles.formRow}>
            <TextField label="OTP" inputMode="numeric" value={pinResetOtp} onChange={(e) => setPinResetOtp(e.target.value)} />
            <TextField
              label="New PIN (4–6 digits)"
              type="password"
              inputMode="numeric"
              value={newShopPin}
              onChange={(e) => setNewShopPin(e.target.value)}
            />
          </div>
          <Button type="submit" variant="ghost" disabled={savingPin || !newShopPin.trim() || !pinResetOtp.trim()}>
            {savingPin ? 'Saving…' : 'Save shop PIN'}
          </Button>
        </form>
      </Card>

      <section style={styles.confirmSection} aria-labelledby="cod-confirm-heading">
        <h2 id="cod-confirm-heading" style={styles.confirmHeading}>
          Confirm declarations
        </h2>
        <p style={styles.confirmLead}>Agent declared handovers for {formatCodDate(date)}.</p>

        {shopLoading || loading ? (
          <Card elevated padding="sm" style={styles.confirmCard}>
            <p style={styles.muted}>{shopLoading ? 'Loading shop…' : 'Loading declarations…'}</p>
          </Card>
        ) : pending.length === 0 && !error ? (
          <Card elevated padding="sm" style={styles.confirmEmpty}>
            <p style={styles.emptyTitle}>Nothing to confirm</p>
            <p style={styles.emptyHint}>When an agent declares in the delivery app, it will show up here.</p>
          </Card>
        ) : (
          pending.map((h) => {
            const agentName = h.agentName?.trim() || 'Delivery agent';
            const agentPhone = h.agentPhone?.trim() || null;
            return (
            <Card key={h.handoverId} elevated padding="sm" style={styles.handoverCard}>
              <p style={styles.handoverAgent}>
                From <strong>{agentName}</strong>
                {agentPhone ? ` · ${agentPhone}` : ''}
              </p>
              <div style={styles.handoverHead}>
                <p style={styles.handoverAmount}>{codMoney(h.declaredAmount, true)}</p>
                <p style={styles.handoverMeta}>
                  {h.lines.length} order{h.lines.length === 1 ? '' : 's'} · declared, awaiting your confirm
                </p>
              </div>
              <ul style={styles.orderList}>
                {h.lines.map((line) => (
                  <li key={line.orderId} style={styles.orderLine}>
                    <span style={styles.orderNum}>{line.orderNumber}</span>
                    <span style={styles.orderCash}>{codMoney(line.collectAmount, true)}</span>
                    {line.vendorAllocations?.length ? (
                      <span style={styles.orderShare}>
                        your share{' '}
                        {codMoney(
                          line.vendorAllocations.reduce((s, a) => s + Number(a.allocatedCash ?? 0), 0),
                          true,
                        )}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {confirmId === h.handoverId ? (
                <form onSubmit={(e) => void onConfirm(e, h)} style={styles.form}>
                  <div style={styles.formRow}>
                    <TextField
                      label="Received (₹)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      required
                    />
                    <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <TextField
                      label="Shop COD PIN"
                      type="password"
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      required
                    />
                  </div>
                  <div style={styles.actions}>
                    <Button type="submit" disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm received'}
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setConfirmId(h.handoverId);
                    setReceived(String(h.declaredAmount));
                    setConfirmPin('');
                  }}
                >
                  Confirm cash received
                </Button>
              )}
            </Card>
          );
          })
        )}
      </section>
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: '0.65rem', padding: '0.35rem 0 0.75rem', minWidth: 0 },
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
  dateLabel: { fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' },
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
  pinCard: { display: 'grid', gap: '0.45rem' },
  confirmSection: { display: 'grid', gap: '0.4rem', marginTop: '0.15rem' },
  confirmHeading: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  confirmLead: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  confirmCard: { margin: 0 },
  confirmEmpty: {
    textAlign: 'center',
    padding: '1rem 0.75rem',
    borderStyle: 'dashed',
  },
  emptyTitle: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '0.9rem' },
  emptyHint: { margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  handoverCard: { display: 'grid', gap: '0.5rem' },
  handoverAgent: { margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' },
  handoverHead: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem 0.65rem' },
  handoverAmount: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  handoverMeta: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  orderList: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.28rem' },
  orderLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.25rem 0.5rem',
    padding: '0.35rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
    fontSize: '0.82rem',
  },
  orderNum: { fontWeight: 800, flex: '1 1 6rem' },
  orderCash: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  orderShare: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, width: '100%' },
  form: { display: 'grid', gap: '0.45rem' },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
    gap: '0.45rem',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' },
};

