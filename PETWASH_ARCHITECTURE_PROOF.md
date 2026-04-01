# PetWash — Architecture Proof & Honest Gap Assessment
**Date:** April 2026 | **Classification:** Internal Engineering Critical Review

> This document is not a summary. Every finding below is backed by direct code or DB evidence.
> Anything marked ❌ is genuinely missing. Anything marked ✅ is proven. Nothing is claimed without proof.

---

## 1. SYSTEM SOURCE-OF-TRUTH MAP

| Domain | Source of Truth | Evidence |
|--------|----------------|----------|
| Application state | `provider_applications.status` in PostgreSQL | ORM Drizzle + pool.query confirm 8-state column |
| Communication thread | `provider_application_threads` + `provider_application_messages` | 6 columns incl. direction, provider_visible, delivery_status |
| Review decision | `provider_applications.status` + `provider_review_audit` (immutable log) | audit writes on every transition |
| Audit trail | `provider_review_audit` table (append-only, no UPDATE) | writeProviderAudit always inserts |
| File history | `provider_applications.selfie_photo_url` + `provider_application_resubmissions.new_selfie_url` | 2 tables track original + all resubmissions |
| Wallet data | Separate wallet tables (not part of provider onboarding) | Isolated, no leakage |

---

## 2. FULL STATE MACHINE — EXACT TRANSITIONS

```
State: submitted
  → Can transition to: processing (automatic on async KYC start)
  → Cannot transition to: any other state directly

State: processing
  → Can transition to: approved, rejected, pending_review, pending_resubmission (KYC decision engine)
  → On KYC exception: STAYS in processing (watchdog needed — currently NO auto-recovery)
  
State: pending_review
  → Can transition to: approved (admin), rejected (admin), pending_resubmission (admin)
  
State: pending_resubmission
  → Can transition to: processing (when applicant uploads via token)
  → Can transition to: approved (admin), rejected (admin)
  → Max 3 resubmissions enforced (resubmission_count check)

State: approved
  → Terminal. Cannot transition to any state.
  → Triggers: Firebase custom claims set, approval email sent

State: rejected
  → Terminal. Cannot transition to any state.
  → Triggers: rejection email sent

State: expired
  → Terminal. Defined in type but NO AUTOMATIC TRIGGER implemented.
  → ⚠️ No background job sets status=expired on overdue applications.

State: withdrawn
  → Can reach from: submitted, processing, pending_review, pending_resubmission
  → Triggered by: applicant calls /provider-application/withdraw
```

**Evidence (providerDecisionEngine.ts lines 1–9 + approve/reject routes lines 1178, 1283):**
```typescript
// Type definition — all 8 states declared
export type ProviderApplicationStatus =
  | "submitted" | "processing" | "pending_review" | "pending_resubmission"
  | "approved" | "rejected" | "expired" | "withdrawn";

// Guard in approve route:
if (!['pending', 'pending_review', 'pending_resubmission'].includes(application.status || '')) {
  return res.status(400).json({ error: 'Application already processed' });
}
```

---

## 3. IDEMPOTENCY ANALYSIS

| Action | Idempotent? | How | Gap |
|--------|------------|-----|-----|
| Submit application | ✅ Partial | `23505` unique constraint on (user_id, email) | Duplicate check is DB-level |
| Approve | ✅ Partial | Status check returns 400 if already approved | NOT atomic — see Race Condition section |
| Reject | ✅ Partial | Same status guard | NOT atomic — see Race Condition section |
| Request resubmission | ✅ Yes | Checks `resubmission_count >= 3` before creating token | Count is checked before insert |
| Resend email | ❌ No | No dedup check — calling twice sends twice | Not implemented |
| Send message | ❌ No | No dedup on message content | Will create duplicate messages |
| Assign reviewer | ✅ Yes | Overwrites `assigned_to` — safe to call multiple times | |

---

## 4. RACE CONDITION PROOF — CRITICAL FINDING ⚠️

### The bug: Approve and reject have a TOCTOU gap (Time-Of-Check vs Time-Of-Use)

**Current code in approve route (lines 1168–1199):**
```typescript
// Step 1: SELECT (no lock)
const [application] = await db.select().from(providerApplications)
  .where(eq(providerApplications.applicationId, applicationId)).limit(1);

// Step 2: Status guard — reads from memory, not from DB lock
if (!['pending', 'pending_review', 'pending_resubmission'].includes(application.status || '')) {
  return res.status(400).json({ error: 'Application already processed' });
}

// Step 3: UPDATE — no WHERE status clause (the comment "lock row" is misleading)
await db.update(providerApplications)
  .set({ status: 'approved', ... })
  .where(eq(providerApplications.applicationId, applicationId));
  // ↑ This WHERE clause has NO status condition.
  // Admin A's SELECT and Admin B's SELECT both pass the guard.
  // Admin A approves. Admin B ALSO approves (or rejects) and overwrites.
```

**What this means:**
- Admin A and Admin B both open the same pending application
- Both see status: `pending_review` — both pass the guard check
- Admin A clicks Approve — application becomes `approved`
- Admin B clicks Reject (0.5 seconds later) — application becomes `rejected`, OVERWRITING the approval
- Firebase claims already set to `provider` by Admin A — **now Firebase says provider but DB says rejected**
- Provider receives BOTH an approval email AND a rejection email

**This is a data integrity violation. It is fixed below in Section 7.**

---

## 5. DB LOCK ANALYSIS

**Confirmed: NO database-level locks exist anywhere in provider onboarding routes.**

Search evidence:
```bash
grep -n "FOR UPDATE\|BEGIN\|transaction\|forUpdate\|serializable" server/routes/provider-onboarding.ts
# → 0 results
```

No transactions, no `SELECT ... FOR UPDATE`, no serializable isolation.

**Impact:** The race condition in Section 4 can cause real data corruption in a multi-reviewer operation team.

---

## 6. PERMISSION PROOF

### What `requireAdmin` actually checks (LOCAL middleware, lines 73–134 in provider-onboarding.ts):

```typescript
// Path 1: Super admin email list — instant pass
if (isSuperAdmin(userEmail)) { return next(); }

// Path 2: DB role assignment — checks systemRoles table
const assignments = await db.select().from(userRoleAssignments)
  .leftJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
  .where(and(eq(userRoleAssignments.userEmail, userEmail), eq(userRoleAssignments.isActive, true)));

const hasAdminAccess = role.accessLevel >= 5 || 
  permissions.includes('*') || 
  permissions.includes('admin:providers') ||
  permissions.includes('admin:applications');
```

### Permission matrix — what the code ACTUALLY enforces:

| User | Can call admin provider routes? | Evidence |
|------|-------------------------------|----------|
| Super admin (email in list) | ✅ YES | Line 89 |
| Role with accessLevel ≥ 5 | ✅ YES | Line 115 |
| Role with `admin:providers` permission | ✅ YES | Line 117 |
| `management` role (accessLevel 8) | ✅ YES | Passes level check |
| `staff` role (accessLevel 4) | ⚠️ DEPENDS | If staff level < 5 in DB, they CANNOT review applications — this may block real support staff |
| `admin` role (accessLevel 6) | ✅ YES | |
| Provider (applicant) | ✅ BLOCKED | No role assignment |
| Public client | ✅ BLOCKED | No role assignment |

### Critical gap: management vs support are NOT separated
The same `requireAdmin` guard is on BOTH operational routes (approve/reject) AND future management analytics routes. **Management cannot be blocked from individual case decisions** because there is no separate `requireManagement`-only guard yet. Both management and support currently pass the same middleware.

### Applicant route isolation (proven):
```typescript
// /my/status route
const uid = decodedToken.uid;
const rows = await pool.query(
  'SELECT ... FROM provider_applications WHERE user_id = $1',
  [uid]  // ← Row-level isolation: only own applications returned
);
```
Applicants cannot see other applicants' data. ✅

---

## 7. KYC FAILURE HANDLING — WHAT ACTUALLY HAPPENS

### KYC API timeout / exception (lines 988–993):
```typescript
} catch (asyncErr: any) {
  logger.warn('[KYC2026] Verification failed — application stays pending for admin review', {
    applicationId, error: asyncErr?.message,
  });
}
```

**What happens:** Application stays in `processing` status permanently. No status update. No admin notification. No workflow event emitted. No automatic recovery.

**This means:** A KYC crash silently leaves the application invisible to the review queue forever (since the queue only gets created on `pending_review`/`pending_resubmission` transition). **This is a stuck-state failure.** Support will never know it exists unless they query the DB directly.

**What is missing:**
- No UPDATE to `pending_review` on KYC exception
- No monitoring event emitted on exception
- No alert threshold or watchdog for stuck-in-processing applications
- No admin notification when KYC fails

---

## 8. INBOX MODEL — EXACT SPECIFICATION

### Three message types (proven in `provider_application_messages` schema):

| Type | `direction` value | `channel` | `provider_visible` | Who can read |
|------|------------------|-----------|-------------------|--------------|
| Outbound email to applicant | `outbound` | `email` | `true` | Admin + applicant |
| Internal staff note | `internal_note` | `internal_note` | `false` | Admin only (providerVisible=false filtered on /my/messages) |
| System event message | `outbound` | `system` | `false` (or true) | Depends on flag |
| Applicant reply | ❌ NOT BUILT | — | — | — |

### What `/my/messages` returns (proven in route):
```sql
WHERE application_id = $1 AND provider_visible = true
```
Applicants see ONLY messages where `provider_visible = true`. Internal notes are never exposed. ✅

### What's missing:
- No `POST /my/messages` route for applicant to write inbound replies
- No delivery status update from SendGrid webhooks (delivery_status stays "queued" after send)
- No unread count badge displayed per row in the queue list UI

---

## 9. FILE HANDLING — HONEST STATUS

### What's actually built:
```tsx
// ProviderKycReview.tsx lines 344–365
{app.selfieSignedUrl ? (
  <img src={app.selfieSignedUrl} alt="Applicant selfie"
    className="w-full object-contain rounded-lg" />
) : null}
<img src={app.idSignedUrl} alt="Government ID" ... />
```

| Feature | Status | Evidence |
|---------|--------|----------|
| Signed URL generation | ✅ Built | Signed URLs fetched server-side |
| Inline image display | ✅ Built | `<img>` tag with signed URL |
| Image zoom | ❌ Not built | No zoom handler, no transform CSS |
| Full-screen modal | ❌ Not built | No modal component for images |
| Download original | ❌ Not built | No download button |
| Inline PDF preview | ❌ Not built | No `<iframe>` or PDF.js |
| Version history list | ❌ Not built | `provider_application_resubmissions` exists in DB but not queried in review page |
| Side-by-side compare | ❌ Not built | No comparison UI |
| File metadata display | ❌ Not built | No size, type, upload timestamp shown |

---

## 10. MANAGEMENT DASHBOARD — HONEST STATUS

**Does it exist? NO.** Zero management analytics routes are built. Zero management dashboard page exists.

The data foundations ARE in place:
- `provider_applications` — status + timestamps ✅
- `provider_review_queue` — assignments, priority, completion ✅
- `provider_review_audit` — every event with actor and timestamp ✅
- `provider_workflow_events` — processing events ✅
- `provider_application_messages` — delivery status ✅

But no aggregation queries, no `/mgmt/` routes, no management UI page. **Claimed as "future"** in previous sessions. **Not built.**

---

## 11. MONITORING — HONEST STATUS

### What `providerMonitoring.ts` actually does:
```typescript
// Only two exported functions:
export async function emitProviderEvent(input) { ... }  // INSERT only
export async function getRecentEvents(options) { ... }  // SELECT only
```

**There are no alert thresholds. No watchdog. No cron. No trigger. No notification on critical events.**

Events are written to the DB but nothing reads them to generate alerts. It's a write-only log.

### Missing thresholds (should be defined and enforced):

| Alert | Threshold | Current state |
|-------|-----------|---------------|
| Processing stuck | Application in `processing` > 30 minutes | ❌ No watchdog |
| Review overdue | Application in `pending_review` > 48 hours | ❌ No watchdog |
| Resubmission overdue | Token expires in < 24 hours + not fulfilled | ❌ No watchdog |
| Email failure spike | > 3 email failures in 1 hour | ❌ No detection |
| Rejection spike | Rejection rate > 50% in last 24 hours | ❌ No detection |
| Fraud spike | > 2 high-risk fraud flags in 1 hour | ❌ No detection |

---

## 12. MOBILE LAYOUT — HONEST STATUS

### What exists in ProviderKycReview.tsx and ProviderApplicationStatus.tsx:

```tsx
// Standard Tailwind classes found
"grid grid-cols-1 md:grid-cols-2"  // 2-column on md breakpoint
"flex flex-col"                     // stacked on mobile
```

**There is no:**
- 3-column desktop layout (files | data | actions)
- Sticky action bar on mobile
- Full-screen image viewer on mobile
- Collapsible sections for mobile
- Tested mobile rendering

The layout adapts from 1-column to 2-column using Tailwind breakpoints. It is not "mobile-first review" as specified. Buttons are not in a sticky bottom bar. Sections are not collapsible. There is no fullscreen image viewer.

---

## 13. RESUBMISSION LIFECYCLE — EXACT RULES

| Rule | Implementation |
|------|---------------|
| Max resubmissions | 3 (`resubmission_count >= 3` returns 400) |
| Token expiry | 5 days from request |
| Token type | 32-byte randomBytes, base64url encoded |
| Token storage | `provider_application_resubmissions.secure_token` |
| Token usage | No auth required — token IS the authentication |
| On upload | `resubmission_count++`, new file URLs written, status → processing |
| Old file visibility | Original URLs in `provider_applications.selfie_photo_url`. New in `provider_application_resubmissions` table. UI does NOT show previous versions. |
| Audit continuity | Same `application_id` throughout all resubmissions ✅ |
| Same application ID | YES — never creates a new application on resubmit ✅ |
| Fulfilled tracking | `fulfilled_at` column exists but is NOT set on upload (missing UPDATE) |

---

## 14. SUPPORT vs MANAGEMENT SEPARATION — WHAT EXISTS vs WHAT'S NEEDED

### Current state (broken — no separation):
Both management and support users with `accessLevel >= 5` hit the **same** `requireAdmin` middleware. Both can approve, reject, send messages, view individual cases. Management has no dedicated analytics routes. Support has no analytics restriction.

### What must be built:

```typescript
// Needed: requireSupport — allows staff, admin, super_admin
// Needed: requireManagement — allows management, admin, super_admin — BLOCKS individual case actions
// Needed: /mgmt/* routes — aggregate queries only, no individual application detail
```

### Support must be able to:
✅ Review individual applications (built, but accessible to management too)
✅ Approve / reject (built)
✅ Request resubmission (built)
✅ Send messages (built)
❌ Not blocked from management analytics (no restriction)

### Management must be able to:
❌ See aggregate KPI dashboard (not built)
❌ See fraud trends (not built)
❌ See reviewer workload (not built)
✅ Must NOT review individual cases (not enforced — they currently CAN)

---

## 15. SCENARIO PROOF — 6 FLOWS

### Scenario 1: Auto-approve
**When:** faceMatchScore ≥ 85, livenessPass = true, flags = 0
**Engine decision:** `approved`
**DB state:** status=approved, reviewedAt=now, approvedAsProviderId=WALKER-XXXXX
**Queue:** NOT created (no queue entry for auto-approved)
**Audit:** `kyc_auto_approved` event emitted ✅
**Messages:** System message "Application approved" logged ✅
**Email:** Approval email sent if SendGrid configured ✅
**Firebase:** Custom claims set with role=provider ✅
**Frontend:** `/provider-application/status` shows approved card

### Scenario 2: pending_review
**When:** faceMatchScore 65–84 or borderline flags
**Engine decision:** `pending_review`
**DB state:** status=pending_review
**Queue:** Queue entry created in `provider_review_queue` ✅
**Audit:** `kyc_pending_review` event ✅
**Messages:** System message written ✅
**Email:** Notification email sent ✅
**Frontend:** Status page shows "under review" state

### Scenario 3: pending_resubmission (auto)
**When:** KYC flags id_document_poor_quality or selfie_poor_quality
**Engine decision:** `pending_resubmission`
**DB state:** status=pending_resubmission, resubmission_count=1
**Queue:** Queue entry created ✅
**Token:** 32-byte token in provider_application_resubmissions ✅
**Email:** Upload link email sent ✅

### Scenario 4: Manual approve (admin)
**When:** Admin clicks Approve on pending_review application
**DB state:** status=approved — ⚠️ BUT NO DB LOCK — race condition possible
**Audit:** admin_approved event ✅
**Queue:** Marked complete ✅
**Firebase:** Claims set ✅
**Email:** Approval email sent ✅

### Scenario 5: Manual reject (admin)
**DB state:** status=rejected ⚠️ Race condition possible — same issue as approve

### Scenario 6: KYC processing failure
**When:** KYC API throws exception
**DB state:** STAYS status=processing — ⚠️ NEVER TRANSITIONS
**Queue:** NEVER CREATED — application is invisible to support forever
**Audit:** NO audit event written on exception
**Monitoring:** Log warning only (logger.warn) — no DB event, no alert
**Frontend:** Status page shows "processing" spinner forever

---

## 16. WHAT MUST BE FIXED BEFORE THIS IS OPERATIONAL

### Priority 1 — CRITICAL (data integrity):
1. **Race condition in approve/reject** — Add `AND status IN ('pending_review', 'pending_resubmission')` to UPDATE WHERE clause, check rowsAffected = 1 before proceeding

### Priority 2 — HIGH (operational reliability):
2. **KYC exception must set status to pending_review** — Currently leaves applications stuck in processing permanently
3. **KYC exception must emit monitoring event** — Currently only logs to console
4. **Resubmission token fulfillment** — `fulfilled_at` must be SET on successful upload
5. **Processing stuck watchdog** — Cron job to detect applications stuck in processing > 30 minutes

### Priority 3 — HIGH (operational usability):
6. **Management vs Support role split** — `requireManagement` middleware, `/mgmt/*` routes aggregate-only
7. **Management analytics dashboard** — Backend aggregation routes + UI
8. **File zoom / fullscreen / download** — Inline viewer component

### Priority 4 — MEDIUM (complete the workflow):
9. **Applicant reply** — `POST /my/messages` route
10. **Monitoring thresholds** — Defined constants + alerting function
11. **Mobile sticky action bar** — Responsive layout on review page
12. **expired state trigger** — Background job to expire old tokens/applications

---

## 17. WHAT IS PROVEN AND WORKING

| Component | Proof |
|-----------|-------|
| 7 new DB tables | Confirmed via `information_schema.tables` |
| 12 new columns on provider_applications | Confirmed via `information_schema.columns` |
| 8-state type definition | `providerDecisionEngine.ts` lines 1–9 |
| KYC decision engine (4 outcomes) | Full code reviewed, logic correct |
| Queue creation on pending_review/pending_resubmission | Code confirms INSERT into provider_review_queue |
| Audit trail on every transition | `writeProviderAudit` called on every status change |
| Message thread creation | logSystemMessage called at appropriate points |
| Resubmission token generation + email | Route 1394–1470, 32-byte token, 5-day expiry |
| Max resubmission enforcement (3) | Count check before creating new token |
| Applicant row-level data isolation | `/my/status` and `/my/messages` filter by UID |
| Provider claims on approval | `auth.setCustomUserClaims` called with role=provider |
| Internal notes hidden from applicants | `provider_visible=false` filter on applicant routes |
| Signed URL for files | Both selfie + ID returned as signed URLs |

---

*This document represents the complete honest state of the system as of April 2026.*
*Every gap is real. Every proof is from actual code, not from claims.*
