# SUMIT Transaction Matrix — Every Surface × Every Transaction × Every Edge Case (CEO 2026-08-16)

**Status:** DESIGN, no code. Every mapping references the CPA-approved
`server/services/sumitDocumentMapping.ts` and the money-invariants skill §2/§3.
No new tax logic is invented anywhere in this document — I only tabulate what
already exists and pin how each surface uses it.

**Origin — CEO 2026-08-16:**
> "each platform service, shop, egift, express checkout, redeem egift, booker and providers, all must be aligned right, each transaction not same, not same email confirmation. recording deal must be safe, saved, legal, wise logic, credit vs sale immediate, egift not sale, israel rules, what if only some amount used of egift, what than, all must be thought above and over many cases, payment to providers, declarations we made"

---

## 0. Principles (locked)

1. **PetWash owns the product. SUMIT owns the accounting.** PetWash decides WHAT happens (a wash was delivered / an eGift was purchased / a provider was accepted). SUMIT decides which fiscal document is issued and computes VAT via `getSumitDocumentMapping(paymentClass)` — the CPA-approved decision table.
2. **Every transaction records a `deal`.** A row in an audit-safe local table BEFORE the outbound SUMIT call, so a crash between "we took the money" and "SUMIT confirmed the doc" is recoverable, not silent.
3. **Every deal carries an idempotency handle** — the reconciler + retry code cannot double-issue a doc.
4. **Confirmation email/SMS text differs per surface** (customer expects "Prestige — Active", "Wash — Started", "eGift purchased", "eGift redeemed", "Booking accepted"). NONE of these is the fiscal document itself — SUMIT sends the חשבונית/קבלה/InvoiceAndReceipt separately with its own numbering.
5. **Business-rule-invariants are NOT touched** — commission %, refund tiers, wallet value, eGift expiry, VAT rate. This design only maps FLOWS, not RULES.

---

## 1. The CPA-approved decision table (recap — do not modify)

Source: `server/services/sumitDocumentMapping.ts`, CPA order refs #3/#4/#5.

| PaymentClass | SUMIT Type | VAT mode | Issuer role | Notes |
|---|---|---|---|---|
| `K9000_WASH` | InvoiceAndReceipt (חשבונית מס/קבלה) | FULL_VAT (18% on total) | PETWASH_PRINCIPAL | Sale-immediate at K9000 self-service |
| `K9000_PUBLIC_CARD` | InvoiceAndReceipt | FULL_VAT | PETWASH_PRINCIPAL | Walk-up card at K9000; Nayax clears, doc same |
| `SHOP_ITEM` | InvoiceAndReceipt | FULL_VAT | PETWASH_PRINCIPAL | Retail item, delivered on payment |
| `WALLET_TOPUP` | Receipt (קבלה) | NO_VAT_STORED_VALUE (0%) | PETWASH_STORED_VALUE | Money in, no service yet — tax deferred to redemption |
| `EGIFT_PURCHASE` | Receipt | NO_VAT_STORED_VALUE (0%) | PETWASH_STORED_VALUE | Voucher created — NOT a sale (CPA #5) |
| `EGIFT_REDEMPTION` | InvoiceAndReceipt | VAT_AT_REDEMPTION (18%) | PETWASH_PRINCIPAL | The redeemed portion IS the sale; VAT event lands here |
| `PROVIDER_BOOKING_COMMISSION` | Invoice (חשבונית מס) | VAT_ON_COMMISSION_ONLY (18% × 15% commission) | PETWASH_DISCLOSED_AGENT | Provider is the principal — PetWash's doc covers commission only |
| `PROVIDER_BOOKING_PRINCIPAL` | InvoiceAndReceipt | FULL_VAT | PETWASH_PRINCIPAL | Reserved for services CPA later classifies as principal-model |
| `REFUND` | CreditInvoice (חשבונית זיכוי) | CREDIT | PETWASH_PRINCIPAL | MUST reference original DocumentID; void-not-delete |
| `CREDIT_ADJUSTMENT` | CreditInvoice | CREDIT | PETWASH_PRINCIPAL | Same — for non-refund corrections |

---

## 2. Every customer surface — mapped

Legend: **PW-Deal** = the local audit row we write before the SUMIT call. **Confirm** = what the customer sees.

### 2.1 K9000 wash (self-serve station)
| Event | PW-Deal | SUMIT call | Confirm | Notes |
|---|---|---|---|---|
| Wash starts (paid) | `k9000_wash_events` row | createDocument(`K9000_WASH`) → InvoiceAndReceipt, FULL_VAT | SMS "הכביסה שלך התחילה" (already sent by K9000 flow) | Idempotency on `washHistoryId` |
| Refund (wash aborted mid-cycle by staff) | `refund_transactions` row keyed on original doc | createCreditDocument(`REFUND`, originalDocumentID) | SMS "החזר בוצע" | CPA requires reference to original |

### 2.2 K9000 public card (walk-up Nayax)
Same as K9000_WASH — separate class only because Nayax clears differently. Same doc, same VAT, same confirm.

### 2.3 Shop item (retail)
| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Purchase confirmed | `purchases` row (activation service) | createDocument(`SHOP_ITEM`) → InvoiceAndReceipt, FULL_VAT | Email "Order confirmed — receipt attached" |
| Return / refund | refund_transactions row | createCreditDocument(`REFUND`) | Email "Refund issued — credit note attached" |

### 2.4 Wallet top-up
| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Top-up cleared | `wallet_ledger` credit entry | createDocument(`WALLET_TOPUP`) → **Receipt, 0% VAT** | Email "Wallet loaded ₪X — receipt attached (tax on use)" |
| Later: wallet consumed for a taxable service | separate deal (below) | Depends on service — the wallet debit alone is NOT a SUMIT doc |

### 2.5 eGift — PURCHASE (buyer pays, voucher created)
| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Payment cleared | `e_gifts` row (voucher created) + `egift_events` audit | createDocument(`EGIFT_PURCHASE`) → **Receipt, 0% VAT** | Email to BUYER: "You purchased an eGift — receipt attached" |
| Voucher email to RECIPIENT | separate email (not a fiscal doc) | none | Email to RECIPIENT: "You received a PetWash eGift 🎁 code XYZ" |
| Buyer refund (before any redemption) | refund_transactions | createCreditDocument(`REFUND`) | Email "Refund issued" |

**CPA order #5 — eGift is NOT a sale at purchase.** The tax event is deferred to redemption or breakage.

### 2.6 eGift — REDEMPTION (partial or full)
This is the case the CEO called out — "what if only some amount used of egift, what then".

**Rule:** the SUMIT tax event covers ONLY the amount consumed. The voucher balance stays on `e_gifts.balance_cents` for the next redemption. Each partial redemption produces its OWN SUMIT `InvoiceAndReceipt` for its own consumed slice.

| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Full redemption (voucher balance == service price) | `egift_events` redeem row; `e_gifts.balance_cents = 0`; voucher marked spent | createDocument(`EGIFT_REDEMPTION`, gross = full price) → InvoiceAndReceipt, FULL_VAT | Email "Service confirmed — invoice attached; eGift fully used" |
| Partial redemption (voucher balance > service price) | `egift_events` redeem row for the CONSUMED portion; `e_gifts.balance_cents -= consumed`; voucher stays active with remainder | createDocument(`EGIFT_REDEMPTION`, gross = **consumed amount only**) → InvoiceAndReceipt, FULL_VAT on that slice | Email "Service confirmed — invoice attached; eGift balance ₪Y remaining" |
| Partial redemption (service price > voucher balance) | 2 legs: (a) egift redeem for FULL balance, (b) new payment leg for the remainder via the current surface | leg (a) → InvoiceAndReceipt for balance; leg (b) → InvoiceAndReceipt for remainder via the surface's own class (K9000/shop/booking) | Email "Service confirmed — invoice attached; eGift used ₪X + card ₪Y" |
| eGift expires (breakage) | `egift_events` breakage row when the CPA-declared expiry passes | createDocument(`EGIFT_REDEMPTION`, gross = unspent balance, marked breakage) — VAT event per CPA order #5 | Email is a business decision (do we notify?) — not touched here |
| Redeem-then-refund (refund the redemption service) | refund_transactions for the redeemed portion | createCreditDocument(`REFUND` linked to the redemption's InvoiceAndReceipt) → CreditInvoice | Email "Refund issued — credit note attached" |

**Idempotency handles for eGift:**
- Purchase: `egift-purchase:${eGiftId}`
- Redemption: `egift-redeem:${eGiftId}:${consumptionEventId}` (per-consumption, so partial redemptions each get their own doc without dedup collision)
- Refund: `refund:${originalDocumentId}:${refundEventId}`

### 2.7 Express checkout (fast shop / express booking)
Not its own payment class — it uses whichever of `SHOP_ITEM` / `K9000_WASH` / `PROVIDER_BOOKING_COMMISSION` the underlying purchase resolves to. The "express" is a UI shortcut, not a new tax event. Same doc + confirm as the underlying class.

### 2.8 Booking (provider marketplace — sitter / walker / academy)
| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Customer pays (money into escrow) | `booking_requests.status='payment_pending'`, escrow doc, idempotency-slot claim (already atomic per #1853) | Optional — no fiscal doc until service completes and customer confirms | Email/SMS "Payment authorized, provider notified" |
| Provider marks service complete | `booking_requests.status='provider_marked_complete'` | none yet | Email/SMS to customer "Provider marked complete — approve within 24h" |
| Customer confirms → escrow releases, commission taken | `booking_requests.status='completed/reviewed'` + earning record + ledger entries | createDocument(`PROVIDER_BOOKING_COMMISSION`, gross = 15% commission slice) → **Invoice** (not receipt — money was already held in escrow before this), VAT on commission ONLY | Email "Booking confirmed — invoice attached" |
| Customer cancels within refund tier | refund_transactions per tier | createCreditDocument(`REFUND`) for the customer's portion | Email "Cancellation processed — credit note attached" |
| Provider cancels (customer full refund + provider penalty) | refund_transactions + provider penalty ledger | createCreditDocument(`REFUND`) for customer; provider penalty is a separate PW-ledger event (no SUMIT doc — internal accounting) | Email "Cancellation refund issued" |

**Provider payout side (not a customer-facing doc):**
- PetWash pays the provider via Upay (per CPA declared arrangement) — this is a separate money-out event tracked in `pw_provider_payouts`.
- The provider issues THEIR OWN fiscal document (עוסק פטור/מורשה/חברה) to PetWash for the money they received — SUMIT's provider-side or manual per provider's own accounting.
- We do NOT issue a fiscal doc for the provider's slice — PetWash is disclosed-agent (CPA #3).

### 2.9 Provider — payment side (getting paid)
| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Provider is paid | `pw_provider_payouts` row + payoutGate audit | none from PetWash side — the provider issues their own doc to us (supplier invoice) | Provider dashboard: "Payout ₪X on YYYY-MM-DD" |
| PetWash records the provider's supplier invoice | `supplier_invoices` row → SumitClient.createDocument (supplier-invoice path already live) | createDocument via the supplier-invoice path (already implemented) | N/A — B2B not customer-facing |

### 2.10 Prestige (recurring subscription — coming via Phase 4 item 5/6)
| Event | PW-Deal | SUMIT call | Confirm |
|---|---|---|---|
| Join Prestige | `loyalty_profiles` + SUMIT chargeRecurring → returns `recurringId`; PW stores `prestige_subscriptions.sumit_recurring_id` | chargeRecurring → InvoiceAndReceipt for the FIRST charge (FULL_VAT if principal service) | Email "Welcome to Prestige — first receipt attached" |
| Renewal (SUMIT auto-charges) | webhook `recurring.charged` → PW updates `prestige_subscriptions.last_paid_at` | SUMIT auto-issues InvoiceAndReceipt (SUMIT sets `UpdateCustomerByEmail:true` — customer gets it directly) | Email from SUMIT (customer sees the invoice); PetWash sends optional "Renewal confirmed" |
| Renewal fails | webhook `recurring.failed` → PW moves `prestige_subscriptions.status='payment_failed'` + grace timer per existing rule | none | Email "Card declined — please update payment method" (rate-limited) |
| Customer cancels | Server calls `cancelRecurring`; waits for `{cancelled:true}` BEFORE flipping local state | cancelRecurring → SUMIT stops future renewals | Email "Prestige cancelled — access until YYYY-MM-DD" |

### 2.11 Wash package (prepaid bundle)
Design decision the CEO called out. Options:
- **Option A: Wallet-style stored value** — buyer pays, `WALLET_TOPUP` Receipt (0% VAT), wash consumption debits the wallet, each consumption issues `K9000_WASH` InvoiceAndReceipt for the consumed slice.
- **Option B: SUMIT recurring** — auto-refill at N remaining. Same as Option A per SUMIT doc.
- **Option C: Bundle-as-shop-item** — sold like SHOP_ITEM (FULL_VAT at purchase). Only correct if the bundle is treated as a delivered good at sale, which per CPA #5 stored-value logic it is NOT.

**Recommend Option A** (matches CPA #5 stored-value treatment). Not shipping code until the CEO confirms which of the three matches business intent.

---

## 3. Deal recording — the pattern

Every surface writes a **PW-Deal** row (in the surface's own table) BEFORE calling SUMIT:

```
PW-Deal (surface table)
   ↓ (crash-safe)
SumitClient.createDocument(...)
   ↓ (idempotent by ExternalIdentifier + Idempotency-Key)
SUMIT DocumentID persisted back on the PW-Deal row
   ↓ (webhook confirms)
sumit_outbound_events audit + confirmation email/SMS
```

If a crash lands between step 1 and 2:
- The reconciler (item 11 in the CEO's list) walks PW-Deal rows with no `sumit_document_id`, replays SumitClient with the same `ExternalIdentifier`. SUMIT's own idempotency (per `SearchMode:"Automatic"` / `ExternalIdentifier`) makes the replay safe — no double doc.

If a crash lands between step 2 and 3:
- Same replay lands the DocumentID on the PW-Deal row (SUMIT returns the same one; it's already in their books).

---

## 4. Confirmation emails — per surface

Each surface writes its own confirmation. These are SEPARATE from the fiscal document that SUMIT issues (SUMIT emails its own חשבונית). No single generic "sale confirmation" template.

| Surface | Trigger | Template | Sender |
|---|---|---|---|
| K9000 wash | wash started | "הכביסה שלך התחילה" | PetWash SMS |
| K9000 wash | wash completed | "הכביסה הושלמה" + optional loyalty points earned | PetWash push/email |
| Shop | purchase confirmed | "Order confirmed — receipt attached (SUMIT)" | PetWash email + SUMIT attaches fiscal doc |
| Wallet | top-up cleared | "Wallet loaded ₪X" | PetWash email; SUMIT emails Receipt |
| eGift buyer | purchase | "You purchased an eGift for X" | PetWash email; SUMIT Receipt |
| eGift recipient | voucher issued | "You received a PetWash eGift 🎁" | PetWash email — NOT a fiscal doc |
| eGift redeem | consumption | "Service confirmed — eGift used" + remaining balance | PetWash email; SUMIT InvoiceAndReceipt |
| Booking accept | provider accepted | "Provider accepted your booking" | PetWash push+email; no fiscal doc yet |
| Booking confirmed | customer confirms completion | "Booking confirmed — invoice attached" | PetWash email; SUMIT Invoice (commission) |
| Booking cancelled | any cancel | "Cancellation processed" per tier | PetWash email; SUMIT CreditInvoice if refund |
| Prestige join | first recurring charge | "Welcome to Prestige — first receipt" | PetWash email + SUMIT InvoiceAndReceipt |
| Prestige renewal | webhook recurring.charged | "Renewal confirmed" (optional) | SUMIT emails the InvoiceAndReceipt directly (UpdateCustomerByEmail) |
| Prestige card declined | webhook recurring.failed | "Card declined — please update" (rate-limited) | PetWash email |
| Refund | any refund | "Refund issued — credit note attached" | PetWash email + SUMIT CreditInvoice |

**No two surfaces share the same template.** Templates live in the existing `server/email/templates/` tree and are picked by the surface's own handler — not a generic dispatcher.

---

## 5. Israeli edge cases (all deferred to existing rules — none invented here)

| Case | Handling |
|---|---|
| Partial eGift redemption (see §2.6) | Per-consumption InvoiceAndReceipt for the CONSUMED slice only. Balance stays on voucher. |
| eGift breakage (expiry) | Per CPA #5, tax event at breakage. `EGIFT_REDEMPTION` doc for the unspent balance. Timing = existing eGift expiry rule (do NOT change). |
| Refund on stored value that was never redeemed | `REFUND` credit against the original `WALLET_TOPUP` / `EGIFT_PURCHASE` Receipt. VAT-neutral (both are 0%). |
| Refund on service that was redeemed with eGift | `REFUND` CreditInvoice against the redemption's InvoiceAndReceipt (FULL_VAT reversed). The eGift balance is REFUNDED to the wallet/original voucher per the existing refund policy (not touched here). |
| Provider cancels late | Existing tier rules (customer full refund + provider penalty). SUMIT-side: one CreditInvoice for the customer; provider penalty is a PW-ledger event, not a SUMIT doc (PetWash is disclosed-agent — the provider's income never went through our SUMIT). |
| Provider payout timing | Existing 72h escrow window. Payout timing is a business rule — not touched. |
| Business customer (has `CompanyNumber`) | SUMIT customer record carries `CompanyNumber`. Same doc types; the doc will show the company number on the invoice per SUMIT's own template. |
| Currency other than ILS | Not supported — every mapping is `ILS`. Reject at ingestion. |
| Foreign-tourist zero-VAT | Not implemented today. If added later, that's a new CPA declaration + new PaymentClass — not a change to existing mappings. |

---

## 6. Declarations — preserved verbatim

The CPA declarations we made (docs/finance and the money-invariants skill §3) are the source of truth. This design does not modify:

- VAT rate (18%)
- Commission (15% on marketplace bookings)
- Disclosed-agent vs principal classification per service
- Refund tier percentages
- eGift breakage/expiry timing
- Wallet stored-value 0% VAT at load
- Provider payout window
- SUMIT document types per payment class (getSumitDocumentMapping)

If any of these need to change, that's a separate CPA/CEO decision + a mapping update in `sumitDocumentMapping.ts` (which has an exhaustiveness guard — a new class must be mapped explicitly).

---

## 7. What ships next (in order, each behind a flag until sandbox-verified)

1. Complete SUMIT webhook lifecycle handlers (item 7 in CEO's SUMIT-lane list).
2. Customer payments/documents read adapter — one place PetWash asks SUMIT "what does this customer have on file" (item 8).
3. Account > Documents / Payments UI mounting the read adapter (item 9).
4. Saved payment methods UI (item 10) — reuses SUMIT `setForCustomer` + `getForCustomer`.
5. Prestige recurring wire-up using the adapter shipped in PR #1868 (item 6 from CEO's list).
6. Daily reconciler (item 11).

Every surface change ships behind its own feature flag. `SUMIT_CUSTOMER_SYNC_ENABLED` (from PR #1866) is the master gate for the customer sync piece; per-surface migration flags will follow.

---

**No merges without CEO approval.**
