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
| `_applied-this-run.txt` | The 69 filenames applied in the proving run | supporting |

---

## 2. "What is live in production now" checklist

Legend: ✅ VERIFIED (I have direct evidence) · 🟡 STRONG SIGNAL (inferred from CI apply log, not a direct prod query) · ⬜ UNVERIFIED (needs a prod query — see file 03)

| Capability | Live? | Basis |
|---|---|---|
| Host Stay tables (`host_stay_details`, `booking_handover_events`) | ✅ | CI `✅ applied: 0088` on prod DATABASE_URL |
| Case-ID sequences (`case_id_sequences`, 0087) | 🟡 | in the 69 applied this run |
| K9000 per-machine secrets (0086) | 🟡 | in the 69 applied this run |
| The 69 migration files listed in `_applied-this-run.txt` | 🟡 | CI apply log, this run |
| `0010_registration_tables` objects | ⬜ | ORPHANED (skipped) — `applicant_id` column missing in prod; needs reconcile |
| `0018_privacy_first_account_schema` objects | ⬜ | ORPHANED (skipped) — `lower(pet_temperament)` functional index invalid in prod; needs reconcile |
| Full prod schema == `schema.ts` (671 tables) | ⬜ | **cannot confirm without a prod schema export** — file 03 |

---

## 3. The one thing blocking a complete audit

I do **not** hold the production `DATABASE_URL` / Neon credentials, so I cannot read the
live schema directly. Two clean ways to unblock, both in `03-schema-audit-and-neon-export.md`:

- **Option A (fastest, you run one command):** `pg_dump --schema-only` against Neon → paste/upload the file → I diff it against `schema.ts`.
- **Option B (repeatable, we build once):** a `workflow_dispatch` "schema-snapshot" CI job that dumps the schema to a downloadable **artifact** (never to logs), so we can re-baseline anytime without anyone handling the URL by hand.

Recommendation: **B**, because it makes prod-truth a one-click, credential-safe, repeatable
operation instead of a manual chore — which is the whole point of this recovery.
