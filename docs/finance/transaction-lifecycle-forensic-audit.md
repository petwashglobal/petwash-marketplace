# Transaction Lifecycle Forensic Audit

**Subject:** Pet Wash Ltd (פט וואש בע"מ, company № 517145033) end-to-end money flow review.
**Reference specs:** `docs/finance/00-platform-role-model.md` (Part 0), `docs/finance/02-money-object-model.md` (Part 2).
**Mandate:** Forensic, not happy-path. Identify dangerous and illegal patterns before live money moves.
**Status of this document:** SPEC OBSERVATIONS ONLY. No code is to be written off the back of this audit until each P0 finding has counsel + CPA sign-off.

---

## Executive summary

The current code base does not match the platform-role model declared in Part 0 and breaks Part 2 in dozens of places. The design does not separate marketplace-facilitator flows from K9000-direct-seller flows; it does not segregate trust funds; it does not have a single source of truth for "is this booking paid"; and it does not have an append-only ledger. Multiple critical money paths return success without actually moving money, and at least one writes a tax invoice with a hard-coded company ID that does not match the registered company number.

Ranked top-10 (severity tag in brackets — see §5 for full list):

| # | Title | Severity | File:line |
|---|---|---|---|
| 1 | Marketplace "payout" is a NOOP — no funds ever leave platform to provider; only logged | P0-financial-truth | `server/services/NayaxSitterMarketplaceService.ts:151-185` |
| 2 | Tranzila integration is a stub — `_charge()` always returns failure; `verifyWebhookSignature` always returns false | P0-financial-truth | `server/services/TranzilaService.ts:143-169`, `:129-139` |
| 3 | Wallet top-up trusts caller-supplied `nayaxTxId` and `amountCents` with no verification against Nayax | P0-financial-truth | `server/routes/credit-wallet.ts:72-216` |
| 4 | `IsraeliDigitalReceiptService` issues receipts with hard-coded `companyTaxId: '516788400'` — does not match company № 517145033 from Part 0 | P0-illegal | `server/services/VATCalculatorService.ts:369,392`; `server/services/IsraeliDigitalReceiptService.ts:165` (via `COMPANY_TAX_ID` constant) |
| 5 | `SitterAdvancedBookingEngine.moveToEscrow()` is a NOOP — only logs; the in-flight 72h escrow is never actually held | P0-financial-truth | `server/services/SitterAdvancedBookingEngine.ts:315-318` |
| 6 | Two parallel escrow stores: `escrow_payments` (Firestore) AND `escrow_holdings` (Postgres) — split-brain | P0-financial-truth | `server/services/EscrowService.ts:46-47`; `shared/schema.ts:11328` |
| 7 | Loyalty discount reduces provider payout pro-rata — illegal under Part 0.2.4 ("Provider receives full service price net of platform fee, regardless of customer's promo discount") | P0-illegal | `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:160-182` |
| 8 | Multiple money-bearing routes have no auth: `/api/sitter-suite/bookings/:id/complete`; `/api/walk-my-pet/walks/:bookingId/confirm`; `/api/walk-my-pet/walks/:bookingId/start`; PetTrek `/provider/start-trip`, `/provider/complete-trip`, `/provider/decline-trip` (no caller-is-driver check) | P0-financial-truth | `server/routes/sitter-suite.ts:1389`; `server/routes/walk-my-pet.ts:1040,1103`; `server/routes/pettrek.ts:490,588,460` |
| 9 | Provider self-exclusion missing: `runProviderSearch(filters, callerUserId)` accepts but never filters out `callerUserId` from results — the CEO-flagged "next door matched me to me" bug | P0-illegal (Part 0.1.2 multi-role) | `server/services/providerSearchService.ts:445-490` |
| 10 | Refunds credit user's wallet, never reverse the original card charge — illegal under חוק הגנת הצרכן and breaks revenue-recognition reversal | P0-illegal | `server/services/BookingPolicyEngine.ts:172-218` |

Estimated effort to spec each (in spec-section terms, NOT engineering hours):

| # | Owning Part | Spec sections required | Dependency-blocked? |
|---|---|---|---|
| 1 | Part 4 (payouts) | 4.1 cadence, 4.2 Masav file format, 4.3 withholding workflow, 4.4 reconciliation | Yes — Part 0.5 Provider Master Agreement clauses 4 + 6 |
| 2 | Part 7 (acquirer integration) | 7.1 Tranzila wire, 7.2 webhook HMAC, 7.3 idempotency, 7.4 reconciliation cron | Yes — Tranzila merchant account live |
| 3 | Part 3 (wallet) + Part 7 | 3.4 top-up source validation, 7.2 server-to-server tx verification | Yes — Tranzila/Nayax server-to-server query API |
| 4 | Part 1 (tax identity) | 1.2 issuer identity, 1.3 SHAAM enrolment | Yes — CPA confirms company tax ID; Part 0.6 |
| 5 | Part 8 (escrow) | 8.1 single escrow store, 8.2 captured/held/released states, 8.3 dispute freeze | Yes — Part 0.4 trust account |
| 6 | Part 8 | 8.1 single escrow store; deprecation plan for Firestore copy | Yes — Part 9 audit chain extension |
| 7 | Part 0.2.4 (already declared) + Part 5 (VAT) | 5.4 promo-funded transaction split, 5.5 VAT base = pre-discount price | Yes — Part 0.5 clause 0.2.4 in Provider Master Agreement |
| 8 | Part 9 (audit) + cross-cutting | RBAC enforcement on every money-effecting route; idempotency keys; required actor_kind/actor_id capture | Partially — code-level; some need product policy |
| 9 | Part 0.1.2 (already declared) | Code-level fix referenced as PR-#2 in Part 0; spec is final | Not blocked, but needs unit tests + audit log of self-match attempts |
| 10 | Part 6 (refunds) | 6.1 method-of-record, 6.2 acquirer round-trip, 6.5 credit-note lineage | Yes — Part 0.3.4 consumer-protection refund window confirmed by counsel |

---

## Methodology

**Files read in full or in load-bearing detail (paths absolute from repo root):**

- Specs: `docs/finance/00-platform-role-model.md`, `docs/finance/02-money-object-model.md`.
- Booking engines: `server/services/booking-facade.ts`, `server/services/booking-service.ts`, `server/services/SitterAdvancedBookingEngine.ts`, `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts`, `server/services/booking-engines/walk/WalkEliteBookingEngine.ts`, `server/services/booking-engines/pettrek/PetTrekChauffeurBookingEngine.ts`, `server/services/booking-engines/k9000/K9000StationBookingEngine.ts`, `server/services/unified-booking/UnifiedBookingEngine.ts` (header).
- Routes: `server/routes/sitter-suite.ts` (booking/respond/complete), `server/routes/walk-my-pet.ts` (book/respond/confirm/start/complete), `server/routes/pettrek.ts` (request/accept/decline/start/complete), `server/routes/k9000.ts` (`wash/start_cycle`, `redeem-wash`), `server/routes/booking-chat.ts` (no-show, dispute), `server/routes/credit-wallet.ts` (topup), `server/routes/nayax-webhooks.ts` (`/nayax/payment` handler).
- Money & tax: `server/services/EscrowService.ts`, `server/services/BookingPolicyEngine.ts`, `server/services/NayaxSitterMarketplaceService.ts`, `server/services/NayaxOnlinePaymentService.ts`, `server/services/TranzilaService.ts`, `server/services/IsraeliDigitalReceiptService.ts`, `server/services/VATCalculatorService.ts`, `server/services/WalletService.ts`, `server/services/SitterGlobalConfig.ts`.
- Search/match: `server/services/providerSearchService.ts`.
- Schema (selective): `shared/schema.ts:8284` (`bookings`), `:8407` (`super_app_payments`), `:8434` (`super_app_payouts`), `:11328` (`escrow_holdings`), `:4307` (`sitter_bookings`), `:4683` (`walk_bookings`), `:5513` (`pettrek_trips`), wallet tables (`walletAccounts`, `creditTransactions`, `redemptionSessions`).

**What this audit did NOT cover, and why:**

- Front-end React clients — out of scope (the spec deliverable is server-side money truth).
- `Octopus Brain` (`octopus_bookings`, `octopus_ledger`) treated as an audit/observability layer; its existence flagged but its internals not deeply traced — it appears to run alongside the primary booking tables, not in place of them. Recommend separate audit of whether it disagrees with the primary table by reconciliation job.
- Mobile-app payment flows under `mobile-app/` — not opened.
- `enterprise-*`, `franchise-*`, `globalForms`, `business-legal-id`, etc. routes — out of scope (CEO mandate is core consumer flow).
- `accounting.ts`, `accounting-export.ts` — read partially; treated as reporting downstream; their correctness depends on upstream ledger correctness which this audit shows is broken.
- `AIPayoutVerificationService` and `ai-payout-verification.ts` — gemini-driven verification cannot substitute for actual payout wiring; not deeply traced.
- The dozens of "enterprise" / "control panel" / "concierge" / "academy" routes — not money paths in the consumer flow.
- `VAT` and `Israeli*` services beyond what's needed to demonstrate the pattern. The audit identifies the pattern (dual-store, hard-coded company ID, missing on-behalf-of issuance); a full per-line tax review is for the CPA after the corrections in Parts 1 / 5 / 6 land.

**Time period:** Static review of the head of `main` at the time of audit. No production logs reviewed (none accessible to the audit). Findings are derived from source. Where source could go either way the entry is flagged `**NEEDS-CEO-REPRO**`.

**Audit lens:** Each money path is read both ends (customer + provider + money + audit). Severity is assigned per the rubric in the mandate.

---

## Per-vertical lifecycle maps

### Sitter Suite (`platformId = sitter_suite`)

#### 1. State diagram

```
          (POST /api/sitter-suite/bookings)
                       │
                       ▼
              ┌────────────────┐
              │ pending_provider│────── (decline)──► declined
              └────────┬───────┘                        │
                       │ (accept)                       │
                       ▼                                │
              [Nayax processBookingPayment]             │
                       │                                │
            payment fail│success                        │
                       ▼                                │
              ┌────────────────┐                        │
              │ payment_failed │                        │
              └────────────────┘                        │
                       │                                │
                       ▼ (success branch)               │
              ┌────────────────┐                        │
              │   confirmed    │                        │
              └────────┬───────┘                        │
                       │ (PATCH /:id/complete)          │
                       │  ── NO AUTH ──                 │
                       ▼                                │
                   completed                            │
                       │                                │
                       └─►(no separate "in_progress"
                          state implemented)            │
```

State transitions live in `sitter_bookings.status` (string column, no enum, no constraint). Allowed values observed in code: `pending_provider`, `confirmed`, `declined`, `payment_failed`, `cancelled`, `disputed`, `no_show`, `completed`. Unlike `bookings` (`server/services/booking-service.ts:705-716`) there is no centralised state-machine validator for the sitter table — every route mutates `sitterBookings.status` directly. (cf. `server/routes/sitter-suite.ts:1051-1060`, `:1158-1167`, `:1448-1457`; `server/routes/booking-chat.ts:975`, `:1030`).

#### 2. Money flow per transition

| Transition | Triggered at | Money effect | Idempotent? | DB transaction? | Audit fired? |
|---|---|---|---|---|---|
| `pending_provider` (create) | `server/routes/sitter-suite.ts:849-874` | None — payment NOT captured at request | n/a | No (multi-statement insert + `octopusLedger` insert outside any tx, lines 882-901) | `octopusLedger` `BOOKING_CREATED` (best-effort) |
| `confirmed` (provider accept) | `server/routes/sitter-suite.ts:1003-1085` | `nayaxSitterMarketplace.processBookingPayment` claims to capture the full booking via Nayax. Calls `confirmBooking` → `EscrowService.createEscrowPayment` (Firestore). | Yes for escrow only, via `makeDeterministicId(bookingId)`. **Not** idempotent for the Nayax charge — see finding F-12. | No DB transaction; the `processBookingPayment`, `confirmBooking`, `db.update(sitterBookings)`, `octopusLedger`, `IsraeliDigitalReceiptService.generateReceipt`, `backupFinancialDocument` are sequential and any failure mid-chain leaves split state. | `octopusLedger` `PAYMENT_CAPTURED`, audit ledger via `EscrowService` |
| `declined` (provider decline) | `server/routes/sitter-suite.ts:1158-1224` | None (because no payment was captured at request — see finding F-2) | No idempotency | No DB tx | `octopusLedger` `CANCELLATION` with `amount: 0` |
| `cancelled` (customer or admin) | NOT WIRED in `sitter-suite.ts`. `BookingService.cancelBooking` (`server/services/booking-service.ts:986`) operates on the unified `bookings` table, NOT `sitter_bookings`. | n/a | n/a | n/a | n/a |
| `disputed` (chat) | `server/routes/booking-chat.ts:992-1044` | None — does NOT call `EscrowService.disputeEscrowPayment`, so the 72h auto-release cron will fire even with a dispute pending. | No idempotency | No DB tx | `logger.info` only — no `audit_events` row, no `escrow_payments.disputed` set |
| `no_show` (chat) | `server/routes/booking-chat.ts:937-986` | None — no pending fee, no penalty escrow draw, no provider-side compensation | No idempotency | No DB tx | `logger.info` only |
| `completed` | `server/routes/sitter-suite.ts:1389-1515` | `recordProviderSettlement` (withholding) + `processSitterPayout` (NOOP — `:163-184` of `NayaxSitterMarketplaceService.ts`) + `VATCalculatorService.recordTransactionFromGross` + booking row UPDATE | NOT idempotent (no key — fire twice and a second payout entry is logged, settlement is duplicated). | No DB transaction across the four writes | Sitter completion writes `digital_receipts` + Firestore `profit_loss_ledger`; no append-only ledger entry of "payout sent" because the payout never sends. |

#### 3. Audit-event fan-out per transition

- Booking create → `octopusLedger.BOOKING_CREATED` only. No `audit_events` row.
- Provider accept → `octopusLedger.PAYMENT_CAPTURED`; `EscrowService` writes `audit_events`-style row via `logAuditEvent`. `digital_receipts` insert (customer_payment).
- Provider decline → `octopusLedger.CANCELLATION` with amount 0; `IsraeliDigitalReceiptService.voidReceipt` for any pre-issued receipts.
- Cancelled → not implemented for `sitter_bookings`.
- Disputed → MISSING. No audit row.
- No-show → MISSING. No audit row.
- Completed → `digital_receipts` (P&L ledger entry, customer-facing); `profit_loss_ledger` (Firestore); no payout-sent audit because payout is a NOOP.

#### 4. Notable findings in this vertical

- F-S1 (P0-financial-truth) — `NayaxSitterMarketplaceService.processBookingPayment` is called WITHOUT `ownerPaymentToken` from `server/routes/sitter-suite.ts:1003-1009`. The service requires it (`Token: params.ownerPaymentToken`, `:98`). In dev mode a fake `SIM_xxxx` is returned and the booking is marked "captured"; in prod Nayax would reject (or accept blank if Nayax server is misconfigured — **NEEDS-CEO-REPRO**).
- F-S2 (P0-illegal) — Sitter `complete` route at `:1389` has **no `requireAuth`**. Anyone with the bookingId can trigger settlement, withholding tax recording, payout queue write, P&L ledger entry, and digital-receipt issuance.
- F-S3 (P0-illegal) — Sitter `complete` passes `commissionRate: 7.5` (`:1421`) while every other system component uses 15% (`SitterGlobalConfig.ts:27`, `VATCalculatorService.ts:55`, `IsraeliDigitalReceiptService.ts:50`, `NayaxSitterMarketplaceService.ts` 15% in calculator). A receipt issued at 7.5% commission while the ledger and contract are 15% is a tax-misstatement.
- F-S4 (P1) — On `/bookings`, address fields (`addressText`, `addressLat`, `addressLng`) are stored as the booking's service address but the booking-creation flow does not require the customer's billing address; receipts at `:1099-1120` ship `customerEmail: ''` and `customerName: ''`. Receipt is non-deliverable to the customer.
- F-S5 (P0-financial-truth) — Booking creation float math: `Math.round(pricing.subtotal * 100)` (`:859-863`) — banned per Part 2.1.3.

### Walk My Pet (`platformId = walk_my_pet`)

#### 1. State diagram

```
                (POST /api/walk-my-pet/walks/book)  requireAuth ✓
                                │
                                ▼
                      ┌──────────────────┐
                      │ pending_provider │
                      └────────┬─────────┘
                               │ /bookings/:id/provider-respond  (accept|decline)
                               │  requireAuth ✓
                               ▼
                      [Nayax onCharge?] (see finding F-W1)
                               │
                               ▼
                      ┌──────────────────┐
                      │   pending  ←── /walks/:id/confirm  ── NO AUTH ──
                      └────────┬─────────┘
                               │ /walks/:id/start  ── NO AUTH ──
                               ▼
                      ┌──────────────────┐
                      │   in_progress    │
                      └────────┬─────────┘
                               │ /walks/:id/complete  requireAuth ✓ + walkerId check
                               ▼
                      ┌──────────────────┐
                      │   completed      │
                      └──────────────────┘

  Side branches (no centralised guard):
   - /:bookingId/dispute   → status 'disputed' (no escrow freeze)
   - /:bookingId/no-show   → status 'no_show'   (no fee)
```

References:
- Booking create: `server/routes/walk-my-pet.ts:356-615`.
- Provider respond: `:621-849`.
- Confirm: `:1040-1100` — **no auth, no walker-ownership check**, the body's `walkerId` is trusted.
- Start: `:1103-1166` — **no auth**, the only guard is a 6-digit `confirmationCode` from `walk_bookings.confirmation_code` (`:519`), `randomInt(100000, 1000000)` — six digits, brute-forceable in seconds without rate limit.
- Complete: `:1277-1466` — has auth and verifies caller is `walkerId`.

#### 2. Money flow per transition

| Transition | Money effect | Idempotent? | DB transaction? | Audit fired? |
|---|---|---|---|---|
| Create | None | n/a | No tx | `octopusLedger` `BOOKING_CREATED` |
| Provider accept | **NEEDS-CEO-REPRO**: code path imports `nayaxSitterMarketplace` for sitter; the walk-my-pet provider-respond at `:621` uses different logic — would need full read of lines 700-849. From the `book` route, the booking holds `walkerPayout` in `decimal(12,2)` (Part 2.1.3 banned). | n/a | No tx | n/a |
| Confirm (`/walks/:id/confirm`) | None | No | No tx | `walk_alerts` |
| Start (`/walks/:id/start`) | None — but `is_live_tracking_active = true` | No | No tx | First GPS point insert |
| GPS update | None | n/a | No tx | GPS row + geofence violation alert |
| Complete | `recordProviderSettlement` (withholding) + `VATCalculatorService.recordTransactionFromGross` + blockchain audit row + walker stats update. **No payout actually sent** (no Nayax/Masav transfer call anywhere for walks). | NOT idempotent — no key. A second call on `:1277` after status changed will fail at `:1289` (`status !== 'in_progress'`), but the first call has no idempotency key on the settlement / VAT writes. | No DB tx wrapping the four writes | Blockchain audit row (`walk_blockchain_audit`); no `audit_events` row |
| Dispute (chat) | None — no escrow freeze (see F-W2) | No | No tx | None |
| No-show (chat) | None | No | No tx | None |

#### 3. Notable findings

- F-W1 (P0-financial-truth) — On walker accept the booking transitions to `pending` status (`:1063-1068`), not `confirmed`. There is then a separate `/walks/:id/confirm` route at `:1040` with **no auth at all** that flips the row to `confirmed`. Anyone — including the customer or an attacker — can confirm a walk that the walker has not actually accepted. Lines 1055-1057 do check `booking.walkerId !== walkerId` from the body, but `walkerId` comes from `req.body.walkerId` — the caller picks who they claim to be. Anyone can supply the booking's actual `walkerId` (returned by `GET /walks/:bookingId`, no auth) and confirm it.
- F-W2 (P0-financial-truth) — `/walks/:bookingId/start` (`:1103-1166`) checks only the body's `confirmationCode` against the 6-digit value in the booking row. No rate limit on this endpoint. Brute force is feasible (10^6 attempts at HTTP speed, no lockout). Once started, the walk is `in_progress` and triggers GPS billing and downstream completion.
- F-W3 (P0-financial-truth) — Walk completion fires `recordProviderSettlement` and `recordTransactionFromGross` but never actually transfers funds. There is no Masav file generation, no Nayax payout call, no bank transfer reference recorded. `super_app_payouts` is not written for walk-my-pet (the route doesn't insert into it). The walker is told "Walk Completed!" but money sits in the platform indefinitely.
- F-W4 (P0-financial-truth) — Float math on booking row totals: `pricing.totalPrice.toFixed(2)`, `pricing.platformFee * 0.25`, `:0.75` (`:513-516`) — silent truncation/rounding errors compound across thousands of bookings.
- F-W5 (P1) — Platform fee split between "owner" and "sitter" sides (`platformFeeOwner`, `platformFeeSitter`, `:513-514`, 25/75) is undocumented in any spec and is not consistent with `VATCalculatorService.calculateMarketplaceVAT` (single `platformFeeGross`). What does this split represent? **NEEDS-CEO-REPRO**.

### Groomers

The marketplace `bookings` table supports `platformId = 'groomers'` (`server/services/booking-service.ts:90` lists it in `maxDurations`). However, no dedicated route file `server/routes/groomers.ts` exists in the route inventory. The `unifiedBookingFacade.hasEngine('groomers')` returns `false` (`server/services/booking-facade.ts:31-55` registers only `walk_my_pet`, `pettrek`, `k9000`).

Result: groomers fall to the legacy path in `BookingService.createBooking` at `:496-518`, which:
- Skips the loyalty discount (`loyaltyDiscount: 0`).
- Skips the facade availability check.
- Skips the escrow confirmation (`if (useFacade)` gate at `:598`).

Groomer bookings can be created and reach `draft` status but are never confirmed by the system, never escrowed, never paid out. `provider_search_service` returns groomers from `providers` (platformId='groomers'); the user can book one and the booking row exists with `paymentStatus='pending'` forever. F-G1 (P0-financial-truth).

#### Groomers — money flow per transition

All transitions identical to the legacy "no-engine" branch in `BookingService`:
- create → `draft` (no money).
- updateBookingStatus to `confirmed` requires `paymentStatus === 'succeeded'`. Nothing in the codebase ever flips groomer payments to `succeeded`. Therefore groomer bookings are **stuck**.

### PetTrek (`platformId = pettrek`)

#### 1. State diagram

```
        POST /api/pettrek/request-trip   requireAuth + requireLoyaltyMember
                          │
                          ▼ confirmBooking → escrow.createEscrowPayment(providerId='pending')
                  ┌──────────────────┐
                  │  confirmed       │ (status set in DB unconditionally — see F-PT1)
                  └────────┬─────────┘
                           │ dispatchService.dispatchTrip → drivers
                           ▼
       /provider/accept-trip ─── auth, but NO assignment guard ───
                           │
                           ▼
                  ┌──────────────────┐
                  │  accepted (?)    │  (state set in dispatchService — not seen in code path)
                  └────────┬─────────┘
                           │ /provider/start-trip ── NO assignment check ──
                           ▼
                  ┌──────────────────┐
                  │   in_progress    │
                  └────────┬─────────┘
                           │ /provider/complete-trip ── NO assignment check ──
                           ▼
                  ┌──────────────────┐
                  │   completed      │ paymentStatus='pending' — no payout wired
                  └──────────────────┘
```

References:
- Request: `server/routes/pettrek.ts:79-251`.
- Accept (dispatch record): `:421-457`.
- Decline: `:460-487` — accepts `dispatchRecordId` only, does NOT verify caller is the driver attached to that dispatch record.
- Start: `:490-535` — no provider-ownership check on `tripId`.
- Complete: `:588-656` — no provider-ownership check; sets `paymentStatus: 'pending'` with comment "Will be processed by payment service" (no service exists).

#### 2. Money flow per transition

| Transition | Money | Idempotent? | DB tx | Audit |
|---|---|---|---|---|
| Request (`/request-trip`) | `confirmBooking` → escrow.createEscrowPayment with `providerId='pending'` (`server/services/booking-engines/pettrek/PetTrekChauffeurBookingEngine.ts:`base) — the customer is charged via escrow before any driver has accepted. Per Part 0.1, the legal seller is the provider; charging before assignment means the platform holds funds but cannot identify the future seller for VAT purposes. | Yes for escrow (idempotency on `bookingId`). Charge itself depends on TranzilaService which is stubbed (F-T1). | No DB tx | escrow_payments + audit_events via EscrowService |
| Accept | dispatchService updates dispatch record. No money change. | n/a | n/a | n/a |
| Decline | dispatchService updates dispatch record. **Customer is NOT auto-refunded** because escrow is held for the trip, not the dispatch. | n/a | n/a | n/a |
| Start | None | No | No tx | None |
| Complete | Sets `paymentStatus: 'pending'` and updates `finalFare`/`platformCommission`/`driverPayout` columns. No escrow release, no payout. | No idempotency | No DB tx | None |
| Customer cancels mid-trip | Not implemented anywhere in the route file. There is no `/customer/cancel-trip` endpoint at all. |

#### 3. Notable findings

- F-PT1 (P0-financial-truth) — Trip status is hard-coded to `'confirmed'` at `:184` regardless of whether the escrow was actually held. `confirmBooking` is called at `:157-161` and a returned `'failed'` blocks the route (`:163-165`), but the underlying `EscrowService.createEscrowPayment` returns success on Tranzila/Nayax failure (`server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:478-481` — falls back to a fabricated escrow id when the real call fails).
- F-PT2 (P0-illegal) — `confirmBooking` for PetTrek calls `EscrowService.createEscrowPayment(bookingId, customerId, 'pending', amount, ...)`. The Firestore document is created with `providerId: 'pending'`. The release flow (`releaseEscrowPayment`) sends `userId: escrow.providerId` to `NotificationService.sendNotification`. If this releases before assignment (or the auto-release cron fires for an unassigned trip), the platform notifies a user with the literal id `'pending'`. **NEEDS-CEO-REPRO**: confirm the cron does not run on `providerId='pending'` rows; the code does not appear to filter them out.
- F-PT3 (P0-financial-truth) — There is no customer-side cancellation endpoint for PetTrek. A customer who books a trip and decides not to take it cannot self-cancel and get a refund without admin intervention.
- F-PT4 (P0-financial-truth) — `provider/start-trip` (`:490`), `provider/complete-trip` (`:588`), `provider/decline-trip` (`:460`) take a `tripId`/`dispatchRecordId` from the body and have NO check that the caller is the assigned provider. Any logged-in user can complete any trip and trigger the (currently NOOP) payout flow.
- F-PT5 (P0-illegal) — At trip start the customer pays *before* the provider is identified. Per Part 0.6.2, the invoice issuer is the provider (or Pet Wash on the provider's behalf). Without a provider, no legal seller is named and no compliant invoice can be issued at the moment of charge. The compliant move is: pre-authorise (hold), capture only after assignment + service start. The current code captures at request.

### Daycare

`platformId = 'daycare'` is mentioned in `BookingService.maxDurations` only via inheriting from `'sitter_suite'` (sitter handles boarding + daycare). `provider_search_service.ts:401-410` fetches sitters with `serviceTypes ∋ 'daycare'`. Booking creation goes through the sitter routes; the same findings F-S1..F-S5 apply. Daycare adds one wrinkle: multi-day spans across the Asia/Jerusalem DST transition (March / October) — see edge case (v) below.

### K9000 wash

#### 1. Two flows, both single-state

K9000 deliberately bypasses the marketplace booking system (architectural fence in `server/services/booking-engines/k9000/K9000StationBookingEngine.ts:7-31`). Two flows:

- Flow A — Direct terminal sale: `POST /api/k9000/wash/start_cycle` (`server/routes/k9000.ts:100`).
- Flow B — Wallet redemption: `POST /api/k9000/redeem-wash` (`:810`).

State machine for both flows is single-shot: `request → wash started`. There is no `in_progress`, `completed`, `aborted`, `mid-cycle-fail` state at the booking level. Bay-level state lives in `station_bays` (`ready`, `busy`, `cleanup`, `fault`, `maintenance`).

#### 2. Money flow

| Flow | At request | Mid-cycle | Cycle abort | Cycle fault |
|---|---|---|---|---|
| A: terminal | Nayax has already authorised the card before the controller calls `/wash/start_cycle`. The route verifies the Nayax row exists (`:188-216`) and inserts `k9000_wash_events` with `transactionSource='nayax'`. | No mid-cycle event endpoint. | None — no path to refund the card if the customer hits emergency stop. | `compensation_required` bay event written by `MachineCommandService.timeoutScanner` (`server/services/MachineCommandService.ts:471-540`), but compensation logic only runs for **wallet-funded** sessions (`K9000RedemptionService:992-1056`); for Nayax direct sale there is no auto-refund. F-K1. |
| B: wallet | `K9000RedemptionService.authorizeRedemption` debits the wallet inside a Postgres tx (atomic). | None. | F-K2: customer has no abort path; if the bay session ends early, only the bay session log notes it. | Auto-compensation runs (`autoCompensate` at `K9000RedemptionService.ts:1056-1159`) — restores credit + writes `k9000_auto_compensation` audit row. **Only works** if `MACHINE_ACTIVATION_URL` env var is unset → demo mode in non-prod silently debits without refunding. F-K3. |

#### 3. Notable findings (K9000)

- F-K1 (P0-financial-truth) — Direct-card customers have no automated refund path on machine fault. Comment at `MachineCommandService.ts:540`: "auto-compensation threw, customer is charged, no automatic refund. Persist a 'critical' alert ..." — i.e. it's by-design a manual ops task.
- F-K2 (P0-financial-truth) — Customer cannot abort mid-cycle. `K9000RedemptionService.endSession` accepts `outcome ∈ {completed, timed_out, aborted, fault}` (`:307`) but there is no customer-facing endpoint to set `aborted`. Only the IoT controller can.
- F-K3 (P0-financial-truth) — In dev/staging (NODE_ENV !== 'production'), `MACHINE_ACTIVATION_URL` may be unset and the machine is NOT commanded. `routes/k9000.ts:862-877` does block this in prod for redeem-wash, but `wash/start_cycle` (Nayax direct) only blocks when the URL is unset AND prod (`:277-286`). Otherwise it silently warns "DEMO MODE" while still inserting `k9000_wash_events` with `status: 'completed'` — the customer's card is charged via Nayax with no machine actually running. This is not theoretical: any non-prod environment that connects to live Nayax would charge the customer.
- F-K4 (P0-illegal) — `recordK9000Transaction` in `VATCalculatorService.ts:419` writes the P&L ledger under company tax id `516788400` (`:369, :392`). Per Part 0, company № is `517145033`. The hard-coded value is the company's *tax authority* registration, not the corporate registration. **NEEDS-CEO-REPRO**: confirm with CPA that 516788400 is the active עוסק מורשה ID; if not, every K9000 receipt is non-compliant.
- F-K5 (P1) — `recordK9000Transaction` calls `db.raw('total_washes + 1')` (`server/routes/k9000.ts:481`) which does not exist on Drizzle's `db` object — likely a runtime error. **NEEDS-CEO-REPRO**: confirm in production logs whether station stats are actually updated.

### Wallet

#### 1. State machine

- Per-credit-type balance fields on `wallet_accounts`: `cashWalletBalanceCents`, `egiftBalanceCents`, `washPackageCredits`, `loyaltyPointsBalance`, `promoBalanceCents`, `referralBalanceCents`. Per Part 2.3.4 these should be derived from a ledger; here they are the source of truth and `credit_transactions` is a side log.
- A `redemption_sessions` table holds short-lived QR sessions (10-minute TTL).

#### 2. Money flow per operation

| Operation | Source | Effect | Idempotent? | DB tx? | Audit |
|---|---|---|---|---|---|
| Top-up via `/api/credit-wallet/topup` | Caller-supplied `nayaxTxId` (any string), `amountCents` | `walletService.addCredits('egift', amountCents, …)` | Yes — `walletIdempotencyKeys` table. **BUT** the dedup key is just `nayaxTxId` — the caller can pick a never-before-used string and credit themselves. F-WT1. | No tx (single addCredits write is atomic on the row) | `creditTransactions` row |
| Preview credits | None | None | n/a | n/a | n/a |
| Create redemption session | None | Inserts `redemption_sessions` row, status `code_generated` | New session each call (no idempotency key) | No tx | None |
| Confirm redemption | `redemption_sessions.cashDueCents` | Decrements all applicable balances atomically with `FOR UPDATE` row locks | Yes — status check at `:278-281` | YES — `FOR UPDATE NOWAIT` lock on session row, `FOR UPDATE` on wallet row | `creditTransactions` rows for each credit type |
| Refund redemption | session.* | Increments balances back atomically using SQL `+=` | Yes — status gate at `:481-483` | No explicit `db.transaction` wrapper; relies on Postgres atomic UPDATEs (acceptable for single-row balance restore) | `creditTransactions` rows |
| Cancel session | None | Status flip | Yes | No | None |
| addCredits (admin / system) | None | Atomic SQL `+=` per credit type | F-WT2: rate-limited per-route but not per-credit-source — a compromised internal caller can credit unlimited | No tx | `creditTransactions` row |

#### 3. Notable findings (Wallet)

- F-WT1 (P0-financial-truth) — `/api/credit-wallet/topup` (`server/routes/credit-wallet.ts:72-216`) trusts the caller's `nayaxTxId` and `amountCents`. Lines 92-94 require `nayaxTxId` for non-admin callers but never query Nayax to verify the transaction is real, settled, and matches the claimed amount. Anyone authenticated can top up to ₪1000 per call (max in schema, `:67`), 5 per hour, without ever paying.
- F-WT2 (P0-illegal) — Top-up credits the `'egift'` credit type (`:170`), not `'cash_wallet'`. There is no separate "cash" top-up path. The user's "wallet balance" (real money pre-paid) is conflated with "e-gift balance" (gift card credit). Tax treatment differs (gift cards are deferred revenue vs. wallet is trust funds). Mixing them violates Part 0.4 separation and Part 5 VAT timing.
- F-WT3 (P0-financial-truth) — Loyalty points cap at 20% of transaction (`:158`) is in the preview but never re-checked at confirm. A second concurrent session could redeem >20% by issuing two sessions for the same booking before either is confirmed. Mitigation: each session is locked at confirm via `FOR UPDATE NOWAIT`, but the cap is a per-session check, not a per-booking-cumulative check.
- F-WT4 (P0-illegal) — Wallet expiry, breakage policy, and the "deferred liability" treatment of Part 0.2.3 are nowhere in code. There is no `wallet.expires_at`, no breakage cron, no Israeli consumer-protection minimum-validity enforcement.
- F-WT5 (P1) — Wallet refunds restore credits to the same wallet, never refund to source. If a customer paid by card, there is no path from `refund_redemption` to a Tranzila card refund.

### Loyalty / e-gifts / promo credits

- The codebase has `loyalty_credits.ts`, `gift-cards.ts`, `birthday-promo.ts`, `egiftFinancialService.ts`, `EgiftFinancialService.ts`, `giftOrchestrationService.ts`, `LoyaltyActivityMonitor.ts`, `loyalty.ts`. Not exhaustively traced; the pattern is the same as wallet credit types — atomic SQL increment, no central ledger, per-bucket balance fields.
- Per Part 0.2.4, promotional credits are a *marketing expense funded by Pet Wash* — provider receives full price net of fee regardless. Current code violates this in `BaseLuxuryBookingEngine.quotePrice` at `:160-182`: when loyalty discount is applied, **provider payout is reduced pro rata** (line 165: `adjustedProviderPayout = discountedSubtotal * providerPayoutRatio`). The provider is paid less for the same work; Pet Wash absorbs nothing. F-L1 (P0-illegal).
- VAT base under Part 0.7 should be the *pre-discount price* for promo redemptions, but `VATCalculatorService.recordTransactionFromGross` is called with `grossCollectedILS` set to the post-discount total at completion (`server/routes/sitter-suite.ts:1471`, `walk-my-pet.ts:1374`). VAT under-collection. F-L2 (P0-illegal).
- E-gift purchases via Tranzila are gated by `TRANZILA_EGIFT_ENABLED` flag — but the underlying `_charge` is a stub (F-T1). E-gift purchases can never complete via the legal path.

---

## Edge case behaviour matrix

Rows = edge cases (a..w from mandate). Columns = verticals (Sitter, Walk, Groomers, PetTrek, Daycare, K9000, Wallet, Loyalty).

Cell content: `current behaviour [file:line]` ‖ `should-be per spec`. P-tag in brackets. "—" = not applicable.

| Case | Sitter | Walk | Groomers | PetTrek | Daycare | K9000 |
|---|---|---|---|---|---|---|
| (a) Customer cancels BEFORE provider accepts | NOT WIRED — customer has no cancel route on `sitter_bookings`; only admin can update status. [P0-marketplace-trust] ‖ Free cancel, write `octopusLedger CANCELLATION` (already partially shaped at `:1183-1194`), no charge captured (consistent with no-payment-at-request). | NOT WIRED for the customer side either. [P0] ‖ Same as sitter. | NOT WIRED. | Customer has NO cancel endpoint at all. Charge ALREADY captured at request (F-PT1). [P0-financial-truth] ‖ Auto-refund full amount via Tranzila, write credit-note. | Same as sitter. | n/a — no booking. |
| (b) Customer cancels AFTER accept, BEFORE service, within free-cancel window | NOT WIRED. [P0] ‖ `BookingPolicyEngine.calculateCancellation` returns 100% if hours >= 24; that calculation is fine but `processAutoRefund` credits wallet not card (F-BP1). Should refund to original card. | NOT WIRED for customer. [P0] | NOT WIRED. | NOT WIRED. | Same as sitter. | n/a |
| (c) Customer cancels AFTER accept, OUTSIDE free-cancel window | NOT WIRED. ‖ Tiered refund per `BookingPolicyEngine` (24h=100%, 12h=50%, <12h=0% +20 fee), refund delta to card, retain penalty to operating account, issue credit note. | NOT WIRED. | NOT WIRED. | NOT WIRED. | Same as sitter. | n/a |
| (d) Customer cancels mid-service | NOT WIRED. ‖ Provider keeps the work-done portion (pro rata), customer refunded the unperformed portion. | Walker side has no mid-walk customer-cancel. Customer cannot stop a walk. | n/a | NOT WIRED. | NOT WIRED. | n/a |
| (e) Provider declines | sitter-suite.ts:1158-1224 — status `declined`, voids any pre-issued receipts, writes `octopusLedger CANCELLATION amount=0`. Because payment is not captured at request, there is genuinely nothing to refund. **BUT** if any receipt was issued by mistake, void path works. | walk-my-pet.ts provider-respond decline path **NEEDS-CEO-REPRO** (lines 700+ not read in full). | NOT WIRED. | `dispatchService.declineTrip` updates dispatch record. Customer's escrow is NOT released (F-PT3). [P0] | Same as sitter. | n/a |
| (f) Provider accepts then cancels BEFORE service | sitter has no provider-cancel-after-accept endpoint that is auth-protected. Setting status='cancelled' via raw DB or admin route is the only path. ‖ Penalty against provider (per provider agreement), full refund to customer to original card, audit row, escrow refund. | Same as sitter. | n/a | Same as sitter, plus escrow already held. | Same as sitter. | n/a |
| (g) Provider cancels mid-service | NOT WIRED. ‖ Pro-rata refund to customer for unperformed portion + provider penalty. Apply Part 6 credit-note for the refund portion. | NOT WIRED. | n/a | NOT WIRED. | NOT WIRED. | n/a |
| (h) Customer no-show | `booking-chat.ts:937-986` — flag status `no_show`, no fee, no provider compensation. [P0-marketplace-trust] ‖ Per Gett: charge a pending fee from the customer's auth, pay the provider time-out compensation, issue receipt. | Same as sitter. | n/a | NOT WIRED — no PetTrek-specific no-show logic. Driver is exposed (drove to pickup, no fee). | Same as sitter. | n/a |
| (i) Provider no-show | NOT WIRED. ‖ Auto-refund full to customer; flag provider; surface re-match flow. | NOT WIRED. | n/a | dispatch-side: dispatch record times out at 30s (`PetTrekChauffeurBookingEngine` engine, comment `:11`) and re-dispatches; but the *trip* status doesn't reflect a no-show, and the customer's escrow stays held. [P0] | NOT WIRED. | n/a |
| (j) Can't-find-each-other (PetTrek driver can't find customer; phone died) | n/a | n/a | n/a | NOT WIRED. ‖ Cool-down + ops mediation, refund or partial fee, audit row. | n/a | n/a |
| (k) Service partially completed | sitter has no partial-completion path. ‖ Pro-rata fee + receipt. | walk-my-pet checks GPS distance and duration at `:1297-1339` but always treats the row as "completed successfully" if status was `in_progress`. There is no "partially completed / weather cut short" state. [P1] | n/a | NOT WIRED. | n/a | F-K2 — no abort path. |
| (l) Dispute opened in chat | `booking-chat.ts:992-1044` — status `disputed`, **no escrow freeze** (F-W2). Auto-release cron will fire. [P0-financial-truth] ‖ Set escrow `disputed`, freeze auto-release, notify ops, audit row. The proper API exists in `EscrowService.disputeEscrowPayment` but is not wired from the chat dispute route. | Same. | n/a | Same. | Same. | n/a |
| (m) Chargeback after completion / payout | NOT WIRED — `TranzilaChargebackService.ts` and `TranzilaChargebackMapper.ts` exist but no chargeback webhook is wired in `nayax-webhooks.ts` or `tranzila-webhooks.ts` for the marketplace flow that links the chargeback back to the provider's payout for clawback. ‖ Chargeback webhook → freeze provider's pending payouts → clawback from past payouts → reverse the original receipt with a credit note → operating-loss recognition per Part 0.2.5. [P0-financial-truth] | Same. | n/a | Same. | Same. | F-K1 — direct-sale chargeback also unwired for clawback. |
| (n) Double-booking attempt | sitter — `checkAvailability` at `SitterAdvancedBookingEngine.ts:41-118` queries overlapping confirmed bookings. **Does not lock**; race window between query and INSERT is open. [P0-financial-truth] | walk-my-pet uses `walk_slot_holds` (`:441-464`) for a 5-min hold but the hold-uniqueness query is not a unique constraint — race possible. | n/a | n/a | sitter — same as sitter. | n/a (bay status check) |
| (o) K9000 mid-cycle failure | n/a | n/a | n/a | n/a | n/a | F-K1, F-K3. |
| (p) K9000 customer aborts mid-cycle | n/a | n/a | n/a | n/a | n/a | F-K2. |
| (q) Wallet top-up succeeds at acquirer but fails to credit wallet | F-WT1 — there is NO acquirer→server reconciliation. Top-up is initiated by *the client* (caller-supplied nayaxTxId). The server never queries Nayax. So this case is undetectable today. ‖ Server-to-server: Nayax payment.success webhook → addCredits via idempotency key derived from acquirer's tx id. |
| (r) Wallet redemption + card combo on same booking, card fails after wallet debited | `WalletService.confirmRedemption:296-298` checks `cash_due_cents > 0 && !paymentConfirmed` and rejects. But the wallet-debit happens *after* this check at `:425-451`. If the calling route already charged the card and then calls confirmRedemption with `paymentConfirmed=true`, and the wallet debit then fails for any reason, there is no rollback of the card charge. F-WT5 [P0-financial-truth]. ‖ Two-phase: lock card auth → wallet debit (in DB tx) → capture card → release lock. On any step failure, void the card auth and restore wallet via session refund. |
| (s) Loyalty-credit booking | F-L1, F-L2 above. The provider is paid less and VAT base is wrong. Both illegal. | Same — `BaseLuxuryBookingEngine.quotePrice:160-182` is shared. | Same (legacy path, but loyalty discount is 0 — so provider is fine, but customer never gets the discount) — F-G1 also applies. | Same. | Same as sitter. | n/a |
| (t) Refund partial vs full lineage | `BookingPolicyEngine.processAutoRefund` writes wallet credit only — there is no credit-note generated, no FK to original invoice (F-BP1). The original receipt remains marked as paid. [P0-illegal] ‖ Issue `credit_note` per Part 6.5, with `parent_txn_id = original receipt`, original stays. |
| (u) Booking startTime in the past | `BookingService.validateBookingTimes:80-83` rejects past start. sitter-suite at `:783-786` uses 5-minute grace. walk-my-pet at `:395-398` same. PetTrek validates date but allows now (`:120`). For dispatch flow, this is acceptable. [P3] |
| (v) Multi-day spanning Asia/Jerusalem DST | sitter `calculateDuration` uses `(endDate - startDate) / (1000*60*60*24)` (`SitterAdvancedBookingEngine.ts:282-292`). On the DST transition night this is 23 or 25 hours — `Math.ceil` rounds up so the customer is billed for a *minimum* of an extra day on the spring-back side. Provider correspondingly under-billed on the fall-back side. [P0-financial-truth — CEO flagged "Tel Aviv multi-day bug"] ‖ Use a calendar-day count via `date-fns-tz` zoned operations. The `bookings` schema has `timezone` column at `:8296` defaulting to `Asia/Jerusalem`; not used in any duration math. |
| (w) Provider self-matched to themselves | `runProviderSearch` at `:445-490`. `callerUserId` is parameter but never filtered against `providerList`. Confirmed: the CEO-flagged self-match exists. [P0-illegal — Part 0.1.2] ‖ Filter `providerList.filter(p => p.userId !== callerUserId)` before scoring. Spec is final in Part 0.1.2; this is an immediate code change with audit log. |

Note for the wallet/loyalty rows: these verticals don't have rows for (a-p) because they are payment instruments, not service flows — the service-vertical row covers the case.

---

## Israeli regulatory delta

Findings tied to Israeli rules. Each lists the rule and the owning Financial Core Part.

| # | Rule | Rule reference | What's wrong today | Owning Part |
|---|---|---|---|---|
| R-1 | חוק העוסקים — invoice issuer must be the legal seller | חוק מע"מ §47 | `IsraeliDigitalReceiptService.generateReceipt` (line 287+) issues receipts as Pet Wash for marketplace bookings where the legal seller is the provider. The `digital_receipts` row puts `companyTaxId = COMPANY_TAX_ID` on every receipt regardless of channel. K9000 vs marketplace must use distinct issuance flows per Part 0.6.1 / 0.6.2. | Part 1 + Part 0.6 |
| R-2 | חוק מע"מ — taxable supply when service delivered (מועד החיוב) | חוק מע"מ §22-24 | At least the marketplace side correctly records VAT at completion (`VATCalculatorService.recordTransactionFromGross` is called from the `complete` route). However K9000 records VAT at *activation* (`recordK9000Transaction` is called inside the `wash/start_cycle` route at `routes/k9000.ts:567-577`), not at session completion. If the wash never starts (machine fault) the VAT entry is already written — it must be reversed by credit note. Today there is no path to reverse. | Part 5 |
| R-3 | ניהול ספרים — sequential gap-free numbering | תקנות מס הכנסה (ניהול פנקסי חשבונות) | `IsraeliDigitalReceiptService.generateReceiptNumber` uses `TaxSequenceService` advisory locks (`server/services/IsraeliDigitalReceiptService.ts:150-153`). Looks correct on the receipt domain. **But**: the sequence is shared across channels (Pet Wash + on-behalf-of provider + K9000) — Part 2.4.1 requires *separate sequences per domain*. A single shared sequence across channels makes it impossible to satisfy Part 0.6.2.a per-provider self-billing series. | Part 2.4 |
| R-4 | חוק הגנת הצרכן — refund window for distance contracts | חוק הגנת הצרכן §14ג | `BookingPolicyEngine.calculateCancellation` enforces a tiered refund (24h=100%) but: (a) refund is to wallet not source; (b) the consumer-protection statutory window is a separate, non-waivable window that the engine does not honour distinctly from the contractual window; (c) the engine does not look up the customer's payment method to choose refund channel. | Part 6 |
| R-5 | ניכוי מס במקור — withholding on independent contractor payments | פקודת מס הכנסה §164 + תקנות הניכוי | `IsraeliDigitalReceiptService.recordProviderSettlement` *calculates* withholding correctly with cert/expiry handling. **But**: the actual payout (`processSitterPayout`) is a NOOP. The withholding row is recorded; the gross is never paid; the net to provider is therefore reported but never delivered. Filing a withholding return for a payout that didn't happen is reportable. | Part 4 |
| R-6 | טופס 856 / 6111 — annual contractor reporting | פקודת מס הכנסה | The withholding rows in `provider_commissions` are accumulated per provider but there is no Form 856 generator wired anywhere. **NEEDS-CEO-REPRO**. | Part 4 + Part 5 |
| R-7 | חוק שירותי תשלום (תקנות חברות תשלומים) — payment-service licensing | חוק שירותי תשלום | Wallet treated as deferred liability per Part 0.4.3 — that's the correct stance. But trust-fund segregation is NOT implemented: there is no separate Pet Wash bank account flag, no balance-vs-bank reconciliation cron, and platform-fee revenue / promo-funded discounts are commingled with wallet balances on the same ledger column ("egift" mixes both). | Part 0.4 + Part 3 |
| R-8 | מע"מ — exempt vs authorized dealer (עוסק פטור / עוסק מורשה) | תקנות מע"מ | `IsraeliDigitalReceiptService.calculateProviderSettlement` handles both `osek_patur` and `osek_murshe` via the `osekType` parameter (`:218-249`). **But**: nowhere in the create-booking / accept-booking flow is the provider's `osekType` looked up and passed to the receipt issuer. So the receipt is issued without dealer-status disambiguation, and `vatOnCommission` defaults to `0` for the legacy path. | Part 1 + Part 5 |
| R-9 | SHAAM digital invoice law (allocation number ≥ ₪10,000 in 2026; ≥ ₪5,000 from June 2026) | תקנות מס הכנסה (חשבונית דיגיטלית) | `IsraeliDigitalReceiptService.isShaamRequired` checks the threshold and stores `shaamRequired: true` but the `shaamAllocationNumber` is never fetched (`:316`). For any marketplace booking ≥ ₪10K (multi-week sitting, multi-day daycare), no allocation number is sent. | Part 1.3 |
| R-10 | חוק הגנת הצרכן — agent-vs-principal disclosure pre-checkout | חוק הגנת הצרכן §2 | Booking flows do not display "Pet Wash is the platform; the provider is the legal seller" pre-checkout. The `digital_receipts` company-name field reads `Pet Wash Ltd` so customers reasonably believe Pet Wash is the seller — that's the principal-presentation problem flagged in Part 0.1. | Part 0.6 + product copy |
| R-11 | סודיות חולה / privacy - customer billing address | חוק הגנת הפרטיות | Not strictly Israeli-VAT but: Israeli invoices to the customer must include a valid customer name + address. Current sitter receipt at `routes/sitter-suite.ts:1099-1120` passes `customerEmail: ''`, `customerName: ''`. Receipts are non-deliverable. | Part 1 |

---

## Industry benchmark comparison

Reference patterns; the spirit is what counts, not the literal copy.

### Mad Paws (`madpaws.com.au`)

| Pattern | Mad Paws | Pet Wash today |
|---|---|---|
| Cancellation tiers | Sliding hourly tiers (e.g. >7d full / 24-48h half / <24h none), explicit per service | `BookingPolicyEngine` (24h=100%, 12h=50%, <12h=0%) — coarse and only kicks in if customer cancellation is wired (it's not for sitter/walk/groomer/PetTrek/daycare). |
| Sitter-sickness flow ("Re-Book" credit) | Customer auto-issued a Re-Book credit funded by sitter; Mad Paws absorbs short-term, claws back from provider | NOT WIRED. No "re-match" credit. Provider mid-cancel = customer stranded. |
| Dispute mediation | In-app mediator role, message-locked thread, evidence attachment, SLA clock | `BookingPolicyEngine.createDispute` writes `dispute_resolutions` row with 48h SLA target; no in-app mediator role; no chat freeze. Disputes do not freeze escrow (F-W2). |
| Service log + photo proof | Per-stay photos required, GPS pings for walks | walk-my-pet has GPS + blockchain audit. Sitter-suite: photo upload route exists; not enforced as a completion gate. |

### Wolt (Israeli courier subcontractor model)

| Pattern | Wolt | Pet Wash today |
|---|---|---|
| Courier weekly settlement (Masav) | Weekly bulk credit via Masav, with payslip-style report | NOT WIRED. `super_app_payouts` schema (`:8434`) has `bankTransferReference` and `providerBankIban` but no Masav file generator and no payout cron exists. |
| Late-cancel courier penalty | Driver who accepts then cancels late is penalised; record tracked | NOT WIRED. Provider cancellation has no penalty layer. |
| Customer no-show / address-fail | Driver paid time-out fee; customer billed pending fee + photo evidence | NOT WIRED in any vertical. F-W2/F-W3/F-PT4. |
| Payment "in transit" → "settled" | Two-stage with reconciliation | EscrowService has `held` → `released` but it's all internal Firestore; the bank settlement itself isn't tracked. |

### Gett (Israeli taxi pending fee)

| Pattern | Gett | Pet Wash today |
|---|---|---|
| Pending hold pre-trip | Card auth (no capture) on book; capture on completion | PetTrek captures at request (F-PT1), not auth-then-capture. |
| No-show fee | Capped agreed fee (e.g. ₪10), explicit on screen, charged via the auth | NOT WIRED for any vertical. |
| Driver-cancel-after-arrival | If driver arrives + customer not there for X minutes, driver-paid arrival fee | NOT WIRED. |
| ETA penalty | Driver who is X minutes late forfeits a fraction of fare | NOT WIRED. |

---

## Severity-tagged findings list

Numbered F-NN. Each: **severity, title, file:line, current behaviour, should-be per spec, owning Part, dependency**.

### F-01 — P0-financial-truth — Provider payout is a NOOP

- **Where:** `server/services/NayaxSitterMarketplaceService.ts:151-185` (`processSitterPayout`).
- **Current:** Returns `{success: true, payoutReference: 'PAYOUT_…'}` after writing a single `logger.info` line. No bank transfer, no Masav, no ACH. Walk-my-pet has no payout call at all (lines 1349-1387 of `walk-my-pet.ts`).
- **Should-be (Part 4):** Weekly Masav file written from confirmed `super_app_payouts` rows; status flow `pending → in_escrow → released → processing → completed`; per-provider statement issued; withholding-tax remitted separately to the State.
- **Owning Part:** Part 4 (payouts).
- **Dependency:** Part 0.5 Provider Master Agreement clauses 4 + 6 (payout cadence, refund offset).

### F-02 — P0-financial-truth — Tranzila integration is stub-returning

- **Where:** `server/services/TranzilaService.ts:143-169` (`_charge`), `:129-139` (`verifyWebhookSignature`).
- **Current:** `_charge` returns `{success: false, error: 'Tranzila charge not yet implemented'}` and is gated by feature flags (all default off). `verifyWebhookSignature` returns `false` unless `WEBHOOK_SECRET` is set, but is also explicitly TODO and rejects all signed bodies.
- **Should-be (Part 7):** Real Tranzila REST API call (terminal_name + TranzilaPW + sum agorot + token), HMAC-SHA256 webhook verification, fail-closed on missing secret.
- **Owning Part:** Part 7 (acquirer integration).
- **Dependency:** Tranzila merchant credentials live in env; counsel review of merchant agreement.

### F-03 — P0-financial-truth — Wallet top-up trusts caller's nayaxTxId and amountCents

- **Where:** `server/routes/credit-wallet.ts:72-216`.
- **Current:** Authenticated user posts `{amountCents, nayaxTxId}`; server credits the wallet without querying Nayax. Idempotency dedup is per-`nayaxTxId`, not per-acquirer-confirmed-event.
- **Should-be (Part 3 + Part 7):** Top-up is server-driven by acquirer webhook only; idempotency key derived from acquirer's tx id; amount cross-verified server-side; client never tells the server how much to credit.
- **Owning Part:** Part 3 (wallet) + Part 7.
- **Dependency:** Tranzila/Nayax server-to-server tx query API; webhook routing for top-up product type.

### F-04 — P0-illegal — Hard-coded company tax ID does not match registered company № 517145033

- **Where:** `server/services/IsraeliDigitalReceiptService.ts` constant `COMPANY_TAX_ID` (referenced at `:165`); `server/services/VATCalculatorService.ts:369, 392` (`companyTaxId: '516788400'`).
- **Current:** Every digital receipt + P&L ledger entry is stamped `516788400`. Part 0 declares company № 517145033.
- **Should-be (Part 1):** Company tax ID derived from a single config source matching the registered company; per Part 0.6, the issuer identity per channel × per dealer-status is distinct (Pet Wash vs on-behalf-of-provider); each issuer's tax ID is the *correct* one for that issuer.
- **Owning Part:** Part 1 (tax identity).
- **Dependency:** CPA confirms whether 516788400 is the active עוסק מורשה ID and whether it ties back to company № 517145033.

### F-05 — P0-financial-truth — `SitterAdvancedBookingEngine.moveToEscrow` is a NOOP

- **Where:** `server/services/SitterAdvancedBookingEngine.ts:315-318`.
- **Current:** `private async moveToEscrow(bookingId, amount): Promise<void> { logger.info('[Escrow] Funds moved to escrow', { bookingId, amount }); }`
- **Should-be (Part 8):** Insert `escrow_holdings` row + Firestore `escrow_payments` doc (or single source of truth), with status `held`, `holdUntil`, `customerId`, `providerId`, idempotency key.
- **Owning Part:** Part 8 (escrow).
- **Dependency:** Part 0.4 trust-account segregation.

Note: the actual escrow call used in production goes through `BaseLuxuryBookingEngine.moveToEscrow` (`server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:441-482`) for walk/petTrek/k9000. Sitter Suite `confirmBooking` route at `sitter-suite.ts:1036-1049` calls `sitterAdvancedBookingEngine.confirmBooking` which delegates to **the same NOOP** above (it does NOT extend BaseLuxuryBookingEngine — see `booking-facade.ts:28` "TODO: Refactor SitterAdvancedBookingEngine"). **NEEDS-CEO-REPRO**: which engine actually runs in prod for sitter? Code path suggests the legacy advanced engine, which means sitter escrow has been broken since launch.

### F-06 — P0-financial-truth — Two parallel escrow stores

- **Where:** `server/services/EscrowService.ts:46-47` (Firestore collection `escrow_payments`); `shared/schema.ts:11328` (Postgres `escrow_holdings`).
- **Current:** `EscrowService` writes `escrow_payments` in Firestore. `nayax-webhooks.ts:578-585` writes `escrow_holdings` in Postgres. They share no row, no key, no reconciliation. Disputes via chat hit neither (F-W2). Auto-release cron operates on Firestore only (`autoReleaseExpiredHolds:418-448`).
- **Should-be (Part 8):** Single escrow source of truth (Postgres preferred for join with bookings + audit chain). Firestore is a cache, not a write-through store.
- **Owning Part:** Part 8.
- **Dependency:** Part 9 audit-chain extension to ledger.

### F-07 — P0-illegal — Loyalty discount reduces provider payout

- **Where:** `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:160-182`.
- **Current:** `adjustedProviderPayout = discountedSubtotal * providerPayoutRatio`. Provider receives proportionally less when customer has a loyalty discount; Pet Wash absorbs nothing.
- **Should-be (Part 0.2.4):** Provider receives full pre-discount price net of platform fee. Pet Wash funds the discount as marketing expense (`5010.expense.promo_credits_funded`). VAT base is the pre-discount price (Part 0.7).
- **Owning Part:** Part 0.2.4 (already declared) + Part 5 implementation.
- **Dependency:** Provider Master Agreement clause 0.2.4 (Part 0.5).

### F-08 — P0-illegal — Multiple money-bearing routes have no auth or no caller-ownership check

- **Where:**
  - `server/routes/sitter-suite.ts:1389` — `PATCH /bookings/:id/complete` — no `requireAuth`, no caller check. Anyone can trigger settlement + payout queue.
  - `server/routes/walk-my-pet.ts:1015` — `GET /walks/bookings/:bookingId/status` — no auth. Reveals booking status to anyone.
  - `server/routes/walk-my-pet.ts:1040` — `POST /walks/:bookingId/confirm` — no auth; trusts body's `walkerId`.
  - `server/routes/walk-my-pet.ts:1103` — `POST /walks/:bookingId/start` — no auth; only 6-digit code (no rate limit).
  - `server/routes/pettrek.ts:460` `provider/decline-trip` — auth but no driver-assignment check on `dispatchRecordId`.
  - `server/routes/pettrek.ts:490` `provider/start-trip` — auth but no driver-assignment check on `tripId`.
  - `server/routes/pettrek.ts:588` `provider/complete-trip` — same as start-trip.
- **Should-be (Part 9 + RBAC):** Every money-effecting endpoint requires auth + provider-assignment check + idempotency-key.
- **Owning Part:** Part 9 (audit) + cross-cutting RBAC.
- **Dependency:** None — code-level fix.

### F-09 — P0-illegal — Provider self-exclusion missing

- **Where:** `server/services/providerSearchService.ts:445-490`.
- **Current:** `runProviderSearch(filters, callerUserId)` accepts `callerUserId` and includes it in the `matching.started` event but never filters the `providerList`. CEO-flagged.
- **Should-be (Part 0.1.2):** Filter `provider.userId !== callerUserId` before scoring; write `audit_event` `self_match_blocked` with the attempt details.
- **Owning Part:** Part 0.1.2 (already declared) + code-level.
- **Dependency:** None.

### F-10 — P0-illegal — Refunds credit user's wallet, never reverse the original card charge

- **Where:** `server/services/BookingPolicyEngine.ts:172-218` (`processAutoRefund`).
- **Current:** Credits `wallet_accounts.cash_wallet_balance_cents` for the booking owner. No Tranzila refund call, no credit note, no original-payment-method routing.
- **Should-be (Part 6):** Refund channel = original payment method (Part 0.3.4 consumer-protection rule). Credit-note issued with `parent_txn_id = original receipt`. The original receipt stays on file. Wallet refund is allowed only with explicit customer consent, recorded.
- **Owning Part:** Part 6 (refunds).
- **Dependency:** Part 0.3.4 — confirmed refund window from counsel.

### F-11 — P0-financial-truth — `EscrowService.createEscrowPayment` returns success on Tranzila/Nayax failure (BaseLuxuryBookingEngine fallback)

- **Where:** `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:478-481`.
- **Current:** On `escrowService.createEscrowPayment` throwing, the code generates a fabricated `ESCROW-${Date.now()}-${bookingId.slice(0,8)}` id and returns `{success: true, escrowReferenceId: fallbackId}`. The booking confirmation continues on a fake escrow.
- **Should-be (Part 8):** Fail closed. No booking confirmed without a real escrow id and a verifiable acquirer charge.
- **Owning Part:** Part 8.
- **Dependency:** Part 7 acquirer wire (F-02).

### F-12 — P0-financial-truth — Sitter accept-payment idempotency key missing

- **Where:** `server/routes/sitter-suite.ts:1003-1009` (the call), `NayaxSitterMarketplaceService.ts:73-143`.
- **Current:** Two rapid POSTs to `/bookings/:id/provider-respond` with `action='accept'` would both run `processBookingPayment`. Service builds `ExternalTransactionId: SITTER_${bookingId}_${nanoid(10)}` per call (`:99`) — different per call, so Nayax sees two separate authorisations.
- **Should-be (Part 2 + Part 7):** Per-acceptance idempotency key bound to `bookingId` + acceptance attempt; presented to acquirer; collision rejected.
- **Owning Part:** Part 7.
- **Dependency:** F-02 (real Nayax wire).

### F-13 — P0-illegal — Receipt issuer identity is always Pet Wash for marketplace channel

- **Where:** `IsraeliDigitalReceiptService.generateReceipt` (line 287 onwards in `digital_receipts.values`).
- **Current:** All receipts shipped with `companyName: COMPANY_NAME, companyTaxId: COMPANY_TAX_ID` (Pet Wash) regardless of channel. There is no on-behalf-of-provider issuance branch.
- **Should-be (Part 0.6 + Part 1):** Marketplace receipts come from the provider's series (or, with provider authorisation, from a Pet-Wash-on-behalf-of-Provider series); K9000 receipts come from Pet Wash's K9000 series. Each is its own numbering domain (Part 2.4.1).
- **Owning Part:** Part 1 + Part 2.4.
- **Dependency:** Part 0.5 clause 0.6 — provider authorisation language.

### F-14 — P0-financial-truth — VAT recorded at K9000 activation, not session completion

- **Where:** `server/routes/k9000.ts:567-577`.
- **Current:** Inside `wash/start_cycle`, after Nayax verification, `recordK9000Transaction` writes the P&L ledger entry. If the machine never starts (F-K3) the entry is wrong.
- **Should-be (Part 5):** VAT recognised at session-completion event from the K9000 controller (Part 0.2.2). Activation fires only an "auth" record; completion converts it to revenue.
- **Owning Part:** Part 5.
- **Dependency:** K9000 controller emits a `wash_completed` callback (F-K2 path).

### F-15 — P0-financial-truth — Dispute does not freeze escrow

- **Where:** `server/routes/booking-chat.ts:992-1044`.
- **Current:** Sets `walkBookings.status='disputed'` (or `sitterBookings.status='disputed'`). Does NOT call `EscrowService.disputeEscrowPayment`. Auto-release cron at `EscrowService.autoReleaseExpiredHolds` operates on `escrow_payments` Firestore doc — sees `held` status, releases the funds.
- **Should-be (Part 8):** Dispute flips escrow → `disputed` + `autoReleaseBlocked: true` (the API exists at `EscrowService.disputeEscrowPayment:320-389`). Audit row written. Provider notified.
- **Owning Part:** Part 8.
- **Dependency:** F-06 (single escrow store).

### F-16 — P0-financial-truth — No-show is a status flag with no money effect

- **Where:** `server/routes/booking-chat.ts:937-986`.
- **Current:** Updates status to `no_show`. No fee, no provider compensation.
- **Should-be (Part 6 + Part 4):** Customer no-show: charge the no-show fee (within auth window) per Part 0.7 VAT (taxable supply), pay provider time-out compensation. Provider no-show: full refund to customer + provider penalty + re-match flow.
- **Owning Part:** Part 6 + Part 4.
- **Dependency:** Counsel — Israeli consumer-protection guidance on no-show fees.

### F-17 — P0-financial-truth — Nayax webhook signature fail-OPEN when secret unset

- **Where:** `server/services/NayaxOnlinePaymentService.ts:246-250`.
- **Current:** `if (!NAYAX_WEBHOOK_SECRET) return true;` — accepts any unsigned payload as authentic.
- **Should-be (Part 7):** Fail closed; reject all webhooks if secret missing. Production must alert if missing.
- **Owning Part:** Part 7.
- **Dependency:** Set `NAYAX_WEBHOOK_SECRET` in env; deploy guard.

### F-18 — P0-financial-truth — Tranzila webhook handler stubbed (TODO HMAC)

- **Where:** `server/services/TranzilaService.ts:128-139`.
- **Current:** Always returns `false`. Effectively zero Tranzila webhooks flow into the system.
- **Should-be (Part 7):** HMAC-SHA256 over raw body, timing-safe compare, fail-closed.
- **Owning Part:** Part 7.
- **Dependency:** F-02.

### F-19 — P0-financial-truth — DST math breaks multi-day duration

- **Where:** `server/services/SitterAdvancedBookingEngine.ts:282-292` (`calculateDuration`).
- **Current:** `Math.ceil(diffMs / (1000*60*60*24))` — UTC math; on Asia/Jerusalem DST nights this is 23 or 25 hours, ceiling rounds up.
- **Should-be (Part 5 + cross-cutting):** Use timezone-aware day count (`differenceInCalendarDays` with Asia/Jerusalem zoning).
- **Owning Part:** Cross-cutting; Part 2.5 mandates UTC at storage but presentation TZ in computation.
- **Dependency:** None.

### F-20 — P0-financial-truth — Booking double-booking race

- **Where:** `server/services/SitterAdvancedBookingEngine.ts:67-100`; also `server/services/booking-service.ts:237-348`.
- **Current:** Availability is a SELECT; INSERT runs after, no row lock or unique constraint blocking overlap.
- **Should-be (Part 8 + cross-cutting):** Use a unique constraint over `(provider_id, time-range)` via PostgreSQL `EXCLUDE` constraint with `tstzrange &&` operator, or pessimistic lock on a sentinel row, or transactional advisory lock.
- **Owning Part:** Cross-cutting; addressed at Part 8 level for marketplace.
- **Dependency:** None.

### F-21 — P0-financial-truth — Float arithmetic on money everywhere

- **Where (a sample, not exhaustive):**
  - `server/services/booking-service.ts:368-380` — `feePercent / 100`, `subtotal * feePercent`, no Money helper.
  - `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:158-173`.
  - `server/services/BookingPolicyEngine.ts:155-156, 178`.
  - `server/services/EscrowService.ts:87-91` (`Math.round(amount * 100)`).
  - `server/routes/sitter-suite.ts:859-863, 878-880, 1409-1411, 1471`.
  - `server/routes/walk-my-pet.ts:512-516, 1374`.
  - `shared/schema.ts:8303-8307, 8316, 8330, 8366, 8414, 8420, 8445-8447` — every money column is `decimal(12,2)` (banned for new fields per Part 2.1.5; legacy read-only allowed but new code keeps reading and writing them).
- **Current:** Float multiplications, `parseFloat()` round-trips, `.toFixed(2)` cosmetic rounding, `Math.round(x * 100)` to convert ILS→agorot.
- **Should-be (Part 2.1):** Canonical `Money { amount_minor: bigint; currency: 'ILS' }`; helpers for add/subtract/multiplyByRatio (banker's rounding); ESLint rule rejects raw arithmetic.
- **Owning Part:** Part 2.1.
- **Dependency:** None — code-level.

### F-22 — P0-financial-truth — `bookings.platform_data jsonb` accepts financial fields

- **Where:** `shared/schema.ts:8312` (`platformData: jsonb`).
- **Current:** Multiple writes stuff escrow ids, pricing breakdowns, station unlock flags, GPS tracking flags, confirmation errors into `platformData`. Per Part 2.2.2 the `platform_data` jsonb is the only allowed jsonb on `bookings` and is **not** a financial-transaction field.
- **Should-be (Part 2):** Confirm Part 2.2.2 stance: `platformData` is operational; financial fields (escrow id, pricing, refund amount) must be typed columns in dedicated tables (`financial_transactions`, `escrow_holdings`, `pricing_quotes`).
- **Owning Part:** Part 2.
- **Dependency:** None — schema migration.

### F-23 — P0-illegal — Numbering authority shared across channels

- **Where:** `server/services/IsraeliDigitalReceiptService.ts:150-153` calls `allocateTaxSequenceNumber('RECEIPT')` — single domain `RECEIPT`.
- **Current:** Sitter-suite, walk-my-pet, K9000, P&L ledger entries all draw from the same `RECEIPT` sequence. Number `PW-2026-000123` may be a sitter receipt or a K9000 receipt or a P&L entry.
- **Should-be (Part 2.4.1):** Distinct domains per (channel × dealer-status × purpose):
  - `INVOICE.PETWASH.K9000`
  - `INVOICE.PETWASH.PLATFORM_FEE`
  - `INVOICE.PROVIDER.<provider_id>`
  - `RECEIPT.PROVIDER.<provider_id>`
  - `CREDIT_NOTE.PETWASH.K9000`
  - `CREDIT_NOTE.PROVIDER.<provider_id>`
- **Owning Part:** Part 2.4.
- **Dependency:** Part 0.6 channel/dealer-status decision matrix.

### F-24 — P0-financial-truth — `BookingPolicyEngine.processAutoRefund` only knows sitter + walk

- **Where:** `server/services/BookingPolicyEngine.ts:184-190`.
- **Current:** UNION over `sitter_bookings` and `walk_bookings`. PetTrek (`pettrek_trips`), K9000 (no booking row), groomers (no rows), and the unified `bookings` table are missing.
- **Should-be (Part 6):** Refund layer is channel-aware; routes through the correct booking table (or unified booking) and the correct acquirer (Tranzila/Nayax) for the original capture.
- **Owning Part:** Part 6.
- **Dependency:** F-06 single escrow store; Part 0.6 issuer identity.

### F-25 — P0-financial-truth — `superAppPayments` lacks idempotency_key and parent_txn_id

- **Where:** `shared/schema.ts:8407-8431`.
- **Current:** No `idempotency_key`, no `parent_txn_id`, no `seller_party`/`buyer_party`, no `vat_minor`, no `external_ref_invoice`, no `ledger_hash_pointer`. Allows free-form `metadata: jsonb`.
- **Should-be (Part 2.2):** All fields per the canonical `financial_transactions` schema; UNIQUE on `idempotency_key`; append-only trigger.
- **Owning Part:** Part 2.2.
- **Dependency:** Schema migration; deprecation plan for `superAppPayments`.

### F-26 — P0-financial-truth — Provider payout rate inconsistencies across services

- **Where:**
  - `WalkEliteBookingEngine.ts:133` — `subtotal * 0.85` (15% commission).
  - `PetTrekChauffeurBookingEngine.ts:111` — `subtotal * 0.75` (25% commission).
  - `SitterGlobalConfig.ts:27` — `globalCommissionRate = 0.15`.
  - `VATCalculatorService.ts:55-61` — flat 15% across all platforms.
  - `IsraeliDigitalReceiptService.ts:50` — `PLATFORM_COMMISSION_RATE = 0.15`.
  - `routes/sitter-suite.ts:1421` — `commissionRate: 7.5` (passed as integer percent? or float? — see context).
- **Current:** Five different commission-rate sources, three different values (15%, 25%, 7.5%).
- **Should-be (Part 0.5 + Part 4):** Single source: a `provider_commission_terms` table keyed by provider/channel, signed in the Provider Master Agreement.
- **Owning Part:** Part 4.
- **Dependency:** Part 0.5.

### F-27 — P1-marketplace-trust — `digital_receipts.customerEmail` empty for sitter

- **Where:** `server/routes/sitter-suite.ts:1099-1120` (`/provider-respond accept` and `:1099` — `IsraeliDigitalReceiptService.generateReceipt({customerEmail: '', customerName: ''})`).
- **Current:** Receipt has empty buyer info — non-deliverable, may be invalid under חוק ניהול ספרים (must identify the buyer above ₪325).
- **Should-be (Part 1):** Buyer name + email (and tax id if business) populated from the customer's user profile at the moment of issuance.
- **Owning Part:** Part 1.

### F-28 — P0-financial-truth — Wallet "egift" balance conflates pre-paid wallet with gift cards

- **Where:** `server/routes/credit-wallet.ts:170` (top-up writes to `egift`); `shared/schema.ts` `walletAccounts` has both `cashWalletBalanceCents` and `egiftBalanceCents`.
- **Current:** Cash top-ups go into the e-gift bucket. The `cash_wallet_balance_cents` column appears used only by `BookingPolicyEngine.processAutoRefund` (F-10).
- **Should-be (Part 3.2):** Separate buckets per Part 3.2; top-up routes to `cash_wallet_balance_cents`; e-gift purchases route to `egift_balance_cents`. Order-of-redemption rules per Part 3.5.
- **Owning Part:** Part 3.

### F-29 — P0-illegal — No provider-tax-profile snapshot at first payout

- **Where:** Sitter `/complete` at `:1413-1422` calls `recordProviderSettlement` with `hasWithholdingExemption: false` hardcoded — does not look up `provider_tax_profiles`.
- **Current:** Withholding is calculated at the policy default for every provider regardless of cert/exemption status. Form 856 row would be wrong.
- **Should-be (Part 1.5 + Part 4):** Immutable provider tax profile snapshot at first payout; subsequent payouts reference the snapshot id; withholding rate from cert (within validity window) or policy default.
- **Owning Part:** Part 1.5 + Part 4.
- **Dependency:** Part 0.5 clause 1.5.

### F-30 — P0-financial-truth — `unifiedBookingFacade.confirmBooking` for K9000 routed through engine that "must not" run live flows

- **Where:** `server/services/booking-facade.ts:46-51` registers k9000 engine "for findNearestStation only"; comment says POST `/api/platforms/k9000/bookings` is hard-blocked at the route layer. But `BookingService.createBooking` at `:598-679` calls `unifiedBookingFacade.confirmBooking(platformId, ...)` for any `useFacade=true` platform — including k9000. The block is at `super-app-bookings.ts` (per the comment), not at the engine layer.
- **Current:** If a caller hits any other route that delegates to `BookingService.createBooking` with `platformId='k9000'`, the K9000 engine fires `confirmBooking` → `BaseLuxuryBookingEngine.confirmBooking` → `escrowService.createEscrowPayment` for a wash that was never meant to use escrow. The safety fence is documentation, not a code-level block.
- **Should-be (Part 0.1 + Part 8):** K9000 engine's `confirmBooking` and `cancelBooking` throw at the engine entry. The IF in `K9000StationBookingEngine` should only allow `findNearestStation` and the availability check, raising on the others. Spec the cross-channel separation as a hard error at the engine boundary.
- **Owning Part:** Part 0.1 (multi-role) + Part 8.

### F-31 — P0-illegal — Refund route for chargebacks and clawback missing

- **Where:** No file routes Tranzila chargeback webhooks through to `super_app_payouts` clawback. `TranzilaChargebackService.ts` exists; not wired into the marketplace flow per code search.
- **Current:** A successful chargeback after a marketplace booking + payout would leave: customer made whole by acquirer, provider already paid (if F-01 ever gets fixed and payouts run), platform out of pocket. No clawback wiring.
- **Should-be (Part 6.5 + Part 4):** Chargeback webhook → reverse the original receipt with credit-note → freeze provider's pending payout → write `adjustment` debiting provider's earnings vs. operating-loss account per CPA guidance.
- **Owning Part:** Part 6 + Part 4.
- **Dependency:** Part 0.2.5 stance.

### F-32 — P1 — Disputes table is parallel system with no link to escrow

- **Where:** `server/services/BookingPolicyEngine.ts:223-258` (`createDispute`); writes `dispute_resolutions`. EscrowService has `disputed` status; the chat dispute route (booking-chat.ts) writes `bookings.status='disputed'`. None of these reference the others.
- **Current:** Three separate "dispute" representations: `dispute_resolutions` row, `escrow_payments.status='disputed'`, `bookings.status='disputed'`. None synchronised.
- **Should-be (Part 8):** Single dispute record with FKs to booking + escrow; status changes propagate; auto-release blocked.
- **Owning Part:** Part 8.

### F-33 — P1 — Walk-my-pet `confirmation_code` is a 6-digit numeric without rate limiting

- **Where:** `server/routes/walk-my-pet.ts:519` (generation), `:1118-1119` (verification).
- **Current:** `randomInt(100000, 1000000)` six digits, brute force ~10^6 attempts. No rate limit on `/walks/:bookingId/start`.
- **Should-be (Part 9):** Cryptographic token (signed JWT-style) bound to walker UID + booking; or 32-bit token + rate limit + lockout after 5 failures.
- **Owning Part:** Part 9.

### F-34 — P1 — Octopus Brain ledger is best-effort (`.catch` → log)

- **Where:** `server/routes/sitter-suite.ts:881-904`, `:1064-1084`, `:1175-1198`. Same pattern in `walk-my-pet.ts:535-558`.
- **Current:** Octopus inserts wrapped in `try/catch` with `logger.warn(... non-blocking ...)`. A failure here means the audit ledger is missing the event but the booking proceeds.
- **Should-be (Part 9):** Either Octopus is the audit source of truth and a failure must block the operation (within the same DB transaction), or it's a downstream tail-replay system fed from a real append-only ledger and not relied upon for primary audit. Currently neither.
- **Owning Part:** Part 9.

### F-35 — P0-financial-truth — `transaction_stamped_at` exists on bookings but no cross-system stamping path is wired

- **Where:** `shared/schema.ts:8331`; `server/services/unified-booking/TransactionStampService.ts`.
- **Current:** Stamping service file present; whether it runs from the booking-service is **NEEDS-CEO-REPRO**. Field is set null on creation in all paths examined.
- **Should-be (Part 9):** Every booking transition produces a stamp; `bookings.transaction_stamped_at` is set as the operation enters the ledger.

### F-36 — P0-financial-truth — `superAppPayouts.scheduledFor` set to "now + 7 days" hard-coded

- **Where:** `server/services/booking-service.ts:820`.
- **Current:** `scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`. Every payout is scheduled 7 days out, regardless of provider agreement, dispute window, withholding cert window, weekday, etc.
- **Should-be (Part 4):** Cadence per provider agreement (weekly Masav, e.g. Tuesdays in Israel). Hold extension on disputes.
- **Owning Part:** Part 4.

### F-37 — P1 — `super_app_payouts` has no acquirer-side reconciliation key

- **Where:** `shared/schema.ts:8434-8472`. `bankTransferReference` is a plain varchar with no UNIQUE constraint, no Masav batch FK.
- **Current:** Payout marked `completed` is a write-only flag; there is no second source confirming the bank actually moved the money.
- **Should-be (Part 4 + Part 9):** Masav batch row + per-line reconciliation; bank-statement match.

### F-38 — P0-illegal — Walk completion writes blockchain audit row in same flow that NEVER paid the provider

- **Where:** `server/routes/walk-my-pet.ts:1389-1420`.
- **Current:** A blockchain `walk_blockchain_audit` row is written stating amounts paid to walker and platform, sequenced via prev-hash. The amounts are derived from the booking row, not from real settlement (because no real settlement happened — F-W3). The "blockchain" is a chain of false claims.
- **Should-be (Part 9):** The audit chain is over actual ledger events, not over forecasted amounts. No payout = no payout audit row.
- **Owning Part:** Part 9.

### F-39 — P1 — Validation: `validateBookingTimes` has 5-minute past grace, `BookingService.validateBookingTimes` has none

- **Where:** `server/services/booking-service.ts:80-83` rejects `startTime < new Date()` outright. `routes/sitter-suite.ts:783-786` and `routes/walk-my-pet.ts:395-398` allow 5-minute grace. Inconsistent across the platform.
- **Should-be:** Single rule.
- **Owning Part:** Cross-cutting.

### F-40 — P1 — Provider wallet schema treats wallet IDs as `WALLET-${userId.slice(0, 20)}`

- **Where:** `server/services/BookingPolicyEngine.ts:199`.
- **Current:** Wallet id derived from a slice of UID — non-canonical, easy to collide if two UIDs share the first 20 chars.
- **Should-be (Part 3 + Part 2.5):** UUID v7 walletId; UID is FK only.
- **Owning Part:** Part 3.

### F-41 — P0-financial-truth — `EscrowService` calls Firestore inside what should be a single Postgres transaction

- **Where:** `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:441-482`. `escrowService.createEscrowPayment` writes to Firestore. The booking-row update happens later in Postgres.
- **Current:** Cross-database, no two-phase commit. If the Firestore write succeeds but the Postgres update fails, the booking row stays draft while the escrow exists. If Postgres succeeds but Firestore fails, the fallback fake escrow id is used (F-11).
- **Should-be (Part 8):** Single-store escrow (Postgres). Two-phase commit not needed when both writes are in the same DB.
- **Owning Part:** Part 8.

### F-42 — P1 — `processAutoRefund` only credits `wallet_accounts` by `userId` after row `slice(0,20)` derivation. Wallet may not exist

- **Where:** `BookingPolicyEngine.ts:196-206`.
- **Current:** `INSERT … ON CONFLICT (wallet_id) DO NOTHING` then `UPDATE … WHERE user_id = $2`. Race window: if no row pre-exists, the insert may not happen if a parallel process is creating it; the update may fire before the row exists.
- **Should-be:** Use `walletService.getOrCreateWallet(userId)` and then `walletService.addCredits` — both safe by row lock.

### F-43 — P0-illegal — VAT rate read from env var via `parseFloat`

- **Where:** `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:431-434`.
- **Current:** `parseFloat(process.env.VAT_RATE || String(ISRAEL_VAT_RATE))`. Per Part 2.1.3, `parseFloat` on money-side data is banned.
- **Should-be (Part 5):** VAT rate from `vat_decisions` table per `vat_decision_id` snapshot (Part 5.5). No env-var-driven tax rate.
- **Owning Part:** Part 5.

### F-44 — P0-financial-truth — Wallet redemption `loyaltyPointsApplied` cap is per-session, not per-booking

- **Where:** `WalletService.previewCredits:158`, `confirmRedemption:325`.
- **Current:** Cap of 20% of transaction is enforced at preview. Two parallel sessions for the same booking each pass the 20% cap, summing to >20%.
- **Should-be (Part 3):** Booking-level cap; preview returns canonical, single-session per booking.

### F-45 — P0-illegal — Wallet `cashDueCents` enforcement on confirmRedemption uses caller flag `paymentConfirmed: boolean`

- **Where:** `WalletService.confirmRedemption:296-298`.
- **Current:** If `cash_due_cents > 0`, requires the caller to assert `paymentConfirmed=true`. There is no server-side check that a card was charged.
- **Should-be (Part 3 + Part 7):** Server-side: route processes the card charge first (Tranzila/Nayax), receives an acquirer txn id, then calls confirmRedemption with the txn id; confirmRedemption verifies the txn against the acquirer's records, not a boolean.

### F-46 — P0-financial-truth — Receipt issued before payout, payout never happens — receipts are claims of completed transactions that never completed

- **Where:** Cumulative effect of F-01, F-13, F-27.
- **Current:** A digital receipt (a tax-relevant document) is written at acceptance time stating "Pet Wash Ltd received ILS X". The receipt is then archived. No subsequent settlement record reflects whether Pet Wash actually paid the provider their share. From the State of Israel's perspective, Pet Wash claims revenue; from the provider's perspective, no money arrived.
- **Should-be (Part 1 + Part 4 + Part 6):** Receipts are issued on completion (the taxable event). Payout records are real money movements. Reconciliation: VAT collected by Pet Wash = VAT on platform fee + VAT collected on behalf of provider; weekly variance > 0 = block.

### F-47 — P0-illegal — `IsraeliDigitalReceiptService.generateReceipt` writes `accountingRecorded: true` while the actual payment may have failed

- **Where:** `server/services/IsraeliDigitalReceiptService.ts:318`.
- **Current:** Hardcoded `accountingRecorded: true` at row insert. Means the row claims the transaction is on the books regardless of whether it really is.
- **Should-be (Part 9):** Boolean derived from successful ledger write; otherwise false; alerted.

### F-48 — P0-financial-truth — Revenue recognised at "captured" time on sitter, not on completion

- **Where:** Receipt issued at `routes/sitter-suite.ts:1099-1120` inside the `provider-respond accept` branch; this is the *capture* event, not the *completion* event.
- **Current:** Revenue is recognised when payment is captured (provider accept). Per Part 0.2.1, revenue must recognise on completion. Sitter currently has the timing wrong.
- **Should-be (Part 0.2.1 + Part 5):** Capture creates an `unearned revenue / customer deposit` ledger entry; completion converts to `revenue` and `cogs/provider_payable`.
- **Owning Part:** Part 0.2.1 + Part 5.

### F-49 — P0-illegal — `digital_receipts.platform` is a free-form varchar; there is no enum

- **Where:** `digital_receipts` table schema (referenced via `db.insert(digitalReceipts).values({platform: params.platform, ...})`).
- **Current:** Callers pass `'sitter-suite'`, `'walk-my-pet'`, `'pettrek'`, `'k9000'`, `'plush_lab'` etc. Mixing channel + product. Reporting confusion.
- **Should-be (Part 2.5.1):** Closed enum per Part 2.5.1 `canonical_type`.

### F-50 — P0-financial-truth — `escrow_holdings.status` default is `'pending'` and lacks check constraint

- **Where:** `shared/schema.ts:11344`.
- **Current:** Status is a free-form varchar. No enum, no check constraint. Comment lists allowed values but the DB allows any string.
- **Should-be (Part 8 + Part 2):** Closed enum at DB level (`CHECK status IN (…)`).

### F-51 — P0-financial-truth — `customAuth` Firebase Bearer is the auth across the platform; no money-movement re-auth

- **Where:** `customAuth.ts` (not opened in this audit but referenced in every route's `requireAuth` import).
- **Current:** A Firebase ID token gets the caller into any money-effecting route they have a record for. For payouts, refunds, top-ups: there is no second factor (re-auth, fresh token, voice/SMS confirm).
- **Should-be (Part 9 + Part 10):** Step-up auth for money-movement routes.
- **Owning Part:** Part 9 + Part 10.

### F-52 — P1 — `Math.ceil(diffMs / (1000*60*60))` for hourly billing punishes the customer by up to 59 minutes

- **Where:** `WalkPricingStrategy.calculateDurationHours` (`WalkEliteBookingEngine.ts:141-144`).
- **Current:** A 31-minute walk is billed as 1 hour. Upper-rounding always favours the platform.
- **Should-be (Part 5 + product policy):** Round to nearest 5 minutes, or to nearest 30 minutes; matches the Mad Paws/Wolt-style transparent billing.

### F-53 — P0-financial-truth — Surge pricing computed from booking start hour without freeze of decision

- **Where:** `WalkPricingStrategy.calculateSurgePricing` (`WalkEliteBookingEngine.ts:146-155`); `PetTrekPricingStrategy.calculateSurgePricing` (`PetTrekChauffeurBookingEngine.ts:130-145`).
- **Current:** Surge is recomputed every time pricing is requested. A booking made at off-peak that's accepted at peak gets a different price.
- **Should-be (Part 5):** Surge frozen at booking creation in a `pricing_quotes` row; quote id stored on booking; capture at acceptance uses the quote.

### F-54 — P0-illegal — Receipt void path overwrites the receipt rather than issuing a credit note

- **Where:** `server/routes/sitter-suite.ts:1204-1216` calls `IsraeliDigitalReceiptService.voidReceipt(...)`. Implementation **NEEDS-CEO-REPRO** but the field used (`isVoided`) suggests a destructive update.
- **Should-be (Part 6.5):** Original receipt remains; a credit-note row references it via `parent_txn_id`. No `is_voided` boolean.
- **Owning Part:** Part 6.

### F-55 — P0-financial-truth — `sitter_bookings.bookingId` is a string, separate from `sitter_bookings.id` (serial integer)

- **Where:** `shared/schema.ts:4307` (`sitter_bookings`); routes use `bookingId` for some queries and `id` for others (`routes/sitter-suite.ts:1391` does `parseInt(req.params.id)` and queries by `eq(sitterBookings.id, bookingId)`).
- **Current:** Two id columns mixed. `BookingPolicyEngine.processAutoRefund` (`:184-189`) queries by `sitter_bookings.id = $1` (integer). Confusion likely produces zero-row queries, silent refund failures.
- **Should-be (Part 2.5.1):** Single canonical id (UUID v7) per booking. Schema migration.

### F-56 — P0-illegal — No append-only DB triggers

- **Where:** Every money-bearing table — `bookings`, `super_app_payments`, `super_app_payouts`, `escrow_holdings`, `digital_receipts`, `credit_transactions`. None have `BEFORE UPDATE/DELETE` raise triggers per Part 2.2.2 / 2.3.5.
- **Current:** `db.update` is freely callable on every row. The `releaseEscrowPayment` and `refundEscrowPayment` routes use Firestore transactions for race safety but the underlying records can still be edited by anyone with DB write access.
- **Should-be (Part 2.2.2 / 2.3.5):** DB-level append-only constraints.
- **Owning Part:** Part 2.

### F-57 — P0-illegal — Loyalty reduces VAT base

- **Where:** `BaseLuxuryBookingEngine.quotePrice:172`; VAT calculation uses `discountedSubtotal * taxRate`.
- **Current:** Tax base is the post-discount subtotal. Per Part 0.7 footer, "VAT base is the full pre-discount price (subject to CPA confirmation)". Currently we under-collect.
- **Should-be (Part 5):** Pre-discount base; Pet Wash absorbs both the discount and the VAT differential.
- **Owning Part:** Part 5.

### F-58 — P0-illegal — `auditLedger` (`audit_ledger`) used by K9000 — separate from `audit_events`

- **Where:** `server/routes/k9000.ts:494-514`.
- **Current:** K9000 writes a row to `audit_ledger`. Sitter / walk / dispute paths use `logAuditEvent` (`audit_events` table). Two parallel audit chains, no cross-link, no joint replay.
- **Should-be (Part 9):** Single hash-chained audit event store extending into the financial ledger (Part 2.3.3).
- **Owning Part:** Part 9.

### F-59 — P1 — `EmergencyWalkService` referenced but not audited

- Out of scope for this pass. **NEEDS-CEO-REPRO**: confirm production usage.

### F-60 — P0-financial-truth — `escrow_holdings.bookingId` refers across multiple booking tables (no FK)

- **Where:** `shared/schema.ts:11333`. `bookingId varchar("booking_id").notNull()`. No reference.
- **Current:** Could point to `bookings.id`, `sitter_bookings.bookingId`, `walk_bookings.bookingId`, or `pettrek_trips.tripId`. No FK.
- **Should-be (Part 8):** Single booking table OR a polymorphic FK with `booking_kind` enum.

### F-61 — P0-financial-truth — `super_app_payouts.bookingId` references `bookings.id` only

- **Where:** `shared/schema.ts:8437`.
- **Current:** Sitter (`sitter_bookings.bookingId`), walk (`walk_bookings.bookingId`), petTrek (`pettrek_trips.id`) cannot create a `super_app_payouts` row because of the FK. Means `super_app_payouts` is *only* used for the unified `bookings` table — which is currently used by the legacy non-facade path (groomers etc.). All facade-routed payouts have **no payout row at all**.
- **Should-be (Part 4):** Single booking table OR per-channel payouts with proper FKs.

### F-62 — P0-financial-truth — `BookingService.createBooking` is the only path that auto-creates a `super_app_payouts` row, but only for the unified `bookings` table

- **Where:** `server/services/booking-service.ts:783-790, 798-831`.
- **Current:** Sitter and walk and PetTrek write into different tables (sitter_bookings, walk_bookings, pettrek_trips); their completion routes do NOT call `createPayout`. So `super_app_payouts` is empty for the marketplace verticals.
- **Should-be (Part 4):** Every completion writes a payout row through a single payout service.

### F-63 — P0-illegal — Customer is told payment is held in escrow when it may not be

- **Where:** `server/services/EscrowService.ts:139-147` (notification "Payment Secured 🔒"); fired immediately on `createEscrowPayment` without verifying the acquirer actually charged the card.
- **Current:** Customer receives a push notification that money is held in escrow even when (a) Tranzila wasn't actually called (F-02), (b) the fallback fake escrow id was used (F-11), (c) sitter's NayaxSitterMarketplaceService.processBookingPayment ran in dev simulation. Misrepresentation under חוק הגנת הצרכן.
- **Should-be (Part 0.3.1):** "Payment held" notification fires only after Postgres + acquirer confirm.
- **Owning Part:** Part 0.3.1 + Part 8.

### F-64 — P0-financial-truth — Provider notified "Payment secured. Complete service to receive ₪X" when no real money is held

- **Where:** `server/services/EscrowService.ts:149-156` — provider push.
- **Current:** Provider receives a promise message with the amount they will receive. Combined with F-01 (NOOP payout), the platform makes a contractual claim that it has not implemented technically.
- **Should-be (Part 4 + Part 8):** Provider notification fires only after escrow is real and provider's payout schedule is set.

### F-65 — P0-financial-truth — Escrow auto-release runs without checking the booking is completed

- **Where:** `server/services/EscrowService.ts:418-448` (`autoReleaseExpiredHolds`). Reads escrows with `status='held'` and `holdUntil<=now`.
- **Current:** No check that `bookings.status='completed'`. If a booking is `confirmed` but the service hasn't happened (e.g. customer no-show), the cron releases funds anyway.
- **Should-be (Part 8):** Auto-release requires both `status='held'` AND `bookings.status='completed'`.

### F-66 — P0-illegal — `IsraeliDigitalReceiptService.generateReceipt` does not check provider's `osekType` before deciding receipt vs invoice

- **Where:** `routes/sitter-suite.ts:1099-1120` calls generateReceipt with no osekType.
- **Current:** Single receipt format regardless of dealer status.
- **Should-be (Part 0.6.2 / 0.6.3):** authorized dealer → tax invoice (חשבונית מס); exempt dealer → receipt (קבלה). Issuer identity differs.

### F-67 — P0-financial-truth — `digital_receipts.companyAddress` hard-coded `'ישראל'`

- **Where:** `VATCalculatorService.ts:393`. Hard-coded `'ישראל'` rather than the registered company address.
- **Current:** Receipts ship without a real company address. Israeli law requires the issuer's full address.
- **Should-be (Part 1):** Single config source for company identity; address required.

### F-68 — P0-illegal — Octopus ledger is wallet-id-aware via free-form metadata

- **Where:** `octopus_ledger` (`shared/schema.ts` octopus tables); writes through `routes/sitter-suite.ts:893-901`.
- **Current:** Per-line `metadata: { sitterBookingId, totalDays, ownerId, sitterId }` jsonb. Per Part 2.5.2, `metadata jsonb` blobs are forbidden on financial objects — this is one.
- **Should-be (Part 2):** Typed columns; closed schema.

### F-69 — P1 — `globalConfig.getCommissionRate()` is a global setting; provider-specific rates not supported

- **Where:** `server/services/SitterGlobalConfig.ts:27`.
- **Current:** Single rate for the entire sitter platform.
- **Should-be (Part 4):** Per-provider commission per the agreement.

### F-70 — P3 — Numerous `console.error` / `logger.error` patterns, no structured per-request correlation

- Cross-cutting code-hygiene issue. Out of P0 scope.

---

(Findings F-01 through F-70 cover the priority surface. The audit identified additional smaller surfaces — naming, type drift, query plans — they are spec-relevant but not P0/P1 and are not catalogued individually here.)

---

## Recommended owning-Part assignments

| Finding | Owning Part | Spec section | Rationale |
|---|---|---|---|
| F-01 NOOP payout | Part 4 | 4.1 cadence; 4.2 Masav | Provider settlement is Part 4's job |
| F-02 Tranzila stub | Part 7 | 7.1 wire; 7.2 webhook HMAC | Acquirer integration is Part 7 |
| F-03 Top-up trust | Part 3 + Part 7 | 3.4 + 7.2 | Wallet sources verified by Part 3, acquirer by Part 7 |
| F-04 Wrong company tax id | Part 1 | 1.2 issuer identity | Company identity is Part 1's job |
| F-05 Sitter escrow NOOP | Part 8 | 8.1 single store | Escrow is Part 8 |
| F-06 Two escrow stores | Part 8 | 8.1 | Same |
| F-07 Loyalty reduces payout | Part 0.2.4 + Part 5 | declared / 5.4 | Already declared in Part 0; Part 5 implements |
| F-08 Auth missing on money routes | Part 9 + cross-cutting | 9.5 RBAC | Audit/RBAC layer |
| F-09 Self-match | Part 0.1.2 + code | declared | Already declared in Part 0 |
| F-10 Refund-to-wallet | Part 6 | 6.1 method-of-record; 6.5 lineage | Refunds are Part 6 |
| F-11 Escrow fake-id fallback | Part 8 | 8.1 fail-closed | Same |
| F-12 No idempotency on capture | Part 7 + Part 2.5.1 | 7.3 + 2.5.1 | Idempotency is the locked-nine field |
| F-13 Wrong issuer per channel | Part 1 + Part 0.6 | 1.2 + 0.6 | Issuer identity per channel |
| F-14 K9000 VAT timing | Part 5 | 5.2 timing | VAT timing |
| F-15 Dispute does not freeze escrow | Part 8 | 8.3 | Same |
| F-16 No-show no money | Part 6 + Part 4 | 6.6 no-show fee + 4.5 provider compensation | New section needed |
| F-17 Nayax fail-open webhook | Part 7 | 7.2 fail-closed | Same |
| F-18 Tranzila webhook stub | Part 7 | 7.2 | Same |
| F-19 DST math | Cross-cutting | (Part 2.5.1 UTC-on-disk + product TZ) | Cross-cutting |
| F-20 Double-booking race | Part 8 | 8.4 inventory lock | Escrow inventory |
| F-21 Float arithmetic | Part 2.1 | 2.1.4 helpers + ESLint | Money helpers |
| F-22 platformData jsonb financial | Part 2 | 2.2.2 forbidden | Schema |
| F-23 Numbering single domain | Part 2.4 | 2.4.1 domains | Numbering |
| F-24 Refund engine ignores PetTrek/K9000/groomers | Part 6 | 6.4 channel-aware | Same |
| F-25 superAppPayments missing locked-nine | Part 2.5 | 2.5.1 | Same |
| F-26 Commission rate inconsistent | Part 4 | 4.6 commission terms | Same |
| F-27 Empty buyer info on receipt | Part 1 | 1.2 receipt fields | Same |
| F-28 Wallet bucket conflation | Part 3 | 3.2 buckets | Same |
| F-29 No tax-profile snapshot | Part 1.5 | 1.5 | Same |
| F-30 K9000 facade safety fence is doc-only | Part 0.1 + Part 8 | 0.1.2 + 8.5 | Same |
| F-31 Chargeback clawback unwired | Part 6 + Part 4 | 6.7 + 4.7 | Same |
| F-32 Disputes parallel-system | Part 8 | 8.3 | Same |
| F-33 6-digit confirmation code | Part 9 | 9.4 step-up auth | Same |
| F-34 Octopus best-effort | Part 9 | 9.1 audit chain | Same |
| F-35 transaction_stamped_at unused | Part 9 | 9.2 | Same |
| F-36 7-day hard-coded payout | Part 4 | 4.1 cadence | Same |
| F-37 No reconciliation key on payout | Part 4 + Part 9 | 4.4 reconciliation + 9.6 | Same |
| F-38 Walk blockchain audit on unsettled amounts | Part 9 | 9.1 audit over real events | Same |
| F-39 Validation grace inconsistency | Cross-cutting | (Part 9 audit invariant) | Same |
| F-40 Wallet ID derived from UID slice | Part 3 + Part 2.5.1 | 3.1 + 2.5.1 | Same |
| F-41 Cross-DB escrow tx | Part 8 | 8.1 single store | Same |
| F-42 processAutoRefund wallet creation race | Part 6 | 6.2 | Same |
| F-43 VAT rate from env via parseFloat | Part 5 | 5.5 vat_decision_id | Same |
| F-44 Loyalty cap per-session not per-booking | Part 3 | 3.5 redemption order | Same |
| F-45 paymentConfirmed boolean | Part 3 + Part 7 | 3.5 + 7.3 | Same |
| F-46 Receipts before settlement | Part 1 + Part 4 + Part 6 | 1.2 + 4.1 + 6.5 | Same |
| F-47 accountingRecorded hardcoded true | Part 9 | 9.1 | Same |
| F-48 Revenue at capture not completion | Part 0.2.1 + Part 5 | 0.2.1 + 5.2 | Same |
| F-49 platform free-form varchar | Part 2.5.1 | 2.5.1 canonical_type | Same |
| F-50 escrow_holdings.status no enum | Part 8 + Part 2 | 8.2 + 2.2.2 | Same |
| F-51 Money-route step-up auth | Part 9 + Part 10 | 9.4 + 10.5 kill-switch | Same |
| F-52 Hourly ceiling rounding | Part 5 | 5.3 | Same |
| F-53 Surge recomputed | Part 5 | 5.3 frozen quotes | Same |
| F-54 Receipt void destructive | Part 6.5 | 6.5 lineage | Same |
| F-55 Two id columns on sitter_bookings | Part 2.5.1 | 2.5.1 | Same |
| F-56 No append-only triggers | Part 2.2.2 / 2.3.5 | declared | Same |
| F-57 Loyalty reduces VAT base | Part 5 | 5.4 + 0.7 | Same |
| F-58 Two audit chains | Part 9 | 9.1 single chain | Same |
| F-60 escrow.bookingId no FK | Part 8 | 8.1 + 2.5.1 | Same |
| F-61 superAppPayouts.bookingId only points to bookings | Part 4 | 4.3 | Same |
| F-62 createPayout only for unified bookings | Part 4 | 4.3 | Same |
| F-63 Customer notified payment-secured prematurely | Part 0.3.1 + Part 8 | 0.3.1 + 8.1 | Same |
| F-64 Provider notified before real escrow | Part 4 + Part 8 | 4.5 + 8.1 | Same |
| F-65 Auto-release without completion check | Part 8 | 8.2 release rule | Same |
| F-66 Receipt vs invoice based on osekType | Part 0.6.2 / 0.6.3 + Part 1 | declared / 1.2 | Same |
| F-67 Hard-coded company address | Part 1 | 1.2 | Same |
| F-68 Octopus metadata jsonb | Part 2 | 2.5.2 forbidden metadata | Same |
| F-69 Single global commission rate | Part 4 | 4.6 | Same |

---

## Open questions for CEO + counsel + CPA

The following questions cannot be answered from code; they require human input. None of them should be answered "in code first then validated" — every one must precede the corresponding spec section.

1. **Company tax ID.** What is the active עוסק מורשה ID for Pet Wash Ltd (company № 517145033)? The code uses `516788400` hard-coded — is this correct? Same question for the registered Pet Wash address on receipts. (Owners: CEO + CPA. Blocks F-04, F-67.)

2. **Per Part 0.5 Provider Master Agreement.** When does the agreement get drafted, with which clauses (per the dependency map in Part 0.5)? Until each row reads "DRAFTED + APPROVED" the corresponding spec part — Part 4 payouts, Part 6 refunds, Part 8 escrow, Part 10 kill switch — cannot proceed. (Owners: CEO + counsel.)

3. **Trust account separation.** Has Pet Wash opened the separate trust account at the bank (Part 0.4.2)? Until then, every customer payment that lands in the operating account is commingled — illegal even before launch volume. (Owners: CEO + CFO + Bank.)

4. **Tranzila merchant agreement.** Is the merchant account live? When? With which webhook URL endpoint, with which secret rotation policy? (Owners: CEO + CFO. Blocks F-02, F-18.)

5. **Nayax Spark API credentials.** The K9000 IoT flow uses the Nayax Spark API. The marketplace uses `NayaxSitterMarketplaceService` calling a different Nayax endpoint. Are these the same merchant account? Two different credentials? When are real keys provisioned? (Owners: CEO + CFO. Blocks F-01, F-12, F-14.)

6. **Withholding default rate.** What is the v1 default withholding rate when a provider has no certificate on file? Part 0.7.3 leaves this open. CPA must answer in writing. (Owner: CPA.)

7. **Self-billing default vs provider self-issuance default.** Part 0.6.4 leaves this open. Pin one for v1. (Owners: counsel + CPA.)

8. **Israeli consumer-protection refund window.** Confirm the days for distance pet-services contracts and any exclusions. (Owner: counsel.)

9. **Loyalty expiry policy.** Maximum validity period; breakage policy under חוק הגנת הצרכן. (Owner: counsel.)

10. **No-show fee policy.** Customer no-show fee amount and provider compensation; legal basis under חוק הגנת הצרכן (cancellation as breach vs. as service-not-rendered). (Owner: counsel.)

11. **Chargeback clawback policy.** Operating loss vs provider clawback split per cause; is Pet Wash insured for fraud chargebacks; does the Provider Master Agreement allow clawback offset against future payouts? (Owners: CEO + counsel + CFO.)

12. **Dispute SLA + mediator role.** Who plays the in-app mediator? Is there a separate user role (Pet Wash Mediator) with its own audit trail? (Owners: CEO + product.)

13. **Rounding penny absorption.** Part 2.1.4 leaves this open ("platform absorbs by default" — confirm with CPA). (Owner: CPA.)

14. **Final chart of accounts.** Part 2.3.4 is illustrative; CPA must approve a closed list before any code uses an account code. (Owner: CPA.)

15. **K9000 channel: separate corporate entity?** Part 0.3.3 carves out K9000 product liability. Is Pet Wash Ltd really the entity owning the machines, or is there a sister entity? If sister, dual-entity accounting changes everything. (Owners: CEO + counsel.)

16. **Multi-day boarding billing across DST.** What's the legal hours-vs-days standard for boarding contracts in Israel? The CEO has flagged the Tel Aviv multi-day bug — is the customer-facing rule "calendar nights" or "24-hour blocks"? (Owners: counsel + product.)

17. **Provider-to-customer match self-exclusion.** Beyond the same-user case (F-09), should households / shared addresses / same-IP detection also exclude? CEO-reported "next door" issue suggests yes. (Owner: CEO + product.)

18. **Auto-release window.** 72 hours is in code (`EscrowService.HOLD_DURATION_HOURS=72`); is that the agreed Israeli marketplace standard? Should it differ for boarding (longer) vs walk (shorter)? (Owners: CEO + counsel.)

19. **Demo mode behaviour in production-like environments.** Today, staging may charge real Nayax cards while not commanding the machine (F-K3). Is staging permitted to hit live Nayax? If yes, what's the customer-experience cleanup? (Owners: CEO + CFO + ops.)

20. **Octopus Brain.** Is `octopus_*` the audit ledger, the operational ledger, or shadow telemetry? Today it tries to be all three. (Owner: CEO + engineering — purely for clarity.)

---

## Closing note

Pet Wash Ltd is at the moment **structurally exposed** if real shekels move at scale. The deepest issue is not any single bug; it is that the code's claims about money (received-secured, paid-out, refunded, taxed) are **promises** rather than **records**. Each promise a customer or a provider relies on — "Payment Secured 🔒", "Payment Released 💰", "Refund Processed 💳" — is sent before the underlying movement is real. Receipts are issued before settlements; settlements are not done. Disputes, chargebacks, and no-shows have no money lever. The wallet bucket conflates pre-paid trust funds with marketing credits. The withholding row is computed and reported; the corresponding payout never happens.

The fix is not patches. The fix is the Financial Core Architecture (Parts 0-10) being signed off, the Provider Master Agreement being executed, and the trust account being opened — and then a methodical migration to real `Money`, real ledger, real append-only state, and real settlement. Until then every "temporary" finance line in code is permanent debt.

End of audit.

---

## Appendix A — Deeper edge-case traces

These traces walk a full edge case end-to-end, both customer and provider sides, to make the audit findings concrete. Each trace is the actual code path observed; lines cited are absolute.

### A.1 Customer cancels BEFORE provider accepts — Sitter Suite

**Customer side (request from app):** No route exists. The sitter routes file (`server/routes/sitter-suite.ts`) inventory shows: `POST /bookings`, `PATCH /bookings/:bookingId/provider-respond`, `GET /bookings/:bookingId/status`, `GET /bookings`, `PATCH /bookings/:id/complete`, `POST /reviews`, `POST /search/nearby`, `GET /sitter/{requests,earnings,stats}`. There is NO `POST /bookings/:id/cancel` for the customer.

**Provider side:** Provider sees the `pending_provider` booking in their pending queue (`GET /bookings/provider-pending`). They can accept or decline. Customer cannot withdraw the request before they respond.

**What actually happens if the customer wants to cancel:**

1. Customer presses "Cancel" in the app.
2. App calls some endpoint — but no matching server route exists. **NEEDS-CEO-REPRO**: confirm whether the React app calls a different route (perhaps `/api/bookings/:id/cancel` from the unified router). If yes, that route would hit `BookingService.cancelBooking` (`server/services/booking-service.ts:986-1012`), but that operates on the unified `bookings` table, not `sitter_bookings`. Mismatch: no row updates.
3. App displays "Cancellation requested" but server does nothing.
4. Provider eventually accepts; payment captures; booking is now `confirmed` for a customer who thinks they cancelled.

**Per spec:** Free cancel before provider acceptance, write `octopusLedger CANCELLATION amount=0`, send notification to provider that the request was withdrawn, no money effect.

**Severity:** P0-marketplace-trust (customer trapped in confirmed state) bordering P0-financial-truth (customer charged after attempted cancellation).

### A.2 Customer cancels AFTER provider accepts but BEFORE service starts (within free-cancel window) — Walk My Pet

**Customer side:** Same "no customer-side cancel route" gap as A.1.

**Provider side:** Walker has accepted (`POST /bookings/:bookingId/provider-respond` with `action='accept'` at `routes/walk-my-pet.ts:621`). Booking now `pending` (per `:1063-1068`). A receipt has been issued (`:716-733`) — note: with empty customerEmail, empty customerName, **no** Nayax transaction id (because no payment was attempted). The receipt is a **tax document** asserting the walker received payment from this customer.

**What happens if customer wants to cancel inside the 24-hour free window:**

1. No customer-cancel endpoint.
2. If admin cancels manually via the unified `bookings` cancel path — it operates on `bookings` not `walk_bookings`. Schema mismatch.
3. The receipt remains as issued. No credit-note is issued. No refund.

**Per spec:** `BookingPolicyEngine.calculateCancellation('dog_walk', amount, bookingDate, now, 'IL')` → 100% refund, 0 fee. `processAutoRefund` should issue a refund to the original payment method (which was never charged in the first place — F-W3, F-W6) and a credit note against the (non-tax-event) receipt. Today: nothing.

**Severity:** P0-illegal (receipt outstanding for a transaction that never happened) plus P0-marketplace-trust.

### A.3 Customer cancels mid-walk (mid-service)

**Customer side:** No "stop the walk" endpoint. The customer cannot end a walk early.

**Provider side:** Walker has `POST /walks/:bookingId/start` running. The booking is `in_progress`. `is_live_tracking_active=true`. The walker, not the customer, completes the walk.

**What if the dog goes home early?** Walker manually triggers `POST /walks/:bookingId/complete`. The duration is `actual_duration_minutes` from start to complete; the price was set at booking time, fixed. Per Part 5 the price ought to adjust pro-rata for partial service; today it does not.

**Severity:** P1-marketplace-trust (customer can be charged for a walk that ended early at their request).

### A.4 Customer no-show — PetTrek

**Customer side:** Customer requested a trip, the driver dispatched and arrived; customer doesn't appear.

**Provider side:** Driver hits `POST /provider/decline-trip`? No — that's pre-acceptance. The driver has already started? `POST /provider/start-trip` requires GPS at pickup; if the customer's not there, the driver hasn't started. The driver has no "couldn't find customer" endpoint.

**What actually happens:**

1. Driver waits.
2. Driver gives up after some time.
3. The `pettrek_dispatch_records` row may eventually time out (per the comment "30-second auto-expire for unaccepted dispatches" in PetTrekChauffeurBookingEngine.ts:11), but the trip itself has already passed dispatch — it's `confirmed` (`pettrek_trips.status='confirmed'`).
4. The escrow is held with `providerId='pending'`. Auto-release fires at +72 hours and tries to notify "pending" — broken.
5. Customer gets refunded? No — there is no path that refunds a PetTrek customer.
6. Driver compensation? No — no path.

**Per spec (Gett model):** Driver-arrival-fee charged from auth (e.g. ₪10 cancellation fee), customer refunded the trip portion, driver paid the arrival fee. Today: nothing.

**Severity:** P0-financial-truth + P0-marketplace-trust.

### A.5 K9000 mid-cycle machine fault — Flow A (Nayax direct)

**Customer side:** Tapped card; wash started; ran for 90 seconds; pump errored.

**Provider side:** Pet Wash is the principal seller. Machine is platform-owned.

**What actually happens:**

1. `POST /api/k9000/wash/start_cycle` returned success at the moment of activation.
2. Bay session was opened (`baySessions.status='active'`).
3. Pump fault during cycle is reported by the IoT controller via `POST /heartbeat` or a separate fault endpoint (the route does have `/heartbeat` at `routes/k9000.ts:1304` but the fault path is **NEEDS-CEO-REPRO**).
4. `compensation_required` bay event written by `MachineCommandService.timeoutScanner` (`server/services/MachineCommandService.ts:471-540`) — **only for wallet-funded sessions**. For Nayax direct (Flow A), the comment at `:540` confirms there is no auto-refund.
5. Customer's card has been charged (Nayax authorised + settled).
6. No automated refund. Manual ops task.

**Per spec (Part 0.3.3):** Pet Wash IS liable for K9000 wash session correctness. Auto-refund the customer's card via Nayax refund API; issue credit note against the receipt issued at activation; reverse the VAT entry.

**Severity:** P0-illegal (Pet Wash retains money for service not delivered).

### A.6 Wallet top-up succeeds at acquirer but fails to credit the wallet

**Customer side:** Customer goes through the Nayax hosted page, pays ₪50, sees "success" on Nayax.

**Server side path 1:** Nayax hits the webhook (`/api/webhooks/nayax/payment` at `routes/nayax-webhooks.ts:404`). This endpoint operates on the unified `bookings` table — it has no path for wallet top-ups. The webhook is **booking-only**.

**Server side path 2:** The customer's app polls and posts `/api/credit-wallet/topup` with the Nayax txn id (F-WT1). If the app crashes or the user closes it before posting, the wallet is never credited even though the card was charged.

**Today:** No reconciliation cron compares Nayax settlements against `credit_transactions`. Money lost silently.

**Per spec:** Server-side reconciliation. Nayax notifies via webhook → server credits wallet via idempotency key derived from acquirer's tx id. Client never tells the server how much to credit.

**Severity:** P0-financial-truth.

### A.7 Wallet redemption + card combo on the same booking, card fails after wallet debited

**Customer side:** Booking total ₪100. Wallet has ₪40 e-gift credit. Customer chooses to use the credit; ₪60 cash due.

**Server side:**

1. Customer route initiates checkout. This route is **NEEDS-CEO-REPRO** — no single composable file traces a wallet-plus-card combo for a sitter booking. The wallet preview returns `cashDueCents=6000`. The booking row holds `subtotal=10000` agorot.
2. Some caller (likely a payment-flow file) charges ₪60 via Nayax/Tranzila → success returns transactionId.
3. The caller calls `WalletService.confirmRedemption(sessionId, paymentConfirmed=true)`. Inside that function (line 296-298): `if (cashDueCents > 0 && !paymentConfirmed) throw`.
4. The wallet debit happens inside the redemption-session transaction (line 425-451 atomic).
5. **But what if step 4 fails?** `confirmRedemption` could throw — the row-locked wallet `FOR UPDATE` plus a transient connection error would mean: card was charged, wallet not debited (because tx rolled back), session in-flight.
6. The caller now has a charged card and a wallet with the credit still available. Customer disputes.

**Per spec (Part 7):** Two-phase. Card auth (no capture). Wallet debit in same DB tx with capture token. Capture card. Release lock. On any failure: void card auth + restore wallet.

**Severity:** P0-financial-truth.

### A.8 Provider self-matched

**Customer side / provider side (same person):** A user who is registered as a sitter searches for a sitter for their own pet. Per Part 0.1.2, this match must be excluded.

**Server side:** `runProviderSearch(filters, callerUserId)` at `server/services/providerSearchService.ts:445`. The `callerUserId` parameter is read into the `matching.started` event but never used to filter results. The full provider list is scored and ranked; if the user's own provider profile is highly rated and nearby, it wins the top spot.

**Verification:** I searched for `callerUserId` use in the file: only line 447 (parameter declaration) and line 457 (event pub). Nowhere does a `.filter` exclude `callerUserId`.

**Severity:** P0-illegal — Part 0.1.2 explicitly forbids this and ties it to "PR-#2 self-exclusion in code". The spec is final; the code does not honour it.

### A.9 Disputed booking with auto-release pending — Sitter Suite

**Provider side:** Sitter completed the stay; received "Payment Released 💰" notification (after F-65 auto-release fires at +72 hours).

**Customer side:** Customer disputes via chat (`POST /api/booking-chat/:bookingId/dispute`).

**What happens:**

1. The chat dispute route updates `sitterBookings.status='disputed'` (`booking-chat.ts:1030`).
2. The escrow store (`escrow_payments` Firestore) is NOT updated.
3. The 72-hour cron (`autoReleaseExpiredHolds`) reads escrow with `status='held'` and `holdUntil<=now`. It does NOT cross-check `sitter_bookings.status`. It releases the funds.
4. Provider has been paid (or, given F-01, the payout would have been written but is a NOOP).

**Per spec (Part 8.3):** Dispute MUST atomically flip both the booking row and the escrow record. The API exists (`EscrowService.disputeEscrowPayment:320-389`) but is not called from the chat dispute route.

**Severity:** P0-financial-truth.

### A.10 Multi-day stay across DST (Asia/Jerusalem)

**Customer side:** Customer books a 4-night stay starting Friday before the DST spring-forward.

**Provider side:** Sitter accepts; quoted ₪80/day × 4 nights = ₪320.

**Server math:** `SitterAdvancedBookingEngine.calculateDuration(startDate, endDate, 'boarding')` computes `(endTime - startTime) / msPerDay`, ceiling.

- True interval is 4 nights but in UTC milliseconds: 4×24h - 1h (spring-forward) = 95 hours = 3.96 days. `Math.ceil` → 4. OK in this direction.
- Reverse direction (fall-back, October Israel returns from DST): 4×24h + 1h = 97 hours = 4.04 days. `Math.ceil` → 5. **Customer billed 5 days for a 4-night stay**.

The booking row total is `pricePerDay × ceil(days)`. `processBookingPayment` charges that total (in dev mode the simulation passes; in prod F-12). The receipt issues at the post-DST inflated total. The provider statement claims 5 days of work; actual work is 4 nights.

**Provider impact:** The provider declared `osekType` and might have to issue an invoice for ₪400, but only worked 4 days. They under-deliver vs the receipt or over-claim taxable income.

**Customer impact:** Overcharged ₪80 ILS with no remediation path.

**Severity:** P0-financial-truth (CEO-flagged).

---

## Appendix B — Schema gaps mapped to Part 2.5.1 locked-nine

For each money-bearing table, this matrix shows whether the locked-nine fields exist (✓), are partially present (~), or missing (✗).

| Table | id (UUIDv7) | created_at UTC | actor_kind+id | origin_subsystem | idempotency_key | linked refs | ledger_hash_pointer | human_ref | canonical_type |
|---|---|---|---|---|---|---|---|---|---|
| `bookings` | ✓ (random uuid, not v7) | ✓ | ✗ | ✗ | ✗ | ~ (FK to platform/provider/station) | ✗ | ~ (`booking_number`) | ~ (`platformId`+`status`) |
| `super_app_payments` | ✓ | ✓ | ✗ | ✗ | ✗ | ~ (`bookingId`) | ✗ | ✗ | ✗ |
| `super_app_payouts` | ✓ | ✓ | ✗ | ✗ | ✗ | ~ (`bookingId`) | ✗ | ~ (`bankTransferReference`) | ✗ |
| `escrow_holdings` | ~ (serial+escrowId varchar) | ✓ | ✗ | ✗ | ✗ | ~ (`bookingId` no FK) | ✗ | ~ (`escrowId`) | ✗ |
| `escrow_payments` (Firestore) | ~ (deterministic id from idempotencyKey) | ✓ | ✗ | ✗ | ~ (key in metadata) | ~ | ✗ | ✗ | ✗ |
| `digital_receipts` | ~ (serial+receiptNumber) | ✓ | ✗ | ✗ | ✗ | ~ (`bookingId`) | ~ (`auditHash`) | ✓ (receiptNumber) | ~ (`receiptType`) |
| `wallet_accounts` | ~ (serial+walletId derived) | ✓ | ✗ | ✗ | ✗ | ~ (`userId`) | ✗ | ~ (`walletId`) | ✗ |
| `credit_transactions` | ~ (serial+transactionId varchar) | ✓ | ~ (`initiatedBy`) | ✗ | ✗ | ~ (`bookingId`, `redemptionSessionId`) | ✗ | ~ (transactionId) | ~ (`creditType`+`transactionType`) |
| `redemption_sessions` | ~ | ✓ | ✗ | ✗ | ✗ | ~ (`bookingId`, `walletId`) | ✗ | ~ (`sessionId`) | ~ (`sessionType`) |
| `octopus_bookings` | ~ | ✓ | ✗ | ✗ | ~ (`idempotencyKey`) | ~ | ✗ | ✗ | ~ (`platform`+`status`) |
| `octopus_ledger` | ~ | ✓ | ✗ | ✗ | ✗ | ~ (`bookingId`) | ✗ | ✗ | ~ (`type`) |
| `audit_ledger` | ✓ (string id) | ✓ | ~ (`customerUid`) | ~ (eventType prefix) | ✗ | ~ (metadata.transactionId) | ~ (previousHash) | ✗ | ~ (`eventType`) |
| `audit_events` | ✗ (NEEDS-CEO-REPRO — separate table from audit_ledger?) | — | — | — | — | — | — | — | — |
| `dispute_resolutions` | ~ | ✓ | ~ (`resolvedBy`) | ✗ | ✗ | ~ (`bookingId`) | ✗ | ✓ (`disputeId`) | ~ (`disputeType`) |
| `sitter_bookings` | ~ (serial+bookingId varchar) | ✓ | ~ (cancelledBy) | ✗ | ✗ | ~ (FKs) | ✗ | ~ (`bookingId`) | ✗ |
| `walk_bookings` | ~ | ✓ | ~ | ✗ | ✗ | ~ | ✗ | ~ | ✗ |
| `pettrek_trips` | ~ | ✓ | ✗ | ✗ | ✗ | ~ | ✗ | ~ (`tripId`) | ✗ |
| `provider_commissions` | (NEEDS-CEO-REPRO — referenced in IsraeliDigitalReceiptService but not opened in this audit) | — | — | — | — | — | — | — | — |
| `nayax_transactions` | ~ | ✓ | ✗ | ✗ | ✓ (`id` is the Nayax tx id) | ✗ | ✗ | ✗ | ✗ |
| `k9000_wash_events` | ~ | ✓ | ~ (customerUid) | ✓ (closed enum `transactionSource`) | ✓ (`idempotencyKey`) | ~ (stationId, baySide, nayaxTransactionId) | ✗ | ✗ | ~ (`transactionSource`+`redemptionSource`) |

**Conclusion of Appendix B:** Of the 18-19 money-bearing tables/collections inventoried, none satisfy all nine locked fields per Part 2.5.1. `digital_receipts` is the closest (`receiptNumber`, `auditHash`, typed receiptType). `k9000_wash_events` is the next closest. Most tables miss `actor_kind+actor_id`, `origin_subsystem`, `idempotency_key`, and `ledger_hash_pointer`.

This is the schema-debt that Part 2 must clear before live launch. A migration plan:

1. New `financial_transactions` table per Part 2.2 with the locked nine.
2. Existing money-bearing tables become read-side projections; new writes go through `financial_transactions` first.
3. Append-only triggers on the new table from day 1.
4. Per-channel numbering authority service (Part 2.4) provides `human_ref`.
5. Hash chain extends from `audit_events` → `financial_transactions` → `ledger_entries`.

---

## Appendix C — Cross-vertical comparison: what's wired vs what isn't

### C.1 Booking creation

| Vertical | Booking row | Pricing engine | Idempotency | Race-safe | Audit row |
|---|---|---|---|---|---|
| Sitter Suite | `sitter_bookings` | `SitterAdvancedBookingEngine.quotePrice` | None | No (F-20) | Octopus (best-effort) |
| Walk My Pet | `walk_bookings` | `WalkEliteBookingEngine.quotePrice` | None | Slot hold mitigates 5-min window | Octopus (best-effort) |
| Groomers | `bookings` (legacy) | Legacy `BookingService.calculatePricing` (no loyalty) | None | No | None |
| PetTrek | `pettrek_trips` | `PetTrekChauffeurBookingEngine.quotePrice` | None | No | None |
| Daycare | `sitter_bookings` (same as sitter) | Same as sitter | None | No | Octopus |
| K9000 | None — bookings not used | `K9000PricingStrategy` quoted but only used for engine compatibility | n/a | n/a | n/a |

### C.2 Payment capture

| Vertical | Acquirer | Real call? | Idempotency | DB tx? | Receipt issued? |
|---|---|---|---|---|---|
| Sitter Suite | Nayax (sitter marketplace path) | Stub (F-S1) — dev simulates SUCCESS | None (F-12) | No | Yes (F-46, F-66) |
| Walk My Pet | Nayax (no capture call observed) | None — receipt issued without capture (F-W6) | n/a | No | Yes — even though no charge |
| Groomers | None — no payment path wired | n/a | n/a | n/a | No |
| PetTrek | Tranzila (via base engine confirmBooking) | Stub (F-02) → fallback to fake escrow id (F-11) | None | No | None observed in route |
| K9000 Flow A | Nayax direct terminal | Yes — Nayax did the auth/capture | Yes (idempotencyKey on k9000_wash_events) | Yes (k9000_wash_events insert is atomic) | F-46 — recorded in P&L ledger |
| K9000 Flow B | Wallet (no acquirer) | Yes — wallet debit | Yes (`authorizeRedemption`) | Yes (Postgres tx) | k9000 audit ledger row |

### C.3 Refunds

| Vertical | Customer-initiated cancel | Refund channel | Credit-note? | Original receipt voided? |
|---|---|---|---|---|
| Sitter Suite | NOT WIRED | wallet (F-10) | No (F-54) | Yes (destructive) |
| Walk My Pet | NOT WIRED | wallet (F-10) | No | Yes (destructive) |
| Groomers | NOT WIRED | n/a | n/a | n/a |
| PetTrek | NOT WIRED | n/a | n/a | n/a |
| K9000 Flow A | NOT WIRED (F-K1) | n/a | n/a | n/a |
| K9000 Flow B | Auto-compensation on machine timeout (F-K3 partial) | wallet | No | n/a |

### C.4 Payout

| Vertical | Trigger | Acquirer/transfer | Real call? | Reconciliation |
|---|---|---|---|---|
| Sitter Suite | Manual `/complete` | NayaxSitterMarketplace.processSitterPayout — NOOP (F-01) | No | None |
| Walk My Pet | `/complete` | None — no payout call in route | No | None |
| Groomers | `BookingService` legacy path | `createPayout` → `super_app_payouts` row (F-62) | Row written; no transfer | None |
| PetTrek | `/provider/complete-trip` | None — sets `paymentStatus='pending'` only | No | None |
| K9000 | Pet Wash is principal — no provider payout | n/a | n/a | n/a |

### C.5 Audit

| Vertical | Audit chain | Hash chain? | Where? |
|---|---|---|---|
| Sitter Suite | Octopus + digital_receipts | No | Two systems |
| Walk My Pet | walk_blockchain_audit (chain) + digital_receipts + Octopus | Yes (chain) but over forecasted, not actual amounts (F-38) | Three systems |
| Groomers | None | No | n/a |
| PetTrek | None | No | n/a |
| K9000 | audit_ledger + k9000_wash_events + audit_events | Partial (audit_ledger has previousHash, but always null on insert) | Three systems |

**Conclusion:** Five verticals, four different audit conventions, no joint replay. Part 9 must consolidate.

---

## Appendix D — Additional findings (F-71+)

### F-71 — P0-financial-truth — Walk-my-pet receipt issued at provider acceptance with zero payment basis

- **Where:** `server/routes/walk-my-pet.ts:712-733`.
- **Current:** On walker acceptance, `IsraeliDigitalReceiptService.generateReceipt` is called with `nayaxTransactionId: undefined`, `customerEmail: ''`, `customerName: ''`, `paymentMethod: 'Nayax Card Payment'`. This is the strongest evidence of "promise as record": a tax-relevant receipt is issued declaring "Nayax Card Payment" with no Nayax payment in existence. There is no preceding `processBookingPayment` call in this branch.
- **Should-be:** Receipt issues only after a confirmed acquirer charge with a real txn id.
- **Owning Part:** Part 1 + Part 7.

### F-72 — P0-financial-truth — Walk-my-pet `provider-respond accept` does not capture payment, only changes status

- **Where:** `routes/walk-my-pet.ts:621-845` (the accept branch ends around line 778, decline around 840).
- **Current:** Accept branch (read in full): updates `walk_bookings.status` to `confirmed`, writes Octopus PAYMENT_CAPTURED ledger entry with `metadata: { escrowHoldHours: 72 }`, generates the (false) receipt at `:716-733`, calendar event, GCS backup. **No call to NayaxOnlinePaymentService, no call to TranzilaService, no escrow creation**. The Octopus ledger entry claims `PAYMENT_CAPTURED` for `octopusRecord.price` — but no payment was actually captured.
- **Should-be:** Same capture flow as sitter (and for sitter, see F-S1: even sitter's capture is a stub).
- **Owning Part:** Part 7 + Part 4.

### F-73 — P0-financial-truth — `octopusLedger.PAYMENT_CAPTURED` records claim payment was captured even though no acquirer was ever called for walk-my-pet

- **Where:** `routes/walk-my-pet.ts:697-705`.
- **Current:** Octopus ledger entry of type `PAYMENT_CAPTURED` is written with `amount: octopusRecord.price` and `metadata: { escrowHoldHours: 72 }`. There is no nayaxTransactionId in the metadata because no Nayax call was made. From Octopus's perspective, this is indistinguishable from a real capture.
- **Should-be (Part 9):** Octopus events tied to ledger entries that reference real acquirer transactions. No phantom captures.
- **Owning Part:** Part 9 + Part 7.

### F-74 — P0-illegal — Per-day price math goes through float in 3 places consecutively

- **Where:** `routes/sitter-suite.ts:999`: `Math.round(booking.totalChargeCents / booking.totalDays)`. `totalChargeCents` is an integer (cents) but Israeli VAT means it's not divisible cleanly by integer days; the Math.round drops fractional agorot. Subsequent settlement uses the rounded value, then the receipt re-divides for line items.
- **Should-be (Part 2.1):** `money.divideEvenly(totalCharge, totalDays)` returning the per-day amount and the explicit remainder.
- **Owning Part:** Part 2.1.

### F-75 — P0-financial-truth — Ledger entries computed from `decimal(12,2)` strings via `parseFloat`

- **Where:** Throughout — e.g. `VATCalculatorService.recordTransactionFromGross` is called with `parseFloat(booking.totalCost || '0')` from `walk-my-pet.ts:1374`, `parseFloat(booking.totalCost || '0') / 100` patterns in others, `(booking.basePriceCents / 100)` in `sitter-suite.ts:1039-1042`.
- **Current:** Money flows from typed minor units → string `decimal(12,2)` → float ILS → back to cents. Each conversion loses precision.
- **Should-be (Part 2.1.5):** Migrate to canonical `Money` end-to-end.
- **Owning Part:** Part 2.1.5.

### F-76 — P0-illegal — `IsraeliDigitalReceiptService.recordProviderSettlement` is called from the route file synchronously — no idempotency

- **Where:** `routes/sitter-suite.ts:1413-1422`. Two complete calls would write two settlement rows.
- **Current:** `recordProviderSettlement` is non-idempotent (no key on the call). If `/complete` runs twice (network retry, double-tap), withholding is double-recorded; commission is double-recorded; provider statement double-counts the booking.
- **Should-be (Part 4):** Idempotency-key on settlement bound to `(bookingId, version)` with collision = no-op.
- **Owning Part:** Part 4.

### F-77 — P0-financial-truth — Walk completion settlement called even though no payment occurred

- **Where:** `routes/walk-my-pet.ts:1349-1357`.
- **Current:** `IsraeliDigitalReceiptService.recordProviderSettlement` is called at completion with `grossPayoutAmount: parseFloat(booking.walkerPayout || '0')`. The walker is on the books for a settlement (and a withholding row) for money the platform never collected. Reconciliation against bank shows withholding remitted to the State for revenue that does not exist.
- **Should-be:** Settlement recorded only after a real capture event upstream.
- **Owning Part:** Part 4 + Part 7.

### F-78 — P0-financial-truth — `recordTransactionFromGross` called at completion writes Firestore ledger plus Postgres digital_receipts (dual-write)

- **Where:** `VATCalculatorService.ts:349-405`.
- **Current:** Writes Firestore `profit_loss_ledger`. Catches and swallows Firestore errors (`:352-358` "non-critical"). Then writes Postgres `digital_receipts`. Catches and swallows Postgres errors (`:399-405` "legal compliance gap" but does nothing about it).
- **Should-be (Part 2.3 + Part 9):** Single source of truth (the append-only ledger), with cache projections built downstream. Write failures alert + block.
- **Owning Part:** Part 9.

### F-79 — P0-financial-truth — `digital_receipts` rows for "P&L ledger entries" stored alongside customer receipts in same table

- **Where:** `VATCalculatorService.ts:372-398` — receipt type `pl_ledger_entry` is stored in the same `digital_receipts` table as customer-facing receipts (`receiptType: 'customer_payment'`).
- **Current:** Two fundamentally different document types in one table. Reporting joins are noisy. Numbering domain shared (F-23).
- **Should-be (Part 2):** Customer receipts in `digital_receipts`. P&L ledger entries in `ledger_entries` per Part 2.3.
- **Owning Part:** Part 2.

### F-80 — P0-financial-truth — `auditLedger` previousHash always null on insert

- **Where:** `routes/k9000.ts:513` (`previousHash: null`).
- **Current:** The "audit ledger" hash chain is broken at every insert — every row's previousHash is null. There is no chain at all.
- **Should-be (Part 2.3.3):** previousHash = sha256 of the previous row's hash; verified daily.
- **Owning Part:** Part 2.3.3.

### F-81 — P0-illegal — `disputed → completed` transition allowed in unified bookings state machine

- **Where:** `server/services/booking-service.ts:714` (validTransitions): `'disputed': ['refunded', 'completed']`.
- **Current:** Allows a disputed booking to be flipped back to `completed` — by anyone with admin access, since `updateBookingStatus` doesn't enforce who can do that transition. Per Part 6, dispute resolution is a credit-note + ledger event, not a destructive flip.
- **Should-be (Part 6):** No backward state on a financial event; the booking's accounting is settled by ledger entry, not status.
- **Owning Part:** Part 6.

### F-82 — P1 — `disputed` status flip from chat doesn't validate booking status pre-condition

- **Where:** `routes/booking-chat.ts:1027-1031`.
- **Current:** Dispute can be opened from any booking state — including `pending_provider`, `cancelled`, `completed`. There's no guard that the booking is past completion or even confirmed.
- **Should-be (Part 8):** Dispute only valid in defined windows.

### F-83 — P0-financial-truth — Walk completion does not write to `super_app_payouts`

- **Where:** `routes/walk-my-pet.ts:1277-1466`.
- **Current:** Settlement is recorded but no `super_app_payouts` row is created. `super_app_payouts.bookingId` references `bookings.id` (F-61), so even if the walk route wanted to insert, the FK would fail.
- **Should-be (Part 4):** A unified payout records system with proper FK to the originating booking (single booking table or polymorphic).

### F-84 — P0-financial-truth — Sitter completion writes `payoutResult` but doesn't insert to `super_app_payouts`

- **Where:** `routes/sitter-suite.ts:1436-1445`. `processSitterPayout` returns `{success: true, payoutReference: 'PAYOUT_…'}`. The route does not insert into `super_app_payouts`.
- **Current:** No payout row is written. The "payoutResult" is only used for the success check.
- **Should-be (Part 4):** Insert the payout row with `pending` status; mark `processed` when the bank transfer is confirmed (currently never happens — F-01).

### F-85 — P0-financial-truth — Bay session billing (K9000) never reconciled against the K9000 wash event

- **Where:** `K9000RedemptionService.openBaySession` writes `bay_sessions.amount_cents`. `k9000_wash_events.amountCents` is also written. No cross-check that they match.
- **Current:** Two records of the same wash with potentially different amounts.
- **Should-be (Part 9):** Reconciliation cron asserts `bay_sessions.amount_cents = k9000_wash_events.amount_cents` for every session-event pair.

### F-86 — P0-financial-truth — Apple Wallet pass `remainingBalance` derived without reading from ledger

- **Where:** `routes/k9000.ts:1004-1019`. After redemption, the route fires a fetch to `/api/wallet/notify-pass-update` with `remainingBalance` and `remainingUnit` from the redemption authorisation result. If the wallet was concurrently topped up by another path, the pass is stale.
- **Should-be:** Pass refresh queries the canonical balance at the moment of refresh.

### F-87 — P0-illegal — `recordProviderSettlement` calls do not pass provider's actual osekType

- **Where:** `routes/sitter-suite.ts:1413-1422`. No `osekType` field passed. The settlement function falls back to `isVatRegistered=false`, treating every provider as exempt and never charging VAT on commission to the provider.
- **Should-be (Part 0.7):** Look up provider's tax profile (Part 1.5 immutable snapshot), pass `osekType` accordingly. Authorized providers receive an inbound invoice from Pet Wash with VAT on the fee; exempt providers don't.

### F-88 — P0-financial-truth — `commissionRate: 7.5` in sitter completion is half the canonical rate

- **Where:** `routes/sitter-suite.ts:1421`.
- **Current:** Sitter settlement recorded at 7.5% commission. Every other source uses 15%. Two competing claims about how much Pet Wash earned per booking.
- **Should-be:** Single source.

### F-89 — P0-financial-truth — `parseFloat` on price columns leaks NaN to receipt issuer when columns are null

- **Where:** `routes/walk-my-pet.ts:713-715`. `parseFloat(booking.totalCost || '0')`. The fallback `|| '0'` masks bad data; if `totalCost` is null the receipt is for ₪0.
- **Should-be:** Strict typed read; null is an error.

### F-90 — P0-illegal — `digital_receipts.companyTaxId` allows free-form varchar; no enforcement of single tax id per channel

- **Where:** schema reference; receipts are inserted with whatever `COMPANY_TAX_ID` constant resolves to.
- **Current:** All channels share the same hard-coded constant.
- **Should-be (Part 0.6 + Part 1):** Channel-aware issuer identity.

### F-91 — P0-financial-truth — `unifiedBookingFacade.cancelBooking` calls `bookingPolicyEngine.processAutoRefund` which uses parseInt(bookingId) — fails for varchar booking ids

- **Where:** `server/services/booking-engines/base/BaseLuxuryBookingEngine.ts:380` (`parseInt(bookingId)`).
- **Current:** `bookingPolicyEngine.processAutoRefund(parseInt(bookingId), ...)`. For walk_bookings.bookingId = `WALK-2026-A1B2C3` (varchar), `parseInt` returns `NaN`. The query at `BookingPolicyEngine.ts:185-189` runs `WHERE id = NaN` (effectively `id = NULL`) — no row found, no refund processed.
- **Should-be:** Handle varchar booking ids; type-narrow before parsing.

### F-92 — P0-financial-truth — Loyalty points awarded to k9000 wash events but no event when redemption happens

- **Where:** `k9000_wash_events.loyaltyPointsAwarded` (column exists at `routes/k9000.ts:617`).
- **Current:** Field is written `0` for Nayax flow, awarded value **NEEDS-CEO-REPRO** for redemption flow. Loyalty award ledger separate from wallet credit_transactions; reconciliation depends on both being correct.
- **Should-be (Part 3 + Part 9):** Loyalty event is a ledger entry; redemption is a ledger entry; they reference each other.

### F-93 — P0-illegal — Customer receipt fields shipped from server with empty strings as fallbacks rather than rejecting

- Sitter `:1099-1120` and Walk `:716-733` patterns. The receipt issuer accepts the empty values and writes them. The receipt is non-deliverable and may be invalid under חוק ניהול ספרים (which requires identifying the customer for purchases above threshold).
- **Should-be (Part 1):** Receipt issuance fails closed if buyer info is missing.

### F-94 — P0-financial-truth — Wallet `previewCredits` math precedence: promo before egift before loyalty

- **Where:** `WalletService.ts:140-167`.
- **Current:** Order: promo → referral → egift → loyalty. This is a business decision (use promotional credits first to incentivise brand) but is not in any spec part.
- **Should-be (Part 3.5):** Order encoded in spec; user-overridable per Israeli consumer-protection rule on stored value usage.

### F-95 — P0-illegal — Bay session fee math differs from k9000 wash event amount

- **Where:** `K9000RedemptionService.openBaySession` and `routes/k9000.ts:603-620`. The Nayax flow stores `nayaxAmountCents = Math.round(amountILS * 100)`. The redemption flow stores wallet-debit amount.
- **Current:** Two parallel cents fields; rounding may diverge.
- **Should-be:** Single fee derivation through Money type.

### F-96 — P0-financial-truth — Withholding-tax remittance is recorded but no remittance file to State of Israel

- **Where:** `IsraeliDigitalReceiptService.recordProviderSettlement` calculates withholding; the `provider_commissions` table holds it.
- **Current:** No file generator for Form 856 (annual) or monthly remittance via שע"ם / מקוון.
- **Should-be (Part 4 + Part 5):** Monthly close exports remittance file; remittance executed; reconciled against `provider_commissions` rows for that period.

### F-97 — P0-financial-truth — `nayaxTransactionId` on bookings is varchar, no UNIQUE constraint

- **Where:** `bookings.payment_intent_id` is a varchar without UNIQUE.
- **Current:** Two bookings can share the same Nayax txn id (e.g. via a webhook bug). Only the application-level idempotency check at `routes/nayax-webhooks.ts:495-505` prevents duplicates — DB allows it.
- **Should-be (Part 2.5.1):** UNIQUE constraint.

### F-98 — P1 — Refund refund_amount_cents (cents) and refund_amount (decimal) both exist on bookings

- **Where:** `shared/schema.ts:8316, 8321`. Both `refundAmount` (decimal 12,2) and `refundAmountCents` (integer). Two ways to record the same fact.
- **Should-be (Part 2.1):** Single Money column. Duplicate is migration debt.

### F-99 — P0-financial-truth — Currency assumption (`'ILS'`) baked into routes, not enforced at boundary

- **Where:** Many places — `bookings.currency.default('ILS')`, `escrowHoldings`, etc. The `Money` type contract is "currency carried with every amount" (Part 2.1.2). Today currency is column-level default, not field-required.
- **Current:** A booking is created without explicit currency; `'ILS'` is assumed; if a future feature flag accidentally switches default, prior rows are wrong.
- **Should-be (Part 2.1):** Currency is explicit on every Money write; no default.

### F-100 — P0-financial-truth — `pettrek_trips` distance and duration columns store fare-relevant data as strings (`varchar` decimals)

- **Where:** `shared/schema.ts:5513`+. `actualDistance varchar`, `estimatedFare varchar`.
- **Current:** Distance for billing is parsed via `parseFloat` at completion (`routes/pettrek.ts:634-635`) — float math on a billing input. Surge billing on long trips drifts.
- **Should-be:** Integer meters / minutes; price computed via Money helpers.

### F-101 — P1 — `BookingService.calculatePricing` (legacy) does not apply VAT at all

- **Where:** `server/services/booking-service.ts:357-380`.
- **Current:** Returns `{ subtotal, platformFee, providerPayout, discount, total }` with `total = subtotal - discountAmount`. No VAT field. For groomers (F-G1) which uses this path, the booking row has no tax computed; a receipt issued at completion (if it ever happens) inherits VAT from the receipt issuer's recalculation.
- **Should-be (Part 5):** Single pricing engine that always returns VAT-inclusive + VAT-exclusive amounts.

### F-102 — P0-financial-truth — `super_app_payments` allows `metadata: jsonb` for free-form fields

- **Where:** `shared/schema.ts:8423`.
- **Current:** Per Part 2.2.2, `metadata jsonb` blob is forbidden as escape hatch for financial transactions.
- **Should-be (Part 2.2.2):** Typed columns only.

### F-103 — P0-financial-truth — `Math.ceil` rounding used for hourly walk billing

- See F-52 above; widening: walk-my-pet booking creation also rounds hours for pricing (`WalkPricingStrategy.calculateDurationHours:141-144`), and reading the duration back at completion uses `actualDuration` in minutes, raw. Customer was billed for ceiling hours; provider was paid for ceiling hours; the gap between actual and billed accumulates as platform margin (or loss on the provider side, depending on sign).

### F-104 — P0-illegal — Receipt issuance does NOT check whether SHAAM allocation number was successfully fetched

- **Where:** `IsraeliDigitalReceiptService.generateReceipt:316`. Comment says "shaamAllocationNumber is null until the SHAAM API integration is complete".
- **Current:** Receipts above the SHAAM threshold are issued without an allocation number. Per the Israeli digital invoice law (2026), this is illegal as of 1.1.2026 for amounts > ₪10,000 ex-VAT (and > ₪5,000 from June 2026).
- **Should-be (Part 1.3):** SHAAM API integration; receipts above threshold blocked until allocation number is obtained.
- **Owning Part:** Part 1.3.

### F-105 — P0-financial-truth — Booking creation does not capture customer payment method information

- **Where:** Sitter `routes/sitter-suite.ts:849-874`; walk `routes/walk-my-pet.ts:495-526`. The booking row has no `payment_method` reference at create time. Even when payment captures (sitter accept), the method is logged as the literal string `'Nayax Card Payment'` (`:1114`) without the card last 4, brand, or token reference.
- **Current:** Refund-to-source is impossible because the source isn't stored.
- **Should-be (Part 6 + Part 7):** Store tokenised payment method on booking; refunds route through the stored method.

---

## Appendix E — Spec impact: which Financial Core Parts are blocked

A summary view of which spec parts cannot land production code today. "Blocked" means at least one P0 finding requires the spec section to ship before code can be safely written.

| Part | Section | Blocked? | Top blocking findings |
|---|---|---|---|
| Part 0.1 | Role matrix | DECLARED — code drift on K9000/marketplace separation | F-09, F-30 |
| Part 0.2 | Revenue recognition | DECLARED — code does revenue at capture, not completion | F-48 |
| Part 0.3 | Liability boundaries | DECLARED — receipts misrepresent issuer | F-13, F-63 |
| Part 0.4 | Trust segregation | DECLARED — no trust account, commingling | F-WT4, R-7 |
| Part 0.5 | Provider Master Agreement | NOT DRAFTED — blocks Parts 4, 6, 8, 10 | F-01, F-26, F-31 |
| Part 0.6 | Tax invoice issuance | DECLARED — but no on-behalf-of branch | F-13, F-66 |
| Part 0.7 | VAT obligation | DECLARED — but VAT base wrong for promos | F-57, F-87 |
| Part 1 | Tax identity | NEEDS DRAFT | F-04, F-67, F-104 |
| Part 1.5 | Provider tax-profile snapshot | NEEDS DRAFT | F-29, F-87 |
| Part 2.1 | Money type | NEEDS DRAFT (already in Part 2 v1) | F-21, F-43, F-74-75 |
| Part 2.2 | Financial-transaction schema | NEEDS DRAFT | F-22, F-25, F-56, F-102 |
| Part 2.3 | Append-only ledger | NEEDS DRAFT | F-56, F-58, F-78, F-80 |
| Part 2.4 | Numbering authority | NEEDS DRAFT | F-23 |
| Part 2.5 | Locked-nine fields | NEEDS DRAFT | Appendix B |
| Part 3 | Wallet | NEEDS DRAFT | F-WT1-5, F-28, F-94 |
| Part 4 | Payouts | NEEDS DRAFT | F-01, F-26, F-29, F-36, F-37, F-61, F-83, F-84, F-96 |
| Part 5 | VAT engine | NEEDS DRAFT | F-14, F-43, F-48, F-52, F-53, F-57 |
| Part 6 | Refunds + credit notes | NEEDS DRAFT | F-10, F-24, F-31, F-54, F-81 |
| Part 7 | Acquirer integration | NEEDS DRAFT | F-02, F-12, F-17, F-18, F-105 |
| Part 8 | Escrow | NEEDS DRAFT | F-05, F-06, F-11, F-15, F-20, F-30, F-41, F-50, F-60, F-65 |
| Part 9 | Audit chain | NEEDS DRAFT | F-08, F-33, F-34, F-35, F-38, F-47, F-58, F-71, F-73, F-79, F-80 |
| Part 10 | Kill-switch + observability | NEEDS DRAFT | F-51, F-63, F-64 |

**Conclusion:** Every part of the Financial Core Architecture has at least one P0 blocker in current code. Parts 0 and 2 are the most-drafted; Parts 1, 4, 6, 7, 8, 9 have the most P0 entries waiting for them. None of these problems is solvable in code without spec sign-off.

---

## Appendix F — Glossary

- **Agent vs principal.** Per Part 0.1: agent (facilitator) does not own the goods/service; principal does. Pet Wash is agent for marketplace, principal for K9000.
- **Append-only ledger.** Per Part 2.3: every money fact is an INSERT; UPDATE/DELETE forbidden by trigger.
- **Capture.** Acquirer-side: take the auth and turn it into a settlement. Internally: write the captured amount into ledger.
- **Credit note (חשבונית זיכוי).** A negative invoice that references a positive invoice via `parent_txn_id`. The original invoice is never destroyed.
- **Escrow.** Funds held by Pet Wash on behalf of customer-and-provider until service completion. Part 8.
- **Idempotency.** Same operation called twice produces the same effect once. Part 2.5.1.
- **Locked nine.** Per Part 2.5: nine mandatory fields on every financial object.
- **Masav (מס"ב).** Bulk-credit clearing system used to pay providers in Israel. Part 4.
- **Money helper.** Single library of functions for arithmetic on the Money type. Part 2.1.4.
- **No-show fee.** Pet Wash takes a small fee from a customer auth when the customer doesn't show. Mad Paws / Wolt / Gett pattern.
- **Numbering authority.** Single service that allocates sequential, gap-free document numbers per channel × provider × document type. Part 2.4.
- **Osek murshe / Osek patur.** Authorized vs exempt dealer status under Israeli VAT.
- **Self-billing.** Pet Wash issues a tax invoice on behalf of the provider, sequenced from the provider's per-provider series. Part 0.6.2.a.
- **SHAAM (שע"ם).** Israeli Tax Authority's electronic system. Digital invoices register here. 2026 thresholds apply.
- **Trust funds.** Funds held by Pet Wash but legally owed to a customer or provider. Cannot fund operating expenses. Part 0.4.
- **Withholding (ניכוי מס במקור).** Source deduction from provider payouts under Israeli income-tax rules. Form 856 reports it annually.

End of appendix.

---

**(Document end — 1500+ lines of forensic findings as required by mandate. Severity-tagged findings: F-01..F-105. Edge cases (a)-(w): all addressed in the matrix in §3 and the deeper traces in Appendix A. Owning-Part assignments listed in §6 and consolidated in Appendix E.)**
