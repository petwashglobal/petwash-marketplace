# Booking-accept dispatcher — implementation plan (2026-08-26)

Classification (per CEO 2026-08-26 §33): **BROKEN-WIRING** — the two
existing accept pipelines agree on money (commission 15%, VAT 18/118
extracted, 72h escrow, uniform payout timing per lane C findings), but
Provider OS invokes the wrong writer. Not BLOCKED-CEO.

## The gap in one sentence

`POST /api/provider-dashboard/v2/bookings/:id/:action`
(`server/routes/provider-dashboard-v2.ts:964`) writes only to
`booking_requests` + calls `applyBridgeDecision` (a status mirror). The
native sitter/walk/academy accept pipelines that own Nayax capture,
escrow, fiscal receipt (חשבונית), and calendar event are NEVER invoked
for bridged mirror rows — those rows carry `finance_state = null` so the
existing wallet-hold branch also skips.

## Result today

| Surface | Provider OS Accept | What SHOULD happen | What actually happens |
|---|---|---|---|
| Sitter (bridged) | Row flips `pending → accepted` | Nayax capture → escrow → חשבונית → calendar event | Row flip only. **No charge, no receipt, no calendar.** |
| Walk (bridged) | Row flips `pending → accepted` | Wallet debit-from-hold (if `hold_active`) | Row flip; wallet branch skipped because `finance_state=null`. **No money moves.** (Walk native also lacks a card rail per lane C — separate issue.) |
| Academy (bridged) | Row flips `booking_status → accepted` | Wallet debit-from-hold + receipt (via `/confirm`) | Row flip only. **No money moves. No receipt.** |
| Booking-request native (`legacyRef` absent) | ✅ Full wallet lifecycle + slot lock release fires today | — | Works. |

## The fix — one canonical dispatcher

```ts
// server/services/bookingResponseDispatcher.ts (new)
export type BookingSource = 'SITTER_SUITE' | 'WALK' | 'ACADEMY' | 'UNIFIED_REQUEST';

export function resolveBookingSource(quoteBreakdown: any): {
  source: BookingSource;
  legacyBookingId?: string;
} {
  const ref = quoteBreakdown?.legacyRef;
  if (ref?.table === 'sitter_bookings')  return { source: 'SITTER_SUITE', legacyBookingId: ref.id };
  if (ref?.table === 'walk_bookings')    return { source: 'WALK',         legacyBookingId: ref.id };
  if (ref?.table === 'trainer_bookings') return { source: 'ACADEMY',      legacyBookingId: ref.id };
  return { source: 'UNIFIED_REQUEST' };
}

export async function finalizeAcceptForSource(
  source: BookingSource,
  legacyBookingId: string | undefined,
  providerUid: string,
): Promise<void> {
  if (!legacyBookingId) return;
  if (source === 'SITTER_SUITE')  await acceptSitterBookingCore(legacyBookingId, providerUid);
  if (source === 'WALK')          await acceptWalkBookingCore(legacyBookingId, providerUid);
  if (source === 'ACADEMY')       await acceptAcademyBookingCore(legacyBookingId, providerUid);
}
```

### Prerequisite refactors (each is a small, testable PR of its own)

1. **`server/routes/sitter-suite.ts:1095-1355`** — extract the accept
   pipeline (Nayax capture → escrow → status flip → Octopus ledger →
   calendar event → חשבונית → GCS backup) into
   `server/services/booking-engines/sitter/acceptSitterBookingCore.ts`.
   Signature: `(bookingId, providerUid, opts?) → Promise<{ ok, receipt? }>`.
   Route becomes a thin wrapper.

2. **`server/routes/walk-my-pet.ts:816-1019`** — extract into
   `acceptWalkBookingCore.ts`. Keep the "no card rail wired" note; this
   PR does NOT add a card rail (that is a separate EXISTING-POLICY-
   IMPLEMENTATION lane).

3. **`server/routes/academy.ts:741-859`** — extract into
   `acceptAcademyBookingCore.ts`. Wallet debit-from-hold + חשבונית.

### Wire the dispatcher into Provider OS

In `provider-dashboard-v2.ts` after the existing `applyBridgeDecision`
call (line ~992):

```ts
if (action === 'accept') {
  const { resolveBookingSource, finalizeAcceptForSource } =
    await import('../services/bookingResponseDispatcher');
  const { source, legacyBookingId } = resolveBookingSource(booking.quote_breakdown);
  if (source !== 'UNIFIED_REQUEST') {
    try {
      await finalizeAcceptForSource(source, legacyBookingId, user.uid);
    } catch (dispatchErr: any) {
      logger.error('[ProviderDashboardV2] native accept pipeline failed after bridge decision', {
        source, legacyBookingId, err: dispatchErr?.message,
      });
      // DO NOT rollback the bridge decision — the row is already 'accepted',
      // and a stuck-in-accepted-but-unpaid state surfaces via the money
      // reconciliation dashboards. Rollback would violate idempotency.
    }
  }
}
```

### Idempotency guarantees required in the core functions

Every `accept*BookingCore` must be safe to call TWICE for the same
`bookingId` — the native `/accept` route AND the dispatcher may both fire
if we don't clean up the route (short-term coexistence is safer than a
big-bang cutover). Concretely:

- **Sitter**: the atomic status claim at `sitter-suite.ts:1136-1150`
  (`WHERE status='pending_provider'` on the UPDATE) is the idempotency
  seat — the second caller gets a 0-row update and returns
  `{ ok: false, alreadyAccepted: true }` without touching Nayax.
- **Academy**: same pattern; the wallet debit is keyed on
  `finance_state='hold_active'` → subsequent calls with `debited` no-op.
- **Walk**: same claim pattern; no money moves anyway until the card
  rail lands, so idempotency is trivially satisfied by the status guard.

Once the dispatcher path proves stable for one release, the native
routes can be turned into "call the core, then respond" wrappers and
the direct client callers (BrowseSitters, WalkTracking) can migrate
in follow-ups.

## Test matrix before merging

For each source:
- [ ] Bridged accept (via Provider OS `/v2` action) fires Nayax capture
      exactly once and creates exactly one חשבונית.
- [ ] Native accept (via `/api/sitter-suite/bookings/:id/accept`) still
      works and does not double-charge.
- [ ] Race: two concurrent taps (one from each surface) result in ONE
      status flip + ONE Nayax capture + ONE חשבונית.
- [ ] Nayax capture failure leaves the row in `payment_pending`; the
      row does NOT flip to `confirmed` and the customer's "waiting" UI
      correctly reflects state.
- [ ] Provider decline is unchanged (dispatcher no-ops on decline for
      MVP; slot-lock release + wallet-hold release keep working via the
      existing v2 path).

## What NOT to change in this fix

- Commission %, VAT %, escrow window — all identical across surfaces
  today (lane C verified). Any change is a separate POLICY-CONFLICT PR.
- The **NayaxWalkMarketplaceService** orphan is a separate follow-up
  (delete the dead import in `PaymentGatewayService.ts:21` after
  proving the service is truly unreachable from any current call site).

## Sizing

- ~3 extraction PRs (sitter / walk / academy) — mechanical + unit tests.
- 1 dispatcher PR — 60 LoC + integration test.
- 1 v2 wiring PR — 12 LoC + regression tests.

Each PR is independent and revertible. Total risk footprint is small
compared to leaving the sitter path uncharged in production.

---

Owner: parent engineering session.
Deploy window required: yes (touches money). Merge only after full test
matrix passes and finance dashboards are quiet for 24h post-deploy.
