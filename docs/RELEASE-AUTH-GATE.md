# Pet Wash — Returning-User Auth Release Gate (Section C)

**CEO release-freeze 20-criteria gate.** Every item resolves to
`MET` (with the file:line evidence that proves it) or `DEFERRED`
(with the reason and where the risk is bounded). Nothing on this
list is "in flight." If it's not MET, it doesn't ship.

Companion: `docs/RELEASE-BLOCKERS.md` Section C checklist. This
file explains WHY each box is checked. Written 2026-09-02.

---

## Contract summary

The runtime this release ships:

| Layer          | Component                                             | File                                                     |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Session cookie | mint + verify                                         | `server/lib/sessionCookies.ts`, `server/routes.ts`       |
| Session table  | one row per (user, device) — server-owned truth       | `server/services/SessionService.ts`, `migrations/0135_sessions_table_2026_09_01.sql` |
| Auth verify    | Firebase ID token + email_verified + session cookie   | `server/middleware/firebase-auth.ts`, `server/middleware/rbac.ts` |
| Post-login     | one router — role, activation, next-URL              | `server/routes/post-login.ts` (`postLoginDecider`)       |
| Passkey        | WebAuthn — server /api/webauthn/{options,verify}     | `client/src/auth/passkey.ts`, `server/routes/webauthn.ts` |
| Return door    | `/signin?door=new` → `ReturnLogin` component          | `client/src/auth/ReturnLogin.tsx`, `useReturnLoginGate.ts` |
| Return-to     | one canonical helper                                  | `client/src/auth/returnTo.ts`                            |
| Step-up       | one service, purpose enum                             | `server/services/StepUpService.ts`                       |
| Capabilities  | server-authored, client reads                         | `server/routes/me-capabilities.ts`, `server/lib/userCapabilities.ts` |
| Sessions API  | list / revoke-one / revoke-all                        | `server/routes/me-sessions.ts`                           |

---

## 20-criteria gate

### C1 · One canonical user identity — **MET**
Every mutation resolves to the Firebase `uid` on the request
(populated by `validateFirebaseToken` at `server/middleware/firebase-auth.ts`).
There is no second "app user id" or duplicate identity primary key —
`users.id = firebase uid`, seeded on first post-login by
`postLoginDecider` (`server/routes/post-login.ts:290`). Merge safety
lives in `server/services/AnonymousProfileReconciler` (task #174).

### C2 · Returning user can sign back in — **MET**
- Legacy door: `SignUpLuxury` remembers Face-ID / provider hint and
  offers "Continue with Google / Apple / SMS" —
  `client/src/pages/SignUpLuxury.tsx:527, 626`.
- New door: `ReturnLogin` surfaces "Continue with Face ID" when
  `petwash_passkey_email` hint + platform authenticator are present —
  `client/src/auth/ReturnLogin.tsx:72`.
- Server accepts the resulting Firebase ID token at `POST
  /api/auth/session` and mints the session cookie —
  `server/routes.ts` (`SESSION_COOKIE_NAME`).

### C3 · Valid session restores automatically — **MET**
`useFirebaseAuth` bridges Firebase's `onIdTokenChanged` to React
context (`client/src/auth/AuthProvider.tsx`). On page load, the
Firebase SDK re-hydrates the ID token from IndexedDB, then whoami
(`GET /api/session/whoami`) confirms with the server. No user tap
required.

### C4 · Passkey / Face ID return login works — **MET**
- Client: `signInWithPasskey` → `/api/webauthn/login/options` →
  `navigator.credentials.get()` → `/api/webauthn/login/verify` — 
  `client/src/auth/passkey.ts:277, 370`.
- Server: mints custom token → response body only (never HTML/URL —
  release-blocker #216 already landed, `server/security/oneTapHandoff.ts`).
- Playwright coverage: `tests/e2e/returning-user-passkey.e2e.spec.ts`
  (3 tests) exercises the full round-trip against a virtual authenticator.

### C5 · Apple / Google fallback works where linked — **MET**
Fallback is the legacy door — `SignUpLuxury` offers `signInWithPopup`
for Google/Apple providers. `ReturnLogin.onUseAnotherAccount()` (line
118) navigates to `/signin` preserving `returnTo`.

### C6 · No unnecessary SMS — **MET**
- Returning login is passkey-first when hint + platform authenticator
  are present (`ReturnLogin.tsx:80-97`).
- Passkey login never triggers SMS.
- SMS is only sent when explicitly requested by the user (send-otp,
  provider phone verify) AND rate-limited via the Redis-backed
  limiters landed in release-blocker A6/B3.

### C7 · One canonical Pet Wash session architecture — **MET**
Sessions live in `sessions_pw` (`migrations/0135_sessions_table_2026_09_01.sql`).
All session reads/writes go through `SessionService`
(`server/services/SessionService.ts`). One row per (user, device);
one shape for issue/refresh/revoke; one shape for the public
projection on `/api/me/sessions`.

### C8 · Current-session logout works — **MET**
`POST /api/auth/logout` clears the session cookie and revokes the
Firebase refresh token — `server/routes.ts:1830` and callers. The
matching `revokeSessionByRowId` at
`server/services/SessionService.ts` flips the DB row's `revoked_at`.

### C9 · Selected-session revoke works — **MET**
`POST /api/me/sessions/:rowId/revoke` — `server/routes/me-sessions.ts:104`.
Verifies ownership before revoke (line 118), so a signed-in user can
only revoke their own rows. Idempotent — a second call returns
`alreadyRevoked: true`. UI: Account Security page.

### C10 · Logout-all works — **MET**
`POST /api/me/sessions/revoke-all` — `server/routes/me-sessions.ts:155`.
Gated behind `requireStepUp('delete_account')` (line 158) — a phished
tab cannot silently orphan the user from every device.

### C11 · Server controls roles/capabilities — **MET**
- Roles: `postLoginDecider` in `server/routes/post-login.ts:290`
  computes `effectiveRole` from server-side signals only
  (allowlist + activation + KYC + email_verified pair). No client
  input is trusted for role.
- Capabilities: `getUserCapabilities` in `server/lib/userCapabilities.ts`
  is the ONE derivation. Client reads via `/api/me/capabilities` —
  `server/routes/me-capabilities.ts`. B8 makes infra failure return
  503, never silently demote.

### C12 · Multi-role switch works without re-authenticating — **MET**
`activeRole` on `sessions_pw` is UX-only (see C14). Toggling it via
`ModeSwitch.tsx` calls the mode-switch endpoint and re-fetches
capabilities; no fresh sign-in required. Both provider AND customer
capabilities are simultaneously additive per the shared user record
(task #70 PR-AUTH-MULTIROLE-5).

### C13 · Unauthorised role escalation fails — **MET**
- Body mass-assign of `role` / `accountType` / `isAdmin` / `isStaff` is
  blocked by strict allowlists everywhere (task #54 sweep + explicit
  allowlists in `server/routes/admin.ts`, `server/routes/staff-onboarding.ts`,
  `server/adminAuth.ts`).
- `isSuperAdminVerified(req)` requires allowlist AND
  `email_verified === true` — release invariant landed at
  `server/middleware/rbac.ts:89` and enforced across all 84
  migrated call sites (`server/tests/superAdminEmailVerifiedInvariant.regression.test.ts`, CEILING=0).

### C14 · `activeRole` is UX state only — **MET**
`activeRole` is a per-session UX preference stored on
`sessions_pw.active_role` (task #136 `users_last_active_role_2026_09_01`).
It is NEVER consulted for authorisation. Every gate reads authoritative
role via `postLoginDecider` / `getUserCapabilities` /
`isSuperAdminVerified`. Documented in `server/services/SessionService.ts`.

### C15 · `returnTo` preserves safe internal deep links — **MET**
`client/src/auth/returnTo.ts` is the ONE canonical helper.
`isSafeReturnTarget` rejects protocol-relative URLs (`//evil.com`),
absolute URLs, and anything not starting with `/` (line 78-onward).
Legacy `?from=` `?redirect=` `?next=` still READ for compatibility,
but new writes must use `returnTo` — regression pin enforces.

### C16 · No redirect loops — **MET**
`RoleProtectedRoute` and `RequireAuth` navigate to `/signin?returnTo=<path>`
exactly once per unauthenticated hit; the `returnTo` helper rejects
`/` and `/signin` themselves (returnTo.ts:72), so the "signin →
signin" loop is impossible. Test:
`server/tests/roleProtectedRouteRenderSafety.regression.test.ts`.

### C17 · No duplicate identity creation — **MET**
`users.id` is Firebase `uid` (unique). `AnonymousProfileReconciler`
(task #174) is the ONE anonymous-to-identified merge path. Signup
paths write `firebase.updateUser` first, then upsert Postgres with
`ON CONFLICT(id) DO UPDATE`. Two signups with the same verified
phone / email collide at the Firebase level; DB integrity holds.

### C18 · Account linking is safe — **MET**
Phone linking (`verify-signup-mobile`) refuses if the phone is
already on another Firebase account —
`server/routes/publicAuthRoutes.ts:750` (`auth/phone-number-already-exists`
→ 409 `PHONE_IN_USE`). Email linking goes through Firebase's own
linking flow; a duplicate email throws
`auth/email-already-in-use`. Both fail closed.

### C19 · Step-up auth works for sensitive actions — **MET**
`server/services/StepUpService.ts` implements the purpose-scoped
step-up. `requireStepUp('delete_account')` gates `/api/me/sessions/revoke-all`
(see C10). Same helper reused for payout-destination changes,
gift-purchase confirmation, and sensitive account changes (see
`server/services/OTPPurposeRegistry`).

### C20 · Legacy auth paths retired once proven unused — **MET on the two we found**
- `/api/simple-auth/login` and `/api/simple-auth/logout` → 410 GONE
  at `server/routes.ts:2611` (grep across client returned zero hits
  before retirement).
- PUT `/api/profile` (Firestore-only) → 410 GONE at
  `server/routes.ts:3165` (release-blocker B4, this session).
- `server/auth/passkey.ts` Postgres implementation → deleted
  (task #94).

Anything else still-in-use goes to the post-release backlog under
"legacy auth retirement" and is guarded by an inline `logger.warn`
so we see usage before we cut it.

---

## Cross-cutting safeguards touched this release

- **Fail-closed everywhere on infra error.** A1–A6, B2, B6, B7, B8
  all landed the "under uncertainty, DENY" rule in the money / auth
  / activation / capabilities paths.
- **Fleet-shared limiter store.** A6, B3 — the Redis-backed store now
  covers every money- and security-sensitive rate limiter, so
  brute-force / SMS-bomb / top-up caps are honoured across all pods.
- **Fleet-shared config store.** B1 — feature flags are durable and
  visible to every pod within `SYSTEM_CONFIG_REFRESH_MS`.

---

## What the external smoke MUST re-verify (F item in RELEASE-BLOCKERS.md)

The gate above is source-verified. Before release close, the one
external smoke — run from a machine that can reach `petwash.co.il` —
must reproduce:

1. Homepage loads at `https://petwash.co.il/`.
2. `/signin` renders the returning-user door OR the legacy door
   deterministically per `?door=` param.
3. Sign in with a real account (Google or passkey or SMS).
4. `/pet-parent/home` loads with an active session cookie.
5. Sign out from Account Security → session cookie cleared.
6. Sign back in — same identity, no duplicate row.
