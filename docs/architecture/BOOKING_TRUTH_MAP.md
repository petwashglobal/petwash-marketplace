# PetWash — Booking Truth Map
> Branch HEAD only. Every claim has exact file + line reference.
> This document is the source of truth for the booking consolidation project (Phase D).

---

## Executive Summary — The Core Bug

**`GET /api/bookings/my-bookings` (server/routes/bookings.ts line 363) queries Firestore `bookings` collection ONLY.**

Walk, sitter, and trainer bookings are written to three separate Postgres tables and are **never returned** by the customer history endpoint. A customer who books a walk, a sitter stay, or a trainer session will see an **empty bookings page** at `/bookings`.

The `OwnerDashboard.tsx` (sitter suite) calls `/api/bookings/my-bookings?platform=sitter-suite` expecting to get sitter bookings. It gets zero results because the Firestore query has no sitter booking records.

---

## Booking Systems — Current Reality

There are **5 parallel, independent booking systems** on this platform. None of them share a read path.

| # | System | Create Endpoint | Table Written | Customer Read Path | Provider Read Path | Admin Read Path |
|---|---|---|---|---|---|---|
| 1 | **General / K9000** | `POST /api/bookings/create` (bookings.ts:40) | Firestore `bookings` | ✅ `GET /api/bookings/my-bookings` (bookings.ts:363) | `GET /api/bookings/my-bookings?role=provider` (bookings.ts:363) | Unknown — needs audit |
| 2 | **Walk My Pet** | `POST /api/walk-my-pet/walks/book` (walk-my-pet.ts:306) | Postgres `walk_bookings` (schema.ts:4677) | ❌ **NOT in `/api/bookings/my-bookings`** | `GET /api/walk-my-pet/walkers/:walkerId/walks` (walk-my-pet.ts:1406) | Unknown — needs audit |
| 3 | **Sitter Suite** | `POST /api/sitter-suite/bookings` (sitter-suite.ts:642) | Postgres `sitter_bookings` (schema.ts:4301) | ❌ **NOT in `/api/bookings/my-bookings`** — `GET /api/sitter-suite/bookings?role=owner` (sitter-suite.ts:1121) is separate | `GET /api/sitter-suite/bookings?role=sitter` (sitter-suite.ts:1121) | Unknown — needs audit |
| 4 | **Academy / Trainer** | `POST /api/academy/bookings` (academy.ts:194) | Postgres `trainer_bookings` (schema.ts:6996) | ❌ **NOT in `/api/bookings/my-bookings`** — `GET /api/academy/bookings` (academy.ts:323) is separate | `GET /api/academy/trainer-bookings` (academy.ts:305) | Unknown — needs audit |
| 5 | **Booking Requests (Provider OS)** | `POST /api/booking-requests` (booking-requests.ts:94) | Postgres `booking_requests` (schema.ts:10534) | `GET /api/booking-requests?role=owner` (booking-requests.ts:531) | `GET /api/booking-requests?role=provider` (booking-requests.ts:531) → this is what `ProviderBookingsDashboard.tsx` (line 97) uses | Via provider OS dashboard |

---

## Detailed Booking Truth per Type

---

### Type 1: General / Marketplace / K9000 Booking

| Field | Detail |
|---|---|
| **Frontend Entry Page** | `/booking` → `MarketplaceBookingFlow.tsx`; `/walk-my-pet/owner/dashboard` → legacy path |
| **API Endpoint** | `POST /api/bookings/create` |
| **File + Line** | `server/routes/bookings.ts` line 40 |
| **Table Written** | Firestore collection `bookings` (NOT Postgres) |
| **Fields Set** | `customerId`, `providerId`, `platform`, `serviceDate`, `status`, `stationId`, `totalCents` |
| **Platform Legal Block** | PetTrek is hard-blocked at line 46-52: returns 403 `PETTREK_NOT_LICENSED` |
| **Status History Table** | None — status is a field on the Firestore doc itself |
| **Payment Path** | Nayax (K9000) or Tranzila checkout via `POST /api/checkout`; payment status on Firestore doc |
| **Notification Path** | Booking confirmation via SendGrid; SMS via Twilio (called from within `bookings.ts` create handler) |
| **Customer History Read** | ✅ `GET /api/bookings/my-bookings` (bookings.ts:363) — works correctly |
| **Provider Dashboard Read** | `GET /api/bookings/my-bookings?role=provider` (bookings.ts:363) — works |
| **Admin Read Path** | Needs audit — likely via `/api/admin/bookings` or Firestore admin SDK |
| **Canonical Status** | ✅ **Canonical for general/K9000 bookings** |
| **Bug/Risk** | PetTrek `CustomerDashboard.tsx` (line 21) calls `GET /api/bookings/my-bookings?platform=pettrek` expecting trip history — but pettrek is legally blocked at create time (line 46), so no pettrek records exist in Firestore. Returns empty array — not a bug, but misleading UI shows empty trip list instead of "service unavailable" message. |

---

### Type 2: Walk My Pet Booking

| Field | Detail |
|---|---|
| **Frontend Entry Page** | `/walk-my-pet/book/:walkerId` → walk booking page |
| **API Endpoint** | `POST /api/walk-my-pet/walks/book` |
| **File + Line** | `server/routes/walk-my-pet.ts` line 306 |
| **Table Written** | Postgres `walk_bookings` (schema.ts line 4677) |
| **Fields Set** | `ownerId`, `walkerId`, `scheduledDate`, `startTime`, `endTime`, `pickupAddress`, `petName`, `status`, `totalCents`, `bookingId` |
| **Status History Table** | None dedicated — status field on `walk_bookings` row |
| **GPS Tracking Table** | Postgres `walk_gps_tracking` (schema.ts line 4776) — written by `POST /api/walk-my-pet/walks/:bookingId/gps` (walk-my-pet.ts:1063) |
| **Health Data Table** | Postgres `walk_health_data` (schema.ts line 4801) |
| **Payment Path** | Inline in booking create handler — calls pricing engine; payment captured on completion |
| **Notification Path** | Within `POST /api/walk-my-pet/walks/book` handler — SMS and email sent at booking creation |
| **Customer History Read** | ❌ **NOT returned by `GET /api/bookings/my-bookings`** (which reads Firestore only) |
| **Correct Customer Read** | `GET /api/walk-my-pet/users/:userId/walks` (walk-my-pet.ts:1381) — exists but no frontend calls it from the main `/bookings` page |
| **Provider Dashboard Read** | `GET /api/walk-my-pet/walkers/:walkerId/walks` (walk-my-pet.ts:1406) — separate silo |
| **Admin Read Path** | Needs audit |
| **Canonical Status** | ✅ **Active, live booking flow** — but invisible to customer history |
| **Bug/Risk** | 🔴 **CRITICAL BUG**: Customer books a walk → sees zero history at `/bookings`. Support receives "where is my booking?" tickets. After completing a walk, no entry appears in customer history. Payout calculation may be correct (uses `walk_bookings` table) but customer cannot verify. |

---

### Type 3: Sitter Suite Booking

| Field | Detail |
|---|---|
| **Frontend Entry Page** | `/sitter-suite/book/:sitterId` → sitter booking form |
| **API Endpoint** | `POST /api/sitter-suite/bookings` |
| **File + Line** | `server/routes/sitter-suite.ts` line 642 |
| **Table Written** | Postgres `sitter_bookings` (schema.ts line 4301) |
| **Fields Set** | `bookingId`, `ownerId`, `sitterId`, `petId`, `startDate`, `endDate`, `totalChargeCents`, `paymentStatus`, `status`, `urgencyScore`, `aiTriageNotes` |
| **Status History Table** | None dedicated |
| **Octopus Ledger** | `POST /api/sitter-suite/bookings` also writes to `octopus_brain_ledger` (financial audit trail — seen in lines 760-780 of sitter-suite.ts) |
| **Payment Path** | Payment status set on `sitter_bookings` row; captured at confirmation via Tranzila |
| **Notification Path** | Within handler — notifications sent at creation and confirmation |
| **Customer History Read** | ❌ **BROKEN**: `OwnerDashboard.tsx` (sitter-suite/OwnerDashboard.tsx line 79) calls `GET /api/bookings/my-bookings?platform=sitter-suite` — this queries Firestore and returns **zero results** because sitter bookings are in Postgres. The correct sitter history endpoint is `GET /api/sitter-suite/bookings?role=owner` (sitter-suite.ts:1121) |
| **Correct Customer Read** | `GET /api/sitter-suite/bookings?role=owner` (sitter-suite.ts:1121) |
| **Provider Dashboard Read** | `GET /api/sitter-suite/bookings?role=sitter` (sitter-suite.ts:1121) |
| **Admin Read Path** | Needs audit |
| **Canonical Status** | ✅ **Active, live booking flow** — but customer history is broken |
| **Bug/Risk** | 🔴 **CRITICAL BUG #1**: `OwnerDashboard.tsx` line 79 calls wrong endpoint → shows empty booking list to sitter-suite customers. **CRITICAL BUG #2**: `SitterBooking.tsx` line 122 calls `queryClient.invalidateQueries({ queryKey: ['/api/bookings/my-bookings'] })` after booking creation — this invalidates the Firestore endpoint (which doesn't have the sitter booking), not the correct Postgres endpoint. Cache invalidation is broken. |

---

### Type 4: Academy / Trainer Booking

| Field | Detail |
|---|---|
| **Frontend Entry Page** | `/academy/book/:trainerId` → trainer booking form |
| **API Endpoint** | `POST /api/academy/bookings` |
| **File + Line** | `server/routes/academy.ts` line 194 |
| **Table Written** | Postgres `trainer_bookings` (schema.ts line 6996) |
| **Fields Set** | `bookingId`, `userId`, `trainerId`, `trainerUserId`, `sessionDate`, `totalAmount`, `platformFee`, `trainerPayout`, `bookingStatus`, `paymentStatus`, `escrowStatus`, `walletHoldCents`, `walletHoldKey`, `autoReleaseAt` |
| **Escrow** | Wallet hold via `walletService.holdBookingWallet()` at creation if wallet credits applied (academy.ts lines 220-250) |
| **Status History Table** | None dedicated |
| **Payment Path** | Wallet hold at creation; captured at completion |
| **Notification Path** | Within handler — navigation links generated (academy.ts lines 290-298) but notification sending needs audit |
| **Customer History Read** | ❌ **NOT returned by `GET /api/bookings/my-bookings`** — customer has no history view for trainer bookings on the main bookings page |
| **Correct Customer Read** | `GET /api/academy/bookings` (academy.ts line 323) — exists but not linked from `/bookings` page |
| **Provider Dashboard Read** | `GET /api/academy/trainer-bookings` (academy.ts line 305) |
| **Admin Read Path** | Needs audit |
| **Canonical Status** | ✅ **Active, live booking flow** — but invisible to customer history |
| **Bug/Risk** | 🔴 **CRITICAL BUG**: Customer pays for trainer session → sees nothing in `/bookings` history. If trainer is a no-show, customer has no record to dispute with. |

---

### Type 5: Booking Request (Provider OS Flow)

| Field | Detail |
|---|---|
| **Frontend Entry Page** | `/marketplace/book/:platform/:id` or `/find-provider` → booking request flow |
| **API Endpoint** | `POST /api/booking-requests` |
| **File + Line** | `server/routes/booking-requests.ts` line 94 |
| **Table Written** | Postgres `booking_requests` (schema.ts line 10534) |
| **Sub-tables** | `booking_request_pets` (booking-requests.ts line 305), `booking_request_addons` (line 346) |
| **Status History Table** | Inline status updates on `booking_requests` row |
| **Payment Path** | `POST /api/booking-requests/:requestId/pay` (booking-requests.ts:1089) — Tranzila |
| **Notification Path** | Calendar event created on booking confirm (booking-requests.ts:1214) |
| **Customer History Read** | `GET /api/booking-requests?role=owner` (booking-requests.ts:531) — used by `ProviderBookingsDashboard.tsx` line 95-97 |
| **Provider Dashboard Read** | `GET /api/booking-requests?role=provider` (booking-requests.ts:531) → used by `ProviderBookingsDashboard.tsx` line 95-97 |
| **Admin Read Path** | Via admin booking-requests endpoints |
| **Canonical Status** | ✅ **Active, canonical booking flow for provider-initiated bookings** |
| **Bug/Risk** | ⚠️ This is also NOT included in `GET /api/bookings/my-bookings`. A customer with booking requests sees them in `/provider-os` but not in `/bookings`. Partial fragmentation. |

---

## Frontend Entry Points and Their Expected Read Path

| Page | Route | API Call Made | Data Received | Bug? |
|---|---|---|---|---|
| Customer Bookings | `/bookings` → `CustomerBookings.tsx` | `GET /api/bookings/my-bookings` | Firestore `bookings` only | 🔴 **Misses walk/sitter/trainer/booking-requests** |
| Sitter Owner Dashboard | `/sitter-suite/owner/dashboard` → `OwnerDashboard.tsx` line 79 | `GET /api/bookings/my-bookings?platform=sitter-suite` | Firestore filtered by platform (empty) | 🔴 **Returns zero sitter bookings** |
| PetTrek Customer Dashboard | `/pettrek/customer/dashboard` → `CustomerDashboard.tsx` line 21 | `GET /api/bookings/my-bookings?platform=pettrek` | Firestore filtered by platform | ⚠️ PetTrek legally blocked; empty result at least correct |
| Walk Owner View | `/walk-my-pet/owner/dashboard` → `WalkMyPetOwnerDashboard.tsx` | `GET /api/walk-my-pet/users/:userId/walks` | Postgres `walk_bookings` | ✅ Correct — but isolated from main `/bookings` view |
| Provider OS | `/provider-os` → `ProviderBookingsDashboard.tsx` line 95 | `GET /api/booking-requests?role=provider` | Postgres `booking_requests` | ✅ Correct for booking-requests flow |
| Academy Customer | `/academy/trainer/bookings` → `AcademyTrainerBookings.tsx` | `GET /api/academy/bookings` | Postgres `trainer_bookings` | ✅ Correct — but isolated from main `/bookings` view |
| My Timeline | `/my/timeline` | Needs audit | Unknown | Needs audit |

---

## Provider Dashboard Read Paths

| Provider Type | Dashboard Route | API Used | Table Read | Complete? |
|---|---|---|---|---|
| Walker | `/provider-os` → `ProviderBookingsDashboard.tsx` | `GET /api/booking-requests?role=provider` | Postgres `booking_requests` | ⚠️ Shows booking-requests only. Walk bookings created via `/api/walk-my-pet/walks/book` (which writes `walk_bookings`) may NOT appear here |
| Sitter | `/provider-os` (same dashboard) | `GET /api/booking-requests?role=provider` | Postgres `booking_requests` | ⚠️ Same issue — sitter bookings from `/api/sitter-suite/bookings` go to `sitter_bookings`, may not appear |
| Trainer | `/academy/trainer/bookings` | `GET /api/academy/trainer-bookings` | Postgres `trainer_bookings` | ✅ Correct for academy flow |

---

## Notification Paths per Booking Type

| Booking Type | Create Notification | Confirmation Notification | Completion Notification | Path |
|---|---|---|---|---|
| General (Firestore) | SendGrid + SMS in bookings.ts create handler | Via `POST /api/bookings/:bookingId/confirm` | Via `POST /api/bookings/:bookingId/complete` | Inline in bookings.ts |
| Walk | SMS + email in walk-my-pet.ts create handler | Via `POST /api/walk-my-pet/walks/:id/confirm` (walk-my-pet.ts:932) | Via `POST /api/walk-my-pet/walks/:id/complete` (walk-my-pet.ts:1169) | Inline in walk-my-pet.ts |
| Sitter | Within sitter-suite.ts create handler | `POST /api/sitter-suite/bookings/:id/confirm` | `PATCH /api/sitter-suite/bookings/:id/complete` | Inline in sitter-suite.ts |
| Trainer | Within academy.ts create handler | `POST /api/academy/bookings/:id/...` | `POST /api/academy/bookings/:id/complete` | Inline in academy.ts |
| Booking Request | `POST /api/booking-requests` creates; calendar at confirm | `POST /api/booking-requests/:id/confirm` (line 1489) | `POST /api/booking-requests/:id/complete` (line 1296) | booking-requests.ts with calendar integration |

---

## Payment and Payout Paths

| Booking Type | Payment Table | Payout Table | Payout Trigger |
|---|---|---|---|
| General (Firestore) | `nayax_transactions` (K9000) or `tranzila` (service) | `contractor_earnings` or `superAppPayouts` | On booking complete |
| Walk | Inline price capture in `walk_bookings` | `contractor_earnings` (walk-my-pet.ts complete handler) | `POST /api/walk-my-pet/walks/:id/complete` |
| Sitter | `sitter_bookings.totalChargeCents` + Tranzila | `sitter_bookings.sitterPayoutCents` → Israeli settlement via `PATCH /api/sitter-suite/bookings/:id/complete` | On completion |
| Trainer | `trainer_bookings.totalAmount` + wallet hold | `trainer_bookings.trainerPayout` → escrow auto-release at `autoReleaseAt` | Auto-release after 72h or manual |
| Booking Request | `POST /api/booking-requests/:id/pay` → `escrowHoldings` (marketplace-bookings.ts line 398) | Release via `POST /api/marketplace-bookings/process-escrow-releases` | On completion |

---

## Stage A — Observability (Telemetry to Add — No Logic Changes)

### A1: Add telemetry to every booking WRITE

**`POST /api/bookings/create` (bookings.ts line 40)**
```
logger.info('[BOOKING_WRITE] general', { bookingId, customerId, platform, serviceDate });
```

**`POST /api/walk-my-pet/walks/book` (walk-my-pet.ts line 306)**
```
logger.info('[BOOKING_WRITE] walk', { bookingId, ownerId, walkerId, scheduledDate });
```

**`POST /api/sitter-suite/bookings` (sitter-suite.ts line 642)**
```
logger.info('[BOOKING_WRITE] sitter', { bookingId, ownerId, sitterId, startDate });
```

**`POST /api/academy/bookings` (academy.ts line 194)**
```
logger.info('[BOOKING_WRITE] trainer', { bookingId, userId, trainerId, sessionDate });
```

**`POST /api/booking-requests` (booking-requests.ts line 94)**
```
logger.info('[BOOKING_WRITE] booking_request', { requestId, ownerId, providerId, serviceType });
```

### A2: Add telemetry to every booking READ

**`GET /api/bookings/my-bookings` (bookings.ts line 363)**
```
logger.info('[BOOKING_READ] firestore_only', { userId, role, resultCount: bookings.length });
```

**`GET /api/sitter-suite/bookings` (sitter-suite.ts line 1121)**
```
logger.info('[BOOKING_READ] sitter_postgres', { userId, role, resultCount });
```

**`GET /api/walk-my-pet/users/:userId/walks` (walk-my-pet.ts line 1381)**
```
logger.info('[BOOKING_READ] walk_postgres', { userId, resultCount });
```

**`GET /api/academy/bookings` (academy.ts line 323)**
```
logger.info('[BOOKING_READ] trainer_postgres', { userId, resultCount });
```

**`GET /api/booking-requests` (booking-requests.ts line 531)**
```
logger.info('[BOOKING_READ] booking_requests_postgres', { userId, role, resultCount });
```

### A3: Add mismatch alert — booking exists in Postgres but not shown in /my-bookings

Add to `GET /api/bookings/my-bookings` after the Firestore query:
```
// Mismatch detection: warn if the authenticated user has walk/sitter/trainer bookings in Postgres
// that are not included in this response
const [walkCount] = await pgDb.select({ count: sql`count(*)` }).from(walkBookings).where(eq(walkBookings.ownerId, userId));
const [sitterCount] = await pgDb.select({ count: sql`count(*)` }).from(sitterBookings).where(eq(sitterBookings.ownerId, userId));
const [trainerCount] = await pgDb.select({ count: sql`count(*)` }).from(trainerBookings).where(eq(trainerBookings.userId, userId));
if (walkCount.count > 0 || sitterCount.count > 0 || trainerCount.count > 0) {
  logger.warn('[BOOKING_MISMATCH] customer has bookings in Postgres not shown in history', {
    userId, firestoreCount: bookings.length,
    walkPostgresCount: walkCount.count,
    sitterPostgresCount: sitterCount.count,
    trainerPostgresCount: trainerCount.count,
  });
}
```

---

## Stage B — Unified Read Layer (After Stage A is deployed and monitored)

### B1: Fix `GET /api/bookings/my-bookings` to aggregate all booking sources

**File**: `server/routes/bookings.ts` line 363
**Change**: After the Firestore query, also query `walk_bookings`, `sitter_bookings`, `trainer_bookings`, and `booking_requests` in Postgres. Merge results into a unified array sorted by date descending.

Return shape must include a `bookingType` or `source` field so the UI can display service-appropriate icons and details.

### B2: Fix `OwnerDashboard.tsx` (sitter-suite) to use the correct endpoint

**File**: `client/src/pages/sitter-suite/OwnerDashboard.tsx` line 79
**Change**: Change `queryKey: ['/api/bookings/my-bookings', { platform: 'sitter-suite' }]` to `queryKey: ['/api/sitter-suite/bookings', { role: 'owner' }]` — the correct Postgres-backed endpoint.

### B3: Fix `SitterBooking.tsx` cache invalidation

**File**: `client/src/pages/SitterBooking.tsx` line 122
**Change**: After successful sitter booking creation, invalidate `['/api/sitter-suite/bookings']` not `['/api/bookings/my-bookings']`.

### B4: Fix `CustomerDashboard.tsx` (pettrek) to show "service unavailable" instead of empty list

**File**: `client/src/pages/pettrek/CustomerDashboard.tsx` line 21
**Change**: Since PetTrek is legally blocked in Israel, this component should show a "PetTrek coming soon" message rather than attempting to fetch an always-empty booking list.

---

## Stage C — Canonical Write Decision

Once Stage B telemetry shows the real volumes per booking type, decide:

1. **Keep walk/sitter/trainer as separate Postgres tables** — Maintain their independent write paths but add to the unified read layer. This is lower risk.
2. **Migrate to a single canonical `bookings` table in Postgres** — Requires migration of all existing Firestore records + schema unification. This is higher risk but creates true single source of truth.

Recommendation: Start with option 1 (unified read, keep separate writes). Option 2 only after 30 days of stable Stage B in production.

---

## Stage D — Migration and Cleanup

Only after Stage C decision is confirmed and Stage B is stable in production:
- If option 1 (unified read): clean up dead Firestore references in sitter/walk/trainer dashboards.
- If option 2 (unified write): migrate Firestore `bookings` to Postgres, decommission Firestore booking collection.

---

## Critical Proven Issues Summary

| # | Issue | Exact Proof | Business Damage | Safe Next Action |
|---|---|---|---|---|
| 1 | `GET /api/bookings/my-bookings` reads Firestore only | `server/routes/bookings.ts` lines 363-401: `db.collection("bookings")` — no Postgres query | Customer books walk/sitter/trainer → sees empty history → calls support or disputes | Stage A telemetry, then Stage B unified read |
| 2 | `OwnerDashboard.tsx` calls wrong endpoint | `client/src/pages/sitter-suite/OwnerDashboard.tsx` line 79: queries `/api/bookings/my-bookings?platform=sitter-suite` which returns Firestore records filtered by platform — zero sitter bookings exist in Firestore | Sitter-suite customers see empty dashboard | Stage B: fix to call `/api/sitter-suite/bookings?role=owner` |
| 3 | `SitterBooking.tsx` invalidates wrong cache key | `client/src/pages/SitterBooking.tsx` line 122: invalidates `/api/bookings/my-bookings` after sitter booking — wrong endpoint | After booking sitter, the history page is refreshed but still shows nothing because the invalidated cache key is the wrong one | Stage B: fix cache key |
| 4 | Trainer bookings have no customer history view | `GET /api/academy/bookings` exists but is not wired to the main `/bookings` customer page | Customer pays for trainer session, has no record to reference or dispute | Stage B: include in unified read |
| 5 | Walk bookings have no customer history view on main page | `GET /api/walk-my-pet/users/:userId/walks` exists but not included in `/bookings` page | Customer books walk, sees nothing in main history | Stage B: include in unified read |
