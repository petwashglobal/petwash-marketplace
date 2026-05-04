# iPhone Safari Smoke Test Plan

**Scope:** Manual smoke test for high-impact mobile flows on iPhone Safari following PR-NAV-1 (account hub) and the P0 admin-login Safari fix.
**Audience:** QA / on-call engineer running pre-release verification.
**Target build:** `main` or release candidate, same Vercel/Hosting URL used by production.
**Estimated runtime:** 12–15 minutes per device.

> Related docs:
> - `docs/SAFARI_WEBKIT_COMPATIBILITY_CHECKLIST.md` (broader Safari/WebKit matrix)
> - `docs/MOBILE_HEADER_AND_FIREBASE_AUTH_FIXES.md`
> - `docs/ONE_TAP_MOBILE_LOGIN.md`

---

## 1. Preconditions

- [ ] Test user accounts available:
  - `qa+customer@petwash.test` (role: customer)
  - `qa+franchisee@petwash.test` (role: franchisee)
  - `qa+admin@petwash.test` (role: admin, allow-listed for `/admin/login`)
- [ ] Each device is signed in to a personal Google account that is NOT the admin account (to flush popup state).
- [ ] Safari → Settings → Safari → "Block All Cookies" is OFF.
- [ ] Safari → Settings → Safari → "Block Pop-ups" — note state per row of the matrix below; the admin login flow MUST work with pop-ups blocked (we use a redirect, not a popup).
- [ ] Cache cleared (Settings → Safari → Clear History and Website Data) before the first run on a given device.

## 2. Device & iOS Coverage Matrix

Run the full checklist (sections 3–7) on at least one device per row. Record pass/fail per scenario in section 8.

| # | Device           | iOS / Safari version | Pop-ups blocked? | Private Browsing? | Required? |
|---|------------------|----------------------|------------------|-------------------|-----------|
| 1 | iPhone 15 Pro    | iOS 18.x             | OFF              | No                | Yes       |
| 2 | iPhone 14        | iOS 17.x             | ON               | No                | Yes       |
| 3 | iPhone 13 / SE3  | iOS 17.x             | OFF              | Yes               | Yes       |
| 4 | iPhone 12 / 11   | iOS 16.x             | OFF              | No                | Recommended |
| 5 | iPhone XR / X    | iOS 16.x (last supported) | OFF         | No                | Recommended |
| 6 | iPad (Safari)    | iPadOS 17+/18+       | OFF              | No                | Spot-check |

Browser engine note: All iOS browsers (Chrome, Edge, Firefox on iOS) use WebKit, so verifying Safari covers them; only Safari is required for sign-off.

## 3. Scenarios

### 3.1 `/admin/login` — Google OAuth via redirect

**Why:** Safari ITP and pop-up blockers historically broke the OAuth popup; we switched to redirect after the P0 fix in `claude/p0-admin-login-google-safari`. We need to confirm no popup-blocker prompt and no redirect loop.

Steps:
1. From a fresh Safari tab, navigate to `https://<host>/admin/login`.
2. Tap **Sign in with Google**.
3. Complete Google account chooser using the admin allow-listed account.
4. Observe redirect back to the admin landing page.

Expected:
- No "Pop-up blocked" Safari banner.
- No infinite redirect between `/admin/login` and `/admin`.
- After sign-in, user lands on the admin home (e.g. `/admin` or role-default route) within 5s.
- Refreshing the admin page does NOT bounce back to `/admin/login` (session persisted via cookie, not popup-only storage).

Fail conditions:
- Redirect loop between login and admin.
- "Pop-up blocked" prompt visible.
- Lands on `/login` (consumer) instead of `/admin`.
- White screen / unhandled error after Google returns.

### 3.2 Gold/profile icon → account route

**Why:** PR-NAV-1 made the header avatar role-aware. Verify the icon routes to the correct hub on mobile.

Steps (run for each role):
1. Sign in as the role under test (customer / franchisee / admin).
2. Tap the gold profile icon in the header.

Expected per role:
- Customer → `/my-account` (or aliased customer hub) loads cleanly.
- Franchisee → franchisee dashboard route (e.g. `/franchisee` or `/account` with franchisee tab) loads cleanly.
- Admin → admin hub (e.g. `/admin`) loads cleanly.
- The icon never routes to `/login` while the user is authenticated.

Fail conditions:
- Tap is dead (no navigation, no visible affordance change).
- Wrong role hub (e.g. customer lands in admin).
- Header reflows / overlaps content after navigation.

### 3.3 `/my-account` shell renders with partial data

**Why:** Pre-fix, missing optional fields could throw and white-screen the shell. PR-NAV-1 made the shell defensive; confirm it survives partial data on mobile.

Steps:
1. Sign in as a freshly created customer account that has NO bookings, NO payment method, NO loyalty points.
2. Navigate to `/my-account`.

Expected:
- Page renders header, tabs/sections, and an empty-state per missing block.
- No red error overlay, no spinner-stuck-forever state.
- Console (if attached via Web Inspector) has no uncaught exceptions related to `undefined` field reads.
- Pull-to-refresh works and does NOT crash the shell.

Fail conditions:
- White screen.
- Partial render then crash on tab switch.
- Infinite skeleton loader (>10s) on Wi-Fi.

### 3.4 Popup interstitial — appears once and dismisses

**Why:** The marketing/announcement interstitial must not nag the user repeatedly on Safari (sessionStorage / cookie quirks under ITP).

Steps:
1. Clear Safari website data for the host.
2. Open the home / landing route.
3. Wait for the interstitial to appear.
4. Dismiss via the close (X) control.
5. Navigate to another route and back; refresh the page once.

Expected:
- Interstitial appears exactly once on the first visit.
- Close control responds to the first tap (no double-tap required, no 300ms tap delay).
- After dismissal, the interstitial does NOT reappear during the same session, including after route changes and a single page refresh.
- No background scroll lock left behind (page scrolls normally after dismiss).

Fail conditions:
- Interstitial reappears on every route change or refresh.
- Close button requires repeated taps.
- Body remains `overflow: hidden` after dismiss (page can't scroll).

### 3.5 Brain dashboard — gated route enforcement

**Why:** The Brain dashboard is admin-gated. Verify the gate works on mobile Safari (no client-only bypass, no flash of protected content).

Steps:
1. While signed OUT, attempt to load `/brain` (or current Brain route) directly via URL.
2. Sign in as a non-admin (customer) and retry.
3. Sign in as the admin allow-listed account and retry.

Expected:
- Signed out: redirected to login (admin or consumer per current policy) WITHOUT any flash of dashboard content.
- Customer: receives 403 / "not authorized" view, NOT the dashboard.
- Admin: dashboard loads, key widgets render, no layout overflow on a 390px-wide viewport.

Fail conditions:
- Any flash of protected content before redirect.
- Customer sees admin data.
- Admin view has horizontally-scrolling layout / cut-off CTAs on iPhone width.

## 4. Cross-cutting checks (run once per device)

- [ ] Status bar / safe-area: No content hidden under the iOS notch or home indicator.
- [ ] Tap targets: All primary CTAs are at least 44×44 pt.
- [ ] Forms: Keyboard appears with the correct type (email, tel, numeric) where applicable.
- [ ] Back/forward gestures: Edge-swipe back from any of the routes above does not corrupt navigation state.
- [ ] Network resilience: Toggle airplane mode mid-flight on `/my-account`; the shell should show a clear offline/error state, not crash.

## 5. Logging on failure

When a row fails, capture:
1. Device + iOS version + Safari version (Settings → General → About).
2. Screen recording (Control Center → Screen Recording).
3. Web Inspector console + network log if Mac is available (Settings → Safari → Advanced → Web Inspector ON, then attach via macOS Safari → Develop menu).
4. Repro URL and the exact step that failed.

File the bug in the repo issue tracker with label `mobile-safari` and link to this checklist run.

## 6. Sign-off criteria

- All scenarios in section 3 pass on rows 1, 2, and 3 of the matrix.
- No P0/P1 regression filed against `mobile-safari` since the run started.
- The on-call engineer signs the row in section 8.

## 7. Run log template

Copy this block per run; commit results back to this file in a follow-up PR if desired.

```
Date:        YYYY-MM-DD
Build SHA:   <git sha or Vercel deployment id>
Tester:      <name>
Device:      iPhone __ (iOS __.__, Safari __)
```

| Scenario | Pass / Fail | Notes |
|----------|-------------|-------|
| 3.1 /admin/login OAuth redirect           |   |   |
| 3.2 Gold icon → account route (customer)  |   |   |
| 3.2 Gold icon → account route (franchisee)|   |   |
| 3.2 Gold icon → account route (admin)     |   |   |
| 3.3 /my-account partial-data shell        |   |   |
| 3.4 Popup interstitial once-and-dismiss   |   |   |
| 3.5 Brain dashboard gate (signed out)     |   |   |
| 3.5 Brain dashboard gate (customer)       |   |   |
| 3.5 Brain dashboard gate (admin)          |   |   |
| 4. Cross-cutting checks                   |   |   |

Sign-off: ____________________   Date: __________
```

## 8. Historical run results

_Add new rows below; do not edit prior rows._

| Date | Build | Device / iOS | Tester | Result |
|------|-------|--------------|--------|--------|
|      |       |              |        |        |
