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
import { ApiError } from '@/shared/api/http';
import {
  acknowledgeVendorAlert,
  fetchPendingVendorAlerts,
  fetchSubOrders,
  type VendorOrderAlertDto,
} from '@/features/orders/api/ordersApi';
import { fetchVendorAlertSettings } from '@/features/orders/api/platformSettingsApi';
import {
  ensureNotificationPermission,
  notifyBrowserOrder,
  playOrderReceivedVoice,
  startOrderAlertLoop,
  stopOrderAlertLoop,
  subscribeOrderAlertAudio,
  unlockOrderAlertAudio,
} from '@/features/orders/lib/orderAlertSound';
import { HubReminderDialog } from '@/features/orders/components/HubReminderDialog';

const POLL_MS = 10_000;

type OrderAlertContextValue = {
  alertMessage: string | null;
  pendingCount: number;
  /** Bumps when a new PLACED order is detected — Home can refresh. */
  alertVersion: number;
  clearAlert: () => void;
  notificationsReady: boolean;
  soundReady: boolean;
  enableNotifications: () => Promise<boolean>;
  enableSound: () => Promise<boolean>;
};

const OrderAlertContext = createContext<OrderAlertContextValue | null>(null);

export function OrderAlertProvider({ children }: { children: ReactNode }) {
  const { session, isAuthenticated } = useAuth();
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [alertVersion, setAlertVersion] = useState(0);
  const [soundReady, setSoundReady] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );
  const [reminders, setReminders] = useState<VendorOrderAlertDto[]>([]);
  const [ackBusy, setAckBusy] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [vendorAlertMessage, setVendorAlertMessage] = useState('Order received');

  const knownIds = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const knownReminderIds = useRef<Set<string>>(new Set());

  const clearAlert = useCallback(() => setAlertMessage(null), []);

  const enableNotifications = useCallback(async () => {
    const ok = await ensureNotificationPermission();
    setNotificationsReady(ok);
    return ok;
  }, []);

  const enableSound = useCallback(async () => {
    const ok = await unlockOrderAlertAudio();
    if (ok) {
      if (reminders.length > 0) startOrderAlertLoop(vendorAlertMessage);
      else playOrderReceivedVoice(vendorAlertMessage);
    }
    return ok;
  }, [reminders.length, vendorAlertMessage]);

  useEffect(() => subscribeOrderAlertAudio(setSoundReady), []);

  useEffect(() => {
    if (reminders.length > 0 && soundReady) startOrderAlertLoop(vendorAlertMessage);
  }, [reminders.length, soundReady, vendorAlertMessage]);

  useEffect(() => {
    if (!isAuthenticated) {
      setVendorAlertMessage('Order received');
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await fetchVendorAlertSettings();
        if (!cancelled) setVendorAlertMessage(settings.vendorOrderAlertMessage);
      } catch {
        /* keep last known global message */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isAuthenticated]);

  // Browsers block sound until the vendor clicks — keep trying until unlock succeeds.
  useEffect(() => {
    if (!isAuthenticated || soundReady) return;
    const unlock = () => {
      void unlockOrderAlertAudio();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [isAuthenticated, soundReady]);

  const fireAlert = useCallback((msg: string) => {
    setAlertMessage(msg);
    setAlertVersion((v) => v + 1);
    // Play even if tab is backgrounded/minimized (needs prior unlock via click / Test).
    playOrderReceivedVoice(vendorAlertMessage);
    notifyBrowserOrder(`HyperLocalMart — ${vendorAlertMessage}`, msg);
    void ensureNotificationPermission().then((ok) => setNotificationsReady(ok));
  }, [vendorAlertMessage]);

  useEffect(() => {
    if (!isAuthenticated || !session) {
      knownIds.current = new Set();
      seeded.current = false;
      knownReminderIds.current = new Set();
      setPendingCount(0);
      setAlertMessage(null);
      setReminders([]);
      stopOrderAlertLoop();
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const [placed, pendingAlerts] = await Promise.all([
          fetchSubOrders(session!.accessToken, session!.vendorId, 'PLACED'),
          fetchPendingVendorAlerts(session!.accessToken, session!.vendorId),
        ]);
        if (cancelled) return;
        const nextIds = new Set(placed.map((o) => o.id));
        setPendingCount(nextIds.size);
        setReminders(pendingAlerts);

        const nextReminderIds = new Set(pendingAlerts.map((a) => a.alertId));
        const newReminders = pendingAlerts.filter((a) => !knownReminderIds.current.has(a.alertId));
        knownReminderIds.current = nextReminderIds;

        if (pendingAlerts.length > 0) {
          startOrderAlertLoop(vendorAlertMessage);
          if (newReminders.length > 0) {
            setAlertVersion((v) => v + 1);
            const first = newReminders[0];
            notifyBrowserOrder(
              `HyperLocalMart — ${vendorAlertMessage}`,
              first.orderNumber
                ? `Hub is calling you for ${first.orderNumber}`
                : 'Hub is calling you — pack this bag',
            );
            void ensureNotificationPermission().then((ok) => setNotificationsReady(ok));
          }
        } else {
          stopOrderAlertLoop();
        }

        if (!seeded.current) {
          knownIds.current = nextIds;
          seeded.current = true;
          // Quiet banner only on first load — no sound for already-waiting orders.
          if (nextIds.size > 0 && pendingAlerts.length === 0) {
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

        if (newcomers.length > 0 && pendingAlerts.length === 0) {
          const msg =
            newcomers.length === 1
              ? `New order ${newcomers[0].subOrderNumber} — needs packing`
              : `${newcomers.length} new orders need packing`;
          fireAlert(msg);
          return;
        }

        if (nextIds.size === 0 && pendingAlerts.length === 0) {
          setAlertMessage(null);
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
      stopOrderAlertLoop();
    };
  }, [isAuthenticated, session, fireAlert, vendorAlertMessage]);

  const currentReminder = reminders[0] ?? null;

  const acknowledgeCurrent = useCallback(async () => {
    if (!session || !currentReminder) return;
    setAckBusy(true);
    setAckError(null);
    try {
      await acknowledgeVendorAlert(session.accessToken, session.vendorId, currentReminder.alertId);
      setReminders((prev) => {
        const next = prev.filter((a) => a.alertId !== currentReminder.alertId);
        if (next.length === 0) stopOrderAlertLoop();
        else startOrderAlertLoop(vendorAlertMessage);
        return next;
      });
      setAlertVersion((v) => v + 1);
    } catch (err) {
      setAckError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not notice this order');
    } finally {
      setAckBusy(false);
    }
  }, [session, currentReminder, vendorAlertMessage]);

  const value = useMemo(
    () => ({
      alertMessage,
      pendingCount,
      alertVersion,
      clearAlert,
      notificationsReady,
      soundReady,
      enableNotifications,
      enableSound,
    }),
    [
      alertMessage,
      pendingCount,
      alertVersion,
      clearAlert,
      notificationsReady,
      soundReady,
      enableNotifications,
      enableSound,
    ],
  );

  return (
    <OrderAlertContext.Provider value={value}>
      {children}
      <HubReminderDialog
        open={Boolean(currentReminder)}
        alertMessage={vendorAlertMessage}
        orderNumber={currentReminder?.orderNumber}
        bagNumber={currentReminder?.subOrderNumber}
        shopName={currentReminder?.shopName}
        busy={ackBusy}
        error={ackError}
        soundReady={soundReady}
        onEnableSound={() => {
          void enableSound();
        }}
        onNoticed={() => {
          void acknowledgeCurrent();
        }}
      />
    </OrderAlertContext.Provider>
  );
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
      soundReady: false,
      enableNotifications: async () => false,
      enableSound: async () => false,
    };
  }
  return ctx;
}
