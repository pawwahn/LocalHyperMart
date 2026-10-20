import type { TownVm } from '@/features/towns/api/townsApi';

function coord(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Great-circle distance in kilometers. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type NearestTown = { town: TownVm; km: number; limitKm: number; within: boolean };

/** Closest enabled town that has a center. `within` is true when the point is inside that town's radius. */
export function nearestOpenTown(
  towns: TownVm[],
  latitude: number,
  longitude: number,
): NearestTown | null {
  let best: NearestTown | null = null;
  for (const town of towns) {
    if (!town.acceptingOrders) continue;
    const lat = coord(town.latitude);
    const lng = coord(town.longitude);
    if (lat == null || lng == null) continue;
    const radius = coord(town.coverageRadiusKm);
    const limitKm = radius != null && radius > 0 ? radius : 10;
    const km = haversineKm(latitude, longitude, lat, lng);
    if (!best || km < best.km) best = { town, km, limitKm, within: km <= limitKm };
  }
  return best;
}
