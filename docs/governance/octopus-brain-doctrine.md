# Octopus Brain Doctrine — Pet Wash Ltd Governance Meta-Doc

**Status:** DRAFT v1 — META. Approved direction by CEO 2026-05-10. Every other governance doc inherits from this one.

**Owner:** CEO. Co-readers: Counsel, Labor lawyer, CPA, Israeli tax advisor, CFO, Engineering lead, Insurance broker, future agents.

**Authored:** 2026-05-10. Branch: `claude/docs-governance-octopus-brain-doctrine` off post-#222 main.

**Scope:** Governance doctrine ONLY. No code. No runtime. No finance wiring. No schema. No vendor activation. This doc captures the **rulebook** that makes all other docs — Part 0 (platform role model), Part 2 (money objects), the forensic audit, the SUMIT/UPay operating model, the vendor-discovery doc, the wallet redesign — safe to act on without re-arguing the meta-rules each time.

**This doc is NOT:**

- ❌ Legal advice. It does not opine on whether any specific Israeli law applies; it routes such questions to specialists (CPA / Counsel / Labor lawyer / Insurance broker).
- ❌ Legal conclusions. It identifies risk vectors and the authority that must classify them, without pre-deciding the classification.
- ❌ Operational implementation. It does not change how any code runs.
- ❌ Pseudo-regulatory certification. Pet Wash is not "compliant" because this doc exists; it is more **defensible** if specialists then answer the routed questions.
- ❌ Marketing language. No "we are compliant" claims.

**This doc IS:**

- ✅ Governance doctrine — the durable rules that constrain every future PR.
- ✅ Exposure mapping — what risks exist and where they land.
- ✅ Responsibility routing — who decides what, and what they must answer in writing.
- ✅ Decision classification — architecture decisions vs authority decisions.
- ✅ Architectural boundaries — rails, ledger, lineage, audit chain.
- ✅ Sign-off requirements — per decision class.
- ✅ Escalation doctrine — what to do when the immune system detects a violation.

**Hard rule (restated):** No live SUMIT API call. No live UPay API call. No automated invoice issuance. No automated refund. No automated provider payout. No wallet automation. No Stripe / Tranzila deletion. No K9000-and-marketplace money mixing. No e-gift treated as fungible cash. No raw card data handled by Pet Wash DOM or backend. No production export of provider Israeli ID, bank account, customer PII, or pet medical records outside an explicitly-approved data-flow path.

---

## Table of contents

| § | Section | Purpose |
|---|---|---|
| 0 | Why this doc exists | Frame the doctrine within the existing finance/architecture series |
| — | Core principle | Architecture decisions vs Authority decisions |
| D1 | Immune system vs CEO pressure | The discipline must work under shortcut pressure, including from the CEO |
| D2 | Vendor demotion | UPay/SUMIT/Nayax/Tranzila/Stripe/Invoice4u/HubSpot are rails, not the system |
| D3 | Ledger as cross-rail bus | Rails never call each other directly; cross-rail goes through the ledger |
| D4 | Architecture vs authority decisions | Don't use architecture debate to avoid authority routing |
| D5 | CEO role clarity | Structure / isolate / ask / document / gate / sequence — route specialists |
| D6 | Roadmap as infrastructure | The PR class registry is load-bearing architecture |
| D7 | Product stream vs finance stream | Velocity ≠ contamination |
| D8 | Forbidden shortcuts | The 21-item live block-list |
| D9 | Authority questions Q1-Q18 | The pending CPA / Counsel / specialist registry |
| D10 | Reviewer checklist (21 questions) | What every future finance/wallet/payment/payout/CRM PR must answer |
| D11 | CEO personal-liability risk map | Statute-by-statute exposure routing (NOT legal conclusions) |
| D12 | Payment Services Law 2023 firewall | Customer-fund custody creates licensing risk; counsel must classify |
| D13 | Per-channel classification gating | Academy = highest reclassification risk; gated separately |
| D14 | Provider-language risk | Avoid employment-coded UX strings unless labor counsel approves |
| D15 | Insurance authority routing | D&O, cyber, provider injury, pet injury, property, exclusions |
| D16 | Manual-fallback discipline | No manual money mutation outside ledger/audit evidence |
| D17 | No-temporary rule | Owner, expiry, rollback, issue, approval — for any temporary measure |
| D18 | Sign-off chain | Per decision class: who signs off in writing |
| D19 | Single-source-of-truth inventory | The identifiers + records that must have one canonical owner each |
| — | Acceptance criteria | What this PR commits to (and what it does not) |
| — | Future-PR reviewer checklist | The questions every reviewer must verify |
| — | Recommended next sequence | What comes after this PR |
| — | What this doc does NOT do | Negative scope, explicit |

---

## 0. Why this doc exists

The platform has reached a point where the roadmap itself has become part of the infrastructure. The PR classes, gates, dependency chains, rollback requirements, CPA/Counsel questions, vendor-readiness blockers, and out-of-scope definitions are now load-bearing architecture, not optional planning.

This doc fixes the **principles** that govern those load-bearing items. Every sub-doctrine is a tentacle obeying these principles. If any future agent — or future CEO, or future engineer — proposes a change that contradicts a principle here, the answer is: **refuse, surface, point at the principle, do not interpret urgency as approval.**

---

## Core principle — Architecture decisions vs Authority decisions

These are different classes of decision. Conflating them is the single most common cause of dangerous shortcuts.

| Architecture decision | Authority decision |
|---|---|
| How should the system be structured? | Who is legally, professionally, operationally, or commercially allowed to decide this? |
| Made by: engineering, product, CEO, platform reviewer, governance docs. | Made by: CPA, Israeli tax advisor, Counsel, Labor lawyer, payment vendor, security reviewer, operations, bank, regulator (where applicable). |
| Examples: K9000 rail isolated; HubSpot is a mirror; e-gift is its own bucket; ledger is append-only; rails never call each other; vendor code lives behind adapters; PRs are single-purpose; runtime needs rollback. | Examples: who is document of record (SUMIT or UPay)? who issues חשבון זיכוי? is self-billing allowed? what is VAT timing for e-gift? is a trust account required? does חיוב ללא אובליגו support legal booking holds? what are refund SLAs under Israeli consumer law? what withholding applies to each provider? is SHAAM allocation handled by SUMIT, Pet Wash, or manual? what bank account goes to UPay? |

**The rule:** the platform has already made major architecture progress (rail separation, lineage, internal ledger doctrine, marketplace vs kiosk separation, e-gift separation, provider payout separation, vendor role separation, CRM mirror vs source-of-truth separation, docs-before-runtime governance, feature-flag discipline, single-purpose PR discipline). What remains in the finance/payment track is mostly **authority routing**. Do not keep re-arguing architecture when the blocker is an unanswered CPA, Counsel, vendor, security, or operations question.

---

## D1. Immune system vs CEO pressure

**Rule:** the immune system must still work when shortcut pressure comes from the CEO.

If any future directive — from anyone, including the CEO — violates the Guardian gates, PR #220 §9 firewall, PR #220 §9.2 readiness preconditions, Issue #223 finance/compliance gates, CPA/Counsel/vendor blockers, payment runtime restrictions, the PCI boundary, the raw-card-data prohibition, the K9000/marketplace money separation, the e-gift/wallet/promo separation, the no-runtime-before-spec rule — then the correct response is:

1. **Refuse** the shortcut.
2. **Surface** the violation.
3. **Point** at the blocking doctrine.
4. **Do not** interpret urgency as approval.

Real-world examples. If launch revenue is at stake and someone says:

- *"Just connect Tranzila one more time"*
- *"Just activate UPay now"*
- *"Just issue invoices from the backend"*
- *"Just refund into wallet only"*
- *"Just store the card"*
- *"Just mix e-gift with wallet balance"*
- *"Just pay providers manually and fix later"*

…the answer is: **No. The firewall applies.**

The immune system is only real if it works under pressure. Most platforms build it after the first tax audit, the first chargeback wave, the first duplicate payout, the first investor due-diligence problem, the first provider dispute, the first customer refund complaint, the first legal letter. Pet Wash is building it before. That is the point.

---

## D2. Vendor demotion

**Rule:** vendors are rails. Vendors are not the system.

This applies to UPay, SUMIT, Nayax, Tranzila, Stripe, Invoice4u, HubSpot, future payment providers, future bookkeeping platforms, future CRM platforms, future kiosk providers. They are replaceable rails, adapters, mirrors, or execution tools.

The Pet Wash system is:

- ledger
- lineage
- reconciliation
- state machine
- audit chain
- PR governance
- domain boundaries
- canonical IDs
- source-of-truth rules
- authority-routing rules

Vendor-specific code lives ONLY in adapter / connector / mapping files, vendor-specific docs, and approved integration-boundary files. Any vendor-specific reference outside an approved boundary is a code-smell and must trigger review.

| Good | Bad |
|---|---|
| `server/integrations/upay/*` | Booking route directly calls UPay |
| `server/integrations/sumit/*` | Wallet route directly calls SUMIT |
| `docs/finance/sumit-upay-operating-model.md` | K9000 route directly mutates marketplace payout |
| `docs/finance/sumit-upay-vendor-discovery-and-rail-architecture.md` | Provider payout route directly depends on Nayax |
| | UI page collects raw card details |
| | Invoice numbering generated in multiple unrelated places |

**Pet Wash must be vendor-integrated, not vendor-dependent.** A good architecture allows UPay to be replaced by another acquirer, SUMIT by Invoice4u, Tranzila to be retired safely, Nayax to remain machine-specific, HubSpot to remain a CRM mirror, and the internal ledger to remain the truth. The vendor can change. The ledger, lineage, reconciliation, audit chain, and state machine must survive.

---

## D3. Ledger as cross-rail bus

**Rule:** rails must never call or mutate each other directly. All cross-rail movement passes through the internal ledger as the event bus and audit spine.

The seven-rail model (locked in PR #221):

1. **K9000 / Nayax rail** — direct infrastructure commerce.
2. **Marketplace rail** — escrow / provider economy.
3. **E-gift rail** — deferred obligation to customer (NOT provider wallet, NOT promo credit, NOT fungible cash).
4. **Promo rail** — marketing-incentive system (NOT e-gift, NOT cash).
5. **Internal ledger rail** — immutable reconciliation truth (the crown jewel).
6. **SUMIT rail** — accounting / fiscal compliance authority, pending CPA confirmation.
7. **UPay rail** — payment execution rail, pending vendor activation and CPA confirmation.

These rails must not directly mutate each other. K9000/Nayax must not mutate marketplace/provider payout balances. Marketplace must not mutate kiosk session state directly. E-gift must not behave as provider wallet. Promo must not become cash. SUMIT/UPay/Nayax emit or receive reconciled events but do not become the operational truth.

Cross-rail effects must happen through:

- immutable ledger entry
- idempotency key
- financial-lineage reference (PR #221 §5: source → authorize → capture → ledger → fiscal → settlement → reconcile → refund/reversal → archive)
- audit event
- reconciliation job
- approved state transition

This is what prevents double refunds, phantom balances, mixed liabilities, impossible audits, provider payout disputes, VAT confusion, duplicate credit-note chains, e-gift misuse, loyalty-points-becoming-money accidents, and vendor lock-in through numbering.

---

## D4. Architecture decisions vs authority decisions

**Rule:** do not use architecture debate to avoid authority routing.

Architecture decisions are the engineering questions in the table at the top of this doc. Authority decisions are CPA / Counsel / Labor-lawyer / vendor / security / ops / bank questions. If the answer requires a specialist, **do not guess**. Route it. Document the answer in writing. Only then build.

This rule is doctrinal because the most common failure mode for Israeli marketplaces is engineering picking a default for an authority question under launch pressure, then discovering at audit that the default was wrong and is now baked into hundreds of issued documents. The cost of routing-then-waiting is always less than the cost of running-then-correcting.

---

## D5. CEO role clarity

**Rule:** the CEO's job is to structure, isolate, ask, document, gate, sequence, and route specialist decisions to specialists.

The CEO does not need to become a CPA, tax lawyer, PCI expert, payments regulator, engineer, acquirer specialist, Israeli VAT authority, or cybersecurity auditor.

The CEO must:

- recognise when a problem belongs to a specialist
- ask the correct question
- get the answer in writing
- store the answer in the correct doc
- prevent runtime before the answer exists
- keep product and finance streams separated
- stop shortcut pressure from bypassing gates
- ensure one PR equals one risk
- keep vendor systems demoted to rails

The precise frame is **not** *"I am not smart enough"*. The precise frame is *"I am not the specialist for this question, so I must route it to the right authority."*

The CEO owns the routing and the discipline, not every specialist answer.

### D5.1 — AI / Gemini governance (sub-rule)

AI / Gemini coworker agents are **analysts, never executives**. AI may surface anomalies, draft text, suggest actions, summarize ledger state, recommend risk flags. Every consequential change requires a **human admin click** that writes to the audit log. The AI suggestion alone is never approval. AI never releases money, issues refunds, triggers payouts, approves or rejects providers, bans users, edits or deletes audit log entries, or hides logs from admin view. This rule is restated from PR #214 (HubSpot Master Operating System) so future agents cannot interpret silence as a relaxation.

---

## D6. Roadmap as infrastructure

**Rule:** the roadmap itself is infrastructure. PR classes, gates, dependencies, rollback rules, out-of-scope definitions, readiness blockers, CPA/Counsel/vendor questions are load-bearing — not optional planning notes.

This means:

- every future PR slots into a named class
- every PR has one purpose
- every PR has explicit out-of-scope
- runtime PRs must reference their governing docs
- docs PRs must not silently authorize runtime
- rollback must be known before merge
- dependencies must be visible before work starts
- CPA / Counsel / vendor blockers must be written down
- forensic-audit findings must map to PR classes
- no issue is allowed to live only in chat memory

The roadmap is treated like code. If a future PR bypasses roadmap rules, it is not just bad process — it is **architecture drift**.

---

## D7. Product stream vs finance stream

**Rule:** product velocity must remain isolated from financial-authority work.

| Product stream | Finance stream |
|---|---|
| pet onboarding shell | SUMIT object mapping |
| breed autocomplete | UPay activation |
| Pet ID card UI | Masav payout spec |
| photo cropper | refund lifecycle |
| profile empty states | credit-note issuance |
| luxury onboarding UX | SHAAM allocation number |
| multilingual UI strings | provider withholding |
| provider-safe pet summary | e-gift redemption |
| | wallet bucket rules |
| | PCI boundary |

These streams must not contaminate each other. Product PRs must not introduce payment, wallet, invoice, payout, refund, provider-settlement, UPay/SUMIT/Nayax runtime, or raw-card handling. Finance PRs must not sneak in UX redesign, onboarding changes, provider activation changes, CRM runtime changes, or feature launches. This separation lets the company keep moving product-side without creating financial chaos.

---

## D8. Forbidden shortcuts (live block-list)

Until CPA, Counsel, vendor, sandbox, security, and reconciliation gates are satisfied **in writing**, the following remain forbidden:

1. No live SUMIT API call.
2. No live UPay API call.
3. No automated invoice issuance.
4. No automated refund.
5. No automated credit-note issuance.
6. No automated provider payout.
7. No wallet automation.
8. No Stripe deletion.
9. No Tranzila deletion.
10. No booking-hold runtime activation (חיוב ללא אובליגו).
11. No K9000-and-marketplace money mixing.
12. No e-gift treated as fungible cash.
13. No promo credit treated as e-gift.
14. No loyalty points treated as money without CPA / Counsel answer.
15. No fiscal-document numbering from more than one authority (single-source).
16. No raw card data handled by Pet Wash frontend.
17. No raw card data handled by Pet Wash backend.
18. No manual admin refund without idempotency design.
19. No provider self-billing without provider-agreement clause AND CPA + Counsel authorisation per the narrow exceptions of תקנה 6א לתקנות מע"מ.
20. No UPay bank docs submitted until trust-account question is answered (PR #220 §10 Q12).
21. No runtime use of vendor assumptions that are not confirmed in writing.
22. **No production export of provider Israeli ID, bank account, customer PII, or pet medical records outside an explicitly-approved data-flow path.** Privacy doctrine pending PR-PRIVACY-1.

If any directive conflicts with this list, stop and report.

---

## D9. Current authority questions

The current finance + governance architecture requires **written answers** to these questions before runtime payment work or any provider activation that depends on the answer.

### From PR #220 §10

| # | Owner | Question |
|---|---|---|
| Q1 | CPA | Document of record: SUMIT or UPay? |
| Q2 | CPA | Credit-note issuer on refund. |
| Q3 | CPA | Refund money path on e-gift redemption. |
| Q4 | Counsel | חיוב ללא אובליגו legal status for booking holds. |
| Q5 | CPA + Counsel | Self-billing vs provider-issued service invoice. |
| Q6 | CPA | Provider tax-status documentation: עוסק מורשה / עוסק פטור / חברה. |
| Q7 | CPA | VAT timing for stored-value / deferred-obligation flows. |
| Q8 | CPA | Correction path for historical receipts under hard-coded `516788400` ≠ actual `517145033` (forensic-audit finding F-104). Re-issue, corrective document, or fix-forward-only. |
| Q9 | CPA + Engineering | Promo-credit bucket naming and treatment. |
| Q10 | CPA | SHAAM allocation-number ownership. **Calendar-locked: threshold drops to ₪5,000 ex-VAT on 2026-06-01.** |
| Q11 | Counsel | **Direct customer relationship classification: principal vs agent vs marketplace facilitator.** Different VAT base, different invoice flow, different liability stance. |
| Q12 | Counsel | Trust-account requirement at SUMIT/UPay onboarding. |

### Added by Issue #223 + reviewer letter

| # | Owner | Question |
|---|---|---|
| Q13 | Counsel | Chargeback / dispute lifecycle, timelines, evidence duties, dispute-fee treatment under Israeli charge-card law. |
| Q14 | Counsel | Consumer-protection refund SLA per rail and required checkout disclosures (חוק הגנת הצרכן). |
| Q15 | Security / PCI | Card-data boundary and PCI-DSS scope. Confirm hosted-checkout / redirect / tokenization only. SAQ level (A / A-EP / B-IP / D / P2PE) per channel. |
| Q16 | CPA | Clearing-fee ledger treatment and VAT-input treatment for UPay monthly invoice. |
| Q17 | CPA + Counsel | Loyalty points: not-money vs money-like redemption event. |
| Q18 | Vendor + CPA | Fiscal-numbering lock-in risk. Confirm one numbering authority only. |

These questions are not optional. They are blockers for runtime.

---

## D10. Reviewer checklist — what every future finance PR must answer

Every future finance, wallet, payment, provider-payout, refund, invoice, CRM-runtime, K9000/Nayax, or marketplace state-machine PR must answer **all** of the following before merge:

1. Which doctrine rule applies?
2. Which rail does this touch?
3. Does it cross rails?
4. If yes, does it cross **through the ledger**?
5. Does it involve money movement?
6. Does it require a CPA answer?
7. Does it require a Counsel answer?
8. Does it require a Labor-lawyer answer?
9. Does it require vendor confirmation?
10. Does it require security review?
11. Does it require sandbox proof?
12. Is there a rollback plan?
13. Is there an idempotency key?
14. Is there an audit event?
15. Is there a reconciliation path?
16. Is there any raw-card-data risk?
17. Is there any document-numbering risk?
18. Is there any stored-value / e-gift / loyalty risk?
19. **Does every money-mutating route in this PR write an `audit_events` row capturing actor, action, target, before-state, after-state?** If no, the PR is not mergeable. (Mandatory audit-log rule, restated from petwash-platform skill §2.)
20. Is there any manual / admin-fallback path that bypasses the ledger or the audit chain? If yes, see D16.
21. Is there any "temporary" measure? If yes, see D17.
22. Is this one PR, one risk?

If any answer is unclear, **stop**. Do not code around uncertainty.

---

## D11. CEO personal-liability risk map

> **Framing rules for this section (do not violate):** this section identifies **risk vectors and the authority that must classify them**. It does not state legal conclusions. It does not certify Pet Wash as compliant under any of these statutes. Classification of any specific Pet Wash activity against any specific statute is a Counsel / CPA / Labor-lawyer decision, not an engineering or doctrine decision.

Israeli statutes and case law that may attach **personal liability** to a director/CEO ("נושא משרה", "מנהל פעיל", controlling shareholder) for company-level compliance failures. Each item names the doctrine doc(s) that close the gap and the specialist who must classify Pet Wash's exposure.

| Tag | Risk vector | Statute / doctrine reference | Closing doc(s) | Authority to classify |
|---|---|---|---|---|
| L1 | Unpaid VAT collected from customers | חוק מס ערך מוסף §119 (director personal liability for VAT not remitted) | G10 company-tax-ID source-of-truth; G12 book-of-record; G11 SHAAM allocation | CPA |
| L1a | Statutory tax veil-piercing | פקודת מס הכנסה §119א (controlling shareholder personally liable where company has tax debt and assets/activity transferred to related party without adequate consideration; **administrative, no fraud proof required**) | G10; G14 annual classification + tax-status audit | CPA + Counsel |
| L2 | Unpaid ניכוי במקור from provider payments | פקודת מס הכנסה §164–§224A | G5 provider-onboarding evidence pack; G6 provider tax-status taxonomy; PR-MASAV-1 (withholding state machine) | CPA |
| L2a | Criminal liability for non-deduction / late remittance | פקודת מס הכנסה §§215, 217, 219 (officer liability) | Same as L2 | CPA + Counsel |
| L3 | Unpaid ביטוח לאומי employer contributions IF providers reclassified | חוק הביטוח הלאומי §367 | G1 subcontractor-classification doctrine; G5; G14 | Labor lawyer + CPA |
| L4 | פיצויי פיטורין / vacation / recuperation back-pay on reclassification | חוק פיצויי פיטורין; חוק חופשה שנתית; recent case law incl. Wolt-track (ע"ע 14039-06-21 חזנוביץ' נ' Wolt, Aug 2022) and 2024 cleaner-reclassification ruling (non-pecuniary damages added) | G1; G2 per-channel matrix; G3 control-test redlines; G14 | Labor lawyer |
| L5 | Minimum-wage / wages-protection back-pay + pension liquidated damages | חוק שכר מינימום; **חוק הגנת השכר §§25ב, 26א** (CEO/director personal liability for unpaid wages and pension where corporate violator insolvent or director caused violation) | G1; G2; G14 | Labor lawyer |
| L6 | False-statement on wrong-ID tax documents (forensic-audit finding F-104) | פקודת מס הכנסה §220 | G10 company-tax-ID source-of-truth; PR #220 §10 Q8 (correction-path decision) | CPA + Counsel |
| L7 | Trust-fund commingling / payment-services exposure | See D12 (Payment Services Law 2023) | G12 book-of-record; D12 firewall in this doc | Counsel |
| L8 | Consumer-protection officer obligations / misleading conduct fines | חוק הגנת הצרכן §22ג (officer-level administrative fines) | G15 named-compliance-officers; PR-COMPLIANCE-DISPUTES-1 | Counsel |
| L9 | AML / KYC director liability on payouts | חוק איסור הלבנת הון, 2000 | Future PR-AML-1; G15 | Counsel |
| L10 | Privacy / data-security director liability | חוק הגנת הפרטיות + תקנות הגנת הפרטיות (אבטחת מידע) 2017 (administrative fines; personal sanctions on officers) | Future PR-PRIVACY-1 | Privacy counsel + Security |
| L11 | Civil duty of care / loyalty | חוק החברות §§252–254 (חובת זהירות), §§254–256 (חובת אמונים) | Board-level; G15 | Counsel + Board |

**CEO defensive-documentation checklist** (the agent's work product, to be confirmed by Counsel):

- Board resolutions documenting the compliance program, accountant + counsel + labor-lawyer appointments, internal-controls policy.
- D&O insurance (ביטוח דירקטורים ונושאי משרה).
- Indemnification undertaking under חוק החברות §§259–260.
- Quarterly compliance-review minutes; written delegation to CFO/accountant.
- CPA opinion letters on classification questions (filed against the Q1–Q18 register in D9).
- No dividends or asset transfers while tax debt is outstanding (§119א trigger).

**Veil-piercing precedent.** Israeli courts pierce sparingly under חוק החברות §6 (fraud, misuse, abuse of separate personality). For startups, courts have pierced where founders mixed personal/corporate funds, drained assets pre-insolvency, or used the entity to evade contractual/statutory duties. The §119א administrative path is **procedurally easier** than civil veil-piercing and is the most likely first vector if a tax debt arises.

**This section does not opine** on whether any of L1–L11 currently applies to Pet Wash. Each requires Counsel / CPA / Labor-lawyer classification per the Authority column above.

---

## D12. Payment Services Law 2023 firewall

> **Framing rules (do not violate):** this section flags a **licensing-risk vector**, not a license requirement. Whether any specific Pet Wash activity falls within the scope of the Payment Services and Payment Initiation Law 2023 is a Counsel decision. The regulator identity is **not yet definitively named** and must be Counsel-confirmed (recent guidance suggests the framework may involve more than one regulator depending on activity classification — including but not limited to רשות שוק ההון and the Israel Securities Authority for non-bank payment services). Trust-account structures **may reduce commingling risk but do not automatically remove the licensing question** — Counsel must confirm whether the activity itself, regardless of custody arrangement, requires licensing.

**Rule:** Pet Wash holding customer balances on its OWN books — e-gift prepayment, wallet top-up, escrow for future bookings, loyalty conversions to money — creates a **licensing-risk vector** under חוק הסדרת העיסוק בשירותי תשלום וייזום תשלום, תשפ"ג–2023 (Payment Services and Payment Initiation Law 2023, in force 2024). If the activity is classified as an unlicensed payment service, the consequences may include:

- Licensing requirement (capital reserves; executive vetting; customer-fund segregation rules; ongoing supervision).
- Officer-level criminal exposure for the unlicensed-services offense.
- Inability to operate the wallet / e-gift / escrow surfaces as currently structured.

**Operational mitigation direction (engineering doctrine — not a legal answer):**

- Customer prepayment, wallet, e-gift, and escrow funds **never sit in Pet Wash's operating bank account**.
- Funds in transit sit at the acquirer (UPay / Nayax) until released.
- If a trust-account / segregated-bank structure is implemented, it is structured per Counsel guidance (PR #220 §10 Q12) — and Counsel must separately confirm whether the activity itself still requires licensing.
- Provider payouts are released within days, not weeks (minimise float in any Pet Wash-controlled account).
- Internal-ledger entries reconcile against the holder-of-funds (acquirer or trust), never against Pet Wash operating-account balances for customer-owed funds.
- Loyalty points are not converted to money in any rail without the explicit answer to Q17 (CPA + Counsel).

**Authority routing:**

- **Counsel** classifies whether each surface (wallet top-up, e-gift purchase, escrow hold, refund credit, promo credit, loyalty redemption, recurring billing, payment links) falls within the Law's scope.
- **Counsel** identifies the applicable regulator(s).
- **CPA** confirms the bank / trust / acquirer structure that satisfies the operational mitigation above.
- **CFO / CEO** confirm the operational rule that no customer funds touch Pet Wash operating accounts.

This question is **existential-class architecture** because the answer determines whether the wallet / e-gift / escrow surfaces can exist in their current architectural shape at all. Until Counsel classifies, the firewall (D8 forbidden list + this section) holds.

---

## D13. Per-channel classification gating

**Rule:** different marketplace channels carry materially different reclassification risk under the מבחן המעורב (mixed test). They cannot be governed by a single classification doctrine.

**Highest reclassification risk: PetWash Academy (instructors).** Academy / training environments naturally create centralized control, process enforcement, curriculum ownership, time/location control, and managerial structure. Five of the seven מבחן המעורב factors typically point employee for academy instructors: integration into the platform's core business, control over schedule, supplied tools (curriculum, classroom), branding mandate, and economic dependency. This channel must be **gated separately** from sitter / walker / groomer / transporter:

- Academy onboarding gates require explicit Labor-lawyer review BEFORE first instructor signs.
- Academy contracts must address the academy-specific risk factors directly.
- Academy classification stance may differ from other channels (in the limit, may need to be payroll, not contractor — that is a Labor-lawyer call).

**Per-channel classification matrix** is the artefact that resolves this. It belongs in `docs/governance/per-channel-classification-matrix.md` (G2 in the future doctrine sequence). Until it lands, any new channel onboarding (academy especially) requires explicit Labor-lawyer review per channel.

---

## D14. Provider-language risk

**Rule:** UX strings and operational language directed at providers must avoid employment-coded terms unless explicitly approved by Labor counsel.

**Forbidden by default** (until Labor counsel approves the specific use):

- "shift" / "משמרת"
- "manager" / "מנהל" (when applied to a Pet Wash staff member supervising providers)
- "employee" / "עובד" (when referring to a provider)
- "salary" / "משכורת" (when referring to provider pay; use "תשלום עבור שירות" or "payout")
- "supervisor" / "ממונה" (when applied to provider relationships)
- "mandatory schedule" / "לוח זמנים מחייב"
- "training day" / "performance review" / "disciplinary action" — without Labor-lawyer review

**Why doctrine-level:** these strings appear in UI copy, email templates, push notifications, internal admin labels, ops dashboards, and operational documentation. Each instance can become courtroom evidence in a reclassification suit (per the Wolt precedent — courts examine substance of the relationship, including how the platform talks to and about providers).

**Implementation:** future provider-facing PRs include a source-pin test that flags any new use of these forbidden terms in customer-or-provider-facing files. Existing uses are inventoried and reviewed in PR-LANGUAGE-AUDIT-1 (future docs class).

---

## D15. Insurance authority routing

**Rule:** insurance is its own authority class with its own routing and its own coverage map.

| Coverage area | Why Pet Wash may need it | Authority who classifies |
|---|---|---|
| **D&O (Directors & Officers)** | CEO personal-liability map (D11). Indemnification under חוק החברות §§259–260. | Insurance broker + Counsel |
| **Cyber liability** | חוק הגנת הפרטיות 2017 admin fines + class-action risk + chargeback / fraud exposure | Insurance broker + Privacy counsel |
| **Provider injury (תאונות עבודה for genuine contractors)** | If provider is hurt on a job AND classified as contractor — primary insurance is provider's own; Pet Wash backstop | Insurance broker + Labor lawyer |
| **Pet injury (third-party liability)** | Customer's pet harmed during platform-booked service | Insurance broker |
| **Property damage (third-party liability)** | Customer property damaged during platform-booked service (sitter in customer's home) | Insurance broker |
| **Tax / withholding exclusions** | Many policies exclude tax-related liability — must be reviewed; cannot rely on insurance for L1, L2, L6 statute exposure | Insurance broker + CPA |

**Insurance is not a substitute for the doctrine.** Even if Pet Wash carries every coverage above, the immune system in D1 is what prevents the claim from being filed in the first place. Insurance is the backstop, not the firewall.

**Operational rule:** providers must carry their own professional + third-party liability insurance per the subcontractor agreement; Pet Wash's policy is backstop. Misordered insurance (Pet Wash's policy as primary) is itself a reclassification indicator.

---

## D16. Manual-fallback discipline

**Rule:** no manual money mutation outside the ledger / audit-evidence chain.

If an admin must manually issue a refund, a credit-note, a payout, a wallet adjustment, or any other money mutation — for any reason, including outage, dispute, customer-service exception, vendor-side error, or migration cleanup — the action MUST:

1. Pass through the same money-mutating route as the automated path.
2. Carry an idempotency key.
3. Write a ledger entry per Part 2.
4. Write an `audit_events` row capturing actor (admin user ID), action, target, before-state, after-state, reason (free-text human explanation).
5. Reference any vendor-side artefact (UPay refund ID, SUMIT credit-note number, Nayax reversal ID).
6. Be subject to the same financial-lineage trace (PR #221 §5).

**Forbidden:** "I'll just SQL-update the wallet balance." "I'll email the customer to apologise and refund manually outside the system." "We'll fix it in the next reconciliation cycle." Each of these creates a phantom mutation that breaks the four-way tie-out.

**The exception that proves the rule:** if a vendor-side artefact (e.g. a manual UPay refund initiated in the UPay portal) lands without a corresponding internal ledger entry, the reconciliation job MUST flag it and the admin MUST manually back-fill the ledger entry through the same route — not bypass the ledger.

---

## D17. No-temporary rule

**Rule:** no "temporary" measure ships without an explicit owner, expiry, rollback, issue number, and approval.

Any measure described as "temporary" — temporary endpoint, temporary feature flag, temporary fallback, temporary wording, temporary mapping, temporary admin override, temporary script — MUST carry, in the merging PR's commit message and in the relevant doc:

| Field | Meaning |
|---|---|
| **Owner** | Named human (engineer + product owner + CEO if material). |
| **Expiry** | Calendar date by which the temporary measure is removed or promoted. |
| **Rollback** | Exact `git revert` or removal procedure. |
| **Issue number** | GitHub issue tracking the temporary measure (open until removed). |
| **Approval** | Who approved the temporary stance, in writing. |

**Why doctrine-level:** "temporary" decisions become permanent debt; permanent debt becomes courtroom evidence; courtroom evidence becomes the case study other founders read. The single most cited finding in regulatory reviews of failed marketplaces is "the temporary measure that was never removed."

If a measure cannot meet all five fields above, it does not ship. Period.

---

## D18. Sign-off chain (per decision class)

**Rule:** every decision class has a fixed sign-off chain. The CEO does not sign alone for any of these — each requires the named specialist's written answer first, then CEO approval.

| Decision class | Sign-off chain (in order) |
|---|---|
| Labor / subcontractor classification (per channel) | Labor lawyer → CEO |
| Tax-status classification (provider עוסק status; private-individual exception) | CPA → CEO |
| Agent vs principal / consumer-law classification | Counsel → CEO |
| Document-of-record (SUMIT / UPay / split) | CPA → CEO (vendor evidence in PR #221 §1.1 supports SUMIT working assumption) |
| Self-billing authorisation (תקנה 6א applicability) | CPA → Counsel → CEO |
| Payment Services Law 2023 classification (D12) | Counsel → CFO → CEO |
| Trust-fund / bank-account structure (Q12) | Counsel → CPA → CFO → CEO |
| Insurance coverage map (D15) | Insurance broker → Counsel → CEO |
| AML / KYC stance | Counsel → Compliance officer (named per G15) → CEO |
| Privacy / data-security | Privacy counsel → Security reviewer → CEO |
| Vendor demotion / re-promotion | Engineering lead → CEO |
| Architecture decisions (engineering rules; rail boundaries) | Engineering lead → CEO |
| Doctrine amendment (this doc itself) | Co-readers (Counsel + CPA + Labor lawyer + CFO + Engineering lead) → CEO |
| Forensic-audit finding correction path (e.g. F-104, Q8) | CPA → Counsel → CEO |
| Dispute / chargeback lifecycle stance (Q13) | Counsel → CPA → CEO |
| Refund SLA per rail / checkout disclosures (Q14) | Counsel → CEO |
| PCI-DSS scope per channel (Q15) | Security reviewer → Acquirer → CEO |
| Clearing-fee ledger treatment (Q16) | CPA → CEO |
| Loyalty-points-as-money classification (Q17) | CPA → Counsel → CEO |
| Fiscal-numbering single-source confirmation (Q18) | CPA → Vendor (SUMIT / UPay) → CEO |

**Operational rule:** the sign-off must be **in writing** (email, signed PDF, or recorded board resolution — not chat, not voice memo, not "we agreed verbally"). The written answer is then filed against the relevant authority question (Q1–Q18) in the doctrine inheritance map. Future agents and reviewers MUST be able to find the written answer by following the question number; if they cannot, the sign-off is treated as not given.

**The CEO's role across every chain above is to confirm the question was routed to the named specialist, the answer was received in writing, and the answer was filed in the right doc. The CEO does not substitute for the specialist.**

---

## D19. Single-source-of-truth inventory

**Rule:** for each identifier or record below, exactly one system is the canonical source of truth. Other systems may mirror or reconcile against it; none may write to it independently.

| Item | Canonical source of truth | Owner | Validation invariant |
|---|---|---|---|
| **Company tax ID** | One central config (location to be pinned in G10) | CFO + CEO | Matches `517145033` (Pet Wash Ltd, incorporated 2025-04-02). Validator runs at app startup; refuses boot if mismatched. The wrong hard-coded `516788400` (forensic-audit F-104) appears nowhere in new code. |
| **Company legal name (Hebrew + English)** | Same central config as company tax ID | CFO + CEO | Matches `"פט וואש בע"מ"` / `"PET WASH LTD"`. |
| **Provider tax-status snapshot** | Immutable provider-status table (Part 1.5; expanded by G7) | Engineering + CPA | Append-only. One row per provider per status-change event. Snapshot referenced by every invoice + payout + Masav line. Never overwritten. |
| **Provider tax-status certificate (אישור ניכוי במקור)** | Provider-onboarding evidence pack (G5) | Operations + CPA | Annually refreshed (typically March). Expiry triggers automatic flip to default withholding rate (per CPA confirmation, Q6). Block payouts when expired. |
| **Provider master record (KYC, bank, ID)** | Internal database; vendor systems mirror | Operations + CPA | KYC-1..KYC-6 evidence (per G5). Updates audit-logged. |
| **Document numbering (per channel × per provider)** | One minter only, pending CPA Q1 (working assumption: SUMIT) | CPA-confirmed authority | Gap-free sequential. No two systems generate numbers in the same series. UPay does not mint independently (per PR #221 §1.1 vendor evidence). |
| **SHAAM allocation number (for invoices over threshold)** | Issued by רשות המסים via SUMIT API (per Q10 working answer) | CPA-confirmed authority | Pre-fetched + cached for any invoice with total ≥ active threshold (₪10,000 ex-VAT until 2026-06-01; ₪5,000 ex-VAT thereafter). |
| **Trust-fund balance** | Internal ledger (Part 2) | Engineering + CFO | Daily four-way tie-out: settlement file ↔ ledger ↔ SUMIT records ↔ trust-bank statement. Variance > 0 pages on-call. |
| **Wallet bucket balances** | Internal ledger (Part 2; buckets per `02-wallet-redesign.md`) | Engineering + CFO | `wallet.cash` / `wallet.gift_card_received` / `wallet.refund_credit` / `wallet.escrow_pending` plus `wallet.promo_credit` (pending Q9). Always shown bucket-attributed in UI; never summed into a single undifferentiated balance. |
| **Booking master record** | Internal database | Engineering | Idempotent state machine. Post-completion mutations forbidden except via reversing entry per D16. |
| **Pet master record** | Internal database | Engineering + Privacy counsel | Per pet-onboarding master plan + future PR-PRIVACY-1. Provider-safe view derived (never raw). |
| **Audit chain** | `audit_events` table (petwash-platform skill §2 mandate) | Engineering | Append-only; covers every money mutation + every admin action; required for D10 Q19. |
| **Customer master record** | Internal database; SUMIT mirrors via לקוחות module; HubSpot mirrors as CRM | Engineering + Privacy counsel | Pet Wash is source of truth (per HubSpot Master Operating System, PR #214). |
| **PR class registry** | `docs/architecture/execution-pr-roadmap.md` | Engineering lead + CEO | Single registry. Every future PR slots into a named class. Registry edits are their own PRs. |

**These are the items that, if duplicated or fragmented across systems, create the failure modes this doctrine prevents** — drift, fragmentation, audit fragmentation, regulator disputes, refund chaos, payout disputes, and the impossible-audit scenario named in the forensic audit's executive summary. Each item's canonical source is named. Each has an owner. Every future PR that touches one of these items must specify which of the three modes it operates in: **read-from-source**, **mirror-of-source-with-reconciliation**, or **write-to-source-with-authority-check**. No fourth mode exists.

---

## Acceptance criteria

This PR is acceptable only if:

- One new doc file is created at `docs/governance/octopus-brain-doctrine.md`.
- No runtime files are changed.
- No schema files are changed.
- No package files are changed.
- No config / env files are changed.
- No existing finance / vendor / payment / wallet / CRM / K9000 code is changed.
- No existing finance doc is edited (Part 0 corrections, Part 0.6 self-billing correction, etc. are SEPARATE PRs).
- The doctrine contains §§ Core principle + D1–D19.
- The forbidden-shortcut list (D8) is included.
- The authority-question registry (D9) is included.
- The future-PR reviewer checklist (D10) is included.
- D11 lists the CEO personal-liability statute references **as risk-vector-and-authority-routing entries, not as legal conclusions**.
- D12 frames the Payment Services Law 2023 question **as a licensing-risk vector to be classified by Counsel, not as a confirmed license requirement**.
- The doc says vendors are rails, not the system (D2).
- The doc says rails never mutate each other directly (D3).
- The doc says architecture and authority decisions are different (D4).
- The doc says the immune system must work under CEO pressure (D1).

---

## Recommended next sequence

1. Review this doctrine.
2. If approved, merge.
3. **After merge**, open separate docs-only PR for Part 0.6 self-billing correction (NOT in this PR — different purpose, different doc).
4. Continue either:
   - Stream A: PR-PET-5 breed autocomplete UX (non-financial, isolated).
   - Stream B: PR-FINANCE-REVIEW-1 (B1–B6 + Q13–Q15 amendment to finance docs).
5. Do not start runtime finance work.
6. Push CPA + Counsel + Labor-lawyer + Insurance-broker routing per D9 + D11 + D12 + D15.
7. Prioritise authority answers in this order: Q1, Q5, Q7, Q10, Q11, Q12, Payment Services Law classification (D12), contractor classification per channel (D13), withholding mechanics (Q6 → PR-MASAV-1).

---

## What this doc does NOT do

- It does **not** modify any code.
- It does **not** modify any schema.
- It does **not** modify any env file.
- It does **not** modify any `package.json` / lockfile.
- It does **not** modify any test file.
- It does **not** modify any existing doc (Part 0, Part 2, forensic audit, sumit-upay-operating-model.md, vendor-discovery doc, 02-wallet-redesign, 04-israeli-compliance, execution-pr-roadmap, HubSpot Master Operating System, etc.).
- It does **not** edit `docs/architecture/execution-pr-roadmap.md` to register the future PR classes (G1–G15, PR-FINANCE-REVIEW-1, PR-COMPLIANCE-DISPUTES-1, PR-MASAV-1, PR-PCI-1, PR-PRIVACY-1, PR-AML-1, PR-LANGUAGE-AUDIT-1) — registry edits are a separate follow-up PR.
- It does **not** decide any §10 or D9 Q1–Q18 question. It frames them; specialists decide.
- It does **not** authorise any production payment activation, any Stripe / Tranzila deletion, any provider payout, any invoice issuance, any חיוב ללא אובליגו booking-hold flow, any UPay account activation, any Jini procurement, any wallet automation, any refund automation, any credit-note automation.
- It does **not** correct Part 0.6 self-billing wording — that is a separate follow-up PR.
- It does **not** opine on whether Pet Wash currently complies with any of the statutes mentioned in D11 or D12 — Counsel / CPA / Labor-lawyer classify.
- It is **not** legal advice. Specialists advise.

— end of doctrine —
