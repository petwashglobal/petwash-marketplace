# OTP: Twilio Verify vs. Own-Code Manual — Decision Brief

**Task**: #181 (CEO OTP brief §6)
**Date**: 2026-08-31
**Status**: Read-only audit + recommendation. No code change.

---

## Current state (verified in source)

PetWash generates **every** OTP itself and sends it via Twilio **Messaging**
(and, for email, via `VerificationEmailDelivery` → SendGrid). Twilio's
Verify API is **not used anywhere**.

Own-code call-sites found:

| File | Line | Snippet | Notes |
|---|---|---|---|
| `server/services/TwilioSMSService.ts` | 320-321 | `crypto.randomInt(900000)` | The generic SMS-OTP path used by phone verification and mobile 2FA. |
| `server/services/UnifiedVerificationService.ts` | 224 | `crypto.randomInt(100000, 1000000)` | The unified verification purpose registry — 9 purposes (login/signup/change_email/…) all share this generator. |
| `server/services/TransactionOTPService.ts` | 54 | `crypto.randomInt(900000)` | Money-moving transaction OTP (guest checkout / high-risk). |
| `server/services/TwoFactorAuthService.ts` | 12-13 | `crypto.randomInt(900000)` | TOTP setup + step-up. |

Search for Twilio Verify API markers (`verify.services`, `VerifyV2`,
`verify/services`) — **zero matches**.

## What we own vs. what Verify would own

We currently own, per own-code path:
- 6-digit code generation (crypto.randomInt) — 4 duplicates of the same
  formula.
- Hash + persist (`verification_challenges.code_hash`).
- Expiry (`expires_at`, TTL 300s in every purpose today).
- Attempt cap + throttle (`attempts` / `max_attempts`, rate-limit
  middleware separately).
- Resend cool-down (per-service, no shared implementation).
- Delivery to SMS via Twilio Messaging or email via SendGrid.
- Locale selection (currently: bilingual he+en concatenated — being
  fixed by task #179's OtpMessageTemplateCatalog).
- Autofill format (currently: none — being fixed by task #183).

Twilio Verify would replace the first six bullets (generate + hash +
expire + throttle + resend + deliver) with one API call to
`client.verify.v2.services(SID).verifications.create({ to, channel })`.
Verify handles the number, hashing, expiry, retries, throttling, and
delivers via the same Twilio Messaging pool we already use — plus WhatsApp
and voice fallback out of the box.

## Doctrine constraint the CEO stated (§6)

> "PetWash's backend must still maintain the business purpose of the
> verification. Twilio knowing that code 123456 is valid isn't
> sufficient — we need to know what the customer is verifying."

Moving to Verify does NOT remove the need for
`verification_challenges` — that table remains the source of truth for
`(user, purpose, entity_ref, verified_at)`. Verify only replaces
the `code_hash` / expiry / attempts columns. The purpose row is still
ours; the Verify SID is one more foreign key on it.

## Pros / cons

### Move to Twilio Verify

Pros:
- **Kills 4 duplicate code-generation call-sites.** One
  audit target instead of four.
- **Free re-use of Twilio's fraud + rate-limit brain** (blocks known
  fraud numbers, obvious brute-force patterns) — we currently rely
  on `SmsAbuseDetector` alone.
- **WhatsApp + voice fallback** without wiring them ourselves — Verify
  ships with them.
- **iOS AutoFill format** is Verify's default template (Verify emits
  Apple's recommended body). Task #183's compliance sweep still runs,
  but drift is much less likely.
- **Locale support** is per-service on Verify (Verify has 30+ localised
  message templates including `he-IL`) — we would still layer our
  purpose-specific one-liner from `OtpMessageTemplateCatalog` for
  the branded custom text, but generic phrasing gets Verify's own.
- **Cost** — Verify per-verification pricing is comparable to
  Messaging + free retries; net wash for us because we currently pay
  for every retry SMS on our own.

Cons:
- **Verify's message templates are constrained** — custom body support
  exists via "Custom Template" but adds carrier certification
  overhead in Israel. Our branded body ("Pet Wash™: קוד האימות…")
  MAY have to move to a Verify Custom Template + approval cycle.
- **Additional external dependency in the verify path.** Twilio Verify
  is a separate SKU from Messaging — an outage on Verify breaks all
  OTP even if Messaging is up. Own-code today has one dependency (SMS
  transport); Verify adds a second layer.
- **Migration surface**: 4 call-sites × N callers each = every
  `startVerification` / `verifyChallenge` handler must swap the
  hash/expiry path for Verify SID persistence. Non-trivial refactor.
- **PII in logs**: Verify logs the destination number on Twilio's
  side; already true for Messaging too, so no net change, but worth
  noting for the PII sweep.
- **Israeli carrier certification** must be re-run for any Verify
  Custom Template.

### Keep own-code manual (status quo, but consolidated)

Pros:
- **Zero external migration**. Everything stays in-repo.
- **Full control** over the message body (already exercised in
  `OtpMessageTemplateCatalog` #179).
- **One fewer external SPOF** on the critical auth path.

Cons:
- **We still own the security posture** — brute-force protection,
  attempt counting, rate limits are ours to keep correct. Any drift
  is a P0 incident.
- **4 duplicate generators** — dedupe would take a smaller refactor
  than a full Verify migration, but the duplication is real today.
- **No WhatsApp / voice fallback** — must be built.
- **iOS AutoFill drift** — must be pinned by our own regression test
  (task #183 does this).

## Recommendation

**Consolidate the own-code path first (small refactor), then
evaluate Verify migration as a separate P1 lane** — for these reasons:

1. The CEO's own §6 warning (Verify does not remove the purpose
   layer) means the migration is not "flip a switch" — it's
   "replace hash/expiry/attempts across four services while keeping
   the purpose registry". Doing it AFTER the P0-CEP OTP brief is
   settled reduces the number of variables changing at once.

2. The four `crypto.randomInt(100000, 1000000)` duplicates are a
   real code-quality smell that we can fix in-place today without
   any Twilio config: introduce `generateOtpCode()` in a new
   `shared/auth/otpCodeGeneration.ts` and delete the three duplicates.
   That is a low-risk win the Verify decision does not block.

3. The template + channel + autofill + screen-spec work already
   shipped (tasks #179 / #180 / #183 / #184) is Verify-agnostic —
   the same evaluators run whether the code is ours or Twilio's.

4. When we do move to Verify, the delta becomes much smaller:
   one `generateOtpCode` call-site to replace with a Verify API call,
   one storage adapter to swap. The refactor becomes tractable.

**Next task (queue as a follow-up if the recommendation is accepted)**:
extract `generateOtpCode()` into `shared/auth/`, replace the four
duplicates, add a source-anchored ban on new `crypto.randomInt` OTP
generators. No behaviour change; delta ≤ 20 lines net.

**Human decision required from CEO**:
- Accept the recommendation and queue the small consolidation task, or
- Green-light the full Verify migration now (accepting the constraint
  that our branded template needs Verify Custom Template certification).
