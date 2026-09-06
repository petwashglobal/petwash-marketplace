# Pet Wash verification — site-wide consolidation matrix

**Audited 2026-09-06 against `main`.** Every row was read in source, not taken
from a previous audit. Production flag state was read live from
`GET /api/verification/status`.

The product rule: **one** Pet Wash verification system —
`VerificationFlow` → `/api/verification/*` → `UnifiedVerificationService` →
`verification_challenges` → purpose-specific `execute()`. The existing service
is canonical. Everything below either already sits on it, or is scheduled onto it.

---

## Where the canonical service already runs

Far more is consolidated than the client surfaces suggest, because several
bespoke-looking HTTP routes are already thin wrappers over the canonical service:

| Route | Purpose | Channel | Calls the canonical service? |
|---|---|---|---|
| `POST /api/auth/email/start` · `/verify` | `signup` \| `login` | email | **Yes** — `auth-email.ts:62` |
| `POST /api/auth/sms/start` · `/verify` | `login` | sms | **Yes** — `auth-sms.ts:175` |
| `POST /api/auth/phone/otp/resend` | `signup` | sms | **Yes** — `publicAuthRoutes.ts:1745` |
| `POST /api/verification/start` · `/verify` · `/resend` | all | per policy | **Yes** — canonical surface |
| account closure | `close_account` | email | **Yes** — `account-management.ts:91` |
| 2FA enable / disable | `enable_2fa` / `disable_2fa` | email | **Yes** — `mfa.ts:116` / `:333` |
| email change | `change_email` | email | **Yes** — `profile-settings.ts:629` |

## Production flag state (live, 2026-09-06)

| Purpose | Flag | Live |
|---|---|---|
| login | `UNIFIED_VERIFICATION_LOGIN_ENABLED` | **ON** |
| signup | `UNIFIED_VERIFICATION_SIGNUP_ENABLED` | **ON** |
| egift_redeem | `UNIFIED_VERIFICATION_EGIFT_REDEEM_ENABLED` | off |
| change_email | `UNIFIED_VERIFICATION_CHANGE_EMAIL_ENABLED` | off |
| close_account | `UNIFIED_VERIFICATION_CLOSE_ACCOUNT_ENABLED` | off |
| enable_2fa / disable_2fa | `..._ENABLE_2FA_ENABLED` / `..._DISABLE_2FA_ENABLED` | off |
| payout | `UNIFIED_VERIFICATION_PAYOUT_ENABLED` | off |

Master `UNIFIED_VERIFICATION_ENABLED` is **ON**.

> **`GiftActivate.tsx:99` already calls `/api/verification/start` with
> `purpose: 'egift_redeem'` — and that flag is OFF in production.** That call
> returns `503 PURPOSE_FLAG_DISABLED` today. Flipping the flag is a
> product decision, not a code change; it is listed as an owed action below.

---

## The migration matrix

`Target` is always `VerificationFlow` + `UnifiedVerificationService`. The
column that matters is **Gap** — what has to change for that to be true.

| # | Surface | Purpose | Channel today | Backend today | Gap |
|---|---|---|---|---|---|
| 1 | `SignUpLuxury.tsx` — email signup | `signup` | email | canonical (via `/api/auth/email/start`) | UI only: bespoke code screen → `VerificationFlow` |
| 2 | `SignUpLuxury.tsx` — mobile signup | `signup` | sms | canonical (via `/api/auth/sms/*`) | UI only |
| 3 | Passwordless login | `login` | email / sms | canonical | UI only |
| 4 | `GiftActivate.tsx` | `egift_redeem` | **sms, hard-coded** | canonical | UI + flip flag + let policy choose email first (SMS cost) |
| 5 | `MyAccount.tsx` — email change | `change_email` | email | canonical | UI only |
| 6 | `MyAccount.tsx` — phone change | **`change_phone`** | sms | **canonical** as of 2026-09-06 | UI only. `POST /settings/phone/{request,confirm}-change` now mirror the email pair; `PATCH /api/user/profile` refuses a phone change |
| 7 | `AccountSecurity.tsx` — 2FA | `enable_2fa` / `disable_2fa` | email | canonical (`mfa.ts`) | UI + flip flags |
| 8 | Account closure | `close_account` | email | canonical | UI + flip flag |
| 9 | `ProviderOnboarding.tsx` | *none yet* | sms | **`/api/provider/phone/{send,verify}-otp`** — bespoke, 0 canonical calls | Needs the `change_phone` / a `provider_phone` purpose, then migrate |
| 10 | `OnboardingVerification.tsx` | *none yet* | email + sms | **`/api/onboarding-verification/*`** — bespoke, 0 canonical calls | Largest single migration (667-line component, 5 endpoints incl. a magic link) |
| 11 | `useTransactionOTP.ts` / `TransactionOTPModal.tsx` | *none yet* | sms | **`/api/transaction-otp/*`** — bespoke, 0 canonical calls | This is the money step-up. Needs `payout`-style purpose binding + a short-lived proof |
| 12 | `israeli-2025-esign.ts` `otp/{send,verify}` | *none* | sms | bespoke | **Out of scope — deliberately.** Legal e-signature OTP is evidence under Israeli e-sign rules; consolidating it changes an evidentiary chain and needs the CLO, not a refactor |
| 13 | `pin-auth` / `PinKeypad` / `TransactionPinModal` | n/a | device PIN | `pin-auth.ts` | **Not an OTP.** A device PIN is a local re-auth factor, not a delivered code. Leave it |
| 14 | `webauthn` / passkey / Face ID | n/a | platform | `webauthn` routes | **Complementary, not competing.** Sits ABOVE codes in the returning-user ladder |

---

## Channel policy — now declared and enforced server-side

Added to `PurposeDefinition`: `allowedChannels`, `recommendedChannel`,
`provesDestinationOwnership`. Enforced in `assertChannelAllowed()` on `/start`
and on any resend channel switch. Published on `/api/verification/status` so
the UI can render the right options — but the UI reading it is a convenience,
never the security boundary.

| Purpose | Allowed | Recommended | Why |
|---|---|---|---|
| `login`, `signup`, `egift_redeem` | email, sms, whatsapp | **email** | Email is effectively free; SMS is not. Phone stays a real fallback |
| `change_email` | **email only** | email | The challenge exists to prove control of the NEW mailbox. Sending it anywhere else proves nothing |
| `enable_2fa`, `disable_2fa`, `close_account`, `payout` | email, sms, whatsapp | **email** | Email leads on cost, but a phone fallback stays — a customer locked out of email must still be able to reach their own money |

| `change_phone` | **sms, whatsapp** | sms | The challenge proves control of the NEW handset. An email code proves control of a mailbox, which says nothing about the number being claimed |

`change_phone` is phone-only with `provesDestinationOwnership: true`, by the
same logic that makes `change_email` email-only — pointed the other way. Both
channels reach the same number, so allowing both does not weaken it; the
invariant the tests enforce is that a prove-ownership purpose never mixes
destination KINDS.

### The generic profile bypass — closed 2026-09-06

`PATCH /api/user/profile` (`user-profile.ts`) wrote **both** `users.phone` and
`users.twoFactorEnabled` straight from the request body. The sibling endpoint
`PATCH /api/user/settings/profile` had guarded the phone since the
mobile-change audit via `decideMobileWrite()` — which made that guard one route
away from pointless. `MyAccount.tsx:2077` let the user edit `phone` into
`editedProfile`, and `:1634` PATCHed the whole object, so this was live.

Both are now refused with a code naming the canonical route. A first-set stays
allowed (`/booking-contact` depends on it); a *change* does not.

**A third phone-change mechanism still exists** and is not yet consolidated:
`transaction-otp`'s `profile_phone_change` purpose
(`server/services/TransactionOTPService.ts:27`). It is row 11's problem — it
needs the step-up proof before it can move.

---

## Owed, not done in this change

1. **Flip the five dark flags** once each surface is migrated and smoke-tested:
   egift_redeem, change_email, close_account, enable_2fa/disable_2fa, payout.
2. ~~Add a `change_phone` purpose~~ **DONE 2026-09-06.** Row 9 (provider
   onboarding) can now migrate onto it. Note the flag
   `UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED` must be ON, or phone changes are
   refused entirely — which is the correct fail-closed posture, but it does
   mean the flag has to be set at the same deploy as the client migration.
3. **Migrate rows 9–11.** Row 11 (transaction OTP) is the money one: the
   verification must mint a short-lived, purpose-bound proof that the money
   service then checks. The OTP must never itself mutate money.
4. **Analytics.** Counters exist per channel in `otp_events`, but there is no
   dashboard for verify-success rate, resend count, fallback rate or SMS cost
   avoided. No OTP digits in any of it.
5. **Real-browser journeys.** The Playwright suite only became runnable in
   #2281 and still is not in CI, so none of the 18 journeys the brief lists
   (mobile autofill, paste-from-email, refresh mid-challenge, multiple tabs,
   iPhone Safari, Android Chrome) has an executed proof yet.
