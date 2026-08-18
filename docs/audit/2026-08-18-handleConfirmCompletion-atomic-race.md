# 2026-08-18 — handleConfirmCompletion atomic-transition race (BLOCKED-CEO)

**Status:** BLOCKED — money-code change; awaiting explicit CEO approval to land.
**File:** `server/routes/booking-requests.ts`
**Handler:** `handleConfirmCompletion` (line ~2798, mounted on both `POST /:requestId/confirm` and `POST /:requestId/approve-completion`).
**Class:** Idempotency defect + potential double-payout.

## The race

The handler does:

```
1.  SELECT booking WHERE requestId=... LIMIT 1                    (line 2804)
2.  Assert booking.status === 'provider_marked_complete'          (line 2817)
3.  createEarningRecord(...)                                      (line 2851)
4.  EscrowService.releaseEscrowPayment(...)                       (line 3258)
5.  writeBookingLedgerEntries(...)                                (line 3273)
6.  VATCalculatorService.recordTransactionFromGross(...)          (line 3345)
7.  IsraeliDigitalReceiptService.generateReceipt(...)             (line 3375)
8.  UPDATE bookingRequests SET status=finalStatus, ownerConfirmedAt=..., paymentReleasedAt=...  (line 3294)
    ← WHERE requestId=X   (NO status guard)
```

The UPDATE at step 8 has no `WHERE status='provider_marked_complete'` guard.
So two concurrent `/confirm` requests from the same authenticated owner (double-tap
on the customer's Confirm button before the button-disable state propagates, retry
after a network hiccup, or a burst from an out-of-order re-tap on top of an
ongoing request) can both pass the SELECT-side status check, then both proceed
through steps 3–8.

## Blast radius

Per money-invariants §2 several downstream steps ARE idempotent:
  - `createEarningRecord` — no unique constraint pre-checked; Drizzle would insert
    two earning rows unless the schema has a unique constraint (not verified).
  - `EscrowService.releaseEscrowPayment` — has an internal exactly-once guard
    per escrow ID (audit-verified 2026-06-24 finding).
  - `IsraeliDigitalReceiptService.generateReceipt` — has its own exactly-once
    guard (comment at line 3364 confirms).
  - `writeBookingLedgerEntries` — fail-soft, not asserted idempotent.
  - `VATCalculatorService.recordTransactionFromGross` — not asserted idempotent.

**Worst-plausible case:** duplicate `contractorEarnings` row → provider paid twice for
the same booking. Duplicate ledger + duplicate VAT entries → misstated financials.

## Fix (single-line, defensive)

Change the UPDATE at line 3294 from:

```
await db.update(bookingRequests)
  .set({ status: finalStatus, ... })
  .where(eq(bookingRequests.requestId, requestId));
```

to a conditional UPDATE that ALSO gates on the source status, using RETURNING
so we know whether we won the race:

```
const [updated] = await db.update(bookingRequests)
  .set({ status: finalStatus, ownerConfirmedAt: now, ... })
  .where(and(
    eq(bookingRequests.requestId, requestId),
    eq(bookingRequests.status, 'provider_marked_complete'),
  ))
  .returning({ id: bookingRequests.id });

if (!updated) {
  // Lost the race — another concurrent /confirm already promoted this row.
  // Roll back the just-created earning + escrow release + ledger write via
  // reverseEarningRecord() / cancelEscrowReleaseIfDuplicate() / etc.
  // OR safer: do the UPDATE FIRST (conditional, with RETURNING), and only
  // then perform the money-flowing side effects. Any of these designs is
  // acceptable — CEO to pick the shape.
  return res.status(409).json({ error: 'BOOKING_ALREADY_CONFIRMED' });
}
```

The cleaner shape is to reorder: put the conditional-UPDATE FIRST, then do
money side effects only when the UPDATE reports a row was actually flipped.
That way we never take money actions on a lost race.

## Why this is BLOCKED-CEO

  1. Reordering + conditional-UPDATE is money-critical code — CEO must sign off
     on the sequence change per standing directive.
  2. Rollback semantics on the earning-record side (if we keep the current order)
     touch payoutLedger, which is money-critical.
  3. Adds a new client-visible 409 response — customer's confirm button UX needs
     a paragraph explaining "another confirmation already in flight" (should be
     transparent — most double-taps happen in <300ms, so the second call losing
     with 409 is the CORRECT outcome).

## Test that would prove the fix

Postgres fixture test that spawns two concurrent /confirm requests against the
same booking, then asserts:
  - Exactly ONE finalStatus transition happened
  - Exactly ONE contractorEarnings row was created
  - Exactly ONE VAT ledger entry was recorded
  - The second call returned 409 (or 200 idempotently — pick one)

Same shape as `server/tests/v2-complete-and-escrow-gate.test.ts` — see it for
the fixture pattern.

## Adjacent guardrails already shipped (this same handler)

  - PR #1904 — explicit 401 + zod input validation (rating 1..5, review ≤ 2000)
  - PR #1911 — sibling routes hardened for auth-slippage
  - PR #1912 — GET /:requestId 401 sweep
  - PR #1914 — client-side rating clamp

Landing the atomic-UPDATE fix on this same handler is the natural next step.

## Awaiting

Explicit CEO approval to touch the money path. Once approved, this doc becomes
the change spec for the follow-up PR.
