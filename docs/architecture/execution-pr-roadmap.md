# Execution PR Roadmap

**Status:** Spec only. No runtime change introduced by the PR that ships this document.

**Purpose:** Per-PR specification metadata for every code PR implied by Sections 01–10. Each entry uses the locked 12-field template from `00-master-roadmap.md §0.6`.

**Hard rules** (govern every entry):

- One PR = one risk
- Spec-only PRs and runtime PRs are distinct
- No mixed-purpose PRs (no payments + bookings + schema + UX in one PR)
- Every runtime PR carries source-pin tests
- Every schema migration is its own PR with rollback plan
- Implementation PRs reference the owning section: `Implements: docs/architecture/<NN>.md §X.Y`

**Scope class legend:**

- `spec` — docs only; no runtime change
- `runtime` — code change; no schema migration
- `schema-migration` — DDL only; runtime that consumes the schema is a separate PR
- `data-migration` — backfill / reclassification of existing rows
- `runtime + Ops` — requires Ops action (secret provisioning, bank coordination, etc.)
- `runtime + UX` — requires product / UX sign-off

---

## Sequencing Overview

```
NOW:    Section 1-10 spec PRs (this pack)
        ─────────────────────────────────────
        ↓ each section spec approved
NEXT:   Per-section spec deepening (where needed) + schema migrations
        (each schema migration PR is single-purpose, rollback-ready)
        ↓ migrations land + green
THEN:   Runtime PRs in dependency order
        ↓ each runtime PR single-purpose, source-pin tested
LATER:  Live cutover PRs (smallest possible flip; kill switch primed)
```

---

## SECTION 01 — Unified Payment Abstraction

### `PR-UPAY-1`
```
Objective:                 SUMIT/UPay API discovery + docs only — produce
                            the request/response mapping draft used by PR-UPAY-3.
Exact scope:               docs/architecture/upay-api-discovery.md
                            + .env.example commentary (no new env keys yet)
Explicit out-of-scope:     no SDK install, no client code, no live calls,
                            no env-config validation
Runtime risk:              none (docs only)
Fraud risk:                none
Migration risk:            none
Rollback strategy:         single-revert of the docs PR
Monitoring requirements:   none
Rollout order:             prerequisite: vendor contract signed (Open Q)
                            blocks: PR-UPAY-2
Dependency graph:          vendor (UPay/SUMIT) API documentation access
Docs-only vs runtime PR:   spec
Estimated blast radius:    zero — documentation
```

### `PR-UPAY-2`
```
Objective:                 env + feature flag + config validation only —
                            extend payment-provider-mode for SUMIT/UPay
                            without wiring any client.
Exact scope:               server/lib/payment-provider-mode.ts
                            (extend validateProductionPaymentSecrets)
                            + .env.example new env block
                            + server/tests/paymentProviderMode.regression.test.ts
                            (new test cases for SUMIT path)
Explicit out-of-scope:     no SDK install, no client code, no live calls
Runtime risk:              low (config-only; production fail-closed if
                            SUMIT_ENABLED=true and secrets missing,
                            mirroring NAYAX pattern from PR-CI-PAYMENT-MODE)
Fraud risk:                none
Migration risk:            none
Rollback strategy:         single-revert; no schema; no live impact unless
                            SUMIT_ENABLED is flipped on
Monitoring requirements:   /health/strict reports SUMIT mode + missing-secrets
Rollout order:             prerequisite: PR-UPAY-1
                            blocks: PR-UPAY-3
Dependency graph:          GCP Secret Manager has SUMIT_* slots provisioned
                            (Ops, can be empty placeholders)
Docs-only vs runtime PR:   runtime
Estimated blast radius:    1 server module + 1 env file + 1 test file
```

### `PR-UPAY-3`
```
Objective:                 client/service abstraction only — implement
                            SUMIT/UPay PaymentProvider adapter behind the
                            interface; mock-mode + adapter audit table only.
                            NO live charge yet.
Exact scope:               server/services/payment-providers/SumitProvider.ts
                            + per-provider audit table (separate
                            schema-migration PR PR-UPAY-3-SCHEMA below)
                            + adapter resolver wiring in
                            server/lib/payment-provider-mode.ts
                            + tests
Explicit out-of-scope:     no live charge, no booking/wallet integration,
                            no webhook receiver
Runtime risk:              low (resolver guarded by mode flag; default mock)
Fraud risk:                none (no live calls)
Migration risk:            schema migration is a SEPARATE PR
                            (PR-UPAY-3-SCHEMA); this PR is runtime-only
Rollback strategy:         single-revert; resolver still answers with mock
Monitoring requirements:   adapter-call metrics added (latency, error class)
Rollout order:             prerequisite: PR-UPAY-2 + PR-UPAY-3-SCHEMA
                            blocks: PR-UPAY-4, PR-UPAY-7
Dependency graph:          docs/architecture/01-unified-payment-abstraction.md
                            §3.1 interface signed off
Docs-only vs runtime PR:   runtime
Estimated blast radius:    new module + resolver edit; no live money path
```

### `PR-UPAY-3-SCHEMA`
```
Objective:                 Schema migration: add upay_audit table for
                            verbatim vendor payload retention.
Exact scope:               drizzle migration + table definition in
                            shared/schema-payments.ts
Explicit out-of-scope:     no runtime consuming code (PR-UPAY-3 consumes)
Runtime risk:              low (additive table; no existing reads/writes)
Fraud risk:                none
Migration risk:            additive only; rollback drops table
Rollback strategy:         reverse migration (drop table) in same PR
Monitoring requirements:   none yet
Rollout order:             prerequisite: PR-UPAY-2
                            blocks: PR-UPAY-3
Dependency graph:          n/a
Docs-only vs runtime PR:   schema-migration
Estimated blast radius:    one new table; zero existing rows touched
```

### `PR-UPAY-4`
```
Objective:                 webhook receiver + signature verification +
                            idempotency only. No business logic.
Exact scope:               server/routes/upay-webhooks.ts (new)
                            + server/services/payment-providers/SumitProvider
                              .verifyWebhook implementation
                            + webhook event-id de-dup table
                              (separate schema-migration PR if not yet)
                            + tests
Explicit out-of-scope:     no consumer-of-webhook business logic; webhook
                            handler only persists + acks
Runtime risk:              medium (new public endpoint; signature verify
                            is the security boundary)
Fraud risk:                medium — replay risk if dedup not strict;
                            mitigated by event-id UNIQUE
Migration risk:            schema migration in separate PR
Rollback strategy:         feature flag on the route; flip OFF
Monitoring requirements:   per-event metrics, signature-failure metric,
                            replay-attempt metric
Rollout order:             prerequisite: PR-UPAY-3 (adapter exists)
                            blocks: PR-UPAY-5
Dependency graph:          webhook URL configured at vendor side (Ops);
                            allowlist of vendor IPs
Docs-only vs runtime PR:   runtime
Estimated blast radius:    one new public endpoint + one new table
```

### `PR-UPAY-5`
```
Objective:                 invoice / receipt lifecycle wiring for online
                            payments — TaxDocumentService consumes
                            adapter results to issue documents per
                            Section 04 templates.
Exact scope:               server/services/TaxDocumentService.ts wiring
                            + invoice-issuance call sites in the booking /
                              top-up consumers of the adapter result
                            + tests
Explicit out-of-scope:     no SHAAM digital signature (separate PR-COMPLIANCE-2)
Runtime risk:              medium — issues real documents; numbering
                            authority writes
Fraud risk:                low (gated by adapter result; PR-J-style verification)
Migration risk:            none
Rollback strategy:         feature flag on the issuance branch
Monitoring requirements:   per-document-class issuance count + numbering
                            gap-detector (PR-COMPLIANCE-1)
Rollout order:             prerequisite: PR-UPAY-4 + PR-COMPLIANCE-1
                            blocks: PR-UPAY-6, PR-UPAY-7
Dependency graph:          Section 04 invoice templates finalised
Docs-only vs runtime PR:   runtime
Estimated blast radius:    issuance call sites + new document rows
```

### `PR-UPAY-6`
```
Objective:                 recurring memberships / subscriptions via SUMIT.
Exact scope:               subscription model + cron + adapter
                            .createRecurring + .cancelRecurring flows
                            + tests
Explicit out-of-scope:     no membership-tier UX; no benefit redemption
Runtime risk:              high — recurring billing creates ongoing money
                            movement
Fraud risk:                medium — subscription fraud vector (Section 09)
Migration risk:            schema for subscription state (separate PR)
Rollback strategy:         feature flag; existing subs handled via
                            grandfather mode while new sign-ups blocked
Monitoring requirements:   subscription churn, payment-failure rate,
                            anomaly alerts
Rollout order:             prerequisite: PR-UPAY-5
                            blocks: customer-facing subscription rollout
Dependency graph:          Provider Master Agreement clauses (if applicable);
                            counsel review of subscription terms
Docs-only vs runtime PR:   runtime
Estimated blast radius:    new domain (subscriptions); new cron; new tables
```

### `PR-UPAY-7`
```
Objective:                 prepaid wash packages + wallet top-up via UPay/SUMIT.
                            Routes top-ups through the SUMIT adapter and
                            into wallet.cash bucket (per Section 02).
Exact scope:               server/routes/credit-wallet.ts /topup wiring
                            for SUMIT path
                            + per-bucket credit (Section 02 dependency)
                            + tests
Explicit out-of-scope:     no wallet-bucket migration (Section 02 land first)
Runtime risk:              high — live customer money flow
Fraud risk:                medium — verification reused from PR-J pattern
                            for SUMIT adapter
Migration risk:            none
Rollback strategy:         feature flag per provider; fall back to mock
                            (which 402s, customers told to retry)
Monitoring requirements:   per-provider top-up volume, success rate,
                            verification-rejection rate
Rollout order:             prerequisite: PR-UPAY-6 (or independently after
                            PR-UPAY-5 + PR-WALLET-1c) + PR-WALLET-1c
Dependency graph:          Section 02 bucket model deployed
Docs-only vs runtime PR:   runtime
Estimated blast radius:    /topup route + per-bucket integration
```

---

## SECTION 02 — Wallet Redesign

### `PR-WALLET-SPEC`
```
Objective:                 Pre-spec for the WALLET-1 sub-PRs (already in
                            this pack as 02-wallet-redesign.md).
Exact scope:               docs only
Runtime risk:              none
(other fields: see 02-wallet-redesign.md §12)
```

### `PR-WALLET-1a` (schema-migration)
```
Objective:                 Add `bucket` discriminator column to
                            creditTransactions + DB triggers blocking
                            UPDATE/DELETE on financial rows.
Exact scope:               drizzle migration files + schema.ts
Explicit out-of-scope:     no consuming code (PR-WALLET-1c does)
Runtime risk:              low (additive column; default backfill is
                            wallet.cash; trigger applies to new rows
                            unless rollback exists)
Fraud risk:                none
Migration risk:            schema-included; rollback = drop column +
                            drop triggers
Rollback strategy:         reverse migration in same PR; tested on staging first
Monitoring requirements:   migration-runtime metric, row-count attestation
Rollout order:             prerequisite: WALLET-SPEC approved
                            blocks: PR-WALLET-1b
Dependency graph:          staging dry-run + CPA sign-off on default-bucket
                            classification
Docs-only vs runtime PR:   schema-migration
Estimated blast radius:    creditTransactions table + new triggers
```

### `PR-WALLET-1b` (data-migration)
```
Objective:                 Backfill bucket classification for existing
                            credit transactions (dry-run first → CPA report
                            → real backfill).
Exact scope:               server/scripts/backfill-wallet-buckets.ts
                            + dry-run output stored as audit artefact
Explicit out-of-scope:     no service-layer change
Runtime risk:              medium (large UPDATE; long-running)
Fraud risk:                none
Migration risk:            data-migration; idempotent via WHERE bucket IS NULL
Rollback strategy:         null out the bucket column (only column-level
                            rollback; row data preserved)
Monitoring requirements:   per-bucket pre/post counts; audit log of
                            classification rule applied
Rollout order:             prerequisite: PR-WALLET-1a (column exists)
                            blocks: PR-WALLET-1c
Dependency graph:          CPA sign-off on dry-run report
Docs-only vs runtime PR:   data-migration
Estimated blast radius:    every existing creditTransactions row touched
```

### `PR-WALLET-1c` (runtime)
```
Objective:                 walletService bucket-aware methods +
                            deterministic redemption-order helper.
Exact scope:               server/services/WalletService.ts (or new
                            BucketAwareWalletService) + tests
Explicit out-of-scope:     no UI; no removal of legacy methods (PR-WALLET-1f)
Runtime risk:              high (wallet money paths)
Fraud risk:                low — verification still gates inputs
Migration risk:            none
Rollback strategy:         feature flag toggles between legacy + new methods
Monitoring requirements:   per-bucket-balance reconciliation alerts
Rollout order:             prerequisite: PR-WALLET-1b
                            blocks: PR-WALLET-1d, PR-WALLET-1e, PR-WALLET-1f
Dependency graph:          Section 02 §3.2 redemption order signed off
Docs-only vs runtime PR:   runtime
Estimated blast radius:    every wallet read/write site
```

### `PR-WALLET-1d` (runtime)
```
Objective:                 Reconciliation daily job: per-customer + per-
                            bucket sum invariant.
Exact scope:               server/jobs/wallet-reconciliation.ts + alert wiring
Explicit out-of-scope:     no auto-correction (alert only)
Runtime risk:              low (read-only)
Fraud risk:                none (signal generator)
Migration risk:            none
Rollback strategy:         disable cron via env flag
Monitoring requirements:   alert-rate metric; false-positive review
Rollout order:             prerequisite: PR-WALLET-1c
Dependency graph:          n/a
Docs-only vs runtime PR:   runtime
Estimated blast radius:    cron + alert routing
```

### `PR-WALLET-1e` (runtime + UX)
```
Objective:                 Admin dashboard per-bucket views (Section 07
                            integration).
Exact scope:               admin route + dashboard panel
Explicit out-of-scope:     no customer-facing UI
Runtime risk:              low (read-only admin)
Fraud risk:                none
Migration risk:            none
Rollback strategy:         feature flag the panel
Monitoring requirements:   admin-action audit
Rollout order:             prerequisite: PR-WALLET-1c + PR-ADMIN-1
Dependency graph:          Section 07 dashboards available
Docs-only vs runtime PR:   runtime + UX
Estimated blast radius:    admin UI only
```

### `PR-WALLET-1f` (runtime — final)
```
Objective:                 Legacy walletService methods removal + flag flip.
Exact scope:               delete deprecated methods; flip flag default to
                            new path
Explicit out-of-scope:     no behaviour change for new methods
Runtime risk:              high — flag flip gates real money
Fraud risk:                none
Migration risk:            none
Rollback strategy:         single-revert; flag re-flips
Monitoring requirements:   error rate spike monitor for 48h post-flip
Rollout order:             final in WALLET-1 sub-sequence; after PR-WALLET-1d
                            stable
Dependency graph:          all prior sub-PRs merged + soak time
Docs-only vs runtime PR:   runtime
Estimated blast radius:    every wallet caller flipped to new path
```

---

## SECTION 03 — Nayax Reconciliation

### `PR-NAYAX-SPEC`
```
Objective: pre-spec (already in pack as 03-nayax-reconciliation.md)
Other fields: see 03-nayax-reconciliation.md §12
```

### `PR-NAYAX-1a` (schema-migration)
```
Objective:                 Extend nayaxTransactions.status enum +
                            nayax_reversals + nayax_settlement_match +
                            reconciliation_job_run tables.
Exact scope:               drizzle migrations + schema.ts
Explicit out-of-scope:     no consuming code
Runtime risk:              low (additive)
Fraud risk:                none
Migration risk:            additive; rollback drops new tables, removes
                            new enum values (Postgres allows enum value
                            removal only via specific path; tested on
                            staging first)
Rollback strategy:         reverse migration in same PR
Monitoring requirements:   none
Rollout order:             prerequisite: NAYAX-SPEC approved
                            blocks: PR-NAYAX-1b
Dependency graph:          n/a
Docs-only vs runtime PR:   schema-migration
Estimated blast radius:    enum + 3 tables
```

### `PR-NAYAX-1b` (runtime)
```
Objective:                 Reconciliation jobs (5) — collect-only mode
                            (no auto-action). Writes reconciliation_job_run
                            rows + classifies variances. No automatic voids
                            or refunds.
Exact scope:               server/jobs/nayax-reconcile-*.ts (5 files)
                            + cron registration in backgroundJobs.ts
Explicit out-of-scope:     no auto-action (1f flips on)
Runtime risk:              low (read + classify)
Fraud risk:                none
Migration risk:            none
Rollback strategy:         per-cron env flag
Monitoring requirements:   per-job latency, run count, variance count
Rollout order:             prerequisite: PR-NAYAX-1a
                            blocks: PR-NAYAX-1c
Dependency graph:          settlement-file format confirmed
Docs-only vs runtime PR:   runtime
Estimated blast radius:    cron registration; no money side effect
```

### `PR-NAYAX-1c` (runtime + Ops)
```
Objective:                 Settlement-file connector (read-only).
Exact scope:               SFTP / API pull client + parser + insert into
                            nayax_settlement_match.staging
Explicit out-of-scope:     no matching logic (jobs do)
Runtime risk:              low
Fraud risk:                low
Migration risk:            none
Rollback strategy:         disable cron via env flag
Monitoring requirements:   pull-success rate; staging-row count
Rollout order:             prerequisite: PR-NAYAX-1a
Dependency graph:          Nayax SFTP credentials + IP allowlist (Ops)
Docs-only vs runtime PR:   runtime + Ops
Estimated blast radius:    new connector; no business-logic side effect
```

### `PR-NAYAX-1d` (runtime)
```
Objective:                 Webhook event-id de-dup (also Section 09 dependency).
Exact scope:               webhook_event_id table + UNIQUE + receiver wiring
Explicit out-of-scope:     no business-logic change
Runtime risk:              low
Fraud risk:                medium — replay protection
Migration risk:            schema (one new table) — separate PR ideally
                            (or co-included if very small)
Rollback strategy:         feature flag the dedup check
Monitoring requirements:   replay-attempt metric
Rollout order:             before any auto-action (PR-NAYAX-1f)
Dependency graph:          n/a
Docs-only vs runtime PR:   schema-migration + runtime (split if migration
                            is risky)
Estimated blast radius:    one table + receiver code
```

### `PR-NAYAX-1e` (runtime)
```
Objective:                 Admin dashboard reconciliation views (Section 07).
Exact scope:               admin pages reading reconciliation tables
Explicit out-of-scope:     no mutation
Runtime risk:              low (read-only)
(other fields per 03-nayax-reconciliation.md §12)
```

### `PR-NAYAX-1f` (runtime — final)
```
Objective:                 Flip jobs to act-mode (auto-void abandoned auths
                            per CEO policy).
Exact scope:               feature flag flip + auto-action code
Explicit out-of-scope:     refund pathway is PR-NAYAX-2
Runtime risk:              high — first time we move acquirer-side money
                            automatically
Fraud risk:                medium — false positives = wrongly voided auths
Migration risk:            none
Rollback strategy:         feature flag flip (single env change)
Monitoring requirements:   per-action volume + variance
Rollout order:             after 1b/1c/1d/1e stable + soak
Dependency graph:          CEO sign-off on auto-action policy
Docs-only vs runtime PR:   runtime
Estimated blast radius:    money side effects on previously inert jobs
```

### `PR-NAYAX-2a` (runtime)
```
Objective:                 Reversal / refund pathway via PaymentProvider
                            adapter (Section 1).
Exact scope:               refund flow + adapter call + ledger entries +
                            credit-note issuance (Section 4 integration)
Explicit out-of-scope:     no admin UI (PR-NAYAX-2b does)
Runtime risk:              high — outbound money movement
Fraud risk:                medium — refund-abuse vector
Migration risk:            none (uses tables from PR-NAYAX-1a)
Rollback strategy:         feature flag refund per channel
Monitoring requirements:   per-refund volume, vendor-failure rate, mismatch
                            rate
Rollout order:             prerequisite: Section 04 + PR-NAYAX-1f stable
Dependency graph:          legal/CPA sign-off on refund policy + Provider
                            Master Agreement clauses
Docs-only vs runtime PR:   runtime
Estimated blast radius:    refund call sites
```

### `PR-NAYAX-2b` (runtime + UX)
```
Objective:                 Customer-facing refund-status surface.
Exact scope:               account-history component + status query API
Explicit out-of-scope:     no admin tooling
Runtime risk:              low (read-only)
(other fields straightforward)
```

---

## SECTION 04 — Israeli Compliance

(Detailed PR list in `04-israeli-compliance.md §12`. Each PR follows the same metadata template; key risk profile summarised here.)

| PR | Class | Runtime risk | Fraud risk | Notes |
|---|---|---|---|---|
| `PR-COMPLIANCE-1` Numbering gap-detector | runtime | low | none | read-only cron |
| `PR-COMPLIANCE-2` SHAAM digital signature | runtime + Ops | medium | none | requires HSM / KMS |
| `PR-COMPLIANCE-3` Refund credit-note lineage | runtime | medium | low | schema may be needed |
| `PR-COMPLIANCE-4` B2B / B2C toggle | runtime + UX | low | low | UX change |
| `PR-COMPLIANCE-5` Multi-language version pinning | runtime | low | none | template enforcement |
| `PR-COMPLIANCE-6` 7-year retention warm-tier | runtime + Ops | low | none | storage class config |
| `PR-COMPLIANCE-7` Customer "all my documents" view | runtime + UX | low | none | UX |

---

## SECTION 05 — Marketplace Payouts

(Detailed PR list in `05-marketplace-payouts.md §12`. Critical-path PRs:)

| PR | Class | Runtime risk | Fraud risk | Notes |
|---|---|---|---|---|
| `PR-PAYOUT-1` Provider tax-status snapshot | schema + runtime | medium | low | Part 1.5 immutable |
| `PR-PAYOUT-2` Lifecycle state machine schema | schema | low | none | enum + tables |
| `PR-PAYOUT-3` Hardcoded-rate fix | runtime | low | low | small, fast — separate PR |
| `PR-PAYOUT-4` Loyalty pro-rata fix | runtime | low | low | closes audit finding #7 |
| `PR-PAYOUT-5` Escrow consolidation | schema + runtime | high | medium | Firestore→Postgres |
| `PR-PAYOUT-6` Dispute freeze | runtime | medium | medium | gates payouts |
| `PR-PAYOUT-7` Withholding ledger | runtime | medium | none | tax accrual |
| `PR-PAYOUT-8` Masav generator | runtime | medium | low | file write only |
| `PR-PAYOUT-9` Bank submission cutover | runtime + Ops | very high | medium | first live payout |
| `PR-PAYOUT-10` Per-batch reconciliation | runtime | low | none | read + alert |
| `PR-PAYOUT-11` Provider statement | runtime | medium | none | doc class |
| `PR-PAYOUT-12` Failed-payout retry | runtime | medium | medium | retry safety |
| `PR-PAYOUT-13` Velocity caps + KYC re-verify | runtime + Sec | medium | high | fraud gate |

---

## SECTION 06 — Booking Consistency

(Detailed PR list in `06-booking-consistency.md §12`.)

| PR | Class | Runtime risk | Fraud risk | Notes |
|---|---|---|---|---|
| `PR-BOOKING-1` Lock-token usage audit | runtime | medium | medium | closes double-book risk |
| `PR-BOOKING-2` Unified cancellation fan-out | runtime | medium | low | ensures fan-out completes |
| `PR-BOOKING-3` Booking expiry sweeps (3 classes) | runtime | medium | low | timeout truth |
| `PR-BOOKING-4` Postgres → Firestore sync helper | runtime | medium | none | one-way authority |
| `PR-BOOKING-5` provider_availability nightly refresh | runtime | low | none | derivative cache |
| `PR-BOOKING-6` State-transition CHECK constraints | schema-migration | medium | low | invariant lock |
| `PR-BOOKING-7` Drift-detector job | runtime | low | none | signal generator |
| `PR-BOOKING-8..N` Per-vertical table consolidation | schema + runtime | high | medium | multi-PR sequence |

---

## SECTION 07 — Admin Observability

(Detailed PR list in `07-admin-observability.md §12`.)

| PR | Class | Runtime risk | Fraud risk | Notes |
|---|---|---|---|---|
| `PR-ADMIN-1` 5-room scaffolding + audit middleware | runtime | low | none | RBAC-gated |
| `PR-ADMIN-2` Trust-account live read + reconciliation room | runtime | low | none | depends on Section 03 |
| `PR-ADMIN-3` Per-provider payout state reads | runtime | low | none | depends on Section 05 |
| `PR-ADMIN-4` Fraud signal queue + dashboards | runtime | low | none | depends on Section 09 |
| `PR-ADMIN-5` Kill-switch surface | runtime | medium | low | flips affect customers |
| `PR-ADMIN-6` Export package endpoint | runtime | low | low | rate-limited |
| `PR-ADMIN-7` Daily close digest + alert routing | runtime + Ops | low | none | email + Slack |
| `PR-ADMIN-8` Drift / freshness self-check | runtime | low | none | signal generator |

---

## SECTION 08 — Production Hardening

(Detailed PR list in `08-production-hardening.md §12`.)

| PR | Class | Runtime risk | Fraud risk | Notes |
|---|---|---|---|---|
| `PR-HARDEN-1..N` CVE patches | runtime + dep | per-package | none | one PR per package or cohort |
| `PR-HARDEN-RUNBOOKS-1..7` Incident runbooks | docs | none | none | per class |
| `PR-HARDEN-2` Pre-deploy secret validation workflow | runtime (CI) | low | low | gates production deploy |
| `PR-HARDEN-3` Warm-tier audit storage | runtime + Ops | low | none | retention config |
| `PR-HARDEN-4` Staging environment isolation | Ops | medium | none | infra |
| `PR-HARDEN-5` Secret rotation schedule | Ops | low | medium | reduces compromise window |
| `PR-HARDEN-6` Annual ownership attestation | docs | none | none | governance |

---

## SECTION 09 — Fraud / Risk

(Detailed PR list in `09-fraud-risk-matrix.md §12`.)

| PR | Class | Runtime risk | Fraud risk | Notes |
|---|---|---|---|---|
| `PR-FRAUD-1` risk_signal schema + write library | schema + runtime | low | none | foundation |
| `PR-FRAUD-2` Velocity caps wallet top-up | runtime | low | high impact | reduces F-05-class |
| `PR-FRAUD-3` Velocity caps payouts | runtime | medium | high impact | per-provider cap |
| `PR-FRAUD-4` Velocity caps referrals + promos | runtime | low | medium impact | abuse mitigation |
| `PR-FRAUD-5` Webhook event-id de-dup | runtime + schema | low | high impact | also Section 03 |
| `PR-FRAUD-6` Per-batch payout fraud gate | runtime | medium | high | gates Section 05 cutover |
| `PR-FRAUD-7..N` Per-vector runbooks | docs | none | none | one per vector |
| `PR-FRAUD-8` Customer freeze messaging | runtime + UX | low | none | UX |

---

## SECTION 10 — Global Scaling

NO PRs implied in v1 (informational). Per-region PR sequences are drafted at the time CEO decides cross-border launch.

---

## Summary Table — All Sections

| Section | # PRs in v1 | Runtime risk profile |
|---|---|---|
| 01 — Unified Payment Abstraction | 8 (UPAY-1..7 + UPAY-3-SCHEMA) | mixed; UPAY-7 highest |
| 02 — Wallet Redesign | 6 (WALLET-1a..1f + spec) | high (1f flip) |
| 03 — Nayax Reconciliation | 8 | high (1f flip + 2a) |
| 04 — Israeli Compliance | 7 | medium (2 = SHAAM) |
| 05 — Marketplace Payouts | 13 | very high (PAYOUT-9 cutover) |
| 06 — Booking Consistency | 8+ | medium |
| 07 — Admin Observability | 8 | low (mostly read) |
| 08 — Production Hardening | 6 + N CVE patches | low-medium |
| 09 — Fraud / Risk | 8+ | mixed |
| 10 — Global Scaling | 0 (deferred) | n/a |
| **TOTAL v1 implementation PRs** | **~70+** | spread by risk class |

Each PR is single-purpose and individually reversible. Per CEO's "Fast, but clean. One PR = one risk" rule.

---

## How to use this roadmap

1. Pick a section to deepen (CEO + Eng).
2. The first PR in that section is the **section spec PR** (already in this pack). It is the green-light to start the implementation PR sequence.
3. Each implementation PR opens with a Gate-1 report referencing this roadmap entry.
4. Schema-migration PRs are scheduled separately from runtime PRs, with their own rollback plan.
5. Ops / Sec / Counsel / CPA / Vendor dependencies are explicit per entry — work in parallel.
6. Live cutover PRs (the "1f" pattern) are always last in their sub-sequence and require explicit CEO approval.

---

## Standing rules per PR

- **Source-pin tests:** every runtime PR adds source-pin tests pinning the change against future regression
- **No fake success:** every PR conforms to Rule H from PR-CI-PAYMENT-MODE
- **Single-revert:** every PR can be reverted with `git revert` (or `git revert -m 1` for merges) and the system returns to the prior known-good state
- **Family suite preserved:** `npx vitest run server/tests/*.regression.test.ts` must remain green
- **tsc baseline preserved:** `npx tsc --noEmit | grep -c "error TS"` must not increase
- **Out-of-scope declared:** every PR explicitly lists what it does NOT change
- **Audit trail:** PR body footer carries `Implements: docs/architecture/<NN>.md §X.Y`
