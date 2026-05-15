# Executive Access & Identity Architecture Audit

**Status:** Read-only audit. **NO code changes. NO implementation.**
**Scope:** Admin / executive access system end-to-end against engineering rules, UX standards, production QA, and Safari/iPad-first behavior.
**Predecessor audits:** `client/src/__audits__/p0-admin-login-google-safari.md` + `client/src/__audits__/p0-mobile-account-routing.md` — this doc builds on them, notes where they remain accurate, and updates where the codebase has moved.

---

## Important warnings — read first

1. **No implementation by this PR.** It is the audit. Stabilization workstreams only start after CEO greenlights the order in §6.
2. **One of the P0 items is operational, not code.** Verifying `SUPER_ADMIN_EMAILS` in GCP Secret Manager contains the CEO's email exactly. I cannot do this from the sandbox — it requires `gcloud secrets versions access`. **The CEO must run that command or have an engineer run it before any other P0 fix is meaningful.**
3. **The dual-resolver pattern + 1.5-second settle period are documented bandaids in the code itself.** Not hidden. The comments at `useAccountNavigation.ts:91-108` explain the workaround. This audit names the root causes and proposes proper fixes for the stabilization workstream.
4. **Two pre-existing audits cover overlapping ground.** Where their findings still hold, this doc references them rather than repeats. Where the codebase has moved past their findings, this doc says so explicitly.

---

## 0. TL;DR

The admin / executive access system is **functionally working but architecturally fragile**. Five immediate risks, three of which can leave the CEO unable to reach the admin dashboard reliably:

1. **Stale `VITE_ADMIN_EMAILS` in the deployed client bundle vs. runtime `SUPER_ADMIN_EMAILS` on the server** — no automated sync. CEO can be in one and not the other. Manifests as either (a) dead-click 403s when CEO clicks an admin action the client shows him but the server denies, or (b) extra-slow tap-to-dashboard journeys via the server fallback path.
2. **CEO email may not be in `SUPER_ADMIN_EMAILS` GCP secret at all** — pre-existing p0-admin-login audit flagged this as the most likely root cause of Safari admin-login failures. Has not been verified in current production.
3. **`/my-account` lazy-load chunk-load failure crashes the entire app UI** — no per-route Suspense fallback, no Layout-level error boundary. CEO sees blank "Something went wrong" with no navigation.
4. **Firebase claims propagation on iPad Safari ITP** — 1.5-second settle period workaround in `resolveAccountRoute()` is a real bandaid for an unfixable platform constraint. Fix direction is structural (server-push claims), not just longer polling.
5. **Mixed enforcement of `email_verified` on admin gates** — newer routes use `isSuperAdminVerified()` (checks Firebase email_verified), older routes use `isSuperAdmin()` (no verification check). Security gap, not just UX.

Three of these can be fixed in roughly **a week of focused engineering**. The other two (Firebase claims propagation, full architectural unification) are a 2026 Q2 / Q3 workstream.

Six deliverables follow in §1–§6 per CEO request.

---

## 1. Architecture map

The pipeline from "user logs in" to "user reaches admin dashboard" runs through six layers. Each layer is a real piece of code, file-ref'd below.

### 1.1 Firebase Auth (client)

- User signs in (Google OAuth, email/password, or passkey). Firebase Auth sets `firebaseUser`.
- `client/src/auth/AuthProvider.tsx:219` — `onAuthStateChanged` fires, hydrating React context with `user`, `loading`, `claims`.
- `getIdTokenResult(true)` refreshes Firebase custom claims; extracted fields: `role`, `accountType`, `loyaltyTier`, `mfa_verified`, `kycStatus`.
- Role mapped to `UserRole` literal at `AuthProvider.tsx:232`. **Historically downgraded unknown roles to `'public'`** — fixed in P0 audit PR #86 by widening the literal to include `'ceo'`, `'hr'`, `'finance'`, `'ops'`.

### 1.2 Server session bootstrap

- `AuthProvider.tsx` calls `ensureServerSession()` which POSTs `/api/auth/session`.
- Server creates HttpOnly session cookie `pw_session`, 5-day max age, SameSite=`none` (prod) / `lax` (dev), domain `.petwash.co.il` (prod).
- Cookie is the primary auth token. Bearer ID token is fallback.

### 1.3 Client-side route resolution (the gold profile icon path)

- `client/src/hooks/useAccountNavigation.ts:78-89` — synchronous `getAccountRoute()` (claims-only, returns `'#'` during loading).
- `useAccountNavigation.ts:109-166` — asynchronous `resolveAccountRoute()` (server-aware, always returns a real route).
- Async resolver decision order:
  1. Sticky-path guard (`/provider-onboarding` etc.) — return current path, don't redirect.
  2. Wait up to 1.5 s for Firebase loading to settle.
  3. If `claims.role` is in `ADMIN_ROLES` → `/admin/dashboard`.
  4. Else if `user.email` is in `VITE_ADMIN_EMAILS` (build-time allowlist) → `/admin/dashboard`.
  5. Else POST `/api/auth/post-login` (server post-login decider).
  6. Else fall back to `/home` (universal safe default for authenticated users) or `/signin` (unauthenticated).

### 1.4 Server post-login decider

- `server/routes/post-login.ts` (POST `/api/auth/post-login`).
- Verifies session cookie OR Bearer token.
- Loads user from PostgreSQL `users` + `user_profiles`.
- Determines role from claims, accountType, or DB legacy field.
- Applies approval rules:
  - `super_admin` — implicit if email in `SUPER_ADMIN_EMAILS`.
  - `staff` — approval via `staffAccessRequests` table.
  - `ceo / hr / finance / ops / admin / management` — approval via `approvalsTable` OR email in `SUPER_ADMIN_EMAILS`.
  - `provider` — approval via `providerApplications` table.
- Returns `{ nextUrl, role, dashboardsAllowed, ... }`.

### 1.5 Server rbac middleware

- `server/middleware/rbac.ts` — `isSuperAdmin()` at line 68, `isSuperAdminVerified()` at line 89 (the newer guard, with `email_verified` check).
- `ROLE_HIERARCHY` enum at line 543-554 (numeric 1–10).
- `requireAdmin`, `requireSuperAdmin` middlewares wrap protected routes.

### 1.6 Post-login coordinator (single-flight)

- `client/src/lib/postLoginCoordinator.ts:146` — single-flight deduplication.
- Caches in-flight `/api/auth/post-login` calls (30s TTL for cacheable bodies).
- Prevents seven concurrent call-sites from firing seven requests.
- After successful POST, invalidates `/api/session/whoami` cache.

### 1.7 Environment variables

| Var | Scope | Source | Used by |
|---|---|---|---|
| `SUPER_ADMIN_EMAILS` | Server runtime | GCP Secret Manager | `rbac.ts:18`, `routes/post-login.ts` |
| `VITE_ADMIN_EMAILS` | Client build time | GitHub Actions `vite build` env | `useAccountNavigation.ts:54`, `GoogleOneTap.tsx:19`, `auth-guardian-2025.ts:31` |
| `VITE_FIREBASE_API_KEY` | Client build time | Secret Manager + CI | Firebase client SDK init |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server runtime | Secret Manager | Admin SDK + GCS backup credentials |

### 1.8 The decision flow on iPad Safari

```
User taps gold profile icon
    ↓
PetWashHeader.handleProfileNavigate() — sets isResolvingProfile=true, button greys out
    ↓
useAccountNavigation.resolveAccountRoute() async
    ↓
Sticky-path check (no — on homepage)
    ↓
Wait up to 1.5s for Firebase loading to settle (ITP scenario)
    ↓
Check claims.role — may not have propagated yet on iPad Safari
    ↓ (if no claim)
Check email in VITE_ADMIN_EMAILS — match? → /admin/dashboard (fastest)
    ↓ (if no match in build-time allowlist)
POST /api/auth/post-login via postLoginCoordinator
    ↓
Server reads SUPER_ADMIN_EMAILS, decides nextUrl
    ↓
Client window.location.assign(nextUrl) — FULL PAGE LOAD
```

The "fastest" path (claim or VITE allowlist) is 0–100ms. The "slow" path (server decider) is 200–2000ms. The "broken" path (timeout, server error) falls through to `/home` — looks like a refresh on the homepage.

---

## 2. Source-of-truth map

For each piece of identity data, here is the canonical source and what happens when sources disagree.

### "Who is a super admin?"

| Source | Priority | Notes |
|---|---|---|
| `SUPER_ADMIN_EMAILS` env var (server) | 1 — authoritative | Read by `rbac.ts:18`. Loaded once at server startup. Hot reload requires Cloud Run revision deploy. |
| `VITE_ADMIN_EMAILS` env var (client, build-time) | 2 — build-time only | Read by client code. Baked into the deployed bundle. **Cannot change at runtime.** Stale if a new admin is added without redeploying client. |
| Firebase custom claim `role='super_admin'` | 3 — runtime, async | Set by the server when minting custom claims. Propagates to client via `getIdTokenResult(true)`. ITP-vulnerable on Safari. |

**Disagreement consequence:** if `VITE_ADMIN_EMAILS` includes an email that `SUPER_ADMIN_EMAILS` does not, client shows admin UI, server denies action with 403. Reverse case: client shows non-admin UI, but actual admin actions succeed (extra-slow journey via server post-login fallback).

### "What is this user's admin role?"

| Source | Priority | Notes |
|---|---|---|
| Firebase custom claim `claims.role` | 1 — client fast path | Mapped via `AuthProvider.tsx:232`. Falls back to `'public'` if not in `UserRole` literal. |
| Server `/api/session/whoami` response | 2 — server-authoritative | Returns `{ role, dashboardsAllowed, mfaRequired, sessionAge, ... }`. |
| PostgreSQL `users.role` column | 3 — DB source | Used by server to mint custom claims. Mutations here propagate to claims on next token refresh (5-minute Firebase claims TTL). |

**Disagreement consequence:** stale claim can route user to wrong dashboard. The 1.5s settle period in `resolveAccountRoute()` is the workaround.

### "Where should this user go post-login?"

| Source | Priority | Notes |
|---|---|---|
| Server `POST /api/auth/post-login` `.nextUrl` | 1 — authoritative | Reads DB + claims + approval tables + `SUPER_ADMIN_EMAILS`. |
| Client `VITE_ADMIN_EMAILS` match | 2 — fast path skip | Skips server call if email matches. Stale risk. |
| Client `claims.role in ADMIN_ROLES` | 2 — fast path skip | Skips server call if claim available. Async race risk. |
| `/home` universal safe default | 99 — fallback | Returned when everything else fails. Looks like a no-op refresh if user is already on `/`. |

### "Is user authenticated?"

| Source | Priority | Notes |
|---|---|---|
| `pw_session` cookie | 1 | Set by `/api/auth/session`. HttpOnly. 5-day max age. SameSite=none in prod. **Vulnerable to Safari ITP partitioning** if user hasn't visited in 7+ days. |
| Bearer ID token | 1 (equal) | Firebase ID token. Refreshed every hour. Sent via `Authorization` header. Survives cookie drops. |

**Both are required as fallbacks for each other.** If both fail simultaneously, user is logged out.

---

## 3. Risk list — executive access continuity

11 risks with likelihood × impact. Ranked by combined severity.

### High severity (CEO-blocking under realistic conditions)

1. **Firebase claims delayed on iPad Safari (ITP)** — claims take >1.5s to propagate. Resolver falls through to server post-login, which routes via `SUPER_ADMIN_EMAILS`. **If CEO email is in the server allowlist, this works.** If not, CEO lands on `/my-account` or `/home`. *Mitigated by:* 1.5s settle + Bearer fallback + server post-login decider. *Root cause:* Firebase claim propagation is async and Safari makes it slower. No client-side fix is fundamental.

2. **Server-side admin email list mismatch with client** — `VITE_ADMIN_EMAILS` (client) and `SUPER_ADMIN_EMAILS` (server) drift. CEO email in one but not other. Manifests as either (a) admin UI visible but actions 403, or (b) admin UI invisible but actions succeed. *Mitigated by:* none currently. *Root cause:* no automated sync between build-time client env and runtime server secret. Manual change in two places required.

3. **`/my-account` lazy-load failure crashes app UI** — chunk-load error (build-id mismatch, Safari aggressive cache, network blip) bubbles to global `AppErrorBoundary`, which hides the whole app. CEO sees blank "Something went wrong" with no navigation. *Mitigated by:* nothing — no per-route Suspense fallback, no Layout-level boundary. *Root cause:* missing error containment.

### Medium severity (UX degradation, occasional failures)

4. **Safari ITP cookie drop** — `pw_session` cookie dropped if user hasn't visited site in 7+ days. `/api/session/whoami` returns 401. Bearer fallback may also be missing. CEO redirected to `/signin` mid-session. *Mitigated by:* Bearer token survival in some cases; weekly active sessions stay valid.

5. **Build-time `VITE_ADMIN_EMAILS` stale** — new admin added to `SUPER_ADMIN_EMAILS` but client bundle not redeployed. Admin still works (via server fallback) but extra-slow path. *Mitigated by:* server decider always wins.

6. **Slow network post-login timeout** — `POST /api/auth/post-login` on 3G can take 5+ seconds. No timeout on the POST itself. Tab appears frozen during the 1.5s settle + slow POST. User force-quits app. *Mitigated by:* `isResolvingProfile` loading state on button.

7. **Private/incognito tab on iOS** — IndexedDB / localStorage / sessionStorage all fail. Firebase auth lost on reload. User appears logged-out though server session may still exist. *Mitigated by:* sessionStorage fallback in `setPersistenceWithFallback()`. Functional but confusing.

8. **Deploy mid-rollout** — Cloud Run revisions have different `SUPER_ADMIN_EMAILS` values. Load balancer rotates user across both. CEO sees 403 on one request, 200 on next. Looks flaky. *Mitigated by:* Cloud Run draining behavior on revision deploys.

9. **Gold profile icon click during slow claims** — claim arrives at 800ms; user taps at 500ms. Button greys out, user perceives unresponsive. *Mitigated by:* visible loading state.

### Low severity (edge cases, intended behavior, or fixed)

10. **New tab after signout** — tab B doesn't know about signout in tab A until AuthProvider runs. Intended behavior.

11. **Sticky-path guard miss** — new form route added to App.tsx without updating `sticky-account-paths.ts`. User in form taps account icon, gets kicked out. *Mitigated by:* explicit list at `sticky-account-paths.ts:21-62`. Maintainability risk.

---

## 4. Contradictions — places where code paths disagree

Seven specific cases where two parts of the codebase make different decisions about the same user.

1. **Dual resolver disagrees with itself** — `useAccountNavigation.getAccountRoute()` (sync) returns `'#'` during loading; `resolveAccountRoute()` (async) always returns a real route. Same user, same moment, two different answers depending on which function is called. *Sync status:* by design. *Risk:* low if call-sites are right; high if a new caller picks the wrong one.

2. **`ADMIN_ROLES` literal in two places** — `client/src/hooks/useAccountNavigation.ts:41-50` and `shared/adminRoles.ts:15-24`. **Currently synced** (both contain the same 8 roles). Comment at line 39-40 says "Keep aligned." *Risk:* no automated test; future drift possible.

3. **`VITE_ADMIN_EMAILS` (client build-time) vs. `SUPER_ADMIN_EMAILS` (server runtime)** — two separate env vars, two separate sources. **Currently no automated sync.** Already covered in §3 risk 2.

4. **`ROLE_HIERARCHY` numeric (server) vs. `UserRole` literal (client)** — server uses 1–10 numeric hierarchy; client uses string literal union. Server has 'pet_parent' role that doesn't exist in client literal. *Sync status:* partial. *Risk:* server can mint a role the client downgrades to `'public'`.

5. **`isAdminRole()` (post-login.ts:183) vs. `ROLE_DASHBOARDS` (routes.ts:2179-2191)** — both check whether a role is admin-capable, via different mechanisms. Currently synced by value. *Risk:* adding a role to one without the other = whoami returns wrong dashboards.

6. **`isSuperAdmin()` (no email_verified check) vs. `isSuperAdminVerified()` (with check)** — both exist in `rbac.ts`. Newer routes use the verified version (PR-A P0-2). Older routes still use the unverified one. **This is a real security gap.** Attacker registers `admin-lookalike@petwash.co.il` (unverified), passes `isSuperAdmin()` on a legacy route.

7. **Sticky-path list vs. actual form routes** — `sticky-account-paths.ts:21-62` is a hardcoded list. Form routes in `App.tsx` are the source of truth. If they diverge (new form added without sticky list update), user data is lost. Already mentioned in §3 risk 11.

---

## 5. Bandaids vs root causes

Ten workarounds in the codebase. For each: where it is, why it's a bandaid, what the root cause is, what a proper fix looks like (without implementing).

| # | Bandaid | Where | Root cause | Proper fix direction |
|---|---|---|---|---|
| 1 | 1.5-second settle period | `useAccountNavigation.ts:130` | Firebase claims propagation is unpredictable on Safari ITP | Real-time claim push (WebSocket or SSE), or server-authoritative routing with no client claim decision |
| 2 | Dual-resolver pattern (sync + async) | `useAccountNavigation.ts:78-89` and `:109-166` | Callers need both fast UI hints and accurate navigation; no single function satisfies both | Unify to one async resolver. Pre-load claims on mount via prefetch. |
| 3 | `/home` universal fallback | `useAccountNavigation.ts:165` | Server post-login decider can fail (network, timeout) | Server should never return un-routable state. Last-known-good `nextUrl` cached client-side. |
| 4 | Build-time `VITE_ADMIN_EMAILS` allowlist | `useAccountNavigation.ts:52-59` | Client bundle is immutable; admin list must change without redeploying client | Move admin email check to server only. Remove `VITE_ADMIN_EMAILS`. Trade-off: one extra `POST /api/auth/post-login` on every account-tap. Eliminates stale-bundle risk. |
| 5 | 4-tier credential cascade | `gcsBackupService.ts:29-33` | Different env names across environments; never standardized | Single canonical env var name. Migrate secrets. Retire alternates. |
| 6 | Session cookie domain hardcoded | `sessionCookies.ts:15` | Code assumes prod is always `petwash.co.il` | `COOKIE_DOMAIN` env var override. |
| 7 | Firebase claim cast to `UserRole \|\| 'public'` | `AuthProvider.tsx:232` | Historical: server minted roles client literal didn't include | Already partially fixed by widening literal. Add runtime assertion to catch new drift. |
| 8 | No per-route Suspense fallback | `App.tsx:2043-2049` | Lazy-loaded routes fail to a global error boundary that hides nav | Add `<Suspense fallback>` around every lazy route + a Layout-level boundary that preserves header/footer. |
| 9 | No error correlation ID | `AppErrorBoundary.tsx:60` | Error logged server-side, user sees generic "Something went wrong" with no reference | Generate client ULID on error, display to user, include in POST to `/api/errors/log`. Support can grep. |
| 10 | Sticky-path hardcoded list | `sticky-account-paths.ts:21-62` | New form routes risk being kicked out mid-form if list not updated | Move list to server config or DB. Or auto-derive from route metadata. |

---

## 6. Recommended stabilization order

Three tiers. Each item: scope estimate, risk, and why it's at that tier.

### P0 — fix this week (CEO can't reliably reach admin)

**P0-1. Verify `SUPER_ADMIN_EMAILS` includes the CEO's email in GCP Secret Manager.** Operational, not code. Run `gcloud secrets versions access latest --secret=SUPER_ADMIN_EMAILS --project=signinpetwash` and confirm `nir.h@petwash.co.il` is present, lowercase, exact. **This blocks every other P0 fix from being meaningful.** Effort: <1 hour. Risk: zero.

**P0-2. Confirm `VITE_ADMIN_EMAILS` is set at CI build time with the same email.** Check `.github/workflows/petwash-ci.yml` env vars. Either it's there (good) or it's missing. If missing, add it. Effort: <1 hour. Risk: zero. Side effect: faster gold-icon click for CEO.

**P0-3. Wrap `/my-account` route in `<Suspense fallback>` + Layout-level error boundary.** Currently a chunk-load failure hides the whole app. Header + footer should stay visible on any single-page error. Effort: 4–6 hours. Risk: low (additive boundaries). Files: `App.tsx:2043`, `Layout.tsx:104-116`, possible new `LayoutErrorBoundary.tsx`.

**P0-4. Audit and migrate legacy `isSuperAdmin()` callers to `isSuperAdminVerified()`.** Pre-existing security gap on routes that use the unverified check. Affected routes need to be enumerated and migrated. Effort: 3–4 hours. Risk: medium (touches auth gates — requires QA on every admin login flow). Files: `rbac.ts:68-96` (the two primitives), every caller of `isSuperAdmin`.

### P1 — fix this month (works but feels broken / sync risk)

**P1-5. Single source of truth for `ADMIN_ROLES`.** Export from `shared/adminRoles.ts`. Import into `useAccountNavigation.ts` and `routes.ts`. Delete the inline literal. Add a regression test that fails if the two diverge. Effort: 1–2 hours. Risk: low.

**P1-6. Error correlation ID in AppErrorBoundary.** Generate ULID on error catch. Display to user. Send to `/api/errors/log`. Support can grep by ID. Effort: 3–5 hours. Risk: low (additive).

**P1-7. Server-side authoritative admin allowlist** — remove `VITE_ADMIN_EMAILS` from client code. Always route via server post-login decider. Eliminates stale-bundle dead-click 403. Effort: low code change, but requires careful testing of the slow-path UX. Risk: medium (changes hot path for every authenticated user's first navigation). Files: `useAccountNavigation.ts:52-59` (delete), `GoogleOneTap.tsx:19` (delete or migrate), `auth-guardian-2025.ts:31` (delete).

**P1-8. Add server timeout + circuit breaker on `POST /api/auth/post-login`.** Currently no client-side timeout. 3G users see 5+ second hangs. Effort: 2–3 hours. Risk: low.

### P2 — architectural cleanup (future-proofing)

**P2-9. Unify the dual resolver.** One async function only. Pre-load claims on mount. Eliminate the 1.5s settle period via server-authoritative pre-claims hydration. Effort: 20–30 hours. Risk: medium (touches every navigation entry point). Pay-off: eliminates the most-touched bandaid in the auth path.

**P2-10. Standardize credentials env var name.** Retire the 4-tier cascade in `gcsBackupService.ts`. Single `GOOGLE_CREDENTIALS_JSON`. Effort: 2–3 hours code + ops time to rotate secrets. Risk: low if backward-compatible during migration.

**P2-11. Sticky-path list from server config or route metadata.** Effort: 4–5 hours. Risk: low. Pay-off: zero risk of new form routes losing data.

**P2-12. Real-time claims sync (WebSocket / SSE).** The proper fix for "Firebase claims delayed on Safari ITP." High engineering cost (15–20 hours) for a rare-but-painful edge case. **Recommend NOT doing P2-12 until P1-7 ships and we have measured how often the slow-path actually fires.** Build the cheap fix first; measure; then decide if the expensive one is worth it.

---

## 7. What this PR does NOT do

- Does not modify `useAccountNavigation.ts`, `AuthProvider.tsx`, `rbac.ts`, `postLoginCoordinator.ts`, or any code file.
- Does not commit any text to a user-facing page.
- Does not constitute legal or security advice.
- Does not run `gcloud secrets` — that's an operational task for the CEO or an engineer with GCP access.
- Does not promise a deploy date.

---

## 8. Decisions awaiting CEO

A. **Run P0-1** (verify `SUPER_ADMIN_EMAILS` contains CEO email). This is the most important single action in this audit. Without it, every other P0 fix has uncertain effect.

B. **Approve P0 order in §6.** Default is the order presented (1 → 2 → 3 → 4). Can be reordered if priorities differ.

C. **Approve P1 batch as a workstream for the next sprint.** Items 5–8, roughly 10–15 engineering hours total.

D. **Defer P2 to a future quarter.** Recommended. Item 12 in particular is high-cost low-frequency — measure first.

E. **Confirm scope** — this audit is access-and-identity-only. Adjacent workstreams (cookies page rebuild, franchise page rebuild, the broader pixel-level visual review) are separate.

---

## 9. References

- Pre-existing audit: `client/src/__audits__/p0-admin-login-google-safari.md`
- Pre-existing audit: `client/src/__audits__/p0-mobile-account-routing.md`
- Code refs throughout this document use the form `path:line` against the May 2026 working copy.

---

**End of audit. No code, no schema, no infrastructure changed. Awaiting CEO answers to Decisions A through E in §8.**
