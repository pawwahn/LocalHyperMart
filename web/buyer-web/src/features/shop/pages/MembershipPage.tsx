import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useShop } from '../hooks/useShop';
import { MembershipPlansPanel } from '../components/MembershipPlansPanel';

export function MembershipPage() {
  const { cart } = useShop();

  return (
    <PortalShell
      title="Free delivery"
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
    >
      <div style={styles.page}>
        <p style={styles.lead}>Pick a plan. Free delivery on orders that would have charged a fee.</p>
        <MembershipPlansPanel />
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { paddingBottom: '0.4rem', display: 'grid', gap: '0.45rem' },
  lead: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 },
};
