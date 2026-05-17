# Infrastructure Audit — 2026-05-17

**Status:** Merged forensic audit. **No code change in this PR.**
**Trigger:** CEO escalation 2026-05-17 — *"Save PetWash matrix from evil agents. The matrix is ours, Neo, claim it to use with authority."* Six parallel forensic agents dispatched over the weekend. Findings consolidated here as the canonical infrastructure reference.
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0 (brand), §1 (module map), §2 (protected systems), §3 (AI advisory rule).
**Companion docs (do not duplicate):**
- `docs/AUTH_STACK_FORENSIC_AUDIT.md` (PR #304)
- `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` (PR #297)
- `docs/INTENT_ARCHITECTURE_AUDIT.md` (PR #300)
- `docs/SUMIT_CAPABILITIES_AUDIT.md` (PR #301)
- `docs/CODEBASE_CLEANUP_AUDIT.md` (PR #307)
- `docs/PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT.md` (PR #312, CEO-approved)
- `docs/GOOGLE_PLACES_AUTOCOMPLETE_AUDIT.md`

**CEO direction (locked):**
1. Don't remove Replit blindly
2. Keep dev-only Replit tooling if harmless
3. Remove only runtime Replit imports used in production paths
4. Consolidate duplicate OAuth / join flows gradually
5. No new PR until approved from this merged audit

---

## §0 — TL;DR

After six parallel forensic agents covering auth stack, admin brain, public-to-provider journey, Replit footprint, secrets matrix, Firebase/Firestore config, marketplace flow, and provider→SUMIT integration:

**The bones are solid.** PetWash is NOT a Replit-damaged codebase. Specifically:
- ✓ Firebase config correct (Safari ITP `authDomain` hardcoded to `petwash.co.il`)
- ✓ Firestore rules tight (no `allow: if true`)
- ✓ Custom claims aligned between server-set and client/rules-read
- ✓ Marketplace booking lifecycle race-condition-free
- ✓ Wallet 9-layer fraud defense intact (append-only ledger + idempotency + velocity + DB locks + hash chain)
- ✓ `תעודת זהות מספר בלבד` rule honored — NO ID photos stored; ID number SHA-256 hashed
- ✓ MockPaymentProvider gates correctly (every method returns `ok: false`)

**The mess is duplication and drift, not destruction:**
- 7 OAuth entry points (3 already consolidated in PR-AUTH-1; 4 remain)
- 4 different iOS detection helpers
- 3 broken `/join/*` provider forms — already 302-redirected in PR #309
- 1 unauthenticated brain API (`/api/octopus-brain`) — already deleted in PR #308
- 7 Replit Connector-dependent server services with zero fallback (runtime liability)
- Several secrets with placeholder values in production CI workflow
- No provider finance profile / SUMIT integration (CEO-approved plan in PR #312)

**This document ranks 47 findings by severity + production risk and proposes 18 surgical PRs over ~3 sprints.** No PR opens without CEO approval per the directive above.

---

## §1 — Auth stack + admin brain ("Octopus")

### §1.1 Findings table

| # | Severity | File:Line | Real risk? | Recommended fix | PR size | Rollback |
|---|---|---|---|---|---|---|
| **A-1** | **P0 SECURITY** ✓ FIXED | `server/routes.ts:10551` (deleted) | YES — `/api/octopus-brain` mounted with rate-limit only; 9 endpoints (5 GET, 3 POST) public; 3 POST mutations lacked `logAuditEvent` | Delete dead code (no UI consumer) | XS | `git revert` |
| **A-2** | **P0 CONVERSION** ✓ FIXED | `client/src/pages/join/JoinAs*.tsx` (deleted) | YES — 3 forms submit to canonical endpoint but omit OTP + self-declaration + ID upload; users hit 400, leave | 302-redirect to `/provider-onboarding?role=X` | S | `git revert` |
| **A-3** | P0 RACE | `client/src/auth/AuthProvider.tsx:211` + `client/src/pages/SignIn.tsx:561` | YES — `getRedirectResult()` consumed twice; second call returns null on iPhone Safari → silent OAuth failure | Page-level components must NOT call `getRedirectResult` (AuthProvider only). Move `SignIn.tsx:561` post-redirect logic to `onAuthStateChanged` observer. | M | Feature-flag `STRICT_AUTH_REDIRECT_OWNER` for 48h soak |
| **A-4** | P1 ARCHITECTURE | 7 sites — `AdminLoginV2.tsx:278`, `auth-guardian-2025.ts:180`, `auth/client.ts:57`, `GmailOAuthButton.tsx:82`, `SignIn.tsx:1020`, `SignUp.tsx:238`, `PrivilegeSignup.tsx` (now in PR-AUTH-1 #305) | PARTIAL — PR-AUTH-1 consolidated 3 of 7. Remaining 4 (SignIn, SignUp, GmailOAuthButton, edge paths) still inline. | PR-AUTH-6 — unify the remaining 4 onto `auth-guardian-2025.ts:signInWithGoogle()` canonical hook | L (20h, MEDIUM risk) | Per-file `git revert`; canonical hook unchanged |
| **A-5** | P1 INCONSISTENCY | `iosAuthHandler.ts:24-115` (4 functions) + `AdminLoginV2.tsx:28` | YES on iPad — `isMobileBrowser()` regex too broad (catches Android Chrome); `isIPhone()` excludes iPad. Result: iPad uses popup somewhere, redirect elsewhere | PR-AUTH-5 — consolidate to single `isIOS()` (catches iPad-as-Mac via `MacIntel + maxTouchPoints>1`). Mark others deprecated re-exports. | S (~2h) | Single-file revert |
| **A-6** | P1 BRAIN VISIBILITY | `client/src/pages/admin/BrainDashboard.tsx:214` + `server/routes/admin-brain.ts` | YES — brain panel only covers 6 of 18 modules. CEO blind to bookings velocity, fraud signals, support queue, loyalty churn, provider rejections, PetTrek, Pet Finder, IL VAT, notifications, Gemini coworker. | Multi-sprint: add panel + endpoint per missing module. ~12 small PRs. Start with bookings velocity + fraud signals (highest-value gaps). | XL (multi-sprint) | Per-panel feature flag |
| **A-7** | P1 AUTH ERROR DIAG | `AdminLoginV2.tsx:104-110` | PARTIAL — 4 distinct OAuth failure modes (OAuth never started / session creation failed / cookie not propagating / role denied) all surface as ONE generic toast. Hides root cause from CEO during incidents. | PR-AUTH-2 — split toast into 4 distinct messages + admin debug overlay gated to `?debug=1` | S (~30min) | Single-file revert |
| **A-8** | P1 STARTUP VALIDATION | `server/middleware/rbac.ts:17-32` | YES — `SUPER_ADMIN_EMAILS` empty in prod → server boots silently, all admin logins fail. CEO would not know unless he tries to log in. | PR-AUTH-3 — server `index.ts` validates `SUPER_ADMIN_EMAILS` non-empty + non-placeholder at boot; exits non-zero if missing | S (~30min) | Revert; existing graceful degradation returns | 
| **A-9** | P2 RACE | `AdminLoginV2.tsx:83-118` | PARTIAL on iPhone Safari ITP — localStorage flag can be cleared on cross-site redirects; useEffect short-circuits silently | Use `sessionStorage` + URL hash fallback alongside localStorage flag | S (~1h) | Single-file revert |
| **A-10** | P2 DEAD CODE | `auth/client.ts:57-100` (deprecated, popup-only) | DEV CLUTTER — already a thin delegator post-PR-AUTH-1; can be removed entirely in PR-AUTH-6 | Delete after PR-AUTH-6 lands and 48h soak | XS | `git revert` |
| **A-11** | P2 MFA SOFT-FAIL | `server/routes.ts:2194-2196` | DEV CLUTTER — `mfaRequired` returns true for admin roles but never 403s if `mfaVerified=false`; client never told | Server returns 403 with `MFA_REQUIRED` error code; client redirects to MFA setup. CEO sign-off required before strict-mode flip. | M | Feature-flag `MFA_STRICT` |
| **A-12** | P3 CSP | `firebase.json:149` | DEV CLUTTER — `script-src 'unsafe-inline' 'unsafe-eval'` necessary for Firebase SDK; XSS risk theoretical (no eval'd user input) | Migrate to CSP nonce-based approach (defer) | L | `git revert` |
| **A-13** | P3 LOGGING | `auth/client.ts:59`, `auth/passkey.ts` (multiple) | DEV CLUTTER — `console.log` shipped to production code paths. No secrets leaked. | Replace with `logger.info()` | XS (~30min) | Single-file revert |

### §1.2 Auth references
- `docs/AUTH_STACK_FORENSIC_AUDIT.md` (PR #304) — 7 OAuth entry points, race condition, ranked fix list
- PR #305 — PR-AUTH-1 (consolidated admin + loyalty + auth/client.ts shim) — MERGED

---

## §2 — Public-to-provider A-to-A journey

### §2.1 The journey audit found

| Step | What exists | Mess? |
|---|---|---|
| 0 — Discovery (homepage CTA) | Multiple CTAs in `ProviderRegistrationBanner.tsx:38-47` lead to mix of `/provider-onboarding` and (now-deleted) `/join/{walker,sitter,trainer}` | ✓ FIXED in PR #309 — all roads lead to canonical `/provider-onboarding?role=X` |
| 1 — Landing surface | `ProviderOnboarding.tsx` (1517 lines) is canonical; 3 sibling forms now 302-redirect | ✓ FIXED |
| 2 — Sign-in gate | Canonical requires pre-auth (`<RequireAuth>`); dedicated allowed pre-auth form fill (now removed) | ✓ FIXED by deletion |
| 3 — Service type | `ProviderOnboarding.tsx:110-123, 720-795` — multi-select walker / sitter / driver / trainer / station_operator | OK |
| 4 — KYC + declarations | OTP via custom 9-country picker (`ProviderOnboarding.tsx:230-238`), Israeli self-declaration mandatory (`:1223-1385`) | Phone field group needs `dir="ltr"` lock for Hebrew RTL — applied in Phase A PR #298 |
| 5 — Document uploads | `selfiePhoto` + `governmentId` required (`server/routes/provider-onboarding.ts:491-497`) | OK |
| 6 — Submission + admin review | `POST /api/provider-onboarding/apply` → `provider_applications.status='pending'` → admin queue | OK |
| 7 — Approval notification | `buildAdminApprovedEmail()` via SendGrid (`server/services/emailTemplates.ts`) | ⚠️ `SENDGRID_TEMPLATE_ID_MEMBER_PASS` placeholder in CI — see §4 finding S-2 |
| 8 — Provider dashboard | `/provider-os` route — `RoleProtectedRoute minRole="provider"` | OK; first-visit onboarding lives inside dashboard |
| 9 — First booking | Per service backend (`bookings.ts`, `walk-my-pet.ts`, `sitter-suite.ts`, `academy.ts`) | OK |
| **10 — First payout** | `ProviderPayoutService.ts:24-150` + Stripe-legacy fields on `providers` table | **❌ GAP — no SUMIT integration; no `provider_finance_profile`. See PR #312 CEO-approved plan.** |

### §2.2 Findings table

| # | Severity | File:Line | Real risk? | Recommended fix | PR size | Rollback |
|---|---|---|---|---|---|---|
| **J-1** | **P0 FINANCE** | `shared/schema.ts:7896-7944` + `server/routes/admin-provider-review.ts:359-399` | YES — approved providers have no structured finance profile; cannot legally receive payouts in Israel | PR-PFP-1 through PR-PFP-11 per `PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT.md` + CEO approval comment on PR #312 | XL (~3 weeks total; MVP in 1 week) | Per-PR `git revert`; existing payout system stays as-is during MVP |
| **J-2** | P0 PROVIDER FORMS ✓ FIXED | `client/src/pages/join/JoinAs*.tsx` | YES — 3 forms broken at submit | 302-redirect (done) | S | `git revert` PR #309 |
| **J-3** | P1 HEBREW BIDI | `ProviderOnboarding.tsx:307, 1223` | YES on iPhone Safari — Hebrew strings render brand mark reversed | Wrap `Pet Wash` with U+2066 ... U+2069 isolation marks | XS (~10min, 2 lines) | Single-file revert |
| **J-4** | P1 PHONE GROUP RTL | `ProviderOnboarding.tsx:826` | YES on Hebrew RTL — country selector + phone input can visually flip; CEO rule violated | Wrap field group with `dir="ltr"` | XS (~5min, 1 line) | Single-file revert |
| **J-5** | P2 ROUTING DEDUP | `client/src/components/ProviderRegistrationBanner.tsx:38-47` | DEV CLUTTER — banner mapper still references logically-distinct routes that all redirect to canonical | Simplify mapper to single canonical CTA + role param | S (~30min) | Single-file revert |
| **J-6** | P2 SIGNUP AUTH GATE | `App.tsx:2274` (canonical) vs former `/join/*` (allowed pre-auth) | FIXED by J-2 deletion | None | N/A | N/A |
| **J-7** | P2 INTENT ARCHITECTURE | `server/routes/post-login.ts:48-50` | YES — `intentToRole('provider')` silently returns `'customer'`; user clicks "Become Provider" → returns later → silently becomes customer | See `docs/INTENT_ARCHITECTURE_AUDIT.md` PR-I1 through PR-I7. 7 PRs over 2 weeks. | L (multi-sprint) | Per-PR revert; feature-flagged strict mode |

---

## §3 — Replit cut-or-keep matrix

### §3.1 Replit footprint (after PR #310 cleanup landed)

| Touchpoint | Type | Status after PR #310 |
|---|---|---|
| `@replit/connectors-sdk` (`package.json:60`) | Production dep, unused | ✓ REMOVED |
| `@replit/vite-plugin-cartographer` (devDeps) | Dev plugin | ✓ REMOVED |
| `@replit/vite-plugin-runtime-error-modal` (devDeps) | Dev plugin | ✓ REMOVED |
| `vite.config.ts:5-19` Replit conditional block | Dev plugin loader | ✓ REMOVED |
| `verify-github-push.js` | Dev script (no fallback) | ✓ REMOVED |
| `.replit` config file | Local Replit IDE config | KEPT (CEO directive — harmless in prod) |
| `replit.md` | 81 KB doc artifact | KEPT (reference) |
| `process.env.REPL_ID` checks | Runtime detection | KEPT (read-only branching) |
| `process.env.REPLIT_CONNECTORS_HOSTNAME` | Runtime — **7 services depend on it** | ⚠️ STILL ACTIVE — see findings R-1 to R-7 |

### §3.2 The remaining runtime liability — 7 services with NO fallback

Per CEO directive (*remove only runtime Replit imports used in production paths*):

| # | Severity | File:Line | Real risk? | Recommended fix | PR size | Rollback |
|---|---|---|---|---|---|---|
| **R-1** | P1 RUNTIME | `server/spotify.ts:15-24` | YES if Cloud Run doesn't have `REPLIT_CONNECTORS_HOSTNAME` — service throws "Spotify not connected"; Spotify widget feature dead | Refactor: store Spotify refresh token in Postgres; refresh server-side; no Replit proxy | M (~4h) | Single-file revert; original code stays |
| **R-2** | P1 RUNTIME | `server/hubspot.ts:11-49` | YES — HubSpot CRM sync breaks without proxy | Refactor: store HubSpot API key in GCP Secret Manager; fetch at startup | M (~4h) | Single-file revert |
| **R-3** | P1 RUNTIME | `server/services/googleSheetsIntegration.ts` | YES — admin Sheets exports fail | Use GCP service account (already exists for Firebase Admin); add Sheets scopes | M (~4h) | Single-file revert |
| **R-4** | P2 RUNTIME | `server/services/googleDriveBackupService.ts` | YES — encrypted backup fails | GCP service account | M (~2h) | Single-file revert |
| **R-5** | P2 RUNTIME | `server/services/CalendarIntegrationService.ts` + `server/services/GoogleCalendarIntegrationService.ts` (DUPLICATE) | YES — calendar sync breaks; also two services doing same thing | GCP service account + consolidate the two services into one | L (~6h) | Per-file revert |
| **R-6** | P2 RUNTIME | `server/routes/gmail.ts` | YES — Gmail integration fails | GCP service account with Gmail scopes | M (~3h) | Single-file revert |
| **R-7** | P3 CONDITIONAL | `server/replitAuth.ts:15-104` | NO — already gracefully falls back to Firebase auth (lines 87-103). Replit OAuth never reaches production users. | Simplify to Firebase-only after the 6 above land | S (~2h) | Revert |
| **R-8** | P3 LIB | `server/lib/replitConnector.ts` (utility wrapper) | DEV CLUTTER — only used by R-1 to R-6. Delete after they're refactored. | Delete in final cleanup PR | XS | `git revert` |
| **R-9** | P3 CSP | `server/middleware/securityHeaders.ts:28-30, 65, 77, 87, 108, 142, 155` (replitHosts) | DEV CLUTTER — CSP-only references; no runtime impact | Optional cleanup after R-1 through R-6 | XS | `git revert` |
| **R-10** | P3 TESTING | `playwright.config.ts:40-42` | DEV CLUTTER — safe fallback to `localhost:5000`; only matters in test runs | Optional cleanup | XS | `git revert` |

**Bottom line per CEO directive:** keep `.replit` config, keep dev-only CSP refs, **refactor R-1 through R-6 (the runtime liabilities) one at a time.** Each is independently safe with same-file revert. ~3-day total effort spread across sprints.

---

## §4 — Secrets matrix

### §4.1 Active production placeholders that block features

| # | Severity | Secret | Where placeholder lives | Real risk? | Recommended fix | PR size | Rollback |
|---|---|---|---|---|---|---|---|
| **S-1** | **P0 ADMIN** | `SUPER_ADMIN_EMAILS` | GCP Secret Manager (CEO updated → version 252) | RESOLVED if v252 contains CEO's email; verify via `/api/session/whoami` | Verify via diagnostic; otherwise add real value | CEO action only | New secret version |
| **S-2** | **P0 EMAIL** | `SENDGRID_TEMPLATE_ID_MEMBER_PASS = 'd-PLACEHOLDER_SET_REAL_TEMPLATE_ID'` | `.github/workflows/petwash-ci.yml:141` | YES — Prestige Pass + booking confirmation emails bounce with 400 from SendGrid | CEO updates GCP Secret Manager; CI workflow strips the placeholder default | CEO action + XS PR | Restore placeholder |
| **S-3** | P0 RECAPTCHA | `RECAPTCHA_SECRET_KEY` hardcoded in CI line 152 — appears to be SITE key (public) not SECRET key | `.github/workflows/petwash-ci.yml:152` | YES — walker reCAPTCHA validation fails | Add real SECRET key as GitHub Actions secret; CI reads it from secrets | XS | Restore inline placeholder |
| **S-4** | P0 SMS | `TWILIO_AUTH_TOKEN` may not be set in production | GCP Secret Manager (visibility unknown from repo) | YES if missing — provider OTP "service unavailable" Hebrew form | CEO verifies all 3 Twilio secrets in GCP Secret Manager | CEO action only | N/A |
| **S-5** | P1 PROD VAR | `VITE_FIREBASE_AUTH_DOMAIN` — currently overridden to `petwash.co.il` in code at `firebase.ts:42` | Code wins, but build env is undeclared | LOW — code default is correct; verify GitHub Actions secret is set as belt-and-braces | Confirm `VITE_FIREBASE_AUTH_DOMAIN` GitHub Actions secret has real value | CEO action | N/A |
| **S-6** | P1 PROD VAR | `VITE_TURNSTILE_SITE_KEY` hardcoded in `.replit` only (`0x4AAA…`) | NOT in `.env.example` or CI build step | YES — Cloudflare Turnstile dead in production builds | Add as GitHub Actions secret + add to CI build env | XS | Remove from CI env |
| **S-7** | P2 PLACEHOLDER | `GOOGLE_TRANSLATE_API_KEY`, `GOOGLE_WEATHER_API_KEY` set to `PLACEHOLDER_*` | `.github/workflows/petwash-ci.yml:270, 278` | DEGRADES GRACEFULLY — translation returns null; weather widget hidden | Optional: set real values when those features are launched | CEO action | N/A |
| **S-8** | P2 PLACEHOLDER | `HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_GUID` placeholders | `.github/workflows/petwash-ci.yml:284, 290` | YES — HubSpot CRM sync blocked; pairs with R-2 refactor | Set real values | CEO action | N/A |
| **S-9** | P2 PLACEHOLDER | `NAYAX_*` (4 secrets) all `nayax-placeholder-not-active` | `.github/workflows/petwash-ci.yml:128-137` | INTENTIONAL — Nayax kiosk hardware not yet deployed; placeholders are by design | Leave until first Nayax kiosk goes live | N/A | N/A |
| **S-10** | P2 STARTUP | `SUPER_ADMIN_EMAILS` not validated at server boot | `server/middleware/rbac.ts:17-32` | YES — server boots silently with admin gate CLOSED if secret missing | PR-AUTH-3 — fail-CLOSED at boot | S | Restore graceful degradation |
| **S-11** | P2 PROD VAR | `VITE_SENTRY_DSN`, `VITE_TAWK_*`, `VITE_APP_VERSION`, `VITE_API_URL`, `VITE_ADMIN_EMAILS` — referenced in code, not declared in CI build env | client files | LOW — defaults to `undefined`, features degrade gracefully | Either declare in CI build env OR remove references | XS each | Per-PR revert |
| **S-12** | P3 SECRET DRIFT | `.replit` exposes `SUPER_ADMIN_EMAILS` in plaintext (committed to repo) | `.replit:53` | YES — emails visible in repo history; not a credential but a target list | Move to git-ignored `.replit.local` (Replit supports this) OR redact | XS | Restore plaintext |

### §4.2 Hygiene PRs proposed

| # | Title | Risk | Effort |
|---|---|---|---|
| **S-A** | Server startup validation of critical secrets (`SUPER_ADMIN_EMAILS`, `TWILIO_*`, `SENDGRID_API_KEY`, `DATABASE_URL`, `JWT_SECRET`) — fail-CLOSED at boot | LOW | ~30 min |
| **S-B** | `npm run check:secrets` script that diffs secret names across `.env.example` / `cloudrun-service.yaml` / `.github/workflows/petwash-ci.yml` / source code | LOW | ~1 h |
| **S-C** | CI workflow tidy — add missing `VITE_*` to pre-build env (Turnstile, Sentry DSN, etc.) | LOW | ~30 min |
| **S-D** | `.replit` secret redaction — move `SUPER_ADMIN_EMAILS` to `.replit.local` (git-ignored) | LOW | ~10 min |

---

## §5 — Firebase / Firestore

### §5.1 Surprisingly clean

The Firebase audit found the previous Replit agent did NOT damage Firebase config. Specifically:

- ✓ `client/src/lib/firebase.ts:41-43` — `authDomain` correctly hardcoded to `petwash.co.il` in production (Safari ITP fix in place)
- ✓ `initializeApp` guarded by `getApps()` check — no duplicate init
- ✓ `initializeAuth([indexedDBLocalPersistence, browserLocalPersistence], browserPopupRedirectResolver)` — correct iOS persistence chain
- ✓ Firestore rules well-scoped (`firestore.rules`) — no `allow: if true` anywhere
- ✓ Custom claims (`role`, `admin`, `accountType`, `franchise_id`) aligned between server-set (`syncFirebaseClaims.ts`) and client/rules-read
- ✓ Storage rules tight (`storage.rules`) — KYC docs + biometric selfies owner+admin only; profile images intentionally public
- ✓ TEST_BYPASS_TOKEN gated on `NODE_ENV !== 'production'`
- ✓ App Check fails CLOSED with critical error if `VITE_RECAPTCHA_SITE_KEY` missing in prod

### §5.2 Remaining findings

| # | Severity | File:Line | Real risk? | Recommended fix | PR size | Rollback |
|---|---|---|---|---|---|---|
| **F-1** | P1 SAFETY | `server/lib/firebase-admin.ts:5` + `client/src/lib/firebase.ts:44` | LOW — both fall back to `'signinpetwash'` if env var missing; works as long as both stay in sync. CEO sets one secret but not the other = silent auth failures. | Centralize env reading in single `config.ts`; validate at boot | S (~1h) | Single-file revert |
| **F-2** | P2 RULES | `firestore.rules:342, 347, 351, 386, 388, 393, 395, 396, 438, 441` | YES — rules check `request.auth.token.franchise_id` but no test verifies server always sets it. If server forgets to set claim, rule silently denies. | Add regression test for `franchise_id` claim presence per owner-role user | M (~3h) | Per-test revert |
| **F-3** | P2 CSP | `firebase.json:149` | DEV CLUTTER — `'unsafe-inline' 'unsafe-eval'` required for Firebase SDK | Migrate to nonce-based CSP (defer) | L | `git revert` |
| **F-4** | P2 ADMIN GUARD | `client/src/components/AdminRouteGuard.tsx` | DEV CLUTTER — 3 sources of truth (claims + whoami + Firestore doc) can race | Rely on claims after fresh token refresh; remove Firestore doc fallback | S | Single-file revert |
| **F-5** | P3 LOGGING | `firebase.ts:85-90`, `firebase-admin.ts:22, 32, 49, 79, 82` | DEV CLUTTER — DEV-only `console.log` calls that Vite tree-shake should drop. Confirm. | Replace with `logger.debug` | XS | Per-file revert |

---

## §6 — Marketplace flow forensic

### §6.1 The bones are solid

- ✓ Booking state machine race-condition-free (`BookingLifecycleService.ts:91-640`)
- ✓ Completion requires BOTH customer and provider to confirm
- ✓ Escrow audit log: append-only + SHA-256 hash chain (`EscrowStateMachine.ts:142-168`)
- ✓ AI verification gate on payout (`ProviderPayoutService.ts:88-129`)
- ✓ Wallet 9-layer fraud defense (`WalletLedger.ts:1-9`)
- ✓ Velocity limiter (10 ops / 60s) + DB `SELECT FOR UPDATE`
- ✓ MockPaymentProvider always returns `{ ok: false }` (no fake-success bypass)
- ✓ `תעודת זהות מספר בלבד` rule honored — `kyc.ts:64-72` hashes ID with salt; no `idPhotoUrl` field
- ✓ Unverified providers cannot match (`matching-ws.ts:45` requires `verification_status='verified'`)

### §6.2 Remaining findings

| # | Severity | File:Line | Real risk? | Recommended fix | PR size | Rollback |
|---|---|---|---|---|---|---|
| **M-1** | **P0 FINANCE** | `shared/schema.ts:7896-7944` (Stripe legacy fields) + missing `provider_finance_profiles` | YES — same as J-1; addressed by PR #312 (CEO-approved) | PR-PFP-1 through PR-PFP-11 | XL | Per-PR revert |
| **M-2** | P1 HARDCODED | `server/routes/admin-escrow-reconciliation.ts:375` | YES if commission rate ever changes — admin escrow reconciliation drifts silently | ✓ FIXED in PR #311 — imports canonical `PETWASH_COMMISSION_RATE` from shared/schema.ts | XS | `git revert` |
| **M-3** | P1 SECURITY | `server/routes/walk-payment-flow.ts` (dev webhook simulate endpoint) | UNKNOWN — comment claims "blocked in production" but actual guard not verified | Audit the route; confirm 403 returned in prod | XS (~30 min audit) | Add explicit prod guard if missing |
| **M-4** | P1 EMAIL DELIVERABILITY | Multiple transactional emails | YES — emoji prefixes in subjects reduce deliverability | ✓ PARTIAL FIX in PR #311 — Tax Report, Nayax Daily, Station alerts cleaned. Welcome / voucher / booking-confirmation emails in `server/emailService.ts` still have emojis. | S (~1h) | Per-file revert |
| **M-5** | P2 HARDCODED | `server/services/BookingLifecycleService.ts:25-29` PLATFORM_ADDON_PRICING | LOW — platform-wide constants are acceptable; only matters if franchises need flexibility | Move to config table if dynamic per-franchise pricing needed | M | Single-file revert |
| **M-6** | P2 HARDCODED | `server/services/loyalty.ts:32-39` tier discounts | LOW — constants acceptable; tied to schema | Leave unless tier changes need to be configurable | N/A | N/A |
| **M-7** | P2 INCOMPLETE | `server/services/TranzilaPaymentRequestService.ts:23-27` | LOW — TODO stub for `_callTranzilaCreatePaymentRequest()`. Tranzila is being deprecated for SUMIT anyway. | Skip; will be replaced entirely by SUMIT integration | N/A | N/A |
| **M-8** | P3 BRAND | Legal docs, code comments (various) | DEV CLUTTER — "Pet Wash" (with space) vs "PetWash™" inconsistency | Bulk replace in legal docs; preserve "Pet Wash Ltd" / "פט וואש בע״מ" only as legal entity strings | M | Per-file revert |

---

## §7 — Consolidated severity ranking

Applying CEO's filters (*real prod risk vs dev clutter*):

### §7.1 P0 — real prod risk, immediate action

| ID | Title | Status | Owner |
|---|---|---|---|
| A-1 | `/api/octopus-brain` unauthenticated 9 endpoints | ✓ FIXED (PR #308 merged) | — |
| A-2 / J-2 | 3 broken `/join/*` provider forms | ✓ FIXED (PR #309 merged) | — |
| A-3 | Page-level `getRedirectResult` race | OPEN | PR-AUTH-6 (deferred per CEO directive — gradual consolidation) |
| J-1 / M-1 | No `provider_finance_profile` → cannot pay providers | OPEN (CEO-approved plan in PR #312) | PR-PFP-1 through PR-PFP-5 (MVP path approved) |
| S-1 | `SUPER_ADMIN_EMAILS` placeholder/missing | CEO ACTION (version 252 set; needs verify) | CEO |
| S-2 | `SENDGRID_TEMPLATE_ID_MEMBER_PASS` placeholder | CEO ACTION | CEO |
| S-3 | `RECAPTCHA_SECRET_KEY` hardcoded SITE key in CI | CEO ACTION | CEO |
| S-4 | `TWILIO_AUTH_TOKEN` may be missing | CEO ACTION | CEO |

### §7.2 P1 — real risk, next sprint

| ID | Title | PR size |
|---|---|---|
| A-4 | Consolidate remaining 4 OAuth entry points | L (PR-AUTH-6) |
| A-5 | Consolidate 4 iOS detection variants | S (PR-AUTH-5) |
| A-7 | Disambiguate Google Sign-In Failed toast | S (PR-AUTH-2) |
| A-8 | Server-startup secret validation | S (PR-AUTH-3) |
| J-3 | Hebrew BiDi marks on brand mark | XS |
| J-4 | `dir="ltr"` lock on phone field group | XS |
| R-1 to R-6 | Refactor 7 Replit-Connector-dependent services | M each (~3 days total) |
| S-5, S-6 | `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_TURNSTILE_SITE_KEY` in CI | XS each |
| M-3 | Verify `walk-payment-flow` prod guard | XS |
| M-4 | Strip emojis from remaining transactional emails | S |
| F-1 | Centralize Firebase config env reading | S |

### §7.3 P2-P3 — dev clutter, deferrable

A-9, A-10, A-11, A-12, A-13, J-5, R-7, R-8, R-9, R-10, S-7 to S-12, F-2 to F-5, M-5 to M-8.

---

## §8 — Recommended PR sequence (CEO approval gated)

**No PR opens without CEO sign-off** per the directive. Proposed sprint sequence below — CEO confirms which to ship per sprint.

### Sprint 1 (1 week) — CEO actions + finance foundation
- CEO: verify S-1, S-2, S-3, S-4 in GCP Secret Manager + GitHub Actions
- PR-PFP-1 through PR-PFP-5 (provider finance MVP — already CEO-approved on PR #312)
- PR-AUTH-3 (server-startup secret validation, ~30 min)

### Sprint 2 (1 week) — auth consolidation
- PR-AUTH-2 (disambiguate Google Sign-In Failed toast)
- PR-AUTH-5 (consolidate iOS detection to single helper)
- PR-AUTH-6 (consolidate remaining 4 OAuth entry points)
- J-3 + J-4 (Hebrew BiDi marks + phone field LTR lock)

### Sprint 3 (1 week) — Replit runtime de-risk
- Refactor R-1 through R-6 one at a time, MEDIUM risk each, ~3 days total
- PR-PFP-6 through PR-PFP-8 (SUMIT typed client + webhook + sub-business creation) — depends on SUMIT support response

### Sprint 4+ — finance production + cleanup
- PR-PFP-9 (payout gating, HIGH risk, CPA review required)
- PR-PFP-10 (backfill script)
- PR-PFP-11 (decommission Stripe legacy fields)
- A-6 (brain dashboard wire 12 missing modules — multi-sprint)
- P2/P3 cleanup items in batch PRs

---

## §9 — Decisions awaiting CEO

| ID | Question | Recommendation |
|---|---|---|
| **D-1** | Sprint 1 start: ship PR-PFP-1 (schema migration) tomorrow? | YES — already approved on PR #312; sets foundation |
| **D-2** | Refactor Replit Connector services (R-1 to R-6) one at a time, or batch into 1 large PR? | One at a time — same-file revert is the safer pattern |
| **D-3** | A-6 (brain dashboard 12 missing module panels) — phase as multi-sprint or defer until SUMIT integration ships? | Defer until SUMIT MVP lands; finance visibility is higher value |
| **D-4** | M-4 (strip emojis from welcome/voucher/booking-confirmation emails) — bundle into one PR or per-file? | Single PR per CEO §0 doctrine batch |
| **D-5** | F-3 (CSP nonce migration) — undertake at all or defer indefinitely? | Defer — Firebase SDK requirement makes this expensive |
| **D-6** | S-D (move `SUPER_ADMIN_EMAILS` out of `.replit` plaintext) — small fix, low value? | Recommend yes; XS effort, removes a target list from public repo history |

---

## §10 — What this PR does NOT do

- No code change (audit only)
- No schema migration
- No new dependency
- No CI workflow change
- No payment / wallet / Tranzila / Summit-integration / Nayax / K9000 touch
- No production secret read or write
- No outbound email to SUMIT (the email in `SUMIT_CAPABILITIES_AUDIT.md` §3 still awaits CEO send)
- No PR opened beyond this doc

---

## §11 — Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ One canonical infrastructure reference replaces 6 scattered audit docs |
| Cheaper? | ✓✓ Severity-ranked findings prevent over-investment in dev clutter |
| Faster? | ✓✓ Sprint sequence in §8 gives a concrete 4-sprint path to clean codebase |
| Easier? | ✓✓ CEO can scan §7 (consolidated severity ranking) in 60 seconds and direct work |
| Luxurious? | ✓✓ Premium = decisions made on evidence, not panic. §7.3 dev-clutter list explicitly de-prioritised. |

**Honest miss:** This doc summarises 6 prior audits and adds severity + rollback columns. **It does NOT replace those audits** — implementation PRs should reference the original audit doc for full file:line refs. This is the index, not the encyclopedia.

---

## §12 — References

All audit docs (read in order of arrival):

| Date | Audit | PR |
|---|---|---|
| 2026-05-16 | `MOBILE_FIRST_2026_REBUILD_AUDIT.md` | (merged) |
| 2026-05-16 | `AI_QA_WATCHTOWER_PROPOSAL.md` + 3 follow-up docs | (merged) |
| 2026-05-16 | `CI_CD_CONCURRENCY_AUDIT.md` | (merged) |
| 2026-05-16 | `FRANCHISE_REBUILD_AUDIT.md` | (merged) |
| 2026-05-16 | `TRANZILA_DEPRECATION_AUDIT.md` | (merged) |
| 2026-05-16 | `SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` | (merged) |
| 2026-05-16 | `PATH_D_CUSTOMER_ENRICHMENT_AUDIT.md` | #295 (merged) |
| 2026-05-16 | `PATH_E_PROVIDER_REBUILD_AUDIT.md` | #296 (merged) |
| 2026-05-16 | `GOOGLE_PLACES_AUTOCOMPLETE_AUDIT.md` | (merged) |
| 2026-05-16 | `PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` | #297 (merged) |
| 2026-05-16 | `INTENT_ARCHITECTURE_AUDIT.md` | #300 (merged) |
| 2026-05-16 | `SUMIT_CAPABILITIES_AUDIT.md` | #301 (merged) |
| 2026-05-17 | `AUTH_STACK_FORENSIC_AUDIT.md` | #304 (merged) |
| 2026-05-17 | `CODEBASE_CLEANUP_AUDIT.md` | #307 (merged) |
| 2026-05-17 | `PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT.md` | #312 (merged, CEO-approved) |

Doctrine: `.claude/skills/petwash-platform/SKILL.md` §0 (brand), §1 (module map), §2 (protected systems), §3 (AI advisory rule).

---

**End of merged audit.** No PR opens without CEO sign-off per §8 sprint plan.
