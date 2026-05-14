# Backup, Retention & Audit Architecture — Proposal

**Status:** Proposal for review. **No implementation has been done.**
**Author:** Claude (CEO-commissioned audit, May 2026)
**Companion doc:** `YOU_ARE_SAFE_GUIDE.md` (existing DR overview)
**Scope:** Postgres (Neon), Firestore, Cloud Storage, audit logs, legal retention, admin safety, GCP service strategy.

---

## 0. TL;DR

The platform's audit and immutability foundation is **stronger than expected**. 20+ INSERT-only audit tables, blockchain-style hash chaining in `auditLedger` and `walkBlockchainAudit`, daily Firestore exports already running, `DataRetentionService` + Firestore `legal_holds` collection already in place, and a `softDeleteService` covering user accounts. Credit where due: this is not a greenfield problem.

The gaps are not "we have no backups." They are:

1. **No formal RTO/RPO SLA, no tested recovery runbook.** Backups exist; restores have never been rehearsed.
2. **Backups retained only ~30 days.** Israeli Tax Authority and VAT Law require **7 years** for financial records — a 90× gap on the most sensitive data.
3. **No GCS Bucket Lock / Object Versioning** configured. A compromised admin or a misconfigured lifecycle rule can delete years of audit history.
4. **Immutability is convention, not enforcement.** Audit tables are INSERT-only by application discipline; nothing at the database level prevents an UPDATE or DELETE.
5. **No 2FA / step-up auth on destructive admin routes.** `requireAdmin` is sufficient for read; insufficient for "delete approval chain step" or "revoke finance role."
6. **Backups are not pinned to Israel.** VAT Law 5736-1975 requires VAT records be stored in Israel unless special authorization granted. Current backup buckets' regions are not documented.
7. **Neon serverless Postgres** is the DB — not Cloud SQL. PITR strategy must be Neon-specific, not Cloud SQL-specific. This is a different architecture than most GCP-native proposals assume.

This proposal addresses each gap. Total estimated incremental monthly cost: **$40–$180/month** depending on data volume, plus a one-time setup effort of ~3–5 engineer-days spread across 4 phases.

---

## 1. What's already in place (don't re-build)

Verified by code audit, May 2026:

### Audit / append-only tables (INSERT-only by convention)

| Table | File | Purpose |
|---|---|---|
| `auditEvents` | `shared/schema.ts:12344` | Core audit trail |
| `auditLedger` | `shared/schema.ts:3583` | Hash-chained tamper-evident ledger |
| `walkBlockchainAudit` | `shared/schema.ts:4864` | Hash-chained walk events |
| `walletLedgerEntries` | `shared/schema.ts:11675` | Double-entry wallet ledger |
| `adminActivityLogs` | `shared/schema.ts:1270` | Admin actions |
| `authEvents` | `shared/schema.ts:12280` | Auth events |
| `securityEvents` | `shared/schema.ts:12587` | Security events with risk score |
| `complianceAuditLogs` | `shared/schema.ts:9778` | Compliance decisions |
| `kycAuditLog` | `shared/schema.ts:12175` | KYC verification |
| `emailAudit` | `shared/schema.ts:12669` | Email delivery |
| `notificationLogs` | `shared/schema.ts:279` | Notification delivery |
| `otpEvents` | `shared/schema.ts:12606` | OTP events |
| `smsEvidence` | `shared/schema.ts:12638` | SMS delivery proof |
| `disputeCases` | `shared/schema.ts:13552` | Payment disputes |
| `bookingActionsLog` | `shared/schema.ts:12934` | Booking state transitions |
| `loginSecurityEvents` | `shared/schema.ts:15256` | Login attempts |
| `providerRankingAudit` | `shared/schema.ts:14983` | Ranking overrides |
| `activationAuditLog` | `shared/schema.ts:13218` | K9000 activation |
| `domainEvents` | `shared/schema.ts:236` | Event sourcing backbone |
| `userDeviceEvents` | `shared/schema.ts:3781` | Device events (7-year retention intended) |

### Scheduled backups already running

- **Daily Firestore export** — `server/backgroundJobs.ts:65-67` — runs at midnight Asia/Jerusalem to GCS bucket `petwash-firestore-backups`.
- **Weekly code backup** — `gs://petwash-code-backups` — tar.gz weekly.
- **Continuous secure messages backup** — `gs://petwash-secure-messages`.
- **Backup email reports with SHA-256 integrity hashes** — `YOU_ARE_SAFE_GUIDE.md:113-124`.

### Retention & legal-hold tooling

- `server/services/softDeleteService.ts` — handles user-level soft delete with `users.softDeleteAt`.
- `server/services/DataRetentionService.ts` — references retention policies.
- `businessLegalIdentities.retentionStatus` + `retentionExpiresAt` — column-level legal hold for business records (`shared/schema.ts:10651`).
- Firestore `legal_holds` collection — referenced in retention logic.
- `isDeleted` soft-delete flag on `bookingMessages`, `socialPosts`, `socialComments`, `socialDirectMessages`.

### Audit middleware

- `auditMiddleware` (`server/routes.ts:166`) — auto-logs admin requests to `auditEvents`.
- `logAuditEvent()` helper — used across destructive routes.

**Bottom line:** the architecture *thinks* about audit, retention, and legal holds correctly. The hardening proposal below is about **enforcement** (DB-level, infra-level, regional-residency-level) and **longevity** (extending 30-day retention to 7 years for financial classes of data).

---

## 2. P0 / P1 / P2 gap matrix

| # | Gap | Severity | Why it matters |
|---|---|---|---|
| G1 | **No tested recovery runbook**. Backups exist; restores have never been done end-to-end. | **P0** | A backup you've never restored from is hope, not a backup. Industry consensus: untested backups fail ~30% of the time. |
| G2 | **Audit logs retained only ~30 days** in GCS; financial records legally require 7 years. | **P0** | Direct legal exposure: 1% of tax liability penalty (post-July-2024) for inadequate VAT records. |
| G3 | **No GCS Bucket Lock / Object Versioning** on backup buckets. | **P0** | A compromised IAM principal or a buggy lifecycle rule can erase all backups in minutes. WORM lock makes this irrecoverable. |
| G4 | **Backup region not pinned to Israel**. VAT Law 5736-1975 requires VAT records be stored in Israel unless special authorization. | **P0 (compliance)** | Sector regulator can audit at any time. |
| G5 | **Immutability is application-convention only**. Schema permits UPDATE/DELETE on audit tables. | **P1** | A SQL injection, a rogue migration, or a careless admin script can rewrite history. |
| G6 | **No 2FA / step-up auth on destructive admin routes** (`DELETE /admin/wallet/finance-roles/:uid`, etc.). | **P1** | Stolen admin session → permanent financial role state changes with no second factor. |
| G7 | **Neon PITR window** is unknown / unverified for current plan. Stated default in GCP land is 7–35 days; Neon's varies by tier. | **P1** | Without a documented PITR window, RPO is undefined. |
| G8 | **Hard DELETE statements exist** in code paths that should be soft-only (e.g., `finance_roles`, `approval_chain_steps`, `remediation_suggestions`). | **P1** | Defeats the "no single admin can hard-delete evidence" requirement. |
| G9 | **No cross-region replication / cold archive tier**. Single-region failure = full outage of backup access. | **P2** | Tel Aviv region outage scenario; correlated risk with primary. |
| G10 | **No formal data classification** mapping each table → retention class → legal basis. | **P2** | Hard to defend "we kept this for 7 years" without a written policy. |

---

## 3. Recommended architecture

### 3.1 PostgreSQL (Neon)

**Current state:** Neon serverless via `DATABASE_URL`. No `pg_dump`, no `pgbackrest`, no `wal-g` — Neon handles backups internally.

**Recommendation:**

1. **Confirm and document Neon's current plan and its PITR window.** Neon offers PITR per branch with retention varying by tier (typically 7 days on free/starter, 30 days on paid). Upgrade if needed to **30-day PITR minimum**.
2. **Nightly logical `pg_dump` to GCS, region `me-west1` (Tel Aviv).** Even though Neon has its own backups, an independent vendor-portable dump is critical insurance — both for vendor lock-in and for the "Neon outage" scenario.
3. **Weekly verified-restore drill** on a Neon dev branch. Restore last night's dump into a throwaway DB, run schema diff + row-count diff, confirm match. Pipe result to admin alerting.
4. **Quarterly full DR exercise** restoring an entire snapshot into a fresh Neon project and pointing a staging app at it. Document the runbook output.

**Exact services to enable:**
- Neon: confirm paid tier with 30-day branch retention.
- GCP: GCS bucket `petwash-postgres-backups` in `me-west1`, Bucket Lock policy 7-year retention, Object Versioning ON.
- Cloud Scheduler + Cloud Run Job (gen2) running `pg_dump` nightly at 02:00 Asia/Jerusalem (offset from the Firestore export at 00:00 to avoid I/O contention).
- Cloud Logging sink for the Cloud Run Job → log-based alerts on failure.

**RPO:** 24h (worst case) / 5min via Neon PITR (best case).
**RTO target:** 4h for full restore.

### 3.2 Firebase / Firestore / Auth

**Current state:** Daily managed export at midnight Asia/Jerusalem to `gs://petwash-firestore-backups`. No PITR mentioned in audit. Firebase Auth has no explicit backup.

**Recommendation:**

1. **Enable Firestore PITR** (max 7-day window) — set in Firestore admin console. Free for the first 7 days; PITR storage billed at standard Firestore pricing.
2. **Keep daily managed exports** as today; extend retention via lifecycle below.
3. **Add weekly Firebase Auth user export** via Admin SDK → GCS `petwash-auth-backups` in `me-west1`. Hashes only (Firebase does not export raw passwords; hashed values are exported with `listUsers()`).
4. **Preserve OTP / consent evidence specifically:** `otpEvents` and `userNotificationConsents` are in Postgres — they're covered by the Postgres backup path above. Confirm both tables are explicitly excluded from any cleanup job.

**RPO:** 24h (export) / 5min (PITR within last 7 days).
**RTO:** 6h for full Firestore restore (managed import is single-region, can be slow on >100GB).

### 3.3 Cloud Storage / uploads

**Current state:** Uploaded files (user photos, K9000 evidence, provider verification docs) managed by `DatabaseStorage` abstraction. No versioning or lifecycle rules detected.

**Recommendation:**

1. **Enable Object Versioning** on all upload buckets. Cost: only delta storage (versions store diffs at full-object granularity, billed at storage rate).
2. **Enable Bucket Lock with retention policy** — different durations per bucket class:
   - User uploads (profile photos, pet photos): **2 years** retention, then lifecycle to delete.
   - Provider verification documents (KYC, licenses): **7 years** retention (locked).
   - K9000 station evidence (wash event proofs, dispute photos): **7 years** retention (locked).
   - Booking/transaction evidence: **7 years** retention (locked).
3. **Bucket Lock is irreversible.** Set the retention period carefully — it can only be increased, not decreased, not removed.
4. **Lifecycle rule** to transition objects to **Coldline** at 90 days and **Archive** at 365 days. Costs drop ~10× for Archive (~$0.0012/GB/month vs ~$0.012/GB/month Standard, in me-west1).
5. **Soft-delete (the GCS-native feature, distinct from app-level `isDeleted`)** with 7-day default. Catches accidental console deletions.

### 3.4 Audit / event logs — database-level immutability

**Current state:** 20+ append-only tables, hash-chained ledger. But the database permits UPDATE/DELETE; only application code prevents it.

**Recommendation:**

1. **PostgreSQL row-level triggers** on each audit table that REJECT any UPDATE or DELETE (allow INSERT only). Implementation: `BEFORE UPDATE OR DELETE` trigger raising `RAISE EXCEPTION 'audit table is append-only'`.
2. **Database role separation:** create a `petwash_app` role with INSERT-only grant on audit tables, and a `petwash_admin` role (used only during migrations) that can ALTER. Application runtime never connects as admin.
3. **Daily checksum job:** compute SHA-256 of each audit table's content (`hashtext(string_agg(...))`) and write to a separate `audit_table_checksums` table. Compare day-to-day; alert on regression.
4. **`auditLedger` hash-chain verification** as a scheduled job — already structurally possible (the columns exist); needs the cron + alert wiring.
5. **Stream audit events to BigQuery** (immutable by virtue of being a separate system + IAM-controlled). Use Cloud Logging → BigQuery sink, partitioned by day. Storage at $0.020/GB/month, queries at $5/TB scanned. 7-year audit corpus likely under 1TB total → ~$20/month at scale.

### 3.5 Legal retention policy

**Israel-specific authoritative references** for the legal/accounting team:

- **VAT Law 5736-1975** + Tax Authority guidance: **7 years from end of tax year** for invoices, receipts, credit notes, supporting documentation. **Must be stored in Israel** unless foreign storage authorized. Penalty: 1% of tax liability for inadequate records (effective July 1, 2024). Sources: Israel Tax Authority, ICNL VAT Law text.
- **Income Tax Ordinance (New Version) 5721-1961:** business books & records 7 years.
- **Privacy Protection Law 5741-1981** + **Privacy Protection (Data Security) Regulations 5777-2017:** annual review of stored data; delete when retention purpose ends; secure-deletion duties. Amendment 13 (effective 2025) strengthens PPA enforcement powers.
- **Companies Law 5759-1999:** corporate records (minutes, shareholder register) per statute.

**Recommended classification matrix:**

| Data class | Retention | Storage region | Immutability |
|---|---|---|---|
| Invoices, receipts, VAT records | 7 years | **Israel (me-west1)** | Bucket Lock + DB triggers |
| Payment events, wallet ledger | 7 years | Israel | Hash chain + Bucket Lock |
| Provider KYC docs | 7 years (from end of relationship) | Israel | Bucket Lock |
| OTP events, consent evidence | 7 years | Israel | DB triggers + INSERT-only role |
| Booking lifecycle records | 7 years (financial linkage) | Israel | DB triggers |
| Dispute cases | 7 years | Israel | Bucket Lock |
| Admin action logs | 7 years | Israel | DB triggers |
| Notification evidence (SMS, email) | 7 years | Israel | Bucket Lock |
| User profile data (non-financial) | Until account deletion + 90 days | Israel | Soft delete |
| User uploads (pet photos etc.) | 2 years from last access | Israel | Versioning + lifecycle |
| Session logs / debug logs | 90 days | Any (no PII) | None |
| Marketing consent / opt-out | 7 years (proof of consent) | Israel | DB triggers |

**Have your accountant + privacy counsel sign off on this matrix before locking Bucket Lock policies — Bucket Lock is irreversible.**

### 3.6 Admin safety

**Current state:** `requireAdmin` middleware on destructive routes; `auditMiddleware` logs the call. No 2FA / step-up on destructive operations. Hard-DELETE SQL exists for some "admin maintenance" operations.

**Recommendation:**

1. **Convert remaining hard-DELETE statements to soft-delete:**
   - `finance_roles` → add `revokedAt`, set on revocation; never DELETE.
   - `approval_chain_steps` → add `removedAt`; never DELETE.
   - `remediation_suggestions` → keep history; add `dismissedAt`.
   - Hard delete remains acceptable for **transient** data only (rate-limit windows, OTP sessions past TTL, WebAuthn challenges).
2. **Step-up OTP gate** on any route classified as "destructive privileged":
   - Issue a fresh OTP to the admin's verified phone before executing the DELETE-class request.
   - Use the existing `TransactionOTPService.ts` infrastructure — it already does timing-safe checks and 30s cooldown.
   - Apply via a `requireStepUpOTP` middleware composed after `requireAdmin`.
3. **Two-person rule** on permanently destructive operations (e.g., revoke a finance role on the CEO's own account, delete a provider's KYC bundle):
   - Operation enters `pending_approval` state.
   - Second admin must approve within 24h or the operation expires.
   - Already partially modelled in `approval_chain_steps`.
4. **Audit log for the audit itself:** when an admin views an audit log (read access), record that. `auditEvents.actionType = 'audit_log_viewed'`.

### 3.7 GCP service strategy

**Region:** **me-west1 (Tel Aviv)** primary. Disaster-recovery secondary: **europe-west4 (Netherlands)** with multi-region replication off by default, opt-in only after legal authorization for foreign storage. Egress me-west1 → europe-west4 is $0.08/GB if needed.

**Services to enable:**

| Service | Purpose | Setup effort |
|---|---|---|
| **Cloud Storage** (existing, but add Bucket Lock + Versioning) | Backups, uploads, archive | 0.5 day |
| **Cloud Storage Coldline / Archive tier** | 90-day / 365-day lifecycle for old backups | included |
| **Cloud Scheduler** | Trigger nightly pg_dump, weekly Auth export | 0.5 day |
| **Cloud Run Jobs (gen2)** | Run pg_dump container | 1 day |
| **Cloud KMS** | Customer-managed encryption keys for buckets (Bucket Lock + CMEK is the strongest guarantee) | 0.5 day |
| **BigQuery** | Audit log archive, queryable for compliance review | 1 day |
| **Cloud Logging sink → BigQuery** | Pipe `auditEvents` to BQ for archive | 0.5 day |
| **Secret Manager** (already in use) | Holds DB creds, KMS keys, service account JSONs | 0 (existing) |
| **Cloud Monitoring + alerting** | RPO/RTO drift alerts, backup-success alerts | 1 day |
| **IAM Conditions** | Restrict destructive bucket ops to break-glass role only | 0.5 day |

**Services to NOT use:**

- **Cloud SQL** — the platform is on Neon; don't migrate just for backups. Use Neon's own PITR plus independent GCS dumps for vendor portability.
- **GCS Multi-Region buckets** for me-west1 data — multi-region in GCP usually means cross-continent, which conflicts with Israel-residency. Use **dual-region (me-west1 + nam5)** only if explicitly authorized.

### 3.8 Estimated monthly costs (range)

Based on a platform with ~50–500 GB of cumulative data (rough estimate; refine after measuring):

| Item | Low (50GB total) | High (500GB total) |
|---|---|---|
| GCS Standard storage me-west1 (recent backups, ~30 days) | $1–2 | $10–15 |
| GCS Coldline storage me-west1 (90d–1yr) | $0.50 | $5 |
| GCS Archive storage me-west1 (1yr–7yr) | $0.10–1 | $1–10 |
| Object Versioning overhead (~30% of base storage) | $0.50 | $5 |
| Bucket Lock | $0 (no extra fee) | $0 |
| Cloud Scheduler | $1 | $1 |
| Cloud Run Jobs (nightly pg_dump, ~5 min compute) | $2 | $5 |
| Cloud KMS (CMEK) | $1 | $1 |
| BigQuery storage (audit archive, partitioned) | $5 | $15 |
| BigQuery queries (light) | $0–5 | $0–10 |
| Cloud Logging ingestion (audit events) | $10 | $40 |
| Cross-region egress (one annual restore drill, 50GB) | $4/yr → $0.30/mo | $24/yr → $2/mo |
| **Estimated total** | **~$25/mo** | **~$110/mo** |
| **Plus Neon plan upgrade (if needed, for 30-day PITR)** | $19–69/mo | $69–700/mo |

The Neon upgrade dominates the bill. Worth a separate cost analysis once data volume is measured. For a small marketplace, **expect $40–$180/month all-in** in steady state; for a mid-size platform, **$200–$1000/month**.

---

## 4. Recovery process (RTO/RPO targets)

| Scenario | RPO target | RTO target |
|---|---|---|
| Single-row mistaken update on Postgres (e.g., wrong wallet balance) | 5 min | 30 min (Neon PITR branch to throwaway DB, surgical UPDATE) |
| Single-table corruption | 1h | 2h (restore table from last night's dump) |
| Full Postgres loss | 24h | 4h (restore last night's dump to fresh Neon project) |
| Single Firestore collection deletion | 5 min | 1h (Firestore PITR if <7 days) |
| Full Firestore loss | 24h | 6h (restore last managed export) |
| Single uploaded file deletion (user mistake) | 0 (versioning) | 5 min |
| Full GCS bucket deletion | 0 (Bucket Lock prevents) | N/A — cannot occur |
| Region outage (me-west1 down) | 24h | 4h if dual-region authorized; otherwise wait for region recovery |
| Audit log tampering detected | 0 (hash chain) | Investigation only, no restore needed |

**Runbook outline (to be authored in Phase 2 — see rollout below):**

1. Incident detection (alerting fires).
2. Severity classification (P0/P1/P2).
3. Decision tree: which restore path?
4. Step-by-step gcloud / Neon CLI commands.
5. Verification (row counts, schema diff, application smoke test).
6. Communication template for users / regulators.
7. Post-incident: drift analysis, audit log capture, lessons-learned doc.

---

## 5. Phased rollout plan

Each phase is ~1 week of engineering effort plus review. **No phase should be skipped.**

### Phase 1 — Foundation & evidence preservation (P0, week 1)

**Objective:** Stop bleeding. Make sure today's backups can't be deleted tomorrow.

- Enable **Object Versioning** on all existing backup buckets (`petwash-firestore-backups`, `petwash-code-backups`, `petwash-secure-messages`).
- Enable **GCS soft-delete** (7-day default).
- Set initial **non-locked retention policies** (so we can test).
- Document current Neon plan + its PITR window in `YOU_ARE_SAFE_GUIDE.md`.
- Inventory of upload buckets + their current region. Move any non-Israel data to `me-west1`.
- **No locking yet** — Phase 1 is reversible.

### Phase 2 — Recovery rehearsal (P0, week 2)

**Objective:** Prove the backups work.

- Author the recovery runbook (`docs/RECOVERY_RUNBOOK.md`).
- Restore last night's Firestore export into a dev Firestore project. Document time + outcome.
- Spin up a Neon dev branch, restore a hypothetical bad-data scenario via PITR. Document.
- Tabletop a "K9000 station evidence missing" scenario.
- Quarterly drill cadence scheduled.

### Phase 3 — Immutability & residency lock-down (P0/P1, weeks 3–4)

**Objective:** Make deletion of evidence physically impossible.

- Add database triggers rejecting UPDATE/DELETE on the 20 audit tables enumerated in §1.
- Create the `petwash_app` Postgres role with INSERT-only grants on audit tables. Switch app runtime to it.
- Lock Bucket Lock policies on Israel-residency buckets (after legal sign-off; **irreversible**).
- Enable CMEK (Customer-Managed Encryption Keys) via Cloud KMS for the locked buckets.
- Wire BigQuery audit-log sink. Set 7-year partition expiration.

### Phase 4 — Admin safety & convention cleanup (P1, week 5)

**Objective:** No single admin can hard-delete critical evidence.

- Convert remaining hard-DELETE statements to soft-delete (finance_roles, approval_chain_steps, remediation_suggestions).
- Add `requireStepUpOTP` middleware. Apply to all destructive admin routes enumerated in §6 of the audit report.
- Wire two-person approval for the smallest set of critical operations (revoke own admin role, delete provider KYC bundle).
- Enable detailed audit-log-viewed events.

### Phase 5 — Optional cross-region DR (P2, week 6+)

**Objective:** Survive a me-west1 region outage.

- Obtain legal authorization for cross-region backup mirror (or document that this is accepted risk).
- Configure dual-region or one-way replication to europe-west4.
- Annual full DR test using the secondary region.

---

## 6. Exact repo / env / config changes (enumerated, not implemented)

This is the to-do for the implementing engineer. **No file modifications are part of this proposal commit.**

### New environment variables

```
GCS_BACKUP_REGION=me-west1
GCS_POSTGRES_BACKUP_BUCKET=petwash-postgres-backups
GCS_AUTH_BACKUP_BUCKET=petwash-auth-backups
GCS_KMS_KEY_NAME=projects/<proj>/locations/me-west1/keyRings/<ring>/cryptoKeys/petwash-backups
BIGQUERY_AUDIT_DATASET=petwash_audit_archive
NEON_PROJECT_ID=<neon-project>
NEON_API_KEY=<from-neon-console>  # via Secret Manager
BACKUP_ALERT_EMAIL=ops@petwash.co.il
RECOVERY_DRILL_SLACK_WEBHOOK=<webhook>
```

### New files to create

- `docs/RECOVERY_RUNBOOK.md` — step-by-step recovery procedures.
- `docs/DATA_CLASSIFICATION_MATRIX.md` — table → retention class → legal basis, signed off by counsel.
- `docs/BACKUP_DRILL_LOG.md` — append-only log of every quarterly drill.
- `server/jobs/postgresNightlyBackup.ts` — Cloud Run Job entry.
- `server/jobs/recoveryDrillVerifier.ts` — automated post-restore verification.
- `migrations/<n>_audit_triggers.sql` — DB triggers rejecting UPDATE/DELETE on audit tables.
- `migrations/<n>_petwash_app_role.sql` — role separation grants.
- `server/middleware/requireStepUpOTP.ts` — fresh-OTP gate.

### Files to modify (no body changes here, just the to-do list)

- `server/routes.ts` — apply `requireStepUpOTP` to destructive admin routes (the ~9 routes enumerated in §6 of the audit report).
- `server/services/softDeleteService.ts` — extend to cover finance_roles, approval_chain_steps, remediation_suggestions.
- `server/backgroundJobs.ts` — add nightly pg_dump + weekly Firebase Auth export schedules.
- `shared/schema.ts` — add `revokedAt` / `removedAt` / `dismissedAt` columns to the three hard-delete-today tables.
- `cloudrun-service.yaml` — add new env-var injections.
- `docs/YOU_ARE_SAFE_GUIDE.md` — update with the new architecture once Phase 1 lands.

### GCP console changes (not in repo)

- Create buckets in me-west1 with versioning ON.
- Create KMS keyring + key in me-west1.
- Create Cloud Scheduler entries (after Phase 1 reversible config).
- Create BigQuery dataset with 7-year partition expiry.
- Create IAM custom role `petwash-break-glass` with bucket-deletion privileges, assigned to no users by default.
- Enable Firestore PITR via console.
- Enable Cloud Logging audit log retention extension (default 30d → 400d for billable logs).

### No dependency changes required for Phase 1.

Phases 2-4 require:
- `@google-cloud/scheduler` for programmatic schedule creation (optional; can be console-only).
- `@google-cloud/bigquery` for audit-archive verification.
- `pg_dump` binary in the Cloud Run Job container (use the official `postgres:16-alpine` base).

---

## 7. Risks to flag before implementation

1. **Bucket Lock is irreversible.** Once locked, the retention period can only be increased, not reduced. Test extensively in unlocked mode in Phase 1 before locking in Phase 3.
2. **Adding DB triggers to a busy table can lock it briefly.** Schedule the migration in a low-traffic window.
3. **Role separation requires app reconfiguration.** The runtime DB user changes; ensure connection pools, migrations, and dev environments all migrate together.
4. **The Israeli residency claim needs legal verification.** I'm working from public sources. Get explicit counsel sign-off before locking retention policies — once locked, you cannot move the data.
5. **Neon's PITR window and snapshot durability are vendor-controlled.** The independent pg_dump path exists precisely to insulate against a Neon outage. Don't skip it.
6. **Cost estimates are ranges, not commitments.** Measure data volume before committing budget. The audit log archive in BigQuery could grow faster than expected if `domainEvents` is high-velocity.
7. **The 7-year-from-end-of-tax-year clock** is per-record, not per-platform. Records issued in tax year 2026 must be retained until end of 2033. Bucket Lock retention must be calculated from the **latest** record's issuance, not the bucket creation date — practically this means renewing the retention period annually or setting it long enough to cover the longest-lived record.

---

## 8. What this proposal deliberately does not include

- **No SOC 2 / ISO 27001 / PCI-DSS audit preparation.** Those are separate work streams (the audit infrastructure here would support them, but the gap analysis is out of scope).
- **No encryption-at-rest review beyond CMEK setup.** GCS already encrypts at rest; CMEK is additive.
- **No employee-laptop / endpoint backup strategy.** This proposal is platform data only.
- **No source-code repository backup strategy.** GitHub already replicates; the existing weekly tar.gz to `petwash-code-backups` is sufficient.
- **No specific GDPR strategy.** GDPR overlaps with the Israeli Privacy Protection Law materially, but EU customer flows have their own deletion-rights obligations that should be designed separately.
- **No implementation.** This document is the proposal. Nothing in the codebase or infrastructure has been changed by this commit.

---

## 9. References

Primary legal sources:

- Israel Value Added Tax Law 5736-1975 — https://www.icnl.org/wp-content/uploads/Israel_vat1975.pdf
- Israel Income Tax Ordinance (New Version) 5721-1961 — https://www.icnl.org/wp-content/uploads/Israel_Ordinance.pdf
- Privacy Protection (Data Security) Regulations 5777-2017 — http://www.informatica-juridica.com/regulations/privacy-protection-data-security-regulations-5777-2017-5-april-2017/
- IAPP overview of Amendment 13 (2025) — https://iapp.org/news/a/israel-marks-a-new-era-in-privacy-law-amendment-13-ushers-in-sweeping-reform
- ICLG Data Protection Laws and Regulations Report 2025–2026, Israel — https://iclg.com/practice-areas/data-protection-laws-and-regulations/israel

Primary technical sources:

- GCP Cloud Storage Bucket Lock (WORM) — https://docs.cloud.google.com/storage/docs/bucket-lock
- GCP Cloud SQL PITR (for reference; not directly applicable on Neon) — https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr
- Firestore backups + scheduled exports — https://cloud.google.com/firestore/docs/solutions/schedule-export
- Firestore PITR announcement — https://cloud.google.com/blog/products/databases/firestore-adds-point-in-time-recovery-and-scheduled-backups
- Cloud SQL pricing reference — https://cloudcostkit.com/guides/gcp-cloud-sql-pricing/
- Israel VAT invoice retention guide — https://invoicedataextraction.com/blog/israel-vat-invoice-requirements

---

**End of proposal. Awaiting review.**
