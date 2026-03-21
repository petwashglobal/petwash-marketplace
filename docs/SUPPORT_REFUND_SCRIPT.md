# PetWash Support — Manual Wallet Refund Procedure

> For use by support agents and on-call engineers only.
> Never run raw SQL updates against `wallets` or `wallet_ledger` without going through the API.

---

## When to use this procedure

Use this when:
- A booking was cancelled but the wallet hold was not released automatically
- A customer was incorrectly double-charged
- A booking was debited but the service was not delivered (provider no-show)
- Support has confirmed the refund is valid and has manager approval

---

## Step 1 — Identify the booking

Run the user wallet audit endpoint to get the full picture:

```bash
curl -s "https://petwash.co.il/api/prestige-pass/admin/wallet/user-audit?userId=<FIREBASE_UID>" \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Or use the Admin Wallet Dashboard → Audit tab → User Wallet Audit panel.

Note:
- `wallet.cashCents` — current available cash balance
- `wallet.pendingCents` — currently held by active bookings
- `bookingSummary` — breakdown by finance_state
- `ledger` — last 200 transactions

---

## Step 2 — Look up the specific booking

**Walker / Sitter booking:**
```sql
SELECT request_id, owner_id, service_type, status, finance_state,
       wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents,
       wallet_hold_key, wallet_debit_key, wallet_release_key, wallet_refund_key,
       created_at, updated_at
FROM booking_requests
WHERE request_id = '<BOOKING_ID>';
```

**Academy booking:**
```sql
SELECT booking_id, user_id, booking_status, finance_state,
       wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents,
       wallet_hold_key, wallet_debit_key, wallet_release_key, wallet_refund_key,
       created_at, updated_at
FROM trainer_bookings
WHERE booking_id = '<BOOKING_ID>';
```

---

## Step 3 — Determine the correct action

| Scenario | Current `finance_state` | Correct action |
|---|---|---|
| Hold stuck, booking never confirmed | `hold_active` | Release hold |
| Service completed, customer disputing | `debited` | Refund from debit |
| Service cancelled before start | `hold_active` | Release hold |
| Hold already released, re-opened by error | `released` | Investigate first |
| Already refunded | `refunded` | Do not refund again |

---

## Step 4a — Release a stuck hold (no debit yet)

Use when `finance_state = hold_active` and the booking should be cancelled.

**Walker / Sitter:**
```bash
curl -X POST "https://petwash.co.il/api/bookings/<REQUEST_ID>/cancel" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "support_manual_cancel", "agentId": "<AGENT_EMAIL>"}'
```

The cancellation handler calls `walletService.releaseBookingHold()` automatically.

If the cancellation endpoint is unavailable, use the wallet admin refund endpoint directly:

```bash
curl -X POST "https://petwash.co.il/api/prestige-pass/admin/wallet/release-hold" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<FIREBASE_UID>",
    "bookingId": "<REQUEST_ID>",
    "amountCents": <HOLD_AMOUNT_IN_AGOROT>,
    "reason": "manual_support_release",
    "agentId": "<AGENT_EMAIL>"
  }'
```

---

## Step 4b — Refund a completed debit

Use when `finance_state = debited` and the service was not delivered or a refund is approved.

```bash
curl -X POST "https://petwash.co.il/api/prestige-pass/admin/wallet/refund" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<FIREBASE_UID>",
    "bookingId": "<REQUEST_ID>",
    "amountCents": <REFUND_AMOUNT_IN_AGOROT>,
    "reason": "service_not_delivered",
    "agentId": "<AGENT_EMAIL>"
  }'
```

> Partial refunds are supported — set `amountCents` to less than `wallet_debited_cents`.
> Full refund: set `amountCents` equal to `wallet_debited_cents`.

---

## Step 5 — Verify the refund landed

Run the user audit again after the refund:

```bash
curl -s "https://petwash.co.il/api/prestige-pass/admin/wallet/user-audit?userId=<FIREBASE_UID>" \
  -H "Authorization: Bearer <admin-token>" | jq '.wallet.cashCents, .wallet.pendingCents, .ledger[0]'
```

Confirm:
- `cashCents` increased by the refund amount
- `pendingCents` decreased (if it was a hold release)
- The latest ledger entry is the refund with the correct idempotency key

---

## Step 6 — Log the action

Record in the support ticket:
- Booking ID
- User ID
- Amount refunded (in ILS, e.g. "₪45.00")
- Reason code
- Agent who approved
- Timestamp of refund
- Before/after `cashCents` balance

---

## Important rules

1. **Never run direct SQL `UPDATE` on `wallets`** — always use the API. The API enforces idempotency keys, ledger writes, and audit trail.
2. **Partial refunds only go to `cash_wallet`** — promo and referral buckets are non-refundable.
3. **50% cap does not apply to refunds** — the full debited amount can be refunded regardless of division.
4. **Idempotency** — if the same refund endpoint is called twice with the same booking ID, the second call is a no-op. Safe to retry.
5. **Manager approval required** for any refund above ₪500.

---

## Quick reference — amount conversion

| ILS | Agorot (cents) |
|---|---|
| ₪10.00 | 1000 |
| ₪45.50 | 4550 |
| ₪100.00 | 10000 |
| ₪250.00 | 25000 |

Formula: `amountCents = Math.round(ILS * 100)`
