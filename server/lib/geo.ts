// ONE shared great-circle distance. Was re-implemented ~10 times across the
// matching engines (providerSearch, booking-search, JobDispatch, Emergency,
// PetTrek dispatch + fare, PawFinder, marketplace-bookings, station-recommend,
// GeolocationService) with divergent copies — plus a couple that return METERS
// (geofence checks, staff onboarding). Centralised here so distance math has a
// single source of truth. Each engine's local function now delegates to these,
// so call sites are unchanged (behaviour identical). (2026-07-29)

const toRad = (v: number) => (v * Math.PI) / 180;
const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in KILOMETRES (haversine, R = 6371 km). */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Great-circle distance in METRES (for geofence / proximity-in-metres checks). */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return haversineKm(aLat, aLng, bLat, bLng) * 1000;
}
