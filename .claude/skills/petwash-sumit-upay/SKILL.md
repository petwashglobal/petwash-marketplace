---
name: petwash-sumit-upay
description: Use this skill for ANY work that touches SUMIT (sumit.co.il / OfficeGuy — PetWash's fiscal issuer and card rail) or UPay (יופיי פיננסים — the clearing licence underneath SUMIT). Triggers on keywords such as SUMIT, sumit.co.il, OfficeGuy, UPay, upay.co.il, beginredirect, hosted payment page, OG-PaymentID, ExternalIdentifier, PW-REF, payments/get, payments/list, documents/create, documents/list, חשבונית מס/קבלה, קבלה, חשבונית זיכוי, credit invoice, allocation number (מספר הקצאה), VAT, invoice, receipt, tax document, card payment, save card, recurring charge, multivendorcharge, marketplace split, openupayterminal, unclaimed payment, late return, SumitClient, IsraeliDigitalReceiptService, SUMIT_ENABLED, SUMIT_SANDBOX, BOOKING_CARD_RAIL, or a customer who "paid but got nothing". It states what is live, what SUMIT has confirmed in writing, what the API cannot do, which flags are dark on purpose, and how to test without moving money. Pairs with petwash-money-booking-invariants (safety rules) and petwash-booking-architect (booking state machine).
---

# PetWash × SUMIT × UPay

SUMIT is PetWash's **single fiscal issuer** (every Israeli tax document) and, since 2026-09-17, its **online card rail** (hosted payment page). UPay is the **clearing licence attached to the SUMIT account**; it is reached only through `api.sumit.co.il`. There is no UPay API, key, SDK or webhook — do not look for one, do not "finish" `server/services/payment-providers/UpayProvider.ts` (a fail-closed contingency stub on no money path). Nayax is a different rail (K9000 kiosk hardware) and never overlaps.

**Audience:** any agent changing payments, receipts, refunds, bookings that charge, or the diagnostics around them.

## What is true in production (2026-09-19)

| Thing | State | Where |
|---|---|---|
| Hosted-page card payments (wallet / packages, booking `/pay`, guest eGift, shop checkout) | **LIVE** | `SUMIT_ENABLED=true`, `SUMIT_SANDBOX=false`, `BOOKING_CARD_RAIL=sumit` in `.github/workflows/petwash-ci.yml` `--set-env-vars` |
| Consumer tax documents (InvoiceAndReceipt / Receipt / Invoice / CreditInvoice by paymentClass) | **LIVE** | `IsraeliDigitalReceiptService` → `SumitReceiptService` → `SumitClient.createCustomerReceipt` |
| Tax Authority link (allocation numbers) | ACTIVE | SUMIT portal, CompanyID `1455151432`; errors are paperwork, see <references/runbooks.md> |
| The unclaimed-payment watch + **late return** | LIVE | `server/cron/sumit-unclaimed-payments.ts`, `server/lib/sumitLateReturn.ts` (#2655) |
| Boot guard | LIVE | `SUMIT_ENABLED=true` in production requires `SUMIT_API_KEY`, `SUMIT_WEBHOOK_SECRET` **and** `SUMIT_COMPANY_ID` (`server/lib/payment-provider-mode.ts`) |
| Daily reconciliation, customer CRM sync, saved-card charge, recurring charge, card vault, Nayax→SUMIT bridge | **DARK by decision** — flags not in the deploy env | `SUMIT_DAILY_RECONCILE_ENABLED`, `SUMIT_CUSTOMER_SYNC_ENABLED`, `SUMIT_SAVED_CARD_CHARGE_ENABLED`, `SUMIT_RECURRING_CHARGE_ENABLED`, `CARD_VAULT_ENABLED`, `NAYAX_SUMIT_BRIDGE_ENABLED` |
| Supplier-invoice lane (PR-S4) | off by default, human-click only | `ff.supplier_invoice_control.sumit_send.enabled`, `sumit.mode` |
| Marketplace split clearing (`multivendorcharge`, `openupayterminal`, per-provider `companies/create`) | **design only, nothing built** | `docs/finance/sumit-upay-marketplace-integration-2026-09-19.md` |

`SUMIT_SANDBOX` is a caller-side audit flag, **not a different endpoint** — there is one base URL, `https://api.sumit.co.il`. Flipping it does not make a call safe.

## What SUMIT confirmed in writing (support thread, 2026-09-18) — do not re-ask

1. The `ExternalIdentifier` we send with `beginredirect` is **only** echoed on the `RedirectURL` (as `OG-ExternalIdentifier`) and shown in the portal. It is **not returned** by `/billing/payments/get/` or `/billing/payments/list/`. There is no API that links a payment to our order.
2. The Triggers-module webhook is **not documented** to carry it either. Buying the Triggers module / Growth plan does not solve this.
3. Writing our reference into the payment page's `DocumentDescription` and finding it via `/accounting/documents/list/` is, in SUMIT's words, the common approach. We do exactly that: `SUMIT_ORDER_REF_PREFIX = 'PW-REF '`.

## The one-payment-one-order rule (how a payment becomes an order)

```
customer → SUMIT hosted page → SUMIT redirects to OUR /return route with OG-PaymentID
/return: getTransaction(id) re-verify → amount == order amount → claimSumitPayment(id, orderRef)   [sumit_payment_claims, PK payment_id]
       → fulfil (booking confirmed / voucher issued / wallet activated) → success page
```
- The `OG-ExternalIdentifier` in the URL is attacker-controlled; **the claim table is the binding**, not the querystring (`server/lib/sumitPaymentReturn.ts`).
- Customer closed the tab before the redirect? The watch lists valid payments, reads the `PW-REF` stamp from the document, and **replays the same GET against our own /return on loopback** (`replayLateReturn`). The route's redirect is the verdict. Ambiguous stamp (two documents, same value, same window) = alert, never a guess. Younger than 10 min = wait.
- Never fulfil anywhere else. Never trust `Valid`/`Result` from the querystring. Never create a second link while an unclaimed payment of that amount exists (`unclaimedPaymentsIn`, used by `/pay`).

## Documents — the CPA-owned mapping

`server/services/sumitDocumentMapping.ts` decides the document type per `paymentClass`; **never invent tax logic**. Wash / shop → InvoiceAndReceipt (VAT). Wallet top-up / eGift purchase → Receipt, **no VAT** (stored value). eGift redemption → InvoiceAndReceipt at redemption. Provider booking → Invoice on **PetWash's commission** (disclosed-agent basis — the one CPA line still to be written down, see runbook). Refund → CreditInvoice. The hosted page's own document is kept a **draft** (`DraftDocument: true`) so we issue exactly one official document per payment. Document numbers run in separate series (InvoiceAndReceipt 10000s, Invoice 20000s, Receipt 30000s).

Dates sent to `documents/list` are **ISO only** (`YYYY-MM-DD`). `DD/MM/YYYY` is misread as `MM/DD` and returns a clean, wrong, empty window — which once authorised a duplicate legal document. `findDocumentByExternalReference` returns `INCONCLUSIVE`, not `ABSENT`, whenever it cannot prove absence; only `ABSENT` permits a retry.

## Secrets and their shapes (never print values)

`SUMIT_API_KEY`, `SUMIT_COMPANY_ID`, `SUMIT_WEBHOOK_SECRET` come from GCP Secret Manager via `--set-secrets` (strategy `overwrite`: omitting one strips it). Secrets have arrived with trailing newlines before — read them through the existing trim/clean helpers, never raw. The webhook is HMAC over the raw body (`x-sumit-signature | x-signature | x-hub-signature-256`, `sha256=<hex>`), receiver `server/routes/sumit-webhook.ts`; the trigger push endpoint is `/api/sumit/trigger/<token>` (token derived in `server/lib/sumitTriggerToken.ts`) and only **wakes the unclaimed watch** — it carries no money facts.

## Testing without moving money

| Want to know | Do |
|---|---|
| Are the creds live? | `GET /api/admin/sumit/health` (presence + wired, never the key), `POST /api/admin/sumit/connection-test` (one real `getvatrate`) |
| Does the hosted page open? | Actions → `diagnose-sumit-payment.yml` — creates a payment PAGE for ₪N; nothing is charged unless a human pays it |
| Read-only SUMIT/UPay status | Actions → `diagnose-sumit-upay-status.yml` |
| Unit / regression | `NODE_ENV=test NAYAX_ENABLED=false SUMIT_ENABLED=false PAYMENT_PROVIDER_MODE=mock npx vitest run sumit` (43 files); CI job `sumit-tax-doc-tests` runs `nayax sumit fiscal` |
| A real ₪1 end to end | only with the CEO, then have the CPA void the test document |

Mock mode never fakes success (Rule H): in tests every SUMIT call answers `{ wired:false }`.

## Hard rules (from petwash-money-booking-invariants, restated for this rail)

- `amountCents > 0` everywhere except the kiosk free-wash exemption. A 100 % coupon cannot reach SUMIT (`COUPON_DISCOUNT_TOO_LARGE`, ₪1 floor).
- One official document per payment; never a second create on an `INCONCLUSIVE` lookup.
- Refunds are CreditInvoices through the receipt service; `SumitSyncService.runDocumentCancel` is a stub that records `pending_swagger` and returns success — do not route a refund through it.
- Money-domain files are single-owner per change (platform skill §GATE 0). If another session is on SUMIT, stop and coordinate.
- Provider money still clears through PetWash's own terminal today. The marketplace split is the fix and is **not built**; the seven questions to SUMIT are drafted in `docs/finance/sumit-marketplace-questions-2026-09-18.md` and unsent.

## Reference files

- <references/endpoints.md> — every SUMIT endpoint `SumitClient` calls, its method, request/response facts verified live, and the gotchas.
- <references/runbooks.md> — go-live flags, Tax Authority errors, the diagnose workflows, the unclaimed watch, what to do when a customer says "I paid and got nothing".
- <references/marketplace.md> — the multivendor design read off the OpenAPI spec, the open vendor questions, and what UPay will and will not answer.
