# Phase 1 — Read-Only Inventory & Gap Report

**Status:** Read-only inventory deliverable. NO infrastructure changed.
**Companion docs:** `BACKUP_RETENTION_ARCHITECTURE.md`, `YOU_ARE_SAFE_GUIDE.md`.
**Branch:** `claude/phase-1-inventory-report`.
**Date:** May 2026.

---

## Important constraints (unchanged from architecture proposal)

- No infrastructure has been changed by this PR.
- No Bucket Lock applied. No IAM changes. No DB triggers. No schema changes. No destructive operations.
- This is a written gap report against the architecture proposal (PR #259, merged), based on what is discoverable in the codebase plus exact instructions for the live-infra checks that require GCP / Neon / Workspace console access.

---

## 0. Executive summary

The codebase tells a partial story. From the repo I can confirm: the production GCP project ID, the Cloud Run region (Israel — me-west1), the database provider (Neon serverless), the GCS bucket names and credential cascade, the cron schedule for all scheduled jobs (including the three backup-relevant ones), the data-retention policy constants the application enforces internally, and the existing soft-delete and hard-delete patterns.

What the codebase **cannot** tell me is: the actual GCS bucket regions (set at bucket-creation time in the console, not in the repo), the active Neon plan tier and PITR window (Neon console only), whether the production cron jobs are actually firing in production (Cloud Logging only), the Workspace tier and existing Shared Drives (Admin console only), and real data volumes. Section 4 below lists exactly what to fetch from each console and how.

The most important new finding versus the architecture proposal: the Firestore "backup" is a **roll-your-own JSON export of 11 named collections**, not a GCP managed Firestore export. This has consequences (§3.2) — primarily that PITR is NOT automatically available, sub-collections beyond one level are NOT captured, and the backup-log collection is itself NOT in the export list, meaning a Firestore wipe destroys the backup audit trail. The fix is to switch to managed exports in Phase 2, additive (keep both).

Refined cost estimate based on what we now know: **Layer 1 ~$40–$110/month** at current size (smaller than the earlier high-end estimate). **Layer 2 ~$22–$92/month** depending on Workspace seats. **Total: $62–$202/month** before any Neon plan upgrade.

---

## 1. What I CAN confirm from the codebase

### 1.1 Production infrastructure identity

- **GCP project ID:** `signinpetwash` (`.github/workflows/petwash-ci.yml:9`).
- **Cloud Run region:** `me-west1` (Tel Aviv). Pinned in `.github/workflows/petwash-ci.yml:10` AND in `firebase.json` rewrite blocks at lines 24, 31, 38, 45. **Israel residency on the compute layer is confirmed.**
- **Cloud Run service name:** `petwash-api` (`cloudrun-service.yaml:4`).

### 1.2 Database — Neon serverless Postgres

- Driver: `@neondatabase/serverless` (`server/db.ts:1`).
- Connection: `DATABASE_URL` secret, injected from GCP Secret Manager (`cloudrun-service.yaml:27-31`).
- Pool config: max 20 connections, 30s idle timeout, 10s connection timeout (`server/db.ts:36-41`).
- WebSocket transport: explicit (`server/db.ts:10`).
- Auto-heal pattern: pool errors logged but do NOT exit the process (`server/db.ts:44-54`). Good resilience pattern.
- Schema discovery: 5 schema modules combined — `shared/schema`, `schema-enterprise`, `schema-unified-platform`, `schema-payments`, `schema-treasury`.
- **What is NOT in the repo:** Neon plan tier, Neon project ID, PITR window, branch retention setting, Neon region. All in Neon console.

### 1.3 GCS buckets

Three buckets are referenced from code:

- `petwash-code-backups` — env-driven via `GCS_CODE_BUCKET` with default fallback (`server/services/gcsBackupService.ts:19`).
- `petwash-firestore-backups` — env-driven via `GCS_FIRESTORE_BUCKET` with default fallback (`server/services/gcsBackupService.ts:20`).
- `petwash-secure-messages` — **hardcoded**, not env-driven (`server/services/gcsBackupService.ts:392`). Each backed-up message lands at `messages/{userId}/{messageId}_{timestamp}.json`.

**Bucket regions, lifecycle rules, versioning state, and storage class are NOT discoverable from the repo.** Bucket configuration is set at the GCP console / `gcloud storage buckets create` command and lives entirely on the GCP side. See §4.1 for the exact commands to fetch this.

Note: `cloudrun-service.yaml` does NOT inject `GCS_CODE_BUCKET`, `GCS_FIRESTORE_BUCKET`, or `GOOGLE_APPLICATION_CREDENTIALS_JSON`. In production, the bucket names fall back to the hardcoded defaults, and the GCS client falls through the credentials cascade to `FIREBASE_SERVICE_ACCOUNT_KEY` (the only credentials env var actually injected — line 52-56).

### 1.4 GCS credentials cascade

`server/services/gcsBackupService.ts:29-37` checks four env vars in order:

1. `GOOGLE_APPLICATION_CREDENTIALS_JSON` (preferred)
2. `GOOGLE_SERVICE_ACCOUNT_JSON`
3. `GOOGLE_APPLICATION_CREDENTIALS`
4. `FIREBASE_SERVICE_ACCOUNT_KEY` (fallback — and the only one injected in prod)

Implication: in production, the GCS backup service uses the **Firebase service account key** to authenticate to GCS. This works because the Firebase service account is also a GCP project member. It is not a clean separation of duties — Phase 3 should consider a dedicated `petwash-backups@signinpetwash.iam.gserviceaccount.com` service account scoped only to the three backup buckets.

### 1.5 Backup cron schedules

From `server/backgroundJobs.ts`:

- **Weekly code backup — Sunday 02:00 Asia/Jerusalem** (line 368). Calls `performWeeklyCodeBackup()`. Uploads `tar.gz` to `gs://petwash-code-backups/`. Excludes `node_modules`, `.git`, `dist`, `.cache`, `*.log`, and previous backup tarballs. SHA-256 hash logged.
- **Daily Firestore export — 01:00 Asia/Jerusalem** (line 375). Calls `performFirestoreExport()`. Iterates 11 hardcoded collections (§1.6) and uploads JSON files to `gs://petwash-firestore-backups/daily/{YYYY-MM-DD}/{collection}_{YYYY-MM-DD}.json`.
- **Daily Merkle blockchain audit snapshot — 02:00 Asia/Jerusalem** (line 423). Calls `AuditLedgerService.createDailySnapshot()`. This is the integrity-attestation job, not a backup itself — it computes a Merkle root over the audit table contents and stores it. Excellent existing tamper-evidence mechanism.
- **Daily 7-year retention cleanup — 03:00 Asia/Jerusalem** (line 410). Calls `cleanupMonitoringData()`. Implements the 7-year retention on monitoring data tables.

The `YOU_ARE_SAFE_GUIDE.md` claim that "Firestore Backup runs at midnight" is inaccurate — the cron is 01:00, not 00:00.

The `YOU_ARE_SAFE_GUIDE.md` claim of "Audit Logs Daily at 2:00 AM" is the Merkle snapshot, not a separate audit-log backup. The audit logs themselves are in Postgres and Firestore and are covered by those backup paths.

### 1.6 Firestore export — what gets captured

The 11 collections that `performFirestoreExport()` iterates (`server/services/gcsBackupService.ts:193-205`):

1. `users` (with one-level sub-collection `users/{id}/profile/data`)
2. `kyc`
3. `birthday_vouchers`
4. `crm_email_templates`
5. `nayax_transactions`
6. `nayax_vouchers`
7. `nayax_webhook_events`
8. `nayax_terminals`
9. `station_events`
10. `inbox`
11. `loyalty`

**Collections that are NOT in this list and therefore NOT being backed up:**

- `legal_holds` — referenced by `DataRetentionService` (line 82) for legal-hold tracking. Losing this collection means legal-hold state vanishes.
- `backup_logs` — written to BY the backup service itself (line 125, 165, 294). The backup service writes its own audit trail to a collection that it does NOT back up. A Firestore wipe destroys the backup audit history.
- Any other Firestore collection in the system (Firebase Auth artifacts, station maintenance, monitoring metadata, etc.).

**Sub-collections beyond one level are NOT captured.** The code only handles `users/{id}/profile/data` as a one-level sub-collection; any deeper nesting is silently lost.

**This is a roll-your-own export, NOT a GCP managed Firestore export.** Consequences:

- Cannot use `gcloud firestore import` to single-command restore.
- Firestore PITR is NOT enabled (PITR requires a separate console flag, unrelated to this code).
- Restore requires a custom script to read the JSON files and write back to Firestore document-by-document.
- Schema or rule changes between export and restore are NOT handled.

### 1.7 Data retention policies (application-enforced)

From `server/services/DataRetentionService.ts:21-33`:

- Financial records — **7 years** (Israeli Tax Ordinance).
- Authentication logs — **7 years** (Privacy Protection Law).
- Customer personal data post-deletion — **90 days** (Israeli Privacy Protection Law 2025).
- Marketing consents — **5 years** (GDPR Article 7).
- Biometric data — **3 years** (Biometric Data Law).
- Session data — **30 days** (Data Minimization).
- Temporary verification codes — **1 day** (Data Minimization).
- Audit trail — **permanent (Infinity)**.

These are application-level constants, not database constraints or GCS lifecycle rules. The actual enforcement is the `runRetentionPurge()` job called daily at line 199 of `backgroundJobs.ts`.

The constants align well with the data classification matrix in `BACKUP_RETENTION_ARCHITECTURE.md` §3.5.

### 1.8 Soft-delete patterns confirmed

- `users.softDeleteAt` column (handled by `server/services/softDeleteService.ts`).
- `businessLegalIdentities.retentionStatus` + `retentionExpiresAt` columns.
- `isDeleted` boolean flags on `bookingMessages`, `socialPosts`, `socialComments`, `socialDirectMessages`.

### 1.9 Hard-delete statements still present (gap)

The architecture proposal flagged these for Phase 4 cleanup. Confirmed still present:

- `DELETE FROM finance_roles` — `prestige-pass.ts:9730`.
- `DELETE FROM finance_role_capabilities` — `prestige-pass.ts:9414`.
- `DELETE FROM approval_chain_steps` — `prestige-pass.ts:12220`.
- `DELETE FROM remediation_suggestions` — `prestige-pass.ts:18284`.
- `DELETE FROM kyc_rate_limits` — `KYCRateLimiter.ts:207` (this one is acceptable — transient data with 1-hour TTL).
- Firestore `.delete()` calls on transient artifacts (WebAuthn challenges, OTP sessions past TTL) — acceptable.

No action in Phase 1 (these are Phase 4 work).

### 1.10 GCP packages installed

From `package.json`:

- `@google-cloud/storage` v7.17.2 — used.
- `@google-cloud/dialogflow-cx` v5.4.0 — used (chatbot).
- `@google-cloud/recaptcha-enterprise` v6.3.1 — used (anti-bot).
- `@google-cloud/translate` v9.2.1 — used (i18n).
- `@google-cloud/vision` v5.3.4 — used (image analysis).

**Missing packages for the proposed Layer 1 / Layer 2 architecture (would need to be added in Phase 3 / future):**

- `@google-cloud/scheduler` — for programmatic Cloud Scheduler triggers (optional; console-only also works).
- `@google-cloud/bigquery` — for BigQuery audit-log archive verification.
- `@google-cloud/kms` — for CMEK key management.
- `googleapis` (for Drive, Sheets, Docs APIs in Layer 2 automation).

### 1.11 CI / deploy

- One deployment workflow: `.github/workflows/petwash-ci.yml`. Uses `google-github-actions/deploy-cloudrun@v2`, deploys to me-west1.
- No backup-related workflows. All backup work is in-app cron, not in CI.
- Other workflows: `cache-cleanup.yml`, `cleanup-merged-branches.yml`, `cloud-run-diagnostics.yml`, `codeql.yml`, `copilot-setup-steps.yml`, `deploy-protection.yml`.

### 1.12 No npm backup / restore scripts

`package.json` has no `backup`, `export`, `dump`, or `restore` npm scripts. All backup work is invoked by the in-app cron jobs at runtime. There is no CLI path to trigger a backup on-demand. Phase 3 should consider adding one (e.g., `npm run backup:firestore -- --target=staging`) for restore-drill scenarios.

---

## 2. What I CANNOT confirm from the sandbox

These items need access to GCP / Neon / Workspace consoles which I do not have from the sandbox. Each item below has the exact commands or console paths so you can fetch the answer in under 5 minutes per item.

### 2.1 GCS bucket regions, versioning, lifecycle, storage class

For each of the three buckets:

```
gcloud storage buckets describe gs://petwash-code-backups \
  --format="value(location,locationType,storageClass,versioning,lifecycle)"

gcloud storage buckets describe gs://petwash-firestore-backups \
  --format="value(location,locationType,storageClass,versioning,lifecycle)"

gcloud storage buckets describe gs://petwash-secure-messages \
  --format="value(location,locationType,storageClass,versioning,lifecycle)"
```

What we need to confirm:

- `location` should be `me-west1` (Tel Aviv). If it is `us-central1` or `eu` or anything else, that's a P0 residency gap.
- `versioning.enabled` should be `true`. Currently almost certainly `false`.
- `lifecycle` should ideally have a rule transitioning objects to Coldline at 90 days. Currently almost certainly empty.
- `storageClass` should start as `STANDARD`; lifecycle moves to `COLDLINE` then `ARCHIVE`.

Console alternative: GCP Console → Cloud Storage → Buckets → click each bucket → Configuration tab.

### 2.2 Neon plan tier and PITR window

Neon does not have a CLI in the sandbox. Go to https://console.neon.tech, sign in, then:

1. Select the petwash project.
2. Settings → Billing — note the plan tier (Free, Launch, Scale, Enterprise).
3. Settings → Branching — note the branch retention setting (in hours or days).
4. Settings → General — note the Neon region (should be the closest to me-west1 — likely `aws-eu-central-1` Frankfurt, since Neon does not yet have a Tel Aviv region as of late 2025).

What we need to confirm:

- Plan tier (Launch = 7-day branch retention, Scale or Enterprise = up to 30 days).
- Branch retention window.
- Neon region — if not in Israel, that's a P1 residency consideration (Postgres data physically leaves Israel; verify with privacy counsel whether that is acceptable given the data classes Postgres holds).

### 2.3 Are the production cron jobs actually firing?

Cloud Run runs the Node process; cron is in-process via `node-cron`. Cron only fires if the container instance is alive. With `minScale: 1` (`cloudrun-service.yaml:11`) one instance is always alive, so cron should fire. But verify in Cloud Logging:

```
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="petwash-api"
   AND textPayload =~ "performWeeklyCodeBackup|performFirestoreExport"' \
  --limit=20 \
  --format="value(timestamp,textPayload)" \
  --freshness=14d
```

Expected: 2 entries per week for code backup (last 14 days = 2 Sundays = 2 runs), plus ~14 entries for Firestore (one per day).

Console alternative: GCP Console → Cloud Logging → Logs Explorer → query for the strings `performWeeklyCodeBackup` and `performFirestoreExport`. Filter last 14 days.

### 2.4 Firestore PITR status

```
gcloud firestore databases describe --database='(default)' \
  --format="value(pointInTimeRecoveryEnablement,locationId)"
```

What we need to confirm:

- `pointInTimeRecoveryEnablement` — likely `POINT_IN_TIME_RECOVERY_DISABLED` since nothing in the codebase enables it. Enabling it is a one-click console action (Firebase Console → Firestore Database → Settings → "Enable PITR").
- `locationId` — should be `me-west1` ideally. If it is `nam5` (multi-region US) or `eur3` (multi-region EU), that is a residency gap that **cannot be changed** for an existing database without a full migration. Flag immediately.

### 2.5 Google Workspace tier and Shared Drives state

Admin console → https://admin.google.com.

1. Billing → Subscriptions — note the Workspace SKU (Business Starter, Business Standard, Business Plus, Enterprise Standard, Enterprise Plus).
2. Apps → Google Workspace → Vault — is Vault enabled? Only present in Business Plus and Enterprise tiers.
3. Apps → Drive and Docs → Manage Shared Drives — list all existing Shared Drives. Note: which ones exist, who is a member of each.
4. Reports → Audit and investigation → Drive log — confirms the audit log is being collected.

Total seats currently active: count.

### 2.6 Real data volumes (for refined cost estimate)

Run inside the sandbox connected to Neon:

```
-- Top 20 tables by row count
SELECT relname AS table_name,
       n_live_tup AS row_count,
       pg_size_pretty(pg_relation_size(oid)) AS size
  FROM pg_class
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
 WHERE pg_namespace.nspname = 'public'
   AND relkind = 'r'
 ORDER BY n_live_tup DESC
 LIMIT 20;

-- Total database size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

For Firestore, the simplest measure:

```
gcloud storage du gs://petwash-firestore-backups/daily/ --summarize
```

That gives the total size of all daily Firestore exports. Divide by ~30 (days retained) to estimate one day's export size.

---

## 3. Discrepancies between existing docs and reality

The existing `docs/YOU_ARE_SAFE_GUIDE.md` is reassurance-style, not operational. Several claims do not match the code:

- **"Daily database export → Every day at 1 AM"** — accurate (cron is 01:00).
- **"Code Backup → Sunday 2 AM"** — accurate.
- **"Audit Logs → Every day 2:00 AM Daily"** — partially accurate. The 02:00 daily cron is the Merkle snapshot (an integrity hash over the audit tables), not a backup of audit-log rows. Audit-log rows are in Postgres and get backed up via the Postgres path (which we are about to confirm works end-to-end in Phase 2).
- **"Firebase Native Backups: Automatic point-in-time recovery"** — likely inaccurate. PITR must be explicitly enabled (§2.4). The code does not enable it.
- **"30-day retention"** — claimed but no GCS lifecycle rule found in code or repo. Retention is currently whatever the GCS console is set to. Probably not 30 days, probably infinite (the default is "keep forever" unless lifecycle is configured). §2.1 will confirm.
- **"Real-time messages backup"** — partially accurate. `petwash-secure-messages` writes are triggered from message events, but the bucket has no versioning / no lifecycle / no immutability based on what we know from §2.1.
- **"Replit Secrets"** references — outdated. Production uses GCP Secret Manager (`cloudrun-service.yaml:28-31` and subsequent). Replit is dev-only.
- **"49/50 score, EXTREMELY SAFE"** — marketing language, not a technical SLA.

Recommended action (Phase 2): replace `YOU_ARE_SAFE_GUIDE.md` with a `RECOVERY_RUNBOOK.md` that is operationally accurate and uses RTO/RPO targets. Keep the reassurance doc as `BACKUPS_FAQ.md` if useful for non-technical audiences.

---

## 4. Refined cost estimate

Now that we know:

- Compute and Cloud Run are in me-west1 (good).
- Neon is the DB (its own pricing layer, separate from GCP).
- Three GCS buckets exist with daily/weekly/per-message writes.
- 11 Firestore collections export as JSON daily.
- Existing data volumes are unknown but likely small (Israeli marketplace, low thousands of users at most).

Refined estimate at current scale (assuming under 100GB total data across all buckets, under 50GB Postgres):

- GCS Standard storage me-west1 (~10–30GB of recent backups): $0.25–$0.75/month.
- GCS Coldline storage me-west1 (~50–200GB after lifecycle): $0.20–$0.80/month.
- GCS Archive storage me-west1 (~200GB+ once Phase 3 ships 7-year retention): $0.25/month per 200GB.
- Object versioning overhead (assuming 30% delta): $0.10–$0.30/month.
- Bucket Lock fee: $0.
- Cloud Scheduler (3 jobs): $0.30/month.
- Cloud Run Job for nightly pg_dump (~5 min/day): $1–$3/month.
- Cloud KMS (1 key, ~5K operations): $0.30/month.
- BigQuery storage (audit archive, partitioned, likely under 10GB at year 1): $0.20/month.
- BigQuery queries (light, for compliance review only): $0–$2/month.
- Cloud Logging (audit event ingestion): $5–$20/month.
- Cross-region egress (one annual restore drill, ~50GB): $4/year amortized to $0.30/month.

**Layer 1 estimated total at current scale: $8–$28/month**, plus Neon plan upgrade if needed.

That is lower than the earlier $40–$180 range in `BACKUP_RETENTION_ARCHITECTURE.md` because the previous range assumed mid-size data volumes (50–500GB). Phase 1 measurement (§2.6) will replace this estimate with measured numbers.

**Layer 2 (Google Workspace):**

- 1 CEO seat Business Plus: $22/month.
- 4 seats Business Plus (CEO + accountant + privacy officer + ops manager): $88/month.
- 4 seats Enterprise Standard (recommended if any of those people are not already on Workspace): $92/month.

**Neon plan upgrade (if needed):**

- Free tier: 7-day branch retention, may already be sufficient for dev work but not for the 30-day PITR target.
- Launch: $19/month, 7-day retention.
- Scale: $69/month, 30-day retention (this matches the proposal's 30-day RPO target).
- Enterprise: custom pricing, longer retention, support, SOC 2 reports.

If you are on Launch today and want 30-day PITR, you need to move to Scale: **+$50/month delta**.

**All-in target steady-state cost (Phase 3 complete):**

- Conservative: $8 (Layer 1) + $22 (Layer 2 single seat) + $0 (Neon stays Launch) = **~$30/month**.
- Recommended: $28 (Layer 1 measured) + $88 (Layer 2 four seats Business Plus) + $50 (Neon Scale upgrade) = **~$166/month**.
- Mid-size (~500GB data, 10 Workspace seats): $110 (Layer 1) + $220 (Layer 2) + $69+ (Neon Scale) = **~$400/month**.

---

## 5. Restore test plan (Phase 1 task 4)

The test happens in a **staging or throwaway dev environment only**. Production is not touched.

**Pre-flight:**

1. Confirm an isolated dev Firestore project exists (or create one in the same Firebase project tree but with no real users).
2. Confirm there is a dev branch of the Neon database with no real customer data, or create a fresh Neon project.

**Test A — Firestore restore drill (P0):**

1. Pick yesterday's Firestore export from `gs://petwash-firestore-backups/daily/{YYYY-MM-DD}/`.
2. Write a one-off restore script that reads each `{collection}_{date}.json` file and writes each doc to the dev Firestore project's matching collection.
3. Time the operation. Document: full duration, number of docs restored, any errors, any data loss (sub-sub-collections, missing fields).
4. Spot-check: pick 5 random user IDs from the export, confirm they appear in the dev Firestore with correct field values.
5. Confirm legal-hold metadata is preserved if any `legal_holds` documents exist — and note the gap if `legal_holds` is NOT in the export list (§1.6 says it is not).

**Test B — Postgres restore drill (P0):**

1. Decide whether the test target is a Neon branch or a fresh Neon project. A Neon branch is cheaper but does not test the cross-project recovery path. Recommend a fresh project for the first drill, branch for subsequent monthly drills.
2. Either use Neon's built-in PITR to a branch (10-second operation) or use `pg_dump`/`pg_restore` if an independent logical dump has been added (not yet — that is Phase 2 work).
3. Time the operation. Document: duration, row counts per major table (compare to source), any schema or data discrepancies.
4. Spot-check: pick 5 random `walletLedgerEntries` rows from source, confirm they appear unchanged in target.

**Test C — Single-file restore from GCS (P0):**

1. Pick a single backup file from `gs://petwash-code-backups/` and restore the tar.gz to a scratch directory locally. Verify SHA-256 matches the value logged in `backup_logs` Firestore collection.
2. This proves the GCS read path works and the integrity hash is honest.

**Deliverable:** A short test report appended to this Phase 1 doc (or saved as `docs/PHASE_1_RESTORE_DRILL_REPORT.md`), with timing, outcomes, and discovered gaps. Phase 2's RECOVERY_RUNBOOK.md will be informed by these results.

**What I need from you for Test B:** Read-only access to a Neon dev branch or permission to create one. If you prefer, you can run the drill yourself and paste the output to me, and I will write the test report.

---

## 6. Gaps vs the architecture proposal — current state

| Proposal section | Gap | Severity | Recommended action |
|---|---|---|---|
| §3.1 Neon PITR | PITR window unknown; may be 7 days on Launch tier | P1 | Verify in console (§2.2); upgrade to Scale if 30-day RPO target stands |
| §3.1 Independent pg_dump | Not implemented | P1 | Phase 2 — add Cloud Run Job |
| §3.2 Firestore PITR | Almost certainly not enabled | P1 | One-click enable in Firebase Console (reversible) |
| §3.2 Managed Firestore exports | Not used — code is roll-your-own | P1 | Phase 2 — add managed export alongside existing JSON |
| §3.2 `legal_holds` collection backup | Not in export list | P1 | Phase 2 — add to COLLECTIONS array |
| §3.2 `backup_logs` Firestore collection backup | Self-referential gap | P1 | Phase 2 — add to COLLECTIONS array |
| §3.3 GCS Object Versioning | Likely off (verify §2.1) | P0 | Phase 1 reversible step — turn ON |
| §3.3 GCS Bucket Lock | Off (verify §2.1) | P0 | Phase 3 only, after legal sign-off (IRREVERSIBLE) |
| §3.3 GCS lifecycle to Coldline/Archive | Likely none | P1 | Phase 1 reversible step — add lifecycle |
| §3.3 CMEK on backup buckets | Not configured | P2 | Phase 3 |
| §3.4 DB triggers on audit tables | Not implemented (convention only) | P1 | Phase 3 |
| §3.4 Postgres role separation | Single role today | P1 | Phase 3 |
| §3.4 BigQuery audit log sink | Not configured | P2 | Phase 3 |
| §3.5 Data classification matrix sign-off | Not obtained | P0 | This week — forward §3.5 of proposal to accountant + privacy counsel |
| §3.6 Step-up OTP on destructive routes | Not implemented | P1 | Phase 4 |
| §3.6 Soft-delete on finance_roles etc. | Hard-delete still used | P1 | Phase 4 |
| §3.7 GCP project organization | Single project, no folder | P2 | Phase 5 — consider org policy at GCP folder level |
| §3.9 Google Workspace Shared Drives | Unknown if exist | P1 | Phase 1 — inventory in Admin console (§2.5) |
| §3.9 Vault retention rules | None configured | P1 | Phase 3 — after Workspace tier confirmed |

---

## 7. Recommended Phase 1 finishing actions (all reversible, all read-only or additive-safe)

These are the actions I would do or that you would do once you have a few minutes in the consoles. NONE of them are destructive or irreversible. NONE of them apply a Bucket Lock or any retention policy that cannot be reverted.

1. **You — fetch §2.1 through §2.6 outputs** in your console session. 5 minutes per item. Paste them back to me and I will append a "measured state" subsection to this report. This unblocks the cost-estimate refinement.
2. **You — enable GCS Object Versioning** on the three backup buckets via console. This is FULLY REVERSIBLE — disable any time. No data is locked. Catches accidental file overwrites starting immediately. Console: Storage → Bucket → Protection tab → Versioning → Edit.
3. **You — enable GCS soft-delete** on the three backup buckets (7-day default). FULLY REVERSIBLE. Catches accidental console deletions.
4. **You — enable Firestore PITR** in Firebase Console (one click). FULLY REVERSIBLE. Free for first 7 days. Once enabled, you can recover to any point in the last 7 days for any single document.
5. **You — forward §3.5 of the architecture proposal** to your accountant for written confirmation of the 7-year retention scope. This is the gate to Phase 3.
6. **You — forward §3.5 (the 4 non-financial rows) + §3.9.5 (Vault retention)** to your privacy counsel for written confirmation. This is the second gate to Phase 3.
7. **Engineering — Phase 2 prep** (after you greenlight, separate PR): add the missing collections (`legal_holds`, `backup_logs`) to the Firestore export COLLECTIONS array; add a managed-export call alongside the roll-your-own JSON; write the `pg_dump` Cloud Run Job; author `RECOVERY_RUNBOOK.md`; execute the restore drill in dev.

---

## 8. What this Phase 1 report deliberately does NOT do

- Does not lock any retention policy.
- Does not change any IAM grant.
- Does not add any database trigger.
- Does not change any schema.
- Does not change any production cron schedule.
- Does not enable any new GCP service in production.
- Does not modify any code under `server/`, `client/`, `shared/`, or `migrations/`.
- Does not add any dependency.

The only change in this PR is this Markdown doc.

---

## 9. Decision points awaiting your input

- **A. Confirm or correct the §2 console-fetch checklist.** If you would rather run the commands and paste output, do that. If you want me to pause Phase 2 until that data is in, say so.
- **B. Confirm the §7 reversible safety nets** (versioning, soft-delete, Firestore PITR) — these are 3-minute console actions and would close the most embarrassing gap immediately. I can write a one-page checklist if helpful.
- **C. Forward §3.5 of the architecture proposal** to accountant + privacy counsel. They are the gating sign-off for any Phase 3 work.
- **D. Decide on Workspace tier**. If you are on Business Starter or Standard today, you do not have Vault — that blocks Layer 2 immutable retention. Business Plus or higher is required.
- **E. Decide whether the restore drill (§5) happens this week or next.** I can do most of the test scripting; you provide the dev environment access or a dev Neon project URL.

---

**End of Phase 1 report. Awaiting your console outputs and decisions A–E.**
