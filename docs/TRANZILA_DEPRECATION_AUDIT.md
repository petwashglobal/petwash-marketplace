# Tranzila Deprecation Audit + Summit Migration Proposal

**Status:** Audit + migration proposal. No code change, no flag flips, no
schema migration, no Summit credentials provisioned, no PR amendments
applied in this PR. Pure planning.

**Parent doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0
(strategic operating pillar, active 2026-05-15) + §2 (protected systems
list — needs update per §11 of this doc).

**Reframing:** CEO directive treats Tranzila as deprecated. The codebase
already reflects this direction. This audit confirms what's in flight,
maps the remaining work, and proposes a phased migration to Summit
primary + UPay fallback. Nayax stays for kiosk hardware payments only.

**Date stamped:** 2026-05-15.

---

## §0 TL;DR

**Tranzila is already deprecated in the codebase, not just in strategy.**

- `docs/architecture/01-unified-payment-abstraction.md:24` already
  documents Tranzila as "Deprecated. Existing services + routes
  flag-gated OFF."
- All Tranzila charge operations (`processEgiftPurchase`,
  `processWalletTopup`, `captureMarketplaceBooking`) are stub
  implementations that return errors and log a deprecation warning.
- 8 feature flags (`TRANZILA_EGIFT_ENABLED`, etc.) all default to
  `false`. Production is not processing customer charges through
  Tranzila today.
- `server/index.ts:228` already names SUMIT/UPay as the next-generation
  provider direction.
- No client-side code depends on Tranzila.

**What is live:**
- Webhook endpoints (`/api/payments/tranzila/webhook`,
  `/api/webhooks/tranzila/*`) — receive no traffic in practice but the
  routes are mounted with full security guards.
- Admin finance dashboard endpoints (`/api/admin/finance/tranzila/*`)
  — show empty data since no transactions exist.
- 4 schema tables (`tranzila_transactions`,
  `tranzila_payment_requests`, `tranzila_chargebacks`,
  `tranzila_settlement_batches`) — exist with rows = 0.

**What is NOT live:**
- Real Tranzila API integration. All API calls are stubbed with
  TODO comments and return safe-default errors.
- HMAC-SHA256 webhook signature verification (algorithm defined in
  test, not wired to production handler).
- Chargeback-to-provider-payout clawback (architecturally planned in
  schema and services, never implemented — confirmed by
  `docs/finance/transaction-lifecycle-forensic-audit.md:366`).

**Migration risk: LOW.** Nothing in production is processing live
Tranzila charges today, so cutting over to Summit does not break
customer experience. The hard work is implementing Summit, not
disconnecting Tranzila.

**Critical strategic finding:** the chargeback-clawback gap is **not a
Tranzila problem.** It's an architecture problem we get to solve right
on Summit. Migration is the opportunity to ship the missing piece
properly.

**Recommended migration: 10 phases, ~30–45 engineer-days total** (most
of that is Summit integration + chargeback clawback implementation, not
Tranzila removal). Phase 1 ships today (this doc + SKILL.md amendment).
Phase 10 (Tranzila code removal) ships last, after Summit is stable.

---

## §1 What's already in flight (predecessor architecture)

Critical context before any new work:

| File / line                                         | What it says                                                                      | Implication                          |
|------------------------------------------------------|-----------------------------------------------------------------------------------|--------------------------------------|
| `docs/architecture/01-unified-payment-abstraction.md:24` | Tranzila: "Deprecated. Existing services + routes flag-gated OFF... Cleanup is a follow-up class of PRs." | Strategic pivot already documented. |
| `server/index.ts:228`                                | Deprecation warning + reference to SUMIT/UPay as next-generation provider          | Direction already named in code.    |
| `server/lib/payment-flags.ts:71-133`                 | All Tranzila flags default false; require `_isTranzilaWebhookSecured` precondition | Flag-gating already enforced.       |
| `server/index.ts:198-222`                            | Startup guard: `TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true` forbidden in prod/staging | Security perimeter already drawn.   |
| `server/services/TranzilaService.ts:129-139`         | `verifyWebhookSignature()` is a TODO stub                                          | Real Tranzila not connected.        |
| `server/services/TranzilaService.ts:157-168`         | Real REST API call returns error, logs warning                                     | Charge operations cannot succeed.   |
| `docs/finance/transaction-lifecycle-forensic-audit.md:366` | "NOT WIRED — chargeback clawback architecturally planned but no webhook is wired" | Strategic gap, not Tranzila-specific |

**Takeaway:** the CEO's directive is locking in a direction the platform
team already started. This PR documents the state and proposes the
forward path.

---

## §2 Audit findings — categorized

39 files mention Tranzila. Distribution:

### §2.1 Active production dependency (6 files)

These ARE mounted and respond to live HTTP requests. They serve no
charge traffic but do receive monitoring + admin queries.

| File                                                       | Role                                                       |
|------------------------------------------------------------|------------------------------------------------------------|
| `server/services/TranzilaWebhookService.ts`                | Webhook dispatcher (524 LOC). Routes 10 event types to mappers. Signature verification stubbed. |
| `server/routes/tranzila-webhooks.ts`                       | `POST /api/payments/tranzila/webhook`. Raw body + IP allowlist. |
| `server/routes/tranzila-event-webhooks.ts`                 | `POST /api/webhooks/tranzila/*`. Per-event-type routing.    |
| `server/routes/finance/tranzila-admin.ts`                  | Admin dashboard endpoints. Live but show empty data.        |
| `shared/schema-tranzila.ts`                                | 4 tables: transactions, payment_requests, chargebacks, settlements. |
| `server/services/PaymentGatewayService.ts`                 | Dispatch facade. Maps platform → provider.                  |

### §2.2 Temporary compatibility layer (12 files)

Stub implementations behind feature flags. Code exists but cannot
execute its primary function.

| File                                                  | Stub status                                              |
|-------------------------------------------------------|----------------------------------------------------------|
| `server/services/TranzilaService.ts`                  | Charge ops stubbed; returns errors. Webhook sig stubbed.  |
| `server/services/TranzilaPaymentRequestService.ts`    | `create()` stub. `cancel()` doesn't call real API.        |
| `server/services/TranzilaChargebackService.ts`        | Operations management — works on stored data, no live API. |
| `server/services/TranzilaDocumentMapper.ts`           | Maps processor docs to `pw_tax_documents`. Gated. CPA sign-off TODO. |
| `server/services/TranzilaPaymentRequestMapper.ts`     | Webhook ingestion mapper. Idempotent on `paymentRequestId`. |
| `server/services/TranzilaChargebackMapper.ts`         | Webhook ingestion mapper. Triggers Octopus alerts.        |
| `server/routes/marketplace-bookings.ts:763-850`       | `pay-with-tranzila` endpoint. Stub charge implementation. |
| `server/lib/payment-flags.ts`                          | Flag definitions + webhook-secured precondition.          |
| `server/lib/payment-provider-mode.ts`                  | Emits deprecation warnings at module load.                 |
| `server/index.ts:198-228`                              | Startup security guard + deprecation warning.              |
| `server/services/PaymentGatewayService.ts`             | Provider dispatch (Nayax for kiosk, Tranzila gated for online). |
| Tests: 2 files (see §2.4)                              | Contract + security tests.                                 |

### §2.3 Stale documentation (7 files)

Docs reference Tranzila in ways that need updating per CEO directive
item #7 ("payment provider abstraction layer / legacy Tranzila
references pending migration review").

| File                                                  | Tranzila mention                                          | Action                          |
|-------------------------------------------------------|-----------------------------------------------------------|---------------------------------|
| `docs/AI_QA_WATCHTOWER_PROPOSAL.md:594`               | Sample daily report — "POST /api/checkout/tranzila"       | Update language; future PR.     |
| `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md:268, 300`    | MVP-Full Journey 4 — "eGift purchase Tranzila sandbox"    | Update language; future PR.     |
| `docs/AI_QA_WATCHTOWER_MVP_ZERO_SPEC.md` (PR #283)    | Multiple Tranzila mentions in scope rules                  | Update before merging PR #283.  |
| `docs/FRANCHISE_REBUILD_AUDIT.md` (PR #286)            | References Tranzila as "sacred" via SKILL.md inheritance   | Update before merging PR #286.  |
| `docs/architecture/01-unified-payment-abstraction.md` | Already documents deprecation (correct as written)         | None — keep as authority.        |
| `docs/finance/transaction-lifecycle-forensic-audit.md`| Notes chargeback clawback gap                              | None — surfaces the gap.         |
| `.claude/skills/petwash-platform/SKILL.md`             | §2 lists Tranzila as "sacred — runtime is sacred"          | **Update urgently** (§11 below). |

### §2.4 Test fixtures (3 files)

| File                                                  | Purpose                                                |
|-------------------------------------------------------|--------------------------------------------------------|
| `tests/tranzila-webhook-hardening.test.js`            | Security tests: HMAC, dedup, bypass enforcement.       |
| `tests/unit/tranzilaWrapper.test.ts`                  | Marketplace pay endpoint contract test.                |
| `server/tests/paymentProviderMode.regression.test.ts` | Env var conflict checks.                                |

These stay until Tranzila code is removed (Phase 10). They guard
against accidental re-introduction of insecure config.

### §2.5 Configuration (1 file)

`.env.example` (lines 185-204) — 11 Tranzila env vars listed. **Stay as
placeholders** while code exists; remove in Phase 10.

---

## §3 Migration concerns (per CEO checklist)

Each concern mapped to current state + post-Summit state.

### §3.1 Webhook handlers (H)

**Current:** signature verification stubbed in `TranzilaService.ts:129-139`. Algorithm (HMAC-SHA256) defined in tests but not wired. Endpoints `/api/payments/tranzila/webhook` and `/api/webhooks/tranzila/*` accept POSTs but no real Tranzila system is configured to send them.

**Post-Summit:** new endpoint(s) `/api/payments/summit/webhook`. Summit signature verification per Summit docs. Same idempotency, same IP allowlist pattern, same audit log per platform skill §2. Implementation pattern from `TranzilaWebhookService.ts` reusable — only the signature math changes.

### §3.2 Refund flow (I)

**Current:** schema supports `transaction_kind='refund'`. No live refund route exists. Tranzila refund webhook handler drafted but does not trigger.

**Post-Summit:** Summit refund API + webhook. Internal refund route at `/api/admin/refund/:transactionId` (admin-only, audit-logged, requires reason). Refund webhook updates ledger. Linked entitlement (eGift balance, wallet credit, booking status) reversed atomically.

### §3.3 Chargeback / dispute (J)

**Current:** `TranzilaChargebackService` + `TranzilaChargebackMapper` exist. Receive webhooks, store cases, dashboard renders open cases with deadline countdown. **MISSING:** webhook does NOT link to provider payout for clawback. Confirmed at `docs/finance/transaction-lifecycle-forensic-audit.md:366`.

**Post-Summit + opportunity:** rebuild chargeback handling on Summit's dispute API with the missing clawback wired correctly:
- Chargeback opened → provider payout for the linked booking is held (if not yet paid) or marked for clawback (if already paid).
- Evidence submitted → status updated, deadline tracked.
- Chargeback lost → provider's wallet debited (with audit log + email). If wallet is insufficient, escalation to manual collections.
- Chargeback won → release the hold; provider notified.

This is the most strategically valuable piece of the migration. Fixing this gap is worth more than the cosmetic Tranzila→Summit cutover.

### §3.4 Recurring billing / payment tokens (K)

**Current:** NONE. No subscription model, no recurring billing, no stored Tranzila tokens.

**Post-Summit:** decision deferred. If loyalty / Prestige Pass eventually needs auto-renewal, Summit's tokenization is the implementation path. Not in scope for this migration.

### §3.5 eGift purchase flow (L)

**Current:** `TranzilaService.processEgiftPurchase()` stub. Gated by `TRANZILA_EGIFT_ENABLED=false`. Frontend `/egift/checkout` exists but cannot complete a real purchase.

**Post-Summit:** new endpoint `/api/checkout/summit/egift`. Same input shape (eGift design, amount, recipient). Returns Summit's hosted checkout URL or iframe. Webhook on `payment.success` issues eGift entitlement + sends email/SMS.

**iOS native consideration:** per `docs/APPLE_DEVELOPER_SETUP_PLAN.md`, Apple Pay routes through the payment processor's Apple Pay endpoint. Summit must support Apple Pay for the eGift checkout to work natively. **CEO must confirm Summit Apple Pay support** before iOS app submission (per Apple Developer plan Decision B).

### §3.6 Booking payment flow (M)

**Current:** `POST /api/marketplace-bookings/:bookingId/pay-with-tranzila` route exists (`marketplace-bookings.ts:763-850`). Stub charge. No live transactions.

**Post-Summit:** new endpoint `/api/marketplace-bookings/:bookingId/pay-with-summit`. Same booking state machine (pending_payment → confirmed). Same audit log. Same idempotency key contract.

**Pay-later pattern:** not currently implemented. Summit's payment-request feature (similar to Tranzila's) supports "send the customer a payment link" workflow. Can be added in Phase 6 if needed.

### §3.7 Wallet top-up flow (N)

**Current:** `TranzilaService.processWalletTopup()` stub. Gated. No live transactions.

**Post-Summit:** standard pattern — charge succeeds → wallet credited → audit log entry → user sees updated balance. Idempotent on `topupId` to prevent double-credit on webhook retry.

### §3.8 Provider payout flow (O)

**Current:** payouts are NOT handled by Tranzila. Separate rail (likely manual bank transfer today, with Stripe Connect as a future option mentioned in earlier audits). No Tranzila code touches payout.

**Post-Summit:** payouts stay on their separate rail. **But** the chargeback-clawback fix (§3.3) intersects: if a chargeback occurs on a paid-out booking, the provider's wallet (held in PetWash's `pw_payments` ledger) must be debited. That is a PetWash internal accounting operation, not a Summit call.

### §3.9 Currency + VAT (P)

**Current:** `israeliTax.ts` integration exists. `TranzilaDocumentMapper` maps processor receipts/tax invoices/credit notes to `pw_tax_documents`. TODO at `TranzilaService.ts:34` — CPA sign-off required on VAT timing before live use.

**Post-Summit:** **Summit's strength is invoicing.** Summit is widely used in Israel specifically as an accounting + invoicing platform. Tax document handling may be cleaner with Summit than it was planned to be with Tranzila. CPA sign-off still required for VAT timing rules. New mapper `SummitDocumentMapper.ts` mirrors the Tranzila one.

### §3.10 Audit log entries (Q)

**Current:** `tranzilaTransactions` table stores `processorTransactionId`, `processorAuthNumber`, processor doc refs. Admin dashboard renders ledger lookups.

**Post-Summit:** new table or shared `payment_transactions` table with `provider` column. Same audit fields. Migration plan: add unified table, dual-write during cutover, deprecate `tranzilaTransactions` after data export.

---

## §4 What breaks if Tranzila removed today

**Honest answer: nothing in production customer experience.**

- All charge operations are stubbed; they have never processed a real transaction.
- All feature flags default false.
- No client-side code depends on Tranzila.
- `/egift/checkout` page renders but cannot complete a purchase regardless.
- `/marketplace-bookings/:id/pay-with-tranzila` returns error.

**What technically goes 404:**
- Webhook endpoints (no live sender configured anyway).
- Admin Tranzila dashboard (no data to display anyway).
- Database tables (rows = 0).

**What we lose by hasty removal:**
- The reusable patterns (HMAC verification, idempotency, IP allowlist, audit log) — these are platform-level patterns. **Keep the patterns, replace the vendor.**
- Test guardrails (`tranzila-webhook-hardening.test.js`) — adapt to Summit, don't delete.
- The chargeback clawback architectural design — port to Summit.

**Recommendation: do not remove Tranzila code in a single PR.** Phase 10 (final removal) ships only after Summit is stable in production, all 3 charge flows (eGift, wallet, marketplace) are cutover, and chargeback clawback is implemented on Summit.

---

## §5 Summit integration requirements

What needs to be true before Summit can ship the first charge to a real customer.

### §5.1 Vendor relationship

- Summit production account opened in PetWash Ltd's name.
- API credentials (terminal name, API key, webhook secret) generated.
- IP allowlist configured: PetWash Cloud Run egress + admin dashboard IPs.
- Test/sandbox account distinct from production. Sandbox credentials separately stored.

### §5.2 Israeli tax compliance

- Summit is an Israeli accounting platform — VAT and receipt rules are first-class.
- CPA confirms: Summit's tax document timing matches PetWash's `pw_tax_documents` table contract.
- Receipt numbering scheme compatible (sequential, no gaps).

### §5.3 Apple Pay support

- Summit confirms Apple Pay endpoint availability.
- Apple Developer plan Decision B updated: was "Tranzila Apple Pay endpoint" → becomes "Summit Apple Pay endpoint."
- Merchant ID `merchant.il.co.petwash` works with Summit.

### §5.4 Webhook contract

- Summit signs webhooks (algorithm: per Summit docs — likely HMAC-SHA256).
- Idempotency key passed through.
- All 8 event types covered (charge.success, charge.failed, refund.success, refund.failed, payment_request.viewed, payment_request.paid, document.issued, chargeback.opened, chargeback.evidence_needed, chargeback.won, chargeback.lost).

### §5.5 Refund + dispute APIs

- Refund API supports partial refunds.
- Dispute API exposes deadlines, evidence upload.
- Settlement reporting available (matches `tranzila_settlement_batches` shape).

### §5.6 Provider payout integration

Out of scope. Payouts stay on their separate rail. Summit handles customer-facing charge + refund only.

---

## §6 UPay fallback role

Per CEO directive, UPay is secondary/fallback. Two scenarios:

**Scenario A — Standby reserve.** Summit is primary, UPay is wired but off. If Summit has an outage or terms change unfavorably, eng lead toggles a flag and PetWash routes to UPay within a deploy cycle. Cost: ~1 day of integration up front, ongoing maintenance to keep both wrappers compatible.

**Scenario B — Geographic / use-case split.** Summit handles invoicing + Israeli accounting flows; UPay handles certain B2B or international cases that Summit doesn't cover well. Cost: ongoing dual-vendor relationship management.

**Recommendation: Scenario A.** Cheaper, simpler, satisfies CEO's "no vendor lock-in" principle without doubling operational surface. Flag-gate UPay at the same `PaymentGatewayService` dispatch facade that already exists for Tranzila → Summit.

---

## §7 Nayax stays — out of scope

Nayax handles physical kiosk payments at K9000 stations. **This migration does not touch Nayax.** Per platform skill §2 the Nayax runtime remains sacred (K9000 hardware activation depends on it). Online clearing migration (Tranzila → Summit) is a separate domain from hardware payments.

Distinction in code:
- `PaymentGatewayService.resolveProviderForPlatform()` maps `k9000_wash → nayax`. Unchanged.
- Online platforms (`sitter_suite`, `walk_my_pet`, `pet_trek`, `e_gift`) currently map to `tranzila`. Change to `summit` over the 10-phase rollout.

---

## §8 Migration sequencing (10 phases)

Each phase is independently revertible. Each ships as its own PR with its own approval gate. None depends on the next being deployed.

| Phase | Title                                                            | Days   | Risk      | Decisions needed (§13)        |
|-------|------------------------------------------------------------------|--------|-----------|--------------------------------|
| 0     | This audit + migration proposal merged                            | 0      | very low  | All §13 (informational)        |
| 1     | SKILL.md §2 update (Tranzila → deprecated; Summit primary)        | 0.1    | very low  | None                           |
| 2     | Summit vendor relationship — account, credentials, IP allowlist   | 2 (CEO)| —         | A (Summit account exists)      |
| 3     | Add Summit Payment Provider in `PaymentGatewayService` dispatch + thin client | 3 | low | B (sandbox first)              |
| 4     | Summit webhook handler — sig verification, idempotency, dispatcher | 3      | medium    | None                           |
| 5     | Cut over eGift purchase flow to Summit (flag-gated, dual-path)    | 4      | medium    | C (Apple Pay support confirmed)|
| 6     | Cut over wallet top-up flow to Summit                              | 2      | medium    | None                           |
| 7     | Cut over marketplace booking flow to Summit                       | 4      | medium    | None                           |
| 8     | **Implement chargeback-to-payout clawback (the missing piece)**   | 5      | medium    | D (clawback policy: hold vs debit immediately?) |
| 9     | UPay fallback wired behind the same dispatch facade               | 1      | low       | E (UPay account exists)        |
| 10    | Remove Tranzila code (routes, services, schema tables, env vars)  | 2      | very low  | F (data retention policy)      |

**Total: ~26 engineer-days for the technical work** + ~2 CEO-days for vendor relationship + ~5 CEO days for decisions A–F.

**Phase 1 ships today** as a separate one-line PR right after this audit merges.

**Phase 10 ships last** — only after Phases 2–9 complete and Summit has processed ≥30 days of live charges without issue.

---

## §9 Five-filter analysis (per SKILL.md §0.8)

| Filter            | Verdict                                                                                                                              |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Better?           | ✓✓✓ — Summit is Israeli-native, better tax + invoicing ergonomics, better dispute API. Bonus: opportunity to ship missing chargeback clawback. |
| Cheaper?          | ✓✓ — Summit pricing per Summit docs (unconfirmed). UPay as fallback prevents lock-in. Engineering cost is the real expense.            |
| Faster?           | ✓ — once Summit ships, eGift / wallet / booking flows become usable (none are today). Initial integration is 26 engineer-days.        |
| Easier?           | ✓✓ — single payment surface for online clearing. Kiosk stays on Nayax (separate domain). Cleaner mental model.                       |
| More luxurious?   | ✓✓✓ — Summit's invoicing + tax document UX is enterprise-grade Israeli clearing infrastructure (per CEO §0.6 partner positioning).   |

**Honest tradeoff:** the chargeback clawback fix is 5 days that "isn't migration." It's a strategic upgrade. We could skip it. We shouldn't. It's the gap that creates real financial risk for providers and PetWash. Migration is the right time to ship it.

---

## §10 What changes on open PRs

Per CEO directive item #7: future docs must stop assuming Tranzila-first.
Three open PRs reference Tranzila and should be amended on their
branches before merge.

| PR    | File                                            | Action                                                                              |
|-------|------------------------------------------------|-------------------------------------------------------------------------------------|
| #283  | `docs/AI_QA_WATCHTOWER_MVP_ZERO_SPEC.md`        | Update Tranzila references to "payment provider abstraction layer (legacy Tranzila references pending migration review per docs/TRANZILA_DEPRECATION_AUDIT.md)". Update on branch `claude/ai-qa-watchtower-mvp-zero-spec` before merge. |
| #286  | `docs/FRANCHISE_REBUILD_AUDIT.md`               | Single mention; update same way. Update on branch `claude/franchise-deep-audit` before merge. |
| #284, #285 | Strategic pillar + CI/CD audit             | No Tranzila references; no action needed.                                            |

Merged docs (proposal #280, sequencing #281, discovery #282) contain
historical Tranzila references. **Recommendation: leave the merged docs
unchanged.** They are historical artifacts that reflect their merge-time
context. The migration proposal (this doc) becomes the authoritative
source going forward.

---

## §11 What SKILL.md §2 needs to say

The platform skill currently lists Tranzila as a "sacred" protected
system. That language is **out of date** post-deprecation. Recommended
amendment to §2 (one-line PR after this audit merges):

**Before (current):**
> **No Tranzila behavior change** unless separately approved. Tranzila
> is the Israeli payment processor — runtime is sacred.

**After (proposed):**
> **Tranzila is deprecated.** Existing services and routes are flag-gated
> OFF (`payment-flags.ts`). Do not extend Tranzila code. Summit
> (sumit.co.il) is the primary online payment direction; UPay (upay.co.il)
> is secondary/fallback; Nayax remains kiosk-only. Migration plan:
> `docs/TRANZILA_DEPRECATION_AUDIT.md`. Removing Tranzila code is gated
> on Phase 10 of that plan. Adding Tranzila code is forbidden.

The Nayax sacred-runtime rule stays unchanged. Tranzila no longer
warrants the "sacred" framing — it warrants the deprecation framing.

---

## §12 What this PR does NOT do

- No code change.
- No flag flip (every Tranzila flag remains as-is).
- No schema change.
- No Summit credentials provisioned.
- No PR #283 amendment in this PR (separate amendment PR if approved).
- No PR #286 amendment in this PR (separate amendment PR if approved).
- No SKILL.md update in this PR (separate one-line PR after this merges).
- No removal of any Tranzila code (Phase 10 deferred).
- No protected systems touched (wallet, K9000, Nayax, schema, auth gates,
  dependencies all unchanged).

Implementation gated on CEO answers to §13.

---

## §13 Decisions awaiting CEO

Six decisions. None blocks this audit doc from merging.

- **A. Summit account status.** Does PetWash Ltd already have a production
  Summit account? If yes, name the contact / API key holder. If no, opening
  one is Phase 2 (~2 CEO-days of vendor relationship work).
  *Recommendation: confirm before Phase 3.*

- **B. Sandbox-first vs production-first.** Standard practice: integrate
  against Summit sandbox, ship to production after passing test suite. Any
  reason to deviate?
  *Recommendation: sandbox first. Always.*

- **C. Apple Pay support on Summit.** Does Summit support Apple Pay for the
  Israeli market? Per `docs/APPLE_DEVELOPER_SETUP_PLAN.md` Decision B, the
  iOS native app v1 needs an Apple Pay endpoint. If Summit doesn't support
  it, native iOS launch is gated.
  *Recommendation: CEO confirm with Summit support team before Phase 5.*

- **D. Chargeback clawback policy.** When a chargeback opens, options for
  provider's payout for that booking:
  1. Immediate hold (provider can't withdraw). Lifted if dispute won.
  2. Immediate debit (clawback now). Refunded if dispute won.
  3. Wait for dispute resolution; debit only if lost.
  *Recommendation: Option 1 (hold). Fairest to provider, protects PetWash.*

- **E. UPay account status.** Does PetWash Ltd have a UPay account? Phase
  9 (UPay fallback) is the last non-cleanup phase.
  *Recommendation: defer until Summit is stable in production.*

- **F. Tranzila data retention.** Tables have rows = 0 today. Phase 10
  drops the tables. Any reason to preserve schema or rows past Phase 10
  (e.g. regulatory)?
  *Recommendation: drop tables in Phase 10. Audit log entries already
  capture historical events.*

---

## §14 Strategic equation check (per §0.7)

```
PetWash™ =
  premium pet-care infrastructure       ← Summit reinforces ✓
  + safer everyday washing               ← unaffected
  + cleaner urban living                 ← unaffected
  + eco-conscious operations             ← unaffected
  + scalable deployment system           ← Summit is enterprise-grade Israeli clearing ✓
  + luxury brand discipline              ← invoicing + tax docs cleaner on Summit ✓
```

Summit migration STRENGTHENS three terms of the equation. No term
degrades.

---

## §15 Mission-anchor check (per §0.1)

- **Human convenience:** ✓ — once Summit ships, eGift / wallet / booking
  charges actually work (none do today). The 70-year-old grandmother
  buying an eGift for her son can finish checkout.
- **Pet safety:** N/A.
- **Premium lifestyle:** ✓ — Summit's UX matches Israeli premium banking
  expectations better than Tranzila's iframe.
- **Urban infrastructure value:** ✓ — invoicing + VAT compliance is the
  table-stakes for municipal / commercial-center partners.
- **Environmental:** N/A.

---

## §16 References

- `docs/architecture/01-unified-payment-abstraction.md` — predecessor
  architecture authority. Lists Tranzila as deprecated.
- `docs/finance/transaction-lifecycle-forensic-audit.md:366` — chargeback
  clawback gap documented.
- `docs/APPLE_DEVELOPER_SETUP_PLAN.md` Decision B — Apple Pay endpoint
  dependency on payment processor.
- `.claude/skills/petwash-platform/SKILL.md` §0 (strategy) + §2 (protected
  systems — needs §11 update).
- `server/services/TranzilaService.ts` + sibling services — current code.
- `server/lib/payment-flags.ts` — flag definitions.
- `shared/schema-tranzila.ts` — schema currently in use.
- Summit: `https://sumit.co.il` — vendor docs.
- UPay: `https://upay.co.il` — vendor docs.

---

**End of audit + migration proposal.** No code ships. Implementation
gated on CEO answers to §13 decisions A–F and acceptance of the 10-phase
sequencing in §8.
