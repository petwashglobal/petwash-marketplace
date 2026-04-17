# IDENTITY_TRUTH_MAP.md
> Branch: copilot/fix-loyalty-flow-issues  
> Generated: 2026-04-17 as part of PR3 — Identity truth repair  
> Source: DATA_TRUTH_MASTER.md, AUTH_ROLE_TRUTH_MAP.md, shared/schema.ts, server/routes.ts

---

## Purpose

Map every table, column, route, and write flow that touches user identity. Establish `users` (Postgres) as the single canonical source and identify all fields where `customers` and `users` diverge.

---

## Tables Involved

### 1. `users` — **CANONICAL** (Postgres, shared/schema.ts:35)

| Field | Notes |
|---|---|
| `id` | Firebase UID (varchar PK) |
| `email` | Unique — canonical |
| `firstName`, `lastName` | Canonical |
| `phone` | Unique — canonical |
| `role` | varchar, default 'customer'; also set in Firebase custom claims |
| `userStatus` | 'new', 'active', 'suspended', etc. |
| `idVerificationStatus` | 'none', 'pending', 'approved', 'rejected' |
| `loyaltyTier` | 7-tier: bronze → royal |
| `loyaltyPoints` | Cached from loyalty_ledger |
| `loyaltyBalanceCents` | Cached from loyalty_ledger (source of truth = loyalty_ledger) |
| `totalSpent` | Decimal — canonical |
| `washBalance` | Integer — canonical |
| `isClubMember` | Boolean — prestige club membership |
| `termsAcceptedAt` | Timestamp — canonical onboarding |
| `profileCompletedAt` | Timestamp — canonical onboarding |
| `communicationPreferences` | JSONB — canonical |
| `suppressionList` | JSONB — canonical |

### 2. `customers` — **LEGACY / SPLIT-TRUTH** (Postgres, shared/schema.ts:339)

| Field | Maps to | Status |
|---|---|---|
| `email` | `users.email` | ⚠️ SPLIT — both writable |
| `firstName`, `lastName` | `users.firstName`, `users.lastName` | ⚠️ SPLIT — customers uses legacy password auth |
| `phone` | `users.phone` | ⚠️ SPLIT |
| `loyaltyTier` | `users.loyaltyTier` | ⚠️ SPLIT — updated in storage.ts:1114 independently |
| `totalSpent` | `users.totalSpent` | ⚠️ SPLIT — both written in nayax-monyx-events.ts |
| `washBalance` | `users.washBalance` | ⚠️ SPLIT |
| `loyaltyPoints` | `users.loyaltyPoints` | ⚠️ SPLIT |
| `giftCardBalance` | `users.giftCardBalance` | ⚠️ SPLIT |
| `isVerified` | `users.idVerificationStatus` | ⚠️ SPLIT — different semantics |
| `termsAccepted` | `users.termsAcceptedAt` | ⚠️ SPLIT — bool vs timestamp |
| `password` | ❌ NOT in users | Legacy — customers uses email/password auth, users uses Firebase |
| `communicationPreferences` | `users.communicationPreferences` | ⚠️ SPLIT |
| `suppressionList` | `users.suppressionList` | ⚠️ SPLIT |
| `authProvider` | Not in users | Legacy — customers only |

### 3. `loyalty_ledger` — Source of truth for balance (schema.ts line ~11250)

Canonical for: `loyaltyBalanceCents`, `loyaltyPoints`  
Both `users.loyaltyBalanceCents` and `users.loyaltyPoints` are cached copies — `loyaltyLedger.ts` writes both atomically.

---

## Routes That Read `users`

| Route | File | Returns |
|---|---|---|
| `GET /api/auth/me` | server/routes/auth.ts:243 | users row (mobile JWT) |
| `GET /api/auth/me-session` | server/routes.ts:2062 | Firebase session → Firestore doc (fallback) |
| `GET /api/session/whoami` | server/routes.ts:2158 | Firebase claims → role/dashboards/KYC |
| `GET /api/me/role` | server/routes.ts:2283 | users.role + Firebase claims |
| `GET /api/profile` | server/routes.ts:2314 | users row (Firebase auth) |
| `GET /api/auth/identity` | server/routes.ts (new) | **CANONICAL** — users + customers backward compat |
| `GET /api/user-profile/me` | server/routes/user-profile.ts | users row |

## Routes That Read `customers`

| Route | File | Returns |
|---|---|---|
| `GET /api/customers/me` | server/routes.ts (legacy) | customers row |
| `GET /api/auth/me-session` | server/routes.ts:2133 | Also reads Firestore `users/{uid}` (not Postgres) |
| `POST /api/auth/login` | server/storage.ts:1083 | customers (legacy email/password login) |

---

## Flows That Write `users`

| Flow | File | Fields Written |
|---|---|---|
| Firebase signup / create-profile | server/routes/publicAuthRoutes.ts:1034 | email, firstName, lastName, phone, role |
| Loyalty ledger credit/debit | server/utils/loyaltyLedger.ts:159, 244, 304, 351 | loyaltyBalanceCents, loyaltyPoints, totalSpent, washBalance |
| Profile update | server/routes/profile-settings.ts:162, 355, 472 | firstName, lastName, phone, email, profileImageUrl |
| Nayax payment event | server/routes/nayax-monyx-events.ts:113, 137 | loyaltyPoints, totalSpent, washBalance |
| Onboarding verification | server/routes/onboarding-verification.ts:601 | idVerificationStatus, biometricMatchStatus |
| Privacy settings | server/routes/privacy-settings.ts:101, 131 | analyticsConsent, marketingConsent, suppressionList |
| Account management | server/routes/account-management.ts:169 | blocked, userStatus |
| Data rights (GDPR) | server/routes/dataRights.ts:319, 609 | communicationPreferences, suppressionList |

## Flows That Write `customers`

| Flow | File | Fields Written | Risk |
|---|---|---|---|
| Legacy registration | server/routes.ts:1911 | All columns | ⚠️ Creates row with independent email/phone |
| Legacy profile update | server/routes.ts:1999 | firstName, lastName, phone | ⚠️ Diverges from users |
| Loyalty tier update | server/routes.ts:3652 | loyaltyTier | ⚠️ DUPLICATE of users.loyaltyTier update |
| storage.ts createCustomer | server/storage.ts:1029 | All columns | Legacy auth flow |
| storage.ts updateCustomer | server/storage.ts:1041, 1114, 1271 | loyalty fields | ⚠️ SPLIT |
| DataRetentionService | server/services/DataRetentionService.ts:485 | anonymized fields | ✅ Safe (same data in both) |
| GDPR data rights | server/routes/dataRights.ts:321, 324, 609, 614 | communicationPreferences | ⚠️ SPLIT but writes both |

---

## Split-Truth Field Matrix

| Field | users | customers | Canonical | Risk |
|---|---|---|---|---|
| `email` | ✅ unique | ✅ unique | `users.email` | Divergence if customer changes email via legacy API |
| `firstName` | ✅ | ✅ | `users.firstName` | Legacy `/api/customers/me` update only writes `customers` |
| `lastName` | ✅ | ✅ | `users.lastName` | Same |
| `phone` | ✅ unique | ✅ | `users.phone` | Two unique indexes can conflict on the same phone |
| `role` | `users.role` varchar | ❌ not in customers | Firebase custom claims | Claims are authoritative; `users.role` is cached copy |
| `idVerificationStatus` | 'none'/'pending'/'approved'/'rejected' | `isVerified` boolean | `users.idVerificationStatus` | Semantics differ; boolean is a lossy simplification |
| `termsAccepted` | `termsAcceptedAt` timestamp | `termsAccepted` boolean | `users.termsAcceptedAt` | Different representations of same fact |
| `loyaltyTier` | ✅ | ✅ | `users.loyaltyTier` | storage.ts:1114 updates customers independently |
| `totalSpent` | ✅ | ✅ | `users.totalSpent` | nayax-monyx-events.ts updates users; storage.ts updates customers |
| `washBalance` | ✅ | ✅ | `users.washBalance` | Same split as totalSpent |
| `loyaltyPoints` | ✅ | ✅ | `users.loyaltyPoints` | loyaltyLedger.ts only writes users; storage.ts writes customers |
| `giftCardBalance` | ✅ | ✅ | `users.giftCardBalance` | Both written independently |
| `communicationPreferences` | ✅ JSONB | ✅ JSONB | `users.communicationPreferences` | privacy-settings only writes users; legacy flow writes customers |
| `suppressionList` | ✅ JSONB | ✅ JSONB | `users.suppressionList` | Same split |
| `onboardingStatus` | `userStatus` / `profileCompletedAt` | ❌ not present | `users.userStatus` | customers has no onboarding state |

---

## Where Split-Truth Can Break Downstream Systems

| System | Risk |
|---|---|
| **Booking** | `booking_requests.ownerId` → `users.id`; loyalty deduction uses `users.loyaltyBalanceCents`. If `customers.loyaltyPoints` differs, customer dashboard shows wrong points. |
| **Loyalty** | `loyaltyLedger.ts` only writes `users`. `customers.loyaltyPoints` is stale for any Firebase user. |
| **Provider** | Provider onboarding reads `users` only. If provider completed legacy registration via `customers`, their verification status may be `isVerified=true` in customers but `idVerificationStatus=none` in users. |
| **Dashboard** | `/api/profile` reads `users`. Legacy dashboard reads `/api/customers/me`. A customer who updated name via legacy API will see different names in different dashboards. |
| **Wallet** | wallet_accounts are linked to `users.id`. If a legacy customer logs in via Firebase and has no `users` row, wallet lookup fails. |
| **Notifications** | NotificationService looks up email/phone from `users`. If a customer only exists in `customers`, they will not receive email/SMS. |

---

## Proposed Read Unification (Safe, No Migration)

### Stage 1 (done in this PR): Add `GET /api/auth/identity`
- Single endpoint that reads `users` as canonical
- Joins `customers` for backward-compat fields not yet migrated
- Logs `[IDENTITY_SPLIT_WRITE]` when divergence detected
- Does NOT modify any data

### Stage 2 (next PR): Redirect all reads to /api/auth/identity
- Frontend: replace all calls to `/api/customers/me`, `/api/auth/me-session`, `/api/profile` with `/api/auth/identity`
- Backend: deprecate `/api/customers/me` with RFC 8594 sunset header
- Monitor `[IDENTITY_SPLIT_WRITE]` telemetry for 30 days

### Stage 3 (future): Write unification
- Identify each write that targets `customers` but not `users`
- Add mirror write: every `customers` write also writes `users`
- After 30-day zero-divergence window, make `customers` read-only

### Stage 4 (future): Deprecate customers table
- Only after Stage 3 proves zero divergence
- Add migration to copy any remaining `customers`-only rows to `users`
- Drop `customers` with a formal deprecation PR

---

## Acceptance Criteria (PR3 read-side)

- [x] `GET /api/auth/identity` returns unified profile from `users` (canonical)
- [x] Backward-compat fields merged from `customers` if present
- [x] `[IDENTITY_SPLIT_WRITE]` telemetry log on divergence
- [x] No data modified — read-only unification
- [ ] Frontend consumers migrated to `/api/auth/identity` (Stage 2, separate PR)
- [ ] Write-side mirroring (Stage 3, separate PR)

---

## What Was Deliberately NOT Changed

- No writes to `users` or `customers` were modified
- No column was dropped or altered
- Legacy `/api/customers/me` endpoint unchanged
- Legacy `/api/auth/me-session` endpoint unchanged
- `customers` table data untouched
- No data migration
