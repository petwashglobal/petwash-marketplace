# UPay Vendor Discovery + Rail Architecture + Financial Lineage — Pet Wash Ltd

**Status:** DRAFT v1 — DOCS ONLY. No code, no config, no env, no schema, no migration, no package change. Companion to PR #220 (`docs/finance/sumit-upay-operating-model.md`); does NOT modify that doc.

**Owner:** CEO (vendor relationship + commercial terms) + CPA (financial-lineage validation, document-of-record) + Counsel (legal trace, agent-vs-principal, dual-MCC) + Engineering (financial-lineage implementation, only after CPA + Counsel sign off PR #220 §10).

**Authored:** 2026-05-10. Branch: `claude/docs-finance-vendor-discovery-and-lineage` off post-#220 main (`241687da8`).

**Hard rule (restated from PR #220 §9):** No live SUMIT or UPay payment wiring. No Stripe / Tranzila reference deletion. No provider payout automation. No fiscal document issuance from this codebase to a real customer or to רשות המסים. This doc adds **discovery context** and **architectural doctrine**; it does not authorise any of the above.

---

## How this doc fits the existing finance series

| Doc | Role | Relationship to this doc |
|---|---|---|
| `docs/finance/00-platform-role-model.md` (Part 0) | Legal seller / buyer / intermediary; trust-fund stance | This doc cites Part 0; does not modify. |
| `docs/finance/02-money-object-model.md` (Part 2) | Typed `Money`, append-only ledger | This doc cites Part 2 § "lineage"; does not modify. |
| `docs/finance/transaction-lifecycle-forensic-audit.md` | 10 P0 findings; F-104 SHAAM allocation gap | This doc cites the audit; does not modify. |
| `docs/finance/sumit-upay-operating-model.md` (PR #220) | Vendor reality + 5-line operating model + e-gift lifecycle + 12 CPA questions + §9 firewall | **This doc EXTENDS PR #220** with: (a) post-merge vendor-discovery facts, (b) the 7-rail separation locked as doctrine, (c) the new "financial lineage" concept. Does not modify PR #220's file. |
| `docs/architecture/01-unified-payment-abstraction.md` | Channel abstraction; PR-UPAY-1..7 plan | This doc updates the question list PR-UPAY-1 should answer. |
| `docs/architecture/02-wallet-redesign.md` | Wallet bucket separation | This doc cites; does not modify. |
| `docs/architecture/04-israeli-compliance.md` | VAT, SHAAM, חשבוניות ישראל | This doc cites §8 of PR #220; does not modify. |
| `docs/architecture/execution-pr-roadmap.md` | PR class registry | This doc does NOT edit the registry. Registry edits are a separate follow-up PR. |

---

## 1. Vendor-discovery facts (delta since PR #220)

Source: vendor websites (`upay.co.il`, `smartpay.co.il`), bookkeeping partner sites (`invoice4u.co.il`, `help.sumit.co.il`), pass dated 2026-05-10. These facts were **not visible** when PR #220 was authored.

### 1.1 UPay is acquirer-NEUTRAL on the bookkeeping side

UPay auto-integrates with **at least two** bookkeeping platforms:

- **SUMIT** — Pet Wash Ltd's current pick.
- **Invoice4u** — an alternative we did not previously know UPay supported.

**Architectural implication:** UPay is a pure payment rail. The bookkeeping platform is a **separate, swappable choice**. This **confirms** the working assumption in PR #220 §10 Q1:

```
SUMIT  =  document-of-record / book of record
UPay   =  clearing rail; does NOT issue documents on its own in
          the integrated mode (it instructs SUMIT to issue them
          after each clearing event)
```

PR #220 §10 Q1 still requires CPA confirmation, but engineering has now seen vendor-side evidence supporting the working answer.

**Engineering doctrine implied:** keep any future PR-SUMIT-* code paths thin enough that an Invoice4u variant is feasible later. Do not bake SUMIT-specific assumptions into the lineage layer.

### 1.2 UPay sells a physical card terminal — "Jini"

Jini is a small chip-and-PIN reader that pairs with a smartphone (audio jack / Bluetooth) for **card-present transactions**. It is what almost certainly runs underneath UPay's "חיוב במעמד הלקוח" surface.

**Operational implication for marketplace card-present (mobile groomer at customer's home; on-site walker payment):** the provider needs the physical Jini reader, not just the UPay app on their phone.

**New non-CPA logistics question (NOT one of PR #220 §10):**

> **L-Jini.** Does Pet Wash issue Jini readers to all approved providers (capex; Pet Wash absorbs cost), require providers to procure their own (friction; provider may not buy), or default to **payment-link only** for v1 (simplest; worse customer UX in-home)?

This is a CEO + Operations decision, not a CPA / Counsel decision.

### 1.3 Standard fee range — and the 0.9% trap

Public surfaces show a fee range of **1.1%–1.5% per regular transaction** on standard tracks. The **0.9% + VAT** figure prominently advertised on `upay.co.il` is **restricted to עוטף-עזה businesses** (southern war-affected). Pet Wash Ltd is **not** in that catchment and **must not** assume 0.9% in any internal financial projection.

| Fact | Value | Source |
|---|---|---|
| Setup fee | Zero on at least one track | `upay.co.il` "ללא דמי הקמה/חודשיים" |
| Monthly fee | Zero on the same track | same |
| Per-transaction fee (standard) | ~1.1%–1.5% | `smartpay.co.il`, `invoice4u.co.il` |
| 0.9% promo | עוטף only — **not Pet Wash** | `upay.co.il` |
| Settlement timing | T+1 (up to 24h) on some tracks | `smartpay.co.il` |
| Bit support | Confirmed | SUMIT help center |

**Action item:** during the L1 vendor call (see PR #220 §11 rollout chain), CEO must obtain a **written quote with the SPECIFIC track + per-transaction fee + settlement timing** Pet Wash will receive. The public 0.9% figure is marketing, not the contract rate.

### 1.4 Fast-funds vs Tranzila

T+1 settlement on UPay (when on the right track) is materially better cash flow than typical multi-day Tranzila settlement. **Reconciliation implication:** the trust-account reconciliation job must run **nightly**, not weekly, once UPay is live. Spec this in the future PR-MASAV-1 reconciliation section.

### 1.5 Activation timeline

Per the SUMIT help center (article dated 2026-03-31): *"לרוב, ניתן לסיים את כל התהליך בימים ספורים. ניתן גם ליצור קשר עם Upay ישירות כדי לזרז את התהליך, במידת הצורך."* — usually a few days; direct vendor contact can expedite.

Pet Wash's UPay account is **opened but not active** (per the SUMIT-dashboard banner observed during the iPad pass). The activation call (PR #220 §11 step L1) is the highest-leverage external action.

---

## 2. UPay vendor-call question list (CEO call brief)

> **Use this as the CEO's call brief for the L1 activation call.** Mark each answer in writing as it lands. Each answer either resolves an open architectural question or unblocks one of the §9.2 readiness preconditions of PR #220.

### 2.1 The 11 questions to ask UPay (verbatim from CEO directive)

| # | Question | Why it matters | Unblocks |
|---|---|---|---|
| **V1** | **Does UPay support dual MCC** in one merchant account (one MCC for K9000 direct-merchant + a different MCC for marketplace facilitator)? Or do we need **two separate UPay accounts**? | Pet Wash Ltd operates in BOTH legal modes. K9000 = direct seller (Part 0.1 row "Pet Wash Ltd — K9000 channel"). Marketplace = facilitator (Part 0.1 row "Pet Wash Ltd — marketplace"). Forcing both into one MCC will create accounting + tax chaos at audit time. | PR #220 §10 Q11 (agent-vs-principal); resolves the operational shape. |
| **V2** | **Does UPay support marketplace / facilitator transactions** with separate provider-payout legs? | If UPay only supports direct-merchant flows, marketplace transactions cannot route through UPay; we'd need a different rail or a different account. | PR #220 §10 Q5; PR-MASAV-1 design. |
| **V3** | **Does UPay's חשבונית מס flow handle SHAAM allocation-number requests automatically?** Or does the user / system have to request the מספר הקצאה per-document via רשות המסים API? | After **2026-06-01** every tax invoice over **₪5,000 ex-VAT** needs an allocation number. Forensic audit F-104 already pinned the gap. We must know who owns this end-to-end before that date. | PR #220 §10 Q10; **calendar-locked 2026-06-01**. |
| **V4** | **האם יש webhook בזמן אמת** (real-time webhook) on every clearing event? What's the HMAC scheme? Replay-protection mechanism? | Without a real-time webhook our internal ledger cannot stay in sync. Polling is unacceptable for money. | PR #220 §9.2 readiness #5 (security model). |
| **V5** | **האם יש sandbox / test environment** with non-production credentials? Are sandbox fiscal documents marked as test (so they don't pollute רשות המסים)? | We cannot satisfy §9.2 readiness #4 (sandbox flow verified) without a real test environment. | PR #220 §9.2 readiness #4. |
| **V6** | **האם יש hold/authorize/capture flow** behind חיוב ללא אובליגו? What's the maximum hold duration? What happens if we don't capture in time? Is the customer's funds released automatically? | Booking deposits + no-show protection depend on this. Counsel needs the legal hold semantics (§10 Q4). | PR #220 §10 Q4. |
| **V7** | **What is the actual settlement timing** on the track Pet Wash will be on? T+1, T+2, T+3? Same for Bit settlements? Same for refunds? | Trust-account reconciliation cadence depends on this. T+1 settlement implies nightly recon job; longer settlement implies different cadence. | PR-MASAV-1 reconciliation section; §9.2 readiness #6. |
| **V8** | **Bit reconciliation export** — does UPay produce a daily settlement file that includes Bit transactions distinguishably? CSV format? API endpoint? | Bit transactions hit a different rail underneath (Israeli interbank P2P). They must be reconcilable separately so any rail-specific dispute can be traced. | Internal-ledger lineage; reconciliation. |
| **V9** | **Masav payout compatibility** — does UPay export Masav files for provider payouts? Or is that a SUMIT-only capability via the SUMIT חיוב מס"ב module? Can the Masav file be downloaded automatically (vs manual)? | Provider payout automation depends on this. Forensic audit F-1 (NayaxSitterMarketplaceService payout NOOP) cannot be fixed without a real Masav path. | PR-MASAV-1; §10 Q5. |
| **V10** | **Whether SUMIT auto-issues fiscal documents after every UPay clearing event.** What's the exact handoff? UPay event → SUMIT API call? Or do we (Pet Wash code) sit in the middle? Is the document number minted by SUMIT or UPay? | This determines who the **document-of-record issuer** legally is — and where the document-numbering invariant (Part 2 append-only) is enforced. | PR #220 §10 Q1; Part 2 append-only invariant. |
| **V11** | **Whether UPay itself stores fiscal-document truth** independently of SUMIT, or relies entirely on SUMIT for the document-of-record. If UPay also stores it, is there a risk of two document numbering streams diverging? | Two document streams = forensic audit's nightmare. Single source must be picked. | PR #220 §10 Q1, Q2. |

### 2.2 What the CEO must obtain in writing from the call

A **written reply** (email or vendor portal message) covering:

```
[ ] Track + per-transaction fee (NOT the 0.9% עוטף marketing rate)
[ ] Setup + monthly fee for that track
[ ] Settlement timing (T+1 / T+2 / etc.)
[ ] Sandbox availability + how to obtain credentials
[ ] API documentation URL or PDF
[ ] Webhook spec (event types, HMAC, replay protection)
[ ] Dual-MCC support stance (yes / no / "two accounts")
[ ] Marketplace/facilitator mode support
[ ] SHAAM allocation-number handling
[ ] Hold/authorize/capture mechanics + duration
[ ] Bit settlement export format
[ ] Masav payout export availability
[ ] Document handoff: UPay event → SUMIT?  who mints document №?
[ ] Jini terminal pricing (per unit + bulk)
[ ] Activation timeline (best case + worst case)
```

This written reply becomes the source artifact for PR-UPAY-1's vendor-discovery section.

---

## 3. UPay activation document checklist (Israeli KYC)

Pet Wash Ltd must gather these **before** the L1 call (or have them ready to submit immediately after).

| # | Document | Notes |
|---|---|---|
| KYC-1 | תעודת התאגדות (incorporation certificate) | Pet Wash Ltd, company № **517145033**, dated 02/04/2025. |
| KYC-2 | אישור ניהול חשבון בנק OR שיק מבוטל | **⚠ DO NOT SUBMIT until §10 Q12 (trust-account decision) is answered by Counsel + CPA.** If Q12 says funds collected from customers must sit in a trust account, the bank-account ID submitted to UPay is the **trust** account, not the operating account. Submitting the operating account when the trust is required creates a structural compliance break that's hard to undo. |
| KYC-3 | תעודת זהות (Israeli ID) of controlling shareholder / signatory | CEO Nir. |
| KYC-4 | Power-of-attorney / signing authority | If signatory is not the sole director per company minutes. |
| KYC-5 | Beneficial-owner declaration (UBO) | Required by Israeli AML law for any new merchant account. |
| KYC-6 | Description of business activity for MCC code | **⚠ Pet Wash operates in TWO legal modes** (direct seller for K9000 + facilitator for marketplace). The vendor-call answer to V1 (dual-MCC) determines whether this is one description with two MCC categories or two separate applications. |

**Engineering note:** none of this is engineering's work. KYC-1..6 are CEO + Legal + bookkeeper actions. Engineering does NOT submit anything to UPay.

---

## 4. The 7-rail architectural separation (DOCTRINE — locked 2026-05-10)

The CEO formalised the following separation as engineering doctrine on 2026-05-10. This is **not** a working assumption. It is the **target architecture every future runtime PR must conform to**. A PR that violates any of the seven boundaries below is wrong, regardless of how clever or convenient the violation looks.

### 4.1 The seven rails

| Rail | What it owns | What it is NOT |
|---|---|---|
| **1. K9000 / Nayax rail** — *direct infrastructure commerce* | Customer-funded card auth at a Pet Wash-owned wash machine; Pet Wash is the **legal seller**; Nayax = acquirer; settled to **operating account** (no trust segregation — Pet Wash IS the seller). | Not a marketplace transaction. Not a provider payout. Not an escrow. **No provider exists.** |
| **2. Marketplace rail** — *escrow / provider economy* | Customer-funded payment for a sitter / walker / groomer / academy / transport service; Pet Wash is the **facilitator**; UPay = acquirer; funds in trust until provider release; provider payout via SUMIT Masav. | Not a direct sale by Pet Wash. Not a kiosk transaction. The customer's payment is held in trust (Part 0.4) until the service is delivered + Settlement Schedule fires. |
| **3. E-gift rail** — *stored-value liability* | Customer prepayment for future services; **deferred obligation owed by Pet Wash** (Part 0.4.3); bucket `wallet.gift_card_received`; bank-side custody = trust account; redeemable at K9000 OR marketplace, with the redemption event routing to the appropriate rail above. | Not provider payout. Not promo credit. Not cash wallet. Not regular income at purchase time. **Not "stored value" in the Israeli regulatory licencing sense** (Part 0 risk register). |
| **4. Promo rail** — *marketing incentive system* | Pet Wash-issued credit at no charge to the customer (sign-up bonus, referral reward, retention promo); recognised as a **marketing expense**, not a customer-funded liability; expiry, terms, redemption rules set by marketing team within Counsel's gift-card-law guardrails. | Not e-gift. Not refundable for cash. Not stored value. Not a prepayment. |
| **5. Internal ledger** — *immutable reconciliation truth* | Append-only `Money` ledger (Part 2); every money event from rails 1–4 produces ledger entries; spine of the four-way tie-out (settlement ↔ ledger ↔ SUMIT ↔ trust account); **the crown jewel** (engineering owns this; vendors do not). | Not vendor-supplied. Not mutable. Not bypassable. |
| **6. SUMIT** — *accounting / fiscal compliance layer* | Bookkeeping (הנהלת חשבונות); fiscal-document issuance (חשבונית מס / קבלה / חשבון זיכוי); Masav payout; recurring; income/expense reporting; accountant's source of truth. | Not the operational source of truth (Pet Wash app/database is). Not the audit-truth source (rail 5 is). Swappable in principle (Invoice4u is an alternative). |
| **7. UPay** — *payment execution layer* | Card auth, Bit, card-present (Jini), payment links, חיוב ללא אובליגו, settlement file production. | Not the document-of-record (rail 6 is, pending §10 Q1 confirmation). Not the audit-truth source (rail 5 is). Acquirer-neutral on the bookkeeping side (SUMIT vs Invoice4u). |

### 4.2 What the separation prevents

The 7-rail separation is the antidote to seven specific failure modes that have killed marketplace platforms in Israel and elsewhere:

1. **VAT confusion** — recognising VAT on the wrong rail at the wrong time (e.g. on e-gift purchase when it should fire at redemption).
2. **Double taxation** — both Pet Wash and the provider issuing VAT documents for the same service.
3. **Provider payout disputes** — provider claims a marketplace transaction; Pet Wash's records show a kiosk transaction; truth is unrecoverable.
4. **Incorrect credit-note chains** — a refund issued from the wrong rail; the חשבון זיכוי does not link cleanly to the original חשבונית מס; SHAAM audit fails.
5. **Stored-value exposure** — e-gift balance treated as company income; regulator pursues Pet Wash for unlicensed stored-value operation.
6. **Reconciliation drift** — trust-account balance ≠ wallet balance + escrow + payable; nobody can answer why.
7. **Impossible audits later** — the four-way tie-out (rail 5) cannot be performed because rails are tangled; an external audit takes weeks instead of hours.

Each failure mode below is a **direct historical consequence** of failing one of the rail boundaries. The forensic audit (`docs/finance/transaction-lifecycle-forensic-audit.md`) has already documented several of these failure modes happening **today** in our code (F-1, F-5, F-6, F-7).

### 4.3 Boundary tests for any future runtime PR

Before any runtime PR is approved, ask:

```
[ ] Which rail does this PR touch?
[ ] Does any code path cross a rail boundary?
[ ] Does any ledger account name appear in two rails? (red flag)
[ ] Does any function name suggest "wallet" without naming the bucket?
[ ] Does any test simulate a refund that crosses rails?
[ ] Does any error path silently fail back to the wrong rail?
```

If any answer is "yes" or "I don't know," the PR needs a redesign before merge.

---

## 5. Financial lineage — new concept (introduced 2026-05-10)

> **CEO directive (2026-05-10):** *"One additional thing to add for future docs: 'financial lineage'. Every money event should eventually trace: source → authorization → capture → ledger entry → fiscal document → settlement → reconciliation → refund/reversal → archive — without ambiguity."*

This concept is **new** to the finance docs as of this PR. It is the **traceability invariant** every future money-handling PR must conform to.

### 5.1 The lineage trace — 9 stations

Every money event in the system, from origin to archival, must pass through the following 9 stations in order. Each station produces a durable artefact (ledger row, document, settlement-file row, reconciliation entry). No station can be skipped without an explicit audit-trail comment explaining why.

```
   ┌────────────┐
1. │  SOURCE    │  Who/what initiated the money event.
   │            │  - Customer card swipe at K9000
   │            │  - Customer "Pay" click on UPay payment link
   │            │  - Customer redeem at booking
   │            │  - Provider Masav payout cycle
   │            │  - Refund admin click
   │            │  Each must capture: actor_kind, actor_id, channel,
   │            │  user-agent or device fingerprint where available.
   └─────┬──────┘
         │
   ┌─────▼──────┐
2. │ AUTHORIZE  │  The acquirer / processor authorises the money
   │            │  movement.
   │            │  - Nayax card auth
   │            │  - UPay card auth / Bit auth / link auth
   │            │  - Internal "wallet auth" (e-gift redemption: enough
   │            │    balance? bucket = gift_card_received?)
   │            │  Captures: auth_id (acquirer reference), timestamp,
   │            │  amount_minor, currency, idempotency_key.
   └─────┬──────┘
         │
   ┌─────▼──────┐
3. │  CAPTURE   │  Funds are committed (auth → capture, or auth+capture
   │            │  in one step for instant rails like Bit).
   │            │  Captures: capture_id, capture_timestamp,
   │            │  captured_amount_minor (may differ from auth amount
   │            │  for tip / partial capture flows).
   └─────┬──────┘
         │
   ┌─────▼──────┐
4. │  LEDGER    │  Append-only Money ledger (Part 2) records the dr/cr
   │   ENTRY    │  pair(s). One event = N ledger rows; never a single
   │            │  net row.
   │            │  Captures: ledger_entry_ids[], money_object_ids,
   │            │  cross-references to source/auth/capture stations.
   └─────┬──────┘
         │
   ┌─────▼──────┐
5. │  FISCAL    │  SUMIT (or whoever §10 Q1 picks) issues the fiscal
   │ DOCUMENT   │  document — חשבונית מס / קבלה / חשבונית מס/קבלה /
   │            │  חשבון זיכוי. SHAAM allocation-number obtained for
   │            │  amounts above threshold (§8 of PR #220).
   │            │  Captures: document_id (system-internal), document_no
   │            │  (legal/SUMIT-side), shaam_allocation_no (if required),
   │            │  issued_at, document_type, customer_id.
   └─────┬──────┘
         │
   ┌─────▼──────┐
6. │ SETTLEMENT │  Acquirer transfers net funds to bank (operating or
   │            │  trust per the rail). Settlement file received daily.
   │            │  Captures: settlement_file_id, settlement_row_id,
   │            │  settled_at, fees_deducted, net_amount, bank_credit_ref.
   └─────┬──────┘
         │
   ┌─────▼──────┐
7. │ RECONCILE  │  Four-way tie-out:
   │            │  settlement file ↔ ledger entries ↔ SUMIT records
   │            │  ↔ trust/operating account bank statement.
   │            │  Captures: reconciliation_run_id, reconciled_at,
   │            │  variance_amount (must be 0 or escalation entry).
   └─────┬──────┘
         │
   ┌─────▼──────┐
8. │  REFUND /  │  If a refund/reversal happens — at any time post-capture
   │  REVERSAL  │  — it goes through THIS station, NOT a parallel path.
   │            │  Reversal generates: a new ledger pair (reversing
   │            │  entry, never a delete), a חשבון זיכוי linked to
   │            │  the original document by `corrects_invoice_id`,
   │            │  and a settlement-file refund row.
   │            │  Captures: reversal_id, original_document_id,
   │            │  credit_note_id, corrects_invoice_id, refund_amount.
   └─────┬──────┘
         │
   ┌─────▼──────┐
9. │  ARCHIVE   │  After the legal retention window (Israeli tax law:
   │            │  7 years; 04-israeli-compliance.md), entries move
   │            │  to warm-tier storage but remain queryable for
   │            │  audit. Never deleted.
   │            │  Captures: archived_at, archive_storage_id,
   │            │  retention_expiry (7y from issuance).
   └────────────┘
```

### 5.2 Why lineage matters — for whom

The financial-lineage trace is **read by** seven distinct audiences. Each demands a different cross-section of the same data. The lineage layer must be designed so all seven can be served from a single query path.

| Audience | What they ask the lineage to prove |
|---|---|
| **רשות המסים (SHAAM auditor)** | "For חשבונית מס № 12345, show me: source, auth, capture, ledger, allocation number, settlement, reconciliation, any refund chain. All in one report." |
| **CPA / accountant** | "For month X, every revenue line traced to its document; every expense line traced to its supplier-document; trust-account variance reconciled to zero." |
| **Counsel** (consumer dispute) | "For booking № 67890, prove the customer authorised the charge, the service was delivered, the refund either happened or didn't, and the credit-note chain (if any) is legally sound." |
| **Customer** (chargeback) | "Show me what I paid, what I got, and any refund." |
| **Provider** (payout dispute) | "Show me every booking I'm owed for, the customer's payment status, my payout cycle, the Masav file row, my withholding (ניכוי במקור)." |
| **Internal admin** (fraud / risk) | "Surface every ledger event by an actor in the last 30 days; flag any cross-rail crossings." |
| **Engineering / on-call** (incident) | "Replay the lineage forward; identify exactly where it broke; reverse-trace from the broken station back to source." |

### 5.3 Lineage applied — three worked examples

#### 5.3.1 K9000 wash session (Rail 1)

```
1. SOURCE        Customer taps card at K9000 station S-042 at 2026-05-12T10:31:00Z.
2. AUTHORIZE     Nayax authorises ₪40 — auth_id NX-771a83.
3. CAPTURE       Nayax captures ₪40 — capture_id NX-771a83-c.
4. LEDGER        dr cash_in_transit_nayax ₪40 / cr revenue_kiosk_wash ₪33.90 /
                 cr vat_output ₪6.10 (ledger entries E-9001, E-9002, E-9003).
5. FISCAL DOC    SUMIT issues קבלה № 2026-K-04217. Allocation number not
                 required (₪40 < ₪5,000 threshold).
6. SETTLEMENT    Daily Nayax settlement file 2026-05-12.csv shows ₪40 settled
                 to operating account, fee ₪0.50 deducted.
7. RECONCILE     Recon run R-2026-05-13 ties all 4 sources: settlement, ledger,
                 SUMIT, bank statement. Variance: ₪0.
8. REFUND        Not applicable (none). If wash failed, reversal would generate
                 חשבון זיכוי linked to קבלה № 2026-K-04217.
9. ARCHIVE       Moves to warm tier 2033-05-12.
```

#### 5.3.2 Marketplace booking with full e-gift redemption (Rail 3 → Rail 2)

```
1. SOURCE        Customer redeems ₪200 e-gift at booking B-3340 (sitter Maya).
2. AUTHORIZE     Internal "wallet auth": bucket wallet.gift_card_received has
                 ≥ ₪200; auth_id WAL-3340a.
3. CAPTURE       Wallet capture (instant; internal); capture_id WAL-3340c.
4. LEDGER        dr wallet.gift_card_received ₪200 (liability discharged) /
                 cr provider_payable_maya ₪150 / cr revenue_platform_fee ₪42.37 /
                 cr vat_output ₪7.63 (entries E-9101..E-9104).
5. FISCAL DOC    Two documents:
                 (a) platform-fee invoice from Pet Wash to customer (₪50 incl. VAT)
                     — SUMIT issues חשבונית מס № 2026-MP-01233.
                 (b) service-fee invoice — issued per §10 Q5 (CPA decides:
                     provider issues, OR Pet Wash issues self-billing).
6. SETTLEMENT    No acquirer settlement (wallet redemption is internal). The
                 Masav payout to Maya for ₪150 fires per Part 4 cadence —
                 settlement_id MS-2026-05-15-batch3-line17.
7. RECONCILE     Recon run R-2026-05-13 ties: wallet ledger, provider_payable
                 ledger, Masav file, trust-account bank statement, SUMIT records.
8. REFUND        If customer cancels mid-stream: reversing entries restore
                 wallet.gift_card_received; חשבון זיכוי № 2026-MP-CN-0411
                 corrects חשבונית מס № 2026-MP-01233; provider_payable_maya
                 reversed only if not yet paid via Masav (else recovery is
                 a separate process, Counsel decides).
9. ARCHIVE       2033-05-12.
```

#### 5.3.3 Refund of a partially-used e-gift (Rail 3, refund station)

```
Pre-state: e-gift purchased for ₪500 (lineage event L1, completed). Customer
           used ₪150 at K9000 (lineage event L2, completed). Customer requests
           refund of unused ₪350 on 2026-05-15.

1. SOURCE        Customer refund request via support; admin "approve refund"
                 click in admin dashboard at 2026-05-15T14:02:00Z.
2. AUTHORIZE     Internal "refund auth": original purchase verified;
                 wallet.gift_card_received bucket has ≥ ₪350 (it has ₪350 —
                 the unused balance); auth_id REF-9012a.
3. CAPTURE       Refund capture: capture_id REF-9012c.
4. LEDGER        dr wallet.gift_card_received ₪350 (liability cleared) /
                 cr cash_in_transit_upay ₪350 (refund-out staging account)
                 (entries E-9201..E-9202).
5. FISCAL DOC    SUMIT issues חשבון זיכוי № 2026-CN-0814; corrects_invoice_id
                 = original e-gift purchase document.
6. SETTLEMENT    UPay processes refund-out; daily settlement file shows
                 ₪350 debit to trust account, refund_id UP-RF-3344.
7. RECONCILE     Recon run R-2026-05-16 ties refund event across the four
                 sources. Variance: ₪0.
8. REFUND        This IS the refund event (station 8 referencing itself).
                 Note: the original L2 K9000 redemption is NOT reversed — it
                 was a legitimate consumption.
9. ARCHIVE       2033-05-15.
```

### 5.4 Lineage ↔ rails

Each rail (§4.1) consumes the lineage stations in slightly different ways. The table below pins the differences so a future PR knows exactly which station applies.

| Station | Rail 1 (K9000) | Rail 2 (Marketplace) | Rail 3 (E-gift) | Rail 4 (Promo) |
|---|---|---|---|---|
| 1 SOURCE | Customer card swipe | Customer pay-link / card-present / Bit | Customer redeem at booking/kiosk OR purchase event | Marketing-team trigger (admin click; auto-rule) |
| 2 AUTHORIZE | Nayax | UPay | Internal wallet auth | Internal promo-policy auth |
| 3 CAPTURE | Nayax | UPay | Internal (instant) | Internal (instant; no money) |
| 4 LEDGER | revenue_kiosk_wash + vat | revenue_platform_fee + provider_payable + vat | wallet.gift_card_received delta + redemption rail's ledger | wallet.promo_credit delta; marketing_expense |
| 5 FISCAL | SUMIT issues קבלה | SUMIT issues platform-fee חשבונית מס + service-fee per Q5 | SUMIT issues at PURCHASE (per §10 Q1); redemption uses redemption rail's doc | **No fiscal document at issuance.** Marketing expense booked. Redemption may produce one (per redemption rail) |
| 6 SETTLEMENT | Nayax daily | UPay daily | None (internal) | None (internal) |
| 7 RECONCILE | settlement ↔ ledger ↔ SUMIT ↔ operating-bank | settlement ↔ ledger ↔ SUMIT ↔ trust-bank | wallet ledger ↔ trust-bank | Promo ledger ↔ marketing-expense subledger (no bank tie-out) |
| 8 REFUND | Nayax reversal + חשבון זיכוי | UPay reversal + חשבון זיכוי + provider-payable handling | Reversing wallet entries + חשבון זיכוי if doc was issued | Promo claw-back; no חשבון זיכוי |
| 9 ARCHIVE | Same retention rules across all rails | (same) | (same) | (same) |

---

## 6. What the financial-lineage concept unblocks

| Future need | Lineage station(s) it relies on | Status |
|---|---|---|
| SHAAM audit | All 9 stations; especially 5 (allocation #), 7 (recon), 8 (credit-note chain) | Calendar-locked 2026-06-01 (per PR #220 §8) |
| Provider payout disputes | 4 (ledger), 5 (service-fee invoice), 6 (Masav settlement row), 8 (any reversal) | Blocked by §10 Q5 + Q6 |
| Customer chargebacks | 1 (source), 2 (auth), 3 (capture), 5 (document), 8 (refund) | Blocked by §9.2 readiness |
| Masav payouts | 4, 5, 6, 7 — provider-side legs | Blocked by V9 vendor answer |
| E-gift redemption chains | 3 stations across rails 3 → 1 OR 3 → 2 | Doctrine pinned in §4 here + PR #220 §7 |
| Loyalty / promotional accounting | All 9 stations; rail 4 stations 1–4 special-cased | Blocked by §10 Q9 (promo bucket) |
| Regulator reviews | All 9 stations; lineage trace is the deliverable | Blocked by Q11 (agent vs principal) |

---

## 7. What this doc does NOT do

- It does **not** modify any code.
- It does **not** modify any schema.
- It does **not** modify any env file (`.env`, `.env.example`).
- It does **not** modify any `package.json` or lockfile.
- It does **not** modify any test file.
- It does **not** modify `docs/finance/sumit-upay-operating-model.md` (PR #220's file). The 3 wording fixes Andrew flagged in his sanity review are a SEPARATE follow-up PR (D1a) — not this PR.
- It does **not** modify `docs/architecture/execution-pr-roadmap.md`. PR-class registry edits are a separate follow-up PR.
- It does **not** decide any §10 question of PR #220. It clarifies vendor-discovery context for the questions; CPA + Counsel still decide.
- It does **not** authorise any production payment activation, any Stripe / Tranzila deletion, any provider payout, any invoice issuance, any חיוב ללא אובליגו booking-hold flow, any Jini procurement, or any UPay account activation.
- It does **not** start any of the future PR classes (PR-SUMIT-1, PR-MASAV-1, PR-REFUND-1, PR-INVOICE-1, PR-UPAY-1+, PR-COMPLIANCE-1+).

---

## Appendix A — Glossary additions for this doc (beyond PR #220)

| Term | Meaning |
|---|---|
| **Jini** | UPay-branded portable chip-and-PIN reader; pairs with smartphone via audio jack / Bluetooth; used for חיוב במעמד הלקוח. |
| **Invoice4u** | Israeli bookkeeping platform; UPay also integrates with it; alternative to SUMIT. |
| **MCC** | Merchant Category Code — a 4-digit acquirer-side classification of the merchant's business activity. Different MCCs imply different VAT, dispute, and chargeback rules. |
| **Dual MCC** | A single merchant account that supports two MCC categories simultaneously (or two coordinated accounts). Required by Pet Wash because K9000 = direct seller and marketplace = facilitator have different MCC categories. |
| **Financial lineage** | The 9-station traceability invariant introduced in §5 of this doc. Every money event traces source → authorize → capture → ledger → fiscal → settlement → reconcile → refund → archive without ambiguity. |
| **L1 call** | The shorthand from PR #220 §11 for the UPay vendor activation call. The CEO performs this call; engineering provides the call-brief (§2 of this doc). |
| **עוטף-עזה** | The southern war-affected catchment area in Israel that qualifies for special economic relief (incl. UPay's 0.9% promo rate). Pet Wash Ltd is **not** in this catchment. |

— end of document —
