# 02 — Migration Recovery Plan

Maps 1:1 to the CEO brief (A–G). Each item states: the goal, the concrete action, who does it,
and the definition of done. Phases are ordered so nothing risky happens before we have prod truth.

---

## Guiding principle

> **`schema.ts` is the intended truth. The Neon production DB is the actual truth. A migration
> is only "done" when those two agree and CI can prove it.** We stop treating the 87-file
> replay as the source of truth and make it a thin, forward-only applier on top of a real baseline.

---

## A. Stop using the file-walker as the only source of truth

**Goal:** the walker must not be the thing we trust to know prod state.

**Actions**
1. Keep `apply-pending-migrations.ts` as the *applier of forward migrations only* — not as a
   reconstruction of history. (#1260 already made it non-fatal on legacy drift.)
2. Introduce an explicit **baseline marker** (§B) so the walker's job becomes "apply everything
   after the baseline," not "replay 87 files and hope."
3. Treat `_petwash_migrations` (the tracking table) as authoritative for "what this applier has
   run," and the **schema snapshot** (file 03) as authoritative for "what prod actually contains."

**Done when:** a fresh run applies only post-baseline files; legacy replay is bypassed, not tolerated.

---

## B. Create a clean production baseline

**Goal:** future migrations start from *real prod*, not from broken 2024-era history.

**Actions**
1. Export the live Neon schema → `prod-schema-YYYYMMDD.sql` (file 03, Option A or B).
2. Diff it against `schema.ts` (drizzle) to get the true delta.
3. Author `migrations/0089_baseline_2026_07.sql` (a *documentation + reconciliation* migration):
   - It does **not** recreate the 88 historical files.
   - It records a baseline row and applies only the *reconciling* DDL the diff surfaced
     (e.g. the objects 0010/0018 were supposed to create, in their real prod-correct shape).
   - All DDL idempotent (`IF NOT EXISTS` / guarded `DO $$`), safe to re-run.
4. Bump `MIGRATION_BASELINE` (env or constant) to `89` so everything `<= 89` is "legacy, applied,
   drift-tolerated" and `0090+` is strict/fail-closed.
5. Add `0010` and `0018` to `.manual-migrations.txt` (allowlist) so they are recorded as
   bootstrapped and never re-attempted — their intent is absorbed into the baseline.

**Done when:** on a fresh prod-clone, running migrations produces a schema equal to `schema.ts`,
and the walker no longer reports ORPHANED files.

**Risk:** medium (touches migration history + a new baseline file). No data mutation — DDL only,
idempotent. Reviewed against the prod dump before merge.

---

## C. Reconcile BEFORE adding more tables (full schema audit)

**Goal:** a written, reviewed diff of code vs prod across every risk axis.

**Audit axes** (produced by the diff tool in file 03):
- Tables in code but not in prod
- Tables in prod but not in code (manually-created / obsolete)
- Missing indexes (esp. on FK columns and hot query paths)
- Missing / orphaned foreign keys
- Unsafe nullable columns (columns the app assumes non-null)
- Duplicate / obsolete migrations (same object created twice; superseded files)
- Objects created manually outside migration history

**Actions**
1. Run the diff (file 03) → `schema-audit-2026-07-03.md` with one table per axis.
2. Triage each finding: `absorb into baseline` / `new forward migration` / `accept + document` / `drop`.
3. **No new feature tables merge until this audit is signed off.**

**Done when:** every row in the audit has a decision and an owner.

---

## D. CI must test migrations two ways

**Goal:** never merge a migration that can't apply cleanly.

**Actions** (implemented as a separate PR — see task #17)
1. **Fresh-DB test:** on any PR touching `migrations/**` or `shared/schema*.ts`, spin up a
   throwaway Postgres service container and run the migrations from zero in **strict mode**
   (no `--lenient`). A new migration that references a missing object fails the PR — loudly.
2. **Prod-baseline test:** load `prod-schema-YYYYMMDD.sql` (the committed baseline from §B) into a
   fresh DB, then apply only the PR's new migrations. Proves the migration works against
   *real prod shape*, not just a clean slate.
3. Both run pre-merge and block on failure.

**Done when:** a deliberately-broken test migration fails CI on both paths.

**Note:** the fresh-DB path is fully buildable now. The prod-baseline path depends on §B's dump
existing in the repo; until then it is scaffolded and skipped-with-log (no silent pass).

---

## E. Manual SQL only as a controlled, tracked hotfix

**Goal:** if we ever must touch prod by hand, it is auditable and converges with code.

**Rule (now enforced by process):** a manual SQL hotfix is allowed only if ALL of:
- it is committed to the repo as a numbered migration or a `docs/recovery/*.sql` hotfix file;
- `_petwash_migrations` / the migration history is updated to reflect it;
- it ships with a **verification query** proving the end state;
- it ships with **rollback / restore** guidance;
- the final state matches `schema.ts`.

**Reference implementation:** `05-host-stay-verify-and-rollback.sql` (this pack) is the template —
Host Stay tables, with verification + rollback, matching the `hostStayDetails` / `bookingHandoverEvents`
Drizzle tables. (Host Stay landed via CI this time, so the SQL is a template + safety net, not a
hotfix we need to run.)

---

## F. Address-match TRUST signal — guardrails

**Goal:** useful signal, zero false accusations, human-in-the-loop.

**Actions** (separate PR — see task #18)
- Output is a **`review_required` TRUST case**, never automatic termination. (Already non-payout-freezing.)
- Reduce false positives:
  - same-household / same family (shared address is expected) → lower confidence, flag reason
  - same building / unit ambiguity → require more than city+street to match
  - provider & owner in the same suburb/complex → not a match on locality alone
  - stale saved address → include address `updatedAt` in evidence
  - spelling / formatting differences → normalized compare (already), but log both raw forms
- Evidence payload must include: normalized matched string, `bookingId`, `ownerId`, `providerId`,
  timestamps, and a machine **reason code**.

**Done when:** the case created is `review_required` with the full evidence payload, and the
guard tests cover the five false-positive scenarios above.

---

## G. Evidence standard (no more "background will notify")

Every production change from here closes with:
- PR merged (link + SHA)
- deploy status (run id + conclusion)
- migration status (the `[migrate] summary` line)
- database verification result (a query result, or the CI apply line)
- exact logs / screenshots
- an explicit "what is still not working" list

This pack itself follows that standard (see README §0 and file 01 §1.3).

---

## Sequencing (what happens in what order)

| Phase | Item | Blocks | Who |
|---|---|---|---|
| 0 ✅ done | Unblock walker (#1258 + #1260); verify 0088 live | — | done |
| 1 | Prod schema export (file 03, Option A or B) | everything below | **CEO/ops runs 1 command** OR approve snapshot job |
| 2 | Schema audit §C | baseline | platform |
| 3 | Baseline §B (`0089_baseline`, bump `MIGRATION_BASELINE`, allowlist 0010/0018) | new tables | platform (approval: migration history) |
| 4 | CI dual-test §D | future safety | platform |
| 5 | Address-match guardrails §F | — | platform (parallel-safe) |
| 6 | Resume features (Host Stay, He/Ru content, multi-role admin) | after 3 | — |
