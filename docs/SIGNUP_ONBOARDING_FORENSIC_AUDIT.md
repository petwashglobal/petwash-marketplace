# Signup + Onboarding Forensic Audit

**Status:** Read-only forensic audit. No code change in this PR.
**Companion to:** `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` (merged in #279,
strategic 11-phase rebuild plan). This doc is **tactical**: flow traces,
state-loss points, exact line numbers, smallest-safe-repair sequence.
**Mission:** Diagnose why signup feels random, why OTP doesn't lead anywhere
deterministic, why provider/customer/loyalty paths fragment.
**Date stamped:** 2026-05-16.

---

## §0 TL;DR

The CEO observation is **structurally correct.** The signup + onboarding
surface is fragmented across 7 routed entry points, three signup intents
(customer / provider / loyalty), and a post-login decider that has
authority but no enforcement teeth.

**The honest summary in three sentences:**

1. **The "called me user" bug isn't a literal string** — it's a fallback
   display rendered when `firstName` is null. The real bug is **phone-OTP
   signup completes WITHOUT collecting the user's name**, leaving the row
   with `firstName=null` and the UI falling back to "Pet Parent" / email
   prefix.
2. **Intent (customer / provider / loyalty) is captured at signup but not
   persisted** to the `users.signupIntent` column. Cleared from
   localStorage + HttpOnly cookie after first consumption. Returning users
   have no record of what they signed up to do.
3. **The architecture is ~60% real, ~40% patchwork.** Auth layer is
   well-designed; the boundaries (admin role triplication, /home universal
   fallback, generic "Pet Parent" display, 1.5-second Firebase claim
   settle loop) hide real bugs behind cosmetic fallbacks.

**Severity:** Not catastrophic. Customers can complete signup. But the
luxury brand promise (§0 SKILL.md doctrine) is violated every time someone
sees themselves called "Pet Parent" instead of by name.

**Repair scope:** 7 small PRs, each independently revertible, no protected
systems touched, no schema migration required (the `users.signupIntent`
column already exists). See §15.

**Decision the CEO must make:** repair the 7 specific bugs (7 PRs over
~2 weeks) OR proceed with the full Phase 1–11 rebuild per
MOBILE_FIRST_2026_REBUILD_AUDIT.md. The 7-PR path produces a deterministic
signup flow without rewriting the architecture. The full rebuild ships
the deterministic flow as part of a broader cleanup. Both are valid.

---

## §1 Flow map — every entry point traced

For each entry, the exact sequence with file references. Routes prefixed
with `(IP)` are implicit-protection routes (component checks role
internally instead of using `RoleProtectedRoute`).

### §1.1 `/signin` via "Continue with Google"

```
1. SignIn.tsx:156 → performOAuthSignup('google')
2. AuthProvider.tsx:233 → createGoogleProvider() + getAuthStrategy()
3. Firebase OAuth flow (popup or redirect)
4. AuthProvider.tsx:190 → onAuthStateChanged fires
5. AuthProvider.tsx:108 → ensureServerSession() → POST /api/auth/session
6. server/routes.ts:1060 → mint pw_session cookie, sync user to Postgres
7. SignIn.tsx:163 → navigatePostLogin({intent: localStorage.signup_intent})
8. postLoginCoordinator.ts:146 → POST /api/auth/post-login (single-flight)
9. server/routes/post-login.ts:203 → postLoginDecider() resolves nextUrl
10. SignIn.tsx:174 → navigate(nextUrl) OR navigate(?from=) if terminal
```

- **Name capture:** displayName from Google → split into firstName/lastName
  at `server/routes/post-login.ts:365`. ✓
- **Consent:** stamped synchronously at `server/routes.ts:1060` (Google
  OAuth screen counts as terms acceptance). ✓
- **Post-login state:** Firebase claims `{role, accountType}` (async,
  may lag 60s on iPad ITP), Postgres row complete, whoami query cached
  2 min.

### §1.2 `/signin` via Mobile OTP (CEO's tested path)

```
1. SignIn.tsx:113 → setPhoneMode(true)
2. User enters phone → signInWithPhoneNumber(auth, phoneNumber)
3. Firebase sends SMS via Twilio
4. User enters 6-digit code → confirmationResult.confirm(code)
5. Firebase returns user with displayName=null (phone has no name)
6. AuthProvider.tsx:108 → ensureServerSession() → POST /api/auth/session
7. server/routes.ts (DB sync) → Postgres row with firstName=null
8. SignIn.tsx → navigatePostLogin()
9. server/routes/post-login.ts:134 → detects firstName missing
10. Returns { nextUrl: '/complete-profile', reason: 'PROFILE_INCOMPLETE' }
11. Client redirects to /complete-profile (CompleteProfile.tsx:77-212)
12. User fills firstName, lastName → POST /api/auth/complete-profile
13. Server updates row, calls resolvePostLogin() again
14. Final nextUrl returned, client navigates
```

- **Name capture:** ❌ **NOT captured at OTP step.** Deferred to
  `/complete-profile`. If user interrupts (back button, network drop,
  refresh), Postgres row stays with `firstName=null`. Next login
  re-triggers `/complete-profile` loop.
- **Consent:** Deferred. Checkbox on `/complete-profile` (line 159).
- **Display fallback when firstName=null:** `MyAccount.tsx` shows "Pet
  Parent" / "בעל חיית מחמד". `client/src/lib/wallet-pass.ts` falls back
  to `email.split('@')[0]`. **This is what the CEO saw as "called me
  user."**

**This is the primary bug the CEO experienced.** Phone-OTP signup has no
hard gate forcing name collection before issuing a session.

### §1.3 `/signup` via Email + Password

```
1. User fills email, password, firstName, lastName, DOB, terms → submit
2. SignUp.tsx → createUserWithEmailAndPassword(auth, email, password)
3. updateProfile(user, {displayName: "{firstName} {lastName}"})
4. AuthProvider.tsx:108 → ensureServerSession()
5. SignUp.tsx:60-71 → navigatePostLogin({intent: localStorage})
6. server/routes/post-login.ts → resolvePostLogin
7. Routes to /home (customer) OR /provider-onboarding (provider intent)
```

- **Name capture:** ✓ At signup form. Persisted.
- **Consent:** ✓ Explicit checkbox required at SignUp.tsx:122. Form won't
  submit if unchecked.
- **Post-login state:** Complete. No redirect to /complete-profile.

### §1.4 `/signin` via Apple OAuth

Same flow as Google. Two differences:

- Apple lets users **hide email + name** at consent screen.
- If hidden: `displayName=null`, `email=null`. Routes to
  `/complete-profile` to fill manually.

### §1.5 `/signin` via Facebook OAuth

Same as Google. Facebook returns email usually, name sometimes.

### §1.6 `/signin` via Passkey / WebAuthn

```
1. signInWithPasskey() → POST /api/webauthn/authenticate
2. Browser biometric prompt (Face ID / fingerprint)
3. Server verifies assertion → Firebase ID token OR custom JWT
4. Rest identical to Google path
```

- **Name capture:** Passkey carries no name → routes to `/complete-profile`.

### §1.7 `/signin` via Email Magic Link

```
1. User enters email → sendSignInLinkToEmail(auth, email)
2. Email link → AuthAction.tsx (Firebase action handler)
3. signInWithEmailLink(auth, email, link)
4. onAuthStateChanged fires, normal post-login flow
```

- **Name capture:** Magic link carries no name → routes to
  `/complete-profile`.

---

## §2 Where logic splits incorrectly

### §2.1 OTP completion → silent dead-end

**Symptom:** "Got SMS, entered code, then nothing happened that I recognized."

**Root cause:**

1. `confirmationResult.confirm(code)` succeeds.
2. Firebase issues an ID token immediately — user is "signed in" from
   Firebase's perspective.
3. `ensureServerSession()` runs synchronously, mints `pw_session` cookie.
4. `navigatePostLogin()` fires — but on iPad Safari ITP, the post-login
   POST may take 1–3 seconds.
5. **Gap:** Between steps 3 and 5, the user is technically logged in
   but their browser shows the OTP screen or a spinner with no message.
6. If post-login succeeds → redirect to `/complete-profile` happens.
7. If user interrupts before step 6 (back button, refresh, tap something
   else) → stuck on a half-state.

**Why this feels random:** Sometimes the user sees the redirect (fast
network), sometimes they see the spinner (slow network), sometimes they
hit back-button before it resolves.

**Fix:** Make the OTP screen block on `firstName` collection IN THE OTP
flow itself, not as a post-login redirect. See §15 PR-Z1.

### §2.2 Firebase claims vs server whoami priority

**Symptom:** Account button sometimes routes to `/admin/dashboard`,
sometimes to `/home`, sometimes to `/provider-os`.

**Root cause:** `useAccountNavigation.ts:91-133` first tries to read role
from Firebase custom claims (fast, but lags up to 60s on iPad ITP), then
falls back to server `/api/auth/post-login` with Bearer token (authoritative
but slower).

**The 1.5-second settle loop** (`useAccountNavigation.ts:127`) is the
bandaid: wait 1.5s for claims to arrive, then use claims if available, else
hit the server. On iPad Safari with cold ITP state, the settle period
is often not enough, so the server is hit anyway.

**Verdict:** Bandaid works but is expensive (every Account tap waits 1.5s).
Real fix: trust server only, never Firebase claims for routing. See §15
PR-Z6.

### §2.3 Role triplication

`ADMIN_ROLES` is defined three times in the codebase:

| File | Line | Why                                  |
|------|------|--------------------------------------|
| `shared/adminRoles.ts` | 15-24 | Canonical |
| `client/src/auth/AuthProvider.tsx` | 35-46 | Client-side mirror |
| `client/src/hooks/useAccountNavigation.ts` | 41-50 | Inline copy for routing logic |

If `shared/adminRoles.ts` is updated and the mirrors aren't, ceo / hr /
finance / ops users silently downgrade to `'public'` role on the client.
Routing falls back to `/my-account` instead of `/admin/dashboard`.

The comment in `AuthProvider.tsx:30` says "see P0 audit Bug 1" — this is
**known but unfixed.** See §15 PR-Z2.

### §2.4 Provider role escalation race

**Schema state:** `users.role` and `provider_applications.status` can
disagree.

**Scenario:**

1. User signs up as customer (role=`'customer'`).
2. User submits provider application → `provider_applications.status='pending'`.
3. Manager approves → `provider_applications.status='approved'`.
4. **But `users.role` is NOT auto-updated** to `'provider'`.

`postLoginDecider()` at `server/routes/post-login.ts:155-165` detects the
mismatch (`status='approved'` but `role != 'provider'`) and returns
`{ nextUrl: '/home', reason: 'ROLE_SYNC_PENDING' }` — meaning **the user
sees the customer dashboard despite being approved as provider.**

**Why this is silent:** The comment in the code says "let post-login
re-sync on next call." But the server doesn't auto-escalate. The user has
to log out + back in for role to update.

**Fix:** On `provider_applications.status='approved'` UPDATE, immediately
escalate `users.role='provider'` in the same transaction. See §15 PR-Z5.

---

## §3 Where state is lost

### §3.1 Phone OTP → name lost on interrupt

Already covered in §2.1. Between OTP success and `/complete-profile`
submission, name is in nobody's memory. Drop the network or tap back →
row stays `firstName=null`.

### §3.2 `signup_intent` localStorage cleared, no persistence

**Lifecycle:**

1. `/signup?intent=provider` → `applyIntentFromUrl()` (intentParam.ts)
   sets `localStorage.signup_intent = 'provider'`.
2. Before OAuth redirect: `seedSignupIntentCookie()` writes HttpOnly
   cookie `pw_signup_intent` (survives Safari ITP localStorage wipe).
3. After OAuth roundtrip: server reads intent from cookie at
   `server/routes/post-login.ts:329-339`.
4. Server consumes cookie + clears it.
5. Client clears `localStorage.signup_intent` at `SignIn.tsx:171`.
6. **The `users.signupIntent` Postgres column (schema.ts:114) exists but
   is NEVER WRITTEN.**

**Effect:** Returning user has no DB record of "I wanted to be a
provider." If they signed up but didn't finish provider onboarding, the
next login treats them as a fresh customer.

**Fix:** Write `users.signupIntent` on first signup. See §15 PR-Z3.

### §3.3 Firebase ID token vs Postgres session race

`AuthProvider.tsx:108` calls `POST /api/auth/session` with Firebase ID
token. Server mints `pw_session` cookie. **But the async Postgres user
sync** (`ensureUserInPostgres`) runs in parallel.

If the client immediately calls `POST /api/auth/post-login` (which
happens for every signin), the server may 404 because the user row
doesn't exist yet.

**Current mitigation:** `server/routes/post-login.ts:210-237` detects
missing user, attempts on-the-fly recovery by querying Firebase Admin
SDK and creating the row.

**Verdict:** Recovery works but is expensive — every post-login call
re-checks Postgres and sometimes hits Firebase Admin SDK.

### §3.4 Consent version never tracked

Schema has `users.termsAcceptedAt` and `users.termsVersion` columns
(schema.ts:125). `termsAcceptedAt` is stamped on consent; `termsVersion`
is **never written**.

If terms change, old acceptances and new acceptances are indistinguishable.
No re-consent flow exists.

**Severity:** Legal / compliance, not UX. Worth fixing once Israeli
counsel reviews terms language.

---

## §4 Duplicate onboarding paths

Per the prior Mobile-First 2026 Rebuild Audit (§2.2):

| Path | Canonical? | How reached | Action in cleanup |
|------|------------|-------------|-------------------|
| `/complete-profile` | ✓ PRIMARY | postLoginDecider redirects | Keep |
| `/provider-onboarding` | ✓ PRIMARY | intent=provider | Keep |
| `/become-provider` | DUPLICATE | "Become Provider" button | Redirect to /provider-onboarding |
| `/apply-provider` | DUPLICATE | unclear entry | Delete |
| `/join-team` | DUPLICATE | staff invite | Redirect or delete |
| `/forms/onboarding` | DEAD | unrouted | Delete |
| `/consent-onboarding` | DEAD | manual URL only | Delete |
| `/welcome-consent` | SECONDARY | post-signup conditional | Fold into /onboarding |
| `/internal/onboard` | SEPARATE | staff invite token | Keep (different audience) |
| `/onboarding/pets` | ORPHANED | NOT routed in App.tsx | Route it OR delete the wizard |

**Key insight from agent:** the system is **NOT multi-path broken** —
there's ONE canonical post-login decider routing through ONE of these
paths based on user state. The problem is duplicate entry points
(multiple "Become Provider" buttons) and dead routes (manual URL only).

---

## §5 Three signup types — customer / provider / loyalty

| Aspect | Customer | Provider | Loyalty |
|--------|----------|----------|---------|
| Entry route | `/signup` (no intent) | `/signup?intent=provider` or "Become Provider" button | `/signup?intent=loyalty` or "Join Prestige" modal |
| Required fields | firstName, lastName, termsAcceptedAt | + phone | + dateOfBirth |
| KYC | None | Full 7-step wizard | Soft (DOB only) |
| Approval gate | Auto | Manager review | Auto |
| Post-signup route | `/home` | `/provider-onboarding` → `/provider/pending` → `/provider-os` | `/home` |
| Schema columns | base | + provider_applications row | + loyaltyTier='bronze' |
| Emails sent | Welcome | Welcome + "Complete your provider application" | Welcome + "You've joined Prestige" |

**Convergence (correct):** all three converge at Firebase Auth →
`ensureServerSession()` → Postgres sync → `postLoginDecider()`.

**Divergence (correct):** intent step determines KYC requirements and
post-signup destination.

**Fragmentation (the bug):**

1. **Multiple "Become Provider" entry points** (`/become-provider`,
   `/apply-provider`, `/join-team`, intent param) → consolidate.
2. **Intent not persisted** to `users.signupIntent` — see §3.2.
3. **No role-switching UI** — user signs up as customer, decides to
   become provider later, must find "Become Provider" button. Per §0.6
   strategic positioning, dual-role IS valid (CEO is dual-role); the
   UI should reflect this.

---

## §6 Provider / customer logic unification

### How the system knows "this user is a provider"

- **Primary:** `users.role = 'provider'`
- **Secondary (authoritative):** `provider_applications.status =
  'approved'` for this userId

These can disagree (see §2.4 race). When they disagree, server returns
`'ROLE_SYNC_PENDING'` and routes to `/home`. **The user is approved but
sees customer dashboard.** Logging out + back in re-syncs.

### Can one user be both customer + provider?

**Schema-wise:** YES. `users.role` is a single field, but the relationship
to `provider_applications` is by userId — a user can be a customer who
also has a provider profile.

**Logic-wise:** NO. The routing assumes 1:1. Switching role requires
admin action.

**Reality:** The CEO is dual-role himself. The current system handles
this awkwardly.

**Fix:** Build a role-switcher pill in the header (per Mobile-First
audit §3.4) that lets dual-role users toggle CustomerShell ↔ ProviderShell
without logout.

### Where is role determined at first login?

- **Social OAuth:** `postLoginDecider()` at `server/routes/post-login.ts:361`
  auto-assigns `role='customer'` if no intent.
- **Email signup:** Intent from form → mapped to role at
  `post-login.ts:394`.
- **Phone OTP:** No intent → defaults to customer.

Role is NOT read from Firebase claims at first login. Firebase claims
are SET by the server after role is determined.

### Provider dashboard vs customer dashboard

YES — two distinct shells:

- **Customer:** `/home` → `Home.tsx`
- **Provider:** `/provider-os` → `ProviderBookingsDashboard.tsx`

**But protection is implicit (P0 audit finding):** neither route has a
`RoleProtectedRoute` wrapper at the App.tsx level. The components check
role internally. This means:

- Component code is loaded into the bundle for all users.
- Brief flash of wrong dashboard possible before role-check redirects.
- Per Mobile-First audit §2.6 — admin routes have the same issue.

---

## §7 Mobile Safari / iPad inconsistency

### iPad Safari ITP effects on auth

1. **HttpOnly cookie partitioning** per domain.
2. **localStorage wipe** on cross-origin OAuth redirect.
3. **Firebase custom claims lag** — refresh on 1-hour background timer,
   may not fire when tab is backgrounded.

### Workarounds in code

| Workaround | Location | Type | Verdict |
|------------|----------|------|---------|
| HttpOnly `pw_signup_intent` cookie (Phase A) | `client/src/lib/seedIntent.ts` | Real solution | ✓ Works |
| Redirect marker dual-store (sessionStorage + localStorage) | `SignIn.tsx:60-94` | Real solution | ✓ Works |
| 1.5s settle period + Bearer token fallback | `useAccountNavigation.ts:127-133` | Bandaid | ✓ Works but expensive |
| `/home` universal fallback | `useAccountNavigation.ts:165` | Bandaid | ✓ Safe, hides routing bugs |
| `onAuthStateChanged` de-duplication | `AuthProvider.tsx:151` | Real solution | ✓ Works |

**The expensive bandaid:** every Account tap on iPad waits 1.5s for
Firebase claims. Better fix: server whoami only, never trust Firebase
claims for routing decisions. See §15 PR-Z6.

---

## §8 Redirect / state management

### `?from=` URL parameter flow

1. **Capture:** `RequireAuth.tsx:18-21` captures pathname when user is
   not authenticated.
2. **Consume:** `SignIn.tsx:178-179` reads `?from=` after post-login
   resolves.
3. **Conditional override:** Only honored if post-login returned a
   "terminal" path (`/home`, `/provider-os`, `/admin/dashboard`,
   `/franchise/dashboard`). Non-terminal paths (e.g., `/complete-profile`)
   ignore `?from=`.

**Intentional design:** users must complete onboarding before returning
to the original target. Correct.

### Single-flight de-duplication

`postLoginCoordinator.ts:138-156` tracks concurrent calls with identical
`(body, idToken)` signature. Cache results for 30s if body is cacheable.

**Works correctly.** Tested in `postLoginCoordinator.regression.test.ts`.

---

## §9 Consent / profile enforcement

| Flow | Enforced where | Schema write |
|------|----------------|--------------|
| Social OAuth | Implicit (OAuth consent screen) | `server/routes.ts:1060` stamps `termsAcceptedAt` immediately |
| Email signup | Checkbox at `SignUp.tsx:122` (required) | Posted with signup body |
| Phone OTP | Deferred to `/complete-profile` (line 159) | Posted on complete-profile submit |
| Email magic link | Deferred to `/complete-profile` | Posted on complete-profile submit |

**Inconsistency:** Phone + magic link users sign in BEFORE accepting
terms. Email + social users accept terms BEFORE signing in.

**Fix:** uniform — terms accepted before session is issued, every entry
point. See §15 PR-Z4.

---

## §10 Firebase auth lifecycle

### Persistence (graceful degradation)

`AuthProvider.tsx:127-144`:

1. Try `indexedDBLocalPersistence` (best).
2. Fall back to `browserLocalPersistence`.
3. Fall back to `browserSessionPersistence`.

✓ Correct. Works on Safari Private Browsing.

### Token refresh

Firebase background timer, 1-hour TTL. iPad backgrounded tabs may delay
refresh.

### Custom claims propagation

- Server calls `setCustomUserClaims(uid, {role, accountType, ...})`
- Claims embedded in next-issued ID token
- Existing tokens NOT retroactively updated
- Client should call `getIdToken(true)` to force refresh — **not done
  consistently** in current code.

### `signOut` cleanup

Cleared:
- Firebase auth state
- Session cookie (best-effort, server may not respond)
- localStorage keys: `petwash_lang`, `pw_admin_pending_email`,
  `emailForSignIn`, `signup_intent`
- React Query cache (via onAuthStateChanged firing with null)

Surviving:
- IndexedDB Firebase tokens (Firebase SDK manages)
- HttpOnly cookies (server must clear)
- `postLoginCoordinator` cache (cleared via `invalidatePostLoginCache()`)

---

## §11 Route guards

Three patterns coexist:

1. **`RequireAuth` wrapper** (App.tsx) — checks user is authenticated.
   On fail, redirect to `/signin?from=...`.
2. **`RoleProtectedRoute` wrapper** — checks role hierarchy. Used for
   `/pet-wash-ltd/executive/*` (per prior audit §2.6).
3. **Implicit (component-internal)** — used for `/admin/*` (60+ routes)
   and `/provider-os`. Component mounts, runs `useWhoami()`, conditionally
   renders or redirects.

**Implicit protection is the P0 finding** from Mobile-First audit §2.6.
Customer browsers download admin code; protection only fires after the
chunk loads.

---

## §12 Post-auth landing logic

### Priority ladder (`useAccountNavigation.ts:41-68`)

```
1. franchise_owner → /franchise/dashboard
2. provider → /provider-os
3. ADMIN_ROLES → /admin/dashboard
4. adminEmailMatch(user.email) → /admin/dashboard ← see §13
5. Server post-login decider nextUrl
6. Authenticated, no role → /home (universal fallback)
```

**Step 4 is a security concern.** If `VITE_ADMIN_EMAILS` env var contains
an email but the server doesn't treat that email as admin, the user sees
admin chrome but server APIs reject every request. Inconsistent. See §15
PR-Z2.

### `postLoginCoordinator` single-flight + 30s cache

Cache key includes idToken tail (last 16 chars). Prevents cross-user
collisions. Cache invalidated by `invalidatePostLoginCache()` after role
change.

✓ Correct design.

---

## §13 Replit patchwork vs real architecture

### Patchwork signs

| File / line | Sign | Severity |
|-------------|------|----------|
| `useAccountNavigation.ts:91-133` | 1.5s settle period bandaid | Expensive but works |
| `useAccountNavigation.ts:52-59` | Email-based admin routing fallback | Security concern |
| `useAccountNavigation.ts:165` | `/home` universal fallback | Hides routing bugs |
| `MyAccount.tsx` | "Pet Parent" / "בעל חיית מחמד" display fallback | Hides missing firstName |
| `wallet-pass.ts` (similar pattern) | `email.split('@')[0]` fallback for displayName | Hides missing name |
| `AuthProvider.tsx:35-46` + `useAccountNavigation.ts:41-50` | Duplicate ADMIN_ROLES | Risk of skew |
| `users.signupIntent` (schema.ts:114) | Column exists, never written | Wasted schema |
| `users.termsVersion` (schema.ts:125) | Column exists, never written | Compliance gap |
| `/forms/onboarding`, `/consent-onboarding` | Routed but never linked | Dead endpoints |
| `/onboarding/pets/*` | Wizard exists, never routed | Orphaned feature |
| `AuthProvider.tsx:178-187` | "PR-FRES-5 mitigation" comment | Acknowledged tech debt |

### Real architecture signs

- Drizzle schema with strict types + constraints
- TypeScript types for `PostLoginResponse`, `WhoamiResponse`, `UserClaims`
- Zod schemas for request validation
- `postLoginCoordinator` single-flight pattern (real engineering)
- `logAuditEvent()` at key state changes
- Comments explaining WHY (PR-FRES references, Phase A, etc.)

**Verdict:** Backbone is solid. Boundaries accumulate patchwork. The
patchwork hides the boundary bugs behind cosmetic fallbacks — which is
why the CEO experiences "everything sort of works but feels random."

---

## §14 Recommended unified architecture

Aligns with Mobile-First 2026 Rebuild Audit §3 (already merged):

1. **One auth entry:** `/welcome` → `/signin` or `/signup`. Delete
   aliases (`/login`, `/sign-in`, `/register`, etc.).
2. **One onboarding:** `/onboarding` with state machine. Phone OTP
   feeds into the same `/onboarding/name` step as social OAuth users
   missing displayName.
3. **One identity source:** server `/api/session/whoami` is
   AUTHORITATIVE. Firebase claims read-only.
4. **Role decided at first login** + persisted to `users.signupIntent`
   so returning users keep their intent.
5. **One admin domain** (`admin.petwash.co.il` per Rebuild Audit §2.6)
   — not routed in customer app.
6. **Two shells:** `CustomerShell` and `ProviderShell`. Dual-role users
   see a role-switcher pill.

---

## §15 Smallest safe staged repair plan (7 PRs)

Ordered by customer impact, each independently revertible, no protected
systems touched, no schema migration required (`users.signupIntent`
already exists).

### PR-Z1 — Block OTP signup until name captured (HIGH impact)

**Fixes:** "called me user" / "got SMS but onboarding didn't continue"
(the symptom the CEO actually experienced).

**Change:** After OTP verification but BEFORE issuing the server session,
present a mandatory name-collection step in the OTP modal. Don't issue
session cookie until firstName + lastName + termsAcceptedAt are set.

**Files:** `SignIn.tsx` OTP path, `server/routes/auth.ts` (gate
`/api/auth/session` on firstName presence for phone-provider users).

**Risk:** LOW. Adds a step, doesn't remove. Existing customers unaffected
(they already have firstName).

### PR-Z2 — Deduplicate ADMIN_ROLES + remove email-based routing

**Fixes:** Triplication risk + security gap.

**Change:**
1. Delete inline `ADMIN_ROLES` from `AuthProvider.tsx` and
   `useAccountNavigation.ts`. Import from `shared/adminRoles.ts` only.
2. Delete `adminEmailMatch()` fallback in `useAccountNavigation.ts:52-59`.
   Server whoami is the only source.

**Files:** `AuthProvider.tsx`, `useAccountNavigation.ts`,
`shared/adminRoles.ts`.

**Risk:** MEDIUM. Anyone relying on `VITE_ADMIN_EMAILS` for client-side
admin access loses it. But server-side admin checks are unchanged, so
the actual API access is unchanged. Only the UI routing changes.

### PR-Z3 — Persist `users.signupIntent`

**Fixes:** Returning users lose their intent. Schema column exists but
isn't written.

**Change:** When `postLoginDecider()` consumes the intent from cookie or
body, write it to `users.signupIntent` before clearing.

**Files:** `server/routes/post-login.ts`.

**Risk:** LOW. Additive write to an existing nullable column.

### PR-Z4 — Uniform consent enforcement

**Fixes:** Phone + magic-link users sign in before accepting terms;
email + social users accept before. Inconsistent.

**Change:** Block session issuance on terms acceptance for ALL flows.
Phone OTP flow: combined with PR-Z1 above (name + terms collected
together).

**Files:** `server/routes/auth.ts`, `SignIn.tsx`, `SignUp.tsx`.

**Risk:** LOW. Adds gate, doesn't change content.

### PR-Z5 — Auto-escalate role on provider approval

**Fixes:** Provider applications approved but `users.role` stays
`'customer'` → user sees customer dashboard despite being approved.

**Change:** When `provider_applications.status` is updated to `'approved'`,
also UPDATE `users.role = 'provider'` in the same transaction. Invalidate
postLoginCoordinator cache.

**Files:** `server/routes/admin/provider-review.ts` (or wherever the
approval handler lives).

**Risk:** MEDIUM. Touches admin moderation flow. Per platform skill §2,
provider approval is sensitive. CEO approval required before this PR.

### PR-Z6 — Remove Firebase claims routing trust (after PR-Z2)

**Fixes:** 1.5-second Account-tap UX lag on iPad Safari ITP.

**Change:**
1. Delete settle period in `useAccountNavigation.ts:127-133`.
2. Delete Bearer token fallback in `postLoginCoordinator.ts` (use
   session cookie only).
3. All routing decisions read from `useWhoami()` (server-authoritative).

**Files:** `useAccountNavigation.ts`, `postLoginCoordinator.ts`.

**Risk:** MEDIUM-HIGH. The settle period exists because Firebase claims
genuinely lag on iPad. If session cookie isn't reliable on iPad ITP
(possible), this PR makes things worse. Must verify session cookie
reliability first.

**Precondition:** PR-Z2 merged (admin routing doesn't depend on Firebase
claims).

### PR-Z7 — Consolidate `onAuthStateChanged` handlers

**Fixes:** Race conditions, side-effect bugs from multiple handlers.

**Change:** Move all `onAuthStateChanged` logic into `AuthProvider`. Other
components (`GoogleOneTap`, `useAutoFaceID`) subscribe to callbacks
exposed by AuthProvider.

**Files:** `AuthProvider.tsx`, `GoogleOneTap.tsx`, `useAutoFaceID.ts`.

**Risk:** MEDIUM. Refactor. Could break subtle side-effects. Must run
full regression test on every auth path.

---

## §16 What this PR does NOT do

- No code change.
- No schema migration.
- No new dependencies.
- No CI workflow change.
- No protected systems touched (wallet, K9000, Nayax, Tranzila, schema,
  auth gates — all read-only inspection).
- No PR-Z1 through PR-Z7 opened (gated on CEO decision: 7 PRs vs full
  rebuild).

---

## §17 Decision awaiting CEO

**Two paths forward:**

**Path A — Tactical 7-PR repair (~2 weeks engineering, ~$0 infra)**

Ship PR-Z1 through PR-Z7 in order. Each independently revertible.
Produces a deterministic signup flow without rewriting architecture.

**Path B — Full Phase 1–11 rebuild (~120–150 engineer-hours)**

Ship per Mobile-First 2026 Rebuild Audit. Includes all of Path A plus
the broader cleanup (admin sub-domain, dashboard split, hamburger
revision, etc.).

**Recommendation: Path A first.** Tactical fixes ship the customer-facing
improvements in 2 weeks. Path B continues in parallel as the strategic
work. Path A doesn't block Path B; many PR-Z files become inputs to the
Phase 4/5/6 rebuild work.

---

## §18 References

- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — strategic 11-phase rebuild
  (merged #279)
- `docs/AUTH_REBUILD_AUDIT.md` — Welcome screen + 4-button design
- `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` — 12 identity bandaids
- `.claude/skills/petwash-platform/SKILL.md` — §0 strategic doctrine,
  §2 protected systems, §3 AI rules

---

**End of forensic audit.** No code ships. Implementation gated on CEO
choice of Path A or Path B in §17.
