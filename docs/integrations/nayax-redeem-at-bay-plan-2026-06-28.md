# K9000 Redeem-at-Bay — verified Nayax wiring plan (2026-06-28)

**Source of truth:** Nayax Developer Portal, read live via the Nayax MCP + the
official `nayax-lynx-*` skills (installed #1151). Every endpoint/field below is
quoted from Nayax's own Cortina Static-QR reference — not assumed. This resolves
the year-long "START_PUMP has no API" blocker (task #9).

## The model (plain)
A customer pre-pays online (wallet / eGift / wash-package) → that balance lives on
**our** server. At the K9000 they scan a QR; the machine starts the wash **without
a second charge**, and we settle it against their balance. If the wash fails, it's
auto-voided and they keep their credit.

PetWash plays the **Cortina Static-QR "Integrator"** role — i.e. Nayax treats us
as the payment authority for these pre-paid customers. We expose 3 inbound
callbacks; we make 1 outbound call.

## The verified flow
```
1. Customer pre-pays online            → balance on our server (wallet/eGift/package)
2. App scans the bay QR / machine no.
3. OUR backend → POST /Cortina/{integratorName}/start   (we initiate)
       body: AppUserId, Balance, Products[], SecretToken, TerminalId|UniQR, TransactionId
   Nayax wakes the device.
4. NAYAX → POST  (our) /api/nayax/cortina/sale          (Nayax asks us to authorize)
       body: BasicInfo{Amount, CurrencyCode, TransactionId}, MachineInfo{Id}, DeviceInfo
   → we check the customer's balance, HOLD the amount, respond APPROVED.
5. Wash starts. On success:
   NAYAX → POST  (our) /api/nayax/cortina/settlement     (final amount)
   → we CAPTURE: debit the pre-paid balance exactly once, issue the SUMIT receipt.
6. On dispense failure / timeout:
   NAYAX → POST  (our) /api/nayax/cortina/void
   → we RELEASE the hold: customer keeps their credit. No charge.
```

## Exact endpoint contracts (verified)
| Direction | Endpoint | Who calls | Key fields |
|---|---|---|---|
| Outbound | `POST /Cortina/{integratorName}/start` | **we call Nayax** | `AppUserId` (our customer id, ≤40), `Balance` (their pre-paid balance, decimal ≤3dp), `SecretToken` (64-char, Nayax-issued, **secret**), `TerminalId` **or** `UniQR` (the machine), `TransactionId` (our id, ≥8 chars, echoed everywhere) |
| Inbound | `POST /Cortina/StaticQR/Sale` | **Nayax calls us** | `BasicInfo.Amount`, `BasicInfo.CurrencyCode` (ILS), `BasicInfo.TransactionId`, `MachineInfo.Id` (virtual machine id → our bay), `DeviceInfo.HwSerial` |
| Inbound | `POST /Cortina/StaticQR/Settlement` | **Nayax calls us** | final `BasicInfo.Amount` + `TransactionId` → capture |
| Inbound | `POST /Cortina/StaticQR/Void` | **Nayax calls us** | `TransactionId` → release/refund |

**Machine identity:** match on `MachineInfo.Id` (stable virtual-machine id), **not**
`DeviceInfo.HwSerial` (changes on device swaps). Keep a `bay ↔ MachineInfo.Id` map.

## What we build (gated, sandbox-first, money-safe)
1. **`NayaxCortinaClient.startStaticQr()`** — outbound `/start` call. Reads
   `NAYAX_CORTINA_INTEGRATOR_NAME` + `NAYAX_CORTINA_SECRET_TOKEN` (secrets, ops-set).
2. **3 inbound handlers** under `/api/nayax/cortina/{sale,settlement,void}`:
   - **Sale** → verify SecretToken/source, look up customer by `AppUserId`, confirm
     pre-paid balance ≥ Amount, place a **hold**, respond approved. Idempotent on
     `TransactionId` (a retry returns the same verdict, never double-holds).
   - **Settlement** → **debit the balance exactly once** (idempotent on
     `TransactionId`), write the ledger entry, fire the SUMIT receipt.
   - **Void** → release the hold / refund the credit (idempotent).
   - CSRF-exempt (machine-to-machine), HMAC/secret-verified, rate-limited.
3. **Money-safety:** single debit per `TransactionId` (DB unique), double-entry
   ledger entry, balance never goes negative, no wash-without-charge / no
   charge-without-wash. Reuses the existing wallet/voucher ledger.
4. **Referee rule** (money domain) locking: inbound handlers exist, idempotent by
   TransactionId, SecretToken-verified — build fails if any is removed.

## What already exists (extend, don't rebuild)
`server/routes/nayax-payments.ts` (usage-event), `server/services/K9000RedemptionService.ts`
(wallet/eGift/package redeem + `k9000WashEvents`), `nayax-monyx-events.ts`,
`nayaxService.ts`. The new Cortina handlers slot alongside these and reuse the
redemption-ledger logic.

## Fully-automatic start (optional, later)
"Remote Vend" (`docs/cortina/staticqr/remote-vend`) can start the wash with **no
button press** — needs the **VPOS/ONYX** device + product `Code`/`PulseLineNumber`.
Confirm the K9000's device type via Lynx `GET /operational/v1/devices/{DeviceID}`
(also gives `StatusID`/`LastUpdated` = live station health).

## Activation (ops — not codeable by the agent; money/keys)
1. Nayax assigns **`integratorName`** + the **64-char `SecretToken`** → store as
   secrets, bind to Cloud Run.
2. Register our 3 inbound URLs (`/api/nayax/cortina/sale|settlement|void`) with Nayax.
3. Sandbox (`qa-lynx` / Cortina test org) → one full scan→start→settle→void cycle.
4. Flip to production only after the sandbox cycle passes.

## Build order
1. Inbound `void` + `settlement` + `sale` handlers (the money path) — gated, sandbox.
2. Outbound `/start` + the app QR screen wiring (the redeem-at-bay screen #3 exists).
3. Referee rule + idempotency tests.
4. Station-health read via Lynx `GET /devices/{id}` → station monitor.
5. Refunds via the `nayax-lynx-refunds` skill; inventory via `nayax-lynx-inventory`.

See memory: nayax-redeem-at-bay-verified-flow-2026-06-28.
