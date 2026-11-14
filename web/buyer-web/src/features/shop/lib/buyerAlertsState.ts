import type { BuyerNotificationDto } from '../api/notificationsApi';

const GLOBAL_SEEN_KEY = 'hlm.buyer.alerts.globalSeenAt';
const ORDER_SEEN_KEY = 'hlm.buyer.alerts.orderSeenAt';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readAlertsGlobalSeenAt(): number {
  const raw = localStorage.getItem(GLOBAL_SEEN_KEY);
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function markAlertsGlobalSeenAt(at = Date.now()) {
  localStorage.setItem(GLOBAL_SEEN_KEY, new Date(at).toISOString());
}

export function readOrderAlertsSeenAt(orderId: string): number {
  const map = readJson<Record<string, string>>(ORDER_SEEN_KEY) ?? {};
  const raw = map[orderId];
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function markOrderAlertsSeen(orderId: string, at = Date.now()) {
  const map = readJson<Record<string, string>>(ORDER_SEEN_KEY) ?? {};
  map[orderId] = new Date(at).toISOString();
  localStorage.setItem(ORDER_SEEN_KEY, JSON.stringify(map));
}

/** One row per status event — prefer PUSH over duplicate SMS. */
export function dedupeBuyerInbox(items: BuyerNotificationDto[]): BuyerNotificationDto[] {
  const byKey = new Map<string, BuyerNotificationDto>();
  for (const n of items) {
    const channel = n.channel.toUpperCase();
    if (channel !== 'PUSH' && channel !== 'SMS') continue;
    const at = new Date(n.createdAt).getTime();
    const bucket = Number.isNaN(at) ? n.id : Math.floor(at / 1000);
    const key = `${n.orderId ?? n.id}:${n.eventCode}:${bucket}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, n);
      continue;
    }
    if (channel === 'PUSH' && existing.channel.toUpperCase() !== 'PUSH') {
      byKey.set(key, n);
    }
  }
  return [...byKey.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function notificationCreatedMs(n: BuyerNotificationDto): number {
  const t = new Date(n.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function isNotificationUnread(n: BuyerNotificationDto, globalSeenAt: number): boolean {
  const at = notificationCreatedMs(n);
  if (at <= 0) return false;
  const orderSeen = n.orderId ? readOrderAlertsSeenAt(n.orderId) : 0;
  const seenAt = Math.max(globalSeenAt, orderSeen);
  return at > seenAt;
}

export function buyerOrderPath(orderId: string, body?: string | null): string {
  const head = (body ?? '').split('·')[0]?.trim().toLowerCase() ?? '';
  if (head.startsWith('diagnostics')) return `/diagnostics/orders/${orderId}`;
  if (head.startsWith('laundry')) return `/laundry/orders/${orderId}`;
  if (head.startsWith('beauty') || head.startsWith('glam')) return `/beauty/orders/${orderId}`;
  return `/orders/${orderId}`;
}
