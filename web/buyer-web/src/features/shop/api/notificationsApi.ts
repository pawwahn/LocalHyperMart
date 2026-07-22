import { apiRequest } from '@/shared/api/http';

export type BuyerNotificationDto = {
  id: string;
  orderId?: string;
  eventCode: string;
  channel: string;
  body?: string;
  status: string;
  createdAt: string;
};

export async function listMyNotifications(token: string, limit = 40): Promise<BuyerNotificationDto[]> {
  const data = await apiRequest<BuyerNotificationDto[]>(`/api/v1/notifications?limit=${limit}`, {
    token,
  });
  return Array.isArray(data) ? data : [];
}
