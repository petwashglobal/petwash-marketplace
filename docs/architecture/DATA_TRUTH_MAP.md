# PetWash — Data Truth Map
> Branch HEAD only. All table references include schema file and line number.

Legend: ✅ Canonical  ⚠️ Duplicate/Conflict  🔴 Dead/Orphan  🟡 Partial

---

## Identity Tables

### `users`
- **File**: `shared/schema.ts` line 35
- **Business purpose**: Primary identity record for every account. Keyed on Firebase UID (`uid` varchar). Contains name, email, phone, role, `termsAcceptedAt`, `onboardingComplete`, `profileComplete`
- **Written by**: `POST /api/auth/session` (via `AuthService.ensureUserInPostgres`), `POST /api/auth/complete-profile`, `POST /api/auth/choose-role`, `POST /api/auth/post-login`
- **Read by**: All authenticated pages via `GET /api/auth/whoami`; post-login routing decision
- **Status**: ✅ **Canonical source of identity**

### `sessions`
- **File**: `shared/schema.ts` line 24
- **Business purpose**: Server-side session store for cookie-based sessions
- **Written by**: `POST /api/auth/session` (creates), `POST /api/auth/signout` (clears)
- **Status**: ✅ Canonical

### `admin_users`
- **File**: `shared/schema.ts` line 1250
- **Business purpose**: Parallel admin user table — stores admin-specific fields separate from `users`
- **Written by**: Admin management endpoints
- **⚠️ Conflict**: Admin users should just be rows in `users` with `role = 'admin'`. Having `admin_users` as a separate table creates a dual source of truth. Admin login may check one table but miss the other.
- **Status**: ⚠️ **Duplicate — should be dissolved into `users`**

### `customers`
- **File**: `shared/schema.ts` line 339
- **Business purpose**: Customer profile extension (name, pets, preferences) — separate from `users`
- **Written by**: Customer profile APIs
- **⚠️ Conflict**: Core customer data (name, email) exists in both `users` and `customers`. No FK constraint visible ensuring they stay in sync.
- **Status**: ⚠️ **Partial duplicate of `users`** — needs FK consolidation

### `oauth_consents`
- **File**: `shared/schema.ts` line 5819
- **Business purpose**: Records which Google OAuth scopes a user has consented to (Calendar, Sheets, etc.)
- **Written by**: `POST /api/consent/oauth`
- **Read by**: Google integration services before making scoped API calls
- **Status**: ✅ Canonical — critical for compliance

### `biometric_consents`
- **File**: `shared/schema.ts` line 5772
- **Business purpose**: Records explicit consent for biometric/face-scan features
- **Written by**: `POST /api/consent/biometric`
- **Status**: ✅ Active

---

## Provider Tables — The Split

### `provider_applications` ← THE LIVE TABLE
- **File**: `shared/schema.ts` line 5027
- **Business purpose**: Stores all provider applications submitted through the live flow: `ProviderOnboarding.tsx` → `POST /api/provider-onboarding/apply`
- **Written by**: `POST /api/provider-onboarding/apply` (provider-onboarding.ts line 400)
- **Read by**: `ProviderPending.tsx` (via `GET /api/provider-onboarding/application/status`), Admin review panels via `GET /api/provider-onboarding/admin/applications/*`
- **Contains**: Full KYC data — selfie, government ID, biometric score, background check, certifications, insurance, application status
- **Status**: ✅ **Canonical source of truth for provider applications**

### `provider_applicants` ← THE DEAD TABLE
- **File**: `shared/schema-enterprise.ts` line 1677
- **Business purpose**: Was intended to store provider applications through the now-dead `BecomeProvider.tsx` → `POST /api/provider-applications` flow
- **Written by**: `POST /api/provider-applications` (dead endpoint — `BecomeProvider.tsx` never mounted)
- **Read by**: Admin routes under `/api/provider-applications/admin/*` — but those admin panels likely show empty data
- **Contains**: Duplicate fields to `provider_applications` but different structure
- **Status**: 🔴 **Dead — orphan table. No live frontend writes to it. Safe to remove after telemetry confirms zero calls.**

### `provider_intake_queue`
- **File**: `shared/schema.ts` line 5145
- **Business purpose**: Separate intake queue fed by Google Forms — providers fill an external Google Form, data synced here via `POST /api/provider-intake/sync`
- **Written by**: `POST /api/provider-intake/submit`, Google Sheets sync
- **Status**: 🟡 **Partial — separate flow, not connected to main application review pipeline**

---

## Booking Tables — The Fragmentation (CRITICAL)

### `bookings` (Firestore collection, NOT Postgres)
- **Business purpose**: General marketplace bookings
- **Written by**: `POST /api/bookings/create` — writes to **Firestore** `db.collection("bookings")`
- **Read by**: `GET /api/bookings/my-bookings` — reads **Firestore only**
- **Status**: ✅ Active — but scope is limited to marketplace bookings only

### `walk_bookings` ← INVISIBLE TO `my-bookings`
- **File**: `shared/schema.ts` line 4677 (Postgres table)
- **Business purpose**: Walk-specific booking records with GPS tracking, health data, blockchain audit
- **Written by**: `POST /api/walk-my-pet/walks/book` (`walk-my-pet.ts` line 306)
- **Read by**: `GET /api/walk-my-pet/walks/:bookingId`, `GET /api/walk-my-pet/users/:userId/walks`
- **⚠️ CRITICAL**: `GET /api/bookings/my-bookings` does NOT read this table. A customer who has only done walk bookings sees ZERO bookings in their `/bookings` page.
- **Status**: ✅ Active silo — **invisible to customer booking history**

### `sitter_bookings` ← INVISIBLE TO `my-bookings`
- **File**: `shared/schema.ts` line 4301 (Postgres table)
- **Business purpose**: Pet sitting booking records
- **Written by**: `POST /api/sitter-suite/bookings` (`sitter-suite.ts` line 642)
- **Read by**: `GET /api/sitter-suite/bookings` — separate from customer history
- **⚠️ CRITICAL**: Not returned by `GET /api/bookings/my-bookings`
- **Status**: ✅ Active silo — **invisible to customer booking history**

### `trainer_bookings` ← INVISIBLE TO `my-bookings`
- **File**: `shared/schema.ts` line 6996 (Postgres table)
- **Business purpose**: Dog training session records
- **Written by**: Academy booking endpoints
- **⚠️ CRITICAL**: Not returned by `GET /api/bookings/my-bookings`
- **Status**: ✅ Active silo — **invisible to customer booking history**

### `booking_requests`
- **File**: `shared/schema.ts` line 10534 (Postgres table)
- **Business purpose**: Pre-booking quote/request before confirmation
- **Written by**: `POST /api/booking-requests/*`
- **Status**: 🟡 Partial — unclear if this converts to a confirmed booking or is a dead-end

### `octopus_bookings`
- **File**: `shared/schema.ts` line 11833
- **Business purpose**: "Octopus model" super-app bookings
- **Written by**: `POST /api/platforms/*`
- **Status**: 🟡 Partial — unclear if actively used

---

## Loyalty Tables

### `loyalty_profiles` ← CANONICAL
- **File**: `shared/schema-loyalty.ts` line 71
- **Business purpose**: One row per loyalty member — tier, points total, join date, member status
- **Written by**: `POST /api/privilege/register` → `privilege-loyalty.ts` line 79
- **Read by**: `GET /api/loyalty/profile`, `LoyaltyDashboard.tsx`
- **Status**: ✅ **Canonical loyalty membership record**

### `points_transactions`
- **File**: `shared/schema-loyalty.ts` line 123
- **Business purpose**: Ledger of every points earn/spend event
- **Written by**: `/api/loyalty/points/add` (admin), booking completion hooks
- **Status**: ✅ Active

### `user_subscriptions`
- **File**: `shared/schema-enterprise.ts` line 532
- **Business purpose**: Subscription plan records — may overlap with `loyalty_profiles`
- **⚠️ Conflict**: A loyalty subscription could be in `loyalty_profiles` AND `user_subscriptions`. No FK links them.
- **Status**: ⚠️ **Potential duplicate for loyalty state**

---

## Payment / Payout Tables

### `nayax_transactions`
- **File**: `shared/schema.ts` line 671
- **Business purpose**: K9000 station payment records from Nayax hardware
- **Written by**: `POST /api/nayax/payment`, `POST /api/webhooks/nayax`
- **Status**: ✅ Canonical K9000 payment ledger

### `super_app_payouts`
- **File**: `shared/schema.ts` line 8386
- **Business purpose**: Provider payout records
- **Written by**: Payout trigger endpoints
- **Status**: ✅ Active

### `contractor_earnings`
- **File**: `shared/schema.ts` line 5338
- **Business purpose**: Contractor/provider earnings ledger
- **Written by**: Booking completion + payout processing
- **Status**: ✅ Active — parallel to `super_app_payouts`

### `wallet_accounts` / `wallet_ledger_entries`
- **File**: `shared/schema.ts` lines 11311, 11493
- **Business purpose**: Internal credit wallet for loyalty credits, voucher credits
- **Status**: ✅ Active

---

## Notification Tables

### `notification_logs`
- **File**: `shared/schema.ts` line 273
- **Business purpose**: Idempotency log for all outbound notifications — MUST be checked before sending to prevent duplicate emails/SMS
- **Written by**: Notification dispatch services
- **⚠️ Risk**: Not all send paths check this table before sending. Dual email paths (SendGrid + Gmail fallback) can both fire without idempotency check.
- **Status**: ✅ Exists — but not consistently enforced as idempotency gate

### `super_app_notifications`
- **File**: `shared/schema.ts` line 8505
- **Business purpose**: In-app notification records
- **Status**: ✅ Active

### `idempotency_keys`
- **File**: `shared/schema.ts` line 14363
- **Business purpose**: Generic idempotency key store for payments and critical operations
- **Status**: ✅ Active — should be extended to cover email sends
