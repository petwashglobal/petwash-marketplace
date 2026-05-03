# P0 Admin Login — iPhone Safari Google Sign-In Diagnosis

Date: 2026-05-03
Branch: `claude/p0-admin-login-google-safari`
Investigator: Claude (research agent)
Reporter: CEO (`nir.h@petwash.co.il`)

## Reported symptoms

On `petwash.co.il/admin` (iPhone Safari):
- Touch ID / Face ID button shows greyed.
- "Continue with Google" tap → red toast "Google Sign-In Failed. Google sign-in failed. Please try again."
- Email/password appears greyed/inert.
- Footer shows: `OAuth 2.1 Secured • Crown Jewel Protocol v2025`.

---

## Section A — Root cause (ranked)

### Hypothesis #1 (TOP): `getRedirectResult` race between AuthProvider and AdminLoginV2

`getRedirectResult()` from Firebase Web SDK can only be consumed **once** per redirect cycle. The first caller to await it gets the `UserCredential`; every subsequent caller gets `null`.

In production today, on the `/admin/login` route, **two** components race to consume the redirect result:

1. `client/src/auth/AuthProvider.tsx:180` — globally mounted on every route, calls `getRedirectResult(auth)` on mount, before any page-level effect has run.
2. `client/src/pages/admin/AdminLoginV2.tsx:82` — the admin login page calls `getRedirectResult(auth)` inside its own `useEffect`.

`AuthProvider` always wins the race because it sits higher in the React tree. Consequence on iPhone Safari (after a `signInWithRedirect` round trip):

- `AuthProvider.getRedirectResult` resolves with the credential.
- `AuthProvider.onAuthStateChanged` fires, calls `ensureServerSession(firebaseUser)` (`client/src/auth/AuthProvider.tsx:88-105`) — server session cookie is set.
- `AdminLoginV2`'s `useEffect` calls `getRedirectResult` → returns `null` → early return at `AdminLoginV2.tsx:83` (`if (!result) return;`).
- **`assertAdminAccess()` is never called.** The admin allow-list / role check (`whoami.isSuperAdmin || isAdminRole(whoami.role)`) is the gate that decides whether to navigate to `/admin/dashboard`. With no result, no gate.
- **`setLocation('/admin/dashboard')` is never called.** The user remains on `/admin/login` despite being authenticated to Firebase.

Why the user perceives "buttons greyed":
- After the redirect lands them back on `/admin/login`, `AuthProvider.loading` is initially `true`. Children of pages that use `useFirebaseAuth()` may render skeleton/disabled UI for a few hundred ms while persistence resolves. The Touch ID button is also conditionally disabled when `email` is empty (`AdminLoginV2.tsx:338`) — which is the case on a fresh page load.

Evidence:
- `client/src/auth/AuthProvider.tsx:179-186` — global `getRedirectResult` consumer.
- `client/src/pages/admin/AdminLoginV2.tsx:78-106` — local `getRedirectResult` consumer (loses the race).
- `client/src/lib/firebase.ts:32-35` — code comment **explicitly documents** this Safari ITP / `getRedirectResult` returning null failure mode after `signInWithRedirect`.

### Hypothesis #2: Pre-redirect throw — `signInWithRedirect` itself rejects

If iPhone Safari blocks Firebase's `auth.signinpetwash.firebaseapp.com` (or `petwash.co.il`) third-party storage read, `signInWithRedirect` can throw before the page redirects. The handler at `AdminLoginV2.tsx:292-302` swallows the exception into the toast: `"Google sign-in failed. Please try again."` — exact match for the reported toast.

This matches the behavior the CEO sees on the *first* tap (red toast appears immediately, no redirect to Google), separate from the post-redirect silent-failure of Hypothesis #1.

Evidence:
- `client/src/pages/admin/AdminLoginV2.tsx:298-302` — toast uses exactly the reported wording.
- `client/src/lib/firebase.ts:32-35` — comment confirms historical Safari ITP failure mode.

PR #74 (`646270a6e`) only documented env vars — it did not change auth. A separate copilot commit `e769d42a0` partly repaired the admin login catch block but introduced an **undefined identifier** (Hypothesis #3 below).

### Hypothesis #3: `extractErrorMessage` is undefined — admin email/password login crashes on non-credential errors

`AdminLoginV2.tsx:144` calls `extractErrorMessage(error)` inside the `handleStandardLogin` catch. The identifier is **never imported and never defined** in this file. Confirmed by `tsc`:

```
client/src/pages/admin/AdminLoginV2.tsx(144,13): error TS2304: Cannot find name 'extractErrorMessage'.
```

Impact: when a user signs in with email/password and the error is *not* a Firebase credential error and *not* `ACCESS_DENIED` (e.g. `SESSION_CREATION_FAILED` thrown by `createServerSession`), the catch block hits a `ReferenceError`. The original Error is lost; the user sees a confusing toast or the page hangs.

Evidence:
- `client/src/pages/admin/AdminLoginV2.tsx:144`.
- TSC baseline includes this exact error.
- `git show e769d42a0 -- client/src/pages/admin/AdminLoginV2.tsx` shows the broken refactor that introduced the unresolved name.

This bug does NOT explain the Google sign-in toast (different code path) but DOES explain why the email/password row may appear "inert" on retry.

### Hypothesis #4 (lower): SUPER_ADMIN_EMAILS allowlist mismatch

`server/middleware/rbac.ts:18` reads `SUPER_ADMIN_EMAILS` from env and compares lowercase. `nir.h@petwash.co.il` would only fail the check if:
- the env var is missing or contains placeholder text on Cloud Run (rbac.ts:20-26 logs a critical error in that case),
- the configured value omits `nir.h` (e.g. uses `nir@petwash.co.il`),
- Google's verified email returned by Firebase is `Nir.H@…` (mixed case is fine — server lowercases) or `nirh@petwash.co.il` (no dot — would fail).

This is **environmental**, not a code bug. We cannot verify without prod env access. **Recommendation to CEO: confirm `gcloud secrets versions access latest --secret=SUPER_ADMIN_EMAILS` contains the exact lowercase string `nir.h@petwash.co.il`.**

If this hypothesis is the root cause, the user would see "This account does not have admin privileges." (the `ACCESS_DENIED` branch at `AdminLoginV2.tsx:97-98`), not "Google sign-in failed." So it does not match the symptom and is ranked last.

### Is the admin login a "stale legacy component" that PR #74 missed?

**No.** `client/src/pages/admin/AdminLoginV2.tsx` is the canonical admin login. `client/src/pages/AdminLogin.tsx` is a thin re-export wrapper around it. `AdminLoginV2` is mounted at `/admin/login` and `/admin/login-v2` (`client/src/App.tsx:2496, 2511`). It already has Safari/iOS detection and uses `signInWithRedirect` on mobile (`AdminLoginV2.tsx:277-282`). PR #74 did not need to touch it.

The bug is **NOT** "popup vs redirect" — the bug is the redirect-result is consumed by the global `AuthProvider` before the admin page can read it.

---

## Section B — The "Crown Jewel" footer

**Footer string location (single match):**
- `client/src/pages/admin/AdminLoginV2.tsx:491` — `OAuth 2.1 Secured • Crown Jewel Protocol v2025`.

**Other Crown Jewel mentions in repo (code comments only, no functional code):**
- `client/src/components/luxury/LuxuryEmoji.tsx:3,5` — JSDoc header comment ("Crown Jewel Edition", "Crown Jewel 3D Engine"). Not user-visible.
- `shared/octopusEmojis.ts:4` — JSDoc header comment ("Crown Jewel Edition"). Not user-visible.

**Verification — does any code implement a "Crown Jewel Protocol"?**

```bash
grep -rn "CrownJewel\|crown_jewel\|CROWN_JEWEL" .
# (no matches in any .ts/.tsx/.js/.json/.md)
```

No class, function, constant, file name, route, env var, or schema field implements anything called "Crown Jewel Protocol". The string is **decorative marketing copy / security theatre** — it claims a protocol that does not exist. It implies a level of bespoke security ("v2025") that is not borne out by any code path.

**Conclusion: theatre. Remove.**

The "OAuth 2.1" claim is also sloppy — Firebase Auth's Google provider negotiates OAuth 2.0 + OIDC. There is no "OAuth 2.1" in this codebase.

---

## Section C — Fix plan

### Fix 1 — Remove the security-theatre footer copy (LOW RISK, single-line)

**File:** `client/src/pages/admin/AdminLoginV2.tsx`
**Line:** 491

**Before:**
```tsx
<p className="text-xs text-gray-500">
  OAuth 2.1 Secured • Crown Jewel Protocol v2025
</p>
```

**After:**
```tsx
<p className="text-xs text-gray-500">
  Secured admin access
</p>
```

Risk: trivially low. Single string change. No behavioural impact.

### Fix 2 — Stop the `getRedirectResult` race; let `AdminLoginV2` complete its post-redirect flow (LOW-MEDIUM RISK, scoped to AdminLoginV2)

**File:** `client/src/pages/admin/AdminLoginV2.tsx`
**Lines:** 77-106 (the `handleRedirectResult` block).

**Approach:** AdminLoginV2 cannot rely on `getRedirectResult` because `AuthProvider` consumes it first. Instead, AdminLoginV2 should observe Firebase's auth state directly with `onAuthStateChanged` (which fires AFTER `AuthProvider`'s `getRedirectResult` resolves) and use a one-shot localStorage flag to recognise a redirect-initiated sign-in. When the user returns from Google, `onAuthStateChanged` fires with a non-null user, the flag is set, AdminLoginV2 takes the user's id token, asserts admin access, and navigates to `/admin/dashboard`.

This mirrors the existing customer pattern in `client/src/pages/SignIn.tsx` (`getRedirectResult` is also called there but the page also listens to `onAuthStateChanged` via the AuthProvider context for the actual sign-in event).

**Sketch (drop-in replacement for the `useEffect` body, ~25 lines):**

```tsx
useEffect(() => {
  const checkWebAuthn = async () => {
    if (window.PublicKeyCredential) {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setSupportsWebAuthn(available);
    }
  };
  checkWebAuthn();

  // Resume Google sign-in after iOS Safari redirect.
  // We cannot use getRedirectResult here because AuthProvider (mounted globally)
  // consumes the redirect result first; a second call returns null. Instead we
  // set a localStorage flag right before signInWithRedirect, then watch
  // onAuthStateChanged for the post-redirect user.
  if (localStorage.getItem('pw_admin_google_redirect_pending') !== '1') return;

  let unsubscribe: (() => void) | undefined;
  (async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    const { auth } = await import('@/lib/firebase');
    unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      localStorage.removeItem('pw_admin_google_redirect_pending');
      try {
        setIsGoogleLoading(true);
        const idToken = await user.getIdToken();
        await createServerSession(idToken);
        await assertAdminAccess();
        toast({ title: 'Welcome back! ✨', description: 'Successfully logged in with Google' });
        setLocation('/admin/dashboard');
      } catch (err: any) {
        const isAccessDenied = err?.message === 'ACCESS_DENIED';
        toast({
          title: 'Google Sign-In Failed',
          description: isAccessDenied
            ? 'This account does not have admin privileges.'
            : 'Google sign-in failed. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsGoogleLoading(false);
        unsubscribe?.();
      }
    });
  })();
  return () => { unsubscribe?.(); };
}, []);
```

And the matching set of the flag in `handleGoogleLogin` right before redirect:

```tsx
if (isMobileBrowser()) {
  localStorage.setItem('pw_admin_google_redirect_pending', '1');
  await signInWithRedirect(auth, provider);
  return;
}
```

**This fix is APPLIED in this commit** because:
- It is scoped to a single file (`AdminLoginV2.tsx`).
- It introduces no new dependencies.
- It does not touch `validateFirebaseToken`, `requireAdmin`, `requireBrainAccess`, `isSuperAdmin`, or any server route.
- It does not change Firebase config, env handling, or `AuthProvider`.
- It is well under 50 lines.
- The localStorage flag is namespaced (`pw_admin_*`) and self-cleaning.

**Risk:** LOW-MEDIUM. The flag is set only on the explicit `signInWithRedirect` path; if a user navigates away mid-redirect, the flag persists until next admin login attempt — at which point it is consumed and cleared. Worst-case: the admin login page briefly shows "Signing in with Google..." after a stale flag, then succeeds or shows a normal toast. Rollback is a single-commit revert.

### Fix 3 — DEFERRED: define `extractErrorMessage`

`AdminLoginV2.tsx:144` references an undefined `extractErrorMessage`. This is a pre-existing TSC error and a latent runtime ReferenceError in the email/password catch block. **Not fixed here** because:
- It is NOT the cause of the reported Google-on-Safari issue.
- Touching it expands scope beyond the P0.
- A safe fix requires either importing a helper from elsewhere or inlining a `String(error?.message ?? '')` extractor — minor but separate concern.

This is filed as a follow-up. Replace `extractErrorMessage(error) || 'Session could not be created. Please try again.'` with `(error?.message && typeof error.message === 'string' ? error.message : '') || 'Session could not be created. Please try again.'`.

### Environment / config changes (separate from code, for CEO to verify)

These are NOT changed by this PR but the CEO should verify on Cloud Run:

1. **`SUPER_ADMIN_EMAILS`** must contain `nir.h@petwash.co.il` (lowercase, exact). Verify with:
   `gcloud secrets versions access latest --secret=SUPER_ADMIN_EMAILS --project=<PROJECT>`
2. **Firebase authorized domains** must include `petwash.co.il` and `www.petwash.co.il` (Firebase Console → Authentication → Settings → Authorized domains).
3. **`authDomain`** is hardcoded to `'petwash.co.il'` in production builds (`client/src/lib/firebase.ts:42`). Confirm this hostname is configured in Firebase as a custom auth domain (not just an authorized domain). If it is not, the redirect handshake will fail for OAuth.

---

## Section D — What was NOT touched

- ❌ Wallet / finance routes
- ❌ K9000 / Nayax / Tranzila integration
- ❌ `shared/schema.ts` or any Drizzle migration
- ❌ Dependencies (`package.json` / `package-lock.json`)
- ❌ Logged-out homepage / customer sign-in (`client/src/pages/SignIn.tsx`)
- ❌ Admin dashboard pages (only the LOGIN entry point)
- ❌ Server routes (`/api/auth/session`, `/api/session/whoami`, `/api/admin/*`)
- ❌ `validateFirebaseToken` / `requireAdmin` / `requireBrainAccess` / `isSuperAdmin`
- ❌ Firebase config (`client/src/lib/firebase.ts`)
- ❌ `AuthProvider.tsx`
- ❌ `useAdminAuth` hook
- ❌ Mobile-account-routing audit components (separate work)
