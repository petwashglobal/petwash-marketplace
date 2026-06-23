# SDD: Three-Frontend App-Structure Rebuild (Website / Prestige / Provider)

- **Date:** 2026-06-24
- **Author:** SDD Writer Agent (Claude)
- **Status:** Draft
- **Feature flag (master):** `VITE_APP_STRUCTURE_V2_ENABLED` (default OFF)
- **Per-stage sub-flags:** `VITE_PRESTIGE_SHELL_ENABLED`, `VITE_PROVIDER_SHELL_V2_ENABLED` (default OFF)
- **Coordination note:** This document is the single coordination artifact for the
  app-structure rebuild. Claude and Codex MUST both build against this SDD and not
  invent a parallel structure. If reality diverges from this document, update the
  document in the same PR — do not fork the design.

---

## 1. Summary

The CEO has approved a full rebuild of the mobile **app structure** so that the
platform is delivered as **three distinct front-ends over one shared backend**:
the public **Website** (marketing/SEO), the **Prestige** customer/loyalty app,
and the **Provider** work/operations app — the "Uber rider vs Uber driver"
split. Today these three experiences share **one flat route tree** in
`client/src/App.tsx` (3,989 lines, ~330 routes), gated only by role guards, and
the signed-out customer app still lands on the marketing Landing page.

The key correction this SDD makes to the brief: **most of the target already
exists** (two real native apps, a full Provider OS shell, customer/Prestige
surfaces, per-app bottom navs, role guards, a flavor-detection pattern). So this
is **not a teardown**. It is a **staged, additive re-organization**: introduce
four route namespaces (`/public/*`, `/prestige/*`, `/provider/*`, `/admin/*`)
plus a Prestige app shell, **re-host** existing screens under them, redirect old
paths, and **flip each app's cold-start entry** behind feature flags — without
ever changing money/finance behavior or breaking the live App-Store-approved
apps.

This is a production system moving real money. The work ships dark, one large
coherent stage per branch/PR/merge, each independently reversible.

---

## 2. Goals / Non-goals

### Goals
1. Four route namespaces with **redirects from every existing path** so no live
   URL, deep link, push payload, or email link 404s.
2. A dedicated **app-native shell per app**: a new **Prestige shell** (header +
   5-tab bottom nav + member home) and the existing **Provider OS** shell
   (already driver-app style). Website keeps marketing chrome.
3. **App entry behavior:** Prestige app always opens to member welcome/login
   (signed-out) or member home (signed-in) — never the marketing Landing.
   Provider app opens to the provider work dashboard or onboarding/application
   status. (Provider entry is already correct; the customer signed-out gap is the
   real fix — `client/src/App.tsx:760-771`.)
4. **Role-scoped exposure / no cross-leak:** Prestige app exposes only
   CUSTOMER / PRESTIGE_MEMBER surfaces; Provider app exposes only
   PROVIDER_APPLICANT / APPROVED_PROVIDER surfaces.
5. A **screen-coverage matrix** mapping all **48 CEO-listed screens** (23
   Prestige + 25 Provider) to EXISTS-rehost / EXISTS-partial / MISSING, with the
   target route and owning component for each.
6. **App-specific push routing** so Prestige and Provider notification sets never
   cross.

### Non-goals (out of scope — DO NOT TOUCH)
- **Finance math / money runtime is SACRED.** Wallet/ledger/credits, SUMIT,
  Nayax, Tranzila/uPay, K9000 redemption, receipt/tax-sequence numbering,
  payout rails — the rebuild may **re-host these screens under new routes** but
  MUST NOT change their behavior, math, request bodies, idempotency keys, or API
  endpoints. Re-hosting = a route alias + redirect, **not** a rewrite.
- **No schema migrations.** No new DB tables/columns in this work. (The one
  push-routing data need is satisfied without a SQL migration — see §6.6.)
- **No new dependencies / no `package.json` / no lockfile changes.** Any such need
  is a separate, explicitly approval-gated item.
- No redesign of individual screens' internals, no new business features, no
  admin-module rework beyond namespacing `/admin/*`.
- No native project restructuring (the two Xcode/Gradle projects stay as-is).

---

## 3. Repository context — what exists today (cited)

### 3.1 Two real native apps already exist
- Provider bundle `il.co.petwash.provider` — `config/capacitor/provider.config.ts`.
- Customer bundle `com.petwash.il` / `il.co.petwash.customer` —
  `config/capacitor/customer.config.ts` (`ios.path: "ios-customer"`,
  `android.path: "android-customer"`).
- Build-time config swap + run helper: `scripts/mobile/run-capacitor-app.mjs`
  (maps `provider`→`provider.config.ts`, `customer`→`customer.config.ts`, copies
  to `capacitor.config.ts`), plus `scripts/mobile/select-capacitor-config.mjs`.
- **Conclusion:** the two-app native plumbing is correct and is **not** rebuilt.

### 3.2 Runtime flavor detection already exists (in two places — consolidate)
- `client/src/App.tsx:731-749` detects bundle id at cold start
  (`setIsProviderApp` / `setIsCustomerApp` from `CapApp.getInfo().id`).
- `client/src/components/AppTermsGate.tsx:92-102` has a second copy:
  `detectFlavor()` → `'web' | 'customer' | 'provider'`.
- **Gap:** flavor detection is duplicated. Stage 0 should extract ONE helper
  (e.g. `client/src/lib/app-flavor.ts`) both call. Low-risk, additive.

### 3.3 Smart cold-start router exists, with one real gap
- `client/src/App.tsx:760-771`: provider app → `/provider-os` (or
  `/provider-onboarding`); signed-in customer app → `/dashboard`.
- **Gap (the brief's core complaint):** signed-**out** customer app falls through
  to the marketing Landing at `/` (`App.tsx:768` only routes `isCustomerApp && user`).
  Target: signed-out Prestige app must open a member welcome/login.

### 3.4 Provider OS is already a full operations shell
- `client/src/pages/provider-os/ProviderOS.tsx` with its own header + internal
  bottom nav (`BOTTOM_NAV`, `ProviderOS.tsx:37-42`) and 11 modules
  (`POSDashboard`, `POSJobs`, `POSCalendar`, `POSWallet`, `POSDocuments`,
  `POSServices`, `POSSafety`, `POSNotifications`, `POSAssistant`, `POSProfile`,
  `POSSettings`).
- Deep-link by `?m=<module>` (`ProviderOS.tsx:77-83`).
- Standalone provider pages already linked: `/provider/tasks`,
  `/provider/earnings`, `/provider-compliance`, `/provider/feedback`,
  `/provider/ranking` (`ProviderOS.tsx:59-65`).
- **Conclusion:** the Provider app shell is ~built. Provider work is mostly
  **namespacing + entry-confirmation**, not new screens.

### 3.5 Customer / Prestige surfaces exist
- `/dashboard` → `DashboardV2` behind `VITE_DASHBOARD_V2_ENABLED` else legacy
  `Dashboard` (`App.tsx:973-983`).
- `/prestige-pass` → `PrestigePassWallet` (live QR member card),
  `/prestige-club`, `/prestige/waitlist` (`App.tsx:1012-1031`).
- Wallet `MyWallet.tsx`, `/bookings` → `CustomerBookings`, `/loyalty/*`
  (`Loyalty*`), receipts `ReceiptPage.tsx`, pets `Pets.tsx` / `PetPassport.tsx`,
  `/paw-finder`, shop `Shop.tsx` / `ShopStore.tsx` / `ShopOrders.tsx`,
  gift cards `BuyGiftCard.tsx` / `EGift.tsx` / `GiftActivate.tsx`.

### 3.6 Per-app navigation already differs
- `client/src/components/MobileBottomNav.tsx`: `PROVIDER_NAV` (4 tabs, lines
  33-38) vs `CUSTOMER_NAV` (5 tabs, lines 20-26), chosen by `role === 'provider'`
  (line 108-109). Hidden on desktop (`md:hidden`) and on immersive routes via
  `isImmersiveRoute()` (line 106).
- `client/src/lib/immersive-routes.ts`: canonical shell-suppression list (already
  lists `/provider-os`, `/prestige-pass`, `/loyalty`, auth/KYC/onboarding).
- **Note:** today the bottom nav switches on **server role**, not on **app
  flavor**. The Prestige nav is the CUSTOMER_NAV; this is fine to reuse.

### 3.7 Role guards exist
- `client/src/auth/RoleProtectedRoute.tsx` with `ROLE_HIERARCHY` (public=1 …
  super_admin=10) and an optional `requiredDashboard` check against
  `dashboardsAllowed`.
- `client/src/auth/useWhoami.ts` returns `role`, `dashboardsAllowed`
  (`'member'|'provider'|'staff'|'admin'`), and crucially the projection fields
  `providerStatus`, `prestigeStatus`, `activeFlow` (`useWhoami.ts:25-27`).
- **Backend is the source of truth** for role (server `whoami`); client guards
  are convenience + UX, never the security boundary.

### 3.8 Push notifications already wired
- `client/src/hooks/useFCMNotifications.ts` (auto-registers after login),
  `client/src/lib/fcm-notifications.ts` saves the token to Firestore at
  `fcmTokens/{userId}/devices/{deviceId}` (`fcm-notifications.ts:138-150`).
- Server senders: `server/lib/fcm-push.ts`, `server/routes/fcm.ts`,
  `server/routes/push-notifications.ts`.
- **Gap for cross-app routing:** the saved token doc records `platform`,
  `deviceName`, `userAgent` — but **NOT an app flavor**. So a Prestige push and a
  Provider push currently can't be steered to the right device. See §6.6.

### 3.9 The single flat route tree (the thing being re-organized)
- `client/src/App.tsx` `<Switch>` begins at line 794; routes span ~`796-3708`.
- There is **already a redirect convention** in this file (e.g. `App.tsx:854-869`,
  `/provider/dashboard`→`/provider-os` at `App.tsx:1776`), which the new
  namespace redirects will follow exactly.
- There is **no** `/public/*` `/prestige/*` `/provider/*` `/admin/*` grouping
  today; `/admin/*` paths exist by convention but are interleaved with everything
  else.

### Platform invariants that constrain this work
- Money is sacred; every money mutation is audited and idempotent; backend is the
  source of truth. (See MEMORY: money-map, refund-rail-gap, K9000 hardware
  reality.) Re-hosting must preserve all of this byte-for-byte.
- CEO rule: **batch into ONE branch/PR/merge per shippable stage** (each merge is
  a multi-minute prod deploy he waits through).
- Brand: pure white bg, black text, metallic gold `#D4AF37` accents; Hebrew-first
  / RTL; real PetWash logo asset only, top-center.

---

## 4. Users & roles / accessibility scoping

### 4.1 Actor → app exposure matrix

| Actor (server role / status) | Website | Prestige app | Provider app | Admin (`/admin/*`) |
|---|---|---|---|---|
| Anonymous (`public`) | Full marketing + public shop/signup | Welcome/Login only | Provider login/apply only | No |
| CUSTOMER / PRESTIGE_MEMBER | Yes (marketing) | **Full** | No (redirect to "become a provider") | No |
| PROVIDER_APPLICANT | Yes | Limited (can also be a customer) | Application status + onboarding | No |
| APPROVED_PROVIDER | Yes | Limited (if also a customer) | **Full** | No |
| ADMIN / SUPPORT / staff+ | Yes | As their customer identity | As their provider identity | **Yes** |

- **No cross-leak rule:** Provider app must not present customer shop/loyalty as
  its main experience; Prestige app must not present earnings/payouts/compliance/
  docs. A user who is *both* provider and customer switches **mode** intentionally
  (mode = which native app they opened; web can offer an explicit switcher). This
  is enforced by (a) the cold-start entry router per flavor, and (b) namespace
  guards (`/prestige/*` requires member-eligibility, `/provider/*` requires
  provider role) — defense in depth on top of the existing
  `RoleProtectedRoute`/`whoami` server truth.

### 4.2 Accessibility & localization
- Hebrew-first / RTL throughout; reuse `useLanguage()` + `dir` handling already
  in `MobileBottomNav.tsx:83,112-115`. New Prestige shell must mirror this.
- Bottom-nav tap targets, `aria-label`/`aria-current` already modeled in
  `MobileBottomNav.tsx:140-141` — copy the pattern, don't invent.
- Shell chrome must stay suppressed on immersive routes (auth/KYC/payment-
  redirect) via `isImmersiveRoute()` — extend the list, never re-implement it.

---

## 5. Architecture — current state vs target state

### 5.1 Current state
```
                client/src/App.tsx  (ONE flat <Switch>, ~330 routes)
                          │
   ┌──────────────────────┼───────────────────────────────┐
   │ cold-start router (App.tsx:760-771) by bundle flavor   │
   └──────────────────────┼───────────────────────────────┘
   provider flavor → /provider-os | /provider-onboarding
   customer flavor + signed-in → /dashboard
   customer flavor + signed-OUT → (falls through to marketing Landing)  ← GAP
   web → Landing
              shared chrome: MobileBottomNav (role-switched), Floating widgets,
              suppressed by isImmersiveRoute()
```

### 5.2 Target state
```
   ┌─────────────────────────────────────────────────────────────────┐
   │            client/src/lib/app-flavor.ts  (ONE resolver)           │
   │              → 'web' | 'prestige' | 'provider'                     │
   └───────────────┬───────────────────────────────────────┬─────────┘
                   │ cold-start entry router (per flavor)    │
   web → /public/home (marketing)                            │
   prestige flavor → /prestige (signed-in home) | /prestige/welcome (signed-out)
   provider flavor → /provider (work home) | /provider/application-status
                   │
   ┌───────────────┼───────────────────────────────────────────────────┐
   │ Namespaced route tree (additive; old paths 301→ new)               │
   │   /public/*    PublicSite chrome      (marketing/SEO/shop/landing)  │
   │   /prestige/*  PrestigeShell          (header + 5-tab nav + home)   │
   │   /provider/*  ProviderOS shell       (existing driver-app shell)   │
   │   /admin/*     Admin chrome           (unchanged behavior)          │
   └────────────────────────────────────────────────────────────────────┘
              All four call ONE backend with the caller's role/permissions.
```

### 5.3 Shell ownership
- **PublicSite:** existing marketing chrome (header/footer). Keep as-is; just
  re-rooted under `/public/*` with redirects from bare marketing paths.
- **PrestigeShell (NEW, thin wrapper — not new screens):** owns header (logo
  top-center, gold accents), the 5-tab bottom nav (Home, Book, Shop, Wallet,
  Account — reuse `CUSTOMER_NAV` semantics), and renders the existing member
  surfaces inside. Member home = `DashboardV2` (already behind
  `VITE_DASHBOARD_V2_ENABLED`).
- **ProviderShell:** already exists as `ProviderOS.tsx`. Re-host under
  `/provider/*`; its internal nav and modules are untouched.
- **Admin:** existing pages; only the route prefix is normalized.

### 5.4 Re-hosting mechanism (key design decision)
Re-hosting is a **route alias**, NOT a file move or rewrite:
- New canonical route under the namespace renders the **same existing component**
  (e.g. `/prestige/wallet` mounts the existing `MyWallet`).
- The **old path becomes a redirect** to the new canonical path (using the
  existing `<Redirect>` convention, `App.tsx:854-869`).
- Money screens (wallet, checkout, K9000 redeem, receipts) are re-hosted this way
  with **zero changes to the component body** — same API calls, same flags. The
  diff for a money screen is literally a new `<Route>` + a `<Redirect>` line.

### 5.5 Happy paths
- **Prestige cold start (signed-in):** open app → `app-flavor='prestige'` →
  router sends `/` → `/prestige` → PrestigeShell renders member home; bottom nav
  visible.
- **Prestige cold start (signed-out):** open app → `/prestige/welcome`
  (member login) — **never** marketing Landing. (Fixes `App.tsx:768`.)
- **Provider cold start:** open app → `app-flavor='provider'` → `/provider`
  (approved) or `/provider/application-status` (applicant) → ProviderOS.

### 5.6 Failure paths
- **Flavor undetectable** (`getInfo()` throws / web): resolver returns `'web'`,
  router leaves `/` on marketing Landing — current behavior preserved.
- **whoami transient error:** `RoleProtectedRoute.tsx:44-51` already keeps the
  user in place and retries; namespace guards inherit this (reuse the same guard).
- **Flag OFF:** every new namespace route is mounted only when its flag is on;
  with flags off the live flat tree is the sole authority. Old paths keep working.
- **Old deep link / push during rollout:** old path still resolves (Stage 0 ships
  redirects *before* entry flips), so a stale push payload never dead-ends.

---

## 6. Screen-coverage matrix (all 48 CEO-listed screens)

Legend: **R** = EXISTS, re-host (route alias only). **P** = EXISTS-partial
(component exists but needs wiring/gap-fill). **M** = MISSING, build new.

### 6.1 Prestige app (23 screens)

| # | CEO screen | Status | Target route | Owning component (current) |
|---|---|---|---|---|
| 1 | Welcome/Login | **P** | `/prestige/welcome` | `Landing`/auth pages; needs a member-specific welcome (signed-out entry gap, `App.tsx:768`) |
| 2 | Member Card / QR | **R** | `/prestige/pass` | `PrestigePassWallet.tsx` (`App.tsx:1023`) |
| 3 | Home Dashboard | **R** | `/prestige` | `DashboardV2.tsx` / `Dashboard.tsx` (`App.tsx:973-983`) |
| 4 | Pet Profiles | **R** | `/prestige/pets` | `Pets.tsx`, `PetPassport.tsx` |
| 5 | Book Self-Service Wash | **R** | `/prestige/book/wash` | K9000 booking (`/k9000/booking/:stationId?`, `App.tsx:2005`) |
| 6 | Buy Wash Package | **R** | `/prestige/packages` | `Packages.tsx` |
| 7 | Gift Card | **R** | `/prestige/gift` | `BuyGiftCard.tsx`, `EGift.tsx` (**money — re-host only**) |
| 8 | Pet Sitter Booking | **R** | `/prestige/book/sitter` | `sitter-suite/*` (`App.tsx:1899`) |
| 9 | Walk My Pet Booking | **R** | `/prestige/book/walk` | `walk-my-pet/*` (`App.tsx:1701`) |
| 10 | Trainer Booking | **R** | `/prestige/book/trainer` | `academy/*` (`App.tsx:1558`) |
| 11 | Pet Transport Booking | **P** | `/prestige/book/transport` | `pettrek/*` — **FROZEN/Coming Soon** (`App.tsx:1795+`); route stub now, surface when unfrozen |
| 12 | Shop | **R** | `/prestige/shop` | `Shop.tsx` / `ShopStore.tsx` (`App.tsx:1139`) |
| 13 | Product Details | **R** | `/prestige/shop/:id` | within `ShopStore.tsx` |
| 14 | Cart | **R** | `/prestige/cart` | shop cart (existing in `Shop*`) |
| 15 | Checkout | **R** | `/prestige/checkout` | shop checkout (**money — re-host only**) |
| 16 | Wallet / Credits | **R** | `/prestige/wallet` | `MyWallet.tsx` (**money — re-host only**) |
| 17 | Rewards | **R** | `/prestige/rewards` | `LoyaltyDashboard.tsx` / `/loyalty/*` (`App.tsx:1044-1078`) |
| 18 | Receipts / Invoices | **R** | `/prestige/receipts` | `ReceiptPage.tsx`, `/receipt/:transactionId` (`App.tsx:3651`) |
| 19 | Booking History | **R** | `/prestige/bookings` | `CustomerBookings.tsx` (`App.tsx:985`) |
| 20 | Reschedule / Cancel | **P** | `/prestige/bookings/:id` | within `CustomerBookings.tsx` (cancel/refund logic — **do not touch refund math**) |
| 21 | Support | **R** | `/prestige/support` | `Support.tsx` (`App.tsx:1210`) |
| 22 | Account Settings | **R** | `/prestige/account` | `MyAccount.tsx` / `Settings.tsx` |
| 23 | Terms / Privacy | **R** | `/prestige/legal/*` | `/legal/*` pages (`App.tsx:1237+`) — WebView-allowed |

**Prestige MISSING/partial:** only #1 (member welcome for signed-out) is a real
small build; #11 transport is blocked by the PetTrek freeze (route stub only).

### 6.2 Provider app (25 screens)

| # | CEO screen | Status | Target route | Owning component (current) |
|---|---|---|---|---|
| 1 | Provider Login | **R** | `/provider/login` | auth pages + flavor entry (`App.tsx:763-766`) |
| 2 | Application Status | **R** | `/provider/application-status` | `ProviderApplicationStatus.tsx` (`/provider-application/status`) |
| 3 | Onboarding Checklist | **R** | `/provider/onboarding` | `ProviderOnboarding.tsx` (multi-step, `ProviderOnboarding.tsx:109`) |
| 4 | Identity Upload | **R** | `/provider/onboarding#identity` | step in `ProviderOnboarding.tsx` |
| 5 | Tax Declaration | **R** | `/provider/onboarding#tax` | `taxStatus` step (`ProviderOnboarding.tsx:180`) |
| 6 | Insurance Declaration | **R** | `/provider/onboarding#insurance` | insurance step (`ProviderOnboarding.tsx:165-178`) |
| 7 | Bank Verification | **P** | `/provider/onboarding#bank` | within onboarding/compliance; verify payout-rail wiring (do not alter payout math) |
| 8 | Legal Agreement Signature | **R** | `/provider/onboarding#sign` | `DocumentSigning.tsx` + provider declaration (`ProviderOnboarding.tsx:45`) |
| 9 | Academy Training | **R** | `/provider/academy` | trainer declarations (`ProviderOnboarding.tsx:195-198`) / `/academy` |
| 10 | Services Offered | **R** | `/provider/services` | `POSServices.tsx` (ProviderOS module) |
| 11 | Pricing | **P** | `/provider/services/pricing` | within `POSServices.tsx` / `ProviderListings.tsx` |
| 12 | Availability Calendar | **R** | `/provider/calendar` | `POSCalendar.tsx` |
| 13 | Job Requests | **R** | `/provider/jobs?tab=requests` | `POSJobs.tsx` |
| 14 | Accepted Jobs | **R** | `/provider/jobs?tab=accepted` | `POSJobs.tsx` |
| 15 | Job Details | **R** | `/provider/jobs/:id` | `POSJobs.tsx` |
| 16 | Start Job | **P** | `/provider/jobs/:id/start` | within `POSJobs.tsx` (lifecycle — verify, don't change money) |
| 17 | Complete Job | **P** | `/provider/jobs/:id/complete` | within `POSJobs.tsx` (completion gates payout — **do not touch**) |
| 18 | Care Notes / Photos | **R** | `/provider/jobs/:id/notes` | `POSJobs.tsx` + camera/doc upload |
| 19 | Incident Report | **R** | `/provider/safety/incident` | `POSSafety.tsx` |
| 20 | Earnings | **R** | `/provider/earnings` | `ProviderEarningsPage.tsx` (`/provider/earnings`) (**money — re-host**) |
| 21 | Payouts | **R** | `/provider/payouts` | `POSWallet.tsx` / earnings (**money — re-host**) |
| 22 | Missing Documents | **R** | `/provider/documents` | `POSDocuments.tsx` / `DocumentManagement.tsx` |
| 23 | Compliance Renewal | **R** | `/provider/compliance` | `ProviderCompliance.tsx` (`/provider-compliance`) |
| 24 | Provider Support | **R** | `/provider/support` | `POSAssistant.tsx` / provider support |
| 25 | Account Settings | **R** | `/provider/account` | `POSProfile.tsx` / `POSSettings.tsx` |

**Provider MISSING/partial:** none truly missing. The "P" rows are existing
sub-flows to confirm/wire under the new namespace; #7/#16/#17 touch money rails
and are **re-host/verify only**.

### 6.3 Summary count
- Prestige: 21 **R**, 2 **P**, 0 **M**.
- Provider: 19 **R**, 6 **P**, 0 **M**.
- **No screen requires a from-zero rebuild.** This confirms the brief's premise:
  the work is structure + entry + namespacing + a handful of wiring gaps.

### 6.6 Push-notification routing (Prestige vs Provider must not cross)
- **Need:** route a Prestige notification (booking confirmed, low balance, gift
  received, weather, reward) only to Prestige devices, and Provider
  notifications (new job, missing doc, compliance expiring, payout processed,
  incident) only to Provider devices.
- **Current gap:** `fcmTokens/{uid}/devices/{deviceId}` stores no app flavor
  (`fcm-notifications.ts:138-150`).
- **Design (no SQL migration):** add an `appFlavor: 'prestige' | 'provider' | 'web'`
  field to the **Firestore** token doc (Firestore is schemaless — additive,
  **not** a DB migration, satisfies the non-goal). The client already knows its
  flavor via the consolidated `app-flavor.ts`. Server senders
  (`server/lib/fcm-push.ts`) filter recipient device tokens by required flavor.
- **Backward compatibility:** tokens written before this change have no
  `appFlavor`; treat missing as "unknown" and fall back to current
  (send-to-all-devices) behavior until re-registered on next app open. No
  notification is lost during transition.
- **Server change is additive and flag-guardable** (`PUSH_FLAVOR_ROUTING_ENABLED`):
  off = today's behavior; on = flavor-filtered.

---

## 7. Security & fraud model

The rebuild is structural and **must not widen any money/identity surface**.

| Threat | Control |
|---|---|
| Cross-leak: customer sees provider payouts/earnings or vice-versa | Namespace guards (`/provider/*` requires provider role, `/prestige/*` requires member) on top of server `whoami` truth; entry router per flavor; nav switched per flavor/role |
| A re-host silently changes money behavior | Re-host = route alias + redirect ONLY; money components' bodies unchanged; reviewer diff for any money screen must be a pure `<Route>`/`<Redirect>` add (enforced in PR review checklist) |
| Client-side balance/role trust | Unchanged: backend remains source of truth; guards are UX only; no balance/role decision moves to client |
| Broken deep link → user dead-ends on a money flow | Old paths redirect to new (shipped in Stage 0 BEFORE entry flips); old paths never removed in the same stage they are superseded |
| Push leaks provider job info to a customer device | `appFlavor` filter in sender (§6.6); missing-flavor fallback is send-to-own-uid-only (already scoped to the user, no cross-user leak) |
| Store-rejection (Apple 4.x: app is a website wrapper) | App-native shell + member/provider home as entry (not marketing Landing) directly answers the rejection class; WebView restricted to terms/privacy/help/payment-redirect/PDF/legal per brief |
| Auth regression during cutover | Reuse existing `RoleProtectedRoute` + `useWhoami` verbatim; no new auth code; transient-error retry preserved (`RoleProtectedRoute.tsx:44-51`) |

**Backend source of truth statement:** no security or money decision is added to
the client by this work. All guards added are convenience/redirect layers over
the existing server-verified `whoami` role and the existing per-rail money gates.

---

## 8. APIs / interfaces

- **No new backend endpoints** for the routing rebuild itself.
- **One additive server behavior** (flag-guarded, §6.6): `server/lib/fcm-push.ts`
  gains an optional `requiredFlavor` filter when selecting device tokens. Request
  contract to callers is unchanged unless they opt in.
- **Client interfaces:**
  - New `client/src/lib/app-flavor.ts`: `getAppFlavor(): Promise<'web'|'prestige'|'provider'>`
    (consolidates `App.tsx:731-749` and `AppTermsGate.detectFlavor`). Note: bundle
    id `com.petwash.il`/`...customer` → `'prestige'`; `...provider` → `'provider'`.
  - New thin `PrestigeShell` component (header + bottom nav + `<Suspense>` outlet).
  - New namespace route group in `App.tsx` (mounted only when flags on).
- **Idempotency/error semantics:** untouched — no money endpoint is modified.

---

## 9. Money & audit

**Nothing in this SDD moves money or writes ledger/audit events.** Money screens
(wallet, checkout, gift, K9000 redeem, receipts, earnings, payouts) are re-hosted
as route aliases pointing at the **same unchanged components**, which continue to
call the **same SUMIT/Nayax/Tranzila/wallet/payout endpoints** with the **same
idempotency keys**. The audit/ledger surface is therefore byte-for-byte
unchanged. This is an explicit invariant: any PR in this series that changes a
file under the money/finance/wallet/ledger/SUMIT/Nayax/Tranzila/payout paths
beyond a route mount is **out of scope and must be rejected**.

---

## 10. Rollout — staged plan (each stage = one branch / PR / merge)

Every stage is **additive and reversible**, ships **dark** behind a flag, and the
**flip** is the last commit of the stage. Old paths keep working until a later,
deliberate cleanup stage.

### Stage 0 — Namespace + redirect scaffolding & shell skeletons (flag OFF)
- Extract `client/src/lib/app-flavor.ts`; point `App.tsx` and `AppTermsGate` at it.
- Add `/public/*`, `/prestige/*`, `/provider/*`, `/admin/*` route group + the new
  `PrestigeShell` skeleton, all mounted **only when `VITE_APP_STRUCTURE_V2_ENABLED`**.
- Add **redirects from old → new** for every mapped screen (using existing
  `<Redirect>` convention). These ship active even with the master flag off if
  they're harmless aliases, OR behind the flag — decide per route to avoid
  double-redirect loops (default: ship redirects with the flag).
- Extend `immersive-routes.ts` with any new immersive prestige/provider paths.
- **Flip at end:** nothing user-visible (flag off). **Rollback:** revert branch /
  flag stays off.

### Stage 1 — Prestige app cutover (flag: `VITE_PRESTIGE_SHELL_ENABLED`)
- Wire PrestigeShell to render existing member surfaces under `/prestige/*`.
- Build screen #1 (member welcome for **signed-out** Prestige app) and fix the
  cold-start gap (`App.tsx:768`) so signed-out → `/prestige/welcome`.
- Flip the **customer/Prestige** flavor entry to `/prestige`.
- Money screens re-hosted as aliases only.
- **Flip at end:** Prestige native app opens to member home/welcome.
- **Rollback:** set `VITE_PRESTIGE_SHELL_ENABLED=false` → entry falls back to
  `/dashboard` / Landing (today's behavior). No data change.

### Stage 2 — Provider app cutover (flag: `VITE_PROVIDER_SHELL_V2_ENABLED`)
- Re-host ProviderOS + standalone provider pages under `/provider/*` with
  redirects from `/provider-os`, `/provider/earnings`, `/provider-compliance`, etc.
- Confirm provider entry (already → `/provider-os`) now → `/provider`.
- Enable `appFlavor` push tagging on provider devices + sender filter
  (`PUSH_FLAVOR_ROUTING_ENABLED`).
- **Flip at end:** Provider native app routes through the `/provider/*` namespace.
- **Rollback:** flag off → `/provider-os` direct mount (today's behavior).

### Stage 3 — Public / Admin namespace tidy
- Re-home marketing under `/public/*` with redirects from bare paths; normalize
  `/admin/*` (already mostly conformant — minimal change).
- Optionally retire the oldest redirects only after analytics show ~zero hits.
- **Rollback:** revert; old paths still served.

### Stage 4 — Gap screens
- Prestige #11 Pet Transport surface (only when PetTrek is unfrozen).
- Any "P" wiring confirmed still open after Stages 1–2 (pricing UI polish, member
  welcome refinements). Strictly **no money-rail changes.**

**Sequencing rationale:** redirects FIRST (Stage 0) guarantees no dead links
before any entry flip; Prestige before Provider because the customer signed-out
gap is the loudest CEO complaint and the lowest money-risk; admin/public tidy
last because it's lowest urgency; gap screens last because they depend on the
shells existing.

### Feature-flag strategy
- `VITE_APP_STRUCTURE_V2_ENABLED` — master: mounts the namespace tree + redirects.
- `VITE_PRESTIGE_SHELL_ENABLED` — Prestige entry flip.
- `VITE_PROVIDER_SHELL_V2_ENABLED` — Provider entry flip.
- `PUSH_FLAVOR_ROUTING_ENABLED` (server) — flavor-filtered push.
- All default **OFF**. Each stage flips exactly one flag at its end. Flags are the
  rollback lever (no redeploy needed to revert behavior).

---

## 11. Test plan

- **Unit:** `getAppFlavor()` mapping (`com.petwash.il`→prestige,
  `...provider`→provider, no-id→web); namespace-guard role decisions; redirect map
  has an entry for **every** of the 48 screens (table-driven test that fails if a
  CEO screen lacks a target route).
- **Regression (reuse the existing `*.regression.test.ts` pattern):** no old path
  404s with flags on AND off; `MobileBottomNav` still hidden on immersive routes;
  `CustomerBookings`/wallet/receipt routes still mount the same components.
- **Cross-leak:** provider role cannot render `/prestige/wallet` as main and
  customer cannot render `/provider/earnings` (guard redirect verified).
- **Money no-touch (critical):** snapshot/diff test or PR-checklist gate proving
  re-hosted money components are byte-identical (only route wiring changed).
- **Push routing:** sender filters by `appFlavor`; missing-flavor tokens fall back
  without dropping; no provider payload reaches a prestige-only token.
- **Entry behavior:** signed-out prestige app → welcome (not Landing); signed-in
  → home; provider applicant → application status.
- **Store-readiness manual pass:** each app opens to its app-native home, WebView
  limited to legal/help/payment-redirect/PDF.

---

## 12. Rollback plan (per stage)
- Every stage is gated by a flag defaulting OFF; **flipping the flag off restores
  prior behavior without a code revert or data change.**
- Redirects are additive aliases; removing them (or the branch) cannot corrupt
  data (no writes involved).
- The push `appFlavor` field is additive in Firestore; turning
  `PUSH_FLAVOR_ROUTING_ENABLED` off reverts to send-to-all-own-devices.
- No schema migration exists to reverse.
- If a money screen misbehaves after re-host, the fix is to flip the namespace
  flag off (re-host alias disappears, original route serves) — instant mitigation.

---

## 13. Open questions (need a human decision)
1. **Dual-role users on web:** the native app picks the flavor, but on **web** a
   user who is both customer and provider needs an explicit mode switcher. Where
   should it live (header menu? account page?) and what is the default landing?
2. **PetTrek freeze:** Prestige #11 Pet Transport is "Coming Soon"
   (`App.tsx:1795+`). Stub the route now (CEO confirm), or omit until unfrozen?
3. **Member welcome (#1):** is the signed-out Prestige welcome a brand-new luxury
   screen (mockup-first per brand rule) or a re-skin of the existing auth pages?
4. **Redirect lifetime:** how long to keep old→new redirects before retiring
   (Stage 3)? Recommend "until analytics show < N hits/week."
5. **Old-path SEO:** for `/public/*` marketing, do we need 301s (SEO-preserving)
   vs SPA client redirects? May require a hosting/`firebase.json` rule — flag as
   a possible separate ops item (no code dep change).
6. **Push `appFlavor` backfill:** acceptable to rely on natural re-registration
   on next app open, or do we need a forced token refresh?

---

## 14. First implementation PR (smallest safe slice)

**Stage 0, scoped to the lowest-risk subset:**
1. Add `client/src/lib/app-flavor.ts` and repoint `App.tsx:731-749` +
   `AppTermsGate.detectFlavor` at it (pure refactor, no behavior change).
2. Add the four-namespace route group + `PrestigeShell` **skeleton**, mounted
   only behind `VITE_APP_STRUCTURE_V2_ENABLED` (default OFF).
3. Add the **redirect map** (old→new) for the Prestige screens as a table +
   table-driven test asserting all 23 Prestige screens have a target.
4. Extend `immersive-routes.ts` with new `/prestige/*` immersive paths.

This ships **completely dark** (flag off = zero user-visible change), is fully
reversible, touches **no money code**, adds **no dependency/schema**, and
establishes the scaffolding every later stage builds on. It is also the natural
hand-off boundary between Claude and Codex.

---

## 15. Out of scope / do-not-touch (explicit)
- Finance math, wallet/ledger/credits balances and movements.
- SUMIT, Nayax, Tranzila/uPay, K9000 redemption runtime, payout rails.
- Receipt / tax-sequence numbering.
- Any DB schema (no migrations).
- `package.json` / lockfile / new dependencies.
- Native Xcode/Gradle project restructuring.
- Individual screen internals / new business features.

---

## 16. Final handoff summary
- **Recommended first PR:** Stage 0 scaffolding (§14) — flag-off, no money, no deps.
- **Out of scope:** §15 (money runtime, schema, deps, native projects).
- **Open questions:** §13 (dual-role web switcher, PetTrek stub, welcome screen
  scope, redirect lifetime, SEO 301s, push backfill).
- **Key fraud/safety risks:** cross-leak between apps; a re-host silently altering
  money behavior; broken deep link dead-ending a money flow; push leaking provider
  data to a customer device; auth regression mid-cutover; Apple "website wrapper"
  rejection. Mitigations in §7/§10/§12.
- **Tests needed:** flavor mapping, redirect-coverage (all 48 screens),
  cross-leak guards, money no-touch diff gate, push flavor routing, entry
  behavior, store-readiness pass (§11).
- **Feature flags:** `VITE_APP_STRUCTURE_V2_ENABLED`,
  `VITE_PRESTIGE_SHELL_ENABLED`, `VITE_PROVIDER_SHELL_V2_ENABLED`,
  `PUSH_FLAVOR_ROUTING_ENABLED` — all default OFF; flag = rollback lever.
- **Rollback:** flip the stage flag OFF; additive-only; no data to reverse (§12).

---

## Appendix A — Original CEO brief (verbatim)

> PETWASH — CRITICAL CORRECTION: PROVIDER APP AND PRESTIGE APP ARE NOT WEBSITE WRAPPERS. We have two app concepts: 1) PetWash Provider App, 2) PetWash Prestige Loyalty App. Current implementation appears to treat them like the PetWash website placed inside an app. A mobile app is not a website wrapper. The Provider App and Prestige App must be two different mobile products with different users, screens, actions, permissions, data, journeys and purpose (analogy: Uber rider app vs Uber driver app — same backend, different apps). MAIN RULE: do not copy the public website into the mobile apps. Website = public info, SEO, marketing, public signup, public shop, general support. Prestige App = loyal customers: wallet, wash packages, gift cards, bookings, shop, rewards, receipts, pet profiles, QR/member pass, premium experience. Provider App = approved providers: onboarding, documents, availability, job offers, accepted bookings, service completion, safety checklists, incident reports, earnings, payouts, compliance, provider support. Three different experiences: Website, Customer/Prestige App, Provider App — do not mix.
> PRESTIGE APP home screen: member card/QR, next booking, wash credits, rewards, quick actions, pet profiles, recommended services, shop offers, gift card button, weather/sun safety alerts, recent receipts. Prestige bottom tabs: Home, Book, Shop, Wallet, Account.
> PROVIDER APP home screen: application status if not approved, today's jobs, pending requests, availability status, compliance status, earnings this month, payout pending, missing documents, safety reminders, support. Provider bottom tabs: Jobs, Calendar, Earnings, Compliance, Account.
> WEBSITE: public homepage, service explanation, SEO, self-service wash info, Pet Sitter page, Walk My Pet page, Academy page, Shop page, Become a Provider landing, support, terms/privacy, login links, app download links. Can start signup but once inside the app the experience must be app-native.
> SHARED BACKEND, DIFFERENT FRONTENDS: one backend (users, pets, bookings, providers, payments, invoices, shop orders, academy, documents, wallet, rewards, payouts, compliance); three frontends (Website, Prestige app, Provider app). Each frontend calls backend with its own role and permissions.
> ROLES: CUSTOMER, PRESTIGE_MEMBER, PROVIDER_APPLICANT, APPROVED_PROVIDER, ADMIN, SUPPORT. Prestige App allows CUSTOMER/PRESTIGE_MEMBER. Provider App allows PROVIDER_APPLICANT/APPROVED_PROVIDER. Do not show provider tools in customer app unless user is also a provider and intentionally switches mode. Do not show customer loyalty/shop as main provider app.
> PRESTIGE APP SCREENS (23): 1 Welcome/Login, 2 Member Card/QR, 3 Home Dashboard, 4 Pet Profiles, 5 Book Self-Service Wash, 6 Buy Wash Package, 7 Gift Card, 8 Pet Sitter Booking, 9 Walk My Pet Booking, 10 Trainer Booking, 11 Pet Transport Booking, 12 Shop, 13 Product Details, 14 Cart, 15 Checkout, 16 Wallet/Credits, 17 Rewards, 18 Receipts/Invoices, 19 Booking History, 20 Reschedule/Cancel, 21 Support, 22 Account Settings, 23 Terms/Privacy.
> PROVIDER APP SCREENS (25): 1 Provider Login, 2 Application Status, 3 Onboarding Checklist, 4 Identity Upload, 5 Tax Declaration, 6 Insurance Declaration, 7 Bank Verification, 8 Legal Agreement Signature, 9 Academy Training, 10 Services Offered, 11 Pricing, 12 Availability Calendar, 13 Job Requests, 14 Accepted Jobs, 15 Job Details, 16 Start Job, 17 Complete Job, 18 Care Notes/Photos, 19 Incident Report, 20 Earnings, 21 Payouts, 22 Missing Documents, 23 Compliance Renewal, 24 Provider Support, 25 Account Settings.
> APP HOMEPAGE SHOULD NOT BE WEBSITE HOMEPAGE. Prestige opens to customer dashboard; Provider opens to provider work dashboard. MOBILE QUALITY: fast, mobile nav, bottom tabs, push, role-based screens, camera/doc upload, wallet/QR, calendar, secure login, deep links, app icons. WebView only for terms/privacy/help/payment-redirect/PDF/legal. PUSH: Prestige (booking confirmed/reminder, credit used, low balance, gift received, receipt, shop order, weather, reward) vs Provider (new job, accepted, cancelled, reminder, missing doc, compliance expiring, payout processed, incident follow-up, support) — do not cross. DATA + PERMISSION differences as above. ROUTING EXAMPLE: /public/*, /prestige/*, /provider/*, /admin/*. DEV CORRECTION TASKS: audit both apps, app-specific navigation, Prestige dashboard, Provider dashboard, split route trees, role guards, replace website homepage inside apps with app dashboard, app-specific bottom tabs, app-specific notifications, provider onboarding workflow, customer wallet/QR/rewards, booking/calendar flows, receipts in Prestige, earnings/payouts in Provider, compliance in Provider, remove marketing pages from core app. FINAL: rebuild the app structure around correct user roles and app-specific dashboards instead of wrapping the public website.

---

## Appendix B — Agent task framing (verbatim, as received)

> Author a Software Design Document for a FULL REBUILD of the PetWash mobile app structure into three distinct front-ends sharing one backend: the public Website, the Prestige (customer/loyalty) App, and the Provider (work/operations) App. The CEO has explicitly approved a full rebuild as written, AFTER being shown that much already exists. Your SDD must reconcile the CEO's brief with what is already built, and specify a STAGED, ADDITIVE cutover — NOT a destructive teardown of live, App-Store-approved, money-handling code.
>
> Hard execution constraints: build the new structure ALONGSIDE the live one, migrate screens with redirects from old paths, then flip each app's entry over, never breaking the live apps mid-flight; money/finance/wallet/ledger/SUMIT/Nayax/Tranzila runtime is SACRED (re-host only, no behavior/math/API change); no schema migrations, no new dependencies, no package.json/lockfile changes unless explicitly called out as a separate approval-gated item; batch into ONE branch/PR/merge per shippable stage; the SDD is the coordination artifact for Claude + Codex.
