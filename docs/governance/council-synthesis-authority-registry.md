# Council Synthesis + Authority Registry — Pet Wash Ltd

**Status:** DRAFT v1 — STRATEGIC SYNTHESIS ONLY. Captures the 4-seat adversarial council review convened by the CEO on 2026-05-10 in response to GitHub Issue #223 + the senior-reviewer letter. Single new file. No code, no schema, no env, no config, no package, no runtime, no payment / wallet / vendor / auth / admin / provider-activation / migration changes.

**Owner:** CEO (commercial direction + sign-off chain) + the named specialist owner per row of §4 (CPA / Counsel / Labor lawyer / Payments architect / Insurance broker / Bank / Vendor).

**Authored:** 2026-05-10. Branch: `claude/docs-governance-council-synthesis` off post-#225 main.

**Hard rule (PR #224 §9 firewall — restated):** No live SUMIT API call. No live UPay API call. No automated invoice issuance. No automated refund. No automated provider payout. No wallet automation. No Stripe / Tranzila deletion. No K9000-and-marketplace money mixing. No e-gift treated as fungible cash. No raw card data handled by Pet Wash DOM or backend.

---

## §1. Status and disclaimer

**This document is strategic synthesis ONLY. It is NOT:**

- ❌ Legal advice, tax advice, labour-law advice, PCI compliance attestation, insurance advice, or financial advice.
- ❌ A substitute for CPA / Counsel / Labor lawyer / Payments architect / Insurance broker / Bank / Vendor opinion in writing.
- ❌ A compliance claim. Pet Wash is not "compliant" because this document exists.
- ❌ A binding decision on any §10 / D9 / Q13-Q42 question. Specialists decide; this doc routes.

**This document IS:**

- ✅ Adversarial-review synthesis from a 4-seat council convened to find what is **wrong, missing, weak, or dangerous** in the platform's future financial processes — across all rails, all platforms, all decision classes.
- ✅ A deduplicated **authority registry** extending PR #220 §10 (Q1-Q12) and PR #224 D9 (Q13-Q18) with new Q19-Q42 from the council.
- ✅ A **ranked PR class queue** sequencing the future docs-only and runtime PRs that close the gaps the council identified.
- ✅ A **runtime firewall** restating which classes of work remain forbidden until written authority responses + PR #220 §9.2 readiness preconditions are satisfied.
- ✅ A **CEO action plan** ROI-ranked + calendar-aware for the operational steps only the CEO can take.

**Specialist confirmation is required before any runtime dependency on any item in this document.** Routing language ("CPA must confirm", "Counsel must classify", "Vendor must answer in writing") is not rhetorical — it is the structural firewall that prevents engineering or product from defaulting authority answers under deadline pressure.

---

## §2. Four council seats

The CEO convened four parallel adversarial reviewers on 2026-05-10. Each was instructed to find what is **wrong**, not to approve. Each had distinct domain authority and read the same doc set (Part 0, Part 2, forensic audit, sumit-upay-operating-model, vendor-discovery, octopus-brain-doctrine, wallet-redesign, israeli-compliance, marketplace-payouts, unified-payment-abstraction, execution-pr-roadmap).

| Seat | Role | Domain | Returned |
|---|---|---|---|
| **Seat 1** | CPA / Tax / Bookkeeping | Israeli VAT, withholding (ניכוי במקור), SHAAM allocation, fiscal-document chain, clearing-fee ledger, e-gift VAT treatment, bookkeeping handoff, F-104 correction path, חברה / עוסק מורשה / עוסק פטור flows, Forms 102/856/6111 | 1st |
| **Seat 2** | Counsel / Legal / Labor / Consumer / Privacy / AML | Subcontractor reclassification (Wolt-track), agent vs principal, חיוב ללא אובליגו, refund SLA, consumer disclosures, gift-card law, privacy law, AML/KYC, Payment Services Law 2023, חוק החברות director duties | 2nd |
| **Seat 3** | Payments Architect / PCI / Reconciliation | Webhook architecture, idempotency keys per rail, cross-rail saga, PCI scope per channel, settlement-timing reconciliation, ledger locking, fiscal-numbering enforcement, vendor migration, anomaly detection | 4th (out of order) |
| **Seat 4** | CFO / Risk / Insurance / Audit Defensibility | Cash flow per rail, trust-fund segregation, vendor concentration, insurance coverage map (D&O / cyber / provider injury / pet injury / property), capital reserves, investor DD readiness, regulator narrative | 3rd (out of order) |

The four seats produced separate reports independently. The cross-seat alignment in §3 indicates **multi-seat convergence** — items two or more seats independently flagged as P0, considered the highest-confidence findings.

---

## §3. Cross-seat P0 findings

Each item below was independently flagged by **2 or more of the four seats** as P0 (could expose CEO personally, could result in regulator action, could result in money-loss or silent corruption). Single-seat-unique findings appear in §4 / §5.

| # | Finding | Seats flagging | Authority class | Calendar |
|---|---|---|---|---|
| **A1** | **F-104 company-tax-ID exposure / false fiscal documents** — hard-coded `516788400` ≠ actual Pet Wash Ltd № `517145033` on every issued receipt. §220 false-statement criminal exposure compounds daily; theoretical max SHAAM penalty ₪5M-₪15M; voluntary disclosure (גילוי מרצון) window may be closing. CPA must select correction path: re-issue all + paired credit notes / corrective documents / fix-forward-only. | 1, 2, 4 | CPA + Counsel | URGENT — CPA call this week |
| **A2** | **Payment Services Law 2023 risk** — wallet, e-gift, escrow, refund-credit, recurring billing, payment-link, חיוב ללא אובליגו surfaces may fall within the Law's scope (חוק הסדרת העיסוק בשירותי תשלום וייזום תשלום, תשפ"ג–2023). Counsel must classify per surface. Capital-reserve estimate (Counsel-confirm; not authoritative): €20k-€125k equivalent. Regulator identity (per seat 2 research: Israel Securities Authority / רשות ני"ע) must be confirmed by Counsel in writing. **e-gift is open-loop** — redeemable at marketplace providers (separate legal persons), which re-enters scope vs closed-loop gift card. CEO PERSONAL LIABILITY for unlicensed payment services if classification adverse. | 2, 3, 4 | Counsel | Pre-runtime |
| **A3** | **Trust-account operationalisation gap** — Part 0.4.2 declares "REQUIRED: separate bank account" but no Israeli bank named, no relationship manager engaged. Calendar: 4-10 weeks. Bank may DECLINE if KYC flags marketplace = money services. If bank refuses, the entire Part 0.4 architecture collapses. Israeli banks (Mizrahi-Tefahot, Hapoalim, Leumi, Discount) typically require formal נאמנות structure with CPA-trustee or "סגור" labelled sub-account. Monthly fees ₪200-₪1,500 + per-tx ₪0.50-₪3.00 + recon labour ₪5-14k/month at v1. **§374 Companies Law director-liability for unlawful preference exposure if commingling occurs.** | 1, 2, 4 | Counsel + CPA + CFO | Start NOW (4-10 wk lead) |
| **A4** | **Self-billing under תקנה 6א unsafe as default** — Part 0.6.2.a treats self-billing as the recommended default, but תקנה 6א to תקנות מע"מ permits self-invoicing only in narrow reverse-charge cases (provider's primary income is salary/pension/allowance) and requires a written declaration from each provider. Pet Wash docs neither define nor collect this declaration. Every self-billed invoice issued under a misconceived 6א theory may be a FALSE FISCAL DOCUMENT under §220. ITA pre-ruling (החלטת מיסוי) recommended. | 1, 2 | CPA + Counsel + ITA | Pre-first-payout |
| **A5** | **CEO personal-liability / D&O tax-exclusion trap** — Israeli D&O typical premium ₪25-80k/yr for ₪5M-20M limit. **Almost every Israeli D&O excludes "חבויות מס"** — meaning §119, §119א, §164, §220 (PR #224 D11 L1, L1a, L2, L6) personal exposure may be EXCLUDED by default. Without negotiated tax-investigation defence-cost rider, single רשות המסים letter against CEO = ₪150-500k legal fees out of pocket before any tax is owed. Plus indemnification undertaking under חוק החברות §§259-260 must be filed. | 4 (unique but CRITICAL) | Insurance broker + Counsel | This week |
| **A6** | **e-gift open-loop / marketplace redemption risk** — Pet Wash e-gift is redeemable at marketplace providers (sitter, walker, groomer, transporter, academy instructor — separate legal persons). Per seat 2: this characterises the e-gift as **open-loop** (vs closed-loop gift card historically out of scope), which **re-enters Payment Services Law 2023 scope**. Mitigation direction (operating doctrine): UPay holds funds, never Pet Wash; Counsel must separately confirm whether the activity itself still requires licensing regardless of custody arrangement. | 2, 4 | Counsel + CPA | Pre-runtime |
| **A7** | **Academy instructor classification risk** — PR #224 D13 flagged academy as highest reclassification risk and gated separately. Seat 2 goes further: "academy contractor stance is NOT survivable as currently framed" — under post-Wolt analysis (ע"ע 14039-06-21 חזנוביץ' נ' Wolt, Aug 2022; 2025 Haifa "logged-in waiting time = work time" ruling; 2024 cleaner-reclassification with non-pecuniary damages), academy instructors have 5 of 7 מבחן המעורב factors pointing employee. **Default may need to be PAYROLL** unless Labor lawyer signs off in writing on a structurally different model (e.g. guest-lecturer < 20% curriculum control + no schedule + instructor-branded materials + no exclusivity). CEO PERSONAL EXPOSURE under חוק הגנת השכר §§ 25ב, 26א (PR #224 D11 L4, L5). | 2, 4 | Labor lawyer | Pre-first-academy-instructor |
| **A8** | **PCI boundary — card data never touching Pet Wash systems** — Pet Wash frontend AND backend must NEVER handle PAN / CVV / track / raw card numbers / custom card forms. Forbidden patterns (each subject to source-pin test in PR-PCI-1): any input field with name/id matching `card`/`pan`/`cvv`/`cvc`/`expir`; any backend log capturing `req.body` for a payment webhook without PAN deny-list; any frontend JS bridge reading from a UPay/Nayax iframe DOM (= SAQ scope explosion); any storage of full PAN. Tentative SAQ classification per channel (Security + Acquirer must confirm under Q15): K9000/Nayax = SAQ-P2PE or B-IP; UPay redirect = SAQ-A; UPay iframe = SAQ-A + PCI v4.0 req 6.4.3 + 11.6.1; Jini terminal = SAQ-B-IP or P2PE (verify Jini's PCI listing). CEO PERSONAL LIABILITY if breach + PCI scope misclaimed. | 2, 3 | Security + Acquirer | Pre-first-payment |

---

## §4. Deduplicated authority registry — Q19-Q42

Extends PR #220 §10 (Q1-Q12) and PR #224 D9 / PR #225 §11 (Q13-Q18). Owner-tagged. Status-tracked. Each question is a routing trigger that **specialists must answer in writing** before any runtime dependency on the item.

**Status legend:**

- 🔴 **Blocks runtime** — no production code may depend on the item until this question is answered in writing
- 🟡 **Specialist required** — must be answered before the relevant docs PR (per §5) is authored
- 🟢 **Open / parking** — flagged for completeness; not blocking immediate work

### CPA-owned

| # | Status | Question |
|---|---|---|
| Q19 | 🔴 | Self-billing 6א legal model + per-provider-tier applicability + ITA pre-ruling (החלטת מיסוי) confirmation |
| Q20 | 🔴 | Default withholding-rate matrix per provider tier when certificate is missing/expired (individual / contractor / חברה / non-resident) |
| Q21 | 🔴 | Form 102 / 856 / 6111 generation source: SUMIT-native or Pet Wash internal? End-to-end test before VAT period closes |
| Q22 | 🔴 | F-104 correction-path selection (re-issue all / corrective documents / fix-forward); voluntary-disclosure window confirmation |
| Q23 | 🟡 | VAT period of חשבון זיכוי when refund crosses VAT period (תקנה 23) |
| Q24 | 🟡 | Promo-funded VAT base (full pre-discount vs net vs platform-funded-third-party-consideration); pin with worked example |
| Q25 | 🔴 | Clearing-fee ledger PATTERN (the worked example, not just the principle of Q16) |
| Q26 | 🟡 | Cross-rail VAT timing matrix (e-gift→K9000, e-gift→marketplace, promo→either, refund-back across rails) |
| Q27 | 🟡 | Recurring-billing fiscal-document chain (subscription, prestige-pass) |
| Q28 | 🟡 | עוסק פטור annual-revenue cap monitoring + auto-flip workflow when provider crosses ~₪120K |
| Q29 | 🟡 | Hebrew-as-legal-version doctrine; English translations are courtesy only; canonical numbering attached to Hebrew |
| Q30 | 🟡 | WORM / immutable archival medium for fiscal documents (not just "Drive") |
| Q31 | 🔴 | Variance threshold above which payouts must be blocked (reconciliation discipline; auditor-expected stance) |

### Counsel-owned

| # | Status | Question |
|---|---|---|
| Q32 | 🔴 | Academy: payroll vs guest-lecturer model — Labor lawyer sign-off in writing before first academy-instructor onboarding |
| Q33 | 🔴 | Payment Services Law 2023 per-surface scope memo (8 surfaces: wallet.cash / wallet.gift_card_received / wallet.refund_credit / wallet.escrow_pending / recurring / payment links / חיוב ללא אובליגו / promo-conversion) — each in or out of scope; capital-reserve figure if any; regulator identity confirmed |
| Q34 | 🔴 | חיוב ללא אובליגו hold semantics: max duration, custody owner during hold, auto-release vs explicit cancel, checkout disclosure language |
| Q35 | 🔴 | תקנות הגנת הפרטיות (אבטחת מידע) 2017 classification level per database (provider PII, customer PII, pet medical records, payment metadata); breach-notification SLA; DPO designation; DSAR procedure |
| Q36 | 🟡 | GDPR Art. 3(2) applicability (tourist / expat customers); HubSpot DPA + cross-border transfer mechanism |
| Q37 | 🟡 | Consumer-protection officer (חוק הגנת הצרכן §22ג) designation: required at current scale? CEO-default vs named officer |
| Q38 | 🔴 | AML / KYC volume triggers (חוק איסור הלבנת הון 2000); KYC tiers; named compliance officer; SAR data-capture readiness |
| Q39 | 🔴 | Refund SLA per rail under חוק הגנת הצרכן + Distance-Sales Regulations + חוק כרטיסי חיוב; per-rail matrix |
| Q40 | 🟡 | Gift-card minimum lifetime (5 years per §14י); breakage stance; partial-redemption clock rule |
| Q41 | 🔴 | Israeli card-scheme chargeback deadlines per category (first-tier 7-14 days; representment 30 days — Counsel must confirm) |
| Q42 | 🟡 | Indemnification under חוק החברות §§259-260 + D&O exclusion review vs L1 / L1a / L2a tax-related items |

### Vendor / Payments-architect / Insurance-broker / Bank-owned

| # | Owner | Status | Question |
|---|---|---|---|
| Q-V18 | Vendor + CPA | 🔴 | Fiscal-numbering single-source confirmation — UPay does NOT mint fiscal documents in integrated mode (PR #221 §1.1 working assumption requires written vendor confirmation; V11 of vendor-call brief). Decision between Option A (vendor mints, Pet Wash references) and Option B (Pet Wash mints, vendor mirrors) — is Option B SHAAM-defensible? |
| Q-PA-1 | Payments architect | 🔴 | Webhook architecture: durable inbox / out-of-order delivery / late-event windows / replay protection / vendor event-sequence storage |
| Q-PA-2 | Payments architect + CPA | 🔴 | Idempotency-key closed table per rail event (marketplace charge / K9000 capture / refund / Masav / wallet top-up); collision rules; reuse-with-different-payload error semantics |
| Q-PA-3 | Payments architect | 🔴 | Cross-rail e-gift redemption saga ordering (allocate-local-txn-id → call SUMIT with idempotency-key → persist returned doc-no → mark fiscal_status=committed); compensation path on phase-2 timeout |
| Q-PA-4 | Payments architect + CPA | 🔴 | 4-way reconciliation algorithm: join keys per pair (settlement→ledger; ledger→SUMIT; SUMIT→bank; bank→settlement); tolerance per tier; priority order on disagreement |
| Q-IB-1 | Insurance broker + Counsel | 🔴 | D&O policy tax-exclusion review + defence-cost rider scope for tax-administrative proceedings (§119א path); cyber rider; provider-injury rider; business-interruption rider for UPay/SUMIT outage; pet-injury liability marketplace endorsement |
| Q-B-1 | CFO + Bank | 🔴 | Named primary trust-account bank + relationship manager engaged; named secondary-acquirer LOI (Cardcom / Pelecard / Tranzila as backup); calendar-aware (4-10 weeks bank lead time) |

**Summary:**

- 🔴 Blocks runtime: 18 questions
- 🟡 Specialist required: 13 questions
- 🟢 Open / parking: 0 (none yet — all routed)

**Total open authority questions across all docs: Q1-Q12 (PR #220 §10) + Q13-Q18 (PR #225 §11) + Q19-Q42 + Q-V18 + Q-PA-1..4 + Q-IB-1 + Q-B-1 = 35 questions, owner-tagged.** The CEO's job under PR #224 D5 + D18 is to route each question to the named specialist and ensure the answer lands in writing.

---

## §5. Ranked PR class queue

Tier-ranked sequencing of the docs-only and runtime PRs that close the gaps the council identified. Each PR is single-purpose, single-revert, and references the §10 / D9 / Q-numbers it answers.

**Tier rule:** no Tier-N+1 PR opens until all Tier-N PRs (in its dependency chain) are merged AND the relevant authority answers are in writing.

### Tier 0 — LAUNCH BLOCKERS (must land before any runtime activation)

| PR | Type | Closes | Authority unblocked |
|---|---|---|---|
| **PR-COUNCIL-AMENDMENTS-1** | docs | Q19-Q42 + Q-V18 + Q-PA-1..4 + Q-IB-1 + Q-B-1 | (this PR is the registration) |
| **PR-NUMBER-1** | docs | Pet Wash as original mint, SUMIT/UPay as foreign refs (A8 + B7 numbering trap) | Q-V18 |
| **PR-PCI-1** | docs | Card-data fence + Jini PCI-listing classification + CSP/SRI source-pin test (A8) | Q15 |
| **PR-WEBHOOK-1** | docs | Webhook reliability spec (durable inbox, ordering, replay) | Q-PA-1 |
| **PR-IDEM-1** | docs | Idempotency-key closed table per rail event | Q-PA-2 |
| **PR-CROSS-RAIL-1** | docs | E-gift redemption saga ordering + compensation paths | Q-PA-3 |
| **PR-RECON-1** | docs | 4-way reconciliation algorithm + variance escalation matrix | Q-PA-4 + Q31 |
| **PR-INFLIGHT-1** | docs | Cash-in-transit aging buckets per rail | (engineering invariant) |
| **PR-LOCK-1** | docs | Concurrent-write locking policy (advisory locks; SERIALIZABLE) | (engineering invariant) |

### Tier 1 — PRE-FIRST-PROVIDER (labour-classification + tax-status exposure)

| PR | Type | Closes | Authority unblocked |
|---|---|---|---|
| **PR-PMA-1** | docs | Provider Master Agreement clauses (substitution / refusal-right / non-exclusivity / provider-tools / own-insurance) | Counsel-drafted |
| **PR-G2-CHANNEL-MATRIX** | docs | Per-channel classification (academy = payroll default unless Labor-lawyer alternative — A7) | Q32 |
| **PR-SELFBILL-1** | docs | תקנה 6א declaration template + per-provider-tier applicability + annual refresh (A4) | Q19 |
| **PR-PART-0-6-CORRECTION** | docs | Corrects Part 0.6 self-billing default treatment based on Q19 answer | Q19 (depends) |
| **PR-MASAV-1** | docs | Withholding state machine + cert lifecycle + Forms 102/856/6111 generators (A4 + B5) | Q20 + Q21 |
| **PR-WITHHOLDING-1** | docs | Default-rate matrix when cert missing/expired; hard-block at expiry | Q20 (subset of PR-MASAV-1 if folded) |
| **PR-PROVIDER-TAX-1** | docs | Tax-status snapshot threading through Masav rows + Form 856 replay-from-snapshot | Q6 + Q30 |

### Tier 2 — PRE-FIRST-PAYMENT (regulatory + consumer-protection exposure)

| PR | Type | Closes | Authority unblocked |
|---|---|---|---|
| **PR-PSL-1** | docs | Payment Services Law 2023 per-surface scope memo + ISA (or other) regulator pre-ruling if borderline (A2 + A6) | Q33 |
| **PR-PRIVACY-1** | docs | תקנות אבטחת מידע 2017 classification per database + DPO + breach SLA + HubSpot SCCs | Q35 + Q36 |
| **PR-CHECKOUT-DISCLOSURE-1** | docs | 9-item checkout disclosure standard per Israeli consumer law (B4) | Q14 + Q39 |
| **PR-VAT-RATE-REFRESH-1** | docs | 17% → 18% across docs (post-Jan-2025); future 19% Jan-2026 watch | (factual update) |
| **PR-COMPLIANCE-DISPUTES-1** | docs | Chargeback / dispute lifecycle spec + evidence-pack standard + SLA timer (B3 + A8) | Q13 + Q41 |
| **PR-AUDIT-EXPORT-1** | docs | 5 SHAAM-auditor canned reports (gap-free invoice register; VAT recon; trust-account 90d tie-out; provider withholding ledger; credit-note lineage) | (engineering deliverable) |
| **PR-INSURANCE-1** | docs | Broker engagement + bound-policy spec + tax-defence-cost rider per A5 | Q-IB-1 + Q42 |
| **PR-VENDOR-RESILIENCE-1** | docs | Secondary-acquirer LOI + warm-sandbox spec | Q-B-1 |
| **PR-CASHFLOW-STRESS-1** | docs | Stress model (7/14/30-day UPay settlement freeze) + line-of-credit doctrine | (CFO-deliverable) |

### Tier 3 — PRE-FIRST-CHARGEBACK / OPERATIONAL HARDENING

| PR | Type | Closes | Authority unblocked |
|---|---|---|---|
| **PR-DEGRADE-1** | docs | Vendor-outage doctrine per rail × per station (must-queue / must-fail-fast / must-manual) | (engineering doctrine) |
| **PR-MASAV-FAIL-1** | docs | Bank-rejection state machine + closed enum reason-codes for Masav row failures | (engineering invariant) |
| **PR-K9000-ABORT-1** | docs | Mid-cycle wash-abort lineage station 8 wiring + Nayax reversal spec | (engineering invariant) |
| **PR-AML-1** | docs | Triggers + tiers + named compliance officer + SAR data-capture | Q38 |
| **PR-ANOMALY-1** | docs | Gemini false-positive doctrine + auto-deactivation of high-FPR rules | (engineering doctrine) |
| **PR-SUMIT-MIGRATE-1** | docs | Vendor-migration protocol (SUMIT → Invoice4u path; sequence reset on year boundary) | (depends on Q-V18 + Q18) |

### Tier P2 (improvement / deferrable)

- Minor doc cleanups; quarterly accountant-export auto-bundle; investor-DD pack pre-build; D&O quarterly review cadence.

---

## §6. Runtime firewall

**No live money code may run until ALL of the following are satisfied:**

1. **PR #220 §9.2 readiness preconditions** (six items):
   1. UPay account ACTIVATED.
   2. UPay API documentation OBTAINED.
   3. CPA confirms document of record (Q1).
   4. Sandbox / test flow VERIFIED end-to-end.
   5. Webhook + auth + security model REVIEWED.
   6. Reconciliation model APPROVED (4-way tie-out — Q-PA-4).

2. **Written authority answers** to ALL 🔴 (blocks runtime) items in §4 above. Specifically:
   - Q1, Q5, Q7, Q10, Q11, Q12 (existing PR #220 §10)
   - Q13, Q14, Q15, Q18 (PR #225 §11)
   - Q19, Q20, Q21, Q22, Q25, Q31 (this doc CPA-owned)
   - Q32, Q33, Q34, Q35, Q38, Q39, Q41 (this doc Counsel-owned)
   - Q-V18, Q-PA-1, Q-PA-2, Q-PA-3, Q-PA-4 (this doc Vendor / Payments architect)
   - Q-IB-1, Q-B-1 (this doc Insurance broker / Bank)

3. **PR #224 §9 forbidden-shortcut list** — all 22 items remain forbidden. No exceptions, no "just this once," no urgency override.

4. **PR #224 D17 no-temporary rule** — no temporary measure ships without owner / expiry / rollback / issue / approval.

If any of the above is not yet satisfied, the answer to "can we ship runtime?" is **no**.

The only work that may proceed in parallel is:

- Docs / spec PRs (Tiers 0-3 in §5).
- Non-financial product PRs (PR-PET-5 breed autocomplete; PR-PET-6 photo cropper; provider portal shell rendering `wired:false`; accessibility audit; mobile polish; luxury visual layer).
- CEO-side operational actions (§8 below).

---

## §7. Calendar-locked items

| Date | Item | Source |
|---|---|---|
| **2026-06-01** | SHAAM allocation-number threshold drops from > ₪10,000 ex-VAT to **> ₪5,000 ex-VAT** for tax invoices (חשבוניות ישראל). Pet Wash must have the allocation-number flow operational by this date OR enforce a hard-cap of ₪4,999.99 ex-VAT on any single invoice. Calendar non-negotiable; no postponement announced as of 2026-05-10. | PR #220 §8 + Q10 |
| **March 31 (annual)** | Annual ניכוי-במקור certificate refresh deadline. Every provider must present a current אישור ניכוי במקור valid for the tax year (typically valid Jan 1 – Mar 31 of the following year). Payouts to providers without a valid current certificate must default to the per-CPA-confirmed default rate (Q20) or be hard-blocked. | PR #220 §10 Q6 + this doc Q20 |
| **Immediate** | F-104 CPA remediation path selection (Q22). Voluntary-disclosure (גילוי מרצון) window may be closing per recent ITA notices; CPA call this week. Each day the wrong company tax ID `516788400` is on issued documents extends the §220 false-statement criminal-liability tail. | PR #220 §10 Q8 + this doc A1 + Q22 |
| **Pre-first-academy-instructor** | Labor-lawyer sign-off on academy classification stance (Q32). No academy onboarding ships pre-sign-off. | this doc A7 + Q32 |
| **Pre-bank-doc-submission to UPay** | Q12 trust-account decision must be answered in writing. KYC-2 submission to UPay must NOT happen before Q12 is resolved (per PR #221 §3 KYC checklist). Submitting the wrong account = structural compliance break that's hard to undo. | PR #220 §10 Q12 |

---

## §8. CEO action plan

ROI-ranked + calendar-aware. **Total all-in spend to close majority of personal-liability tail: < ₪100k.** That is less than one month of engineering payroll.

### THIS WEEK (highest ROI; CEO personal-liability protection first)

| # | Action | Cost | Closes |
|---|---|---|---|
| 1 | **Engage Israeli D&O broker** (Ayalon / Harel / Migdal / Clal). Bind ₪5-10M policy with EXPLICIT defence-cost coverage for tax-administrative proceedings (§119א — A5). | ₪30-50k/yr | A5 + Q-IB-1 |
| 2 | **CPA call.** Open written engagement letter scoping Q1, Q5, Q7, Q8, Q10, Q16, Q19-Q31. Voluntary-disclosure (גילוי מרצון) window status confirmed. Pick F-104 correction path (re-issue / corrective / fix-forward) in writing. | CPA fees | A1 + Q19-Q31 |
| 3 | **Counsel call.** Open written engagement scoping Q4, Q11, Q12, Q32-Q42. Specifically: Payment Services Law 2023 per-surface scope memo (Q33); regulator identity confirmed; capital-reserve figure if any. | ~₪15-30k legal | A2 + Q32-Q42 |
| 4 | **UPay vendor activation call** (PR #221 §2 brief — 11 V-questions verbatim). Get the written reply covering V1-V11 + activation paperwork list + SHAAM clarification + Jini pricing. | call only | unblocks readiness 1, 2 |

### NEXT 14 DAYS

| # | Action | Cost | Closes |
|---|---|---|---|
| 5 | **Trust-account discovery** at named Israeli bank (Mizrahi-Tefahot / Hapoalim / Leumi / Discount). 4-10 weeks calendar — start NOW. If bank refuses, you find out early not at launch. | ₪5-14k/month + ₪200-1500/month | A3 + Q12 + Q-B-1 |
| 6 | **Withholding-cert mass-refresh** before payout. Engineering query: every provider where `cert_expires_at < now()` OR cert is missing. Surface to CEO + CPA before next Masav batch. | engineering | A4 (partial) + Q20 |
| 7 | **F-104 correction execution begins** (per CPA path picked). Voluntary disclosure filed if applicable. | CPA labour ₪3-8/doc × ~10k docs = ₪30-80k if re-issue | A1 |

### NEXT 30 DAYS

| # | Action | Cost | Closes |
|---|---|---|---|
| 8 | **Sign LOI with secondary acquirer** (Cardcom / Pelecard / Tranzila as backup). Warm sandbox kept current. Shortens vendor-failure recovery from 12 weeks to 3-4. | LOI free; engineering sandbox time | Q-B-1 + A3 (partial) |
| 9 | **Cash-flow stress model** + secure ₪500k-₪1M revolving line of credit. Chargeback-rate dashboard with 0.5% alert. | bank arrangement fee | seat 4 B6 |
| 10 | **Bind cyber + pet-injury liability + business-interruption rider** before first marketplace booking. | ₪25-65k/yr combined | seat 4 C5 |

### NEXT 60 DAYS

| # | Action | Cost | Closes |
|---|---|---|---|
| 11 | **Counsel-drafted Provider Master Agreement** (every Part 0.5 row). Substitution + refusal-right + non-exclusivity + provider-tools + own-insurance + 6א declaration + tax-status capture. | ~₪30-60k legal | PR-PMA-1 + Q32 + Q19 |
| 12 | **Per-channel classification matrix (G2)** signed off by Labor lawyer. Academy stance decided in writing. | Labor lawyer fees | A7 + Q32 |
| 13 | **תקנות אבטחת מידע 2017 classification + DPO designation + breach SOP + HubSpot SCCs.** | privacy counsel fees | Q35 + Q36 |
| 14 | **PR-AUDIT-EXPORT-1 shipped** (5 SHAAM-auditor canned reports). | engineering 2 sprints | seat 4 C1 |
| 15 | **Pre-build investor-DD pack.** | low cost | seat 4 D4 |
| 16 | **Quarterly compliance-review minute cadence** — board-level resolution. Cheap. Load-bearing for §§259-260 indemnification defence. | board time | seat 4 D5 + Q42 |

### Operational hard-cap (immediate, until Q10 resolved)

**Hard-cap any single invoice at ₪4,999.99 ex-VAT** until SHAAM allocation-number flow is operational (Q10 + 2026-06-01 calendar lock). This protects against the threshold drop.

---

## §9. Authority hierarchy

Pet Wash decision-making authority, ranked. Higher rows override lower rows. No amendment to a higher row may be made silently.

| Rank | Authority class | Governs | Source |
|---|---|---|---|
| 1 | **CEO directives** | All explicit CEO instructions during a session OR durable instructions filed in repo docs | conversation transcript + repo |
| 2 | **Guardian gates** | Pre-code (Gate 1), Pre-commit (Gate 2), Pre-push (Gate 3); non-bypassable | `.claude/skills/petwash-pr-guardian/SKILL.md` |
| 3 | **Product / platform architecture rules** | Module boundaries, rail separation, ledger spine, vendor demotion, audit-log mandate | `.claude/skills/petwash-platform/SKILL.md` + PR #224 doctrine |
| 4 | **CPA / Counsel / Labor-lawyer / specialist approval boundaries** | Authority questions Q1-Q42 (and onwards); written specialist answer required before runtime dependency | PR #220 §10 + PR #224 D9 + PR #225 §11 + this doc §4 |
| 5 | **Runtime safety boundaries** | PR #220 §9 firewall (22 forbidden actions) + §9.2 readiness preconditions (six items) | PR #220 + PR #224 D8 |
| 6 | **Merge discipline** | One-purpose PR, single-revert, reversible changes, no hidden migrations | PR #224 D6 + §14 below |

**Conflict resolution:**

- A higher-row rule cannot be silently overridden by a lower-row rule.
- A CEO directive (rank 1) MAY override a Guardian gate ONLY by explicit written authorization that names the gate being relaxed; the relaxation must be filed in the PR's commit message.
- A CEO directive may NOT override a runtime-safety boundary or a specialist-approval boundary. Per PR #224 D1: *"the immune system must still work when shortcut pressure comes from the CEO."*

---

## §10. AI may / AI may not matrix

Restates and consolidates the AI-governance rules across PR #214 (HubSpot Master Operating System), PR #224 D5.1, and the petwash-platform skill §3. AI / Gemini coworker agents are **analysts, never executives**.

### AI MAY:

- **Audit** — read code, docs, ledger, audit-log, vendor-event stream; produce findings.
- **Map** — produce dependency maps, cross-reference indices, schema diagrams, vendor call-graphs.
- **Summarize** — synthesize ledger state, transaction history, support tickets, ops anomalies.
- **Propose** — suggest admin actions, surface risk flags, recommend doctrinal amendments, draft text for human review.
- **Detect risk** — anomaly detection (chargeback spikes, station outage clusters, unusual booking volume), pattern matching, draft incident reports.

### AI MAY NOT:

- **Approve payments.** Releasing money requires a human admin click that writes to the audit log.
- **Approve payouts.** Same rule.
- **Approve refunds or credit-notes.** Issuing a חשבון זיכוי requires a human-approved decision and a ledger entry recorded by an admin.
- **Approve invoice issuance.** Minting a חשבונית מס requires a human-approved decision; document numbers may not be claimed by AI.
- **Approve provider activation.** KYC, license verification, contractor classification, payout eligibility — all human decisions.
- **Approve legal obligations.** Contracts, terms-of-service amendments, consent collection, settlement agreements — all human decisions.
- **Approve municipal commitments.** Permits, leases, regulatory filings, business-licence renewals — all human decisions.
- **Approve accounting truth.** Ledger entries, period closes, P&L recognition decisions, VAT-period attributions — all bound by Part 2 / SUMIT / CPA.
- **Approve production deletions.** Provider records, customer records, pet records, ledger entries, audit-log entries — never. Rectification = reversing entry, never deletion.
- **Edit, redact, or hide audit-log entries.**
- **Hide logs from admin view.**

The rule pattern: **AI populates UI, humans populate audit log.** If a future code path lets AI's suggestion alone cause a state-change consequence, the code path is wrong.

---

## §11. Mandatory source-of-truth registry

Five canonical authority boundaries that must remain stable across vendor changes, doctrine amendments, and runtime evolution. Each row names what is the source of truth, what is a mirror or derived view, and what is a vendor-side reflection.

| Domain | Source of truth | Mirror / derived | Vendor reflection |
|---|---|---|---|
| **Operational truth** (bookings, sessions, customers, providers, pets, schedules, state) | **Pet Wash internal database / application** | HubSpot CRM (mirror per PR #214); admin dashboards (derived); ops tools (derived) | UPay transaction log; SUMIT customer records (vendor-side mirror only) |
| **HubSpot mirror role** | **CRM-side mirror only** — HubSpot is NEVER the source of customer / provider / pet facts; Pet Wash DB is | webhooks from Pet Wash → HubSpot one-way preferred | n/a |
| **Nayax / K9000 machine authority boundary** | **Nayax** for card auth + settlement file; **K9000 hardware controller** for session activation + abort | Pet Wash internal ledger writes a `cash_in_transit_nayax` ledger pair on capture; reconciles against Nayax settlement file | Nayax dashboard is vendor-side; never authoritative for our books |
| **Accounting / export boundary** | **SUMIT** for fiscal documents (per Q1 working assumption pending CPA confirmation); **Pet Wash internal ledger** (Part 2) for the immutable money spine | quarterly accountant export bundle (derived); Form 102 / 856 / 6111 generators (derived) | Invoice4u remains a swappable alternative to SUMIT (PR #221 §1.1) |
| **Wallet ledger authority** | **Pet Wash internal ledger** (Part 2 + `02-wallet-redesign.md` bucket model: `wallet.cash` / `wallet.gift_card_received` / `wallet.refund_credit` / `wallet.escrow_pending` + future `wallet.promo_credit` per Q9) | UI wallet display (derived; always bucket-attributed per PR #224 D8 + reviewer-letter §10 #6); admin wallet tools (derived) | UPay does NOT store Pet Wash wallet balances. If it did, that would be vendor-lock-in (Q-V18) |
| **Audit chain** | **`audit_events` table** (petwash-platform skill §2 mandate) | admin audit-viewer (derived); regulator / auditor export (derived per PR-AUDIT-EXPORT-1) | n/a — audit chain is internal-only |

These rows are not exhaustive but they are **load-bearing**. Any future PR that conflicts with one — by treating HubSpot as source-of-customer-truth, or by storing wallet balances at UPay, or by allowing AI to mutate the audit chain — is wrong, regardless of how convenient the violation looks.

---

## §12. PR classification registry

Every PR opens in exactly **one** of the seven classes below. Class determines review burden, runtime-safety expectations, rollback shape, and approval chain.

| Class | What it is | Review focus | Examples |
|---|---|---|---|
| **docs-only** | New / amended documentation; zero code, schema, env, package, test, runtime change | Scope discipline; no code drift; no compliance claims | PR #220, #221, #222, #224, #225, this PR |
| **read-only discovery** | Audit pins, source-pin tests, regression tests that verify invariants but mutate nothing | Test correctness; no false positives that block legit work | PR #216 PR-PET-1 (audit pins) |
| **feature-flag UI** | New customer or provider UI surface, default flag OFF, no backend persistence beyond pre-existing safe fields | UX correctness; mobile / iPhone Safari / RTL; flag honoured; rollback = single revert | PR #219 PR-PET-4 (onboarding shell) |
| **runtime-safe backend** | Backend logic, no money mutation, no schema migration; idempotency-key + audit-log mandates apply | Idempotency; audit-log; no money path; no schema | (future PR-AUDIT-EXPORT-1) |
| **finance-sensitive** | Touches wallet / ledger / payout / invoice / refund / fiscal-document / VAT / withholding code paths | Money invariant preservation; PR #220 §9.2 readiness; specialist sign-off; ledger entries; audit chain; reconciliation | (future PR-MASAV-1 runtime, PR-UPAY-1 runtime — NOT YET) |
| **legal / CPA dependent** | Requires CPA / Counsel / Labor-lawyer / Privacy-counsel written answer before authoring or before merge | Authority routing; written answer attached to PR; specialist named in PR description | (future PR-PMA-1, PR-SELFBILL-1, PR-PSL-1) |
| **destructive / removal PR** | Deletes code, removes a vendor, drops a schema column, retires a route, removes a feature | Dependency map BEFORE removal; no orphan state; explicit migration plan; rollback explicit | (future PR-TRANZILA-RETIREMENT-1 — gated on full vendor map) |

Each PR's title and description must declare its class. Reviewer applies the class-specific checks. **Mixed-class PRs are rejected on principle** (one-purpose discipline — PR #224 D6).

---

## §13. Stop-and-report triggers

The agent must STOP work and surface the situation to the CEO in a ONE-BOX report when ANY of the following is detected — **even if the CEO directive in the current session would otherwise authorize proceeding**. The trigger is doctrinal: the agent's risk assessment takes precedence over apparent authorization velocity.

| # | Trigger | Why it stops |
|---|---|---|
| 1 | **Overlapping file risk** — two PRs in flight modifying the same file | Merge conflict; one PR silently undoes the other's intent; reviewer cannot validate |
| 2 | **Duplicate architecture** — proposing a new abstraction that already exists under a different name | Drift; future engineers cannot find the canonical implementation; doctrine fragmentation |
| 3 | **Payment / accounting scope creep** — PR began in product stream, now touches money / wallet / ledger / fiscal-document path | Single-purpose discipline broken; review burden mismatch; specialist approval missing |
| 4 | **Schema drift** — PR adds a column / changes a type / renames a field that touches money or financial data | Migration path required; data-correctness invariant at risk; CPA approval triggered |
| 5 | **Source-of-truth ambiguity** — PR makes a write to a system that is supposed to be a mirror, OR a read from a system that is supposed to be authoritative-but-stale | §11 boundary violated; canonical truth diverges; reconciliation broken |
| 6 | **Hidden runtime side effects** — PR claims docs-only or feature-flag-only but introduces an active code path, an env-default change, a webhook listener, or a cron that runs without explicit gating | Firewall bypassed; CEO authorization premise wrong |
| 7 | **Authority answer drift** — a specialist answer (CPA / Counsel / Labor lawyer) referenced in the PR has changed materially since it was filed, or was never filed in writing in the first place | Doctrine invalidated; PR no longer well-founded |
| 8 | **Calendar-locked deadline at risk** — a PR that depends on a calendar-locked authority answer (e.g. 2026-06-01 SHAAM threshold) is at risk of merging after the deadline without the authority answer in place | Operational hard-cap must be enforced first |

**On detection:** the agent stops, emits a stop-and-report block in ONE BOX (per CEO durable preference), names the trigger, references the relevant doctrine row, and waits for explicit CEO directive. The agent does NOT proceed by reasoning around the trigger.

---

## §14. Merge discipline

Operational rules for merging any PR into `main`. These are restatements + extensions of PR #224 D6 + Guardian Gate 3.

| Rule | Statement |
|---|---|
| **One-purpose PR** | Each PR has exactly one stated purpose; one-line title under 70 characters; no "and"; mixed-purpose PRs are rejected |
| **Reversible changes** | Single `git revert` undoes the PR cleanly; no orphan database state; no orphan vendor-side state; no orphan documents |
| **Dependency mapping before deletions** | Any destructive / removal PR (per §12) maps every consumer of the removed item BEFORE the deletion is staged; map filed in the PR description |
| **No finance cutover without audit map** | A finance-sensitive runtime PR (per §12) does not merge until: (a) every reference of the affected vendor / column / route is mapped; (b) the migration plan is filed; (c) CPA / Counsel sign-off (per §4) is in writing; (d) PR #220 §9.2 readiness is satisfied |
| **No hidden migrations** | A PR that touches the schema declares the migration plan in the description; a PR that does not touch the schema and contains no migration code MUST NOT execute a migration as a side effect of merge |
| **Rollback explicit** | Every PR's description states the rollback procedure (typically "single git revert") in one line; PRs without a rollback statement are rejected |
| **Authority answers attached** | A legal / CPA-dependent PR (per §12) attaches the specialist's written answer (or links to the issue / file where it is stored) in the PR description |
| **No pre-merge state changes** | The PR's branch does NOT mutate production state, does NOT call vendor APIs in non-sandbox, does NOT run a schema migration in CI against production data |

---

## §15. What this doc does NOT do

- It does **not** modify any code.
- It does **not** modify any schema.
- It does **not** modify any env / config / package / lockfile.
- It does **not** modify any test file.
- It does **not** modify any existing doc — explicitly: Part 0, Part 2, forensic audit, sumit-upay-operating-model, vendor-discovery, octopus-brain-doctrine, wallet-redesign, israeli-compliance, marketplace-payouts, unified-payment-abstraction, execution-pr-roadmap, finance-review-blind-spots-and-authority-questions, HubSpot Master Operating System.
- It does **not** edit `docs/architecture/execution-pr-roadmap.md` to register the future PR classes named in §5. Registry edits are a separate follow-up PR.
- It does **not** decide any §10 / D9 / Q13-Q42 question. It frames them; specialists decide.
- It does **not** authorise any production payment activation, any Stripe / Tranzila deletion, any provider payout, any invoice / credit-note issuance, any חיוב ללא אובליגו booking-hold flow, any UPay account activation, any Jini procurement, any wallet automation, any refund automation.
- It does **not** start any of the future PR classes (PR-NUMBER-1, PR-PCI-1, PR-WEBHOOK-1, PR-IDEM-1, PR-CROSS-RAIL-1, PR-RECON-1, PR-INFLIGHT-1, PR-LOCK-1, PR-PMA-1, PR-G2-CHANNEL-MATRIX, PR-SELFBILL-1, PR-PART-0-6-CORRECTION, PR-MASAV-1, PR-PROVIDER-TAX-1, PR-PSL-1, PR-PRIVACY-1, PR-CHECKOUT-DISCLOSURE-1, PR-VAT-RATE-REFRESH-1, PR-COMPLIANCE-DISPUTES-1, PR-AUDIT-EXPORT-1, PR-INSURANCE-1, PR-VENDOR-RESILIENCE-1, PR-CASHFLOW-STRESS-1, PR-DEGRADE-1, PR-MASAV-FAIL-1, PR-K9000-ABORT-1, PR-AML-1, PR-ANOMALY-1, PR-SUMIT-MIGRATE-1).
- It does **not** mix with PR-PET-5. The next non-financial product PR (PR-PET-5 breed autocomplete UX) is a SEPARATE branch and a SEPARATE PR.
- It is **not** legal advice. Specialists advise.

---

## §16. Rollback

Single `git revert` of the merge commit. Doc removed. No follow-up cleanup. No code, schema, env, config, test touched. The 24+ new authority questions remain documented in this PR's history; if reverted, they still exist in the discussion record but lose their canonical home in the repo.

---

## Framing reminder (do not lose at any future amendment)

This doc is **strategic synthesis, not legal advice**. Statutes referenced are **risk-vectors and routing triggers**, not final legal conclusions. Every legal / tax / labour / payment-services / privacy / AML / insurance point requires CPA / Counsel / Labor lawyer / Privacy counsel / Insurance broker / Bank / Vendor / Security confirmation in writing before runtime dependency. No compliance claims are made. Pet Wash is not "compliant" because this doc exists; it is more **defensible** if specialists then answer the routed questions.

— end of document —
