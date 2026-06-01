# SDD: Universal Payment Provider Routing + Purchase Lifecycle (Platform-Wide)

| | |
|---|---|
| **Status** | Draft (design only — no code, no PRs) |
| **Date** | 2026-05-26 |
| **Author** | SDD Writer Agent (PetWash) |
| **Feature flag (umbrella)** | `ff.commerce.unified_purchase_lifecycle.enabled` (default **OFF**) |
| **Sub-flags** | `ff.payments.router.enabled`, `ff.payments.router.upay_direct`, `ff.purchase.lifecycle.shop`, `ff.purchase.lifecycle.wallet_topup`, `ff.purchase.lifecycle.gift_cards`, `ff.purchase.lifecycle.bookings`, `ff.purchase.lifecycle.franchise`, `ff.purchase.lifecycle.kiosk`, `ff.purchase.audit_unified`, `ff.notifications.buyer_receiver_split` |
| **Method** | `.github/skills/sdd-writer-iterative/SKILL.md` |
| **Requested by** | CEO (nir.h@petwash.co.il) on 2026-05-26 |
| **Sibling SDDs (read first)** | `docs/design/2026-05-25-commerce-promotions-pricing.md` (pricing/promotions/wallet/VAT primitives — **merged**); `docs/design/2026-05-26-shop-module-physical-goods.md` (PR #464 draft — physical-goods catalog/inventory/checkout/lifecycle, scoped to shop only) |
| **Codex prototype (out of repo)** | Files do NOT exist in this repo's branches yet. Codex (a different agent running on the operator's local machine) prototyped the shop-only lifecycle in: `ShopDeliveryRoutingService.ts`, `ShopOrderLifecycleService.ts`, `ShopOrderStateMachine.ts`, `migrations/0039_shop_purchase_lifecycle.sql`, `ShopNotificationPlanner.ts`, `ShopPaymentProviderPolicy.ts`. This SDD lifts those primitives to a platform-wide abstraction. |
| **Companion in-flight SDDs** | `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md`, `docs/design/2026-05-25-smart-identity-routing.md` |

---

## Table of contents

1. Executive summary
2. Goals / Non-goals
3. Repository context (what exists today, cited)
4. Users, roles, accessibility, localization
5. Architecture (components, data flow, sequences)
6. Universal PaymentProviderRouter (component A)
7. Universal PurchaseLifecycle state machine (component B)
8. Universal Receipt/Invoice subsystem (component C)
9. Universal Notification engine (component D)
10. Universal Delivery routing (component E)
11. Per-surface adapters (shop, wallet top-up, gift cards, bookings, franchise, kiosk)
12. Data model (new/changed tables, additive-first)
13. Security & fraud model
14. APIs / interfaces
15. Money & audit (ledger movements, reconciliation)
16. Rollout & feature flags
17. Test plan
18. Rollback plan
19. Open questions (§10 — 10+ items)
20. First implementation PR
21. Appendix A — original operator request (verbatim)
22. Appendix B — finance-confirmed rate table format
23. Appendix C — Codex prototype file map (out of repo)

---

## 1. Executive summary

PetWash has six paid surfaces today (or in flight): **service bookings** (wash, walk, sitter, trainer, academy), **shop physical goods** (PR #464 draft, sibling SDD `docs/design/2026-05-26-shop-module-physical-goods.md`), **gift cards** (`petWashVouchers2025` already in schema), **wallet top-ups** (K9000 prepaid balance), **franchise application fees**, and **kiosk products** (K9000 vending — `kioskProducts`, `kioskSales`). Each surface today reaches money differently: some go through `EnhancedBookingService`, some through `WalletEngine`, some through `EgiftFinancialService`, some through `NayaxOnlinePaymentService`. There is **no single router** that decides which clearing channel takes the swipe (SUMIT-aggregated UPAY vs uPay direct vs anything else), **no single lifecycle vocabulary** to audit a purchase from quote to fulfilment, **no single receipt source-of-truth statement**, **no single buyer-vs-receiver notification split**, and **no single delivery routing decision** (Wolt Packages vs Israel Post vs courier vs no-delivery).

Codex prototyped the answer for the **shop module only** (`ShopOrderLifecycleService.ts`, `ShopOrderStateMachine.ts`, `ShopPaymentProviderPolicy.ts`, `ShopDeliveryRoutingService.ts`, `ShopNotificationPlanner.ts`, migration `0039_shop_purchase_lifecycle.sql`). The operator's directive (Appendix A, verbatim) is to lift that thinking to **every paid surface** — one router, one lifecycle, one receipt subsystem, one notification engine, one delivery decision.

This SDD designs the **five platform-wide primitives**:

- **A. PaymentProviderRouter** — chooses SUMIT (legal system-of-record) vs UPAY direct (cheaper acquirer when eligible), driven by a finance-confirmed rate table and a fee snapshot per purchase. SUMIT remains the **legal "boss"** for invoices/receipts/accountant queue regardless of clearing channel.
- **B. PurchaseLifecycle state machine** — one canonical state vocabulary (`draft → quote_required → quoted → payment_pending → paid → receipt_pending → receipt_issued → fulfilment_pending → fulfilment_in_progress → fulfilled → completed` + `cancelled / failed / refunded / returned`) with per-surface fulfilment sub-machines (bookings → `scheduled/in_progress/service_completed`; gift cards → `issued/activated/redeemed`; wallet → `credited`; franchise → `application_under_review/approved/rejected`; kiosk → `vended`; shop → Codex's existing chain).
- **C. ReceiptInvoice subsystem** — SUMIT-only legal receipts platform-wide. `receipt_issued` only when SUMIT returns a real receipt number. `receipt_failed` surfaces to a finance/admin queue. `transactionId` stored separately from `receiptNumber`. VAT + payment fees + clearing fees + provider fees snapshotted at quote time, never recomputed at receipt time.
- **D. NotificationEngine** — buyer-vs-receiver split extended platform-wide. Receiver **never** sees payment/fee details on any surface. Hebrew-first, English fallback. Channels: email + SMS + in-app push + WhatsApp.
- **E. DeliveryRouter** — Wolt Packages / Israel Post / courier / pickup / digital (no delivery) / scheduled-service (no delivery). Constraints lifted from Codex's shop logic with per-surface overrides.

No production code lands from this SDD. The contract here is a **shared TypeScript type pack** (`shared/purchase-lifecycle/*.ts`), five new service classes (`server/services/commerce/*`), one new migration with two new tables (`purchase_events`, `payment_provider_routes`) plus narrow additive columns on six existing tables, and a per-surface adapter pattern. Per-surface adopters (shop → wallet top-up → gift card → booking → franchise/kiosk) migrate one at a time behind sub-flags; the first PR is **schema + types only** with zero behavioural change.

## 2. Goals / Non-goals

**Goals**

- Make the platform's payment-clearing choice (SUMIT-aggregated vs UPAY-direct vs future acquirer) a **single function call** from any surface, with a finance-confirmed rate table as the only knob.
- Make the platform's purchase lifecycle a **single state-machine vocabulary** so every surface emits the same audit row shape, the same notification triggers, and the same admin/finance queue.
- Make **SUMIT the legal "boss"** for receipts/invoices platform-wide, separately from whoever clears the money. Never invent a `receiptNumber`. Never store fake `transactionId`.
- Snapshot **VAT + clearing fees + provider fees + acquirer fees** at quote time and lock them with the order — never recompute at receipt time. Drift becomes a reconciliation alert, not silent overwrite.
- Extend the **buyer-vs-receiver notification split** from gift-card flows (today's only example) to every surface where buyer ≠ receiver (gifted booking, gifted top-up, B2B booking for an employee, franchise application by a parent entity for a sub-franchisee).
- Generalize **delivery routing** to support all six surfaces: physical goods (Wolt/Israel Post), scheduled services (no delivery), gift cards (digital — no delivery, but email/SMS dispatch is "delivery" semantically), wallet top-ups (digital), franchise fees (digital + paper), kiosk products (vended at machine — no delivery).
- Provide a **per-surface migration sequence** that minimises blast radius: shop → wallet top-up → gift cards → bookings (largest, last) → franchise/kiosk in parallel with bookings.
- Every state transition produces a `purchase_events` row matching Codex's `shop_order_events` schema (`oldStatus`, `newStatus`, `actorType`, `actorId`, `providerName`, `providerReference`, `metadataJson`) — **single audit table for every purchase across the platform**, not per-surface.
- Israeli legal/compliance preserved across every surface: VAT 18%, 14-day cooling-off (חוק הגנת הצרכן — מכר מרחוק), Sumit receipt sequence integrity, payment-method disclosure at checkout.
- Mobile-first + RTL Hebrew throughout (per `.claude/skills/petwash-ui-ux/SKILL.md:22, 188-215`).

**Non-goals**

- **No actual SUMIT/uPay/Wolt/Israel Post API integration code.** The router/lifecycle/notifications are abstractions with explicit plug-points; the wire-level integrations land in **implementation PRs after this SDD**, each behind its own sub-flag.
- **No change** to `walletLedgerEntries` schema, bucket enum, or hash chain (`shared/schema.ts:11675-11719`). Crown jewel per `.claude/skills/petwash-platform/SKILL.md:194-200`.
- **No change** to Tranzila behaviour (also a crown-jewel constraint).
- **No new pricing engine.** Every line continues to pass through `PriceQuoteService.buildQuote()` (sibling commerce-pricing SDD §8.2). The router consumes the quote's `total` field — it never re-prices.
- **No KYC / identity routing / multi-currency** — covered by `docs/design/2026-05-25-smart-identity-routing.md`.
- **No shipping carrier integration code** beyond the Wolt/Israel Post plug-points (the shop SDD already declares a `ShippingProvider` interface; this SDD makes it platform-wide).
- **No luxury shop visual aesthetic** — sibling shop SDD §10 owns that, gated by an operator-approved reference PNG.
- **No retroactive Tranzila routing rewrite.** Existing Tranzila flows are out of scope; the router is additive and only fires on new write paths gated by `ff.payments.router.enabled`.
- **No retroactive backfill of historic bookings into `purchase_events`** in v1 (this is one of the open questions §19.6). Only new purchases write to the unified audit.
- **No code from this SDD.** Implementation PRs follow.

## 3. Repository context (what exists today)

### 3.1 Money primitives this SDD reuses (do not reinvent)

| Component | File:line | Reused as |
|---|---|---|
| `walletLedgerEntries` (append-only, hash-chained, bucket-discriminated) | `shared/schema.ts:11675-11719` | Single ledger for every paid surface. Router/lifecycle never write here directly — they call existing wallet write APIs (`UnifiedWalletService`, `WalletEngine`). |
| `walletIdempotencyKeys` | `shared/schema.ts:11760-11772` | Reused for idempotency on every router and lifecycle write endpoint. |
| `walletJtiRegistry` | `shared/schema.ts:11777-11792` | Replay-protection for any signed payment intent or webhook envelope. |
| `walletFraudLog` | `shared/schema.ts:11795+` | Suspicious router/lifecycle events (fee drift, receipt-number reuse attempts, transactionId collisions) log here. |
| `walletReconciliationRuns` | `shared/schema.ts:11735` | Already covers any new ledger rows — no new reconciliation pipeline needed. |
| `escrowHoldings` (booking deposit hold/capture) | `shared/schema.ts` (`bookings` / `escrowHoldings` block) | Booking surface's payment hold lifecycle. Router treats the existing capture step as the `paid` transition. |
| `PriceQuoteService.buildQuote()` | sibling commerce-pricing SDD §8.2 (proposed `server/services/commerce/PriceQuoteService.ts`) | Single source of truth for `total`. Router consumes it; never re-prices. |
| `StackingResolver` | sibling commerce-pricing SDD §5.4 | Discount stacking applied before the quote reaches the router. |
| `CouponService` | `server/services/CouponService.ts:129` | Already handles atomic redemption + abuse gates. Unchanged. |
| `FinancialDocumentService.create({ documentType })` | `server/services/FinancialDocumentService.ts:55,75,83,140` | The **only** path that mints a Sumit-backed legal document. ReceiptInvoice subsystem (§8) is a thin wrapper that adds: state machine transitions, `receiptNumber` separation from `transactionId`, per-surface `documentType` mapping. |
| `VATCalculatorService` | `server/services/VATCalculatorService.ts:5,46,52,69` | Israeli VAT 18% (post 2025-01-01). VAT snapshot at quote time. |
| `SumitClient` / `SumitDispatcher` | `server/services/SumitClient.ts:158,191,347`; `server/services/SumitDispatcher.ts` | The Sumit rail. SUMIT remains the legal system-of-record regardless of acquirer. |
| `SumitPreflightCheck.ts` | `server/services/SumitPreflightCheck.ts` | Wired credentials check; router refuses to route to SUMIT if preflight fails. |
| `NayaxOnlinePaymentService.ts`, `NayaxJobDispatchPaymentService.ts` | `server/services/NayaxOnlinePaymentService.ts`, `server/services/NayaxJobDispatchPaymentService.ts` | K9000/Nayax payment surface. Router treats Nayax as a per-surface acquirer override (kiosk surface). |
| `BookingLifecycleService` + `BookingLifecycleStatus` | `server/services/BookingLifecycleService.ts:13,92,418,482`; `shared/schema.ts:11435-11467` | Existing booking lifecycle. The new universal lifecycle is **mapped onto** the existing booking lifecycle (§7.4) — not replaced. Booking remains the booking-specific vocabulary; the platform-wide vocabulary is **additive** and shadows it. |
| `EnhancedBookingService` | `server/services/EnhancedBookingService.ts` | Existing booking write path. Lifecycle wrapper hooks in additively. |
| `WalletEngine` + `UnifiedWalletService` | `server/services/WalletEngine.ts`, `server/services/UnifiedWalletService.ts:36,248` | Wallet top-up surface's existing write path. |
| `EgiftFinancialService` | `server/services/EgiftFinancialService.ts` | Gift-card buyer/receiver flow. Lifecycle wrapper hooks in additively. |
| `KioskCouponService` | `server/services/KioskCouponService.ts` | Kiosk surface's coupon code redemption. Lifecycle wrapper handles kiosk fulfilment terminal state. |
| `logAuditEvent(...)` | `server/middleware/auditLog.ts:57` | Every router/lifecycle/receipt mutation writes here in addition to `purchase_events`. |
| `requireAdmin` + admin route hardening | `server/middleware/rbac.ts:398`; mounted at `server/routes.ts:413-436` | All admin-facing finance queues (receipt failures, fee-drift alerts, manual review) inherit this stack. |
| `requireAuth` | `server/middleware/gates.ts:56` | Customer-facing router/lifecycle endpoints. |

### 3.2 Per-surface write paths today (one-line each, with citations)

- **Bookings** → `EnhancedBookingService` → `BookingLifecycleService.transitionStatus()` (`BookingLifecycleService.ts:418`) → `walletLedgerEntries` via existing capture (`BookingLifecycleService.ts:536-566`).
- **Wallet top-up** → `UnifiedWalletService` (`UnifiedWalletService.ts:36-248`) → `walletLedgerEntries`.
- **Gift cards** → `EgiftFinancialService` + `petWashVouchers2025` (sibling commerce-pricing SDD §5.1(a)).
- **Shop physical goods** → sibling shop SDD's `shop_orders` + `shop_order_events` (Codex prototype) → `FinancialDocumentService` → `walletLedgerEntries`.
- **Franchise application fees** → today: ad-hoc Sumit invoice via `FinancialDocumentService` (no dedicated lifecycle).
- **Kiosk** → `NayaxOnlinePaymentService` → `kioskSales` (`shared/schema.ts:3464+`).

### 3.3 What does NOT exist today (the gap this SDD fills)

- **No `PaymentProviderRouter`** — every surface hardcodes its acquirer.
- **No unified `PurchaseLifecycle` vocabulary** — booking has its own enum (`BookingLifecycleStatus`, `schema.ts:11435-11449`), shop will have its own (Codex), wallet/gift/franchise/kiosk have ad-hoc status fields.
- **No unified `purchase_events` audit table** — booking has `bookingStatusHistory` (`schema.ts:11424`), shop will have `shop_order_events` (Codex), wallet has its own ledger (which is the money audit, not the lifecycle audit), gift/franchise/kiosk have nothing dedicated.
- **No fee-snapshot table** — clearing fees, acquirer fees, VAT-on-fees are not consistently snapshotted today; recompute drift is currently possible.
- **No buyer/receiver notification split as a platform primitive** — gift cards do it ad-hoc; bookings/franchise/wallet don't differentiate.
- **No platform-wide delivery routing decision** — shop will introduce it (Codex), but bookings/gift/wallet/franchise/kiosk need their own per-surface "delivery is not physical" mapping.

### 3.4 Codex prototype (out of this repo's branches — DO NOT try to read)

The operator ran a different agent (Codex) on their local machine which produced shop-only prototypes of all five primitives. Those files are **not** in `origin/main` and **not** in `claude/sdd-shop-module-physical-goods` (PR #464):

- `server/services/shop/ShopDeliveryRoutingService.ts` — Wolt Packages vs Israel Post decision based on weight, dimensions, distance, supported-city list, live-quote availability.
- `server/services/shop/ShopOrderLifecycleService.ts` — order-level state machine.
- `server/services/shop/ShopOrderStateMachine.ts` — declarative transition table.
- `server/services/shop/ShopPaymentProviderPolicy.ts` — SUMIT vs UPAY routing for shop. **Most relevant to this SDD — its policy shape generalises into the platform-wide router (§6).**
- `server/services/shop/ShopNotificationPlanner.ts` — buyer-vs-receiver, channel selection, Hebrew-first.
- `migrations/0039_shop_purchase_lifecycle.sql` — adds `booking_id`, `shipping_provider`, `payment_method`, `invoice_status`, `notification_status` to `shop_orders`; creates `shop_order_events` with `old_status`, `new_status`, `actor_type`, `actor_id`, `provider_name`, `provider_reference`, `metadata_json JSONB DEFAULT '{}'`.

This SDD treats the Codex files as a **proof-of-concept** of the shape. They are described, not read.

## 4. Users, roles, accessibility, localization

### 4.1 Actors

| Actor | What they do with the router/lifecycle |
|---|---|
| **Customer (buyer)** | Picks a surface (booking/shop/gift/top-up/franchise/kiosk), reaches a paywall, sees a single price + a `payment_method` selector. Router runs server-side. Customer never sees fee math. |
| **Customer (receiver, when buyer ≠ receiver)** | Sees fulfilment-only updates (gift card redemption, gifted booking dispatch). Never sees payment/fee details. |
| **Provider (wash provider, walker, sitter, trainer)** | Sees booking lifecycle transitions relevant to them (`scheduled`, `in_progress`, `service_completed`). Never sees the buyer's payment method or acquirer choice. |
| **Admin / Finance** | Sees the receipt-failure queue (§8.5), the fee-drift alert queue (§13.4), the manual-review queue (§7.7), and the unified `purchase_events` audit. |
| **Accountant** | Sees only the SUMIT receipt book (legal source-of-record). The platform-wide audit is for internal ops; the legal book is SUMIT. |
| **System / Provider API webhook (SUMIT, UPAY, Wolt, AfterShip, Nayax)** | Emits `purchase_events` rows with `actorType='provider_api'` and the provider's signed reference. |
| **Maya (reception agent)** | Initiates a booking purchase on behalf of a customer (phone/walk-in). Lifecycle treats Maya as `actorType='admin'` with Maya's session ID; router runs identically to customer-initiated. |
| **K9000 machine (kiosk surface)** | Vended terminal state emitter. `actorType='machine'` with `actorId=stationId`. |

### 4.2 Permission matrix (router + lifecycle)

| Action | Customer | Provider | Admin | Finance | System |
|---|---|---|---|---|---|
| Initiate purchase / get a quote | yes (own) | no | yes (on behalf, Maya) | no | yes (recurring) |
| Read own purchase status | yes (own) | yes (own bookings) | yes (all) | yes (all) | yes (all) |
| Read fee snapshot for a purchase | **no** | **no** | yes | yes | yes |
| Transition lifecycle state | only `cancelled` (own, pre-paid) | provider-side transitions only | yes (with audit) | refund-related only | yes (provider webhooks) |
| Read receipt number | yes (own) | no | yes | yes | yes |
| Override router decision | no | no | yes (admin-flag) | no | no |
| Read `purchase_events` audit | no | own bookings only | yes | yes | yes |

### 4.3 Accessibility & localization

- All customer-facing copy Hebrew-first with English fallback. Existing pattern: bilingual content in `kioskProducts.name/nameHe` (`schema.ts:3416-3461`). Receipt-failure admin queue is operator-only and may be English.
- RTL throughout for HE locale (`.claude/skills/petwash-ui-ux/SKILL.md:22, 188-215`).
- Mobile-first: operator runs admin from a phone; receipt-failure queue and fee-drift queue are mobile-first surfaces.
- Numeric/currency: ILS-default. The router's amount input is in **integer cents (agorot)** to match the wallet ledger.
- Voiceover/screen-reader labels: payment-method selector must announce the method name and any non-default fee disclosure in Hebrew.

## 5. Architecture

### 5.1 High-level flow

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │  Per-surface adapter (shop / wallet / gift / booking / franchise /  │
   │  kiosk) — converts surface-specific intent into a PurchaseIntent    │
   └─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  PriceQuoteService.buildQuote(...)      │  ← sibling commerce SDD §8.2
                │  → { lineItems, discounts, total, vat } │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  PaymentProviderRouter.route(...)       │  ← §6 (this SDD)
                │  → { acquirer, systemOfRecord,          │
                │      feeSnapshot, requiresContract,     │
                │      paymentSessionParams }             │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  PurchaseLifecycleService.create(...)   │  ← §7
                │  draft → quote_required → quoted        │
                │  → payment_pending                      │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  Acquirer (SUMIT-aggregated UPAY,       │
                │  UPAY direct, Nayax for kiosk, etc.)    │
                │  returns transactionId                  │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  Lifecycle → paid → receipt_pending     │
                │  ReceiptInvoiceService.issue(...)       │  ← §8
                │  → SumitClient.createDocument(...)       │
                │  → receiptNumber stored separately      │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  Lifecycle → receipt_issued →           │
                │  fulfilment_pending → fulfilment_in_    │
                │  progress → fulfilled → completed       │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  NotificationEngine.plan(...)           │  ← §9
                │  (buyer + receiver + provider + admin)  │
                │  channels: email + SMS + push + WA      │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  DeliveryRouter.route(...) where        │  ← §10
                │  applicable (shop / gift / franchise)   │
                └─────────────────────────────────────────┘
```

Every transition emits a `purchase_events` row. Every monetary movement still lands in `walletLedgerEntries` (unchanged crown jewel).

### 5.2 Components (one-line each)

- **`shared/purchase-lifecycle/types.ts`** — canonical TypeScript types: `PurchaseSurface`, `PurchaseStatus`, `PurchaseEvent`, `PaymentMethod`, `PaymentSegment`, `FeeSnapshot`, `RouterDecision`, `LifecycleSubstate`.
- **`server/services/commerce/PaymentProviderRouter.ts`** — pure function `route(intent: PurchaseIntent) → RouterDecision`. No I/O except reading the rate table.
- **`server/services/commerce/PurchaseLifecycleService.ts`** — wraps every per-surface lifecycle. Owns transitions, emits `purchase_events`, calls `logAuditEvent`.
- **`server/services/commerce/PurchaseStateMachine.ts`** — declarative transition table (per surface). Read-only.
- **`server/services/commerce/ReceiptInvoiceService.ts`** — thin wrapper over `FinancialDocumentService.create(...)` that adds: state-machine entry, `receiptNumber` separation, `receipt_failed` queue, fee-snapshot enforcement.
- **`server/services/commerce/NotificationEngine.ts`** — pure planner: takes a `PurchaseEvent` and returns a `NotificationPlan` of (recipient, channel, locale, templateKey, redactionLevel).
- **`server/services/commerce/DeliveryRouter.ts`** — Wolt/Israel Post/courier/pickup/digital/scheduled-service decision. Per-surface input shape, single output shape.
- **Per-surface adapters** — `ShopPurchaseAdapter.ts`, `WalletTopUpAdapter.ts`, `GiftCardAdapter.ts`, `BookingAdapter.ts`, `FranchiseFeeAdapter.ts`, `KioskAdapter.ts`. Thin translation between surface-specific schema and the universal `PurchaseIntent` / `PurchaseEvent` shape.
- **Admin queues** — `/admin/finance/receipt-failures`, `/admin/finance/fee-drift`, `/admin/finance/manual-review`, `/admin/finance/purchase-audit`.

### 5.3 Happy-path sequence (gift card purchase, paid by Bit)

```
1. Customer (buyer) selects "Gift card 200 NIS" → GiftCardAdapter builds PurchaseIntent
       { surface: 'gift_card', amount: 20000, currency: 'ILS',
         paymentMethod: 'bit', segment: 'b2c',
         buyerUserId: 'u_123', receiverEmail: 'r@example.com' }
2. PriceQuoteService.buildQuote(intent) → { total: 20000, vat: 0 (gift card not VAT-able at issue, only at redeem), ... }
3. PaymentProviderRouter.route(intent, quote) →
       { acquirer: 'upay_via_sumit', systemOfRecord: 'sumit',
         feeSnapshot: { feeBps: 160, feeVatBps: 28.8, source: 'sumit.co.il/help' },
         requiresContractConfirmation: false /* aggregated rate is published */,
         paymentSessionParams: { sumitPaymentPageUrl, ... } }
4. PurchaseLifecycleService.create(intent, quote, routerDecision) →
       row in purchases (id=p_abc), purchase_events row: draft → quote_required → quoted → payment_pending
5. Customer redirected to Sumit payment page. Sumit clears via UPAY. Returns transactionId.
6. PurchaseLifecycleService.markPaid(p_abc, transactionId) → paid → receipt_pending
7. ReceiptInvoiceService.issue(p_abc) → SumitClient.createDocument(...) returns receiptNumber.
       → receipt_issued. purchase_events row records receiptNumber separately from transactionId.
8. PurchaseLifecycleService.fulfil(p_abc) →
       fulfilment_pending → fulfilment_in_progress (GiftCardAdapter.activateVoucher)
       → fulfilled (voucher row issued in petWashVouchers2025)
       → completed
9. NotificationEngine.plan(...) → buyer gets receipt email + voucher confirmation; receiver gets ONLY a "you got a gift" email with redemption link, ZERO payment/fee detail.
```

### 5.4 Failure-path sequences (key ones)

- **Acquirer auth fails** → lifecycle stays at `payment_pending`; after N retries (configured per surface) transitions to `failed`. NotificationEngine sends buyer-only "payment failed, no charge" message. **No** receipt row. **No** ledger row.
- **Acquirer cleared, Sumit receipt creation fails** → lifecycle `paid → receipt_pending` (held). Admin queue `/admin/finance/receipt-failures` lists it. Customer is **not** told "completed" until receipt issued. (Open question §19.4 — do we email customer "your purchase succeeded, receipt is being prepared" or hold all comms?)
- **Webhook arrives out of order** (SUMIT receipt webhook arrives before our own `markPaid` call returns) → idempotency table (`walletIdempotencyKeys`) absorbs the race; state machine guards prevent double-mint of `receiptNumber`.
- **Wolt live-quote returns "no carrier"** (shop surface) → lifecycle holds at `quoted`; DeliveryRouter forces fallback to Israel Post; if both fail, surface returns `quote_required` error and **checkout payment is blocked** (per Codex's "no live quote = no checkout payment" rule, lifted platform-wide).
- **Refund** → lifecycle transitions `completed → refund_pending → refunded` (or partial: `refund_partial`); ReceiptInvoiceService issues a `refund_receipt` Sumit document. Money movement reversed in `walletLedgerEntries` via existing wallet APIs.
- **Cooling-off invocation** (Israeli distance-sales law, 14 days) → adapter exposes a `requestCoolingOffRefund(purchaseId)` endpoint per surface; lifecycle transitions identically to a refund, with `actorType='customer'`, `metadataJson.coolingOff=true`.
- **Fee drift** (the rate the router snapshotted at quote time differs from what SUMIT actually charged at clearing) → fee-drift alert row written to `walletFraudLog`; admin queue surfaces it. No automatic adjustment — finance reviews.

### 5.5 Concurrency & idempotency

- Every router/lifecycle write endpoint requires an `Idempotency-Key` header. Implementation reuses `walletIdempotencyKeys` (`schema.ts:11760-11772`).
- Provider webhooks (SUMIT, UPAY, Wolt, AfterShip, Nayax) carry signed external references that are upserted into `purchase_events.provider_reference` with a unique index per `(provider_name, provider_reference)`. Replay = no-op.
- State-machine guards prevent invalid transitions; an attempt is logged to `walletFraudLog` with reason `invalid_transition`.


## 6. Universal PaymentProviderRouter (component A)

### 6.1 Purpose

Given a `PurchaseIntent` and a `PriceQuote`, decide:
1. **Which acquirer clears the money** (SUMIT-aggregated UPAY, UPAY direct, future acquirer, Nayax for kiosk, wallet-only for redemption).
2. **Which entity is the legal system-of-record for the receipt** — answer: **always SUMIT** in v1.
3. **What fee snapshot to lock onto the purchase** (so finance can reconcile and so the customer can see a stable price).
4. **What additional confirmations are required** (e.g., `requiresContractConfirmation: true` for the UPAY-direct discounted rate until finance signs off).
5. **What `paymentSessionParams`** the per-surface adapter passes to the customer (Sumit payment-page URL, Nayax intent, etc.).

The router is **pure** — given the same inputs and the same rate-table snapshot, it returns the same decision. Rate-table snapshots are versioned so finance can audit "which rules applied to purchase X at time T".

### 6.2 Inputs (`PurchaseIntent` + `PriceQuote`)

```ts
type PurchaseSurface =
  | 'shop'          // physical goods (sibling shop SDD)
  | 'booking'       // wash / walk / sitter / trainer / academy
  | 'gift_card'     // BuyGiftCard purchase + redemption
  | 'wallet_topup'  // K9000 wallet credit purchase
  | 'franchise_fee' // application/onboarding fee
  | 'kiosk';        // K9000 vending product

type PaymentMethod =
  | 'card'
  | 'bit'
  | 'apple_pay'
  | 'google_pay'
  | 'wallet_redemption'   // pay from existing PetWash wallet (e-gift / wash credits)
  | 'split_card_wallet';  // partial wallet + remainder card (sibling commerce-pricing SDD §5.2)

type CustomerSegment =
  | 'b2c'
  | 'b2b'
  | 'franchise_entity'
  | 'otef_eligible_business'  // gates the UPAY-direct cheaper rate
  | 'maya_proxy';             // Maya purchased on behalf of a customer

interface PurchaseIntent {
  surface: PurchaseSurface;
  amountCents: number;           // integer agorot
  currency: 'ILS';               // v1: ILS only
  paymentMethod: PaymentMethod;
  segment: CustomerSegment;
  buyerUserId: string;
  receiverUserId?: string;       // if differs (gifted purchases)
  surfaceMetadata: Record<string, unknown>;  // surface-specific (e.g., bookingId, shopOrderId)
}
```

### 6.3 Outputs (`RouterDecision`)

```ts
interface RouterDecision {
  acquirer:
    | 'upay_via_sumit'   // SUMIT aggregates and clears via UPAY (today's default)
    | 'upay_direct'      // UPAY direct rail (cheaper, gated)
    | 'nayax'            // K9000 hardware kiosk
    | 'wallet_only';     // 100% wallet redemption (no acquirer call)
  systemOfRecord: 'sumit';     // v1: always SUMIT
  feeSnapshot: FeeSnapshot;    // see §6.4
  requiresContractConfirmation: boolean;  // true blocks checkout until finance confirms
  paymentSessionParams: Record<string, unknown>;  // opaque to router; passed back to adapter
  routedAt: string;            // ISO timestamp
  ruleSetVersion: string;      // version of payment_provider_routes table snapshot
  reason: string;              // human-readable explanation for audit
}

interface FeeSnapshot {
  source: 'sumit.co.il/help' | 'upay.co.il' | 'finance_confirmed' | 'manual_override';
  sourceUrl?: string;
  feeBps: number;              // basis points (100 = 1.00%)
  feeVatBps: number;           // VAT portion of fee in bps
  fixedFeeCents: number;       // any per-transaction fixed fee
  capturedAt: string;
  contractRef?: string;        // if finance_confirmed, the contract row id
}
```

### 6.4 Rate table (Codex's verified rates as starting point)

| Channel | Method | Rate | Source | `requiresContractConfirmation` |
|---|---|---|---|---|
| SUMIT-aggregated UPAY (default) | Card (regular settle) | **1.10% + VAT** | sumit.co.il help center | false |
| SUMIT-aggregated UPAY | Card (next-day settle) | **1.40% + VAT** | sumit.co.il help center | false |
| SUMIT-aggregated UPAY | Bit | **1.60% + VAT** | sumit.co.il help center | false |
| SUMIT-aggregated UPAY | Special / non-Israel card | **4.20%** | sumit.co.il help center | false |
| UPAY direct (Otef-eligible) | Card | **0.90% + VAT** | upay.co.il landing | **true** (until finance verifies contract) |
| Nayax (kiosk) | Card | per Nayax agreement (existing) | existing wiring | false |
| Wallet redemption | n/a | **0 fee** | n/a | false |

**Rule of thumb**: public website rates are starting points; the router only treats a rate as **applicable to a purchase** when the rate row exists in `payment_provider_routes` with status `finance_confirmed` for the customer segment in question. Until then, `requiresContractConfirmation=true` and the surface either (a) falls back to the next cheapest finance-confirmed channel or (b) refuses checkout (per-surface configurable, default = refuse).

**Operator strategic input (2026-05-26)** — Nayax Israel beyond kiosk: operator notes Nayax offers terminal-owned acquiring ("100% ownership and profit without rent"). For high-volume non-kiosk surfaces (shop, bookings) this could have a lower TCO than UPAY-via-SUMIT over the terminal's lifetime (terminal capex amortised vs ongoing percentage fees). Currently scoped as kiosk-only in v1 because the TCO model does not exist yet. See §19.13 for the open question that gates expansion.

### 6.5 Routing rules

1. **If `paymentMethod === 'wallet_redemption'`** and the user's wallet balance covers `amountCents` → `acquirer='wallet_only'`. No acquirer call.
2. **If `paymentMethod === 'split_card_wallet'`** → wallet covers part, remainder routes per rules 3-7.
3. **If `surface === 'kiosk'`** → `acquirer='nayax'`. (Existing K9000 wiring.)
4. **If `segment === 'otef_eligible_business'`** AND UPAY-direct row is `finance_confirmed` AND `paymentMethod` is `card` → `acquirer='upay_direct'`, fee 0.90% + VAT.
5. **If `paymentMethod === 'bit'`** → `acquirer='upay_via_sumit'`, fee 1.60% + VAT.
6. **Default** → `acquirer='upay_via_sumit'`, fee per next-day or regular settle (per-surface configurable; v1 default = regular settle 1.10% + VAT).
7. **If amount > per-surface threshold** (configurable, e.g., 5,000 NIS) → router emits `requiresAdditionalAuth=true` in metadata; adapter prompts for 3DS / extra verification. (Threshold is informational, not a router branch.)
8. **Fail-closed**: if no rule matches (e.g., `paymentMethod='apple_pay'` but no acquirer in the rate table supports Apple Pay for the segment) → router returns `acquirer=null` and `reason='no_eligible_acquirer'`; adapter blocks checkout with a Hebrew-first error.

### 6.6 SUMIT is the legal "boss" regardless of acquirer

Even when `acquirer='upay_direct'` (cheaper rail bypassing the SUMIT aggregator), the **receipt is still issued via `FinancialDocumentService` → `SumitClient.createDocument(...)`**. The `RouterDecision.systemOfRecord` field is **always `'sumit'`** in v1. This protects: accountant queue, receipt-number continuity (a single Sumit receipt book), Israeli VAT report integrity, audit trail.

The router does **not** decide receipt source. The ReceiptInvoiceService (§8) always calls SUMIT. The router only decides clearing.

### 6.7 Rate-table snapshotting

- The `payment_provider_routes` table (§12.2) stores **every rate that has ever been routable**, with `effective_from`, `effective_to`, `status` (`draft / pending_finance / finance_confirmed / superseded / withdrawn`), `source`, `source_url`, `contract_ref`, `created_by`.
- Router reads only `finance_confirmed` rows that overlap the current timestamp.
- Every `RouterDecision.feeSnapshot` carries the `payment_provider_routes.id` it was computed from, so finance can replay any decision.
- `ruleSetVersion` in `RouterDecision` is a deterministic hash of the active rule-set rows at decision time.

### 6.8 Admin override

- An admin (with `requireAdmin` + MFA) can override a router decision for a single purchase via `/api/admin/finance/router/override`. The override is recorded with `actorType='admin'`, `actorId=adminUserId`, and `reason=...` in the `purchase_events` row. The fee snapshot from the override is locked.
- Admin override does **not** mutate the rate table. Persistent rate changes require finance to add a new `payment_provider_routes` row.

### 6.9 What the router does NOT do

- It does not call the acquirer (the adapter does, with the router's `paymentSessionParams`).
- It does not write to `walletLedgerEntries` (existing wallet code does, after `markPaid`).
- It does not pick the payment method (the customer does).
- It does not snapshot pricing (`PriceQuoteService` did that already).
- It does not issue receipts (`ReceiptInvoiceService` does).

## 7. Universal PurchaseLifecycle state machine (component B)

### 7.1 Canonical states

Lifted from Codex's shop_orders vocabulary and generalized:

```
draft
  → quote_required
       → quoted
            → payment_pending
                 → paid
                      → receipt_pending
                           → receipt_issued
                                → fulfilment_pending
                                     → fulfilment_in_progress
                                          → fulfilled
                                               → completed
                                                    (terminal happy)

Cross-cutting terminal/abnormal states (reachable from many points):
  cancelled                 (pre-paid abort by buyer, admin, or system)
  failed                    (acquirer rejection, fraud block, eligibility fail)
  refund_pending → refunded (post-paid customer-initiated or admin-initiated)
  refund_partial            (subset of line items refunded; non-terminal — purchase still active for remainder)
  returned                  (physical goods only; lifecycle re-enters refund flow)
  manual_review             (held for human; reachable from receipt_pending or fulfilment_pending)
```

### 7.2 Per-surface fulfilment sub-machines

| Surface | `fulfilment_pending` → `fulfilment_in_progress` → `fulfilled` mapped to |
|---|---|
| **Bookings** (wash, walk, sitter, trainer, academy) | `scheduled` → `in_progress` → `service_completed` (maps onto existing `BookingLifecycleStatus` — see §7.4) |
| **Gift cards** | `issued` (voucher row created) → `activated` (claim link visited) → `redeemed` (balance fully spent) |
| **Wallet top-ups** | `credited` (wallet ledger row written; single step — `fulfilment_in_progress` and `fulfilled` collapse) |
| **Franchise application fees** | `application_under_review` → `approved` (terminal `fulfilled`) OR `rejected` (terminal — may trigger refund) |
| **Kiosk** | `vended` (single step; Nayax confirms machine dispensed) |
| **Shop physical goods** | `preparing` → `packed` → `label_created` → `package_on_the_way` → `out_for_delivery` → `delivered` (Codex's existing chain — kept unchanged) |

### 7.3 Transition table (excerpt)

```ts
const TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  draft: ['quote_required', 'cancelled'],
  quote_required: ['quoted', 'cancelled', 'failed'],
  quoted: ['payment_pending', 'cancelled'],
  payment_pending: ['paid', 'failed', 'cancelled'],
  paid: ['receipt_pending', 'refund_pending'],
  receipt_pending: ['receipt_issued', 'manual_review', 'refund_pending'],
  receipt_issued: ['fulfilment_pending', 'refund_pending'],
  fulfilment_pending: ['fulfilment_in_progress', 'refund_pending', 'manual_review'],
  fulfilment_in_progress: ['fulfilled', 'failed', 'refund_pending'],
  fulfilled: ['completed', 'returned', 'refund_pending'],
  completed: ['returned', 'refund_pending'],   // post-sale return / cooling-off
  returned: ['refund_pending'],
  refund_pending: ['refunded', 'refund_partial', 'failed'],
  refund_partial: ['refunded', 'refund_partial'],  // additional partials
  refunded: [],                 // terminal
  cancelled: [],                // terminal
  failed: [],                   // terminal
  manual_review: ['receipt_pending', 'fulfilment_pending', 'cancelled', 'refunded'],
};
```

Every transition is guarded by the state machine. An attempt with an invalid `(from, to)` pair returns 409 and writes to `walletFraudLog` with `reason='invalid_transition'`.

### 7.4 Booking surface — mapping to existing `BookingLifecycleStatus`

The existing booking lifecycle (`shared/schema.ts:11435-11449`) has its own vocabulary (`inquiry`, `quote_sent`, `quote_expired`, `deposit_pending`, `deposit_received`, `owner_confirmed`, `provider_confirmed`, `in_progress`, `owner_completion_review`, `provider_completion_review`, `completed`, `cancelled`, `refunded`, `disputed`). The booking lifecycle is **not replaced**. The universal lifecycle is **additive and shadows** it:

| Universal | Existing `BookingLifecycleStatus` |
|---|---|
| `draft` | (pre-`inquiry`) |
| `quote_required` | `inquiry` |
| `quoted` | `quote_sent` |
| `payment_pending` | `deposit_pending` |
| `paid` | `deposit_received` |
| `receipt_pending` → `receipt_issued` | (sub-step within `deposit_received`) |
| `fulfilment_pending` | `owner_confirmed` + `provider_confirmed` |
| `fulfilment_in_progress` | `in_progress` |
| `fulfilled` (review window) | `owner_completion_review` + `provider_completion_review` |
| `completed` | `completed` |
| `cancelled` | `cancelled` |
| `refund_pending` → `refunded` | `refunded` |
| `manual_review` | `disputed` |

`BookingAdapter` is the mapping layer. The booking surface continues to read/write its own enum **and** writes a corresponding universal `purchase_events` row at each transition.

### 7.5 `purchase_events` audit row

Every transition writes a row to `purchase_events` (new table — §12.1). Shape mirrors Codex's `shop_order_events`:

```ts
interface PurchaseEvent {
  id: string;
  purchaseId: string;
  surface: PurchaseSurface;
  oldStatus: PurchaseStatus | null;
  newStatus: PurchaseStatus;
  actorType: 'system' | 'admin' | 'provider' | 'customer' | 'provider_api' | 'machine';
  actorId: string | null;
  providerName: string | null;     // 'sumit' | 'upay' | 'wolt' | 'aftership' | 'nayax' | null
  providerReference: string | null; // signed external ID
  metadataJson: Record<string, unknown>;  // free-form; never carries fee snapshot (that lives on the purchase row)
  occurredAt: string;
}
```

Unique partial index on `(provider_name, provider_reference) WHERE provider_reference IS NOT NULL` guarantees webhook idempotency.

### 7.6 Refund handling

- Refunds enter via per-surface adapters that call `PurchaseLifecycleService.requestRefund(purchaseId, { amountCents?, reason, actorType, actorId })`.
- Full refund: `... → refund_pending → refunded`. Money reversed via existing wallet APIs. Sumit `refund_receipt` document issued (`FinancialDocumentService.create({ documentType: 'refund_receipt' })` per `FinancialDocumentService.ts:63`).
- Partial refund: `... → refund_partial`. Purchase remains active for non-refunded portion. Multiple partials may stack.
- Cooling-off (Israeli מכר מרחוק, 14 days): same flow, `metadataJson.coolingOff=true`, `actorType='customer'`. Per-surface eligibility rules (§19.7 is an open question — services vs goods vs gift cards differ).
- Refund routing decision (does UPAY refund flow through SUMIT or directly?) — open question §19.4.

### 7.7 `manual_review` queue

- Surfaces a row in `/admin/finance/manual-review` whenever:
  - Receipt issuance fails after N retries (`receipt_pending → manual_review`).
  - Fee drift exceeds tolerance (§13.4).
  - Acquirer reports a fraud block.
  - State-machine guard rejects an invalid transition (logged but the purchase itself may not enter `manual_review` — that depends on the calling surface; default = yes).
- Admin actions: `release_to_receipt_pending`, `release_to_fulfilment_pending`, `cancel`, `refund` — each writes a `purchase_events` row with `actorType='admin'`.

### 7.8 What the lifecycle does NOT do

- It does not write to `walletLedgerEntries` directly. It calls existing wallet APIs.
- It does not issue receipts. It transitions to `receipt_pending` and `ReceiptInvoiceService` (§8) does the SUMIT call.
- It does not send notifications. It emits events; `NotificationEngine` (§9) plans the comms.
- It does not decide the acquirer. `PaymentProviderRouter` (§6) did that earlier.

## 8. Universal Receipt/Invoice subsystem (component C)

### 8.1 Single source of legal receipts: SUMIT

- Every paid purchase, on every surface, gets exactly one **legal receipt** issued by `SumitClient.createDocument(...)` via `FinancialDocumentService.create({ documentType, ... })` (`FinancialDocumentService.ts:55,75,83,140`).
- Per-surface `documentType` mapping:

| Surface | `documentType` |
|---|---|
| Bookings | `booking_receipt` (existing) |
| Shop physical goods | `product_order_receipt` (new — added in sibling shop SDD §9.2) |
| Gift cards | `gift_card_receipt` (new — additive) |
| Wallet top-ups | `wallet_topup_receipt` (new — additive) |
| Franchise fees | `franchise_fee_receipt` (new — additive) |
| Kiosk | `kiosk_sale_receipt` (new — additive) |
| Refunds (all surfaces) | `refund_receipt` (existing — `FinancialDocumentService.ts:63`) |

### 8.2 `receiptNumber` separated from `transactionId`

- `transactionId` = the acquirer's transaction ID (UPAY's, Nayax's). Stored on `purchases.transaction_id` and on the `purchase_events` row for the `paid` transition (`provider_reference` field).
- `receiptNumber` = SUMIT's legal receipt number. Stored on `purchases.receipt_number` and on the `purchase_events` row for the `receipt_issued` transition (`provider_reference` field with `provider_name='sumit'`).
- **They are NEVER the same column.** Conflating them is a defect — separate columns, separate provenance.

### 8.3 `receipt_issued` ONLY when SUMIT returns a real number

- `ReceiptInvoiceService.issue(purchaseId)` calls `FinancialDocumentService.create(...)`.
- If SUMIT returns a non-empty `receiptNumber` → state transitions `receipt_pending → receipt_issued`.
- If SUMIT returns an error → service retries with exponential backoff (per `SumitDispatcher` pattern). After N retries → state transitions `receipt_pending → manual_review` (§7.7).
- **No fake numbers ever.** The service refuses to write a placeholder string to `receipt_number`. Per-Codex's hard guard, lifted to platform.

### 8.4 Fee snapshot enforcement

- `purchases.fee_snapshot_json` (JSONB, the `FeeSnapshot` written by the router at quote time) is **read-only** after the `quoted → payment_pending` transition.
- When `ReceiptInvoiceService.issue(...)` runs, it passes the snapshot fee fields to `FinancialDocumentService` so the receipt line items match what the customer agreed to pay.
- If the acquirer's actual settlement fee differs from the snapshot → write a row to `walletFraudLog` with `reason='fee_drift'`, surface in `/admin/finance/fee-drift`. **No automatic adjustment of the receipt.** The receipt is locked at the snapshot value; finance reconciles drift offline.

### 8.5 Receipt-failure admin queue

- `/admin/finance/receipt-failures` lists purchases in `manual_review` whose entry reason was `receipt_pending` exceeding retry budget.
- Admin actions: `retry`, `cancel_and_refund`, `manual_receipt_number_entry` (last resort — writes audit row with `actorType='admin'`, `metadataJson.manualEntry=true`, requires MFA confirmation and a free-text justification).
- Manual entry **does not** bypass SUMIT integrity — it records the number SUMIT issued out-of-band (e.g., via SUMIT's own UI when our API call failed). Cross-checked against SUMIT's webhook stream by the daily reconciliation job.

### 8.6 VAT treatment at quote time

- `VATCalculatorService` (`server/services/VATCalculatorService.ts:5,46,52,69`) is called once at quote time. The resulting `vatCents` is snapshotted on `purchases.vat_cents` and reused at receipt time.
- Israeli VAT rate is **18%** (post-2025-01-01).
- Surfaces with special VAT treatment (gift card issuance is VAT-deferred until redemption; the redemption transaction VAT-s, not the purchase) are explicit in the per-surface adapter (§11.3).

### 8.7 Receipt sequence question (open §19.3)

- Today, SUMIT issues receipts from a single business document book. The platform currently uses one Sumit receipt sequence for all booking receipts.
- Open: do we keep ONE shared Sumit receipt sequence across all six surfaces (cleanest legal interpretation; matches accountant's existing workflow) OR split per-surface (operationally cleaner reporting, more accountant overhead)?
- Default for v1: **ONE shared sequence** (no operational change). Per-surface book split is a follow-up if finance asks for it.

## 9. Universal Notification engine (component D)

### 9.1 Inputs and outputs

```ts
interface NotificationPlanInput {
  event: PurchaseEvent;
  purchase: Purchase;
  buyer: { userId: string; email?: string; phone?: string; locale: 'he' | 'en'; ... };
  receiver?: { userId?: string; email?: string; phone?: string; locale: 'he' | 'en'; ... };
  provider?: { userId: string; ... };  // for bookings
}

interface NotificationPlan {
  messages: NotificationMessage[];
}

interface NotificationMessage {
  recipient: 'buyer' | 'receiver' | 'provider' | 'admin';
  channel: 'email' | 'sms' | 'push' | 'whatsapp';
  locale: 'he' | 'en';
  templateKey: string;
  redactionLevel: 'full_detail' | 'fulfilment_only' | 'admin_internal';
  payload: Record<string, unknown>;  // template variables; never includes raw card data
}
```

### 9.2 Buyer-vs-receiver redaction (the platform-wide rule)

| Detail | Buyer | Receiver | Provider | Admin |
|---|---|---|---|---|
| Price paid | yes | **no** | no | yes |
| Payment method | yes | **no** | no | yes |
| Fee breakdown | yes (subtotal level) | **no** | no | yes (full) |
| Receipt number | yes | **no** | no | yes |
| Transaction ID | no (internal) | **no** | no | yes |
| Fulfilment status (e.g., "your gift is on the way") | yes | **yes** | yes (own only) | yes |
| Service date/time | yes | yes (if applicable) | yes (own only) | yes |
| Item title / generic description | yes | yes | yes (own only) | yes |
| Customer address (delivery) | yes | yes (if delivery target) | only if dispatch needs it | yes |

Receiver **never** sees price, payment method, fees, or receipt details — on any surface. This is the platform rule; per-surface code cannot opt out.

### 9.3 Channel selection

- Default channels per template, configurable per user preference.
- Hebrew-first templates; English fallback when `user.locale='en'`.
- WhatsApp where the user has opted in (existing platform pattern).
- Push only when a mobile-app session is bound to the user.
- SMS reserved for: payment confirmation, fulfilment dispatch, refund completion, cooling-off receipt.

### 9.4 Template registry

- `shared/notification-templates/*.json` — one file per `templateKey`, with `he` and `en` variants, redaction-level annotation, and a JSON schema for `payload`.
- Render via existing email/SMS/push services; planner returns the plan, dispatchers execute.

### 9.5 Triggers per state

| State entered | Buyer | Receiver | Provider | Admin |
|---|---|---|---|---|
| `quoted` | (silent — same UI session) | — | — | — |
| `payment_pending` | (silent — same UI session) | — | — | — |
| `paid` | email + push: "payment received" | — | — | — |
| `receipt_issued` | email: receipt attached | — | — | — |
| `fulfilment_pending` | (silent) | — | (booking) push: "new booking" | — |
| `fulfilment_in_progress` | push (booking: "your wash started") | push (gift: "your gift is being processed") | (booking) push | — |
| `fulfilled` | email + push: "complete" | email + push (where applicable) | (booking) push | — |
| `completed` | email: "thanks" | (silent or gift-redeemed-thanks) | — | — |
| `cancelled` | email: "cancelled, no charge" | — | — | — |
| `failed` | email + SMS: "payment failed, no charge" | — | — | finance queue surface |
| `refund_pending` | email: "refund in progress" | — | — | — |
| `refunded` | email + SMS: "refund issued" | — | — | — |
| `manual_review` | (silent unless surface owner decides) | — | — | finance queue surface |

### 9.6 Multi-actor purchase (open question §19.8)

- Gifted booking (buyer pays, receiver receives the wash, provider executes) — three-way matrix. Receiver gets fulfilment notices; provider gets booking dispatch; buyer gets payment + completion summary.
- B2B booking (employer pays, employee receives, provider executes) — same shape, different segment.
- Default behaviour: planner emits one message per recipient row in the matrix. Surface-specific adapters can mute a recipient via `disableRecipient: 'receiver'` flag at intent time (e.g., a corporate gift where the employer wants to deliver in person).

## 10. Universal Delivery routing (component E)

### 10.1 Decision space

| Decision | Applies to | Outcome |
|---|---|---|
| **Wolt Packages** | shop physical goods | Codex's gating rules (≤8kg, ≤35×35×30cm, distance ≤15km, supported city, live quote ≥0) |
| **Israel Post** | shop physical goods (default), gift card physical (rare — e.g., premium plastic card mailed) | Default for shop when Wolt ineligible |
| **Courier (third-party)** | shop heavy/oversized; bookings rare equipment | Pluggable; not implemented v1 |
| **Pickup** | shop pickup-from-warehouse option, kiosk vended product | No delivery cost |
| **Digital** | gift cards (email), wallet top-ups (instant), franchise paperwork (PDF) | No physical shipment |
| **Scheduled-service** | bookings (wash, walk, sitter, trainer, academy) | The "delivery" is the service itself at the scheduled time — `DeliveryRouter` returns `kind: 'scheduled_service'` and the booking surface handles dispatch via its existing flows |

### 10.2 Per-surface defaults

| Surface | DeliveryRouter input | Default output |
|---|---|---|
| Shop physical goods | weight, dimensions, origin/destination coords, supported-city, live quote | Wolt if eligible, else Israel Post, else block checkout |
| Gift cards (digital) | (none — always digital) | `kind: 'digital'`, channel: email + SMS |
| Wallet top-ups | (none — always instant) | `kind: 'instant'` |
| Bookings | scheduled date/time, service location | `kind: 'scheduled_service'` |
| Franchise fees | (none — PDF) | `kind: 'digital'`, channel: email + PDF attachment |
| Kiosk | machineId | `kind: 'kiosk_vended'` |

### 10.3 Codex's shop rules lifted into the router

For `surface='shop'`:
- **Wolt eligibility**: package ≤8kg AND max dim ≤35×35×30cm AND origin+destination Google coords present AND distance ≤15km AND destination city ∈ supported service area AND Wolt live-quote API returns a price.
- **Israel Post default**: when Wolt ineligible OR small keychain (per-SKU flag).
- **Hard guard**: no live quote = no checkout payment. Surface returns `delivery_quote_failed` and the lifecycle stays at `quote_required`.
- **No fake tracking number** ever. If neither carrier returns a real label, lifecycle holds at `label_pending` → `manual_review` (per Codex).

### 10.4 Per-surface adapters provide the input

- `ShopPurchaseAdapter` populates package physical attributes from `products`/`product_variants` (sibling shop SDD §3.4).
- `BookingAdapter` populates scheduled date/time and service location from `bookings`.
- `GiftCardAdapter` populates receiver email/phone.
- `WalletTopUpAdapter` populates (nothing — instant).
- `FranchiseFeeAdapter` populates email + PDF target.
- `KioskAdapter` populates `stationId`.

### 10.5 What the delivery router does NOT do

- It does not call carrier APIs (the per-surface dispatch service does, with the router's `deliveryParams`).
- It does not write tracking numbers (the dispatch service does, into `purchases.tracking_*` columns).
- It does not decide refund eligibility on a returned package (that's lifecycle `returned → refund_pending`).

## 11. Per-surface adapters

Each adapter is a thin translation layer that (a) reads the surface's existing schema and (b) emits universal `PurchaseIntent` / `PurchaseEvent` shapes. Adapters live in `server/services/commerce/adapters/`. None of the existing per-surface code is removed in v1 — the adapter is **additive**.

### 11.1 ShopPurchaseAdapter

- Reads from `shop_orders` (sibling shop SDD §6.1; Codex prototype adds `booking_id`, `shipping_provider`, `payment_method`, `invoice_status`, `notification_status`).
- Translates Codex's shop-specific lifecycle states into the universal vocabulary 1:1 (Codex's vocabulary is already the canonical one).
- Pass-through: Codex's `shop_order_events` rows ALSO write to the universal `purchase_events` table during the migration window. The duplicate write is dropped once the shop surface is fully on the universal table (Open Q §19.6).

### 11.2 WalletTopUpAdapter

- Reads from existing `UnifiedWalletService` write path (`UnifiedWalletService.ts:36-248`).
- Maps top-up to lifecycle: `draft → quote_required → quoted → payment_pending → paid → receipt_pending → receipt_issued → fulfilment_pending → fulfilment_in_progress → fulfilled (credited) → completed`.
- `fulfilment_in_progress` and `fulfilled` collapse into the existing wallet-credit step.
- Pilot surface (smallest single transaction type, easiest to validate the universal lifecycle end-to-end).

### 11.3 GiftCardAdapter

- Reads from `petWashVouchers2025` (sibling commerce-pricing SDD §5.1(a)).
- Two distinct purchases possible: (a) **gift-card issuance** (buyer pays, voucher row created), (b) **gift-card redemption** (no money in — pre-paid balance applied to another purchase).
- VAT deferred until redemption (Israeli tax pattern for prepaid vouchers): the issuance receipt is a "advance payment" Sumit document; the redemption applies VAT against the receiving surface's line items.
- Buyer-vs-receiver split is critical here (already true today, but now codified platform-wide).

### 11.4 BookingAdapter

- Reads from `bookings` + `bookingStatusHistory` (`shared/schema.ts:11424`) + `escrowHoldings` (`schema.ts:11432`).
- Maps universal → `BookingLifecycleStatus` per §7.4.
- Largest surface; last to migrate. Sub-flag: `ff.purchase.lifecycle.bookings`. Cohort-controlled rollout (start with walker bookings → sitter → trainer → wash live → academy).
- Handles three-actor matrix (buyer, receiver, provider) for gifted bookings.

### 11.5 FranchiseFeeAdapter

- Reads from existing franchise application flow (`shared/schema-franchise.ts`).
- Sub-states under `fulfilment_in_progress`: `application_under_review` → `approved` (terminal `fulfilled`) | `rejected` (terminal — may trigger `refund_pending`).
- Notifications: buyer (franchisee applicant) gets payment + receipt + approval/rejection; PetWash admin (franchise team) gets a "new application" notification.

### 11.6 KioskAdapter

- Reads from `kioskSales` (`shared/schema.ts:3464+`) and `kioskProducts` (`schema.ts:3416`).
- Acquirer: `nayax` (existing wiring). Router treats kiosk as a non-overridable surface (rule §6.5.3).
- Fulfilment: `fulfilment_in_progress → fulfilled` is the Nayax machine-vend confirmation (`actorType='machine'`).

## 12. Data model (new/changed tables, additive-first)

### 12.1 New table: `purchases`

Single platform-wide row per purchase. Replaces nothing — it's a **shadow row** in v1, populated alongside the existing surface-specific tables, and only becomes authoritative once a surface flips to read from it. Until then, surface-specific tables remain the source of truth.

```sql
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface text NOT NULL CHECK (surface IN
    ('shop','booking','gift_card','wallet_topup','franchise_fee','kiosk')),
  surface_ref_id text NOT NULL,            -- pointer back to surface row (shop_orders.id, bookings.id, etc.)
  buyer_user_id text NOT NULL,
  receiver_user_id text,                   -- when buyer ≠ receiver
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'ILS' CHECK (currency = 'ILS'),
  status text NOT NULL,                    -- universal PurchaseStatus
  payment_method text NOT NULL,            -- PaymentMethod
  segment text NOT NULL,                   -- CustomerSegment
  acquirer text,                           -- 'upay_via_sumit' | 'upay_direct' | 'nayax' | 'wallet_only'
  system_of_record text NOT NULL DEFAULT 'sumit',
  transaction_id text,                     -- acquirer's tx id
  receipt_number text,                     -- SUMIT's receipt number (NEVER same column as transaction_id)
  fee_snapshot_json jsonb NOT NULL,        -- FeeSnapshot at quote time (read-only after quoted→payment_pending)
  vat_cents bigint NOT NULL DEFAULT 0,
  rule_set_version text NOT NULL,          -- payment_provider_routes snapshot hash
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX purchases_surface_ref_uq ON purchases (surface, surface_ref_id);
CREATE INDEX purchases_buyer_idx ON purchases (buyer_user_id);
CREATE INDEX purchases_receiver_idx ON purchases (receiver_user_id) WHERE receiver_user_id IS NOT NULL;
CREATE INDEX purchases_status_idx ON purchases (status);
CREATE INDEX purchases_created_at_idx ON purchases (created_at);
CREATE UNIQUE INDEX purchases_transaction_id_uq
  ON purchases (acquirer, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX purchases_receipt_number_uq
  ON purchases (system_of_record, receipt_number) WHERE receipt_number IS NOT NULL;
```

Cross-surface `transaction_id` collision is prevented per-acquirer (Open Q §19.10 — do we enforce uniqueness platform-wide regardless of acquirer? v1 answer: per-acquirer, since UPAY-direct and Nayax could legitimately reuse a numeric ID).

### 12.2 New table: `purchase_events`

Shape from Codex's `shop_order_events`, lifted platform-wide.

```sql
CREATE TABLE purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  surface text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN
    ('system','admin','provider','customer','provider_api','machine')),
  actor_id text,
  provider_name text,                      -- 'sumit'|'upay'|'wolt'|'aftership'|'nayax'|null
  provider_reference text,                 -- signed external ID (idempotency anchor)
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_events_purchase_idx ON purchase_events (purchase_id, occurred_at);
CREATE INDEX purchase_events_surface_idx ON purchase_events (surface, occurred_at);
CREATE UNIQUE INDEX purchase_events_provider_ref_uq
  ON purchase_events (provider_name, provider_reference)
  WHERE provider_reference IS NOT NULL;
```

### 12.3 New table: `payment_provider_routes`

The finance-confirmed rate table the router reads.

```sql
CREATE TABLE payment_provider_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquirer text NOT NULL,                  -- 'upay_via_sumit' | 'upay_direct' | 'nayax' | 'wallet_only'
  surface text,                            -- nullable = all surfaces
  payment_method text,                     -- nullable = all methods
  segment text,                            -- nullable = all segments
  min_amount_cents bigint,
  max_amount_cents bigint,
  fee_bps int NOT NULL,
  fee_vat_bps int NOT NULL,
  fixed_fee_cents bigint NOT NULL DEFAULT 0,
  source text NOT NULL CHECK (source IN
    ('sumit.co.il/help','upay.co.il','finance_confirmed','manual_override')),
  source_url text,
  contract_ref text,                       -- when source='finance_confirmed'
  status text NOT NULL CHECK (status IN
    ('draft','pending_finance','finance_confirmed','superseded','withdrawn')),
  requires_contract_confirmation boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,                        -- finance admin user id
  approved_at timestamptz
);

CREATE INDEX ppr_active_idx ON payment_provider_routes (acquirer, status, effective_from, effective_to);
```

### 12.4 Additive columns on existing tables

Per-surface tables get a thin pointer back to `purchases.id` so the universal lifecycle can shadow the surface-specific lifecycle without dual-writing app state.

| Table | New column |
|---|---|
| `bookings` | `purchase_id uuid REFERENCES purchases(id)` |
| `shop_orders` (sibling shop SDD) | `purchase_id uuid REFERENCES purchases(id)` |
| `petWashVouchers2025` | `purchase_id uuid REFERENCES purchases(id)` |
| Wallet top-up ledger rows (no dedicated table — top-ups create a `walletLedgerEntries` row with `bucket='topup'`; we add a `purchase_id` column on `walletLedgerEntries` ONLY if reconciliation needs it — pending §19.6 decision) | (deferred) |
| Franchise application table (per `schema-franchise.ts`) | `purchase_id uuid REFERENCES purchases(id)` |
| `kioskSales` | `purchase_id uuid REFERENCES purchases(id)` |

Each is **nullable** in v1 (additive, not enforced). Backfill is a §19.6 open question.

### 12.5 Migration file naming

- `migrations/0040_purchase_lifecycle_unified.sql` — creates `purchases`, `purchase_events`, `payment_provider_routes`, adds nullable `purchase_id` columns on listed tables.
- Migration is **additive only**. No drops, no renames. Reversible by reverse-DDL.

## 13. Security & fraud model

### 13.1 Backend is source of truth (platform invariant)

Per `.claude/skills/petwash-platform/SKILL.md:194-200` — money is sacred. **No client-side value reaches the router.**

- Client sends: `surface`, `surfaceMetadata.surfaceRefId`, `paymentMethod` (only). Nothing else.
- Server resolves: amount, segment, buyerUserId, receiverUserId, fee rate. All from authoritative server-side state.
- Server signs: any redirect URL (Sumit payment page) is constructed server-side with HMAC, never built client-side.
- Client **cannot**: submit final price, submit `transactionId`, submit `receiptNumber`, submit `feeBps`, submit `acquirer` choice.

### 13.2 Replay protection

- Idempotency: every router/lifecycle/refund endpoint requires `Idempotency-Key` header; stored in `walletIdempotencyKeys` (`schema.ts:11760-11772`).
- Webhook replay: unique partial index on `purchase_events (provider_name, provider_reference)` — replays no-op.
- Signed redirect URLs: HMAC-bound to user session + nonce stored in `walletJtiRegistry` (`schema.ts:11777-11792`).

### 13.3 Double-clearing protection

- State machine guards prevent `paid → payment_pending` (no way to re-clear an already-paid purchase).
- Acquirer webhooks that arrive after `paid` state for the same transactionId are absorbed by the unique index on `purchases (acquirer, transaction_id)`.
- If a second webhook arrives with a **different** transactionId for the same purchase (impossible under normal flow) → `walletFraudLog` with `reason='multi_charge_attempt'`, surface `manual_review`.

### 13.4 Fee-drift detection

- After acquirer settlement, daily reconciliation job compares `purchases.fee_snapshot_json.feeBps` to the acquirer's actual settled fee.
- Drift > 0 bps → row in `walletFraudLog` with `reason='fee_drift'`, surface in `/admin/finance/fee-drift`.
- No automatic adjustment. Finance reviews and either: (a) accepts the drift (records a manual finance adjustment ledger row in the existing wallet ledger), (b) opens a chargeback with the acquirer, (c) updates the rate table for future purchases.

### 13.5 Receipt-number integrity

- `receipt_number` is unique per (`system_of_record`, `receipt_number`) — see §12.1.
- An attempt to mint the same `receipt_number` twice fails at DB constraint; service writes `walletFraudLog reason='receipt_dup_attempt'`.
- Manual receipt-number entry (§8.5) requires MFA-confirmed admin action and is itself audit-logged.

### 13.6 TransactionId / receiptNumber separation

- They live in **different columns**. Any code that conflates them is a defect detected by:
  - SQL type/check constraints (separate columns).
  - Lint rule: `eslint-rule-no-receipt-number-in-transaction-id` (to be added in the first PR's tests).
  - Daily reconciliation job: every `purchases` row where `transaction_id = receipt_number` flags `walletFraudLog reason='conflated_ids'`.

### 13.7 Threat list (table)

| Threat | Control |
|---|---|
| Client-side price tampering | Server-resolves amount from authoritative state; client never submits price |
| Replay of webhook | Unique index on `(provider_name, provider_reference)` |
| Replay of customer request | `Idempotency-Key` required; `walletIdempotencyKeys` |
| Double-clearing | State guards + unique `(acquirer, transaction_id)` |
| Forged receipt | SUMIT integration; no fake numbers; `receipt_pending → manual_review` on failure |
| Forged tracking number (shop) | DeliveryRouter holds at `label_pending → manual_review` if carrier returns no real label |
| Screenshot reuse (gift card redemption) | Voucher redemption is server-side atomic in existing CouponService (sibling commerce-pricing SDD) |
| Fee drift (acquirer charged differently than quoted) | Daily reconciliation, `walletFraudLog`, finance queue |
| Cross-surface transactionId collision | Per-(acquirer, transaction_id) uniqueness (v1) |
| Manual admin override abuse | MFA-gated, audited, every override writes a `purchase_events` row with `actorType='admin'` and a `reason` |
| Lifecycle stuck (purchase orphaned in `payment_pending`) | TTL job sweeps purchases older than per-surface threshold → `failed` + buyer notified |
| Otef-eligibility forgery (claiming UPAY-direct rate without contract) | `requires_contract_confirmation=true` blocks until finance-confirmed; router refuses to apply rate otherwise |

### 13.8 Compliance

- **VAT** (Israeli 18%): snapshotted at quote time, never recomputed at receipt time.
- **Cooling-off** (14 days, חוק הגנת הצרכן — מכר מרחוק): per-surface eligibility codified in adapter (services have different cooling-off rules than goods than gift cards — §19.7 open).
- **Receipt sequence integrity** (Israeli tax law): SUMIT manages the sequence. Manual entry only in admin emergency, audited, MFA-gated.
- **Payment-method disclosure** at checkout: Hebrew-first, RTL, accessible label per `.claude/skills/petwash-ui-ux/SKILL.md`.
- **Privacy**: receiver never sees buyer's payment details (notification redaction §9.2).

## 14. APIs / interfaces

All endpoints prefixed `/api/commerce/` for new universal endpoints; per-surface endpoints remain at their existing paths and call into the universal services server-side.

### 14.1 Customer-facing

```
POST   /api/commerce/intent                # Returns a quote + RouterDecision (preview, no purchase row yet)
POST   /api/commerce/purchase              # Creates a purchase row; transitions draft → quote_required → quoted → payment_pending
GET    /api/commerce/purchase/:id          # Read own purchase (RBAC: buyer or receiver)
POST   /api/commerce/purchase/:id/cancel   # Customer cancel (only valid pre-paid)
POST   /api/commerce/purchase/:id/refund   # Customer-initiated refund (cooling-off or fail)
GET    /api/commerce/purchase/:id/events   # Own audit (redacted — no fee details)
```

Headers: `Idempotency-Key` required on POST.

Request to `/api/commerce/purchase`:
```json
{
  "surface": "gift_card",
  "surfaceMetadata": { "amountCents": 20000, "receiverEmail": "r@example.com" },
  "paymentMethod": "bit"
}
```

Response:
```json
{
  "purchaseId": "p_abc",
  "status": "payment_pending",
  "paymentSessionParams": { "redirectUrl": "https://app.sumit.co.il/pay/..." },
  "feeDisclosure": { "showsFeeBreakdown": false, "totalCents": 20000, "currency": "ILS" }
}
```

### 14.2 Admin-facing

```
GET    /api/admin/finance/purchase-audit                    # Cross-surface audit search
GET    /api/admin/finance/receipt-failures                  # Queue
POST   /api/admin/finance/receipt-failures/:id/retry        # Retry SUMIT issuance
POST   /api/admin/finance/receipt-failures/:id/manual       # Manual receipt number entry (MFA required)
POST   /api/admin/finance/receipt-failures/:id/cancel       # Cancel + refund
GET    /api/admin/finance/fee-drift                         # Queue
POST   /api/admin/finance/fee-drift/:id/accept              # Accept drift; writes manual adjustment
GET    /api/admin/finance/manual-review                     # Queue
POST   /api/admin/finance/manual-review/:id/release         # Release back to lifecycle
GET    /api/admin/finance/router/rate-table                 # Read current rates
POST   /api/admin/finance/router/rate-table                 # Add a rate row (draft/pending_finance)
POST   /api/admin/finance/router/rate-table/:id/approve     # Finance approval (MFA, status=finance_confirmed)
POST   /api/admin/finance/router/override                   # Per-purchase override (MFA)
```

All under `requireAdmin` + admin route hardening (`server/routes.ts:413-436`).

### 14.3 Webhook endpoints

```
POST   /api/webhooks/sumit                                  # SUMIT receipt + settlement webhooks
POST   /api/webhooks/upay                                   # UPAY direct webhooks (when enabled)
POST   /api/webhooks/wolt                                   # Wolt Packages dispatch + delivery
POST   /api/webhooks/aftership                              # AfterShip tracking unification
POST   /api/webhooks/nayax                                  # Nayax kiosk vend confirmation (existing — reused)
```

Each verifies the provider's signature, looks up the purchase by `provider_reference`, transitions the lifecycle accordingly. Replay-safe via unique index.

### 14.4 Internal service interfaces

```ts
class PaymentProviderRouter {
  route(intent: PurchaseIntent, quote: PriceQuote): RouterDecision;
}

class PurchaseLifecycleService {
  create(intent: PurchaseIntent, quote: PriceQuote, decision: RouterDecision): Promise<Purchase>;
  transition(purchaseId: string, to: PurchaseStatus, actor: Actor, meta?: object): Promise<PurchaseEvent>;
  markPaid(purchaseId: string, transactionId: string, providerName: string): Promise<PurchaseEvent>;
  requestRefund(purchaseId: string, opts: RefundOpts): Promise<PurchaseEvent>;
}

class ReceiptInvoiceService {
  issue(purchaseId: string): Promise<{ receiptNumber: string } | { status: 'failed' | 'retry' }>;
}

class NotificationEngine {
  plan(event: PurchaseEvent, ctx: NotificationContext): NotificationPlan;
}

class DeliveryRouter {
  route(input: DeliveryInput): DeliveryDecision;
}
```

## 15. Money & audit (ledger movements, reconciliation)

### 15.1 Ledger movements (crown jewel untouched)

- Every `paid` transition triggers an existing wallet API call that writes to `walletLedgerEntries` (`schema.ts:11675`). **Lifecycle never writes to the ledger directly.**
- Bucket usage:
  - Booking → existing `service_revenue` bucket via existing booking write path.
  - Shop physical goods → existing `service_revenue` bucket via sibling shop SDD's checkout path.
  - Gift card issuance → existing prepaid liability bucket via `EgiftFinancialService`.
  - Gift card redemption → existing bucket transfers via `CouponService` / wallet APIs.
  - Wallet top-up → existing `topup` bucket via `UnifiedWalletService`.
  - Franchise fee → existing `service_revenue` bucket.
  - Kiosk → existing kiosk-sale bucket via `NayaxOnlinePaymentService`.
- **No new bucket.** Lifecycle is metadata; ledger is money.

### 15.2 Audit trail

- Every `purchase_events` row is the **lifecycle audit**.
- Every `walletLedgerEntries` row is the **money audit**.
- Cross-reference: `walletLedgerEntries.referenceId` already exists; we extend its convention so any purchase-linked ledger row carries `referenceType='purchase' + referenceId=purchases.id`. (This is a usage convention, not a schema change.)
- Daily reconciliation (`walletReconciliationRuns`, `schema.ts:11735`) compares `purchase_events` paid-state transitions to `walletLedgerEntries` rows — any mismatch surfaces in finance.

### 15.3 Refund reversal

- Refund issues a counter-row in `walletLedgerEntries` via existing wallet APIs.
- `FinancialDocumentService.create({ documentType: 'refund_receipt', ... })` issues the SUMIT refund document.
- `purchases.status` transitions to `refunded` (or `refund_partial`).
- `purchase_events` row records the refund with `actorType` (`customer` or `admin`) and `metadataJson.refundReason`.

### 15.4 Reconciliation queries

- Per-day per-acquirer: `SELECT SUM(amount_cents - fee_snapshot.amount) FROM purchases WHERE status IN ('receipt_issued','completed') GROUP BY acquirer, date`.
- Drift detection: join `purchases.fee_snapshot_json` to acquirer settlement report; deltas → `walletFraudLog`.
- Receipt-number continuity: sequential check on SUMIT receipt numbers per receipt book (whichever §19.3 answer applies).

## 16. Rollout & feature flags

### 16.1 Feature flag tree

- `ff.commerce.unified_purchase_lifecycle.enabled` — umbrella. **OFF by default.** When ON, the universal services are wired but per-surface adoption is still gated by sub-flags.
- `ff.payments.router.enabled` — router runs in shadow mode (logs its decision but adapter still uses today's hardcoded acquirer).
- `ff.payments.router.upay_direct` — gates the UPAY-direct rail. **OFF until finance signs contract.**
- `ff.purchase.lifecycle.shop` — shop adapter writes to universal `purchases` + `purchase_events` (alongside `shop_orders`).
- `ff.purchase.lifecycle.wallet_topup` — pilot surface.
- `ff.purchase.lifecycle.gift_cards` — gift card adapter on.
- `ff.purchase.lifecycle.bookings` — cohort-controlled (walker → sitter → trainer → wash live → academy).
- `ff.purchase.lifecycle.franchise` — franchise adapter on.
- `ff.purchase.lifecycle.kiosk` — kiosk adapter on.
- `ff.purchase.audit_unified` — when ON, surfaces stop writing per-surface event tables and rely solely on `purchase_events`. Last flag to flip.
- `ff.notifications.buyer_receiver_split` — when ON, NotificationEngine planning replaces per-surface ad-hoc notification code.

### 16.2 Phased migration (per operator's stated sequence)

| Phase | Surface | Flag ON | Notes |
|---|---|---|---|
| 0 | (none) | `ff.commerce.unified_purchase_lifecycle.enabled` | Schema + types land; no behavioural change |
| 1 | **Shop** | `ff.purchase.lifecycle.shop` | Codex prototype lands as-is in implementation PRs; refactor onto unified types in pass 2 |
| 2 | **Wallet top-ups** (pilot) | `ff.purchase.lifecycle.wallet_topup` | Smallest surface; easiest to validate |
| 3 | **Gift cards** | `ff.purchase.lifecycle.gift_cards` | Already has buyer/receiver split |
| 4 | **Bookings** | `ff.purchase.lifecycle.bookings` | Largest; cohort by booking engine: walker → sitter → trainer → wash live → academy |
| 5 | **Franchise + Kiosk** (parallel with phase 4) | `ff.purchase.lifecycle.franchise`, `ff.purchase.lifecycle.kiosk` | Low volume; can ride alongside booking cohorts |
| 6 | `ff.notifications.buyer_receiver_split` ON | — | Notification engine becomes single source |
| 7 | `ff.payments.router.enabled` flipped from shadow to authoritative | — | Router decides acquirer for real |
| 8 | `ff.payments.router.upay_direct` ON | — | UPAY-direct rail goes live (pending finance contract) |
| 9 | `ff.purchase.audit_unified` ON | — | Per-surface event tables become append-only ghosts; reads move to `purchase_events` |

### 16.3 Migration safety

- Schema migration is additive; rollback = drop new tables + drop new columns. No data loss.
- Per-surface adapters dual-write during their phase (per-surface table + universal table). Reads still come from per-surface table.
- Read flip is the last per-surface step; behind `ff.purchase.audit_unified`.
- Router stays in shadow mode (logs only) for the entire shop+wallet+gift+booking migration window. Only flipped to authoritative once finance has signed off on the rate table.

## 17. Test plan

### 17.1 Unit tests

| ID | Description | Layer |
|---|---|---|
| U1 | `PaymentProviderRouter.route()` returns SUMIT+UPAY 1.10% for default card | service |
| U2 | Returns 1.60% for Bit | service |
| U3 | Returns UPAY-direct 0.90% only when segment=`otef_eligible_business` AND status=`finance_confirmed` | service |
| U4 | Returns `wallet_only` when paymentMethod=`wallet_redemption` and balance covers amount | service |
| U5 | Returns `nayax` for kiosk surface | service |
| U6 | Refuses (returns null) when no eligible rate row | service |
| U7 | `requires_contract_confirmation=true` blocks checkout for UPAY-direct rate without finance approval | service |
| U8 | State machine rejects invalid transitions (e.g., `paid → payment_pending`) | service |
| U9 | State machine rejects same-state self-transition (idempotent — does NOT throw, returns existing event) | service |
| U10 | `ReceiptInvoiceService.issue()` refuses to write placeholder `receipt_number` on SUMIT error | service |
| U11 | `ReceiptInvoiceService.issue()` after N retries transitions to `manual_review` | service |
| U12 | `NotificationEngine.plan()` redacts price + payment method from receiver | service |
| U13 | `NotificationEngine.plan()` Hebrew-first for `locale='he'` user | service |
| U14 | `DeliveryRouter.route()` returns `wolt` only when all five eligibility constraints pass | service |
| U15 | `DeliveryRouter.route()` returns `israel_post` as fallback | service |
| U16 | `DeliveryRouter.route()` blocks checkout when neither Wolt nor Israel Post returns a real label | service |
| U17 | `BookingAdapter` maps `BookingLifecycleStatus.deposit_received` to universal `paid` | service |
| U18 | Cross-surface `transactionId` uniqueness per-acquirer enforced at DB constraint | DB |
| U19 | `receiptNumber` uniqueness per-`system_of_record` enforced at DB constraint | DB |
| U20 | `purchase_events.provider_reference` unique-per-provider enforced | DB |

### 17.2 Integration tests

| ID | Description |
|---|---|
| I1 | Happy path: wallet top-up via SUMIT+UPAY → `completed`; ledger row matches snapshot |
| I2 | Happy path: gift-card purchase, buyer sees receipt, receiver gets ONLY redemption link |
| I3 | Happy path: booking deposit; universal lifecycle shadow matches `BookingLifecycleStatus` |
| I4 | Happy path: shop order → Wolt eligible → label_created → delivered → completed |
| I5 | Happy path: kiosk vend via Nayax → `fulfilled (vended)` |
| I6 | Failure: SUMIT receipt issuance fails 3x → `manual_review` queue; admin retry succeeds |
| I7 | Failure: acquirer rejects → `failed`; no ledger row written; buyer SMS sent |
| I8 | Failure: Wolt live quote returns null → checkout blocked at `quote_required`; no payment session |
| I9 | Failure: cooling-off invocation within 14 days for shop goods → `refund_pending → refunded`; SUMIT refund doc issued |
| I10 | Failure: cooling-off invocation outside 14 days → 422 response |
| I11 | Concurrency: two `markPaid` calls with same `Idempotency-Key` → one row, one ledger entry |
| I12 | Concurrency: SUMIT webhook arrives before `markPaid` returns → no double-mint; final state correct |
| I13 | Refund partial: 2 line items, refund 1 → `refund_partial`; second refund → `refunded` |
| I14 | Admin override: change acquirer from `upay_via_sumit` to `upay_direct` → audit row with `actorType='admin'` |
| I15 | Fee drift: reconciliation flags mismatch → `walletFraudLog` row + finance queue surfaces it |

### 17.3 Fraud/abuse tests

| ID | Description |
|---|---|
| F1 | Client submits forged `amountCents` in payload → server ignores, uses authoritative state |
| F2 | Client submits forged `transactionId` → endpoint has no field for it; rejected |
| F3 | Replayed webhook with same `provider_reference` → no-op |
| F4 | Two purchases attempt the same `transactionId` for the same acquirer → DB rejects second |
| F5 | Attempt to mint duplicate `receiptNumber` → DB rejects |
| F6 | Customer attempts to refund another customer's purchase → 403 |
| F7 | Customer reads another customer's `purchase_events` → 403 |
| F8 | Admin override without MFA → rejected |
| F9 | Otef-eligibility claimed without contract row → router falls back to default |
| F10 | Manual receipt-number entry by non-MFA admin → rejected |

### 17.4 Accessibility / RTL tests

| ID | Description |
|---|---|
| A1 | Payment-method selector renders RTL on `dir="rtl"` |
| A2 | Receipt email Hebrew-first |
| A3 | Receiver-redacted email contains NO price string in any language |
| A4 | Screen reader announces payment method + fee disclosure in Hebrew |
| A5 | Admin queues mobile-first (operator runs from phone) |

### 17.5 Reconciliation tests

| ID | Description |
|---|---|
| R1 | Daily reconciliation finds zero discrepancies on happy-path days |
| R2 | Reconciliation flags fee drift > 0 bps |
| R3 | Reconciliation flags `purchases` row in `receipt_issued` with no `walletLedgerEntries` paired row |
| R4 | Reconciliation flags receipt-sequence gap on SUMIT book |

## 18. Rollback plan

Each phase has a corresponding rollback. Order matters — undo in reverse.

| Phase | Rollback step |
|---|---|
| 9 (audit unified ON) | Set `ff.purchase.audit_unified=false`; surfaces resume reading per-surface event tables |
| 8 (UPAY direct) | Set `ff.payments.router.upay_direct=false`; router stops emitting UPAY-direct decisions; in-flight purchases continue settling via UPAY-direct (no mid-flight switch) |
| 7 (router authoritative) | Set `ff.payments.router.enabled` back to shadow mode; surfaces revert to today's hardcoded acquirer |
| 6 (notifications unified) | Set `ff.notifications.buyer_receiver_split=false`; per-surface notifications resume |
| 5 (franchise + kiosk) | Set respective sub-flags off; surfaces revert |
| 4 (bookings cohorts) | Set `ff.purchase.lifecycle.bookings` off; booking write path stops dual-writing |
| 3 (gift cards) | Set `ff.purchase.lifecycle.gift_cards` off |
| 2 (wallet top-ups) | Set `ff.purchase.lifecycle.wallet_topup` off |
| 1 (shop) | Set `ff.purchase.lifecycle.shop` off; sibling shop SDD's checkout continues unaffected |
| 0 (schema) | If absolutely necessary, drop `purchase_events`, `purchases`, `payment_provider_routes`, drop nullable `purchase_id` columns. **All schema is additive — data loss is limited to the universal-table-only rows.** |

**Data reversal**: ledger entries (`walletLedgerEntries`) are untouched throughout. Rollback never alters money. Worst case: customers who got receipts mid-flight keep them (SUMIT issued them, the receipt is legal). New purchases stop using the unified system.

**Emergency stop**: `ff.commerce.unified_purchase_lifecycle.enabled=false` instantly disables all unified write paths. Per-surface code paths continue independently. There is no scenario in which the unified system can corrupt money — the ledger and SUMIT remain the sources of truth.

## 19. Open questions (must be answered before phase 7 — router authoritative)

1. **SUMIT-vs-UPAY rate negotiation timing** — when do we pull actual contract rates from finance? Public website rates (1.10%, 1.40%, 1.60%, 4.20%, 0.90%) are starting points; finance must sign each `payment_provider_routes` row. Open: target date for first finance approval pass.
2. **Per-surface payment-method defaults** — should gift card purchase be card-only (operator suggestion)? booking accept Bit+card? wallet top-up card-only (to avoid double-card-fee on top-up + later purchase)? Each surface needs an explicit allow-list — proposed defaults need finance + operator sign-off.
3. **Receipt sequence — one shared SUMIT receipt book or per-surface books?** v1 default: ONE shared sequence (no operational change). Finance may want per-surface books for cleaner reporting. Tradeoff: operational overhead vs reporting clarity.
4. **Refund routing** — does UPAY refund flow through SUMIT (preserving the legal source-of-record symmetry) or directly via the acquirer? Today's booking refunds go SUMIT; should kiosk Nayax refunds go SUMIT too (likely no — Nayax is mechanical)?
5. **Wallet redemption + Sumit card split-tender across surfaces** — today's flag (`ff.commerce.split_tender`) is shop-only. Do we extend split-tender (partial wallet + remainder card) to bookings, gift-card purchases, franchise fees? Each surface may have legal-receipt implications.
6. **Migration scope — backfill historic bookings into `purchase_events`?** v1 default: no backfill. Only new purchases write to universal audit. If finance/ops wants historic visibility, a one-time backfill job is a follow-up SDD.
7. **Cooling-off per surface** — Israeli מכר מרחוק / חוק הגנת הצרכן distinguishes goods vs services vs gift cards. Goods: 14 days. Services: shorter, with exceptions for "performed" services. Gift cards: 14 days but only against unredeemed balance. Need explicit per-surface eligibility table approved by legal.
8. **Multi-actor purchases — three-way notification matrix** — for a gifted booking, buyer + receiver + provider all need different notifications. Default matrix proposed (§9.6); operator and provider-experience team need to sign off on cadence.
9. **Idempotency — global idempotency table or per-provider for webhooks?** Today: `walletIdempotencyKeys` is platform-wide (used for customer requests). Webhooks use the unique index on `purchase_events(provider_name, provider_reference)`. Question: do we add an explicit `webhook_idempotency` table to absorb webhooks before they reach `purchase_events`? Tradeoff: extra write vs cleaner separation.
10. **Cross-surface transactionId collisions** — v1 default: enforce uniqueness per `(acquirer, transaction_id)`. UPAY-direct and Nayax could legitimately reuse a numeric ID. Question: do we enforce platform-wide uniqueness (`transaction_id` alone) instead? Cleaner but may collide. Recommend: keep per-acquirer in v1.
11. **(Bonus)** — When `acquirer='wallet_only'`, do we still mint a SUMIT receipt? Today: yes for booking via existing wiring (zero-cash receipt). Confirm for every surface; especially gift-card redemption against wallet (the redemption may not need a separate receipt if the receiving surface already gets one).
12. **(Bonus)** — `manual_review` SLA — how long should the finance queue allow a purchase to sit before auto-cancelling with a refund? Per-surface or platform-wide? Proposed: 72 hours platform-wide, configurable per surface.
13. **Nayax-as-general-acquirer (operator strategic input, 2026-05-26)** — beyond the existing kiosk wiring, operator suggests Nayax Israel for non-kiosk surfaces because terminal ownership eliminates monthly rental and may yield a lower lifetime fee profile than UPAY-via-SUMIT at high volumes. Open: finance to model TCO (terminal capex + per-transaction card fees + maintenance + chargeback handling) vs SUMIT-aggregated UPAY at projected PetWash volume across shop and bookings. Decision blocks any `acquirer='nayax'` rule for surfaces other than `kiosk`. Until decided, the router will refuse to route shop/booking traffic to Nayax even if a rate row is seeded.
14. **SUMIT API provisioning timing (operator-resolved 2026-05-26)** — operator confirms SUMIT API access has been provisioned and PetWash's business account is sync-ready. Implementation PR-7+ (§20) can call SUMIT directly without a separate provisioning step. Open: does the existing SUMIT account use the SUMIT-aggregated UPAY billing path (1.1%+VAT) or a custom contract? Finance must surface this before PR-7 codes the fee snapshot.

## 20. First implementation PR

**Smallest safe slice (PR-1, schema + types only — zero behavioural change):**

- `migrations/0040_purchase_lifecycle_unified.sql` — creates `purchases`, `purchase_events`, `payment_provider_routes` (no constraints on per-surface tables in this PR).
- `shared/purchase-lifecycle/types.ts` — `PurchaseSurface`, `PurchaseStatus`, `PaymentMethod`, `CustomerSegment`, `FeeSnapshot`, `RouterDecision`, `PurchaseEvent`, `PurchaseIntent`.
- `shared/purchase-lifecycle/transitions.ts` — declarative transition table (constant export).
- `server/services/commerce/PurchaseStateMachine.ts` — pure function `canTransition(from, to): boolean`.
- Unit tests for state machine (U8, U9 from §17.1).
- Behind `ff.commerce.unified_purchase_lifecycle.enabled` (no callers yet — flag is informational).

**Acceptance criteria for PR-1:**

- Migration runs cleanly forward + reverse against a copy of staging DB.
- TypeScript types compile in `shared/` and are importable from `server/`.
- State machine unit tests pass (correctness + idempotent self-transition).
- No existing code path is touched.
- No new dependencies.

**Subsequent PRs (sketch — each its own SDD review or smaller decision doc):**

- PR-2: `PaymentProviderRouter` (pure function, no I/O except reading `payment_provider_routes`); behind `ff.payments.router.enabled` in shadow mode; logs decisions, returns them, but no surface consumes the result yet.
- PR-3: `PurchaseLifecycleService.create()` + first adapter — `WalletTopUpAdapter` (pilot surface; smallest surface area).
- PR-4: `ReceiptInvoiceService` thin wrapper over `FinancialDocumentService`; wallet top-up surface uses it.
- PR-5: `NotificationEngine` (planner only — dispatchers reuse existing email/SMS/push services).
- PR-6: `DeliveryRouter` (pure function; shop surface uses it).
- PR-7: `ShopPurchaseAdapter` (lifts Codex prototype onto unified primitives).
- PR-8: `GiftCardAdapter`.
- PR-9: `BookingAdapter` (largest; cohort rollout).
- PR-10: `FranchiseFeeAdapter`, `KioskAdapter`.
- PR-11: Finance admin queues (`/admin/finance/{receipt-failures, fee-drift, manual-review, router/*}`).
- PR-12: Reconciliation extensions (daily job extensions on `walletReconciliationRuns`).
- PR-13: `ff.purchase.audit_unified` flip — per-surface event tables become append-only ghosts.
- PR-14: `ff.payments.router.enabled` flipped to authoritative (after finance signs the rate table).
- PR-15: `ff.payments.router.upay_direct` ON (after finance signs UPAY-direct contract).

## 21. Appendix A — original operator request (verbatim)

> very intersting way of thinking brain codex agent got, not stupid like replit, read vthis its valled to our platforms not only shop , fees choice system ai smart logic . Update

(Preserved verbatim per skill rule §3 / §5. Translation guide for non-Hebrew-speakers: "very interesting way of thinking codex agent got, not stupid like replit, read this — apply to all our platforms not only shop, fees-choice system, smart logic. Update [the design].")

Author intent (paraphrase for clarity, not replacement of the above): lift the Codex shop-only prototype thinking (payment-provider policy, lifecycle state machine, buyer/receiver notification split, delivery routing decision) to a **platform-wide architecture** covering every paid surface (bookings, gift cards, wallet top-ups, franchise fees, kiosk products, shop physical goods). The operator's praise for Codex over Replit signals: they value careful, evidence-grounded design that cites real sources (sumit.co.il help, upay.co.il) and refuses to invent fake receipt numbers or fake tracking — those guarantees must be the spine of the platform-wide design.

## 22. Appendix B — finance-confirmed rate table format

Example `payment_provider_routes` rows the operator + finance need to seed:

```
acquirer            surface  method  segment                  fee_bps  fee_vat_bps  source                  status               rcc
upay_via_sumit      *        card    b2c                      110      19.8         sumit.co.il/help        finance_confirmed    false
upay_via_sumit      *        card    b2b                      110      19.8         sumit.co.il/help        finance_confirmed    false
upay_via_sumit      *        bit     *                        160      28.8         sumit.co.il/help        finance_confirmed    false
upay_via_sumit      *        card    *  (special/non-IL)      420      75.6         sumit.co.il/help        finance_confirmed    false
upay_direct         *        card    otef_eligible_business   90       16.2         upay.co.il              pending_finance      true     ← needs contract
nayax               kiosk    card    *                        (per existing Nayax agreement)               finance_confirmed    false
wallet_only         *        wallet_redemption  *             0        0            n/a                     finance_confirmed    false
```

(`rcc` = `requires_contract_confirmation`)

Acronym key: `*` = applies to all values of that column. `b2c` / `b2b` / `otef_eligible_business` = customer segment. `bps` = basis points (100 bps = 1.00%).

## 23. Appendix C — Codex prototype file map (out of repo)

These files were prototyped on the operator's local machine by Codex and are NOT present in this repo's branches. They are described here for traceability so future reviewers know the provenance of the platform-wide design.

| File | Role | Mapped to platform-wide component |
|---|---|---|
| `server/services/shop/ShopPaymentProviderPolicy.ts` | SUMIT vs UPAY decision, fee snapshot, contract-confirmation flag | `server/services/commerce/PaymentProviderRouter.ts` (§6) |
| `server/services/shop/ShopOrderLifecycleService.ts` | Order-level state machine, audit row emission | `server/services/commerce/PurchaseLifecycleService.ts` (§7) |
| `server/services/shop/ShopOrderStateMachine.ts` | Declarative transition table | `server/services/commerce/PurchaseStateMachine.ts` (§7.3) |
| `server/services/shop/ShopNotificationPlanner.ts` | Buyer-vs-receiver redaction, Hebrew-first templates | `server/services/commerce/NotificationEngine.ts` (§9) |
| `server/services/shop/ShopDeliveryRoutingService.ts` | Wolt vs Israel Post eligibility, hard guard on live quote | `server/services/commerce/DeliveryRouter.ts` (§10) |
| `migrations/0039_shop_purchase_lifecycle.sql` | `shop_orders` additive columns, `shop_order_events` table | `migrations/0040_purchase_lifecycle_unified.sql` (§12.5) |

These prototypes proved the shape works for one surface. This SDD generalises them to six.

---

**End of SDD.** Per skill rule §5, this is one document. No code, no PRs, no agents. Branch: `claude/sdd-universal-payment-and-lifecycle`. Operator review step pushes when ready.
