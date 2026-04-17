# DATA_TRUTH_MASTER.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit

---

## Critical Table Classification

### Identity

| Table | schema.ts Line | Purpose | Writers | Status |
|---|---|---|---|---|
| `users` | 35 | Primary identity: auth, KYC biometric, roles, loyaltyTier, activation state | 58+ routes | **CANONICAL** |
| `customers` | 339 | Legacy duplicate: email, loyaltyTier, spend, auth provider | 11 routes | **DUPLICATE** ⚠️ |
| `sessions` | 24 | Express session storage (PostgreSQL) | 8 routes | **CANONICAL** |

**Split-truth risk:** `users` and `customers` both store `email`, `loyaltyTier`, `totalSpent`, `washBalance`, `loyaltyPoints`. If both are updated separately, they diverge. Canonical is `users`. `customers` should be read-only derived or migrated out.

---

### Provider

| Table | schema.ts Line | Purpose | Writers | Status |
|---|---|---|---|---|
| `providerApplications` | 5027 | Provider intake: KYC, background checks, certs, criminal history | 7 routes | **CANONICAL** |
| `walkerProfiles` | 4562 | Walker operational profile | walk-my-pet.ts, provider-onboarding.ts | **CANONICAL** (legacy creation path) |
| `sitterProfiles` | 3996 | Sitter operational profile | sitter-suite.ts, provider-onboarding.ts | **CANONICAL** (legacy creation path) |
| `trainers` | 6915 | Trainer operational profile | academy.ts (admin only) | **CANONICAL** |
| `providerProfiles` | 12283 | Search/ranking metadata (computed) | booking_requests reads, not onboarding | **DENORMALIZED** |
| `pettrekProviders` | 5415 | Driver profiles (separate system) | pettrek routes | **LEGACY** |
| `octopusProviders` | 11805 | Centralized provider registry (abandoned) | Nothing modern | **ABANDONED** |
| `providerIntakeQueue` | 5145 | Google Forms manual intake queue | intake routes | **LEGACY** |
| `providerApplicants` | schema-enterprise.ts | Deprecated onboarding system | DEPRECATED endpoint only | **DEPRECATED** |

---

### Booking

| Table | schema.ts Line | Purpose | Writers | Status |
|---|---|---|---|---|
| `bookingRequests` | 10534 | Universal booking with quote engine, wallet state machine | booking-requests.ts | **CANONICAL (primary)** |
| `walkBookings` | 4677 | Walk-specific: GPS, geofencing, vital data, live monitoring | walk-my-pet.ts | **CANONICAL** |
| `sitterBookings` | 4301 | Sitter-specific: multi-day, two-sided consent, medical | sitter-suite.ts | **CANONICAL** |
| `trainerBookings` | 6996 | Trainer sessions: 72h escrow, trainer payout | academy.ts | **CANONICAL** |
| `bookings` | 8236 | Super-app generic: grooming, transport, multi-platform | super-app-bookings.ts, unified-platform.ts | **CANONICAL (unwired)** |

**Split-truth confirmed:** Walk/sitter/trainer bookings are written to their own Postgres tables. Customer history was previously only reading `bookingRequests`. Stage B fix (booking-requests.ts unified read) resolves this for customers. Marketplace `bookings` table remains completely unwired.

---

### Wallet & Financial

| Table | schema.ts Line | Purpose | Writers | Status |
|---|---|---|---|---|
| `walletAccounts` | 11311 | Cached aggregate balances | credit-wallet.ts, account-management.ts | **CANONICAL (cache)** |
| `walletLedgerEntries` | 11493 | **SOURCE OF TRUTH** — append-only, double-entry | Internal wallet service | **CANONICAL (immutable)** |
| `creditTransactions` | 11350 | Mobile/hardware credit redemption log | credit-wallet routes | **CANONICAL** |
| `redemptionSessions` | 11396 | QR/NFC session state | station routes | **CANONICAL** |
| `loyaltyLedger` | 13197 | 7-tier loyalty points log (bronze→royal) | admin-loyalty.ts, loyalty-credits.ts | **CANONICAL** |
| `providerPayoutEntries` | 13340 | Provider payout accounting (gross - 15% fee) | payout routes | **CANONICAL** |
| `payoutSchedules` | 13443 | Payout batch scheduling | payout orchestration | **CANONICAL** |

**Financial integrity:** `walletLedgerEntries` is append-only with idempotency keys. `walletAccounts` is a cached balance that can be reconciled from ledger. Double-entry accounting is preserved.

---

### Loyalty

| Table | Location | Purpose | Status |
|---|---|---|---|
| `loyalty_profiles` | schema-loyalty.ts:71 | Core: tier, points, xp, level, washes, streaks | **CANONICAL** |
| `points_transactions` | schema-loyalty.ts:123 | Immutable points ledger | **CANONICAL** |
| `loyaltyLedger` | schema.ts:13197 | Admin-managed transaction log (separate from points_transactions) | **CANONICAL** |
| `privilege_members` | privilege-loyalty.ts:41 | Prestige membership | **CANONICAL** |
| `subscriptionProducts` | schema.ts:2654 | Subscription box products | **CANONICAL** |
| `customerSubscriptions` | schema.ts:2692 | Active customer subscriptions | **CANONICAL** |

---

### Notifications & Audit

| Table | schema.ts Line | Purpose | Writers | Status |
|---|---|---|---|---|
| `notificationLogs` | 273 | Immutable notification audit: channel, status, retry, delivery | notifications.ts, admin-notifications.ts | **CANONICAL** |
| `superAppNotifications` | ~11000 | In-app notification inbox (Postgres) | booking-requests.ts, provider-dashboard-v2.ts | **CANONICAL** |
| `domainEvents` | 230 | Event sourcing for audit and replay | eventPublisher | **CANONICAL** |

---

## Dangerous Split-Truth Situations

### 1. `users` vs `customers` (CRITICAL)
Both tables store loyalty points and spend data. Any endpoint that updates one but not the other causes silent data inconsistency. Requires consolidation PR:
- Map all `customers` writes → point to `users` instead
- Deprecate `customers` table (keep as view for backward compat)

### 2. Booking Store Split (RESOLVED for reads, PENDING for writes)
Customers previously saw empty history because:
- Walk/sitter/trainer bookings → Postgres tables (separate)
- Customer history → read only from `bookingRequests` (Firestore-era endpoint)

Stage B fix resolves the **read** layer. Write layer remains split (by design for now — no destructive migration per problem statement rules).

### 3. Marketplace `bookings` Table (0% wired)
Complete table with write endpoints, zero frontend consumers. Not shown to customers or providers anywhere. Must be resolved in Stage C after confirming write volume.

### 4. Provider Profile Creation Gap
`providerApplications.status='approved'` does NOT auto-create `walkerProfiles`/`sitterProfiles`/`trainers`. Provider is "approved" in the application system but has no operational profile until a separate legacy endpoint is called. See PROVIDER_DEPRECATION_PLAN.md.

---

## Tables with No Route Readers (Internal Only)

- `domainEvents` — event sourcing, consumed internally by EventBus
- `walletReconciliationRuns` — accounting reconciliation
- `walletIdempotencyKeys` — anti-fraud, consumed internally
- `walletJtiRegistry` — JWT token validation
- `walletFraudLog` — fraud audit only
