# SDD: PetWash Commerce OS — One Unified Checkout & Payment Engine

| | |
|---|---|
| **Status** | Draft (design only — no code, no PRs) |
| **Date** | 2026-06-18 |
| **Author** | SDD Writer Agent (PetWash) |
| **Feature flag (umbrella)** | `ff.commerce_os.enabled` (default **OFF**) |
| **Sub-flags** | `ff.commerce_os.single_wash`, `ff.commerce_os.wash_packages`, `ff.commerce_os.egift`, `ff.commerce_os.memberships`, `ff.commerce_os.marketplace`, `ff.commerce_os.saas` |
| **Provider env gate** | `SUMIT_ENABLED=true` + `PAYMENT_PROVIDER_MODE=live` (see `server/lib/payment-provider-mode.ts:39`) |
| **Method** | `.github/skills/sdd-writer-iterative/SKILL.md` |
| **Requested by** | CEO (nir.h@petwash.co.il) on 2026-06-18 |
| **Sibling SDDs (read first — heavy overlap)** | `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md` (umbrella `ff.commerce.unified_purchase_lifecycle`), `docs/design/2026-05-25-commerce-promotions-pricing.md` (pricing/VAT primitives), `docs/design/2026-05-26-shop-module-physical-goods.md`, `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` |

> **Important reconciliation note.** A sibling SDD already designed a platform-wide
> `PaymentProviderRouter` + `PurchaseLifecycle` state machine
> (`docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md`). This document
> is the CEO's **simpler, sell-now framing** of the same goal: ONE `/api/checkout`
> entry, ONE webhook, an `activateProduct()` switch. Where the two differ, the
> guidance here is to **adopt the sibling's vocabulary** (lifecycle states, fee
> snapshots) but ship the **narrow Phase-1 slice** below first. This SDD does **not**
> authorize a second parallel commerce stack.

---

## 1. Summary

PetWash today reaches money through **at least five divergent paths**: the K9000 /
Nayax wash flow, the `/api/checkout` wash-package flow (Nayax hosted), the
`/api/gift-cards/purchase` eGift flow (Nayax, currently 503-gated), three booking
engines, and the wallet redemption engine. There is **no single checkout entry**
and **no single webhook** that activates a product after verified payment. The CEO
wants ONE engine: `Website/App → POST /api/checkout/create → SUMIT (system of
record) + uPay (gateway) → webhook → activateProduct(order) → invoice + wallet/
order/booking + notify + audit`. **Never trust the frontend; only the webhook
activates.**

Good news from the repo audit: **most of the spine already exists** — `SumitClient`
with hosted-checkout (`beginRedirect`) + server re-verify (`getTransaction`) +
HMAC webhook verification, a mounted SUMIT webhook receiver, a `UpayProvider`
(fails-closed pending the API6 spec), a full wallet ledger with idempotency/JTI/
holds, an eGift voucher system, a hash-chained `audit_ledger`, the unified booking
engine, and SUMIT receipt creation. **The work is consolidation and wiring, not a
from-scratch build.** The single biggest launch blocker is **vendor credentials +
the uPay API6 encryption spec**, not code.

This SDD inventories what exists vs. what is missing, defines the one checkout
engine and the `activateProduct` switch reusing existing services, reconciles the
data model against `shared/schema.ts`, lists the exact SUMIT + uPay capabilities/
credentials the CEO must confirm, designs the webhook safely, and gives the
**shortest safe path to actually selling** (single wash + packages + eGift).

---

## 2. Goals / Non-goals

### Goals
1. One authenticated entry point: `POST /api/checkout/create` returning a hosted
   `payment_url` (no card data ever touches PetWash).
2. One inbound confirmation: a signature-verified, idempotent webhook that is the
   **only** thing that activates a product.
3. One `activateProduct(order)` switch keyed on `PRODUCT_TYPE`, dispatching to the
   **existing** wallet / eGift / booking / membership services.
4. Reuse the existing schema (`orders`-equivalent, `payments`, `wallet_accounts`,
   `e_vouchers`, `memberships`, `bookings`, `audit_ledger`) — add only genuinely
   missing columns/tables.
5. Israeli law baked in: VAT 18% inclusive, total-inclusive price shown upfront
   (Consumer Protection §17a), SUMIT-issued חשבונית מס/קבלה.
6. Phase-1 ships single wash + wash packages + eGift behind sub-flags without
   breaking the live K9000/Nayax wash flow or the working booking-payment flow.

### Non-goals (this SDD)
- Building a second commerce stack parallel to the sibling SDD's router/lifecycle.
- Replacing Nayax for **in-machine K9000 card swipes** (Nayax stays at the machine;
  Commerce OS handles **online prepaid/eGift/packages** that are later *redeemed*
  at the machine).
- Auto-paying providers before service completion/approval (explicitly forbidden).
- Building the uPay API6 `msg` encryption (that is a separate, vendor-spec-gated PR).
- Physical-goods delivery routing (covered by the shop SDD).
- Migrating the three booking engines into one in Phase 1 (Phase 3; see §7/§13).

---

## 3. Repository context — current-state inventory

Every row cites real code. **Reuse these; do not reinvent.**

### 3.1 Capability inventory table

| Capability | State | Evidence (`path:line`) |
|---|---|---|
| **Online checkout entry** | **PARTIAL** | `POST /api/checkout` exists but is wash-package-only and Nayax-bound: `server/routes.ts:5862`. No generic `PRODUCT_TYPE` entry, no `payment_url` return. The CEO's `/api/checkout/create` is **MISSING**. |
| **SUMIT financial backend** | **PARTIAL (strong)** | `SumitClient` fully written: `createDocument` (B2B invoice) `server/services/SumitClient.ts:191`; `createCustomerReceipt` (חשבונית מס/קבלה) `:345`; `beginRedirect` hosted checkout `:498`; `getTransaction` re-verify `:545`; `verifyWebhookSignature` HMAC `:457`. **Not enabled** (no creds; `isWired()` false `:108`). Body field casing **unverified** vs real swagger (comments `:207`, `:495`). |
| **SUMIT hosted-payment routes** | **EXISTS** | `POST /api/payments/sumit/begin` + `GET /api/payments/sumit/return` (server-side re-verify): `server/routes/payments-sumit.ts:34,58`. Mounted `server/routes.ts:10870`. Returns 503 until wired. |
| **Payment webhook receiver** | **PARTIAL (skeleton)** | `POST /api/sumit/webhook` mounted at `server/routes.ts:9985`; handler `server/routes/sumit-webhook.ts:100`. HMAC-verified, rate-limited, writes audit row. **But it does NOT activate anything** — payload→activation is explicitly deferred (`:166-198`). This is the key Phase-1 gap. |
| **uPay gateway** | **PARTIAL (fails-closed)** | `UpayProvider`: config/health/reachability live; `createPaymentRedirect` **fails closed** pending the API6 `msg`/encryption spec: `server/services/payment-providers/UpayProvider.ts:104`. `UPAY_API_KEY` provisioned per header comment `:13`. Admin route `server/routes/admin-upay.ts`. |
| **Payment provider mode gate** | **EXISTS** | `getPaymentProviderMode` (live default, mock needs double opt-in in prod), `validateProductionPaymentSecrets` fail-closed when `SUMIT_ENABLED`/`NAYAX_ENABLED` lack secrets: `server/lib/payment-provider-mode.ts:39,112`. |
| **Wallet / credits** | **EXISTS (robust)** | `wallet_accounts` (cash/egift/washPackageCredits/promo/loyalty divisions) `shared/schema.ts:11640`; `credit_transactions` append-only ledger `:11679`; `redemption_sessions` `:11725`; `wallet_idempotency_keys` `:11907`; `wallet_jti_registry` `:11924`; `wallet_holds` `:11970`. `WalletService` API: `getOrCreateWallet` `server/services/WalletService.ts:69`, `addCredits` `:658`, `createRedemptionSession` `:187`, `confirmRedemption` (idempotent) `:265`, hold/release/debit `:1275,:1298,:1328`. |
| **Wash packages** | **PARTIAL** | `wash_packages` table (price editable in DB) `shared/schema.ts:527`; seeds `server/seeds/luxuryWashPackages.ts`. Purchase wired to **Nayax** + Firestore session `server/routes.ts:5933-5969`. Credits awarded **only on Nayax webhook** (good pattern). No SUMIT path yet. **No admin price-edit route found** (prices DB-editable but no UI/endpoint). |
| **eGift cards** | **PARTIAL** | `e_vouchers` (codeHash, STORED_VALUE, owner binding) `shared/schema.ts:540`; redemptions/events ledgers `:561,:572`. Purchase route `POST /api/gift-cards/purchase` is **double-gated 503** (`EGIFT_PURCHASE_ENABLED` + Nayax keys): `server/routes/gift-cards.ts:351,372`. `activate-wallet` credits `egiftBalanceCents` `:846`. Legacy `/redeem` disabled `server/routes.ts:3877`. |
| **Bookings (THREE engines)** | **EXISTS, divergent** | (1) `UnifiedBookingEngine` (draft→quote→confirm, immutable transaction stamp): `server/services/unified-booking/UnifiedBookingEngine.ts:60`. (2) `UnifiedLuxuryBookingFacade` routing per-platform engines (walk/pettrek/k9000): `server/services/booking-facade.ts`. (3) marketplace/sitter engines (`SitterAdvancedBookingEngine`, `EnhancedBookingService`). Known problem — consolidation target. `payment_intents` ties bookings to Nayax `shared/schema.ts:7774`. |
| **Memberships / subscriptions** | **PARTIAL/MESSY** | `memberships` table carries legacy `stripeSubscriptionId`/`stripeCustomerId` columns (Stripe is dead) `shared/schema.ts:8763`. Also `customerSubscriptions` `:2817`, `subscriptionPlans`/`userSubscriptions` in `shared/schema-enterprise.ts:493,532`. **No recurring billing engine wired.** `MembershipService.ts` exists. |
| **Invoices / receipts / tax** | **EXISTS** | `IsraeliInvoiceGenerator`, `IsraeliDigitalReceiptService`, `TaxSequenceService`, `SumitReceiptService` all present in `server/services/`. VAT 18% canonical `shared/israel-compliance-config.ts:30`; effective-dated schedule `:57`. `tax_invoices`/`smart_wash_receipts` tables `shared/schema.ts:1509,1595`. |
| **Audit (hash-chain)** | **EXISTS** | `audit_ledger` with `previousHash`/`currentHash`/`blockNumber` UNIQUE `shared/schema.ts:3702`; `AuditLedgerService.recordEvent` (in DB txn) `server/services/AuditLedgerService.ts:59`, `verifyChainIntegrity` `:417`, `createDailySnapshot` `:535`. Webhook already writes an audit row via `recordAuditEvent` `server/routes/sumit-webhook.ts:171`. |
| **Card tokenization storage** | **PARTIAL** | `customer_payment_tokens` (encrypted **Nayax** token, masked PAN) `shared/schema.ts:3981`. No SUMIT/uPay merchant-token storage yet (needed for Phase-2 recurring). |
| **Nayax (K9000 + online)** | **EXISTS** | `nayax_transactions` lifecycle `shared/schema.ts:794`; `nayax_webhook_events` (idempotency `eventId` UNIQUE) `:868`; `NayaxOnlinePaymentService.ts`, `NayaxSparkService.ts`. Webhook dedup `server/lib/nayaxWebhookDedup.ts`. |

### 3.2 Platform invariants that apply (must not be weakened)
- **Money is sacred; backend is the only source of truth.** Frontend success is never trusted (`server/routes/payments-sumit.ts:64` re-verifies server-side).
- **Every money mutation is idempotent and audited** (`wallet_idempotency_keys`, `nayax_webhook_events.eventId` UNIQUE, `audit_ledger.blockNumber` UNIQUE).
- **No fake success ("Rule H")** — providers fail closed when unwired (`UpayProvider.ts:119`, `SumitClient.ts:193`).
- **Production refuses to operate live without secrets** (`payment-provider-mode.ts:142`).
- **Stripe is dead; Tranzila is removed** — never reintroduce (`payment-provider-mode.ts:11-13`). The legacy `stripe*` columns on `memberships` are vestigial and must be ignored, not used.

---

## 4. Users & roles / accessibility

| Actor | May | May NOT |
|---|---|---|
| **Customer (auth)** | Call `/api/checkout/create`; be redirected to hosted page; redeem wallet/eGift/package at K9000 via QR | See/handle card data; activate a product via the frontend; set their own price |
| **Anonymous** | View catalog + total-inclusive prices (§17a) | Create checkout (Phase 1 requires auth; matches `/api/checkout` today) |
| **Admin** | Edit prices (DB-backed, **new** route); view transaction log; reconcile; refund via SUMIT credit-invoice | Mark a payment paid by hand without a verified provider event |
| **SUMIT / uPay (system)** | POST signed webhooks; host the payment page; issue fiscal docs | Reach any PetWash route without HMAC signature |
| **K9000 / Nayax** | Confirm in-machine redemption of prepaid credits | Originate online card charges through Commerce OS |
| **System (webhook)** | Run `activateProduct`, credit wallet, issue receipt, notify, audit | Activate twice for one event (idempotency) |

**Accessibility / localization:** Hebrew-first, RTL. The total-inclusive price (VAT
included) and the line "המחיר כולל מע"מ" must be visible **before** the customer is
sent to the hosted page (Consumer Protection §17a). Receipts are issued by SUMIT in
Hebrew (`SumitClient.ts` sets `Language: 'he'`). The hosted page itself is SUMIT/uPay
chrome — confirm it renders RTL Hebrew (vendor checklist §5).

---

## 5. Architecture

### 5.1 Components (all but the orchestrator already exist)
- **CheckoutController** (`/api/checkout/create`) — *new thin orchestrator*. Validates `PRODUCT_TYPE` + quantity, loads the **server-side** price (never trusts the body), computes VAT-inclusive total, writes an `order` row in `payment_pending`, calls the payment session, returns `payment_url`.
- **Payment session** — reuse `sumitClient.beginRedirect()` (`SumitClient.ts:498`). uPay clears underneath SUMIT's hosted page, so **no direct uPay call is needed for Phase 1**. (Direct `UpayProvider.createPaymentRedirect` stays fails-closed until the API6 spec lands.)
- **Webhook receiver** (`/api/payments/webhook`) — extend the **existing** `server/routes/sumit-webhook.ts` to call `activateProduct` instead of only logging. (Decision in §9 / Open Q1: reuse `/api/sumit/webhook` vs add `/api/payments/webhook` alias.)
- **ProductActivationService.activateProduct(order)** — *new switch*, dispatching to existing services:

```
switch (order.productType) {
  SINGLE_WASH        → WalletService.addCredits(washPackageCredits:1) → QR redeem at K9000
  WASH_PACKAGE       → WalletService.addCredits(washPackageCredits:N)  [reuse webhook pattern routes.ts:5933]
  EGIFT_CARD         → EgiftFinancialService issue e_voucher (codeHash + QR), bind owner
  MEMBERSHIP         → MembershipService.activate (Phase 2; recurring via SUMIT)
  *_BOOKING          → UnifiedBookingEngine.confirm(bookingId)  (Phase 3)
  SAAS_SUBSCRIPTION  → finance subscription activate  (Phase 4)
}
```
  Then always: issue SUMIT receipt (`createCustomerReceipt`), notify (buyer/receiver split), append `audit_ledger` event.

### 5.2 Happy-path sequence (Phase-1 wash package)
```
Customer ──POST /api/checkout/create {productType:WASH_PACKAGE, packageId} (auth)
  └─ Controller loads price from wash_packages (server-side), computes VAT-incl total
  └─ writes order row: status=payment_pending, idempotencyKey, externalId
  └─ sumitClient.beginRedirect({externalId, amountIls(gross), redirectUrl})
  └─ returns { payment_url }
Customer ── redirected to SUMIT hosted page ── pays via uPay (Apple/Google/card/bit)
SUMIT ── issues חשבונית מס/קבלה ── POST /api/payments/webhook (HMAC signed)
  └─ verify signature → dedupe on eventId → load order by externalId
  └─ mark order paid (idempotent) → activateProduct():
        WalletService.addCredits(washPackageCredits = pkg.washCount)
  └─ record audit_ledger event → notify buyer
  └─ 200 OK
Customer ── /payment-success (display only; product already active from webhook)
```

### 5.3 Key failure paths
- **Customer abandons hosted page:** order stays `payment_pending`; a sweep job expires it after N hours; **no credits**.
- **Webhook never arrives / SUMIT down:** the `GET /api/payments/sumit/return` re-verify (`payments-sumit.ts:58`) is a **secondary** confirmation; it must enqueue the same idempotent `activateProduct`, not a parallel one. Reconciliation job (`DailyReconciliationJob.ts`) flags orders paid-at-SUMIT but not-activated.
- **Duplicate webhook:** deduped on event id (mirror `nayax_webhook_events.eventId` UNIQUE) → second call is a no-op 200.
- **Spoofed return querystring:** ignored; only HMAC webhook + server `getTransaction` are authoritative.
- **uPay/SUMIT unwired:** `/api/checkout/create` returns 503 (matches `beginRedirect` `wired:false`), never a fake success.

---

## 6. Data model (reconciled against `shared/schema.ts` — additive only)

**Reuse, do not duplicate.** The platform already has wallet, voucher, booking,
membership, audit, and tax tables. The only genuinely-missing concept is a
**unified order header + payment record** that is product-type-agnostic.

### 6.1 New tables (2)
1. **`commerce_orders`** — the one order header for every `PRODUCT_TYPE`.
   - `id` (uuid), `external_id` (unique, = SUMIT `ExternalIdentifier` + idempotency key),
     `user_id`, `product_type` (enum, the CEO's 8 values), `quantity`,
     `unit_price_cents`, `vat_cents`, `total_cents` (VAT-inclusive),
     `currency` default `ILS`, `status`
     (`payment_pending → paid → activated → fulfilled | cancelled | failed | refunded`),
     `sumit_transaction_id`, `sumit_document_number`, `provider` (`sumit_upay`),
     `metadata` jsonb (packageId / voucherId / bookingId after activation),
     `paid_at`, `activated_at`, `created_at`.
   - *Why new:* `pending_transactions` (`schema.ts:771`) is **package-only and
     Nayax-shaped**; `payment_intents` (`:7774`) is **booking+Nayax-shaped**. Neither
     is product-type-generic. `commerce_orders` is the missing generic header.
     (The sibling SDD calls these `purchase_events` — pick ONE name in Open Q2.)
2. **`commerce_webhook_events`** — idempotency + raw payload for `/api/payments/webhook`.
   - `event_id` (unique), `provider`, `event_type`, `order_external_id`,
     `processed` bool, `processed_at`, `raw_payload` jsonb, `created_at`.
   - *Why new vs reuse `nayax_webhook_events`:* that table is Nayax-specific; a
     SUMIT/uPay event table keeps providers cleanly separated. (Alternatively add a
     `provider` column to `nayax_webhook_events` and rename — Open Q3.)

### 6.2 Reused tables (no new parallels)
- Wallet credit grant → `wallet_accounts` + `credit_transactions` via `WalletService.addCredits` (`WalletService.ts:658`). `source_type='purchase'`, `source_id=order.id`.
- eGift issuance → `e_vouchers` + `e_voucher_events` (`schema.ts:540,572`).
- Membership → `memberships` (`schema.ts:8763`) — **ignore** the dead `stripe*` columns; add `sumit_recurring_id` (one new column, Phase 2).
- Booking confirm → `bookings` + unified `TransactionStampService` (Phase 3).
- Receipt → `tax_invoices` / SUMIT doc number on `commerce_orders.sumit_document_number`.
- Audit → `audit_ledger` (`schema.ts:3702`); add `'order_paid'`, `'product_activated'` to the `eventType` enum (`schema.ts:3744` — note the enum is narrow today; widen it).

### 6.3 New columns (minimal)
- `wash_packages`: none needed (price already DB-editable; admin route is a route, not a column).
- `memberships`: `+ sumit_recurring_id varchar` (Phase 2).
- `customer_payment_tokens`: `+ provider varchar default 'nayax'` + `+ sumit_token varchar` (Phase 2 recurring; today it is Nayax-only `schema.ts:3981`).

---

## 7. Phase 1 cut-list — the shortest safe path to selling

**Goal: sell single washes, wash packages, and eGift cards online, with a real
SUMIT invoice, behind flags, without touching the live K9000/booking flows.**

### What must be true to take the first real shekel
1. **CEO provides credentials** (the real blocker — §8): `SUMIT_API_KEY`,
   `SUMIT_COMPANY_ID`, `SUMIT_WEBHOOK_SECRET`, set `SUMIT_ENABLED=true`,
   `SUMIT_SANDBOX=true` first.
2. **Verify SUMIT body shape in sandbox** — the field casing in `SumitClient`
   (`createDocument`/`createCustomerReceipt`/`beginRedirect`) is **unverified** vs the
   real swagger (`SumitClient.ts:207,495`). One sandbox round-trip confirms or fixes it.
3. **Build the thin orchestrator** `POST /api/checkout/create` (the only genuinely
   new code) for `SINGLE_WASH | WASH_PACKAGE | EGIFT_CARD`, loading server-side prices.
4. **Make the webhook activate** — extend `server/routes/sumit-webhook.ts` to look up
   `commerce_orders` by `external_id` and call `activateProduct` (idempotent), instead
   of only logging.
5. **`ProductActivationService` for 3 types** — wallet credits (single wash + package,
   reusing the proven `routes.ts:5933` award-on-webhook pattern) and eGift issuance.
6. **Un-gate eGift purchase** to route through Commerce OS / SUMIT instead of the
   503 Nayax path (`gift-cards.ts:351`).
7. **Admin transaction log + price edit** — read `commerce_orders`; one admin route to
   edit `wash_packages.price` (currently no endpoint).
8. **§17a price display** — total-inclusive price + "כולל מע"מ" before redirect.

### Explicitly deferred to later phases
- Memberships + recurring billing (Phase 2 — SUMIT recurring + Apple/Google merchant tokens).
- Sitting/walking/grooming marketplace through Commerce OS (Phase 3 — and the booking-engine consolidation).
- SaaS/franchise subscriptions (Phase 4).
- Direct uPay API6 charging (only needed if we ever bypass SUMIT's hosted page).

---

## 8. SUMIT + uPay confirmation checklist (the real launch blocker)

### 8.1 Credentials/secrets the CEO must provide
| Secret | Used by | Status |
|---|---|---|
| `SUMIT_API_KEY` | `SumitClient` | **MISSING** (`isWired()` false `SumitClient.ts:108`) |
| `SUMIT_COMPANY_ID` | `SumitClient` | **MISSING** |
| `SUMIT_WEBHOOK_SECRET` | webhook HMAC `SumitClient.ts:457` | **MISSING** |
| `SUMIT_ENABLED=true` + `SUMIT_SANDBOX=true→false` | gate `payment-provider-mode.ts:83` | OFF |
| `UPAY_API_KEY` | `UpayProvider` | **provisioned** per comment `UpayProvider.ts:13` (verify in Secret Manager) |
| uPay API6 `msg` + encryption spec | `UpayProvider.createPaymentRedirect` | **MISSING** — only needed for *direct* uPay; **not** needed if SUMIT hosts the page |

### 8.2 Capabilities to verify in SUMIT sandbox (before any prod send)
- [ ] Hosted checkout: `POST /billing/payments/beginredirect/` returns a usable `payment_url` (field name unverified — `beginRedirect` tries `RedirectURL/PaymentURL/URL` `SumitClient.ts:531`).
- [ ] Apple Pay / Google Pay / credit card / **bit** all selectable on the hosted page.
- [ ] Server re-verify: `POST /billing/payments/gettransaction/` returns an authoritative `Valid/Status` (`SumitClient.ts:545`).
- [ ] Fiscal doc: hosted charge issues a real חשבונית מס/קבלה with a sequential ITA number; OR we issue via `createCustomerReceipt` — confirm we are not double-issuing.
- [ ] Customer creation + `ExternalIdentifier` round-trips for idempotency.
- [ ] Document-type enum strings confirmed (`Invoice`/`InvoiceAndReceipt`/`CreditInvoice`) and body key **casing** (`SumitClient.ts:207`).
- [ ] Webhook: SUMIT can POST to `/api/payments/webhook`; confirm the **signature header name** (`x-sumit-signature` assumed `sumit-webhook.ts:109`) and the HMAC scheme matches our verify.
- [ ] Refund path: `CreditInvoice` issuance.
- [ ] (Phase 2) Recurring/subscription API + merchant-token storage.

---

## 9. Webhook design

- **Endpoint:** extend existing `server/routes/sumit-webhook.ts` (raw-body parser already correct for HMAC `:105`). Expose it as `/api/payments/webhook` (alias) or keep `/api/sumit/webhook` — Open Q1.
- **Signature:** `sumitClient.verifyWebhookSignature` (HMAC-SHA256, constant-time, `SumitClient.ts:457`). Reject 401 when secret unset or mismatch — already implemented (`sumit-webhook.ts:139`).
- **Idempotency:** insert into `commerce_webhook_events.event_id` (UNIQUE). On conflict → already processed → 200 no-op. (Mirror `nayax_webhook_events` pattern `schema.ts:868`.)
- **Activate-only-on-webhook:** the order moves `payment_pending → paid → activated` **only** inside the webhook handler, inside a DB transaction, wrapping `activateProduct`. The `/return` redirect re-verify (`payments-sumit.ts:58`) may *also* trigger the same idempotent activation as a fallback, but never a second one.
- **CSRF:** the webhook is a public POST — must be in the `AUTH_CSRF_EXEMPT` allowlist (`server/index.ts`) or it 403s in prod (known regression class). Confirm before launch.
- **Never trust the body's amount:** re-load `commerce_orders.total_cents` and, where possible, cross-check against `getTransaction`.

---

## 10. Security & fraud model

| Threat | Control |
|---|---|
| Client sets own price | Price loaded server-side from `wash_packages` / catalog; body price ignored (today's `/api/checkout` already does this `routes.ts:5881`). |
| Frontend fakes success | Only the HMAC webhook activates; `/return` querystring re-verified via `getTransaction` (`payments-sumit.ts:64`). |
| Replay / duplicate webhook | `commerce_webhook_events.event_id` UNIQUE → no-op. |
| Double-activation race | `activateProduct` runs in a DB txn; order status guard `paid→activated` is the lock; wallet grant uses `wallet_idempotency_keys` (`schema.ts:11907`). |
| Card data exposure | None stored; SUMIT/uPay hosts the form (PCI scope stays with vendor). |
| eGift code reuse / theft | `e_vouchers.codeHash` (never plaintext), owner-bound on claim, redemption ledger (`schema.ts:540,561`). |
| Provider paid before service | Commerce OS only **collects**; payouts gated by completion/approval elsewhere — Phase 3 must not auto-pay. |
| Audit tamper | `audit_ledger` hash chain + `verifyChainIntegrity` (`AuditLedgerService.ts:417`). **Known gap:** no automatic chain-verify cron and the K9000 ledger-insert was historically broken — schedule a verify job (Open Q4). |
| Mock-mode in prod | Double opt-in required (`payment-provider-mode.ts:59`); do not weaken. |

---

## 11. APIs / interfaces

### `POST /api/checkout/create` (new; auth required)
```
Request: { productType: PRODUCT_TYPE, packageId?|amountIls?|quantity?, idempotencyKey? }
Behaviour: load server-side price → compute VAT-incl total → insert commerce_orders
           (payment_pending) → sumitClient.beginRedirect → return payment_url
Response 200: { ok:true, orderId, payment_url, totalCents, vatCents }
Response 503: { error:'payments_not_enabled' }   // SUMIT unwired (no fake success)
Response 400: invalid product/price
```
Idempotency: same `idempotencyKey` (or `external_id`) returns the existing order's `payment_url`, never a second charge.

### `POST /api/payments/webhook` (public, HMAC)
```
Verify HMAC → dedupe event_id → load order → mark paid → activateProduct → receipt → notify → audit
Always 200 on signature-valid (even on internal partial failure, which is queued) so SUMIT stops retrying.
401 on bad/missing signature.
```

### Admin
- `GET /api/admin/commerce/orders` — transaction log (reuse admin RBAC).
- `PATCH /api/admin/commerce/prices/:packageId` — edit `wash_packages.price` (new; audited).

---

## 12. Money & audit (ledger movements)

- **On checkout create:** no money moves; order = `payment_pending`.
- **On webhook paid:** SUMIT issues חשבונית מס/קבלה (the fiscal record). PetWash writes
  `commerce_orders.sumit_document_number` + an `audit_ledger` `order_paid` event.
- **On activate (wash/package):** `WalletService.addCredits` writes one `credit_transactions`
  row (`source_type='purchase'`, idempotent) and updates `wallet_accounts.washPackageCredits`.
- **On activate (eGift):** `e_vouchers` issued + `e_voucher_events` `ISSUED`.
- **Reconciliation:** `DailyReconciliationJob` / `FinancialReconciliationService` cross-check
  `commerce_orders.paid` vs SUMIT docs vs wallet grants; flag mismatches to admin.
- **Refund:** SUMIT `CreditInvoice` + reverse the wallet/eGift grant + audit `refunded`.

---

## 13. Rollout & migration (must not break K9000 / bookings)

1. **PR-1 (schema + types only, zero behaviour):** add `commerce_orders`,
   `commerce_webhook_events`, the `audit_ledger` enum widening, the additive columns.
   Flag `ff.commerce_os.enabled` default OFF.
2. **PR-2:** `CheckoutController` + `ProductActivationService` (3 types) + webhook
   activation, all behind `ff.commerce_os.single_wash|wash_packages|egift`. SUMIT in
   **sandbox**. The existing Nayax `/api/checkout` and gift-card 503 paths stay as-is.
3. **Cutover:** flip eGift + packages to Commerce OS once sandbox passes; the old
   Nayax wash-package webhook path can run in parallel until verified, then retire.
4. **K9000 in-machine swipe stays on Nayax** untouched. Commerce OS sells the *prepaid*
   credits that K9000 later redeems via the existing wallet/QR flow.
5. **Booking engines (Phase 3):** route booking *payment* through Commerce OS first
   (collect online) while keeping each engine's scheduling logic; consolidate engines
   as a **separate** SDD — do not bundle into Phase 1.

---

## 14. Test plan

- **Unit:** price loaded server-side (body price ignored); VAT-inclusive math; `activateProduct` switch per type; idempotent webhook (same event_id twice → one grant).
- **Integration (SUMIT sandbox):** create→beginRedirect→webhook→wallet credited→receipt number present; eGift issue + redeem.
- **Fraud/abuse:** spoofed `/return` querystring rejected; tampered amount ignored; replayed webhook no-op; checkout while unwired → 503 not fake success.
- **Concurrency:** two webhooks for one order race → single activation (DB txn + status guard).
- **Regression guards (existing patterns to mirror):** `server/tests/wash-pack-bleed-stop.test.ts`, `walletTopupVerify.regression.test.ts`, `booking-calendar-after-payment.guard.test.ts`, `escrow-idempotency.test.ts`, `nayaxWebhookDedup.test.ts`, `sumitClient.test.ts`.
- **§17a:** snapshot test that the total-inclusive price + "כולל מע"מ" renders pre-redirect.

---

## 15. Rollback plan

- Set `ff.commerce_os.enabled=false` (and/or per-type sub-flags) → `/api/checkout/create`
  returns 503; old Nayax package path + gift-card 503 resume; no schema rollback needed
  (new tables are additive and inert when the flag is off).
- If a SUMIT body-shape bug ships: set `SUMIT_SANDBOX=true` to stop production sends
  immediately (no code deploy), then fix.
- Data reversal: any erroneously-granted wallet credit is reversed via
  `WalletService` adjust + `audit_ledger` `refunded`; eGift cancelled via `e_voucher_events`.

---

## 16. Open questions (human decision needed)

1. **Webhook path:** reuse `/api/sumit/webhook` (already mounted, `routes.ts:9985`) or add `/api/payments/webhook` alias as the CEO's spec names it? (Recommend alias → same handler.)
2. **Order table name:** `commerce_orders` (this SDD) vs `purchase_events` (sibling SDD `2026-05-26-payment-provider-routing-and-lifecycle.md`). **Pick one** to avoid a third parallel stack.
3. **Webhook event table:** new `commerce_webhook_events` vs add `provider` column to `nayax_webhook_events`.
4. **Audit chain verify cron** — schedule `verifyChainIntegrity`? (Known gap; recommend yes.)
5. **Does SUMIT's hosted page issue the fiscal doc itself, or must we call `createCustomerReceipt`?** Determines double-issue risk (verify in sandbox §8.2).
6. **bit** support — is it on the SUMIT/uPay hosted page or a separate rail?
7. **Single wash online** — does the CEO want a true online single-wash purchase, or is single-wash always an in-machine Nayax swipe with Commerce OS only selling packages/eGift? (Affects whether `SINGLE_WASH` is Phase 1.)
8. **Sibling-SDD reconciliation:** is Commerce OS the same program as `ff.commerce.unified_purchase_lifecycle`, or a fresh start that supersedes it? (Strongly recommend: same program, this is the Phase-1 slice.)

---

## 17. First implementation PR (smallest safe slice)

**PR-1: `commerce_os` schema + types only, flag OFF, zero behavioural change.**
- Migration: `commerce_orders`, `commerce_webhook_events`, widen `audit_ledger` event enum, additive columns.
- `shared/commerce-os/types.ts`: `PRODUCT_TYPE` enum + order/webhook interfaces.
- Feature-flag plumbing `ff.commerce_os.*` default OFF.
- Tests: schema migrates clean; types compile; no route mounted yet.
- **No payment code, no checkout endpoint, no activation** — that is PR-2, gated, sandbox-only.

---

## Summary block (per skill §5)

**Recommended first PR:** PR-1 above — schema + types only, flag OFF, no behaviour change.

**Out of scope:** second parallel commerce stack; replacing Nayax at the K9000 machine; auto-paying providers; uPay API6 direct-charge encryption; physical-goods delivery; booking-engine consolidation (Phase 3+); recurring billing (Phase 2).

**Open questions:** webhook path/alias; one order-table name across SDDs; webhook event table reuse vs new; audit-verify cron; whether SUMIT hosted page self-issues the fiscal doc; bit rail; whether SINGLE_WASH is online or in-machine; whether this supersedes the sibling lifecycle SDD.

**Key fraud/safety risks:** activate-only-on-webhook must be airtight (idempotency + DB-txn status guard); SUMIT body-shape is unverified until a sandbox round-trip; webhook signature header/HMAC scheme unconfirmed; public webhook must be CSRF-exempt or it 403s; audit chain has no auto-verify and a historically-broken K9000 insert.

**Tests needed:** server-side pricing, idempotent webhook, fraud (spoofed return, tampered amount, replay), unwired→503-not-fake-success, concurrency single-activation, §17a price display; mirror existing guards (`wash-pack-bleed-stop`, `walletTopupVerify`, `nayaxWebhookDedup`, `sumitClient`).

**Feature flags:** `ff.commerce_os.enabled` (umbrella, OFF) + per-type sub-flags; provider gate `SUMIT_ENABLED` + `PAYMENT_PROVIDER_MODE=live` + `SUMIT_SANDBOX` first.

**Rollback plan:** flip the flag → 503 + old paths resume (additive tables inert); `SUMIT_SANDBOX=true` instantly stops prod sends; wallet/eGift grants reversible via existing adjust + audit.

---

## Appendix A — Original request (verbatim)

> Author ONE Software Design Document (SDD) in docs/design/ for "PetWash Commerce OS" — a single unified checkout/payment engine that all product types flow through. Ground EVERYTHING in the actual repo: before designing, search the codebase and document what ALREADY EXISTS vs what's MISSING. Do not propose building from scratch what already exists.
>
> THE VISION (CEO's master instruction — preserve it verbatim in the appendix):
> ONE checkout system for ALL products — never separate payments per product. Flow: Website/App → PetWash backend commerce engine → SUMIT (financial backend: customers, invoices/receipts, recurring, payment-method tokens) + uPay (gateway: Apple Pay / Google Pay / credit card / bit, tokenization) → webhook confirms → activate product + wallet/order/subscription/booking + invoice + notify + audit log.
> PRODUCT_TYPE = { SINGLE_WASH, WASH_PACKAGE, EGIFT_CARD, MEMBERSHIP, PET_SITTING_BOOKING, DOG_WALKING_BOOKING, GROOMING_BOOKING, SAAS_SUBSCRIPTION }.
> Core endpoints: POST /api/checkout/create (→ payment_url/session) and POST /api/payments/webhook (verify signature → mark paid → SUMIT invoice → activateProduct(order) switch → notify → audit). NEVER trust frontend success; only the webhook activates. NEVER store cards; never expose secret keys to frontend; never activate before webhook; never auto-pay providers before service completion/approval. Prices editable from admin (not hard-coded in frontend). Phase 1 = single wash + wash packages + eGift + Apple/Google Pay/card hosted checkout + SUMIT invoice + wallet credits + QR redemption + admin transaction log. Phase 2 = memberships + recurring billing (SUMIT recurring + Apple/Google merchant tokens). Phase 3 = sitting/walking/grooming marketplace. Phase 4 = SaaS/provider/franchise subscriptions.
>
> MAP THE EXISTING REPO (search + cite file:line) — these likely already exist; the SDD must reconcile against them, NOT duplicate:
> - SUMIT integration: search server/ for SumitClient / sumit / OfficeGuy / officeguy — what create-document/charge/payment-session/recurring methods exist, what's wired, what's stubbed. (Memory: SumitClient exists; create-document body shape fixed in PR #776; "online rail = UPay(brand)/SUMIT(engine, api.sumit.co.il)"; historically blocked on SUMIT test creds.)
> - uPay: any uPay/Tranzila/Nayax payment gateway code. (Tranzila was killed; Nayax is K9000 only.)
> - Wallet/credits: WalletService, WalletLedger, BillingLedger, redemptionSessions, wash_packages, credit_wallet routes.
> - eGift: gift-cards routes/services, the unique single-use gift code + QR.
> - Bookings: unified-booking engine (UnifiedBookingEngine, TransactionStampService), marketplace-bookings, BookingLifecycleService — note there are THREE divergent booking engines (a known problem; the SDD should address consolidating onto the one commerce engine).
> - Invoices/receipts/tax: IsraeliInvoiceGenerator, TaxSequence, IsraeliDigitalReceiptService, israeli-compliance-config (VAT 18%, SHAAM allocation threshold), disclosed-agent VAT (15% commission vs 100% GMV).
> - Money safety already shipped: the resilient payment-reference guard (no booking confirmed without verified payment), the K9000 nonce single-use DB guard, the hash-chained audit ledger (AuditLedgerService) — but note its gaps (K9000 ledger insert was broken; ImmutableStampService ephemeral key; no auto chain verify).
> - Pricing-disclosure law (Israeli Consumer Protection §17a): total-inclusive price must show upfront — the SDD must bake this into the checkout.
>
> DELIVER in the SDD:
> 1. Current-state inventory: a table of each capability (customer, order, payment, wallet, package, gift, subscription, booking, invoice, audit, SUMIT, uPay) → EXISTS (file:line) / PARTIAL / MISSING.
> 2. Target architecture: the ONE checkout engine + the product_type activation switch, reusing existing services. Show how the 3 booking engines + K9000 + eGift + packages all route through it.
> 3. The data model reconciled against the EXISTING schema (shared/schema.ts) — reuse current tables (orders, payments, wallet, gift_cards, subscriptions, bookings, audit) rather than inventing parallel ones; list only genuinely-new columns/tables.
> 4. The SUMIT + uPay API confirmation checklist: exactly which API capabilities must be verified (hosted checkout, Apple/Google Pay, card, tokenization, recurring, webhooks/signature, customer + invoice creation) and which CREDENTIALS/secrets the CEO must provide (the real launch blocker).
> 5. Webhook design (signature verification, idempotency, activate-only-on-webhook).
> 6. Phase 1 cut-list: the SHORTEST safe path to actually selling (single wash + packages + eGift), with the specific gaps to close.
> 7. Risks (money-critical), and the migration/consolidation plan that does NOT break the working booking-payment + K9000 flows.
>
> This is a DESIGN DOC ONLY — no production code, no PRs. Write one markdown file to docs/design/. Be concrete and repo-grounded; the goal is the CEO + a programmer can see exactly what exists, what's missing, and the shortest safe path to start selling.
