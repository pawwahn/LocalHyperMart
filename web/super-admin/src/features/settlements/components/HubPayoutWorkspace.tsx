import { useCallback, useEffect, useRef, useState, type CSSProperties, ReactNode } from 'react';
import { Button, Card } from '@/shared/ui';
import { formatMoney, type DeliveryFranchiseDue } from '../api/settlementsApi';
import { fetchHubPaymentSubmissions } from '../api/hubPaymentApi';
import { HubPaymentVerificationPanel } from './HubPaymentVerificationPanel';
import { HubPaymentHistoryPanel } from './HubPaymentHistoryPanel';
import { HubPaymentRequestsAdminPanel } from './HubPaymentRequestsAdminPanel';

/** KoyaKart → hub vs hub → KoyaKart — never mixed on one screen. */
export type HubPayoutTab = 'app-to-hub' | 'hub-to-app';

export type HubPaysSubTab = 'cod-statement' | 'records' | 'franchise-bill' | 'awaiting' | 'history';

const HUB_PAYS_SUB_TABS: { id: HubPaysSubTab; label: string }[] = [
  { id: 'cod-statement', label: 'Issue COD statement' },
  { id: 'records', label: 'Records' },
  { id: 'franchise-bill', label: 'Issue franchise bill' },
  { id: 'awaiting', label: 'Awaiting your confirmation' },
  { id: 'history', label: 'Payment history' },
];

type Props = {
  tab: HubPayoutTab;
  onTab: (t: HubPayoutTab) => void;
  token: string;
  townId: string;
  hubId: string;
  hubName: string;
  from: string;
  to: string;
  refreshTick: number;
  onPaymentReviewed: () => void;
  franchise: DeliveryFranchiseDue | null;
  selectedTotal: number;
  selectedCount: number;
  openCount: number;
  loading: boolean;
  onRefresh: () => void;
  onMarkPaid: () => void;
  onMarkFranchise: () => void;
  canPayOrders: boolean;
  canCollectFranchise: boolean;
  saving: boolean;
  commissionSection: ReactNode;
  recordsSection: ReactNode;
  onSubTabChange?: (tab: HubPaysSubTab) => void;
};

export function HubPayoutWorkspace({
  tab,
  onTab,
  token,
  townId,
  hubId,
  hubName,
  from,
  to,
  refreshTick,
  onPaymentReviewed,
  franchise,
  selectedTotal,
  selectedCount,
  openCount,
  loading,
  onRefresh,
  onMarkPaid,
  onMarkFranchise,
  canPayOrders,
  canCollectFranchise,
  saving,
  commissionSection,
  recordsSection,
  onSubTabChange,
}: Props) {
  const showFranchise = !!franchise?.enabled;
  const franchiseCollected = !!franchise?.alreadyCollected;
  const [hubPaysTab, setHubPaysTab] = useState<HubPaysSubTab>('cod-statement');
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [pendingTick, setPendingTick] = useState(0);
  const pendingKeyRef = useRef<string | null>(null);

  const loadAwaitingCount = useCallback(async () => {
    if (!token || !townId || !hubId) {
      setAwaitingCount(0);
      return;
    }
    try {
      const rows = await fetchHubPaymentSubmissions(token, townId, hubId);
      const pending = rows.filter((r) => r.status === 'PENDING_VERIFICATION');
      setAwaitingCount(pending.length);
      const key = pending.map((r) => r.submissionId).sort().join(',');
      const prev = pendingKeyRef.current;
      pendingKeyRef.current = key;
      if (prev !== null && prev !== key) setPendingTick((n) => n + 1);
    } catch {
      setAwaitingCount(0);
    }
  }, [token, townId, hubId]);

  useEffect(() => {
    pendingKeyRef.current = null;
  }, [townId, hubId]);

  useEffect(() => {
    void loadAwaitingCount();
  }, [loadAwaitingCount, refreshTick]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadAwaitingCount();
    };
    const timer = window.setInterval(onVisible, 30_000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadAwaitingCount]);

  return (
    <div style={styles.root}>
      <nav className="hub-payout-tabs" style={styles.tabs} role="tablist" aria-label="Money direction">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'app-to-hub'}
          style={tab === 'app-to-hub' ? styles.tabOnApp : styles.tabOff}
          onClick={() => onTab('app-to-hub')}
        >
          KoyaKart pays hub
          {openCount > 0 ? <span style={styles.tabBadge}>{openCount}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'hub-to-app'}
          style={tab === 'hub-to-app' ? styles.tabOnHub : styles.tabOff}
          onClick={() => onTab('hub-to-app')}
        >
          Hub pays KoyaKart
          {awaitingCount > 0 ? ` (${awaitingCount})` : ''}
        </button>
      </nav>

      {tab === 'app-to-hub' ? (
        <div style={styles.panel}>
          <Card padding="sm" style={styles.scopeCardApp}>
            <p style={styles.scopeTitle}>Delivery commission only</p>
            <p style={styles.muted}>
              Pay the hub for completed trips in the date range above. Franchise and COD are on the other tab.
            </p>
            <div style={styles.scopeHero}>
              <span style={styles.scopeLabel}>Selected to pay</span>
              <strong style={styles.scopeAmount}>{formatMoney(selectedTotal)}</strong>
              <span style={styles.muted}>
                {selectedCount} of {openCount} payable trips selected
              </span>
            </div>
            <Button size="sm" disabled={!canPayOrders || saving} onClick={onMarkPaid}>
              {saving ? 'Saving…' : `Mark paid · ${formatMoney(selectedTotal)}`}
            </Button>
          </Card>
          {commissionSection}
        </div>
      ) : null}

      {tab === 'hub-to-app' ? (
        <div style={styles.panel}>
          <Card padding="sm" style={styles.scopeCardHub}>
            <div style={styles.scopeHeadRow}>
              <div style={styles.scopeHeadText}>
                <p style={styles.scopeTitle}>Hub pays KoyaKart</p>
                <p style={styles.muted}>
                  Issue bills or open Records — collections stay on their own tab so large histories stay fast.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onRefresh();
                  void loadAwaitingCount();
                }}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            <nav style={styles.subTabs} role="tablist" aria-label="Hub pays KoyaKart">
              {HUB_PAYS_SUB_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={hubPaysTab === t.id}
                  style={hubPaysTab === t.id ? styles.subTabOn : styles.subTabOff}
                  onClick={() => {
                    setHubPaysTab(t.id);
                    onSubTabChange?.(t.id);
                  }}
                >
                  {t.id === 'awaiting' && awaitingCount > 0 ? `${t.label} (${awaitingCount})` : t.label}
                </button>
              ))}
            </nav>
          </Card>

          {hubPaysTab === 'cod-statement' ? (
            <HubPaymentRequestsAdminPanel
              token={token}
              townId={townId}
              hubId={hubId}
              refreshTick={refreshTick}
              onChanged={onPaymentReviewed}
              section="cod"
            />
          ) : null}

          {hubPaysTab === 'records' ? recordsSection : null}

          {hubPaysTab === 'franchise-bill' ? (
            <HubPaymentRequestsAdminPanel
              token={token}
              townId={townId}
              hubId={hubId}
              refreshTick={refreshTick}
              onChanged={onPaymentReviewed}
              section="franchise"
            />
          ) : null}

          {hubPaysTab === 'awaiting' ? (
            <HubPaymentVerificationPanel
              token={token}
              townId={townId}
              hubId={hubId}
              refreshTick={refreshTick + pendingTick}
              onReviewed={() => {
                onPaymentReviewed();
                void loadAwaitingCount();
              }}
            />
          ) : null}

          {hubPaysTab === 'history' ? (
            <HubPaymentHistoryPanel
              token={token}
              townId={townId}
              hubId={hubId}
              hubName={hubName}
              refreshTick={refreshTick + pendingTick}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.35rem',
    padding: '0.3rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
  },
  tabOnApp: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.5rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #ecfdf5, #d1fae5)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#a7f3d0',
    fontFamily: 'inherit',
    color: '#14532d',
    position: 'relative',
  },
  tabOnHub: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.5rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #fff7ed, #ffedd5)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#fed7aa',
    fontFamily: 'inherit',
    color: '#9a3412',
    position: 'relative',
  },
  tabOff: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.5rem',
    fontWeight: 650,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'transparent',
    fontFamily: 'inherit',
    color: 'var(--text-muted)',
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    minWidth: '1rem',
    height: '1rem',
    padding: '0 0.25rem',
    borderRadius: 999,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.58rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
  },
  panel: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  scopeCardApp: {
    gap: '0.4rem',
    border: '1px solid #a7f3d0',
    background: 'color-mix(in srgb, #ecfdf5 40%, var(--bg-elevated))',
  },
  scopeCardHub: {
    gap: '0.4rem',
    border: '1px solid #fed7aa',
    background: 'color-mix(in srgb, #fff7ed 45%, var(--bg-elevated))',
  },
  scopeTitle: { margin: 0, fontWeight: 900, fontSize: '0.9rem' },
  scopeHeadRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.45rem',
  },
  scopeHeadText: { flex: '1 1 12rem', display: 'grid', gap: '0.25rem', minWidth: 0 },
  subTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    marginTop: '0.35rem',
    paddingTop: '0.45rem',
    borderTop: '1px solid color-mix(in srgb, #fed7aa 80%, var(--border))',
  },
  subTabOn: {
    border: '1px solid #059669',
    borderRadius: 999,
    padding: '0.32rem 0.65rem',
    background: '#ecfdf5',
    color: '#14532d',
    fontWeight: 800,
    fontSize: '0.68rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.25,
    textAlign: 'left',
  },
  subTabOff: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.32rem 0.65rem',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    fontWeight: 650,
    fontSize: '0.68rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.25,
    textAlign: 'left',
  },
  scopeHero: { display: 'grid', gap: '0.12rem' },
  scopeLabel: { fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  scopeAmount: { fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' },
  franchiseOk: {
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    background: '#ecfdf5',
    border: '1px solid #bbf7d0',
    display: 'grid',
    gap: '0.25rem',
  },
  franchiseDue: {
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    display: 'grid',
    gap: '0.25rem',
  },
  muted: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 },
};
