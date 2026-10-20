import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button } from '@/shared/ui';
import { formatMoney } from '@/features/reports/api/reportsApi';
import {
  PAYOUT_ACKED_EVENT,
  acknowledgeSettlement,
  fetchAckReminders,
  reportPayoutNotReceived,
  type VendorSettlement,
} from '@/features/reports/api/payoutsApi';

const POLL_MS = 30_000;

function seenKey(vendorId: string) {
  return `hlm.payoutAckSeen.${vendorId}`;
}

function readSeen(vendorId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(seenKey(vendorId)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function formatDay(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Popup when KoyaKart reminds the shop to confirm a payout reached them; reopens on every new reminder. */
export function PayoutAckReminder() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const titleId = useId();
  const [items, setItems] = useState<VendorSettlement[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!session?.accessToken || !session.vendorId) return;
    try {
      const list = await fetchAckReminders(session.accessToken, session.vendorId);
      setItems(list);
      const seen = readSeen(session.vendorId);
      if (list.some((s) => s.ackRemindedAt && seen[s.id] !== s.ackRemindedAt)) setOpen(true);
      if (list.length === 0) setOpen(false);
    } catch {
      // Payment service may be down; try again on the next poll.
    }
  }, [session]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  function later() {
    if (session?.vendorId) {
      const seen = readSeen(session.vendorId);
      for (const s of items) if (s.ackRemindedAt) seen[s.id] = s.ackRemindedAt;
      localStorage.setItem(seenKey(session.vendorId), JSON.stringify(seen));
    }
    setDisputing(false);
    setNote('');
    setOpen(false);
  }

  async function reportMissing() {
    if (!session?.accessToken || !session.vendorId) return;
    setBusyId('missing');
    setError(null);
    try {
      for (const s of items) {
        const updated = await reportPayoutNotReceived(session.accessToken, session.vendorId, s.id, note);
        window.dispatchEvent(new CustomEvent(PAYOUT_ACKED_EVENT, { detail: updated }));
      }
      later();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not tell KoyaKart');
    } finally {
      setBusyId(null);
    }
  }

  async function ack(s: VendorSettlement) {
    if (!session?.accessToken || !session.vendorId) return;
    setBusyId(s.id);
    setError(null);
    try {
      const updated = await acknowledgeSettlement(session.accessToken, session.vendorId, s.id);
      window.dispatchEvent(new CustomEvent(PAYOUT_ACKED_EVENT, { detail: updated }));
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== s.id);
        if (next.length === 0) setOpen(false);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm receipt');
    } finally {
      setBusyId(null);
    }
  }

  if (!open || items.length === 0) return null;

  return (
    <div style={styles.overlay} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={styles.dialog}>
        <h2 id={titleId} style={styles.title}>
          KoyaKart sent you money — please confirm
        </h2>
        <p style={styles.lead}>
          Check your bank / UPI app. Tap <strong>Yes, I received it</strong> once the amount is in your account.
        </p>
        {error ? <p style={styles.error}>{error}</p> : null}
        <div style={styles.list}>
          {items.map((s) => (
            <div key={s.id} style={styles.item}>
              <div style={styles.itemMain}>
                <div style={styles.amount}>{formatMoney(s.netAmount)}</div>
                <div style={styles.meta}>
                  {s.payoutMethod ?? 'Payout'} · Txn {s.transactionReference || 'no ref'}
                </div>
                {s.transactionNotes?.trim() ? <div style={styles.meta}>{s.transactionNotes.trim()}</div> : null}
                <div style={styles.meta}>
                  Orders {formatDay(s.periodStart)} – {formatDay(s.periodEnd)} · sent {formatWhen(s.paidAt)}
                </div>
                {(s.ackReminderCount ?? 0) > 1 ? (
                  <div style={styles.nudge}>Reminder {s.ackReminderCount} from KoyaKart</div>
                ) : null}
              </div>
              <Button type="button" disabled={busyId === s.id} onClick={() => void ack(s)}>
                {busyId === s.id ? 'Saving…' : 'Yes, I received it'}
              </Button>
            </div>
          ))}
        </div>
        {disputing ? (
          <div style={styles.dispute}>
            <p style={styles.lead}>
              KoyaKart will see this as <strong>Vendor not received</strong> and can correct the payment details.
            </p>
            <textarea
              style={styles.note}
              value={note}
              maxLength={500}
              rows={2}
              placeholder="What should they recheck?"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        ) : null}
        <div style={styles.actions}>
          {disputing ? (
            <>
              <Button type="button" variant="ghost" disabled={busyId != null} onClick={() => setDisputing(false)}>
                Go back
              </Button>
              <Button type="button" disabled={busyId != null || !note.trim()} onClick={() => void reportMissing()}>
                {busyId === 'missing' ? 'Sending…' : 'Send comment'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  later();
                  navigate('/payouts');
                }}
              >
                Open payouts
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDisputing(true)}>
                Not received yet
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.45)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(32rem, 100%)',
    maxHeight: '90dvh',
    overflow: 'auto',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.1rem',
    display: 'grid',
    gap: '0.7rem',
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)' },
  lead: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.4 },
  error: { margin: 0, color: 'var(--danger, #dc2626)', fontSize: '0.85rem', fontWeight: 700 },
  list: { display: 'grid', gap: '0.5rem' },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    flexWrap: 'wrap',
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 10px)',
    background: 'var(--bg-subtle, #f8faf9)',
  },
  itemMain: { display: 'grid', gap: '0.15rem', minWidth: 0 },
  amount: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--success, #15803d)' },
  meta: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  nudge: { fontSize: '0.75rem', fontWeight: 800, color: '#b45309' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' },
  dispute: { display: 'grid', gap: '0.4rem' },
  note: {
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '3.2rem',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '0.85rem',
  },
};
