# OTP Verification-Trigger Inventory

**Task**: #182 (CEO OTP brief §9)
**Date**: 2026-08-31
**Scope**: Every place in the repo (server/, client/) that issues a
verification code (SMS or email OTP) to a user.

**Method**: source walk by the Explore agent, cross-verified against
`grep -rn 'randomInt.*100000'` and `grep -rn 'purpose:'` in
`server/services` + `server/routes` + `server/lib`.

**How to read**: "Necessary?" is the CEO's decision, not mine. The
"Recommended" column is my best read against the CEO OTP brief §3
(email-preferred where risk allows) + the actual business event.

---

## Table — every OTP trigger today

| # | Trigger | File:line | Route | Channel today | Purpose (col) | Template | Own-code / Verify | Necessary? | Recommended channel per §3 | Recommended purpose in OTP_PURPOSES |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Public signup — SMS OTP | routes/publicAuthRoutes.ts:1583 | POST /api/auth/phone/otp/send | SMS or WhatsApp | `signup` | UnifiedVerificationService:296 (unified) / RegistrationOTPService:271 (fallback) | Own | Yes | SMS (phone ownership check) | `PHONE_VERIFICATION` |
| 2 | Public phone login (legacy) | routes/publicAuthRoutes.ts:404 | POST /api/auth/phone/send-code | SMS | *(none — bypass)* | TwilioSMSService:392 | Own | Retire | (delete) | (delete) |
| 3 | Legacy 2-step login start | routes/publicAuthRoutes.ts:798 | POST /api/auth/login/2fa/start | SMS | *(none)* | TwilioSMSService:392 | Own | Retire | (delete) | (delete) |
| 4 | Canonical customer SMS start | routes/auth-sms.ts:173 | POST /api/auth/sms/start | SMS | `login` | UnifiedVerificationService:296 | Own | Yes | Email default; SMS on elevatedRisk | `LOGIN` |
| 5 | Email OTP start (signup/login) | routes/auth-email.ts:62 | POST /api/auth/email/start | Email | `signup` or `login` | VerificationEmailDelivery:85 | Own | Yes | Email (cheap channel default) | `ACCOUNT_ACTIVATION` or `LOGIN` |
| 6 | Onboarding SMS code | routes/onboarding-verification.ts:613 | POST /api/onboarding-verification/send-sms-code | SMS | *(none)* | TwilioSMSService:392 | Own | Consolidate into #1 | SMS | `PHONE_VERIFICATION` |
| 7 | Onboarding email code | routes/onboarding-verification.ts:329 | POST /api/onboarding-verification/send-email-code | Email | *(none)* | inline getEmailHtml | Own | Consolidate into #5 | Email | `EMAIL_VERIFICATION` |
| 8 | Onboarding activation email | routes/onboarding-verification.ts:809 | POST /api/onboarding-verification/send-activation-email | Email | *(none)* | buildActivationEmail | Own | Yes (first-time activation) | Email | `ACCOUNT_ACTIVATION` |
| 9 | Provider phone verify | routes/provider-phone.ts:85 | POST /api/provider/phone/send-otp | SMS | *(none — Firestore doc)* | inline | Own | Yes (payout-eligibility precondition) | SMS | `PHONE_VERIFICATION` |
| 10 | MFA enable-2FA gate | routes/mfa.ts:116 | POST /api/mfa/enroll/totp | Email | `enable_2fa` | VerificationEmailDelivery:52 | Own | Yes | Email default; SMS on elevatedRisk | `SENSITIVE_ACCOUNT_CHANGE` (or a new `TWO_FACTOR_ENABLE` — CEO to bless) |
| 11 | MFA disable-2FA gate | routes/mfa.ts:333 | DELETE /api/mfa/enrollment/:id | Email | `disable_2fa` | VerificationEmailDelivery:60 | Own | Yes | SMS (revoking a security control is high-risk) | `SENSITIVE_ACCOUNT_CHANGE` (or `TWO_FACTOR_DISABLE`) |
| 12 | Legacy MFA `/send-otp` | services/TwoFactorAuthService.ts:220/235 | POST /api/mfa/send-otp | SMS + email | *(none — Redis only)* | inline (2 templates) | Own | Retire / route through unified | Merge into #10/#11 | (as above) |
| 13 | Transaction OTP (guest checkout) | services/TransactionOTPService.ts:300/317 | POST /api/transaction-otp/send | SMS + email | *(none — Redis only)* | inline (2 templates) | Own | Yes (money-moving) | SMS if mobile verified; email fallback | `PURCHASE_CONFIRMATION` or `BOOKING_CONFIRMATION` per caller |
| 14 | Profile — change email | routes/profile-settings.ts:310 (unified) / :342 fallback | POST /api/profile/settings/email/request-change | Email | `change_email` (unified) / *(none)* on fallback | VerificationEmailDelivery:36 | Own | Yes | Email (destination) + SMS (owner) — dual per §3 elevatedRisk | `EMAIL_VERIFICATION` (destination) + `SENSITIVE_ACCOUNT_CHANGE` (owner) |
| 15 | Account close | routes/account-management.ts:91 | POST /api/account/delete | Email | `close_account` | VerificationEmailDelivery:44 | Own | Yes | SMS (destructive) — fall back to email | `CLOSE_ACCOUNT` |
| 16 | Sensitive payout gate | lib/unifiedPayoutVerification.ts:57 | (admin payout handlers) | Email | `payout` | VerificationEmailDelivery:68 | Own | Yes | SMS (money-moving) — fall back to email | `CHANGE_PAYOUT_DESTINATION` (for destination edit) or a new `PAYOUT_ACTION` (CEO to bless) |
| 17 | eGift redeem verification | routes/verification.ts:153 / gift-cards.ts:927 | POST /api/verification/start (purpose=egift_redeem) | SMS or WhatsApp | `egift_redeem` | UnifiedVerificationService:296 | Own | Yes | Email default; SMS on elevatedRisk (voucher fraud) | (new `GIFT_REDEEM` — CEO to bless; `GIFT_PURCHASE` is buyer-side) |
| 18 | Generic unified start (all purposes) | routes/verification.ts:153 | POST /api/verification/start | any | any registry purpose (incl. `diagnostic_noop`) | UnifiedVerificationService:296 / VerificationEmailDelivery:85 | Own | Yes (dispatcher only — no direct trigger) | per caller | per caller |
| 19 | Israeli 2025 e-signature OTP | routes/israeli-2025-esign.ts:309/320 | POST /api/israeli-2025-esign/otp/send | SMS or email | *(none — Redis)* | inline (2 templates) | Own | Yes (legal signature) | SMS if mobile verified; email fallback | `SENSITIVE_ACCOUNT_CHANGE` (or new `LEGAL_ESIGN`) |
| 20 | CEO free-voucher 2FA | routes/admin.ts:1010 | POST /api/admin/ceo/request-voucher | WhatsApp | *(none — Firestore)* | inline | Own | Yes (admin-only) | WhatsApp (as-is; CEO's own channel) | `SENSITIVE_ACCOUNT_CHANGE` |

Excluded (not user-auth OTPs — pickup / handoff PINs):
- `routes/walk-my-pet.ts:700` — booking `confirmationCode`
- `services/booking-engines/k9000/K9000StationBookingEngine.ts:216` — station `token`
- These are handled by `HandoffCodeSpec.ts` (task #67 in the marketplace-doctrine index) and have their own timing-safe verify path.

---

## Gaps found

### 1. Call-sites that bypass `verification_challenges` entirely (unauditable)

11 of the 20 triggers skip the unified state machine — no purpose
column, no expiry-ledger, no attempts row. Any auditor asking "did we
send this code?" cannot answer for these paths through the fintech
evidence trail:

`#2, #3, #6, #7, #8, #9, #12, #13, #14 fallback branch, #19, #20`.

Several ALSO skip `otp_events` (the fintech evidence ledger):
`#6, #7, #12, #13, #19, #20`.

`#2` writes an `otp_events` row (publicAuthRoutes.ts:427) but with no
`purpose` field.

### 2. `unifiedVerificationPurposeRegistry` uses purposes that are NOT in `OTP_PURPOSES`

The unified service ships 9 purposes (`diagnostic_noop`, `login`,
`signup`, `egift_redeem`, `change_email`, `enable_2fa`, `disable_2fa`,
`close_account`, `payout`). Zero of these match `OTP_PURPOSES` — the
two enumerations have drifted. Every real row in
`verification_challenges` today would be refused by
`evaluateOtpConsumption()` with `UNKNOWN_STORED_PURPOSE`.

Task #177 owns the reconciliation. This inventory clarifies what
needs to happen at each call-site:

- `login` → `LOGIN`
- `signup` → **either** `ACCOUNT_ACTIVATION` (first-time) **or**
  `PHONE_VERIFICATION` (if the OTP verifies the mobile) — needs CEO ruling.
- `change_email` → `EMAIL_VERIFICATION`
- `close_account` → `CLOSE_ACCOUNT`
- `payout` → `CHANGE_PAYOUT_DESTINATION` OR a new `PAYOUT_ACTION`
- `egift_redeem` → **needs a new `GIFT_REDEEM`** (distinct from
  `GIFT_PURCHASE` in OTP_PURPOSES, which is buyer-side)
- `enable_2fa` / `disable_2fa` → subsume under
  `SENSITIVE_ACCOUNT_CHANGE`, OR add two new canonical purposes
- `diagnostic_noop` → delete (it's test-only; no user-facing trigger)

### 3. 12 duplicated OTP generators (same crypto.randomInt formula)

Every trigger generates its 6-digit code with an identical
`crypto.randomInt(100000, 1000000|999999)` call. The 12 sites:

- `services/UnifiedVerificationService.ts:223`
- `services/TwilioSMSService.ts:320`
- `services/RegistrationOTPService.ts:111`
- `services/TwoFactorAuthService.ts:12`
- `services/TransactionOTPService.ts:53`
- `routes/onboarding-verification.ts:213` and `:783`
- `routes/profile-settings.ts:342`
- `routes/provider-phone.ts:63`
- `routes/admin.ts:986`
- `routes/israeli-2025-esign.ts:299`
- `lib/serviceVerificationCrypto.ts:15`

Should collapse to one `generateOtpCode()` in `shared/auth/`, with a
source-anchored ban on `crypto.randomInt` outside that file. See the
Twilio Verify decision brief (task #181) — this consolidation is the
recommended first-step BEFORE any Verify migration.

### 4. Multiple parallel email OTP templates

Independent HTML templates in:

- `services/VerificationEmailDelivery.ts` — the intended shared path.
- `services/TwoFactorAuthService.ts` — its own inline HTML.
- `services/TransactionOTPService.ts` — its own inline HTML.
- `routes/onboarding-verification.ts` — its own inline HTML.
- `routes/israeli-2025-esign.ts` — its own inline HTML.

Matches the concern flagged at `VerificationEmailDelivery.ts:12` on
2026-07-30. The `OtpMessageTemplateCatalog` shipped in task #179 is
the intended single home; every non-VerificationEmailDelivery template
should migrate to it.

---

## What the CEO can do with this table

1. **Delete triggers** (`#2, #3`, possibly `#6/#7/#12` if consolidated):
   fewer SMS sent, fewer places to audit.
2. **Bless canonical purpose mappings** for the drifted 9 (see gap #2
   above), unblocking task #177.
3. **Green-light the `generateOtpCode()` consolidation** (a small
   PR — no behaviour change, ≤ 20 lines net, adds a source-anchored
   ban on new duplicates).
4. **Decide** on the Twilio Verify question from task #181's brief.
