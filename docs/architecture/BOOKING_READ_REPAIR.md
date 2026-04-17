# Booking Read Repair Plan — Stage B
> Companion to BOOKING_TRUTH_MAP.md  
> Stage B: unified read only. No table migrations. No write-path changes.

---

## What Stage B Must Fix

| Problem | Evidence | Damage |
|---|---|---|
| `CustomerBookings.tsx` only shows `booking_requests`, not walk/sitter/trainer bookings | `GET /api/booking-requests` (booking-requests.ts:531) queries `booking_requests` only | Customer who books a dog walk sees empty `/bookings` page |
| `OwnerDashboard.tsx` (sitter-suite) calls wrong endpoint | `client/src/pages/sitter-suite/OwnerDashboard.tsx:79` queries `/api/bookings/my-bookings?platform=sitter-suite` (Firestore) instead of `/api/sitter-suite/bookings?role=owner` (Postgres) | Sitter-suite customer always sees empty history in their service-specific dashboard |
| Provider dashboard v2 only reads `booking_requests`, misses walk/sitter bookings | `server/routes/provider-dashboard-v2.ts:129` queries `booking_requests` only | Walker/Sitter providers who received bookings via the platform-specific flows (walk-my-pet, sitter-suite) don't see them in the unified provider OS |
| `SitterBooking.tsx` invalidates the wrong query key | `client/src/pages/SitterBooking.tsx:122` invalidates `['/api/bookings/my-bookings']` after booking creation | After a sitter booking is created, the customer's history view is invalidated but the invalidated cache is the wrong one (Firestore endpoint), so the UI doesn't show the new sitter booking |
| `ReviewSubmitDialog.tsx` invalidates the wrong query key | `client/src/components/ReviewSubmitDialog.tsx:53` invalidates `['/api/bookings/my-bookings']` | After review submission, the wrong cache is refreshed |

---

## File-by-File Repair Plan

### Change 1 — Backend: extend `GET /api/booking-requests` to aggregate all booking types

**File**: `server/routes/booking-requests.ts`  
**Location**: `router.get('/', ...)` handler starting at line 531

**What to do**: After the existing `booking_requests` query, also query:
- `walk_bookings` WHERE `ownerId = userId` (customer) or `walkerId` resolved from walker profile (provider)
- `sitter_bookings` WHERE `ownerId = userId` (customer)
- `trainer_bookings` WHERE `userId = userId` (customer)

Normalize each source to the same response shape with a `_source` and `_sourceType` field so the frontend knows what it's looking at without changing the page's rendering logic.

**Status mapping** (all map cleanly to `booking_requests` status enum):
| Source Status | Mapped Status |
|---|---|
| `walk_bookings.status = pending` | `pending` |
| `walk_bookings.status = confirmed` | `confirmed` |
| `walk_bookings.status = in_progress` | `in_progress` |
| `walk_bookings.status = completed` | `completed` |
| `walk_bookings.status = cancelled` | `cancelled` |
| `sitter_bookings.status = pending_provider` | `pending` |
| `sitter_bookings.status = pending` | `pending` |
| `sitter_bookings.status = confirmed` | `confirmed` |
| `sitter_bookings.status = in_progress` | `in_progress` |
| `sitter_bookings.status = completed` | `completed` |
| `sitter_bookings.status = cancelled` | `cancelled` |
| `trainer_bookings.bookingStatus = pending` | `pending` |
| `trainer_bookings.bookingStatus = confirmed` | `confirmed` |
| `trainer_bookings.bookingStatus = completed` | `completed` |
| `trainer_bookings.bookingStatus = cancelled` | `cancelled` |

**Service type mapping**:
| Source | `serviceType` value |
|---|---|
| `walk_bookings` | `dog_walking` |
| `sitter_bookings` | `pet_sitting` |
| `trainer_bookings` | `training` |

**Amount normalization**:
| Source | `totalCents` |
|---|---|
| `walk_bookings.totalCost` | decimal × 100 |
| `sitter_bookings.totalChargeCents` | already cents |
| `trainer_bookings.totalAmount` | decimal × 100 |

**Provider info lookup**:
| Source | Provider ID | Name resolution |
|---|---|---|
| `walk_bookings.walkerId` | `walkerProfiles.walkerId` | JOIN `walkerProfiles` → `firstName + lastName` or `displayName` |
| `sitter_bookings.sitterId` | `sitterProfiles.id` | JOIN `sitterProfiles` → `firstName + lastName` |
| `trainer_bookings.trainerUserId` | Firebase UID | JOIN `trainers` → `firstName + lastName` |

**Important**: Only applies for `role !== 'provider'` (owner/customer view). For provider view, the existing query is correct since providers use their booking-requests flow.

---

### Change 2 — Frontend: fix `OwnerDashboard.tsx` (sitter-suite) query key

**File**: `client/src/pages/sitter-suite/OwnerDashboard.tsx`  
**Line**: 79  
**Current**: `queryKey: ['/api/bookings/my-bookings', { platform: 'sitter-suite' }]`  
**Fix**: `queryKey: ['/api/sitter-suite/bookings', { role: 'owner' }]`

This changes from the Firestore-backed endpoint (which has zero sitter bookings) to the correct Postgres-backed endpoint for sitter bookings.

---

### Change 3 — Frontend: fix `SitterBooking.tsx` cache invalidation

**File**: `client/src/pages/SitterBooking.tsx`  
**Line**: 122  
**Current**: `queryClient.invalidateQueries({ queryKey: ['/api/bookings/my-bookings'] })`  
**Fix**: `queryClient.invalidateQueries({ queryKey: ['/api/sitter-suite/bookings'] })`

Also add secondary invalidation of `/api/booking-requests` since the unified endpoint now returns sitter bookings too.

---

### Change 4 — Frontend: fix `ReviewSubmitDialog.tsx` cache invalidation

**File**: `client/src/components/ReviewSubmitDialog.tsx`  
**Line**: 53  
**Current**: `queryClient.invalidateQueries({ queryKey: ['/api/bookings/my-bookings'] })`  
**Fix**: Also invalidate `['/api/booking-requests']` since that is what `CustomerBookings.tsx` reads.

---

### Change 5 — Backend: provider dashboard v2 also shows walk/sitter bookings

**File**: `server/routes/provider-dashboard-v2.ts`  
**Location**: `router.get('/bookings', ...)` at line 129  

**What to do**: After reading `booking_requests`, also read:
- `walk_bookings` WHERE `walkerId = walkerProfile.walkerId` for providers who are walkers
- `sitter_bookings` WHERE `sitterId = sitterProfile.id` for providers who are sitters

This requires two sub-lookups:
1. Lookup if this provider has a walker profile: `SELECT walkerId FROM walker_profiles WHERE userId = $uid`
2. Lookup if this provider has a sitter profile: `SELECT id FROM sitter_profiles WHERE userId = $uid`

Then merge results, normalize to V1 shape, sort by date.

Add `_source` field so the provider OS can optionally show a service-type badge.

---

## Telemetry to Add (Stage A3 - mismatch detection)

When `GET /api/booking-requests` runs and the caller is a customer:
1. After fetching from all sources, log a count comparison
2. If `walk_bookings + sitter_bookings + trainer_bookings > 0` and they were previously invisible, log `[BOOKING_MISMATCH_REPAIRED]` with counts

```
logger.info('[BOOKING_UNIFIED_READ]', {
  userId,
  bookingRequestsCount: bookings.length,
  walkBookingsCount: walkBookings.length,
  sitterBookingsCount: sitterBookings.length,
  trainerBookingsCount: trainerBookings.length,
  totalReturned: allBookings.length,
  previouslyMissing: walkBookings.length + sitterBookings.length + trainerBookings.length,
});
```

---

## What NOT to Change in Stage B

- ❌ Do NOT change any booking creation endpoint
- ❌ Do NOT move or migrate any records between tables
- ❌ Do NOT change the Firestore `bookings` collection
- ❌ Do NOT redesign any UI components
- ❌ Do NOT change the provider OS flow (booking-requests create/respond cycle)
- ❌ Do NOT change the walk-my-pet booking flow
- ❌ Do NOT change the sitter-suite booking flow  
- ❌ Do NOT change the academy booking flow

---

## Stage C Decision Gates (after Stage B is live and telemetry proves stable)

After 30 days of Stage B running, use telemetry to decide:

| Question | Signal | Decision |
|---|---|---|
| Are `walk_bookings` and `booking_requests` being used by the same customers? | `[BOOKING_UNIFIED_READ]` logs — compare userId overlap | If >80% overlap → candidate for unified write |
| Is `booking_requests.serviceType = dog_walking` being used at all? | `[BOOKING_WRITE] booking_request` logs filtered by serviceType | If yes → may already be partially unified |
| Do providers check their walk bookings in provider OS? | `[BOOKING_READ] walk_postgres` + provider OS usage | If provider OS is the preferred view → prioritize provider dashboard merge |
