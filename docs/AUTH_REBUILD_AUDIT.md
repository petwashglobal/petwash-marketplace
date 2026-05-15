# Auth & Onboarding Rebuild — Audit & Proposal

**Status:** Read-only audit + drafted architecture. **NO code changes. NO implementation.**
**Scope:** Full sign-in / sign-up / identity-provider / consent / trusted-device / profile-completion architecture, plus the Welcome screen redesign requested in the CEO brief.
**Predecessor docs:** `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` (PR 277, exec access layer) + `client/src/__audits__/p0-admin-login-google-safari.md` + `client/src/__audits__/p0-mobile-account-routing.md`. This doc builds on those rather than duplicates them.

---

## Important warnings — read first

1. **No implementation by this PR.** Audit + architecture proposal only. Implementation phases (§13) only start after CEO sign-off plus Israeli legal counsel review of every consent screen and trust statement that goes live.
2. **One critical platform constraint discovered.** Apple App Store Guideline 4.8 mandates that any product offering a third-party social login (Google, Facebook, etc.) MUST also offer Apple Sign In. Currently satisfied — Apple is wired. **If we ever remove Apple Sign In, we must also remove Google.** This is non-negotiable for iOS distribution and applies to web flows too. Source: [Apple Developer — App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) §4.8.
3. **Three providers wired but not equal quality.** Google has a premium consent screen but overly broad scopes (Gmail + Contacts + Calendar — we only need email). Apple has a clean minimal consent. Facebook falls back to a generic dialog. The rebuild must normalize the consent UX across providers.
4. **No "Anonymous USER" pattern found** — already a strength. The codebase requires real identity (email, phone, or OAuth provider) on every signup path. The CEO's worry about "broken anonymous USER profile" is unfounded in current code. The proposal preserves this property.
5. **The current auth UI is closer to Airbnb/Uber than Firebase demo** per the agent's visual assessment. SignIn.tsx uses Cormorant Garamond / Playfair Display serif logo on white background with gold accents. **But it's a 2200-line mega-component and does not yet consume the Phase B2 design tokens** (still uses hex literals for gold). The rebuild gets it onto stage-white + ink-900 + Inter sans alignment.

---

## 0. TL;DR

The platform's auth stack is more advanced than the CEO probably realizes. Passkeys (WebAuthn) are wired and working. Apple, Google, Facebook OAuth are all wired. Email magic link is wired. Phone OTP is wired via Firebase Phone Auth (no Twilio dependency). Device trust ("remember this device 30 days") exists. The CEO's worry about "anonymous USER" creation is unfounded — every signup path requires identity.

Five real gaps the rebuild should fix:

1. **Sign In and Sign Up are separate pages with separate URLs** (`/signin` vs `/signup`). Modern apps merge them. The system should intelligently detect existing users and route accordingly — this is the CEO's "no duplicated sign-up vs sign-in confusion" requirement.
2. **Google OAuth consent screen requests Gmail + Contacts + Calendar scopes.** The app only needs email. This is excessive scope creep and should be reduced before any new flow ships. Privacy regulator-visible.
3. **Facebook OAuth uses a generic fallback consent dialog,** not the premium per-provider design Apple and Google have. Either elevate to match or remove Facebook entirely (recommended — Israeli market + privacy posture).
4. **TikTok and Instagram appear in `OAuthConsentDialog` enum** as dead code (no actual auth implementation). The Instagram Basic Display API died Dec 2024; the Graph API path is not viable for general consumer login. Recommend removing these enum values to prevent future confusion.
5. **The Welcome screen doesn't exist as a distinct entry point.** Today, unauthenticated users land on the marketing homepage and reach auth via the hamburger menu CTA. The CEO's brief calls for a proper Welcome screen with clean provider buttons. Building this is a positive addition, not a rewrite — the underlying providers are already wired.

Five small implementation PRs cover the rebuild (§13). The largest single change is the Welcome screen itself.

---

## 1. Current flow map

Verified by code audit, May 2026.

### 1.1 Entry surfaces

| URL | File | What it does |
|---|---|---|
| `/signin` | `client/src/pages/SignIn.tsx` (2200 lines) | The canonical sign-in. Six provider options + email/password + magic link + passkey conditional UI. |
| `/signup` (+ aliases `/sign-up`, `/register`) | `client/src/pages/SignUp.tsx` | Separate signup page with same provider options + first-name gate. |
| `/` | `client/src/pages/Landing.tsx` (via `Home.tsx:14`) | Marketing homepage for unauthenticated users. Has "Sign In" + "Sign Up" links in hamburger and header. No dedicated Welcome entry. |

### 1.2 Provider integrations verified

| Provider | Wired? | Where | Consent screen |
|---|---|---|---|
| **Google OAuth** | Yes | `lib/iosAuthHandler.ts:120-132` (`createGoogleProvider()`) | `PremiumGoogleOAuthConsent.tsx` (premium, but requests Gmail + Contacts + Calendar — overly broad) |
| **Apple Sign In** | Yes | `iosAuthHandler.ts:138-144` (`createAppleProvider()`) | `AppleOAuthConsent.tsx` (clean, minimal, asks only for name + email; consent timestamp stored in localStorage as `petwash_oauth_consent_apple`) |
| **Facebook Sign In** | Yes | `iosAuthHandler.ts:150-160` (`createFacebookProvider()`) | Generic `OAuthConsentDialog.tsx` (less premium than Google/Apple per-provider screens) |
| **Phone OTP** | Yes | Firebase Phone Auth (not Twilio) | None — implicit via OS dialog |
| **Email + password** | Yes | Firebase Auth standard | None |
| **Email link / magic link** | Yes | Firebase `sendSignInLinkToEmail` / `isSignInWithEmailLink` / `signInWithEmailLink` | None — handled in email |
| **Passkey / WebAuthn** | Yes | `client/src/auth/passkey.ts` (via `@simplewebauthn/browser`); server `/api/webauthn/*` routes | Native OS dialog (Face ID, Touch ID, fingerprint, Windows Hello) |
| **Custom token** | Yes, internal only | `signInWithCustomToken` for admin emergency recovery + session resumption | N/A — not public-facing |
| **Anonymous Auth** | NO | Never called in code | N/A — by design |
| **TikTok login** | NO (analytics labels only) | Mentioned in `OAuthConsentDialog` enum line 32-33 but no provider implementation | N/A |
| **Instagram login** | NO (analytics labels only) | Same as TikTok | N/A |

### 1.3 Post-auth routing

After Firebase auth succeeds (any provider), the flow is:

```
Firebase auth callback
  → AuthProvider.tsx:219 onAuthStateChanged fires
  → getIdTokenResult(true) hydrates claims
  → ensureServerSession() POST /api/auth/session (sets pw_session cookie)
  → resolvePostLogin() POST /api/auth/post-login (returns nextUrl)
  → window.location.assign(nextUrl)
```

The `resolvePostLogin()` decision is covered in detail in `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` §1.4. Short version: server reads role from claims, DB, and approval tables; returns `/admin/dashboard`, `/provider-os`, `/home`, or an onboarding form route.

### 1.4 Profile-completion gates today

- **Customers** — no enforced "first name required" gate at `/my-account` landing. User can land on `/home` immediately.
- **Providers** — explicit form at `/provider-onboarding` with firstName, lastName, phone, ID, etc.
- **Admins** — bypass onboarding, land on `/admin/dashboard`.
- **Phone signup** — name collection is enforced ("T12 workaround" at `SignUp.tsx:91-92`) before Firebase user is finalized. **No "anonymous USER" row ever created.**

### 1.5 Session and persistence

- **Cookie:** `pw_session` HttpOnly, SameSite=none (prod), 5-day max-age, domain `.petwash.co.il`.
- **Bearer fallback:** Firebase ID token, 1-hour refresh, sent as `Authorization: Bearer <token>`.
- **Client storage cascade:** IndexedDB → localStorage → sessionStorage (`AuthProvider.tsx:127-144`).
- **localStorage keys (4):** `petwash_lang`, `pw_admin_pending_email`, `emailForSignIn` (magic link recovery), `signup_intent`.
- **Sign-out flow:** wipes cookie + all localStorage keys + IndexedDB + sessionStorage + Firebase auth state + React Query cache, then hard reloads to `/`.

### 1.6 Trusted device today

- `trustDevice()` + `isDeviceTrusted()` library at `client/src/lib/deviceTrust.ts` (referenced from `SignIn.tsx:34`).
- 30-day trust window.
- "Remember this device" checkbox exists on `/signin` (per agent audit) but is opt-in, not opt-out, and not prominent.
- Used by MFA gate to skip step-up on subsequent visits.

### 1.7 MFA / step-up today

- `mfaRoutes` server-wired.
- `claims.mfa_verified` boolean checked by `session-hardening.ts`.
- Step-up triggers on session-age threshold.
- Admin-only by default. Customers don't have MFA today.

---

## 2. The Apple Sign In compliance rule — critical platform constraint

**Apple App Store Review Guidelines §4.8** (in force since 2020, updated periodically through 2025):

If your app or web product uses a third-party or social login service (Google, Facebook, Twitter, LinkedIn, Amazon, WeChat, etc.) to set up or authenticate the primary account, you must ALSO offer Apple Sign In as an equivalent option. Apple Sign In must be **equally prominent** in the UI.

**What this means for PetWash:**

- Google Sign In currently on the page → Apple Sign In **MUST** stay on the page. **Cannot be removed.**
- If we ever add a new social provider (e.g., LinkedIn), Apple Sign In must be present too.
- This applies to the web flow on iOS Safari, not just the native app store distribution.

**Exceptions (do not apply to PetWash):**

- Government / industry-backed citizen identification (e.g., Israeli digital ID systems — possibly relevant in future).
- The app is a dedicated client for a single third-party service (e.g., Twitter client that needs Twitter auth).

**Recommendation:** Keep Apple Sign In permanently. Treat Google + Apple as a paired set. If we remove Google for any reason, we can also remove Apple. We cannot keep one without the other.

Source: [Apple Developer — App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Apple Developer Forums — Mandatory Apple sign-in](https://developer.apple.com/forums/thread/129487), [Apple Developer News 2019-09-12](https://developer.apple.com/news/?id=09122019b).

---

## 3. Social login recommendation matrix

Per CEO's explicit request: do not add every provider blindly. Each provider carries its own privacy posture, security review burden, scope-creep risk, and ongoing maintenance load.

| Provider | Current state | Recommendation | Privacy / legal note | Firebase compat | Mobile UX |
|---|---|---|---|---|---|
| **Apple Sign In** | Wired | **KEEP — mandatory** under Apple Guideline 4.8 if any other social provider is on screen | Minimal data: name (optional, can be hidden) + email (can be Apple proxy alias) | ✅ Native Firebase Auth | ✅ Best on iOS, OK on Android |
| **Google Sign In** | Wired | **KEEP — reduce scopes** | Currently requests Gmail + Contacts + Calendar. Only email is needed. Remove the other two before any new flow ships. | ✅ Native Firebase Auth | ✅ Best on Android, OK on iOS |
| **Mobile Number (Phone OTP)** | Wired via Firebase Phone Auth | **KEEP — promote to primary slot in Welcome screen** | OK — phone is shared only with PetWash | ✅ Native Firebase Auth (no Twilio dependency) | ✅ Universal |
| **Email (password OR magic link)** | Wired | **KEEP — but lead with magic link, not password** | OK | ✅ Native Firebase Auth | ✅ Universal |
| **Passkey / WebAuthn** | Wired (custom backend, not Firebase Identity Platform native) | **KEEP as returning-user fast path** | OK — credential stays on device | ⚠️ Custom token integration, not native Firebase passkey SDK (which doesn't exist in 2026). See §4. | ✅ Excellent on iOS 16+ (95%+ of iPhones); good on modern Android |
| **Facebook Sign In** | Wired but uses generic consent dialog | **RECOMMEND REMOVING** | Meta tracking concerns; declining preference in Europe + Israel; regulatory scrutiny; low-value for pet-wash demographic | ✅ Available | ⚠️ Confusing post-Meta-rebrand |
| **TikTok Sign In** | Not wired (analytics enum only — dead code) | **DO NOT ADD** | TikTok API approval is stringent; demographic mismatch; ongoing US/EU regulatory uncertainty | ❌ Not a Firebase native provider; would require custom OAuth | ⚠️ App-not-installed fallback is poor |
| **Instagram Sign In** | Not wired (analytics enum only) | **DO NOT ADD** | Instagram Basic Display API died Dec 2024 ([SociaVault — Instagram API Deprecated](https://sociavault.com/blog/instagram-api-deprecated-alternative-2026)). Successor requires Business/Creator account + connected Facebook Page + Meta app review. Not viable as general consumer login. | ❌ Not viable | ❌ |
| **LinkedIn Sign In** | Not wired | Do not add for now | If business partnership signups become common, revisit. Triggers Apple 4.8 if added. | ⚠️ Custom OAuth | OK |
| **Email + password** | Wired | **KEEP as legacy fallback only** | OK | ✅ | OK |

**Net recommendation:**
- **Welcome screen carries 4 buttons:** Apple, Google, Mobile Number, Email (in that order on iOS; Google/Apple can swap on Android per platform convention).
- **Remove Facebook from the public UI.** Keep the underlying provider wiring for existing Facebook-authenticated users to log back in, but stop offering it on new flows. Phase-out plan in §13.
- **Remove TikTok + Instagram from the `OAuthConsentDialog` enum.** Dead code that signals intent we don't have.

---

## 4. Welcome screen redesign — the CEO's specific brief

The CEO requested a clean entry point with this exact structure:

> WELCOME SCREEN
>
> PetWash™
>
> Care, services, and smart pet infrastructure.
>
> Continue with Apple
> Continue with Google
> Continue with Mobile Number
> Continue with Email

### 4.1 Proposed page architecture

**Route:** `/welcome` (new), with `/signin` and `/signup` continuing to function for direct deep links but the hamburger CTA pointing to `/welcome`.

**Layout (top-to-bottom):**

1. Logo + brand mark — `PetWash™` in `ink-900` on `stage-white` background, Inter `font-extralight` sized large (`text-[clamp(40px,8vw,72px)]`). Apply the Phase B2 design tokens. ™ wrapped in U+2066/U+2069 BiDi isolation per the established convention.
2. Tagline — one line, Hebrew or English. Hebrew: "טיפול, שירותים ותשתית חכמה לבעלי חיים." English: "Care, services, and smart pet infrastructure."
3. A subtle 1px hairline divider in `ink-900/8`.
4. Four provider buttons, full-width on mobile, max-width 360px on desktop, stacked vertically:
   - **Continue with Apple** — solid black, white Apple logo, white text.
   - **Continue with Google** — solid black or `ink-900`, white Google "G" logo, white text. (Avoid Google's brand-mandated multi-color "G on white" because it breaks our luxury palette; per Google Brand Guidelines, the monochrome "G on dark" is permitted.)
   - **Continue with Mobile Number** — solid black, phone icon, white text.
   - **Continue with Email** — outlined `ink-900` border, transparent fill, `ink-900` text. Lowest visual priority (matches "passwordless first" recommendation).
5. Below the buttons: small uppercase tracked text "BY CONTINUING YOU AGREE TO" + Terms link + Privacy Policy link. `text-ink-400`, `tracking-[0.18em]`, `text-[10px]`.
6. Below that: subtle "Already have a passkey set up? Use Face ID / Touch ID" affordance that fires `signInWithPasskeyConditional()` automatically when the user's device offers it. Hidden if not available.

### 4.2 Account detection logic (the CEO's "no duplicated sign-up vs sign-in confusion" rule)

The current architecture splits at the URL level (`/signin` vs `/signup`). The proposed flow merges this:

```
User clicks "Continue with X"
  ↓
Provider OAuth completes → Firebase user available
  ↓
Server endpoint /api/auth/account-status (NEW, lightweight, ~50ms)
  ↓
  - if user has completed profile (has firstName, has accountType set) → /my-account or role dashboard
  - if user is brand new (no firstName) → /onboarding (NEW unified onboarding flow)
  - if user is partially onboarded (provider mid-form etc.) → resume that form (sticky-path)
  ↓
User never sees "Sign In or Sign Up" choice. The system decides.
```

This is the Airbnb / Uber / Revolut pattern. The user thinks "I want to use PetWash" not "I need to choose between sign-in and sign-up."

### 4.3 Returning-user fast path

If `signInWithPasskeyConditional()` fires (the user has a passkey for petwash.co.il on this device), the Welcome screen shows the Face ID / Touch ID prompt automatically, and the user is in within 1–2 seconds without tapping anything. This is the modern equivalent of "Remember Me" but cryptographically backed.

### 4.4 Mobile keyboard + iOS Safari behavior

- All provider buttons use native `<button>` elements, not `<a>` styled as buttons — avoids keyboard zoom issues.
- Email and phone inputs (when revealed in step 2 of email/phone flows) use `autocomplete="email"` / `autocomplete="tel"` to trigger iCloud Keychain / Google Password Manager.
- WebAuthn conditional UI uses `autocomplete="username webauthn"` on the email field per the W3C spec, so iOS Safari's autofill chip surfaces saved passkeys.

### 4.5 RTL / Hebrew handling

- Welcome screen renders `dir="rtl"` when language is Hebrew or Arabic.
- Provider names stay in their canonical form (Apple, Google) but the verb ("Continue with" → "המשך עם") translates.
- ™ symbol BiDi-isolated per the established pattern (U+2066/U+2069), same as the Phase B2 fix in `platformCards.ts`.

### 4.6 What NOT to do on the Welcome screen

- No big forms dumped immediately.
- No "Or sign in with email/password" mega-form below the buttons.
- No multi-color emoji.
- No glassmorphism, no decorative gradients.
- No "Sign Up" vs "Sign In" mode toggle. The system decides.

---

## 5. Modern auth architecture proposal

### 5.1 Topology

```
Welcome screen
  ├── Apple Sign In ──── Firebase OAuthProvider('apple.com') ──┐
  ├── Google Sign In ─── Firebase GoogleAuthProvider ──────────┤
  ├── Mobile Number ──── Firebase Phone Auth ──────────────────┤
  └── Email ──── Magic Link (default) ─── Firebase Email Link ─┤
            └── Password (advanced, hidden by default) ────────┤
                                                                ↓
                                                Firebase Auth user
                                                                ↓
                                                /api/auth/account-status (NEW)
                                                  decides: new / existing / partial
                                                                ↓
                                                Welcome → /my-account or /onboarding or sticky-form

Passkey conditional UI (parallel)
  └── On Welcome screen mount, if device has passkey for petwash.co.il,
      autofill chip surfaces → one-tap Face ID / Touch ID → straight to
      /api/auth/account-status → routed.
```

### 5.2 What stays the same

- Firebase Auth as the identity backbone — no migration to a different provider (Stytch, Clerk, Hanko) recommended at this time. The codebase has 2 years of Firebase integration; rip-and-replace is expensive and the existing integration is functional.
- Server `/api/auth/session` cookie minting flow.
- `useAccountNavigation` resolver pattern — already covered in the executive access audit (PR 277) with its own stabilization workstream.
- All existing OAuth provider wirings (Google, Apple, Facebook), with scope/UI changes proposed below.

### 5.3 What changes

- **New `/welcome` route** with the layout in §4.
- **New `/api/auth/account-status` endpoint** — lightweight, returns `{ status: 'new' | 'existing' | 'partial', nextUrl }` based on Firebase UID lookup in `users` table.
- **New `/onboarding` unified onboarding route** — replaces the implicit "land on /my-account and figure it out" pattern. Asks for first name + email-or-phone-as-second-contact + accountType selection (Customer / Provider) before allowing access to dashboards.
- **Google OAuth scopes reduced** from `profile, email, calendar, contacts` to just `profile, email`. Update `iosAuthHandler.ts:124-125` and the `PremiumGoogleOAuthConsent.tsx` permission text.
- **Facebook UI hidden** (deprecation in progress). Underlying provider stays wired for existing Facebook-authenticated users only.
- **TikTok + Instagram enum values removed** from `OAuthConsentDialog`.

---

## 6. Passkey / WebAuthn feasibility — already largely there

The codebase has functional WebAuthn integration. Verified:

- Client: `@simplewebauthn/browser` library in `client/src/auth/passkey.ts`.
- Conditional UI via `signInWithPasskeyConditional()` for autofill on the Welcome / sign-in screen.
- Registration via `registerPasskey(idToken, email)`.
- Platform authenticator detection (`isPlatformAuthenticatorAvailable()`).
- Custom token mint on the server side at `/api/webauthn/*` to bridge to Firebase Auth.

**Firebase Auth does NOT have a first-class passkey SDK in 2026.** Per [MojoAuth — Firebase Auth Alternatives 2026](https://mojoauth.com/blog/10-best-firebase-auth-alternatives) and the [Firebase iOS SDK issue tracker](https://github.com/firebase/firebase-ios-sdk/issues/11548), passkey enrollment is not natively supported in the managed SDK. Custom WebAuthn integration with custom-token bridging is required.

**Good news: that's exactly what PetWash already has.** No additional architectural work needed. The rebuild just makes passkeys more visible on the Welcome screen via the conditional UI auto-firing.

iOS Safari WebAuthn support is mature: [passkeys.dev — iOS](https://passkeys.dev/docs/reference/ios/) reports 100% of iOS 16+ devices support WebAuthn, with 95%+ ready for passkeys via iCloud Keychain. [State of Passkeys on iOS 2026](https://state-of-passkeys.io/ios) confirms cross-device sync via iCloud is 100%.

Recommendation: feature-flag the auto-firing conditional UI initially. Measure how often it succeeds vs how often it surfaces but the user dismisses it. Tune timing if needed.

---

## 7. Consent architecture proposal

Five consent surfaces, each with its own version and storage.

| Surface | Trigger | Where stored | Versioning |
|---|---|---|---|
| **Apple Sign In consent** | Before redirect | localStorage `petwash_oauth_consent_apple` (today) → migrate to a `userConsents` table row on first successful login | Version field + timestamp + privacy-policy-version |
| **Google Sign In consent** | Before redirect | NEW — same `userConsents` table pattern | Version field + timestamp |
| **Facebook Sign In consent** | Before redirect | NEW — same pattern, until Facebook is sunset | Version field + timestamp |
| **Marketing communications consent** | First login (separate checkbox in onboarding, NOT bundled with account creation) | `users.marketingSmsConsentAt` / `marketingEmailConsentAt` / `marketingPushConsentAt` (already exists in schema) | Schema already has timestamp; add `marketingConsentVersion` column |
| **Privacy Policy + Terms acceptance** | First login / on policy version change | NEW `userPolicyAcceptances` table — userId, policyType, policyVersion, acceptedAt, ipHash, userAgent | Required version field |

**Critical CEO rule applied** (per `EGIFT_VAT_FINANCIAL_PROPOSAL.md` Architectural Rule 4): consent decisions are stored as ledger-style append-only rows, never updated in place. If the user updates their consent, we INSERT a new row with the new state, never UPDATE.

**Per the CEO's brief explicit point:** marketing consent is separate from account creation. Tickling the "create account" button does NOT auto-opt-in to marketing communications. The marketing consent is a separate, optional checkbox shown after first login.

**Per the CEO's brief explicit point:** provider onboarding consent is separate from pet-owner consent. The provider-onboarding form has its own consent surface for the business agreement, ID document handling, KYC processing, etc. — distinct from a customer's marketing consent.

---

## 8. Trusted-device architecture proposal

### 8.1 What exists today

- `client/src/lib/deviceTrust.ts` — `trustDevice()` + `isDeviceTrusted()` library.
- 30-day window.
- Stored in localStorage (implicit).
- Used by MFA gate to skip step-up on trusted devices.

### 8.2 What the rebuild adds

- **`userDevices` table** (new) — userId, deviceId (UUID), deviceName (browser-derived: "iPhone 14 / Safari"), createdAt, lastUsedAt, trustedUntil, revokedAt.
- **First-login flow** — after Firebase auth, server records the device fingerprint hash + last-used timestamp.
- **Revoke from settings** — `/account/devices` page (new) lists all trusted devices with "Sign out from this device" + "Revoke" buttons.
- **"Sign out from all devices"** — clears all `userDevices` rows for the user, forces re-auth everywhere.
- **Trusted device expires** — after 30 days of no activity, the row is marked `revokedAt`. User must re-authenticate.

### 8.3 Privacy posture

- Device fingerprint is a hash (SHA-256 of UA + screen size + timezone + accept-language), not a raw fingerprint.
- IP address is hashed and stored only for security review (anomaly detection), not for advertising.
- Device names are user-readable and editable.

### 8.4 Admin / executive safeguards

- Admin and provider accounts cannot use trusted-device shortcuts for step-up MFA on sensitive operations. The 30-day trust does not weaken privileged actions.
- Sensitive operations (per `EGIFT_VAT_FINANCIAL_PROPOSAL.md` admin tooling proposal) still require fresh OTP step-up at the moment of action regardless of device trust.

---

## 9. Profile-completion architecture proposal

### 9.1 The "anonymous USER" prevention rule

Per the CEO's brief: never create a broken profile row.

**Current state (verified):** the codebase already enforces this. `SignUp.tsx:91-92` blocks profile creation for phone-auth users until they provide first/last name. Email signup requires an email. OAuth providers always carry email or sub-identifier.

**Proposed reinforcement:** make this rule a documented architectural invariant, not just a happenstance of the current code. Add a server-side check in `/api/auth/account-status`:

```
If Firebase user exists but no users row exists yet:
  → return status: 'new', nextUrl: '/onboarding'
If users row exists but firstName is null:
  → return status: 'partial', nextUrl: '/onboarding/profile'
Else:
  → return status: 'existing', nextUrl: <role-aware dashboard>
```

The personalized homepage greeting ("ברוך הבא, Nir") only fires when `users.firstName` is non-null. Otherwise the page shows the unauthenticated state and routes to onboarding.

### 9.2 Unified onboarding flow

`/onboarding` (new), three steps:

1. **First name + last name** (required).
2. **Second contact method** — if signed up via email, ask for phone; if signed up via phone, ask for email. Optional but encouraged.
3. **Account type** — Customer (default) or Provider. Provider selection routes to `/provider-onboarding` (the existing detailed form).

Each step has a Skip button (except first name). Each step's data is saved on advance. User can leave and resume.

### 9.3 Sticky-path resume

Same as the executive access audit (PR 277) §1.7 — if user is mid-onboarding and clicks the gold profile icon, the sticky-path guard returns them to the form, not to a dashboard.

---

## 10. Account settings architecture proposal

New page `/account/settings` (or extend the existing `/my-account` page) with the CEO's full list:

- Update name (firstName, lastName)
- Update email (with verification)
- Update phone (with OTP confirmation)
- Manage login methods: list of connected providers (Apple / Google / Email / Phone / Passkey). Connect or disconnect. Cannot disconnect the last one.
- Trusted devices list (§8.2).
- Sign out from this device.
- Sign out from all devices.
- Delete account request (Israeli Privacy Protection Law right of erasure — must be wired to a workflow, not auto-delete).
- Privacy data export request (Israeli Privacy Protection Law right of portability — must produce a structured export).

Each destructive action requires fresh OTP confirmation, regardless of trusted-device state.

---

## 11. Security rules from the CEO brief — confirmed by audit

- "No password storage by PetWash™ unless absolutely required." — already true. Firebase Auth stores password hashes, not PetWash's server. Migration to passwordless-first reduces this exposure further.
- "Firebase Auth / Identity Platform compatibility first." — already true.
- "Admin/executive accounts require stronger protection." — already true via MFA gate. Reinforce by not weakening MFA for trusted devices on admin accounts.
- "Provider accounts require stronger verification than pet-owner accounts." — already true via `/provider-onboarding` KYC form. Reinforce by requiring a real second contact method on provider accounts (no phone-only providers).
- "No frontend-only trust decisions." — partially true; the `VITE_ADMIN_EMAILS` build-time check is a frontend-only trust decision and should be removed per the executive access audit (PR 277, P1-7).
- "No role assignment from client input alone." — already true. Roles are minted by the server post-login decider.

---

## 12. UX standard from the CEO brief — assessment

The CEO references Apple / Uber / Airbnb / Revolut / Tesla as the target. The agent's visual assessment of the current `/signin` page rates it "premium minimalist, closer to Airbnb / Uber than Firebase demo." This is a good starting position, not a starting-from-zero.

What remains to close the gap:

- Migrate SignIn.tsx + SignUp.tsx + the new Welcome screen to Phase B2 design tokens (`ink-900`, `stage-white`, Inter sans, no gold-gradient hex literals).
- Apply consistent button geometry (sharp 2px corners, solid black, no gradients) per Phase B2 conventions.
- Remove decorative animations beyond the calm fade-in.
- Eliminate the 2200-line mega-component by splitting SignIn into smaller per-provider sub-components.

---

## 13. Rollout PR phases

Each phase is one small, independently-revertable PR.

| Phase | Scope | Effort | Risk | Depends on |
|---|---|---|---|---|
| **0** | This audit doc + CEO + Israeli legal counsel review of consent text | 0 (doc only) | None | Nothing |
| **1** | Reduce Google OAuth scopes from `profile, email, calendar, contacts` to `profile, email`. Update `iosAuthHandler.ts:124-125` + `PremiumGoogleOAuthConsent.tsx` permission text + a brief privacy-policy version bump if the Privacy Policy currently lists Calendar/Contacts scopes. | ~2-3 hours | LOW (scopes can only narrow without breaking existing flows) | Phase 0 |
| **2** | Remove TikTok + Instagram from `OAuthConsentDialog` enum. Clean up dead code. | ~30 min | None (dead code removal) | Phase 0 |
| **3** | New `/welcome` route + Welcome screen component per §4. Reuses existing OAuth providers + passkey conditional UI. Phase B2 design tokens. Hamburger menu CTA points here. /signin and /signup still functional for deep links. | ~10-12 hours | MEDIUM (new route, new visual; deploy preview required) | Phase 0 + Phase B2 tokens already merged |
| **4** | New `/api/auth/account-status` endpoint + the merged sign-in/sign-up routing on the Welcome screen. /signin and /signup deprecated in UI but URLs continue to redirect. | ~4-6 hours | MEDIUM (changes core auth routing — needs careful QA on every provider path) | Phase 3 |
| **5** | New `/onboarding` unified flow per §9.2. Replaces the implicit "land on /my-account and hope" pattern. | ~6-8 hours | MEDIUM (new route, new component, profile-creation gates) | Phase 4 |
| **6** | New `userConsents` table + Privacy Policy / Terms acceptance flow + marketing-consent-separate UI. Israeli legal counsel must approve every consent string before this ships. | ~6-8 hours | MEDIUM-HIGH (legal text changes) | Phase 0 lawyer review |
| **7** | `userDevices` table + `/account/devices` page + "Sign out from all devices" + "Revoke" actions. | ~6-8 hours | MEDIUM | Phase 4 |
| **8** | Account settings page extension per §10. | ~8-10 hours | MEDIUM | Phase 4, 7 |
| **9** | Facebook UI hidden from Welcome screen. Provider wiring stays for existing Facebook-authenticated users to log back in. | ~1 hour | LOW | Phase 3 |
| **10** | SignIn.tsx + SignUp.tsx visual migration to Phase B2 tokens. Split the 2200-line file into smaller components. | ~8-10 hours | MEDIUM | Phase 4 (since UI is being replaced anyway) |

**Recommended order:** 0 → 1 → 2 (small wins, no UI changes) → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10.

**Total estimated effort:** ~50–70 engineering hours across all phases. Most can ship in parallel teams.

---

## 14. Rollback plan

Each phase is independently revertable.

- **Phase 1 rollback** — revert the scope reduction in `iosAuthHandler.ts`. Google reverts to requesting Gmail + Contacts + Calendar. No data loss.
- **Phase 2 rollback** — restore TikTok + Instagram enum values. No user-facing impact.
- **Phase 3 rollback** — remove the `/welcome` route. Hamburger CTA reverts to `/signin`. Users who bookmarked `/welcome` get a 404 — acceptable since the route is new.
- **Phase 4 rollback** — `/api/auth/account-status` becomes a no-op return-200. `/signin` and `/signup` continue to work because their URLs were never removed.
- **Phase 5 rollback** — `/onboarding` route remains but is unreferenced. Users who land there manually still complete their profiles. No data loss.
- **Phase 6 rollback** — `userConsents` table stays (data is valuable). The UI surface is rolled back. New users default to opt-out marketing per default.
- **Phase 7 rollback** — `userDevices` table stays. `/account/devices` page is hidden. Existing trusted-device behavior (30-day cookie + library) unchanged.
- **Phase 8 rollback** — account-settings extension reverted to current /my-account behavior.
- **Phase 9 rollback** — Facebook button reappears on Welcome screen.
- **Phase 10 rollback** — visual revert to current 2200-line SignIn.tsx. No functional change.

**Global rollback (worst case):** the entire rebuild can be reverted by reverting Phases 3–10 in reverse order. Phases 0–2 are doc / cleanup and don't need rolling back. The underlying auth providers (Google, Apple, Facebook, Phone, Email, Passkey) are not touched — they're already wired in the current code. The rebuild is a UI + flow layer on top.

---

## 15. Decisions awaiting CEO

A. **Approve the social login recommendation matrix in §3.** Specifically: keep Apple + Google + Phone + Email + Passkey; deprecate Facebook in the UI (Phase 9); never add TikTok or Instagram. Per Apple Guideline 4.8, Apple stays mandatory.

B. **Approve the Welcome screen design in §4.** Specifically: four-button vertical layout, Apple-first order, no big forms upfront, passkey conditional UI auto-firing.

C. **Approve the `/onboarding` unified flow in §9.2.** Specifically: first-name required, second-contact-method encouraged, account type selection, sticky-path resume.

D. **Approve the consent architecture in §7.** Specifically: separate marketing consent from account creation, separate provider-onboarding consent from customer consent, append-only `userConsents` storage. **Israeli legal counsel must review every consent string before any of these ships.**

E. **Approve the trusted-device architecture in §8.** Specifically: 30-day window, revoke from settings, no weakening of admin MFA.

F. **Approve the rollout order in §13.** Default: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Phases 1, 2, 9, 10 can swap order without dependency violations.

G. **Confirm "remove Facebook" decision** (Phase 9). Recommended for Israeli market + privacy posture, but it's a strategic call, not a technical one.

H. **Confirm scope** — this is the auth-and-onboarding rebuild, separate from the executive access stabilization (PR 277). The two workstreams should be coordinated but ship independently.

---

## 16. What this PR (the doc) does NOT do

- Does not modify `SignIn.tsx`, `SignUp.tsx`, `AuthProvider.tsx`, `iosAuthHandler.ts`, `passkey.ts`, or any code file.
- Does not constitute legal advice.
- Does not replace Israeli legal counsel's review of every consent string and Privacy Policy clause that goes live.
- Does not commit to a specific deploy date.
- Does not change any consent that's currently stored.

---

## 17. References

### External sources

- [Apple Developer — App Store Review Guidelines §4.8](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Developer News 2019-09-12 — New Guidelines for Sign in with Apple](https://developer.apple.com/news/?id=09122019b)
- [MojoAuth — 10 Best Firebase Auth Alternatives 2026](https://mojoauth.com/blog/10-best-firebase-auth-alternatives) (Firebase passkey limitations)
- [Firebase iOS SDK issue #11548 — Passkey support feature request](https://github.com/firebase/firebase-ios-sdk/issues/11548)
- [passkeys.dev — iOS reference](https://passkeys.dev/docs/reference/ios/)
- [State of Passkeys on iOS 2026](https://state-of-passkeys.io/ios)
- [SociaVault — Instagram API Deprecated 2026](https://sociavault.com/blog/instagram-api-deprecated-alternative-2026)
- [TikTok Developers — OAuth User Access Token Management](https://developers.tiktok.com/doc/oauth-user-access-token-management)

### Internal predecessor docs

- `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` — exec access layer (PR 277)
- `client/src/__audits__/p0-admin-login-google-safari.md`
- `client/src/__audits__/p0-mobile-account-routing.md`
- `docs/EGIFT_VAT_FINANCIAL_PROPOSAL.md` §0a — the 10 architectural rules (consent storage discipline)

### Code refs (verified during audit)

- `client/src/pages/SignIn.tsx` (2200-line mega-component)
- `client/src/pages/SignUp.tsx` (with T12 phone name-collection gate at line 91–92)
- `client/src/auth/AuthProvider.tsx` (Firebase init, claims hydration, session bootstrap)
- `client/src/auth/passkey.ts` (WebAuthn / passkey)
- `client/src/lib/iosAuthHandler.ts:120–160` (OAuth provider factories)
- `client/src/components/PremiumGoogleOAuthConsent.tsx` (Gmail + Contacts + Calendar scopes — needs reduction)
- `client/src/components/AppleOAuthConsent.tsx` (clean, minimal — keep)
- `client/src/components/OAuthConsentDialog.tsx` (generic Facebook fallback + dead TikTok/Instagram enum entries)
- `client/src/lib/deviceTrust.ts` (existing 30-day device trust)
- `client/src/lib/postLoginCoordinator.ts:146+` (single-flight post-login dedup)
- `client/src/hooks/useAccountNavigation.ts:78–166` (role-aware destination resolver)
- `shared/schema-unified-platform.ts:87–95` (marketing consent timestamps already in schema)

---

**End of audit. No code, no schema, no infrastructure changed. Awaiting CEO answers to Decisions A through H in §15, plus Israeli legal counsel review of every consent string before Phase 6 implementation.**
