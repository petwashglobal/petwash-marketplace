# SDD: Universal Outgoings / Accounts Payable Engine — every shekel that LEAVES PetWash

| | |
|---|---|
| **Status** | Draft (design only — no code, no migrations, no PRs) |
| **Date** | 2026-05-27 |
| **Author** | SDD Writer Agent (PetWash) |
| **Feature flag (umbrella)** | `ff.commerce.unified_outflow_engine.enabled` (default **OFF**) |
| **Sub-flags** | `ff.outflow.refunds.enabled`, `ff.outflow.provider_payouts.enabled`, `ff.outflow.supplier_invoices.enabled`, `ff.outflow.vat_remittance.enabled`, `ff.outflow.tax_remittance.enabled`, `ff.outflow.salary_disbursement.enabled`, `ff.outflow.insurance_premiums.enabled`, `ff.outflow.dual_control_required`, `ff.outflow.bank_account_binding`, `ff.outflow.anomaly_detection`, `ff.outflow.related_party_block`, `ff.outflow.bank_holiday_queue` |
| **Method** | `.github/skills/sdd-writer-iterative/SKILL.md` |
| **Requested by** | CEO (nir.h@petwash.co.il) on 2026-05-27 |
| **Sibling SDD (money-IN — merged PR #467)** | `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md` — this SDD is the **money-OUT mirror**. Same primitives, opposite direction. |
| **Sibling SDDs (reference, do not restate)** | `docs/design/2026-05-25-commerce-promotions-pricing.md` (pricing, VAT, wallet primitives — merged); `docs/design/2026-05-26-shop-module-physical-goods.md` (shop catalog/inventory/checkout); `docs/design/2026-05-25-smart-identity-routing.md` (KYC/identity routing); `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` (supplier invoice fraud screening — this SDD extends it to the unified outflow ledger). |

---

## Table of contents

0. Operator framing — why now (the "save us" half)
1. Executive summary
2. Goals / Non-goals
3. Repository context (what exists today, cited)
4. Users, roles, accessibility, localization
5. Architecture (components, data flow, sequences)
6. Universal `OutflowRequest` primitive (component A)
7. Universal `OutflowLifecycle` state machine (component B)
8. Fraud-control layer — the "save us" core (component C)
9. Provider payout sub-system (component D — highest volume)
10. Refund sub-system (component E)
11. Supplier invoice payment sub-system (component F — extends 2026-05-22 SDD)
12. Salary / staff disbursement sub-system (component G)
13. VAT / tax remittance sub-system (component H)
14. Insurance premium sub-system (component I)
15. Data model (new/changed tables, additive-first)
16. Security & fraud model (expansive — minimum 10 threats per operator directive)
17. APIs / interfaces
18. Money & audit (ledger movements, reconciliation)
19. Rollout & feature flags (per-surface adoption sequence)
20. Test plan
21. Rollback plan
22. Open questions (minimum 12)
23. First implementation PR (smallest safe slice)
24. Appendix A — original operator request (verbatim)
25. Appendix B — fraud control reference matrix
26. Appendix C — symmetry table vs the money-IN SDD (PR #467)

---

## 0. Operator framing — why now (preserve this section)

Operator directive (2026-05-27, verbatim — full quote also in Appendix A):

> "Save us, secure us and make us better, top global pet lifestyle hub, platforms, shop, free activity, fun, attractive, perks, most advanced globally if total offering of services and tech. Launch 🚀 both."

Translation for this SDD: this is the **"save us" half**. The "make us better / fun / attractive / perks" half belongs to engagement SDDs (Tentacles 8, 11, 13) and is explicitly out of scope here. The operator's directive that pairs both halves into one breath is preserved verbatim because the agent must not paraphrase away the operator's compound intent — but only the "save us, secure us" half is **acted on** in this document.

**Why money-OUT, now**:

PR #467 (`docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md`) landed the money-IN backbone — one router, one lifecycle, one receipt subsystem, one audit. Money-OUT remains the **single biggest financial liability fix on the platform today**:

- Provider payouts are partially automated via `superAppPayouts` + `ProviderPayoutService` (`server/services/ProviderPayoutService.ts:24-611`, 72-hour escrow auto-release + AI verification), but **bank disbursement itself remains manual** — no Masav rail (intentionally absent and **forbidden** by regression tests at `server/tests/financeDash.regression.test.ts:88`).
- Supplier invoices are handled by the screening SDD `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` (`accountsPayable` + `supplier_invoices` + `invoice_checks` design) — but the **payment leg** is also manual today.
- Refund flow is scattered per-surface: bookings refund through `BookingLifecycleService`, gift cards through `EgiftFinancialService`, wallet top-ups through `UnifiedWalletService`, kiosk through `NayaxOnlinePaymentService`, shop through the sibling shop SDD's checkout. No single refund engine; no single cooling-off rule table.
- VAT remittance is hand-rolled monthly. `taxReturns` + `taxPayments` exist in `shared/schema-finance.ts:123-175` but are **manual entry today** with no auto-preparation from `purchase_events` (PR #467 §7.5).
- Withholding remittance has a ledger (`withholdingRemittanceLedger`, `shared/schema.ts:15200-15234`) but no automated quarterly Form 856 disbursement.

At Rover-scale ($1B GMV reference frame, hundreds of thousands of payouts/month — per the Octopus v2 amendment merged at `100f81e`), every one of these manual paths is a fraud surface and a Sarbanes-Oxley-style audit failure waiting to happen. **This SDD makes outgoings airtight BEFORE volume scales.**

The pairing with PR #467 is deliberate: every money-IN primitive has a money-OUT mirror. The reader of this SDD should be able to put the two docs side-by-side and see the symmetry table (§26 / Appendix C).

## 1. Executive summary

PetWash has eight outflow categories today (or in flight): **provider payouts** (commission to walkers/sitters/trainers/groomers/academy/drivers/station staff), **franchise revenue-share** (split per franchise station, Tentacle 6), **refunds** (across shop, bookings, gift cards, wallet top-ups, franchise fees, kiosk), **supplier invoices** (existing screening SDD), **salaries / 1099-equivalent staff payments** (disbursement leg only — payroll calculation is out of scope), **VAT remittance** (monthly form 102 + 126 to הרשות המסים), **insurance premium outflows** (provider liability, employer's liability, future pet insurance), and **tax payments** (corporate income tax, withholding tax). Today each category has its own ad-hoc path; **none is fraud-airtight**; none uses a single audit row shape; none has a dual-control choke point that scales beyond a small team.

This SDD designs the **money-OUT mirror** of PR #467's money-IN backbone. Five platform-wide primitives:

- **A. `OutflowRequest`** — symmetric to `PurchaseIntent` (PR #467 §6.2). Inputs: amount, currency, beneficiary, beneficiary type, surface that originated the outflow, fee structure, payment method, tax classification. Client cannot submit `amountCents`, `beneficiaryBankAccount`, or `taxClassification` — all resolved server-side from finance-confirmed reference tables and authoritative source rows.
- **B. `OutflowLifecycle`** — `draft → pending_finance_review → approved → executing → executed` plus `failed / cancelled / clawed_back / manual_review`. The `pending_finance_review` state is the dual-control choke point. Every transition emits a `outflow_events` row shaped identically to PR #467's `purchase_events` (§7.5).
- **C. Fraud-control layer** — dual control, velocity caps, signed bank-account binding, no-client-submitted-amounts, insider-theft mitigation (related-party detection), anomaly detection (anchored to `walletFraudLog`, `shared/schema.ts:11795`), bank-holiday + weekend handling.
- **D. Per-category sub-systems** — Provider Payout extends `superAppPayouts` + `ProviderPayoutService` with cadence/holdback/method/tax-form configuration. Refund engine reverse-flows through the same acquirer the original payment used (preserves PCI scope + reconciliation symmetry). Supplier Invoice payment extends `2026-05-22-supplier-invoice-sumit-fraud-control.md` to its disbursement leg. Salary disbursement consumes payroll-domain output (separate SDD) and runs the bank-transfer leg. VAT/tax remittance auto-prepares form files from `purchase_events` + `withholdingRemittanceLedger`; operator clicks submit. Insurance premium outflows are recurring scheduled outflows.

No production code lands from this SDD. The contract is a **shared TypeScript type pack** (`shared/outflow-lifecycle/*.ts`), five new service classes under `server/services/commerce/outflow/*`, one new migration with five new tables (`outflows`, `outflow_events`, `beneficiaries`, `beneficiary_bank_accounts`, `outflow_approval_rules`) plus narrow additive columns on existing surface tables, and a per-category adapter pattern. Per-category adopters (refunds → provider payouts → supplier invoices → VAT/tax → salaries) migrate one at a time behind sub-flags; the first PR is **schema + types + state machine only** with zero behavioural change.

The `walletLedgerEntries` crown jewel is **never written to directly** by this engine — outflows that touch the wallet (refund-to-wallet, wallet-credit payouts) call existing wallet APIs. `superAppPayouts` is **not replaced**; it becomes one of several adapter inputs feeding the unified engine.

## 2. Goals / Non-goals

**Goals**

- Make every PetWash outflow flow through **one server-side primitive** with the same fraud, audit, and approval guarantees PR #467 gave money-IN.
- Make finance review the **choke point** for every above-threshold outflow, with dual-control enforced by state machine (not by hope).
- Snapshot **beneficiary, amount, tax classification, and bank account** at approval time and lock them — drift becomes a manual-review alert, not a silent overwrite.
- Make refunds **universal across all surfaces** (shop, bookings, gift cards, wallet top-ups, franchise fees, kiosk) with one cooling-off lookup table and one reverse-flow rule.
- Reuse existing primitives: `walletLedgerEntries` (crown jewel), `walletIdempotencyKeys`, `walletJtiRegistry`, `walletFraudLog`, `walletReconciliationRuns`, `superAppPayouts`, `withholdingRemittanceLedger`, `FinancialDocumentService` (refund_receipt path), `ProviderPayoutService`, `SumitClient`/`SumitDispatcher`, `accountsPayable` + supplier-invoice SDD pipeline. **No new primitives where an existing one applies.**
- Hash-chain `outflow_events` for tamper-evidence (mirroring `walletLedgerEntries.previousHash` / `entryHash` and the `taxAuditLogs.auditHash` / `previousAuditHash` pattern, `shared/schema-finance.ts:189-190`).
- Per-category adoption order chosen to **minimise blast radius** and address the most-urgent-pain category first:
  1. **Refunds** (most scattered surface, smallest individual amount, most urgent customer-facing).
  2. **Provider payouts** (highest volume, biggest manual workaround pain).
  3. **Supplier invoices** (extends existing screening SDD's payment leg).
  4. **VAT / tax remittance** (monthly cadence — can wait for 1-3 to stabilise).
  5. **Salaries / 1099-equivalent staff payments** (last; depends on HR-domain payroll calculation SDD).
- Insurance premium outflows ride alongside supplier invoices in cadence (they ARE invoices from insurers); flag `ff.outflow.insurance_premiums.enabled` is granular to allow finance to gate them separately.
- Israeli legal compliance: tax authority form integrity, AML reporting thresholds, chargeback windows, cooling-off rules (חוק הגנת הצרכן — מכר מרחוק, 14-day default with surface variations).
- Mobile-first + RTL Hebrew for admin queues and dual-approval interfaces (operator runs finance approval from a phone).

**Non-goals**

- **No KYC / identity routing / multi-currency** — covered by `docs/design/2026-05-25-smart-identity-routing.md`. v1 is **ILS-only** (multi-currency is open question §22.3).
- **No payroll calculation logic.** This SDD handles the **disbursement leg** (bank transfer to a verified employee/contractor account). The actual gross-to-net, BL/income-tax/social-security calculation is a separate HR-domain SDD that must be written first. This SDD assumes a `payroll_run` row arrives with finalised net amounts per staff member.
- **No supplier sourcing / marketplace selection logic** — this SDD only covers **paying vendors PetWash has already selected**. Vendor evaluation and sourcing is a separate concern.
- **No pet insurance product (Tentacle 14)** — only the outflow leg for **PetWash's own** insurance premiums (provider liability, employer's liability). Pet insurance as a product is a future SDD.
- **No actual SUMIT / UPay / Nayax / bank-API integration code** — the integrations are abstractions with explicit plug-points. Wire-level code lands in implementation PRs after this SDD, each behind its own sub-flag.
- **No Masav payment rail.** Per regression tests at `server/tests/financeDash.regression.test.ts:88` — Masav is intentionally absent and forbidden. The disbursement leg is documented as **server-side abstracted** so that when finance / legal sign off on a rail (Masav, SWIFT IBAN, manual cheque, SUMIT-issued payment), the engine plugs into it without re-architecting.
- **No change to `walletLedgerEntries` schema** (crown jewel per `.claude/skills/petwash-platform/SKILL.md:194-200`). No change to `superAppPayouts` columns either (additive `outflow_id` only). No change to `withholdingRemittanceLedger` either.
- **No automatic VAT/tax form submission to הרשות המסים without an operator click.** v1 default: system stages the form file; operator clicks "submit" in the admin queue (open question §22.6 — auto-submit on schedule is deferred).
- **No retroactive backfill** of historic payouts/refunds/supplier-payments into the new `outflows` table. Only new outflows write to the unified engine. Backfill is a follow-up decision (see §22.10).
- **No operator's broader vision items** (fun, attractive, perks, free activity, global pet lifestyle hub) — engagement SDDs, not this one.
- **No "make us better" features.** The pairing in the operator's quote is preserved verbatim but only "save us, secure us" is acted on here.

## 3. Repository context (what exists today, cited)

### 3.1 Money-OUT primitives this SDD reuses (do not reinvent)

| Component | File:line | Reused as |
|---|---|---|
| `walletLedgerEntries` (append-only, hash-chained, bucket-discriminated; `provider_payout` bucket exists) | `shared/schema.ts:11675-11719` (bucket list at `:11688-11690`) | Single ledger for every outflow that touches the wallet (refund-to-wallet, wallet-credit payouts). Engine never writes here directly — calls existing wallet APIs. |
| `walletIdempotencyKeys` | `shared/schema.ts:11760-11772` | Idempotency on every outflow write endpoint. |
| `walletJtiRegistry` | `shared/schema.ts:11777-11792` | Replay-protection for any signed approval token or bank-account-binding token. |
| `walletFraudLog` (already includes `outcome: allowed/flagged/blocked` and `riskScore 0-100`) | `shared/schema.ts:11795-11818` | Anomaly + insider-theft + velocity-cap + related-party + bank-account-swap events log here. |
| `walletReconciliationRuns` | `shared/schema.ts:11735-11754` | Daily reconciliation extended to verify `outflows.executed` rows match counter-rows in `walletLedgerEntries` (where applicable) and bank statements (where ingestible). |
| `superAppPayouts` (existing payout primitive — 72hr escrow + AI verification + Israeli bank IBAN) | `shared/schema.ts:8467-8505` | Provider Payout adapter wraps this table. Adds an `outflow_id` pointer column; existing columns and semantics unchanged. |
| `ProviderPayoutService` (escrow release, AI verification via `AIPayoutVerificationService`) | `server/services/ProviderPayoutService.ts:24-611` | Provider Payout adapter calls this for the AI-verification step. The dual-control gate is **added before** this service runs for above-threshold amounts. |
| `payoutLedger.ts` (`createEarningRecord` — calculates platform fee, VAT back-calc 18/118, 72-hour escrow date) | `server/services/payoutLedger.ts:53-100+` | Read-only data source for provider commission amounts. The unified `OutflowRequest` for a provider payout **reads** from here; never overwrites. |
| `contractorBankDetails` (Israeli bank IBAN, branch, account, `isVerified`) | `shared/schema.ts:9432-9448` | Beneficiary bank account source-of-truth for provider payouts. Engine treats `isVerified=true` as a hard gate (re-verification flow described §8.4). |
| `withholdingRemittanceLedger` (per-booking withholding, quarterly Form 856 aggregation) | `shared/schema.ts:15200-15234` | Tax-remittance sub-system reads from here; aggregates `period='YYYY-QN'` rows into a Form 856 outflow. |
| `accountsPayable` (AP header, supplierId-linked, unique invoiceNumber, paymentStatus enum, approvedBy/approvedAt) | `shared/schema-finance.ts:20-46` | Supplier-invoice payment leg consumes this table. `paymentStatus='scheduled'` is the trigger for `OutflowRequest` creation. |
| `taxReturns` + `taxPayments` + `taxAuditLogs` (existing tax-domain tables with `auditHash` chain) | `shared/schema-finance.ts:123-197` | VAT/tax remittance sub-system writes here. Auto-prepares `taxReturns` row, stages it, operator approves → creates `OutflowRequest` linked to `taxPayments` row. |
| `generalLedger` (with `transactionType` constrained to TRANSACTION_TYPES, includes `provider_payout / refund / chargeback / adjustment`) | `shared/schema-finance.ts:78-119` (mandatory `transactionType` per Section 1) | Engine writes GL entries for every executed outflow (existing pattern, not new). |
| `supplierContracts` + `supplierPayments` (corporate AP) | `shared/schema-corporate.ts:172-220` | Supplier-payment audit row source. |
| `FinancialDocumentService.create({ documentType: 'refund_receipt' })` | `server/services/FinancialDocumentService.ts:55,63,75-140` | Refund engine calls this to issue the SUMIT refund document; mirrors the money-IN receipt path. |
| `SumitClient` + `SumitDispatcher` | `server/services/SumitClient.ts`, `server/services/SumitDispatcher.ts` | SUMIT remains legal source-of-record for outflow documents (refund_receipt, supplier-payment confirmation, salary slip metadata where applicable). |
| `NayaxOnlinePaymentService` | `server/services/NayaxOnlinePaymentService.ts` | Kiosk refunds reverse-flow through Nayax (per §10 reverse-flow rule). |
| `EnhancedBookingService` + `BookingLifecycleService` (existing booking refund path) | `server/services/EnhancedBookingService.ts`, `server/services/BookingLifecycleService.ts:13-566` | Existing per-surface refund path. Refund adapter sits BEFORE it; the existing service is called from the adapter, not bypassed. |
| `EgiftFinancialService` | `server/services/EgiftFinancialService.ts` | Gift-card refund / unredeemed-balance refund path. |
| `UnifiedWalletService` | `server/services/UnifiedWalletService.ts:36-248` | Wallet top-up refund path. |
| `AIPayoutVerificationService` (Gemini 2.5 Flash work-verification before payout) | `server/services/AIPayoutVerificationService.ts` | Pre-approval gate for provider payouts (existing logic, kept). |
| `auditSignature` + `recordExpenseApproval` (free-form approval audit) | `server/utils/auditSignature.ts:233,259` | Approval audit pattern — every dual-approver signature stored here. |
| `AuditLedgerService.recordEvent()` (hash-chained immutable audit) | `server/services/AuditLedgerService.ts:59` | Optional future ledger if `outflow_events` chain extends to platform-wide audit. |
| `logAuditEvent(...)` | `server/middleware/auditLog.ts:57` | Every engine mutation writes here in addition to `outflow_events`. |
| `requireAdmin` + admin route hardening | `server/middleware/rbac.ts:398`; mounted at `server/routes.ts:413-436` | All admin-facing dual-approval and finance queues inherit this stack. MFA gate added per §8.2. |
| `requireAuth` | `server/middleware/gates.ts:56` | Beneficiary-facing endpoints (provider sees own payouts). |
| `israeliExpenses` (VAT fields + approval + submittedToAccountant) | `shared/schema.ts:2804+` | Existing fraud-field template the supplier-invoice SDD already references. |
| `ReceiptOCRService` + `ReceiptFraudDetection` (SHA-256 duplicate + Gemini) | `server/services/ReceiptOCRService.ts:77`, `server/services/ReceiptFraudDetection.ts:61` | Supplier-invoice payment leg consumes the fraud-screened invoice; never re-runs OCR. |
| `purchase_events` + `purchases` (money-IN audit + state — PR #467 §7.5, §12.1) | `migrations/0040_purchase_lifecycle_unified.sql` (per PR #467 §12.5) | Refund engine reads from `purchases` to determine the reverse-flow acquirer and original transaction snapshot. **Read-only**. |
| `payment_provider_routes` (PR #467 §12.3 — finance-confirmed rate table) | per PR #467 §6.4-6.7 | Refund acquirer determination consults the rate table to confirm which acquirer the original purchase used (reverse-flow rule §10.3). |

### 3.2 Per-category outflow paths today (one-line each, with citations)

- **Provider payouts** → `payoutLedger.createEarningRecord` (`payoutLedger.ts:53`) writes a `contractorEarnings` row + 72-hour escrow timestamp → `ProviderPayoutService.findExpiredEscrows` + `releaseEscrowAndPayout` (`ProviderPayoutService.ts:29,58`) → `AIPayoutVerificationService.verifyWorkForPayout` (`ProviderPayoutService.ts:92`) → updates `superAppPayouts.status` to `completed` (manual bank transfer; Masav forbidden by test at `financeDash.regression.test.ts:88`).
- **Franchise revenue share** → no dedicated service today. Manually computed monthly per franchise contract; no audit table.
- **Refunds — bookings** → `BookingLifecycleService` transitions `... → refunded` (`BookingLifecycleService.ts:418`) → wallet counter-row via existing wallet APIs.
- **Refunds — gift cards** → `EgiftFinancialService` issues unredeemed-balance refund (`EgiftFinancialService.ts`).
- **Refunds — wallet top-ups** → `UnifiedWalletService` reversal (`UnifiedWalletService.ts:36-248`).
- **Refunds — kiosk** → `NayaxOnlinePaymentService` reverse transaction.
- **Refunds — shop physical goods** → sibling shop SDD's refund (Codex prototype + sibling SDD §15.3).
- **Refunds — franchise fees** → ad-hoc admin action; no dedicated lifecycle today.
- **Supplier invoice payments** → `accountsPayable.paymentStatus='paid'` set manually after the screening pipeline of `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` lets the invoice through; bank disbursement is manual.
- **Salaries** → no automated path; payroll calculation is out of platform scope today.
- **VAT remittance (form 102 / 126)** → `taxReturns` + `taxPayments` manually entered; `taxAuditLogs` already has hash chain (`taxAuditLogs.auditHash`, `shared/schema-finance.ts:189-190`).
- **Withholding remittance** → `withholdingRemittanceLedger` rows aggregate by `period='YYYY-QN'`; quarterly Form 856 is hand-prepared.
- **Insurance premium outflows** → no dedicated path today; treated as supplier invoices.
- **Tax payments (corporate income, advance tax)** → `taxPayments` table exists; entry is manual.

### 3.3 What does NOT exist today (the gap this SDD fills)

- **No unified `OutflowRequest` primitive** — every outflow category has its own initiation shape (or none).
- **No unified `OutflowLifecycle` vocabulary** — `superAppPayouts.status` has its own enum (`pending | in_escrow | released | processing | completed | failed`, `schema.ts:8484`); `accountsPayable.paymentStatus` has its own (`pending | scheduled | paid | overdue | cancelled`, `schema-finance.ts:30`); refunds have no dedicated enum; salaries have nothing.
- **No `outflow_events` audit table** — `superAppPayouts` has no event log; `accountsPayable` has no event log; `taxAuditLogs` covers tax-domain only; `walletLedgerEntries` is the money audit, not the lifecycle audit.
- **No dual-control state** — `accountsPayable.approvedBy` is a single column (one approver). Provider payouts have AI verification but only one human in the loop. No platform-wide dual-control choke point.
- **No `beneficiaries` master table** — bank accounts live in `contractorBankDetails` (`shared/schema.ts:9432`) and `suppliers.bankAccountDetails` (per `schema-corporate.ts` per the supplier-invoice SDD §1) but there is no platform-wide beneficiary identity that unifies them across categories.
- **No signed bank-account binding flow** — `contractorBankDetails.isVerified` is a manual boolean set by an admin. There is no passkey/MFA-signed beneficiary attestation today (Q-OUTFLOW-X / §22).
- **No velocity caps platform-wide** — per-beneficiary or per-actor approval rate has no enforcement.
- **No related-party detection** — actor-approves-self or actor-approves-related-party is not blocked today.
- **No bank-holiday + weekend queue handling** — outflows queued for Friday afternoon execute immediately (or sit until next manual processing).
- **No clawback state** — chargeback-induced reversal of an executed payout has no canonical state today.
- **No VAT/tax form auto-preparation** — `taxReturns` rows are typed manually; nothing reads `purchase_events` to populate.

### 3.4 Sibling SDDs (referenced, not restated)

- `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md` (PR #467 — merged 2026-05-26) — **money-IN backbone**. This SDD is its mirror. The symmetry table is Appendix C.
- `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` — **screening** layer for supplier invoices. This SDD extends it to the **payment** leg. The screening logic is **not restated**; the supplier invoice payment adapter (§11) consumes its output (a fraud-screened, approved `supplier_invoices` row in GREEN state).
- `docs/design/2026-05-25-commerce-promotions-pricing.md` — pricing, VAT calculation, wallet primitives.
- `docs/design/2026-05-26-shop-module-physical-goods.md` — shop catalog, inventory, checkout (one of the refund surfaces).
- `docs/design/2026-05-25-smart-identity-routing.md` — KYC, identity, multi-currency (out of scope here).

## 4. Users, roles, accessibility, localization

### 4.1 Actors

| Actor | What they do with the outflow engine |
|---|---|
| **Beneficiary — Provider** (walker, sitter, trainer, groomer, academy instructor, driver, station staff) | Sees own pending payout, holdback %, cleared payouts, next payout date, annual tax form (ה17 / 856). Cannot initiate, cannot approve, cannot change own bank account without re-verification (§8.4). |
| **Beneficiary — Franchise station** | Sees revenue-share allocation per period in franchise dashboard (Tentacle 6). Cannot initiate; cannot approve. |
| **Beneficiary — Supplier** | Sees own paid invoices in supplier portal (read-only). Cannot initiate, cannot approve. |
| **Beneficiary — Staff** | Sees own payslip metadata + bank deposit reference (read-only). Cannot initiate. |
| **Beneficiary — Customer** (refund recipient) | Sees refund status in own purchase view (PR #467 §14.1 `GET /api/commerce/purchase/:id`). Cannot initiate refund directly except for cooling-off self-service (§10.4). |
| **Beneficiary — Tax authority** (הרשות המסים) | Recipient of VAT/tax-payment outflows. Identity is a finance-confirmed reference row, not a user. |
| **Beneficiary — Insurance provider** | Recipient of insurance premium outflows. Same shape as supplier. |
| **Finance reviewer (Approver 1)** | Reviews `pending_finance_review` queue, approves or rejects. MFA gated. Cannot single-handedly approve outflows above dual-control threshold. |
| **Operator / CFO (Approver 2)** | Second approver for dual-control above-threshold outflows. MFA gated. |
| **Accountant (external — קופרברג, עזרא ושות', per supplier-invoice SDD §1)** | Read-only access to outflow audit + tax-form staging. Cannot approve, cannot execute, cannot initiate. |
| **Admin (PetWash admin, not finance)** | Initiates refunds via per-surface admin tools; cannot approve outflows. Initiation is logged with `actorType='admin'`. |
| **System** | Auto-creates `OutflowRequest` rows from triggers: 72hr escrow release → provider payout; `accountsPayable.paymentStatus='scheduled'` → supplier payment; `purchase_events.status='refunded'` → refund outflow; monthly cron → VAT form preparation; quarterly cron → withholding Form 856; recurring schedule → insurance premium. |
| **System (Bank API)** | Confirms execution via webhook (when a bank rail is implemented). Replay-safe via `outflow_events (provider_name, provider_reference)` unique index. |
| **System (SUMIT)** | Confirms refund_receipt issuance via existing `FinancialDocumentService` path. |

### 4.2 Permission matrix

| Action | Beneficiary | Admin | Finance (Approver 1) | Operator/CFO (Approver 2) | Accountant | System |
|---|---|---|---|---|---|---|
| Initiate `OutflowRequest` | **no** | yes (refunds for own surface) | yes | yes | no | yes (cron/triggers) |
| Read own outflow status | yes (own only) | yes (own surface) | yes (all) | yes (all) | yes (all, read-only) | yes |
| Read amount + bank account | yes (own only — redacted account) | partial (own surface; amount only) | yes | yes | yes | yes |
| Approve (single-approver path, sub-threshold) | no | no | yes (with MFA) | yes (with MFA) | no | yes (auto-approve under daily cap) |
| Approve (Approver 1, dual-control path) | no | no | yes (with MFA) | no | no | no |
| Approve (Approver 2, dual-control path) | no | no | no | yes (with MFA) | no | no |
| Reject / cancel pre-execute | no | yes (own surface initiations only) | yes (own approvals) | yes | no | yes (anomaly/velocity-cap holds) |
| Execute (`executing → executed` transition) | no | no | no | no | no | yes (bank/SUMIT webhook + state-machine) |
| Bind / change beneficiary bank account | yes (own — with re-verification, §8.4) | no | yes (verification step after beneficiary submission, with MFA) | yes | no | no |
| Issue manual override (single approval above threshold) | no | no | no | yes (CFO only, MFA, audit row + reason required) | no | no |
| Read `outflow_events` audit | own only | own surface only | yes | yes | yes | yes |
| Submit VAT/tax form to ITA | no | no | no | yes (manual click; auto-submit deferred) | no | no |

### 4.3 Accessibility & localization

- All beneficiary-facing copy Hebrew-first with English fallback. Provider tax-form summary in Hebrew (form ה17 — Israeli annual income summary). Foreign provider 856 in English.
- RTL throughout for HE locale (per `.claude/skills/petwash-ui-ux/SKILL.md:22, 188-215`).
- **Mobile-first** for finance reviewer + CFO approver — operator runs approval from a phone. Dual-approval interface is mobile-first; approver-2 must NOT have to be on desktop.
- Numeric/currency: ILS-default. All amounts in **integer agorot** (cents) to match the wallet ledger.
- Screen-reader: bank account last-four-digits announced as separate digits (not as a number). Beneficiary type announced in Hebrew.
- Voiceover/screen-reader labels: approval button must announce "approve outflow of X agorot to beneficiary Y" — never just "approve."

## 5. Architecture

### 5.1 High-level flow

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Trigger source (system / admin / cron / API webhook):               │
   │    refund      → refund adapter   ← reads purchases / purchase_events│
   │    payout      → payout adapter   ← reads superAppPayouts / earnings │
   │    supplier    → supplier adapter ← reads accountsPayable + screening│
   │    salary      → salary adapter   ← reads payroll_run (HR domain)    │
   │    VAT/tax     → tax adapter      ← reads purchase_events + WHL      │
   │    insurance   → insurance adapter← reads supplier-style contracts   │
   │    franchise   → franchise adapter← reads franchise revenue formulas │
   └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  OutflowRequestBuilder (server-side)     │  ← §6
                │  resolves amount, beneficiary, tax       │
                │  classification, payment method,         │
                │  bank account binding (all from          │
                │  authoritative server state — never      │
                │  client-submitted)                       │
                └──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  FraudControlLayer.preApprove(...)       │  ← §8
                │   - velocity caps                        │
                │   - related-party detection              │
                │   - anomaly historical-deviation         │
                │   - bank-holiday queue check             │
                │   → ok  |  manual_review  |  blocked     │
                └──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  OutflowLifecycleService.create(...)     │  ← §7
                │  draft → pending_finance_review (or      │
                │  auto-approved if sub-threshold &        │
                │  daily cap not breached)                 │
                └──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  Dual-control approval                    │  ← §8.2
                │  Approver 1 (finance, MFA)                │
                │  Approver 2 (operator/CFO, MFA)           │
                │  (or single-approver if sub-threshold)    │
                └──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  approved → executing                    │
                │  PaymentRailDispatcher.execute(...)      │
                │  (bank transfer / Bit / wallet credit /  │
                │   cheque / SUMIT-issued payment)         │
                └──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  executed (terminal happy)               │
                │  GL entry written (existing pattern)     │
                │  walletLedgerEntries counter-row (if     │
                │  outflow touches wallet)                 │
                │  outflow_events row + hash chain         │
                │  SUMIT document (refund_receipt for      │
                │  refunds; payment confirmation for       │
                │  others — open Q §22)                    │
                └──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────┐
                │  Notification (reuses NotificationEngine │
                │  from PR #467 §9 — buyer/receiver split  │
                │  becomes beneficiary/finance/admin split)│
                └──────────────────────────────────────────┘
```

Every transition emits an `outflow_events` row. Every monetary movement that touches the wallet still lands in `walletLedgerEntries` (unchanged crown jewel).

### 5.2 Components (one-line each)

- **`shared/outflow-lifecycle/types.ts`** — canonical TypeScript types: `OutflowCategory`, `OutflowStatus`, `OutflowEvent`, `BeneficiaryType`, `PaymentRail`, `TaxClassification`, `OutflowRequest`, `ApprovalRecord`, `ClawbackRecord`.
- **`server/services/commerce/outflow/OutflowRequestBuilder.ts`** — pure function `build(trigger): OutflowRequest`. No I/O except reading authoritative source rows. Server-resolves every field that fraud-touchable clients must not submit.
- **`server/services/commerce/outflow/OutflowLifecycleService.ts`** — wraps every per-category adapter. Owns transitions, emits `outflow_events`, calls `logAuditEvent`, writes hash chain.
- **`server/services/commerce/outflow/OutflowStateMachine.ts`** — declarative transition table.
- **`server/services/commerce/outflow/FraudControlLayer.ts`** — `preApprove(request): { decision: 'ok'|'manual_review'|'blocked', reasons: string[], riskScore: number }`. Reads `walletFraudLog`, velocity-cap state, related-party rules.
- **`server/services/commerce/outflow/DualControlService.ts`** — manages `pending_finance_review` queue, two-approver flow, MFA enforcement (delegates to existing auth/MFA primitives).
- **`server/services/commerce/outflow/PaymentRailDispatcher.ts`** — pluggable dispatcher: bank transfer (today: stub — manual queue export until Masav forbiddance lifts), Bit, wallet credit (calls existing wallet APIs), cheque (operator manual), SUMIT-issued payment (calls SumitClient).
- **`server/services/commerce/outflow/BeneficiaryService.ts`** — beneficiary registry CRUD + signed bank-account binding (passkey/MFA attestation at onboarding; re-verification flow on change).
- **`server/services/commerce/outflow/AnomalyDetector.ts`** — per-beneficiary historical deviation analysis; logs `walletFraudLog` row on outliers.
- **Per-category adapters** — `RefundOutflowAdapter.ts`, `ProviderPayoutAdapter.ts`, `FranchiseRevenueShareAdapter.ts`, `SupplierInvoiceAdapter.ts`, `SalaryDisbursementAdapter.ts`, `VATTaxRemittanceAdapter.ts`, `InsurancePremiumAdapter.ts`.
- **Admin queues** — `/admin/finance/outflow-approval` (dual-control queue), `/admin/finance/outflow-manual-review` (anomaly/velocity/related-party holds), `/admin/finance/outflow-audit` (cross-category audit search), `/admin/finance/beneficiary-rebinding` (bank account change verification), `/admin/finance/tax-form-staging` (VAT/tax form review + click-to-submit).

### 5.3 Happy-path sequence (provider weekly payout)

```
1. Cron: Sunday 06:00 IL — PayoutSchedulerCron sweeps providers with cadence='weekly' whose next_payout_at <= now.
2. For each provider:
   ProviderPayoutAdapter.build(providerId, periodStart, periodEnd) →
     reads contractorEarnings + superAppPayouts (status='in_escrow' AND escrowReleaseDate <= now)
     subtracts holdback % (from provider config, default 0% verified, 5% first-90-days, 10% high-chargeback)
     applies tax classification (osek_patur / osek_murshe / חברה בע"מ / foreign)
     resolves verified bank account from contractorBankDetails.isVerified=true (refuse if not verified)
     returns OutflowRequest { category: 'provider_payout', amountCents, beneficiaryId, ... }
3. FraudControlLayer.preApprove(request) →
     velocity check (per-beneficiary daily/monthly cap)
     anomaly check (deviation vs trailing-90-day mean > X%)
     related-party check (approver not beneficiary)
     bank-holiday check (Friday afternoon → defer to Sunday)
     → decision = 'ok'
4. OutflowLifecycleService.create(request, preApproval) →
     status = (amount < dual_control_threshold) ? 'approved' (single auto-approver) : 'pending_finance_review'
     outflow_events row: null → draft → pending_finance_review (or → approved if auto)
5. (If pending_finance_review) Finance reviewer in mobile admin queue approves with MFA →
     outflow_events: pending_finance_review → (approver_1_signed) ... awaits approver 2
6. (If pending_finance_review) CFO approves with MFA →
     outflow_events: → approved
7. PaymentRailDispatcher.execute(outflowId) →
     rail = 'bank_transfer' (provider's chosen method at onboarding)
     calls AIPayoutVerificationService.verifyWorkForPayout (existing — ProviderPayoutService.ts:92)
     if AI verifies: status → executing, then on bank rail confirmation → executed
8. walletLedgerEntries counter-row (bucket='provider_payout', direction='debit' from platform wallet)
9. GL entry: transactionType='provider_payout', referenceType='outflow', referenceId=outflowId
10. SUMIT: optional payment-confirmation document (open Q §22.X — does SUMIT log outbound or only inbound? Per supplier-invoice SDD §10, SUMIT collects bookkeeping; outflows ARE bookkeeping → answer leans yes; finance to confirm).
11. NotificationEngine (reused from PR #467 §9): beneficiary gets payout email + SMS; finance gets confirmation summary.
12. Annual: TaxFormGenerator builds ה17 (Israeli) or 856 (foreign) from year's outflow rows; provider downloads from portal.
```

### 5.4 Happy-path sequence (refund — shop physical good within 14-day cooling-off)

```
1. Customer in own purchase view clicks "request refund — cooling off" on a shop order.
2. RefundOutflowAdapter.build(purchaseId, requestedBy='customer', reason='cooling_off') →
     reads purchases row (PR #467 §12.1)
     verifies surface='shop' AND now <= purchase.created_at + 14 days (cooling-off lookup table)
     determines reverse-flow acquirer: same as purchases.acquirer (e.g., upay_via_sumit)
     returns OutflowRequest { category: 'refund', amountCents=purchase.amount_cents, beneficiaryType='customer', sourcePurchaseId=purchase.id, ... }
3. FraudControlLayer.preApprove → ok (refund-to-original-payment-source has no related-party risk because the beneficiary is the original payer).
4. OutflowLifecycleService.create → status='approved' if amount < threshold else 'pending_finance_review'.
5. PaymentRailDispatcher.execute →
     rail = 'reverse_acquirer' (reverse the original UPAY-via-SUMIT clearing)
     SumitClient issues 'refund_receipt' document (existing path — FinancialDocumentService.ts:63)
     status → executed
6. purchases.status (money-IN side, PR #467 §7.6) transitions to 'refund_pending → refunded' via the PurchaseLifecycleService.requestRefund(...) bridge — both lifecycles update.
7. walletLedgerEntries reversal row.
8. Notification: customer gets refund SMS + email; admin queue logs the event.
```

### 5.5 Failure-path sequences (key ones)

- **AI work-verification fails (provider payout)** → `OutflowLifecycleService.create` returns `pending_finance_review` regardless of threshold; metadata.aiBlocked=true; finance must consciously override (with reason + MFA) for it to proceed. (Existing `ProviderPayoutService.ts:113-120` already returns false; this engine reads that result.)
- **Anomaly detector flags > X% deviation** → `FraudControlLayer.preApprove` returns `manual_review`; outflow lands directly in `/admin/finance/outflow-manual-review` queue, bypassing the auto-approve path.
- **Bank account marked `isVerified=false` or changed within last 30 days** → `OutflowRequestBuilder` refuses to build the outflow at all; surfaces a row in `/admin/finance/beneficiary-rebinding` for re-verification.
- **Velocity cap breached** → `manual_review`. Cap is per-beneficiary-per-day, per-beneficiary-per-month, per-actor-approval-rate (an approver who has approved > N outflows in last 24 hours is rate-limited regardless of amounts).
- **Approver and beneficiary are related party** (email-domain match OR shared bank account OR operator-maintained related-party list — see §22.4) → state machine refuses the transition `pending_finance_review → approved` with that actor; logs `walletFraudLog.reason='related_party_block'`.
- **VAT form already submitted for the period** → tax adapter refuses to create a second `outflow` for the same `(period, form_type)` pair; daily reconciliation flags any attempt as `vat_form_replay`.
- **Refund attempted outside cooling-off window** → adapter returns 422 with `code='cooling_off_expired'`; admin can still initiate a manual refund (different code path — `actorType='admin'`, `reason` required).
- **Bank-rail confirmation never arrives** → TTL job sweeps `executing` outflows older than per-rail SLA (e.g., 48 hours for bank transfer) and surfaces them in `/admin/finance/outflow-manual-review` with reason `execution_stalled`. **No automatic retry** — finance decides (the money may have moved without a webhook).
- **Chargeback on an already-executed payout** → bank/acquirer webhook triggers `requestClawback(outflowId)`; state transitions `executed → clawed_back`; if the beneficiary's wallet has positive balance, reversal row written to `walletLedgerEntries`; if not, escalates to `/admin/finance/outflow-manual-review` with reason `clawback_uncollectible`.

### 5.6 Concurrency & idempotency

- Every `OutflowRequest` carries an `idempotencyKey` — operator-supplied or auto-generated from `(category, beneficiaryId, sourceReferenceId, runId)`. Stored in `walletIdempotencyKeys` (`schema.ts:11760-11772`).
- Replay of the same idempotencyKey returns the existing outflow row (no double-creation).
- Bank/SUMIT webhooks carry signed external references that are upserted into `outflow_events.provider_reference` with a unique index per `(provider_name, provider_reference)`. Replay = no-op.
- State-machine guards prevent invalid transitions; an attempt is logged to `walletFraudLog` with reason `invalid_outflow_transition`.
- Dual-approval is atomic on `pending_finance_review → approved` via a row-locked update — two concurrent CFO clicks cannot both transition.

## 6. Universal `OutflowRequest` primitive (component A)

### 6.1 Purpose

Given a trigger (cron, admin action, system event, refund request), construct a fully-resolved outflow specification that can be approved and executed. Symmetric to PR #467 §6.2's `PurchaseIntent`.

### 6.2 Inputs and outputs

```ts
type OutflowCategory =
  | 'refund'                    // money returns to original payer (customer)
  | 'provider_payout'           // commission split to service provider
  | 'franchise_revenue_share'   // split to franchise station
  | 'supplier_invoice_payment'  // supplier invoice (extends 2026-05-22 SDD)
  | 'insurance_premium'         // insurance vendor invoice (same shape as supplier in v1)
  | 'salary_disbursement'       // staff payroll (disbursement leg only)
  | 'vat_remittance'            // monthly form 102/126 to הרשות המסים
  | 'tax_payment'               // corporate tax / withholding (Form 856 quarterly + annual)
  | 'wallet_credit_payout';     // payout method = credit to provider's PetWash wallet

type BeneficiaryType =
  | 'provider'                  // walker/sitter/trainer/groomer/academy/driver/station_staff
  | 'franchise_station'
  | 'supplier'
  | 'insurance_vendor'
  | 'staff'
  | 'tax_authority'
  | 'customer';                 // refund recipient

type PaymentRail =
  | 'bank_transfer'             // Israeli bank IBAN (v1: manual queue export; Masav forbidden — see §2 non-goals)
  | 'bit'
  | 'wallet_credit'             // credits beneficiary's PetWash wallet
  | 'cheque'                    // manual cheque (rare; insurance vendors, legal disbursements)
  | 'sumit_issued_payment'      // SUMIT-issued outbound payment (where API supports)
  | 'reverse_acquirer';         // refund-only: reverses original acquirer transaction

type TaxClassification =
  | 'osek_patur'                // עוסק פטור — no VAT issued
  | 'osek_murshe'               // עוסק מורשה — VAT applies
  | 'company_ltd'               // חברה בע"מ
  | 'foreign_provider'          // requires Form 856
  | 'staff_w2_equivalent'       // employee, payroll-domain
  | 'tax_authority_remittance'  // outflow to authority itself
  | 'customer_refund';          // refund — no VAT issuance (VAT reversal happens on receiving surface's purchase row)

interface OutflowRequest {
  category: OutflowCategory;
  amountCents: number;          // integer agorot — SERVER-RESOLVED, never client-submitted
  currency: 'ILS';              // v1: ILS only
  beneficiaryId: string;        // FK to beneficiaries (§15)
  beneficiaryType: BeneficiaryType;
  beneficiaryBankAccountId: string; // FK to beneficiary_bank_accounts — SERVER-RESOLVED
  paymentRail: PaymentRail;
  taxClassification: TaxClassification;
  sourceReferenceType:          // what triggered this outflow
    | 'purchase_id'             // refund — points to purchases.id (PR #467 §12.1)
    | 'booking_id'              // provider payout — points to bookings.id
    | 'superAppPayout_id'       // provider payout — bridges existing table
    | 'accountsPayable_id'      // supplier / insurance — bridges existing AP table
    | 'taxReturn_id'            // VAT/tax remittance — bridges existing tax table
    | 'withholdingPeriod'       // tax — period 'YYYY-QN' aggregating withholdingRemittanceLedger
    | 'payrollRun_id'           // salary — points to payroll_run (HR domain)
    | 'franchise_period';       // franchise revenue share — period 'YYYY-MM'
  sourceReferenceId: string;
  idempotencyKey: string;       // required
  initiatedBy:                  // who triggered it
    | { actorType: 'system'; trigger: string }
    | { actorType: 'admin'; actorId: string }
    | { actorType: 'customer'; actorId: string } // refund cooling-off
    | { actorType: 'cron'; jobName: string };
  metadataJson: Record<string, unknown>;
}
```

### 6.3 Hard guards (the "save us" core, restated as code-level constraints)

The client cannot submit any of the following — they are **always** server-resolved:

- `amountCents` — resolved from the source row (purchase amount for refund, commission ledger for payout, accountsPayable.totalAmount for supplier, taxReturns.netVATOwed for VAT, payroll_run.netAmount for salary).
- `beneficiaryBankAccountId` — resolved from `beneficiary_bank_accounts WHERE beneficiary_id = ? AND is_verified = true AND verified_at IS NOT NULL` (newest verified account; if none, refuse).
- `taxClassification` — resolved from beneficiary master record (`beneficiaries.tax_classification`).
- `paymentRail` — resolved from beneficiary's chosen method at onboarding (`beneficiaries.default_payment_rail`).

The client (or admin initiator) MAY supply:

- The trigger / source reference (e.g., a refund request submits `purchaseId`).
- A free-text `reason` field (recorded in `metadataJson`).
- The `idempotencyKey`.

That is all. Any other field on a client request is **ignored** by `OutflowRequestBuilder`.

### 6.4 Idempotency key construction

When the trigger is system/cron and no explicit key is supplied, the builder auto-generates:

```
idempotencyKey = sha256(`${category}:${beneficiaryId}:${sourceReferenceId}:${runId}`)
```

Where `runId` is the cron run identifier or the API request identifier. Two replays from the same cron run with the same source reference produce the same key, return the same outflow.

For customer-initiated refunds: `sha256('refund' + purchaseId + customerId)`. Two clicks of "request refund" on the same purchase produce one outflow.

### 6.5 What `OutflowRequestBuilder` does NOT do

- It does not approve. It produces a request that enters `pending_finance_review` (or `approved` if eligible for auto-approval).
- It does not write to `walletLedgerEntries`. Execution does, via existing wallet APIs.
- It does not pick the beneficiary — the trigger does.
- It does not call the bank rail. `PaymentRailDispatcher` does, after approval.

## 7. Universal `OutflowLifecycle` state machine (component B)

### 7.1 Canonical states

```
draft
  → pending_finance_review
       → approved
            → executing
                 → executed
                      (terminal happy)

Cross-cutting terminal/abnormal states:
  failed              (rail rejection, bank-rail unavailable, beneficiary account closed)
  cancelled           (pre-execution abort by approver or system)
  manual_review       (anomaly, velocity cap, related-party, AI block, execution stall)
  clawed_back         (post-execute reversal — chargeback, dispute, fraud-after-the-fact)
```

`refund_partial` exists on the money-IN side (PR #467 §7.1); on the outflow side, partial outflows are modelled as **multiple outflow rows** linked to the same `sourceReferenceId` rather than a single partial state. Each row is independently approved and executed. Total refunded across rows must not exceed the source row's amount (DB constraint via partial unique index — §15).

### 7.2 Transition table (excerpt)

```ts
const OUTFLOW_TRANSITIONS: Record<OutflowStatus, OutflowStatus[]> = {
  draft: ['pending_finance_review', 'approved' /* auto-approve sub-threshold */, 'cancelled', 'manual_review'],
  pending_finance_review: ['approved', 'cancelled', 'manual_review'],
  approved: ['executing', 'cancelled'],
  executing: ['executed', 'failed', 'manual_review'],
  executed: ['clawed_back'],          // only chargeback/dispute reaches this
  failed: [],                          // terminal
  cancelled: [],                       // terminal
  manual_review: ['pending_finance_review', 'approved', 'cancelled'],
  clawed_back: [],                     // terminal
};
```

Every transition is guarded. An attempt with an invalid `(from, to)` pair returns 409 and writes to `walletFraudLog` with `reason='invalid_outflow_transition'`.

### 7.3 Per-category fulfilment notes

- **`refund`** → `executed` means the SUMIT `refund_receipt` document was issued AND the reverse-flow rail confirmed AND the `purchases.status` (PR #467) transitioned to `refunded` or `refund_partial`. Three-way commit; if any leg fails, the outflow stays in `executing` and surfaces in manual review.
- **`provider_payout`** → `executed` means bank-rail confirmed AND `walletLedgerEntries` counter-row written AND `superAppPayouts.status` set to `completed`.
- **`franchise_revenue_share`** → `executed` means bank-rail confirmed AND franchise dashboard sees the credit (Tentacle 6 read-side).
- **`supplier_invoice_payment`** → `executed` means bank-rail confirmed AND `accountsPayable.paymentStatus` set to `paid` AND `accountsPayable.paymentDate` populated.
- **`insurance_premium`** → identical shape to supplier payment but tagged separately for reporting + flagging (a premium-rate-change anomaly is a higher-risk event than a routine supplier invoice).
- **`salary_disbursement`** → `executed` means bank-rail confirmed AND payroll_run row marked paid (HR-domain — out of scope; this engine emits the event for HR to consume).
- **`vat_remittance`** → `executed` means operator clicked submit on the staged form AND the system received an ITA reference number (`taxReturns.itaReferenceNumber`).
- **`tax_payment`** → identical shape to VAT remittance.
- **`wallet_credit_payout`** → `executed` means the wallet API call returned success and a `walletLedgerEntries` row was written. No bank rail; this is the fastest path. (Open Q §22.8 — confirm this counts as an "outflow" for SUMIT bookkeeping purposes.)

### 7.4 `outflow_events` audit row

Every transition writes a row to `outflow_events` (new table — §15). Shape mirrors PR #467's `purchase_events`:

```ts
interface OutflowEvent {
  id: string;
  outflowId: string;
  category: OutflowCategory;
  oldStatus: OutflowStatus | null;
  newStatus: OutflowStatus;
  actorType: 'system' | 'admin' | 'provider_api' | 'machine' | 'approver_1' | 'approver_2' | 'customer';
  actorId: string | null;
  providerName: string | null;       // 'sumit' | 'bank_rail' | 'nayax' | 'bit' | null
  providerReference: string | null;  // signed external ID
  approvalSignatureHash: string | null;  // SHA-256 of approver's MFA-confirmed signature (links to auditSignature pattern)
  previousEventHash: string;
  eventHash: string;                 // hash-chain on (outflowId, previousEventHash, payload)
  metadataJson: Record<string, unknown>;
  occurredAt: string;
}
```

Unique partial index on `(provider_name, provider_reference) WHERE provider_reference IS NOT NULL` guarantees webhook idempotency. Hash chain mirrors `walletLedgerEntries.previousHash` / `entryHash` (`schema.ts:11718-11719`) and `taxAuditLogs.auditHash` / `previousAuditHash` (`schema-finance.ts:189-190`).

### 7.5 Clawback handling

- Triggered by: bank/acquirer chargeback webhook, admin manual clawback action, dispute-resolution outcome.
- Lifecycle transition: `executed → clawed_back`.
- Counter-row in `walletLedgerEntries` if the outflow originally moved through the wallet (refund-to-wallet path; provider payout with `paymentRail='wallet_credit'`).
- If the outflow was a refund: the original `purchases.status` transitions from `refunded` back to `paid` (or a new state `refund_clawed_back` — open Q §22.X with PR #467 §7 author). The customer's refund is reversed.
- If the outflow was a provider payout to bank: clawback recovers funds from a downstream provider payout (offset against next payable amount) OR escalates to manual collection if no further payouts exist (`/admin/finance/outflow-manual-review` reason `clawback_uncollectible`).
- Open Q §22.12 — clawback timing window: per Israeli law + per acquirer SLA, finance defines the maximum days post-`executed` during which a clawback is automatic vs requires manual write-off.

### 7.6 `manual_review` queue

- `/admin/finance/outflow-manual-review` lists rows held by FraudControlLayer or stuck in `executing`.
- Admin actions: `release_to_pending_finance_review`, `release_to_approved` (CFO-only with MFA + reason), `cancel`, `mark_clawback_uncollectible`.
- Every release writes an `outflow_events` row with `actorType='admin'` and `metadataJson.releaseReason`.

### 7.7 What the lifecycle does NOT do

- It does not write to `walletLedgerEntries` directly. Execution calls existing wallet APIs.
- It does not call the bank rail. `PaymentRailDispatcher` does.
- It does not run velocity / anomaly checks. `FraudControlLayer` does, before lifecycle creation.
- It does not send notifications. It emits events; `NotificationEngine` (PR #467 §9, reused) plans the comms.

## 8. Fraud-control layer — the "save us" core (component C)

This is the spine of the SDD. The operator's directive — "save us, secure us" — translates into the **fraud-control choke point that scales beyond a small team**.

### 8.1 Dual control (above-threshold)

- Configurable per-beneficiary-type threshold in `outflow_approval_rules` (default: 1000 ILS = 100000 agorot).
- Below threshold: single-approver auto-approve path (Finance reviewer with MFA, or system auto-approve under a daily aggregate cap).
- Above threshold: **two distinct human approvers required**, each with MFA.
- Atomic transition `pending_finance_review → approved` requires both approver records present.
- Approver 1 and Approver 2 cannot be the same user (state machine refuses).
- Approver-related-party check (§8.5) runs against both approvers independently.

### 8.2 MFA enforcement

- Approval endpoints (`POST /api/admin/finance/outflow/:id/approve-1`, `POST /api/admin/finance/outflow/:id/approve-2`) require an MFA-confirmed session token.
- Open Q §22.11 — passkey / TOTP / both? Recommendation: passkey for CFO (Approver 2) on the mobile-first interface, TOTP fallback for Finance reviewer (Approver 1). Either way, both legs MFA-gated.
- MFA confirmation signature stored in `outflow_events.approvalSignatureHash` (SHA-256 of the MFA challenge response + outflow row hash) — non-repudiable.

### 8.3 Velocity caps

Stored in `outflow_approval_rules` and evaluated by `FraudControlLayer.preApprove(...)`:

- **Per-beneficiary-per-day cap**: configurable (default: 50,000 ILS = 5,000,000 agorot for providers; 100,000 ILS for suppliers; no cap for tax-authority beneficiaries).
- **Per-beneficiary-per-month cap**: configurable (default: 500,000 ILS for providers; 1,000,000 ILS for suppliers).
- **Per-actor-approval-rate cap**: an approver who has approved > N outflows in a rolling 24-hour window is rate-limited (default N=50 for Finance, N=20 for CFO).
- **Per-actor-approval-aggregate cap**: an approver whose approved-amount in a rolling 24-hour window exceeds X ILS is rate-limited (default X=1,000,000 ILS for Finance, X=5,000,000 ILS for CFO).

Cap breach → `manual_review` (not blocked outright — finance can override on the queue with reason).

### 8.4 Bank account binding (Q-OUTFLOW-X)

Bank account changes are the highest-frequency social-engineering target. Today's `contractorBankDetails.isVerified` is a manual admin boolean — adequate at hand-curated scale, inadequate at hundreds of thousands of payouts/month.

**v1 design**:

1. **Onboarding binding**: beneficiary submits bank account during onboarding (provider, supplier, staff). Account stored in `beneficiary_bank_accounts` with `is_verified=false`. Beneficiary signs a passkey/MFA attestation that "this account belongs to me" — signature hash stored in `beneficiary_bank_accounts.signature_hash`. Finance reviewer manually verifies (bank document upload, micro-deposit confirmation, or accountant attestation — see supplier-invoice SDD §8) and sets `is_verified=true` + `verified_by` + `verified_at`.
2. **Change attempt**: beneficiary submits a new bank account → new row in `beneficiary_bank_accounts` with `is_verified=false`. Old row stays (append-only, supersession via `superseded_by_id` modelled on `businessLegalIdDocuments`, `schema.ts:15314` per supplier-invoice SDD §1).
3. **Cooldown**: outflows referencing this beneficiary continue to use the **old verified account** until the new account is verified AND a 7-day cooldown has elapsed (configurable per beneficiary type).
4. **Re-verification flow**: beneficiary signs a passkey/MFA attestation on the new account; finance reviewer performs the verification step + MFA confirmation; an admin queue at `/admin/finance/beneficiary-rebinding` surfaces the row. Email + SMS to the beneficiary's verified contact on the old account informing them of the change (anti-account-takeover).
5. **`OutflowRequestBuilder` refuses** to build any outflow whose resolved bank account is `is_verified=false` OR was `verified_at < now - 7 days` (if marked as `recently_changed=true`). Refusal logs `walletFraudLog reason='bank_account_unverified'`.

This is **the** anti-bank-swap mitigation. See §16 (Threat T2).

### 8.5 Insider-theft mitigation — related-party detection (Q-OUTFLOW-Y)

The simplest fraud is "Finance reviewer approves outflow to their own bank account." Or to a colluding party's. Detection methods, in priority order:

1. **Identity match**: approver's `user_id` equals beneficiary's linked user_id (the obvious case). Blocked at state-machine level.
2. **Bank account match**: approver's own beneficiary record (if they're also a staff member or provider) shares a bank account with the outflow's beneficiary. Blocked.
3. **Email-domain match**: approver's email and beneficiary's email share a domain AND the domain is not on a whitelist (e.g., `petwash.co.il` is whitelisted because all staff share it — but two random `gmail.com` matches would be flagged). Surfaces `manual_review`, not block.
4. **Operator-maintained related-party list**: finance can maintain `related_party_rules` (a sub-table of `outflow_approval_rules` with `approver_id, beneficiary_id, relation_type`) for known relationships (spouse, business partner, prior employer). Match → `manual_review`.
5. **Behavioural pattern**: an approver who has approved > Y% of all outflows to a single beneficiary in a rolling window → `manual_review`. Anchored to existing `walletFraudLog` outcome enum.

Open Q §22.4 — which methods to enable in v1. Recommendation: identity-match + bank-account-match in v1 (block); operator-maintained list in v1 (manual_review); email-domain and behavioural in v2.

### 8.6 No client-submitted amounts (restated)

`OutflowRequestBuilder` ignores any client-supplied `amountCents`, `beneficiaryBankAccountId`, `taxClassification`, `paymentRail`. All four are server-resolved from authoritative source rows. See §6.3.

A lint rule (or codegen contract) ensures the `OutflowRequestBuilder.build()` signature does not accept these fields from a request body. Tested via F1 / F2 in §20.3.

### 8.7 Anomaly detection (per-beneficiary historical deviation)

`AnomalyDetector` computes per-beneficiary trailing-90-day mean + standard deviation of outflow amount. Any new outflow exceeding `mean + 2*std_dev` triggers `manual_review`. Configurable σ threshold per category.

For VAT remittance: anomaly is a month with > 3x the trailing-12-month mean — typically a legitimate spike, but worth a manual second look.

For provider payout: anomaly is a payout > 2x the provider's trailing-90-day mean — often a back-paid period, but worth a manual second look.

Anchored to existing fraud guard patterns in `walletFraudLog` (`schema.ts:11795-11818`). Outcome enum (`allowed | flagged | blocked`) reused; `riskScore` field (0-100) reused.

### 8.8 Bank-holiday + weekend handling

Israeli business-day calendar:

- Friday afternoon onwards (cut-off configurable, default Friday 14:00 IL) → outflows defer to Sunday 06:00 IL.
- Saturday (Shabbat) → no execution.
- Israeli public holidays per ITA calendar → no execution.

`OutflowRequestBuilder` produces the row but `FraudControlLayer.preApprove` adds metadata `defer_until` if cut-off passed. `PaymentRailDispatcher.execute` refuses to dispatch before `defer_until`.

For international providers (foreign_provider tax classification): per-jurisdiction calendar, but v1 defaults to Israeli calendar with operator override.

### 8.9 Velocity-cap and anomaly logging

Every flagged outflow writes a row to `walletFraudLog` (reuses existing table; no schema change):

```
walletFraudLog {
  actorType: 'system',
  actorId: 'OutflowFraudControlLayer',
  action: 'velocity_cap_breach' | 'anomaly_detected' | 'related_party_block' | 'bank_account_unverified' | 'bank_holiday_defer',
  targetWalletId: beneficiary.wallet_id (if any),
  riskScore: computed,
  outcome: 'flagged' | 'blocked',
  reason: human-readable explanation,
  metadata: { outflowId, threshold, observed, ... }
}
```

This is **the same fraud log** money-IN uses. Cross-cutting fraud queries (e.g., "show me all flagged events for user X") return both inflow and outflow.

## 9. Provider payout sub-system (component D — highest volume)

### 9.1 Source data

- `payoutLedger.contractorEarnings` (`server/services/payoutLedger.ts:53-100+`) — earnings rows with platform fee, VAT back-calc, escrow date.
- `superAppPayouts` (`shared/schema.ts:8467-8505`) — payout records with Israeli IBAN, 72-hour escrow release, AI verification fields.
- `withholdingRemittanceLedger` (`shared/schema.ts:15200-15234`) — withholding amounts per booking, aggregated by period.
- `contractorBankDetails` (`shared/schema.ts:9432-9448`) — verified Israeli bank account.

### 9.2 Cadence

Configurable per provider in `beneficiaries.payout_cadence`:

- **Weekly** (default for verified providers) — Sunday 06:00 IL run sweeps prior week's escrow-released earnings.
- **Bi-weekly** — every other Sunday.
- **Monthly** — first Sunday of month.

Open Q §22.1 — operator confirms default. Recommendation: weekly for verified, monthly for first-90-days providers (matches their holdback tier).

### 9.3 Holdback (chargeback reserve %)

Stored in `beneficiaries.holdback_bps`:

- **Verified** (≥ 90 days, < 1% chargeback rate) → 0%.
- **First-90-days** → 5% (500 bps).
- **High-chargeback-history** (> 3% in trailing-90-day) → 10% (1000 bps).

Holdback amount accumulates in `beneficiaries.holdback_balance_cents`. Released to next payout when the provider's chargeback rate drops back into the lower tier AND a configurable cool-off period elapses (default 90 days at the lower tier).

Open Q §22.2 — operator confirms tiers + thresholds.

### 9.4 Payment method

Stored in `beneficiaries.default_payment_rail`:

- **Bank transfer** (default) — Israeli IBAN via the bank rail (v1: manual queue export; Masav forbidden per regression tests).
- **Bit** (peer-to-peer Israeli payment) — for low-amount sub-threshold payouts and quick disbursements.
- **Wallet credit** — credits provider's PetWash wallet (instant; no bank rail; `paymentRail='wallet_credit'`). Provider can then redeem from the wallet at K9000 stations or convert (depending on platform rules).

Open Q §22.8 — does wallet credit count as outflow for SUMIT bookkeeping? Recommendation: yes, symmetric to wallet redemption being a purchase in PR #467 §6.5.1.

### 9.5 Tax form generation

Annually (post fiscal year-end):

- **Israeli provider** (osek_patur / osek_murshe / company_ltd) → ה17 form summarising annual income, withholding, VAT.
- **Foreign provider** (foreign_provider) → Form 856 summarising withholding remitted to ITA.

Anchored to existing `IsraeliTaxAPIService.ts`, `TaxComplianceService.ts`, `TaxDocumentService.ts` (`server/services/` — confirmed present).

Generated form is hash-stamped (SHA-256), stored, surfaced to provider portal for download, and aggregated into the annual VAT/tax remittance flow.

### 9.6 Provider dashboard (Tentacle 3, read-side)

Provider sees:

- **Pending payout**: amount accumulating in the next-cadence-bucket.
- **Cleared payouts**: list of `executed` outflows with date, amount, bank reference (last 4).
- **Holdback balance**: amount on hold + tier explanation.
- **Next payout date**: based on cadence.
- **Annual tax form**: download link to ה17 / 856 (once available).

All read-only. No initiation, no approval. Hebrew-first with English fallback.

### 9.7 Integration with `superAppPayouts` (additive)

- `superAppPayouts` gets a new nullable column: `outflow_id varchar REFERENCES outflows(id)`.
- Existing `ProviderPayoutService.releaseEscrowAndPayout` (`ProviderPayoutService.ts:58`) is called from within the engine's `PaymentRailDispatcher.execute` step for the `provider_payout` category — preserving the AI verification gate.
- Existing `superAppPayouts.status` enum (`pending | in_escrow | released | processing | completed | failed`) continues to be written. It is **shadowed** by the new `outflows.status` lifecycle — both update in step.
- Reads continue from `superAppPayouts` during the migration window. Reads flip to `outflows` after the `ff.outflow.provider_payouts.enabled` reaches full cohort.

## 10. Refund sub-system (component E)

### 10.1 Universal across all surfaces

Refunds are the most-urgent-pain category per §2 (scattered today). The refund adapter is universal:

```ts
RefundOutflowAdapter.build({
  purchaseId: string,         // PR #467 §12.1 — purchases.id
  amountCents?: number,       // partial refund — if omitted, full refund
  reason: string,             // free-text, audit-logged
  requestedBy: { actorType: 'customer' | 'admin', actorId: string },
}): OutflowRequest
```

The adapter reads `purchases` to derive: `amountCents` (or validates `amountCents <= purchase.amount_cents`), `surface`, `acquirer`, `transactionId`, `receiptNumber`, `customerUserId` (becomes `beneficiaryId` of type `customer`).

### 10.2 Cooling-off lookup (Israeli מכר מרחוק)

Per-surface eligibility table (in code, with PR #467 §19.7 footnote that legal must approve):

| Surface | Cooling-off window | Eligibility test |
|---|---|---|
| Shop physical goods | 14 days from delivery | Goods unused / undamaged (operator self-assessed, audit-logged) |
| Service bookings (wash, walk, sitter, trainer, academy) | 14 days from booking OR before service start, whichever sooner; **NOT** after service performed | `bookings.status NOT IN ('in_progress', 'service_completed')` |
| Gift cards (issued, unredeemed) | 14 days from purchase | `petWashVouchers2025.balance == petWashVouchers2025.initialBalance` |
| Gift cards (partially redeemed) | refund unredeemed balance only | Partial refund — see §10.4 |
| Wallet top-ups | 14 days from top-up, unredeemed portion | `walletLedgerEntries` for the topup not yet debited |
| Franchise fees | per franchise agreement (typically 0 days; "as-is") | Operator override only |
| Kiosk products | not refundable (vended physical product) | Admin override only with reason |

Refusal outside the window returns 422 with `code='cooling_off_expired'`; an admin can still initiate a manual refund (different code path — `actorType='admin'`, `reason` required, MFA gated for amounts above threshold).

### 10.3 Reverse-flow rule (the PCI + reconciliation symmetry)

**Rule**: refund through the **same acquirer** the original payment used.

- If `purchases.acquirer = 'upay_via_sumit'` → refund via SUMIT (reverse-flow leg through SUMIT's refund API + `FinancialDocumentService.create({ documentType: 'refund_receipt' })`).
- If `purchases.acquirer = 'upay_direct'` → refund via UPAY direct.
- If `purchases.acquirer = 'nayax'` → refund via NayaxOnlinePaymentService reverse transaction.
- If `purchases.acquirer = 'wallet_only'` → refund directly to the customer's PetWash wallet (no external acquirer).

**Why same-acquirer**: preserves PCI scope (no card data leaves the original boundary), preserves reconciliation symmetry (`walletReconciliationRuns` can match every refund to its inflow), preserves the legal chain in SUMIT's receipt book.

Open Q §22.9 — can finance override the same-acquirer rule for edge cases (e.g., the original acquirer is unavailable)? Recommendation: yes, with CFO MFA + audit row; default = no override.

### 10.4 Partial refunds

Modelled as multiple `outflows` rows linked to the same `purchases.id`. Each row independently approved + executed.

Constraint (DB-enforced): `SUM(outflows.amount_cents WHERE source_reference_id = purchase.id AND status = 'executed') <= purchases.amount_cents`.

The `purchases.status` (PR #467 §7.1) transitions to `refund_partial` after first partial executes; to `refunded` after total equals purchase amount.

### 10.5 Customer self-service cooling-off endpoint

```
POST /api/commerce/purchase/:id/refund
Body: { reason: string, amountCents?: number }
Auth: requireAuth (customer must own the purchase)
```

Calls `RefundOutflowAdapter.build(...)` with `requestedBy.actorType='customer'`. The cooling-off lookup decides eligibility. Sub-threshold refunds auto-approve. Above-threshold (rare for cooling-off) dual-control applies.

This is the **same endpoint** PR #467 §14.1 already declared. This SDD wires the outflow engine behind it.

## 11. Supplier invoice payment sub-system (component F)

### 11.1 Anchor (do not restate)

Screening logic is in `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md`. The screening produces a `supplier_invoices` row (or `accountsPayable` row) in GREEN state with `approvedBy` + `approvedAt`. The payment leg consumes that row.

### 11.2 Trigger

- Cron sweeps `accountsPayable WHERE paymentStatus='scheduled' AND dueDate <= now`.
- For each row: `SupplierInvoiceAdapter.build(accountsPayableId)` → `OutflowRequest` of category `supplier_invoice_payment`.

### 11.3 Differences from provider payout

- No AI work-verification step (the work-verification analog is the screening pipeline, already done).
- Beneficiary type = `supplier` or `insurance_vendor`.
- Tax classification = supplier's declared type (osek_patur / osek_murshe / company_ltd / foreign_provider).
- Withholding: if supplier's `providerTaxCompliance.withholdingRate > 0`, the outflow `amount_cents` is the invoice amount minus withholding; a separate `tax_payment` outflow accumulates the withholding for quarterly remittance (Form 856). Anchor to `withholdingRemittanceLedger` aggregation.
- Reference: `sourceReferenceType='accountsPayable_id'`, `sourceReferenceId=accountsPayable.id`.

### 11.4 Linkage back

On `executed`: `accountsPayable.paymentStatus = 'paid'`, `accountsPayable.paymentDate = today`, `accountsPayable.paymentReference = outflows.id`.

## 12. Salary / staff disbursement sub-system (component G)

### 12.1 Out-of-scope reminder

The payroll calculation (gross-to-net, ביטוח לאומי, מס הכנסה, social security, withholding) is **not in this SDD**. A separate HR-domain SDD must precede the salary disbursement implementation PR.

### 12.2 Engine contract

This engine consumes a `payroll_run` row (HR-domain table; precise schema TBD by HR SDD) containing per-staff-member finalised net amounts. The salary adapter:

```ts
SalaryDisbursementAdapter.build({
  payrollRunId: string,
}): OutflowRequest[]    // one per staff member
```

For each staff member with a `net_amount_cents`:

- Beneficiary = staff member's `beneficiaries` row (type `staff`).
- Amount = `net_amount_cents`.
- Rail = staff's chosen rail (`bank_transfer` typical).
- Tax classification = `staff_w2_equivalent`.
- Source reference = `payroll_run.id` + `staff_member.id`.

### 12.3 Dual-control implication

Payroll runs are batched. Per-staff outflows under threshold auto-approve; aggregate payroll above threshold requires CFO sign-off on the payroll run before any disbursement executes (this is a payroll-domain concern that surfaces in this SDD's queue).

## 13. VAT / tax remittance sub-system (component H)

### 13.1 Monthly VAT (Form 102 + Form 126)

Cron: 1st of each month at 06:00 IL.

`VATTaxRemittanceAdapter.build({ period: 'YYYY-MM' })`:

- Aggregates `purchase_events` (PR #467 §7.5) where state transitioned to `paid` during the period.
- Reads `purchases.vat_cents` per row.
- Computes VAT collected (`SUM(purchases.vat_cents)`).
- Reads VAT paid on inbound supplier invoices (existing `israeliExpenses` + `accountsPayable.taxAmount`).
- Builds `taxReturns` row (`shared/schema-finance.ts:123`) with `returnType='vat_monthly'`, `periodStart`, `periodEnd`, `netVATOwed = vatCollected - vatPaid`.
- Stages the row at `taxReturns.status='draft'`.
- Surfaces in `/admin/finance/tax-form-staging` queue for operator review.

### 13.2 Operator click-to-submit

Operator (CFO, MFA) reviews staged form, clicks "submit":

- `taxReturns.status='submitted'`, `taxReturns.submittedToITA=true`, `taxReturns.submittedAt=now`.
- `OutflowRequest` created with category `vat_remittance`, beneficiary = tax authority (finance-confirmed reference row in `beneficiaries`), amount = `netVATOwed`.
- Dual-control: VAT remittances are always above threshold; dual-approval enforced.
- On approval + execute: `taxPayments` row written (`shared/schema-finance.ts:153`), `ita_remittance_reference` populated when ITA confirms.

Open Q §22.6 — auto-submit on schedule? v1 default: **manual operator click**. Israeli tax law requires the company to attest to the form; auto-submission removes the conscious attestation step. Defer to v2.

### 13.3 Quarterly withholding (Form 856)

Cron: 1st of each quarter at 06:00 IL.

Aggregates `withholdingRemittanceLedger WHERE period='YYYY-QN' AND status='held'`:

- For Israeli providers: builds quarterly Form 856 summary.
- Creates `OutflowRequest` of category `tax_payment` with beneficiary = tax authority.
- On `executed`: `withholdingRemittanceLedger.status='remitted'`, `remittedAt=now`, `itaRemittanceReference=...`.

### 13.4 Annual corporate income tax

Cron: end of fiscal year preparation.

Aggregates corporate revenue + expenses; produces annual return. Operator + accountant review (the accountant's existing read-only access per supplier-invoice SDD §10 covers this). Submission via existing `IsraeliTaxAuthorityAPI.ts`.

### 13.5 Hash-stamp + no-recompute rule

Every staged form is hash-stamped (SHA-256 of form content). After submission, the form is immutable — re-running the cron for the same period returns the existing form. Israeli tax law requirement (cited in §16 / Threat T5).

Anchored to `taxAuditLogs.auditHash` / `previousAuditHash` (`schema-finance.ts:189-190`) — the existing chain.

## 14. Insurance premium sub-system (component I)

### 14.1 Two-line system

Insurance vendors are functionally identical to suppliers for the disbursement leg, but:

1. **Premium-rate-change anomaly is a higher-risk event**. An insurance premium that jumps > 20% triggers `manual_review` regardless of velocity cap.
2. **Recurring schedule**: premiums are typically monthly/quarterly/annual with predictable amounts. Anomaly detector has lower σ threshold (default 1.5σ instead of 2σ).

### 14.2 Reuse

For v1: insurance premium outflows ride alongside supplier invoices in cadence + screening pipeline. The `supplier_invoices` table from the supplier-invoice SDD covers insurance vendor invoices identically.

Open Q §22.7 — does the existing supplier-invoice SDD cover insurance vendors, or do they need separate handling? Recommendation: same table, separate flag (`ff.outflow.insurance_premiums.enabled`) so finance can gate insurance approvals separately from goods/services suppliers.

## 15. Data model (new/changed tables, additive-first)

### 15.1 New table: `outflows`

```sql
CREATE TABLE outflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN
    ('refund','provider_payout','franchise_revenue_share','supplier_invoice_payment',
     'insurance_premium','salary_disbursement','vat_remittance','tax_payment','wallet_credit_payout')),
  beneficiary_id uuid NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  beneficiary_type text NOT NULL,
  beneficiary_bank_account_id uuid REFERENCES beneficiary_bank_accounts(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'ILS' CHECK (currency = 'ILS'),
  status text NOT NULL,                          -- OutflowStatus
  payment_rail text NOT NULL,
  tax_classification text NOT NULL,
  source_reference_type text NOT NULL,
  source_reference_id text NOT NULL,             -- pointer back to triggering row
  source_purchase_id uuid REFERENCES purchases(id),     -- refund-only convenience FK
  source_booking_id varchar REFERENCES bookings(id),    -- payout-only convenience FK
  source_account_payable_id integer,             -- supplier-only convenience FK
  source_tax_return_id integer,                  -- VAT/tax-only convenience FK
  initiated_by_actor_type text NOT NULL,
  initiated_by_actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  defer_until timestamptz,                       -- bank-holiday/weekend deferral
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  clawed_back_at timestamptz,
  cancelled_at timestamptz
);

CREATE UNIQUE INDEX outflows_idem_uq ON outflows (idempotency_key);
CREATE INDEX outflows_beneficiary_idx ON outflows (beneficiary_id, created_at);
CREATE INDEX outflows_category_status_idx ON outflows (category, status);
CREATE INDEX outflows_source_purchase_idx ON outflows (source_purchase_id) WHERE source_purchase_id IS NOT NULL;
CREATE INDEX outflows_source_account_payable_idx ON outflows (source_account_payable_id) WHERE source_account_payable_id IS NOT NULL;
CREATE INDEX outflows_defer_until_idx ON outflows (defer_until) WHERE defer_until IS NOT NULL;
CREATE INDEX outflows_status_idx ON outflows (status);

-- Hard refund-aggregate constraint (prevents over-refund): enforced in app + verified by nightly recon
-- (See §10.4 — DB CHECK on cumulative sum is non-trivial in Postgres; enforced via app + trigger.)
```

### 15.2 New table: `outflow_events`

Shape from PR #467's `purchase_events` (§7.5), with hash chain.

```sql
CREATE TABLE outflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outflow_id uuid NOT NULL REFERENCES outflows(id) ON DELETE RESTRICT,
  category text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN
    ('system','admin','approver_1','approver_2','provider_api','machine','customer','cron')),
  actor_id text,
  provider_name text,                            -- 'sumit'|'bank_rail'|'nayax'|'bit'|null
  provider_reference text,                       -- signed external ID (idempotency anchor)
  approval_signature_hash text,                  -- SHA-256 of MFA-confirmed signature
  previous_event_hash varchar(64) NOT NULL,      -- hash chain
  event_hash varchar(64) NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outflow_events_outflow_idx ON outflow_events (outflow_id, occurred_at);
CREATE INDEX outflow_events_category_idx ON outflow_events (category, occurred_at);
CREATE UNIQUE INDEX outflow_events_provider_ref_uq
  ON outflow_events (provider_name, provider_reference)
  WHERE provider_reference IS NOT NULL;
CREATE INDEX outflow_events_event_hash_idx ON outflow_events (event_hash);
```

Hash chain construction: `event_hash = sha256(outflow_id + previous_event_hash + new_status + actor_type + actor_id + occurred_at + canonical(metadata_json))`. First event's `previous_event_hash = 'genesis_' + sha256(outflow_id)`.

Open Q §22.10 — start fresh OR continue from supplier-invoice SDD's chain? Recommendation: **start fresh per-outflow** (each outflow has its own chain seeded from its id) — simpler and gives O(events-per-outflow) verification cost rather than O(all-events) cross-category cost. Supplier invoice's chain (if any added in implementation) is independent.

### 15.3 New table: `beneficiaries`

```sql
CREATE TABLE beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_type text NOT NULL CHECK (beneficiary_type IN
    ('provider','franchise_station','supplier','insurance_vendor','staff','tax_authority','customer')),
  external_id text,                              -- pointer to source-of-truth (providers.id, suppliers.id, users.id, etc.)
  display_name text NOT NULL,
  legal_name text,
  tax_classification text NOT NULL,
  default_payment_rail text NOT NULL,
  payout_cadence text,                           -- 'weekly' | 'biweekly' | 'monthly' (provider-only)
  holdback_bps integer NOT NULL DEFAULT 0,
  holdback_balance_cents bigint NOT NULL DEFAULT 0,
  daily_cap_cents bigint,
  monthly_cap_cents bigint,
  is_active boolean NOT NULL DEFAULT true,
  related_party_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beneficiaries_type_idx ON beneficiaries (beneficiary_type);
CREATE INDEX beneficiaries_external_idx ON beneficiaries (external_id);
CREATE INDEX beneficiaries_active_idx ON beneficiaries (is_active) WHERE is_active = true;
```

### 15.4 New table: `beneficiary_bank_accounts`

```sql
CREATE TABLE beneficiary_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  bank_name text NOT NULL,
  bank_code text,
  branch_code text,
  account_number_encrypted text NOT NULL,        -- encrypted at rest; never in logs
  account_number_last4 text NOT NULL,            -- for display only
  account_holder_name text NOT NULL,
  iban text,                                     -- Israeli IBAN where applicable
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by_user_id text,
  signature_hash text,                           -- SHA-256 of beneficiary's passkey/MFA attestation
  signature_method text,                         -- 'passkey' | 'totp' | 'docuseal'
  cooldown_until timestamptz,                    -- recently-changed cooldown
  superseded_by_id uuid REFERENCES beneficiary_bank_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bba_beneficiary_idx ON beneficiary_bank_accounts (beneficiary_id, is_active, is_verified);
-- At most one active+verified row per beneficiary at a time:
CREATE UNIQUE INDEX bba_one_active_verified
  ON beneficiary_bank_accounts (beneficiary_id)
  WHERE is_active = true AND is_verified = true AND superseded_by_id IS NULL;
```

Anchored to existing `contractorBankDetails` (`schema.ts:9432`) and supplier `bankAccountDetails` (`schema-corporate.ts` per supplier SDD §1). Those tables remain authoritative for their respective domains; `beneficiary_bank_accounts` is a **unifying view** for the outflow engine. Migration: backfill from existing tables once during the rollout phase (additive write; reads continue from existing tables until the migration flag flips).

### 15.5 New table: `outflow_approval_rules`

```sql
CREATE TABLE outflow_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,                                 -- nullable = all categories
  beneficiary_type text,                         -- nullable = all types
  rule_kind text NOT NULL CHECK (rule_kind IN
    ('dual_control_threshold','velocity_per_day','velocity_per_month',
     'approver_rate_24h','approver_aggregate_24h','anomaly_sigma','related_party')),
  threshold_cents bigint,                        -- for threshold/velocity/aggregate
  count_threshold integer,                       -- for approver rate
  sigma_multiplier decimal(4,2),                 -- for anomaly
  related_party_type text,                       -- for related_party kind
  approver_user_id text,                         -- for related_party kind (specific actor)
  beneficiary_id uuid,                           -- for related_party kind (specific beneficiary)
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by_user_id text NOT NULL,
  approved_by_user_id text,                      -- finance/CFO approval of the rule itself
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oar_active_idx ON outflow_approval_rules (is_active, category, beneficiary_type) WHERE is_active = true;
```

Rules themselves are dual-control: a rule change requires finance + CFO approval (rule's own `approved_by_user_id`). Meta-control protects the control layer.

### 15.6 Additive columns on existing tables

Per-source tables get a thin pointer back to `outflows.id`. All nullable in v1.

| Table | New column | Purpose |
|---|---|---|
| `superAppPayouts` | `outflow_id uuid REFERENCES outflows(id)` | Provider payout linkage. |
| `accountsPayable` | `outflow_id uuid REFERENCES outflows(id)` | Supplier / insurance payment linkage. |
| `taxPayments` | `outflow_id uuid REFERENCES outflows(id)` | VAT / tax remittance linkage. |
| `withholdingRemittanceLedger` | `outflow_id uuid REFERENCES outflows(id)` | Quarterly withholding remittance linkage. |
| `purchases` (PR #467 §12.1) | `refund_outflow_ids jsonb DEFAULT '[]'::jsonb` | Array of refund outflow IDs (since partial refunds produce multiple rows). |

### 15.7 Migration file naming

- `migrations/0041_outflow_engine.sql` — creates `outflows`, `outflow_events`, `beneficiaries`, `beneficiary_bank_accounts`, `outflow_approval_rules`; adds nullable `outflow_id` (or `refund_outflow_ids`) columns on listed existing tables.
- Migration is **additive only**. No drops, no renames. Reversible by reverse-DDL.

## 16. Security & fraud model

This section is expansive per operator directive. Threats are enumerated with mitigation + which §6/§7/§8/§15 feature blocks each.

### 16.1 Backend is source of truth (platform invariant, restated)

Per `.claude/skills/petwash-platform/SKILL.md:194-200` — money is sacred. **No client-side value reaches the engine.**

- Client sends: trigger reference + `idempotencyKey` + optional `reason`. Nothing else.
- Server resolves: amount, beneficiary, bank account, tax classification, payment rail. All from authoritative server-side state.
- Server signs: any approval token (passkey/MFA challenge) is constructed server-side, never built client-side.
- Client **cannot**: submit final amount, submit beneficiary bank account, submit tax classification, submit payment rail, submit approval signature.

### 16.2 Threat table (minimum 10 threats per operator directive)

| # | Threat | Mitigation | Blocking feature |
|---|---|---|---|
| **T1** | Insider-approval ring (two colluding finance + CFO approve a fraudulent outflow to a colluder's bank account) | Related-party detection (§8.5), velocity-cap on approver-rate (§8.3), anomaly detector flags atypical beneficiary (§8.7), bank-holiday queue prevents Friday-evening collusion (§8.8). For deeper protection, the audit chain (§15.2) makes every approval signature non-repudiable; periodic finance audit reviews approver-by-beneficiary distribution. | §8.3 (velocity caps), §8.5 (related-party), §8.7 (anomaly), §7.4 (signed audit), §22.4 (open Q — related-party method) |
| **T2** | Bank account swap attack (attacker compromises provider/supplier account, swaps bank IBAN, payouts go to attacker) | Signed bank-account binding (§8.4): every account change requires beneficiary passkey/MFA attestation + finance manual verification + 7-day cooldown + email/SMS to OLD verified contact informing of change. `OutflowRequestBuilder` refuses to build any outflow whose bank account was changed in last 7 days. | §8.4, §15.4 (`beneficiary_bank_accounts.cooldown_until`, `signature_hash`), `walletFraudLog` reason `bank_account_unverified` |
| **T3** | Payout amount inflation (insider manipulates commission % to inflate provider payout to a colluder) | Amount is server-resolved from `payoutLedger.contractorEarnings` + `superAppPayouts` (existing rows). Changes to those rows require admin action that is itself audited (`logAuditEvent`). Anomaly detector (§8.7) catches > 2σ deviations. Daily reconciliation compares `outflows.amount_cents` to source `superAppPayouts.netAmount`. | §6.3 (no client amount), §8.7 (anomaly), §18.3 (reconciliation) |
| **T4** | Refund-to-wallet exfiltration (attacker triggers refund to an attacker-controlled wallet, then redeems quickly through K9000) | Reverse-flow rule (§10.3) forces refund through the **same acquirer** the original payment used. If original was `card`, refund returns to that card — never to a wallet unless the original was wallet. Customer-self-service refund endpoint requires `requireAuth` + customer must own the purchase. | §10.3 (reverse-flow), §4.2 (RBAC on `POST /api/commerce/purchase/:id/refund`) |
| **T5** | VAT-form replay (attacker re-submits an already-submitted form to double-pay or to leak data) | Hash-stamp (§13.5): every form is hash-stamped at staging; re-running the cron for the same period returns the existing form. `taxReturns` row UNIQUE on `(returnType, fiscalYear, fiscalPeriod)`. Submission writes `taxAuditLogs` chain entry; replay = no-op. | §13.5, `taxReturns` UNIQUE index, `taxAuditLogs.auditHash` chain (`shared/schema-finance.ts:189-190`) |
| **T6** | Currency drift (multi-currency edge case — outflow created in ILS, executed in USD without conversion guard) | v1 is **ILS-only** (`outflows.currency CHECK (currency = 'ILS')`). Multi-currency is open question §22.3 and gated behind a separate sub-flag when implemented. | §15.1 (CHECK constraint), §22.3 (deferred) |
| **T7** | Chargeback double-clawback (chargeback webhook arrives twice, attempting two clawbacks against the same payout) | Unique partial index on `outflow_events (provider_name, provider_reference)` absorbs the replay. State machine refuses `executed → clawed_back` if already `clawed_back`. Daily reconciliation cross-checks bank chargeback list against `outflows.clawed_back_at`. | §5.6 (idempotency), §7.2 (state machine), §18.3 (reconciliation) |
| **T8** | SUMIT-API compromise (attacker obtains SUMIT credentials and forges outbound payment documents) | SUMIT secret is server-side env-only (per supplier-invoice SDD §1 — "the design must not expose, duplicate, request, or document the secret"). Outbound SUMIT documents are written ONLY by `FinancialDocumentService.create(...)` (`server/services/FinancialDocumentService.ts:55,75,83,140`) which already has idempotency + audit; an attacker with SUMIT creds cannot forge an `outflows` row, so the cross-check between `outflows.executed` and SUMIT receipts catches forgery. | Existing SUMIT secret handling (supplier SDD §1), §18.3 reconciliation, `walletFraudLog` cross-cuts |
| **T9** | Tax-form forgery (file edited post-generation, pre-submit) | Hash-stamp at generation (§13.5). Operator review surface displays the staged form's hash; submission verifies the hash matches before submitting. Mismatch → refuse + alert. | §13.5, operator review UI |
| **T10** | Provider-tax-form ID collision (two providers receive the same Form ה17 / 856 sequence number) | Annual form generation uses a deterministic sequence per provider × year. UNIQUE index on `(provider_id, year, form_type)`. | `IsraeliTaxAPIService.ts` existing logic + new unique index on annual form table |
| **T11** | Client-side amount tampering (attacker submits `amountCents=99999999` in a refund request) | `OutflowRequestBuilder` ignores client-supplied amount (§6.3). For refunds, `amountCents` may only be supplied to specify a partial refund and is validated `<= purchases.amount_cents`. | §6.3, §10.4 |
| **T12** | Replayed approval (attacker replays an approver's MFA confirmation against a different outflow) | MFA challenge is bound to `(outflowId, outflowRowHash, approverUserId, nonce)`. Replay against a different outflow id fails signature verification. `walletJtiRegistry` (`schema.ts:11777`) absorbs the JTI; replay → reject. | §8.2 (MFA), `walletJtiRegistry` |
| **T13** | Stuck-executing fund draft (outflow stuck in `executing` with bank rail unconfirmed; funds may have moved silently) | TTL job sweeps `executing` outflows older than per-rail SLA (default 48h bank, 1h Bit, instant wallet); surfaces in `manual_review` with `reason='execution_stalled'`. **No automatic retry** (the money may have moved). Finance manually reconciles against bank statement. | §5.5, `outflows.executed_at` null check + age, manual_review queue |
| **T14** | Withholding rate manipulation (insider changes provider's `withholdingRate` to dodge ITA remittance) | `providerTaxCompliance` changes are audited via existing `auditSignature` (`server/utils/auditSignature.ts:233,259`). Quarterly Form 856 reconciliation compares `withholdingRemittanceLedger` aggregate to actual outflow amounts; deviation flags ITA reporting risk. | Existing audit + §13.3 cross-check |
| **T15** | Bank-holiday execution (Friday-night dispatch goes through unobserved) | `OutflowRequestBuilder` sets `defer_until` per §8.8. `PaymentRailDispatcher.execute` refuses to dispatch before `defer_until`. | §8.8, §15.1 (`defer_until` column) |

### 16.3 Compliance

- **Israeli tax authority**: VAT 18%, Form 102/126 monthly, Form 856 quarterly, annual income tax. All hash-stamped, all immutable post-submission (§13.5, T5, T9).
- **AML reporting thresholds**: outflows above a configurable AML threshold (default 50,000 ILS to a single beneficiary in a rolling 30-day window) trigger an automatic flag in `walletFraudLog` for finance review. Manual disclosure to הרשות לאיסור הלבנת הון per operator decision. (Open Q §22.X — automate the disclosure file? v1: no.)
- **Chargeback windows**: per Israeli law + acquirer SLA, clawback timing window enforced at state-machine level (open Q §22.12).
- **Privacy**: beneficiary bank account numbers stored encrypted at rest; only last 4 digits ever rendered to a UI. Never written to logs (per supplier-invoice SDD §1 / §8 pattern).
- **Cooling-off (חוק הגנת הצרכן — מכר מרחוק)**: §10.2 lookup table.
- **Receipt-sequence integrity** (Israeli tax law): SUMIT manages the refund_receipt sequence (refund_receipt documentType, `FinancialDocumentService.ts:63`). Engine never invents a number.

## 17. APIs / interfaces

### 17.1 Customer-facing

```
POST   /api/commerce/purchase/:id/refund      # Customer-initiated cooling-off refund (PR #467 §14.1 — now wired to outflow engine)
GET    /api/me/outflows                       # Beneficiary reads own outflows (provider/staff/supplier)
GET    /api/me/outflows/:id                   # Beneficiary reads own outflow detail
GET    /api/me/tax-forms                      # Beneficiary downloads own ה17 / 856
```

### 17.2 Admin / Finance

```
GET    /api/admin/finance/outflows                          # Cross-category outflow search
GET    /api/admin/finance/outflows/:id                      # Outflow detail
GET    /api/admin/finance/outflow-approval                  # Dual-control queue (pending_finance_review)
POST   /api/admin/finance/outflows/:id/approve-1            # Approver 1 sign-off (MFA)
POST   /api/admin/finance/outflows/:id/approve-2            # Approver 2 sign-off (MFA, CFO)
POST   /api/admin/finance/outflows/:id/reject               # Either approver rejects
POST   /api/admin/finance/outflows/:id/cancel               # Pre-execute cancel
POST   /api/admin/finance/outflows/:id/override             # CFO single-approver override (MFA, audit row + reason required)
GET    /api/admin/finance/outflow-manual-review             # Anomaly / velocity / related-party / stuck queue
POST   /api/admin/finance/outflow-manual-review/:id/release # Release back to lifecycle
POST   /api/admin/finance/outflow-manual-review/:id/clawback-uncollectible  # Mark clawback uncollectible
GET    /api/admin/finance/beneficiary-rebinding             # Pending bank-account changes queue
POST   /api/admin/finance/beneficiary-rebinding/:id/verify  # Finance verifies bank change (MFA)
GET    /api/admin/finance/tax-form-staging                  # Staged VAT/tax forms
POST   /api/admin/finance/tax-form-staging/:id/submit       # Operator click-to-submit (MFA, CFO)
GET    /api/admin/finance/outflow-approval-rules            # Rule registry read
POST   /api/admin/finance/outflow-approval-rules            # Add/modify rule (rule itself dual-approved)
POST   /api/admin/finance/clawback/:outflowId               # Manual clawback (e.g., post-discovery fraud)
```

All under `requireAdmin` + MFA enforcement. Approval endpoints under `requireAdmin` with separate role checks for `finance` (approve-1) and `cfo` (approve-2).

### 17.3 Webhook endpoints

```
POST   /api/webhooks/bank-rail              # Bank-rail confirmation (when rail is wired)
POST   /api/webhooks/sumit/outflow          # SUMIT refund_receipt issuance webhook
POST   /api/webhooks/upay/refund            # UPAY refund confirmation
POST   /api/webhooks/nayax/refund           # Nayax reverse-transaction confirmation
POST   /api/webhooks/chargeback             # Acquirer chargeback notification → triggers clawback flow
```

Each verifies provider signature, looks up outflow by `provider_reference`, transitions lifecycle. Replay-safe via unique index on `outflow_events`.

### 17.4 Internal service interfaces

```ts
class OutflowRequestBuilder {
  build(trigger: OutflowTrigger): Promise<OutflowRequest>;
}

class FraudControlLayer {
  preApprove(request: OutflowRequest): Promise<{
    decision: 'ok' | 'manual_review' | 'blocked',
    reasons: string[],
    riskScore: number
  }>;
}

class OutflowLifecycleService {
  create(request: OutflowRequest, preApproval: PreApprovalResult): Promise<Outflow>;
  approve(outflowId: string, approverUserId: string, leg: 1 | 2, mfaConfirmation: MFA): Promise<OutflowEvent>;
  reject(outflowId: string, approverUserId: string, reason: string): Promise<OutflowEvent>;
  cancel(outflowId: string, actor: Actor, reason: string): Promise<OutflowEvent>;
  markExecuting(outflowId: string): Promise<OutflowEvent>;
  markExecuted(outflowId: string, providerName: string, providerReference: string): Promise<OutflowEvent>;
  requestClawback(outflowId: string, source: 'webhook' | 'admin', reason: string): Promise<OutflowEvent>;
}

class PaymentRailDispatcher {
  execute(outflow: Outflow): Promise<{ status: 'executed' | 'failed' | 'pending_webhook', reason?: string }>;
}

class BeneficiaryService {
  bindBankAccount(beneficiaryId: string, account: BankAccountInput, signature: PasskeyOrTotp): Promise<BeneficiaryBankAccount>;
  verifyBankAccount(accountId: string, verifierUserId: string, mfa: MFA): Promise<BeneficiaryBankAccount>;
  resolveActiveVerifiedAccount(beneficiaryId: string): Promise<BeneficiaryBankAccount | null>;
}
```

## 18. Money & audit (ledger movements, reconciliation)

### 18.1 Ledger movements (crown jewel untouched)

- Every `executed` outflow that touches the wallet triggers an existing wallet API call that writes to `walletLedgerEntries` (`schema.ts:11675`). **The engine never writes to the ledger directly.**
- Bucket usage:
  - Provider payout (wallet_credit path) → existing `provider_payout` bucket via existing wallet APIs (bucket already enumerated at `schema.ts:11689-11690`).
  - Refund (to wallet) → existing wallet APIs; bucket per the original purchase's bucket (mirror).
  - Salary disbursement → no wallet entry (bank rail only).
  - Supplier / insurance / VAT / tax → no wallet entry (bank rail only).
- **No new bucket required.** Existing `provider_payout` covers payouts; refunds reuse the inflow bucket of the source purchase.

### 18.2 Audit trail (three layers)

- **Lifecycle audit**: every `outflow_events` row (§15.2).
- **Money audit**: every `walletLedgerEntries` row (where applicable).
- **GL audit**: every executed outflow writes a `generalLedger` row (`schema-finance.ts:78-119`) with `transactionType` matching the existing TRANSACTION_TYPES enum (`provider_payout`, `refund`, `chargeback`, `adjustment` already present).
- **Cross-reference**: `outflows.id` is the unifying key. `walletLedgerEntries.metadata.outflow_id`, `generalLedger.referenceType='outflow', referenceId=outflows.id`.

### 18.3 Reconciliation

Daily reconciliation (extends `walletReconciliationRuns`, `schema.ts:11735`):

- **R1** — every `outflows.executed` row that touches the wallet has a matching `walletLedgerEntries` row. Mismatch → finance queue.
- **R2** — every `outflows.executed` row of category `provider_payout` has a matching `superAppPayouts.status='completed'` row.
- **R3** — every `outflows.executed` row of category `supplier_invoice_payment` has matching `accountsPayable.paymentStatus='paid'` row.
- **R4** — every `outflows.clawed_back` row has a matching webhook event or admin action; orphan clawbacks flag.
- **R5** — every `withholdingRemittanceLedger.status='remitted'` row has a matching `outflows.id` of category `tax_payment`.
- **R6** — every staged VAT form's hash matches the submitted form's hash (post-submission).
- **R7** — beneficiary bank-account-change events in last 24h cross-checked against `walletFraudLog` notifications (anti-stealth-change).
- **R8** — sum of approved-amounts-per-approver-per-24h against velocity caps; alerts on caps approaching.
- **R9** — anomaly false-positive rate per category (operational health metric).

## 19. Rollout & feature flags

### 19.1 Feature flag tree

- `ff.commerce.unified_outflow_engine.enabled` — **umbrella, OFF**. When ON, services are wired but per-category adoption gated by sub-flags.
- `ff.outflow.refunds.enabled` — first surface (smallest, most-urgent).
- `ff.outflow.provider_payouts.enabled` — second surface (highest volume, biggest manual pain).
- `ff.outflow.supplier_invoices.enabled` — third (extends 2026-05-22 SDD).
- `ff.outflow.vat_remittance.enabled` — fourth (monthly cadence, can wait).
- `ff.outflow.tax_remittance.enabled` — quarterly (Form 856) + annual.
- `ff.outflow.salary_disbursement.enabled` — last (depends on HR-domain SDD).
- `ff.outflow.insurance_premiums.enabled` — parallel with supplier invoices.
- `ff.outflow.franchise_revenue_share.enabled` — parallel with payouts (Tentacle 6).
- `ff.outflow.dual_control_required` — when ON, threshold enforcement active. **ON by default once umbrella is ON.**
- `ff.outflow.bank_account_binding` — when ON, signed binding required for all new bank-account changes.
- `ff.outflow.anomaly_detection` — when ON, AnomalyDetector runs.
- `ff.outflow.related_party_block` — when ON, identity-match + bank-account-match blocks active.
- `ff.outflow.bank_holiday_queue` — when ON, defer_until enforced.

### 19.2 Per-category adoption sequence

Operator-stated sequence (per §2 goals):

| Phase | Category | Flag ON | Notes |
|---|---|---|---|
| 0 | (none) | `ff.commerce.unified_outflow_engine.enabled` | Schema + types + state machine land; no behavioural change. Dual-control / binding / anomaly flags also flip ON. |
| 1 | **Refunds** | `ff.outflow.refunds.enabled` | Smallest surface, most-urgent. Adapter dual-writes; reads continue from per-surface tables. Cooling-off lookup hardcoded. |
| 2 | **Provider payouts** | `ff.outflow.provider_payouts.enabled` | Highest volume. Cohort by category: walker → sitter → trainer → wash live → academy → drivers → station staff. AI verification gate preserved. |
| 3 | **Franchise revenue share** | `ff.outflow.franchise_revenue_share.enabled` | Parallel with phase 2. Low volume; can ride alongside payouts. |
| 4 | **Supplier invoices** | `ff.outflow.supplier_invoices.enabled` | Extends 2026-05-22 SDD's payment leg. |
| 5 | **Insurance premiums** | `ff.outflow.insurance_premiums.enabled` | Parallel with phase 4. |
| 6 | **VAT remittance** | `ff.outflow.vat_remittance.enabled` | Monthly cadence. Can wait until 1-5 stable. |
| 7 | **Tax remittance** | `ff.outflow.tax_remittance.enabled` | Quarterly + annual. Same shape as VAT. |
| 8 | **Salaries** | `ff.outflow.salary_disbursement.enabled` | Last. Depends on HR-domain payroll-calculation SDD. |

### 19.3 Migration safety

- Schema migration additive; rollback = drop new tables + drop new columns. No data loss.
- Per-category adapters **dual-write** during their phase (per-source table + universal `outflows`). Reads still come from per-source table.
- Read flip is the last per-category step.
- All new outflows during the migration window are still dual-controlled (when the threshold flag is ON), even if reads come from legacy tables.
- Engine stays in **shadow mode** for refunds first (logs `OutflowRequest` decisions, lets the existing per-surface refund path execute). Only flips to authoritative once finance confirms the dual-control queue is stable.

## 20. Test plan

### 20.1 Unit tests

| ID | Description | Layer |
|---|---|---|
| U1 | `OutflowRequestBuilder.build()` resolves `amountCents` server-side; ignores client-supplied amount | service |
| U2 | `OutflowRequestBuilder.build()` refuses when no verified bank account exists | service |
| U3 | `OutflowRequestBuilder.build()` refuses when bank account changed within last 7 days | service |
| U4 | `OutflowStateMachine` rejects `executed → executing` | service |
| U5 | `OutflowStateMachine` rejects `pending_finance_review → approved` by same user twice (dual-control) | service |
| U6 | `FraudControlLayer` returns `manual_review` when velocity-per-day cap breached | service |
| U7 | `FraudControlLayer` returns `manual_review` when anomaly > 2σ deviation | service |
| U8 | `FraudControlLayer` returns `blocked` when approver_user_id == beneficiary external_id (identity match) | service |
| U9 | `FraudControlLayer` returns `blocked` when approver's beneficiary record shares bank account with target beneficiary | service |
| U10 | `OutflowRequestBuilder` defers `OutflowRequest.defer_until` to Sunday 06:00 when built after Friday 14:00 IL | service |
| U11 | `OutflowEvents` hash chain valid for sequence of transitions | service |
| U12 | `RefundOutflowAdapter` correctly reverse-flows: `upay_via_sumit → sumit refund_receipt` | service |
| U13 | `RefundOutflowAdapter` refuses when now > purchase.created_at + cooling-off window (shop=14d) | service |
| U14 | Partial refund: 2 partial outflows summing to purchase amount transition `purchases.status` to `refunded` | service |
| U15 | Partial refund: outflow attempting amount > remaining-refundable is rejected | service |
| U16 | `ProviderPayoutAdapter` applies holdback % from `beneficiaries.holdback_bps` | service |
| U17 | `ProviderPayoutAdapter` calls `AIPayoutVerificationService.verifyWorkForPayout`; on failure, outflow lands in `pending_finance_review` regardless of threshold | service |
| U18 | `VATTaxRemittanceAdapter` aggregates `purchase_events` for the period and produces a hash-stamped `taxReturns` row | service |
| U19 | Replay attempt: re-running VAT cron for the same period returns the existing form without re-creating | service |
| U20 | `outflows.idempotency_key` UNIQUE enforced at DB | DB |
| U21 | `outflow_events (provider_name, provider_reference)` UNIQUE partial index enforced | DB |
| U22 | `beneficiary_bank_accounts` partial UNIQUE on one active+verified per beneficiary enforced | DB |
| U23 | `outflows.amount_cents > 0` CHECK enforced | DB |
| U24 | `outflows.currency = 'ILS'` CHECK enforced | DB |

### 20.2 Integration tests

| ID | Description |
|---|---|
| I1 | Happy path: shop refund cooling-off → customer initiates → outflow auto-approved (sub-threshold) → SUMIT refund_receipt issued → `purchases.status='refunded'` |
| I2 | Happy path: provider payout weekly cron → AI verifies → dual-approval (above threshold) → bank-rail execute → `superAppPayouts.status='completed'` |
| I3 | Happy path: supplier invoice payment from screened+approved `accountsPayable` row → dual-approval → bank-rail execute → `accountsPayable.paymentStatus='paid'` |
| I4 | Happy path: monthly VAT staged → operator clicks submit → `taxReturns.status='submitted'`, `taxPayments` row written, outflow executed |
| I5 | Happy path: quarterly Form 856 → aggregates `withholdingRemittanceLedger period='YYYY-Q1'` → outflow executed → ledger rows marked `status='remitted'` |
| I6 | Failure: AI verification fails → outflow lands in `pending_finance_review` with `aiBlocked=true` metadata regardless of amount |
| I7 | Failure: bank rail returns "account closed" → outflow → `failed`; admin queue picks it up |
| I8 | Failure: SUMIT refund_receipt issuance fails 3x → `manual_review`; admin retry succeeds |
| I9 | Concurrency: two `approve-2` requests with different idempotency keys race → state machine row-lock ensures one approves, the other returns 409 |
| I10 | Concurrency: chargeback webhook arrives twice within 1 minute → unique index absorbs replay; clawback executes once |
| I11 | Clawback: provider payout `executed` → chargeback webhook → `clawed_back`; offset created against next payout |
| I12 | Cooling-off boundary: refund attempted at day 15 → 422 with `code='cooling_off_expired'` |
| I13 | Bank-holiday: outflow created Friday 16:00 IL → `defer_until=Sunday 06:00`; dispatcher refuses execute before then |
| I14 | Bank-account change cooldown: change Monday → outflow attempted Tuesday → refused with `bank_account_unverified` |
| I15 | Velocity cap: same beneficiary receives outflow at 09:00 = 30,000 ILS, then at 10:00 = 30,000 ILS → second outflow → `manual_review` (cap=50,000) |
| I16 | Insurance premium anomaly: monthly premium normally 5,000 ILS → request for 12,000 ILS → `manual_review` regardless of velocity cap |
| I17 | Salary disbursement: payroll_run with 50 staff members → 50 outflows created, each auto-approved sub-threshold; total payroll above CFO daily cap → CFO sign-off on run before any execute |

### 20.3 Fraud / abuse tests

| ID | Description |
|---|---|
| F1 | Client submits forged `amountCents` in refund body → builder ignores, uses authoritative `purchases.amount_cents` |
| F2 | Client submits forged `beneficiaryBankAccountId` → builder ignores, resolves from `beneficiaries.default_payment_rail` + verified account |
| F3 | Approver 1 attempts to also sign as Approver 2 → state machine returns 409 |
| F4 | Replayed bank-rail webhook with same `provider_reference` → no-op |
| F5 | Replayed chargeback webhook → no-op |
| F6 | Insider (Finance reviewer) attempts to approve outflow to their own beneficiary record → blocked at state machine (T1, T2) |
| F7 | Insider attempts to approve outflow to a beneficiary whose bank account matches their own bank account → blocked (T1) |
| F8 | Bank-account swap simulation: attacker submits new bank account for a provider, attempts payout same day → builder refuses (cooldown) |
| F9 | VAT-form replay: re-run cron for an already-submitted period → existing form returned, no new outflow |
| F10 | Tax-form edit-after-staging: form hash at submit ≠ hash at stage → submit refused with alert |
| F11 | Manual override without CFO MFA → 403 |
| F12 | Customer attempts to refund another customer's purchase → 403 |
| F13 | Customer attempts to read another beneficiary's outflow → 403 |
| F14 | Mass refund attack: attacker triggers 1000 self-refund requests against own purchases → idempotency key collapses to actual purchase count; velocity cap on customer-initiator stops further attempts |
| F15 | Withholding-rate change attempt: insider changes `providerTaxCompliance.withholdingRate` → existing audit fires; daily reconciliation R5 catches the deviation |

### 20.4 Accessibility / RTL tests

| ID | Description |
|---|---|
| A1 | Approval queue renders RTL on `dir="rtl"` |
| A2 | Beneficiary outflow detail Hebrew-first |
| A3 | Bank account last-4 announced as separate digits by screen reader |
| A4 | Approve button announces full context: "approve outflow of X agorot to beneficiary Y" |
| A5 | Approval queue mobile-first (CFO approves from phone) |
| A6 | Provider tax form (ה17) renders RTL with Hebrew column headers |

### 20.5 Reconciliation tests

| ID | Description |
|---|---|
| R-T1 | Daily recon finds zero discrepancies on happy-path days |
| R-T2 | Recon flags `outflows.executed` of category `provider_payout` without matching `superAppPayouts.status='completed'` |
| R-T3 | Recon flags `withholdingRemittanceLedger.status='held'` rows older than period+30 days as overdue |
| R-T4 | Recon flags VAT form staged but not submitted within 5 business days of period close |
| R-T5 | Recon flags bank-account change within 24h without corresponding email/SMS notification log entry |

## 21. Rollback plan

Each phase has a corresponding rollback. Order matters — undo in reverse.

| Phase | Rollback step |
|---|---|
| 8 (salaries) | `ff.outflow.salary_disbursement.enabled=false`; payroll runs revert to HR-domain disbursement path |
| 7 (tax remittance) | `ff.outflow.tax_remittance.enabled=false`; quarterly Form 856 reverts to manual |
| 6 (VAT remittance) | `ff.outflow.vat_remittance.enabled=false`; `taxReturns` rows are manually populated again |
| 5 (insurance premiums) | `ff.outflow.insurance_premiums.enabled=false`; revert to supplier-invoice path treating premiums as supplier |
| 4 (supplier invoices) | `ff.outflow.supplier_invoices.enabled=false`; `accountsPayable` payment leg reverts to manual |
| 3 (franchise revenue share) | `ff.outflow.franchise_revenue_share.enabled=false`; franchise dashboards revert to manual calc |
| 2 (provider payouts) | `ff.outflow.provider_payouts.enabled=false`; `ProviderPayoutService.releaseEscrowAndPayout` continues to run unchanged (engine is shadow above it) |
| 1 (refunds) | `ff.outflow.refunds.enabled=false`; per-surface refund paths resume as today |
| 0 (schema + dual-control + binding) | If absolutely necessary, drop `outflows`, `outflow_events`, `beneficiaries`, `beneficiary_bank_accounts`, `outflow_approval_rules`; drop nullable `outflow_id` columns. **All schema is additive.** Bank-account-binding rollback retains beneficiary attestation signatures in audit logs (never deleted). |

**Data reversal**: `walletLedgerEntries` is untouched throughout. Rollback never alters money. Existing per-surface paths (`ProviderPayoutService`, `EgiftFinancialService`, `UnifiedWalletService`, `accountsPayable` manual flows) continue functioning the moment the corresponding sub-flag flips OFF.

**Emergency stop**: `ff.commerce.unified_outflow_engine.enabled=false` instantly disables all engine write paths. Per-category code paths continue independently. There is no scenario in which the engine can corrupt money — the ledger and existing tables remain the sources of truth.

## 22. Open questions (must be answered before phase 2 — provider payouts authoritative)

1. **Payout cadence default** — weekly, bi-weekly, or monthly? Recommendation: weekly for verified providers, monthly for first-90-days. Operator + finance confirm.
2. **Chargeback reserve tiers** — operator confirms: 0% verified, 5% first-90-days, 10% high-chargeback. Confirm thresholds (what triggers "high-chargeback"? Recommendation: > 3% chargeback rate in trailing-90-day window).
3. **Multi-currency v1** — ILS-only acceptable for v1? Recommendation: yes. Foreign provider payouts in ILS at platform's exchange-rate snapshot; multi-currency is v2 behind separate sub-flag.
4. **Related-party detection method** — which methods enabled in v1? Recommendation: identity-match + bank-account-match (block); operator-maintained list (manual_review); email-domain + behavioural deferred to v2.
5. **Bank holiday calendar** — Israeli business-day calendar default. For international providers (foreign_provider): per-jurisdiction or default IL? Recommendation: default IL with operator override per beneficiary.
6. **Tax-form submission** — manual operator click each month, or auto-submit on schedule? Recommendation: **manual click in v1** (legal attestation requirement). Auto-submit deferred to v2 with finance + legal sign-off.
7. **Insurance premium contract management** — does the existing supplier-invoice SDD cover insurance vendors, or do they need separate handling? Recommendation: same table, separate sub-flag for gating + lower σ anomaly threshold.
8. **Wallet-credit payouts** — when provider chooses `wallet_credit`, does it count as outflow for SUMIT bookkeeping? Recommendation: yes, symmetric to wallet redemption being a purchase (PR #467 §6.5.1). Finance confirm SUMIT document type.
9. **Refund-routing override** — can finance override the same-acquirer rule for edge cases (original acquirer unavailable)? Recommendation: yes, with CFO MFA + audit row; default = no override.
10. **Hash-chain anchor** — start fresh per-outflow OR continue from supplier-invoice SDD's existing chain? Recommendation: **start fresh per-outflow** (simpler verification, cheaper). Supplier-invoice's chain (if it has one) is independent.
11. **Operator MFA on outflow approval** — passkey / TOTP / both? Recommendation: passkey for CFO (Approver 2) on mobile-first; TOTP fallback for Finance (Approver 1). Both legs MFA-gated.
12. **Dispute-clawback timing window** — how long post-`executed` can a clawback happen? Per Israeli law + per acquirer SLA. Recommendation: 180 days bank-rail / 90 days SUMIT-issued / 540 days for cards per Visa/MC dispute windows. Finance to confirm with acquirers + legal.
13. **AML disclosure automation** — outflows above 50,000 ILS to a single beneficiary in 30 days flag in `walletFraudLog`. Should the system auto-prepare the disclosure file to הרשות לאיסור הלבנת הון? Recommendation: v1 manual; v2 auto-prepare staged file with operator click.
14. **Salary disbursement HR-domain SDD** — this engine is blocked on a precedent HR-domain SDD that defines the payroll_run schema. Operator + HR-domain owner to author that SDD before phase 8.
15. **Backfill historic outflows** — provider payouts, refunds, supplier payments executed before the engine. Recommendation: **no backfill in v1**. Reports for historical periods continue to read legacy tables. Backfill is a separate decision after engine stabilises.
16. **Annual ה17 / 856 form rendering** — Hebrew-first / English fallback / PDF format. Engine generates; provider downloads. Open: rendering library, signature provenance, archival (Drive folder per provider — anchored to supplier-invoice SDD §1's pattern).

## 23. First implementation PR

**Smallest safe slice (PR-1, schema + types + state machine only — zero behavioural change):**

- `migrations/0041_outflow_engine.sql` — creates `outflows`, `outflow_events`, `beneficiaries`, `beneficiary_bank_accounts`, `outflow_approval_rules` (no nullable FK columns on existing tables in this PR; those come in PR-2).
- `shared/outflow-lifecycle/types.ts` — `OutflowCategory`, `OutflowStatus`, `BeneficiaryType`, `PaymentRail`, `TaxClassification`, `OutflowRequest`, `OutflowEvent`, `ApprovalRecord`, `ClawbackRecord`.
- `shared/outflow-lifecycle/transitions.ts` — declarative transition table (constant export).
- `server/services/commerce/outflow/OutflowStateMachine.ts` — pure function `canTransition(from, to): boolean`.
- Unit tests for state machine (U4, U5 from §20.1) and DB constraints (U20-U24).
- Behind `ff.commerce.unified_outflow_engine.enabled` (no callers yet — flag is informational).

**Acceptance criteria for PR-1:**

- Migration runs cleanly forward + reverse against a copy of staging DB.
- TypeScript types compile in `shared/` and are importable from `server/`.
- State machine unit tests pass (correctness + invalid-transition rejection + idempotent self-transition).
- DB constraint tests pass (CHECK, UNIQUE partial indexes).
- No existing code path is touched.
- No new dependencies.
- Zero behavioural change verified by re-running existing booking/refund/payout integration tests — all pass unchanged.

**Subsequent PRs (sketch — each its own SDD review or smaller decision doc):**

- PR-2: Additive `outflow_id` (or `refund_outflow_ids`) columns on `superAppPayouts`, `accountsPayable`, `taxPayments`, `withholdingRemittanceLedger`, `purchases`. Nullable, unused.
- PR-3: `FraudControlLayer` (pure function, no I/O except reading rules + fraud log); behind `ff.outflow.anomaly_detection`, `ff.outflow.related_party_block` in shadow mode; logs decisions, returns them.
- PR-4: `OutflowLifecycleService.create()` + `BeneficiaryService` bank-account binding (read-only resolveActiveVerifiedAccount in this PR; mutation in PR-5).
- PR-5: `BeneficiaryService.bindBankAccount` + `verifyBankAccount` with passkey/MFA signature capture.
- PR-6: `RefundOutflowAdapter` (first surface) + reverse-flow rule + cooling-off lookup; gated behind `ff.outflow.refunds.enabled`; shadow-mode first (logs decisions, lets existing refund paths execute), then authoritative after finance sign-off.
- PR-7: Admin queues (`/admin/finance/outflow-approval`, `/admin/finance/outflow-manual-review`, `/admin/finance/beneficiary-rebinding`). Mobile-first + RTL.
- PR-8: `DualControlService` + MFA gates + approval endpoints.
- PR-9: `ProviderPayoutAdapter` (second surface; AI verification gate preserved); cohort rollout.
- PR-10: `FranchiseRevenueShareAdapter` + Tentacle 6 dashboard read-side.
- PR-11: `SupplierInvoiceAdapter` (extends 2026-05-22 SDD's payment leg).
- PR-12: `InsurancePremiumAdapter` (parallel with PR-11).
- PR-13: `VATTaxRemittanceAdapter` + `/admin/finance/tax-form-staging` queue.
- PR-14: Withholding Form 856 quarterly cron.
- PR-15: `PaymentRailDispatcher` plug-points (bank rail abstraction; v1 manual queue export since Masav forbidden).
- PR-16: `SalaryDisbursementAdapter` (last; depends on HR-domain payroll-calculation SDD precedent).
- PR-17: Clawback webhook + clawback admin action; `outflow_events` hash-chain verification job.
- PR-18: Reconciliation extensions (R1-R9 from §18.3).
- PR-19: `ff.outflow.refunds.enabled` flipped from shadow to authoritative.
- PR-20: subsequent category flag flips.

## 24. Appendix A — original operator request (verbatim)

> Operator directive (2026-05-27): "Save us, secure us and make us better, top global pet lifestyle hub, platforms, shop, free activity, fun, attractive, perks, most advanced globally if total offering of services and tech. Launch 🚀 both."

Preserved verbatim per skill rule §3 / §5.

Author intent (paraphrase for clarity, not replacement of the above): the operator's quote pairs two halves — "save us, secure us" AND "make us better, fun, attractive, perks." This SDD acts on the "save us, secure us" half: the universal outgoings / accounts payable engine that closes the single biggest financial liability surface on the platform before volume scales to Rover-level. The "make us better / fun / attractive / perks" half belongs to engagement SDDs (Tentacles 8, 11, 13) and is explicitly out of scope here. The pairing in the operator's breath is preserved verbatim because the agent must not paraphrase away the compound intent — but only the "save us, secure us" half is acted on in this document. "Launch 🚀 both" refers to launching the money-IN and money-OUT halves together: PR #467 (money-IN, merged 2026-05-26) and this SDD (money-OUT, today). The "both" is the symmetric pair, not the two halves of the quote.

## 25. Appendix B — fraud control reference matrix

Cross-reference of fraud controls (§8) by category. Y = applies; N = not applicable; M = monitored only (no block).

| Control | Refund | Provider payout | Franchise share | Supplier inv | Insurance | Salary | VAT | Tax | Wallet credit |
|---|---|---|---|---|---|---|---|---|---|
| Dual-control above threshold | Y (rare, large) | Y | Y | Y | Y | Y (per run) | Y | Y | Y |
| Velocity per-beneficiary-day | Y | Y | M | Y | Y | M | N | N | Y |
| Velocity per-beneficiary-month | Y | Y | Y | Y | Y | M | N | N | Y |
| Approver-rate cap | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Bank-account-binding | N (reverse-flow) | Y | Y | Y | Y | Y | N (auth ref) | N (auth ref) | N (wallet) |
| Related-party block (identity match) | N | Y | Y | Y | Y | Y | N | N | Y |
| Related-party block (bank match) | N | Y | Y | Y | Y | Y | N | N | M |
| Anomaly (σ deviation) | M | Y | Y | Y | Y (tighter σ) | M (per run) | Y | Y | M |
| Bank-holiday defer | N (instant rev) | Y | Y | Y | Y | Y | Y | Y | N |
| AI verification gate | N | Y (existing) | N | N | N | N | N | N | N |
| Same-acquirer reverse-flow | Y | N | N | N | N | N | N | N | N |
| Cooling-off lookup | Y | N | N | N | N | N | N | N | N |
| Hash-stamp form | N | N | N | N | N | N | Y | Y | N |
| Clawback support | Y | Y | Y | M (rare) | M | M | N | N | Y |

## 26. Appendix C — symmetry table vs the money-IN SDD (PR #467)

Side-by-side mirror of primitives.

| Concept | Money-IN (PR #467) | Money-OUT (this SDD) |
|---|---|---|
| Primary primitive | `PurchaseIntent` (§6.2) | `OutflowRequest` (§6.2) |
| Lifecycle service | `PurchaseLifecycleService` (§7) | `OutflowLifecycleService` (§7) |
| State machine | `PurchaseStateMachine` (§7.3) | `OutflowStateMachine` (§7.2) |
| Audit table | `purchase_events` (§7.5) | `outflow_events` (§15.2) |
| Main table | `purchases` (§12.1) | `outflows` (§15.1) |
| Acquirer/rail decision | `PaymentProviderRouter` (§6) | `PaymentRailDispatcher` (§5.2) |
| Receipt subsystem | `ReceiptInvoiceService` (§8) | `FinancialDocumentService.create({ documentType: 'refund_receipt' })` for refunds; existing payment-confirmation paths for others |
| Notification engine | `NotificationEngine` (§9) | Reuses PR #467 §9 with beneficiary/finance/admin redaction split |
| Fee snapshot | `FeeSnapshot` (§6.4, §6.7) | `outflow_approval_rules` snapshot at approval time (analog) |
| Receipt sequence | SUMIT receipt book | SUMIT refund_receipt book (same sequence, separate documentType) |
| Idempotency | `walletIdempotencyKeys` | `walletIdempotencyKeys` (same table, different `endpoint`) |
| Webhook idempotency | unique index on `purchase_events (provider_name, provider_reference)` | unique index on `outflow_events (provider_name, provider_reference)` |
| Hash chain | (none in PR #467 §7.5 — open Q) | Hash chain on `outflow_events` (§15.2) — additive |
| Crown jewel | `walletLedgerEntries` (untouched) | `walletLedgerEntries` (untouched) |
| Choke point | Sumit receipt issuance (legal source-of-record) | `pending_finance_review` dual-control approval |
| First implementation PR | schema + types only | schema + types + state machine only |
| Feature flag tree | `ff.commerce.unified_purchase_lifecycle.enabled` + sub-flags | `ff.commerce.unified_outflow_engine.enabled` + sub-flags |

The two SDDs together form the complete commerce backbone: money-IN with one router + one lifecycle + one audit; money-OUT with one builder + one lifecycle + one audit + dual-control. Reconciliation can now query both sides of every shekel that touches PetWash, end-to-end, in one audit chain.

---

End of document.
