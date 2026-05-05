# Database Map — PR-W20 (Mega Phase A.3)

**Status:** READ-ONLY map + risk audit. No code, no schema changes.
**Scope:** every `pgTable("…")` definition across `shared/` (640 tables), classified by domain, money-touching, audit, orphan, and duplicate-name.
**Date:** 2026-05-05

---

## 0. Surface size

| Metric | Count |
|---|---|
| Total `pgTable` definitions | **640** |
| Tables referenced from `server/` (active) | **487** |
| Tables defined but **never referenced** from `server/` (orphan suspects) | **153** |
| **Duplicate table NAMES** (same SQL identifier, different TS exports) | **19** |
| Schema files | **20+** (top: `schema.ts` 439, `schema-enterprise.ts` 43, `schema-corporate.ts` 21, `super-app-schema-v2.ts` 16, `schema-finance.ts` 16, `super-app-schema.ts` 15, `schema-unified-platform.ts` 10) |

---

## 1. Action items extracted

### 🔴 P0 — DUPLICATE TABLE NAMES (SQL identifier collisions)

19 SQL-level table names are defined by **multiple** `pgTable()` calls in different schema files. Drizzle generates SQL using the table name string — only ONE physical table exists per name in Postgres. The other definitions are dead, but TypeScript will happily import any of them, giving misleading type shape and causing latent runtime bugs.

| SQL table name | TS exports |
|---|---|
| `bookings` | **3** |
| `payments` | **3** (in `schema.ts`, `super-app-schema.ts`, `super-app-schema-v2.ts`) |
| `availability_slots` | **3** |
| `booking_items` | **3** |
| `locations` | **3** |
| `memberships` | **3** |
| `pets` | **3** |
| `platforms` | **3** |
| `providers` | **3** |
| `stations` | **3** |
| `vehicles` | **3** |
| `account_deletion_requests` | **2** |
| `booking_pets` | **2** |
| `departments` | **2** |
| `franchisees` | **2** |
| `messages` | **2** |
| `notifications` | **2** |
| `payouts` | **2** |
| `reviews` | **2** |

**Risk:** different services may import a different `bookings` symbol, see different columns, write the wrong shape, or run a query that resolves at SQL level to the wrong table semantics. Most-likely-real impact: cross-domain dashboard queries that JOIN `bookings` to `payments` — depends on which import was selected.

**Action: PR-W48 (NEW)** — schema collision audit. For each duplicate name, decide which definition is canonical and re-export the others as the canonical type (or delete entirely if dead). NO `DROP TABLE` — table itself is fine; we collapse the TypeScript type duplication.

### 🔴 P0 — SECOND wallet ledger system (architectural drift)

`shared/schema-unified-platform.ts:16-49` defines a SEPARATE wallet ledger:

```
walletTransactions  (wallet_transactions)
walletBalances      (wallet_balances)
```

The MODERN ledger is in `shared/schema.ts:11450+`:

```
walletAccounts          (wallet_accounts)
creditTransactions      (credit_transactions)
walletLedgerEntries     (wallet_ledger_entries)   ← hash-chained
walletReconciliationRuns
walletIdempotencyKeys
walletJtiRegistry
walletFraudLog
walletHolds
```

**Who uses the legacy ledger:**
- `server/repositories/WalletRepository.ts` (read + write — but no external caller invokes the write methods)
- `server/services/CDPService.ts` (read-only analytics: `getTotalSpending`, `getTransactionCount`)
- `server/repositories/AnalyticsRepository.ts`
- `server/services/UnifiedPricingService.ts`
- `server/routes/prestige-pass.ts`

**Risk verdict:** the legacy ledger is currently READ-ONLY in production code paths. The write methods inside `WalletRepository.ts` (lines 70, 175) appear to have **no live callers** — they're dead. But they exist, so any future PR that imports `walletRepository.create*` will silently start a third dual-ledger.

**Action:** in PR-W23 (Dead Code Scanner) verify the WalletRepository write paths are dead. If yes, delete the write methods. If no, this is the same severity as the `UnifiedWalletService.deductFunds` finding (PR-W19) and rolls into PR-W47.

### 🔴 P0 — Legacy wallet COLUMNS still in schema

(Already covered in PR-W14 — restated here for completeness)

| Column | File:Line | Active writers | Notes |
|---|---|---|---|
| `users.washBalance` | `schema.ts:88` | 0 (since PR-W10) | Legacy column; new value always 0; UI reads still surface. |
| `users.giftCardBalance` | `schema.ts:89` | 0 | Same. |
| `customers.washBalance` | `schema.ts:364` | 0 (since PR-W10) | Same. |
| `customers.giftCardBalance` | `schema.ts:365` | 0 (since PR #123) | Same. |

**Action:** orphan-balance migration → drop columns. Tracked as PR-W16 (dry-run plan exists). NOT in scope of this PR.

### 🟠 MEDIUM — 153 orphan-suspect tables

Tables defined in `shared/*.ts` but never referenced from any file under `server/`. Sample (40 of 153):

```
boardMembers              boardMeetings           jvRevenueShares
intercompanyAgreements    taxTreaties             transferPricingDocumentation
jobDescriptions           organizationalChart     authorityLevels
delegationOfAuthority     usStateNexus            usFederalTaxFilings
usStateTaxFilings         usFederalTax            usStateTax
usPayrollTax              canadianTax             ukTax
australianTax             payrollProviders        payrollEmployeeMappings
payrollSyncLogs           adpIntegration          gustoIntegration
deelIntegration           payrollPayPeriods       payrollPaychecks
payrollTimesheets         compensationStructure   benefitsPackages
employeeBenefitsEnrollment employeeTerminations   companyProfile
organizationalRoles       contractorLifecycleRecords
paymentAccounts           ledgerTransactions      invoiceHeaders
invoiceItems              eVoucherEvents
```

These look like **future-feature scaffolding** (US/Canada/UK/AU tax, ADP/Gusto/Deel payroll, board governance, intercompany agreements). Likely defined ahead of feature work and never wired up.

**Risk:** schema migrations (drizzle-kit push) will create these tables in production even though nothing reads/writes them. Inflates schema, slows backups, confuses operators.

**Action:** PR-W23 (Dead Code Scanner) will mark each as `SAFE-DELETE` / `NEEDS-RUNTIME-VERIFY` / `UNKNOWN`. Per CEO rule: do NOT auto-delete. Operator will choose.

### 🟢 Money / wallet table inventory (modern stack — clean)

| Table | Purpose | Cited by |
|---|---|---|
| `wallet_accounts` | aggregated wallet balances per user | `WalletService`, `K9000RedemptionService`, drift detector |
| `credit_transactions` | append-only ledger of every credit/debit | same |
| `wallet_ledger_entries` | hash-chained legal log (PR-W2) | `WalletLedger` |
| `wallet_idempotency_keys` | replay protection per endpoint | PR-W4, PR-W7 |
| `wallet_jti_registry` | JWT claim replay-protection for wallet links | wallet-link tokens |
| `wallet_fraud_log` | suspected-fraud signal | fraud detector |
| `wallet_holds` | escrow holds (booking) | marketplace booking |
| `wallet_reconciliation_runs` | drift detector run history | PR-W2 nightly |
| `escrow_holdings` | per-booking escrow records | escrow service |
| `audit_events` | hash-chained admin/operator log | `logAuditEvent` |
| `payment_intents` | upstream payment intent records | payment gateway |
| `nayax_transactions` | Nayax-side tx records | `nayaxFirestoreService` |
| `nayax_webhook_events` | inbound webhook log | webhook handler |
| `nayax_qr_redemptions` | K9000 QR redemption ledger | K9000 redeem path |
| `nayax_telemetry` | terminal telemetry | maintenance service |
| `tranzila_transactions` | Tranzila-side tx | `TranzilaService` |
| `tranzila_chargebacks` | chargeback events | `TranzilaChargebackService` |
| `tranzila_payment_requests` | payment intents (Tranzila) | `TranzilaPaymentRequestService` |
| `tranzila_settlement_batches` | daily settlement | settlement reconciliation |
| `e_vouchers` | e-gift voucher records | `gift-cards.ts`, `nayaxService.ts` |
| `voucher_redemptions` | voucher spend events | redemption services |
| `coupons` | coupon definitions | `CouponService` |
| `coupon_redemptions` | coupon use events | same |
| `loyalty_ledger` | points ledger | loyalty engine |
| `tax_invoices` | issued tax invoices | invoice generators |
| `digital_receipts` | electronic receipts | `IsraeliDigitalReceiptService` |
| `pw_payments` | unified payment records | `bookingLedgerWriter`, `DailyReconciliationJob` |
| `pw_provider_payouts` | provider payout records | payout services |
| `pw_tax_documents` | tax docs index | accounting routes |
| `pw_reconciliation_reports` | daily recon snapshots | `DailyReconciliationJob` |
| `withholding_remittance_ledger` | tax withholding history | tax services |
| `refund_approvals` | refund approval workflow | finance approvals |
| `payout_release_approvals` | payout release approvals | treasury |

### 🟢 Audit table inventory

| Table | Purpose |
|---|---|
| `audit_events` | hash-chained admin/operator action log (PR-W1) |
| `audit_ledger` | (separate?) — needs verification |
| `tax_audit_logs` | tax-specific audit |
| `billing_audit_log` | billing-specific audit |
| `compliance_audit_trail` | compliance-specific audit |
| `document_access_log` | secure document access log |

**Action:** confirm that `audit_events` is the canonical hash-chained audit table and the others are domain-specific extensions, NOT alternative implementations. PR-W33 (Admin Action Forensics) will resolve.

---

## 2. Domain table inventory (high level)

| Domain | Sample tables | File |
|---|---|---|
| Wallet (modern) | `wallet_accounts`, `credit_transactions`, `wallet_ledger_entries` | `schema.ts:11450+` |
| Wallet (legacy) | `wallet_transactions`, `wallet_balances` | `schema-unified-platform.ts:16` |
| Bookings | `bookings` (3 defs), `booking_items`, `availability_slots`, `bookingPets` | `schema.ts`, `super-app-schema*.ts` |
| Payments | `payments` (3 defs), `payment_intents`, `pw_payments` | multiple |
| Payouts | `payouts` (2), `pw_provider_payouts`, `payout_schedules`, `payout_release_approvals` | `schema.ts`, `super-app-schema*.ts` |
| Vouchers | `e_vouchers`, `voucher_redemptions`, `voucher_usage_history_2025`, `voucher_usage_ledger_2025` | `schema.ts`, `petwashVoucher2025*.ts` |
| Coupons | `coupons`, `coupon_redemptions`, `coupon_eligibility_rules` | `schema-loyalty.ts`? |
| Loyalty | `loyalty_ledger`, `loyalty_rules`, `loyalty_campaigns`, `loyalty_profiles` | `schema-loyalty.ts` |
| Compliance | `tax_invoices`, `digital_receipts`, `compliance_tasks`, `compliance_audit_trail` | `schema-compliance.ts` |
| Tranzila | 4 tables (see above) | `schema-tranzila.ts` |
| Nayax | 4 tables | `schema.ts` (embedded) |
| K9000 | `k9000_led_status`, `k9000_led_command_history`, `pet_wash_stations`, `station_telemetry` | `schema-operations.ts`? |
| HR | 9 tables in `schema-hr.ts` (ALL ORPHAN per scan above) | `schema-hr.ts` |
| Payroll | `payrollProviders`, `payrollPaychecks`, … (ALL ORPHAN) | `schema-payroll.ts` |
| Logistics | `logistics_warehouses`, `logistics_inventory`, `logistics_fulfillment_orders` | `schema-logistics.ts` |
| Enterprise | 43 tables in `schema-enterprise.ts` (most ORPHAN per scan above) | `schema-enterprise.ts` |

---

## 3. Recommended next PRs

| PR | Purpose | Risk |
|---|---|---|
| **PR-W48** | Schema collision audit + collapse duplicate type exports for the 19 SQL names defined multiple times | LOW (no DDL change — only TS imports updated) |
| **PR-W23** | Dead Code Scanner — produces the `SAFE-DELETE / NEEDS-VERIFY / UNKNOWN` classification for the 153 orphan tables and the WalletRepository writes | LOW (read-only) |
| **PR-W47** | (queued from PR-W19) Fix `UnifiedWalletService.deductFunds` to write `creditTransactions` row | HIGH if active / LOW if dead |
| **PR-W16** | (queued from PR-W14) Orphan balance migration | MED — money movement, CEO sign-off |

---

## 4. Files inspected

`shared/schema*.ts`, `shared/*-schema*.ts`, `shared/petwash*.ts`, `shared/super-app-schema*.ts`, `shared/finance-flow-types.ts`, `shared/firestore-schema.ts`, `shared/globalCompliance.ts`.

End of map. All claims grep-cited. No DDL, no schema migration. No money moved.
