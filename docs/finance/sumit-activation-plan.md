# Pet Wash Ltd SUMIT Activation Plan

Status: structure only. Do not perform live SUMIT changes until Nir, finance, and accountant approve the staged canary.

## Operating Rule

The PetWash system prepares. The agent checks. Pet Wash approves. The accountant confirms tax/accounting. Only then can SUMIT become official.

No fake receipt numbers, fake invoice numbers, fake provider payments, fake VAT decisions, or silent edits are allowed. Every official document action needs an idempotency key, source evidence, an audit event, and a clear owner.

## Current Control Panel

The read-only SUMIT wiring inspector is mounted at `/api/admin/sumit/*` and is restricted to verified super-admin access.

It does not send documents to SUMIT.

Routes:

- `GET /api/admin/sumit/health`: activation mode, feature flags, secret-presence booleans, invoice status counts, and activation readiness.
- `GET /api/admin/sumit/preflight/:invoiceId`: per-invoice checklist for supplier approval, Israeli osek classification, risk state, idempotency, and env readiness.
- `GET /api/admin/sumit/sync-dryrun`: what would sync if activated, supplier osek-classification buckets, SUMIT job queue depth, recent SUMIT audit events, and activation readiness.

Important: secret values must never appear in the response. Only booleans such as `sumitApiKey: true/false` are allowed.

## Live SUMIT Locks

Real API posting is blocked unless all locks are intentionally open:

1. `sumit.mode = api`
2. `ff.supplier_invoice_control.enabled = true`
3. `ff.supplier_invoice_control.sumit_send.enabled = true`
4. `SUMIT_ENABLED = true`
5. `SUMIT_API_KEY`, `SUMIT_COMPANY_ID`, and `SUMIT_WEBHOOK_SECRET` are present server-side
6. invoice/supplier preflight passes
7. idempotency key exists
8. source evidence exists
9. accountant-required VAT/tax cases are resolved

## Activation Phases

| Phase | Goal | Gate |
|---|---|---|
| Phase 0 | Get facts | Read `/health` and `/sync-dryrun` as super-admin. No live sends. |
| Phase 1 | Provider/supplier tax data ready | Unknown Israeli osek classification count is zero. |
| Phase 2 | Secrets bound | Required SUMIT API secrets exist in Secret Manager/Cloud Run only. |
| Phase 3 | Client and simulator clean | Focused SUMIT tests pass. No stale `sandbox-api` host. Mock/simulator path works through `SUMIT_API_BASE_URL`. |
| Phase 4 | Production dry-run review | Dry-run counts and queue are reviewed by Nir/finance/accountant. |
| Phase 5 | Canary | One approved low-risk document only. Watch audit ledger, queue, and real SUMIT account. |
| Phase 6 | Full on | Only after canary is clean, failed buckets are zero, and alerting exists. |

## Israeli Provider/Supplier Tax Logic

Every supplier/provider must have a stored and reviewed tax classification before official document posting or payout:

- `patur`: עוסק פטור. No VAT claim. Block if the uploaded document includes VAT.
- `murshe`: עוסק מורשה. VAT must be checked against the document.
- `chevra`: חברה בע"מ. VAT/company details must be checked.
- `unknown`: blocked until finance/accountant review.

Do not guess tax status from a name, phone, email, or prior relationship.

## Different Provider Rates and Platform Charges

Provider payout and document logic must preserve the exact agreement used for each job:

- business arm
- service platform
- provider ID
- customer/member ID
- booking/order/job ID
- original customer price
- discount amount
- discount funded by Pet Wash/provider/supplier/franchisee/shared
- VAT amount and VAT rule version
- provider base payout
- provider adjustment
- final provider payout
- agreement rule/version
- approval status
- SUMIT/accountant status
- bank match status

Default rule: Pet Wash discounts do not reduce provider payout unless the signed provider agreement clearly allows it.

## Audit Ledger Rule

SUMIT and money actions must behave like an append-only ledger:

- every send attempt gets an idempotency key
- every result gets a status
- every failure keeps the error reason without exposing secrets
- manual corrections create a new event instead of rewriting history
- accountant decisions are stored as approvals, not hidden comments

## No-Go Conditions

Do not run a live SUMIT canary when any of these are true:

- `sandbox-api.sumit.co.il` appears in executable code
- any supplier/provider has `unknown` osek classification
- SUMIT secrets are missing
- `sumit.mode` is not `api`
- send flag is off
- SUMIT client reports `wired=false`
- failed SUMIT jobs are open
- the invoice is not `ready_for_accountant`
- supplier is not approved
- invoice risk is red
- invoice already has a successful SUMIT document id
- accountant-required VAT/tax issue is unresolved

## Next Production Fact Check

Nir or a verified super-admin should read these in production and paste only the JSON outputs, not any secrets:

```text
GET https://petwash.co.il/api/admin/sumit/health
GET https://petwash.co.il/api/admin/sumit/sync-dryrun
```

Those responses decide the real phase. If either route returns 404, the feature flag or super-admin gate is still closed.

## Accountant/SUMIT Questions Before Canary

- Confirm SUMIT document type mapping for tax invoice, invoice/receipt, receipt, and credit note.
- Confirm whether customer receipts are emailed by PetWash SendGrid or SUMIT mail.
- Confirm VAT treatment for עוסק פטור supplier documents.
- Confirm provider payout exports and accountant monthly pack fields.
- Confirm whether SUMIT can support department/project/location tags for PetWash business arms.

## Current Implementation Notes

- `SumitClient` uses `https://api.sumit.co.il` by default.
- `SUMIT_SANDBOX` is a caller-side safety flag, not a host selector.
- `SUMIT_API_BASE_URL` exists only for local tests/mocks.
- `admin-sumit` dry-run reads `suppliers.osek_classification`, the real schema column.
- The readiness contract surfaces blockers, owner, next action, canary readiness, and full-live readiness.
