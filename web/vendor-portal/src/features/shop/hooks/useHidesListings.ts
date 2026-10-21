import { useEffect, useState } from 'react';
import { apiRequest } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';

const CACHE_KEY = 'hlm.vendor.hidesListings';

type MeHint = { hidesListings?: boolean; serviceName?: string };

function isLaundryService(name: string | undefined): boolean {
  return /laundry/i.test(name ?? '');
}

export function catalogHiddenForVendor(me: MeHint | null | undefined): boolean {
  if (!me) return false;
  return Boolean(me.hidesListings) || isLaundryService(me.serviceName);
}

function readCached(vendorId: string | undefined): boolean {
  if (!vendorId) return false;
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '') as {
      vendorId?: string;
      hides?: boolean;
      serviceName?: string;
    };
    if (parsed.vendorId !== vendorId) return false;
    return catalogHiddenForVendor({ hidesListings: parsed.hides, serviceName: parsed.serviceName });
  } catch {
    return false;
  }
}

function writeCached(vendorId: string, me: MeHint) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ vendorId, hides: catalogHiddenForVendor(me), serviceName: me.serviceName ?? '' }),
  );
}

/** True for laundry vendors: no grocery Listings or Sellers. */
export function useHidesListings(): boolean {
  const { session, updateSession } = useAuth();
  const token = session?.accessToken;
  const vendorId = session?.vendorId;
  const fromSession = catalogHiddenForVendor({
    hidesListings: session?.hidesListings,
    serviceName: session?.serviceName,
  });
  const [hidesListings, setHidesListings] = useState(() => fromSession || readCached(vendorId));

  useEffect(() => {
    const next = fromSession || readCached(vendorId);
    setHidesListings(next);
    if (!token || !vendorId) return;
    let cancelled = false;
    void apiRequest<MeHint>('/api/v1/vendors/me', { token })
      .then((me) => {
        const hides = catalogHiddenForVendor(me);
        writeCached(vendorId, me);
        updateSession({
          hidesListings: hides,
          serviceName: me.serviceName ?? session?.serviceName,
        });
        if (!cancelled) setHidesListings(hides);
      })
      .catch(() => {
        if (!cancelled) setHidesListings(fromSession || readCached(vendorId));
      });
    return () => {
      cancelled = true;
    };
  }, [token, vendorId, fromSession, session?.serviceName, updateSession]);

  return hidesListings;
}
