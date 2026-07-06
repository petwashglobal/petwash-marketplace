# Nayax Cortina StaticQR — go-live runbook (2026-07-06)

The redeem-at-bay code is **complete and spec-conformant** (verified against the
Nayax dev-portal Cortina StaticQR spec). It sits DARK until `NAYAX_CORTINA_ENABLED=true`.
The only thing left is Nayax-side provisioning + a few config values — no more code.

## What the code now does (both Cortina flows)

PetWash is registered AS a Cortina payment method. Nayax calls our endpoints; we
verify the customer's PRE-PAID credit (wash-package → eGift → cash) and approve.
The card is NEVER charged — "already paid, wash free". Public walk-up card stays
plain Nayax.

- **PreAuthorization flow:** `/Authorization` (reserve) → `/Settlement` (debit) → `/Cancel`
- **PreSelection flow:** `/Sale` (reserve) → `/Sale End Notification` (debit) → `/Void`
- Plus `/Refund`. We answer BOTH flows and both case styles, so whichever way
  Nayax configures the machine, it works.
- Money-safe: reserve on approve, debit only after the vend is confirmed;
  exactly-once via a reservation idempotency key; declines use the verified
  Cortina codes (1 funds, 2 unknown txn, 5 fraud, 6 system, 50 unknown machine,
  992 timeout, 999 general).

## Endpoint URLs to give your Nayax TPOC

Base: `https://petwash.co.il/api/webhooks/nayax/cortina`

| Cortina command | URL |
|---|---|
| Authorization | `…/api/webhooks/nayax/cortina/authorize` |
| Settlement | `…/api/webhooks/nayax/cortina/settlement` |
| Sale (PreSelection) | `…/api/webhooks/nayax/cortina/sale` |
| Sale End Notification | `…/api/webhooks/nayax/cortina/sale-end-notification` |
| Cancel | `…/api/webhooks/nayax/cortina/cancel` |
| Void | `…/api/webhooks/nayax/cortina/void` |
| Refund | `…/api/webhooks/nayax/cortina/refund` |

(We also answer the PascalCase and `/staticqr/<cmd>` variants, so a base-URL +
auto-append config resolves too.)

## What to get from Nayax (their team provisions this — you can't self-serve)

1. Register **PetWash as a Cortina payment method** (integrator/payment-method name).
2. **Secret token** → set as `NAYAX_CORTINA_SECRET_TOKEN`.
3. **Base URL** for our outbound `Start` call → `NAYAX_CORTINA_BASE_URL`
   (prod `https://lynx.nayax.com`, QA `https://qa-lynx.nayax.com`).
4. **Message certificate(s)** — Cortina ciphers the message body (decline codes
   990/991/1010 are cert errors). Confirm whether our integration must decrypt,
   and get the cert if so.
5. **"PreSelection = Yes"** (or PreAuthorization) enabled on each K9000 virtual machine.
6. Each **bay's TerminalId** (MachineInfo.TerminalId) — we map bay ↔ terminal in
   `station_bays.nayaxTerminalId` / `nayaxQrReaderId`.
7. Set **"QR" as an Idle Mode Screen** so each bay shows its Monyx QR.

## Config I set once you have the above

```
NAYAX_CORTINA_INTEGRATOR_NAME=<payment method name>
NAYAX_CORTINA_SECRET_TOKEN=<secret>      # → Secret Manager, never in git
NAYAX_CORTINA_BASE_URL=https://qa-lynx.nayax.com   # QA first
NAYAX_CORTINA_SANDBOX=true
NAYAX_CORTINA_ENABLED=true                # flip LAST, after a sandbox test
```
Plus per-bay `nayaxTerminalId` in `station_bays`.

## Go-live test plan (QA sandbox first)

1. Map one bay's TerminalId, set the env in QA, flip ENABLED.
2. Load a test wallet with a wash-package credit.
3. Scan the bay QR with the PetWash app → Nayax fires Authorize/Sale → we approve →
   the machine begins a session → confirm the debit lands on Settlement/SaleEnd.
4. Verify decline paths: no credit → code 1; wrong bay → code 50.
5. Confirm the exact field casing on the FIRST live sandbox payload, then flip
   `NAYAX_CORTINA_SANDBOX=false` + prod base URL for production.

## Still to confirm (honest open items)
- Certificate/ciphering: does our inbound handler need to decrypt the body, or
  does Nayax post plaintext to our HTTPS endpoint? (Ask TPOC — affects codes 990/991.)
- Inbound caller auth: today we guard via the signed PetWash pass-link token +
  bay resolution. Consider `NAYAX_ALLOWED_IPS` allowlist once Nayax gives the IPs.
