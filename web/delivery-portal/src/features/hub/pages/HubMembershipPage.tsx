import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { HubShell } from '../layout/HubShell';
import {
  cancelHubMembershipCash,
  confirmHubMembershipCash,
  fetchHubPendingCash,
  type HubMembershipPurchase,
} from '../api/membershipApi';

function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(0)}`;
}

export function HubMembershipPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [rows, setRows] = useState<HubMembershipPurchase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setRows(await fetchHubPendingCash(token));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load cash requests');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirm(id: string) {
    setBusy(true);
    setError(null);
    try {
      await confirmHubMembershipCash(token, id);
      setNotice('Cash taken. Credits added.');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelHubMembershipCash(token, id);
      setNotice('Request cancelled.');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <HubShell title="Membership cash" subtitle="Confirm cash packs" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      <Card style={styles.card}>
        {rows.length === 0 ? (
          <p style={styles.empty}>No pending cash memberships.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Slab</th>
                <th style={styles.th}>Cash</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.purchaseId}>
                  <td style={styles.td}>{row.buyerPhone}</td>
                  <td style={styles.td}>{row.slab}</td>
                  <td style={styles.td}>{money(row.price)}</td>
                  <td style={styles.td}>
                    <Button size="sm" disabled={busy} onClick={() => void confirm(row.purchaseId)}>
                      Got cash
                    </Button>{' '}
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void cancel(row.purchaseId)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </HubShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '0.5rem' },
  empty: { margin: 0, color: 'var(--text-muted)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th: { textAlign: 'left', padding: '0.28rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.32rem 0.28rem', borderBottom: '1px solid var(--border)' },
};
