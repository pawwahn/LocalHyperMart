export const PICKUP_SLOTS = [
  { id: '08', label: '8–10 AM', start: '08:00', end: '10:00' },
  { id: '10', label: '10–12', start: '10:00', end: '12:00' },
  { id: '12', label: '12–2 PM', start: '12:00', end: '14:00' },
  { id: '14', label: '2–4 PM', start: '14:00', end: '16:00' },
  { id: '16', label: '4–6 PM', start: '16:00', end: '18:00' },
  { id: '18', label: '6–8 PM', start: '18:00', end: '20:00' },
] as const;

export type PickupSlotId = (typeof PICKUP_SLOTS)[number]['id'];

export function parseBlockedSlotIds(raw?: string | null): PickupSlotId[] {
  const allowed = new Set(PICKUP_SLOTS.map((slot) => slot.id));
  return (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((id): id is PickupSlotId => allowed.has(id as PickupSlotId));
}
