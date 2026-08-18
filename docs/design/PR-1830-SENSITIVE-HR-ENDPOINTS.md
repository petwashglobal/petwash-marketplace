# Sensitive HR endpoints — design proposal (companion to PR #1830)

**Status**: proposal — needs CEO + legal sign-off before implementation.
**Blocks**: PR #1830 merge until these endpoints exist OR CEO explicitly accepts the temporary raw-DB fallback.

## Why this doc exists

PR #1830 removed compensation / banking / RBAC / identity fields from the general `PATCH /api/enterprise/hr/employees/:id` allowlist because that endpoint let one compromised admin token rewrite any employee's salary or bank details via a single request body key. That fix is correct.

But leaving ops with no legitimate way to edit those fields (or telling them "use direct DB access") is not an acceptable final architecture — direct DB edits bypass application controls and audit trails.

This doc classifies every removed field, proposes one dedicated audited endpoint per class, and flags every business decision that has to be made before code ships.

## Field classification

| Field | Class | Sensitivity |
|---|---|---|
| `employeeId` | IMMUTABLE | Read-only after creation |
| `firebaseUid` | SECURITY IDENTITY | Never re-writable via API |
| `personalId` (national ID) | ENCRYPTED PII | Rewrite requires proof + legal event |
| `dateOfBirth` | HR PROFILE | Editable via general PATCH (already allowlisted) |
| `gender` | HR PROFILE | Editable via general PATCH |
| `nationality` | HR PROFILE | Editable via general PATCH |
| `address` | HR PROFILE | Editable via general PATCH |
| `emergencyContact` | HR PROFILE | Editable via general PATCH |
| `salary` | COMPENSATION | Rewrite requires HR Manager + dual approval |
| `salaryCurrency` | COMPENSATION | Rewrite requires HR Manager + dual approval |
| `paymentFrequency` | COMPENSATION | Rewrite requires HR Manager |
| `bankAccountDetails` | BANKING | Rewrite requires **verified employee consent event** (not admin body write) |
| `taxDetails` | TAX | Rewrite requires HR Manager + tax-officer role |
| `socialInsuranceNumber` | TAX | Rewrite requires HR Manager + legal event |
| `role` | RBAC | Rewrite requires super_admin + audit reason |
| `permissions` | RBAC | Rewrite requires super_admin + audit reason |
| `franchiseId` | ORG BOUNDARY | Rewrite requires super_admin (multi-tenant move) |

## Proposed endpoint suite

Each endpoint sits under the same `requireAdmin` mount as today's general PATCH, but layers additional authorization + a mandatory audit row. All accept `application/json`, all validated via Zod `.strict()`, all return the updated employee DTO.

Common request envelope for every sensitive-mutation endpoint below:

```
{
  reason: string,           // free-text audit reason, required, min 10 chars
  effectiveDate?: string,   // ISO date; defaults to now
  <field-specific payload>
}
```

Common audit row written to `audit_events` on success:

```
logAuditEvent({
  actorUserId: <requireAdmin resolved uid>,
  actorRole:   <resolved role from server capabilities>,
  actionType:  'HR_' + <ENDPOINT_TAG>,   // e.g. HR_COMPENSATION_UPDATE
  targetType:  'hr_employee',
  targetId:    String(employeeId),
  ip, userAgent, traceId,
  metadata: {
    reason, effectiveDate,
    oldValues: <field-scoped snapshot>,  // hashed / masked for BANKING/TAX
    newValues: <field-scoped snapshot>,  // hashed / masked for BANKING/TAX
  },
  severity: 'warning',
});
```

### 1. `PATCH /api/enterprise/hr/employees/:id/compensation`

Fields: `salary`, `salaryCurrency`, `paymentFrequency`.

- Authorization: `requireAdmin` + server-side capability check `capabilities.hr_compensation === true` (new capability — HR Manager role). Not every admin should compensate.
- **BUSINESS DECISION**: does PetWash want dual-approval on salary changes? If yes, this endpoint writes a `pending_change` row and a companion `POST /api/enterprise/hr/compensation-approvals/:changeId/approve` endpoint requires a second HR Manager to sign off before the actual employee row updates. **FLAG** — recommend dual-approval.
- Audit `oldValues` / `newValues` carry the raw numbers (no masking — these are auditors' primary evidence).

### 2. `PATCH /api/enterprise/hr/employees/:id/bank-details`

Fields: `bankAccountDetails` (full object).

- Authorization: `requireAdmin` + `capabilities.hr_manager === true` AND a verified employee consent event from within the last 24h (see below). Bank-detail rewrites are the #1 payroll-fraud attack (redirect payroll to attacker account) — the extra employee-consent gate is the countermeasure.
- **BUSINESS DECISION**: how does the employee provide consent? Options:
  - a) Employee-initiated flow: employee logs in, sees a "pending bank-detail change" screen, confirms via a fresh OTP to their verified mobile. Consent event stored with 24h TTL. Admin then completes the change within that window.
  - b) Signed evidence upload: HR uploads a bank-change form signed by the employee; a second admin verifies signature. Slower but paper-trail explicit.
  - Recommend (a) for speed + auditability. **FLAG** for business call.
- Audit `oldValues` / `newValues` HASHED (SHA-256 of `iban + account_holder`) not the raw values — auditors get proof of change without a second copy of banking PII in the audit log.

### 3. `PATCH /api/enterprise/hr/employees/:id/tax-details`

Fields: `taxDetails`, `socialInsuranceNumber`.

- Authorization: `requireAdmin` + `capabilities.hr_manager === true`. No employee-consent gate (tax IDs are legal record — HR corrects them from source-of-truth documents).
- **BUSINESS DECISION**: does Israeli tax law require a legal-event trigger (e.g. Bituach Leumi form) to update `socialInsuranceNumber`? **FLAG** for legal review. If yes, endpoint requires an `evidenceDocumentUrl` (link to uploaded form in the encrypted document store) in the request body.
- Audit `oldValues` / `newValues` MASKED (first-4 + last-2 of the tax id) — auditors get proof; second copy of the ID stays out of the audit log.

### 4. `PATCH /api/enterprise/hr/employees/:id/access`

Fields: `role`, `permissions`.

- Authorization: `super_admin` (via `isSuperAdminVerified` — allowlist + `email_verified`; PR-AUTH-ADMIN-7 pattern). No HR Manager promotion — RBAC changes go through the platform owner only.
- `reason` field REQUIRED and audit-log carries actor + reason verbatim.
- Audit `oldValues` / `newValues` carry the raw role + permissions arrays.

### 5. `PATCH /api/enterprise/hr/employees/:id/identity`

Fields: `firebaseUid`.

- Authorization: `super_admin` (verified) AND a `reason` matching a whitelist of legitimate causes: `'GOOGLE_ACCOUNT_MIGRATION'`, `'FIREBASE_PROJECT_MOVE'`, `'ACCOUNT_RECOVERY_AFTER_ID_LOSS'`. Anything else → 400 with the whitelist in the error message.
- Additional post-check: after the `firebaseUid` is rewritten, invalidate ALL of the OLD uid's Firebase sessions AND emit a `FORCE_TOKEN_REFRESH` push to the new uid so the client re-fetches an ID token. Without this, an old session cookie could still act as the old uid.
- Audit row includes `oldFirebaseUid`, `newFirebaseUid`, `reason`, `revokedSessionCount`.

## Fields NOT to endpoint-fy

- `employeeId` — immutable after creation. If HR needs to correct it, the correct answer is: create a new employee row + soft-delete the old one, not rewrite the ID (which invalidates every downstream FK reference from payroll / performance-reviews / access rows).
- `personalId` — same rationale as `firebaseUid`; add to `PATCH …/identity` behind the whitelisted-reason gate. **FLAG** — is a national-ID edit ever legitimate outside creation? Recommend NO (soft-delete + re-create pattern) unless legal review says otherwise.

## Business decisions to flag before implementation

1. **Dual-approval on compensation changes** — recommend yes; needs CEO sign-off on the workflow.
2. **Employee-consent gate for bank-detail changes** — recommend (a) fresh-OTP within 24h; needs product review on employee UX.
3. **Legal-event trigger for `socialInsuranceNumber` rewrite** — needs Israeli tax + legal review.
4. **`personalId` editability** — recommend NO after creation; needs legal review.
5. **What counts as `capabilities.hr_manager` / `capabilities.hr_compensation`?** — needs org-chart decision on which roles get the two capability grants.
6. **Retention policy for the sensitive-mutation audit rows** — needs legal review; recommend 7-year retention (matches payroll retention) + encrypted-at-rest.

## Implementation plan (once decisions land)

1. Add capabilities `hr_manager`, `hr_compensation`, `hr_tax_officer` to `server/lib/userCapabilities.ts` (PR-AUTH-MULTIROLE-5 pattern).
2. New Zod schema module `server/lib/hrSensitivePatchSchemas.ts` — one `.strict()` schema per endpoint, exported for behavioral tests.
3. Five endpoints in `server/routes/enterprise-hr.ts` following the pattern above.
4. Per-endpoint audit rows via `logAuditEvent` (already exists at `server/middleware/auditLog.ts:57`).
5. Behavioral tests per endpoint: allowed-path succeeds and writes an audit row; unauthorized caller (missing capability) → 403; missing `reason` → 400; unknown body key → 400 (`.strict()` rejects).
6. Employee-consent gate for bank-details (new small `hrBankChangeConsents` table + fresh-OTP verify).

Estimated scope: one PR per endpoint (5) + one PR for the capabilities extension + one PR for the consent-gate scaffolding = **7 PRs**, each mergeable independently against PR #1830 once the design lands.

## What blocks PR #1830 merge today

Two options, pick one:

- **Option A (recommended)**: build the endpoint suite above → merge PR #1830 alongside them. Nobody loses the ability to update sensitive HR fields; the writes just have the correct ceremony. Ops has a UI to point at.
- **Option B (temporary)**: CEO explicitly accepts that between PR #1830 merge and the suite shipping, sensitive HR field edits go through a **manual super-admin-only DB migration script** (checked into `scripts/hr-sensitive-mutation.ts`) that requires a written reason + writes the same `audit_events` row the future endpoints will write. This still bypasses UI but keeps the audit lane consistent. **FLAG** for CEO decision.

Either way, PR #1830 does not merge until the operator story is answered.
