/**
 * Canonical PetWash station registry (single source of truth).
 *
 * WHY a code registry and not the pet_wash_stations table: that table is empty
 * in prod and carries NOT-NULL FKs to countries + franchise_territories which
 * are ALSO empty, so seeding it blind would break on the FK cascade (verified
 * live 2026-07-24). Until a careful seed migration lands, this is the trusted
 * source the admin bookkeeping + maps read from. Every field is real
 * (CEO-confirmed); dual-bay stations list BOTH Nayax machine IDs so bay
 * transactions (nayax_transaction_events.machine_id) join back to a station.
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
}

export const STATION_REGISTRY: Station[] = [
  {
    code: 'PWS-IL-KFS-001',
    nameHe: 'פארק יצחק ולד, כפר סבא',
    nameEn: 'Isaac Wald Park, Kfar Saba',
    address: 'רחוב ויצמן 185, כפר סבא (מיקוד 4439654)',
    city: 'כפר סבא',
    lat: 32.179964, lng: 34.925016,
    hoursHe: 'כל יום 05:30–23:00',
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
    // Real street address (2026-07-26): Weizmann 135, Green Kfar Saba, Park 80.
    // Was the vague "park entrance, coffee kiosk", which map apps could not pin
    // — so Waze/Google snapped it onto the Wald station (Weizmann 185). Distinct
    // street number is what stops the two Kfar Saba stations being merged.
    address: 'רחוב ויצמן 135, כפר סבא הירוקה (פארק 80), כפר סבא',
    city: 'כפר סבא',
    lat: 32.1982242, lng: 34.892436,
    hoursHe: 'פתוחה 24/7',
    open: true,
    // Dual-bay; the two Nayax machine ids for this site are not yet confirmed
    // in our records — bay bookkeeping fills in automatically once the first
    // events arrive carrying their machine ids (see bookkeeping endpoint).
    bays: [],
  },
];

/** machine_id → { station, bay } for joining bay transactions back to a station. */
export function buildMachineIndex(): Map<string, { station: Station; bay: StationBay }> {
  const idx = new Map<string, { station: Station; bay: StationBay }>();
  for (const station of STATION_REGISTRY) {
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
