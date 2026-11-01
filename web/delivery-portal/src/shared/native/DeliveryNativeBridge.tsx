import { useLocation } from 'react-router-dom';
import { NativeAppBridge } from '@hlm-native';

const HUB_TAB_ROOTS = [
  '/hub',
  '/hub/boys',
  '/hub/cod',
  '/hub/memberships',
  '/hub/claims',
  '/hub/reports',
  '/hub/accounts',
  '/hub/incentives',
] as const;

const AGENT_TAB_ROOTS = [
  '/agent',
  '/agent/pickups',
  '/agent/deliveries',
  '/agent/cod-handover',
  '/agent/history',
  '/agent/pay',
] as const;

/** Picks tab roots from current hub vs agent section. */
export function DeliveryNativeBridge() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/hub')) {
    return <NativeAppBridge tabRoots={HUB_TAB_ROOTS} />;
  }
  if (pathname.startsWith('/agent')) {
    return <NativeAppBridge tabRoots={AGENT_TAB_ROOTS} />;
  }
  return <NativeAppBridge tabRoots={['/login']} loginPath="/login" />;
}
