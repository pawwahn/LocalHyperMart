import { useEffect, useState } from 'react';
import { getPublicPlatformSettings } from '@/features/auth/api/platformSettingsApi';
import { apiRequest } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';

export const DEFAULT_DELIVERY_FEE = 40;

export type DeliveryNudge = {
  addMore: number;
  nextFee: number;
};

export type DeliveryQuote = {
  deliveryFee: number;
  platformFee: number;
  nudge: DeliveryNudge | null;
  progress: number;
};

export function useDeliveryQuote(orderValue: number, enabled = true): DeliveryQuote {
  const { session } = useAuth();
  const { townId } = useTown();
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_DELIVERY_FEE);
  const [platformFee, setPlatformFee] = useState(0);
  const [nudge, setNudge] = useState<DeliveryNudge | null>(null);

  useEffect(() => {
    if (!enabled) {
      setNudge(null);
      return;
    }
    let cancelled = false;
    async function loadFee() {
      try {
        if (townId) {
          const params = new URLSearchParams();
          if (orderValue > 0) params.set('orderValue', String(orderValue));
          const q = params.toString();
          const data = await apiRequest<{
            deliveryFee?: number;
            platformFee?: number;
            addMoreForCheaperDelivery?: number;
            nextDeliveryFee?: number;
          }>(`/api/v1/towns/${townId}/delivery-fee${q ? `?${q}` : ''}`, {
            token: session?.accessToken,
          });
          if (cancelled) return;
          setDeliveryFee(Math.max(0, Number(data?.deliveryFee) || DEFAULT_DELIVERY_FEE));
          setPlatformFee(Math.max(0, Number(data?.platformFee) || 0));
          const addMore = Number(data?.addMoreForCheaperDelivery ?? 0);
          const nextFee = Number(data?.nextDeliveryFee);
          setNudge(
            addMore > 0 && Number.isFinite(nextFee) ? { addMore, nextFee } : null,
          );
          return;
        }
        const s = await getPublicPlatformSettings();
        if (cancelled) return;
        setDeliveryFee(Math.max(0, Number(s.deliveryFee) || DEFAULT_DELIVERY_FEE));
        setPlatformFee(0);
        setNudge(null);
      } catch {
        if (cancelled) return;
        setDeliveryFee(DEFAULT_DELIVERY_FEE);
        setPlatformFee(0);
        setNudge(null);
      }
    }
    void loadFee();
    return () => {
      cancelled = true;
    };
  }, [townId, orderValue, session?.accessToken, enabled]);

  const progress =
    nudge && orderValue + nudge.addMore > 0 ? orderValue / (orderValue + nudge.addMore) : 0;

  return { deliveryFee, platformFee, nudge, progress };
}
