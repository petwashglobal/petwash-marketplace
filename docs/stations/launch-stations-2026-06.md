# Launch stations — June/July 2026 (CEO data, 2026-06-11)

Source: CEO message 2026-06-11 with two Google Maps pins. These are the first
two physical Pet Wash™ Smart Hub deployments. This doc is the single place
where their canonical data lives until the rows exist in `pet_wash_stations`.

## Station 1 — Isaac Wald Park, Kfar Saba (CEO: opening in ~2–3 weeks)

CEO description: "Pet Wash Israel's first outdoor smart dual wash hub."

| Field | Value | Status |
|---|---|---|
| stationCode | `PWS-IL-KFS-001` | proposed (CEO confirm) |
| stationName | `Pet Wash™ Isaac Wald Park · פארק יצחק ולד` | proposed |
| address | `פארק יצחק ולד (Isaac Wald Park)` | from Maps pin |
| city | `כפר סבא` | confirmed |
| latitude / longitude | `32.179964 / 34.925016` | from Maps URL |
| operationalStatus | `coming_soon` until opening day, then `active` | — |
| postalCode | **NEEDED from CEO** (column is NOT NULL) | ⚠️ |
| identityNumber | **NEEDED — hardware serial on the unit** | ⚠️ |
| qrCode | **NEEDED — QR printed on the unit** | ⚠️ |
| ownershipType | `corporate_owned` (assumed — CEO confirm) | ⚠️ |
| territoryId / countryId | FK rows must exist first (see below) | ⚠️ |
| operatingHours | **Daily 05:30–23:00, all 7 days** (CEO 2026-06-11). JSON: every day `{"open":"05:30","close":"23:00"}` | ✅ |

## Station 2 — Green Kfar Saba / כפר סבא הירוקה (approx; CEO: ~2 weeks after Station 1)

| Field | Value | Status |
|---|---|---|
| stationCode | `PWS-IL-KFS-002` | proposed |
| neighborhood | Green Kfar Saba (כפר סבא הירוקה) — CEO 2026-06-11 | ✅ |
| latitude / longitude | `32.186193 / 34.897218` | from Maps short-link (resolved 2026-06-11) |
| city | `כפר סבא` | from coordinates |
| operatingHours | **24/7** (CEO 2026-06-11). JSON: every day `{"open":"00:00","close":"23:59"}` | ✅ |
| address | **APPROXIMATE — do NOT publish until CEO confirms exact site** | ⚠️ |
| everything else | as Station 1 | ⚠️ |

**Rule: Station 2 must NOT get a public page or DB row until the address is
final** — publishing an approximate address repeats the fake-locations bug
(#664) in slow motion.

## How the rows get created (admin path, no schema change)

`POST /api/enterprise/stations` (requireAdmin) validates against
`insertPetWashStationSchema`. Prerequisites in order:

1. `POST /api/enterprise/countries` — Israel row (if absent).
2. `POST /api/enterprise/territories` — a territory row (e.g. "Sharon / השרון").
3. `POST /api/enterprise/stations` — the station payload per the table above.

Once the Station 1 row exists with `coming_soon`:
- `/locations` lists it automatically (gold "נפתחת בקרוב · Opening soon").
- `/stations/pws-il-kfs-001` goes live with LocalBusiness schema → Google
  starts indexing weeks before opening day (intentional — local rankings
  need lead time).
- Flip to `active` on opening day — one field update.
- Google Business Profile for the station should be claimed in the same
  week the page goes live (CEO action; needs business verification).

## Open questions for CEO (blocking Station 1 row)

1. Postal code for Isaac Wald Park station.
2. Hardware identityNumber + QR code value (printed on the unit).
3. ~~Operating hours~~ ✅ answered 2026-06-11: Wald Park daily 05:30–23:00; Green Kfar Saba 24/7.
4. Confirm ownershipType = corporate-owned (not franchise).
