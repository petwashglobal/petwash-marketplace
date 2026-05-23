# SUMIT readiness check — 2026-05-23

**Question this answers:** What needs to happen before PetWash can actually
push an invoice to sumit.co.il in production?

**Short answer:** A lot. The screening pipeline that *feeds* SUMIT is live
(behind a flag). The connector that *talks to* SUMIT does not exist yet.
There are five sequenced PRs between today's state and a real SUMIT send.

## 1. Current state (one paragraph)

PR #370 (commit `b8063f0`, merged 2026-05-23) added the inbound
supplier-invoice screening pipeline: upload → SHA-256 dedupe → Google
Vision OCR → Gemini fraud detection → deterministic rules →
`ready_for_accountant` terminal state. The pipeline is gated by
`ff.supplier_invoice_control.enabled` (default OFF). No invoice has
ever left the screening stage. No code calls `api.sumit.co.il`. The
`SUMIT_API_KEY` / `SUMIT_WEBHOOK_SECRET` env vars are validated for
presence in `server/lib/payment-provider-mode.ts` but never read.
The 22-question support email to SUMIT (`docs/SUMIT_SUPPORT_EMAIL.md`)
is drafted and has not been sent.

## 2. What's already in place (no work needed)

| Capability | Where | Notes |
|---|---|---|
| Supplier invoice ingestion | `SupplierInvoiceScreeningService.ts` | PR #370 |
| Schema: `supplier_invoices`, `supplier_invoice_checks` | `shared/schema.ts:15555,15596` | PR #370 |
| OCR (Google Vision) | `ReceiptOCRService.ts` | Pre-existing |
| Fraud scoring (Gemini) | wired into screening | PR #370 |
| Env validation for SUMIT keys | `payment-provider-mode.ts:59,118-129` | Validates presence only |
| Architecture design | `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` | SDD v3 |
| Vendor / rail architecture | `docs/finance/sumit-upay-vendor-discovery-and-rail-architecture.md` | Reference |
| Drafted support email | `docs/SUMIT_SUPPORT_EMAIL.md` | 22 open questions |

## 3. What's blocking — PR-by-PR breakdown

Each row is the smallest safe PR. Each one must be approved
individually before code starts.

### PR-S1 — Send the SUMIT support email (no code)
- **Action:** CEO sends `docs/SUMIT_SUPPORT_EMAIL.md` from
  `nir.h@petwash.co.il`.
- **Unblocks:** PR-S2 cannot start until SUMIT confirms API auth model
  (body-embedded credentials vs. header), endpoint base URL, sandbox
  credentials, webhook signature scheme, document-number assignment
  rules, marketplace-vendor model.
- **Risk:** none — operational, not code.

### PR-S2 — Schema additions for SUMIT linkage
- **New columns on `supplier_invoices`:**
  `sumit_document_id`, `sumit_status` (enum: `pending` | `sent` | `confirmed` | `failed`),
  `sumit_sent_at`, `sumit_confirmed_at`, `sumit_last_error`, `sumit_idempotency_key`.
- **New table:** `sumit_outbound_events` — append-only log of every
  payload + response (for audit + replay).
- **Protected system:** YES — schema change. Requires explicit approval.
- **Risk:** medium. Reversible with `DROP COLUMN` if no rows have a non-null SUMIT id.

### PR-S3 — `SumitClient` service (no caller, no flag yet)
- New `server/services/SumitClient.ts` — HTTP client + retry +
  signed-webhook verification + audit log entry per call.
- Returns `wired: false` from a `health()` method until
  `SUMIT_ENABLED=true` and a successful sandbox round-trip.
- **No route mounts.** **No invoice ever calls it.** This PR is the
  client + tests only.
- **Risk:** low. Self-contained service. No behavior change anywhere.

### PR-S4 — `sumit_send` feature flag + admin button
- Add `ff.supplier_invoice_control.sumit_send.enabled` (default OFF).
- Admin "Send to SUMIT" button appears on
  `ready_for_accountant` invoices when flag is ON.
- Click → audit log → `SumitClient.createDocument()` → write
  `sumit_document_id` + `sumit_status`.
- **Protected system:** YES — money-adjacent. Requires explicit approval.
- **Risk:** medium. Human gates the send. Flag stays OFF until first
  successful sandbox round-trip with real SUMIT credentials.

### PR-S5 — Webhook receiver + reconciliation
- `POST /api/sumit/webhook` — HMAC-validate via `SUMIT_WEBHOOK_SECRET`,
  update `sumit_status`.
- Daily reconciliation job: any `sumit_status='sent'` older than 24h
  → alert.
- **Risk:** medium. Webhook idempotency is the trap — must dedupe
  by SUMIT event id + invoice id.

## 4. "Google IT account" — open question

The user asked whether SUMIT is "synced to our google it account." I
found no code for any Google Workspace / Gmail / IT-account sync. Google
appears in the repo only as Vision (OCR), Drive (backup), and Sheets
(admin logging). If the intent is one of:

- Forward each SUMIT invoice PDF to a shared Drive folder for the accountant
- CC accountant's Google Workspace mailbox on each SUMIT submission
- Mirror SUMIT documents into a Sheet for the bookkeeper

…each is a small, separate PR after PR-S4 and should be specified
explicitly. Until then, no Google sync exists or is planned.

## 5. Risk callouts

- **Money rail.** SUMIT issues legally-valid IL invoices. A duplicate or
  wrong-amount send creates a real tax-compliance incident. Every
  outbound call must be idempotency-keyed and audit-logged before the
  send, not after.
- **Marketplace-vendor model.** SDD references a SUMIT multi-vendor
  payment path. That is a separate authorization scope from
  document-issuance and should NOT be combined into one PR.
- **No autonomous sends.** Per `petwash-platform` §3, Gemini does not
  release money. SUMIT sends must be a human click that writes the audit
  log; AI may surface "ready to send" but cannot trigger.
- **Sandbox first.** Production SUMIT credentials must not be installed
  until PR-S3 + PR-S4 have run end-to-end against SUMIT sandbox with a
  test merchant and the audit log shows expected pre/post state.

## 6. Recommended sequence

1. PR-S1 (today): send the support email.
2. Wait for SUMIT reply (blocking).
3. PR-S2: schema additions (small, isolated).
4. PR-S3: SumitClient service (no caller).
5. PR-S4: admin send + flag (still OFF in prod).
6. Sandbox round-trip with one test invoice end-to-end.
7. PR-S5: webhook + reconciliation.
8. Flip `ff.supplier_invoice_control.sumit_send.enabled` to ON for one
   pilot supplier. Watch for one week.
9. Roll out remaining suppliers.

No step above is currently in progress. PR-S1 is unblocked the moment
the CEO sends the email.
