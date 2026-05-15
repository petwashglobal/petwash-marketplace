# Mobile-First 2026 Rebuild — Architecture Audit + UX System Proposal

**Status:** Pure audit + proposal. No code ships from this PR.
**Mission:** Full auth, onboarding, account, role, dashboard, navigation rebuild
for mobile-first 2026 UX. Apple/Tesla/Airbnb level. No patching of legacy flows.
**Audience:** CEO + engineering. Decisions in §11 gate every Phase ≥1 PR.
**Date stamped:** 2026-05-15.

---

## §0 TL;DR

PetWash works in production but the auth/onboarding/dashboard surface has accreted
**15 auth entry points, 5 onboarding flows, 10+ duplicated route aliases, 60+
admin routes, 4 nav surfaces, and 4 parallel state owners for user identity**.
The codebase is functional, not broken — but it is not a 2026 mobile-first
luxury product. This audit identifies what to **delete**, what to **collapse**,
what to **isolate**, and what to **rebuild from scratch** before any further
feature work lands.

Five structural truths drive the rebuild:

1. **Identity must have one owner.** Today, the signed-in user lives in Firebase
   Auth, in a `/api/session/whoami` TanStack Query, in a `useSimpleAuth` Context,
   in `localStorage`, and in custom claims that lag the server by up to 60s.
   Pick one. The proposal: server `whoami` is the single source of truth;
   Firebase is a credential, not a state store.

2. **Onboarding is not "fill the profile" — it is staged, post-auth, and one
   route.** Today there are 5+ parallel onboarding pages. Proposal: `/onboarding`
   with serial steps gated on `userStatus`, no other onboarding route exists.

3. **Customers and Providers must never see each other's dashboard.** Today
   `useAccountNavigation` resolves both into the same priority order. Proposal:
   role is decided at sign-in and the app boots a different shell for each.

4. **Admin must be invisible to customers.** Today 60+ `/admin/*` routes mount
   unconditionally; protection is implicit inside the lazy-loaded component.
   Proposal: admin is a **separate sub-domain** (`admin.petwash.co.il`) or a
   build-time-gated bundle, not a route inside the customer app.

5. **iPhone Safari is the only browser that matters for v1.** Every flow
   below is designed for one-thumb, 100dvh, RTL-safe, OTP-autofilled,
   Face-ID-warm-return. Desktop is a scale-up of the iPhone design.

The rebuild ships in **11 phased PRs**, each independently revertible. No
phase requires a database migration except Phase 7 (`userDevices` table).
Total engineering: ~120–150 hours.

---

## §1 What's already in flight (predecessor docs)

Read first. This audit assumes their findings.

| Doc                                              | Status        | Covers                                                       |
|--------------------------------------------------|---------------|--------------------------------------------------------------|
| `docs/AUTH_REBUILD_AUDIT.md` (PR awaiting merge) | Open          | Welcome screen 4-button design, Apple Guideline 4.8, passkey |
| `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` (#277) | Open          | 12 identity bandaids, super-admin check duplication          |
| `docs/APPLE_DEVELOPER_SETUP_PLAN.md`             | Open          | iOS native shell, Bundle IDs, Universal Links                |
| `docs/PRODUCTION_QUALITY_AUDIT.md`               | Merged        | Cookies page, hamburger menu, platform cards                 |
| `docs/AUTH_AND_LOGIN_AUDIT.md`                   | Merged (prior)| First-pass auth findings                                     |

Decisions A–H from the AUTH_REBUILD_AUDIT and A–G from the APPLE_DEVELOPER_SETUP
plan are inputs here, not duplicated. This doc adds **dashboards, navigation,
state ownership, route map, RTL safety, and the phased rollout sequence**.

---

## §2 Architecture audit — current state

### §2.1 Duplicate auth paths

**15 distinct entry points** today. Active routed pages:

| Path                       | File                                          | Providers                                    |
|----------------------------|-----------------------------------------------|----------------------------------------------|
| `/signin`                  | `client/src/pages/SignIn.tsx` (2,684 lines)   | Email, Google, Apple, Facebook, Passkey, OTP |
| `/signin-advanced`         | same file                                     | same — unclear differentiation               |
| `/sign-in`                 | redirect to `/signin`                         | —                                            |
| `/login`                   | redirect to `/signin`                         | —                                            |
| `/signup`                  | `client/src/pages/SignUp.tsx` (1,415 lines)   | Email, Google, Apple, Facebook, Phone OTP    |
| `/sign-up`                 | redirect to `/signup`                         | —                                            |
| `/register`                | redirect to `/signup`                         | —                                            |
| `/welcome-consent`         | `WelcomeConsent.tsx`                          | Consent post-signup                          |
| `/internal/onboard`        | `InternalOnboard.tsx`                         | Staff invitation link                        |
| `/auth/action`             | `AuthAction.tsx`                              | Firebase action handler                      |
| `/__/auth/action`          | `AuthAction.tsx`                              | Duplicate Firebase action handler            |
| `/admin/login`             | `admin/AdminLoginV2.tsx`                      | Admin-only email/password                    |
| `/admin/login-v2`          | same file                                     | Same — unclear which is canonical            |

Plus 6 modal/component entry points:
`GoogleOAuthConsent`, `AppleOAuthConsent`, `OAuthConsentDialog`,
`CustomerSignupModal`, `KenzoWelcomePopup` (orphaned, not routed),
`GmailOAuthButton` (integration status unknown).

**Verdict:** Collapse to **3** routed entries: `/welcome` (new), `/signin`
(returning users), `/signup` (intent-aware new users). Delete every alias.
Delete every modal entry point and route everything through `/welcome`.

### §2.2 Duplicate onboarding flows

5+ parallel onboarding routes exist today:

| Route                  | Purpose                                | Status               |
|------------------------|----------------------------------------|----------------------|
| `/complete-profile`    | Role-conditional post-signup form       | Canonical            |
| `/provider-onboarding` | 7-step provider KYC wizard              | Canonical for providers |
| `/become-provider`     | Different provider onboarding entry     | Duplicate            |
| `/apply-provider`      | Yet another provider entry              | Duplicate            |
| `/forms/onboarding`    | `CustomerOnboardingForm.tsx`            | Routed but unused    |
| `/consent-onboarding`  | `ConsentOnboarding.tsx`                 | Consent only         |
| `/internal/onboard`    | Staff invite onboarding                 | Separate flow        |
| `/onboarding/*` (Pet)  | 6-step pet onboarding wizard (Welcome → Species → Breed → Name → Photo → Review) | **EXISTS BUT NOT ROUTED in App.tsx** |

**Verdict:** One `/onboarding` route. Steps gated by `userStatus`:
`mobile_verified` → name + DOB + city → `profile_incomplete` → pets →
`profile_complete`. Provider KYC is `/onboarding/provider/*` sub-flow.
Staff onboarding stays separate at `/internal/onboard` (token-gated, public
to invitees only). Everything else deleted.

### §2.3 Duplicate profile creators

Three server endpoints can create a user row:

1. `server/routes/publicAuthRoutes.ts:1043-1100` — signup flow.
2. `server/routes/mobile-auth.ts:116-148` — mobile JWT path. Also creates
   loyalty profile + wallet on first call (different side-effects than #1).
3. `server/routes/post-login.ts:1-200` — completes profile if missing fields.

Two displayName patterns exist:

- `users.firstName` + `users.lastName` (canonical, nullable).
- `displayName` exists only in the nested groomer profile table at
  `shared/schema.ts:4589` — not in the core users table.

OAuth fallback at `mobile-auth.ts:124` does `name || email.split('@')[0]`.
SignUp.tsx:216 does `name.split(' ')`. Both can produce empty `lastName`
on first sign-in.

**No literal "USER" placeholder string was found.** The mission statement
suggested it exists; the reality is fallbacks like `'Pet Parent'` / `'בעל
חיית מחמד'` in `MyAccount.tsx`. These render when `firstName` is null —
which happens routinely for phone-only OTP signups that never completed
the post-OTP name step.

**Verdict:** One server endpoint `POST /api/account/upsert` owns user
row creation + first-name + loyalty + wallet, atomically. OAuth + OTP
paths converge on it. The "Pet Parent" fallback display is killed —
**no signed-in user may exist without firstName**. Phone OTP signup must
complete the name step before the session is issued.

### §2.4 Duplicate dashboard routes

**60+ admin routes**, **9 provider routes** (some redirecting), **6 customer
dashboard variants**, **7 ops-monitor route aliases**, **4 eGift aliases**,
**3 paw-finder aliases**, **3 referral aliases**.

Worst offenders:

| Concept                | Aliases                                                              |
|------------------------|----------------------------------------------------------------------|
| Customer login         | `/signin`, `/sign-in`, `/login` (3)                                  |
| Customer signup        | `/signup`, `/sign-up`, `/register` (3)                               |
| Customer dashboard     | `/dashboard`, `/home`, `/my/timeline`, `/bookings`, `/favourites`    |
| Provider dashboard     | `/provider-os`, `/provider/dashboard`, `/provider/timeline`, `/provider/console` (3 redirect to first) |
| Provider entry         | `/provider-onboarding`, `/become-provider`, `/apply-provider`, `/join-team` |
| eGift                  | `/egift`, `/e-gift`, `/e-gifts`, `/gift-cards` (4)                   |
| Paw finder             | `/paw-finder`, `/find-pet`, `/lost-pet` (3)                          |
| Referral               | `/referral`, `/refer` (2)                                            |
| Ops monitor            | `/ops`, `/ops/today`, `/mobile-ops`, `/mobile/ops`, `/mobile/stations`, `/m`, `/s/:id` (7) |
| Admin login            | `/admin`, `/admin/login`, `/admin/login-v2` (3)                      |
| Audit trail            | `/audit-trail`, `/pet-wash-ltd/executive/audit` (2)                  |
| Compliance             | `/admin/compliance-control-tower`, `/pet-wash-ltd/executive/compliance` (2) |
| Financial              | `/admin/financial`, `/pet-wash-ltd/executive/finance` (2)            |

**Orphaned sub-platform dashboards (exist on disk, NOT routed in `App.tsx`):**

- `client/src/pages/sitter-suite/` — SitterDashboard, SitterEditProfile, PetSitterProfilePage
- `client/src/pages/walk-my-pet/` — WalkerDashboard, OwnerDashboard
- `client/src/pages/pettrek/` — PetTrekProviderDashboard, PetTrekTracking, DriverDashboard, CustomerDashboard
- `client/src/pages/academy/` — TrainerProfile
- `client/src/pages/onboarding/` — Pet onboarding multi-step wizard

**Verdict:** Two top-level shells: `CustomerShell` and `ProviderShell`.
Customer routes live under `/c/*` or unprefixed; provider routes under
`/p/*`. Admin is **not** routed in either shell — see §2.6. Every alias
above is deleted; the canonical route is the only one. Orphaned dashboards
are either routed (Pet onboarding) or deleted from disk (Sitter/Walker/
PetTrek/Trainer until those products go live).

### §2.5 Legacy hamburger menu routes

The hamburger is **healthier than expected**:

- 4 nav surfaces total: `PetWashHeader.tsx`, `Footer.tsx`, `LegalFooter.tsx`,
  `MobileBottomNav.tsx`. No duplicates, each plays a distinct role.
- Hamburger has 8 sections, 30+ items. Every link resolves to a real route.
- No admin / brain / dev links leak into the customer hamburger.
- BiDi isolation already used for `PetWash™` brand mark.

Real issues:

- Drawer slides from the **right** for both LTR and RTL. In Hebrew it should
  slide from the **left** (language-natural direction). Hardcoded at
  `client/src/styles/petwash-header.css:936-937, 952-953, 1120-1126`.
- One orphan `100vh` at `client/src/index.css:1842` (rest of codebase uses
  `100dvh` per platform skill §6).
- Hamburger close button (`.pw-mobile-close` / `.pw-mobile-top`) has no
  `env(safe-area-inset-top)` padding — on iPhone with Dynamic Island, the
  button may be partially occluded by the notch.

Legal links in hamburger are **6 of 30 items** (one of 8 sections) —
acceptable for now per the mission's "reduce legal clutter from primary
UX" goal, but candidates for footer-only relocation in Phase 9.

**Verdict:** Don't rewrite the hamburger from scratch. Fix the three
specific bugs above. Move legal links from hamburger LEGAL section to
footer-only in Phase 9. Hamburger structure (8 sections) is the new IA.

### §2.6 Old admin exposure

Two protection patterns coexist in the route layer at `client/src/App.tsx`:

1. **Explicit `RoleProtectedRoute` wrapper** — used for
   `/pet-wash-ltd/executive/*` (lines 2443–2520). Correct pattern.
2. **Implicit, lazy-component-internal** — used for all `/admin/*` routes
   (60+ routes, lines 2630–3024). Route is mounted unconditionally;
   protection only fires after the component is imported and runs its
   own `useWhoami()` check.

The implicit pattern means:

- Any visitor can navigate to `/admin/brain`, `/admin/dashboard`,
  `/admin/users`, etc. — the URL resolves, the chunk loads, and only
  then is the user redirected. Code is shipped to non-admin browsers.
- Bundle splitting hides this somewhat (admin code is lazy-chunked) but
  the chunk filename + route map is in the source map.
- This violates "no visible admin UI" in the rebuild mission.

**Verdict:** Three options, ranked:

- **Best:** Admin moves to a separate sub-domain `admin.petwash.co.il`
  with its own React build and its own bundle. Customer app never ships
  admin code. Requires DNS + Firebase Auth domain config + one new Cloud
  Run service. ~8 engineer-hours one-time.
- **Acceptable:** Admin routes stay in monorepo but are conditionally
  registered at runtime — `if (await whoamiHasAdminRole()) register
  AdminRoutes()`. The route chunks are still in the bundle but no `<Route>`
  ever mounts for non-admins. Saves DNS work, doesn't save bundle size.
- **Worst:** Keep current pattern, add explicit `RoleProtectedRoute`
  wrapper on every admin Route. Easy mistake, doesn't prevent chunk
  shipping. **Not recommended.**

### §2.7 Broken / dual OTP implementations

Two parallel OTP paths exist:

**Path 1 (canonical, actively used):** Custom Twilio + `registrationOTPService`.
- Client: `client/src/components/OtpCodeInput.tsx` — 6-digit numeric input
  with `inputMode="numeric"` + `autoComplete="one-time-code"` (line 6).
- WebOTP API integration for Chrome / Android at lines 56–76:
  `navigator.credentials.get({ otp: { transport: ['sms'] } })`.
- Used by `SignIn.tsx` line 20, `SignUp.tsx` line 41.
- Server: `server/routes/publicAuthRoutes.ts:895` (send), `:986` (verify).
- Rate limit: 3 sends / 10 min, 5 verifies / 5 min.

**Path 2 (orphaned, not used):** Firebase MFA via `useMultiFactorAuth.ts`.
- 100+ line hook with Firebase `PhoneAuthProvider` enrollment.
- **Not imported by any active component.**

**Transaction OTP** (separate, kept):
- `server/routes/transaction-otp.ts` (142 lines) — for sensitive operations:
  egift_purchase, wallet_topup, payment_method_change, large_booking,
  loyalty_redemption, password_change, email_change, provider_payout,
  bank_details_change, profile_phone_change.
- This is correct — it's a step-up OTP for high-value actions, not auth.

**iOS Safari autofill check:** ✓ `autoComplete="one-time-code"` is on the
first input. iOS will surface the SMS code in the keyboard suggestion bar
when the SMS contains the code. **The pattern must match:** the SMS body
must include the originating domain in `@petwash.co.il #123456` format
for iOS to bind the code to the website. This is currently sent via the
Twilio template — verify it includes the domain.

**Verdict:** Delete `useMultiFactorAuth.ts`. Keep the Twilio + WebOTP path.
Audit the SMS template for the iOS-bound format. Add an explicit test that
breaks if the template drops the domain prefix.

### §2.8 Role conflicts

Three sources of duplication:

**(a) Two parallel super-admin checks** in `server/middleware/rbac.ts`:
- Line 68: `isSuperAdmin(email)` — checks email against `SUPER_ADMIN_EMAILS`
  only. **Does NOT verify `email_verified`.** Legacy.
- Line 89: `isSuperAdminVerified(req)` — checks `email_verified` + allowlist.
  Newer, correct.

Older routes still use the unverified version. Attacker registers an unverified
account matching an admin email → bypasses legacy gates. **P0 security**.

**(b) Three `ADMIN_ROLES` literal definitions** (currently in sync, no test):
- `shared/adminRoles.ts:15-24` — single source of truth (8 roles).
- `client/src/hooks/useAccountNavigation.ts:41-50` — client copy.
- `server/routes.ts:1041` — server copy.

**(c) `VITE_ADMIN_EMAILS` (client build-time) vs `SUPER_ADMIN_EMAILS`
(server runtime)** — two separate env vars. If they drift, a stale client
bundle shows admin UI to someone the server no longer treats as admin.

**Verdict:** One canonical list of admin roles, imported from `shared/`
everywhere. Delete the client and server copies. Add a regression test that
fails the build if the list is duplicated. Migrate every legacy
`isSuperAdmin()` caller to `isSuperAdminVerified()` and delete the unverified
function. Delete `VITE_ADMIN_EMAILS` entirely — the server is the only
authority on who is an admin, and the client must call `whoami` to find out.

### §2.9 Safari / iPhone UX failures

| File / line                                    | Issue                                                      |
|------------------------------------------------|------------------------------------------------------------|
| `client/src/index.css:1842`                    | Orphan `100vh` (rest of codebase uses `100dvh`)            |
| `client/src/styles/petwash-header.css:936-937` | Drawer hardcoded `right: -100%; left: auto`                |
| `petwash-header.css` `.pw-mobile-top`          | No `env(safe-area-inset-top)` — Dynamic Island can occlude |
| `client/src/pages/SignIn.tsx:61-94`            | ITP redirect marker stored in BOTH sessionStorage AND localStorage — scattered ITP defense |
| `client/src/hooks/useAccountNavigation.ts:91`  | 1.5-second settle period bandaid (waiting for claims to propagate) |
| `client/src/auth/AuthProvider.tsx:229`         | `getIdTokenResult(true)` called once on auth state change — no refresh on role escalation |
| `client/src/pages/ProviderDashboard.tsx`       | Multiple hardcoded `dir="rtl"` not conditioned on locale   |
| `client/src/pages/PawFinder.tsx`               | Same — hardcoded `dir="rtl"`                                |
| `client/src/pages/MyAccount.tsx`               | Same — hardcoded `dir="rtl"`                                |
| `client/src/components/IsraeliTaxInvoice.tsx`  | `dir="rtl"` always (acceptable — invoice is always Hebrew) |

Pattern: **the codebase has solid iOS Safari handling in spots, no
coherent strategy.** Bearer-token-in-header for ITP cookie loss exists in
`GoogleOneTap.tsx` (line 154) but not in passkey or OTP paths. Redirect
marker dual-store exists for sign-in but not for sign-up.

**Verdict:** Build one `iosSafariSafe.ts` utility that owns:
- ITP redirect marker write/read (one function, used by all auth paths).
- Bearer token attachment to `/api/auth/session` POST.
- `100dvh` enforcement (delete the orphan `100vh`).
- `env(safe-area-inset-*)` standard wrapper component for top-right close
  buttons and bottom CTAs.

### §2.10 Stale Firebase assumptions

| Assumption                                          | Reality                                                                                 |
|------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Custom claims propagate within ~5s                   | iPad Safari ITP delays propagation by **up to 60s** in some conditions                  |
| `getIdTokenResult(true)` always returns fresh claims | True, but only if user has a valid session cookie — Safari ITP can drop it             |
| `onAuthStateChanged` fires once per state            | Fires twice on tab-reopen in some Safari versions (causes double `ensureServerSession`) |
| Firebase Auth + JWT can coexist                      | Two token lifetimes (Firebase 1h, JWT 30m) → desync window where one is valid, one isn't |
| The 5-day `pw_session` cookie outlives the Firebase ID token | True, but doesn't help if Firebase token can't refresh inside ITP                |

`server/routes/mobile-auth.ts` runs an **entirely parallel JWT path**
(30m access + 30d refresh, rotated, stored in `refreshTokens` table) for
mobile clients. The web app uses Firebase. The native iOS app (per
`docs/APPLE_DEVELOPER_SETUP_PLAN.md`) will use Firebase. The JWT path
serves an unknown population.

**Verdict:** Unify on Firebase Auth for browser + native, with the
server-issued `pw_session` cookie as the auxiliary trust signal. Delete
the mobile-auth.ts JWT path **only after confirming no production client
depends on it** — Phase 11. Until then, document it as "deprecated, do
not extend."

### §2.11 Legacy routing trees

`client/src/App.tsx` is **3,065 lines**. It declares the full route table
in one giant `<Switch>`. Routes are not grouped by role, by lifecycle, or
by surface — they are in roughly the order they were added across two
years.

A grep against actively-mounted routes finds:

- 250+ `<Route>` declarations.
- ~40 redirect-only routes (`<Redirect from="..." to="..." />`).
- 7 places where the same component renders under multiple paths.
- Multiple lazy-loaded chunks named after deleted features (search for
  `lazy(() => import('./pages/old-`).

**Verdict:** `App.tsx` is split by shell:

```
client/src/
├── routes/
│   ├── PublicRoutes.tsx       (Home, marketing, legal, /welcome, /signin, /signup)
│   ├── OnboardingRoutes.tsx   (/onboarding/*)
│   ├── CustomerShell.tsx      (logged-in customer surface)
│   ├── ProviderShell.tsx      (logged-in provider surface)
│   └── AdminBundle.tsx        (conditional, see §2.6)
├── App.tsx                    (under 200 lines — just shell switching)
```

This split is mechanical, not a rewrite. Phase 4 of the rollout.

---

## §3 New architecture proposal

### §3.1 One identity system

```
┌──────────────────────────────────────────────────────────┐
│  Server: POST /api/session/whoami                        │
│  Returns: { id, role, firstName, status,                 │
│             dashboards: ['customer'|'provider'|'admin'], │
│             onboardingNext: '/onboarding/...' | null,    │
│             featureFlags: { ... } }                      │
│  Source of truth for everything role-related.            │
└──────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ refresh on:
                          │  - sign in
                          │  - sign out
                          │  - role escalation (POST /api/auth/post-login response)
                          │  - 5-minute interval
                          │  - window focus
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Client: useWhoami() (TanStack Query)                    │
│  ONLY source of role/status/dashboards in UI.            │
│  Firebase user is read-only credential proof.            │
└──────────────────────────────────────────────────────────┘
```

What this replaces:
- `useSimpleAuth` Context (deleted).
- `useAuth` hook reading `['/api/auth/user']` (deleted — was redundant).
- Inline `localStorage.getItem('role')` lookups (deleted).
- Client-side `VITE_ADMIN_EMAILS` check (deleted).
- The 1.5-second settle period in `useAccountNavigation.ts:91` (deleted
  — `useWhoami` already handles loading state correctly).

Firebase Auth keeps three responsibilities and nothing else:
1. Issuing the ID token used to prove identity to `/api/auth/session`.
2. Persisting "the user is signed in" across tab/refresh via
   `indexedDBLocalPersistence`.
3. Providing the OAuth flow for Google / Apple / Facebook.

Custom claims are **deprecated for routing decisions** — they remain only
for server-side audit-log enrichment.

### §3.2 One onboarding system

```
Authenticated user lands → useWhoami() returns onboardingNext

  /onboarding (router)
  ├── /onboarding/name           (firstName required for all roles)
  ├── /onboarding/intent         (customer / provider / "just browsing")
  ├── /onboarding/customer/pets  (add at least one pet — skippable post-v1)
  ├── /onboarding/customer/done  (welcome card + CTA into /home)
  ├── /onboarding/provider/phone (OTP)
  ├── /onboarding/provider/kyc   (id, address, vehicle, business type)
  ├── /onboarding/provider/docs  (insurance, license, certs)
  ├── /onboarding/provider/review (pending state, "we'll email you")
  └── /onboarding/done           (terminal — clears onboardingNext server-side)

Every other onboarding route deleted:
  ✘ /complete-profile         (replaced by /onboarding/name)
  ✘ /provider-onboarding      (replaced by /onboarding/provider/*)
  ✘ /become-provider          (no purpose — duplicate entry)
  ✘ /apply-provider           (no purpose — duplicate entry)
  ✘ /forms/onboarding         (dead code)
  ✘ /consent-onboarding       (folded into /onboarding/name privacy block)
  ✘ /welcome-consent          (folded into /welcome)

Kept separate (different audience):
  ✓ /internal/onboard         (staff invite — token-gated, never customer-facing)
```

**Sticky path rule:** while `onboardingNext !== null`, any navigation to
`/`, `/home`, `/dashboard`, `/provider/*` etc. **redirects back to
`onboardingNext`**. The user cannot "exit onboarding by typing a URL."
This is a server-side check on `whoami`, not a client-side bandaid.

### §3.3 One profile owner model

Server endpoint **`POST /api/account/upsert`** is the only path that
creates or updates `users.firstName / lastName / phone / email`. It is
called by:
- Onboarding `/onboarding/name` step (creates first-time).
- Account settings (updates).
- OAuth post-login (creates from `name` claim).
- OTP post-verify (creates with `firstName` from the name step).

Three rules:
- **No user row may exist with null `firstName` after `/onboarding/name`
  completes.**
- **No session cookie issued before `firstName` is set.** Auth and
  identity are not the same — auth is the credential, identity is the
  name. Without the name, the user is mid-onboarding, not signed-in.
- **No client-side fallback like `'Pet Parent'`.** If `firstName` ever
  appears null at render time, that's a bug — log it, redirect to
  `/onboarding/name`.

Drizzle schema change: `users.firstName` becomes `NOT NULL` in Phase 7
(after backfilling existing nulls — most are phone-only OTP signups
that never completed the name step).

### §3.4 Separate Customer + Provider dashboards

Two shells. The user is in exactly one.

**CustomerShell** (`/c/*` or unprefixed authenticated routes):
- `/home` — overview, upcoming bookings, nearest Smart Hub, eGifts in wallet.
- `/bookings` — list, filterable.
- `/bookings/:id` — detail.
- `/walks` — Walk My Pet bookings.
- `/find` — find a sitter / walker / station map.
- `/wallet` — eGifts, loyalty points, payment methods.
- `/account` — settings.

**ProviderShell** (`/p/*`):
- `/p` — overview (today's bookings, earnings this week, rating).
- `/p/inbox` — booking requests + tasks.
- `/p/calendar` — schedule.
- `/p/earnings` — payouts + history.
- `/p/feedback` — reviews.
- `/p/account` — settings (separate from customer account).

Customer and Provider **cannot share a session** if the role differs.
If a user is both (rare — provider buying an eGift for their parent's
dog), they see a **role-switcher pill** in the top header and the shell
swaps. No cross-rendering.

**The decision** of which shell to boot is made **once at sign-in by
`whoami.dashboards[0]`**. The client does not re-decide per route.

### §3.5 No visible admin UI

Per §2.6 verdict. Phase 8 of the rollout introduces the sub-domain
approach: `admin.petwash.co.il` is a separate React build deployed to its
own Cloud Run service. The customer-facing bundle ships zero admin code.

Until Phase 8 ships, the interim mitigation is the "Acceptable" option
from §2.6: conditional route registration. Phase 3 implements it.

---

## §4 New route map

```
================================
  PUBLIC
================================
/                       Home (marketing)
/about                  Brand story
/stations               Smart Hub list
/stations/:slug         Smart Hub detail
/sitter-suite           Pet Sitter marketing
/walk-my-pet            Walker marketing
/paw-finder             Lost & Found public
/paw-finder/lost/:id    Lost-pet detail
/egift                  eGift hero
/egift/redeem/:code     Redemption
/legal/*                Privacy / Terms / Cookies / Accessibility / Trademark
/contact                Contact / support
/welcome                NEW — 4-button auth gateway
/signin                 NEW — returning user (single canonical)
/signup                 NEW — new user (single canonical)
/auth/action            Firebase action handler (only this path)

================================
  ONBOARDING (gated on onboardingNext != null)
================================
/onboarding/name        firstName + DOB + city
/onboarding/intent      customer | provider | browse
/onboarding/customer/*  pets, preferences, done
/onboarding/provider/*  phone, kyc, docs, review, done

================================
  CUSTOMER SHELL (authenticated, role=customer)
================================
/home                   Customer dashboard
/bookings               List
/bookings/:id           Detail
/walks                  Walks
/find                   Find a sitter / walker / station
/wallet                 eGifts + loyalty + payment methods
/account                Settings

================================
  PROVIDER SHELL (authenticated, role=provider)
================================
/p                      Provider overview
/p/inbox                Booking requests + tasks
/p/calendar             Schedule
/p/earnings             Payouts
/p/feedback             Reviews
/p/account              Provider settings

================================
  STAFF / INTERNAL (authenticated, role=staff)
================================
/internal/onboard       Invite-token entry
/staff/scan             QR scan tools

================================
  ADMIN (separate sub-domain or conditional bundle)
================================
admin.petwash.co.il/*   All /admin/* routes move here
```

**Routes deleted in the rebuild:**

```
/sign-in /login /sign-up /register
/dashboard /my/timeline /favourites (folded into /home)
/provider-os /provider/dashboard /provider/timeline /provider/console (collapsed into /p)
/provider-onboarding /become-provider /apply-provider /join-team (collapsed into /onboarding/provider)
/complete-profile (collapsed into /onboarding/name)
/forms/onboarding /consent-onboarding /welcome-consent (deleted)
/e-gift /e-gifts /gift-cards (collapsed into /egift)
/find-pet /lost-pet (collapsed into /paw-finder)
/referral (collapsed into /refer — pick one)
/ops/today /mobile-ops /mobile/ops /mobile/stations /m /s/:id (collapsed into /ops)
/audit-trail /admin/compliance-control-tower /admin/financial (use canonical paths)
/admin/login /admin/login-v2 (collapsed — admin is sub-domain)
/admin/* (moved to admin sub-domain)
```

Approximate route count reduction: **~250 → ~80**.

---

## §5 UX system proposal

### §5.1 Welcome screen (from `docs/AUTH_REBUILD_AUDIT.md`, brought forward)

Four buttons, vertical stack on mobile, equal visual weight. Apple at
the top (Apple Guideline 4.8 compliance for the native iOS app, plus
visual hierarchy in the brand voice). No gradients. No neon. No "or"
dividers — the buttons are not alternatives, they are equal entrances.

```
                  [ PetWash logo ]
                  Premium pet care.
                  Welcome.

              ┌─────────────────────┐
              │  Continue with Apple│
              └─────────────────────┘
              ┌─────────────────────┐
              │  Continue with Google│
              └─────────────────────┘
              ┌─────────────────────┐
              │  Mobile Number      │
              └─────────────────────┘
              ┌─────────────────────┐
              │  Email              │
              └─────────────────────┘

              By continuing you agree to our
              Terms and Privacy.

              Have an account? Sign in →
```

Notes:
- "Sign in" link sends to `/signin`. On `/signin`, the layout is identical
  but the headline is "Welcome back" and the bottom link is "Don't have
  an account? Sign up →".
- Passkey conditional-UI (`@simplewebauthn/browser` autofill) triggers
  automatically if a passkey is stored for the device — surfaces the
  Face ID prompt over the Welcome screen without a button.
- The "Mobile Number" path leads to OTP entry then to `/onboarding/name`.
- The "Email" path leads to magic link (no password). Password-based
  email/password sign-in remains in `/signin` for users who already have
  passwords; new signups never see a password field.

### §5.2 OTP screen — iOS autofill correct

```
                  Code sent to
                  +972 50 *** **89

                  ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐
                  │ ││ ││ ││ ││ ││ │
                  └─┘└─┘└─┘└─┘└─┘└─┘

                  Resend in 0:42

                  Wrong number? Go back →
```

Technical:
- Single `<input>` with `maxLength=6`, `inputMode="numeric"`,
  `autoComplete="one-time-code"`. The visual 6-box look is rendered
  on top with CSS — but **the actual input is one field** so iOS keyboard
  autofill works (iOS surfaces the SMS code as a single tap).
- Twilio SMS body MUST include `Your PetWash code is 123456 @petwash.co.il
  #123456` — the `@domain #code` suffix binds the code to the website
  for iOS keyboard suggestion. Add an assertion in the SMS service.
- WebOTP API fallback for Chrome / Android already in
  `OtpCodeInput.tsx:56-76`.

### §5.3 Onboarding stages

Each step is **one screen, one question, one CTA**. Mobile-first.
Progress dots at the top (3 dots for customer, 5 for provider). Back
arrow only — no "skip" in v1 (skipping creates the "Pet Parent" hole
we're fixing).

```
Step 1 (name):       "What should we call you?"
                     [First name      ]
                     [Last name       ]
                                              [ Continue ]

Step 2 (intent):     "Which best describes you?"
                     ◯ I want pet services
                     ◯ I want to offer services
                     ◯ Just browsing for now
                                              [ Continue ]

Step 3 (customer/pets): "Tell us about your pet"
                     [Pet name ]
                     [Species ▾]
                     [Breed (optional) ▾]
                     [Photo (optional)]
                                  [Skip]  [ Add Pet ]

Step 4 (customer/done): "Welcome to PetWash, [Name]"
                     "Your first wash is on us."
                                              [ Find a station → ]
```

For provider intent: steps 3+ are KYC. CEO already approved the
existing 7-step provider KYC content; this is purely a visual
re-skin to match the customer onboarding aesthetic.

### §5.4 Customer home

```
┌──────────────────────────────────────┐
│  ☰  PetWash                     [👤] │  Header (hamburger + avatar)
├──────────────────────────────────────┤
│  Good morning, Nir.                  │  Greeting (firstName, never "USER")
│                                      │
│  Upcoming                            │
│  ┌────────────────────────────────┐  │
│  │ Smart Hub — Tel Aviv Central   │  │
│  │ Tomorrow at 09:30              │  │
│  │ [Manage] [Get directions]      │  │
│  └────────────────────────────────┘  │
│                                      │
│  Nearest station                     │
│  ┌────────────────────────────────┐  │
│  │ [map preview]                  │  │
│  │ Smart Hub — Dizengoff (1.2km)  │  │
│  │ [Open in app]                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  Your wallet                         │
│  ┌────────────────────────────────┐  │
│  │ ₪240 eGift balance             │  │
│  │ 2,140 loyalty points           │  │
│  │ [View wallet →]                │  │
│  └────────────────────────────────┘  │
│                                      │
│  Weather today                       │  WeatherKit (mobile app only)
│  ┌────────────────────────────────┐  │
│  │ ☀ 23°C — perfect for a walk    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
[ 🏠 Home ][ 📅 Bookings ][ 🐾 Find ][ 💰 Wallet ]  Bottom tab (existing component, kept)
```

### §5.5 Provider home

Same shell, different cards. Today's bookings, earnings this week, rating
trend, inbox unread badge.

### §5.6 Hamburger — premium revision

Today's 8 sections collapsed and re-prioritized:

```
☰ Menu

  PLATFORMS               (current 8 items — no change)
  ─────────────────────
  Smart Hub
  Pet Sitter
  Pet Walker
  PetFinder
  Pet Trek                (badge: "Soon")
  Academy
  Shop                    (badge: "Soon")
  Avatar Studio           (badge: "Soon")

  YOUR ACCOUNT
  ─────────────────────
  Dashboard
  Bookings
  Wallet & eGifts
  Refer a friend
  Settings

  HELP
  ─────────────────────
  Contact us
  System status

  ── (footer mini-row, smaller font, muted)
  About · Privacy · Terms · © 2026

  [Log out]                (red text, bottom)
```

What moves:
- **Legal links** out of the 8-item LEGAL section → into the muted footer
  mini-row. 6 items become 2 (Privacy + Terms) with `· · ·` separators.
  Reduces clutter without losing access.
- **Partners & Franchise** section → moved out of customer hamburger
  entirely. Lives only at `/franchise` (public marketing page).
- **Company** section → moved out. Lives only at `/about` and footer.

This satisfies the "reduce legal clutter from primary UX" mission goal.

### §5.7 Account settings

Single screen, no nested pages for v1. Sections:

```
[Avatar] Nir Hever                       [Edit]
nir@petwash.co.il
+972 50 *** **89

  Personal
  Name, date of birth, language

  Security
  Passkey ✓  Face ID ✓  Trusted devices: 2
  [Manage]

  Notifications
  Email · SMS · WhatsApp · Push toggles per channel

  Payment methods
  Apple Pay ✓ · Visa **4242
  [Manage]

  Privacy & consent
  Marketing emails: Off
  Analytics: On (no tracking pixels per policy)
  [Manage]

  Connected platforms
  Apple ✓
  Google (not connected)
  Facebook (not connected)
  [Manage]

  ─────────────────────────────────────
  [Log out]
  Delete account →
```

---

## §6 State ownership proposal

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: SERVER — single source of truth                │
│   - users table (canonical row)                         │
│   - userConsents table (append-only audit log)          │
│   - userDevices table (trusted-device 30-day window)    │
│   - Firebase custom claims (audit enrichment ONLY)      │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ /api/session/whoami
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: TANSTACK QUERY — single client cache           │
│   queryKey: ['session', 'whoami']                       │
│   staleTime: 2 minutes                                  │
│   refetchOnWindowFocus: true                            │
│   refetchInterval: 5 minutes                            │
│   Invalidated on: signIn, signOut, role-change response │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ useWhoami() hook
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: UI                                             │
│   No component reads identity from anywhere else.       │
│   No Zustand store for user state.                      │
│   No Context for user state.                            │
│   No localStorage reads for user state at render time.  │
└─────────────────────────────────────────────────────────┘
```

What stays in Context / Zustand:
- **Language preference** — `languageStore.tsx` is the single source.
  Delete the App.tsx polling at lines 3265–3291.
- **Booking draft** — non-identity ephemeral state.
- **Pet onboarding draft** — per-form, ephemeral.

What is in localStorage (and ONLY there):
- `pw_lang` — language preference.
- `pw_passkey_email` — last-seen email for Face ID auto-prompt.
- `pw_device_id` — local device fingerprint for trusted-device.
- That's it. Anything auth-related comes from `whoami`.

---

## §7 Native iPhone UX

### §7.1 Face ID / biometric return

Already wired via `client/src/auth/passkey.ts` (`@simplewebauthn/browser`).
Three improvements:

1. **Conditional UI on `/welcome`** — passkey autofill triggers Face ID
   automatically when the user opens the Welcome screen, before they tap
   any button. Already implemented at `passkey.ts:354-409` but only on
   `/signin`. Move to `/welcome`.

2. **Trusted device window** — `client/src/lib/deviceTrust.ts` is
   localStorage-only today. Server-side enforcement requires a new
   `userDevices` table (Phase 7):

   ```
   userDevices: id, userId, deviceId (uuid), name (e.g. "iPhone 15 Pro"),
                userAgent, lastSeen, trustedUntil, createdAt
   ```

   30-day window from `trustedUntil`. Re-prompt OTP/Face ID after window
   expires.

3. **Save login (OAuth tokens not stored client-side)** — Firebase
   `indexedDBLocalPersistence` already handles this. The "save login"
   checkbox is misleading because it implies an optional behavior — in
   reality, persistence is always on for the same device. Replace the
   checkbox with copy "Stay signed in on this device for 30 days" and
   write to `userDevices`. If the user unchecks, set the 30-day to "this
   session only."

### §7.2 OTP autofill

Already correct in `OtpCodeInput.tsx` (`autoComplete="one-time-code"` +
WebOTP). Two follow-ups in §2.7.

### §7.3 Safe areas + 100dvh

One sweep in Phase 2 fixes:
- The orphan `100vh` at `client/src/index.css:1842`.
- The hamburger close button (`petwash-header.css` `.pw-mobile-top`).
- Any other `100vh` discovered by grep (per platform skill §2 mobile-first).

### §7.4 Deep-link safety

Today's `?from=` pattern in `RequireAuth.tsx:19-21` + `SignIn.tsx:178-192`
works but is race-prone — if `post-login` takes >1s and the URL is
rewritten mid-flight, the user can lose the `from`. Replace with a
server-side stash:

```
GET /booking/123 (not authenticated)
  → /signin
  → server stores { stashedReturnPath: '/booking/123' } against session id
  → user signs in
  → /api/session/whoami response includes returnPath
  → client navigates there atomically, server clears the stash
```

This survives ITP redirects, popup-vs-redirect mode swaps, and double
auth-state-changed events.

---

## §8 Hebrew + English RTL safety

Six concrete fixes:

1. **Drawer slide direction** — `petwash-header.css:936-937, 952-953,
   1120-1126` use logical-property-aware math instead of hardcoded
   `right / left`. CSS `:dir(rtl) .pw-mobile-drawer { ... }` selector
   pattern.

2. **Hardcoded `dir="rtl"` in components** — 6+ files reviewed. Replace
   with a single `useLocaleDirection()` hook that returns `'rtl' | 'ltr'`
   from the language store. Components apply `dir={direction}` once at
   their root.

3. **BiDi isolation** — `PetWash™` is wrapped in U+2066/U+2069 in
   `client/src/content/platformCards.ts:183`. The same pattern must apply
   anywhere "PetWash" / "PetWash™" sits inside Hebrew text:
   `Footer.tsx`, `WashPackages.tsx`, marketing copy, push notifications,
   email templates, SMS templates.

4. **Locale resolver consolidation** — `resolveLocale()` in
   `client/src/lib/platformCardAsset.ts` is the canonical pattern (CEO
   directive: app store > navigator > English fallback, NEVER IP). Lift
   it to `client/src/lib/locale.ts` and make it the only resolver.

5. **Critical flow audit** — booking, checkout, eGift, profile, account
   need explicit RTL pass after Phase 5 (UX redesign). Test matrix per
   platform skill §5.

6. **Numerals** — Hebrew typically uses Western Arabic numerals (1234,
   not ١٢٣٤). Verify all price displays do not switch numerals.

---

## §9 Phased rebuild plan with rollback

**Total: ~120–150 engineer-hours across 11 PRs.** Each phase is
independently revertible by reverting one commit. No phase requires the
previous phase to be deployed — they are decoupled by feature flags.

| Phase | PR title                                              | Hours | Rollback                                          |
|-------|-------------------------------------------------------|-------|---------------------------------------------------|
| 1     | `chore(routes)`: delete orphan / duplicate aliases    | 6     | Revert single commit; routes were aliases anyway. |
| 2     | `fix(safari)`: 100dvh sweep + safe-area + RTL drawer  | 4     | Revert single commit; pure CSS.                   |
| 3     | `feat(admin)`: conditional admin route registration   | 8     | Feature flag `ADMIN_ROUTES_GATED` off → reverts.  |
| 4     | `chore(routes)`: split App.tsx into shells            | 16    | Revert single commit; mechanical refactor only.   |
| 5     | `feat(welcome)`: new `/welcome` + `/signin` + `/signup` | 20  | Behind flag `AUTH_REBUILD_VISIBLE`. Off = old pages render. |
| 6     | `feat(onboarding)`: unified `/onboarding/*` flow       | 24    | Behind flag `ONBOARDING_REBUILD`. Off = old pages. |
| 7     | `feat(devices)`: `userDevices` table + 30-day trust    | 12    | Migration is additive; flag `TRUSTED_DEVICE_30D`.  |
| 8     | `feat(admin-subdomain)`: admin.petwash.co.il bundle    | 16    | Old `/admin/*` routes stay live until DNS cut.    |
| 9     | `feat(hamburger)`: legal moves to footer, IA cleanup   | 6     | Revert single commit; nav-only.                   |
| 10    | `chore(auth)`: collapse super-admin checks + ADMIN_ROLES literal | 8 | Single source migration; revert per file. |
| 11    | `chore(auth)`: delete `mobile-auth.ts` JWT path        | 10    | Confirm telemetry first; revert restores file.    |

**Order matters for risk:**
- Phase 1–2 land first because they're pure cleanup with zero behavior change.
- Phase 3 unblocks the admin sub-domain work.
- Phase 4 unblocks Phases 5–6 by making the shell-split available.
- Phases 5–6 ship together behind one combined flag for QA.
- Phase 7 is the only schema migration; it's additive.
- Phase 8 is the biggest single piece — DNS + new Cloud Run + admin-only
  build. Plan a 4-hour deploy window.
- Phase 11 is the last because it deletes legacy code and can't be
  re-undeleted without effort.

**Feature flags (existing pattern in `client/src/config/featureFlags.ts`):**

```
VITE_AUTH_REBUILD_VISIBLE='false'     → default off
VITE_ONBOARDING_REBUILD='false'       → default off
VITE_ADMIN_ROUTES_GATED='false'       → default off
VITE_TRUSTED_DEVICE_30D='false'       → default off
VITE_ADMIN_SUBDOMAIN_ACTIVE='false'   → default off
```

Production rollout per phase: dark-launch (flag off for everyone) → CEO
preview (flag on for `nir.h@petwash.co.il` only) → 10% canary → 100%.

---

## §10 Tests + observability per phase

Per platform skill §5. Every PR's report block must include:

- `tsc --noEmit` before/after error count.
- `vitest` before/after pass/fail count.
- Manual test matrix: iPhone Safari (mandatory), iPad Safari, Desktop
  Chrome, RTL Hebrew flow end-to-end, LTR English flow end-to-end,
  signed-out, signed-in customer, signed-in provider, signed-in admin.
- Risk classification (low / medium / high) + one-sentence rationale.
- Rollback plan (per phase table above).

New monitoring added in Phase 4:
- Auth funnel: `/welcome` → button click → `/signin` or `/signup` →
  `/onboarding/name` → terminal. Emit `pw_auth_step` event at each
  transition. Surface in CEO brain dashboard.
- Identity desync alarm: if `whoami.role !== firebaseClaims.role`,
  log warning + force `getIdTokenResult(true)`. Threshold alert if >1%
  of sessions hit this in a 1-hour window.

---

## §11 Decisions awaiting CEO

Numbered so we can lock them one at a time in chat.

- **A.** Admin separation: **sub-domain** (`admin.petwash.co.il`,
  separate build, 8h work) OR **conditional bundle** (route registration
  gated, 4h work, admin JS still ships)?
  *Recommendation: sub-domain.*

- **B.** Customer/Provider dual-role users: support **role-switcher pill**
  in header (rare case, ~50 users today) OR **forbid** (one account, one
  role, second account if needed)?
  *Recommendation: role-switcher — cheaper than account-merge support
  tickets, and CEO is one of the dual-role users.*

- **C.** Phone-OTP-only signup: require **email** at name step (so we
  can email receipts + recovery) OR **truly phone-only** (no email row
  in users table)?
  *Recommendation: email **optional** at signup, mandatory at first
  booking. SMS receipts in the meantime.*

- **D.** Orphaned sub-platform dashboards (Sitter, Walker, PetTrek,
  Trainer): **route them now** OR **delete them** until those products
  go GA?
  *Recommendation: delete from disk. Re-introduce when each platform's
  product is ready. Current code is stale.*

- **E.** `mobile-auth.ts` JWT path: **deprecate now** (Phase 11) OR
  **keep indefinitely** for an unknown mobile-app client?
  *Recommendation: telemetry first — log every call for 2 weeks. If no
  call volume, delete in Phase 11. If volume, keep and document.*

- **F.** Legal links in hamburger: **move all 6 to footer mini-row**
  (mission goal) OR **keep current LEGAL section**?
  *Recommendation: move to footer mini-row. Improves UX clarity. Legal
  team has no concern as long as Privacy + Terms remain one-tap
  accessible.*

- **G.** Trusted-device window: **30 days** (proposal) OR longer / shorter?
  *Recommendation: 30 days, matches the existing `pw_session` cookie
  upper bound and Israeli banking sector norms.*

- **H.** `firstName NOT NULL` migration (Phase 7): how to handle existing
  phone-OTP users with null firstName — **email them** to complete profile,
  OR **force the onboarding step** on next login, OR **set placeholder
  from phone-last-4** at backfill?
  *Recommendation: force the onboarding step on next login. Email follow-up
  if no login in 30 days. No placeholder names ever.*

---

## §12 What this PR does NOT do

Per platform skill §2 ("one purpose per PR" + non-negotiable rules):

- No code changes.
- No new dependencies.
- No schema migrations.
- No wallet / finance / Tranzila / K9000 / Nayax changes.
- No Firebase project configuration changes.
- No DNS / Cloud Run changes.
- No deletion of any orphaned file — Decision D gates that.
- No feature flag introductions — Phase 1 PR introduces them.

---

## §13 References

- `docs/AUTH_REBUILD_AUDIT.md` — Welcome screen 4-button design,
  Apple Guideline 4.8, passkey wiring.
- `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` — 12 identity bandaids
  (1.5s settle period, /home universal fallback, dual super-admin checks).
- `docs/APPLE_DEVELOPER_SETUP_PLAN.md` — iOS native shell, Bundle IDs,
  Universal Links, App Store Review strategy.
- `docs/PRODUCTION_QUALITY_AUDIT.md` — Cookies page, hamburger menu,
  platform cards cutoff fixes.
- Platform skill `.claude/skills/petwash-platform/SKILL.md` — non-negotiable
  code rules, mobile-first mandate, design rules.

---

**End of audit.** No code ships from this PR. Implementation gated on CEO
sign-off on Decisions A–H.
