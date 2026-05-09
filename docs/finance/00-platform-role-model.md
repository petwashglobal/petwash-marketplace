# Financial Core Architecture — Part 0: Platform Role Model

**Status:** DRAFT v1 — must be approved before any other Financial Core spec part is finalised.

**Owner:** CEO + counsel + CPA. Engineering implements only what this part declares.

**Hard rule:** No "temporary" finance logic. Anything written into production becomes permanent debt. Every section below specifies the **minimum legally-defensible launch architecture**, not idealised future architecture.

---

## Why Part 0 exists

Pet Wash Ltd is now an Israeli regulated company:

- **Legal name (Hebrew):** פט וואש בע"מ
- **Legal name (English):** PET WASH LTD
- **Company Number:** 517145033
- **Date of incorporation:** 02/04/2025
- **Jurisdiction:** Israel

From the day the first real shekel moves through the platform, the company is making accounting and tax assertions to the customer, the provider, and to the State of Israel. If those assertions are inconsistent — for example, the platform charges VAT but the provider is the legal seller, or money sits in the platform balance but is treated as the provider's revenue — the chain becomes structurally illegal and cannot be retrofitted by code.

Parts 1–10 of the Financial Core Architecture (tax identity, money objects, wallets, VAT, payouts, refunds, escrow, Nayax, audit, observability) all assume a settled answer to one question: **for each revenue stream, who is the legal seller, who is the legal buyer, and who is the legal intermediary?**

Part 0 settles that question. The rest of the spec must conform to it.

---

## 0.1 Legal role matrix

Each row defines a real-world participant and their **single canonical role** for v1. Multi-role participants are a known anti-pattern — they are explicitly disallowed at v1.

| Participant | Canonical role | Holds customer money? | Issues tax invoice to customer? | VAT obligor for customer-facing price? |
|---|---|---|---|---|
| **Pet Wash Ltd** (the platform) | Marketplace facilitator + payment service operator | Yes, in trust until release | Issues a **platform-fee invoice** to customer (and, where applicable, an **on-behalf-of invoice** for the provider — see 0.6) | Yes for platform fee. For service fee: see 0.6 / 0.7. |
| **Customer** | Retail buyer of pet services and machine washes | No | No | No (pays VAT; doesn't owe it) |
| **Provider** (sitter / walker / groomer / transport / Walk My Pet / PetTrek / Sitter Suite) | Independent service seller, contracted to the platform | No (cannot hold platform-collected money directly) | Issues their own tax invoice for the service, OR receives a platform-issued on-behalf-of invoice (per 0.6) | Yes for the service fee, **only if** they are an authorized dealer (עוסק מורשה). Exempt dealers (עוסק פטור) charge no VAT. |
| **Pet Wash Ltd — K9000 channel** | Direct seller of automated pet-wash sessions on Pet Wash-owned machines | Yes (platform owns the machine and the service) | Yes (platform is the legal seller) | Yes (platform is principal, not facilitator) |
| **Nayax** | Card acquirer / payment processor for K9000 machine sessions | Holds funds in transit only — never platform balance | No | No |
| **Tranzila** | Card acquirer / payment processor for marketplace bookings and wallet top-ups | Holds funds in transit only | No | No |
| **Bank (Pet Wash operating account)** | Custodian of operating funds | Yes (operating funds only — see 0.4 for trust funds) | No | No |
| **Bank (Pet Wash trust / escrow account, if separated)** | Custodian of customer / provider funds in flight | Yes (trust funds only) | No | No |
| **Masav (מס"ב)** | Bulk-credit clearing system used to pay providers | Funds in transit only | No | No |
| **Wallet holder** (logical role) | Pet Wash Ltd, on behalf of an identified user | Yes (in trust, see 0.4) | N/A | N/A |

### 0.1.1 Roles that DO NOT exist at v1 (explicit non-roles)

To prevent role drift, the following are declared explicitly absent at v1:

- Pet Wash is **not** a reseller of provider services. It does not buy and resell.
- Pet Wash is **not** a P2P money-transfer service.
- The provider is **not** an employee of Pet Wash for tax purposes (no PAYE / no withholding-as-employer flow).
- The customer is **not** a counterparty to the provider directly through Pet Wash for payment purposes — the customer pays Pet Wash (as platform), and Pet Wash settles to the provider per the agreement.
- The wallet is **not** stored value of the user in their own legal possession; it is funds held by Pet Wash in trust against future redemption (see 0.4).

### 0.1.2 Multi-role disallowance

A single legal person may not occupy two canonical roles in the same transaction. Concretely:

- A user who is **both** a customer and a provider (cross-side account) must **not** be matched to themselves (this is also enforced by PR-#2 self-exclusion in code).
- Pet Wash Ltd may not be **both** facilitator and seller in the same booking. K9000 transactions are seller-side; marketplace transactions are facilitator-side. The two pipelines are separated end-to-end, including invoice templates, ledger account codes, and reconciliation jobs.

---

## 0.2 Revenue-recognition stance

Revenue recognition determines **what amount Pet Wash Ltd records as its own revenue** for accounting / tax / Profit & Loss purposes, separately from gross transaction volume.

### 0.2.1 Marketplace bookings (provider sells to customer; Pet Wash facilitates)

**Stance:** Net revenue recognition (Pet Wash recognises only the platform fee + any direct service charges, not the gross booking value).

- **Pet Wash revenue** = platform fee (commission %) + any add-on service fees (e.g. premium placement, dispute mediation fee) charged to either side.
- **Provider revenue** = service fee paid by customer minus platform fee. This is the provider's revenue, not Pet Wash's, even though the funds transit Pet Wash's trust account.
- **Recognition trigger:** booking completion (status transitions to `completed`) — never at booking creation, never at payment authorisation.
- **Reversal:** on refund / cancellation that flips the completion, the recognised platform fee is reversed via credit note (see Part 6); never deleted.

### 0.2.2 K9000 wash sessions (Pet Wash sells to customer, Pet Wash owns the machine)

**Stance:** Gross revenue recognition (Pet Wash recognises the full machine session price).

- **Pet Wash revenue** = full session price.
- **Recognition trigger:** session completion event from the K9000 runtime (status transitions to `completed` — Part 7 lifecycle). Authorisation alone never triggers recognition.
- **No provider split.** The K9000 machine is Pet Wash property; there is no marketplace counterparty.

### 0.2.3 Wallet top-ups

**Stance:** No revenue recognition at top-up. Top-ups are deferred liability (Pet Wash owes the wallet holder either future services or refund) — see Part 3.

- Revenue recognises only on wallet **redemption** against a real booking / wash session, at which point 0.2.1 or 0.2.2 applies to the redeemed amount.

### 0.2.4 Loyalty points / e-gifts / promotional credits

**Stance:** Promotional credits issued by Pet Wash are a marketing expense, not deferred revenue. Loyalty points earned from real spend are deferred liability up to expiry; on expiry they release as breakage (other income), but only if the legal terms permit it under Israeli consumer-protection rules.

- Buckets are kept separate (Part 3.2). They never share a balance field with stored value.

### 0.2.5 Dispute / chargeback / refund

- Refunds are credit notes (Part 6), not invoice deletions. Recognised revenue is reversed in the period of the credit note; the original invoice and recognition stay on record.
- Chargebacks recognise as a contra-revenue or operating loss per CPA guidance, depending on cause.

---

## 0.3 Marketplace liability boundaries

Defines what Pet Wash is, and is not, legally liable for. This drives Terms of Service language, provider agreement language, and which insurance covers which event.

### 0.3.1 What Pet Wash IS liable for

- **Platform availability and security** — uptime, data integrity, account security, App Check, audit chain integrity.
- **Payment processing correctness** — charges accurate to authorised amount, refunds processed per policy, idempotency, no double-charge.
- **Trust-fund custody** — funds held on behalf of users / providers are not commingled with operating funds (0.4).
- **Compliance of platform-issued documents** — invoices, credit notes, statements, payout reports issued by Pet Wash must be accurate, sequenced, and retained per Israeli law (Part 9).
- **App Check / KYC enforcement** as declared (these are platform safety claims, not provider claims).

### 0.3.2 What Pet Wash is NOT liable for (provider-bounded)

- **Service quality** delivered by the provider (boarding, walking, grooming outcome quality).
- **Provider professional licensing** — provider warrants their own licensing; Pet Wash collects evidence but is not the licensor.
- **Provider tax filings** — Pet Wash issues platform-side invoices and provider statements (Part 4); provider is responsible for filing their own VAT, income tax, and any self-employed contributions to בטוח לאומי.
- **In-person incidents** between the customer and provider beyond the platform's stated insurance coverage (if any) — the platform is not the insurer of last resort.
- **Customer pet outcomes** beyond mediation duties.

### 0.3.3 K9000 carve-out

For K9000 channel (Pet Wash as principal seller, 0.1), Pet Wash IS liable for:

- The wash session itself (machine condition, dispenser fluid, cycle correctness).
- The product liability for any chemicals dispensed by the machine.
- Any injury to pet caused by machine malfunction.

This is why the K9000 pipeline is end-to-end separated from the marketplace pipeline — the legal exposure is structurally different.

### 0.3.4 Israeli consumer-protection floor

Regardless of contract language, certain rights are non-waivable under חוק הגנת הצרכן and related regulations:

- Right of cancellation within statutory window for distance contracts.
- Refund rights for non-delivered services.
- Disclosure of agent vs principal status before checkout.

These rights must be reflected in the booking flow, not just in Terms of Service. Part 6 (Refunds) and Part 8 (Escrow) inherit these requirements.

---

## 0.4 Trust / escrow legal stance

Defines whose money is in which account, when, and under what title.

### 0.4.1 The three custody states

Every shekel collected by Pet Wash is in exactly one of these states at any time:

1. **In transit** — at the acquirer (Tranzila / Nayax) before settlement to Pet Wash's bank. Not Pet Wash's money in legal terms; the acquirer is the temporary custodian.
2. **In trust** — settled to Pet Wash's bank account, but legally earmarked for a specific user or provider obligation that has not yet been discharged. Pet Wash is the trustee, not the beneficial owner. Funds in this state include:
   - Wallet balances (customer is beneficiary)
   - Pre-completion booking funds (the booking has not yet completed; provider's share is contingent)
   - Refundable balances pending dispute resolution
3. **Operating** — Pet Wash's own money, available for operating expenses, payroll, taxes, dividends. Funds enter this state only after the corresponding obligation is discharged (booking completed and provider paid; wallet redeemed; dispute closed).

### 0.4.2 Account separation requirement (v1 mandate)

For v1 launch:

- **REQUIRED:** A separate bank account (or sub-account / earmarked balance, per bank capability) holds Trust funds. Operating funds are held in a different account.
- **REQUIRED:** Daily reconciliation: sum of Trust-state ledger entries == bank-side trust balance. Variance > 0 alerts within 24h (Part 10).
- **PROHIBITED:** Using Trust-state funds to pay operating expenses, payroll, or any non-beneficiary obligation, even temporarily.
- **PROHIBITED:** "Borrowing" from Trust account against future operating revenue, even with intent to repay.

### 0.4.3 Wallet stance

The wallet is a logical sub-ledger inside the Trust state. The wallet balance is **not** the user's money in the legal sense of stored value — it is a deferred obligation owed by Pet Wash to the user, redeemable for future services or refundable subject to terms.

This distinction matters because:

- Stored-value status would trigger payment-services regulation in Israel under certain thresholds.
- Deferred-obligation status (the chosen v1 stance) keeps the wallet within marketplace-facilitator regulation but requires strict trust-fund segregation.

### 0.4.4 Open question for counsel

- Does Israeli regulation require a formal trustee structure / נאמנות הסדרת חשבון, or is contractual trust language in Terms of Service sufficient at v1 transaction volumes? Answer pinned in 0.5.

---

## 0.5 Provider agreement dependency map

Every Part of this spec depends on specific clauses being present in the **Provider Master Agreement** (the contract every provider signs before their first payout). Without those clauses, the spec sections become unenforceable.

| Spec part | Dependent provider-agreement clause | Status |
|---|---|---|
| 0.1 (canonical role) | "Provider is an independent contractor, not an employee. Provider is the seller of services to the customer; Pet Wash is the facilitator." | TODO — counsel to draft |
| 0.2.1 (net revenue recognition) | "Pet Wash retains the platform fee from the customer's payment; the remainder is the Provider's revenue." | TODO |
| 0.2.4 (loyalty / promo) | "Promotional credits redeemed against Provider services are funded by Pet Wash Ltd; Provider receives full service price net of platform fee, regardless of customer's promo discount." | TODO |
| 0.3.2 (provider-bounded liability) | Service-quality, licensing, and provider-tax-filing responsibilities sit with Provider. | TODO |
| 0.4 (trust funds) | "Pet Wash holds funds collected from customers in trust until release per the Settlement Schedule." | TODO |
| 0.6 (on-behalf-of invoicing) | "Provider authorises Pet Wash to issue tax invoices on Provider's behalf where applicable." Required for self-billing model under Israeli VAT rules. | TODO — depends on counsel + CPA |
| 0.7 (VAT obligation) | "Provider warrants their VAT status (authorized / exempt) and provides their tax ID. Provider is responsible for VAT on the service portion; Pet Wash is responsible for VAT on the platform fee." | TODO |
| 1.5 (immutable tax-profile snapshot) | "Provider's tax-status declarations are recorded as evidence at first payout and may not be retroactively altered." | TODO |
| 4 (payouts) | Payout cadence, minimum payout, currency, dispute hold rules, withholding (if any). | TODO |
| 6 (refunds) | "Provider agrees that customer-facing refunds may be processed by Pet Wash and offset against future Provider payouts per the Refund Policy." | TODO |
| 8 (escrow) | "Funds for confirmed bookings are held by Pet Wash until completion; the Provider has no claim to such funds before completion." | TODO |
| 9 (audit / archival) | "Provider authorises Pet Wash to retain all transaction records for the statutory archival period." | TODO |
| 10.5 (kill switches) | "Pet Wash may suspend Provider payouts / activity for compliance, dispute, or risk reasons; suspension is logged and appealable per the Suspension Policy." | TODO |

Until each row reads "DRAFTED + APPROVED", the corresponding spec part is **dependency-blocked** for production code.

---

## 0.6 Tax-invoice issuance authority

**Per Israeli VAT rules**, every taxable transaction must produce an invoice from the legal seller to the legal buyer.

### 0.6.1 K9000 channel

- **Seller:** Pet Wash Ltd.
- **Buyer:** Customer.
- **Issued by:** Pet Wash Ltd, immediately on session completion.
- **Format:** Standard SHAAM-compliant tax invoice. Sequenced from Pet Wash's K9000-channel invoice series. (Part 1.3 / Part 2.4)

### 0.6.2 Marketplace channel — provider is authorized dealer (עוסק מורשה)

Two sub-models, decided per provider:

#### 0.6.2.a Self-billing (recommended default)
- **Seller:** Provider (legal).
- **Buyer:** Customer.
- **Issued by:** Pet Wash Ltd, **on behalf of the Provider**, via written authorisation in the Provider Master Agreement (0.5).
- **Sequenced from:** the Provider's invoice series (Pet Wash maintains a per-provider sequence counter; gap-free, year-scoped — Part 2.4).
- **Pet Wash also issues:** a separate tax invoice from Pet Wash Ltd to Provider for the platform fee (Pet Wash is the seller of facilitation services to the Provider).
- **Why default:** centralises sequencing, ensures invoice issuance happens at the moment of revenue recognition, prevents missed-invoice audit findings.

#### 0.6.2.b Provider self-issuance (legacy / opt-out)
- **Issued by:** Provider directly, outside Pet Wash systems.
- **Pet Wash records:** a reference to the provider-issued invoice number when supplied; without it, Pet Wash flags the booking as `invoice_pending_external` and does not release payout until reconciled.
- **Pet Wash still issues:** the platform-fee invoice from Pet Wash Ltd to Provider.
- **Why offered:** legacy providers may already have established invoicing systems; switching cost may exceed compliance benefit at v1.

### 0.6.3 Marketplace channel — provider is exempt dealer (עוסק פטור)

- **Seller:** Provider.
- **Buyer:** Customer.
- **Issued by:** Pet Wash Ltd on behalf of Provider, formatted as a **receipt** (קבלה), not a tax invoice. No VAT line item on the service portion.
- **Pet Wash invoice to Provider:** standard tax invoice for platform fee with VAT (Pet Wash is authorized).

### 0.6.4 Open question for CPA

- Confirm the on-behalf-of self-billing model is permissible under current Israeli VAT regulations and what authorisation language is required in the Provider Master Agreement.
- Confirm SHAAM digital-signature requirements per channel (Part 1.3).

---

## 0.7 VAT obligation mapping

This section names **who owes VAT to the State of Israel** for each line of revenue. Part 5 implements the engine; Part 0.7 fixes the legal answer.

| Revenue line | Legal seller | VAT owed by | Standard rate (v1) | Notes |
|---|---|---|---|---|
| K9000 wash session | Pet Wash Ltd | Pet Wash Ltd | 17% (or current Israeli standard rate) | Always taxable. |
| Marketplace service — provider authorized | Provider | Provider | 17% | Pet Wash collects-and-remits-on-behalf-of via self-billing (0.6.2.a) or records-and-reports only (0.6.2.b). |
| Marketplace service — provider exempt | Provider | None | 0% (exempt) | No VAT line; receipt format. |
| Platform fee — Pet Wash to Customer (where charged separately) | Pet Wash Ltd | Pet Wash Ltd | 17% | Always Pet Wash's own VAT. |
| Platform fee — Pet Wash to Provider (commission) | Pet Wash Ltd | Pet Wash Ltd | 17% | Provider receives an inbound invoice from Pet Wash for the fee. |
| Wallet top-up | (no taxable event yet) | None at top-up | n/a | VAT applies on redemption per the redeemed-against revenue line. |
| Loyalty / promo credit redemption | Funded by Pet Wash | Pet Wash bears the discount cost | n/a | Provider is paid full service price net of fee, as if no discount; the VAT base is the full pre-discount price (subject to CPA confirmation). |
| Refund / credit note | (reversal) | Reverses the original VAT entry | n/a | Part 6 lineage. Original invoice never deleted. |

### 0.7.1 Tourist / cross-border

Out of scope for v1. The platform is targeted at the Israeli market. Any non-Israeli user / non-Israeli card flows through the standard Israeli VAT flow until a future PR specifies otherwise.

### 0.7.2 Reverse charge

Out of scope for v1 (no B2B-to-foreign-supplier transactions in the consumer flow).

### 0.7.3 Withholding on provider payouts

Standard Israeli withholding-tax (ניכוי מס במקור) rules may apply to certain provider payments. The Provider Master Agreement (0.5) must capture the provider's withholding certificate / exemption status; the immutable tax-profile snapshot (Part 1.5) records it at payout time. **Open for CPA:** v1 default rate when no certificate is on file.

---

## v1 Launch scope

- All seven sub-sections (0.1 through 0.7) approved by CEO + counsel + CPA.
- Provider Master Agreement (0.5) drafted with all dependency clauses.
- Trust account (0.4.2) operationally separated at the bank.
- Tax-invoice templates (0.6) drafted for each of the 4 channel × dealer-status combinations.
- VAT obligation map (0.7) confirmed by CPA in writing.
- Decision pinned: self-billing default vs provider self-issuance default.
- Decision pinned: trustee structure vs contractual-trust v1 stance (0.4.4).

## Deferred scope

- Multi-currency (ILS-only at v1).
- Cross-border / tourist VAT (v1 out of scope, declared 0.7.1).
- Reverse charge (v1 out of scope, declared 0.7.2).
- Stored-value licensing route for the wallet (deferred unless transaction volumes demand it).
- B2B / corporate-account billing (deferred).
- Multi-VAT-jurisdiction (deferred).

## Legal assumptions

- Pet Wash Ltd retains a competent Israeli tax counsel and a CPA before v1 launch.
- Self-billing on behalf of providers is permissible under current Israeli VAT rules with proper authorisation in the Provider Master Agreement (open for confirmation, 0.6.4).
- Trust-fund segregation at the bank is operationally feasible without triggering payment-services-licensing requirements at v1 transaction volumes (open for confirmation, 0.4.4).
- The platform-fee + facilitation model qualifies as a marketplace-facilitator service under Israeli consumer-protection law (assumed; open for counsel review).

## Unresolved questions

1. **0.4.4** — Trustee structure vs contractual trust language: which is required at v1 transaction volumes?
2. **0.6.4** — Self-billing default vs provider self-issuance default: pin one for v1.
3. **0.7.3** — Withholding-tax v1 default rate when no provider certificate is on file.
4. **0.3.4** — Israeli consumer-protection refund window for distance contracts: confirmed days and exclusions.
5. **0.2.4** — Loyalty-points expiry: legal duration limits and the breakage-recognition stance.
6. **0.1** — Whether Pet Wash needs an additional regulatory licence for any non-K9000 activity (counsel review).

## Dependency owners

| Item | Owner |
|---|---|
| Provider Master Agreement drafting | Counsel |
| Tax-invoice templates (per channel × dealer status) | CPA + Engineering |
| Trust-account operational setup | CFO + Bank relationship manager |
| VAT obligation map confirmation | CPA |
| Self-billing authorisation language | Counsel |
| Withholding certificate workflow | CPA |
| Audit chain extension to financial records | Engineering (Part 9) |

## Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Provider role drift (provider treated as employee for some flow) | Tax filings inconsistent; potential employer-liability exposure | Multi-role disallowance enforced in code (0.1.2); single canonical role per participant per transaction. |
| Trust funds commingled with operating funds | Regulatory exposure; insolvency exposure to user funds | Separate bank account (0.4.2); daily reconciliation alert; kill-switch on operating-from-trust (Part 10.5). |
| Tax invoice issued from wrong sequence | SHAAM audit finding; possible invalidation of invoices | Numbering authority is single-source per channel × per provider (Part 2.4); gap-free; year-scoped. |
| Wallet treated as stored value without licence | Regulatory exposure | Deferred-obligation stance (0.4.3); legal review at any threshold change. |
| Provider Master Agreement missing dependency clause | Spec sections (Part 4 / 6 / 8 / 10.5) unenforceable | Dependency map (0.5) is a launch blocker; no spec part proceeds to code without its clause. |

## Reconciliation strategy

- Daily: sum(Trust-state ledger) == bank trust balance. Variance > 0 → critical alert.
- Daily: count(invoices issued today) == count(transactions recognised today, by channel). Variance → invoice-pending audit job.
- Weekly: per-provider statement — gross sold vs platform fee retained vs payout owed vs payout sent. Variance > 0 → manual hold + alert.
- Monthly: VAT period close — sum(VAT collected by Pet Wash) and sum(VAT collected on behalf of providers) reconciled against expected from revenue figures. Variance > 0 → CPA review before filing.

## Rollback / offset strategy

- All financial state changes are append-only ledger entries (Part 2). To "undo" anything is to write an offsetting entry with a credit-note reference, not to mutate or delete.
- A wrongly-issued invoice is corrected by issuing a credit note for the full amount and a fresh invoice — the wrong invoice never disappears (Part 6.5 lineage).
- Role-misassignment in the system (e.g. a transaction wrongly tagged K9000 instead of marketplace) is corrected by an offsetting reclassification ledger entry plus a corrective invoice/credit-note pair if the error reached the customer.
- No "delete" or "fix in place" path for any financial record. Ever.

---

**Hard rule restated:** No "temporary" finance logic. If 0.1–0.7 cannot all be answered today, the missing answers become **unresolved questions** above and **block** the corresponding spec parts and code paths. Do not fabricate provisional answers in code.
