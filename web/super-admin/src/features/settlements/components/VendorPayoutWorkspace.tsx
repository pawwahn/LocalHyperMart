import { type CSSProperties, type ReactNode } from 'react';
import { Button, Card } from '@/shared/ui';
import { formatMoney } from '../api/settlementsApi';

/** KoyaKart → vendor vs vendor → KoyaKart — never mixed on one screen. */
export type VendorPayoutTab = 'app-to-vendor' | 'vendor-to-app' | 'subscription';

export type VendorAppSubTab = 'pay' | 'records';
export type VendorPaysSubTab = 'collect' | 'records';

type Props = {
  tab: VendorPayoutTab;
  onTab: (t: VendorPayoutTab) => void;
  appSubTab: VendorAppSubTab;
  onAppSubTab: (t: VendorAppSubTab) => void;
  paysSubTab: VendorPaysSubTab;
  onPaysSubTab: (t: VendorPaysSubTab) => void;
  onCheckRecords?: () => void;
  remindingBills?: boolean;
  awaitingBillCount?: number;
  paidBillCount?: number;
  onConfirmReceived?: () => void;
  payOpenCount: number;
  collectOpenCount: number;
  /** Shop-fee bills sent and not yet confirmed received. */
  outstandingCollect?: number;
  outstandingBillCount?: number;
  selectedCount: number;
  selectedGross: number;
  expectedNet: number;
  netPending?: boolean;
  loading: boolean;
  saving: boolean;
  canSubmit: boolean;
  submitHint?: string | null;
  onRefresh: () => void;
  onSubmit: () => void;
  canSendBill: boolean;
  sendBillHint?: string | null;
  onSendBill: () => void;
  workSection: ReactNode;
  payRecords: ReactNode;
  collectRecords: ReactNode;
  subscriptionSection: ReactNode;
  subscriptionDueCount: number;
  /** Paid payouts the vendor said did not arrive. Admin must correct the record. */
  needsActionCount?: number;
};

export function VendorPayoutWorkspace({
  tab,
  onTab,
  appSubTab,
  onAppSubTab,
  paysSubTab,
  onPaysSubTab,
  onCheckRecords,
  remindingBills,
  awaitingBillCount = 0,
  paidBillCount = 0,
  onConfirmReceived,
  payOpenCount,
  collectOpenCount,
  outstandingCollect = 0,
  outstandingBillCount = 0,
  selectedCount,
  selectedGross,
  expectedNet,
  netPending,
  loading,
  saving,
  canSubmit,
  submitHint,
  onRefresh,
  onSubmit,
  canSendBill,
  sendBillHint,
  onSendBill,
  workSection,
  payRecords,
  collectRecords,
  subscriptionSection,
  subscriptionDueCount,
  needsActionCount = 0,
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
          {needsActionCount > 0 ? <span style={styles.tabParen}> ({needsActionCount})</span> : null}
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'subscription'}
          style={tab === 'subscription' ? styles.tabOnSub : styles.tabOff}
          onClick={() => onTab('subscription')}
        >
          Subscription bill
          {subscriptionDueCount > 0 ? <span style={styles.tabBadgePurple}>{subscriptionDueCount}</span> : null}
        </button>
      </nav>

      {tab === 'subscription' ? <div style={styles.panel}>{subscriptionSection}</div> : null}

      {tab === 'app-to-vendor' ? (
        <div style={styles.panel}>
          <Card padding="sm" style={styles.scopeCardApp}>
            <div style={styles.scopeHeadRow}>
              <div style={styles.scopeHeadText}>
                <p style={styles.scopeTitle}>Pay for cash we hold</p>
                <p style={styles.muted}>
                  Online UPI and hub COD. Net = bag total − order commission / slabs − claims. Monthly subscription
                  is a separate bill.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            <div style={styles.scopeHero}>
              <span style={styles.scopeLabel}>Selected to pay</span>
              <strong style={styles.scopeAmount}>{netPending ? '…' : formatMoney(expectedNet)}</strong>
              <span style={styles.muted}>
                {selectedCount} of {payOpenCount} bags · {formatMoney(selectedGross)} gross
              </span>
            </div>
            <Button size="sm" disabled={!canSubmit || saving} onClick={onSubmit}>
              {saving ? 'Saving…' : netPending ? 'Calculating…' : `Mark paid · ${formatMoney(expectedNet)}`}
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
                {needsActionCount > 0 ? <span style={styles.tabParen}> ({needsActionCount})</span> : null}
              </button>
            </nav>
          </Card>
          {appSubTab === 'pay' ? workSection : payRecords}
        </div>
      ) : null}

      {tab === 'vendor-to-app' ? (
        <div style={styles.panel}>
          {paysSubTab === 'collect' ? (
            workSection
          ) : (
            <>
              <CollectFeesCard
                loading={loading}
                saving={saving}
                canSubmit={canSubmit}
                canSendBill={canSendBill}
                sendBillHint={sendBillHint}
                selectedCount={selectedCount}
                selectedGross={selectedGross}
                expectedNet={expectedNet}
                netPending={netPending}
                outstandingCollect={outstandingCollect}
                outstandingBillCount={outstandingBillCount}
                paysSubTab={paysSubTab}
                onPaysSubTab={onPaysSubTab}
                onRefresh={onRefresh}
                onSubmit={onSubmit}
                onSendBill={onSendBill}
                onCheckRecords={onCheckRecords}
                remindingBills={remindingBills}
                awaitingBillCount={awaitingBillCount}
                paidBillCount={paidBillCount}
                onConfirmReceived={onConfirmReceived}
              />
              {collectRecords}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CollectFeesCard({
  loading,
  saving,
  canSubmit,
  canSendBill,
  sendBillHint,
  selectedCount,
  selectedGross,
  expectedNet,
  netPending,
  outstandingCollect = 0,
  outstandingBillCount = 0,
  paysSubTab,
  onPaysSubTab,
  onRefresh,
  onSubmit,
  onSendBill,
  onCheckRecords,
  remindingBills,
  awaitingBillCount = 0,
  paidBillCount = 0,
  onConfirmReceived,
  attached,
}: {
  loading: boolean;
  saving: boolean;
  canSubmit: boolean;
  canSendBill: boolean;
  sendBillHint?: string | null;
  selectedCount: number;
  selectedGross: number;
  expectedNet: number;
  netPending?: boolean;
  outstandingCollect?: number;
  outstandingBillCount?: number;
  paysSubTab: VendorPaysSubTab;
  onPaysSubTab: (t: VendorPaysSubTab) => void;
  onRefresh: () => void;
  onSubmit: () => void;
  onSendBill: () => void;
  onCheckRecords?: () => void;
  remindingBills?: boolean;
  awaitingBillCount?: number;
  paidBillCount?: number;
  onConfirmReceived?: () => void;
  /** Sits flush on the orders table — no gap, shared bottom edge. */
  attached?: boolean;
}) {
  const vendorPaidWaiting = paidBillCount > 0 && awaitingBillCount === 0 && selectedCount === 0;
  const billedOnly = outstandingCollect > 0 && selectedCount === 0 && !vendorPaidWaiting;
  const stillToCollect = Math.round((expectedNet + outstandingCollect) * 100) / 100;
  return (
    <Card padding="sm" style={attached ? styles.scopeCardAttached : styles.scopeCardHub}>
      <div style={styles.collectTop}>
        <div style={styles.scopeHeadText}>
          <p style={styles.scopeTitle}>Collect fees from shop</p>
          <p style={styles.muted}>
            {vendorPaidWaiting
              ? `Vendor paid · ${paidBillCount} payment${paidBillCount === 1 ? '' : 's'} to confirm`
              : billedOnly
              ? `${outstandingBillCount} bill${outstandingBillCount === 1 ? '' : 's'} sent · not received yet`
              : outstandingCollect > 0
                ? `${selectedCount} bag${selectedCount === 1 ? '' : 's'} · ${formatMoney(selectedGross)} at the shop · ${formatMoney(outstandingCollect)} already billed`
                : `${selectedCount} bag${selectedCount === 1 ? '' : 's'} · ${formatMoney(selectedGross)} already at the shop`}
          </p>
        </div>
        <div style={styles.collectAmount}>
          <span style={styles.scopeLabel}>To collect</span>
          <strong style={styles.collectAmountValue}>
            {netPending ? (outstandingCollect > 0 ? formatMoney(outstandingCollect) : '…') : formatMoney(stillToCollect)}
          </strong>
        </div>
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      <div style={styles.collectActions}>
        {vendorPaidWaiting ? (
          <Button size="sm" disabled={saving} onClick={() => onConfirmReceived?.()}>
            Confirm received
          </Button>
        ) : billedOnly ? (
          <Button
            size="sm"
            disabled={remindingBills}
            onClick={() => (onCheckRecords ? onCheckRecords() : onPaysSubTab('records'))}
          >
            {remindingBills ? 'Reminding…' : 'Check payment in Records'}
          </Button>
        ) : (
          <>
            <Button size="sm" disabled={!canSendBill || saving} onClick={onSendBill}>
              {saving ? 'Saving…' : netPending ? 'Calculating…' : `Send bill · ${formatMoney(expectedNet)}`}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canSubmit || saving} onClick={onSubmit}>
              Already received
            </Button>
          </>
        )}
        <span style={styles.muted}>
          {vendorPaidWaiting
            ? 'Check the UTR, then confirm. Reject from Records if the details are wrong.'
            : billedOnly
            ? 'Vendor pays this bill in their portal. Confirm or reject it in Records.'
            : 'Vendor pays in their portal. Confirm or reject in Records.'}
        </span>
      </div>
      {!billedOnly && !canSendBill && sendBillHint ? <p style={styles.submitHint}>{sendBillHint}</p> : null}
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
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  submitHint: { margin: 0, color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700 },
  collectActions: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
  tabOnSub: {
    border: '1px solid #c4b5fd',
    borderRadius: 10,
    padding: '0.55rem 0.5rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #f5f3ff, #ede9fe)',
    fontFamily: 'inherit',
    color: '#5b21b6',
    position: 'relative',
  },
  tabBadgePurple: {
    position: 'absolute',
    top: 4,
    right: 8,
    minWidth: '1rem',
    height: '1rem',
    padding: '0 0.25rem',
    borderRadius: 999,
    background: '#6d28d9',
    color: '#fff',
    fontSize: '0.58rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
  },
  tabParen: { color: '#9a3412', fontWeight: 800 },
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
    display: 'grid',
    gap: '0.45rem',
    border: '1px solid #fed7aa',
    background: 'linear-gradient(180deg, #fff7ed 0%, var(--bg-elevated) 72%)',
  },
  scopeCardAttached: {
    display: 'grid',
    gap: '0.4rem',
    border: '1px solid #fed7aa',
    borderBottom: 'none',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    background: 'linear-gradient(180deg, #fff7ed 0%, var(--bg-elevated) 78%)',
    marginBottom: 0,
    boxShadow: 'none',
    padding: '0.55rem 0.7rem 0.4rem',
  },
  collectTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  collectAmount: {
    marginLeft: 'auto',
    display: 'grid',
    justifyItems: 'end',
    gap: '0.02rem',
    padding: '0.15rem 0.55rem',
    borderRadius: 10,
    background: 'color-mix(in srgb, #fff 70%, #ffedd5)',
    border: '1px solid #fed7aa',
  },
  collectAmountValue: {
    fontSize: '1.15rem',
    fontWeight: 900,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    color: '#9a3412',
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
