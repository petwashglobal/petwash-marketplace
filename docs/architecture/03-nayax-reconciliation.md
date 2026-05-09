# 03 — Nayax Reconciliation Architecture

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 7 (Nayax / Machine Payment Reconciliation).

---

## 1. Objective

Build the operational truth layer that reconciles Nayax-side records (authorisations, captures, settlements, reversals) against PetWash-side records (`nayaxTransactions`, ledger entries, K9000 sessions). Detect and alert on every divergence: abandoned auths, machine-offline mid-cycle, settlement mismatch, double-capture, lost vend, refund failure.

The current state has good per-transaction primitives (PR-J verification; PR-K env guard) but no end-to-end reconciliation loop. Settlement-day gaps go silently into operating loss.

---

## 2. Current state

| Surface | Today |
|---|---|
| Transaction lifecycle | `nayaxTransactions.status` enum: `initiated → authorized → vend_pending → vend_success → settled \| voided \| failed` |
| Verification on top-up | PR-J #209: amount + customerUid + status checked against `nayaxTransactions` row before wallet credit |
| Activation guard | PR-K #206: refuses K9000 wash if `MACHINE_ACTIVATION_URL` missing |
| Webhook ingest | `server/routes/nayax-monyx-events.ts` accepts payloads, persists `nayaxTransactionEvents` |
| Settlement file ingest | NOT implemented |
| Reversal / refund flow | NOT implemented (NayaxSparkService has stubs but no live wiring) |
| Abandoned-auth sweep | NOT implemented |
| Machine-offline mid-cycle handling | Partial (PR-K guard) — no auto-refund for pre-authorised charges that the machine never consumed |
| Reconciliation alerts | NOT implemented |
| Daily close report | NOT implemented |

---

## 3. Target architecture

### 3.1 Canonical Nayax transaction lifecycle (immutable enum)

```
created
   ↓
authorized           ← acquirer holds funds; not yet ours
   ↓
machine_ack          ← K9000 controller confirms it received START command
   ↓
running              ← machine reports cycle in progress
   ↓
completed            ← cycle finished cleanly
   ↓
captured             ← we asked acquirer to capture (settle the auth)
   ↓
settled              ← acquirer paid out to our trust account
─────────────────────────────────────────
   ↓ (alternate paths from any pre-capture state)
failed               ← terminal: customer not charged
voided               ← terminal: auth released; customer not charged
reversed             ← terminal: charged then refunded post-settlement
reconciled           ← admin marker that this row matched a settlement-file row
```

**No silent-success state.** Every transaction must be in one of these states. A row stuck for > N hours in a non-terminal state triggers an alert.

### 3.2 Five reconciliation jobs (cron-driven)

| Job | Cadence | Reads | Writes | Alerts on |
|---|---|---|---|---|
| **abandoned-auth sweep** | every 15 min | `nayaxTransactions` rows in `authorized` for > 30 min without `machine_ack` | `nayax_reversals` queue + voids the auth | any sweep with N > threshold |
| **machine-not-acked sweep** | every 5 min | rows in `machine_ack` for > 10 min without `running` | flags as `failed` + queues auto-refund | per row |
| **incomplete-cycle sweep** | every 10 min | rows in `running` for > expected_duration + grace | flags + queues review | per row |
| **settlement-file reconciliation** | daily at 03:00 Asia/Jerusalem | acquirer's daily settlement CSV (Nayax SFTP / API pull) | matches each row to a `nayaxTransactions` row; writes `nayax_settlement_match` table | mismatch list |
| **chargeback ingestion** | webhook + daily backstop | acquirer chargeback notifications | `nayax_chargebacks` + freezes the related ledger row | per chargeback |

Each job writes a `reconciliation_job_run` row with `started_at`, `finished_at`, `rows_examined`, `variances_found`, `alerts_emitted`, `result_summary`. Per Financial Core Part 9.6.

### 3.3 Mismatch taxonomy

Every variance is classified:

| Code | Meaning | Auto-action | Manual review |
|---|---|---|---|
| `AUTH_NO_MACHINE_ACK` | auth held but machine never acked | void the auth | yes if > 1 per session |
| `MACHINE_ACK_NO_RUN` | controller acked but pump never ran | refund + flag controller | yes |
| `RUN_NO_COMPLETE` | started but cycle never finished | partial refund per policy | yes |
| `SETTLEMENT_AMOUNT_MISMATCH` | acquirer settled different cents than we recorded | hold the diff | yes — finance triages |
| `SETTLEMENT_MISSING_TXN` | acquirer reports a txn we have no record of | block all related operations | yes — security incident |
| `OUR_TXN_MISSING_FROM_SETTLEMENT` | we have a record, acquirer doesn't | flag + retry capture | yes if persistent |
| `CAPTURE_DOUBLE` | two captures against one auth | revert second + alert | yes — bug or attack |
| `CHARGEBACK_RECEIVED` | acquirer reports a chargeback | freeze customer account + provider payout | yes — dispute workflow |

### 3.4 Reversal / refund pathway

A refund is **never** an inline mutation of the original transaction. It is an offsetting entry plus a vendor-side reversal call:

```
1. Look up nayaxTransactions row by id (PR-J pattern).
2. Verify status ∈ {authorized, settled} (no double-refund; status pre-checked).
3. Call NayaxSparkProvider.refund({ originalTxn, amountCents, reason, idempotencyKey }).
4. On vendor success: persist nayax_refund row referencing original; flip original.status to 'reversed'; write paired ledger entries (debit revenue, credit refund_payable).
5. On vendor failure: persist nayax_refund row with status='vendor_failure', alert on-call, do not flip original status.
6. Customer-facing receipt → credit note (Section 4 / Part 6.5).
```

All steps idempotent on the supplied key. The PR-J verification helper is reused for the look-up phase.

### 3.5 Auth-without-consumption auto-refund

Closes the F-11 audit gap (machine-fault customers on Nayax direct flow had no auto-refund). When the activation guard (PR-K) refuses to fire the machine, OR the machine fails to ack, the abandoned-auth sweep voids/refunds the pre-authorised funds. No manual ticket needed for the happy-failure case.

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| No abandoned-auth sweep | critical — money sits at acquirer indefinitely |
| No settlement-file ingest | critical — cannot detect mis-settlement |
| No reconciliation alerts | high — silent loss surface |
| No reversal / refund pathway | high — refunds today require manual intervention |
| Lifecycle enum incomplete (`machine_ack`, `running`, `captured`, `reversed`, `reconciled` don't all exist) | high — schema migration needed |
| No `reconciliation_job_run` table | medium |
| Webhook ingestion lacks event-id de-dup | medium — replay risk |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- Schema migration: extend `nayaxTransactions.status` enum + add `nayax_reversals` + `nayax_settlement_match` + `reconciliation_job_run` tables (separate migration PR).
- Cron registration for the 5 jobs (gated off until source-pin tests pass).
- Settlement-file connector — Nayax SFTP / API pull (read-only credentials; no payment side effects).
- Reversal pathway through the `PaymentProvider` adapter (Section 1).
- Webhook event-id de-dup table.

**Deferred scope:**
- Multi-acquirer reconciliation (only Nayax in v1; UPay / SUMIT in their own roadmap items)
- Chargeback workflow UI (admin dashboard view comes in Section 7)
- Predictive variance detection / ML

---

## 6. Legal / regulatory / financial assumptions

- The acquirer's settlement file is the legal record of what entered our trust account. Our internal record is the legal record of what we sold. Variance investigation is mandatory under Israeli accounting law (`חוק מסמכי חשבונות`).
- Chargebacks must be reported in the period received (not the period of the original transaction) per CPA confirmation.
- Pre-authorised but never-captured funds are NOT revenue — they are acquirer-held customer money. Voiding them is operationally required, not optional.

---

## 7. Open questions for human decision

1. **Settlement-file delivery** — SFTP pull, API pull, or webhook push? Vendor + Ops decide.
2. **Sweep thresholds** — auth abandonment after 30 min default; CFO confirm.
3. **Auto-refund authority** — does the abandoned-auth sweep auto-issue refunds, or does it only queue them for admin click? Counsel recommendation; CEO decides v1 stance.
4. **Variance tolerance** — 0 cents (strict) or N cents (rounding tolerance)? CPA recommendation.
5. **Chargeback hold policy** — freeze customer wallet AND provider payout? CEO + Counsel.
6. **Pull cadence vs push** — Nayax may offer either; pick based on reliability + cost.

---

## 8. Dependency graph

**This section blocks:**
- PR-NAYAX-1 (reconciliation + unconsumed-authorisation audit)
- PR-NAYAX-2 (refund / reversal safety flow)
- Section 5 (marketplace payouts) — payouts cannot release until settlement is reconciled
- Section 7 (admin observability) — the dashboards consume reconciliation tables

**This section is blocked by:**
- Section 1 (`PaymentProvider` adapter) — refund pathway routes through the adapter
- Financial Core Part 7 sign-off
- Vendor settlement-file format confirmed

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Settlement file fails to download (vendor outage) | Daily reconciliation skipped | Job emits "skipped" status row; alert; resume next day; weekly catch-up job |
| Variance threshold tripped due to rounding policy mismatch | False alerts | Tolerance configurable per acquirer; CPA-approved value |
| Reversal call timeout | Original status not flipped; double-refund risk on retry | Idempotency-key on every reversal call; vendor must dedup |
| Webhook event replayed | Double-processed event | event-id de-dup table; UNIQUE constraint |
| Sweep job runs concurrently with itself (cron drift) | Race condition voiding the same auth twice | Advisory lock per sweep type; second instance no-ops |
| Auto-refund issued for a successful vend (false positive) | Customer was charged then refunded a real wash | Conservative thresholds + manual-review gate; auto-refund only fires on lifecycle states with no ambiguity |

---

## 10. Reconciliation strategy (recursive — this section IS the reconciliation strategy)

In addition to the jobs above:

- Per-day report: rows reconciled / rows variant / rows unmatched in either direction
- Per-week report: trend + chargeback rate
- Per-month CFO close report: ties to bank statement of trust account
- Per-quarter CPA report: full variance log + corrective entries

---

## 11. Rollback / offset strategy

- Each cron is independently disablable via env (`NAYAX_RECON_<JOB>_ENABLED=false`). Disabling stops new sweeps; in-flight jobs complete.
- A misposted offset entry is corrected by another offset entry — never by mutating prior rows.
- Schema-migration rollback is its own PR with reverse migration for each enum value added (`status` enum extensions are append-only at the enum-value level for safety).

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-NAYAX-SPEC` | This document | spec |
| `PR-NAYAX-1a` | Schema migration: extend `nayaxTransactions.status` enum + new tables | schema-migration |
| `PR-NAYAX-1b` | Reconciliation jobs (5) — gated OFF; runs collect-only initially | runtime |
| `PR-NAYAX-1c` | Settlement-file connector (read-only) | runtime |
| `PR-NAYAX-1d` | Webhook event-id de-dup | runtime |
| `PR-NAYAX-1e` | Admin dashboard reconciliation views (consumes Section 7) | runtime |
| `PR-NAYAX-1f` | Flip jobs to act-mode (auto-void / auto-refund per CEO policy) | runtime (final) |
| `PR-NAYAX-2a` | Reversal / refund pathway (uses PaymentProvider adapter) | runtime |
| `PR-NAYAX-2b` | Customer-facing refund-status surface | runtime |

Each PR carries the full 12-field metadata (`execution-pr-roadmap.md`).
