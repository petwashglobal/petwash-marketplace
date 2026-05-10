# SUMIT + UPay Operating Model — Pet Wash Ltd

**Status:** DRAFT v1 — DOCS ONLY. No code, no config, no runtime change, no migration, no package change is introduced or implied by this document. Approval of this document signals agreement on the **vendor reality** + **operating model**, and **unblocks the CPA review questions** at the end. Each runtime PR that follows is its own decision.

**Owner:** CEO (product + commercial direction) + CPA (legal seller, VAT, document-of-record, payouts) + Counsel (consumer law, gift-card law, marketplace agency model) + Engineering (implementation, only after CPA + Counsel sign off the questions in §10).

**Authored:** 2026-05-10. Authored on branch `claude/docs-finance-sumit-upay-operating-model` off post-#219 main.

**Hard rule (stated up front, repeated in §11):** No live SUMIT or UPay payment wiring is permitted, no Stripe / Tranzila reference is to be deleted, no provider payout is to be automated, and no fiscal document is to be issued from this codebase to a real customer or to רשות המסים, until the CPA + Counsel questions in §10 are answered in writing AND a separate runtime PR class is approved per §11.

---

## ⚠️ CRITICAL-READ HEADLINE (do not skip)

If you are reading this in a hurry, this is the entire model in five lines:

1. **PetWash app/database = operational source of truth.** Bookings, sessions, customers, providers, pets — these live in PetWash. SUMIT and UPay are downstream consumers, not authoritative.
2. **PetWash internal append-only ledger (Part 2) = audit/reconciliation truth.** Every shekel that moves anywhere in the system is also recorded here, with idempotency, before-state, after-state, and actor.
3. **SUMIT = proposed accounting / bookkeeping / fiscal-document authority — pending CPA confirmation.** Working assumption; can change in §10 Q1.
4. **UPay = proposed payment execution rail — pending vendor activation + CPA confirmation.** Cards, Bit, card-present, payment links, חיוב ללא אובליגו. Connected through SUMIT.
5. **Nayax / K9000 = separate machine rail. Not a marketplace wallet. Not a provider economy. Not an escrow.** Pet Wash is the direct seller; there is no provider; no payout split; no escrow logic.

Everything else in this doc refines those five lines. Anything that contradicts them is wrong.

---

## How this document fits the existing finance docs

This is a **vendor-reality + operating-model layer**. It does not redefine concepts that already exist; it **extends them** with newly-discovered SUMIT/UPay facts that were not visible at the time the existing parts were authored.

| Existing doc | Owns | This doc's relationship |
|---|---|---|
| `docs/finance/00-platform-role-model.md` (Part 0) | Legal seller / buyer / intermediary per revenue line; trust-fund stance; provider master agreement scaffolding | **This doc cites Part 0.** Adds: which vendor (SUMIT vs UPay vs Nayax) executes which Part-0 role. |
| `docs/finance/02-money-object-model.md` (Part 2) | Typed `Money`, append-only ledger, mandatory financial-object fields | **This doc cites Part 2.** Adds: which vendor's ID maps to which ledger external_reference field shape. |
| `docs/finance/transaction-lifecycle-forensic-audit.md` | 10 P0 findings on the current code (incl. F-104 SHAAM allocation number not fetched, hard-coded company tax ID 516788400 ≠ actual 517145033) | **This doc cites the audit.** Adds: which findings are unblocked by SUMIT/UPay adoption (e.g. F-104 unblocks once UPay/SUMIT issues fiscal documents with allocation numbers). |
| `docs/architecture/01-unified-payment-abstraction.md` | Channel abstraction (Nayax / Tranzila / UPay / SUMIT); PR-UPAY-1..7 plan | **This doc cites the abstraction.** Adds: SUMIT-opens-UPay-account fact, UPay's 5 fiscal doc types, Bit + חיוב ללא אובליגו + digital cheque capabilities — all of which were unknown at the time PR-UPAY-1..7 were sketched. |
| `docs/architecture/02-wallet-redesign.md` | Bucket separation (`wallet.cash`, `wallet.gift_card_received`, `wallet.refund_credit`, `wallet.escrow_pending`); Israeli gift-card law | **This doc cites 02-wallet-redesign.** Adds: how e-gift redemption interacts with K9000 vs marketplace vs partial redemption — the missing **lifecycle layer** on top of the existing bucket model. |
| `docs/architecture/04-israeli-compliance.md` | VAT, SHAAM, חשבוניות ישראל threshold | **This doc cites 04.** Adds: 2026-06-01 threshold drop (₪10,000 → ₪5,000 ex-VAT) as an **immediate operational item**, not deferred. |
| `docs/architecture/execution-pr-roadmap.md` | Existing PR class registry (PR-UPAY-1..7, PR-COMPLIANCE-1..7, PR-NAYAX-*, etc.) | **This doc proposes new PR classes** (PR-SUMIT-1, PR-MASAV-1, PR-REFUND-1, PR-INVOICE-1) AND maps them onto existing classes where they overlap (§11). Registry edits are a follow-up roadmap PR, not part of this doc. |

If anything below contradicts an existing doc, the existing doc wins until explicitly amended in its own PR. This doc does not silently override anyone.

---

## 1. Why this doc exists — the vendor pivot

Before the iPad-screenshot pass on 2026-05-09:

- The codebase + docs assumed **Tranzila** as the active marketplace acquirer and **Nayax** as the K9000 acquirer.
- `server/lib/payment-provider-mode.ts` already declared `SUMIT_ENABLED` / `SUMIT_API_KEY` / `SUMIT_WEBHOOK_SECRET` env flags, but **no live implementation** existed.
- A code comment in that same file (`payment-provider-mode.ts:148`) literally states *"Tranzila is being retired in favour of SUMIT/UPay. Remove after migration."* — i.e. the **direction is committed**, the **execution is not**.
- `docs/architecture/01-unified-payment-abstraction.md:148` left two open questions: *"Channel-to-provider mapping for marketplace bookings — UPay or SUMIT? CFO + counsel pick once vendor contracts are signed."* and *"Recurring / subscription provider — SUMIT positioned as the default; CEO confirm."*

After the iPad-screenshot pass, the picture is clearer:

1. **SUMIT is already the accountant/bookkeeping front door for Pet Wash Ltd** — the company is logged in, the dashboard shows סליקה / לקוחות / הכנסות / הוצאות / הנהלת חשבונות modules, the accountant ("יועץ") is wired in.
2. **SUMIT opened a UPay account for Pet Wash Ltd.** A banner inside the SUMIT dashboard says verbatim: *"רוצה כבר להתחיל לסלוק? פתחנו לך חשבון ב-Upay, כעת צריך ליצור איתם קשר להפעלת החשבון."* (Translation: "Want to start clearing? We opened a UPay account for you, now you need to contact them to activate the account.") The account is **opened, not active**.
3. **UPay is a multi-rail merchant tool**, not just a card processor. The home screen ("בוקר טוב, ניר") exposes six action surfaces: Bit charge, card-present (chip & PIN) charge, payment-link request, digital cheque, expense capture, and document creation.
4. **UPay can issue fiscal documents directly.** From the "מסמך חדש" screen, five document types are available: חשבונית מס (tax invoice), קבלה (receipt), חשבונית מס/קבלה (combined), חשבון עסקה (pro-forma), חשבון זיכוי (credit note).
5. **A new feature flag exists in UPay:** *חיוב ללא אובליגו* (charge-without-obligation), labelled "חדש". Almost certainly an authorise-then-capture / hold-then-release flow — relevant for booking deposits or no-show protection without locking the customer's funds.

This means SUMIT and UPay are **not two separate vendors to glue together**. They are a **single integrated stack** sold by one entity (the SUMIT brand) where SUMIT = the bookkeeping/fiscal front door and UPay = the payment-execution rail underneath. This is a material architectural fact; the rest of this doc captures the implications.

---

## 2. Discovered facts — the iPad-screenshot pass

The CEO conducted a screen-by-screen pass on his iPad on 2026-05-09 / 2026-05-10. The facts below are what the screens actually showed. They are anchored to vendor UI text so they can be re-verified.

### 2.1 SUMIT (`app.sumit.co.il`)

| Surface | What it showed |
|---|---|
| Login | Standard SaaS login (Google / Facebook / Apple / SSO/SAML / email-link / password). Hebrew-first. |
| Dashboard for "פט וואש בע"מ" | Pet Wash Ltd is the active business. |
| Quick actions (פעולות מהירות) | לקוח/ה, חשבונית מס/קבלה, מסמך אחר, העלאת הוצאות, סליקת אשראי, סליקה מהירה. |
| Modules (מודולים) | סליקת אשראי (credit clearing), הנהלת חשבונות (bookkeeping), הוצאות (expenses), הכנסות (income), לקוחות (customers). "הוספת מודול חדש" button to add more. |
| Module store (חנות מודולים) — recommended | דפי תשלום (payment pages, web/email/WhatsApp), חיוב מס"ב (Masav direct-debit), הוראות קבע (recurring/standing orders), דיוור במייל (email blast), שליחת סמסים (SMS blast). |
| Banner | *"רוצה כבר להתחיל לסלוק? פתחנו לך חשבון ב-Upay, כעת צריך ליצור איתם קשר להפעלת החשבון."* |
| Account holder | "ניר" (the CEO is the registered admin). |

### 2.2 UPay (the SUMIT-affiliated payment app)

| Surface | What it showed |
|---|---|
| Greeting | "בוקר טוב, ניר" — same identity as SUMIT login. |
| Balance | ₪0 (account opened, never funded). |
| Six action tiles | חיוב עם ביט (Bit charge), חיוב במעמד הלקוח (card-present charge — chip-and-PIN at customer), בקשה לתשלום (payment-link request, sent via SMS/WhatsApp/email), צ׳ק דיגיטלי (digital cheque), הוספת הוצאה חדשה (expense capture for inbound), הוספת מסמך חדש (fiscal document creation). |
| Bottom navigation | עמוד הבית (home), תמונת מצב (snapshot/dashboard), אזור אישי (personal area), הוראות קבע (standing orders / recurring), חיוב ללא אובליגו (charge-without-obligation, marked **חדש**). |
| Document creation flow | Five fiscal document types: חשבונית מס, קבלה, חשבונית מס/קבלה, חשבון עסקה, חשבון זיכוי. |

### 2.3 Inferred relationship (working assumption — to be CPA-confirmed)

| Layer | Vendor | Role |
|---|---|---|
| Bookkeeping / book of record | SUMIT | The accountant's source of truth. הנהלת חשבונות module. Where רואה החשבון logs in. |
| Fiscal documents (חשבונית, קבלה, חשבון זיכוי) | **TBD — SUMIT or UPay** | UPay can issue all 5 types directly. SUMIT also issues חשבונית מס/קבלה via its own quick action. **Single source must be picked**, otherwise document numbering will fragment and the ledger will break Part 2's append-only invariant. |
| Payment clearing (cards, Bit, payment links) | UPay | The active acquirer for online + card-present marketplace flows. |
| Direct-debit / Masav | SUMIT (חיוב מס"ב module) | Provider payouts go through SUMIT's Masav module (Part 4 cadence + format requirement). |
| Recurring / standing orders | SUMIT (הוראות קבע module) AND UPay (הוראות קבע bottom-nav) | **Overlap** — must pick one as authoritative. |
| Reporting / accountant export | SUMIT | The accountant works inside SUMIT, so reports must originate or land here. |
| Customer-facing "buy + pay link" page | SUMIT (דפי תשלום module) and/or UPay (בקשה לתשלום) | **Overlap** — must pick one for our customer flow. |

Italicised cells = **open architectural decisions that this doc surfaces but does not resolve** — see §10 (CPA / Counsel questions).

---

## 3. Target architecture — financial-domain separation

This section restates and consolidates the financial-domain separation philosophy the CEO laid out on 2026-05-09. It is the **headline rule**. Every later section refines it; nothing below contradicts it.

### 3.1 The five financial domains (must remain separate)

| # | Domain | Owns | Vendor |
|---|---|---|---|
| 1 | **K9000 + Nayax — direct machine transaction rail** | A customer paying a kiosk for a wash session at a Pet Wash-owned machine. **No provider.** Pet Wash Ltd is the legal seller (Part 0.1). | Nayax (acquirer); K9000 (hardware control). |
| 2 | **Marketplace / provider economy** | A customer paying for a sitter / walker / groomer / transport service. **Provider exists.** Pet Wash is marketplace facilitator (Part 0.1). | UPay (acquirer); SUMIT (book + Masav payouts). |
| 3 | **PetWash internal wallet — promotional / store-credit / e-gift** | Stored value owed by Pet Wash to the customer (Part 0.4.3 deferred-obligation; **not legal stored value**). Already bucket-separated in `02-wallet-redesign.md` into `cash`, `gift_card_received`, `refund_credit`, `escrow_pending`. | None directly (internal). E-gift purchase routes through UPay; redemption never re-touches an acquirer (it's an internal ledger transfer). |
| 4 | **SUMIT — accounting / fiscal layer** | Book of record. הנהלת חשבונות. Reports the accountant uses. Working assumption: SUMIT is the **document-of-record issuer** until §10 question Q1 is CPA-answered otherwise. | SUMIT. |
| 5 | **UPay — payment execution layer** | The wires — actual money movement, card auth, Bit, payment links, חיוב ללא אובליגו. Stateless for accounting purposes (every UPay transaction must produce a SUMIT document). | UPay. |
| 6 | **Internal ledger — audit / reconciliation layer** | The append-only `Money` ledger declared in Part 2. **Source of truth for "what happened, in what order, by whom."** Reconciles against (a) the bank trust account, (b) SUMIT, and (c) acquirer settlement files. | None — ours. |

**Note:** §3.1 has six rows but five **vendor-facing** domains; the internal ledger (row 6) is ours and is the spine.

### 3.2 The kiosk wash — correct flow vs anti-pattern

**Correct (target):**

```
Customer → Nayax terminal at K9000 → card auth → wash session activated
       └─→ ledger writes:
              dr. cash_in_transit_nayax       ₪X
              cr. revenue_kiosk_wash          ₪X / 1.18      (pre-VAT)
              cr. vat_output                  ₪X − ₪X/1.18   (VAT collected)
       └─→ SUMIT receives a קבלה / חשבונית מס/קבלה document for the customer
       └─→ Daily Nayax settlement file → cash_in_transit_nayax cleared → bank operating account credited (NOT trust)
```

**Wrong (anti-pattern the CEO has explicitly forbidden):**

```
Customer → "provider wallet" credit
        → "marketplace escrow" hold
        → "payout split" with no provider
        → release to a phantom "kiosk provider" balance
```

This anti-pattern shows up when a generic booking-engine flow is applied to kiosks. **Kiosks have no provider. They are smart infrastructure appliances owned by Pet Wash Ltd.** Treating them like a marketplace booking creates regulatory risk, accounting confusion, refund chaos, VAT timing confusion, provider disputes, and stored-value exposure — for no reason.

### 3.3 Why mixing the domains is dangerous

A platform that tangles machine-infrastructure revenue + marketplace escrow + stored-value wallets + provider balances + promotions + tax documents into one blob suffers, in increasing order of severity:

1. **Reconciliation chaos.** "Why is the trust-account balance ≠ wallet balance + escrow?" becomes unanswerable.
2. **VAT timing errors.** VAT recognised on wallet top-up while it should be recognised on service redemption (or vice versa).
3. **Provider disputes.** A provider sees a wallet credit and assumes it's payable; in fact it's a customer's promo credit pending redemption.
4. **Refund chaos.** A refund for a kiosk wash routes through "provider escrow" code, which fails because there's no provider.
5. **Regulatory exposure.** The platform looks like it's operating an unlicensed stored-value account because the wallet has fungible balance from multiple distinct legal sources.
6. **Tax-document fragmentation.** A קבלה issued by UPay and a חשבונית by SUMIT for the same transaction → numbering broken, audit chain broken, accountant unable to certify.

The separation in §3.1 is the antidote. It is **not** an idealised architecture; it is the **minimum legally-defensible launch architecture**.

---

## 4. UPay capability map (against Part-0 roles)

Based on what the iPad screenshots showed, UPay covers the following Part-0 acquirer responsibilities. Anything **not** in this table should be assumed **not** offered by UPay until written vendor confirmation says otherwise.

| Capability | UPay surface | Part-0 role | Covered? |
|---|---|---|---|
| Card-present (chip-and-PIN, in customer presence) | חיוב במעמד הלקוח | Acquirer for marketplace booking when provider takes payment in person (e.g. mobile groomer at customer's home) | ✓ |
| Card-not-present, link-pay (SMS / WhatsApp / email) | בקשה לתשלום | Acquirer for online marketplace booking | ✓ |
| Bit (Israeli P2P/merchant payment rail) | חיוב עם ביט | Acquirer for low-friction Israeli customer payment | ✓ |
| Authorise-then-capture / hold | חיוב ללא אובליגו (חדש) | Acquirer for booking-deposit / no-show protection | ✓ (but **vendor terms must be confirmed** — see §10 Q4) |
| Recurring / subscription | הוראות קבע (UPay bottom-nav) | Acquirer for subscription products (Prestige Pass, etc.) | ✓ — overlaps with SUMIT הוראות קבע, **pick one** |
| Digital cheque | צ׳ק דיגיטלי | Niche; uncommon in marketplace flows; **likely out of scope for v1** | ✓ available, not used at v1 |
| Fiscal document issuance | הוספת מסמך חדש (5 doc types) | Document-of-record issuer | **OPEN** — CPA picks SUMIT vs UPay (§10 Q1) |
| Provider Masav payout | NOT a UPay feature; SUMIT חיוב מס"ב module covers this | Direct-debit batch out to providers (Part 4) | ✗ UPay; ✓ SUMIT |
| Refund / credit-note issuance | חשבון זיכוי in UPay's document flow | Document side of refund (Part F-104; PR-COMPLIANCE-3) | ✓ available — **must pair with money-side reversal** (§10 Q3) |

UPay does **not** appear to offer Nayax-style unattended kiosk acquiring. That stays Nayax.

---

## 5. SUMIT capability map (against Part-0 roles)

| Capability | SUMIT surface | Part-0 role | Covered? |
|---|---|---|---|
| Bookkeeping / הנהלת חשבונות | Module: הנהלת חשבונות | Book of record | ✓ |
| Income tracking / הכנסות | Module: הכנסות | Revenue ledger | ✓ |
| Expense tracking / הוצאות | Module: הוצאות | Expense ledger | ✓ |
| Customer master / לקוחות | Module: לקוחות | Customer entity registry | ✓ — must reconcile with our `users` table by email/phone/Israeli-ID |
| Quick credit-card clearing / סליקת אשראי | Module + quick action | Acquirer for one-off charge | ✓ (likely calls UPay underneath) |
| Quick fast-clearing / סליקה מהירה | Quick action | Acquirer for one-off charge — even faster | ✓ (likely calls UPay underneath) |
| Recurring / standing orders / הוראות קבע | Module | Subscription billing | ✓ — overlaps with UPay הוראות קבע |
| Masav direct-debit / חיוב מס"ב | Module | Provider payout (Part 4) | ✓ |
| Payment pages / דפי תשלום | Module | Customer-facing buy+pay landing pages (e-gift purchase, prestige-pass purchase, etc.) | ✓ — overlaps with UPay בקשה לתשלום |
| Email blast / דיוור במייל | Module | Customer comms — **out of scope for finance**, FYI only | n/a |
| SMS blast / שליחת סמסים | Module | Customer comms — **out of scope for finance** | n/a |

SUMIT also has its own document issuance (חשבונית מס/קבלה via the quick action). Combined with UPay's 5 doc types, this is the heart of §10 Q1.

---

## 6. The kiosk vs marketplace separation — restated for the CPA

> CPA: skip directly to §10 if you only want the questions that need your sign-off. This section is the engineering rationale for why those questions matter.

### 6.1 Kiosk wash (K9000 + Nayax)

- Pet Wash Ltd is the **legal seller** (Part 0.1).
- The customer pays at the machine. Nayax authorises the card. Money flows: customer card → Nayax → bank operating account (settled daily).
- Pet Wash issues a **קבלה** (or חשבונית מס/קבלה) to the customer for the wash. New code must use Pet Wash Ltd company number **517145033**. Historical receipts under the wrong hard-coded `516788400` (forensic-audit finding F-104) require a CPA decision under **§10 Q8**: re-issue, corrective document, or fix-forward-only.
- **No provider exists.** No payout split. No escrow. No marketplace logic.
- VAT is recognised at the moment the wash session is delivered (≈ instant after card auth). One transaction, one document.
- If the wash fails (machine offline, water out), the refund is a **chargeback or a manual reversal initiated by Pet Wash** — issued via SUMIT or UPay as a **חשבון זיכוי**, money refunded via Nayax reversal.

### 6.2 Marketplace booking (sitter / walker / groomer / transport)

- Pet Wash Ltd is the **marketplace facilitator** (Part 0.1).
- The customer pays online (UPay payment link or in-person via UPay card-present at the provider) or in advance (UPay capture).
- Customer-facing price = service fee + platform fee. Per Part 0.6, customer receives:
  - A **platform-fee invoice** from Pet Wash (the platform fee).
  - A **service-fee invoice** for the provider's service (issued by the provider, OR issued by Pet Wash on the provider's behalf — Part 0.6 self-billing model — **CPA picks**, §10 Q5).
- VAT is recognised differently for each leg:
  - Platform-fee leg → Pet Wash is VAT obligor.
  - Service-fee leg → provider is VAT obligor **only if** עוסק מורשה. עוסק פטור provider charges no VAT.
- Provider payout = service fee net of platform fee, paid via SUMIT Masav (Part 4).

### 6.3 Why these two flows must never share code paths

The forensic audit (F-1, F-5, F-7, F-8) shows that the current codebase already has cross-contamination between kiosk and marketplace flows. This doc's recommendation is that PR-NAYAX-* (kiosk) and PR-UPAY-* (marketplace) **must not share a money-mutation code path**. The unified-payment-abstraction in `01-unified-payment-abstraction.md` provides a shared **interface** (call shape, idempotency keys, audit hooks), but the **implementations** must be separate per channel. Kiosk PR class never calls marketplace ledger entries; marketplace PR class never calls kiosk ledger entries.

---

## 7. E-gift CRITICAL FINANCE RULE

**This section is a verbatim CPA-readable transcription of the CEO directive (2026-05-09) plus mapping to the existing 02-wallet-redesign bucket model.** Do not paraphrase. If a future PR conflicts with this section, the PR is wrong.

### 7.1 Headline rule

E-gift is a **deferred obligation owed by Pet Wash to the customer** (Part 0.4.3 stance). Colloquially this is similar to "stored value", but **explicitly not a legal conclusion** in the Israeli regulatory sense — Part 0 risk register flags *"Wallet treated as stored value without licence — Regulatory exposure"* (00-platform-role-model.md line 336). E-gift purchase is **not** regular income at purchase time. Already bucket-separated in `02-wallet-redesign.md` (`wallet.gift_card_received` bucket). This section adds the **lifecycle** that the existing docs left implicit.

### 7.2 The 10 lifecycle steps (each is a separate ledger event)

1. **Purchase through UPay/SUMIT.** Customer pays Pet Wash for an e-gift of nominal value V. Money in. **Bank-side custody:** must follow the Part 0.4 trust-segregation stance — funds owed back to the customer as services or refund must not co-mingle with Pet Wash's operating funds. The specific bank account designated to UPay is **gated by §10 Q12** and must NOT be submitted to UPay until Counsel + CPA answer Q12 in writing. **Ledger:** `cash_in_transit_upay` debit, `wallet.gift_card_received` credit (deferred obligation per Part 0.4.3). **Document:** receipt or חשבונית מס issued per CPA decision (§10 Q1). **What is NOT created:** no `wallet.cash` credit; no provider record; no booking record.
2. **Stored-value balance creation.** The `wallet.gift_card_received` bucket increments by V. This bucket is **firewalled** from `wallet.cash`, `wallet.refund_credit`, `wallet.escrow_pending`, and from any provider wallet.
3. **Redemption at K9000 / Nayax wash station.** Customer activates a wash with e-gift. **No provider.** Pet Wash is the seller. **Ledger:** `wallet.gift_card_received` debit (liability discharged), `revenue_kiosk_wash` credit (pre-VAT), `vat_output` credit (VAT). **Document:** קבלה for the customer; UPay/SUMIT receives the document via vendor sync; SUMIT records the income. **Required external references:** session ID (K9000), Nayax transaction reference, internal ledger entry ID. **Idempotency key:** the K9000 session ID itself, so a retry never double-burns the gift card.
4. **Redemption for sitter / walker / academy / marketplace booking.** Customer pays a booking with e-gift. **Provider exists** (sitter, walker, groomer, transporter, **academy instructor**, etc.). Pet Wash still owes the provider their service fee. **Ledger:** `wallet.gift_card_received` debit (liability discharged), `provider_payable_<provider_id>` credit (Part 4 payable), `revenue_platform_fee` credit (pre-VAT) + `vat_output` credit on platform fee, `provider_service_fee_passthrough` credit (per Part 0.6 self-billing or provider-issued model). **Documents:** platform-fee invoice from Pet Wash; service-fee invoice (per §10 Q5). **VAT timing:** at booking completion, NOT at e-gift purchase. **Provider payout fires later** via SUMIT Masav, regardless of the fact that the customer paid with e-gift. PetWash Academy is a marketplace channel for fiscal/provider purposes, even though its product (training course) differs from a wash/walk/sit booking.
5. **Partial redemption.** E-gift V₁; service S₁ where S₁ < V₁. Remainder R = V₁ − S₁ stays in `wallet.gift_card_received`. **Each redemption is a separate ledger transaction with its own idempotency key.** No "merge" of remainders across e-gifts (FIFO consumption per `02-wallet-redesign.md`'s consumption ordering).
6. **Refund / cancellation / credit-note flow.** No row is ever **deleted**. Every reversal is a **reversing ledger entry** with its own ID, and a **חשבון זיכוי** is issued (per §10 Q2 — UPay or SUMIT issues it). The credit-note's `corrects_invoice_id` field links to the original document (Part 2 + PR-COMPLIANCE-3 lineage). The customer's gift balance is restored to the bucket the redemption originally drew from (`wallet.gift_card_received`, not `wallet.cash`).
7. **Expiry / breakage.** **CPA decision required.** Israeli gift-card law (`חוק הגנת הצרכן`) sets a minimum lifetime; expiry rules vary by gift-card class. When (and whether) an unredeemed e-gift can be recognised as company income (breakage) is **not** an engineering decision. Until CPA rules, the engineering default is: e-gift balances **do not expire** and remain on the trust-fund liability ledger indefinitely.
8. **VAT timing.** **CPA decision required.** Possible answers: (a) VAT at e-gift purchase, on the gross gift amount; (b) VAT at redemption, on the service price; (c) split — VAT on platform fee at purchase, VAT on service at redemption. Each has different implications for cash flow, refunds, and the deferred-liability stance. Until CPA rules, the engineering default follows Part-0 0.4.3 deferred-obligation stance: VAT recognised at redemption, on the redemption value.
9. **Provider payout when e-gift funds a booking.** Provider is paid the same amount they would be paid for a non-e-gift booking. The customer's payment method is **invisible to the provider**. SUMIT Masav payout fires per Part 4 cadence regardless of whether the funding source was e-gift, cash, or card.
10. **Full audit chain + idempotency.** Every operation above produces an `audit_events` row (Part 9) AND an append-only ledger row (Part 2). Every operation has an idempotency key (booking ID, session ID, e-gift purchase ID) so retries never double-burn or double-refund.

### 7.3 The hard separations (never mix these buckets)

1. **K9000 redemption ≠ marketplace redemption.** No shared code path. No shared ledger account. K9000 redemption produces `revenue_kiosk_wash`; marketplace redemption produces `provider_payable` + `revenue_platform_fee`. They differ in legal seller, VAT obligor, document type, and refund path. **K9000 wash transactions never create provider payouts. Marketplace transactions (sitter / walker / academy) MAY create provider payable.**
2. **E-gift balance ≠ provider wallet.** Provider wallet (if/when introduced) is `provider_payable_<provider_id>` — a payable, owed FROM Pet Wash TO provider. E-gift balance is `wallet.gift_card_received` — a payable, owed FROM Pet Wash TO customer. They are obligations to different parties; they must never share a balance row.
3. **Promo credit ≠ e-gift.** Promo credit is **marketing-expense logic**, not stored value. Issued by Pet Wash for free, recognised as a marketing expense at issuance (or at redemption — CPA decides, §10 Q9). Not refundable for cash. Legally not stored value. E-gift was **paid for by the customer**; refundable per §10 Q3; deferred-obligation per Part-0 0.4.3. The two flows have **different P&L treatment**. They share no bucket. (`02-wallet-redesign.md` does not yet name a `wallet.promo_credit` bucket; that is §10 Q9.)
4. **Cash wallet ≠ e-gift.** `wallet.cash` is customer-funded credit at par with cash (`02-wallet-redesign.md` row 1). `wallet.gift_card_received` is a separate bucket subject to gift-card law. They must never be summed into a single "balance" surfaced to the user without bucket attribution.
5. **Refund credit ≠ e-gift.** `wallet.refund_credit` is the bucket that holds funds returned to a customer when a booking is reversed. It has its own redemption + expiry rules and a different lineage to original invoice. It is never "topped up by purchase".
6. **Loyalty points ≠ money.** Loyalty points are NOT a money object. They do not appear in the `Money` ledger (Part 2). They do not have currency, do not accrue VAT, and do not appear on a fiscal document — **unless and until** CPA / Counsel define an explicit conversion-to-money point at which a loyalty redemption becomes a money event (e.g. "100 points = ₪10 promo credit at redemption"). Until that conversion event, points are a customer-engagement counter, not a balance.

### 7.4 What this means in plain English (for the CEO's team)

- A customer who buys ₪200 of e-gift has not given Pet Wash ₪200 of revenue. They have **prepaid for future services**. Pet Wash owes them ₪200 of services until they redeem.
- When they redeem at a K9000 for ₪40, ₪40 of revenue is recognised that day. Their balance drops to ₪160.
- When they redeem the remaining ₪160 at a sitter booking, ₪160 of revenue is split between platform fee + provider service fee. The provider is paid their cut, in cash, by Pet Wash, via SUMIT Masav, on the next payout cycle. The customer's e-gift balance drops to ₪0.
- If they ask for a refund of the unused ₪40 mid-stream, Pet Wash issues a חשבון זיכוי, the e-gift balance drops to ₪0, and ₪40 of cash leaves the trust account.
- **At no point** does any money sit in a "provider wallet" or "marketplace escrow" or a "K9000 provider balance". Those concepts do not exist for e-gift.

---

## 8. 2026 חשבוניות-ישראל timeline — IMMEDIATE OPERATIONAL FLAG

The Israeli digital-invoice law (`תקנות מס הכנסה (חשבונית דיגיטלית)`) requires Pet Wash to obtain an **allocation number (מספר הקצאה)** from רשות המסים for high-value tax invoices BEFORE the invoice is issued.

| Effective date | Threshold (pre-VAT) | Source |
|---|---|---|
| Today (2026-05-10) | Tax invoices > **₪10,000** ex-VAT require an allocation number | תקנות מס הכנסה (חשבונית דיגיטלית) — current rule |
| **2026-06-01** (≈3 weeks away) | Threshold **drops to > ₪5,000** ex-VAT | Same regulation, scheduled drop |

**This means:** by 2026-06-01, every Pet Wash tax invoice over ₪5,000 ex-VAT must carry a SHAAM allocation number, OR the document is non-compliant.

**Forensic audit finding F-104** (`docs/finance/transaction-lifecycle-forensic-audit.md`) already pinned that the current code has `IsraeliDigitalReceiptService.isShaamRequired` checking the threshold but `shaamAllocationNumber` never being fetched. **For any marketplace booking ≥ ₪10K** (multi-week sitter, multi-day daycare, multi-pet bundle, group bookings), no allocation number is sent today. After 2026-06-01, the same gap opens at ₪5K — which is far more frequent.

**Operational implications for SUMIT/UPay adoption:**

1. **Whoever issues the document (SUMIT or UPay — see §10 Q1) must be the entity that holds the SHAAM allocation-number flow.** Pet Wash should not implement allocation-number fetching independently if SUMIT or UPay already does it; if neither does, this is a Pet Wash-side requirement.
2. **Vendor confirmation needed:** does UPay's חשבונית מס flow handle allocation-number requests automatically? Does SUMIT's חשבונית מס/קבלה flow handle them? **This is a vendor-discovery question for PR-UPAY-1 / PR-SUMIT-1.**
3. **CPA action item:** confirm Pet Wash is registered for SHAAM digital invoices and has the necessary credentials. If not, registration must complete BEFORE any invoice ≥ threshold is issued.

This is **not deferrable**. The threshold drop is calendar-locked.

---

## 9. Hard firewall

### 9.1 Forbidden actions

The following are forbidden until §10 questions are CPA + Counsel-answered AND a separate runtime PR (per §11) is approved.

1. **No live SUMIT API call** from production code (no `SUMIT_ENABLED=true` deploy).
2. **No live UPay API call** from production code (no UPay client implementation).
3. **No deletion** of any Stripe / Tranzila reference.
4. **No removal** of `SUMIT_ENABLED` / `SUMIT_API_KEY` / `SUMIT_WEBHOOK_SECRET` env declarations (they are scaffolding; keep them).
5. **No automated invoice issuance** to any customer.
6. **No automated provider payout**.
7. **No automated refund / credit-note issuance**.
8. **No code path** that mixes K9000-channel money with marketplace-channel money.
9. **No code path** that treats e-gift balance as fungible with `wallet.cash`.
10. **No live wiring** of חיוב ללא אובליגו (booking holds) until vendor terms confirm the legal hold-period and release semantics.

### 9.2 Six readiness preconditions before any runtime PR treats SUMIT or UPay as a live provider

No runtime code may treat SUMIT / UPay as a live provider until **all six** of the following are satisfied **in writing**:

1. **UPay account activated.** Vendor confirms account is live (currently opened-but-not-active per §1 / §2.1 / §2.2 banner).
2. **API documentation obtained.** Written UPay API spec in our possession; covers auth, endpoints, request/response shapes, idempotency, error codes, rate limits.
3. **CPA confirms document of record** (§10 Q1) — SUMIT vs UPay vs split.
4. **Sandbox / test flow verified.** End-to-end transaction in sandbox: charge → webhook → ledger entry → fiscal document → reconciliation. Captured in regression tests that exercise the sandbox path.
5. **Webhook + auth + security model reviewed.** HMAC verification, replay protection, secrets in GCP Secret Manager (not in env files). Reviewed by engineering security-conscious owner.
6. **Reconciliation model approved.** Daily settlement file ↔ internal ledger ↔ SUMIT ↔ trust account — four-way tie-out; variance handling specified.

If any of the six is "not yet", the answer to "can we ship?" is "no."

### 9.3 What engineering may continue to do (without violating the firewall)

- Add docs (this doc; future SUMIT/UPay vendor-spec docs).
- Run vendor-discovery against **test environments** with explicitly non-production credentials.
- Pin behaviour with regression tests that **assert the firewall is intact** (e.g. tests that confirm no production code calls SUMIT, no production code calls UPay, kiosk and marketplace ledger paths do not cross).
- Add the missing `wallet.promo_credit` bucket to the schema **only as a separate, explicitly-approved schema-migration PR** (§10 Q9), and only after Counsel reviews the gift-card-law implications.

---

## 10. Open questions — REQUIRES CPA + COUNSEL SIGN-OFF

These are the questions that BLOCK the runtime PRs in §11. Each is labelled with the role that must answer it. Engineering will not pick a default if a question is left open; engineering will refuse to ship until the question is answered in writing.

**Q1. [CPA] — Document of record: SUMIT or UPay?**
UPay can issue all 5 fiscal document types (חשבונית מס / קבלה / חשבונית מס/קבלה / חשבון עסקה / חשבון זיכוי). SUMIT also issues חשבונית מס/קבלה. **Single source of truth required.** Working assumption: SUMIT = book + document of record; UPay = clearing rail; UPay issues no fiscal document independently — instead it instructs SUMIT to issue the document. CPA confirm.

**Q2. [CPA] — Credit-note issuer on refund.**
On a refund, who issues the חשבון זיכוי? Same answer as Q1 in most cases, but called out separately because UPay's refund flow may differ. Forensic audit F-104 + PR-COMPLIANCE-3 lineage must connect.

**Q3. [CPA] — Refund money path on e-gift redemption.**
When a customer refunds a partially-used e-gift, does the cash leave the trust account immediately (refund_credit_returned_via_acquirer) or does the balance restore to wallet.gift_card_received? Default answer in §7.2 step 6 is "balance restored", but cash refund is the legal customer right. **CPA decides which is the default and which is opt-in.**

**Q4. [Counsel] — חיוב ללא אובליגו legal status for booking holds.**
Is UPay's authorise-then-capture flow legally a "hold" (Pet Wash never takes the money) or a "charge" (Pet Wash takes the money and refunds on cancellation)? Israeli consumer law has different rules for the two. **No booking-hold UI ships** until Counsel answers.

**Q5. [CPA + Counsel] — Self-billing vs provider-issued service invoice.**
For a marketplace booking, does the provider issue their own חשבונית מס to the customer, or does Pet Wash issue an **on-behalf-of** invoice (self-billing)? Part 0.6 names this question; this doc does not resolve it. Has tax + legal implications for עוסק מורשה / עוסק פטור / חברה / private provider tiers.

**Q6. [CPA] — Provider tax-status documentation.**
How are עוסק מורשה, עוסק פטור, חברה, and legally-allowed private providers represented in (a) provider master record, (b) generated documents, (c) Masav payout, (d) withholding (ניכוי במקור)? Today nothing is captured; the field is conceptually missing.

**Q7. [CPA] — VAT timing for stored-value flows.**
- E-gift purchase → recognise VAT? When?
- Wallet top-up → recognise VAT? When?
- Promo credit issuance → recognise VAT? Probably not (no consideration), but confirm.
- Loyalty points redemption → recognise VAT? On what base?
- Refund of any of the above → reversal mechanics?
The §7.2 default (VAT at redemption) is engineering's working assumption pending CPA decision.

**Q8. [CPA] — Correction of historical wrong-company-number receipts (forensic audit F-104 + hard-coded `companyTaxId: '516788400'`).**
The current code issues receipts under company tax ID 516788400 which **does not match** the actual company number 517145033. CPA must specify the correction path: re-issue all affected receipts? Issue corrective documents? Flag-only (do nothing for past, fix forward)? This is a legal-correction question with a clock attached.

**Q9. [CPA + Engineering] — Promo credit bucket name.**
`02-wallet-redesign.md` currently lists `wallet.cash`, `wallet.gift_card_received`, `wallet.refund_credit`, `wallet.escrow_pending`. **Promo credit is not yet a named bucket.** Either it is a sub-class of `wallet.gift_card_received` (almost certainly wrong — different legal class), or it is a NEW bucket (`wallet.promo_credit`). Decide.

**Q10. [CPA] — SHAAM allocation-number ownership.**
Does SUMIT fetch the SHAAM allocation number on Pet Wash's behalf? Does UPay? Does Pet Wash have to integrate directly? Required answer **before 2026-06-01** when the threshold drops to ₪5,000 ex-VAT.

**Q11. [Counsel] — Agent vs principal model for marketplace transactions.**
Is Pet Wash the *agent* (provider sells; Pet Wash facilitates) or the *principal* (Pet Wash buys from provider, resells to customer)? Different VAT treatment, different invoice flow, different liability stance. Part 0 implicitly declares "marketplace facilitator" (= agent), but for online flows where Pet Wash takes payment first, the line blurs.

**Q12. [Counsel] — Trust-account requirement at SUMIT/UPay onboarding.**
Part 0.4 declares trust-fund segregation. SUMIT + UPay must accommodate this — funds collected for providers must land in a trust account, not the operating account. Confirm with the vendor that this is technically supported (separate bank account designation in their KYC).

---

## 11. Future runtime PR classes (proposed)

The CEO listed five new PR classes on 2026-05-10. Where they overlap with existing PR classes already in `docs/architecture/execution-pr-roadmap.md`, this doc proposes a **mapping**, not a duplicate. Registry edits (renames / merges / new entries) are a follow-up roadmap PR — **not** part of this docs-only PR.

| Proposed (CEO) | Maps to existing class | Recommendation |
|---|---|---|
| **PR-SUMIT-1** — docs + object mapping | (none yet — `01-unified-payment-abstraction.md` references PR-UPAY-1..7 but not a SUMIT-specific class) | **NEW class.** Author SUMIT object mapping (customer / income / expense / document / Masav-batch / recurring) against our `Money` + `users` + `bookings` + `invoices` schemas. Docs-only, no runtime. |
| **PR-UPAY-1** — activation + API discovery | **PR-UPAY-1 already exists** in execution-pr-roadmap.md (line 45) | **REUSE existing class.** Update its description to include "vendor activation contact + API discovery" as the first deliverable. |
| **PR-MASAV-1** — provider payout spec | (none yet — Part 4 is referenced but not registered as a PR) | **NEW class.** Spec the Masav file format, cadence, withholding handling, reconciliation. Docs-only, no runtime. |
| **PR-REFUND-1** — credit note lifecycle spec | **PR-COMPLIANCE-3 / 3-PARTIAL** already cover refund credit-note lineage (lines 523, 832 of execution roadmap) | **MERGE recommendation.** Either rename PR-COMPLIANCE-3 → PR-REFUND-1 (clearer name), or treat PR-REFUND-1 as the SUMIT/UPay-specific implementation of PR-COMPLIANCE-3. CEO + roadmap-owner pick. |
| **PR-INVOICE-1** — fiscal document lifecycle spec | **PR-UPAY-5** already covers invoice/receipt lifecycle (line 167 of execution roadmap) | **MERGE recommendation.** Either rename PR-UPAY-5 → PR-INVOICE-1, or treat PR-INVOICE-1 as the umbrella spec PR that PR-UPAY-5 (UPay-specific implementation) consumes. CEO + roadmap-owner pick. |

**No PR class above is started by THIS doc.** Each is a separate decision after §10 questions are answered.

**This doc does NOT edit `docs/architecture/execution-pr-roadmap.md`.** The PR-class registry is its own source of truth; the registry edit is a follow-up PR (a one-PR-purpose roadmap-amendment PR) that the CEO opens or approves. This doc only **proposes** the mappings; it does not register them.

### Suggested rollout order (the chain — for context only)

```
THIS DOC (sumit-upay-operating-model.md)              ← we are here
   │
   ├─→ §10 CPA + Counsel sign-off            (no PR; written approval)
   │
   ├─→ PR-SUMIT-1   docs: SUMIT object mapping
   ├─→ PR-MASAV-1   docs: Masav file format + payout cadence
   ├─→ PR-REFUND-1  docs: credit-note lifecycle (or merge with PR-COMPLIANCE-3)
   ├─→ PR-INVOICE-1 docs: fiscal document lifecycle (or merge with PR-UPAY-5)
   │
   ├─→ PR-UPAY-1    runtime: activation + API discovery (test creds only)
   ├─→ PR-UPAY-2    runtime: webhook HMAC + idempotency
   ├─→ PR-UPAY-3    runtime: adapter set
   ├─→ PR-UPAY-4    runtime: invoice/receipt issuance (consumes PR-INVOICE-1)
   ├─→ PR-UPAY-5    runtime: lifecycle (consumes PR-INVOICE-1 + PR-COMPLIANCE-1)
   ├─→ PR-UPAY-6    runtime: refund/credit-note (consumes PR-REFUND-1 + PR-COMPLIANCE-3)
   ├─→ PR-UPAY-7    runtime: production cutover
   │
   ├─→ PR-COMPLIANCE-1   numbering gap-detector (already in roadmap)
   ├─→ PR-COMPLIANCE-2   SHAAM digital signature (already in roadmap)
   │
   ├─→ TRANZILA RETIREMENT — only after the above prove out
   └─→ STRIPE RETIREMENT — only after Tranzila is gone
```

The chain is **linear**, not parallel. Skipping a step creates the blob §3.3 warned against.

---

## 12. What this doc does NOT do

- It does **not** modify any code.
- It does **not** modify any schema.
- It does **not** modify any env file or `.env.example`.
- It does **not** modify any package.json or lockfile.
- It does **not** modify any test file (other than nothing).
- It does **not** modify the existing finance / architecture docs (Part 0, Part 2, forensic audit, 01-unified-payment-abstraction, 02-wallet-redesign, 04-israeli-compliance).
- It does **not** edit `execution-pr-roadmap.md` to register new PR classes — that is a separate follow-up roadmap PR.
- It does **not** decide any §10 question. It frames them; CPA + Counsel decide.
- It does **not** authorise any production payment activation, any Tranzila / Stripe deletion, any provider payout, any invoice issuance, or any chiluv ללא אובליגו booking-hold flow.

If you find this doc later and you want to start any of the above, **stop**. Re-read §9 (hard firewall), then read §10 (open questions). If the question that gates your change is still unanswered, escalate to CEO + CPA + Counsel. Do not interpret silence as approval.

---

## Appendix A — Hebrew terminology (for the bilingual reader)

| Hebrew | English | Notes |
|---|---|---|
| חשבונית מס | Tax invoice | The legal document a VAT-registered seller issues to a customer. |
| קבלה | Receipt | Acknowledgment of payment received. Can stand alone (cash sale) or follow a חשבונית. |
| חשבונית מס/קבלה | Combined tax invoice + receipt | One document = invoice + payment proof. Common in retail. |
| חשבון עסקה | Pro-forma invoice | Pre-payment quote. Not a tax document. |
| חשבון זיכוי | Credit note | The legal document that reverses (or partially reverses) an earlier חשבונית מס. Mandatory on refund. |
| הוראות קבע | Standing orders / recurring | Bank direct-debit mandate. |
| חיוב מס"ב | Masav direct-debit (interbank batch file) | The Israeli interbank payment file format. Used for provider payouts. |
| חיוב ללא אובליגו | Charge without obligation | Authorise-then-capture / hold. UPay-specific feature flag. |
| מספר הקצאה | Allocation number | The SHAAM-issued number that must appear on a חשבונית מס over threshold. |
| עוסק מורשה | Authorised dealer (VAT-registered) | Charges VAT, files VAT returns. |
| עוסק פטור | Exempt dealer (small-business VAT exempt) | Does NOT charge VAT; below annual revenue threshold. |
| חברה | Limited company | Files corporate tax + VAT separately. |
| ניכוי במקור | Withholding at source | Pet Wash withholds tax from provider payout, remits to רשות המסים. |
| רשות המסים | Israel Tax Authority | The regulator. |
| חוק הגנת הצרכן | Consumer Protection Law | Governs gift cards, refunds, cancellations. |

---

## Appendix B — Cross-reference index

For any future agent picking up this doc cold, here's what to read next based on what you're trying to do.

| If you're working on… | Read first | Then |
|---|---|---|
| K9000 / Nayax integration | `docs/architecture/03-nayax-reconciliation.md` | This doc §3, §6.1 |
| Marketplace booking payment | `docs/finance/00-platform-role-model.md` Part 0.1 | This doc §3, §6.2, §10 Q5 + Q11 |
| Wallet bucket model | `docs/architecture/02-wallet-redesign.md` | This doc §7 |
| E-gift purchase / redemption | This doc §7 (full rule) | `02-wallet-redesign.md` for bucket impl |
| Refund / credit-note | `docs/finance/transaction-lifecycle-forensic-audit.md` F-104 + `docs/architecture/execution-pr-roadmap.md` PR-COMPLIANCE-3 | This doc §10 Q2, §11 PR-REFUND-1 |
| Provider payout | This doc §10 Q5/Q6, §11 PR-MASAV-1 | `00-platform-role-model.md` Part 0.5/0.6 |
| Stripe / Tranzila deletion | **STOP.** This doc §9 firewall #3. Wait for §11 chain to finish. | — |
| SHAAM / חשבוניות ישראל | This doc §8 | `04-israeli-compliance.md` + forensic audit F-104 |
| Adding a new PR class | `execution-pr-roadmap.md` (the registry) | This doc §11 for SUMIT/UPay-specific overlap |

— end of document —
