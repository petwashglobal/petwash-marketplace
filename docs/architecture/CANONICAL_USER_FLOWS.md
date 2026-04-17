# PetWash — Canonical User Flows
> Defines the intended canonical flow for each major user journey.
> Every flow names the exact route → component → API endpoint → DB table chain.

---

## 1. Customer Signup and Login

### Canonical Signup Flow
```
/sign-up
  → SignUp.tsx
  → Firebase auth (email/Google/Apple/phone)
  → POST /api/auth/session            (creates session cookie, syncs to users table)
  → POST /api/auth/post-login         (routing decision)
    ├─ If profile incomplete → /complete-profile
    │     → CompleteProfile.tsx
    │     → POST /api/auth/complete-profile  (writes users.firstName, users.termsAcceptedAt)
    │     → POST /api/auth/post-login again
    └─ If profile complete → /dashboard
```

### Canonical Login Flow
```
/sign-in  (canonical)
/signin → redirect to /sign-in  (legacy alias)
/login  → redirect to /sign-in  (legacy alias)
  → SignIn.tsx
  → Firebase auth (any method)
  → POST /api/auth/session
  → POST /api/auth/post-login
    ├─ role = provider + approved → /provider-os
    ├─ role = provider + pending  → /provider/pending
    ├─ role = provider + rejected → /provider/rejected
    ├─ role = staff + pending     → /staff/pending
    ├─ role = admin               → /hq
    └─ else                       → /dashboard
```

### What Must Be True
- One `users` row per Firebase UID — no duplicates
- `termsAcceptedAt` stamped at session creation for social OAuth (done in `POST /api/auth/session`)
- Social login users skip `/complete-profile` gate (done — terms stamped inline)

---

## 2. Loyalty Signup and Join

### Canonical Join Flow
```
/privilege  ← CANONICAL ENTRY
/loyalty/join  → should redirect to /privilege (currently renders PrivilegeSignup directly — duplicate)
/vito          → should redirect to /privilege (currently renders PrivilegeSignup directly — duplicate)

  → PrivilegeSignup.tsx  (client/src/pages/PrivilegeSignup.tsx)
  → POST /api/privilege/register   (server/routes/privilege-loyalty.ts line 79)
    → writes loyalty_profiles row (schema-loyalty.ts line 71)
    → triggers Google Wallet pass issuance (GOOGLE_SERVICE_ACCOUNT_JSON required)
    → sends welcome email (SendGrid)
  → /loyalty/dashboard
```

### What Must Be True
- `/loyalty/join` and `/vito` MUST redirect to `/privilege` (not render independently)
- Pricing source of truth MUST be in the DB or a single server constant — not in multiple React components
- `POST /api/prestige/join` vs `POST /api/privilege/register` must be reconciled — one canonical endpoint
- Loyalty join must NEVER trigger provider onboarding logic

---

## 3. Provider Signup and Approval

### Canonical Flow (VERIFIED — App.tsx lines 1114-1123, 2065-2091)
```
/join/walker  → redirect → /become-provider?type=walker
/join/sitter  → redirect → /become-provider?type=sitter
/join/trainer → redirect → /become-provider?type=trainer

/become-provider?type=X
  → NOT a page — pure redirect:
  → /sign-in?redirect=/provider-onboarding?type=X
  → (user signs in or creates account)
  → /provider-onboarding?type=X
  → ProviderOnboarding.tsx  (RequireAuth)
  → POST /api/provider-onboarding/apply     (provider-onboarding.ts line 400)
    → writes provider_applications row (schema.ts line 5027)
    → sends admin alert email
    → sends applicant confirmation email
    → logs to Google Sheets
  → /provider/pending

ADMIN REVIEW:
  GET /api/provider-onboarding/admin/applications/pending
  POST /api/provider-onboarding/admin/applications/approve
    → updates provider_applications.status = 'approved'
    → upgrades users.role to 'provider'
    → creates walkerProfile / sitterProfile as applicable
  POST /api/provider-onboarding/admin/applications/reject
    → updates provider_applications.status = 'rejected'

POST APPROVAL:
  → /provider-os  (ProviderBookingsDashboard, RequireAuth + minRole="provider")
```

### What Must Be True
- `BecomeProvider.tsx` must be removed (dead file — lazy import at line 76, never mounted)
- `POST /api/provider-applications` must be removed after telemetry confirms zero calls
- `provider_applicants` table must be archived/dropped after above
- Provider intent (`type=walker|sitter|trainer`) must survive the sign-in redirect and be restored on `/provider-onboarding` load

---

## 4. Booking Creation

### The Correct Architecture
Each vertical has its own create path and table. A unified READ path must aggregate them.

```
WALK BOOKING:
  /walk-my-pet/book/:walkerId
    → POST /api/walk-my-pet/walks/book        (walk-my-pet.ts line 306)
    → writes walk_bookings (schema.ts line 4677)
    → calendar event created
    → SMS reminder scheduled

SITTER BOOKING:
  /sitter-suite/book/:sitterId
    → POST /api/sitter-suite/bookings         (sitter-suite.ts line 642)
    → writes sitter_bookings (schema.ts line 4301)

TRAINER BOOKING:
  /academy/book/:trainerId
    → POST /api/academy/...
    → writes trainer_bookings (schema.ts line 6996)

MARKETPLACE (GENERAL):
  /booking/new/:serviceType/:providerId
    → POST /api/bookings/create
    → writes bookings (Firestore)
```

### The Bug (CONFIRMED — bookings.ts lines 363-401)
`GET /api/bookings/my-bookings` queries Firestore `db.collection("bookings")` ONLY.
It does NOT query `walk_bookings`, `sitter_bookings`, or `trainer_bookings`.

**Business damage**: Customers with walk/sitter/trainer bookings see empty history at `/bookings`.

### Fix Required (Track C)
`GET /api/bookings/my-bookings` must be a unified aggregation:
```
async getUserBookings(userId):
  firestore: bookings where customerId == userId
  postgres:  walk_bookings where customer_id == userId
  postgres:  sitter_bookings where customer_id == userId
  postgres:  trainer_bookings where customer_id == userId
  → merge + sort by date
  → return unified array
```

---

## 5. Booking Confirmation

```
Booking exists in vertical table (walk_bookings / sitter_bookings / etc.)
  → Provider sees booking in /provider-os
  → Provider confirms: POST /api/bookings/:id/confirm  OR  POST /api/walk-my-pet/walks/:id/confirm
  → Status updated in respective table
  → Customer notification sent (FCM push + email)
  → Calendar event updated
```

---

## 6. Payment

```
K9000 STATION:
  Customer taps card at station
    → Nayax hardware → POST /api/webhooks/nayax
    → writes nayax_transactions
    → session recorded in wash_history

MARKETPLACE BOOKING PAYMENT:
  /booking checkout step
    → POST /api/checkout  (Tranzila or Nayax)
    → writes pending_transactions
    → on webhook confirmation → marks booking paid

VOUCHER PURCHASE:
  → POST /api/vouchers/purchase  or  POST /api/e-vouchers
  → writes e_vouchers / petwash_vouchers_2025
```

---

## 7. Notification Dispatch

### Canonical Path
```
Business event (booking created, approved, cancelled, etc.)
  → Check notification_logs for idempotency key
  → If already sent → skip
  → Send via SendGrid (primary email)
  → If SendGrid fails (4xx/5xx) → send via Gmail fallback (secondary)
  → Send via Twilio (SMS — MESSAGING_SERVICE_SID priority over PHONE_NUMBER)
  → Send via FCM (push — /api/fcm/*)
  → Write to notification_logs (mark sent)
```

### What Must Be True
- Every send path checks `notification_logs` for idempotency key before firing
- SendGrid and Gmail fallback MUST NOT both fire for the same event
- FCM is the only push path — no duplicate dispatch

---

## 8. Provider Payout

```
Booking marked complete
  → Payout calculation (platform fee deducted)
  → writes super_app_payouts or contractor_earnings
  → Payout batch (weekly/monthly based on provider type)
  → Bank transfer via escrow route
  → Provider notified via SMS + email
```

---

## 9. Refund / Dispute

```
Customer raises dispute
  → POST /api/disputes/*
  → writes booking_disputes (schema.ts line 14768)
  → Admin review via /admin/disputes
  → If approved: refund via original payment method
  → writes transaction refund record
  → Customer + provider notified
```

---

## 10. Weather Intervention for Outdoor Services

```
Walk booking created
  → Weather service checked for service date + location
  → If severe weather forecast:
    → Advisory shown to customer (current behavior — advisory only)
    → Target behavior: customer must acknowledge weather warning before booking confirms
  → Walk day: re-check weather at 6am
    → If unsafe → auto-alert customer and walker
    → Walker has option to cancel without penalty
```

### What Must Be True
- Weather policy must be defined: advisory-only OR enforced blocking gate
- Current status: 🟡 Advisory only — no enforcement
- Recommend: enforce acknowledgment step on booking confirmation for outdoor services
