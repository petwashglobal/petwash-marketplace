# PetWash Platform Completeness Matrix — 2026-08-27

CEO 2026-08-27 §37. One matrix, one truth per platform × capability. This
document is authoritative for the state of each vertical at the end of the
current wire-only sweep. Update whenever a cell flips.

Legend:
- ✅  live end-to-end (route, service, tests, UI where applicable)
- 🟡  built but wire-blocked (dependency named in the note)
- ⚠️  partial — see note
- ❌  not started
- —   not applicable to this platform

## Capabilities × Platforms

| Capability                     | SHOP | K9000 | EGIFT | WALLET | SITTER | WALK | ACADEMY | PETTREK |
|--------------------------------|:----:|:-----:|:-----:|:------:|:------:|:----:|:-------:|:-------:|
| JobPassport                    |  🟡  |  🟡   |  🟡   |   —    |   ✅   |  ✅  |   ✅    |   ⚠️    |
| TransactionPassport            |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ⚠️  |   ✅    |   ✅    |
| Provider / fulfiller resolver  |  ✅  |  ✅   |   —   |   —    |   ✅   |  ✅  |   ✅    |   ✅    |
| Payment authority              |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ❌  |   ✅    |   ✅    |
| Funding legs (multi-rail)      |  ⚠️  |  ⚠️   |  ✅   |   ✅   |   ⚠️   |  ❌  |   ⚠️    |   ⚠️    |
| SUMIT fiscal document mapping  |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ❌  |   ✅    |   ✅    |
| Customer receipt UI            |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ✅  |   ✅    |   ✅    |
| Refund lineage                 |  ✅  |  ✅   |  ✅   |  ✅    |   ✅   |  —   |   ✅    |   ✅    |
| Handoff (issue / verify)       |  ✅  |   —   |   —   |   —    |   ✅   |  ✅  |   ✅    |   🟡    |
| Review                         |  ✅  |   —   |   —   |   —    |   ✅   |  ✅  |   ✅    |   ⚠️    |
| Reconciliation warnings        |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ⚠️  |   ✅    |   ✅    |
| Customer UI                    |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ✅  |   ✅    |   ⚠️    |
| Provider UI                    |   —  |   —   |   —   |   —    |   ✅   |  ✅  |   ✅    |   ⚠️    |
| Admin UI                       |  ✅  |  ✅   |  ✅   |   ✅   |   ✅   |  ✅  |   ✅    |   ✅    |
| E2E (Playwright)               |  ✅  |  ✅   |  ✅   |   ⚠️   |   ✅   |  ✅  |   ⚠️    |   ✅    |

## What changed since 2026-08-27 first draft

Six cells advanced in the subsequent sweep:

- **SHOP × Handoff** 🟡 → ✅ (`0b804422d`) HandoffPinTile mounted on
  ready-to-collect shop orders.
- **SHOP / K9000 / EGIFT / WALLET / SITTER / ACADEMY × Refund lineage**
  ⚠️ → ✅ (`5d33b422a`, `c091d10fd`) composeRefundLineage was
  querying nonexistent columns and using the wrong source_type
  taxonomy. Real bug: every refund lineage was silently returning
  empty. Fixed to use refund_transactions' actual schema + the
  RefundService taxonomy.
- **SITTER / WALK × E2E** ⚠️ → ✅ (`4e91032bb`) Playwright spec covers
  the shared list + shop detail path with fixtures that pin the §24
  discipline (walk = NOT_REQUIRED, never silently PAID).
- **WALK × Admin UI** ⚠️ → ✅ (`f53bf0724`) AdminTransactionExplorer
  works for every source including walk_bookings.
- **All platforms × Admin UI** flipped up (`f53bf0724`) — the dedicated
  admin explorer at /admin/fiscal-transactions/:source/:sourceId now
  renders every fiscal transaction along the eight §16 axes with
  inline reconciliation warnings.
- **PETTREK column** — first pass (`fc861f6fc`). composePettrekFiscal
  wired via 'pettrek_trips' source hint. Transaction / Payment /
  Provider / SUMIT / Refund / Reconciliation / Customer receipt /
  Admin UI cells all flip up. Remaining ⚠️: multi-rail funding legs,
  reviews, customer + provider dashboards under
  client/src/pages/pettrek/* (unrouted per orphan report v4 — separate
  cleanup PR). Handoff purpose='PETTREK_PICKUP' + 'PETTREK_DROPOFF'
  will land when the driver-side UI ships.

## Notes

### SHOP
- JobPassport: adapter shipped in the composer but shop_orders don't yet
  surface a jobRef in the customer UI. TransactionPassport is complete.
- Funding legs: today shop is card-only via SUMIT. Multi-rail (eGift +
  card + wallet) is the universal-eGift lane § 24-26 — CEO gate.
- Handoff PIN issue exists for shop pickup (SHOP_PICKUP purpose) but no
  UI mounts it yet — same infra as sitter/walk, just no BookingConfirmed
  branch renders the tile for a shop pickup.

### K9000
- JobPassport: K9000 wash events surface as jobs via the composer.
  jobRef → bookingId reverse index (§60 Phase 2) still pending.
- Funding legs: multi-rail supported by the K9000RedemptionService but
  MARKETPLACE_EGIFT_FISCAL_ACTIVATION not yet green.
- Refund lineage: partial — refund_transactions table is 42P01 in
  fresh envs, so lineage returns empty. Adapter is READ-ONLY safe.

### EGIFT
- Reservation write path (§22) shipped as `egiftReservationService.ts`
  with atomic AVAILABLE→RESERVED→COMMITTED/RELEASED. No commercial flow
  consumes it yet — CEO gate.
- Customer §31 tile ships: Available / Reserved / Redeemed / Restored
  visible on `/account/transactions/egift_guest_orders_purchase/:id`.
- Balance projection derived from ledger + open reservations.

### WALLET
- Wallet-topup passport shipped with real Nayax + wallet ledger hints
  passed to reconciliation.
- Refund lineage partial: no chargeback path exists on wallet-topup
  today.

### SITTER
- JobPassport ✅ (fully composed, all axes).
- Provider commission lineage now real (`composeProviderCommissionLineage`
  wired). §22 literal-equality gates.
- Handoff PIN customer + provider UI live.

### WALK
- **Payment authority: ❌.** §24 — walk today has no payment rail; the
  composer honestly reports `paid=false`. No fiscal document required.
- TransactionPassport: partial for this reason.
- Cutover to `acceptWalkBookingCore` still blocked on PAYMENT_RAIL_MISSING.

### ACADEMY
- Trainer bookings pass through the composer with `paymentIntentId` for
  Stripe/SUMIT. All axes ✅ except funding-legs breakdown.

### PETTREK
- ⚠️ across the board. Driver/customer dashboards exist under
  `client/src/pages/pettrek/` but are not routed from App.tsx
  (orphan-detector v2 caught this — see docs/audit/orphan-report-2026-08-27.md).
- Composer branch not written.
- Reviews + reconciliation not started.

## Wire-blocked gates (do not activate without CEO sign-off)

- `MARKETPLACE_EGIFT_FISCAL_ACTIVATION` — universal eGift as a funding
  source across marketplace bookings. Encoded in
  `server/services/sumitDocumentMapping.ts` via
  `getFundingAwareSumitMapping()` — callers may PREVIEW the mapping but
  the money paths must not act on it until CEO clears.
- `BOOKING_ACCEPT_DISPATCHER_ENABLED` — new booking-response
  dispatcher flow (`BookingResponseDispatcher.ts`) supersedes the
  legacy accept/decline path. Flag ships false.

## Follow-up backlog

- Refund exact-original-legs (§27) — currently the passport carries
  `amountRefundedCents` at the aggregate level; per-leg reversal
  (`eGift ₪20 restored + card ₪80 refunded`) needs an adapter.
- PetTrek composer branch — currently ❌; §37 says no blank cells for
  active platforms once launched.
- Admin transaction passport — currently reuses the customer passport
  with staff-level projection (`viewFor.showsExternalIds=true`).
  Dedicated admin explorer with inline reconciliation warnings per §16
  would surface the SUMIT/Nayax/wallet mismatches in one place.
- E2E specs for WALLET / SITTER / WALK / ACADEMY — Playwright entries
  exist but haven't been wired to the fiscal-passport surfaces added
  this sweep.
