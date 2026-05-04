# PR-26 — Signup / Login Data Map (Coworker, plan-only)

> Read-only audit. **Do not** mutate accounts, claims, sessions, or auth flows
> from this document. The coworker uses this map to *detect* stuck signup states
> and surface them to a human approver. Any remediation must go through an
> existing reviewed admin path.

## 1. Source-of-truth boundary

PetWash holds signup state in **two stores** that must agree:

| Store        | Role                                                       | Authority                                                  |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Firebase Auth | Identity (uid, email, phone, providerData, customClaims)   | Owns proof-of-identity (OAuth, email-link, phone OTP)      |
| Firestore    | Pre-account profile draft (`users/{uid}/profile/data`)     | Captures consent flags before PostgreSQL row exists        |
| PostgreSQL   | `users` row + role/state machines                          | Owns `role`, `userStatus`, `activationStatus`, KYC, claims |

`server/services/AuthService.ts → ensureUserInPostgres()` reconciles Firebase
identity into the PostgreSQL `users` row. `server/routes/post-login.ts →
postLoginDecider()` is the single funnel that:

1. Recovers a missing PG row from Firebase (race condition recovery).
2. Backfills `termsAcceptedAt` from Firestore `acceptedTerms`.
3. Stamps consent for social-OAuth users who never saw the signup form.
4. Auto-assigns `role='customer'` for social/phone users with no intent.
5. Computes `userStatus` and writes the routing decision.

Any drift between the three stores is an observable stuck state.

## 2. Collections / tables involved

### PostgreSQL (Drizzle, `shared/schema.ts`)

| Table                    | Key signup fields                                                                                                   | Purpose                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `users`                  | `id, email, phone, role, userStatus, signupIntent, accessLevel, authProvider, emailVerified, phoneVerified, mfaEnrolled, termsAcceptedAt, privacyAcceptedAt, activationStatus, mobileVerifiedAt, emailVerifiedAt, accountActivatedAt, blocked, approvedAt, approvedBy, providerApprovedAt, staffApprovedAt, createdAt, lastLoginAt` | Canonical user record. `id` = Firebase uid.        |
| `provider_applications`  | `userId, status` ∈ {`draft`, `pending`, `pending_review`, `under_review`, `pending_resubmission`, `approved`, `rejected`} | Provider KYC track.                                |
| `staff_access_requests`  | `userId, requestedRole, status` ∈ {`pending`, `approved`, `rejected`}                                               | Staff approval queue.                              |
| `onboarding_cases`       | `userId, context, status, currentStep`                                                                              | One-row-per-user funnel state for analytics.       |
| `otp_events`             | `phoneE164, userId, eventType, otpId, createdAt`                                                                    | Registration / sign-in OTP audit trail.            |
| `sms_evidence`           | `userId, ...`                                                                                                       | Message-delivery evidence for legal/regulatory.    |
| `refresh_tokens`         | `userId, jti, deviceId, expiresAt, revokedAt`                                                                       | Mobile JWT session.                                |
| `security_events`        | `userId, eventType, ip, userAgent, riskScore, metadata`                                                             | Audit log (login_success, etc).                    |
| `audit_events`           | `actorUserId, actionType, targetType, targetId`                                                                     | Privileged-action audit.                           |

### Firestore

| Path                              | Written by                                          | Notes                                        |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| `users/{uid}/profile/data`        | Email-signup form (client) → consent fields         | `acceptedTerms`, `consentTimestamp`, `firstName`, `lastName` |
| (custom claims — Firebase Auth)   | `pull_request_review_write` admin tooling           | `roles[]` mirror used by some clients        |

### Firebase Auth

| Field            | Used by                                                        |
| ---------------- | -------------------------------------------------------------- |
| `providerData[]` | Detect social provider in `postLoginDecider`                   |
| `displayName`    | Seed `firstName` / `lastName` for social/phone signups         |
| `phoneNumber`    | Seed `users.phone` when missing                                |
| `emailVerified`  | Mirror into `users.emailVerified` (PG)                         |

## 3. Write paths (where signup state changes)

| Step                                  | File / function                                                              | Mutates                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Email/phone signup form               | client → Firestore `users/{uid}/profile/data`                                | `acceptedTerms`, `consentTimestamp`                                  |
| Firebase user creation                | Firebase Auth (client SDK)                                                   | `auth.users` (Firebase)                                              |
| Background PG row creation            | `AuthService.ensureUserInPostgres`                                           | `users` insert + `loyalty_profiles` + `wallet_accounts`              |
| Post-login funnel                     | `server/routes/post-login.ts → postLoginDecider`                             | `users.role`, `users.userStatus`, `users.signupIntent`, `users.termsAcceptedAt`, `users.privacyAcceptedAt`, `users.lastLoginAt`, `users.authProvider`, `users.deviceId`, `users.providerApprovedAt`, `onboarding_cases`, `security_events` |
| Provider draft                        | `storage.createProviderApplicationDraft`                                     | `provider_applications` insert (`status='draft'`)                    |
| Staff request                         | `storage.createStaffAccessRequest`                                           | `staff_access_requests` insert (`status='pending'`)                  |
| Email verification                    | Firebase Auth verify-email link → `auth.users.emailVerified = true`          | Mirrored into `users.emailVerified` on next login                    |
| Phone OTP send / verify               | `server/services/RegistrationOTPService.ts`                                  | `otp_events`, `sms_evidence`, Redis/in-memory rate counters          |
| JWT mobile login                      | `server/routes/auth.ts` (`/refresh`, `/logout`)                              | `refresh_tokens`                                                     |
| Social OAuth (TikTok, Instagram, …)   | `server/routes/social-oauth.ts`                                              | Firebase custom token; PG row appears via `ensureUserInPostgres`     |
| Provider approval (admin)             | admin-panel (out of signup scope)                                            | `provider_applications.status='approved'` → triggers `userStatus='provider_active'` on next login |

## 4. State machines

### `users.userStatus`  (`shared/schema.ts → USER_STATUS_VALUES`)

```
new
 → profile_incomplete   (role assigned, required fields missing)
 → profile_complete
   ↘ kyc_pending        (provider draft exists)
     → kyc_approved | kyc_rejected
   ↘ provider_pending_approval → provider_active
   ↘ staff_pending_approval    → staff_active
suspended                       (operator action; out of signup)
```

### `users.activationStatus`  (independent state machine, lines 144–152)

```
draft
 → mobile_verified  (mobileVerifiedAt set)
 → email_verified   (emailVerifiedAt set)
 → active           (accountActivatedAt set)
 → suspended | deleted
```

> ⚠️ `userStatus` and `activationStatus` evolved independently and are not
> always kept in sync — see stuck state **S5** below.

### `provider_applications.status`

`draft → pending → pending_review → under_review → approved | rejected | pending_resubmission`

### `staff_access_requests.status`

`pending → approved | rejected`

## 5. Required fields per role

From `server/routes/post-login.ts → REQUIRED_FIELDS_BY_ROLE`:

| Role        | Required                                                            |
| ----------- | ------------------------------------------------------------------- |
| customer    | `firstName, lastName, termsAcceptedAt`                              |
| loyalty     | `firstName, lastName, dateOfBirth, termsAcceptedAt`                 |
| provider    | `firstName, lastName, phone, termsAcceptedAt`                       |
| staff       | `firstName, lastName, termsAcceptedAt`                              |
| admin       | `firstName, lastName, termsAcceptedAt`                              |
| management  | `firstName, lastName, termsAcceptedAt`                              |

Any null among these triggers `userStatus='profile_incomplete'` and
`postLoginDecider` routes the user to `/complete-profile`.

## 6. Observable stuck states (detection rules)

Each rule below is **read-only** (a SELECT a coworker can run). All rules
exclude `users.blocked = true` and `users.softDeleteAt IS NOT NULL`.

### S1. Firebase identity exists, no PostgreSQL row

- **Symptom** — user can sign in but every API returns `404 USER_NOT_FOUND`.
- **Detect** — Firebase Auth `listUsers()` uid not present in
  `SELECT id FROM users`. Cross-check requires Firebase Admin SDK.
- **Recovery (existing path)** — next call to `postLoginDecider` triggers the
  race-condition recovery branch (`AuthService.ensureUserInPostgres`).
- **Stuck if** — user has not logged in for ≥ 24h since Firebase `creationTime`.

### S2. PostgreSQL row exists, role still `new` / `userStatus='new'`

```sql
SELECT id, email, created_at
FROM users
WHERE (role IS NULL OR role = 'new')
  AND user_status = 'new'
  AND created_at < now() - INTERVAL '24 hours'
  AND blocked = false
  AND soft_delete_at IS NULL;
```

Means the user landed on `/choose-role` and never picked one.

### S3. Profile incomplete > 7 days

```sql
SELECT id, email, role, last_login_at
FROM users
WHERE user_status = 'profile_incomplete'
  AND COALESCE(last_login_at, created_at) < now() - INTERVAL '7 days'
  AND blocked = false;
```

### S4. Email-provider account, email never verified

```sql
SELECT id, email, created_at
FROM users
WHERE auth_provider = 'email'
  AND email_verified = false
  AND created_at < now() - INTERVAL '48 hours'
  AND blocked = false;
```

### S5. `userStatus` / `activationStatus` divergence

```sql
SELECT id, user_status, activation_status, mobile_verified_at, email_verified_at
FROM users
WHERE (
  (user_status IN ('profile_complete', 'provider_active', 'staff_active') AND activation_status = 'draft')
  OR
  (activation_status = 'active' AND user_status IN ('new', 'profile_incomplete'))
)
AND blocked = false;
```

Both machines should agree once the user is past consent + verification.

### S6. Provider draft never submitted

```sql
SELECT pa.user_id, pa.created_at
FROM provider_applications pa
JOIN users u ON u.id = pa.user_id
WHERE pa.status = 'draft'
  AND pa.created_at < now() - INTERVAL '14 days'
  AND u.blocked = false;
```

### S7. Provider stuck in review > 5 business days

```sql
SELECT user_id, status, updated_at
FROM provider_applications
WHERE status IN ('pending', 'pending_review', 'under_review', 'pending_resubmission')
  AND updated_at < now() - INTERVAL '5 days';
```

### S8. Staff request unanswered

```sql
SELECT user_id, requested_at
FROM staff_access_requests
WHERE status = 'pending'
  AND requested_at < now() - INTERVAL '3 days';
```

### S9. OTP loop / brute-force suspicion

```sql
SELECT phone_e164, COUNT(*) AS sends
FROM otp_events
WHERE event_type IN ('otp_sent', 'otp_resend')
  AND created_at > now() - INTERVAL '1 hour'
GROUP BY phone_e164
HAVING COUNT(*) >= 3;
```

`RegistrationOTPService` enforces `OTP_PHONE_MAX_PER_HOUR = 3`,
`OTP_IP_MAX_PER_HOUR = 15`, `OTP_DEVICE_MAX_PER_HOUR = 10`. Hitting any cap
indicates a stuck phone-verification flow worth surfacing.

### S10. OTP verified but no PG row / no role

```sql
SELECT DISTINCT oe.phone_e164, oe.user_id
FROM otp_events oe
LEFT JOIN users u ON u.id = oe.user_id
WHERE oe.event_type = 'otp_verified'
  AND oe.created_at > now() - INTERVAL '7 days'
  AND (u.id IS NULL OR u.role IS NULL OR u.role = 'new');
```

### S11. Social-login linked but no consent stamped

```sql
SELECT id, auth_provider, created_at
FROM users
WHERE auth_provider IN ('google', 'apple', 'facebook', 'tiktok', 'instagram', 'phone')
  AND terms_accepted_at IS NULL
  AND created_at < now() - INTERVAL '24 hours';
```

`postLoginDecider` is supposed to stamp consent for social users on first
login (lines 274–301). Rows here mean the user logged in but the funnel
short-circuited before the consent block ran.

### S12. Onboarding case stale

```sql
SELECT user_id, context, status, current_step, updated_at
FROM onboarding_cases
WHERE status NOT IN ('approved', 'rejected')
  AND updated_at < now() - INTERVAL '14 days';
```

### S13. Privileged role without explicit approval

```sql
SELECT id, email, role
FROM users
WHERE role IN ('admin', 'management', 'staff', 'ops', 'hr', 'finance', 'ceo')
  AND role <> 'super_admin'
  AND (approved_at IS NULL OR approved_by IS NULL);
```

`postLoginDecider` blocks these users at `/access-pending` until `approvedAt`
+ `approvedBy` are set, but the row itself can drift. The coworker should
flag (never fix) any hit here.

### S14. Refresh-token piling without recent login

```sql
SELECT user_id, COUNT(*) AS active_tokens
FROM refresh_tokens
WHERE revoked_at IS NULL
  AND expires_at > now()
GROUP BY user_id
HAVING COUNT(*) > 10;
```

Indicates the rotation/revoke path is failing for that user.

## 7. What the coworker is allowed to do

- **READ** any of the tables / collections above through the read-only DB
  surface in `server/services/coworker/readonly-db.ts`.
- **REPORT** the rule hits in a triage view (one row per stuck account, plus
  the rule id S1–S14).
- **PROPOSE** a remediation path that is one of the existing flows
  (`/complete-profile`, `/verify-email`, admin approval, OTP cooldown reset)
  — without executing it.

## 8. What the coworker must NOT do

- Write to `users`, `provider_applications`, `staff_access_requests`,
  `onboarding_cases`, `refresh_tokens`, `otp_events`, Firestore profile docs,
  or Firebase Auth (claims, password, email verification).
- Trigger password resets, OTP resends, or welcome emails.
- Change `role`, `userStatus`, `activationStatus`, `approvedAt`, or any
  consent timestamp.
- Add schema migrations or new dependencies.

The governance layer in `server/services/coworker/governance.ts` already
enforces the read-only invariant; this document is the *what* and *why* the
coworker is querying.

## 9. Open questions for follow-up PRs

1. **Two activation machines.** `userStatus` vs `activationStatus` should
   collapse to one source of truth (or `activationStatus` should be a
   computed view).
2. **Firestore consent backfill is one-way.** `acceptedTerms` in
   `users/{uid}/profile/data` only flows *into* PG. If a user revokes
   consent through the privacy UI we have no documented sync back.
3. **TikTok / Instagram have no email.** `ensureUserInPostgres` accepts
   missing email but downstream rules (S4) assume `auth_provider='email'`
   gates verification. A separate detection rule for these providers may
   be warranted.
4. **`onboarding_cases` is one-row-per-user** (`uniqueIndex` on `user_id`).
   A user who pivots from customer → provider currently overwrites the
   case context. Worth confirming whether that loses funnel signal.

---

*Plan-only document. No code changes. No data changes.*
