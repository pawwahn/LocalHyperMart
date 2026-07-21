import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { fetchSubOrders } from '@/features/orders/api/ordersApi';
import {
  ensureNotificationPermission,
  notifyBrowserOrder,
  playOrderReceivedVoice,
  unlockOrderAlertAudio,
} from '@/features/orders/lib/orderAlertSound';

const POLL_MS = 15_000;
/** Re-alert while PLACED orders still sit unacked. */
const NAG_MS = 90_000;

type OrderAlertContextValue = {
  alertMessage: string | null;
  pendingCount: number;
  /** Bumps when a new PLACED order is detected — Home can refresh. */
  alertVersion: number;
  clearAlert: () => void;
  notificationsReady: boolean;
  enableNotifications: () => Promise<boolean>;
};

const OrderAlertContext = createContext<OrderAlertContextValue | null>(null);

export function OrderAlertProvider({ children }: { children: ReactNode }) {
  const { session, isAuthenticated } = useAuth();
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [alertVersion, setAlertVersion] = useState(0);
  const [notificationsReady, setNotificationsReady] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  const knownIds = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const lastAlertAt = useRef(0);

  const clearAlert = useCallback(() => setAlertMessage(null), []);

  const enableNotifications = useCallback(async () => {
    const ok = await ensureNotificationPermission();
    setNotificationsReady(ok);
    return ok;
  }, []);

  // Browsers block sound until the vendor clicks once — unlock on first interaction.
  useEffect(() => {
    if (!isAuthenticated) return;
    const unlock = () => {
      void unlockOrderAlertAudio();
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [isAuthenticated]);

  const fireAlert = useCallback(
    (msg: string, opts?: { nag?: boolean }) => {
      setAlertMessage(msg);
      lastAlertAt.current = Date.now();
      if (!opts?.nag) {
        setAlertVersion((v) => v + 1);
      }
      // Play even if tab is backgrounded/minimized (needs prior unlock via click / Test).
      playOrderReceivedVoice();
      notifyBrowserOrder('HyperLocalMart — new order', msg);
      void ensureNotificationPermission().then((ok) => setNotificationsReady(ok));
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated || !session) {
      knownIds.current = new Set();
      seeded.current = false;
      setPendingCount(0);
      setAlertMessage(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const placed = await fetchSubOrders(session!.accessToken, session!.vendorId, 'PLACED');
        if (cancelled) return;
        const nextIds = new Set(placed.map((o) => o.id));
        setPendingCount(nextIds.size);

        if (!seeded.current) {
          knownIds.current = nextIds;
          seeded.current = true;
          if (nextIds.size > 0) {
            setAlertMessage(
              nextIds.size === 1
                ? `1 order waiting — pack and mark Ready`
                : `${nextIds.size} orders waiting — pack and mark Ready`,
            );
          }
          return;
        }

        const newcomers = placed.filter((o) => !knownIds.current.has(o.id));
        knownIds.current = nextIds;

        if (newcomers.length > 0) {
          const msg =
            newcomers.length === 1
              ? `New order ${newcomers[0].subOrderNumber} — needs packing`
              : `${newcomers.length} new orders need packing`;
          fireAlert(msg);
          return;
        }

        // Still have open PLACED? Nudge so they don't forget (sound + banner).
        if (nextIds.size > 0 && Date.now() - lastAlertAt.current >= NAG_MS) {
          fireAlert(
            nextIds.size === 1
              ? `Still 1 order waiting — pack and mark Ready`
              : `Still ${nextIds.size} orders waiting — pack and mark Ready`,
            { nag: true },
          );
        }
      } catch {
        /* quiet on poll errors */
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, session, fireAlert]);

  const value = useMemo(
    () => ({
      alertMessage,
      pendingCount,
      alertVersion,
      clearAlert,
      notificationsReady,
      enableNotifications,
    }),
    [
      alertMessage,
      pendingCount,
      alertVersion,
      clearAlert,
      notificationsReady,
      enableNotifications,
    ],
  );

  return <OrderAlertContext.Provider value={value}>{children}</OrderAlertContext.Provider>;
}

export function useOrderAlert(): OrderAlertContextValue {
  const ctx = useContext(OrderAlertContext);
  if (!ctx) {
    return {
      alertMessage: null,
      pendingCount: 0,
      alertVersion: 0,
      clearAlert: () => undefined,
      notificationsReady: false,
      enableNotifications: async () => false,
    };
  }
  return ctx;
}
