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

---

## 7. 2026-05-30 milestone update — SUMIT account → PetWash Ltd tax-authority link

**Status:** ✅ SUMIT user account is connected to PetWash Ltd. at the
SUMIT level. Tax-authority allocation-number test still failing
with "user not authorized for business ת.ז." error.

### What changed today

CEO (Nir Hadad) opened sumit.co.il accounting console and reached the
**Tax Authority Connection** screen at
`app.sumit.co.il/accounting/shaamstatus/?companyid=1455151432`.

Screen confirms:

| Field | Value |
|---|---|
| חיבור (Connection) | Israel Tax Authority (חשבוניות ישראל) |
| Connection owner | ניר חדד |
| Identity number | XXXXX4437 (Nir personal ת.ז.) |
| Connecting user email | `nir.h@petwash.co.il` |
| Connection status | **פעיל** (active) |
| Expiry | 28/08/2026 (1-year term) |
| Company entity | פט וואש בע"מ (PetWash Ltd, ע.מ. 517145033) |

This means **SUMIT ↔ Tax Authority handshake is wired at the account
level.** The system knows that "this SUMIT customer" wants to use
"this Nir Hadad person" to act on behalf of "this PetWash Ltd entity"
against Israel Invoices (Mas Shevach קצאה project).

### Why the allocation test still fails

Clicking **"בדיקת החיבור לטובת קבלת מספר הקצאה לחשבוניות"** (Test
connection for allocation-number receipt) returns this error from
the Tax Authority API (translated):

> The user connected to the tax authority (033554437) is NOT
> authorized to receive an allocation number on behalf of the
> business ע.מ. 517145033. Please verify the authorization exists
> on the Tax Authority website in accordance with tax authority
> guidelines.

**Root cause:** the SUMIT side is fine. The **Tax Authority side**
still needs Nir Hadad personal (ת.ז. 033554437) to be registered as
"מורשה-על" (Supreme Authorized Representative) for PetWash Ltd
(ע.מ. 517145033) in the government's digital authorization system at:

→ https://www.gov.il/he/service/authorize-certification-perform-digital-operations

This is a **one-time regulatory setup**, not a code task. See the
runbook in §9 below.

### Why this is still a milestone

Before today:
- SUMIT account existed but had no link to PetWash company entity
- Tax Authority connection slot was empty
- Cannot even attempt allocation-number flow

After today:
- SUMIT recognizes PetWash Ltd. as the company entity
- Tax Authority connection is active for one year
- One known regulatory step remains before invoices can actually be
  issued via the API

This unblocks PR-S2 / PR-S3 scoping: we now know the connection
shape (1 SUMIT account ↔ 1 IL-natural-person authoriser ↔ 1 IL
business entity) and the auth scope (Israel Invoices project,
specifically allocation-number receipt).

---

## 8. Remaining steps to first real invoice

Updated sequence, post 2026-05-30 milestone:

1. **CEO completes gov.il "מורשה-על" registration for PetWash Ltd**
   (one-time, ~15 minutes, Sun-Thu 08:15-15:45, requires digital
   certificate). See runbook
   `docs/finance/runbook-sumit-tax-authority-error.md`.
2. **CEO re-clicks "בדיקת החיבור"** in SUMIT — must return success.
3. PR-S1 — Send remaining SUMIT support email questions (still drafted).
4. PR-S2 — Schema additions (cheaper now that connection model is known).
5. PR-S3 — SumitClient service.
6. PR-S4 — Admin send + feature flag.
7. PR-S5 — Webhook + reconciliation.
8. Sandbox round-trip with one test invoice.
9. Production pilot: one supplier, one week observation.
10. Full rollout.

---

## 9. Connection scope reminder (legal)

The Tax Authority authorization granted via gov.il scopes **what
the connected user can do on behalf of the business**. The minimum
scope needed for SUMIT to issue PetWash invoices is:

- **חשבוניות ישראל** (Israel Invoices project) — allocation number
  receipt for each invoice.

Do NOT grant broader scope without explicit accountant review.
Each additional scope (VAT digital filing, payroll Form 161, donation
reporting) is a separate fiduciary delegation and should only be
enabled when there's a specific operational need.

---

## 11. 2026-05-31 reality check — PR-S2 already shipped

During a CTO sweep on 2026-05-31, the schema additions described in
§3 PR-S2 were found to already exist in the repo. Either a previous
CTO session shipped them or they were authored as part of the
initial supplier-invoice screening work and never re-flagged here.

### Evidence

**Schema** — `shared/schema.ts:15585-15608`:
```
// SUMIT (sumit.co.il) linkage — populated by PR-S4 once the admin
// "Send to SUMIT" button + ff.supplier_invoice_control.sumit_send.enabled
sumitDocumentId:      varchar("sumit_document_id", { length: 64 }),
sumitStatus:          varchar("sumit_status", { length: 20 }),
sumitSentAt:          timestamp("sumit_sent_at", { withTimezone: true }),
sumitConfirmedAt:     timestamp("sumit_confirmed_at", { withTimezone: true }),
sumitLastError:       text("sumit_last_error"),
sumitIdempotencyKey:  varchar("sumit_idempotency_key", { length: 80 }),
```
Plus 3 indexes: `idx_supplier_invoices_sumit_status`, `idx_supplier_invoices_sumit_document`, `idx_supplier_invoices_sumit_idem`.

**Audit-log table** — `shared/schema.ts:15627`:
```
export const sumitOutboundEvents = pgTable("sumit_outbound_events", { ... });
```
With 4 indexes: by invoice, by created-desc, by idempotency, by document.

**Migration file** — `migrations/0025_supplier_invoices_sumit_linkage.sql` exists.

### Implication

The PR-by-PR breakdown in §3 is now: PR-S2 ✅, PR-S1 ⏳ (you/CEO), PR-S3 + PR-S4 + PR-S5 still ahead.

### What's actually blocking PR-S3

The `SumitClient.ts` service (PR-S3) cannot be written responsibly
until PR-S1 unblocks it: SUMIT support must confirm the API auth
model, endpoint base URLs, sandbox credentials, webhook signature
scheme, document-number assignment rules, and marketplace-vendor
model. The 22-question email at `docs/SUMIT_SUPPORT_EMAIL.md` is
drafted; the CEO has not yet sent it.

Without those answers, writing `SumitClient.ts` means guessing the
API shape. Per platform §0 (verify before guessing) and §3 (no
autonomous sends), the CTO will NOT speculate on SUMIT's API.

### Updated remaining-steps sequence (replaces §8)

1. **CEO sends the SUMIT support email** (`docs/SUMIT_SUPPORT_EMAIL.md`).
2. CEO completes gov.il "מורשה-על" registration Sunday morning.
3. CEO re-tests SUMIT connection — expects success.
4. SUMIT replies to support email with API specs (may take 1-5 business days).
5. CTO writes PR-S3 (`SumitClient.ts`) using the confirmed API specs.
6. CTO writes PR-S4 (admin "Send to SUMIT" button + feature flag, default OFF).
7. End-to-end sandbox round-trip with one test invoice.
8. CTO writes PR-S5 (webhook receiver + reconciliation).
9. Flip `ff.supplier_invoice_control.sumit_send.enabled` to ON for one pilot supplier.
10. Watch for one week, then roll out to all suppliers.

---

## 10. Last updated

| Date | Change | By |
|---|---|---|
| 2026-05-23 | Doc created | CTO |
| 2026-05-30 | §7-9 added — SUMIT↔TaxAuth account link established, one regulatory gap remaining | CTO |
| 2026-05-31 | §11 added — PR-S2 found already shipped; remaining sequence updated; PR-S3 blocked on PR-S1 (CEO sends support email) | CTO |
