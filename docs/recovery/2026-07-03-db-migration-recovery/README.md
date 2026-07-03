# PetWash — Database & Migration Recovery Pack

**Date:** 2026-07-03
**Owner:** CEO (Nir) + platform
**Trigger:** New tables (0088 Host Stay) repeatedly failed to reach production; the
CI migration file-walker kept replaying 87 historical migrations and dying on old
"poison" files. Decision: stop relying on manual Neon SQL; establish schema truth,
migration truth, and production verification as a permanent, professional process.

This pack is committed to the repo (version-controlled) rather than living only in a
Drive folder, per the requirement that any hotfix/baseline be *tracked in the repo*.

---

## 0. Headline status (VERIFIED 2026-07-03)

| Item | Status | Evidence |
|---|---|---|
| 0088 Host Stay tables in production | ✅ **APPLIED** | [04-migration-run-log](04-migration-run-log-28633508916.txt): `✅ applied: 0088_host_stay_journey.sql` |
| CI migration job reaches the end of the backlog | ✅ **PASS** (first time) | run `28633508916`, sha `6e50cbc10`, job "Apply pending SQL migrations" = success |
| Migrations newly applied this run | 69 | log summary line |
| Legacy files correctly skipped (not fatal) | 2 | `0010_registration_tables` (42703), `0018_privacy_first_account_schema` (42883) |
| Manual Neon SQL still required for 0088 | ❌ **NO LONGER** | superseded by the run above |

> The immediate fire is out. The rest of this pack is about making sure it **stays** out
> and that we never again ship a table that silently fails to land.

---

## 1. What each file in this pack is

| File | Purpose | Item in CEO brief |
|---|---|---|
| `README.md` (this) | Index + "what is live" checklist | 6 |
| `01-current-state-and-evidence.md` | Hard facts: table counts, migration counts, the run evidence | 1, 4 |
| `02-migration-recovery-plan.md` | The professional plan: stop-walker-as-truth, baseline, reconcile, CI dual-test | A–G, 7 |
| `03-schema-audit-and-neon-export.md` | The audit method + the **exact commands you run against Neon** to give us prod truth | 1, 2 (C), B |
| `04-migration-run-log-28633508916.txt` | Raw CI log proving 0088 applied | 4 |
| `05-host-stay-verify-and-rollback.sql` | Verification queries + rollback for the Host Stay tables | E |
| `06-pr-index.md` | PR links + commit SHAs for #1255–#1260 | 5 |
| `07-schema-audit-2026-07-03.md` | **Real code-vs-prod diff** (690 prod tables vs 670 ORM models) | 1, 2, C |
| `prod-schema-2026-07-03.sql` | **Production schema export** (`pg_dump --schema-only`; 690 tables, no data) | 1 |
| `audit/` | Derived lists (prod/code tables, diffs, raw-SQL usage) | supporting |
| `_applied-this-run.txt` | The 69 filenames applied in the proving run | supporting |

---

## 2. "What is live in production now" checklist

Legend: ✅ VERIFIED (direct evidence) · 🟡 STRONG SIGNAL (CI apply log) · ⬜ open item

| Capability | Live? | Basis |
|---|---|---|
| Prod schema now exported + diffed against code | ✅ | `prod-schema-2026-07-03.sql` + file 07 |
| Every table the live app uses exists in prod | ✅ | file 07 Finding 1: 0 live tables missing (4 code-only are obsolete, 0 queries) |
| Host Stay tables (`host_stay_details`, `booking_handover_events`) | ✅ | CI `✅ applied: 0088`; present in prod dump |
| Case-ID sequences (`case_id_sequences`, 0087) | ✅ | in prod dump + 69 applied this run |
| K9000 per-machine secrets (0086) | 🟡 | in the 69 applied this run |
| 24 prod tables run on raw SQL with no ORM model (money-heavy) | ⚠️ | file 07 Finding 2 — reconcile in baseline §B |
| `host_stay_details.id` type drift (prod uuid vs code varchar) | ⚠️ | file 07 Finding 3 |
| `0010` / `0018` legacy migrations never applied (ORPHANED) | ⬜ | reconcile in baseline §B/§C |

---

## 3. Prod truth is now available (blocker cleared)

The original blocker — no prod schema on hand — is **resolved**. The `Schema Snapshot (prod,
read-only)` workflow (merged, PR #1262/#1263) dumped the live Neon schema to an artifact; it is
committed here as `prod-schema-2026-07-03.sql` (690 tables, `--schema-only`, no data). The
code-vs-prod diff is done in `07-schema-audit-2026-07-03.md`.

Re-run anytime: **Actions ▸ "Schema Snapshot (prod, read-only)" ▸ Run workflow**, then
`gh run download <run-id> -n prod-schema-snapshot`. No one handles the connection string by hand.
