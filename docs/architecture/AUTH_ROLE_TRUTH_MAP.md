# AUTH_ROLE_TRUTH_MAP.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit

---

## Auth Methods in Use

| Method | File | Verification | Used By |
|---|---|---|---|
| Firebase ID Token | server/middleware/firebase-auth.ts:64 | `firebaseAdmin.verifyIdToken(token, true)` | Most API routes |
| Firebase Session Cookie | server/middleware/firebase-auth.ts:72 | `firebaseAdmin.verifySessionCookie(cookie, true)` | Web session |
| Express Session (PostgreSQL) | server/customAuth.ts:61 | `session(sessionConfig)` | `requireAuth` middleware |
| JWT Bearer Token | server/middleware/auth.ts:36 | `jwt.verify(token, JWT_SECRET)` | Mobile app |
| Mobile JWT (Access + Refresh) | server/routes/auth.ts:30 | Access: 30min, Refresh: 30 days | Mobile clients |

---

## Canonical Roles

**Defined at:** `shared/schema.ts:12150`
```
ALLOWED_ROLES = ['customer', 'loyalty', 'provider', 'staff', 'management', 'admin']
```

Additional engine-internal roles: CUSTOMER, PROVIDER, ADMIN, FINANCE (schema.ts:11773)

---

## Role Matrix

| Role | Allowed Auth | Required Profile State | Post-Login Route | Tables Touched | Permissions |
|---|---|---|---|---|---|
| anonymous | — | — | `/` | — | Read public content |
| customer | Firebase + Session | Email verified | `/home` | users, customers | Book services, view history |
| loyalty | Firebase + Session | Email verified + loyalty enrolled | `/loyalty/dashboard` | loyalty_profiles, privilege_members | Loyalty features + customer |
| provider (pending) | Firebase + Session | providerApplications submitted | `/provider/pending` | providerApplications | None — waiting approval |
| provider (active) | Firebase + Session | providerApplications approved + Firebase claims set | `/provider-os` | walkerProfiles/sitterProfiles/trainers + bookings | Manage bookings, receive payouts |
| staff | Firebase + Session + MFA | staffApplications approved | `/access-pending` → `/admin/dashboard` | users (role=staff) | Support tooling |
| management | Firebase + Session + MFA | Staff approved, elevated | `/admin/dashboard` | users (role=management) | Analytics, approvals |
| admin | Firebase + Session + MFA | users.role=admin | `/admin/dashboard` | All tables | Full platform access |
| franchise_owner | Firebase + Session | users.role=franchise_owner | `/franchise/dashboard` | franchise tables | Franchise financials |

---

## Post-Login Routing Decision

**File:** `server/routes/post-login.ts:181-570`  
**Endpoint:** `POST /api/auth/post-login`

| Status | Role | Next URL | Code |
|---|---|---|---|
| blocked | any | `/blocked` | USER_BLOCKED |
| unverified email | any | `/verify-email` | EMAIL_UNVERIFIED |
| new, no role | any | `/choose-role` | NO_ROLE |
| profile incomplete | any | `/complete-profile` | PROFILE_INCOMPLETE |
| KYC draft | provider | `/provider-onboarding` | KYC_REQUIRED |
| provider pending | provider | `/provider/pending` | PROVIDER_APPROVAL_REQUIRED |
| provider rejected | provider | `/provider/rejected` | PROVIDER_REJECTED |
| provider active | provider | `/provider-os` | OK |
| staff pending | staff | `/access-pending` | STAFF_APPROVAL_REQUIRED |
| staff rejected | staff | `/staff/rejected` | STAFF_REJECTED |
| staff/admin active | staff/admin | `/admin/dashboard` | OK |
| franchise owner | franchise_owner | `/franchise/dashboard` | — |
| complete | any | `/home` | OK |

---

## Duplicate Session Endpoints

| Endpoint | File | Auth Method | Purpose |
|---|---|---|---|
| `GET /api/auth/me` | server/routes/auth.ts:243 | JWT Bearer (mobile) | Mobile profile — requires `Authorization:` header |
| `GET /api/auth/whoami` | server/routes.ts:1301 | Session cookie (web) | Web profile + status |
| `GET /api/user/profile` | server/routes/user-profile.ts:47 | Firebase OR Bearer | Hybrid profile |
| `GET /api/simple-auth/me` | publicAuthRoutes.ts:102 | Optional Firebase | Returns 200+null if logged out |

**Problem:** `/api/auth/me` and `/api/auth/whoami` serve the same purpose via different auth mechanisms. Web clients must use `/whoami`; mobile must use `/me`. No unified endpoint.

**Recommendation (Stage C):** Create `GET /api/auth/identity` that accepts either bearer token or session cookie and returns a normalized identity object.

---

## Known Issues

### 1. `requireProviderActive` Orphaned
- **Defined at:** `server/middleware/gates.ts:192-222`
- **Usage:** ZERO routes use it
- Provider endpoints are NOT currently gated by provider active status
- Any approved provider (or user with provider claims) can call provider endpoints

### 2. `requireMfaEnrolled` Unused
- **Defined at:** `server/middleware/gates.ts:284-325`
- Referenced only in comments in `server/routes/admin-paw-finder.ts:3`
- MFA is enforced only via `requireAdminMfa` (requireMfa.ts:12) for admin/management roles

### 3. Role Escalation Gap
- **Lines:** server/routes.ts:1016-1058 (session creation)
- Pre-decoded Firebase token role used to bypass reCAPTCHA before DB role is verified
- Risk: Client-controlled Firebase token could include elevated role claim
- Fix: Verify role against DB before using for reCAPTCHA bypass decision

### 4. Super Admin Bypass
- **File:** `server/middleware/gates.ts:89-92`
- Hardcoded email list + `SUPER_ADMIN_EMAILS` env var
- Super admins bypass ALL role checks, MFA, staff approval
- No audit trail on super-admin bypass actions — add telemetry

---

## Stale Token Enforcement

- Privileged roles (admin, management, staff, ceo, finance) reject tokens >24 hours old
- **server/routes.ts:1071-1082** (session creation)
- **server/routes/publicAuthRoutes.ts:130-137** (public auth)

---

## Session Creation Flow

```
Client → POST /api/auth/session (Firebase ID token)
  ↓ Rate limit: 20 req/15min
  ↓ Decode token (without full verify)
  ↓ Check: privileged role? → require email verified, reject if stale (>24h)
  ↓ Verify token (full Firebase verify)
  ↓ Create session cookie (pw_session)
  ↓ Return { ok: true }

Client → POST /api/auth/post-login
  ↓ requireAuth (reads pw_session)
  ↓ postLoginDecider: compute userStatus
  ↓ Return { nextUrl }
  ↓ Client navigates to nextUrl
```
