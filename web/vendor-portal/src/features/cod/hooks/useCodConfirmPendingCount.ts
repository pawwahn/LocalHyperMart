import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { fetchPendingCodHandoverCount } from '../api/codHandoverApi';

/** Declarations agents already submitted that this shop has not confirmed yet. */
export function useCodConfirmPendingCount(): number {
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
      void fetchPendingCodHandoverCount(token, vendorId)
        .then((n) => {
          if (!cancelled) setCount(Number.isFinite(n) && n > 0 ? n : 0);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener('hlm:cod-confirm-pending', load);
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener('hlm:cod-confirm-pending', load);
      window.clearInterval(timer);
    };
  }, [token, vendorId]);

  return count;
}
