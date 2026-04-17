# PetWash — Route Truth Map
> Branch HEAD only. Source: `client/src/App.tsx`. Every route verified by line number.

Legend: ✅ Canonical  ⚠️ Duplicate/Alias  🔴 Dead  🟡 Partial

---

## Authentication Routes

| Route | Component | Guard | Status | Redirect Logic | Business Purpose |
|---|---|---|---|---|---|
| `/sign-in` | `SignIn` | Public | ✅ Canonical | After success → `POST /api/auth/post-login` decides destination | Primary sign-in entry |
| `/signin` | → `/sign-in` | Public | ⚠️ Legacy alias | App.tsx line 512 | Legacy |
| `/login` | → `/sign-in` | Public | ⚠️ Legacy alias | App.tsx line 518 | Legacy |
| `/sign-up` | `SignUp` | Public | ✅ Canonical | After success → `/choose-role` or `/complete-profile` | Primary signup |
| `/signup` | → `/sign-up` | Public | ⚠️ Legacy alias | App.tsx line 545 | Legacy |
| `/register` | → `/sign-up` | Public | ⚠️ Legacy alias | App.tsx line 551 | Legacy |
| `/signin-advanced` | Unknown page | Public | 🟡 Partial | — | Advanced sign-in (biometric?) |
| `/auth/action` | `AuthAction` | Public | ✅ Canonical | Handles Firebase email link magic | Firebase email link handler |
| `/__/auth/action` | `AuthAction` | Public | ✅ Canonical | App.tsx line 651 | Firebase Hosting path alias |
| `/verify-email` | `VerifyEmail` | Public | ✅ Active | — | Firebase email verification |
| `/activate-account` | `AccountActivation` | Public | ✅ Active | — | Account activation |
| `/choose-role` | `ChooseRole` | RequireAuth | ✅ Canonical | After choice → `/complete-profile` or `/provider-onboarding` | Post-signup role selection |
| `/complete-profile` | `CompleteProfile` | RequireAuth | ✅ Canonical | After completion → post-login routing | Profile completion gate |
| `/welcome-consent` | `WelcomeConsent` | Public | ✅ Active | — | GDPR/consent first step |
| `/consent-onboarding` | `ConsentOnboarding` | Public | ✅ Active | — | Extended consent collection |
| `/notification-consent` | `NotificationConsent` | Public | ✅ Active | — | Push notification opt-in |

---

## Provider Routes

| Route | Component | Guard | Status | Redirect Logic | Business Purpose |
|---|---|---|---|---|---|
| `/join/walker` | `<Redirect>` | Public | ⚠️ Alias | → `/become-provider?type=walker` (App.tsx line 1115) | Legacy walker join link |
| `/join/sitter` | `<Redirect>` | Public | ⚠️ Alias | → `/become-provider?type=sitter` (App.tsx line 1118) | Legacy sitter join link |
| `/join/trainer` | `<Redirect>` | Public | ⚠️ Alias | → `/become-provider?type=trainer` (App.tsx line 1121) | Legacy trainer join link |
| `/apply-provider` | `<Redirect>` | Public | ⚠️ Alias | → `/become-provider` (App.tsx line 2088) | Legacy apply link |
| `/join-team` | `<Redirect>` | Public | ⚠️ Alias | → `/become-provider` (App.tsx line 2091) | Legacy team join link |
| `/become-provider` | **`<Redirect>` ONLY** | Public | ✅ Entry gate | → `/sign-in?redirect=/provider-onboarding[?type=X]` (App.tsx lines 2065-2077) | **Never renders BecomeProvider.tsx** |
| `/provider-onboarding` | `ProviderOnboarding` | RequireAuth | ✅ **CANONICAL LIVE FORM** | After submit → `/provider/pending` | The only real provider application UI |
| `/provider/pending` | `ProviderPending` | RequireAuth | ✅ Active | — | Waiting for admin review |
| `/provider/rejected` | `ProviderRejected` | RequireAuth | ✅ Active | — | Rejection state with reapply option |
| `/provider/dashboard` | `<Redirect>` | RequireAuth | ⚠️ Legacy | → `/provider-os` (App.tsx line 1267) | Old dashboard path |
| `/provider/timeline` | `<Redirect>` | RequireAuth | ⚠️ Legacy | → `/provider-os` (App.tsx line 1268) | Old timeline path |
| `/provider/console` | `<Redirect>` | RequireAuth | ⚠️ Legacy | → `/provider-os` (App.tsx line 1269) | Old console path |
| `/provider-os` | `ProviderBookingsDashboard` | RequireAuth + `minRole="provider"` | ✅ **CANONICAL PROVIDER DASHBOARD** | — | Single provider hub |
| `/walk-my-pet/walker/dashboard` | `<Redirect>` | Public | ⚠️ Legacy | → `/provider-os` (App.tsx line 1156) | Old walker dashboard |
| `/sitter-suite/sitter/dashboard` | `<Redirect>` | Public | ⚠️ Legacy | → `/provider-os` (App.tsx line 1362) | Old sitter dashboard |
| `BecomeProvider.tsx` | *(file exists, lazy import exists line 76)* | — | 🔴 **DEAD — never mounted** | — | No route renders this file |

---

## Loyalty / Privilege / Prestige Routes

| Route | Component | Guard | Status | Redirect Logic | Business Purpose |
|---|---|---|---|---|---|
| `/privilege` | `PrivilegeSignup` | Public | ✅ **CANONICAL LOYALTY JOIN** | After submit → `/loyalty/dashboard` | Primary loyalty join entry |
| `/loyalty/join` | `PrivilegeSignup` | Public | ⚠️ Duplicate renders same component | App.tsx line 706 | Should redirect to `/privilege` |
| `/vito` | `PrivilegeSignup` | Public | ⚠️ Duplicate renders same component | App.tsx line 710 | Should redirect to `/privilege` |
| `/prestige-club` | `PrestigeClub` | Public | ✅ Active | — | Prestige tier info/landing |
| `/prestige-pass` | Route declared | RequireAuth | 🟡 Partial — check component | — | Prestige digital pass |
| `/loyalty` | `Loyalty` | Public | ✅ Active | — | Loyalty info/landing page |
| `/loyalty/dashboard` | `LoyaltyDashboard` | RequireAuth | ✅ Active | — | Member dashboard |
| `/loyalty/tiers` | `LoyaltyTiers` | Public | ✅ Active | — | Tier comparison |
| `/loyalty/benefits` | `LoyaltyBenefits` | Public | ✅ Active | — | Benefits listing |
| `/loyalty/birthday` | `LoyaltyBirthday` | RequireAuth | ✅ Active | — | Birthday reward management |
| `/loyalty/refer` | `LoyaltyRefer` | RequireAuth | ✅ Active | — | Referral management |
| `/loyalty/credits` | `LoyaltyCreditsHistory` | RequireAuth | ✅ Active | — | Credits history |

---

## Booking Routes

| Route | Component | Guard | Status | Business Purpose |
|---|---|---|---|---|
| `/booking` | `MarketplaceBookingFlow` | Public | ✅ Canonical marketplace booking entry | General booking flow |
| `/booking/new/:serviceType/:providerId` | `MarketplaceBookingFlow` | Public | ✅ Active | Direct provider booking |
| `/booking/confirmation/:requestId` | `MarketplaceBookingFlow` | Public | ✅ Active | Post-booking confirmation |
| `/bookings` | `CustomerBookings` | RequireAuth | ✅ Active | **⚠️ Only shows Firestore `bookings` collection — misses walk/sitter/trainer** |
| `/my/timeline` | Timeline page | RequireAuth | ✅ Active | Timeline view of bookings |
| `/walk-my-pet/book/:walkerId` | Walk booking page | RequireAuth | ✅ Active silo | Walk booking entry → `POST /api/walk-my-pet/walks/book` → `walk_bookings` table |
| `/sitter-suite/book/:sitterId` | Sitter booking page | RequireAuth | ✅ Active silo | Sitter booking → `POST /api/sitter-suite/bookings` → `sitter_bookings` table |
| `/academy/book/:trainerId` | Trainer booking page | RequireAuth | ✅ Active silo | Trainer booking → `POST /api/academy/...` → `trainer_bookings` table |
| `/booking-chat/:bookingId` | Booking chat | RequireAuth | ✅ Active | Booking-specific messaging |

---

## Admin Routes (all behind `AdminRouteGuard` + `requireRole('admin','management','staff')`)

| Route | Component | Notes |
|---|---|---|
| `/hq` | `UnifiedControlPanel` | Management hub |
| `/admin/backend-panel` | `AdminBackendPanel` | Full admin panel |
| `/admin/kyc` | `AdminKYC` | KYC review |
| `/admin/customers` | Customer management | CRM entry |
| `/admin/providers` | Provider review | Via `/api/admin/providers` |
| `/admin/vouchers` | `AdminVouchers` | Voucher management |
| `/admin/finance` | `AdminFinancial` | Finance dashboard |
| `/admin/crm` | `CrmDashboard` | CRM |
| `/admin/stations` | Station management | K9000 ops |
| `/crm/leads` | `LeadManagement` | Lead management |
| `/crm/communications` | `CommunicationCenter` | Comms hub |

---

## Public / Marketing Routes

| Route | Component | Status |
|---|---|---|
| `/` | Home/Landing | ✅ Canonical |
| `/marketplace` | `Marketplace` | ✅ Active |
| `/services/:service` | `ServiceLandingPage` | ✅ Active |
| `/walk-my-pet` | Walk My Pet landing | ✅ Active |
| `/talent` | `TalentMarketplace` | ✅ Active |
| `/about` | `About` | ✅ Active |
| `/careers` | Careers page | ✅ Active |
| `/contact` | Contact | ✅ Active |
| `/legal/*` | Legal pages | ✅ Active |
| `/status` | Status page | ✅ Active |

---

## Popup / Promo

| Component | File | Trigger | Suppressed On | Control |
|---|---|---|---|---|
| `PromoAdPopup` | `client/src/components/PromoAdPopup.tsx` | Auto, after 3s delay | Auth, onboarding, loyalty join paths (line 8-11) | `localStorage` 24h key + `sessionStorage` per-session key |
