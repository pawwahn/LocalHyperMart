import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { listMyNotifications, type BuyerNotificationDto } from '../api/notificationsApi';
import {
  dedupeBuyerInbox,
  isNotificationUnread,
  markAlertsGlobalSeenAt,
  markOrderAlertsSeen,
  readAlertsGlobalSeenAt,
} from '../lib/buyerAlertsState';

type BuyerAlertsContextValue = {
  items: BuyerNotificationDto[];
  unreadCount: number;
  unreadOrderIds: Set<string>;
  loading: boolean;
  globalSeenAt: number;
  reload: () => Promise<void>;
  markAllSeen: () => void;
  markOrderSeen: (orderId: string) => void;
  hasUnreadOrder: (orderId: string) => boolean;
};

const BuyerAlertsContext = createContext<BuyerAlertsContextValue | null>(null);

const POLL_MS = 45_000;

export function BuyerAlertsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [rawItems, setRawItems] = useState<BuyerNotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalSeenAt, setGlobalSeenAt] = useState(() => readAlertsGlobalSeenAt());
  const [orderSeenTick, setOrderSeenTick] = useState(0);

  const items = useMemo(() => dedupeBuyerInbox(rawItems), [rawItems]);

  const unreadItems = useMemo(
    () => items.filter((n) => isNotificationUnread(n, globalSeenAt)),
    [items, globalSeenAt, orderSeenTick],
  );

  const unreadOrderIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of unreadItems) {
      if (n.orderId) set.add(n.orderId);
    }
    return set;
  }, [unreadItems]);

  const reload = useCallback(async () => {
    if (!token) {
      setRawItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listMyNotifications(token, 60);
      setRawItems(list);
    } catch {
      /* keep last good list */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!token) return undefined;
    const id = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(id);
  }, [reload, token]);

  useEffect(() => {
    if (!token) return undefined;
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload, token]);

  const markAllSeen = useCallback(() => {
    const at = Date.now();
    markAlertsGlobalSeenAt(at);
    setGlobalSeenAt(at);
  }, []);

  const markOrderSeen = useCallback((orderId: string) => {
    markOrderAlertsSeen(orderId);
    setOrderSeenTick((v) => v + 1);
  }, []);

  const hasUnreadOrder = useCallback(
    (orderId: string) => unreadOrderIds.has(orderId),
    [unreadOrderIds],
  );

  const value = useMemo(
    () => ({
      items,
      unreadCount: unreadItems.length,
      unreadOrderIds,
      loading,
      globalSeenAt,
      reload,
      markAllSeen,
      markOrderSeen,
      hasUnreadOrder,
    }),
    [items, unreadItems.length, unreadOrderIds, loading, globalSeenAt, reload, markAllSeen, markOrderSeen, hasUnreadOrder],
  );

  return <BuyerAlertsContext.Provider value={value}>{children}</BuyerAlertsContext.Provider>;
}

export function useBuyerAlerts(): BuyerAlertsContextValue {
  const ctx = useContext(BuyerAlertsContext);
  if (!ctx) {
    return {
      items: [],
      unreadCount: 0,
      unreadOrderIds: new Set(),
      loading: false,
      globalSeenAt: 0,
      reload: async () => {},
      markAllSeen: () => {},
      markOrderSeen: () => {},
      hasUnreadOrder: () => false,
    };
  }
  return ctx;
}
