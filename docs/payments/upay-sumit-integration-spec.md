# UPay / SUMIT Online Payment Integration — Spec

**Status:** Draft for build · **Owner:** CTO · **Date:** 2026-06-03
**Supersedes:** Tranzila (removed — see PR #563)

---

## 0. TL;DR (the one thing to understand)

**UPay is the brand; SUMIT is the engine.** `upay.co.il` publishes **no public developer API** — it is a consumer payments app. The actual card charging, transaction recording, and invoicing happen through its partner **SUMIT (sumit.co.il, formerly "OfficeGuy")**, which has a documented REST API. PetWash already integrates the SUMIT **invoicing** half; this spec covers the missing **card-charging** half.

> Source of truth for endpoints/params: **SUMIT Swagger** — https://app.sumit.co.il/help/developers/swagger/index.html
> Anything marked `UNVERIFIED` below must be confirmed against that Swagger before coding.

---

## 1. What already exists in the codebase (CONFIRMED)

| Piece | File | State |
|---|---|---|
| SUMIT client (base URL, auth, document create, webhook verify) | `server/services/SumitClient.ts` | Wired |
| Base URL | `https://api.sumit.co.il` (one URL; sandbox vs prod chosen by **credentials**, not host). Override: `SUMIT_API_BASE_URL` | Confirmed in code |
| Auth pattern | Body-embedded `Credentials: { CompanyID, APIKey }` | Confirmed |
| Invoice/receipt | `createDocument()` → `POST /accounting/documents/create/` | Wired |
| Webhook verify | `SumitClient.verifyWebhookSignature()` + `server/routes/sumit-webhook.ts` | Wired |
| Sync / preflight / readiness | `SumitSyncService`, `SumitPreflightCheck`, `SumitActivationReadiness` | Wired |
| Env contract + fail-closed | `server/lib/payment-provider-mode.ts`: `SUMIT_ENABLED` requires `SUMIT_API_KEY` + `SUMIT_WEBHOOK_SECRET` in prod | Confirmed |
| Env names documented | `.env.example`: `SUMIT_API_KEY`, `SUMIT_COMPANY_ID`, `SUMIT_TERMINAL_ID`, `SUMIT_WEBHOOK_SECRET`, `SUMIT_API_BASE_URL`, `SUMIT_APP_NAME` | Confirmed |

**Missing = the charge path.** `SumitClient.ts` already names the intended surface: *"createDocument, **multivendorcharge**, webhook verification."* The charge call is the gap.

---

## 2. SUMIT API surface we need (confirm names against Swagger)

| Need | Endpoint (UNVERIFIED — confirm in Swagger) | Notes |
|---|---|---|
| Tokenize a card client-side (PCI SAQ-A) | SUMIT **PaymentsJS** / `OfficeGuy.Payments` single-use token | Card data never touches PetWash servers. Returns a `SingleUseToken`. |
| Charge a single card | `POST /billing/payments/charge/` | Body: `Credentials`, `Customer`, `Items` (or `Amount`), `PaymentMethod{ SingleUseToken }`, idempotency. |
| Marketplace split charge (platform + provider) | `multivendorcharge` (named in `SumitClient` comments) | For sitter/walker/trek: charge customer, route 85% to provider, keep 15% commission. Confirm split semantics. |
| Recurring / saved card | Customer payment-method token (`CustomerID` + stored token) | For future subscriptions / loyalty auto-renew. |
| Issue invoice/receipt | `POST /accounting/documents/create/` | **Already wired** — call after a successful charge. |
| Webhook (charge result, chargeback, settlement) | `server/routes/sumit-webhook.ts` | HMAC verify already wired; add charge-result handlers. |

---

## 3. What to build (sequenced PRs)

Each is its own PR (Guardian: never bundle finance changes).

**PR-SUMIT-1 — `SumitClient.charge()` (server)**
- Add `charge()` and `multivendorCharge()` to `SumitClient.ts`, mirroring the existing `createDocument()` body-embedded `Credentials` pattern.
- Idempotency key on every charge (client-supplied UUID); SUMIT must treat a retried key as a no-op (confirm mechanism in Swagger).
- Returns a typed `{ success, transactionId, documentId?, error? }`. **No fake success** — mock mode returns `ok:false` (matches `MockPaymentProvider`).

**PR-SUMIT-2 — wire `resolveProviderForPlatform`**
- After PR #563, online platforms throw *"pending UPay/SUMIT."* Replace `throw` with routing to the SUMIT charge path. Add `'sumit'` to the `PaymentProvider` union.

**PR-SUMIT-3 — online booking capture route**
- Re-introduce the marketplace capture route (replacing the deleted `pay-with-tranzila`) as `POST /api/marketplace-bookings/:id/pay` → `SumitClient.multivendorCharge()` → on success transition booking to `confirmed` (existing `bookingLifecycleService`), issue receipt via `createDocument()`, write escrow via existing flow.

**PR-SUMIT-4 — wallet top-up + e-gift capture**
- Wallet top-up and e-gift purchase via `SumitClient.charge()`. Credit lands in the internal ledger (source of truth) only **after** the SUMIT webhook confirms settlement.

**PR-SUMIT-5 — client tokenization (PCI SAQ-A)**
- Embed SUMIT PaymentsJS on the checkout surface so the card → SingleUseToken happens in the browser. PetWash servers only ever see the token. Keeps us out of PCI DSS SAQ-D.

---

## 4. Hard requirements (non-negotiable)

- **Pricing disclosure (Israeli Consumer Protection Law §17a — the Wolt 3.75M₪ precedent).** Every consumer surface shows the **total inclusive price (כולל מע"מ, כולל דמי פלטפורמה)** before the customer commits. The 15% platform commission must be folded into the displayed total, never appear as a checkout surprise. (Platform skill §2.)
- **Internal ledger is the source of truth.** A SUMIT charge does **not** credit a wallet/loyalty balance directly — the ledger is credited only on confirmed settlement (webhook), with an audit entry (`logAuditEvent`: actor, action, target, before/after).
- **Idempotency everywhere.** Every charge carries a client UUID; retries are no-ops. Webhooks are idempotent on SUMIT's event id.
- **Fail-closed.** `SUMIT_ENABLED=true` in prod with missing secrets already refuses to boot — keep it.
- **No fake success.** Mock mode (`PAYMENT_PROVIDER_MODE=mock`) returns `ok:false`; CI never charges.
- **K9000/Nayax untouched.** Kiosk stays on Nayax. This is the *online* rail only.

---

## 5. What I need from you / UPay-SUMIT onboarding

1. **SUMIT company account** (the UPay-partnered SUMIT org) → `SUMIT_COMPANY_ID` + `SUMIT_API_KEY` (a **testing** Company/APIKey first — same base URL, test org).
2. **Webhook secret** → `SUMIT_WEBHOOK_SECRET`, and register the webhook URL `https://petwash.co.il/api/sumit/webhook`.
3. Confirm **marketplace split** is supported on your SUMIT plan (`multivendorcharge`) or whether provider payouts run separately via the existing payout path.
4. The **PaymentsJS public key** for client-side tokenization.

All of these come from the SUMIT dashboard / your UPay account manager — no code is blocked on me reading them; the build is blocked only on the **test credentials**.

---

## 6. Open questions (answer from Swagger, not assumption)

- Exact charge endpoint path + whether single-charge and multivendor are separate operations.
- Idempotency mechanism (header vs body field).
- Settlement timing → when is it safe to release escrow / credit the ledger.
- Refund / void endpoints (needed for booking cancellation within policy).

---

## Sources
- SUMIT Swagger (authoritative): https://app.sumit.co.il/help/developers/swagger/index.html
- SUMIT API base: `https://api.sumit.co.il` (confirmed in `server/services/SumitClient.ts`)
- SUMIT WooCommerce gateway (proves card-charging capability): https://wordpress.org/plugins/woo-payment-gateway-officeguy/
- upay.co.il (consumer site, no public API): https://www.upay.co.il
