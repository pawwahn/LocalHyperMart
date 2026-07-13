/** Asia/Kolkata wall clock for hub + agent action times. */
export function formatPortalTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export type ActionEventView = {
  eventType: string;
  createdAt: string;
};

/** Plain-language labels for delivery_events.event_type */
export function actionEventLabel(eventType: string): string {
  switch (eventType) {
    case 'PICKUP_ASSIGNED':
      return 'Hub sent boy to shop';
    case 'LAST_MILE_ASSIGNED':
      return 'Hub sent boy to home';
    case 'REASSIGNED':
      return 'Hub changed boy';
    case 'PICKED_FROM_VENDOR':
      return 'Boy took bag from shop';
    case 'PICKED_FROM_HUB':
      return 'Boy left hub to home';
    case 'BROUGHT_TO_HUB':
      return 'Bag checked in at hub';
    case 'DELIVERED':
      return 'Delivered to customer';
    case 'BUYER_REJECTED':
      return 'Customer refused';
    case 'OTP_OVERRIDE':
      return 'Hub changed OTP';
    default:
      return eventType.replaceAll('_', ' ').toLowerCase();
  }
}
