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
import {
  fetchWalletBalance,
  fetchWalletTransactions,
  type WalletTransactionDto,
} from '@/features/shop/api/shopApi';

const PAGE_SIZE = 40;

type WalletContextValue = {
  balance: number;
  transactions: WalletTransactionDto[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

/** Shared wallet state so header chip and Wallet page always show the same balance. */
export function WalletProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(session?.accessToken));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  const loadingMoreLock = useRef(false);

  const reload = useCallback(async () => {
    if (!session?.accessToken) {
      setBalance(0);
      setTransactions([]);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      hasLoadedOnce.current = false;
      return;
    }
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    const token = session.accessToken;
    const errors: string[] = [];

    try {
      const wallet = await fetchWalletBalance(token);
      setBalance(Number(wallet.balance ?? 0));
    } catch (err) {
      if (!hasLoadedOnce.current) setBalance(0);
      errors.push(err instanceof Error ? err.message : 'Could not load balance');
    }

    try {
      const page = await fetchWalletTransactions(token, { limit: PAGE_SIZE, offset: 0 });
      setTransactions(page.items ?? []);
      setHasMore(Boolean(page.hasMore));
    } catch (err) {
      if (!hasLoadedOnce.current) {
        setTransactions([]);
        setHasMore(false);
      }
      errors.push(err instanceof Error ? err.message : 'Could not load activity');
    }

    setError(errors.length > 0 ? [...new Set(errors)].join(' · ') : null);
    hasLoadedOnce.current = true;
    setLoading(false);
  }, [session?.accessToken]);

  const loadMore = useCallback(async () => {
    if (!session?.accessToken || !hasMore || loadingMoreLock.current) return;
    loadingMoreLock.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchWalletTransactions(session.accessToken, {
        limit: PAGE_SIZE,
        offset: transactions.length,
      });
      const next = page.items ?? [];
      setTransactions((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...next.filter((t) => !seen.has(t.id))];
      });
      setHasMore(Boolean(page.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more activity');
    } finally {
      loadingMoreLock.current = false;
      setLoadingMore(false);
    }
  }, [session?.accessToken, hasMore, transactions.length]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!session?.accessToken) return;
    function onVisible() {
      if (document.visibilityState === 'visible') void reload();
    }
    function onInvalidate() {
      void reload();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hlm:wallet-invalidate', onInvalidate);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hlm:wallet-invalidate', onInvalidate);
    };
  }, [session?.accessToken, reload]);

  const value = useMemo(
    () => ({ balance, transactions, hasMore, loading, loadingMore, error, reload, loadMore }),
    [balance, transactions, hasMore, loading, loadingMore, error, reload, loadMore],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
