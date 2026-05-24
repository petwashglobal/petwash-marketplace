# Nayax VPOS Touch — draft device serials from operator photos

Owner extracted six serial numbers from photos of physical Nayax VPOS
Touch credit-card readers (intended for installation in PetWash
machines). **These are DRAFT values** — the operator must visually
verify each one against the device label before saving in the admin
panel. Photos can be ambiguous (mirrored, partially obscured, OCR-style
misreads of `0` vs `O` etc).

## Provider / model

| Field    | Value         |
|----------|---------------|
| provider | `nayax`       |
| model    | `VPOS Touch`  |
| status   | `in_stock`    |

## Draft serial numbers (verify before saving)

```
0434332725182400
0434332725182374
0434332725182403
0434332725182443
0434332725182462
0434332725182389
```

## Operator workflow

1. Go to `/admin/payment-devices` (admin UI, ships in next PR).
2. Click **Add device**.
3. Provider: `nayax`. Model: `VPOS Touch`.
4. Type each serial above into the form. Cross-check against the
   physical device label. Correct any digits that look wrong.
5. Optional fields (leave blank if unknown for now):
   - `part_number`
   - `nayax_terminal_id` (Nayax's own terminal id; you get this from
     Nayax dashboard after the device is provisioned in their system)
   - `sim_iccid`
   - `notes`
6. Click **Save**. The device lands in stock with status `in_stock`.
7. Later, when the device is installed in a PetWash machine, use the
   **Assign to machine** action on the device row — that writes an
   append-only row into `payment_device_assignments` and updates the
   device's status to `installed`.

## Safety notes

- Serial numbers are **private**. Never expose them in customer-facing
  UI or in unauthenticated API responses. The admin routes are gated
  by `requireAdmin + requireMfaEnrolled`.
- The `payment_device_assignments` history table is **append-only** at
  the DB level (trigger blocks UPDATE/DELETE). Even an admin cannot
  rewrite history. This is intentional for warranty / dispute / audit
  traceability.
- This system is **stock + asset tracking only**. It does NOT change:
  - Nayax payment runtime (`NayaxOnlinePaymentService`, webhooks)
  - K9000 polling or machine commands
  - Wallet credits / debits
  - Payment session lifecycle
- Linking a device to a machine is metadata only. The Nayax terminal
  still talks to the K9000 the same way as before.

## Next milestones (separate PRs)

- **PR-2**: Admin UI at `/admin/payment-devices` (list, add, edit,
  assign, history) — Hebrew/English, premium luxury aesthetic.
- **PR-3** (later, if Nayax API/webhooks are wired): when a Nayax
  webhook arrives, look up the terminal by `nayax_terminal_id` and
  update `last_seen_at` on the device row. Read-only visibility into
  payment runtime — never changes payment behaviour.
- **PR-4** (later): warranty / SLA reporting based on
  `payment_device_assignments` history.
