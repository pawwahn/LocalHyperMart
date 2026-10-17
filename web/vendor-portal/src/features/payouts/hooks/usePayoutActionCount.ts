import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import {
  PAYOUT_ACKED_EVENT,
  PAYOUT_ACTION_EVENT,
  countVendorPayoutActions,
  fetchMySubscriptionBills,
  listMySettlements,
} from '@/features/reports/api/payoutsApi';

/** Settlements and subscriptions waiting on this shop. Shown on the Payouts nav. */
export function usePayoutActionCount(): number {
  const { session } = useAuth();
  const vendorId = session?.vendorId;
  const token = session?.accessToken;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token || !vendorId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      void Promise.all([listMySettlements(token, vendorId), fetchMySubscriptionBills(token, vendorId)])
        .then(([settlements, subscriptions]) => {
          if (!cancelled) setCount(countVendorPayoutActions(settlements, subscriptions));
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(PAYOUT_ACKED_EVENT, load);
    window.addEventListener(PAYOUT_ACTION_EVENT, load);
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener(PAYOUT_ACKED_EVENT, load);
      window.removeEventListener(PAYOUT_ACTION_EVENT, load);
      window.clearInterval(timer);
    };
  }, [token, vendorId]);

  return count;
}
