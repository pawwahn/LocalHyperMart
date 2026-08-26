import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { listPendingScratchCards, type ScratchCardDto } from '../api/shopApi';
import { ScratchCardSheet } from './ScratchCardSheet';

const DISMISS_KEY = 'hlm.scratch.dismissed';

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
}

/** Shows an unrevealed delivery scratch card on any buyer screen. */
export function ScratchCardHost() {
  const { session, isAuthenticated } = useAuth();
  const token = session?.accessToken ?? '';
  const [card, setCard] = useState<ScratchCardDto | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setCard(null);
      return;
    }
    try {
      const pending = await listPendingScratchCards(token);
      const dismissed = readDismissed();
      setCard((current) => {
        if (current?.status === 'REVEALED') return current;
        return pending.find((item) => item.status === 'ISSUED' && !dismissed.has(item.id)) ?? null;
      });
    } catch {
      /* keep current overlay */
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    window.addEventListener('hlm:scratch-refresh', onFocus);
    const timer = window.setInterval(onFocus, 20_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('hlm:scratch-refresh', onFocus);
      window.clearInterval(timer);
    };
  }, [reload]);

  if (!card || !token) return null;

  return (
    <ScratchCardSheet
      key={card.id}
      card={card}
      token={token}
      onClose={() => {
        if (card.status === 'ISSUED') {
          const dismissed = readDismissed();
          dismissed.add(card.id);
          writeDismissed(dismissed);
        }
        setCard(null);
      }}
      onRevealed={(next) => {
        setCard(next);
      }}
    />
  );
}
