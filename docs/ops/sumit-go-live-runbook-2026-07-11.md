# SUMIT Fiscal Go-Live Runbook (2026-07-11)

SUMIT (OfficeGuy) is PetWash's **single official fiscal issuer** — the issuer of record for every PetWash-owned sale. This runbook takes it from the current **dark/sandbox** state to **live per-sale documents**. It is an ordered checklist: do the steps top-to-bottom; do not flip the master switch before the CPA decision (Step 1) is answered.

> Scope reminder: PetWash issues documents only for its **own** sales (membership / prepaid / shop / eGift / marketplace commission). Public walk-up card sales at a K9000 bay are **Nayax's / the operator's** transaction, not ours to receipt.

---

## What is already TRUE (verified — do not re-do)
- **Creds verified live.** `getvatrate` returned HTTP 200, VAT 18% (2026-07-05). CompanyID `1455151432`. Never re-ask for creds; they live in Secret Manager.
- **SUMIT ↔ ITA connection ACTIVE** (פעיל), valid to **28/08/2026**. The tax-authority link is NOT a blocker.
- **Per-class document engine is built + wired** (`server/services/sumitDocumentMapping.ts` + `IsraeliDigitalReceiptService`): each sale maps to the correct SUMIT doc type — InvoiceAndReceipt (wash/shop), Receipt/no-VAT (wallet top-up, eGift purchase), InvoiceAndReceipt at redemption (eGift redeem), Invoice/commission-VAT (provider booking), CreditInvoice (refund).
- **Separate number series per doc type** confirmed live (InvoiceAndReceipt 10000s, Invoice 20000s, Receipt 30000s).
- **Readiness self-checks exist:** `GET /api/admin/sumit/health` (env presence + wired state, never the key) and `POST /api/admin/sumit/connection-test` (one real authed call).

## The gate flags (server/services/SumitClient.ts)
| Flag | Dark/sandbox (now) | Go-live |
|------|--------------------|---------|
| `SUMIT_ENABLED` | unset / not `true` | **`true`** |
| `SUMIT_SANDBOX` | unset / `true` (default) | **`false`** |
| `SUMIT_API_KEY` | set (verified) | set |
| `SUMIT_COMPANY_ID` | `1455151432` | same |
| `SUMIT_WEBHOOK_SECRET` | **must be set** | set (HMAC for inbound webhooks) |

Note: SUMIT has **one** base URL (`https://api.sumit.co.il/`). `SUMIT_SANDBOX` is a **caller-side** flag (audit/logging + guard), not a different endpoint. Live issuance = `SUMIT_ENABLED=true` **and** `SUMIT_SANDBOX=false` with the real key.

---

## Step 1 — CPA DECISION (the one real blocker) 🔴
Marketplace provider bookings: **VAT basis** must be ruled by the CPA (רו״ח קופרברג) — is PetWash a **disclosed agent** (VAT on PetWash's commission only — current mapping, `PROVIDER_BOOKING_COMMISSION` → Invoice) or **principal** (VAT on the full amount)? Memory `provider-vat-18pct-settled` says 18% on PetWash's own commission is correct/closed — but get the **explicit written basis** for marketplace bookings before live issuance so we never invent tax logic (CPA order #1). Everything else is already CPA-consistent.

**Output needed:** one line from the CPA confirming the marketplace booking basis. Nothing else in Step 1.

## Step 2 — Set the go-live secrets (ops, Nir)
1. Confirm `SUMIT_WEBHOOK_SECRET` is set in Secret Manager (create if absent).
2. Ensure `SUMIT_API_KEY`, `SUMIT_COMPANY_ID` are in the Cloud Run `--set-secrets` (durable across deploys).
3. Do **not** flip `SUMIT_ENABLED` yet.

## Step 3 — Pre-flight readiness (no customer impact)
1. `GET /api/admin/sumit/health` → expect `wired:false` reason = "SUMIT_ENABLED not true" and all creds present = true.
2. Temporarily, with `SUMIT_ENABLED=true` + `SUMIT_SANDBOX=true`, run `POST /api/admin/sumit/connection-test` → expect a real authed 200. (Sandbox flag keeps it audit-flagged.)

## Step 4 — Flip live
1. Set `SUMIT_ENABLED=true` **and** `SUMIT_SANDBOX=false`.
2. Redeploy / restart so the flags load.
3. `GET /api/admin/sumit/health` → `wired:true`, sandbox:false.

## Step 5 — Acceptance run (one real ₪1 doc per class)
Issue one real minimal document for each class and confirm the doc type + number series:
- wash / shop → **InvoiceAndReceipt** (10000s), VAT 18% line present
- wallet top-up / eGift purchase → **Receipt** (30000s), **no VAT** (stored value)
- eGift redemption → **InvoiceAndReceipt**, VAT at redemption
- provider booking commission → **Invoice** (20000s), VAT on commission per Step 1
- refund → **CreditInvoice** (זיכוי)
Verify each lands in SUMIT and the customer receipt email fires.

## Step 6 — Void the test documents (CPA)
Have רו״ח קופרברג void the earlier test docs: **#10000, #10001, #20000, #30000** (+ any Step-5 ₪1 docs). These are test issuances, not real sales.

## Step 7 — Watch + rollback
- Watch the first day of live docs (Tower Control finance-reconciliation + SUMIT dashboard).
- **Rollback = one flag:** set `SUMIT_ENABLED=false` (or `SUMIT_SANDBOX=true`) → issuance stops immediately; the client no-ops. No code change, no deploy needed if flags are runtime env.

---

## One-line status
**Code: DONE. Tax link: ACTIVE. Blocker: one CPA line on marketplace VAT basis (Step 1), then flip two flags (Step 4) and run the ₪1-per-class acceptance (Step 5).**
