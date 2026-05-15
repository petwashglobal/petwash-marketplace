# EGift VAT — Deep Audit and Accounting Planning Layer

**Status:** Audit + planning. **NO code changes. NO schema changes. NO accounting changes. NO implementation.**
**Companion doc:** `EGIFT_VAT_FINANCIAL_PROPOSAL.md` (merged in PR #264 + amended in PR #265). This deep audit layers on top of that architectural foundation — it does not replace it.
**Scope:** Israeli VAT (מע״מ 18%) treatment of the PetWash eGift system end-to-end, including invoice timing, refund/cancellation, partial redemption, breakage, accounting drift risk, and integration with Israel's CTC ("Invoice Israel") e-invoicing reform.

---

## Important warnings — read first

1. **I am not an Israeli CPA. I am not an Israeli tax attorney.** This document is a structured audit drafted from public sources. **Every position must be reviewed and confirmed by a qualified Israeli CPA / tax advisor before any implementation work.** Where the public sources are silent or ambiguous, I flag the question explicitly for the CPA to answer.
2. **No implementation will follow this PR.** It is the planning layer. Implementation PRs only start after CEO + CPA written sign-off on the mode selection (Mode A / B / C in §3 below) AND the per-question answers in §13.
3. **The existing EGIFT_VAT_MODE flag is the framework.** All scenarios in this audit assume that flag exists in `disabled_pending_review` default state until the CPA chooses Mode A or B. Implementing the flag is Phase 1 of the existing PR #264 rollout plan.
4. **No assumptions.** Where I infer a likely Israeli position from international consensus or EU doctrine, I state that explicitly and label it as "international consensus, requires Israeli CPA confirmation." I never present uncited inferences as Israeli law.
5. **PetWash specifics that drive the analysis (verified in code):**
   - Denominations are fixed: ₪100, ₪250, ₪500, ₪1000 (`server/lib/egift-denominations.ts:18`).
   - Each gift card is redeemable across multiple PetWash platforms — K9000 Wash Hub, Sitter Suite, Walk My Pet, PetTrek, Pet Wash Academy, Nayax Pet Wash (per the `platformServices` array in `EGift.tsx`).
   - The Israeli VAT rate is **18%** as of January 1, 2025 (`shared/israel-compliance-config.ts:30`, confirmed by [Marosa VAT](https://marosavat.com/vat-news/israel-increases-vat-rate-from-17-to-18-by-2025)).
   - The platform processes payments via Nayax. The full gift amount is currently sent to Nayax with no VAT line item.
   - The egift ledger (`egift_events` table) has no `vatCents` column today. PR #264 proposes adding it.

---

## 0. TL;DR

The single biggest VAT question for PetWash eGift is:

**Is the eGift card a Single-Purpose Voucher (SPV) or a Multi-Purpose Voucher (MPV) under VAT timing rules?**

The answer drives everything else. From the public sources I could find, Israel does not have a dedicated Tax Authority circular publicly addressing this question for gift cards. International best practice (EU VAT Directive 2016/1065, IFRS 15, ASC 606) and the international CPA consensus both treat gift cards redeemable for **multiple types of services with potentially different tax treatments or places of supply** as Multi-Purpose Vouchers, which means:

- VAT is **NOT** charged at the sale of the gift card.
- VAT is charged at **redemption**, when the actual taxable supply occurs.
- The platform records the gift card sale as **deferred revenue / outstanding liability**, not as taxable revenue.

PetWash eGift is clearly multi-purpose by design — the card is redeemable across at least six distinct service platforms. **The probable Israeli CPA conclusion is Mode B (`redemption_vat`) — deferred liability, VAT recognized at redemption.** But this MUST be confirmed in writing by the Israeli CPA before any implementation. There is also a less common interpretation (Mode A, `purchase_vat`) that the CPA might prefer for cash-flow / risk reasons, and that interpretation is documented below for completeness.

Eight critical accounting risks are flagged in §11 — anything from invoice-issuance timing under Israeli Tax Authority's 14-day rule, to the CTC ("Invoice Israel") e-invoicing reform's NIS 5,000 threshold (effective June 2026) that could affect bulk corporate gift card purchases.

This audit's role: get the CPA enough structured information to make the Mode A vs Mode B decision, and answer the implementation questions that follow.

---

## 1. The Israeli VAT framework — public sources

### 1.1 Rate and primary law

- **Rate:** 18% (raised from 17% on 1 January 2025). Source: VAT Law 5736-1975 + Israel Tax Authority circular. Public reference: [Marosa VAT](https://marosavat.com/vat-news/israel-increases-vat-rate-from-17-to-18-by-2025), [PwC Israel Corporate Tax Summary](https://taxsummaries.pwc.com/israel/corporate/other-taxes).
- **Primary statute:** Value Added Tax Law 5736-1975 (פקודת מס ערך מוסף תשל"ו-1975). English public text: [ICNL — Value Added Tax Law 5736-1975](https://www.icnl.org/wp-content/uploads/Israel_vat1975.pdf).

### 1.2 Tax invoice (חשבונית מס) issuance rule

- The tax invoice must be issued **within 14 days of the supply OR of cash receipt, whichever comes first**. Source: Avalara Israeli VAT invoice rules, public reference: [Avalara — Israeli VAT invoice rules](https://www.avalara.com/vatlive/en/country-guides/africa-and-middle-east/israel/israeli-vat-invoice-rules.html).
- For service providers, the "tax point" may in some cases be aligned with payment receipt rather than supply, but this is regulator-permitted by category, not automatic.
- **The 14-day window starts at the EARLIER of supply or payment.** Public reference: [Pagero — Israel e-invoicing compliance](https://www.pagero.com/compliance/regulatory-updates/israel).

### 1.3 CTC ("Invoice Israel") allocation number reform

- **Effective dates and thresholds:**
  - From **1 January 2026**: invoices of **NIS 10,000 or more** (excluding VAT) require a Tax Authority allocation number (מספר הקצאה) issued via SHAAM, otherwise the buyer cannot deduct input VAT.
  - From **1 June 2026**: threshold drops to **NIS 5,000 or more** (excluding VAT).
  - Public reference: [VATupdate — Israel Accelerates CTC Allocation Number Rollout](https://www.vatupdate.com/2025/12/10/israel-accelerates-ctc-invoice-allocation-number-rollout-lower-thresholds-effective-2026/), [Sovos — Israel CTC Reforms](https://sovos.com/vat/tax-rules/e-invoicing-israel/).
- **Scope:** B2B domestic transactions. B2C and cross-border excluded from the mandatory CTC requirement, per [Pagero](https://www.pagero.com/compliance/regulatory-updates/israel) and [Sovos](https://sovos.com/regulatory-updates/vat/israel-tax-authority-confirms-accelerated-timeline-for-ctc-invoice-allocation-number/).
- **Implication for PetWash eGift:**
  - The four denominations (₪100, ₪250, ₪500, ₪1000) are all **well below** the NIS 5,000 threshold individually. A single retail eGift purchase by a private consumer is not subject to the CTC allocation requirement.
  - **However:** a corporate buyer purchasing **multiple gift cards in one invoice** (e.g., a business buying 10 × ₪1000 = ₪10,000 for employee gifts) **does cross the threshold**. If PetWash issues a single tax invoice for that bulk purchase, that invoice requires a SHAAM allocation number under the 2026 CTC rules. This is documented as a separate scenario in §10.

### 1.4 General Israeli VAT principles relevant to gift cards

Public Israeli sources do not contain a dedicated gift-card / prepaid-voucher circular that I could find. The general framework therefore applies:

- VAT is charged on the **supply of a taxable good or service** at the time of supply (or earlier payment, per §1.2).
- For services, "supply" is typically when the service is rendered to the customer.
- "Advance payment" for a specific future service is taxable when received (since the supply event is identified).
- Pre-paid stored value redeemable for **unspecified future supplies** does not have a defined Israeli circular — this is the gap that international best practice fills (§2).

**The Israeli VAT Law does not explicitly distinguish between Single-Purpose Vouchers and Multi-Purpose Vouchers as the EU VAT Directive does. This is a gap that the CPA needs to address based on their reading of the Israeli framework + any unpublished Tax Authority rulings they have access to.**

---

## 2. International voucher framework — the SPV vs MPV doctrine

### 2.1 EU VAT Directive 2016/1065 (the international reference point)

The EU VAT Directive on vouchers, in force since January 2019, distinguishes two voucher types:

- **Single-Purpose Voucher (SPV):** a voucher for which, **at the time of issuance, both the place of supply AND the amount of VAT due are known**. The transfer of an SPV is treated as the supply itself — VAT is charged at the issuance/sale of the SPV.
- **Multi-Purpose Voucher (MPV):** a voucher for which the place of supply, the type of supply, OR the applicable VAT rate is not yet known at the time of issuance. VAT is **not** charged at the sale of an MPV; it is charged at the moment of redemption, when the taxable supply actually occurs.

The PetWash eGift card is redeemable across at least six distinct service platforms (K9000 Wash Hub, Sitter Suite, Walk My Pet, PetTrek, Pet Wash Academy, Nayax Pet Wash). Each of these may have:
- Different VAT treatment (some may include education services in Class 41 with different rate rules).
- Different place of supply (Sitter Suite at the sitter's location; K9000 at the station location; Walk My Pet potentially nomadic).
- Different supply timing.

**Under the EU MPV doctrine, PetWash eGift unambiguously qualifies as a Multi-Purpose Voucher.** This is international best practice. Whether the Israeli Tax Authority would adopt the same treatment must be confirmed by the CPA.

Public reference for the EU MPV/SPV distinction: international IFRS / VAT literature, e.g., [BDO — IFRS 15 in the spotlight: Accounting for vouchers](https://www.bdo.co.uk/en-gb/insights/business-edge/business-edge-2017/ifrs-15-in-the-spotlight) and [PwC Viewpoint — Unexercised rights (breakage)](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/revenue_from_contrac/revenue_from_contrac_US/chapter_7_options_to_US/74unexercised_rights_US.html).

### 2.2 IFRS 15 / ASC 606 accounting consensus

Independent of VAT, the accounting consensus is unambiguous:

- Both IFRS 15 (international) and ASC 606 (US) require that gift card sales **not** be recognized as revenue at the time of sale.
- The sale produces a **contract liability** (deferred revenue / unearned revenue).
- Revenue is recognized **at redemption**, when the performance obligation is satisfied (the service is rendered).
- Public reference: [KPMG Revenue IFRS 15 Handbook July 2025](https://assets.kpmg.com/content/dam/kpmgsites/xx/pdf/ifrg/2025/isg-handbook-revenue.pdf), [CPDbox — How to account for gift cards](https://www.cpdbox.com/ifrs-revenue-from-breakage/), [GBQ CPA — How To Correctly Account For Gift Cards](https://gbq.com/accounting-for-gift-cards/).

### 2.3 Implication for PetWash

The accounting answer (defer revenue, recognize at redemption) is unambiguous and internationally consistent.

The VAT answer is **probably** the same (defer VAT, recognize at redemption) under the multi-purpose-voucher reading. **But this is the question the Israeli CPA must answer formally in writing.** The Israeli VAT Law's 14-day invoice rule (§1.2) creates a potential mechanical conflict if the CPA reaches the opposite conclusion: that the sale of the gift card is itself a taxable supply, in which case an invoice with VAT must be issued within 14 days of the sale.

---

## 3. The three documented EGIFT_VAT_MODE values (from PR #264, restated)

| Mode | When VAT recognized | Buyer pays | Recipient receives | Aligns with |
|------|----------------------|-------------|---------------------|-------------|
| **Mode A — `purchase_vat`** | At eGift purchase | ₪118 for a ₪100 gift (₪100 credit + ₪18 VAT) | ₪100 credit (pre-VAT) | SPV-style; aggressive cash-flow but creates VAT exposure on unredeemed cards |
| **Mode B — `redemption_vat`** | At eGift redemption (when service is rendered) | ₪100 for a ₪100 gift | ₪100 credit; VAT reverse-calculated from service price at redemption | MPV-style + IFRS 15 / ASC 606 consensus |
| **Mode C — `disabled_pending_review`** | Default; no VAT recognized at egift event level | ₪100 for a ₪100 gift; aggregate VAT reconciled monthly via existing `IsraeliVATReclaimService` | Same as Mode B | Current state — works for aggregate revenue but creates reconciliation drift over time |

**Recommended posture (subject to CPA approval):** Mode C as default until CPA selects between Mode A and Mode B. CPA's likely answer (based on the MPV doctrine + IFRS 15 consensus + multi-platform PetWash design) is Mode B, but this is the CPA's call, not the engineer's.

---

## 4. Question 1 — How VAT should apply to eGift purchases

**The mechanical answer depends on which mode the CPA selects:**

### Under Mode A (purchase_vat — SPV treatment)

- Buyer pays ₪118 for a ₪100 gift card.
- Platform issues a tax invoice (חשבונית מס) within 14 days of the sale (per §1.2) showing:
  - Net amount: ₪100
  - VAT (18%): ₪18
  - Gross total: ₪118
- Recipient receives a ₪100 credit redeemable for services. The recipient never sees VAT — it was already paid by the buyer.
- At redemption, the service-side flow recognizes the wash/groom/walk service as covered by the existing credit (no new VAT event).
- Refund of an unredeemed Mode A gift card requires reversing both principal (₪100) AND collected VAT (₪18) — see §6.

### Under Mode B (redemption_vat — MPV treatment)

- Buyer pays ₪100 for a ₪100 gift card.
- Platform issues a receipt (קבלה — non-tax-invoice) showing ₪100, with no VAT breakdown. The sale is recorded as a deferred liability, not a taxable supply.
- At redemption, when the recipient consumes a service worth ₪100, the service is a taxable supply. The supplier (PetWash or the provider) issues a tax invoice for that service. VAT (₪15.25 on a ₪100 gross service, reverse-calculated from 1.18) is recognized then. The gift card simply funds the buyer side of that transaction.
- Refund of an unredeemed Mode B gift card reverses only the deferred liability (₪100). No VAT was ever recognized; no VAT needs to be reversed.

### Under Mode C (disabled_pending_review — current default)

- Same buyer experience as Mode B (₪100 paid, ₪100 credit).
- But no per-event VAT recording. Reconciliation is done at the aggregate revenue level monthly (via existing `IsraeliVATReclaimService`). This is the current behaviour.
- This mode is structurally less precise than Mode B and creates reconciliation drift over time. It is acceptable as a default-until-decided posture but should not be the permanent answer.

**The mechanically cleanest answer is Mode B. The Israeli CPA must confirm.**

---

## 5. Question 2 — Whether VAT is recognized at purchase, redemption, or both

This is a re-statement of §4 in plain language for the CPA.

**Under no scenario should VAT be recognized BOTH at purchase AND at redemption.** That would be double-recognition. The system must be designed to recognize VAT **once and only once** per transaction.

- Mode A: VAT recognized ONLY at purchase. Redemption is non-VAT-bearing.
- Mode B: VAT recognized ONLY at redemption. Purchase is non-VAT-bearing.
- Mode C: VAT not recognized at the egift-event level at all; recovered via aggregate reconciliation. Higher drift risk.

**The architectural guarantee that prevents double-recognition:** the `vatMode` column on each egift_events row (PR #264 schema addition) records which mode was active when the event occurred. This is the cryptographic anchor. If the system is ever audited, the CPA can replay the entire history and confirm that any given event was VAT-recognized at one point in the lifecycle and only one.

**The 10 architectural rules in `EGIFT_VAT_FINANCIAL_PROPOSAL.md` §0a — specifically rule 1 (ledger-first accounting), rule 2 (reverse entries only), rule 3 (idempotent event processing), and rule 6 (every state transition reconstructible from append-only events) — collectively make double-recognition technically impossible.** The audit trail proves the once-and-only-once property.

---

## 6. Question 3 — Invoice and receipt behaviour

### 6.1 Under Mode A (SPV treatment)

- **Document issued at purchase:** Israeli tax invoice (חשבונית מס) for the gross amount ₪118, showing net ₪100 + VAT ₪18.
- **Timing:** within 14 days of the sale (Israeli VAT Law). Currently the buyer's confirmation email could carry this invoice or link to it.
- **Recipient delivery email:** NOT an invoice. The recipient receives the gift; they didn't pay PetWash anything. The recipient's later redemption (for services) does not generate an invoice from PetWash to the recipient — the recipient is the consumer of a pre-paid service, not the buyer.
- **CTC allocation number:** required IF the single tax invoice is ≥ NIS 10,000 (from Jan 2026) or ≥ NIS 5,000 (from June 2026). A consumer buying one ₪118 card is well below. A B2B bulk buyer purchasing 10 × ₪1000 = ₪10,000 net (≥ threshold after June 2026 at ₪5,000) requires an allocation number.

### 6.2 Under Mode B (MPV treatment)

- **Document issued at purchase:** Receipt (קבלה) for ₪100, no VAT line item. This is a non-tax-invoice receipt evidencing payment. It is NOT a tax invoice and does not trigger the 14-day rule.
- **Document issued at redemption:** Tax invoice (חשבונית מס) for the service consumed. The supplier of the actual service (PetWash for a K9000 wash, the sitter for Sitter Suite work, etc.) issues that invoice. VAT is recognized then.
- **CTC allocation number:** applies to the SERVICE invoice at redemption, not to the egift purchase receipt. Standard CTC thresholds apply (NIS 10,000 / NIS 5,000).

### 6.3 Under Mode C (current default)

- Same as Mode B externally. Internal aggregate reconciliation only. Not a long-term answer.

### 6.4 Critical 14-day timing finding

If the CPA selects Mode A: every eGift purchase triggers a 14-day invoice clock. The system must be able to issue compliant Israeli tax invoices on demand or at scheduled intervals. **This is a meaningful engineering surface that does not exist today** — the codebase has invoice schema (`pwTaxDocuments`) but no automated invoice issuance flow tied to egift purchase events. PR #264 Phase 3 would need to add this.

If the CPA selects Mode B: the 14-day clock applies only to the redemption event, which is already a service-supply event with its own invoice path. Lower engineering burden.

**This is a real engineering cost difference between modes A and B that the CPA may not be aware of. The CEO should flag this when consulting the CPA.**

---

## 7. Question 4 — Refunds and cancellations interaction with VAT

### 7.1 Under Mode A (SPV treatment)

If an unredeemed gift card is refunded (within whatever refund window the CPA approves — currently proposed as 14 days in PR #264 Decision B):

1. Insert reverse ledger entry in `egift_events`: `eventType = 'REFUND_ISSUED'`, `amountCents = -10000`, `vatCents = -1800`, `grossCents = -11800`.
2. Insert reverse entry in `walletLedgerEntries` debiting platform's egift liability.
3. Issue a **credit invoice** (חשבונית זיכוי) to the original buyer for ₪118 (net ₪100 + VAT ₪18). This is the Israeli equivalent of a credit note.
4. Refund the ₪118 to the buyer's original payment method via the payment processor.
5. The VAT that was previously remitted to the Tax Authority on the original sale is now reclaimable as input VAT (or netted in the next monthly filing).

**Consequence:** Mode A refunds are mechanically more complex because they affect VAT collected. The credit invoice must be issued and the VAT period adjusted.

### 7.2 Under Mode B (MPV treatment)

If an unredeemed gift card is refunded:

1. Insert reverse ledger entry: `vatCents = 0` (no VAT was recognized).
2. Reverse the deferred liability.
3. Issue a refund receipt (not a credit invoice — no VAT to reverse).
4. Refund ₪100 to the buyer.
5. No VAT period adjustment needed.

**Consequence:** Mode B refunds are mechanically simpler. No VAT credit note. No Tax Authority filing adjustment.

### 7.3 Partial redemption + subsequent refund

If a recipient uses ₪50 of a ₪100 card and the remaining ₪50 is later refunded (e.g., due to dispute):

- Mode A: refund net ₪50 + reversed VAT ₪9 = ₪59 to the buyer. Credit invoice for the unused portion.
- Mode B: refund net ₪50 to the buyer. The ₪50 already redeemed is already a recognized service supply with its own VAT invoice — that doesn't get reversed.

### 7.4 Expired card scenario

This is Decision H (breakage accounting) in PR #265 — already deferred for CPA decision. Two leading options:

- Expired Mode A card: VAT was already remitted at purchase. Expiry doesn't claw it back. Decision H question: when does the un-redeemed ₪100 of liability convert to recognized revenue?
- Expired Mode B card: No VAT was recognized. Decision H question: same — when (and whether) to recognize as breakage revenue.

The Israeli CPA should answer Decision H in concert with the VAT mode decision, because the two are mechanically linked. **An expired Mode A card is more punishing for cash flow than an expired Mode B card** because the platform has already remitted VAT on a sale that produces no service.

---

## 8. Question 5 — Partial redemption behaviour

The audit found that the current redemption route at `server/routes/gift-cards.ts:441-444` force-marks the entire voucher REDEEMED on first use, regardless of amount used. **This is a real bug, not a missing feature** — flagged in PR #264 Decision F.

Partial redemption mechanics under each mode:

### Under Mode A

- Recipient redeems ₪40 of a ₪100 card for a wash service.
- `egift_events` insert: `eventType = 'PARTIAL_REDEEM'`, `amountCents = -4000`, `vatCents = 0` (already recognized at purchase).
- Service supplier issues a tax invoice for the wash service: but the ₪40 covered by the gift card has NO VAT (the buyer already paid VAT at gift card purchase). The remaining service amount, if any, paid by the recipient out-of-pocket, has its own VAT.
- This creates a mixed-VAT receipt scenario at the cash register / point of sale that requires careful tax invoice composition.

### Under Mode B

- Recipient redeems ₪40 of a ₪100 card for a wash service.
- `egift_events` insert: `eventType = 'PARTIAL_REDEEM'`, `amountCents = -4000`, `vatCents` = `4000 / 1.18 * 0.18` ≈ ₪6.10 (reverse-calculated from gross ₪40).
- The full ₪40 service is VAT-bearing — VAT is recognized now.
- No mixed-VAT complexity. Standard Israeli VAT path.

**Mode B is structurally simpler for partial redemption.** This is another engineering cost the CPA should consider.

---

## 9. Question 6 — Accounting records: how the business must track VAT safely

Regardless of mode selected, the accounting records must support:

1. **Per-event VAT recording.** PR #264 §3.1 schema additions are non-negotiable: `vatCents`, `vatRate`, `vatMode`, `grossCents`, `netCents`, `processorFeeCents`, `outstandingLiabilityCents` columns on `egift_events`.
2. **Mode-snapshot per event.** The `vatMode` column captures which mode was active when the event was recorded. This is critical for audit replay — if the platform ever changes modes, prior events retain their original treatment. The CPA can always determine "what mode was this event recorded under" without ambiguity.
3. **Hash-chain integrity.** The existing `sha256Hash` chain on `egift_events` proves no row was added or modified after the fact. CPA-friendly.
4. **Reverse-entries only.** Rule 2 of the 10 architectural rules. Never UPDATE or DELETE financial history. CPA-friendly.
5. **Daily reconciliation.** A scheduled job (PR #264 Phase 3) verifies that the platform's outstanding egift liability matches the sum of (issued cards) minus (redeemed + refunded + expired-recognized) cards. Drift is a P0 alert.
6. **Monthly VAT filing integration.** The existing `IsraeliVATReclaimService` (`server/services/IsraeliVATReclaimService.ts`) currently does aggregate revenue × 1.18 reverse-calc. Once the per-event vatCents data exists, this can be replaced with sum-of-vatCents (more precise, no drift) by reading the egift_events column.
7. **Invoice issuance log.** A new `pwTaxDocuments` link from each egift_events row that triggered an invoice issuance. The CPA can audit the chain: event → invoice number → SHAAM allocation number (if applicable) → filed with Tax Authority.

**Without these seven points implemented, the platform is exposed to either over-recognition (paying VAT twice) or under-recognition (missing VAT on a taxable supply). Both have legal consequences under the Israeli VAT Law.**

---

## 10. Question 7 — Double-recognition and accounting drift risks

The architecture in PR #264 + PR #265 prevents double-recognition by design (per §5 above). But there are still drift risks unrelated to the mode choice:

### 10.1 The 14-day clock missed

If Mode A is selected and PetWash fails to issue a tax invoice within 14 days of a gift card sale, the platform is in non-compliance with VAT Law §46-47 (per the [Avalara Israel guide](https://www.avalara.com/vatlive/en/country-guides/africa-and-middle-east/israel/israeli-vat-invoice-rules.html)). This requires reliable automated invoice issuance — a real engineering surface.

### 10.2 Aggregate reconciliation drift in Mode C

Mode C (current default) reconciles VAT at the aggregate revenue level. Over many months this naturally drifts from per-event truth because:
- Refunds across the month boundary are reconciled in the wrong period.
- Partial redemptions don't get individually VAT-tagged.
- Breakage / expiry recognition is approximated.

**This is why Mode C is documented as `disabled_pending_review` — it is acceptable to default to it while the CPA decides, but it is not a permanent operating mode.**

### 10.3 The CTC threshold trap for bulk corporate purchases

A corporate buyer purchasing 10 × ₪1000 gift cards = ₪10,000 in one transaction crosses the CTC allocation-number threshold (NIS 10,000 from Jan 2026; NIS 5,000 from June 2026). If the platform issues ONE tax invoice for ₪10,000 and does NOT obtain a SHAAM allocation number, the corporate buyer cannot deduct input VAT and may dispute the invoice. **The platform must either:**
- Detect bulk purchases and obtain SHAAM allocation numbers automatically (significant engineering).
- OR issue multiple smaller invoices each below the threshold (potentially questionable practice — the CPA should rule).
- OR refuse single-invoice bulk purchases above the threshold and require separate purchases.

This decision applies to both Mode A and Mode B (Mode B's redemption-side invoice can also cross the threshold for a luxury service).

### 10.4 Currency drift

PetWash eGift is ILS-only. If a card ever crosses borders (a buyer in another country, a recipient outside Israel), currency conversion creates VAT exposure. Currently the code in `EGift.tsx:537` uses fixed ILS denominations. **No code change needed today; flagging for the CPA.**

### 10.5 Processor fee accounting

Nayax charges PetWash a processor fee on each transaction. The fee is paid out of the gross amount the buyer pays. Under Mode A, the processor fee is a deductible business expense; the VAT is calculated on the gross gift card value (₪100), not on the net-of-fee amount. This is standard practice. PR #264 §3.1 includes a `processorFeeCents` column on `egift_events` to track this — but the calculation logic and any input-VAT reclaim from Nayax fees is a separate CPA conversation.

### 10.6 Withholding tax interaction

`shared/israel-compliance-config.ts` flags a withholding-tax provision (currently marked "pending CPA sign-off"). For pure consumer-to-business gift card sales, withholding is not relevant. For corporate buyers or B2B contexts, the CPA must confirm whether withholding applies.

### 10.7 Hash-chain break (theoretical)

If the egift_events hash chain is ever broken — e.g., due to a migration bug, a hand-edited row, or a corrupted backup restore — the platform loses its tamper-evidence story for the egift ledger. Daily integrity check (PR #264 Phase 3) detects this. Without it, drift can compound silently.

### 10.8 Refund window expiry conflict

If the CPA approves a 14-day refund window (PR #264 Decision B) for Mode A gift cards, the platform must also have issued the tax invoice by then. A refund within the 14-day window means the invoice was JUST issued and now needs to be cancelled with a credit invoice. The credit invoice generates its own SHAAM trail. This is a real edge case the CPA should address.

---

## 11. Question 8 — Gift-card liability handling on the balance sheet

Under both Mode A and Mode B (and Mode C), the platform carries a **gift card liability** on the balance sheet:

- The amount equals the sum of `eVouchers.remainingAmount` across all vouchers with `status IN ('ACTIVE', 'CLAIMED', 'ISSUED')` and `expiresAt > NOW()`.
- This liability is owed to recipients (or potentially to buyers if refunded).
- **Mode A** liability is net of VAT — the platform owes recipients ₪100 of service per ₪100 in the books (since the ₪18 VAT was already paid to the Tax Authority at purchase).
- **Mode B** liability is gross — the platform owes recipients the full ₪100, which when redeemed will be split between revenue (₪84.75) and VAT remittance (₪15.25).

**Both treatments are correct under their respective modes. They produce different balance sheet shapes for the same economic reality.**

The CPA's selection of Mode A vs Mode B has implications for:
- The size of the outstanding liability ledger entry (Mode B is larger by 18%).
- The cash position at any point in time (Mode A has already remitted VAT; Mode B holds it as part of liability).
- The reconciliation between bank balance and gift-card liability.

The architectural foundation in PR #264 §5.2 (daily liability snapshots written to `egift_liability_snapshots` table) supports both treatments.

---

## 12. Question 9 — Integration with Israeli invoice/compliance flows

### 12.1 Existing infrastructure (from earlier audit)

PetWash already has:
- `shared/schema-payments.ts:205-271` — `pwTaxDocuments` table for invoice/receipt records.
- `server/services/IsraeliVATReclaimService.ts` — monthly VAT filing generator.
- `shared/israel-compliance-config.ts` — central VAT rate + agent model + withholding configuration.
- `FinancialReconciliationService.ts` — monthly aggregate reconciliation.

### 12.2 Missing infrastructure for full VAT-aware egift

These are the new pieces required regardless of mode:

1. **Automated tax invoice / receipt issuance** triggered by egift events. Currently the audit found no automated invoice issuance tied to egift purchase or redemption.
2. **SHAAM allocation number integration** for invoices crossing the CTC threshold. The Tax Authority API for obtaining allocation numbers is documented; integration is non-trivial but well-scoped engineering work.
3. **Credit invoice (חשבונית זיכוי) issuance** for refunds. Required if Mode A is selected and refunds are allowed. Currently no credit invoice flow exists.
4. **Per-event invoice traceability** — link from `egift_events` row to the issued `pwTaxDocuments` row. PR #264 schema additions allow this via `metadata.invoiceId` but the link isn't wired yet.
5. **Buyer-facing invoice download** in the buyer's account / email. Standard Israeli practice for any VAT-bearing purchase.

### 12.3 Phasing

PR #264's 5-phase rollout already accommodates these:
- **Phase 1** (foundation): schema additions only. Already documented.
- **Phase 2** (display + recording): adds the line items + buyer email fields. Receipt issuance for Mode B.
- **Phase 3** (liability tracking + partial redemption): daily snapshot job + bug fix.
- **Phase 4** (admin tools + refund flow): credit invoice issuance for Mode A.
- **Phase 5** (CPA cutover): mode flip + go-live.

**Missing from PR #264 (added by this audit):** a sub-phase for automated tax invoice issuance + SHAAM allocation number integration. This is real new scope and the CPA should be made aware that selecting Mode A is significantly more engineering work than Mode B because of the invoice issuance burden.

---

## 13. Decisions awaiting CPA + CEO

These extend (do not replace) the existing Decisions A–I in `EGIFT_VAT_FINANCIAL_PROPOSAL.md` §12.

**Decision J — Single-Purpose vs Multi-Purpose Voucher classification.** Does the Israeli CPA classify the PetWash eGift as MPV (deferred VAT, Mode B treatment) or SPV (immediate VAT, Mode A treatment)? Default Israeli treatment in absence of a TA circular is not established in public sources. CPA must give a written opinion.

**Decision K — Tax invoice issuance timing trigger.** Under Mode A, what is the operational rule? (Suggested: issue invoice automatically within 24 hours of payment confirmation. CPA may have stricter standard.)

**Decision L — Credit invoice path for refunds.** Required only if Mode A. Currently no credit invoice flow exists. Phase 4 of the rollout would add this.

**Decision M — SHAAM allocation number integration scope.** When does the platform first need to obtain allocation numbers? (Standard answer: as soon as any single tax invoice crosses NIS 10,000 net = ₪11,800 gross, expected for any corporate purchase of 12 × ₪1000 cards in 2026.)

**Decision N — Aggregate-vs-per-event reconciliation method.** Once per-event vatCents exists, should `IsraeliVATReclaimService` move from aggregate revenue × 1.18 to sum-of-vatCents? Recommended yes — more precise, no drift, CPA-friendly. But the migration must be done after Mode B (or Mode A) is selected; running both methods in parallel for one filing cycle for comparison is a good safety step.

**Decision O — Bulk corporate purchase handling.** If a corporate buyer purchases multiple cards in one transaction crossing the CTC threshold, does the platform:
- (a) Obtain a SHAAM allocation number for the single invoice (preferred — preserves buyer's input VAT deduction).
- (b) Issue multiple smaller invoices below the threshold (potentially gaming; CPA must rule).
- (c) Refuse the bulk purchase as a single transaction (commercially weak).

**Decision P — Withholding tax applicability.** For B2B / corporate buyers of gift cards, does Israeli withholding tax apply? (Probably not for consumer-like prepaid services, but CPA must confirm.)

**Decision Q — Cross-border buyer treatment.** If a buyer outside Israel purchases an Israeli-redeemable gift card (e.g., a relative abroad gifting a card for a recipient in Israel), what is the VAT treatment? This is outside current scope but should be flagged.

---

## 14. References

### Israeli statutory and tax authority sources (public)

- Value Added Tax Law 5736-1975 (primary text): [ICNL — Israel VAT Law](https://www.icnl.org/wp-content/uploads/Israel_vat1975.pdf)
- Israel Tax Authority CTC ("Invoice Israel") accelerated timeline: [VATupdate](https://www.vatupdate.com/2025/12/10/israel-accelerates-ctc-invoice-allocation-number-rollout-lower-thresholds-effective-2026/), [Sovos](https://sovos.com/regulatory-updates/vat/israel-tax-authority-confirms-accelerated-timeline-for-ctc-invoice-allocation-number/)
- VAT rate change to 18% (Jan 2025): [Marosa VAT](https://marosavat.com/vat-news/israel-increases-vat-rate-from-17-to-18-by-2025)
- 14-day invoice issuance rule: [Avalara — Israeli VAT invoice rules](https://www.avalara.com/vatlive/en/country-guides/africa-and-middle-east/israel/israeli-vat-invoice-rules.html), [Pagero](https://www.pagero.com/compliance/regulatory-updates/israel)
- 2026 VAT updates overview: [Herzog Law — VAT Updates for 2026](https://herzoglaw.co.il/en/news-and-insights/overview-of-vat-and-customs-updates-effective-in-2026/), [Lexology](https://www.lexology.com/library/detail.aspx?g=cdd1fdf3-76c0-45b0-bc86-b5227affa60c)
- 2026 Israeli VAT guide: [Quaderno — Israel VAT Guide 2026](https://quaderno.io/guides/israel-vat-guide/)
- General Israeli tax overview: [PwC — Israel Corporate Other Taxes](https://taxsummaries.pwc.com/israel/corporate/other-taxes)

### International accounting / VAT framework (consensus references)

- IFRS 15 voucher accounting handbook: [KPMG — Revenue IFRS 15 Handbook 2025](https://assets.kpmg.com/content/dam/kpmgsites/xx/pdf/ifrg/2025/isg-handbook-revenue.pdf)
- IFRS 15 gift card accounting: [CPDbox — How to account for gift cards](https://www.cpdbox.com/ifrs-revenue-from-breakage/), [GBQ CPA — How To Correctly Account For Gift Cards](https://gbq.com/accounting-for-gift-cards/)
- US ASC 606 breakage and unexercised rights: [PwC Viewpoint — Unexercised rights (breakage)](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/revenue_from_contrac/revenue_from_contrac_US/chapter_7_options_to_US/74unexercised_rights_US.html), [Deloitte DART — Prepaid stored-value derecognition](https://dart.deloitte.com/USDART/home/codification/liabilities/asc470-10/roadmap-debt/chapter-9-debt-extinguishments/9-4-derecognition-liabilities-for-prepaid)
- BDO IFRS 15 in the spotlight (vouchers): [BDO — Accounting for vouchers](https://www.bdo.co.uk/en-gb/insights/business-edge/business-edge-2017/ifrs-15-in-the-spotlight)

### Codebase references (verified for this audit)

- `server/lib/egift-denominations.ts:18` — denominations source of truth.
- `shared/israel-compliance-config.ts:30` — `ISRAEL_VAT_RATE = 0.18`.
- `server/services/IsraeliVATReclaimService.ts` — existing monthly VAT filing service.
- `server/services/EgiftFinancialService.ts:83-264` — current egift purchase ledger writes (no VAT today).
- `shared/schema-payments.ts:205-271` — `pwTaxDocuments` table for invoices.
- `server/routes/gift-cards.ts:331-412` — purchase route.
- `server/routes/gift-cards.ts:414-550` — redemption route.

### Companion repository documents

- `docs/EGIFT_VAT_FINANCIAL_PROPOSAL.md` — architectural foundation (PR #264 / #265 merged).
- `docs/BACKUP_RETENTION_ARCHITECTURE.md` — audit ledger immutability rules (egift ledger inherits).
- `docs/LEGAL_TRADEMARK_PROPOSAL.md` — open PR #270 trademark notice (separate workstream).

---

## 15. What this PR (the doc) does NOT do

- Does not change any code.
- Does not change any schema.
- Does not change any accounting or VAT behaviour.
- Does not pick Mode A or Mode B — that is the Israeli CPA's call.
- Does not constitute tax or legal advice.
- Does not commit to a specific implementation phase or date.

---

**End of deep audit. No code, no schema, no infrastructure, no accounting changes. Awaiting CEO + Israeli CPA review and written sign-off on Decisions J through Q (and the earlier Decisions A–I from PR #264 / #265) before any implementation work begins.**
