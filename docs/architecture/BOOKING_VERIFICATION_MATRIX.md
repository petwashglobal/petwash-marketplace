# BOOKING_VERIFICATION_MATRIX.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit  
> Companion: BOOKING_READ_REPAIR.md, BOOKING_TRUTH_MAP.md

---

## Overall Wiring Status

| Booking Type | Customer History | Provider Dashboard | Admin Reporting | % Wired |
|---|---|---|---|---|
| General (Firestore `bookings`) | ❌ Route exists, not consumed | ✓ PASS | ❌ Missing | 20% |
| Walk (`walk_bookings` Postgres) | **✓ FIXED** Stage B unified read | ✓ PASS (pending) / **FIXED** active+completed | ❌ Missing | **80%** |
| Sitter (`sitter_bookings` Postgres) | **✓ FIXED** Stage B unified read | ✓ PASS (requests, earnings, stats wired) | ❌ Missing | **80%** |
| Trainer (`trainer_bookings` Postgres) | **✓ FIXED** Stage B unified read | ✓ PASS (TrainerBookings.tsx) | ✓ PASS (admin/stats) | **95%** |
| Booking Requests (`booking_requests` Postgres) | ✓ PASS (CustomerBookings.tsx) | ❌ Provider role param not called | ❌ Missing | 40% |
| Marketplace (`bookings` Postgres / super-app) | ❌ Completely unwired | ❌ Completely unwired | ❌ Missing | 0% |

---

## 1. General Booking (Firestore `bookings` collection)

| Dimension | Value | File:Line | Status |
|---|---|---|---|
| Create endpoint | `POST /api/bookings/create` | server/routes/bookings.ts:40 | ✓ ACTIVE |
| Table | Firestore `bookings` collection | bookings.ts:260 | ✓ |
| Payment | `EscrowService.createEscrowPayment()` | bookings.ts:317 | ✓ ACTIVE |
| Notification | `NotificationService.sendNotification()` | bookings.ts:342, 352 | ✓ ACTIVE |
| Customer history route | `GET /api/bookings/my-bookings` | bookings.ts:369 | ✓ EXISTS |
| Customer history frontend | CustomerBookings.tsx reads `/api/booking-requests` | CustomerBookings.tsx:782 | ❌ NOT CONSUMING |
| Provider dashboard route | `GET /api/provider-dashboard-v2/bookings` | provider-dashboard-v2.ts:129 | ✓ EXISTS |
| Admin route | `/api/admin/analytics/*` | admin.ts | ⚠ PARTIAL |
| Cache invalidation | Missing in frontend | — | ❌ MISSING |

**Root cause:** `GET /api/bookings/my-bookings` exists and reads Firestore correctly. But `CustomerBookings.tsx` was hardcoded to query `/api/booking-requests` only. Stage B unified read (booking-requests.ts) now aggregates all Postgres sources but Firestore bookings remain invisible to customers.

**Stage C decision gate:** Check if Firestore `bookings` collection is still written to by any active path. If usage is <5% vs booking_requests, merge writes to Postgres before exposing in customer history.

---

## 2. Walk Booking (`walk_bookings` Postgres table)

| Dimension | Value | File:Line | Status |
|---|---|---|---|
| Create endpoint | `POST /api/walk-my-pet/walks/book` | walk-my-pet.ts:380 | ✓ ACTIVE |
| Table | `walk_bookings` (Postgres) | schema.ts:4677 | ✓ |
| Payment | EscrowService + Nayax | walk-my-pet.ts:614+ | ✓ ACTIVE |
| Walker notification | SMS via TwilioSMSService (fire-and-forget) | walk-my-pet.ts:507 | ✓ ACTIVE |
| Owner notification (new) | `dispatchNotification` in-app | walk-my-pet.ts:527 | **✓ FIXED** |
| Customer history route | `GET /api/walk-my-pet/users/:userId/walks` | walk-my-pet.ts:1390 | ✓ EXISTS |
| Customer history frontend | `GET /api/booking-requests` unified read includes walk_bookings | booking-requests.ts:605 | **✓ FIXED Stage B** |
| Provider pending route | `GET /api/walk-my-pet/bookings/provider-pending` | walk-my-pet.ts:753 | ✓ EXISTS |
| Provider pending frontend | WalkerDashboard.tsx:77 | WalkerDashboard.tsx:77 | ✓ WIRED |
| Provider active route | `GET /api/walk-my-pet/walker/active` | walk-my-pet.ts:1618 | ✓ EXISTS |
| Provider active frontend | WalkerDashboard.tsx `activeWalk` query | WalkerDashboard.tsx | **✓ FIXED** |
| Provider completed route | `GET /api/walk-my-pet/walker/completed` | walk-my-pet.ts:1661 | ✓ EXISTS |
| Provider completed frontend | WalkerDashboard.tsx `completedWalks` query | WalkerDashboard.tsx | **✓ FIXED** |
| Earnings frontend | WalkerDashboard.tsx:83 | WalkerDashboard.tsx:83 | ✓ WIRED |
| Admin route | provider-dashboard-v2 `/bookings` now includes walk_bookings | provider-dashboard-v2.ts:192 | **✓ FIXED Stage B** |

---

## 3. Sitter Booking (`sitter_bookings` Postgres table)

| Dimension | Value | File:Line | Status |
|---|---|---|---|
| Create endpoint | `POST /api/sitter-suite/bookings` | sitter-suite.ts:660 | ✓ ACTIVE |
| Table | `sitter_bookings` (Postgres) | schema.ts:4301 | ✓ |
| Payment | `nayaxSitterMarketplace.processBookingPayment()` | sitter-suite.ts:895 | ✓ ACTIVE |
| Sitter notification | SMS via TwilioSMSService | sitter-suite.ts:811 | ✓ ACTIVE |
| Owner notification (new) | `dispatchNotification` in-app | sitter-suite.ts:829 | **✓ FIXED** |
| Customer history frontend | `GET /api/booking-requests` unified read includes sitter_bookings | booking-requests.ts:613 | **✓ FIXED Stage B** |
| Provider pending route | `GET /api/sitter-suite/bookings/provider-pending` | sitter-suite.ts:1097 | ✓ EXISTS |
| Provider requests frontend | SitterDashboard.tsx → `/api/sitter-suite/sitter/requests` | SitterDashboard.tsx:104 | ✓ WIRED |
| Provider earnings frontend | SitterDashboard.tsx → `/api/sitter-suite/sitter/earnings` | SitterDashboard.tsx:110 | ✓ WIRED |
| Provider stats frontend | SitterDashboard.tsx → `/api/sitter-suite/sitter/stats` | SitterDashboard.tsx:115 | ✓ WIRED |
| OwnerDashboard query key | Fixed from Firestore → Postgres endpoint | OwnerDashboard.tsx:82 | **✓ FIXED Stage B** |
| Admin route | provider-dashboard-v2 `/bookings` includes sitter_bookings | provider-dashboard-v2.ts:198 | **✓ FIXED Stage B** |

---

## 4. Trainer Booking (`trainer_bookings` Postgres table)

| Dimension | Value | File:Line | Status |
|---|---|---|---|
| Create endpoint | `POST /api/academy/bookings` | academy.ts:210 | ✓ ACTIVE |
| Table | `trainer_bookings` (Postgres) | schema.ts:6996 | ✓ |
| Payment | Status update + escrow | academy.ts:452+ | ⚠ UNCLEAR |
| Notification | **NOT FOUND** | academy.ts:252 | ❌ MISSING |
| Customer history route | `GET /api/academy/bookings` | academy.ts:335 | ✓ EXISTS |
| Customer history frontend | `GET /api/booking-requests` unified read includes trainer_bookings | booking-requests.ts:614 | **✓ FIXED Stage B** |
| Provider (trainer) dashboard | `GET /api/academy/trainer-bookings` | academy.ts:314 | ✓ EXISTS |
| Provider frontend | TrainerBookings.tsx:77 → `/api/academy/trainer-bookings` | TrainerBookings.tsx:77 | ✓ WIRED |
| Admin stats | `GET /api/academy/admin/stats` | academy.ts:809 | ✓ EXISTS |
| Cache invalidation | TrainerBookings.tsx:88, 103 | TrainerBookings.tsx | ✓ PARTIAL |

**Remaining gap:** Academy booking creation has no notification dispatch (no SMS or push to customer or trainer). Needs investigation in Stage C.

---

## 5. Booking Requests (`booking_requests` Postgres table)

| Dimension | Value | File:Line | Status |
|---|---|---|---|
| Create endpoint | `POST /api/booking-requests/` | booking-requests.ts:120 | ✓ ACTIVE |
| Table | `booking_requests` (Postgres) | schema.ts:10534 | ✓ |
| Payment | EscrowService integration | booking-requests.ts | ✓ ACTIVE |
| Notification (provider) | `dispatchNotification()` (direct) | booking-requests.ts:413 | ✓ ACTIVE |
| Notification (via event) | `eventPublisher.publishEvent(BOOKING_CREATED)` → NotificationEventHandlers | booking-requests.ts:388 | ⚠ **DUPLICATE** |
| Customer history | `GET /api/booking-requests/?role=owner` | booking-requests.ts:540 | ✓ WIRED |
| Provider view | `GET /api/booking-requests/?role=provider` | booking-requests.ts:557 | ✓ EXISTS (not called from POSJobs) |
| Workflow endpoints | /respond, /meet-greet, /pay, /start, /complete, /arriving, /confirm, /cancel | booking-requests.ts | ✓ 8 ACTIVE |
| Admin route | **NOT FOUND** | — | ❌ MISSING |
| Cache invalidation | CustomerBookings.tsx line 792 | CustomerBookings.tsx | ✓ PARTIAL |

**Known duplicate:** Lines 388 (eventBus) and 413 (direct dispatch) both notify the provider when a booking_request is created. Risk: provider gets 2 notifications. Needs deduplication in Stage C.

---

## 6. Marketplace / Super-App Bookings (`bookings` Postgres table)

| Dimension | Value | File:Line | Status |
|---|---|---|---|
| Create endpoint | `POST /api/marketplace-bookings/create` | marketplace-bookings.ts:177 | ✓ EXISTS |
| Create endpoint (platform) | `POST /api/platforms/:platformId/bookings` | super-app-bookings.ts:87 | ✓ EXISTS |
| Table | `bookings` (Postgres) | schema.ts:8236 | ✓ |
| Customer history route | `GET /api/marketplace-bookings/my-bookings` | marketplace-bookings.ts:563 | ✓ EXISTS |
| Customer history frontend | **NO queryKey references** | — | ❌ NOT WIRED |
| Provider rate card | `GET /api/marketplace-bookings/provider/:providerId/rate-card` | marketplace-bookings.ts:849 | ✓ EXISTS |
| Provider bookings | `POST /api/platforms/:platformId/provider/bookings` | super-app-bookings.ts:392 | ✓ EXISTS |
| Provider frontend | **NO queryKey references** | — | ❌ NOT WIRED |
| Payment checkout | `POST /api/marketplace-bookings/:quoteId/checkout` | marketplace-bookings.ts:222 | ✓ ACTIVE |
| Admin route | **NOT FOUND** | — | ❌ MISSING |
| Cache invalidation | **NONE** | — | ❌ MISSING |

**Status: COMPLETELY UNWIRED.** All endpoints exist and are mounted but zero frontend consumers. This is Stage C work — requires a full platform decision on whether marketplace bookings merge into booking_requests or get their own UI surface.

---

## Mismatch Detection Checklist

| Signal | Log Key | Where |
|---|---|---|
| Booking exists in one store, missing from unified read | `[BOOKING_MISMATCH_REPAIRED]` | booking-requests.ts:826 |
| Provider count differs from list | `[BOOKING_UNIFIED_READ]` fields: walkBookingsCount, sitterBookingsCount, trainerBookingsCount | booking-requests.ts:818 |
| Unknown status mapping | Normalized in route with catch-all `'pending'` | booking-requests.ts:617-644 |
| Missing provider name | `providerName: null` in response `_source` row | booking-requests.ts:693 |

---

## Stage C Gate Conditions

Do NOT proceed to Stage C until all of the following are confirmed by 30-day telemetry:

- [ ] `[BOOKING_UNIFIED_READ]` logs show stable non-zero `previouslyMissing` counts → confirms the split was real
- [ ] Firestore `bookings` collection write volume vs `booking_requests` write volume → determines if Firestore path is still live
- [ ] `booking_requests` notification duplicate rate measured → must be <1 before removing the event path
- [ ] Marketplace bookings write volume checked → if zero, mark as dead before any migration
