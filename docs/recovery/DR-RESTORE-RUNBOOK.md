# Disaster-Recovery Restore Runbook

**Purpose:** rebuild the PetWash Postgres schema after a total DB loss, and keep the
restore point from going stale. Read this before touching a recovery.

## The restore point

- **`docs/recovery/prod-schema-latest.sql`** — the current structure-only baseline
  (`pg_dump --schema-only`, no data). Refreshed automatically: the
  **Schema Snapshot** workflow (`.github/workflows/schema-snapshot.yml`) runs weekly
  (Mon 04:00 UTC) and on manual dispatch, dumps prod read-only, and opens a
  **`chore(dr): refresh prod schema baseline`** PR when the schema changed. Merge it
  to keep the baseline current. (Docs-only → never triggers a deploy.)
- `docs/recovery/2026-07-03-db-migration-recovery/prod-schema-2026-07-03.sql` — the
  original one-time capture, kept for history. Superseded by `prod-schema-latest.sql`.

## Why the baseline — not `migrations/` — is the source of truth for a rebuild

`migrations/meta/_journal.json` tracks only **6** of the **92** SQL files in
`migrations/`. The rest are hand-written and applied by the custom runner
`scripts/apply-pending-migrations.ts` (its own `_petwash_migrations` table +
`.manual-migrations.txt` skip-list + `--lenient` mode), and `shared/schema.ts` is
synced to prod out-of-band via `drizzle-kit push`. **`drizzle-kit migrate` alone
cannot reconstruct prod.** So a clean rebuild restores the schema **snapshot**, then
lets the runner catch up any newer migrations.

## Restore procedure

1. Provision a fresh Postgres (Neon) and get its **direct** (non-pooler) connection URL.
2. Apply the baseline:
   `psql "$NEW_DATABASE_URL" -f docs/recovery/prod-schema-latest.sql`
3. Seed the runner's ledger so it does not re-run everything the snapshot already
   contains — mark all current `migrations/*.sql` as applied
   (bootstrap `_petwash_migrations`), then run `scripts/apply-pending-migrations.ts`
   to apply anything merged **after** the snapshot. In `--lenient` mode, orphaned
   `ALTER`/`INDEX` targets are logged and skipped, not fatal.
4. Point `DATABASE_URL` (GCP Secret Manager) at the restored DB and redeploy.
5. Verify: table count in the restored DB vs `pgTable(` count in `shared/schema.ts`;
   spot-check the money tables (`wallet_ledger_entries`, `refund_transactions`,
   `points_transactions`, `super_app_payouts`).

## Known gap (tracked)

Full reconciliation of the drizzle journal to all 92 files (so `drizzle-kit migrate`
alone is authoritative) is deliberately **not** done — it risks re-running
hand-written migrations against a live schema. The snapshot-based restore above is
the supported path until that reconciliation is planned and rehearsed against a
throwaway DB.
