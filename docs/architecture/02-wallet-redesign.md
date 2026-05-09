# 02 — Wallet System Redesign

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 3 (Wallet & Balance Truth) — this section is the engineering plan to implement Part 3.

---

## 1. Objective

Replace the current single-bucket wallet (where cash top-ups, e-gift purchases, and promo credits are conflated) with **explicitly separated balance buckets**, each with its own legal status, redemption rules, refund eligibility, and audit invariants.

The current model violates Part 0.4 (trust funds in custody), Part 0.7 (VAT obligation per source), and creates real fraud / accounting risk.

---

## 2. Current state

| Concern | Today |
|---|---|
| Top-up route | `server/routes/credit-wallet.ts` `/topup` — credits an `'egift'` bucket regardless of source (verified PR-J #209) |
| Wallet schema | `walletAccounts` + `creditTransactions` exist; balance is a single column |
| Verification | PR-J added Nayax-side verification before credit (status / amount / customerUid) |
| Idempotency | PR-W4 layer in place (`walletIdempotencyKeys` UNIQUE) |
| Bucket separation | NONE — top-up cash, gift card balance, promotional credit, loyalty all live in the same bucket |
| Refund eligibility | NOT differentiated — refunding "any" credit pulls from the same balance |
| VAT timing | Top-up is recorded as `vatMode: 'deferred_liability'` per `TransactionEngine.VERTICAL_CONFIG`; redemption fires the VAT event. But because buckets aren't separated, the deferred-liability VAT amount can be miscomputed when promo credits are mixed in. |

**Audit finding F-05** (now mitigated by PR-J) called out the bucket conflation as a blocker for clean accounting; PR-J only fixed the verification, not the bucket separation.

---

## 3. Target architecture

### 3.1 Seven distinct balance buckets

Per Financial Core Part 3.2 (which CEO ratified earlier):

| Bucket | Source | Refundable to card? | VAT timing | Expirable? |
|---|---|---|---|---|
| `wallet.cash` | Customer top-up via verified payment | Yes (within statutory window) | Deferred liability; fires at redemption | No |
| `wallet.promotional` | Pet Wash issues as marketing | Never (no underlying payment) | Marketing expense, not deferred revenue | Yes (per legal limits) |
| `wallet.gift_card_received` | Inbound from a purchased gift card | Per gift-card policy | Deferred liability; fires at redemption | Yes (Israeli gift-card law) |
| `wallet.refund_credit` | Issued in lieu of a card refund (customer election only) | No (already chose credit instead of refund) | Per credit-note rules (Part 6.5) | Per legal limits |
| `wallet.loyalty_points` | Earned from real spend | No (per loyalty terms) | n/a (point system, not money) | Yes (typical) |
| `wallet.escrow_pending` | Funds for a confirmed but not yet delivered booking | Refundable on cancel per policy | VAT held until completion | n/a (pending) |
| `wallet.non_refundable_bonus` | Pet Wash discretionary credit (referrals etc.) | No | Marketing expense | Yes |

**Buckets never mix in one balance field.** Reconciliation invariant: `sum(buckets) === ledger-derived total`. If the invariant breaks, the daily reconciliation job alerts (Section 7).

### 3.2 Redemption order (deterministic)

When a customer pays with their wallet, redemption draws from buckets in this order:

```
1. wallet.escrow_pending     (if the redemption matches the booking the escrow is held for)
2. wallet.refund_credit      (already paid for, customer elected credit)
3. wallet.gift_card_received (gift cards expire — burn first)
4. wallet.cash               (customer money)
5. wallet.promotional        (Pet Wash marketing money)
6. wallet.non_refundable_bonus (lowest priority; never converts back to cash)
```

`wallet.loyalty_points` is a separate redemption flow (points → discount factor), not money-additive.

### 3.3 Per-bucket transaction journal

Each bucket has its own row class in `creditTransactions` with a `bucket` discriminator column. Reads are bucket-aware (`SELECT ... WHERE walletId = ? AND bucket = ?`).

### 3.4 Bucket transitions are explicit

A credit cannot silently move from one bucket to another. If a refund flips `wallet.cash` → `wallet.refund_credit`, that is an explicit ledger entry pair: debit cash bucket, credit refund_credit bucket, with `txn_kind = 'bucket_reclassify'`. Append-only.

### 3.5 Audit immutability

- `creditTransactions` becomes append-only at the database level (DB trigger blocks `UPDATE` / `DELETE` on the rows; corrections are offsetting entries).
- Each row carries the **locked-nine** fields per Financial Core Part 2.5:
  - `id` (UUID v7), `created_at` UTC, `actor_kind`+`actor_id`, `origin_subsystem`, `idempotency_key`, linked refs, `ledger_hash_pointer`, `human_ref`, `canonical_type`.
- Hash chain extends the existing audit-event chain.

---

## 4. Gaps from current to target

| Gap | Owner | Severity |
|---|---|---|
| No `bucket` column on `creditTransactions` | Eng (schema migration PR) | high |
| No DB trigger preventing UPDATE/DELETE on `creditTransactions` | Eng (schema migration PR) | high |
| `walletService.addCredits()` accepts a string source but doesn't enforce bucket invariants | Eng | high |
| No deterministic redemption-order helper | Eng | high |
| `walletAccounts.balance` is a single column — needs split or computed view | Eng + CPA | medium (compat-bridge possible) |
| Reconciliation invariant job missing | Eng + Ops | medium |
| Locked-nine fields not yet on `creditTransactions` | Eng | medium |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- Schema migration introducing `bucket` discriminator + DB triggers (its own migration PR with rollback)
- Backfill plan: every existing row classified as `wallet.cash` (default) or `wallet.gift_card_received` (where source attribution allows). Backfill runs in its own data-migration PR with audit log.
- `walletService` API replaced with bucket-aware variants; legacy methods marked deprecated and feature-flagged off after one migration window.
- Reconciliation job daily.
- Per-bucket displays in admin dashboard (Section 7).

**Deferred scope:**
- Customer-facing per-bucket display in the app (UX decision, separate PR class)
- Loyalty-points redemption refactor (separate roadmap item)
- Multi-currency wallet (Section 10)

---

## 6. Legal / regulatory / financial assumptions

- Wallet is **deferred obligation**, not stored value (Part 0.4.3). Bucket separation does not change this.
- Israeli gift-card law (`חוק הגנת הצרכן (כרטיסי אשראי / כרטיסי תשלום)`) sets minimum lifetime + refund rights for `gift_card_received`. CPA + counsel confirm before code lands.
- Promotional credit is a **marketing expense** at issue, not deferred revenue (Part 0.2.4).
- Trust-fund segregation rule (Part 0.4.2): the bank-side balance for `wallet.cash` + `wallet.gift_card_received` + `wallet.escrow_pending` + `wallet.refund_credit` MUST sit in the trust account, separated from operating funds.

---

## 7. Open questions for human decision

1. **Retroactive backfill** — every existing wallet credit defaults to `wallet.cash`? Or do we attempt source attribution from `creditTransactions.transactionType`?
2. **Refund election UX** — when a refund is offered, can the customer choose card-refund vs `wallet.refund_credit`? Today the code mostly issues credit by default. Counsel rules; UX follows.
3. **Promotional credit expiry policy** — 12 months default? CEO sets.
4. **Loyalty points** — keep separate from money buckets entirely (recommended) or fold into `wallet.non_refundable_bonus` for storage?
5. **Cap per bucket** — anti-abuse caps (e.g. max `wallet.promotional` per user per month) — Sec input required.

---

## 8. Dependency graph

**This section blocks:**
- PR-WALLET-1 (the schema migration + backfill)
- Section 5 (marketplace payouts) — payouts pull only from confirmed-payment buckets
- Section 4 (Israeli compliance) — invoice / receipt flow per bucket
- Section 9 (fraud matrix) — promotional / non-refundable abuse caps

**This section is blocked by:**
- Financial Core Part 3 sign-off (CEO + CPA)
- Israeli gift-card legal review
- Bucket-policy decisions in the Open Questions list

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Bucket invariant breaks (sum diverges from ledger) | Customer balance lies | Hourly reconciliation alert; admin auto-freeze if drift > tolerance |
| Backfill mis-classifies a `gift_card_received` as `wallet.cash` | Promo credit treated as cash → inflated apparent revenue | Backfill PR runs in dry-mode first, produces classification report for CPA sign-off, then writes |
| Redemption order inverted (cash burned before promo) | Customer disadvantaged | Source-pin tests on the redemption helper; integration test pins the order |
| DB trigger missing in production after deploy | UPDATE/DELETE possible silently | `/health/strict` includes "wallet append-only triggers present" check; deploy gate |
| Bucket-reclassification entry skipped | Sum invariant breaks; audit chain hash fails | Pair-write enforced in code; reconciliation catches |
| Loyalty points accidentally added to a money bucket | Customer can spend points as cash | Type-system separation: `LoyaltyPoints` is a different TS type than `Money` |

---

## 10. Reconciliation strategy

**Per-customer:**
`sum(creditTransactions WHERE walletId = X) GROUP BY bucket` must equal the `walletAccounts.balance_<bucket>` cache for X. Hourly + on-demand admin verifier.

**Per-bucket platform-wide:**
`sum(wallet.cash + wallet.gift_card_received + wallet.refund_credit + wallet.escrow_pending)` must equal the bank trust-account balance, daily, with variance > 0 paging on-call.

**Per-VAT-period:**
`sum(redemption events from wallet.cash + wallet.gift_card_received)` aligns with the deferred-liability balance unwinding declared to the tax authority.

---

## 11. Rollback / offset strategy

- The schema migration has a paired backout migration (`drop column bucket`, `recreate prior balance column`). Backout migration is its own PR.
- During the migration window, the legacy `walletService` methods remain functional behind a flag, so a runtime-PR rollback is single-revert.
- After cut-over, "rollback" of a misclassification is via offsetting `bucket_reclassify` entries — never by mutating historical rows.

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-WALLET-SPEC` | This document — pre-spec for WALLET-1 | spec |
| `PR-WALLET-1a` | Schema migration: add `bucket` column + DB append-only triggers | schema-migration (separate PR with rollback) |
| `PR-WALLET-1b` | Data backfill (dry-run first; CPA sign-off; then write) | data-migration |
| `PR-WALLET-1c` | `walletService` bucket-aware methods + redemption order helper | runtime |
| `PR-WALLET-1d` | Reconciliation daily job + alert | runtime |
| `PR-WALLET-1e` | Admin dashboard per-bucket views (consumes Section 7) | runtime |
| `PR-WALLET-1f` | Legacy method removal + flag flip | runtime (final) |

Each in its own PR with full metadata (`execution-pr-roadmap.md`).
