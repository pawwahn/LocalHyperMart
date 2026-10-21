import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DashboardPage } from '@/features/orders/pages/DashboardPage';
import { ListingsPage } from '@/features/listings/pages/ListingsPage';
import { ReportsPage } from '@/features/reports/pages/ReportsPage';
import { PayoutAckReminder } from '@/features/payouts/components/PayoutAckReminder';
import { VendorBillReminder } from '@/features/payouts/components/VendorBillReminder';
import { useHidesListings } from '@/features/shop/hooks/useHidesListings';
import { PortalShell } from './PortalShell';
import { PortalChromeProvider, usePortalChromeState } from './PortalChromeContext';

/**
 * Persistent chrome + keep-alive for Home/Listings/Reports so tab switches
 * do not remount those screens or re-show a blank loading state.
 */
export function VendorChromeLayout() {
  return (
    <PortalChromeProvider>
      <VendorChromeLayoutInner />
    </PortalChromeProvider>
  );
}

function VendorChromeLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const chrome = usePortalChromeState();
  const hidesListings = useHidesListings();
  const path = location.pathname;
  const onHome = path === '/dashboard';
  const onListings = path === '/listings' && !hidesListings;
  const onReports = path === '/reports';
  const keepAliveRoute = onHome || onListings || onReports;

  const [homeVisited, setHomeVisited] = useState(onHome);
  const [listingsVisited, setListingsVisited] = useState(onListings);
  const [reportsVisited, setReportsVisited] = useState(onReports);

  useEffect(() => {
    if (hidesListings && (location.pathname === '/listings' || location.pathname === '/sellers')) {
      navigate('/dashboard', { replace: true });
    }
  }, [hidesListings, location.pathname, navigate]);

  useEffect(() => {
    if (onHome) setHomeVisited(true);
    if (onListings) setListingsVisited(true);
    if (onReports) setReportsVisited(true);
  }, [onHome, onListings, onReports]);

  return (
    <PortalShell
      title={chrome.title}
      onRefresh={chrome.onRefresh}
      shopPause={chrome.shopPause}
    >
      {homeVisited ? (
        <KeepAlivePane active={onHome}>
          <DashboardPage active={onHome} />
        </KeepAlivePane>
      ) : null}
      {listingsVisited && !hidesListings ? (
        <KeepAlivePane active={onListings}>
          <ListingsPage active={onListings} />
        </KeepAlivePane>
      ) : null}
      {reportsVisited ? (
        <KeepAlivePane active={onReports}>
          <ReportsPage active={onReports} />
        </KeepAlivePane>
      ) : null}
      {!keepAliveRoute ? <Outlet /> : null}
      <PayoutAckReminder />
      <VendorBillReminder />
    </PortalShell>
  );
}

function KeepAlivePane({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div style={active ? styles.visible : styles.hidden} aria-hidden={!active}>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  visible: { display: 'contents' },
  hidden: { display: 'none' },
};
