import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { fetchMyStats } from '../api/agentApi';

/** Shop-owned delivery agent (vendor direct) vs town hub rider. */
export function useAgentKind() {
  const { session } = useAuth();
  const [vendorShop, setVendorShop] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session) {
      setVendorShop(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    void fetchMyStats(session.accessToken)
      .then((stats) => {
        if (!cancelled) setVendorShop(stats.agentType === 'VENDOR');
      })
      .catch(() => {
        if (!cancelled) setVendorShop(false);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { vendorShop, ready };
}
