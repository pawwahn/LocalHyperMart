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

type WalletContextValue = {
  balance: number;
  transactions: WalletTransactionDto[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

/** Shared wallet state so header chip and Wallet page always show the same balance. */
export function WalletProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [loading, setLoading] = useState(Boolean(session?.accessToken));
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(async () => {
    if (!session?.accessToken) {
      setBalance(0);
      setTransactions([]);
      setLoading(false);
      setError(null);
      hasLoadedOnce.current = false;
      return;
    }
    // Soft refresh: keep last balance/activity visible while updating.
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
      const txns = await fetchWalletTransactions(token);
      setTransactions(txns);
    } catch (err) {
      if (!hasLoadedOnce.current) setTransactions([]);
      errors.push(err instanceof Error ? err.message : 'Could not load activity');
    }

    setError(errors.length > 0 ? [...new Set(errors)].join(' · ') : null);
    hasLoadedOnce.current = true;
    setLoading(false);
  }, [session?.accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Quiet background refresh when returning to the tab (no loading flash).
  useEffect(() => {
    if (!session?.accessToken) return;
    function onVisible() {
      if (document.visibilityState === 'visible') void reload();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session?.accessToken, reload]);

  const value = useMemo(
    () => ({ balance, transactions, loading, error, reload }),
    [balance, transactions, loading, error, reload],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
