import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { fetchMyProfile } from '../api/userApi';

/** Buyer first name from `GET /users/me`. */
export function useBuyerDisplayName(): string | null {
  const { session } = useAuth();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) {
      setName(null);
      return;
    }
    let cancelled = false;
    void fetchMyProfile(session.accessToken)
      .then((profile) => {
        if (cancelled) return;
        const first = profile.firstName?.trim();
        setName(first || null);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  return name;
}
