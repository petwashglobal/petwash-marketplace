# P0 Audit — Mobile Account Routing & `/my-account` Crash

**Date:** 2026-05-03
**Audit-only.** No source code changed. No schema. No deps. No push.
**Branch:** `claude/p0-mobile-account-routing-audit`
**Trigger:** CEO ("Nir") on iPhone Safari at `petwash.co.il`. Tapped profile/name → routed to `/my-account` → `AppErrorBoundary` rendered "Something went wrong".

This document inventories the crash, the routing surface, the auth chain, the menus, the route table, and slices the next 5 fix PRs.

---

## 1. Root-cause hypothesis for `/my-account` crash

### 1.1 Is `/my-account` registered?
**YES** — `client/src/App.tsx:2043-2049`:

```tsx
<Route path="/my-account">
  {() => (
    <RequireAuth>
      <MyAccount />
    </RequireAuth>
  )}
</Route>
```

`MyAccount` is lazy-imported at `client/src/App.tsx:181`. `RequireAuth` at `client/src/auth/RequireAuth.tsx:1-25` redirects to `/signin?from=/my-account` if `user` is null.

### 1.2 Page surface
- `client/src/pages/MyAccount.tsx` — **4240 lines**. Single-file mega component. ~30+ `useQuery` calls, deep nested objects, raw property access on `profile.*`.
- Wrapped in `Layout` (`client/src/components/Layout.tsx:104` → renders `PetWashHeader` + `Footer`).
- Top-level export `MyAccount` at `MyAccount.tsx:293`.

### 1.3 Crash mechanisms (ranked)

**Hypothesis A — `profile.notificationPreferences` undefined access (HIGHEST likelihood)**
- `MyAccount.tsx:934-955` builds a fallback `profile` object **only when `profileData` is undefined**:
  ```ts
  const profile = profileData || { displayName: ..., notificationPreferences: {...} };
  ```
- The moment `/api/user/profile` returns ANY object — even an incomplete row from the DB — the fallback is bypassed and the real (partial) `profileData` is used.
- `MyAccount.tsx:2323`: `profile.notificationPreferences?.[item.key as keyof typeof profile.notificationPreferences]` — **the property access uses optional chaining once, but the `.map((item) => ...)` array of 10 items will TypeError if `profile.notificationPreferences` is `null` from the API** (because `null` is an object and the `?.` only guards `undefined`/`null`, BUT `profile.notificationPreferences[...]` on line 2327 inside `onCheckedChange` does **not** optional chain — it spreads `null` into an object literal which is fine, but then accesses `[item.key]` on `null` would throw if directly read).
- Likely scenario: API row has `notification_preferences: null` (legacy row, brand-new user post-signup, or row created before the column existed). The render path lands in the spread on line 2327 only on click — but the **render itself** at line 2323 uses `?.` so this alone may not crash the initial render.
- However, line 2328 in `onCheckedChange`: `...profile.notificationPreferences` spreads `null` → `{...null}` is valid in JS (yields `{}`), so this isn't the killer either.
- **Real risk path:** further down (line ~3185) `profile?.birthdate` is fine, but several call sites read `profile.X` with no guard at all. Search reveals `profile.notificationPreferences` is dereferenced multiple times. The crash trigger is more likely Hypothesis B.

**Hypothesis B — `profile.X` direct property access on partial response (HIGH)**
- `MyAccount.tsx:1002`, `1072`, `1322`, `1331`, `1347`, `1365`, `1390-1394`, `1416`, `1434`, `1451`, `1469`, `1488-1489`, `1514`, `1866-1873`, `2433`, `2439`, `2447`: ~30 sites of `profile.<field>` with no optional chain.
- The fallback at line 934 supplies `displayName, email, phone, address, city, birthdate, photoURL, preferredLanguage, notificationPreferences` — but **does NOT supply** `street, streetNumber, apartment, postalCode, country, latitude, longitude, addressIsTemporary, temporaryAddress, gender, idNumber, carPlate, carPlate2, emergencyContactName, emergencyContactPhone, twoFactorEnabled, marketingConsent`.
- If the API returns a real row missing one of these (most rows pre-2026-Q1 will be missing `addressIsTemporary`, `carPlate2`, `temporaryAddress`, `temporaryLat/Lng/Postal`), no individual access is fatal **except** when an iteration assumes shape (e.g. `profile.notificationPreferences` keys).
- **Most likely fatal site:** `MyAccount.tsx:2323` — the `Switch` initial render iterates `[{key: 'pushEnabled'}, ...]` and reads `profile.notificationPreferences?.[item.key]`. If `notificationPreferences` is `null`/`undefined` AND `item.key` is `'worldDogDayEnabled'` etc., the optional chain protects render. **But** the cookie/promo card render at line ~3850 reads `profile?.email || user?.email` which is fine.

**Hypothesis C — Lazy-import + ErrorBoundary catching during Suspense (MEDIUM)**
- `client/src/App.tsx:181` `const MyAccount = lazy(() => import("@/pages/MyAccount"))`. `MyAccount.tsx` imports many heavy modules: `IsraeliTaxInvoice`, `PetIntakeForm`, `GooglePlacesAutocomplete`, `sanitize-html`, `@simplewebauthn/browser` (dynamically), CSS files. A chunk load failure on Safari (cache-stale, network blip, ITP partition) throws → caught by `AppErrorBoundary`.
- The `AppErrorBoundary` at `client/src/components/AppErrorBoundary.tsx:47-129` wraps the **whole app** at `client/src/main.tsx:62-66`. It is mounted ABOVE the Router. There is no per-route Suspense fallback wrapper around `MyAccount` (other routes use `<Suspense fallback={<PageLoader />}>` — see `App.tsx:2106-2110`). So a Suspense exception during `MyAccount` lazy import bubbles up to the global boundary.

**Hypothesis D — `useQuery` with no `useUser` guard, but `user` undefined briefly (MEDIUM)**
- `MyAccount.tsx:341-344`: `useQuery({ queryKey: ['/api/credit-wallet/summary'], enabled: !!user })`. The `enabled: !!user` is correct.
- But several `useQuery` callbacks call `await user.getIdToken()` (`MyAccount.tsx:541-547`, `559-563`, `602-606`). The `if (!user) return null` guards exist on most paths, but `useQuery` `data` is typed as `WhoamiResponse` (not nullable), and downstream code may dereference.

**Hypothesis E — `firebaseUser.reload()` race after email change (LOW)**
- `MyAccount.tsx:856-858` calls `firebaseUser.reload()` after email change confirm. Not a first-render crash.

**Hypothesis F — RequireAuth loop on iPhone Safari (LOW but plausible for the CEO's exact path)**
- `RequireAuth.tsx:8-14`: shows a dark spinner if `loading === true`.
- `AuthProvider.tsx:188-223`: `setLoading(false)` happens AFTER `ensureServerSession` completes (line 192-195). On iPhone Safari ITP, `getRedirectResult` and `setPersistence` chain on cold start can take 500-1500 ms. During that window `loading=true` → spinner. If `/api/auth/session` POST fails (CORS, ITP cookie drop, 401 from missing token), the `await` still resolves (errors are swallowed at `AuthProvider.tsx:102-104`). So `setLoading(false)` does fire.
- However, if the user pressed the gold profile button and `useAccountNavigation.resolveAccountRoute()` decided to send the user to `/my-account`, but Firebase claims arrive late and the `/api/auth/post-login` call returns a different `nextUrl` (e.g. `/admin/dashboard` for the CEO), the user might end up at `/my-account` only on direct navigation. **The CEO's path** = profile-icon tap → `resolveAccountRoute()` → because `claims.role` may be `'public'` or undefined for the CEO if his admin claim hasn't been minted, fallback through to server `nextUrl` … which lands him at `/my-account`. So `MyAccount` is **expected to render for CEO** until claims propagate, or admin email allowlist matches.
- See `useAccountNavigation.ts:114`: `if (adminEmailMatch(user?.email)) return '/admin/dashboard';` — depends on `VITE_ADMIN_EMAILS`. If the CEO's email is not in that env var, AND his Firebase custom claim has not been set, the resolver lands him on `/my-account`. **This is itself a P0 finding** — the CEO should never see `/my-account`.

**Ranked likelihood:**

| # | Hypothesis | Likelihood | Evidence |
|---|---|---|---|
| 1 | C — Lazy-load chunk error caught by global boundary | **HIGH** | No per-route Suspense around `MyAccount`; iPhone Safari is the worst chunk-cache offender; build-id mismatch between fresh HTML and stale chunk after deploy is common. `main.tsx:56-66` wraps app in `AppErrorBoundary` but `App.tsx:2043` doesn't wrap `MyAccount` in Suspense. |
| 2 | B — Direct `profile.X` access on partial DB row | **HIGH** | 30+ unguarded reads. Any missing field on the live row is a crash candidate. Most likely on a CEO row that has `displayName=Nir` but lacks newer columns. |
| 3 | F — Wrong destination for CEO (lands on `/my-account` instead of `/admin/dashboard`) | **HIGH** | `useAccountNavigation.ts` falls through to `/my-account` if `claims.role` and email-allowlist both miss. Independent of crash, this is also a routing P0. |
| 4 | A — `notificationPreferences` undefined inside iteration | MEDIUM | Optional chain at line 2323 is correct, but adjacent code is fragile. |
| 5 | D — Stale `user` in async callbacks | MEDIUM | Defensive enough but multiple places. |
| 6 | E — Email reload race | LOW | Not first-render. |

### 1.4 ErrorBoundary: what it logs vs hides
`client/src/components/AppErrorBoundary.tsx`:
- POSTs to `/api/errors/log` (line 60) with: `context, message, stack, componentStack, timestamp, url, userAgent, connectionType, userId, userRole, language`. Good telemetry coverage.
- Renders generic "Something went wrong" card. Stack trace shown **only in `import.meta.env.DEV`** (line 96-107).
- **No reference ID** surfaced to the user. Production users cannot give support a correlator.
- **No distinction** between: route-not-found, render error, lazy-chunk fetch error, network/API failure swallowed.
- Two CTAs: "Reload Page" / "Go Home". No "report issue" button.
- If `/api/errors/log` itself fails, falls back to `console.error` only — no localStorage queue, no retry.

---

## 2. Logged-in profile/account click

### 2.1 Where the gold profile badge lives
`client/src/components/PetWashHeader.tsx:511-523` (desktop / top-right) and `:632-643` (mobile drawer top, "pw-account-circle"). Both buttons:
```tsx
onClick={handleProfileNavigate}
data-testid="button-header-profile" / "button-mobile-account-gold"
```

### 2.2 Click handler
`client/src/components/PetWashHeader.tsx:257-274`:
```ts
const handleProfileNavigate = async () => {
  if (isResolvingProfile) return;
  setIsResolvingProfile(true);
  try {
    const route = await resolveAccountRoute();
    handleNavigate(route);   // window.location.assign(route)
  } catch (err) {
    handleNavigate('/home');
  } finally { setIsResolvingProfile(false); }
};
```

### 2.3 What `resolveAccountRoute` returns
`client/src/hooks/useAccountNavigation.ts:97-146`:
- Waits up to 1.5 s for `loading` to settle.
- If unauthenticated → `/signin`.
- Else, claims-based fast path → `/franchise/dashboard` | `/provider-os` | `/admin/dashboard`.
- Else, email allowlist (`VITE_ADMIN_EMAILS`) → `/admin/dashboard`.
- Else, `POST /api/auth/post-login` → server `nextUrl`.
- Else, `/home`.

### 2.4 Cross-check against router
- `/franchise/dashboard` ✓ `App.tsx:1857`.
- `/provider-os` ✓ `App.tsx:1302`.
- `/admin/dashboard` ✓ `App.tsx:2513`.
- `/my-account` ✓ `App.tsx:2043`.
- `/home` ✓ `App.tsx:508`.
- `/signin` ✓ `App.tsx:518`.

The handler navigates via `window.location.assign(route)` (`PetWashHeader.tsx:360`), which forces a **full page reload** instead of client-side push. **This is intentional** to drop stale React state — but it means every profile-tap re-bootstraps Firebase and re-runs `AppErrorBoundary`, so any first-render crash on the destination is amplified.

---

## 3. Role-aware destination logic

### 3.1 Role definitions (multiple sources of truth — CONCERN)
1. **Firebase custom-claim `UserRole`** — `client/src/auth/AuthProvider.tsx:26`:
   ```ts
   export type UserRole = 'public' | 'provider' | 'franchise_owner' | 'staff' | 'admin' | 'management' | 'super_admin';
   ```
   No `customer` literal. Customers carry `role: 'public'`.
2. **`shared/adminRoles.ts:15-24`** — `ADMIN_ROLES`: `'admin' | 'ops' | 'management' | 'super_admin' | 'staff' | 'hr' | 'finance' | 'ceo'`. Includes `'ops'`, `'hr'`, `'finance'`, `'ceo'` which are NOT in `UserRole` literal.
3. **`shared/petwashRoles.ts:5-20`** — `PlatformRole`: `SUPER_ADMIN | ADMIN | FRANCHISE_OWNER | STATION_MANAGER | TECHNICIAN | DRIVER | PET_SITTER | PET_HOST | GROOMER | TRAINER | VET_ASSISTANT | CUSTOMER_SUPPORT | FINANCE_MANAGER | OPERATIONS_MANAGER | MARKETING_MANAGER`. Yet **another** taxonomy.
4. **Server `WhoamiResponse.role: string`** (`useWhoami.ts:11`) — string, no enum constraint.

This is a **3-way schism**. The router uses (1), admin endpoints use (2), HR/onboarding may use (3). Roles like `'ceo'`, `'hr'`, `'finance'` **exist in `adminRoles.ts` but cannot be returned to the client through the strongly typed `UserRole`** — they fall through to `'public'` in `AuthProvider.setClaims` (line 200-201: `role: (c.role as UserRole) || 'public'`). **A CEO with `claim.role='ceo'` is silently downgraded to `'public'` on the client.**

### 3.2 Per-role recommended destination from a profile-icon tap

| Role | Recommended destination | Status |
|---|---|---|
| Logged out | `/signin?from=<current>` | ✓ existing — `RequireAuth.tsx:21` |
| `public` (regular customer, no extra claim) | `/my-account` | ⚠ partial — works, but `/my-account` itself is the crash; also there is no role-specific account hub |
| Prestige member (loyalty tier) | `/my-account` (with prestige tab default) **or** `/loyalty/dashboard` | ⚠ partial — `/loyalty/dashboard` (`App.tsx:726`) exists but profile button never goes there |
| Provider applicant (pending) | `/provider/pending` | ✓ existing — `App.tsx:576`, but `useAccountNavigation` does not route here based on claim |
| Approved provider (`role='provider'`) | `/provider-os` | ✓ existing — `App.tsx:1302`, `useAccountNavigation:51` ✓ |
| `franchise_owner` | `/franchise/dashboard` | ✓ existing — `App.tsx:1857`, `useAccountNavigation:50` ✓ |
| `staff` / `admin` / `management` / `super_admin` | `/admin/dashboard` | ✓ existing — `App.tsx:2513`, `useAccountNavigation:52` ✓ |
| `ceo` (in `adminRoles.ts` only) | `/pet-wash-ltd/executive/ceo` | ✗ **MISSING** — CEO claim is discarded client-side; routes exist (`App.tsx:2319`) but `useAccountNavigation` cannot reach them |
| `hr` (in `adminRoles.ts` only) | `/admin/hr` (`App.tsx:844`) or HR dashboard | ✗ MISSING — same discarded-claim issue |
| `finance` (in `adminRoles.ts` only) | `/pet-wash-ltd/executive/finance` (`App.tsx:2330`) | ✗ MISSING — same |
| `ops` (in `adminRoles.ts` only) | `/admin/ops-monitor` (`App.tsx:1789`) | ✗ MISSING — same |

### 3.3 Existing role-routing code
- `client/src/hooks/useAccountNavigation.ts:49-57` (sync) and `:97-146` (async) — primary.
- `client/src/components/AdminRouteGuard.tsx` — admin-area gate (read but uses `isAdminRole`).
- `client/src/auth/RoleProtectedRoute.tsx:5-13` — `ROLE_HIERARCHY` numeric comparison. Does NOT include `ceo`, `hr`, `finance`, `ops`.
- `client/src/hooks/useAdminAuth.ts` — used by admin-only pages.

---

## 4. Hamburger menu inventory

Source: `client/src/components/PetWashHeader.tsx:171-230` (item arrays) and `:646-820` (drawer render).

| Item label (EN / HE) | File:line | Current route | Route exists? | Auth required? | Expected audience | Bug found | Severity | Recommended fix |
|---|---|---|---|---|---|---|---|---|
| Pet Wash Hub / מרכז | PetWashHeader.tsx:172 | `/hub` | ✓ `App.tsx:793` | No | Public | None visible | — | — |
| Pet Wash Stations / תחנות | :173 | `/stations` | ✓ `App.tsx:796` | No | Public | None visible | — | — |
| PawFinder / מציאת חיות | :174 | `/paw-finder` | ✓ `App.tsx:2008` | No | Public | None | — | — |
| Pet Sitter / שמרטף | :175 | `/sitter-suite` | ✓ `App.tsx:1406` | No | Public | None | — | — |
| Pet Walker / מטייל | :176 | `/walk-my-pet` | ✓ `App.tsx:1222` | No | Public | None | — | — |
| Pet Transport / הסעות | :177 | `/pettrek/book` | ✓ `App.tsx:1289` | Yes (frozen flag) | Public | Item is `frozen: true` — clicking is disabled even though route exists | P2 | Either un-freeze + smoke-test or hide |
| Academy / אקדמיה | :181 | `/academy` | ✓ `App.tsx:1084` | No | Public | None | — | — |
| Pet Wash Shop / חנות | :182 | `/shop` | ✓ `App.tsx:799` | No, frozen | Public | Frozen pill correct | — | — |
| Avatar Studio | :183 | `#` | ✗ N/A | Frozen | — | href is `#` — `handleNavigate` early-returns on `#` (`PetWashHeader.tsx:355`). Fine for frozen. | — | — |
| Smart booking / הזמנה חכמה | :192 | `/booking` | ✓ `App.tsx:802` | Mixed | Customer | None | — | — |
| PetWash Privilege | :193 | `/loyalty` | ✓ `App.tsx:721` | No | Public | None | — | — |
| Tiers / דרגות | :194 | `/loyalty/tiers` | ✓ `App.tsx:735` | No | Public | None | — | — |
| Benefits and perks | :195 | `/loyalty/benefits` | ✓ `App.tsx:738` | No | Public | None | — | — |
| Birthday & special rewards | :196 | `/loyalty/birthday` | ✓ `App.tsx:741` | No | Public | None | — | — |
| Refer a friend | :197 | `/loyalty/refer` | ✓ `App.tsx:744` | No | Public | None | — | — |
| e-Gift / תווי שי | :198 | `/egift` | ✓ `App.tsx:775` | No | Public | None | — | — |
| Find a station / מצא תחנה | :199 | `/map` | ✓ `App.tsx:823` | No | Public | None | — | — |
| Franchise / זכיינות | :203 | `/franchise` | ✓ `App.tsx:2011` | No | B2B | None | — | — |
| Business locations | :204 | `/partners/locations` | ✓ `App.tsx:871` | No | B2B | None | — | — |
| Suppliers / ספקים | :205 | `/partners/suppliers` | ✓ `App.tsx:874` | No | B2B | None | — | — |
| Municipal | :206 | `/partners/municipal` | ✓ `App.tsx:877` | No | B2B | None | — | — |
| About / אודות | :210 | `/about` | ✓ `App.tsx:1999` | No | Public | None | — | — |
| **Our story / הסיפור** | :211 | `/story` | ✓ `App.tsx:828` | No | Public | None | — | — |
| **Media / מדיה** | :212 | `/media` | ✓ `App.tsx:831` | No | Public | None | — | — |
| **Gallery / גלריה** | :213 | `/gallery` | ✓ `App.tsx:2102` | No | Public | None | — | — |
| **Careers / קריירה** | :214 | `/careers` | ✓ `App.tsx:834` | No | Public | None | — | — |
| **Terms / תנאים** | :218 | `/legal/terms` | ✓ `App.tsx:882` | No | Public | None | — | — |
| **Privacy / פרטיות** | :219 | `/legal/privacy` | ✓ `App.tsx:885` | No | Public | None | — | — |
| **eGift policy** | :220 | `/legal/egift-policy` | ✓ `App.tsx:888` | No | Public | None | — | — |
| **Privilege terms** | :221 | `/legal/loyalty-terms` | ✓ `App.tsx:891` | No | Public | None | — | — |
| **Cookies & tracking** | :222 | `/legal/cookies` | ✓ `App.tsx:894` | No | Public | None | — | — |
| **Accessibility statement** | :223 | `/legal/accessibility` | ✓ `App.tsx:897` | No | Public | None — but also `/accessibility` and `/accessibility-statement` exist as separate routes (`App.tsx:2300-2301`) — three URLs render this content | P2 | Pick one canonical, redirect others |
| **Help / FAQ** | :227 | `/support` | ✓ `App.tsx:860` | No | Public | None visible | — | — |
| **Contact / WhatsApp** | :228 | `/contact` | ✓ `App.tsx:2091` | No | Public | None | — | — |
| **System status / סטטוס מערכת** | :229 | `/status` | ⚠ `App.tsx:863` AND `App.tsx:2007` — **duplicate registration**. wouter takes the FIRST match (`/status` → ServiceStatus). The second is dead code. Also `/system-status` is mentioned by the CEO but is NOT a registered route — `/status` exists. | Mixed | Public | **Duplicate `/status` route** (line 863 vs 2007) — both register the same path, second is unreachable. CEO refers to "System status" — needs rename or `/system-status` alias. | P1 | Remove duplicate, add `/system-status` alias |
| Sign in / התחברות (logged-out drawer) | :803-808 | `/signin` | ✓ `App.tsx:518` | No | Public | None | — | — |
| Sign up / הרשמה | :811-816 | `/signup` | ✓ `App.tsx:551` | No | Public | None | — | — |
| Language switch | :620-631 | n/a | n/a | No | All | Persists to `localStorage.pw_lang` and updates `document.documentElement.dir/lang` (`Layout.tsx:36-46`, header `:303-311`) — **two writers, can race**. Header writes `dir` immediately; Layout's effect runs on mount. Race only matters on first paint. | P2 | Single source of truth via `useLanguage` |
| Gold icon (drawer top, mobile) | :632-643 | calls `handleProfileNavigate` | depends | depends | Logged in & out | Same `resolveAccountRoute` issue as section 2 — falls through to `/my-account` for CEO. | **P0** | See PR-NAV-1 |
| **My Dashboard (logged-in drawer)** | :769-778 | `handleProfileNavigate` → resolved route | depends | Logged in | All | Falls through to `/my-account` for CEO; no role-aware label distinction | P0 | See PR-NAV-1 |
| **My account (logged-in drawer)** | :779-786 | `/my-account` (hard-coded) | ✓ but crashes | Logged in | All | Direct route to `/my-account` regardless of role; crash trigger | **P0** | Make role-aware; fix crash |
| Log out | :787-798 | `logout()` | n/a | Logged in | All | Calls `AuthProvider.logout` (`AuthProvider.tsx:232-280`). Sequence: `queryClient.clear()` → `/api/auth/signout` → `signOut(auth)` → clear keys → `window.location.replace('/')`. Solid. | — | — |
| Conditional admin link | MISSING — not found in code | — | — | — | Admin | The drawer never surfaces a "Go to Admin" link when the user is admin. The gold icon resolver does, but the drawer "My Dashboard" only routes via the same handler — not a labeled admin link | P1 | Add explicit "Admin Dashboard" item shown when `role` ∈ ADMIN_ROLES |
| Conditional provider link | MISSING — not found in code | — | — | — | Provider | Same pattern as admin link. No explicit "Provider OS" item in drawer | P1 | Add when `role === 'provider'` |

Drawer global issue (P1): the drawer uses `<button onClick={handleNavigate}>` with `window.location.assign` — every link forces full page reload, killing client-side state. Functional but slow on cellular.

---

## 5. Bottom mobile navigation inventory

Source: `client/src/components/MobileBottomNav.tsx`.

Customer nav (`MobileBottomNav.tsx:17-23`):

| Item label (EN / HE) | File:line | Route | Route exists? | Auth required? | Audience | Bug | Severity | Fix |
|---|---|---|---|---|---|---|---|---|
| Home / בית | :18 | `/home` | ✓ `App.tsx:508` | No | Customer | None | — | — |
| PawFinder / מציאת חיות | :19 | `/paw-finder` | ✓ `App.tsx:2008` | No | Customer | None | — | — |
| Bookings / הזמנות | :20 | `/bookings` | ✓ `App.tsx:668` | Yes | Customer | None visible | — | — |
| Messages / הודעות | :21 | `/booking-chat/inbox` | ✓ `App.tsx:527` | Yes | Customer | No unread badge surfaced (header has it; bottom nav does not) | P2 | Add unread count badge |
| Account / חשבון | :22 | `/my-account` | ✓ but crashes | Yes | Customer | **Direct hardcoded route to `/my-account` — bypasses `resolveAccountRoute`. Provider/admin clicking this lands on `/my-account` instead of their own dashboard.** | **P0** | Use `resolveAccountRoute` |

Provider nav (`MobileBottomNav.tsx:25-30`): role-switched at `:49-50`. Items map to `/provider-os`, `/provider-os/bookings`, `/provider-os/inbox`, `/my-account`. The provider account tab still hard-routes to `/my-account` not provider profile — same P0.

### 5.1 Active state on `/my-account`
`MobileBottomNav.tsx:66-68`:
```ts
const isActive = location === path
  || location.startsWith(path + '/')
  || (path === '/paw-finder' && pawFinderAliases.some(...));
```
Works for `/my-account` exactly. Active style colors icon + label gold (`#C5A55A`). When `MyAccount` crashes, the bottom nav still renders if the `AppErrorBoundary` is **outside** the Router — but in this app `AppErrorBoundary` wraps the WHOLE app at `main.tsx:62-66`. So the crash UI replaces the entire tree; bottom nav disappears. **Result:** the user is stranded with only "Reload" / "Go Home". This is a UX regression worth noting.

### 5.2 Logged-out vs logged-in visibility
`MobileBottomNav.tsx:44`: `if (loading || roleLoading || !user) return null`. Hidden when logged out. ✓
Hidden on `/signin`, `/admin`, `/internal`, `/blocked`, `/access-pending`, `/provider/pending`, `/provider/rejected` (`HIDDEN_PREFIXES :32-35`). ✓

### 5.3 Hebrew RTL behavior
`MobileBottomNav.tsx:42, 55`: `dir={isRTL ? 'rtl' : 'ltr'}`. Items rendered as `<ul className="flex">` — flex direction in CSS auto-mirrors with `dir`. Spot-check: with `dir=rtl` Home is on the right, Account on the left. **Acceptable.** The `paddingBottom: 'env(safe-area-inset-bottom)'` (line 60) handles iPhone home-indicator. ✓

### 5.4 Visual conflict
`Layout.tsx:110`: `<div className="pb-16 md:pb-0">` — adds 64 px bottom padding on mobile to clear the bottom nav. The bottom nav itself is `h-14` (56 px) + safe-area inset. `pb-16` is 64 px which clears it. ✓ But `MyAccount.tsx:982` uses `min-h-screen py-8 px-4` — the `min-h-screen` is `100vh`, not `100dvh`, so on iPhone Safari with bottom URL bar visible, last 60-90 px of the page can be hidden behind the bar. **P2.**

---

## 6. Auth + route protection audit

### 6.1 Hydration chain
`AuthProvider.tsx:172-225`:
1. `setPersistenceWithFallback()` — try `indexedDB` → `localStorage` → `sessionStorage`. All can fail in iOS private mode.
2. `await getRedirectResult(auth)` — handles iOS Safari redirect-based sign-in.
3. `onAuthStateChanged` callback:
   - If `firebaseUser`: `await ensureServerSession(firebaseUser)` (creates server cookie). Errors swallowed.
   - `getIdTokenResult(true)` to extract custom claims. Errors swallowed → claims default to `{ role: 'public' }`.
   - `setClaimsLoading(false)` → `setUser(firebaseUser)` → `setLoading(false)`.

### 6.2 Failure modes

| Step | Failure | Result |
|---|---|---|
| Firebase user exists, DB row missing | `/api/users/me` (or `/api/user/profile`) returns 404 | `useQuery` fails silently. `MyAccount` falls back to constructed `profile` object — **but only the first level**. Deeper field access still throws. |
| DB row exists, `role` column undefined / 'public' | Custom claim arrives as `undefined` | Client treats user as `'public'` → routes to `/my-account` — even for the CEO. Section 3.2 row "ceo". |
| Custom claim missing entirely (claim never minted) | `getIdTokenResult(true)` returns claims without `role` | Same as above → `'public'`. |
| Provider status loading | Provider hits profile button before whoami responds | `useWhoami` returns `role='public'` until query resolves; bottom-nav shows customer items briefly, then swaps. Cosmetic flicker. |

### 6.3 Race conditions on iPhone Safari refresh / direct-URL-open
- **ITP cookie partitioning**: `credentials: 'include'` in `ensureServerSession` may fail on iOS Safari ≥14 if the user hasn't visited `petwash.co.il` recently. Cookie is dropped silently → server session cookie missing → `useWhoami` returns 401 → `RoleProtectedRoute` redirects to `/signin`.
- **`getRedirectResult` blocking**: AuthProvider awaits it inside the IIFE before subscribing to `onAuthStateChanged`. If the token-exchange step takes >1.5 s, `RequireAuth` shows spinner → user perceives "frozen". Actual MyAccount renders fine after.
- **Stale Firebase config**: `index.html:175-197` races `/api/config/firebase` against a 3 s timeout. If both VITE env fallback AND server config fail, `firebase.ts` ends up with `undefined` API key → `auth` initialization throws → caught by `AppErrorBoundary` on top-level mount. **Identical user-visible symptom to a `/my-account` crash.**
- **Direct `/my-account` URL on cold load**: `RequireAuth` shows spinner (loading=true). `onAuthStateChanged` resolves user. `MyAccount` mounts → 8 `useQuery` fire concurrently. Any one component-level throw (lazy chunk fail, etc.) bubbles to global boundary.

---

## 7. Key routes verification table

| Route | Status | Registered at | Page component | Notes |
|---|---|---|---|---|
| `/` | ✓ | `App.tsx:498` | Home | OK |
| `/home` | ✓ | `App.tsx:508` | Home | OK |
| `/my-account` | ⚠ exists but bugged | `App.tsx:2043` | `MyAccount.tsx` | Crash trigger |
| `/account` | ✗ missing | — | — | Not registered. Footer/menu doesn't link there but a user typing it lands on `NotFound` |
| `/dashboard` | ✓ | `App.tsx:660` | `Dashboard.tsx` | RequireAuth-gated |
| `/loyalty` | ✓ | `App.tsx:721` | `Loyalty` | OK |
| `/loyalty/dashboard` | ✓ | `App.tsx:726` | `LoyaltyDashboard` | OK |
| `/prestige` | ✗ missing | — | — | `/prestige-club` (`App.tsx:695`) and `/prestige-pass` (`:700`) exist, but bare `/prestige` does not |
| `/provider` | ✗ missing as a top-level route | — | — | `/provider-os` (`App.tsx:1302`) is the canonical, plus many `/provider/*` subroutes |
| `/provider/dashboard` | ⚠ redirects | `App.tsx:1297` | Redirect → `/provider-os` | OK |
| `/provider/onboarding` | ✗ missing | — | — | `/provider-onboarding` (`App.tsx:2126`) exists with hyphen, not `/provider/onboarding` |
| `/admin/dashboard` | 🔒 admin-gated | `App.tsx:2513` | `AdminDashboard` | OK |
| `/admin/brain` | 🔒 admin-gated | `App.tsx:2589` | OctopusBrain | OK |
| `/bookings` | ✓ | `App.tsx:668` | `CustomerBookings` (RequireAuth) | OK |
| `/my-bookings` | ✗ missing | — | — | Only `/bookings` is registered. Hebrew "הזמנות" maps to `/bookings`. Mobile nav uses `/bookings`. |
| `/sitter-suite` | ✓ | `App.tsx:1406` | `SitterSuite` | OK |
| `/walk-my-pet` | ✓ | `App.tsx:1222` | `WalkMyPet` | OK |
| `/pettrek` | ✓ | `App.tsx:1322` | `PetTrekTracking`/etc | OK; plus `/pettrek/:rest*` catch-all |
| `/paw-finder` | ✓ | `App.tsx:2008` | `PawFinder` | OK |
| `/egift` | ✓ | `App.tsx:775` | `EGift` | OK |
| `/wallet` | ✓ | `App.tsx:2028` | `WalletDownload` | OK; also `/my-wallet` (`:2029`) |
| `/support` | ✓ | `App.tsx:860` | `Support` | OK |
| `/contact` | ✓ | `App.tsx:2091` | `Contact` | OK |
| `/privacy` | ⚠ redirect | `App.tsx:2103` | Redirect → `/privacy-policy` | OK; also `/legal/privacy` (`:885`) — three URLs |
| `/terms` | ✓ | `App.tsx:2105` | `Terms` | OK; also `/legal/terms` (`:882`) |
| `/accessibility` | ✓ | `App.tsx:2300` | `Accessibility` | OK; also `/accessibility-statement` (`:2301`) and `/legal/accessibility` (`:897`) — three URLs |
| `/system-status` | ✗ missing | — | — | Only `/status` exists (twice — duplicate route bug, line 863 and 2007). CEO referenced "System status" — not reachable at `/system-status` |
| `/signin` | ✓ | `App.tsx:518` | `SignIn` | OK; aliases `/sign-in` `/login` |
| `/signup` | ✓ | `App.tsx:551` | `SignUp` | OK; aliases `/sign-up` `/register` |

**Catch-all at `App.tsx:2930`**: `<Route component={NotFound} />`. Confirmed.

---

## 8. Error handling audit

### 8.1 Components
- `client/src/components/AppErrorBoundary.tsx` — single global boundary mounted at `main.tsx:62-66`.
- No per-route boundaries. No per-feature boundaries.

### 8.2 Logging
- POSTs `/api/errors/log` (`AppErrorBoundary.tsx:60`).
- Includes URL, UA, connection type, Firebase UID (best-effort from `localStorage`), `pw_role`, `pw_lang`.
- On POST failure → `console.error` only. **No retry, no localStorage queue.**
- No Sentry/Rollbar/equivalent integration visible.

### 8.3 No reference ID
- No `correlationId` or `incidentId` shown to user.
- Support agent receiving "the page broke" cannot find the matching server log.

### 8.4 No error type distinction
- Single screen for: route 404, render TypeError, lazy chunk load failure, network/API down. Differentiating these would let the boundary auto-reload chunks (cache bust) vs route the user back home.

### 8.5 Recommendations (no code)
1. Generate a short reference ID client-side at boundary catch (e.g., 8-char ULID) and display it: "Reference: `01HX7M2K9P`".
2. Add per-route `<Suspense fallback>` wrappers around lazy components — so a chunk-load failure on `MyAccount` doesn't blow away the whole shell + bottom nav.
3. Distinguish lazy-import error (`error.message.includes('Loading chunk')` or `error.name === 'ChunkLoadError'`) and show "App update detected — reload to continue" with auto-reload.
4. Persist failed `/api/errors/log` POSTs to `localStorage` queue, retry on next mount.
5. Surface a "Copy reference" button + a "Report issue" link to `/support` with the ref pre-filled.
6. Add a dedicated catch boundary inside `Layout` so the header + bottom nav stay visible even when a page errors.

---

## 9. iPhone Safari specifics

### 9.1 Direct-URL `/my-account` while logged in
- Cold load → `index.html` → JS bundle → `main.tsx` initApp() → races Firebase config (400 ms timeout) → mounts `AppErrorBoundary` → renders `App` → `Router` matches `/my-account` → `RequireAuth` shows spinner (loading=true) → `AuthProvider.useEffect` runs `setPersistenceWithFallback`, `getRedirectResult`, then subscribes `onAuthStateChanged` → on user emit, calls `ensureServerSession` (POST `/api/auth/session`).
- **Likely failure surface:** if any of `getRedirectResult`, `setPersistence`, or `ensureServerSession` exceeds the perceived budget (~3 s on cellular), the spinner persists and the user thinks the app is dead.
- A render-time exception in `MyAccount` lazy-load chunk (build-id mismatch after deploy) bubbles to global boundary → "Something went wrong" — this matches the CEO's screenshot exactly.

### 9.2 Refresh on `/my-account`
- Same path as 9.1. Refresh resets Firebase auth, re-runs `getRedirectResult`. iPhone Safari ITP may drop the session cookie if the user hasn't been on the site recently. Result: server `whoami` returns 401, `RoleProtectedRoute` redirects, but `RequireAuth` only checks Firebase user (not server) so it lets the page render with stale Firebase user → first server call inside `MyAccount` returns 401 → swallowed by `useQuery` → page renders with empty data.

### 9.3 Firebase redirect/callback handling
- `AuthProvider.tsx:179-186` — calls `getRedirectResult(auth)` once per mount inside the IIFE, before subscribing to `onAuthStateChanged`. Standard, correct.
- Errors logged but non-fatal.

### 9.4 Viewport / safe-area / bottom-nav overlap
- `index.html:7` — `viewport-fit=cover` ✓
- `index.html:96-99` — `--safe-area-inset-*` CSS vars defined ✓
- `index.html:107-110` — body padding uses safe-area insets ✓
- `MobileBottomNav.tsx:60` — bottom nav padding uses `env(safe-area-inset-bottom)` ✓
- `Layout.tsx:50` — `min-h-[100dvh]` ✓
- `MyAccount.tsx:982` — `min-h-screen` (legacy 100vh, NOT 100dvh) — **P2**, last screen-height of content can hide behind iPhone toolbar.

### 9.5 Hebrew RTL behavior
- `Layout.tsx:36-46` and `PetWashHeader.tsx:303-311` both write `document.documentElement.dir`. Two writers, can race on first paint but converge. ✓ Drawer uses logical properties (`marginInlineStart`) on line 451. Bottom nav uses `dir` attribute. Acceptable.

---

## 10. Proposed fix PR slicing (next 5 PRs)

Each PR is small, independently shippable, and cannot be combined.

```
PR-NAV-1: Fix /my-account crash + ship a role-aware account hub
  Goal:        Stop the iPhone Safari "Something went wrong" on profile-icon tap
               by wrapping MyAccount in a per-route ErrorBoundary + Suspense,
               hardening profile.* property access, and routing the CEO to the
               correct dashboard via the central account-route resolver.
  Files:       - client/src/App.tsx (wrap /my-account in <Suspense> + boundary)
               - client/src/pages/MyAccount.tsx (defensive optional chaining
                 on profile.*; add safe shape for notificationPreferences;
                 100dvh instead of 100vh)
               - client/src/hooks/useAccountNavigation.ts (extend role map to
                 include 'ceo' / 'hr' / 'finance' / 'ops' from adminRoles.ts)
               - client/src/auth/AuthProvider.tsx (widen UserRole literal to
                 include the four extra admin roles instead of silently
                 collapsing them to 'public')
               - client/src/components/MobileBottomNav.tsx (Account tab calls
                 resolveAccountRoute, not hard-coded /my-account)
  Risk:        MEDIUM — touches auth claims path. Needs iPhone Safari smoke.
  Depends on:  N/A
  Out of scope:
    - wallet / finance / K9000 / Nayax / Tranzila / schema / new deps
    - hamburger menu cleanup (PR-NAV-2)
    - bottom-nav visual changes (PR-NAV-3)
    - admin dashboard internals
    - provider OS internals

PR-NAV-2: Hamburger menu route cleanup
  Goal:        Remove duplicate /status registration; pick canonical
               /accessibility URL (kill the 3-way split with /legal/accessibility
               and /accessibility-statement); add /system-status alias matching
               the menu label; add explicit "Admin Dashboard" / "Provider OS"
               drawer items shown when role matches.
  Files:       - client/src/App.tsx (delete duplicate /status, add redirects
                 for the dropped accessibility paths, add /system-status)
               - client/src/components/PetWashHeader.tsx (add role-conditional
                 admin/provider drawer items; rename "System status" link target)
  Risk:        LOW — link cleanup, no new behavior.
  Depends on:  N/A (independent of NAV-1)
  Out of scope:
    - /my-account crash (NAV-1)
    - bottom nav (NAV-3)
    - new dependencies / new pages
    - any wallet / K9000 / Nayax change

PR-NAV-3: Bottom mobile nav cleanup + active-state correctness
  Goal:        Account tab routes via resolveAccountRoute (so providers /
               admins land on their own home, not /my-account); add unread
               messages badge on Messages tab; replace 100vh with 100dvh on
               affected ancestors; make sure bottom nav stays visible on
               error-boundary fallback (per-route boundary inside Layout).
  Files:       - client/src/components/MobileBottomNav.tsx
               - client/src/components/Layout.tsx (per-route ErrorBoundary
                 inside Layout)
               - client/src/components/AppErrorBoundary.tsx (only kept as
                 outermost net; new layout-level boundary added)
  Risk:        LOW — UI change with no business-logic touch.
  Depends on:  PR-NAV-1 (uses the same resolveAccountRoute; better to land
               PR-NAV-1 first so the resolver is correct)
  Out of scope:
    - hamburger menu (NAV-2)
    - any auth or claims change
    - schema, deps, finance

PR-NAV-4: ErrorBoundary improvements (logging, reference ID, error types)
  Goal:        Generate client-side reference ID at boundary catch, display
               it on the fallback UI, persist failed /api/errors/log POSTs
               to a localStorage retry queue, distinguish ChunkLoadError vs
               render error vs API failure, and add a "Report issue" CTA
               that pre-fills /support with the reference.
  Files:       - client/src/components/AppErrorBoundary.tsx
               - client/src/lib/errorRetryQueue.ts (NEW — small util, no deps)
  Risk:        LOW — pure additive, no business path touched.
  Depends on:  N/A
  Out of scope:
    - server-side /api/errors/log changes (no schema, no new deps)
    - Sentry/Rollbar integration (would require new dep — separate approval)
    - any user-facing copy change beyond the ref-ID line

PR-NAV-5: iPhone Safari smoke tests for /my-account routing
  Goal:        Add Playwright tests that reproduce the CEO's exact scenario:
               iPhone Safari viewport, logged-in customer / provider / admin /
               franchise_owner / unauthenticated, tap profile icon, refresh
               on /my-account, refresh on /admin/dashboard, refresh on
               /provider-os. Catch any future regression.
  Files:       - client/e2e/iphone-safari/account-routing.spec.ts (NEW)
               - playwright.config.ts (extend devices block — no new deps,
                 Playwright already installed)
  Risk:        LOW — test-only.
  Depends on:  PR-NAV-1, PR-NAV-3 (otherwise tests fail)
  Out of scope:
    - production code changes
    - new test framework / new deps
    - non-iPhone-Safari test matrix
```

---

## 11. Hard exclusions for any follow-up fix PR

These are OFF-LIMITS without separate, named approval:

- ❌ wallet / finance behavior change (release/refund/payout/balance math)
- ❌ K9000 / Nayax / Tranzila runtime change
- ❌ schema migration (`shared/schema*.ts`, Drizzle migrations)
- ❌ new dependencies (`package.json` / lockfile)
- ❌ logged-out homepage breakage
- ❌ admin dashboard regression
- ❌ provider flow regression (provider-os, onboarding, KYC)
- ❌ mixing scope with concurrent PR-22 / PR-23 / PR-24 / PR-25 / popup / skill-pack branches

---

## Appendix — file index referenced

- `client/src/App.tsx` (3149 lines) — route table
- `client/src/main.tsx` (80 lines) — root mount + global ErrorBoundary
- `client/src/components/AppErrorBoundary.tsx` (129 lines)
- `client/src/components/MobileBottomNav.tsx` (101 lines)
- `client/src/components/PetWashHeader.tsx` (826 lines) — header + hamburger drawer
- `client/src/components/Layout.tsx` (116 lines)
- `client/src/components/Footer.tsx` — legal links
- `client/src/auth/AuthProvider.tsx` (288 lines) — Firebase + claims hydration
- `client/src/auth/RequireAuth.tsx` (25 lines)
- `client/src/auth/RoleProtectedRoute.tsx` (67 lines)
- `client/src/auth/useWhoami.ts` (65 lines) — server `/api/session/whoami`
- `client/src/hooks/useAccountNavigation.ts` (149 lines) — central role-aware destination resolver
- `client/src/pages/MyAccount.tsx` (4240 lines) — the crashing page
- `shared/petwashRoles.ts` — PlatformRole enum (15 roles)
- `shared/adminRoles.ts` — ADMIN_ROLES (8 roles, includes `'ceo'`)
- `client/index.html` — viewport, safe-area, Firebase runtime config

End of audit.
