import { apiRequest } from '@/shared/api/http';

export type GatewayId = 'RAZORPAY' | 'CASHFREE' | 'PHONEPE';

export type GatewayAdminRow = {
  gateway: GatewayId;
  label: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  clientVersion: string;
  webhookSecret: string;
  webhookUsername: string;
  webhookPassword: string;
  environment: string;
};

export async function fetchPaymentGateways(token: string): Promise<GatewayAdminRow[]> {
  const data = await apiRequest<GatewayAdminRow[]>('/api/v1/payments/admin/gateways', { token });
  return Array.isArray(data) ? data : [];
}

export async function savePaymentGateways(token: string, rows: GatewayAdminRow[]): Promise<GatewayAdminRow[]> {
  const data = await apiRequest<GatewayAdminRow[]>('/api/v1/payments/admin/gateways', {
    method: 'PUT',
    token,
    body: rows.map((row) => ({
      gateway: row.gateway,
      enabled: row.enabled,
      clientId: row.clientId,
      clientSecret: row.clientSecret,
      clientVersion: row.clientVersion,
      webhookSecret: row.webhookSecret,
      webhookUsername: row.webhookUsername,
      webhookPassword: row.webhookPassword,
      environment: row.environment || 'sandbox',
    })),
  });
  return Array.isArray(data) ? data : [];
}
