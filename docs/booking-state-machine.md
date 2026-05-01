# Booking State Machine — Canonical Reference

This document is the single source of truth for booking lifecycle in the
PetWash marketplace. Use it when adding, fixing, or auditing any booking
endpoint. If the code disagrees with this doc, fix the code.

## What is in scope

This document covers the **marketplace booking lifecycle** for human-
provided services: pet sitting, dog walking, training, transport, and
grooming. Each booking has a customer, a provider, a quote, an accept/
decline cycle, payment escrow, completion, and review.

## What is NOT in scope — K9000 self-service kiosk

K9000 dual-bay Pet Wash stations are **self-service physical kiosks**
and are **NOT** part of the marketplace booking lifecycle. Do not
build appointment / accept / cancel / dispute logic for K9000.

   K9000 model (this is the only correct way to describe it):
   • Customer arrives at a station — no reservation, no scheduling.
   • Two bays operate independently. "Capacity" = bay availability,
     not a calendar of bookings.
   • Public users tap card / Apple Pay / Google Pay at the Nayax
     terminal mounted on the central column. No PetWash account
     required (works like a parking meter).
   • Registered users redeem credit / loyalty / e-gift / voucher
     by scanning a mobile QR or entering a numeric code on the
     keypad — fulfilled through the Nayax QR reader.
   • Wash session is started by the cycle keypad, not by a server-
     side state-machine transition.

   What this means for code:
   • K9000 stations live in `k9000_wash_stations` (their own table).
     They do NOT use `booking_requests`.
   • The `'k9000'` value in the legacy `providerType` enum exists for
     reporting only. New marketplace booking code MUST NOT add K9000
     to its accept / cancel / dispute paths.
   • Phase B6 customer address snapshot columns on `booking_requests`
     are deliberately scoped to marketplace flows. K9000 sessions do
     not need a customer address — the customer is physically at the
     station, by definition.
   • Nayax + QR redemption code lives in the wallet/payment service
     layer (`server/services/WalletService.ts`,
     `server/routes/credit-wallet.ts`,
     `server/routes/nayax-payments.ts`). That code path is
     INTENTIONALLY separate from the booking state machine and must
     stay separate.

## Stores

PetWash currently has multiple booking stores. Going forward, **Postgres
`booking_requests` is canonical** for marketplace flows (sitter, walker,
trainer, driver). Other tables exist for historical reasons:

| Store | Domain | Status |
| --- | --- | --- |
| `booking_requests` (Postgres, `shared/schema.ts:10580`) | Marketplace — sitter/walker/trainer/driver | **Canonical** |
| `sitter_bookings` (Postgres, `shared/schema.ts:4307`) | Legacy sitter flow | Read-only / migrating |
| `walk_bookings` (Postgres, `shared/schema.ts:4683`) | Legacy walker flow | Read-only / migrating |
| `bookings` Firestore collection (`server/routes/bookings.ts`) | Generic | Should be reconciled against Postgres |
| `k9000_wash_stations` (Postgres) | **Self-service kiosk capacity (NOT bookings)** | Out of scope for this doc |

All conflict checks, availability queries, and reporting **must** consult
`booking_requests` (and the legacy tables until migration completes).
Adding a new store is forbidden without an architecture review.

## Allowed statuses

`booking_requests.status` values:

```
pending                — owner created the request; waiting for provider
accepted               — provider accepted; payment not yet captured
meet_greet_scheduled   — provider accepted with a meet-and-greet date
declined               — provider declined; terminal
in_progress            — service has started
completed              — service complete; awaiting customer confirmation
reviewed               — customer left a review; terminal
cancelled              — cancelled by owner, provider, or system; terminal
disputed               — customer raised a dispute; under review
```

Anything else returned from the database is a bug.

## State transitions

```
                       (owner creates request)
                                 │
                                 ▼
                            ┌─pending─┐
                            │         │
              provider      │         │ provider
              accepts       │         │ declines
                            │         │
                  ┌─accepted┘         └─declined─[terminal]
                  │   │
                  │   └── (with meet-greet date) ──> meet_greet_scheduled
                  │                                          │
                  │                                          │ meet-greet completed
                  │   ┌──────────────────────────────────────┘
                  ▼   ▼
              [payment captured / wallet held]
                  │
                  ▼
              in_progress  ── owner cancel / provider emergency cancel ──> cancelled
                  │
                  ▼
              completed     ── 7-day window expires without dispute ──> reviewed
                  │
              ┌───┴────┐
              │        │
            review    dispute
              │        │
              ▼        ▼
          reviewed  disputed
                       │
                       └── resolution ──> reviewed | cancelled
```

### Trigger reference

| From → To | Trigger | Endpoint |
| --- | --- | --- |
| _none_ → `pending` | Owner submits | `POST /api/booking-requests` |
| `pending` → `accepted` | Provider accepts (no meet-greet) | `POST /api/booking-requests/:requestId/respond` |
| `pending` → `meet_greet_scheduled` | Provider accepts with date | same |
| `pending` → `declined` | Provider declines | same |
| `pending` → `cancelled` | Auto-decline after 24 h _(future)_ | scheduled job (TODO) |
| `meet_greet_scheduled` → `accepted` | Meet-greet completed | `POST /api/booking-requests/:requestId/meet-greet` |
| `accepted` → `in_progress` | Provider starts service | `POST /api/booking-requests/:requestId/start` |
| `in_progress` → `completed` | Provider completes service | `POST /api/booking-requests/:requestId/complete` |
| `completed` → `reviewed` | Customer leaves review | `POST /api/marketplace-reviews` |
| `completed` → `disputed` | Customer raises dispute | `POST /api/booking-requests/:requestId/dispute` |
| any → `cancelled` | Cancel by owner/provider/admin | `POST /api/<*>/cancel` |
| `disputed` → `reviewed`/`cancelled` | Admin resolution | admin tooling |

## Side effects (must always run on transition)

| Transition | Wallet | Calendar | Notification | Audit |
| --- | --- | --- | --- | --- |
| `pending → accepted` | Hold remains | **Create event** | SMS + email + inbox to owner | `bookingEventLogger` |
| `pending → declined` | Release hold | (no event) | SMS + email + inbox to owner | logger |
| `pending → cancelled (timeout)` | Release hold | (no event) | SMS + email to owner | logger |
| `* → cancelled` | Refund per policy | **Delete event** | SMS + email to other party | logger |
| `in_progress → completed` | Capture (T+0) or schedule release | (event remains) | inbox to owner | logger |
| `completed → reviewed` | Final release | (event remains) | inbox to provider | logger |

Any new transition that omits one of these side effects is a bug. The
existing helpers live in:

- Wallet: `server/services/WalletService.ts`,
  `server/services/EscrowService.ts`
- Calendar: `server/services/CalendarIntegrationService.ts`
- Notifications: `server/lib/notificationDispatcher.ts`,
  `server/services/PetWashNotificationEngine.ts`
- Audit: `server/services/bookingEventLogger.ts`

## Authentication

Every booking endpoint must be authenticated. Today the legacy routes use
`requireAuth` from `server/customAuth.ts`; the marketplace routes use
`optionalFirebaseToken` at mount with explicit `req.user?.uid` checks
inside each handler.

**Going forward, marketplace routes should mount `validateFirebaseToken`
at the route level so an absent token is rejected by middleware, not by
each handler.** This is currently being addressed in the booking
stabilization work.

## Reviewer eligibility

`POST /api/marketplace-reviews` enforces:

1. Reviewer is the booking owner.
2. Reviewer is not also the provider.
3. Booking status ∈ `{completed, reviewed}`.
4. One review per `(bookingId, customerId)` pair.

See `server/routes/marketplace-reviews.ts:170-225`. These are the
"trust integrity rules" — do not weaken.

## What we explicitly do NOT do

- We do not allow a provider to accept a request that does not belong
  to them (see `booking-requests.ts:732`).
- We do not accept a booking before the provider's
  `backgroundCheckStatus` is `'approved'` (see `booking-requests.ts:740`).
- We do not allow PetTrek bookings — every entry-point returns
  `403 PETTREK_NOT_LICENSED` until Israeli licensing is granted.
- We do not allow the client to set quote columns (`quote*Cents`) — those
  are filled server-side by `quoteEngine.calculateQuote`.

## Open work tracked elsewhere

- Cross-store conflict-check for double-booking (see audit doc).
- Auto-decline scheduler for stale `pending` requests > 24 h.
- Two-way Google Calendar sync.
- Migration of legacy `sitter_bookings` and `walk_bookings` rows into
  `booking_requests`.
