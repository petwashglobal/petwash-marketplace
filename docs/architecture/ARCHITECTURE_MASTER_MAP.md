# PetWash Platform — Architecture Master Map
> Branch HEAD truth only. Generated 2026-04-17. Every claim references real file + line.

---

## 1. Product Map — What PetWash Builds and Sells

| Business Line | What It Sells | Customer | Provider | Platform Outcome |
|---|---|---|---|---|
| **K9000 Self-Wash** | Time at a physical pet-wash machine | Pet owner at a station | Station operator (franchise or company-owned) | Paid wash session recorded; revenue via Nayax/Tranzila |
| **Walk My Pet** | On-demand / scheduled dog walks | Pet owner | Vetted walker (`walkerProfiles`, `walkBookings`) | Walk confirmed, GPS-tracked, completed, reviewed, payout triggered |
| **Sitter Suite** | Pet sitting / boarding at provider's home | Pet owner | Vetted sitter (`sitterProfiles`, `sitterBookings`) | Sitting stay confirmed, completed, reviewed, payout triggered |
| **Academy / Trainer** | Dog training sessions | Pet owner | Vetted trainer (`trainerBookings`) | Session confirmed, completed, reviewed, payout triggered |
| **Loyalty / Privilege / Prestige** | Membership subscription with perks, wallet credits, digital card/pass | Pet owner (any) | None — this is a customer program | Subscription sold, loyalty profile created, Google Wallet pass issued |
| **PetTrek / Transport** | Pet taxi/transport service | Pet owner | Driver | Trip confirmed, GPS-tracked, completed, payout triggered |
| **Marketplace (General)** | Browse and book any of the above | Pet owner | Any approved provider | Discovery layer on top of verticals |
| **E-Vouchers / Gift Cards** | Prepaid credits for services | Purchaser / Recipient | None | Voucher issued via Nayax or direct purchase |
| **Franchise** | Station / territory franchise rights | Franchisee | PetWash HQ | Franchise agreement, territory assigned, recurring fees |

---

## 2. Identity and Role Map

### Anonymous Visitor
- **Sign up path**: `/sign-up` → `POST /api/simple-auth/signup` OR Firebase email/Google/Apple/phone → `POST /api/auth/session`
- **Sign in methods**: All (email, Google, Apple, phone, passkey)
- **Profile requirements**: None
- **Dashboard destination**: `/` (home)
- **Tables touched**: None until auth
- **Permissions**: Read-only public pages only

### Customer (role = `customer` or no role)
- **Sign up path**: `/sign-up` → Firebase auth → `POST /api/auth/session` → `POST /api/auth/post-login` → role check → `/dashboard`
- **Sign in methods**: All Firebase methods + passkey
- **Profile requirements**: `users.firstName`, `users.lastName`, `users.termsAcceptedAt` (enforced by `postLoginDecider`)
- **Dashboard destination**: `/dashboard`
- **Tables touched**: `users`, `customers` (profile extension), `bookings` (Firestore), `walk_bookings`, `sitter_bookings`, `loyalty_profiles`
- **Permissions**: Browse, book, view own bookings, join loyalty

### Loyalty Member (role = `customer` + `loyalty_profiles` row exists)
- **Join path**: `/privilege` → `PrivilegeSignup.tsx` → `POST /api/privilege/register` → `privilege_loyalty.ts` router
- **Pricing source of truth**: `privilegeLoyaltyRoutes` (`server/routes/privilege-loyalty.ts`) — `POST /register`
- **Card/pass**: Google Wallet pass via `server/routes/google-wallet.ts` + `GOOGLE_SERVICE_ACCOUNT_JSON`
- **Dashboard destination**: `/loyalty/dashboard`
- **Tables touched**: `loyalty_profiles` (schema-loyalty.ts), `points_transactions`, `user_subscriptions` (schema-enterprise.ts)
- **⚠️ Conflict**: `loyalty_profiles` (schema-loyalty.ts line 71) vs `user_subscriptions` (schema-enterprise.ts line 532) — both can represent a loyalty subscription state; no FK linking them

### Provider Applicant (role = `provider_applicant`)
- **Sign up path**: Any `/join/walker|sitter|trainer` or `/become-provider?type=X` → redirect → `/sign-in?redirect=/provider-onboarding?type=X` → `RequireAuth` → `/provider-onboarding` → `ProviderOnboarding.tsx`
- **Submit endpoint**: `POST /api/provider-onboarding/apply` (`server/routes/provider-onboarding.ts` line 400)
- **Table written**: `providerApplications` (`shared/schema.ts` line 5027)
- **Post-submit destination**: `/provider/pending`
- **Permissions**: View own application status only

### Approved Provider (role = `provider`)
- **Dashboard destination**: `/provider-os` (canonical, all old paths redirect here — App.tsx lines 1267-1269)
- **Tables touched**: `walkerProfiles`, `sitterProfiles`, `walkBookings`, `sitterBookings`, `trainerBookings`, `superAppPayouts`, `contractorEarnings`
- **Permissions**: Receive bookings, view earnings, manage availability

### Admin / Staff / Management
- **Sign in**: Firebase + MFA enforced (`requireMfaEnrolled` middleware)
- **Dashboard**: `/hq` (management), `/admin/*` suite (admin), `/admin/backend-panel` (super admin)
- **Route guard**: `AdminRouteGuard` + `requireRole('admin','management','staff')` + `requireStaffApproved`
- **Tables touched**: All tables (read-only constraints not enforced at DB level)

### Franchise Owner
- **Dashboard**: `/franchise/dashboard` → `FranchiseOwnerDashboard.tsx`
- **Route guard**: `AdminRouteGuard` (same guard as admin — **⚠️ no dedicated franchise role guard**)
- **Tables touched**: `franchisees`, `franchise_territories`, `pet_wash_stations` (schema-enterprise.ts)

---

## 3. Business Flow Classification

### Customer Flows
`/` → `/marketplace` → `/booking` → `/bookings` → `/loyalty` → `/vouchers` → `/egift`

### Provider Flows
`/join/*` → `/become-provider` → `/provider-onboarding` → `/provider/pending|rejected` → `/provider-os`

### Loyalty Flows
`/privilege` (canonical) / `/loyalty/join` (alias) / `/vito` (alias) → `PrivilegeSignup` → `/loyalty/dashboard`

### Back-Office / Operations Flows
`/hq` → `/admin/*` → `/crm/*` → `/enterprise/*` → `/franchise/*` → `/ops*`
