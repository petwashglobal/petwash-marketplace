# SDD: Identity / Capability Foundation — One Person, Many Relationships

| | |
|---|---|
| **Status** | Draft (design only — no code, no PRs) |
| **Date** | 2026-06-07 |
| **Author** | SDD Writer Agent (PetWash) |
| **Feature flag** | `ff.identity.capabilities.enabled` (default **OFF**) |
| **Method** | `.github/skills/sdd-writer-iterative/SKILL.md` |
| **Requested by** | CEO (Nir Hadad) |
| **Companion docs** | `docs/design/2026-05-25-smart-identity-routing.md` (identity-linking + passkeys + admin-invite), `docs/design/2026-05-27-privacy-doctrine-il-plus-gdpr.md` (privacy doctrine) |

---

## 0. Relationship to existing design work (read first — do not duplicate)

A prior SDD, `docs/design/2026-05-25-smart-identity-routing.md`, already designs:
the `identity_accounts` linking table, a canonical `user_passkeys` table, the
`admin_invitations` invite-only admin flow, the global `PhoneInput`/`EmailIdentity`
components, captcha hardening, and a Firebase-login linking algorithm (its §10).
**This SDD does not re-specify any of that.** Where this design needs identity
linking (e.g. reconciling a Firebase login to an existing email/phone row), it
**consumes** that prior design's `identity_accounts` table and its
`loginOrLink()` algorithm.

What the prior SDD does **not** solve, and what this SDD exists to solve:

1. The **single-`role` root defect** — a human can hold only one of
   customer/loyalty/provider/staff at a time. The prior SDD treats `role` as a
   single value throughout (e.g. its §11 routing tree is single-role). It never
   models "the same person is BOTH a loyalty member AND a provider."
2. The **5 concrete routing bugs** in `server/routes/post-login.ts` (listed and
   verified in §3.3) — the prior SDD restates the routing tree as "already
   correct, just harden it"; it is **not** correct for multi-capability users.
3. The **founder-001 orphan / legacy-slug relink** — the prior SDD explicitly
   defers "migration of historical duplicate accounts" (its Non-goals). This SDD
   owns that workstream because the CEO's own account is the blocking instance.
4. The **super-admin two-identity split** across four inconsistent gate styles.
5. The **plaintext `idNumber` / `passportNumber` PII** remediation tied to
   Amendment 13.

If the two designs are ever implemented together, **this SDD's capability model
is the foundation the prior SDD's routing tree must be rebuilt on top of.** The
prior SDD's `identity_accounts` is the *who-are-you* layer; this SDD's
capability set is the *what-may-you-do* layer. They are complementary, not
competing.

---

## 1. Summary

A real PetWash human has **multiple simultaneous relationships** with the
business — the same person can be a paying customer, a loyalty/club member, an
approved service provider, and (rarely) a staff member, all under one email and
one phone. The platform today cannot represent this: a person is one `users` row
with a **single `role` varchar** (`shared/schema.ts:112`, default `customer`),
and both `users.email` and `users.phone` are **UNIQUE** (`schema.ts:37,44`) so
one human is physically one row holding one role. That single field cannot say
"provider AND loyalty." An **unused `users.roles` jsonb array** already exists
(`schema.ts:39`, default `'[]'`) but the routing logic ignores it entirely.

This produces the bugs the CEO reported: a loyalty member who applies as a
provider is silently sent back to `/home` and his application is orphaned;
provider approval **overwrites** his loyalty role; his sign-in bounces to the
profile form and never completes; and his super-admin account "never works"
because four different admin gates each accept a different identity.

This SDD designs the fix in two layers:

- **IDENTITY** — one person = one stable internal `user_id` + email + phone, with
  email/phone reconciliation so a Firebase login resolves to the *existing* human
  instead of orphaning or colliding. (Reuses the prior SDD's `identity_accounts`.)
- **CAPABILITIES** — a person holds a **set** of capabilities
  (`customer | loyalty | provider | staff`), not a single role. The session
  declares which capability it is "acting as," and post-login routing chooses by
  capability + per-capability completion, replacing the broken single-role
  precedence chain.

It also unifies the super-admin identity and remediates the plaintext-PII
exposure as a clearly-scoped **companion workstream** (§9), separable from the
identity work so it can ship on its own approval track.

**No money math, no K9000/Nayax behavior, no SUMIT behavior changes.** Every
schema change is additive and **REQUIRES EXPLICIT CEO APPROVAL** per
`.claude/skills/petwash-platform/SKILL.md:206` ("No schema migrations unless
separately approved. Adding a column counts.").

---

## 2. Goals / Non-goals

**Goals**
- Model one human as one identity that can hold **multiple capabilities at once**.
- A person can be a loyalty member AND apply as a provider with the **same email +
  phone**, and the system routes each relationship correctly end to end.
- Replace the single-`role` precedence chain in `post-login.ts` with
  capability-aware routing; eliminate the 5 confirmed bugs explicitly (§7.4).
- Reconcile a Firebase login to an existing email/phone row instead of
  orphaning/colliding; safely relink the legacy seeded `founder-001-nir-hadad`
  row to the CEO's real Firebase login.
- One canonical super-admin identity model with **one consistent gate** across
  `rbac.ts`, `gates.ts`, and `providerCommandCenter.ts`.
- A single source of truth for "is this person a loyalty member."
- Encrypt-at-rest / tokenize `idNumber` and `passportNumber`; stop writing the
  full ID number into `internalNotes`; make `DOCUMENT_ENCRYPTION_KEY` mandatory
  (fail-closed) in prod. Tie to Amendment 13.
- Every capability grant/revoke and every admin/money mutation is audited.

**Non-goals (out of scope here)**
- No new payment provider; no wallet/loyalty **balance math** change; no K9000 /
  Nayax / SUMIT runtime change. (Loyalty *balance* is untouched; only the
  *representation of membership* is rationalized — see §6.5, and confirm with CEO.)
- No replacement of Firebase Auth. Firebase stays the ID-token issuer.
- No re-design of the eight signup surfaces or passkey storage — that is the
  prior SDD's job (§0). This SDD assumes those land or are deferred independently.
- No bulk merge of historical duplicate accounts beyond the founder row. A
  general duplicate-merge tool is a separate approval-gated data project (§8.4).
- No new languages beyond He/En/Ar (existing i18n keys reused).

---

## 3. Repository context — current state (verified this session)

All file:line references below were opened and confirmed against the working
tree at commit `c75896a3d` on 2026-06-07.

### 3.1 The root defect — one row, one role

| Fact | Evidence |
|---|---|
| A human is one `users` row | `shared/schema.ts:35` (`users` pgTable), PK `id varchar` (`:36`) |
| Single role field, default customer | `shared/schema.ts:112` `role: varchar("role").default("customer")` |
| Email is UNIQUE (one human = one row) | `shared/schema.ts:37` `email: varchar("email").unique()` |
| Phone is UNIQUE | `shared/schema.ts:44` `phone: varchar("phone").unique()` |
| An unused capability array already exists but routing ignores it | `shared/schema.ts:39` `roles: jsonb("roles").default('[]')` |

**Consequence:** there is no place to record "this person is a provider AND a
loyalty member." The `roles` jsonb (`:39`) is the latent fix the routing never
adopted — `post-login.ts` reads `user.role` (the varchar), never `user.roles`.

### 3.2 Identity lookup is UID-only — orphans the founder

`server/services/AuthService.ts:236` `ensureUserInPostgres(firebaseUid, email, …)`
looks up **only** by `getUserById(firebaseUid)` (`:245`). If no row matches the
Firebase UID, it calls `createUser({ id: firebaseUid, email, … })` (`:259`).
There is **no email-based or phone-based reconciliation** anywhere in this path.

The seeded founder row (`scripts/admin/create-first-founder-member.ts:62-68`):
- `userId: "founder-001-nir-hadad"` — a hand-written slug, **not** a 28-char
  Firebase UID.
- `email: "nir.h@petwash.co.il"`, `phone: "+61419773360"` (Australia code).

So when the CEO logs in via Firebase (real UID ≠ the slug), `getUserById` misses,
`createUser` runs with `email = "nir.h@petwash.co.il"`, and the **UNIQUE email
constraint (`schema.ts:37`) rejects the INSERT** → the recovery path in
`post-login.ts:211-237` cannot produce a usable row → 404 / orphan. The CEO's
real login can never bind to his own seeded account.

`post-login.ts` is littered with manual cross-store sync hacks that are symptoms
of this missing reconciliation layer: race-condition recovery (`:211-237`),
Firestore `termsAcceptedAt` backfill (`:301-327` region), social-terms stamping
(`:333-360` region). These should disappear once identity reconciliation exists.

### 3.3 The 5 confirmed routing/role bugs (all in `server/routes/post-login.ts`)

| # | Bug | Verified location | Broken outcome |
|---|---|---|---|
| **B1** | Loyalty short-circuits before provider check | `post-login.ts:138` `if (role === 'loyalty') return { nextUrl: '/home' … }` executes **before** the `if (providerApp) {…}` block at `:142` | A loyalty-role user who applies as provider is permanently sent to `/home`; provider application orphaned; no error shown. |
| **B2** | Approval overwrites the prior role | `post-login.ts:621-623` — on `userStatus==='provider_active'`, `updates.role = 'provider'` (`:623`) **overwrites** whatever `role` was (e.g. `'loyalty'`) | Becoming a provider **destroys** the loyalty relationship — `role` can only hold one value. |
| **B3** | Per-role required-fields flip bounces "complete" users | `REQUIRED_FIELDS_BY_ROLE` (`post-login.ts:30-37`): `loyalty` requires `dateOfBirth` (`:32`), `provider` requires `phone` (`:33`), `customer` neither (`:31`); `getMissingFields` keys on the single `role` (`:39-41`) | When `role` flips, the completion check flips; a profile-complete user gets bounced to `/complete-profile` (`buildRoutingResponse :134`). |
| **B4** | "Apply as provider" sets role=customer | `intentToRole('provider')` returns `'customer'` (`post-login.ts:48`) | Signing up *as a provider* sets `role='customer'`; the role lags reality until approval (B2) overwrites it. The provider intent lives only in `signupIntent`. |
| **B5** | Loyalty has no single source of truth | `role==='loyalty'` (`post-login.ts:138`) **and** `users.loyaltyTier`/`loyaltyPoints`/`loyaltyBalanceCents` (`schema.ts:69,90,91`) **and** `loyaltyLedger` (`schema.ts:13503`) **and** `memberships` (`schema.ts:8618`) **and** an `ensureLoyaltyProfile()` method (`AuthService.ts:247`) | UIs keyed on different fields disagree about whether someone is a member. |

> **Correction to the brief:** the brief cited `loyaltyProfiles` and
> `privilege_members` tables. Grep of `shared/schema.ts` finds **no** tables by
> those exact names. The real loyalty representations are: `role='loyalty'`,
> the cached columns on `users` (`loyaltyTier :69`, `loyaltyPoints :90`,
> `loyaltyBalanceCents :91` — the last comments "source of truth = loyalty_ledger"),
> the `loyaltyLedger` table (`:13503`), the `memberships` table (`:8618`), and
> the `AuthService.ensureLoyaltyProfile()` method (`:247`). The *substance* of
> B5 (no single source of truth) is fully confirmed; only two table names were
> stale.

### 3.4 Super-admin — four gates, no single passing identity

`SUPER_ADMIN_EMAILS` contains both `nir.h@petwash.co.il` and
`nirhadad1@gmail.com`, but the gates disagree on who counts:

| Gate | Location | Accepts | Problem |
|---|---|---|---|
| Legacy `isSuperAdmin(email)` | `server/middleware/rbac.ts:68` | any email in `SUPER_ADMIN_EMAILS`, **no** email_verified check (self-documented at `:60-67`) | weak but currently the only one the founder can pass |
| Strict `isSuperAdminVerified(req)` | `server/middleware/rbac.ts:89-95` | requires `firebaseUser.email_verified === true` (`:91`) AND allowlist | the `nir.h` row is `email_verified=false` → **deadlock** for the legitimate CEO |
| `gates.ts` `SUPER_ADMINS` | `server/middleware/gates.ts:12-13`, checked at `:93,:248,:308,:382` | its own env-derived list | a separate code path with its own list |
| Management-identity | `shared/providerCommandCenter.ts:308` `isManagementIdentity(email)` | **only** `nir.h@petwash.co.il` or `ido.s@petwash.co.il` (`:309-310`) — hardcoded | ignores `nirhadad1@gmail.com` entirely |
| Seed script | `server/scripts/create-super-admin.ts:9` `SUPER_ADMIN_EMAILS = 'nirhadad1@gmail.com'` | creates the **gmail** identity | the identity the management gate rejects |

**Net:** no single email passes all four gate styles. The seed creates the gmail
identity; the management gate only honors the petwash.co.il identity; the strict
RBAC gate requires email_verified the founder row lacks. The CEO experiences this
as "super-admin never works."

### 3.5 PII / Israeli-compliance exposure (Amendment 13)

| Field | State | Evidence |
|---|---|---|
| Uploaded KYC document **files** | Encrypted AES-256-GCM **only if** `DOCUMENT_ENCRYPTION_KEY` set | `server/document-security-2025.ts`; wired at `provider-onboarding.ts:59-71`; fail-closed in prod at `:59-67`, warn-and-store-plaintext otherwise at `:67` |
| `users.idNumber` (Teudat Zehut) | **Plaintext** varchar | `shared/schema.ts:62` |
| Full ID number inside `provider_applications.internalNotes` | **Plaintext JSON** — full `idNumber` written, only `kycIdLastFour` is the redacted form elsewhere | `provider-onboarding.ts:772` (`internalNotes: …JSON.stringify({ declarations, idNumber: idNumber \|\| null, … })`); compare redacted use at `:1000` `kycIdLastFour` |
| `passportVerifications.passportNumber` | **Plaintext AND indexed**, literal warning comment | `shared/schema.ts:6681` (`// ⚠️ ENCRYPT IN PRODUCTION`) and index `:6722` `idx_passport_number`. Adjacent PII also flagged: `surname :6682`, `givenNames :6683`, `dateOfBirth :6684`, `rawMRZ :6707` |

This is the Amendment 13 / Israeli Protection of Privacy Law exposure: national
ID and passport numbers stored in clear, one of them indexed, and a code path
that writes the full ID into a notes blob. See the privacy doctrine doc
`docs/design/2026-05-27-privacy-doctrine-il-plus-gdpr.md` for the governing
policy this remediation enforces.

### 3.6 Governance constraints that bind this design

From `.claude/skills/petwash-platform/SKILL.md`:
- No schema migration without separate approval — adding a column counts (`:206`).
- No wallet/finance behavior change without approval; adding audit logging is
  fine, changing balance/release/refund math is not (`:210`).
- Every money mutation and every admin mutation must be audited with
  actor/action/target/before-after (`:221-223`).
- Multi-agent repo: claim work via a draft PR before coding; grep before building
  to avoid duplicate work (`:193-199`). **This SDD claims the identity-capability
  design space; the prior SDD (§0) owns identity-linking/passkeys/admin-invite.**

---

## 4. Users, roles & accessibility scoping

### 4.1 Capabilities, not a role

The vocabulary of **capabilities** (the set a person may hold simultaneously):

| Capability | Granted by | Self-serve? |
|---|---|---|
| `customer` | signup (default) | yes |
| `loyalty` | joining the club / first qualifying purchase | yes |
| `provider` | admin **approval** of an application | no (apply → approve) |
| `staff` | admin/super-admin **invite** acceptance | no (invite-only) |
| `admin` / `super_admin` | super-admin **invite** (prior SDD §5.5) | no (invite-only) |

A person can hold `{customer, loyalty, provider}` at the same time. `admin` and
`staff` remain invite-only and are deliberately **not** mixed into the
self-serve capability set — they are granted through the admin-invitation flow
designed in the prior SDD.

### 4.2 Actor permission matrix (server-enforced)

| Actor (capability held) | May | May NOT |
|---|---|---|
| Public visitor | signup as customer; apply as provider | self-grant provider/staff/admin; pick capability from a client field |
| Customer | customer dashboard, wallet, bookings | touch admin/provider endpoints |
| Loyalty member | customer surfaces + club benefits, points, prestige pass | nothing additional gated; loyalty is additive |
| Provider candidate (application pending) | view application status; resubmit docs | provider dashboard, accept bookings, see customer PII |
| Provider (approved, capability held) | provider OS, accept bookings — **while still keeping** customer/loyalty surfaces | admin/staff endpoints |
| Staff | admin support views per `accessLevel`/`roles[]` | approve providers without clearance; mint admin invites |
| Admin | approve/reject providers; issue staff invites; view audit | issue admin invites; change money state (separate approval) |
| Super-admin | issue admin invites; view chain-of-custody | edit/delete audit history (append-only, `SKILL.md:284`) |
| System/cron | capability-expiry sweeps, reconciliation | mint identities, grant capabilities |

### 4.3 Accessibility / localization
- Hebrew-first RTL (`petwash-ui-ux/SKILL.md:22` — "RTL is not added later").
- The **capability switcher** (§6.4) must render correctly in RTL; the active
  capability label and the switch control follow logical CSS, not hardcoded
  left/right.
- All capability labels ("Pet owner" / "Club member" / "Provider") are i18n keys,
  no hardcoded English.
- Phone digits stay LTR inside RTL containers (reuse existing `PhoneInput`,
  `client/src/components/PhoneInput.tsx`, per ui-ux skill).

---

## 5. Target model — Identity vs Capability

### 5.1 Two layers, cleanly separated

```
┌──────────────────────── IDENTITY (who you are) ────────────────────────┐
│ users.id (stable internal id)  ·  email (unique)  ·  phone (unique)     │
│ identity_accounts  ── reconcile Firebase logins to ONE user_id          │
│   (provider_type, provider_subject, normalized_email, normalized_phone) │
│   [reused from docs/design/2026-05-25-smart-identity-routing.md §7.1]    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │  one person
                                   ▼  holds a SET of …
┌──────────────────── CAPABILITIES (what you may do) ────────────────────┐
│ user_capabilities  ── one row per (user_id, capability)                 │
│   status: active | pending | suspended | revoked                        │
│   per-capability completion + audit of grant/revoke                     │
└─────────────────────────────────────────────────────────────────────────┘
                                   │  the session picks …
                                   ▼
┌──────────────── ACTIVE CONTEXT (which hat right now) ──────────────────┐
│ session.activeCapability  ── server-validated against user_capabilities │
│ post-login routing chooses by activeCapability + its completion state   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Decision: dedicated `user_capabilities` table vs the existing `users.roles` jsonb

| Option | Better | Cheaper | Faster (to build) | Easier (to reason about) | More luxurious (UX) |
|---|---|---|---|---|---|
| **A. Use `users.roles` jsonb** (`schema.ts:39`) | adds no table | no migration of a new table | fastest first step | jsonb arrays can't carry per-capability status/timestamps/approver without nesting; no FK; no per-row audit; can't index a grant lifecycle | poor — can't cleanly show "provider: approved 12 May" |
| **B. Dedicated `user_capabilities` table** (recommended) | one row per relationship with status, granted_by, granted_at, revoked_at | one additive table (approval-gated) | a bit more upfront | each capability is a first-class, auditable, queryable row; FK to `users.id`; partial unique enforces "one active provider grant per user" | strong — the switcher and admin views read clean rows |

**Recommendation: Option B — a dedicated `user_capabilities` table.** Rationale:
capability grants are money/identity/safety-sensitive (a provider grant gates
payouts; a loyalty grant gates discounts), and `SKILL.md:221-223` requires every
grant to be auditable with actor/before/after. A jsonb array on `users` cannot
carry `granted_by`, `granted_at`, `status`, `revoked_at`, or a per-grant audit
linkage without becoming a worse version of a table. The existing `users.roles`
jsonb (`:39`) is **demoted to a denormalized read-cache** (optionally mirrored
from `user_capabilities` for fast `WHERE roles @> '["provider"]'` lookups), never
the source of truth. The existing single `users.role` varchar (`:112`) is
**retained, untouched, and frozen** as a legacy compatibility shadow during
migration (it becomes a computed "primary capability" — see §8) so no existing
read path breaks before it is migrated.

### 5.3 How the session represents "acting as capability X"

- The server derives the set of **active** capabilities from `user_capabilities`
  on each `/api/post-login` call.
- The session carries `activeCapability` (default = highest-privilege *completed*
  capability, or the last one the user explicitly switched to).
- `activeCapability` is **always re-validated server-side** against
  `user_capabilities.status='active'` before any capability-scoped authorization.
  The client may *request* a switch; the server decides.
- This replaces the single-role precedence chain: routing no longer asks "what is
  this user's one role" but "what is the active capability and is it complete."

---

## 6. The loyalty + provider same-person scenario (action → reaction → broken outcome)

The CEO's exact case: one human, `nir.h@petwash.co.il` / `+61419773360`, who is a
loyalty member and applies to become a provider. Both orderings are broken today.

### 6.1 Ordering A — loyalty FIRST, then apply as provider (TODAY)

| Step | Action | Reaction (today) | Broken outcome |
|---|---|---|---|
| 1 | Joins club | `role='loyalty'`, loyalty cols set | OK |
| 2 | Visits `/become-provider`, submits application | `signupIntent='provider'`; provider_application row created; `role` stays `'loyalty'` (B4: intent→customer never even applies because role already loyalty) | application exists but role unchanged |
| 3 | Returns, hits `/api/post-login` | `buildRoutingResponse` reaches `if (role === 'loyalty') return '/home'` at `:138` **before** the `if (providerApp)` block at `:142` | **B1: sent to `/home`; provider application orphaned; never reaches onboarding; no error** |
| 4 | Admin approves anyway | `post-login.ts:623` `updates.role = 'provider'` overwrites `'loyalty'` | **B2: loyalty relationship destroyed; loyalty UIs now disagree (B5)** |
| 5 | Re-login as now-provider | `REQUIRED_FIELDS_BY_ROLE['provider']` requires `phone` (`:33`); if missing → bounce | **B3: possible bounce to `/complete-profile`** |

### 6.2 Ordering B — provider FIRST, then join loyalty (TODAY)

| Step | Action | Reaction (today) | Broken outcome |
|---|---|---|---|
| 1 | Visits `/become-provider`, submits | `intentToRole('provider')` → `'customer'` (`:48`); `role='customer'`, `signupIntent='provider'` | **B4: role says customer despite provider intent** |
| 2 | Admin approves | `:623` sets `role='provider'` | role now provider (single value) |
| 3 | Joins club | club join wants `role='loyalty'`, but role is `'provider'` — one field, can't be both | **collision: either loyalty join is silently dropped or it overwrites `role='loyalty'` and destroys provider routing** |
| 4 | Re-login | `if (role==='loyalty') return '/home'` (`:138`) fires → provider OS unreachable; OR role stayed provider → loyalty benefits invisible | **mutually exclusive; one relationship always lost** |

### 6.3 Target behavior (both orderings, after this design)

| Step | Action | Reaction (target) | Outcome |
|---|---|---|---|
| any | Join club | `user_capabilities`: upsert `(user_id, 'loyalty', status='active')` | loyalty held |
| any | Apply as provider | `user_capabilities`: upsert `(user_id, 'provider', status='pending')`; application row created | provider pending, **loyalty untouched** |
| — | Login | routing reads the **set**; default active = highest completed capability; provider-pending surfaces an application-status card without hiding loyalty/customer home | both relationships visible |
| — | Admin approves provider | `user_capabilities`: set `provider.status='active'`, `granted_by`, `granted_at`; audit `CAPABILITY_GRANTED`; **loyalty row untouched** | person is now customer + loyalty + provider |
| — | Switch context | client requests `activeCapability='provider'`; server validates it's active; routes to provider OS | clean switch, no data loss |

### 6.4 Capability switcher (UX)
When a user holds more than one completed capability, the post-login response
returns the full set and the app shows a switcher ("Pet owner · Club · Provider").
A user with one capability never sees it (progressive disclosure,
`petwash-ui-ux` principle). RTL-correct, i18n labels.

### 6.5 Loyalty single source of truth (B5)
Designate `user_capabilities (capability='loyalty', status)` as the **single
source of truth for membership status** (am I a member?). The **balance/points
math is unchanged** — `loyaltyLedger` (`schema.ts:13503`) remains the source of
truth for *amounts*, and `loyaltyBalanceCents` (`:91`) remains its cache, exactly
as today. `role='loyalty'` stops being a membership signal once migrated.
**This separation (status vs amount) must be confirmed with the CEO** because it
touches the loyalty domain (`SKILL.md:210`), even though no balance math changes.

---

## 7. Routing redesign — capability-aware post-login

### 7.1 New decision model (replaces the single-role precedence chain)

Pseudocode for the new `buildRoutingResponse` (server-side, the only source of
truth — frontend guards remain UX-only per `SKILL.md`):

```
caps   = user_capabilities WHERE user_id = u.id            # the SET
active = validateActive(session.activeCapability, caps)     # server-checked

1. if u.blocked                       → /blocked
2. if authProvider='email' && !emailVerified
                                      → /verify-email
3. if caps is empty                   → /choose-role        # brand-new user
4. # per-capability completion (NOT a single global role check)
   if !isComplete(active, u)          → /complete-profile?for=<active>
5. switch (active):
     customer → /home
     loyalty  → /home (club surfaces enabled)
     provider:
        appStatus = providerApplicationStatus(u)
        draft/none           → /provider-onboarding
        pending/under_review → /provider/pending
        pending_resubmission → /provider-application/status
        rejected             → /provider/rejected
        approved (+cap active)→ /provider-os
     staff/admin/super_admin → (prior SDD §11 admin/invite tree)
6. if multiple completed caps && no explicit active
                                      → default to highest-privilege completed cap
7. fallback                           → /home
```

Key change: step 4 checks completion **for the active capability**, not for a
single global role — this is what kills B3.

### 7.2 Per-capability required fields (replaces `REQUIRED_FIELDS_BY_ROLE`)

`REQUIRED_FIELDS_BY_ROLE` (`post-login.ts:30-37`) becomes
`REQUIRED_FIELDS_BY_CAPABILITY`, and completion is evaluated against the **active**
capability only, so flipping context never bounces a user who completed another
capability. A user is "complete for customer" independently of being "complete
for provider."

### 7.3 Context switching
The client may POST a desired `activeCapability`; the server validates it against
`user_capabilities.status='active'` and re-issues the routing decision. An invalid
switch (capability not held / not active) returns 403 + audit
`CAPABILITY_SWITCH_DENIED`, never silently downgrades.

### 7.4 Bug → fix mapping (explicit)

| Bug | Fix in this design |
|---|---|
| **B1** (`:138` loyalty short-circuits before provider) | Routing no longer branches on a single role; it branches on the **active capability**. A loyalty member with a pending provider application has both capabilities; the provider-application surface is reachable via context, never pre-empted. |
| **B2** (`:623` approval overwrites role) | Approval sets `user_capabilities(provider).status='active'` — a **new/updated row**, never an overwrite of another capability. The legacy `users.role` write is removed from this path once migrated (or, during transition, mirrors "primary capability" without clobbering others). |
| **B3** (`:30-37` per-role required fields flip) | Completion is per-capability (`REQUIRED_FIELDS_BY_CAPABILITY`), evaluated for the **active** capability only. |
| **B4** (`:48` intent→customer) | Applying as provider creates a `user_capabilities(provider, status='pending')` row directly. Intent is no longer mapped to a (wrong) single role; the capability records the truth from the first click. |
| **B5** (no loyalty SoT) | `user_capabilities(loyalty)` is the membership SoT; `loyaltyLedger`/`loyaltyBalanceCents` remain the amount SoT (§6.5). |

---

## 8. Account linking & migration (founder-001 and the general case)

### 8.1 Reconciliation on login (consumes prior SDD §10)
`ensureUserInPostgres` (`AuthService.ts:236`) is extended so that **before**
falling through to `createUser` (`:259`), it runs the prior SDD's `loginOrLink()`:
match by `(provider_type, provider_subject)`, then by **verified** normalized
email, then by **verified** normalized phone, and only create a new user on no
match. This is what stops the orphan/collision: a Firebase login for
`nir.h@petwash.co.il` resolves to the existing founder row by email instead of
attempting a colliding INSERT.

### 8.2 The founder-001 relink problem
The founder row's PK is the slug `founder-001-nir-hadad` (`create-first-founder-member.ts:64`),
not the Firebase UID. Other tables (passes, memberships, loyalty ledger) hold FK
references to `users.id = 'founder-001-nir-hadad'`. We cannot simply change the PK
without cascading every FK.

Two strategies:

| Strategy | How | Trade-offs |
|---|---|---|
| **PK rewrite** | Update `users.id` slug → real Firebase UID and cascade-update every FK referencing it | clean end state; but risky — must enumerate **all** FK references to `users.id`; any missed FK orphans data; needs a transaction + full backup |
| **Alias table (recommended)** | Add an `identity_accounts` row mapping `provider_subject = <real Firebase UID>` → `user_id = 'founder-001-nir-hadad'`. The slug PK never changes; the login resolves through `identity_accounts` to the existing row | zero FK churn; reuses the prior SDD's table; reversible (delete the alias row); the slug PK staying is cosmetically odd but harmless |

**Recommendation: the alias-table strategy.** It reuses `identity_accounts`
(already designed), touches no FK, and is reversible. The PK-rewrite is reserved
only if a future cleanup wants human-unreadable PKs everywhere — a separate,
approval-gated project. The founder's `email_verified` deadlock (§3.4) is fixed
separately in §10 (super-admin), not by the relink.

### 8.3 Migration of `role` → `user_capabilities` (backfill)
One-time idempotent backfill: for every existing `users` row, INSERT a
`user_capabilities` row mirroring the current `role` (and add a `loyalty` row
where loyalty cols indicate membership). Read-only against `users`; additive into
the new table; re-runnable. The legacy `users.role`/`users.roles` are left intact
as shadows until the final cutover phase (§11).

### 8.4 General duplicate accounts
Out of scope beyond the founder. If two existing rows share a normalized email or
phone, **do not auto-merge** — flag for manual review (prior SDD §10 conflict
path). A bulk-merge tool is a separate approval-gated data project.

---

## 9. PII encryption remediation (companion workstream — separable)

This can ship on its own approval track, independent of the capability work; it
is bundled here because the CEO asked "is the Israeli legal/secure info
encrypted." Governed by `docs/design/2026-05-27-privacy-doctrine-il-plus-gdpr.md`.

| Item | Today | Target |
|---|---|---|
| `users.idNumber` (`schema.ts:62`) plaintext | clear varchar | encrypt-at-rest via existing `DocumentEncryption` AES-256-GCM (`server/document-security-2025.ts`) OR tokenize (store ciphertext + `idNumberLastFour` for display). Recommendation below. |
| Full ID in `internalNotes` (`provider-onboarding.ts:772`) | full `idNumber` in plaintext JSON | **stop writing the full number** — write only `kycIdLastFour` (the redacted form already used at `:1000`). Strip on read for existing rows. |
| `passportVerifications.passportNumber` (`schema.ts:6681`) plaintext **and indexed** (`:6722`) + adjacent PII (`:6682-6707`) | clear + B-tree index | encrypt the value; replace the searchable index with a **blind/searchable hash** column (HMAC-SHA-256 with a server-side key) so lookups work without exposing the number; encrypt `surname`/`givenNames`/`rawMRZ` too |
| `DOCUMENT_ENCRYPTION_KEY` | fail-closed in prod for **files** (`provider-onboarding.ts:59-67`), warn-and-plaintext otherwise (`:67`) | make the key **mandatory (fail-closed) in prod for ALL PII paths**, not just file uploads; startup gate refuses to boot in prod without it |

**Recommendation: column-level encryption with a searchable HMAC sidecar.** For
fields that must be looked up (passport number), store
`passport_number_enc` (ciphertext) + `passport_number_hmac` (deterministic HMAC,
indexed) and drop the plaintext index. For fields never searched (idNumber in
notes), simply stop storing them. This satisfies Amendment 13's minimization +
security duties while keeping the one legitimate lookup working.

**Crown-jewel caution:** changing how `idNumber`/`passportNumber` are stored is a
schema change (`SKILL.md:206`) **and** touches data already in production —
requires CEO approval, a backfill/encrypt migration of existing rows, and a
key-management decision (where `DOCUMENT_ENCRYPTION_KEY` / a new
`PII_HMAC_KEY` live in Secret Manager).

---

## 10. Super-admin identity unification

### 10.1 Canonical model
- One canonical super-admin identity: a `users` row with a
  `user_capabilities(super_admin, status='active')` grant, gated additionally by
  the `SUPER_ADMIN_EMAILS` allowlist (defense in depth).
- Reconcile the two CEO emails: declare **`nir.h@petwash.co.il` the canonical
  super-admin identity** (it is the founder's seeded business identity,
  `create-first-founder-member.ts:65`); add `nirhadad1@gmail.com` as a **linked
  identity** on the same `user_id` via `identity_accounts` (so logging in with
  either Firebase identity resolves to the same human and the same capability).
  The seed script (`create-super-admin.ts:9`) is updated to seed/link the
  canonical identity rather than create a second island.

### 10.2 One consistent gate
Replace the four divergent gates (§3.4) with a single helper used everywhere
(`rbac.ts`, `gates.ts`, `providerCommandCenter.ts`):

```
isSuperAdmin(req) :=
     emailIn(SUPER_ADMIN_EMAILS)                 # allowlist
  && user_capabilities(super_admin).active        # DB-backed grant
  && ( email_verified === true  OR  email is a verified business-domain admin )
```

- `isManagementIdentity` (`providerCommandCenter.ts:308`) stops hardcoding two
  emails and delegates to this helper.
- `gates.ts` `SUPER_ADMINS` (`:12-13`) and `rbac.ts` `isSuperAdmin` (`:68`) /
  `isSuperAdminVerified` (`:89`) collapse into the one helper.

### 10.3 Remove the email_verified deadlock
The strict gate's hard `email_verified===true` (`rbac.ts:91`) currently locks out
the legitimate founder whose row is `email_verified=false`. Fix: super-admin
verification is satisfied by **either** Firebase `email_verified` **or** the
account being a pre-provisioned business-domain admin whose verification was done
out-of-band at provisioning time (recorded as an audited `ADMIN_VERIFIED`
event). This removes the deadlock without weakening the gate for unverified
public emails. **The relink (§8.2) + this change together are what finally make
the CEO's super-admin "work."**

---

## 11. Data model (additive only — REQUIRES APPROVAL)

No existing column altered. New table:

```
user_capabilities                    -- NEW
  id              bigserial primary key
  user_id         varchar(128) not null references users(id)
  capability      varchar(20)  not null  -- customer|loyalty|provider|staff|admin|super_admin
  status          varchar(16)  not null  -- active|pending|suspended|revoked
  granted_by      varchar(128) references users(id)   -- null for self-serve
  granted_at      timestamp default now()
  revoked_at      timestamp
  metadata        jsonb default '{}'     -- e.g. {application_id, tier}
  created_at      timestamp default now()
  updated_at      timestamp default now()

  UNIQUE (user_id, capability)                         -- one row per relationship
  -- only one ACTIVE provider/staff/admin grant per user:
  -- enforced by the UNIQUE above (status lives in the row)
  INDEX (user_id) WHERE status = 'active'
  INDEX (capability, status)
```

PII remediation (companion, §9): additive columns
`passport_number_enc`, `passport_number_hmac` on `passportVerifications`; an
encrypt-in-place migration for `users.idNumber`. **All approval-gated.**

`identity_accounts` is **not** redefined here — it is the prior SDD's table (its
§7.1). This SDD only adds rows to it (the founder alias, the gmail link).

---

## 12. Security, fraud & audit

| Threat | Control |
|---|---|
| Client self-grants a capability | Server ignores any client `capability`/`role` field. Capabilities are granted only by: self-serve customer/loyalty (server-controlled), provider **approval** route (admin auth), staff/admin **invite** acceptance (prior SDD). |
| Provider self-activation | `user_capabilities(provider).status='active'` set only inside the admin approval route under admin auth + audit (replaces the role overwrite at `post-login.ts:623`). |
| Capability switch to a capability not held | Server validates `activeCapability` against `user_capabilities.status='active'`; 403 + `CAPABILITY_SWITCH_DENIED` audit. |
| Account hijack via unverified email link | Reconciliation links by email/phone **only when the new provider verified it** (prior SDD §10). |
| Super-admin bypass | One gate: allowlist AND DB grant AND verification (§10.2); append-only audit on every grant. |
| PII exposure (Amendment 13) | Encrypt idNumber/passportNumber; drop plaintext index for blind HMAC; fail-closed key in prod (§9). |
| Audit tampering | Append-only; no edit/delete (`SKILL.md:284`). |

**Audit events** (via `logAuditEvent`, `server/middleware/auditLog.ts`):
`CAPABILITY_GRANTED`, `CAPABILITY_REVOKED`, `CAPABILITY_SUSPENDED`,
`CAPABILITY_SWITCH_DENIED`, `PROVIDER_CAPABILITY_APPROVED`, `IDENTITY_RELINKED`
(founder), `ADMIN_VERIFIED`, `SUPER_ADMIN_GATE_DENIED`, plus the PII migration
emits `PII_FIELD_ENCRYPTED` per backfilled row-batch. Every entry carries
actor/action/target/before-after (`SKILL.md:223`).

---

## 13. Test plan

| # | Test | Type |
|---|---|---|
| T1 | Person holds loyalty + provider simultaneously; both surfaces reachable | integration |
| T2 | Loyalty member applies as provider → application NOT orphaned; reachable (kills **B1**) | integration |
| T3 | Provider approval does NOT remove the loyalty capability (kills **B2**) | integration |
| T4 | Switching active capability does not bounce a user who is complete for another capability (kills **B3**) | integration |
| T5 | "Apply as provider" creates a `provider` capability (pending), not `role='customer'` (kills **B4**) | integration |
| T6 | `user_capabilities(loyalty)` is the membership SoT; ledger/balance unchanged (kills **B5**) | integration |
| T7 | Firebase login for `nir.h@petwash.co.il` resolves to `founder-001-nir-hadad` via alias, no collision, no orphan | integration |
| T8 | Founder super-admin passes all gate call sites with one identity; gmail login resolves to same user | integration |
| T9 | email_verified=false founder still passes super-admin gate via business-admin path; unverified public email does NOT | integration |
| T10 | Client cannot self-grant a capability (capability field ignored) | integration |
| T11 | Capability switch to an unheld capability → 403 + audit | integration |
| T12 | `idNumber` not present in `internalNotes` after provider submit (only last-four) | integration |
| T13 | passport lookup works via HMAC; plaintext index removed; value encrypted at rest | integration |
| T14 | Prod boot refuses without `DOCUMENT_ENCRYPTION_KEY` on all PII paths | unit/startup |
| T15 | Backfill `role`→`user_capabilities` is idempotent (re-run = no-op) | integration |
| T16 | RTL: capability switcher renders correctly in Hebrew; labels are i18n keys | UI |
| T17 | Wallet/loyalty authorization smoke suite passes unchanged (regression guard) | integration |

---

## 14. Rollout / phased PR breakdown

`ff.identity.capabilities.enabled` default **OFF**. Legacy `role` path stays live
through every phase. Each PR is one purpose; money/schema phases flagged.

| Phase / PR | Purpose | Approval gate |
|---|---|---|
| **PR-0 (this doc)** | The SDD itself | none (design only) |
| **PR-1** | Super-admin gate unification (§10.2) + remove email_verified deadlock (§10.3). Code-only, no schema. Founder can finally administer. | standard PR |
| **PR-2** | Founder relink via `identity_accounts` alias row (§8.2). Reuses prior SDD table **if it exists**; if not, blocked on that table landing. | **needs prior SDD's `identity_accounts`** |
| **PR-3** | Extend `ensureUserInPostgres` to reconcile by verified email/phone before `createUser` (§8.1). Behind flag. | standard PR (no schema) |
| **PR-4** | Add `user_capabilities` table (§11). No write paths yet. | **CEO APPROVAL (schema)** |
| **PR-5** | Idempotent backfill `role`/loyalty cols → `user_capabilities` (§8.3). Read-only against `users`. | **CEO APPROVAL (data)** |
| **PR-6** | Capability-aware `buildRoutingResponse` behind flag (§7); kills B1–B4 when flag ON; legacy path when OFF. | standard PR |
| **PR-7** | Loyalty membership SoT = `user_capabilities(loyalty)`; ledger/balance untouched (§6.5). | **CEO APPROVAL (loyalty domain, `SKILL.md:210`)** |
| **PR-8** | Capability switcher UI + per-capability completion (§6.4, §7.2). RTL/i18n. | standard PR |
| **PR-9 (companion A)** | Stop writing full `idNumber` to `internalNotes` (`provider-onboarding.ts:772`) → last-four only (§9). | standard PR |
| **PR-10 (companion B)** | Make `DOCUMENT_ENCRYPTION_KEY` mandatory for all PII paths; startup fail-closed (§9). | standard PR (ops/env) |
| **PR-11 (companion C)** | Encrypt `users.idNumber` + `passportNumber`; add HMAC sidecar; drop plaintext index; backfill-encrypt existing rows (§9). | **CEO APPROVAL (schema + prod data + key mgmt)** |
| **PR-12** | Cohort flip flag ON (10→50→100%) with audit-volume monitoring; then freeze/retire `users.role` as a computed shadow. | **CEO APPROVAL (cutover)** |

**Migration safety:** all schema changes additive through PR-11; the legacy
`role` varchar is never dropped within this plan (it becomes a computed shadow).
Each phase is independently revertible.

---

## 15. Rollback plan

- PR-1 (gate unify): revert the commit; gates return to current (broken-but-known)
  state. No data drift.
- PR-2 (founder alias): delete the `identity_accounts` alias row; founder reverts
  to current orphan state. No FK touched.
- PR-3/PR-6/PR-8 (behind flag): set `ff.identity.capabilities.enabled=false`; the
  legacy single-`role` path resumes immediately.
- PR-4/PR-5 (table + backfill): drop `user_capabilities`; no existing table
  altered.
- PR-9/PR-10 (PII redaction/fail-closed): revert commit; behavior returns to
  prior. PR-9 cannot un-redact already-redacted notes (acceptable — that is the
  goal).
- PR-11 (encryption): pre-migration full backup mandatory; rollback restores
  plaintext from backup and re-adds the index. Carries the highest rollback cost
  — ship it last and alone.
- PR-12 (cutover): flip the flag OFF per cohort; `users.role` shadow is still
  populated, so legacy reads keep working.

---

## 16. Risks, open questions, tradeoffs

**Risks**
- Touches the most security-critical surface (identity + authorization) plus a
  crown-jewel-adjacent domain (loyalty membership). A capability-routing
  regression can secondarily break wallet/finance authorization — mitigation:
  every PR runs the wallet/loyalty authorization smoke suite (T17).
- Two SDDs now touch identity (this one + `2026-05-25-smart-identity-routing.md`).
  If both are implemented by different agents, the capability model (this SDD)
  must land **under** the routing tree (prior SDD), not in parallel — coordinate
  ownership to avoid the exact duplicate-build failure `SKILL.md:193` warns about.
- PII re-encryption migration (PR-11) mutates production PII — highest blast
  radius; isolate and back up.
- Loyalty-membership SoT change (PR-7) is loyalty-domain — requires CEO sign-off
  even though no balance math changes.

**Open questions (need a human decision)**
1. Confirm canonical super-admin identity = `nir.h@petwash.co.il` with
   `nirhadad1@gmail.com` linked (vs the reverse). (§10.1)
2. Does the prior SDD's `identity_accounts` table exist yet / is it scheduled? PR-2
   and PR-3 depend on it. If not landing soon, this SDD needs its own minimal
   linking table (would then need de-dup against the prior SDD).
3. Founder relink: alias-table (recommended) vs PK-rewrite? (§8.2)
4. idNumber: full column encryption vs tokenize-and-keep-last-four-only? (§9)
5. Where do `DOCUMENT_ENCRYPTION_KEY` and the new `PII_HMAC_KEY` live in Secret
   Manager, and who rotates them? (§9)
6. Should `super_admin`/`admin`/`staff` live in `user_capabilities` at all, or stay
   purely in the prior SDD's invite/claims model? (This SDD treats them as
   capabilities for a single gate; confirm.) (§4.1, §10)
7. How many existing `users` rows share a normalized email or phone today?
   Determines how noisy the §8.4 conflict path is.
8. Australia phone (`+61419773360`) on an Israel-market founder — intentional, or
   a seed error to correct during relink? (`create-first-founder-member.ts:68`)

**Tradeoffs (five-filter)**
- **Better/easier:** dedicated `user_capabilities` table over `users.roles` jsonb —
  auditable, queryable, FK-safe (§5.2).
- **Cheaper/faster:** alias-table relink over PK-rewrite — zero FK churn,
  reversible (§8.2).
- **More luxurious:** the capability switcher gives the founder a single account
  that fluidly shows "Pet owner · Club · Provider" — matches the luxury brand
  standard the CEO cares about, instead of forcing separate logins.

---

## 17. First implementation PR (smallest safe slice)

**PR-1: Unify the super-admin gate and remove the email_verified deadlock (§10).**

- Code-only, **no schema change, no flag**. Lowest blast radius of the lot.
- Collapse the four divergent gates (`rbac.ts:68`, `rbac.ts:89-95`,
  `gates.ts:12-13`, `providerCommandCenter.ts:308`) into one helper:
  allowlist AND verification-OR-business-admin.
- Make `isManagementIdentity` delegate to that helper instead of hardcoding two
  emails.
- Allow the founder's `email_verified=false` business identity to pass via an
  audited business-admin path; keep unverified public emails out.
- Tests: T8, T9.

**Why first:** it is the one fix that makes the CEO's super-admin "work today,"
needs no schema migration, no feature flag, and no money-domain approval, and is
reversible in a single commit. It unblocks the CEO administering the platform
while the larger capability work goes through its approval gates. (Note: full
relink — T7 — additionally needs PR-2's `identity_accounts` alias.)

**Out of scope of PR-1:** the `user_capabilities` table, routing rewrite, founder
relink, loyalty SoT, and all PII encryption — those are PR-2…PR-12, each
separately approved.

---

## 18. Appendix — Original request (verbatim)

> Author ONE Software Design Document in docs/design/ for fixing PetWash's broken identity / role / capability foundation. This is a large, risky feature (touches identity, auth routing, the loyalty/money domain, and PII compliance), so it must be designed before any code. Ground every claim in the actual repo (verify the file:line refs below yourself; correct me if any are stale). Do NOT write production code.
>
> == ORIGINAL REQUEST (preserve verbatim intent in the appendix) ==
> The non-technical CEO (Nir Hadad) reported, across several messages: (a) signing in as "Nir" — an account that may date from the Replit era — dumps him on what looks like the old sign-up screen and never completes; (b) the sign-in page has no clear email field / no clear "log in vs new" distinction; (c) "after SMS, what does the system actually DO? what's the follow-up trigger?"; (d) backend super-admin nir.h@petwash.co.il "never works"; (e) a real person should be able to be BOTH a loyalty member AND a provider with the SAME email + mobile — "its totally different, the code should know how to channel them right and map them end to end"; (f) "every button, every field, action + reaction, end to end"; (g) where are memberships/providers saved, and is the Israeli legal/secure info encrypted. He chose option B: design the fix for the confirmed bugs, and "move to a deep smart" (go deep/comprehensive).
>
> == CONFIRMED FINDINGS (already verified against the repo this session — re-verify and cite) ==
> ROOT DEFECT: A human is modeled with a single `users.role` varchar (default 'customer'), but real people have MULTIPLE simultaneous relationships (customer/loyalty/provider/staff). `users.email` and `users.phone` are both UNIQUE (one human = one row), so that one row's single `role` field physically cannot hold "provider AND loyalty". There is ALSO an unused `users.roles` jsonb array column ("[]") that the routing ignores.
>
> The 5 confirmed routing/role bugs (all in server/routes/post-login.ts):
> 1. buildRoutingResponse line ~138: `if (role === 'loyalty') return /home` executes BEFORE the providerApp check at ~142 — so a loyalty-role user who applies as provider can NEVER reach provider onboarding; permanently sent to /home, application orphaned, no error.
> 2. Lines ~621-623: on provider approval, `updates.role = 'provider'` OVERWRITES any prior role (e.g. 'loyalty') — destroys the other relationship.
> 3. REQUIRED_FIELDS_BY_ROLE (lines ~30-37): loyalty requires dateOfBirth, provider requires phone, customer neither. When role flips, the completion check flips, bouncing a "complete" user back to /complete-profile.
> 4. intentToRole('provider') returns 'customer' (line ~48) — signing up "as provider" sets role='customer'; role lags reality until approval overwrites it.
> 5. Loyalty has NO single source of truth: represented as role='loyalty' AND users.loyaltyTier/loyaltyPoints/loyaltyBalanceCents AND loyaltyProfiles AND privilege_members AND memberships AND loyaltyLedger. UIs keyed on different ones will disagree.
>
> IDENTITY/ORPHAN bug: post-login looks up users by Firebase UID (storage.getUser(firebaseUid)). There is NO email-based account linking and NO Replit->Firebase migration. The CEO's row has id `founder-001-nir-hadad` (a hand-seeded slug, NOT a 28-char Firebase UID), role=customer, user_status=new, auth_provider=null, terms_accepted_at=null, last_login_at=null. So his real Firebase login can never match this row; ensureUserInPostgres would try to create a new row but collides on the UNIQUE email constraint -> 404 / orphan. post-login.ts also contains multiple manual cross-store sync hacks (Firestore termsAcceptedAt backfill ~301-327, social-terms stamping ~333-360, race-condition recovery ~211-237) — symptoms of the missing clean identity model.
>
> SUPER-ADMIN bug (two-identity split): SUPER_ADMIN_EMAILS env is set and contains BOTH nir.h@petwash.co.il and nirhadad1@gmail.com. But: management-identity gate (shared/providerCommandCenter.ts:310 isManagementIdentity) accepts ONLY nir.h@petwash.co.il/ido.s; super-admin seed scripts create nirhadad1@gmail.com (server/scripts/create-super-admin.ts:9). isSuperAdminVerified (server/middleware/rbac.ts:89-95) requires firebaseUser.email_verified===true; nir.h row is email_verified=false. rbac.ts:68 legacy isSuperAdmin checks email only (no verification). gates.ts has its own SUPER_ADMINS list. Net: no single email passes all gate styles (allowlist vs verified-email vs DB-role vs management-identity). Gates are inconsistent.
>
> PII / ISRAELI COMPLIANCE gap: Uploaded KYC document FILES are encrypted via DocumentEncryption AES-256-GCM (server/document-security-2025.ts; wired at provider-onboarding.ts:70) but ONLY if DOCUMENT_ENCRYPTION_KEY is set. The ID NUMBERS themselves are PLAINTEXT: users.idNumber (schema.ts:62) plain varchar; the full idNumber is also written plaintext into provider_applications.internalNotes JSON (provider-onboarding.ts:772, only kycIdLastFour redacted); passportVerifications.passportNumber (schema.ts:6681) plaintext AND indexed with a literal "⚠️ ENCRYPT IN PRODUCTION" comment. This is the Amendment 13 / Israeli Protection of Privacy Law exposure.
>
> == WHAT THE SDD MUST COVER ==
> 1. Problem statement & current-state analysis (cite repo file:line; include the action→reaction→broken-outcome table for the loyalty+provider-same-person scenario, both orderings).
> 2. Target identity model: separate IDENTITY (one person: stable internal user id + email + phone, with email-based linking/reconciliation) from CAPABILITIES (a SET — customer/loyalty/provider/staff — not a single role). Decide: use the existing users.roles jsonb vs a dedicated user_capabilities/relationships table. Give the recommendation with trade-offs. Define how "the session is acting AS capability X" is represented and how post-login routing chooses, replacing the single-role precedence chain.
> 3. Account linking & migration: how a Firebase login reconciles to an existing email/phone row instead of orphaning; how to relink/migrate legacy seeded rows (e.g. founder-001-nir-hadad) safely given UNIQUE(email,phone) and FK references to users.id; PK-change vs alias-table strategies.
> 4. Routing redesign: replace the buildRoutingResponse single-role precedence with capability-aware routing; per-capability required-fields and completion; how a user holding multiple capabilities chooses/switches context. Eliminate the 5 bugs explicitly, mapping each to its fix.
> 5. Super-admin identity unification: one canonical admin identity model; reconcile the two CEO emails; consistent gate (allowlist + verified + role) across rbac.ts, gates.ts, providerCommandCenter; remove the email_verified deadlock for legitimate admins.
> 6. PII encryption remediation (can be a clearly-scoped companion workstream, not necessarily same PR): encrypt-at-rest or tokenize idNumber / passportNumber; stop writing full idNumber into internalNotes; searchable-hash strategy for the indexed passportNumber; make DOCUMENT_ENCRYPTION_KEY mandatory (fail-closed) in prod. Tie to Amendment 13.
> 7. Migration plan, data-integrity/rollback, audit-logging requirements (money/admin mutations), test matrix (the user states + flows from the petwash-platform skill §5), and a phased PR breakdown (each PR one purpose) respecting the repo's governance (no schema migration / no money-behavior change without explicit CEO approval — call out which phases need that approval).
> 8. Risks, open questions, and explicit tradeoffs (use the five-filter framing: better/cheaper/faster/easier/more-luxurious where relevant).
>
> Read the petwash-platform, petwash-pr-guardian, and petwash-ui-ux skills for governance constraints and fold them in. Check for any existing related design docs or in-flight branches/PRs first (the repo is worked by multiple agents) and reference rather than duplicate. Deliver the path to the written SDD and a concise executive summary I can relay to a non-technical CEO.
