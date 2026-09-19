# SUMIT / UPay runbooks

## 1. "I paid and got nothing" (customer)

1. Do **not** issue a new payment link first. `POST /api/booking-requests/:id/pay` already refuses a replacement while an unclaimed SUMIT payment of that amount exists.
2. Find the payment: SUMIT portal → תשלומים דיגיטליים, or `listPayments` for the window. The document attached to it carries `PW-REF <externalId>`; that names the order.
3. The watch (`runSumitUnclaimedPaymentWatch`, every cron tick and on every trigger push) will replay the customer's missing return automatically once the payment is 10 minutes old, **if exactly one stamped document matches**. Check the admin alert `sumit_unclaimed_payment:<id>`: if it says "late return replayed … refused: <HTTP …>", read the route's reason (amount mismatch, status gate, deal gate, claim by another order).
4. If the stamp is ambiguous (two same-value documents in the window) a human matches it: confirm the customer, then call the return route once for that order with the PaymentID — the claim makes a second call a no-op.
5. Never edit `booking_requests.status` by hand to "confirmed"; the escrow, calendar, letters and bridge write-backs only happen on the route.

## 2. Go-live and rollback flags

Live = `SUMIT_ENABLED=true` **and** `SUMIT_SANDBOX=false` with the real key **and** `SUMIT_COMPANY_ID`. Rollback = `SUMIT_ENABLED=false` (issuance and card pages stop; everything answers `{ wired:false }`), no deploy of code needed if the flag is runtime env — but note the deploy line is `--set-env-vars` that REPLACES all plain env, so a console-set value is wiped on the next deploy; change the workflow line and the smoke mirror (`scripts/guards/deploy_env_mirrors_smoke.py` enforces the mirror). Full ordered checklist: `docs/ops/sumit-go-live-runbook-2026-07-11.md`.

## 3. Tax Authority errors in the SUMIT portal

"המשתמש המחובר אל רשות המסים אינו רשאי לקבל מספר הקצאה", "תוקף ההרשאה פג", allocation number rejected: these are **מורשה-על authorisation paperwork at gov.il**, not code. Escalate to the accountant, not an engineer. Steps: `docs/finance/runbook-sumit-tax-authority-error.md`. The SUMIT↔ITA link was active and valid to 28/08/2026; renew before it lapses.

## 4. The diagnose workflows (Actions tab; the Claude GitHub App cannot dispatch them — a human presses Run)

| Workflow | Does | Money? |
|---|---|---|
| `diagnose-sumit-payment.yml` | one real `beginredirect` for ₪N, prints the response shape | creates a page only; nothing charged unless someone pays it |
| `diagnose-sumit-upay-status.yml` | three read calls (creds, VAT rate, status) | no |
| `sumit-trigger-subscription.yml` | subscribes SUMIT's CRM trigger to `/api/sumit/trigger/<token>` | no |
| `diagnose-chat-delivery.yml`, `diagnose-email-samples.yml` | not SUMIT — messaging/email samples | no |

Secrets are loaded from GCP Secret Manager and masked; if a run prints a value it is a bug, fix the workflow.

## 5. Reconciliation (dark today)

`SumitReconciliationService` (daily SUMIT-docs ↔ local-rows diff, writes `sumit_reconcile_runs`) starts but returns "SUMIT_DAILY_RECONCILE_ENABLED is not true". Turning it on is a deploy-env decision; it is read-only against SUMIT. Until then the unclaimed watch is the only automatic cross-check.

## 6. Refunds

Customer refund = CreditInvoice through `IsraeliDigitalReceiptService` (`paymentClass` refund mapping) + the wallet/escrow refund path that owns the money. `SumitSyncService.runDocumentCancel` and `runCustomerSync` are stubs (`pending_swagger`, return true). `POST /api/gift-cards/purchase` is a retired Nayax rail (503 forever).

## 7. Secret hygiene lessons (2026-09-19)

- A secret with a trailing newline is a 400 from the provider with no field named; log the provider's error body (redacted), and read every secret through a cleaner.
- Secret Manager currently also holds `TWILIO_PHONE_NUMBER_IL/_US` placeholders that are not E.164 — unrelated to SUMIT but the same lesson: a present secret is not a valid secret. `SumitClient.isWired()` requires key **and** company id; the boot guard now refuses to start without the company id in production.

## 8. Who to ask

- SUMIT support: support@sumit.co.il (answers within hours; an AI agent "ג'יימס" replies first, cite the swagger when it contradicts the help centre).
- UPay: info@upay.co.il, 03-8008729 — asks for identification (ח.פ., ID issue date or DOB, last 4 bank digits or registration email) before answering anything; the open questions are foreign cards, passport in the ID field, and payout/document status.
- CPA (רו״ח קופרברג): the marketplace VAT basis (disclosed agent vs principal) — one written line still owed.
