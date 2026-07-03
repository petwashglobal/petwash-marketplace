# 03 — Schema Audit & Production Schema Export

The audit (plan §C) needs the **actual prod schema**. I cannot read Neon directly (no creds).
Here are two clean ways to produce it. **Option B is recommended** — it is one click, no one
handles the connection string by hand, and it is repeatable.

The production `DATABASE_URL` is stored in **GCP Secret Manager** (secret `DATABASE_URL`,
project `signinpetwash`) — confirmed by the migrate job in `petwash-ci.yml`. So the snapshot job
reuses the exact mechanism that already works.

---

## Option B (recommended) — CI "schema-snapshot" job → downloadable artifact

A new `workflow_dispatch` job that:
1. auths to GCP with the existing `GOOGLE_APPLICATION_CREDENTIALS_JSON`,
2. fetches `DATABASE_URL` from Secret Manager and **masks** it,
3. runs `pg_dump --schema-only --no-owner --no-privileges` (structure only — **no data, no secrets**),
4. uploads the result as a build **artifact** (never printed to logs).

Then prod truth is retrieved with:
```bash
gh run download <run-id> -n prod-schema-snapshot -D docs/recovery/2026-07-03-db-migration-recovery/
```

**Why artifact, not logs:** the schema is not a secret, but printing a 671-table DDL to CI logs
is noisy and could incidentally echo comments/defaults we'd rather not broadcast. An artifact is
access-controlled to the repo and easy to diff.

This job is designed (not yet merged) — it ships in the same PR as the CI dual-test (plan §D,
task #17). It is **read-only** (`pg_dump`), touches no data, and cannot mutate prod.

---

## Option A (fallback) — you run one command locally

Requires the Neon connection string (Neon console → your project → *Connection Details* → the
**direct** — not pooled — `postgresql://...` URL) and `pg_dump` installed
(`brew install libpq` on macOS, then use `/opt/homebrew/opt/libpq/bin/pg_dump`).

```bash
# Structure only — NO data, NO passwords in the output.
pg_dump --schema-only --no-owner --no-privileges \
  "postgresql://USER:PASSWORD@ep-xxxx.neon.tech/dbname?sslmode=require" \
  > prod-schema-2026-07-03.sql
```

Then drop `prod-schema-2026-07-03.sql` into this folder (or paste it to me) and I run the diff.
The file contains only `CREATE TABLE / INDEX / CONSTRAINT` statements — safe to share in the repo.

> ⚠️ Do NOT paste the connection string into chat or commit it. Only the `--schema-only` output.

---

## The diff method (how code-vs-prod is computed)

Once `prod-schema-YYYYMMDD.sql` exists:

1. **Load** it into a throwaway local Postgres:
   ```bash
   createdb petwash_prod_clone
   psql petwash_prod_clone < prod-schema-2026-07-03.sql
   ```
2. **Ask Drizzle what it would change** to make that DB match `schema.ts`:
   ```bash
   DATABASE_URL=postgres://localhost/petwash_prod_clone npx drizzle-kit generate --name audit_probe
   # OR: drizzle-kit push --dry-run (whichever this repo's drizzle version supports)
   ```
   Everything Drizzle wants to **CREATE/ALTER** = the gap in prod (in code, not in prod).
3. **Reverse check** — tables in prod but not in code:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname='public'
   EXCEPT SELECT <table list generated from schema.ts>;
   ```
4. **Index / FK / nullable audit** — from the clone:
   ```sql
   -- FK columns lacking an index (common perf gap):
   SELECT c.conrelid::regclass AS table, a.attname AS column
   FROM pg_constraint c
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
   WHERE c.contype='f'
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
       WHERE i.indrelid=c.conrelid AND a.attnum=ANY(i.indkey)
     );
   -- nullable columns the app treats as required → compare to schema.ts .notNull()
   SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema='public' AND is_nullable='YES' ORDER BY 1,2;
   ```
5. Output → `schema-audit-2026-07-03.md`, one section per axis in plan §C, each row triaged.

---

## Output of this step

A committed `schema-audit-2026-07-03.md` + the committed `prod-schema-2026-07-03.sql`. Those two
files, plus the baseline migration in plan §B, are what make prod truth *durable* — the next
person never has to guess again.
