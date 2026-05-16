# Auth Stack — End-to-End Forensic Audit

**Status:** Audit + ranked fix list. **No code change in this PR.**
**Trigger:** CEO escalation 2026-05-17 — admin login at `/admin/login-v2` shows "Google Sign-In Failed" toast on iPhone Safari after OAuth completes. CEO quote: *"It's layers and layers of sign in sign up gmail etc. There is smoke one or more preventing. Go from the end to the start and find the mistakes — big or faults. Sometimes it's the tiny things causing issues hidden."*
**Companions:**
- `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` (Phase A–D plan)
- `docs/INTENT_ARCHITECTURE_AUDIT.md` (6-way fork rebuild)
- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` (Path A)
- `docs/GOOGLE_PLACES_AUTOCOMPLETE_AUDIT.md`
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0.

---

## §0 TL;DR

CEO's suspicion is **correct**: the auth stack has **7 independent OAuth entry points**, **inconsistent iOS detection** in 4 different forms across the codebase, and a known **race condition** where `getRedirectResult()` is consumed by the global `AuthProvider` before page-specific handlers can use it. On iPhone Safari this combines with Safari ITP (Intelligent Tracking Prevention) to silently fail admin login.

**Two most-likely culprits behind the "Google Sign-In Failed" toast CEO sees:**

1. **`SUPER_ADMIN_EMAILS` env var not set / placeholder in production** → all OAuth completes successfully, but `/api/session/whoami` returns `isSuperAdmin: false`, `assertAdminAccess()` throws `ACCESS_DENIED`, generic toast fires. **CEO needs to verify the GCP Secret Manager value contains `nir.h@petwash.co.il` (case-sensitive, no trailing whitespace).**

2. **Firebase `authDomain` still `signinpetwash.firebaseapp.com` in some builds** → Safari ITP blocks 3rd-party storage for that domain → `getRedirectResult()` returns null after successful Google OAuth → race condition with global `AuthProvider` → silent failure. Production should use `petwash.co.il` (server-injected; needs verification).

**Stack is repairable.** Top 10 fixes ranked P0/P1/P2 in §7. Most are additive consolidation, no protected systems touched. Estimate ~1 week to ship the P0+P1 set as a single Phase B sub-track.

---

## §1 The error surface — where the toast comes from

`client/src/pages/admin/AdminLoginV2.tsx:104-110` is the toast firing site:

```
toast({
  title: "Google Sign-In Failed",
  description: isAccessDenied
    ? "This account does not have admin privileges."
    : "Google sign-in failed. Please try again.",
  variant: "destructive",
});
```

This toast catches **FOUR distinct failure modes**, all indistinguishable from the user's perspective:

| # | Failure | Caught at | Discriminator |
|---|---|---|---|
| 1 | OAuth never completed (Safari ITP, popup blocked, redirect lost) | `onAuthStateChanged` never fires with a user | No state change observable; user is just stuck on login |
| 2 | OAuth succeeded but `createServerSession()` throws `SESSION_CREATION_FAILED` | `AdminLoginV2.tsx:53` | `/api/auth/session` returned non-200 (token expired, email not verified, reCAPTCHA failed) |
| 3 | Session created but `assertAdminAccess()` throws `SESSION_VERIFICATION_FAILED` | `AdminLoginV2.tsx:60` | `/api/session/whoami` returned non-200 (cookie not propagating from iPhone Safari ITP) |
| 4 | Whoami succeeded but `whoami.isSuperAdmin && isAdminRole(whoami.role)` both false → `ACCESS_DENIED` | `AdminLoginV2.tsx:64` | `SUPER_ADMIN_EMAILS` empty/placeholder OR user has no admin custom claim |

**Without runtime instrumentation, these four modes are indistinguishable.** Fix-bias: assume #1 or #4 first (they're the most common); use the diagnostic in §8.

---

## §2 Seven OAuth entry points — the duplication

| # | File:Line | iOS detection | OAuth method | Comment |
|---|---|---|---|---|
| 1 | `AdminLoginV2.tsx:278` | `isMobileBrowser()` (regex only) | popup OR redirect | Admin |
| 2 | `lib/auth-guardian-2025.ts:180` | `isIOS()` | popup OR redirect | JoinAs* pages |
| 3 | `auth/client.ts:57` | **none — popup ONLY** | popup only | **No iOS fallback — broken on iPhone Safari** |
| 4 | `components/GmailOAuthButton.tsx:82` | `isIPhone()` (excludes iPad) | popup OR redirect | Gmail-scope flow only |
| 5 | `SignIn.tsx:1020` | inline check | popup OR redirect | Customer signup |
| 6 | `SignUp.tsx:238` | inline check | popup OR redirect | Customer signup |
| 7 | `PrivilegeSignup.tsx` | inline check | popup OR redirect | Loyalty signup |

**Four different iOS-detection functions** across these sites:
- `isMobileBrowser()` (`AdminLoginV2.tsx:28`) — `/iPhone|iPad|iPod|Android/i` regex — **too broad** (Android Chrome handles popup fine)
- `isIOS()` (`iosAuthHandler.ts:45`) — includes MacIntel + maxTouchPoints>1 (catches iPad-as-Mac) — **correct**
- `isIOSSafari()` (`iosAuthHandler.ts:24`) — defined but unused
- `isIPhone()` (`iosAuthHandler.ts:55`) — excludes iPad — **inconsistent**

**Result:** a user on iPad could get popup in one flow and redirect in another, leading to state loss.

---

## §3 Layer diagram — tap "Continue with Google" → admin dashboard

```
CLIENT
─────
AdminLoginV2.tsx:407 (button tap)
    ↓
handleGoogleLogin() [line 278]
    ├─ isMobileBrowser() [iPhone? Android? iPad?]
    ├─ YES → signInWithRedirect() [line 293]
    │         + set localStorage 'pw_admin_google_redirect_pending=1'
    │         [page unloads → Google → returns]
    │         useEffect at line 67 re-runs
    │           ↓
    │         AuthProvider.tsx:211 consumes getRedirectResult() FIRST (global)
    │           ↓ ↓ ↓ RACE CONDITION ↓ ↓ ↓
    │         AdminLoginV2 useEffect:91 subscribes onAuthStateChanged
    │         → fires when AuthProvider sets user
    │         → if listener fires before Firebase state propagates → null user → silent fail
    │
    └─ NO  → signInWithPopup() [line 299]
              + inline result
    ↓
createServerSession(idToken) [line 45]
    └─ POST /api/auth/session  → server/routes.ts:1018
         ├─ verifyIdToken
         ├─ email_verified check for privileged roles
         ├─ createSessionCookie → Set-Cookie pw_session
         │    domain=.petwash.co.il, sameSite=none, secure, httpOnly,
         │    maxAge=432000000ms (5d)
         └─ 200 { ok, cookie, expiresInMs }
    ↓
assertAdminAccess() [line 57]
    └─ GET /api/session/whoami  → server/routes.ts:2126
         ├─ Read req.cookies.pw_session OR Bearer
         ├─ verifySessionCookie / verifyIdToken
         ├─ fbAdminAuth.getUser(uid) → customClaims.role
         ├─ checkSuperAdmin(email) ← SUPER_ADMIN_EMAILS env var
         │    └─ if empty/placeholder → isSuperAdmin: false (gate CLOSED)
         ├─ role resolution: public | pet_parent | provider | staff | admin | …
         ├─ session age check: 14400s (4h) for admins → 401 if expired
         └─ 200 { authenticated, role, isSuperAdmin, dashboardsAllowed, … }
    ↓
isAdminRole(whoami.role) ? setLocation('/admin/dashboard') : throw ACCESS_DENIED
```

---

## §4 iPhone Safari-specific failure modes

| Hot spot | File:Line | Risk |
|---|---|---|
| `isMobileBrowser()` regex-only detection | `AdminLoginV2.tsx:28` | Treats Android Chrome as "needs redirect" — incorrect. Inconsistent with `isIOS()` used elsewhere. |
| Firebase `authDomain` fallback unguarded | `firebase.ts:43` | `import.meta.env.VITE_FIREBASE_AUTH_DOMAIN \|\| 'signinpetwash.firebaseapp.com'` — if VITE var unset in dev OR prod, falls back to the **Safari-ITP-blocked domain**. |
| `getRedirectResult()` consumed twice | `AuthProvider.tsx:211` + `SignIn.tsx:561` | Firebase clears result after first read. Second read returns null. `AdminLoginV2` uses `onAuthStateChanged` workaround, but introduces race. |
| Session cookie SameSite=none + Secure | `sessionCookies.ts:16` | Correct for cross-site OAuth, but cookie domain hardcoded `.petwash.co.il` — won't work on staging/preview URLs. |
| `localStorage` flag for redirect resume | `AdminLoginV2.tsx:83-84` | Safari can clear localStorage on cross-site redirects under ITP heuristics. If flag is gone after return, the entire useEffect short-circuits silently. |

**ITP root-cause chain** (most likely on iPhone Safari):
1. WebKit classifies `signinpetwash.firebaseapp.com` as a tracking domain
2. After `signInWithRedirect()`, Firebase stores result in IndexedDB on that domain
3. On return to `petwash.co.il`, Safari blocks the cross-origin IndexedDB read
4. `getRedirectResult()` returns null (storage is inaccessible)
5. AuthProvider sees no user → CEO sees "Google Sign-In Failed"

**Mitigation in place:** `firebase.ts:41-43` overrides `authDomain` to `petwash.co.il` in production. But **needs runtime verification** — view source on production, look for `authDomain: "petwash.co.il"`. If you see `signinpetwash.firebaseapp.com`, the override didn't apply for this build.

---

## §5 Phone OTP failure mode (Hebrew provider onboarding)

CEO screenshot at 18:22 shows Hebrew provider onboarding with: **"שירות האימות אינו זמין כרגע. אנא נסה שוב."** (Verification service unavailable. Please try again.)

**Endpoint:** `POST /api/provider/phone/send-otp` (`server/routes/provider-phone.ts:48`)

**Dependencies:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

All read from `cloudrun-service.yaml:57-71` env vars sourced from GCP Secret Manager.

**Failure path:**
- Endpoint returns 503 → client surfaces "Verification service is temporarily unavailable. Please try again."
- `ProviderOnboarding.tsx:255` produces that string when status === 503 OR message contains "starting up"

**Most-likely causes (ranked):**
1. **One or more Twilio secrets is missing/empty in GCP Secret Manager** → Twilio client throws → server returns 503
2. **Twilio account suspended** (billing, daily SMS quota exceeded, sender number expired)
3. **Phone number format rejected** — Israeli number with country code `+972` is valid; flag emoji prefix was stripped in PR #298 so format should be clean now

**Diagnostic CEO can run:**
- GCP Logs Explorer → Cloud Run service → search `Twilio` or `SMS_FAILED`
- Twilio console → check sender number status + recent error log

---

## §6 Smoke list — 15 hidden small things

1. **`console.log` shipped to production** — `auth/client.ts:59`, multiple in `auth/passkey.ts`. Should be `logger.info()`.
2. **Emoji in code** — `auth/client.ts:59` has `🪟` in log message. Not user-visible but log-cluttering.
3. **Deprecated handlers warn but stay callable** — `auth/client.ts:67 handleRedirectResult()`, `iosAuthHandler.ts:112 handleAuthRedirect()`. Callers might still invoke.
4. **4 separate iOS detection functions** — none consistent (see §2).
5. **Firebase auth domain fallback unguarded** — `firebase.ts:43` (see §4).
6. **SUPER_ADMIN_EMAILS not validated at startup** — `rbac.ts:17-32` logs error but doesn't halt boot. Server starts with gate CLOSED → all admins silently fail.
7. **`getRedirectResult()` race condition** — see §4.
8. **Phone OTP format validation is weak** — `provider-phone.ts:54` only checks `phone.trim().length < 8`. No country-code format check.
9. **Cookie domain hardcoded `.petwash.co.il`** — `sessionCookies.ts:16`. Staging/preview URLs broken.
10. **Admin session 14400s (4h) hardcoded** — `routes.ts:2206`. No env override; ops can't extend.
11. **MFA "required" but silently allowed** — `routes.ts:2194-2196` returns `mfaRequired: true` but doesn't 403 if `mfaVerified: false`. Client never told.
12. **postLoginCoordinator 30s cache** — `postLoginCoordinator.ts:86`. Could serve stale intent if role changed server-side.
13. **DEV mode bypasses auth entirely** — `AuthProvider.tsx:152-176`. If `import.meta.env.DEV` true in a production build (misconfig), entire auth bypassed.
14. **Inconsistent emojis in auth toasts** — `AdminLoginV2.tsx:100, 141` (`Welcome back! ✨`), `258` (`Biometric Authentication Successful! 🎉`). Phase A PR #302 already fixes these; pending merge.
15. **Brand string `Pet Wash` (with space) in admin** — `AdminLoginV2.tsx:2, 327, 332, 337`. Phase A PR #302 fixes these too.

---

## §7 Ranked fix list — 10 PRs

### P0 — unblock CEO now

**PR-AUTH-1 — Verify + fix `SUPER_ADMIN_EMAILS` in prod** (CEO action, no code)
- GCP Secret Manager → `SUPER_ADMIN_EMAILS` → confirm value includes `nir.h@petwash.co.il`
- Force Cloud Run revision restart (merge any PR or click "Deploy latest" in Cloud Run console) so the running container reads the new secret value
- Diagnostic: `https://petwash.co.il/api/session/whoami` after a failed login; check `isSuperAdmin` field

**PR-AUTH-2 — Disambiguate the failure toast** (~30 min repo change)
- `AdminLoginV2.tsx:104-110` — split the generic toast into 4 distinct messages per failure mode (popup blocked / session creation failed / cookie not propagating / role not admin)
- Adds a small admin debug overlay (gated to localhost or `?debug=1`) printing the exact failing step
- Risk: LOW

**PR-AUTH-3 — Validate `SUPER_ADMIN_EMAILS` at server startup** (~30 min)
- `server/index.ts` or `rbac.ts` — refuse to boot if `SUPER_ADMIN_EMAILS` empty or contains placeholder text
- Logs CRITICAL + exits non-zero
- Risk: LOW (operational improvement; failing-closed at boot is safer than silently failing at request time)

### P1 — fix next sprint

**PR-AUTH-4 — Consolidate to ONE OAuth entry point** (~1 day)
- `lib/auth-guardian-2025.ts:signInWithGoogle()` becomes the canonical entry
- Delete `auth/client.ts:loginWithGoogle()` (no iOS fallback)
- Delete `iosAuthHandler.ts:signInWithBestMethod()` (deprecated)
- Update `AdminLoginV2`, `SignIn`, `SignUp`, `PrivilegeSignup`, `JoinAs*` to call the canonical hook
- Risk: MEDIUM (touches every signin entry; needs staging soak)

**PR-AUTH-5 — Consolidate iOS detection to ONE function** (~30 min)
- Canonical `isIOS()` in `lib/iosAuthHandler.ts:45` (covers iPad-as-Mac)
- Delete `isMobileBrowser()`, `isIPhone()`, unused `isIOSSafari()`
- Risk: LOW

**PR-AUTH-6 — Eliminate the `getRedirectResult` race** (~half day)
- AuthProvider keeps the single global consumer
- AdminLoginV2 + SignIn observe `onAuthStateChanged` only — never call `getRedirectResult` directly
- Document the contract inline
- Risk: MEDIUM (touches the redirect-completion path; iPhone Safari soak required)

**PR-AUTH-7 — Verify + harden Firebase `authDomain` for production**
- Confirm `petwash.co.il` is in the actual built bundle (view source)
- Add a CI assertion that the production build does NOT contain `signinpetwash.firebaseapp.com` as authDomain
- Risk: LOW

**PR-AUTH-8 — Verify Twilio secrets + add startup validation**
- Confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` are present in GCP Secret Manager
- `server/index.ts` validates Twilio client can authenticate on boot
- Logs WARNING (not CRITICAL) if missing — phone OTP is degradable
- Risk: LOW

### P2 — cleanup later

**PR-AUTH-9 — Replace `console.log` with structured `logger.info` in auth modules** (~30 min)
- `auth/client.ts`, `auth/passkey.ts`, `iosAuthHandler.ts`, `auth-guardian-2025.ts`
- Risk: LOW

**PR-AUTH-10 — Add e2e iPhone Safari test for admin login** (~1 day)
- Playwright on iOS device cloud (BrowserStack or LambdaTest)
- CI-gated on every PR touching `client/src/pages/admin/*` or `client/src/auth/*`
- Risk: LOW

---

## §8 Diagnostic for CEO — confirm which gate is closed

After PR #302 + #303 deploy, on iPhone Safari:

| Step | Action | Expected |
|---|---|---|
| 1 | Open `https://petwash.co.il/admin/login-v2` | Page renders with 4-color Google button (PR #303), no overlays (PR #302), brand-correct title |
| 2 | Sign out if signed in (or use Private window) | — |
| 3 | Tap "Continue with Google" → 2FA → return | — |
| 4 | If you land on `/admin/dashboard` | ✅ done, both bugs gone |
| 5 | If you bounce back to `/admin/login-v2` with red toast | Open new tab → `https://petwash.co.il/api/session/whoami` |
| 6a | `{"authenticated":false}` or 401 | Session cookie didn't propagate. iPhone Safari ITP. Most likely failure mode #3 in §1. Needs PR-AUTH-6. |
| 6b | `{"authenticated":true, "isSuperAdmin":false, "role":"public", "email":"..."}` | Confirms failure mode #4. **SUPER_ADMIN_EMAILS missing your email in GCP Secret Manager.** Run PR-AUTH-1. |
| 6c | `{"authenticated":true, "isSuperAdmin":true, "role":"super_admin"}` BUT login still fails | Race condition between AuthProvider and AdminLoginV2. Failure mode #1. Needs PR-AUTH-6. |

---

## §9 What this PR does NOT do

- No code change (audit-only).
- No schema migration.
- No new dependency.
- No CI workflow change.
- No payment / wallet / Tranzila / Summit / Nayax / K9000 touch.
- No production-secret read or write.
- No outbound API calls.
- No PR-AUTH-1 through PR-AUTH-10 opened (gated on CEO go-ahead and the §8 diagnostic).

---

## §10 Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ One canonical OAuth path beats 7 |
| Cheaper? | ✓✓ Consolidation reduces maintenance debt by ~50% |
| Faster? | ✓✓ iPhone Safari users stop being lost in race conditions |
| Easier? | ✓✓ Single iOS detection, single OAuth call site, single race-condition-free post-OAuth handler |
| Luxurious? | ✓✓ Premium ≠ broken on Apple devices. Apple is the §0 doctrine's reference device. |

**Honest miss:** PR-AUTH-4 (consolidate OAuth) is the highest-impact PR but also the highest blast-radius. It touches every signin/signup entry. **Soak in staging for 48h before stacking other auth PRs on top.**

---

## §11 References

- `client/src/pages/admin/AdminLoginV2.tsx:28, 67-118, 278-320` — admin login + race-condition workaround
- `client/src/auth/AuthProvider.tsx:205-261` — global getRedirectResult consumer
- `client/src/auth/client.ts:57-100` — deprecated alternative auth surface
- `client/src/lib/auth-guardian-2025.ts:180` — canonical OAuth hook (recommended single source)
- `client/src/lib/iosAuthHandler.ts:24-115` — iOS detection (multiple variants)
- `client/src/lib/firebase.ts:41-129` — Firebase init + authDomain
- `client/src/lib/postLoginCoordinator.ts` — post-login routing decider
- `server/routes.ts:1018-1297` — `/api/auth/session`
- `server/routes.ts:2126-2257` — `/api/session/whoami`
- `server/middleware/rbac.ts:12-95` — `isSuperAdmin()` + `SUPER_ADMIN_EMAILS`
- `server/routes/provider-phone.ts:48-95` — phone OTP endpoint
- `cloudrun-service.yaml:57-71, 159-164` — Twilio + SUPER_ADMIN_EMAILS secret bindings
- `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` — Phase A–D parent plan
- `.claude/skills/petwash-platform/SKILL.md` §0 — doctrine

---

**End of audit.** Implementation gated on CEO §8 diagnostic + go-ahead on PR-AUTH-1 through PR-AUTH-10.
