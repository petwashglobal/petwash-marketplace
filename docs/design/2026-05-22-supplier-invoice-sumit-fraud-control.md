# SDD: Supplier / Invoice / SUMIT / Bookkeeping / Fraud-Control System (Pet Wash Ltd)

Status: Draft (design only — no code). Date: 2026-05-22. Feature flag: `ff.supplier_invoice_control.enabled` (default OFF). Method: `.github/skills/sdd-writer-iterative/SKILL.md`.

Secret handling: SUMIT credentials are stored in Pet Wash secrets and must be accessed server-side via environment variables. The design must not expose or duplicate secrets.

## Summary

An internal financial-control layer that screens every supplier/provider invoice BEFORE it is paid and BEFORE it reaches the accountant via SUMIT. Flow: provider uploads invoice → system OCR-scans it → fraud/duplicate/legal/tax/bank/job checks → admin approval (four-eyes for high value/high risk) → push clean, approved, traceable document to SUMIT/accountant → accountant confirms bookkeeping → payment recorded. SUMIT remains the bookkeeping hub; Pet Wash adds the control layer in front of it.

Core rules (non-negotiable invariants): no supplier is trusted until verified; no invoice is trusted until scanned; no invoice is paid until matched to real work and approved; no bank account is used until verified; SUMIT/accountant receive only clean, approved, traceable documents.

Key design finding: ~80% of the primitives already exist in the repo. This is mostly an assembly + workflow job, not a green-field build. Net-new is roughly two tables, one screening route, the SUMIT connector, and thin glue.

## 1. What already exists and should be reused

- Supplier entity already exists: `suppliers` table (`shared/schema-corporate.ts:134`) with legalName, registrationNumber, taxId, supplierType, paymentTerms, bankAccountDetails (jsonb), isApproved; plus `supplierContracts` (:160), `supplierQualityScores` (:181), `supplierPayments` (:198). CRUD in `server/storage.ts:3880`. This is distinct from service `providers` (`shared/schema.ts:7896`) — do not conflate them.
- Invoice/AP header already exists: `accountsPayable` (`shared/schema-finance.ts:20`) is already supplierId-linked with invoiceNumber (unique), amounts, taxAmount, paymentStatus, approvedBy. CRUD `server/storage.ts:4833`.
- Approval-workflow template: `israeliExpenses` (`shared/schema.ts:2804`) with amountBeforeVat/vatAmount/totalAmount/vatRate, status pending/approved/rejected, approvedBy, submittedToAccountant; routes `server/routes/accounting.ts:38,323,627`.
- Fraud-field template: `staffExpenses` (`shared/schema.ts:7424`) with receiptVerificationStatus, receiptOcrData, geminiValidation, fraudScore, fraudFlags, duplicateCheckHash (indexed).
- OCR already built: `server/services/ReceiptOCRService.ts:77` (Google Vision, Israeli tax-ID + ₪ + סה"כ regex, DPA-compliant), singleton `receiptOCRService`.
- Fraud engine ~80% built: `server/services/ReceiptFraudDetection.ts:61` (`analyzeReceipt` → SHA-256 duplicate hash, duplicate check, Gemini fraud analysis, fraudScore 0-100, flags). Also `server/ai/fraudScan.ts:202` (`scanTransaction`, alerts, auto-block).
- Immutable audit: hash-chained `AuditLedgerService.recordEvent()` (`server/services/AuditLedgerService.ts:59`); plus a free-form audit with ready-made `recordExpenseSubmission`/`recordExpenseApproval` (`server/utils/auditSignature.ts:233,259`) usable with no schema change.
- Roles/RBAC: `finance`/`FINANCE_MANAGER`, `super_admin`, `OPERATIONS_MANAGER` already exist (`shared/petwashRoles.ts`, `shared/adminRoles.ts:15`); enforcement via `server/middleware/rbac.ts:204` (`checkPermission`).
- Israeli compliance: `shared/israel-compliance-config.ts` (ISRAEL_VAT_RATE 0.18, SHAAM e-invoice thresholds, COMPANY_TAX_ID); withholding via `server/services/VATCalculatorService.ts:118` and `withholdingRemittanceLedger` (`shared/schema.ts:15200`); `server/israeliComplianceMonitor.ts`.
- Four-eyes pattern: refund second-approver guard (approver ≠ requester) at `server/routes/prestige-pass.ts:6491`.
- File storage: KYC multer→Firebase Storage→signed URL pattern (`server/routes/kyc.ts:46-130,442`) is the pattern to reuse for invoice PDFs.
- Bank/reconciliation: `bankAccounts` (:3157), `bankTransactions` (:3177), `bankReconciliations` (:3250); payee bank info in `suppliers.bankAccountDetails` and `contractorBankDetails` (:9432).
- Accountant export (the model for SUMIT handoff): `sendTaxReportToAccountant` (`server/israeliTaxReport.ts:322`), monthly-package generate (`accounting.ts:627`), `israeliMonthlyFinancialPackages` (`shared/schema.ts:3056`, has accountantEmail/sentToAccountantAt/accountantConfirmedReceipt).

## 2. What needs to be built new

- A per-invoice screening pipeline. Add a new `supplier_invoices` table (or extend `accountsPayable`) carrying OCR fields, fraudScore/fraudFlags/duplicateCheckHash, screening status and timestamps, and a supplierId FK to the existing `suppliers`.
- A new `invoice_checks` table: one row per automated/manual check (exact_duplicate_file, duplicate_invoice_number, bank_mismatch, business_number_mismatch, vat_math, job/PO match, supplier_approved, withholding_required, four_eyes) with result pass/warning/fail, score impact, who/when.
- A four-eyes maker-checker gate for supplier payments/sends (reuse the prestige-pass guard). None exists for AP today.
- The SUMIT connector (does not exist; only future-reference comments). Built server-side only, using the secret via env var as stated above; model it on the existing accountant-export flow.
- A supplier-facing onboarding + document-upload portal (provider onboarding exists, supplier onboarding does not) and a supplier_documents link (suppliers currently store only bankAccountDetails jsonb).
- Two new roles: `Supplier` (own data only) and `Accountant` (read-only + export). `finance`/`super_admin` already exist.
- Optional later: extend `AuditLedgerService` enums to log invoice/approval events on the hash chain; for the first slice use the free-form `auditSignature.ts` to avoid schema churn.

## 3. How supplier verification works

- Supplier self-registers (draft) with legal name, supplier type (company / osek murshe / osek patur / individual / foreign), business number (ח.פ / ע.מ / ת.ז), VAT status, contact. Reuse the `suppliers` table.
- Supplier uploads required documents (reuse the KYC upload pattern + a new supplier_documents link): for company / עוסק מורשה — אישור ניהול ספרים, אישור ניכוי מס במקור, business certificate, bank confirmation, signed agreement, insurance if relevant; for עוסק פטור — עוסק פטור certificate, withholding approval, bank confirmation, agreement.
- Bank account submitted as pending and verified MANUALLY by finance (never auto-approved; never pay a new/unverified account).
- Admin approval requires: required documents present and valid, bank account verified, business number present, agreement accepted. Only then status = approved. A supplier cannot be paid unless approved.
- Document expiry (e.g. אישור ניהול ספרים, ניכוי מס במקור, insurance) flips the supplier to pending_review and downgrades new invoices to YELLOW until refreshed.

## 4. How invoice upload works

- Sources: provider portal, admin upload, email parser, WhatsApp forward, manual. Each upload reuses the multer→Firebase Storage pattern for the PDF and computes a SHA-256 file hash on save.
- On upload: create invoice (status uploaded) → run OCR via `receiptOCRService.extractReceiptData()` to pull invoice number, supplier name, business number, date, amount-before-VAT, VAT, total, and any visible bank details → run the fraud/duplicate checks (section 5) → compute risk → set status to ready_for_approval (GREEN), needs_review (YELLOW), or blocked (RED).
- The provider sees only a neutral status ("Invoice received — under review"); fraud logic and reasons are never exposed to the provider.

## 5. How duplicate and fraud detection works

- Reuse `receiptFraudDetection.analyzeReceipt()` and `ai/fraudScan.ts`; persist one `invoice_checks` row per rule. Rules and indicative score impact: exact duplicate file hash (RED, +100); duplicate invoice number for same supplier (RED, +100); same job/PO already invoiced (RED, +100); bank-account mismatch vs verified account (RED, +80); business-number mismatch (RED, +80); supplier-name mismatch below threshold (YELLOW, +40, RED if business number also mismatches); same amount + close date + same supplier (YELLOW/RED, +40); high visual/layout similarity with matching amount or bank or number (YELLOW/RED, +50); missing tax documents (YELLOW, +30); bank details missing from invoice (YELLOW, +25); no job/PO linked for an operational expense (YELLOW, +20); VAT math mismatch or VAT charged by an exempt dealer (YELLOW, +20); amount above threshold (e.g. ₪2,000/₪5,000) requires finance-manager approval (+15).
- Risk levels: 0–24 GREEN (normal workflow); 25–69 YELLOW (manual note required); 70–100 RED (cannot be paid; only finance manager / super admin may override, and the override is itself an audited event).
- Duplicate detection reuses the existing SHA-256 `duplicateCheckHash` mechanism already used by `staffExpenses`.

## 6. How bank-account verification works

- Bank accounts live as records with status pending/verified/rejected/old/blocked and a verification method (manual, bank document, micro-deposit, accountant-confirmed). Reuse `suppliers.bankAccountDetails` plus the existing `bankAccounts`/reconciliation tables; sensitive fields encrypted at rest.
- A new or changed bank account always requires manual finance approval and is never auto-used for payment. If invoice-visible bank details do not match a verified account → RED; if no bank details are visible on the invoice → YELLOW.
- Bank-change events are audited (who/when/old→new) and trigger a notification.

## 7. How job / PO matching works

- For provider/operational invoices, link to a completed booking/job (reuse `bookings`/`superAppPayouts.bookingId` linkage and the dual-approval completion gate at `server/routes/booking-requests.ts:1455`). Rules: job must be completed; invoice provider must equal job provider; amount must match agreed price within tolerance; the job must not already be invoiced (RED if it is).
- For general business expenses (accountant, rent, software, utilities) there is no end-customer job; match instead to a `supplierContract`/PO or mark as a recurring approved expense. No-job-linked is YELLOW for operational suppliers, acceptable for general business expenses.

## 8. How SUMIT / accountant handoff works

- Only an internally approved, non-RED (or explicitly overridden) invoice from an approved supplier may be sent. On send, status → sent_to_sumit and the send is audited.
- Connector is server-side only and built flexibly with a safe config wrapper; it must support at least one of: a SUMIT API call, a SUMIT expense-email forward, or a manual export package (ZIP of PDFs + CSV + supplier docs + approval log) modelled on the existing `sendTaxReportToAccountant` and monthly-package flow.
- Secret handling, restated exactly: SUMIT credentials are stored in Pet Wash secrets and must be accessed server-side via environment variables. The design must not expose or duplicate secrets. The SUMIT key is never hard-coded, never in frontend, never logged, never in errors, never in this SDD, never in the database unless encrypted with strong reason; tests mock SUMIT unless a safe explicit integration test is run; rotate immediately if ever exposed.
- Accountant statuses: not_sent → sent_to_sumit → received_by_accountant → (missing_details → back to admin) → entered_in_books → rejected_by_accountant. The accountant is read-only plus comments and bookkeeping status; the accountant cannot approve that operational work was actually done — only Pet Wash admin confirms service delivery.

## 9. How Israeli bookkeeping, tax and compliance risks are handled

- VAT: store amount-before-VAT, VAT amount, total, VAT rate (reuse ISRAEL_VAT_RATE 0.18 and `VATCalculatorService`), and a VAT-eligibility flag; flag VAT math errors and VAT charged by exempt dealers.
- Withholding tax (ניכוי מס במקור): store each supplier's withholding rate from their approval document; if missing, flag "missing withholding approval — accountant review required" (reuse `withholdingRemittanceLedger`).
- Document reminders: notify before אישור ניהול ספרים / ניכוי מס במקור / insurance / agreement expire.
- Employee-vs-contractor risk: if a provider works regularly, only for Pet Wash, under Pet Wash control with fixed hours/equipment, flag "possible employee/contractor classification issue — legal/accountant review" (relevant for ביטוח לאומי and employment law).
- SHAAM e-invoicing: respect the existing SHAAM thresholds in config when an allocation/clearing number is required.
- Full audit trail per invoice (who uploaded, when, who approved, why, all checks, when sent to SUMIT, accountant status, payment status) via the existing audit utilities; approval events are immutable.

## 10. Feature flag

`ff.supplier_invoice_control.enabled`, default OFF. When OFF, none of the new routes/UI are active and existing accounting/expense flows are untouched. Turn ON per-environment (staging first). A secondary flag `ff.supplier_invoice_control.sumit_send.enabled` (default OFF) gates the SUMIT connector specifically, so screening can ship and run before any external send is enabled.

## 11. Rollback plan

- Flip `ff.supplier_invoice_control.enabled` OFF → instantly disables all new routes/UI; existing flows are unaffected because new tables are additive and nothing in the legacy path reads them.
- The first slice moves no money and executes no payment rail (Masav is intentionally absent and is actively forbidden by regression tests at `server/tests/financeDash.regression.test.ts:88`), so there is no financial state to unwind.
- New tables are additive (no destructive migration); if needed they can be dropped while the flag is OFF. The SUMIT connector is behind its own flag and can be disabled independently.

## 12. First safe PR

An inbound supplier-invoice screening pipeline that stops at "ready_for_accountant" and moves no money: add the `supplier_invoices` and `invoice_checks` tables (screening columns copied from `staffExpenses`, supplierId FK to existing `suppliers`); add `POST /api/supplier-invoices` reusing the kyc.ts upload pattern, then `receiptOCRService.extractReceiptData()` then `receiptFraudDetection.analyzeReceipt()` to populate OCR + fraud fields and reject duplicates via the existing SHA-256 hash; record approvals via `recordExpenseApproval` (auditSignature.ts, no audit-schema change) with the prestige-pass four-eyes guard for amounts over threshold; gate all routes with `checkPermission` and the existing `finance`/`FINANCE_MANAGER` role plus a new read-only `accountant` role; terminal state `ready_for_accountant` only records/notifies. Explicitly out of this PR: SUMIT connector, Masav/payment execution, supplier self-onboarding UI, hash-chain audit enum extension. Everything behind the flag, default OFF, with tests.

## 13. Open questions

- Does SUMIT expose an ingestion API, or do we start with email-forward / export package? (Connector shape depends on this; secret is already stored either way.)
- Reuse `accountsPayable` as the invoice header vs. a dedicated `supplier_invoices` table — which is canonical, to avoid two AP models?
- Are "providers" (sitters/walkers) ever paid as suppliers through this flow, or only true vendors? (Affects job-matching vs PO-matching.)
- High-value approval threshold(s) in ₪ for four-eyes and finance-manager escalation.
- Payment execution: stays external/manual until Masav rails are obtained — confirm we only record "paid", never execute, in phase 1.
- Withholding-rate source of truth: per-supplier document vs accountant-provided table.

## 14. Risks

- Money/compliance blast radius — mitigated by flag-OFF default, no payment execution in phase 1, and SDD-first discipline.
- Two AP models if `accountsPayable` and a new table diverge — resolve in open questions before coding.
- SUMIT secret exposure — mitigated by server-side-only env access, no logging, no DB storage, mocked tests, rotation on exposure.
- OCR/fraud false positives blocking legitimate suppliers — mitigated by GREEN/YELLOW/RED tiers with human override and audited overrides.
- Employee-vs-contractor misclassification (ביטוח לאומי / labor law) — surfaced as a flag for legal/accountant, not auto-decided.
- Bank-change fraud — mitigated by mandatory manual verification and never paying unverified accounts.

## 15. Appendix — original plan (verbatim, as provided by Nir)

The full original instruction plan is preserved verbatim below as provided: a supplier/invoice/SUMIT/bookkeeping/fraud-control system whose main goal is to control every supplier/provider invoice before it is paid or sent to bookkeeping (provider uploads invoice → system scans → checks fraud/duplicates/legal/tax/bank/job match → admin approves → push to SUMIT/accountant → accountant processes → payment approved/recorded), protecting Pet Wash from duplicate invoices, fake invoices, changed-bank-account fraud, wrong supplier details, invoicing for work not done, near-identical invoices, unregistered suppliers, payment before accounting approval, and missing Israeli tax documents. It specifies: system architecture (Provider Portal, Admin Panel, Fraud Engine with GREEN/YELLOW/RED, SUMIT/Accountant integration, Israeli Compliance Layer covering מס הכנסה / מע״מ / ביטוח לאומי / ניכוי מס במקור / אישור ניהול ספרים / VAT status / audit trail); user roles (Provider/Supplier/מטפל, Pet Wash Admin, Finance Manager, Accountant, Super Admin) with explicit can/cannot lists; database tables (suppliers, supplier_bank_accounts, supplier_documents, jobs, invoices, invoice_checks, approval_events, payments) with full field lists and rules; API routes for supplier registration, document/bank upload, supplier approve/suspend, invoice upload/run-checks/list/detail/approve-internal/reject/send-to-sumit/bookkeeping-approved/mark-paid; twelve fraud rules (exact duplicate file, duplicate invoice number same supplier, duplicate number similar supplier, same amount+close date+same supplier, similar PDF layout, bank mismatch, supplier name mismatch, business number mismatch, VAT math, job match, expired tax documents, high amount threshold); a risk-scoring scheme (start 0; +100 exact duplicate file / duplicate invoice number / job already invoiced; +80 bank mismatch / business number mismatch; +50 visual similarity; +40 supplier name mismatch / same amount-date-provider; +30 missing tax documents; +25 missing bank account; +20 no job linked / VAT mismatch; +15 high amount; GREEN 0–24, YELLOW 25–69, RED 70–100; RED cannot be paid, YELLOW needs note, GREEN continues); SUMIT wiring with three connectors (API uploadExpense, email forwarding forwardApprovedInvoice, manual export-approved-invoices ZIP+CSV); accountant workflow and statuses (not_sent, sent_to_sumit, received_by_accountant, missing_details, entered_in_books, rejected_by_accountant); Israeli compliance logic (document reminders, VAT tracking, withholding tax, employee-vs-contractor warning, audit trail); provider onboarding flow (profile, documents, bank verification, agreement acceptance, admin approval); invoice upload flow; admin invoice review page with PDF preview, risk color, reasons, supplier details, bank/job comparison, similar invoices, tax-document status and action buttons (Approve, Reject, Request correction, Send to SUMIT, Block supplier, Escalate to finance manager); payment approval rules (only if bookkeeping_approved or finance override, supplier approved, bank verified, risk not RED, no duplicate, approval log exists, else block with "Payment blocked: invoice has unresolved fraud/compliance warnings"); notifications to provider/admin/accountant; the processInvoice pseudocode; UI pages for provider, admin and accountant; provider terms (true and accurate invoices, no duplicates, no unapproved bank changes, payment only after approval, Pet Wash may delay suspicious invoices and offset duplicate/mistaken payments, keep valid tax documents, notify of VAT/tax/business changes, termination for fraud); a five-phase MVP build order (1 basic supplier+invoice control, 2 OCR and fraud rules, 3 job matching, 4 SUMIT integration, 5 advanced risk engine); and the final instruction that this is a financial-control system, not a simple invoice uploader, where no supplier is trusted until verified, no invoice is trusted until scanned, no invoice is paid until matched to real work, no bank account is used until verified, no accounting record is polluted with suspicious invoices, SUMIT/accountant receive only clean approved traceable documents, SUMIT is the bookkeeping hub, and the Pet Wash system is the fraud/supplier/job/payment-control layer.
