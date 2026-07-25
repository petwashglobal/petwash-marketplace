---
name: petwash-money-booking-invariants
description: Non-negotiable safety invariants for PetWash booking, payment, receipt/VAT, payout, and PII code — the regression guardrail that stops the exact bugs the 2026-07-25 octopus audit found from ever coming back. Use this BEFORE writing or reviewing any code that creates a booking, charges or refunds money, issues a receipt or computes VAT, releases a payout, or stores a national ID / bank detail. If your change touches sitter-suite.ts, walk-my-pet.ts, academy.ts, booking-requests.ts, IsraeliDigitalReceiptService.ts, EscrowService.ts, payoutGate.ts, user-profile.ts, or any *_bookings / receipts / payments / ledger table, this skill applies even if the task sounds small. Pairs with petwash-booking-architect (design) and petwash-pr-guardian (process).
---

# PetWash Money & Booking Invariants

This is the guardrail, not the design doc. `petwash-booking-architect` tells you how the system is *shaped*; this tells you the handful of things that, if you get them wrong, silently lose money, double-book a real customer, or leak a national ID. Every rule here is a bug that **actually happened** and was fixed — the audit is in memory (`octopus-end-to-end-safety-xray-2026-07-25`). Your job is to not reintroduce them.

The reason these keep coming back: there is no server type-check gate, there are three parallel booking engines, and several safety gates ship switched *off*. So a wrong field name or a missing lock doesn't fail the build — it fails a live customer. Treat every item below as load-bearing.

Before you change money/booking/PII code, read the relevant section, then confirm in your PR description which invariants your change preserves.

---

## 1. A booking must acquire an atomic slot lock before it inserts

**The bug (P0):** Pet Sitter checked availability and then inserted in two separate steps — two taps double-booked the sitter. Academy had *no* availability check at all. Both are fixed by one mechanism.

**The rule:** any code path that creates a booking for a provider at a time must grab a slot lock **immediately before the insert**, in the same request, and only proceed if it succeeds.

- Use the one proven mechanism: `acquireSlotLock(db, { providerId, startAt, endAt, bookingRef, serviceType })` from `server/lib/marketplaceSlotLock.ts`. It is backed by a Postgres `EXCLUDE` constraint (migration 0028) — the database itself rejects an overlapping insert, so the code cannot race.
- **Key the lock on the provider's canonical Firebase `userId`**, never a per-table numeric id. This is what makes the lock span platforms — a person who both sits and trains cannot be booked twice for the same window across two arms. Same key space as `booking_requests`.
- On `BookingSlotConflictError`, return **409** with a clear "already booked" message. Do not swallow it and insert anyway.
- **Release the lock** (`releaseSlotLock(db, bookingRef)`) when the booking reaches a terminal non-active state (provider declines, customer/owner cancels) and in the `catch` if the insert fails — otherwise a dead request blocks the calendar forever. Over-blocking is the safe direction; double-booking is not.

Reference implementations to copy: `academy.ts` (`/bookings`) and `sitter-suite.ts` (`/bookings`). Do not invent a new per-table `UNIQUE` constraint or a plain `SELECT`-then-insert — that is exactly the race that was removed.

## 2. Every paid booking issues a customer receipt at the fiscal event

**The bug (P0):** the escrow engine (`booking-requests.ts`) recorded a P&L ledger row at completion but issued **no customer receipt at all** — no חשבונית/קבלה. The sitter/walk/academy v1 routes did; this one didn't.

**The rule:** wherever a booking's money becomes final (payment capture, or escrow release / owner-confirm), call `IsraeliDigitalReceiptService.generateReceipt({ ... })`. It has its own exactly-once guard (dedup per `bookingId`), so calling it is idempotent — a second path firing will not double-issue. Make the call fire-and-forget + fail-soft so a receipt problem never rolls back a confirmed booking, but **it must be called**. Pass the correct `paymentClass` (see §3).

## 3. VAT follows the CPA per-class rule — never flat 18% on the whole amount

**The bug (P0):** `generateReceipt` booked 18% on the full amount for every payment class, ignoring the `vatMode` the call sites already declared. Wallet top-ups and eGift purchases were taxed on stored value; provider bookings were taxed on the whole gross instead of the commission.

**The rule:** VAT is decided by `paymentClass` → `getSumitDocumentMapping(paymentClass).vatMode`, resolved by `IsraeliDigitalReceiptService.resolveReceiptVat(params)`. Do not hand-roll a VAT number in a route. The classes that matter:

| paymentClass | vatMode | VAT charged |
|---|---|---|
| `K9000_WASH`, `K9000_PUBLIC_CARD`, `SHOP_ITEM`, `PROVIDER_BOOKING_PRINCIPAL` | FULL_VAT | 18% on the full amount |
| `WALLET_TOPUP`, `EGIFT_PURCHASE` | NO_VAT_STORED_VALUE | **0** — tax is deferred to redemption |
| `PROVIDER_BOOKING_COMMISSION` | VAT_ON_COMMISSION_ONLY | 18% on PetWash's 15% commission only |
| `EGIFT_REDEMPTION` | VAT_AT_REDEMPTION | 18% at the redemption event |
| `REFUND`, `CREDIT_ADJUSTMENT` | CREDIT | credit note via `issueCreditNote`, not `generateReceipt` |

Provider bookings (sitter/walk/academy/booking-requests) are **disclosed-agent → `PROVIDER_BOOKING_COMMISSION`**. If you add a new paid surface, map it in `sumitDocumentMapping.ts` (the switch is exhaustiveness-guarded so a new class must be mapped explicitly by the CPA). Never re-derive tax logic inline — that is CPA-owned.

## 4. Money-in is idempotent; money-out is gated and audited

- **Idempotency:** every charge / top-up / redeem / refund insert must be keyed so a webhook retry or a double-submit cannot create two rows. Existing patterns: `ON CONFLICT (idempotency_key)`, `walletIdempotencyKeys`, `refund_transactions.idempotencyKey`. If you add a money-in path without an idempotency key, that is a defect.
- **Wallet** goes through `WalletLedger` (SHA-256 hash-chained, `SELECT FOR UPDATE`, atomic `balance >= amount` floor). Never write a raw balance setter; `WalletRepository.updateBalance()` is dead on purpose — do not revive it.
- **Payout** must clear the gate chain in `payoutGate.ts` and fail **closed** on the SQL rails (`payoutLedger`, `ProviderPayoutService`). Note: some sub-gates (signed-declaration, strict identity, escrow gate) ship in **shadow mode** behind env flags (`PROVIDER_DECLARATIONS_ENFORCE`, `ESCROW_PAYOUT_GATE_ENFORCE`, `PROVIDER_PAYOUT_STRICT`). Do not add code that assumes they are enforced, and do not quietly widen a shadow gate to auto-pay. Flipping them on is a business/counsel decision, not a code change.
- **Audit:** any event that moves money or changes a role must call `logAuditEvent(...)`. Fiscal + wallet events use the hash-chained `auditLedger`; prefer it for new money events. A money mutation with no audit write is a defect.

## 5. National ID and bank details are encrypted at rest — never plaintext

**The bug (P1):** the profile endpoint wrote `users.id_number` in plaintext while every other path encrypted it.

**The rule:** a national ID (Teudat Zehut) or bank/IBAN value is written with `encryptField(value)` into the `*_enc` column, plus `blindIndex(value)` into the `*_hash` column when you need to look it up. Lookups match on the blind-index hash, never the plaintext column. Masked display uses `maskId` (`server/lib/israeliId.ts`) / `maskIban` (`server/services/secretFieldCrypto.ts`) on the decrypted value. The crypto helpers (`encryptField`, `decryptField`, `blindIndex`) live in `server/services/secretFieldCrypto.ts`. Follow `member-discount.ts` / `user-profile.ts` (`idNumberEnc` + `idNumberHash`). Minimize collection in the first place — do not add an ID field to a flow that does not truly need it (see `petwash-provider-onboarding`).

## 6. booking_requests is canonical; the legacy bridge must not silently drop

Legacy `sitter_bookings` / `walk_bookings` are mirrored into the canonical `booking_requests` (which the provider inbox reads) by `legacyBookingBridge`. That bridge is fire-and-forget today — if it throws, the booking exists but is invisible to the provider ("hung forever"). If you touch it, make the mirror reliable (retry / reconcile), and never make a *new* booking surface that writes only a legacy table without bridging. Keep the **four gates separate** — Deal (booking-requests) · MachineSession (K9000) · Commerce (SUMIT) · Ledger (wallet) — a change in one must not silently mutate another.

---

## Pre-merge checklist (state these in the PR)

1. **Booking insert?** → slot lock acquired before insert, keyed on provider `userId`, 409 on conflict, released on decline/cancel/fail. (§1)
2. **Money becomes final?** → `generateReceipt` is called with the right `paymentClass`. (§2, §3)
3. **VAT?** → decided by `vatMode` via `resolveReceiptVat`, not a literal 18% in the route. (§3)
4. **Money-in?** → idempotency key present. **Money-out?** → gate chain, fail-closed, audited. (§4)
5. **National ID / bank detail?** → `encryptField` + `blindIndex`, no plaintext column written, lookup on hash. (§5)
6. **New booking surface?** → writes/bridges to `booking_requests`; gates not merged. (§6)
7. Add a regression test that pins the invariant your change relies on (grep-level source pins are fine and cheap — see `server/tests/*.regression.test.ts` for the pattern).

If a change genuinely cannot satisfy one of these (e.g. a deliberate product decision), say so explicitly in the PR and explain why the safe direction is preserved. Silence is not an option — that is how these bugs lived for months.
