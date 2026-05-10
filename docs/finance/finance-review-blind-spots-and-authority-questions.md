# Finance Review — Blind Spots and Authority Questions (PR-FINANCE-REVIEW-1)

**Status:** DRAFT v1 — DOCS ONLY. No code, no schema, no env, no config, no package, no runtime, no payment / wallet / payout / refund / invoice automation, no SUMIT / UPay / Nayax / Tranzila / Stripe runtime wiring, no K9000 runtime, no HubSpot runtime, no auth / admin / provider activation changes. Single-purpose follow-up to **GitHub Issue #223** capturing the senior-reviewer letter from 2026-05-10. Does NOT modify any existing finance, architecture, or governance doc.

**Owner:** CEO (commercial direction) + CPA (B1 / B5 / Q13-Q18 CPA-tagged items) + Counsel (B3 / B4 / Q13-Q18 Counsel-tagged items) + Security reviewer (B6 / Q15) + Engineering lead (rail-bus invariants + manual-action audit invariants).

**Authored:** 2026-05-10. Branch: `claude/docs-finance-review-blind-spots` off post-#224 main.

**Scope:** Captures the six "blind spots" (B1-B6) identified in Issue #223 as detailed spec items, registers six new authority questions (Q13-Q18) against the registry in PR #224 D9, and restates five doctrine rules in their finance-specific context (rails never mutate; ledger bus; loyalty-points-as-money trap; vendor numbering lock-in; manual-action audit). Each item is **a risk-vector and authority-routing entry, NOT a legal conclusion or a compliance claim.**

**Framing rules (do not violate):**

- This is a **governance / spec doc, not legal advice.** Statutes referenced are **risk-vector and routing triggers**, not final legal conclusions.
- Every legal / tax / labour / payment-services point states that **CPA / Counsel / Labor lawyer / Vendor confirmation** is required before runtime dependency.
- **No compliance claims.** Pet Wash is not "compliant" because this doc exists; it is more **defensible** if specialists then answer the routed questions.
- **Out of scope:** Part 0.6 self-billing default correction is a SEPARATE follow-up PR (`PR-PART-0-6-CORRECTION`) and is referenced here only as a pointer.
- **Out of scope:** the 4-seat council adversarial-review findings (returned 2026-05-10 under Issue #223 follow-up) feed a separate `PR-COUNCIL-AMENDMENTS-1` and are not folded into this PR. This PR is exactly the predetermined Issue-#223 scope.
- **Out of scope:** any runtime activation, any vendor wiring, any production data flow.

**Hard rule (PR #224 §9 firewall — restated):** No live SUMIT API call. No live UPay API call. No automated invoice issuance. No automated refund. No automated provider payout. No wallet automation. No Stripe / Tranzila deletion. No K9000-and-marketplace money mixing. No e-gift treated as fungible cash. No raw card data handled by Pet Wash DOM or backend.

---

## How this doc fits the existing finance + governance series

This PR is the **content layer** that consumes the META-rulebook of PR #224 and the operating-model docs of PR #220 + PR #221. It does not create new doctrine; it applies existing doctrine to the six blind spots and six authority questions named in Issue #223.

| Doc (already on main) | Role | This PR's relationship |
|---|---|---|
| `docs/finance/00-platform-role-model.md` (Part 0) | Legal roles, trust-fund stance | Cited; not modified |
| `docs/finance/02-money-object-model.md` (Part 2) | Typed `Money`, append-only ledger | Cited; not modified |
| `docs/finance/transaction-lifecycle-forensic-audit.md` | 10 P0 findings, including F-104 | Cited; spec items reference findings |
| `docs/finance/sumit-upay-operating-model.md` (PR #220) | Vendor reality + 12 §10 questions | Cited; this PR registers Q13-Q18 in the same registry |
| `docs/finance/sumit-upay-vendor-discovery-and-rail-architecture.md` (PR #221) | 7-rail separation + 9-station financial lineage | Cited; B-items + cross-rail rule reference §4 + §5 |
| `docs/governance/octopus-brain-doctrine.md` (PR #224) | META-rulebook | Cited as governing meta; D-numbers cross-referenced throughout |
| `docs/architecture/02-wallet-redesign.md` | Wallet bucket separation | Cited; not modified |
| `docs/architecture/04-israeli-compliance.md` | VAT, SHAAM | Cited; not modified |
| `docs/architecture/05-marketplace-payouts.md` | Marketplace payout shape | Cited; B5 spec item references |
| `docs/architecture/01-unified-payment-abstraction.md` | Channel abstraction; PR-UPAY-1..7 | Cited; not modified |
| `docs/architecture/execution-pr-roadmap.md` | PR class registry | NOT modified — registry edits are a separate follow-up PR |

---

## 1. B1 — Clearing-fee ledger treatment

> **Authority:** CPA (decision class: tax-status / book-of-record). **Doctrine:** PR #224 D11 L1 (VAT) + D19 (Single-source-of-truth). **Existing doc:** Part 0.7 + `04-israeli-compliance.md`. **Source:** Issue #223 §B1 + Q16.

### 1.1 The risk vector

When a customer pays a gross amount and the acquirer (UPay / Nayax) settles a NET amount after deducting clearing fees, two failure modes exist if the ledger pattern is not specified:

- **Failure mode A — under-collection of output VAT.** If revenue is recognised at the NET settled amount (₪97 of ₪100), the ₪3 of fees has implicitly been treated as a customer discount. Output VAT is then under-collected on the customer-facing transaction. This is a fiscal misstatement with §220 exposure (PR #224 D11 L6).
- **Failure mode B — missed input VAT recovery.** The acquirer issues a monthly tax invoice (חשבונית מס) to Pet Wash for the cumulative clearing fees. The VAT input on that invoice is recoverable. If the fees are netted into revenue rather than booked as an expense, the input VAT is never claimed.

Both failure modes are silent at unit scale and material at platform scale.

### 1.2 The right pattern (subject to CPA confirmation — Q16 / Q25)

The ledger pattern that satisfies both customer-facing fiscal-document correctness and Pet Wash's deductible-expense bookkeeping:

```
Customer pays ₪100 (gross, including VAT at the active rate).
Customer-facing fiscal document shows ₪100 = pre-VAT base + VAT.
Customer NEVER sees the clearing fee line.

Pet Wash internal ledger (the spine — Part 2; the bus per PR #224 D3):
   dr  cash_in_transit_<acquirer>             ₪(100 - fee)
   dr  expense_clearing_fee_<acquirer>        ₪fee
   cr  revenue_<rail>                         ₪(100 / (1 + VAT))
   cr  vat_output                             ₪(100 - 100/(1 + VAT))

Acquirer monthly חשבונית מס TO Pet Wash:
   dr  expense_clearing_fee_<acquirer>        (matched to accrual)
   dr  vat_input_recoverable                  (the input VAT on fees)
   cr  cash_in_transit_<acquirer>             (clears the contra)
```

The fee is "מגולמת בחשבונית" (embedded in the customer's invoice) in the sense that the customer's invoice shows the full gross price; the fee never reduces the customer's paid amount. In Pet Wash's books the fee is a separate expense line that makes the P&L margin truthful and recovers input VAT.

### 1.3 What this doc does NOT do

- Does **not** decide the VAT base. The active VAT rate at any given time (currently 18% post-Jan-2025; future rates may differ) is sourced from `04-israeli-compliance.md` and confirmed by CPA, not by this doc.
- Does **not** prescribe the ledger account naming convention beyond the illustrative shape above. Final account codes are spec'd in Part 2.3 + the future PR-RECON-1 / PR-INFLIGHT-1 if those are opened.
- Does **not** specify per-rail nuances. K9000 fee structure (Nayax) and marketplace fee structure (UPay) differ; per-rail spec belongs in the relevant rail's PR.

### 1.4 Sign-off chain (per PR #224 D18)

CPA → CEO. Engineering does not commit to the pattern in code until CPA confirms the worked example in writing.

---

## 2. B2 — Document-numbering single-source-of-truth

> **Authority:** CPA + Vendor (decision class: document-of-record). **Doctrine:** PR #224 D2 (vendor demotion) + D19 (single-source-of-truth) + D8.15 (no fiscal numbering from more than one authority). **Existing docs:** PR #220 §10 Q1, PR #221 §1.1 (vendor-side evidence supporting SUMIT working assumption). **Source:** Issue #223 §B2 + Q18.

### 2.1 The risk vector

Israeli VAT law requires sequential, gap-free document numbering per channel × per provider. If two systems mint fiscal numbers for the same flow, the platform produces two parallel sequences:

- A SHAAM auditor sees the same money event represented by two numbered documents (one in SUMIT's stream, one in UPay's), and may treat one of them as a duplicate or a defect. Either outcome is an audit failure.
- The append-only ledger invariant of Part 2 cannot reconcile against two divergent number streams.

### 2.2 The rule (subject to CPA confirmation — Q1 / Q18)

**Exactly one system mints fiscal document numbers.** Working assumption per PR #220 §10 Q1 + PR #221 §1.1 vendor-side evidence: **SUMIT is the document-of-record minter; UPay does not produce fiscal documents in the integrated mode.** This is engineering's working answer; CPA must confirm in writing per the PR #224 D18 sign-off chain.

### 2.3 The vendor-lock-in trap (cross-link to Section 9 of this doc)

Naming SUMIT as the original mint creates **vendor lock-in via numbering**: if the SUMIT relationship deteriorates (pricing, support, terms, outage), Pet Wash cannot migrate to Invoice4u without breaking the chain-of-custody for all previously issued documents. SHAAM does not allow gaps mid-year (Part 2.4.3).

A more defensible architecture (subject to CPA confirmation under Q18): Pet Wash maintains its OWN canonical `(domain, year, sequence_no)` tuple as the legal-of-record number; SUMIT's number is held as a foreign reference. This is a non-trivial architectural decision; the doctrine cannot resolve it without CPA + vendor confirmation. Flagged here as a recommended discussion item for PR-NUMBER-1 (a future docs-only PR if approved).

### 2.4 What this doc does NOT do

- Does **not** decide between "SUMIT mints" and "Pet Wash mints, SUMIT mirrors." That is Q18 — CPA + vendor.
- Does **not** edit Part 2.4 (numbering authority spec). That edit belongs in PR-NUMBER-1.

### 2.5 Sign-off chain

CPA → Vendor (SUMIT) → CEO. The vendor-side question must be obtained in writing during the L1 vendor call (PR #221 §2 vendor-call brief, V11).

---

## 3. B3 — Chargeback / dispute lifecycle (SEPARATE from refund)

> **Authority:** Counsel (decision class: consumer / card-scheme law). **Doctrine:** PR #224 D8 (forbidden shortcuts) + D10 reviewer checklist + D11 L8 (Consumer Protection officer fines). **Existing doc:** PR #221 §5 (financial lineage station 8 — refund/reversal). **Source:** Issue #223 §B3 + Q13.

### 3.1 The risk vector

PR #221 §5 station 8 covers **refund / reversal** — money decisions Pet Wash initiates. It does NOT yet cover **chargebacks / disputes** — money decisions the customer or the bank initiates. These are different lifecycles:

| Refund / reversal | Chargeback / dispute |
|---|---|
| Pet Wash decides | Customer files via bank; bank decides |
| Pet Wash issues חשבון זיכוי | Bank notifies via acquirer |
| Money path: Pet Wash → customer | Money path: bank takes funds back from acquirer (typically with a dispute fee) |
| Internal SLA | Israeli card-scheme + bank deadline (typically 7-14 days first-tier, 30 days representment — Counsel must confirm) |
| Substates: requested → approved → issued → settled | Substates: received → defended → won → lost |

### 3.2 The rule (subject to Counsel confirmation — Q13)

The financial-lineage trace (PR #221 §5) **must be extended** to model chargebacks as a distinct substate of station 8, not collapsed into refund. Concretely:

- A new `dispute` lifecycle state machine: `received → defended → won → lost`.
- A new ledger account class: `expense_dispute_fee_<acquirer>` (the per-dispute fee charged by the acquirer regardless of outcome).
- A new evidence-pack contract: what the platform must assemble within the bank's deadline (acquirer notification → original auth receipt → capture receipt → fiscal document → service-delivery proof → customer-provider chat / GPS / photo evidence → cancellation policy at booking time). Counsel-confirmed.
- The dispute clock must be wired to the human ops dashboard with countdown, NOT silent.

### 3.3 What this doc does NOT do

- Does **not** specify the deadlines per dispute category — Counsel decides under Q13.
- Does **not** spec the technical webhook contract for dispute notifications — that belongs in PR-WEBHOOK-1 / PR-COMPLIANCE-DISPUTES-1.

### 3.4 Sign-off chain

Counsel → CPA → CEO.

---

## 4. B4 — Israeli consumer-protection refund SLA + checkout disclosures

> **Authority:** Counsel (decision class: consumer law). **Doctrine:** PR #224 D11 L8 (Consumer Protection §22ג officer fines) + D8.15. **Existing doc:** PR #220 §10 Q3 (refund money path). **Source:** Issue #223 §B4 + Q14.

### 4.1 The risk vector

Israeli consumer law (חוק הגנת הצרכן + Distance-Sales Regulations + חוק כרטיסי חיוב 1986) imposes specific obligations on Pet Wash that are not yet pinned in any spec doc:

- **Cooling-off rights** for distance contracts (typically 14 days; specific service-already-performed exceptions apply).
- **Refund deadline SLA** per rail (typically 7 business days for many cases; chargeback-driven reversals run on a different clock under חוק כרטיסי חיוב).
- **Credit-note (חשבון זיכוי) issuance SLA** once a refund is approved.
- **Mandatory checkout disclosures** (price including VAT in shekels; platform-fee vs service-fee breakdown; provider identity per channel; agent vs principal disclosure tied to PR #220 §10 Q11; cooling-off notice; refund procedure; complaint procedure; named consumer-protection officer; gift-card terms minimum-lifetime).

The risk: per-transaction administrative fines under §22ג; voidable contracts; class-action exposure; CEO personal-liability under §22ג officer-fines (PR #224 D11 L8).

### 4.2 The rule (subject to Counsel confirmation — Q14)

Counsel must define **per rail**:

- Refund SLA (calendar / business days).
- Credit-note issuance SLA after refund approval.
- Cooling-off applicability and the service-already-performed exception (some marketplace bookings — e.g. an in-progress sitter stay — fall under the exception).
- Checkout-disclosure standard (the enumerated items above) — what must appear on every checkout surface, in what language, with what prominence.

Outputs of Counsel's answer feed a future docs-only `PR-CHECKOUT-DISCLOSURE-1` (not this PR).

### 4.3 What this doc does NOT do

- Does **not** decide the SLA per rail — Counsel decides under Q14.
- Does **not** specify the checkout UI — UI specification is product-stream work.
- Does **not** name the consumer-protection officer — that is a separate operational decision (PR #224 D8 + future G15).

### 4.4 Sign-off chain

Counsel → CEO.

---

## 5. B5 — Provider withholding mechanics + Form 102 / 856 export

> **Authority:** CPA (decision class: tax-status). **Doctrine:** PR #224 D11 L2 + L2a + D19. **Existing doc:** PR #220 §10 Q6, `05-marketplace-payouts.md`. **Source:** Issue #223 §B5.

### 5.1 The risk vector

Pet Wash, paying provider service fees, is a **ניכה** (withholder at source) under פקודת מס הכנסה §164. The platform must:

1. Verify each provider's **אישור ניכוי מס במקור** annually via רשות המסים' supplier-inquiry interface.
2. If valid certificate present → withhold at the rate stated (often 0% for clean providers).
3. **If no certificate / certificate expired → withhold at the default rate** (per CPA confirmation; non-binding indicative figures: ~30% for many contractor classes; ~47% for individuals; case-by-case for חברה).
4. File **טופס 102** monthly (by the 15th of the following month) with totals withheld + remitted to ניכויים account.
5. File annual **טופס 856** by 30 April reporting per-provider totals; cross-checks with providers' annual returns.

Failure-mode exposure: under-withholding triggers JOINT LIABILITY of the payor under §164 (PR #224 D11 L2). Failure to file 102/856 timely triggers administrative fines per תקנות; criminal exposure under פקודת מס הכנסה §§ 215, 217, 219 for non-deduction or late remittance attaches to the company AND its officers (PR #224 D11 L2a).

### 5.2 The rule (subject to CPA confirmation — Q6 / Q20)

**Future docs-only `PR-MASAV-1` must include:**

1. Withholding-at-source state machine: `verified → withheld_at_zero | withheld_at_default | blocked`.
2. Certificate refresh workflow: annual mass-refresh job before March 31; per-provider certificate validity check at every payout; immutable certificate snapshot at every payout (Part 1.5).
3. **Hard block** on payout when `provider_tax_profile.cert_expires_at < now()` OR cert is missing.
4. Default-rate auto-flip when cert is missing/expired, per CPA-pinned rate matrix.
5. Form 102 generator: monthly export, data shape per רשות המסים specification.
6. Form 856 generator: annual export, by 30 April; data shape per specification.
7. Form 6111 (annual financial-statement export) source-of-record: SUMIT or internal — per CPA decision.

The state machine + the export generators are spec items for PR-MASAV-1; this PR registers the requirement, not the implementation.

### 5.3 Per-provider tier mechanics (cross-link to PR #220 §10 Q6)

The four provider tax-status tiers (עוסק מורשה / עוסק פטור / חברה / private where legally allowed — Q6 open) each have distinct withholding obligations and distinct invoice flows. This doc registers the requirement that PR-MASAV-1 specify them per tier; it does NOT decide the per-tier mechanics. CPA decides under Q6.

### 5.4 What this doc does NOT do

- Does **not** specify the default withholding rate. CPA pins under Q20.
- Does **not** specify the per-tier invoice flow. CPA pins under Q6.
- Does **not** specify whether SUMIT or internal generates Forms 102 / 856 / 6111 — that is a separate sub-question (CPA + Engineering).

### 5.5 Sign-off chain

CPA → CEO. Engineering implements PR-MASAV-1 only after the rate matrix + tier-mechanics + export-source decisions are answered in writing.

---

## 6. B6 — PCI-DSS / card-data boundary

> **Authority:** Security reviewer + Acquirer (decision class: PCI-DSS). **Doctrine:** PR #224 D8.16 + D8.17 (raw card data forbidden) + D11 L7. **Existing doc:** PR #220 §10 Q15 (placeholder). **Source:** Issue #223 §B6.

### 6.1 The risk vector

Pet Wash's frontend AND backend must **never** handle PAN (full card number), CVV, raw card numbers, or custom card-input forms. Accidentally taking even one of these elements into Pet Wash's infrastructure changes the PCI-DSS Self-Assessment Questionnaire (SAQ) level, which can:

- Push the platform from SAQ-A (light, ~22 controls; vendor-hosted iframe / redirect / tokenized) to SAQ-A-EP (mid; any platform code touching the payment-page DOM).
- Push to SAQ-D (heavy; if any PAN ever touches a Pet Wash server log or DB) for a year.
- Trigger PCI-DSS v4.0 mandatory controls (req 6.4.3 script management; req 11.6.1 HTTP-header / script tamper detection) on any iframe-hosting page.
- Acquirer-imposed fines + merchant-account termination (acquirer contract).
- חוק הגנת הפרטיות exposure (PAN data is high-sensitivity personal data); admin fines on officers (PR #224 D11 L10).

CEO PERSONAL LIABILITY if a breach occurs and PCI scope was misclaimed.

### 6.2 The rule (subject to Security review + Acquirer confirmation — Q15)

**Pet Wash uses ONLY hosted-checkout / redirect / iframe / tokenized vendor flows for any card-payment surface.** Concretely:

- Card-not-present: UPay's hosted payment page or payment-link. Customer enters card data on UPay's domain or in a UPay iframe; Pet Wash receives only a token + transaction reference.
- Card-present: UPay's Jini terminal (provider-held). The terminal handles PAN/CVV; Pet Wash receives only a token + transaction reference.
- K9000 kiosk: Nayax's terminal embedded in the machine. Same — Pet Wash receives only a session ID + transaction reference.

**Forbidden patterns** (each will be the subject of a future source-pin test in PR-PCI-1):

- Any input field on a Pet Wash-rendered page with name / id matching `/card|cc[-_ ]?(num|number)|pan|cvv|cvc|expir(y|ation)/i`.
- Any backend log statement that captures `req.body` for a payment webhook without a deny-list filter for PAN / CVV / track / expiry fields.
- Any frontend JS bridge that reads from a UPay or Nayax iframe DOM (this changes scope from SAQ-A to SAQ-A-EP at minimum).
- Any storage of full PAN in any Pet Wash database, file, log, cache, or analytics event.

### 6.3 SAQ classification per channel (subject to Security + Acquirer confirmation — Q15)

Tentative engineering working answers (Counsel + Security must confirm; vendor PCI-listing must be verified per Jini specifically):

- K9000 / Nayax: SAQ-P2PE or SAQ-B-IP (depending on Nayax's PCI-PTS listing).
- Marketplace online (UPay redirect): SAQ-A.
- Marketplace online (UPay iframe): SAQ-A but with PCI-DSS v4.0 req 6.4.3 + 11.6.1 in scope.
- Marketplace card-present (Jini): SAQ-B-IP or SAQ-P2PE — must be verified against Jini's PCI-listing.

**SAQ-D applies only if Pet Wash backend stores / processes / transmits PAN. It must not.**

### 6.4 What this doc does NOT do

- Does **not** name the SAQ level definitively per channel — Security + Acquirer pin under Q15.
- Does **not** specify the source-pin test — PR-PCI-1 (separate docs-only PR) specifies the test.
- Does **not** decide insurance coverage for PCI-related breaches — Insurance-broker authority routing under PR #224 D15.

### 6.5 Sign-off chain

Security reviewer → Acquirer (UPay / Nayax) → CEO.

---

## 7. Cross-rail invariant: rails never mutate each other; ledger is the bus

> **Doctrine:** PR #224 D3 (ledger as cross-rail bus). **Existing doc:** PR #221 §4 (7-rail separation) + §5 (9-station financial lineage). **This doc:** finance-specific restatement.

### 7.1 The rule (already locked in PR #224)

Rails 1-7 (K9000, Marketplace, E-gift, Promo, Internal-ledger, SUMIT, UPay) **must not directly mutate each other**. Cross-rail movement passes through:

- An immutable ledger entry.
- An idempotency key (per Section 8 below).
- A financial-lineage reference (PR #221 §5).
- An audit event.
- A reconciliation path.
- An approved state transition.

### 7.2 What this means in finance terms

- A K9000 wash cannot directly write to a marketplace `provider_payable_<id>` ledger row. (There is no provider in K9000 — the rail has no payable.)
- A marketplace booking cannot directly mutate K9000 station state. (The kiosk has no marketplace event.)
- An e-gift redemption that funds a marketplace booking emits TWO ledger pairs (one for the e-gift bucket debit, one for the marketplace rail's revenue + payable). The two pairs are linked by a common `txn_id` but neither pair calls into the other rail's code.
- A promo-credit redemption produces a marketing-expense ledger row, NOT a wallet-cash row.
- A SUMIT or UPay vendor event is INGESTED into the ledger as the source-of-record event; the rail does not mutate the ledger as a side-effect of vendor state.

### 7.3 What this doc does NOT do

- Does **not** specify the cross-rail saga ordering or the transaction boundary semantics. That is the subject of a future `PR-CROSS-RAIL-1` if approved (council seat 3 P0 finding; out of scope here).

### 7.4 Sign-off chain

Engineering lead → CEO.

---

## 8. Loyalty-points-as-money trap

> **Doctrine:** PR #224 D8.14 (no loyalty points treated as money without CPA / Counsel answer) + Issue #223 §B / loyalty trap. **Existing doc:** PR #220 §7.3 #6 (loyalty points are not money until CPA defines a conversion event). **This doc:** finance-specific restatement.

### 8.1 The risk vector

If loyalty points have a fixed shekel value, redeem directly at checkout, and behave like cash in any user-visible flow, regulators may treat them as financial value obligations subject to:

- Stored-value reclassification under the Payment Services Law 2023 (PR #224 D12) — adding to the surfaces that potentially trigger licensing.
- Gift-card-law obligations under חוק הגנת הצרכן §14י (minimum lifetime, breakage rules, partial-redemption clock).
- VAT-recognition timing questions (Q7) — when does VAT recognise on a points redemption?

### 8.2 The rule (subject to CPA + Counsel confirmation — Q17)

Until CPA + Counsel answer Q17 in writing, loyalty points are treated by engineering as **NOT a money object**:

- They do not appear in the `Money` ledger (Part 2).
- They do not have currency or VAT.
- They do not appear on a fiscal document.
- They do not have a public shekel-equivalent value displayed in any user surface that suggests a redemption-at-checkout behaviour.

If CPA + Counsel define an explicit **conversion-to-money point** (e.g. "100 points → ₪10 promo credit at redemption"), then the conversion event is what enters the ledger; the points themselves remain a customer-engagement counter. The conversion event flows through Rail 4 (promo) per the doctrine, not through the e-gift bucket and not through cash.

### 8.3 What this doc does NOT do

- Does **not** decide whether points are money. That is Q17 — CPA + Counsel.
- Does **not** specify the conversion-event shape. That is content for a future PR if approved.

### 8.4 Sign-off chain

CPA → Counsel → CEO.

---

## 9. Vendor lock-in via fiscal numbering

> **Doctrine:** PR #224 D2 (vendor demotion) + D19 (single-source-of-truth) + Section 2 of this doc. **Source:** Issue #223 §B / numbering trap.

### 9.1 The risk vector

If a payment vendor (SUMIT, UPay, or any future replacement) is the sole minter of fiscal document numbers, migrating away from that vendor breaks the chain-of-custody for previously issued documents. SHAAM does not allow gaps mid-year (Part 2.4.3). The cost of vendor migration becomes prohibitive — effectively, vendor lock-in.

### 9.2 The rule (subject to CPA + Vendor confirmation — Q18)

**The numbering authority must be deliberate and singular.** Two architecturally defensible options:

- **Option A — Vendor as original mint.** SUMIT mints; Pet Wash holds SUMIT's number as a foreign reference. Simpler. Carries vendor lock-in by design. Any migration requires a documented vendor-migration protocol (sequence reset on year boundary; customer comms; CPA-confirmed audit chain).
- **Option B — Pet Wash as original mint.** Pet Wash maintains its own canonical `(domain, year, sequence_no)` tuple. SUMIT (or any vendor) mirrors the Pet Wash number in its document presentation. The legal-of-record number is Pet Wash's. Subject to CPA confirmation that this is SHAAM-defensible.

This doc registers the requirement that one of the two is chosen in writing under Q18; it does NOT pick. The choice has architectural consequences that propagate into PR-NUMBER-1, PR-SUMIT-MIGRATE-1, PR-INVOICE-1, and PR-UPAY-5.

### 9.3 What this doc does NOT do

- Does **not** decide between Option A and Option B — CPA + Vendor pin under Q18.
- Does **not** edit Part 2.4 numbering authority spec — that edit belongs in PR-NUMBER-1.
- Does **not** spec the vendor-migration protocol — PR-SUMIT-MIGRATE-1 (separate, future).

### 9.4 Sign-off chain

CPA → Vendor (SUMIT) → CEO.

---

## 10. Manual finance actions must create ledger / audit evidence

> **Doctrine:** PR #224 D16 (manual-fallback discipline) + petwash-platform skill §2 (audit log mandatory). **This doc:** finance-specific restatement.

### 10.1 The rule (already locked in PR #224 D16)

No manual money mutation outside the ledger / audit-evidence chain. Concretely, the FORBIDDEN patterns are:

- WhatsApp-only refund ("I told the customer I'd refund them").
- Spreadsheet-only payout ("I'll add this provider to next week's batch by hand").
- Unlogged credit-note ("the document was issued from SUMIT directly without a corresponding ledger entry in Pet Wash").
- Manual balance adjustment ("we'll just SQL-update the wallet").
- Vendor-portal-only refund ("I issued the refund in UPay but it never landed in our books").

### 10.2 The required pattern (already locked)

Every admin-initiated money mutation passes through the **same money-mutating route as the automated path** and produces:

1. An idempotency key (per the closed table in PR-IDEM-1 if approved; for now per the natural-key shape per rail).
2. A ledger entry (Part 2 append-only).
3. An `audit_events` row capturing actor (admin user ID), action, target, before-state, after-state, free-text reason.
4. A financial-lineage trace (PR #221 §5).
5. A vendor-side reference where applicable (UPay refund ID, SUMIT credit-note number, Nayax reversal ID).

### 10.3 The exception that proves the rule

If a vendor-side artefact lands without a corresponding internal ledger entry (e.g. an admin manually issued a UPay refund in the UPay portal), the **reconciliation job** flags it and the admin **manually back-fills** the ledger entry through the same money-mutating route. The admin does NOT bypass the ledger.

### 10.4 Why this is here

This rule is doctrine-level (PR #224 D16). It is restated in this finance PR because the six blind spots (B1-B6) above all involve manual decision points (CPA approves a correction; admin issues a credit-note; ops handles a chargeback). Without explicit linkage to D16, those manual decision points are at risk of bypassing the ledger.

### 10.5 Sign-off chain

Engineering lead → CEO. Operationally, every admin user with money-mutating permissions must be onboarded with this rule.

---

## 11. New authority questions (Q13-Q18)

These extend the registry already established in PR #220 §10 (Q1-Q12) and PR #224 D9. Each has a single owner. Each is **a routing trigger, not a legal conclusion**.

| # | Owner | Question |
|---|---|---|
| **Q13** | Counsel | Chargeback / dispute lifecycle, timelines, evidence duties, dispute-fee treatment under Israeli charge-card law (חוק כרטיסי חיוב 1986 + Payment Services Law 2020 reversal-window rules). What are the per-category deadlines and the evidence-pack standard? |
| **Q14** | Counsel | Consumer-protection refund SLA per rail and required checkout disclosures (חוק הגנת הצרכן + Distance-Sales Regulations). What is the deadline by which Pet Wash must issue a refund and a חשבון זיכוי for each rail (kiosk, marketplace, e-gift, partial-redemption, provider no-show)? What disclosures are mandatory at checkout? |
| **Q15** | Security / PCI | Card-data boundary and PCI-DSS scope. Confirm hosted-checkout / redirect / tokenization only. SAQ level (A / A-EP / B-IP / D / P2PE) per channel. Verify Jini's PCI-listing exact P2PE status before any provider rollout. |
| **Q16** | CPA | Clearing-fee ledger treatment and VAT-input treatment for the UPay (and Nayax) monthly invoice to Pet Wash. Confirm the ledger pattern in §1.2 of this doc — or correct it. |
| **Q17** | CPA + Counsel | Loyalty points: not-money vs money-like redemption event. If money-like, when does the conversion event occur, what rail does it route through, and what fiscal-document obligations attach? |
| **Q18** | Vendor + CPA | Fiscal-numbering lock-in risk. Confirm one numbering authority only. Decide between Option A (vendor mints; Pet Wash references) and Option B (Pet Wash mints; vendor mirrors). Is Option B SHAAM-defensible? |

These questions land in the same registry as PR #220 §10 / PR #224 D9. Future agents and reviewers find specialist answers by question number.

---

## 12. Out of scope (explicit)

This PR does **not**:

- Modify any code file.
- Modify any schema file.
- Modify any env / config / package / lockfile.
- Modify any test file.
- Modify any existing doc (Part 0, Part 2, forensic audit, sumit-upay-operating-model, vendor-discovery, octopus-brain-doctrine, wallet-redesign, israeli-compliance, marketplace-payouts, unified-payment-abstraction, execution-pr-roadmap, HubSpot Master Operating System).
- Edit `docs/architecture/execution-pr-roadmap.md` to register the future PR classes named in this doc (PR-CHECKOUT-DISCLOSURE-1, PR-MASAV-1, PR-PCI-1, PR-NUMBER-1, PR-CROSS-RAIL-1, PR-COMPLIANCE-DISPUTES-1, PR-COUNCIL-AMENDMENTS-1, PR-PART-0-6-CORRECTION, PR-SUMIT-MIGRATE-1, etc.). Registry edits are a separate follow-up PR.
- Decide any §10 / D9 / Q13-Q18 question. It frames them; specialists decide.
- Authorise any production payment activation, any Stripe / Tranzila deletion, any provider payout, any invoice / credit-note issuance, any חיוב ללא אובליגו booking-hold flow, any UPay account activation, any Jini procurement, any wallet automation, any refund automation.
- Correct Part 0.6 self-billing default. **That is a SEPARATE follow-up PR (`PR-PART-0-6-CORRECTION`)** and must NOT be folded into this PR.
- Fold in the 4-seat council adversarial-review findings returned 2026-05-10. Those go into a separate `PR-COUNCIL-AMENDMENTS-1` if approved, with deduplicated Q19+ numbering.
- Make any compliance claim about Pet Wash's current state under any Israeli statute. Specialists classify; this doc routes.

---

## 13. Recommended next sequence

1. Review this PR and merge if approved.
2. **Send Q13-Q18 to CPA + Counsel + Security reviewer** per the owner column in §11.
3. Open separate docs-only `PR-PART-0-6-CORRECTION` if CPA confirms the self-billing default is misframed.
4. Open separate docs-only `PR-COUNCIL-AMENDMENTS-1` to consolidate the 4-seat council findings (Q19-Q42 deduplicated).
5. Continue Stream A (PR-PET-5 breed autocomplete UX) in parallel — non-financial, isolated.
6. Do not start runtime finance work until §9.2 readiness preconditions of PR #220 are satisfied AND CPA / Counsel / Security answers to Q1-Q18 are in writing.

---

## 14. Rollback

Single `git revert` of the merge commit. Doc removed. No follow-up cleanup. No code, no schema, no env, no config touched.

---

## Framing reminder (do not lose at any future amendment)

This doc is **governance / spec, not legal advice**. Statutes referenced are **risk-vectors and routing triggers**, not final legal conclusions. Every legal / tax / labour / payment-services point requires CPA / Counsel / Labor lawyer / Vendor / Security confirmation in writing before runtime dependency. No compliance claims are made. Pet Wash is not "compliant" because this doc exists; it is more **defensible** if specialists then answer the routed questions.

— end of document —
