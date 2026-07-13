import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  downloadOrderInvoice,
  fetchOrderDetail,
  type OrderDetailDto,
} from '../api/shopApi';

export function useOrderDetail(orderId: string | undefined) {
  const { session } = useAuth();
  const [order, setOrder] = useState<OrderDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session || !orderId) {
      setOrder(null);
      setLoading(false);
      setError(!session ? 'Sign in to view this order.' : 'Order not found.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrder(await fetchOrderDetail(session.accessToken, orderId));
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
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
    error,
    invoiceBusy,
    invoiceError,
    reload,
    downloadInvoice,
  };
}
