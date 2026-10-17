import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button } from '@/shared/ui';
import { formatMoney } from '@/features/reports/api/reportsApi';
import { fetchBillReminders, type VendorSettlement } from '@/features/reports/api/payoutsApi';

const POLL_MS = 30_000;

function seenKey(vendorId: string) {
  return `hlm.billReminderSeen.${vendorId}`;
}

function readSeen(vendorId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(seenKey(vendorId)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Popup when KoyaKart reminds the shop to pay a sent fee bill. Reopens on every new reminder. */
export function VendorBillReminder() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const titleId = useId();
  const [items, setItems] = useState<VendorSettlement[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken || !session.vendorId) return;
    try {
      const list = await fetchBillReminders(session.accessToken, session.vendorId);
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
    setOpen(false);
  }

  if (!open || items.length === 0) return null;

  return (
    <div style={styles.overlay} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={styles.dialog}>
        <h2 id={titleId} style={styles.title}>
          KoyaKart reminder — please pay this bill
        </h2>
        <p style={styles.lead}>Pay from Payouts and enter the UTR. KoyaKart will confirm it.</p>
        <div style={styles.list}>
          {items.map((s) => (
            <div key={s.id} style={styles.item}>
              <div style={styles.amount}>{formatMoney(s.netAmount)}</div>
              <div style={styles.meta}>
                {s.serviceInvoiceNumber ?? 'Bill'}
                {(s.ackReminderCount ?? 0) > 1 ? ` · reminder ${s.ackReminderCount}` : ''}
              </div>
            </div>
          ))}
        </div>
        <div style={styles.actions}>
          <Button type="button" variant="ghost" onClick={later}>
            Later
          </Button>
          <Button
            type="button"
            onClick={() => {
              later();
              navigate('/payouts');
            }}
          >
            Open payouts
          </Button>
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
    width: 'min(28rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderTop: '4px solid var(--brand, #0C831F)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.1rem',
    display: 'grid',
    gap: '0.65rem',
  },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.12rem', color: 'var(--text)' },
  lead: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.4 },
  list: { display: 'grid', gap: '0.4rem' },
  item: {
    padding: '0.55rem 0.65rem',
    borderRadius: 10,
    background: 'color-mix(in srgb, var(--brand, #0C831F) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--brand, #0C831F) 25%, transparent)',
  },
  amount: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand, #0C831F)' },
  meta: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' },
};
