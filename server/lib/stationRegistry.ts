/**
 * PetWash station registry.
 *
 * SINCE 2026-09-18 THE SOURCE IS THE DATABASE: `station_registry`, seeded by
 * migration 0163 from the array below. Opening a station in any other city is
 * now an INSERT, not a code change and a deploy — the thing that kept the
 * product to two bays in Kfar Saba.
 *
 * The array stays as the FALLBACK: if the table is missing or empty (fresh
 * environment, migration not yet applied, DB blip) callers still get the two
 * real stations rather than an empty map. pet_wash_stations is still not
 * usable — NOT NULL FKs to countries + franchise_territories, both empty.
 *
 * Every field is real (CEO-confirmed); dual-bay stations list BOTH Nayax
 * machine IDs so bay transactions (nayax_transaction_events.machine_id) join
 * back to a station.
 */
export interface StationBay {
  machineId: string;      // Nayax machine id (the bookkeeping key)
  terminalId?: string;    // Nayax device/terminal id
  label: string;          // human label, Hebrew
}
export interface Station {
  code: string;           // our station id (PWS-IL-KFS-###)
  nameHe: string;
  nameEn: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  hoursHe: string;
  open: boolean;
  bays: StationBay[];     // dual-bay = 2 entries
  accessHe?: string;      // CEO-confirmed on-site directions (parking, landmark)
  accessEn?: string;
}

/** Fallback only — the live list comes from loadStations(). */
export const STATION_REGISTRY: Station[] = [
  {
    code: 'PWS-IL-KFS-001',
    nameHe: 'פארק יצחק ולד, כפר סבא',
    nameEn: 'Isaac Wald Park, Kfar Saba',
    // CEO-confirmed 2026-07-26: Wald's real address IS Weizmann 185, Kfar Saba.
    // (Do NOT "correct" this from a reverse-geocode — the CEO is the authority.)
    address: 'רחוב ויצמן 185, כפר סבא (מיקוד 4439654)',
    city: 'כפר סבא',
    lat: 32.179964, lng: 34.925016,
    hoursHe: 'כל יום 05:30–23:00',
    // CEO-confirmed 2026-08-01 on-site directions.
    accessHe: 'בתוך הפארק, ליד החניון הראשי; חניה במקום בתשלום (כחול-לבן), ומשם הליכה קצרה אל העמדה.',
    accessEn: 'Inside the park, next to the main parking lot; paid on-site parking (blue-and-white), then a short walk to the bay.',
    open: true,
    bays: [
      { machineId: '182443', terminalId: '369617593', label: 'תא ימין' },
      { machineId: '182462', terminalId: '188843334', label: 'תא שמאל' },
    ],
  },
  {
    code: 'PWS-IL-KFS-002',
    nameHe: 'כפר סבא הירוקה',
    nameEn: 'Green Kfar Saba',
    // Identified by neighbourhood + park (Park 80, Green Kfar Saba) — NOT a
    // street number. The "Weizmann 135" that briefly appeared here came from a
    // WRONG Waze listing and was removed 2026-07-26. The exact pin is the
    // CEO-confirmed coordinates below; street text pending the CEO's real address.
    address: 'כפר סבא הירוקה, פארק 80, כפר סבא',
    city: 'כפר סבא',
    lat: 32.1982242, lng: 34.892436,
    hoursHe: 'פתוחה 24/7',
    // CEO-confirmed 2026-08-01 on-site directions.
    accessHe: 'ממש בכניסה לפארק, ליד קיוסק הקפה; העמדה נראית מהכניסה.',
    accessEn: 'Right at the park entrance, beside the coffee kiosk; the bay is visible from the entrance.',
    open: true,
    // Dual-bay; the two Nayax machine ids for this site are not yet confirmed
    // in our records — bay bookkeeping fills in automatically once the first
    // events arrive carrying their machine ids (see bookkeeping endpoint).
    bays: [],
  },
];

/** machine_id → { station, bay } for joining bay transactions back to a station. */
export function buildMachineIndex(stations: Station[] = STATION_REGISTRY): Map<string, { station: Station; bay: StationBay }> {
  const idx = new Map<string, { station: Station; bay: StationBay }>();
  for (const station of stations) {
    for (const bay of station.bays) idx.set(bay.machineId, { station, bay });
  }
  return idx;
}

/** Google Maps + Waze deep links for a station. */
export function stationMapLinks(s: Station) {
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`,
    waze: `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`,
  };
}

// ─── DB-backed loading ───────────────────────────────────────────────────────

/** Shape of one station_registry row we care about (snake_case from SQL). */
type StationRow = {
  station_id: string; station_name: string | null; station_name_he: string | null;
  address: string | null; city: string | null; coordinates: unknown;
  operating_status: string | null; is_active: boolean | null;
  bays: unknown; hours_he: string | null; access_he: string | null; access_en: string | null;
};

/** Pure: one DB row → Station. Returns null when the row cannot be trusted. */
export function rowToStation(r: StationRow): Station | null {
  const coords = (r.coordinates ?? {}) as { lat?: unknown; lng?: unknown };
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!r.station_id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const bays: StationBay[] = Array.isArray(r.bays)
    ? (r.bays as any[])
        .filter((b) => b && typeof b.machineId === 'string' && b.machineId.trim())
        .map((b) => ({ machineId: String(b.machineId), terminalId: b.terminalId ? String(b.terminalId) : undefined, label: String(b.label ?? '') }))
    : [];
  return {
    code: r.station_id,
    nameHe: r.station_name_he || r.station_name || r.station_id,
    nameEn: r.station_name || r.station_name_he || r.station_id,
    address: r.address ?? '',
    city: r.city ?? '',
    lat, lng,
    hoursHe: r.hours_he ?? '',
    open: r.is_active !== false && (r.operating_status ?? 'active') === 'active',
    bays,
    ...(r.access_he ? { accessHe: r.access_he } : {}),
    ...(r.access_en ? { accessEn: r.access_en } : {}),
  };
}

let cache: { at: number; stations: Station[] } | null = null;
const CACHE_MS = 5 * 60_000;

/** Drop the memo (after an admin adds or edits a station). */
export function invalidateStationCache(): void { cache = null; }

/**
 * The live station list. Database first, code array as the fallback — a
 * station is never silently missing because a query failed.
 */
export async function loadStations(opts?: { force?: boolean }): Promise<Station[]> {
  if (!opts?.force && cache && Date.now() - cache.at < CACHE_MS) return cache.stations;
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    const res: any = await db.execute(sql`
      SELECT station_id, station_name, station_name_he, address, city, coordinates,
             operating_status, is_active, bays, hours_he, access_he, access_en
      FROM station_registry
      WHERE is_active IS NOT FALSE
      ORDER BY station_id
    `);
    const rows: StationRow[] = (res?.rows ?? res ?? []) as StationRow[];
    const stations = rows.map(rowToStation).filter((s): s is Station => s !== null);
    if (stations.length === 0) {
      cache = { at: Date.now(), stations: STATION_REGISTRY };
      return STATION_REGISTRY;
    }
    cache = { at: Date.now(), stations };
    return stations;
  } catch (err: any) {
    const { logger } = await import('./logger');
    logger.warn('[StationRegistry] DB read failed — serving the built-in list', { error: err?.message });
    return STATION_REGISTRY;
  }
}
