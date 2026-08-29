# Lane A — SignUpLuxury State Machine Audit

**Branch:** `auth-master-lane-a-progressive-signup` (off `origin/main`)
**Prepared:** 2026-08-29 (CEO FLY MODE II — AUTH CONVERSION P0)
**Purpose:** map the current SignUpLuxury signup contract, name the
contradictions, and lock the canonical state machine that replaces it.

---

## 1. Contradictory contracts today (client/src/pages/SignUpLuxury.tsx on `main`)

Two different "ready" predicates coexist in the same 3035-line file:

| Predicate | Line | Rule | Which surface uses it |
|-----------|------|------|-----------------------|
| `hasContact = phoneValid \|\| emailValid` | 1480 | either contact is enough | `readyForSubmit` (single-contact Continue) |
| `readyForSubmit = !busy && hasContact && (authMode==='login' ? true : consentOk)` | 1484 | signup CTA on one contact + terms | Continue button on the primary flow |
| `bothContacts = phoneValid && emailValid` | 1490 | phone AND email | `startJoin()` guard |
| `joinReady = !busy && bothContacts && passwordValid && consentOk && namesValid` | 1501 | phone + email + password + terms + first+last name | Join Now button |
| `loginReady = !busy && emailValid && password.length >= 1` | 1504 | email + password | Login Now button |

Two different submit functions:

- `startSignup()` at line 1508 — proceeds on the FIRST valid contact.
  `if (phoneValid) { setMethod('mobile'); void sendCode(); }`
- `startJoin()` at line 1518 — refuses to proceed unless `bothContacts &&
  passwordValid && isAdult`.

A user typing only a phone number reaches Continue via `readyForSubmit`
but that button (also labelled "Continue") is wired to `startJoin` on
some render paths and to `startSignup` on others, depending on which
of the ~10 `authMode` × `contactMode` × `method` × `mobileStep` ×
`emailStep` sub-branches is active. The `mobileStep` gate at line 694
demands a real 18+ DOB before sending the FIRST SMS, then the SMS
success handler at line 731/846/899 shifts to `method === 'email'`
expecting the email-code branch to run.

Comments in the same file boast "LEAN single-field entry" and "no long
form" while the render tree shows first/last name + DOB + password +
confirm + terms + marketing before the user has proven a single
contact.

## 2. State variables (partial — the 40+ that drive the flow)

Every declaration below is on `main` today.

    Flow control:
      authMode           'join' | 'login'
      manualMode         boolean
      method             'mobile' | 'email'
      contactMode        'choose' | 'phone' | 'email'
      mobileStep         boolean   (SMS-code step)
      emailStep          boolean   (email-code step)
      sent               boolean
      resendCountdown    number
      cachedEmailSessionToken   string | null
      cachedPhoneVerificationToken   string | null
    Identity fields:
      phone, email, password, confirm
      firstName, lastName, dob
      ageConfirmed18Plus, over18
      agreedTerms, acceptedMarketing
    Cross-cutting:
      twoFactor, mfaChallenge, mfaLoginInFlight (ref)
      linkState, linkPassword
      bioAvailable, showFaceIDOffer, faceIDEmail, platformAuthCapable
      emailConflictInfo
      inlineError, busy

Any interaction requires the developer to reason about the Cartesian
product of ~10 orthogonal booleans. That is the root cause of the
contradiction.

## 3. Canonical model (CEO FLY MODE II §1)

    METHOD_SELECTION
      → user picks Google / Apple / mobile / email
    AUTHENTICATING
      → provider handshake (Firebase popup/redirect/native, phone-OTP,
        email-code)
    CONTACT_VERIFY
      → OTP screen (only when the chosen method needs one — Google/
        Apple skip this)
    ACCOUNT_RESOLUTION
      → server returns { isNewUser, profileState, requiredActions,
        capabilities }
    PROFILE_COMPLETION
      → collect ONLY missing required base fields, one screen per
        action (mobile, name-if-Google-didn't-provide, DOB-if-required,
        Terms). Marketing is optional + separate.
    ACTIVATION
      → server marks account activated (both contacts confirmed when
        needed, terms accepted, DOB captured if required)
    POST_LOGIN
      → server-authoritative destination
    DONE

The server owns the `isNewUser` / `profileState` / `requiredActions`
authority (CEO §9). The client renders whatever the server says is
next — never guesses from missing fields, Firebase error strings, or
whether a password worked.

## 4. Rules of engagement (CEO §19 → §22)

- Initial signup screen contains four buttons only:
  `Continue with Google`, `Continue with Apple`, `Continue with mobile`,
  `Continue with email`. Nothing else — no name/DOB/password/consent
  UI before identity has been proven.
- After Google/Apple/phone/email succeeds and the server has responded,
  `PROFILE_COMPLETION` renders `1 of N`/`2 of N` screens containing
  ONLY the fields the server said were still missing.
- `Continue with mobile` shows a phone-only screen, then an OTP screen.
  No DOB/name/email demand before the first `Send code`.
- Provider intent (`returnTo`, `requestedService`, `firstTouch`,
  `authJourneyId`) survives across every screen. Prestige intent too.
- `preferredAuthMethod` is only persisted after BOTH Firebase success
  AND PetWash session success. Failed/cancelled attempts are never
  written.

## 5. Extraction map (Lane A shipping order)

1. **Commit 1 (this commit)** — audit doc + `progressiveSignupState.ts`
   pure helper module implementing the eight canonical states plus
   the transition matrix. Pinned with vitest — no UI touched yet.
2. **Commit 2** — server contract shim: `/api/auth/session` responds
   with `{ isNewUser, profileState, requiredActions }` (already partly
   there for the new-user branch; the intent is to make it always
   present and the ONE authority the client consumes).
3. **Commit 3** — new `SignUpProgressive.tsx` page mounted at `/signup`
   under a build flag. Legacy SignUpLuxury stays live until the new
   surface has E2E coverage.
4. **Commit 4** — Firebase test adapter gains `personas.customerNew`
   (`isNewUser:true`, missing mobile+terms) so the true-new E2E
   scenario can run.
5. **Commit 5** — true new-Google E2E lands: `/signup` → real Google
   → adapter → session `isNewUser:true` → PROFILE_COMPLETION mobile
   screen → SMS test adapter → OTP → ACTIVATION → `/pet-parent/home`.
   Same UID throughout.
6. **Commit 6** — returning-Google E2E lands: `/signin` → real Google
   → session `isNewUser:false` → `/pet-parent/home` directly. No
   AccountActivation screens, no DOB, no mobile collection.
7. **Commit 7** — phone new E2E; **Commit 8** — phone returning.
8. **Commit 9** — email new; **Commit 10** — email returning.
9. **Commit 11+** — WebKit / Chromium mobile viewport matrix.

Every commit stays under ~400 lines diff so a reviewer can hold each
in their head. Merge-decision boundary is CEO, not the branch.

## 6. Old helpers that must go (CEO §8)

    readyForSubmit
    joinReady
    bothContacts
    startSignup
    startJoin
    emailSubmit         (partial — was already dead)
    sendEmailCode       (kept but wrapped in the new state machine)
    sendCode            (kept but wrapped)
    verifyEmailCode     (kept but wrapped)
    loginWithPassword   (moved out of signup surface — sign-in page owns password)

The kept helpers survive as PRIVATE utility functions inside the new
progressive component. The exported surface is one state machine
driver plus one `render(step)` React tree.

## 7. What does NOT change

- Server `/api/auth/session` continues to accept the same POST body
  (idToken + optional consent flags). Its RESPONSE grows the strict
  `{ isNewUser, profileState, requiredActions, capabilities }` shape.
- Passkey enrolment and biometric offer stay on the security-settings
  page, not signup. The signup surface does not offer Face ID during
  first-touch.
- Preferred-auth-method persistence rule (CEO §18) is unchanged in
  policy but tightened: only save after PetWash session success.

---

**Merge posture:** the branch stays on the extraction ladder. NO
MERGE WITHOUT CEO.
