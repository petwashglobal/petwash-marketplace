# 07 — Schema Audit (code vs production)

**Date:** 2026-07-03
**Prod source:** `prod-schema-snapshot.sql` — `pg_dump --schema-only` of Neon prod,
produced by the `Schema Snapshot (prod, read-only)` workflow (run `28635200651`/`28635425955`).
**Code source:** all `pgTable(...)` models in `shared/**` + `server/**` (`*.ts`).

This is the real code-vs-prod diff (plan §C). It is derived from an actual prod schema dump,
not estimated.

---

## Headline numbers

| Metric | Production (Neon) | Code (Drizzle ORM) |
|---|---|---|
| Tables | **690** | 670 models |
| Indexes | **1,544** | — |
| Foreign keys | **376** | — |
| Enums (`CREATE TYPE`) | **13** | — |
| Postgres server | **18.4** | — |

---

## Finding 1 — Tables in code but NOT in prod: **4, all obsolete (no runtime risk)** ✅

`messages`, `notifications`, `payouts`, `reviews`.

- All four are defined **only** in the legacy `shared/super-app-schema.ts` and
  `shared/super-app-schema-v2.ts` (two old "super-app" schema drafts).
- Prod implements these as **domain-specific** tables instead:
  `super_app_messages` / `booking_messages` / `chat_messages`; `super_app_notifications`;
  `super_app_payouts` / `pw_provider_payouts`; `marketplace_reviews` / `sitter_reviews` / …
- **Zero** Drizzle query references (`.from(messages)`, `.insert(payouts)`, …) in `server/**`.

**Verdict:** dead schema definitions. No app path queries the bare tables, so their absence from
prod causes **no 500s**. **Action:** delete the 4 obsolete definitions (and audit whether
`super-app-schema{,-v2}.ts` can be retired entirely) — a code cleanup, low priority, no prod change.

> This is the reassuring result: **no table the live app actually uses is missing from prod.**

---

## Finding 2 — Tables in prod but NOT modelled in the ORM: **24 (raw-SQL-managed)** ⚠️

These exist in prod and are queried via raw SQL (`db.execute(sql\`…\`)`), but have **no Drizzle
model**, so they are invisible to `drizzle-kit` — schema changes to them are untracked and there is
no type safety. Ranked by `server/**` usage:

| Table | server refs | Cluster |
|---|---:|---|
| `payout_batches` | 69 | **money / payouts** |
| `financial_approval_log` | 23 | **money / approvals** |
| `payout_failures` | 18 | **money / payouts** |
| `k9000_redemption_reservations` | 16 | **K9000 redemption** |
| `shop_orders` | 13 | shop |
| `payout_batch_items` | 13 | **money / payouts** |
| `coupon_issuances` | 11 | coupons |
| `reconciliation_results` | 10 | **money / reconciliation** |
| `financial_approval_matrix` | 10 | **money / approvals** |
| `shop_products` | 9 | shop |
| `kiosk_coupon_tokens` | 8 | coupons |
| `k9000_reconciliation_breaks` | 8 | **K9000 / money** |
| `shop_cart_items` | 7 | shop |
| `shop_carts` | 6 | shop |
| `privilege_members` | 5 | loyalty |
| `coupon_audit_log` | 5 | coupons |
| `shop_order_items` | 4 | shop |
| `shop_delivery_addresses` | 4 | shop |
| `coupon_validation_attempts` | 4 | coupons |
| `paw_finder_notifications` | 3 | pet finder |
| `shop_product_variants` | 2 | shop |
| `_petwash_migrations` | 2 | infra (migration tracker — expected) |
| `k9000_redeemed_nonces` | 1 | K9000 security |
| `vat_rate_configs` | 0 | tax config — **verify not dead** |

**Verdict:** the biggest structural risk. Real **money infrastructure** (payout batching,
financial approvals, reconciliation, K9000 redemption reservations/nonces) lives on tables with
**no ORM model and no migration-tracked schema**. Nothing is broken today, but every change to
these is hand-SQL with no tooling safety net.

**Action (feeds the baseline §B):**
1. Add Drizzle models for the actively-used tables, money cluster first (`payout_batches`,
   `payout_failures`, `payout_batch_items`, `financial_approval_log`, `financial_approval_matrix`,
   `reconciliation_results`, `k9000_*`). Model-only; introspect the real prod columns from the dump.
2. Confirm `vat_rate_configs` (0 refs) is intentional config, else drop it.
3. `_petwash_migrations` stays ORM-less (infra) — document, don't model.

---

## Finding 3 — Type drift on `host_stay_details.id` (uuid vs varchar) ⚠️

- Prod (from dump): `id uuid DEFAULT gen_random_uuid() NOT NULL`
- `schema.ts`: `varchar("id").primaryKey().default(sql\`gen_random_uuid()\`)`

Functionally OK (uuid serialises to string; DB fills the default), but it is a real declared-vs-actual
type mismatch. **Action:** align `schema.ts` to `uuid` (or vice-versa) in the baseline. Likely not
unique — a full column-type diff (below) should be run for the whole schema.

---

## Not yet done in this pass (needs the loaded clone)

Counts above come from parsing the dump directly. The following need the dump **loaded into a
throwaway Postgres** + Drizzle introspection (method in file 03) and are the next audit slice:

- Per-column type/nullability diff across all 670 shared tables (Finding 3 is one instance).
- FK-columns-without-an-index report (perf).
- Duplicate/obsolete migration reconciliation (e.g. the 2 ORPHANED files 0010/0018).

These are deliberately **not** guessed here. Each becomes a row in the baseline plan (§B).

---

## What this audit changes about the recovery

- Plan §B baseline should **absorb the 24 raw-SQL tables into the ORM** (money first) and fix the
  `host_stay_details.id` drift — not just record a marker.
- Plan §C's "tables in code not prod" axis is **closed** (Finding 1: none live).
- The `Schema Snapshot` job (file 03 / this run) is now the repeatable prod-truth source; re-run it
  before cutting the baseline so the diff is fresh.
