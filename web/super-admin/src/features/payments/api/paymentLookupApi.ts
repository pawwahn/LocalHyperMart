import { apiRequest } from '@/shared/api/http';

export type AdminPaymentAttempt = {
  paymentId: string;
  status: string;
  gateway: string;
  amount: number;
  currency?: string;
  orderNumber?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  createdAt?: string;
  paidAt?: string | null;
};

export type AdminOrderPayments = {
  orderId: string;
  orderNumber: string;
  townId: string;
  buyerId: string;
  buyerPhone?: string | null;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  orderTotal: number;
  payments: AdminPaymentAttempt[];
};

export async function lookupOrderPayments(token: string, q: string): Promise<AdminOrderPayments> {
  const query = encodeURIComponent(q.trim());
  return apiRequest<AdminOrderPayments>(`/api/v1/payments/admin/order-payments?q=${query}`, { token });
}
