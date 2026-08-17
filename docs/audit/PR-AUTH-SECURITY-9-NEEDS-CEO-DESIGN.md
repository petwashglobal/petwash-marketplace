# PR-AUTH-SECURITY-9 — NEEDS-CEO-DESIGN

Sections marked NEEDS-CEO-DESIGN per the fire-order rule
("If any single section needs more than 500 LOC or touches money code, STOP
that section, mark it NEEDS-CEO-DESIGN, and continue the other sections").

---

## §6 Email change — dedicated verified-identity flow

**Why paused:** a lawful email change is a THREE-step atomic flow that
touches auth, email delivery, session revocation, audit logging, and a new
migration for a short-lived pending-change token. Doing it right is well
over the 500-LOC ceiling and adds a new dependency surface (SendGrid template
+ token cryptography).

**Current state (audit):** grep found no `/api/auth/change-email` endpoint on
`origin/main`. Any client that changes an email today does so via
`PATCH /api/user/profile`, which is exactly the anti-pattern the CEO asked us
to eliminate (no re-auth, no verification of the NEW address, no atomic
`email + email_verified` flip).

**Design shape needed (blocks Lane A):**

1. `POST /api/auth/change-email/request` — requires strong re-auth (session
   `auth_time` ≤ 10 min OR `reauth=true` header carrying a fresh id-token).
   Body `{ newEmail }`. Server:
   - Verifies `newEmail` is not already used (no duplicate identity).
   - Persists a row in `email_change_requests { user_id, new_email,
     token_hash, expires_at, ip, ua }` — needs schema migration (approval
     required).
   - Sends a signed verification link to `newEmail` (SendGrid template).
2. `POST /api/auth/change-email/confirm` — public, body `{ token }`.
   Server:
   - Verifies token hash + not expired + not consumed.
   - Atomic transaction: `users.email = newEmail`, `email_verified = true`,
     `email_verified_at = now()`; call
     `firebaseAdmin.auth().updateUser(uid, { email, emailVerified: true })`;
     revoke refresh tokens; mark request consumed; write audit event.
   - Response 200 → client re-auth flow.
3. Client `SecuritySettings.tsx` panel: two-step UI ("we've sent a link to
   your NEW email" → "check inbox" → done). Existing verified-email chip on
   the Security status card refreshes off `/api/security/status`.

**Estimated diff:** ~650 LOC across:
- `shared/schema.ts` (+1 table, migration `NNNN_email_change_requests.sql`)
- `server/routes/auth-change-email.ts` (new, ~250 LOC)
- `server/lib/emailChangeTokens.ts` (new, ~80 LOC)
- `server/services/emails/ChangeEmailTemplate.ts` (new, ~40 LOC)
- `client/src/components/security/ChangeEmailPanel.tsx` (new, ~180 LOC)
- Tests + wiring.

**Ask CEO:**
- Approve schema migration `email_change_requests`.
- Approve SendGrid template ID + copy (Hebrew + English).
- Confirm re-auth window (10 min? or require fresh id-token for every request?).
- Confirm whether staff/admin should skip verification (probably NO).

---

## §7 Mobile change — dedicated SMS-verified flow

**Why paused:** identical structure to §6 but with SMS OTP instead of an
email link, plus the E.164 canonicalization must happen on the SERVER (never
trust the client to normalize). Also over 500 LOC when done right.

**Current state (audit):** no `/api/auth/change-mobile` endpoint on
`origin/main`. Mobile changes today happen via a generic profile PATCH — no
verification of the NEW number, no atomic write.

**Design shape needed:**

1. `POST /api/auth/change-mobile/request` — strong re-auth; body
   `{ newMobile }`. Server:
   - Normalizes to E.164 (`shared/lib/phoneE164.ts` already exists — reuse).
   - Rejects duplicate.
   - Persists `mobile_change_requests { user_id, new_mobile_e164,
     otp_hash, expires_at, attempts }` — needs migration.
   - Sends 6-digit OTP via `TwilioSMSService` (existing).
2. `POST /api/auth/change-mobile/verify` — body `{ otp }`. Server:
   - Verifies OTP + not expired + attempts < 5.
   - Atomic tx: `users.phone_e164 = newMobile`, `phone_verified = true`,
     `mobile_verified_at = now()`; call
     `firebaseAdmin.auth().updateUser(uid, { phoneNumber: newMobile })`;
     revoke refresh tokens; audit.
3. Client panel mirrors §6.

**Estimated diff:** ~550 LOC across:
- `shared/schema.ts` (+1 table)
- `server/routes/auth-change-mobile.ts` (~230 LOC, reuses TwilioSMSService)
- `client/src/components/security/ChangeMobilePanel.tsx` (~180 LOC)
- Tests + wiring.

**Ask CEO:**
- Approve schema migration `mobile_change_requests`.
- Confirm OTP length (6? 4?) and expiry (5 min? 15 min?).
- Confirm behavior if new mobile is on a country outside APPROVED_COUNTRIES.
- Confirm whether staff/admin should skip verification (probably NO).

---

## Ship order recommendation

Sections 1, 2, 3, 4, 5, 8 are already on branch `claude/pr-auth-security-9`
and pushed. §6 and §7 can be a separate PR pair (each fully self-contained)
once the CEO signs off on the design shape above. Attempting them inside
the current PR would violate the "one purpose per PR" rule from
`petwash-pr-guardian` and blow the 500-LOC ceiling.
