# 04 — Israeli Financial Compliance

**Status:** Spec only. No runtime change.

**Owning Financial Core Parts:** Part 1 (Legal & Tax Identity), Part 5 (VAT Orchestration), Part 6 (Refunds & Credit Notes).

---

## 1. Objective

Lock the Israeli invoice / receipt / credit-note lifecycle so every customer-visible financial document is:

- **Sequenced gap-free** per SHAAM (`שע"מ`) requirements
- **Issued by the correct legal seller** per channel (Pet Wash Ltd direct vs marketplace facilitator on behalf of provider, per Part 0.6)
- **VAT-compliant** per Part 5 obligation map (authorised dealer vs exempt; reverse charge out of scope v1)
- **Retained for 7 years** under `חוק מסמכי חשבונות, תשמ"ו-1976`
- **Multi-language consistent** (Hebrew + English versions of the same document tied to the same canonical numbering)

The prior implementation issued documents with the wrong company tax id (closed by PR-G #205) and had partial sequencing (`TaxDocumentService` exists). This section is the architectural plan to make the lifecycle complete and correct.

---

## 2. Current state

| Surface | Today |
|---|---|
| Legal identity | Centralised in `shared/finance-identity.ts` (PR-G): `COMPANY_TAX_ID = '517145033'`, EN/HE names, `getCompanyVatLineHe()`, `getCompanyVatLineEn()` |
| Banking identity | Centralised + encrypted in `server/services/TreasuryConfigService.ts` — never hardcoded |
| Invoice generator | `server/services/IsraeliInvoiceGenerator.ts` — Hebrew + English PDFs, uses canonical helpers (PR-G) |
| Tax document store | `server/services/TaxDocumentService.ts` — issues `RECEIPT` / `TOPUP_RECEIPT` / `TAX_INVOICE` / `CREDIT_NOTE` / `COMMISSION_INVOICE` / `CHARGEBACK_NOTICE` / `ADJUSTMENT_NOTE` |
| Sequence allocator | `server/services/TaxSequenceService.ts` — per-domain monotonic counters with advisory lock |
| Drive archival | `server/services/DriveArchivalService.ts` — async PDF archival to Google Drive |
| Credit-note (זיכוי) lifecycle | Partial — `voidAndReissue` exists but no first-class refund credit-note flow |
| B2B vs B2C distinction | Partial — `taxProfile.osekStatus` informs commission invoice but not customer invoice format |
| SHAAM digital signature | NOT implemented — invoices are PDF only, not signed |
| Per-language version pinning | Partial — both languages exist but they don't share a canonical number ledger |

---

## 3. Target architecture

### 3.1 Document classes (locked enum)

| Class | Issued to | Issued by | Sequence domain | VAT line |
|---|---|---|---|---|
| K9000 wash receipt (קבלה) | Customer | Pet Wash Ltd | `INVOICE.PETWASH.K9000` | Yes (Pet Wash VAT) |
| K9000 tax invoice (חשבונית מס) | Customer | Pet Wash Ltd | `INVOICE.PETWASH.K9000` | Yes |
| Marketplace booking — authorised provider, self-billed | Customer | Pet Wash Ltd on behalf of Provider | `INVOICE.PROVIDER.<provider_id>` | Yes (Provider VAT) |
| Marketplace booking — authorised provider, self-issued | Customer | Provider directly (Pet Wash records ref only) | (provider's external) | Yes |
| Marketplace booking — exempt provider | Customer | Pet Wash Ltd on behalf of Provider | `RECEIPT.PROVIDER.<provider_id>` | No (exempt) |
| Platform-fee invoice to Provider | Provider | Pet Wash Ltd | `INVOICE.PETWASH.PLATFORM_FEE` | Yes (Pet Wash VAT) |
| Wallet top-up receipt | Customer | Pet Wash Ltd | `RECEIPT.PETWASH.TOPUP` | No (deferred liability) |
| Credit note (זיכוי) | Customer | Same issuer as the original document | `CREDIT_NOTE.<original-domain>` | Reversal of the original |
| Payout report | Provider | Pet Wash Ltd | `PAYOUT_REPORT.<provider_id>` | n/a (statement, not invoice) |

### 3.2 Numbering authority (already-shipped contract)

Per Financial Core Part 2.4:
- One sequence per `(domain, year)`
- Numbers allocated via `INSERT ... RETURNING` inside the same DB transaction as the consuming row
- No advance allocation, no external allocator, no skips
- Daily gap-detector job (Section 7)

### 3.3 Customer-visible refund == credit note (Part 6.5)

Refunds are **never** invoice deletions. The lineage is:

```
Original invoice  ──┐
                    ├──→  Credit note (issued; references original by id; offsets amount)
                    │
Refund              ──┘  ──→  Payment-side reversal (acquirer call)
                                         │
                                         └──→  Payout adjustment to provider (if applicable)
```

The original invoice stays in storage forever. The credit note is its own document with its own number from the matching credit-note domain. Both are referenceable from the customer's account history.

### 3.4 Multi-language version pinning

A document has one canonical number. Hebrew and English versions are renderings of the same document; both reference the same `tax_doc_id` and the same sequence number. The PDF metadata records which language was the customer-facing version (some accounts elect Hebrew, some English). The sequence is allocated once.

### 3.5 SHAAM digital signature

Per Israeli Tax Authority circular requirements: tax invoices over a threshold must carry a digital signature. The signing flow:

1. Render canonical PDF (deterministic byte output — fonts embedded, images deterministic, no timestamps inside the PDF body).
2. Compute SHA-256 of canonical PDF bytes.
3. Sign with the company's SHAAM-registered key (HSM or key-management service).
4. Attach signature to the PDF and persist signed bytes to immutable storage (Drive archival per Part 9.2).
5. Record signature hash in `pw_tax_documents.signature_sha256` column.

Signing happens **after** the document is issued and numbered — never before.

### 3.6 B2B vs B2C handling

- **B2C (customer is consumer):** customer details on invoice = name + city + email. No VAT id required.
- **B2B (customer is a business):** customer details = legal name + VAT id (`עוסק מורשה` number) + business address. The customer's own VAT id appears on the invoice so they can reclaim VAT.

Distinction is captured at booking time via an explicit "I am a business" toggle. The toggle is sticky per customer profile after first set.

### 3.7 Retention

- Hot storage (Drive): 12 months
- Warm storage (GCS Coldline or equivalent): months 13–84
- Total retention: 7 years minimum
- Export package format defined in Part 9.7

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| No SHAAM digital signature | high — required at threshold |
| Credit-note flow is half-built (`voidAndReissue` exists; refund-credit-note not first-class) | high |
| No B2B / B2C toggle in booking flow | medium |
| Multi-language version pinning is convention-only, not enforced | medium |
| Provider self-billing authorisation language not yet captured in Provider Master Agreement | blocker (counsel) |
| 7-year retention warm-tier storage class not chosen | medium (Ops) |
| Daily gap-detector for numbering not implemented | high |
| Customer-facing "view all my documents" surface is partial | medium |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- All 9 document classes (Section 3.1) issuing through the unified `TaxDocumentService` with their correct sequence domain
- Refund credit-note pathway tied to Part 6.5 lineage
- B2B/B2C toggle + invoice template branching
- Daily numbering gap-detector
- Multi-language version pinning enforced (one sequence per document, two language renderings linked to it)
- Retention policy: hot tier active (Drive); warm tier configured but doesn't matter for v1 launch volume

**Deferred scope:**
- SHAAM digital signature (configurable threshold; signed PDFs come in PR-COMPLIANCE-2 once HSM / key-management is sourced)
- Bulk export-package endpoint for accountant / regulator (Part 9.7 — separate spec)
- Multi-jurisdiction support (Section 10)

---

## 6. Legal / regulatory / financial assumptions

- Pet Wash Ltd is `עוסק מורשה`. VAT id = company id = 517145033 (verified).
- Self-billing on behalf of providers is permissible with authorisation language in the Provider Master Agreement (Part 0.6.2 / 0.6.4 — open question, counsel confirms).
- Israeli VAT rate v1 = 18% (effective Jan 2025 per Tax Authority circular). Codified once in `shared/israel-compliance-config.ts:ISRAEL_VAT_RATE`.
- Currency v1 = ILS only. Foreign cards are accepted but charge in ILS.
- 7-year minimum retention is non-negotiable.

---

## 7. Open questions for human decision

1. **Provider Master Agreement clauses** — counsel drafts; CEO signs (Part 0.5 dependency).
2. **B2B detection UX** — where in the booking flow does the toggle live? Product decides.
3. **SHAAM digital signature provider** — local HSM / GCP KMS / managed signing service? Ops + Sec choose.
4. **Threshold for signed invoices** — Israeli Tax Authority sets per directive; CPA confirms current threshold.
5. **Provider-issued invoice trust** — for the self-issued (legacy) opt-out path (Part 0.6.2.b), how do we capture the provider's invoice number? Manual entry vs OCR vs API? Eng + Product.
6. **Customer-facing language preference** — sticky per profile, or per-document choice?

---

## 8. Dependency graph

**This section blocks:**
- PR-UPAY-5 (invoice / receipt lifecycle for online payments — UPay/SUMIT integration consumes this section's templates)
- Section 5 (marketplace payouts) — provider statement format
- Section 7 (admin dashboards) — finance views consume the document store
- Section 9 (fraud) — chargeback notice handling consumes the document classes here

**This section is blocked by:**
- Provider Master Agreement (counsel)
- SHAAM provider sourcing (Ops + Sec) — for the deferred signing scope

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Numbering gap | SHAAM finding; possible invalidation of invoices in the gap range | Daily gap-detector; allocation inside the same DB txn as the consuming row |
| Wrong issuer (customer sees Pet Wash issuing for an exempt provider as taxable) | Wrong VAT collected; legal exposure | Issuer derived from `provider.taxStatus` snapshot at issue time (Part 1.5 immutable snapshot) |
| Multi-language render uses different totals | Customer confusion + audit risk | Single source of truth = the underlying transaction row; renderer is pure function of (txn, language) |
| Refund issued without paired credit note | Audit trail breaks | `nayax_refund` insert + credit-note issue happen in same DB txn; constraint enforces |
| Document deleted by admin | 7-year retention violated | Retention policy DB-level — no DELETE permission for any role; admin "void" sets `status='voided'` and issues offsetting credit note |
| Tax id literal regression | Wrong-entity invoices issued (the F-01 bug we just closed) | PR-G source-pin tests pin the canonical literal; family suite catches |

---

## 10. Reconciliation strategy

- Per-day: count(issued today) per domain == count(consumer rows that fired an issuance today).
- Per-VAT-period (monthly): sum(VAT collected per invoice domain) reconciled to bank-side trust account inflow attributable to VAT.
- Per-credit-note: every credit note must reference exactly one original invoice. No orphans.
- Per-language: every multi-language document has exactly two renderings or exactly one (if customer locale only one); never zero, never three.

---

## 11. Rollback / offset strategy

- A wrongly-issued invoice → credit note for the full amount + reissue. Original invoice never disappears. Numbering not re-used.
- Misclassified `taxStatus` snapshot → corrective ledger entry + corrective invoice/credit-note pair if it reached the customer.
- SHAAM signing rollback (if signing service breaks): revert to unsigned PDF emission + page operations team. Documents below threshold continue. Documents above threshold queue for signing once service restored.

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-COMPLIANCE-SPEC` | This document | spec |
| `PR-COMPLIANCE-1` | Numbering gap-detector cron + admin alert | runtime |
| `PR-COMPLIANCE-2` | SHAAM digital-signature pipeline (deferred — requires HSM / key-management) | runtime + Ops |
| `PR-COMPLIANCE-3` | Refund credit-note lineage (paired insert + offsetting ledger) | runtime |
| `PR-COMPLIANCE-4` | B2B / B2C toggle in booking flow + invoice template branch | runtime + UX |
| `PR-COMPLIANCE-5` | Multi-language version pinning enforcement | runtime |
| `PR-COMPLIANCE-6` | 7-year retention storage-class configuration + warm-tier migration job | runtime + Ops |
| `PR-COMPLIANCE-7` | Customer-facing "all my documents" view (+ download) | runtime + UX |

Each PR carries the full 12-field metadata.
