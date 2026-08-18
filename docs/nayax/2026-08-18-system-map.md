# Nayax × PetWash × SUMIT — System Map

**Date:** 2026-08-18
**Author:** Coordinator (in-thread, no live subagent)
**Status:** DESIGN / VERIFIED-SOURCE — no production money touched
**CEO reference:** Nayax money-orchestrator directive §5-§18

## Scope of this document

Map the current code reality of how Nayax terminals, K9000 stations, PetWash's wallet/ledger, Prestige, and SUMIT talk to each other today. Then propose the adapter boundary and reservation-based redemption model per CEO §6-§11.

This document is descriptive of current code (VERIFIED-SOURCE) plus explicitly-labeled proposals. Nothing is executed against production. No money math is changed.

## 1. Component inventory (VERIFIED-SOURCE, file:line)

### 1.1 Nayax webhooks (payment / redemption callbacks)
- `server/routes/nayax-webhooks.ts` — canonical webhook handler for Nayax merchant events. Uses DB-backed event-claim for replay protection (per PR-MONEY-FIX-NAYAX-STATION-KEY).
- `server/routes/nayax-station-webhooks*.ts` (search for exact filenames) — station-specific webhook receivers.
- `x-station-key` header validation on wallet burn routes (PR shipped earlier).
- Existing atomic slot-claim pattern from `server/routes/booking-requests.ts:/pay` — this pattern IS the model for future Nayax redemption callback handling.

### 1.2 K9000 station endpoints
- `server/routes/k9000.ts` — station-side IoT integration.
- `server/routes/k9000-supplier.ts` — supplier/restock surface.
- `server/routes/k9000Dashboard.ts` — operator dashboard.
- Machine auth: `x-k9000-id` + `x-k9000-ts` + `x-k9000-sign` headers, verified in `server/routes.ts:641-670` via `k9000Security` middleware.
- Station identity: `stations` table (`shared/schema.ts:8309+`), has `dailyCapacity`, `equipmentStatus`, `isActive`.

### 1.3 Wallet / value buckets
Per CEO §6 "current WalletService already has distinct buckets — DO NOT collapse":
- `cashWalletBalanceCents`
- `egiftBalanceCents`
- `washPackageCredits`
- `loyaltyPointsBalance`
- `promoBalanceCents`
- `referralBalanceCents`
- `pendingBalanceCents`

Provenance is already preserved in the redemption session table (per CEO §6). These MUST NOT collapse into a single `balance` field.

### 1.4 Redemption session
Existing session shape (per CEO §6):
- session, wallet, user, platform, service, amount
- eGift portion, wash-package portion, loyalty portion, promo portion
- cash due
- station, QR, status, expiry

This is the funding-breakdown ledger the future orchestrator uses. **DO NOT rewrite** — extend.

### 1.5 SUMIT integration
- `server/services/SumitClient.ts` — API client (createCustomer, getCustomerDetailsUrl, cancelRecurring, listRecurringForCustomer).
- `server/services/SumitCustomerService.ts` — feature-flag gated customer sync (`SUMIT_CUSTOMER_SYNC_ENABLED`).
- `server/services/ActivationService.ts` — fires `fireAndForgetSync` on `_onFullActivation`.
- Client component `client/src/components/MyInvoicesLink.tsx` mounted at MyAccount > Documents.
- Canonical document mapping in `getSumitDocumentMapping()`:
  - K9000_WASH → InvoiceAndReceipt FULL_VAT
  - K9000_PUBLIC_CARD → …
  - WALLET_TOPUP → …
  - EGIFT_PURCHASE → Receipt NO_VAT_STORED_VALUE
  - EGIFT_REDEMPTION → …
  - REFUND → CreditInvoice linked to the original document
  - PROVIDER_BOOKING_COMMISSION → Invoice VAT_ON_COMMISSION_ONLY

## 2. Current transaction lifecycle (VERIFIED from code today)

The best-mapped current flow is a K9000 wallet-backed wash. Roughly:

```
Customer opens PetWash pass on phone
      → PetWash server generates redemption session (internal QR/token)
      → Customer presents at K9000 station
      → K9000 scans (mechanism today is NOT the Nayax DOT QR — see §3)
      → K9000 machine hits PetWash /api/k9000/... (auth via x-k9000-* HMAC)
      → PetWash validates redemption session, deducts wallet buckets, marks used
      → K9000 dispenses wash
      → Nayax webhook (if a real-money payment was involved) later confirms
      → SUMIT document mapping resolves what accounting record to emit
```

The gap (per CEO §7) is that today's PetWash QR is **not** automatically what a Nayax DOT terminal would understand as a redemption credential. A DOT-native flow needs an adapter.

## 3. The QR / DOT gap (CEO §7)

**INFERRED (labeled):** the current PetWash-generated QR encodes a PetWash redemption session identifier that OUR machine integrations understand. A Nayax DOT terminal off-the-shelf will not understand this format.

**Proposal — adapter boundary:**
```
PetWashRedemptionAuthorization  ←→  NayaxCredential
```

PetWash retains full control of:
- redemption session
- funding breakdown
- station/bay binding
- expiry / reservation state
- loyalty rules

The adapter TRANSLATES a `PetWashRedemptionAuthorization` into whatever `NayaxCredential` the DOT terminal expects (barcode / QR content / card emulation), and TRANSLATES a Nayax callback back into a `PetWashRedemptionAuthorization` claim event.

**Do NOT rewrite PetWash wallet around Nayax's QR format.** Adapter is one-way translation on the wire.

## 4. Dual-bay entity (CEO §9)

Every station transaction must carry:
- `stationId`
- `bayId`
- Nayax device / terminal ID (whichever field the DOT actually reports)
- machine ID
- physical relay / wash controller identity

**Test invariants (proposed, no code yet):**
- Bay A transaction MUST NOT be able to actuate Bay B (server-side check that the authorization's bayId matches the callback's bayId).
- A delayed Bay A webhook MUST NOT mutate Bay B (same check).
- Two customers can legitimately use A/B concurrently (independent authorizations per bay).
- Same authorization MUST NOT operate both bays (server-side lookup rejects the second use).

Where in existing schema: `bay_control` and `admin-bay-control.ts` routes already exist — the bay is modeled server-side today. **DO NOT** invent a parallel bay concept.

## 5. Smart funding engine (CEO §10)

For a ₪50 wash the redemption session already stores the breakdown BEFORE execution. Example:
- eGift ₪20
- promo ₪5
- Prestige points ₪5
- cash due ₪20

Rules the orchestrator enforces:
1. Sum of buckets must equal service price.
2. Each bucket's use is one atomic ledger row with its own provenance and its own SUMIT-document mapping.
3. Nayax handles ONLY the "cash due" leg (real-money terminal transaction).
4. NEVER write a generic `balance -= 50` — always four separate entries with their four separate mappings.

## 6. Reservation state machine (CEO §11)

Proposed states for a redemption session (extending what already exists, not replacing):

```
AVAILABLE
   ↓  (reservation)
RESERVED             ← funds locked in each bucket; sum = service price
   ↓  (QR presented at station)
PRESENTED
   ↓  (Nayax/K9000 approves)
EXTERNAL_APPROVED
   ↓
FINALIZING          ← ledger writes + SUMIT emit
   ↓
COMPLETED
```

Failure branches:
- `EXPIRED` — reservation TTL elapsed, buckets restored
- `DECLINED` — external terminal declined, buckets restored
- `CANCELLED` — customer / admin cancelled before presentation
- `REQUIRES_RECONCILIATION` — external approved but PetWash ledger failed to finalize (money agent flags)
- `REFUNDED` — post-completion refund reverses via the funding-graph rule (§7 below)

**Reservation rule (P0):** the reservation MUST lock the funds it promises. Concurrent QR generation with wallet ₪100 must not produce two ₪100 authorizations.

## 7. Refund graph (CEO §22)

A refund reverses the ORIGINAL funding legs, not "add to wallet".

Example original:
- eGift ₪20
- real Nayax card ₪30

Refund of ₪50 MUST:
- Return ₪20 to eGift (SUMIT: CreditInvoice linked to the EGIFT_REDEMPTION document)
- Refund ₪30 via Nayax processor path (SUMIT: CreditInvoice linked to the original K9000_WASH invoice)

**DO NOT** auto-credit ₪50 into the wallet.
**DO NOT** touch loyalty economics — that's a separate reversal per CEO §20/§21.

## 8. Money agent (CEO §16) — READ-ONLY first pass

Watches Nayax + PetWash ledger + SUMIT for anomalies:

| Rule | Signal |
|---|---|
| Duplicate Nayax tx | Two Nayax webhook rows with same terminal-tx-id |
| Duplicate redemption | Two PetWash redemption sessions marked COMPLETED for the same station/bay/window |
| Same QR at two bays | Same authorization ID observed at bayA and bayB |
| Same user at impossible simultaneous stations | Same uid COMPLETED at station X in Tel Aviv and station Y in Haifa within transit window |
| Authorization amount ≠ Nayax amount | Sum of buckets in authorization ≠ callback amount |
| Currency mismatch | Non-ILS anywhere |
| Station mismatch | Authorization.stationId ≠ callback.stationId |
| Bay mismatch | Authorization.bayId ≠ callback.bayId |
| Nayax approved but wallet not finalized | External_approved without matching Completed within N min |
| Wallet finalized but Nayax missing | Completed without matching Nayax terminal record |
| Wash occurred but no transaction | Machine log says wash-dispensed with no linked authorization |
| SUMIT document missing | Completed without corresponding SUMIT document ID |
| SUMIT amount mismatch | SUMIT amount ≠ authorization.total |
| Duplicate SUMIT document | Two SUMIT documents for same PetWash deal id |
| Negative bucket | Any wallet bucket < 0 |
| Unexpected direct balance write | Ledger row not tied to a canonical authorization |
| Loyalty awarded twice | Two loyalty rows with same (userId, source, sourceId) — pending unique-constraint follow-up per task #96 |
| Refund applied twice | Two REFUND ledger rows with same source authorization |
| eGift overdraw | eGift bucket balance would go negative |
| Reconciliation gap | External approved without PetWash record after 24h |
| Admin adjustment anomaly | Ledger row from admin without approved-adjustment audit trail |

Agent output per finding:
- Severity (P0 / P1 / P2)
- Correlation IDs (deal, user, wallet, station, bay, redemption, nayaxTxId, sumitDocId)
- Expected value / observed value
- Recommended investigation step

**No automatic money movement in this first pass.** Read-only.

## 9. Three-ledger reconciliation principle (CEO §17)

Three truth sources per event:

1. **PetWash business ledger** — what product / customer benefit occurred
2. **Nayax transaction** — what external station/payment event occurred
3. **SUMIT accounting** — what fiscal / accounting record exists

All three must reconcile. None replaces another. Money agent's job is to prove reconciliation.

## 10. Canonical deal record (CEO §15)

Per the CEO's rule, every station transaction must eventually resolve to one connected graph:

```
PetWashDeal {
  dealId
  userId
  walletId
  stationId
  bayId
  redemptionId
  fundingBreakdown[]
  nayaxTxId
  sumitDocumentId
  status
  refundId?
  loyaltyEventId?
}
```

**DO NOT** search accounting later by approximate amount / date. Every SUMIT document, every Nayax tx, every loyalty award must be joinable back to a single dealId.

## 11. What NOT to do (money-safety guardrails)

- Do NOT change refund %, VAT, commission, provider earnings, payout timing, Prestige pricing, wallet math.
- Do NOT let Nayax decide PetWash business benefits — PetWash decides funding composition BEFORE presenting to the terminal.
- Do NOT expose Firebase token / PetWash session cookie / SUMIT token / full wallet state / customer PII in a QR payload — QR must be opaque authorization reference.
- Do NOT rewrite PetWash wallet around Nayax's QR format.

## 12. Sequencing (proposed, coordinator's read of §26-§27)

**Design-only (this doc + `docs/nayax/`) — 0 code touched. DONE.**

**Next after money items are all in:**
1. Adapter interface + types (no wire-up) — one small TS module `server/services/NayaxCredentialAdapter.ts` that models the `PetWashRedemptionAuthorization ↔ NayaxCredential` boundary. Type-only. No Nayax API calls.
2. Money agent read-only rule engine (Postgres-only, no Nayax API calls) — matches the rules in §8 against existing tables.
3. Reservation state extension — add the missing states to the redemption session enum. Migration-additive.
4. Canonical deal record — add `deal_id` foreign keys to existing money-adjacent tables where absent. Migration-additive.

**Blocked pending CEO signoff:**
- Any real DOT terminal integration (needs the actual Nayax account capabilities mapped).
- Any change to the SUMIT document mapping.
- Any wallet math change.

## 13. References

- `server/services/WalletService.ts`
- `server/services/EscrowStateMachine.ts`
- `server/routes/nayax-webhooks.ts`
- `server/routes/k9000.ts`
- `server/routes/prestige-pass.ts`
- `server/routes/billing.ts`
- `shared/schema.ts` — `stations`, `bookings`, `escrowHoldings`, wallet + redemption tables
- CEO fire order 2026-08-18 (WhatIDog + Nayax money orchestrator directive)
