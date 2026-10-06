import { type CSSProperties, type ReactNode } from 'react';
import { Button, Card } from '@/shared/ui';
import { formatMoney } from '../api/settlementsApi';

/** KoyaKart → vendor vs vendor → KoyaKart — never mixed on one screen. */
export type VendorPayoutTab = 'app-to-vendor' | 'vendor-to-app';

export type VendorAppSubTab = 'pay' | 'records';
export type VendorPaysSubTab = 'collect' | 'records';

type Props = {
  tab: VendorPayoutTab;
  onTab: (t: VendorPayoutTab) => void;
  appSubTab: VendorAppSubTab;
  onAppSubTab: (t: VendorAppSubTab) => void;
  paysSubTab: VendorPaysSubTab;
  onPaysSubTab: (t: VendorPaysSubTab) => void;
  payOpenCount: number;
  collectOpenCount: number;
  selectedCount: number;
  selectedGross: number;
  expectedNet: number;
  loading: boolean;
  saving: boolean;
  canSubmit: boolean;
  submitHint?: string | null;
  onRefresh: () => void;
  onSubmit: () => void;
  workSection: ReactNode;
  payRecords: ReactNode;
  collectRecords: ReactNode;
};

export function VendorPayoutWorkspace({
  tab,
  onTab,
  appSubTab,
  onAppSubTab,
  paysSubTab,
  onPaysSubTab,
  payOpenCount,
  collectOpenCount,
  selectedCount,
  selectedGross,
  expectedNet,
  loading,
  saving,
  canSubmit,
  submitHint,
  onRefresh,
  onSubmit,
  workSection,
  payRecords,
  collectRecords,
}: Props) {
  return (
    <div style={styles.root}>
      <nav className="vendor-payout-tabs" style={styles.tabs} role="tablist" aria-label="Money direction">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'app-to-vendor'}
          style={tab === 'app-to-vendor' ? styles.tabOnApp : styles.tabOff}
          onClick={() => onTab('app-to-vendor')}
        >
          KoyaKart pays vendor
          {payOpenCount > 0 ? <span style={styles.tabBadge}>{payOpenCount}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'vendor-to-app'}
          style={tab === 'vendor-to-app' ? styles.tabOnHub : styles.tabOff}
          onClick={() => onTab('vendor-to-app')}
        >
          Vendor pays KoyaKart
          {collectOpenCount > 0 ? <span style={styles.tabBadgeOrange}>{collectOpenCount}</span> : null}
        </button>
      </nav>

      {tab === 'app-to-vendor' ? (
        <div style={styles.panel}>
          <Card padding="sm" style={styles.scopeCardApp}>
            <div style={styles.scopeHeadRow}>
              <div style={styles.scopeHeadText}>
                <p style={styles.scopeTitle}>Pay for cash we hold</p>
                <p style={styles.muted}>
                  Online UPI and hub COD. Net = bag total − order commission / slabs − claims. Monthly fee is on the
                  other tab.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            <div style={styles.scopeHero}>
              <span style={styles.scopeLabel}>Selected to pay</span>
              <strong style={styles.scopeAmount}>{formatMoney(expectedNet)}</strong>
              <span style={styles.muted}>
                {selectedCount} of {payOpenCount} bags · {formatMoney(selectedGross)} gross
              </span>
            </div>
            <Button size="sm" disabled={!canSubmit || saving} onClick={onSubmit}>
              {saving ? 'Saving…' : `Mark paid · ${formatMoney(expectedNet)}`}
            </Button>
            {submitHint ? <p style={styles.submitHint}>{submitHint}</p> : null}
            <nav style={styles.subTabsApp} role="tablist" aria-label="KoyaKart pays vendor">
              <button
                type="button"
                role="tab"
                aria-selected={appSubTab === 'pay'}
                style={appSubTab === 'pay' ? styles.subTabOn : styles.subTabOff}
                onClick={() => onAppSubTab('pay')}
              >
                Pay bags
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appSubTab === 'records'}
                style={appSubTab === 'records' ? styles.subTabOn : styles.subTabOff}
                onClick={() => onAppSubTab('records')}
              >
                Records
              </button>
            </nav>
          </Card>
          {appSubTab === 'pay' ? workSection : payRecords}
        </div>
      ) : null}

      {tab === 'vendor-to-app' ? (
        <div style={styles.panel}>
          <Card padding="sm" style={styles.scopeCardHub}>
            <div style={styles.scopeHeadRow}>
              <div style={styles.scopeHeadText}>
                <p style={styles.scopeTitle}>Collect fees from shop</p>
                <p style={styles.muted}>
                  Shop-held COD (own staff) plus monthly fee. Cash already at the shop — collect commission / slabs /
                  subscription, then close those bags.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            <div style={styles.scopeHero}>
              <span style={styles.scopeLabel}>To collect</span>
              <strong style={styles.scopeAmount}>{formatMoney(expectedNet)}</strong>
              <span style={styles.muted}>
                {selectedCount} shop-held bag{selectedCount === 1 ? '' : 's'} · {formatMoney(selectedGross)} already at
                shop
              </span>
            </div>
            <Button size="sm" disabled={!canSubmit || saving} onClick={onSubmit}>
              {saving ? 'Saving…' : `Mark received · ${formatMoney(expectedNet)}`}
            </Button>
            {submitHint ? <p style={styles.submitHint}>{submitHint}</p> : null}
            <nav style={styles.subTabsHub} role="tablist" aria-label="Vendor pays KoyaKart">
              <button
                type="button"
                role="tab"
                aria-selected={paysSubTab === 'collect'}
                style={paysSubTab === 'collect' ? styles.subTabOn : styles.subTabOff}
                onClick={() => onPaysSubTab('collect')}
              >
                Collect fees
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={paysSubTab === 'records'}
                style={paysSubTab === 'records' ? styles.subTabOn : styles.subTabOff}
                onClick={() => onPaysSubTab('records')}
              >
                Records
              </button>
            </nav>
          </Card>
          {paysSubTab === 'collect' ? workSection : collectRecords}
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  submitHint: { margin: 0, color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700 },
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
    border: '1px solid #a7f3d0',
    borderRadius: 10,
    padding: '0.55rem 0.5rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #ecfdf5, #d1fae5)',
    fontFamily: 'inherit',
    color: '#14532d',
    position: 'relative',
  },
  tabOnHub: {
    border: '1px solid #fed7aa',
    borderRadius: 10,
    padding: '0.55rem 0.5rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #fff7ed, #ffedd5)',
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
  tabBadgeOrange: {
    position: 'absolute',
    top: 4,
    right: 8,
    minWidth: '1rem',
    height: '1rem',
    padding: '0 0.25rem',
    borderRadius: 999,
    background: '#c2410c',
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
  subTabsApp: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    marginTop: '0.15rem',
    paddingTop: '0.45rem',
    borderTop: '1px solid color-mix(in srgb, #a7f3d0 80%, var(--border))',
  },
  subTabsHub: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    marginTop: '0.15rem',
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
  scopeLabel: {
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  scopeAmount: { fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' },
  muted: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 },
};
