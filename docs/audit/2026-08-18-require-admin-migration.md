# requireAdmin Consolidation — 2026-08-18

Follow-up to `claude/pr-admin-auth-gaps` which migrated the two CANONICAL
`requireAdmin` entrypoints (`server/adminAuth.ts` and
`server/middleware/rbac.ts`) to enforce `email_verified` on the super-admin
allowlist path. This PR sweeps the route-file-local `requireAdmin` copies
that were tracked as follow-up.

## Migrated in this PR (12 files → `isSuperAdminVerified(req)`)

All 12 followed the same simple-pattern shape (rely on upstream
`validateFirebaseToken` to populate `req.firebaseUser`, then
`isSuperAdmin(email)`). Swapped to `isSuperAdminVerified(req)` which
enforces BOTH the allowlist and Firebase's `email_verified === true`.

| File | Notes |
|---|---|
| server/routes/admin-alerts.ts | 1 site |
| server/routes/admin-loyalty.ts | 1 site |
| server/routes/admin-payments-control.ts | 1 site |
| server/routes/admin-applications.ts | 1 site (single-line if) |
| server/routes/admin-provider-verification.ts | 1 site (inline body) |
| server/routes/admin-customer-detail.ts | 1 site |
| server/routes/admin-provider-control.ts | 1 site |
| server/routes/admin-bay-control.ts | 1 site |
| server/routes/admin-member-discount.ts | 1 site |
| server/routes/admin-deadlines.ts | 1 site |
| server/routes/google-forms.ts | 1 site |
| server/routes/admin.ts | 2 sites — requireAdmin + requireAdminOrViewer's admin path |

## Deferred (need separate analysis — DIFFERENT shape)

| File | Shape | Why not this PR |
|---|---|---|
| server/routes/admin-notifications.ts | Self-verifies Bearer token, checks `claims.role === 'admin'` | Needs to be either replaced by canonical mount chain OR keep as-is with `email_verified` added |
| server/routes/admin-provider-review.ts | Self-verifies Bearer, checks `SUPER_ADMIN_EMAILS` env manually | Same as above |
| server/routes/admin-reconfirmation.ts | Async | Need to inspect |
| server/routes/police-check.ts | Async | Need to inspect |
| server/routes/provider-onboarding.ts | Async | Need to inspect |
| server/routes/contractor.ts | Async | Need to inspect |
| server/routes/marketplace-ranking.ts | Different signature: returns `string \| null` (userId or null); no `next()` — an inline helper, not middleware | Contract change to make it middleware would break call sites |
| server/routes/kyc.ts | `const requireAdmin = [middleware chain]` | Chain-based; already close to canonical |
| server/routes/admin-identity-merge.ts | `= [validateFirebaseToken, loadUserRole, checkAccessLevel(6)]` | Already canonical (checkAccessLevel enforces DB-loaded role) |
| server/routes/chat-history.ts | Uses `req.user.role === 'admin' \| 'superadmin'` (custom shape) | Different auth model; check separately |
| server/lib/adminCheck.ts | `requireAdminRole` — different function name | Verify usage separately |

## Test invariants

For every migrated file:
- Unverified allowlisted email → DENIED (was previously ALLOWED — the fix)
- Verified allowlisted email → ALLOWED (unchanged)
- Verified normal customer → DENIED (unchanged)
- Missing `req.firebaseUser` → DENIED (rbac.ts:89 guard)
- No client-supplied identity: `body.email` / `body.role` / `body.userId` are IGNORED for authority decisions

## Money invariance

Zero. Auth-code only. No money math, no receipt/VAT/payout/refund logic.
