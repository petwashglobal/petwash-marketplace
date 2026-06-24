# PetWash Platform — 360° Integrity Audit (2026-06-24)

Multi-agent, adversarially-verified sweep of every money/transaction surface.
**70 agents · 8 domains · 61 raw findings → 35 confirmed.** Each confirmed finding
was independently verified (a second agent tried to *refute* it) and given a
corrected severity.

| Domain | Found | Confirmed |
|---|---|---|
| Shop (cart→checkout→stock→delivery→ledger) | 13 | 10 |
| Booking lifecycle (incl. lost-connection) | 9 | 5 |
| Availability / pending state | 8 | 5 |
| eGift | 7 | 4 |
| Wallet integrity | 7 | 3 |
| Payments / confirmations | 7 | 2 |
| Auth / fraud / IDOR | 6 | 3 |
| K9000 redeem | 4 | 3 |

## Verdict

High-value owned-rail cores (K9000 redeem, eGift activation, the booking state
machine) are structurally sound and use atomic SQL on the hottest paths. The
platform is **not launch-ready as a whole** because of three defect classes that
can move real money: (a) the **shop checkout is wired to methods that don't
exist** and will crash when enabled; (b) several **money mutations lack
idempotency or transactional atomicity** (admin credit, K9000 auto-compensation,
unified add-funds, ledger writes); (c) several **webhooks/state checks are
missing a guard** (late payment webhook revives dead bookings; top-up credits on
"authorized" not "settled").

> **Important nuance from verification:** the synthesizer's headline #1
> ("client-controlled booking price", `bookings.ts`) was **downgraded to MEDIUM** —
> that endpoint is **legacy/undocumented and NOT used by production booking flows**
> (walk/sitter use separate server-priced endpoints). Still worth disabling/validating,
> but it is not the catastrophe the raw headline implied. Use the *corrected*
> severities below.

## Corrected must-fix (worst-first, reachable today)

1. **Admin manual-credit: header-only secret + no idempotency** — `prestige-pass.ts:2237-2298`. No Firebase verify; double-click double-credits; audit actor can default to literal `'admin'`. *(auth + money)*
2. **Unified add-funds double-credit** — `WalletService.addCredits` skips idempotency when `sourceId` is undefined; `UnifiedWalletService.addFunds` / `POST /api/unified/wallet/add-funds` pass none → retry double-credits. *(money)*
3. **Late Nayax webhook revives dead booking** — `nayax-webhooks.ts:1170-1227` doesn't require `payment_pending`; a cancelled/refunded booking can be resurrected → double-charge. (The sibling `/nayax/payment` webhook *does* gate this — copy it.) *(money/state)*
4. **K9000 auto-compensation double-refund** — `K9000RedemptionService.ts:1098-1251` `autoCompensateSession()` has no `status==='timed_out'` guard; a retry re-credits (₪55→₪110). Hard to hit today but a real gap. *(money)*
5. **Top-up credits on "authorized" not "settled"** — `wallet-topup-verify.ts:70` accepts `authorized` (a hold); if the card later declines, spendable credits exist for unpaid money. *(money)*
6. **Tax sequence concurrency** — `TaxSequenceService.ts:63-89` advisory lock runs on pooled connections (lock ≠ select ≠ insert), so it protects nothing. A unique constraint now exists (so duplicates *fail* instead of silently writing), but under load it causes receipt-issue **failures**; fix = wrap allocation+insert in one tx with `pg_advisory_xact_lock`. *(legal/compliance)*
7. **Non-atomic ledger writes** — `WalletService.ts` `adminInjectCredits` (916-922) & `refundRedemption` (516-598) update balance then insert ledger outside a tx → crash window = balance moved with no audit trail. *(integrity)*
8. **Provider paid on unpaid booking (defense-in-depth)** — `booking-requests.ts:2088-2097,2406-2423` releases escrow/creates earning without asserting `paymentHeldAt`. State machine prevents it today; add the explicit check. *(money)*
9. **Shop checkout crashes when enabled** — `shop.ts` calls non-existent `EscrowService.hold/cancel/release` + `WalletService.deductFromWallet/creditWallet`, and never decrements stock (oversell). Flag-OFF today; **do not flip `SHOP_*_ENABLED` until rewired.** *(broken-wiring/state)*
10. **Gift recipient-email enumeration** — `gift-cards.ts:839-869` public `GET /:voucherId/info` returns `recipientEmail` with no auth/rate-limit. *(privacy)*

## All 35 confirmed findings

Severity shown is the **corrected** (post-verification) value. "Reach" = exploitable in current production wiring (Y), latent/defense-in-depth (latent), or behind an off flag (flag-off).

| # | Sev | Reach | Domain | Title | File |
|---|---|---|---|---|---|
| 1 | critical | flag-off | shop | Stock not decremented on order (oversell) | ShopService.ts:525-528 |
| 2 | critical | flag-off | shop | EscrowService.hold/cancel/release don't exist | shop.ts:368,476,602 |
| 3 | critical | flag-off | shop | No stock re-check at checkout (oversell) | ShopService.ts:331-337 |
| 4 | critical | Y | wallet | Non-atomic admin credit injection (no tx) | WalletService.ts:916-922 |
| 5 | high | latent | booking | Provider paid w/o paymentHeldAt check | booking-requests.ts:2088,2406 |
| 6 | high | Y | booking | Late webhook revives dead booking → double-charge | nayax-webhooks.ts:1170-1227 |
| 7 | high | Y | booking | Slot lock never released if decline-msg fails | booking-requests.ts:1305-1307 |
| 8 | high | Y | booking | 100%-refund abuse right after provider accept | booking-requests.ts:2920-2948 |
| 9 | high | flag-off | shop | WalletService.deductFromWallet/creditWallet don't exist | shop.ts:327,477 |
| 10 | high | flag-off | shop | Order created before payment (ghost orders) | shop.ts:332-349 |
| 11 | high | flag-off | shop | Tax invoice only on delivery, not at sale | shop.ts:600-604 |
| 12 | high | flag-off | shop | Refund doesn't restore stock post-delivery | ShopService.ts:609-615 |
| 13 | high | flag-off | shop | Delivery cost not locked until payment | shop.ts:314,319 |
| 14 | high | Y | egift | Unified add-funds double-credit (no sourceId idempotency) | WalletService.ts:659-772 |
| 15 | high | Y | egift | Legacy giftCardBalance orphaned (unspendable funds) | legacy-gift-card-redeem-handler.ts |
| 16 | high | Y | egift | Gift recipient email enumeration (public, no rate-limit) | gift-cards.ts:839-869 |
| 17 | high | Y | wallet | Top-up credits on 'authorized' not 'settled' | credit-wallet.ts:204-211 |
| 18 | high | Y | wallet | refundRedemption not atomic (balance vs ledger) | WalletService.ts:516-598 |
| 19 | high | latent | redeem | K9000 auto-compensation double-refund (no idempotency) | K9000RedemptionService.ts:1098-1251 |
| 20 | high | latent | redeem | (dup) auto-comp missing timed_out guard | K9000RedemptionService.ts:1098-1127 |
| 21 | high | Y | payments | Tax sequence advisory lock ineffective (pooled conns) | TaxSequenceService.ts:63-89 |
| 22 | high | Y | avail | No sweeper for expired 'authorized' payment intents | NayaxJobDispatchPaymentService.ts:369 (schema mismatch) |
| 23 | high | Y | avail | Slot shown 'available' though bookingId set | bookings.ts:440 |
| 24 | high | Y | avail | Expired escrow holds stuck if cron fails (no DLQ) | EscrowService.ts:418-448 |
| 25 | high | Y | avail | Voucher redemption ack timeout — no sweeper | storage.ts:1687-1787 |
| 26 | high | Y | avail | Payout gate hold has no timeout/force-release | ProviderPayoutService.ts:170-188 |
| 27 | high | Y | auth | admin/manual-credit header-only secret (no Firebase) | prestige-pass.ts:2237-2298 |
| 28 | high | Y | auth | admin/manual-credit no idempotency (double-credit) | prestige-pass.ts:2237-2298 |
| 29 | medium | flag-off | shop | Escrow not integrated with shop order statuses | shop.ts:600-602 |
| 30 | medium | flag-off | shop | No geo-validation on delivery address | shop.ts:132-140 |
| 31 | medium | Y | redeem | Bay session active before machine ACK (no live verify) | K9000RedemptionService.ts:979-1008 |
| 32 | medium | Y | payments | Settlement ±1 agora tolerance (slow-bleed) | nayax-webhooks.ts:313,560 |
| 33 | medium | legacy | auth | Client-controlled booking price (LEGACY unused endpoint) | bookings.ts:44-256 |
| 34 | low | Y | booking | Wallet debit in setImmediate desync (self-healed by cron) | booking-requests.ts:1327-1360 |
| 35 | low | latent | egift | Recipient binding check not atomic with update | gift-cards.ts:891-966 |

## Systemic root causes

- **Divergent / fictional service contracts** — shop wired to booking-only Escrow/Wallet APIs that don't exist; multiple booking paths bypass the payment-held invariant. (The known "three divergent booking engines" theme.)
- **Non-atomic ledger pattern repeated** — balance `UPDATE` first, ledger `INSERT` last, no enclosing transaction (4, 14, 18).
- **Missing idempotency on money mutations** — K9000 compensation (19/20), admin credit (28), top-up-on-authorized (17), unified add-funds (14). Contrast `credit-wallet` / `manual-adjustment.ts` which *do* require keys.
- **Webhook/state-validation gaps** — payment webhooks accept events without validating the booking is in a legal state (6, 23); ±1 agora tolerance (32).
- **No backstop sweepers / dead-letter** — expired auths (22), escrow holds (24), voucher acks (25), payout gates (26) rely on a single cron with no retry/DLQ.
- **Trusting client input** — legacy client-set price (33), no checkout stock re-check (3), delivery cost not locked (13).
- **Order-before-payment / fiscal-doc timing** — shop creates orders before charge (10) and issues the tax invoice on delivery not at sale (11).

## What looks healthy

- K9000 redemption core uses atomic transactions for session/bay/credit decrement (compensation idempotency is the exception).
- eGift activation is idempotent in practice (`gift-cards.ts` always supplies `voucherId` as a stable `sourceId`; redemption uses an atomic REDEEMED update).
- Refund/restore + admin-credit use SQL increments (no lost-update race) — the gap is only the transactional wrapping of the ledger insert.
- `redeemVoucherAtomic` decrements + records in one transaction; the legacy gift-card redeem endpoint is correctly disabled (410 GONE).
- The settlement webhook does amount-match reconciliation (only defect is the ±1 agora tolerance).
- Provider payout is gated by `checkPayoutGates` (fail-closed); the weakness is operational (no timeout), not a bypass.

## Fix sequencing (each = its own careful, tested PR)

**Batch A — money mutation hardening (no schema):** 4, 18 (wrap in tx) · 14 (require sourceId idempotency on unified add-funds) · 27, 28 (admin-credit: Firebase verify + idempotency key) · 19/20 (auto-comp `timed_out` guard).
**Batch B — webhook/state guards (no schema):** 6 (require `payment_pending`) · 5 (provider paymentHeldAt assert) · 23 (bookingId availability check) · 33 (disable/validate legacy price endpoint) · 16 (auth+rate-limit gift info).
**Batch C — settlement/sweepers:** 32 (log/alert on tolerance) · 24, 25, 26, 22 (retry/DLQ/force-release; 22 also needs a schema-field fix).
**Batch D — tax sequence:** 21 (`pg_advisory_xact_lock` inside one tx) — verify against existing unique constraint.
**Batch E — shop (pre-launch, keep flags OFF):** 1, 2, 3, 9, 10, 11, 12, 13, 29, 30 — rebuild shop↔escrow↔wallet↔stock↔fiscal end-to-end before enabling `SHOP_*_ENABLED`.
**Batch F — legacy/cleanup:** 15 (giftCardBalance migration — needs ops) · 34, 35, 31, 8, 7.

> Migrations / ops needed: #21 (verify constraint), #22 (paymentIntents schema fields), #15 (legacy balance migration). These are flagged for CEO approval before applying.
