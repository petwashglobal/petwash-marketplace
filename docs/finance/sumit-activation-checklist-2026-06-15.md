# SUMIT activation checklist — turn on Wolt/Uber-style invoicing (2026-06-15)

Plain-English steps to take the **live SUMIT account** (confirmed open in browser
as "פט וואש בע"מ" with full invoicing + an API module) and connect it to the
PetWash backend so we issue real Israeli tax invoices automatically.

## Reality check (verified in code, 2026-06-15)
The integration is **built end-to-end** — the old "stub" comment in
`SumitClient.ts` is stale:
- `SumitClient.createDocument` → real `POST https://api.sumit.co.il/accounting/documents/create/` (DocumentType 1 = חשבונית מס), idempotency, HMAC webhook verify.
- Callers exist: `SumitDispatcher`, `SumitSyncService`, `SupplierInvoiceSumitSendService`.
- Admin readiness surface: `GET /api/admin/sumit/health`, `GET /api/admin/sumit/sync-dryrun` (super-admin).
- Inbound webhook receiver mounted: `POST /api/sumit/webhook` (HMAC-verified).
- Disclosed-agent VAT (15% commission, not GMV) coded in `TransactionEngine.ts`.

It is **gated**, not missing. To go live you flip switches and verify in sandbox.

## What blocks it (exactly 4 things)
1. Credentials not set: `SUMIT_API_KEY`, `SUMIT_COMPANY_ID`, `SUMIT_WEBHOOK_SECRET`.
2. `SUMIT_ENABLED` not `true` (so `isWired()` returns false → every send no-ops).
3. Feature flag `ff.supplier_invoice_control.sumit_send.enabled` off.
4. Request **body field names are best-guess** vs SUMIT's authenticated swagger
   (the code itself flags this) — must be verified in **sandbox** before production.

---

## Step 1 — Credentials (CEO / ops; I won't handle the key)
In the live SUMIT panel → **API** module:
- Copy the **API Key** and **Company ID**.
- Create a **webhook secret** (a long random string) and register the webhook to
  `https://petwash.co.il/api/sumit/webhook` with that secret.

Set on the backend (Cloud Run secrets — **never in code**):
```
SUMIT_API_KEY=…           SUMIT_COMPANY_ID=…        SUMIT_WEBHOOK_SECRET=…
SUMIT_ENABLED=true        SUMIT_SANDBOX=true        # keep sandbox until Step 3 passes
```

## Step 2 — Confirm wiring (read-only, safe)
As super-admin:
- `GET /api/admin/sumit/health` → expect `sumitClient.wired: true` and all creds green.
- `GET /api/admin/sumit/sync-dryrun` → dry-run; confirms what *would* be sent, fires nothing.

## Step 3 — Verify in SANDBOX (the one real engineering unknown)
With `SUMIT_SANDBOX=true`, enable `ff.supplier_invoice_control.sumit_send.enabled`
and send **one** test document. Then check the SUMIT testing org:
- Did a **חשבונית מס** appear with the right customer, amount, and VAT?
- If SUMIT rejects it or maps fields wrong, fix the `createDocument` body shape
  (`Credentials` / `DocumentType` / `Items` / `Customer`) against SUMIT's real
  swagger. **This is the only step that may need a code change.**

## Step 4 — Go live (production)
Only after Step 3 passes **and** you approve: set `SUMIT_SANDBOX=false`.
Real tax-invoice issuance + provider self-billing begins.

---

## The two document flows (the Wolt/Uber model, already coded)
- **Customer tax invoice:** K9000 = PetWash is the principal (100% taxable sale);
  marketplace (sitter/walk/trek) = PetWash is the **disclosed agent**, VAT on the
  **~15% commission only**, not the full job price.
- **Provider self-billed document:** PetWash issues the invoice **on the provider's
  behalf** (the Wolt move). Requires each provider's **osek number + bank details**
  (schema fields exist; provider onboarding must collect them before payout).

*Code references: `server/services/SumitClient.ts`, `SumitDispatcher.ts`,
`SumitSyncService.ts`, `SupplierInvoiceSumitSendService.ts`,
`server/routes/admin-sumit.ts`, `server/routes/sumit-webhook.ts`,
`server/lib/payment-provider-mode.ts`, `server/services/TransactionEngine.ts`.*
