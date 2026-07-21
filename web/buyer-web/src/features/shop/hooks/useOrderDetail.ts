import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  downloadOrderInvoice,
  fetchOrderDetail,
  type OrderDetailDto,
  type OrderSummaryDto,
} from '../api/shopApi';

const detailCache = new Map<string, OrderDetailDto>();
const inflight = new Map<string, Promise<OrderDetailDto>>();

function cacheKey(orderId: string): string {
  return orderId;
}

/** Warm the detail cache so tapping a row feels instant. */
export function prefetchOrderDetail(token: string, orderId: string): void {
  const key = cacheKey(orderId);
  if (detailCache.has(key) || inflight.has(key)) return;
  const task = fetchOrderDetail(token, orderId)
    .then((data) => {
      detailCache.set(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  void task.catch(() => {
    /* prefetch is best-effort */
  });
}

export function summaryToPreview(summary: OrderSummaryDto): OrderDetailDto {
  return {
    orderId: summary.orderId,
    orderNumber: summary.orderNumber,
    status: summary.status,
    displayStatus: summary.displayStatus,
    placedAt: summary.placedAt,
    itemsSubtotal: Number(summary.totalAmount ?? 0),
    deliveryFee: 0,
    storeCreditApplied: 0,
    totalAmount: Number(summary.totalAmount ?? 0),
    paymentMethod: summary.paymentMethod ?? 'COD',
    paymentStatus: summary.paymentStatus,
    deliveryAddress: null,
    items: [],
    invoicePdfUrl: null,
    timeline: undefined,
  };
}

export function useOrderDetail(orderId: string | undefined, preview?: OrderDetailDto | null) {
  const { session } = useAuth();
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const [order, setOrder] = useState<OrderDetailDto | null>(() => {
    if (!orderId) return null;
    return detailCache.get(cacheKey(orderId)) ?? preview ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (!orderId) return false;
    return !(detailCache.has(cacheKey(orderId)) || preview);
  });
  const [error, setError] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    if (!session || !orderId) {
      setOrder(null);
      setLoading(false);
      setRefreshing(false);
      setError(!session ? 'Sign in to view this order.' : 'Order not found.');
      return;
    }
    const key = cacheKey(orderId);
    const seed = detailCache.get(key) ?? previewRef.current;
    const hasSeed = Boolean(seed);
    if (seed) setOrder((prev) => prev ?? seed);
    if (!hasSeed) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      let data: OrderDetailDto;
      const pending = inflight.get(key);
      if (pending) {
        data = await pending;
      } else {
        const task = fetchOrderDetail(session.accessToken, orderId);
        inflight.set(key, task);
        try {
          data = await task;
        } finally {
          inflight.delete(key);
        }
      }
      detailCache.set(key, data);
      setOrder(data);
    } catch (err) {
      if (!hasSeed) setOrder(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, orderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function downloadInvoice() {
    if (!session || !orderId) return;
    setInvoiceBusy(true);
    setInvoiceError(null);
    try {
      const { blob, filename } = await downloadOrderInvoice(session.accessToken, orderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Could not download invoice');
    } finally {
      setInvoiceBusy(false);
    }
  }

  return {
    order,
    loading,
    refreshing,
    error,
    invoiceBusy,
    invoiceError,
    reload,
    downloadInvoice,
  };
}
