# 01 — Current State & Evidence

All numbers below are pulled directly from the repo and the CI run on 2026-07-03.
Nothing here is estimated.

## 1.1 Schema (code side — the ORM truth)

| Metric | Value | Source |
|---|---|---|
| `pgTable(...)` definitions in `shared/schema.ts` | 466 | `grep -cE "= pgTable\(" shared/schema.ts` |
| `pgTable(...)` across ALL `shared/schema*.ts` (34 files) | **671** | `grep -rhE "= pgTable\(" shared/schema*.ts \| wc -l` |
| Modular schema files | 33 (+ `schema.ts`) | `ls shared/schema*.ts` |

The code declares ~671 tables. Whether prod actually has all 671 is **unverified** until a
prod schema export exists (see `03-schema-audit-and-neon-export.md`).

## 1.2 Migrations (file side)

| Metric | Value | Source |
|---|---|---|
| `.sql` files in `migrations/` | 87 | `ls migrations/*.sql \| wc -l` |
| Range | `0000_acoustic_steel_serpent` → `0088_host_stay_journey` | — |
| Registered in Drizzle `_journal.json` | **6** | `migrations/meta/_journal.json` |
| Hand-written / untracked by Drizzle | **81** | 87 − 6 |
| In `.manual-migrations.txt` allowlist | 0 | file empty |

**Root cause in one line:** 81 of 87 migrations are hand-written and unknown to
`drizzle-kit migrate`, so the repo built a custom file-walker
(`scripts/apply-pending-migrations.ts`) that replays every file from `0000` on each run.
Because prod's schema was *also* being changed out-of-band via `drizzle-kit push`, some old
files now reference objects that exist in a different shape in prod (or not at all), and
they throw. Before the fixes below, the first such throw killed the whole run.

## 1.3 The proving run (VERIFIED)

- **Run:** `28633508916` — "PetWash CI 2026 — Production Deploy", `workflow_dispatch`, `run_migrations=true`
- **Commit:** `6e50cbc10` (main, includes #1258 + #1260)
- **Migrate step:** `Apply pending SQL migrations` → **success**
- **Deploy:** backend (Cloud Run) + frontend (Firebase) both deployed after.

Summary line from the log:

```
[migrate] summary: 69 newly applied, 0 bootstrapped as already-existing,
          0 skipped via manual allowlist, 2 ORPHANED (lenient skip), 0 DATA_CONFLICT (lenient skip).
[migrate] ✅ applied: 0088_host_stay_journey.sql
```

Interpretation:
- **69 newly applied** — the walker ran forward through the whole backlog for the first time.
- **0 bootstrapped** — none hit "already exists"; the ~16 not in the 69/2 were already recorded in `_petwash_migrations` from prior partial runs and were skipped before execution.
- **2 ORPHANED** — the only two genuinely-broken legacy files, skipped (not fatal):
  - `0010_registration_tables.sql` — `42703`, `column "applicant_id" does not exist`
  - `0018_privacy_first_account_schema.sql` — `42883`, `function lower(pet_temperament) does not exist`
- **0088 applied** — Host Stay tables landed in prod. **Manual Neon SQL is no longer required.**

Full raw log: `04-migration-run-log-28633508916.txt`. Applied filenames: `_applied-this-run.txt`.

## 1.4 What carried the run (honest attribution)

The two orphaned files failed with `42703` and `42883`. Both codes are already tolerated by
`UNDEFINED_REFERENCE_CODES` (42703 original; **42883 added by #1258**). So this run was
carried by **#1258**, not by the #1260 baseline — the baseline skip did **not** fire this time
(no `LEGACY-DRIFT` lines in the log).

`#1260`'s value is **durability/insurance**: the *next* unknown legacy poison code (some
`42xxx` we haven't seen) would previously have re-blocked the walker. With #1260, any error on
a pre-baseline file (`<= 0088`) is skipped, while a genuinely-new migration (`0089+`) still
fails closed. So we won't be back here chasing the next code.

## 1.5 Known residual problems (carried into the plan)

1. **Two orphaned legacy migrations** (0010, 0018) never applied. Their intended objects may be
   missing or differently-shaped in prod. → reconcile in the baseline (plan §B/§C).
2. **No prod schema truth on hand.** Cannot confirm the 671 code tables all exist in prod, nor
   detect prod-only tables, missing indexes/FKs, or unsafe nullables. → plan §C + file 03.
3. **The walker still replays 87 files every run.** It works now, but it is O(history) and one
   bad *new* migration mid-list could still halt everything after it. → plan §A/§B (baseline squash).
4. **No CI test that a migration set applies from zero**, and none against a prod-like baseline.
   → plan §D.
