# 01 — Unified Payment Abstraction Layer

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 7 (Nayax / Machine Payment Reconciliation) is the seller-side spec; this section is the cross-vendor adapter layer.

---

## 1. Objective

A single canonical interface — `PaymentProvider` — through which every customer-facing money movement flows, regardless of vendor. Vendor-specific code lives behind one of N concrete adapters that each implement the same surface.

The unified layer eliminates: vendor-specific call sites scattered across routes, divergent error shapes, and the historical pattern where the prior implementation wired vendor SDKs directly into business logic.

---

## 2. Current state

| Vendor | Status (post-#207) | Where consumed |
|---|---|---|
| **Nayax** | Active for K9000 card sale; `NayaxSparkService` honours `PAYMENT_PROVIDER_MODE=mock` and `NAYAX_ENABLED=false` flags (PR-CI-SMOKE-HOTFIX) | `server/services/NayaxSparkService.ts`, `server/routes/k9000.ts` (verification helper for /topup also reads `nayaxTransactions` per PR-J) |
| **UPay / SUMIT** | NOT implemented. Env names documented in `.env.example` (PR-CI-PAYMENT-MODE) for future GCP Secret Manager provisioning. | n/a |
| **Stripe** | Deprecated. No `STRIPE_*` env consumed by runtime (verified by grep in PR-CI-PAYMENT-MODE). Module loader emits a deprecation warning if any `STRIPE_*` env var is present at boot. | n/a |
| **Tranzila** | Deprecated. Existing services + routes flag-gated OFF (`payment-flags.ts`). Module loader emits a deprecation warning. Cleanup is a follow-up class of PRs. | `server/services/Tranzila*.ts`, `server/routes/tranzila-*.ts` (gated OFF) |
| **MockPaymentProvider** | Active in CI / mock mode. Returns `ok:false` from every method (`server/services/payment-providers/MockPaymentProvider.ts`). | CI smoke + unit tests |

The `payment-provider-mode` module (`server/lib/payment-provider-mode.ts`) is already the canonical mode/flag source.

---

## 3. Target architecture

### 3.1 The `PaymentProvider` interface (conceptual)

```ts
export interface PaymentProvider {
  readonly name: ProviderName;          // 'nayax' | 'upay' | 'sumit' | 'mock'
  readonly capabilities: ProviderCapabilities;

  authorize(req: AuthorizeRequest): Promise<AuthorizeResult>;
  capture(req: CaptureRequest):     Promise<CaptureResult>;
  voidAuth(req: VoidRequest):       Promise<VoidResult>;
  refund(req: RefundRequest):       Promise<RefundResult>;
  payout?(req: PayoutRequest):      Promise<PayoutResult>;       // optional; not all support
  verifyWebhook(headers: WebhookHeaders, rawBody: Buffer): Promise<WebhookVerification>;
}
```

All result types are discriminated unions:

```ts
type AuthorizeResult =
  | { ok: true;  txnRef: string; provider: ProviderName; gatewayPayload: unknown }
  | { ok: false; reason: 'declined' | 'invalid_request' | 'vendor_error' | 'mock-mode'; detail: string };
```

`gatewayPayload` is for downstream reconciliation; never displayed to end users.

### 3.2 Capability descriptor

```ts
interface ProviderCapabilities {
  supportsAuth:     boolean;      // separate auth + later capture
  supportsRefund:   boolean;      // partial + full
  supportsVoid:     boolean;      // void unsettled auth
  supportsPayout:   boolean;      // outbound to provider bank
  supportsRecurring:boolean;      // subscriptions / memberships
  webhookVerify:    'hmac' | 'jwt' | 'mtls' | 'none';
  currencyCodes:    Currency[];   // 'ILS' v1
}
```

### 3.3 Resolver

```ts
getPaymentProvider(channel: PaymentChannel): PaymentProvider
```

Channel → provider mapping is config-driven, not hardcoded:

| Channel | v1 provider | Future |
|---|---|---|
| `k9000.machine_card` | `nayax` | n/a (Nayax owns terminal) |
| `marketplace.booking` | `upay` (post-implementation) | `sumit` |
| `wallet.topup` | `upay` (post-implementation) | `sumit` |
| `subscription.recurring` | `sumit` | n/a |
| `egift.purchase` | `upay` | `sumit` |

Resolver returns `MockPaymentProvider` whenever `PAYMENT_PROVIDER_MODE=mock` regardless of channel mapping.

### 3.4 Adapter responsibilities

Each adapter is responsible for, and only for:

- Mapping the canonical request → vendor's API request shape
- Calling the vendor (HTTP / SDK)
- Mapping the vendor response → canonical result shape
- Persisting the verbatim vendor payload to a per-provider audit table
- Emitting standardised metrics (latency, error class, retry count)

Adapters MUST NOT:

- Mutate wallet / ledger / booking state directly. That is downstream business logic operating on the result.
- Issue invoices or receipts. That is the numbering authority + invoice service (Part 2.4 + Section 4 of this roadmap).
- Use `console.log` for vendor responses (PII / PCI risk).

---

## 4. Gaps from current to target

| Gap | Owner | Severity |
|---|---|---|
| No unified `PaymentProvider` interface exists | Eng | high — every new vendor multiplies route surface today |
| Nayax code lives in routes (e.g. `routes/k9000.ts:288-358` directly fetches the activation URL) | Eng | medium — refactor when adapter ships |
| No Capabilities descriptor — code paths assume features without checking | Eng | medium — guarded today by ad-hoc env flags |
| UPay / SUMIT entirely missing | Vendor | blocker for online billing |
| Tranzila services still in tree but flag-gated OFF | Eng | low — cleanup PR class scheduled (`PR-CLEAN-TRANZILA-N`) |
| No per-provider verbatim audit table | Eng + CPA | medium — needed for chargeback evidence |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- `PaymentProvider` interface + concrete `MockPaymentProvider` and `NayaxSparkProvider` (wraps existing `NayaxSparkService`)
- Resolver with channel → provider map
- Capabilities descriptor + boundary checks (refuse to call `payout` on a provider whose Capabilities say `supportsPayout: false`)
- One adapter audit table per provider (append-only, vendor payload stored)

**Deferred scope:**
- UPay / SUMIT adapters (separate PR class, see `execution-pr-roadmap.md` PR-UPAY-1..7)
- Live recurring / subscription billing
- Multi-currency
- Cross-region failover

---

## 6. Legal / regulatory / financial assumptions

- Israeli Tax Authority requires that the entity issuing the invoice is the legal seller. This is decided in Financial Core Part 0.6, not in this layer. Adapters carry the money; invoicing happens elsewhere.
- The acquirer (Nayax / UPay / SUMIT) is a **payment service operator**, not a counterparty. Funds in transit are at the acquirer; trust funds are at our bank (Part 0.4 custody states).
- Webhooks from acquirers are NEVER trusted without HMAC / signed payload verification (PR-J locked this rule for /topup; the adapter layer enforces it for every webhook).

---

## 7. Open questions for human decision

1. **Channel-to-provider mapping for marketplace bookings** — UPay or SUMIT? CFO + counsel pick once vendor contracts are signed.
2. **Recurring / subscription provider** — SUMIT positioned as the default; CEO confirm.
3. **Per-provider audit table retention** — 7-year minimum (Israeli accounting law) but retention class (hot vs cold) is an Ops decision.
4. **Webhook IP allowlist policy** — keep per-provider IP allowlist (Tranzila pattern preserved by `payment-flags.ts`)? CEO + Ops decide.
5. **Currency v1** — locked to ILS. Multi-currency is global-scaling (Section 10).

---

## 8. Dependency graph

**This section blocks:**
- PR-UPAY-3 (client/service abstraction) — needs the interface + resolver in place first
- PR-NAYAX-1 (reconciliation) — adapter audit table gives us the verbatim payload to reconcile against
- Section 5 (marketplace payouts) — payouts route through the same adapter layer

**This section is blocked by:**
- Financial Core Part 0 (legal-role model) — already shipped (PR #201)
- UPay / SUMIT vendor selection (open question)

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Adapter swallows vendor error and returns `ok:true` | Fake-success state — Rule H violation | Discriminated-union return; lint rule blocks `ok: true` literal in helper modules; source-pin tests assert |
| Missing Capabilities check before calling unsupported method | Runtime exception in production | Resolver wraps every adapter in a typed proxy that asserts capability before delegating |
| Vendor payload dropped (not persisted) | Cannot reconcile chargebacks | Adapter contract MUST persist verbatim; integration test asserts row count |
| Webhook signature verifier returns `true` on missing secret | Forged webhook can mutate payment state | Boot-time fail-closed when secret missing for any enabled provider (already enforced by `payment-provider-mode.ts`) |
| Mode flag drift (e.g. `PAYMENT_PROVIDER_MODE=mock` slips into production) | Live customers cannot pay | `/health/strict` reports the resolved mode; CI gates promotion if mock detected in production deploy |

---

## 10. Reconciliation strategy

Per-provider audit table is the source of truth for reconciliation. Daily job:

1. Pull vendor settlement file (Nayax `daily_settlement.csv`, UPay/SUMIT equivalents).
2. For each settlement row, look up the matching adapter audit row by `gatewayTransactionId`.
3. Diff: `settlement.netCents - adapter.expectedNetCents` per row.
4. Variance > 0 → `reconciliation_variance` table row + Slack alert.
5. End-of-day report attached to admin dashboard (Section 7).

---

## 11. Rollback / offset strategy

Live-money rollback in this layer happens at the resolver:

- **Channel re-mapping** (config-only) — switch back to a previous provider for a channel without code change.
- **Provider-level kill** — set `<provider>_ENABLED=false`; the resolver immediately falls back to the next adapter in the channel's preference list, or to `MockPaymentProvider` if none.
- **Mock-mode escape hatch** — `PAYMENT_PROVIDER_MODE=mock` short-circuits everything (used for incident response only; alerts on detection in production per Failure 5 above).

Offsetting entries for already-charged customers route through the **refund** path of the original adapter, not by mutating the original transaction row (Part 2.2 append-only rule).

---

## 12. Execution PR sequence (specs in `execution-pr-roadmap.md`)

| PR | Purpose |
|---|---|
| `PR-UPAY-1` | API discovery + docs only (vendor research, OpenAPI capture, mapping draft) |
| `PR-UPAY-2` | env + feature flag + config validation only |
| `PR-UPAY-3` | client/service abstraction only — no live charge yet (consumes the interface from this section) |
| `PR-UPAY-4` | webhook receiver + signature verification + idempotency only |
| `PR-UPAY-5` | invoice / receipt lifecycle (consumes Section 4) |
| `PR-UPAY-6` | recurring memberships / subscriptions |
| `PR-UPAY-7` | prepaid wash packages and wallet top-up (consumes Section 2) |

Each is single-purpose with full metadata.
