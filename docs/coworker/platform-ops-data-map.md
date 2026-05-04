# PR-27 — Platform Ops Coworker Data Map (Plan-Only)

**Scope:** Read-only inventory of the data sources a future "platform ops"
AI coworker family would consume. **Plan only.** No code, no schema migrations,
no new dependencies, no runtime side effects (no K9000 commands, no Nayax
retries, no cron triggers, no payment-webhook replays).

This document maps the existing surfaces a platform-ops coworker would query
through the same readonly-db / governance contract that PR-20/PR-21 already
established for the other coworker families.

---

## Hard rules (carried forward from PR-20/PR-21/PR-22)

The platform-ops coworker, if/when wired in a follow-up PR, MUST:

1. Be **gated by `requireBrainAccess`** (super-admin email allowlist OR
   `ceo | cfo | ops_lead` role) — same gate as `/api/admin/brain` and
   `/api/admin/coworker/*` (`server/routes/coworker.ts:39`).
2. Use the **`server/services/coworker/readonly-db.ts`** wrapper — SELECT-only,
   no WITH...INSERT, no multi-statement bundles. Defense-in-depth on top of
   Drizzle / Postgres role permissions.
3. Pass through **`server/services/coworker/governance.ts`** — rate limit per
   (actor, family), output safety scan for "decision verbs", deterministic
   fallback contract on Gemini unavailability.
4. Return the **`CoworkerOutput`** shape from `shared/coworker-types.ts`
   (`wired`, `fallback`, `generatedAt`, `ttlSeconds`, anomalies,
   recommendations) — advisory only. **No money, refund, payout, retry, ban,
   or hardware-command decisions are derived from the output.** A human admin
   click + audit log is the only path that ever executes an action.
5. **NEVER** expose Tranzila or Nayax payloads beyond the read shape declared
   below. Webhooks are read-only inputs to this map; the coworker MUST NOT
   call `POST /webhooks/*` retry endpoints, MUST NOT issue Tranzila refund /
   capture requests, and MUST NOT trigger Nayax commands.

---

## Source 1 — Station Alerts

**Purpose:** Surface open / unacknowledged station alerts (low supplies,
equipment failure, offline, maintenance due, high usage, temperature warning)
so the ops coworker can summarize current site health.

**Primary store**

- Table: `station_alerts` (Drizzle: `stationAlerts`)
- File: `shared/schema-enterprise.ts:649-685`
- Indexes already exist on `(station_id, severity, status, triggered_at)`,
  so the coworker's read queries are non-degrading.

**Read shape (SELECT-only)**

```sql
SELECT id, station_id, alert_type, severity, title, message,
       triggered_at, status, acknowledged_at, resolved_at,
       work_order_id
FROM station_alerts
WHERE status IN ('open', 'acknowledged')
  AND triggered_at >= now() - interval '24 hours'
ORDER BY severity DESC, triggered_at DESC
LIMIT 200;
```

**Adjacent context the coworker should join (read-only)**

- `petWashStations` (station name, location, franchiseId) —
  `shared/schema.ts` / `shared/schema-enterprise.ts`.
- `maintenanceWorkOrders` via `station_alerts.work_order_id` for
  "is a fix already in flight?".
- `stationTelemetry` (last heartbeat, networkLatency) for cross-checking
  "alert says offline but heartbeat is fresh" anomalies —
  `shared/schema-enterprise.ts:640`.

**Coworker consumption**

- Anomaly cards: `severity === 'critical'` rows older than N minutes
  unacknowledged.
- Recommendation cards: deep-link to existing admin station detail page; do
  not auto-acknowledge or auto-resolve.

**Hard stops**

- The coworker MUST NOT issue K9000 commands, MUST NOT update
  `station_alerts.status`, MUST NOT create work orders. All writes go through
  the existing admin UI.

---

## Source 2 — Cron Health

**Purpose:** Tell ops which scheduled jobs are configured, when they last ran,
and whether the realtime station-health cron is reporting healthy.

**Primary stores**

- **Static cron registry (code-level, no DB):**
  - `server/backgroundJobs.ts` — central scheduler. Every `cron.schedule(...)`
    call here is the canonical source for "what crons exist". Registered
    schedules include `*/5 * * * *` auto-void, `0 * * * *` recovery sweeps,
    `0 8 * * *` daily-close reminders, `0 10 1 * *` monthly settlements, etc.
    Lines 50-371 enumerate the full set.
  - `server/cron/*.ts` — per-cron implementations:
    `auto-approve-completions.ts`, `auto-void-expired-payments.ts`,
    `monthly-settlements.ts`, `recovery-automation.ts`,
    `station-heartbeat-monitor.ts`, `winback.ts`.
  - `server/jobs/*.ts` — long-running monitors (`healthMonitor.ts`,
    `sla-monitor.ts`, `watchdog.ts`, `wallet-reconciliation.ts`,
    `kycDeletionJob.ts`, `winback-processor.ts`, etc.).

- **Runtime health signal (in-memory + logs):**
  - `server/jobs/healthMonitor.ts` — every 5 minutes computes a
    `StationStatus { ok, responseTime, lastError }` per station based on
    `last_heartbeat` (10-minute freshness window) and `iot_status`. Signals
    are emitted via `logger` and `NotificationService` (Slack), not persisted
    to a dedicated cron-health table.

- **Per-station heartbeat timestamps (DB):**
  - `petWashStations.last_heartbeat` and `petWashStations.iot_status` —
    derived signal of "did the heartbeat cron observe this station recently?".

**Read shape**

The coworker has no `cron_runs` / `failed_jobs` table to query (see Source 3
below). The platform-ops coworker would therefore consume cron health via:

1. Static catalog (code-derived constants, generated at build time — NOT a
   schema change).
2. Live freshness via `petWashStations.last_heartbeat < now() - interval '10
   minutes'` aggregated by franchise.
3. Recent log lines (Cloud Logging) filtered on `[HealthMonitor]`,
   `[BackgroundJobs]`, `[Cron]` prefixes — surfaced via the existing
   observability pipeline (`server/lib/observability.ts`), not directly by SQL.

**Coworker consumption**

- "X stations have not heartbeated in >10m" anomaly.
- "Cron Y last logged success >2h ago" warning (sourced from logs, not DB).

**Hard stops**

- The coworker MUST NOT trigger crons, MUST NOT call any
  `cron.schedule(...).now()` shim, MUST NOT POST to admin endpoints that
  enqueue jobs.

---

## Source 3 — Failed Jobs

**Purpose:** Surface background-job failures the ops team should investigate.

**Current state of the data source**

There is **no dedicated `failed_jobs` / `job_runs` table** in the Drizzle
schema. A repo-wide search across `shared/*.ts` shows no such table. The only
`failed_jobs`-style reference lives in
`server/routes/prestige-pass.ts` and is unrelated to the cron system.

Background-job failure information today flows through three secondary
channels:

1. **Structured logs** — every `server/cron/*.ts` and `server/jobs/*.ts`
   wraps its run in try/catch and emits `logger.error(...)` with a job tag.
   Cloud Logging is the de-facto source of failure history.
2. **Ops incidents** — `ops_incidents` table
   (`shared/schema-operations.ts:119`) is the human-curated incident log.
   Some critical job failures get promoted to incidents by the existing
   alerting; most do not.
3. **Watchdog tables (Gemini-driven, not cron-driven)** — `watchdog_issues`,
   `watchdog_auto_fixes` (`shared/schema-gemini-watchdog.ts:13, 59`) record
   issues found by the Gemini watchdog runtime. These are *application*
   issues (checkout failure, signup struggle) rather than *cron-job*
   failures, so they only partially overlap.

**Read shape (best available today)**

```sql
-- Watchdog auto-fixes / issues (DB)
SELECT id, issue_type, severity, status, detected_at, resolved_at
FROM watchdog_issues
WHERE detected_at >= now() - interval '7 days'
  AND status IN ('open', 'investigating')
ORDER BY severity DESC, detected_at DESC
LIMIT 100;

-- Ops incidents (DB)
SELECT id, title, severity, status, opened_at, resolved_at, source
FROM ops_incidents
WHERE opened_at >= now() - interval '7 days'
  AND status IN ('open', 'in_progress')
ORDER BY severity DESC, opened_at DESC
LIMIT 100;
```

For pure cron-job failures, the ops coworker would have to query the
**logging pipeline** (Cloud Logging severity=ERROR, tag like `[Cron]` or
`[Jobs]`) — there is no SQL surface for this today.

**Coworker consumption**

- Recommendation: aggregate watchdog + ops_incidents counts per category, link
  to existing admin pages.
- Plan-only note: a future PR may introduce a `job_runs` table to give the
  coworker a SQL surface; **out of scope for PR-27** (no schema migrations).

**Hard stops**

- MUST NOT retry failed jobs. MUST NOT mark watchdog or ops_incidents rows as
  resolved.

---

## Source 4 — Payment Webhook Inbound Logs (Tranzila + Nayax) — READ ONLY

**Purpose:** Let the ops coworker count inbound webhook events, spot
unprocessed / errored deliveries, and surface "X% of Tranzila webhooks today
returned an error" without ever touching the payment money path.

**Primary stores**

### Nayax (K9000 terminal payments)

- Table: `nayax_webhook_events` (Drizzle: `nayaxWebhookEvents`)
- File: `shared/schema.ts:751-763`
- Columns of interest:
  `id, event_type, event_id, transaction_id, terminal_id, payload, signature,
  processed, processed_at, error, created_at`.
- Idempotency key: `event_id` (unique). Coworker must use this to
  deduplicate; **never rewrite this table**.

### Tranzila (digital purchase rail)

- Tables (all in `shared/schema-tranzila.ts`):
  - `tranzila_transactions` (line 50) — `processor_payload_raw` jsonb stores
    the raw API/webhook payload; `transaction_kind`,
    `processor_transaction_id`, status fields are the canonical state.
  - `tranzila_payment_requests` (~line 200) — webhook updates flip these
    between `viewed → paid → failed`.
  - `tranzila_chargebacks` (~line 285) — webhook events when chargeback cases
    open or update.
- Note from the schema header: ownership contract — Nayax and Tranzila fields
  MUST NOT appear on the same transaction row. The coworker MUST respect this
  separation and join only via the documented `pw_payment_id` /
  `idempotency_key` cross-references.

**Read shape**

```sql
-- Nayax inbound webhook health (last 24h)
SELECT event_type,
       count(*)                                 AS total,
       count(*) FILTER (WHERE processed)        AS processed,
       count(*) FILTER (WHERE error IS NOT NULL) AS errored,
       max(created_at)                          AS latest
FROM nayax_webhook_events
WHERE created_at >= now() - interval '24 hours'
GROUP BY event_type
ORDER BY errored DESC NULLS LAST, total DESC;

-- Tranzila transaction status mix (last 24h)
SELECT transaction_kind,
       status,
       count(*) AS n
FROM tranzila_transactions
WHERE created_at >= now() - interval '24 hours'
GROUP BY transaction_kind, status
ORDER BY n DESC;
```

**Coworker consumption**

- Anomaly: `errored / total > 1%` on a Nayax `event_type`.
- Anomaly: Tranzila `failed` count spike vs 7-day baseline.
- Recommendation: deep-link to the existing admin webhook diagnostic page;
  do not auto-replay.

**Hard stops**

- MUST NOT POST to webhook-replay endpoints.
- MUST NOT call Tranzila REST (charge / refund / capture).
- MUST NOT issue Nayax commands or terminal retries.
- MUST NOT decrypt or log full PAN / card data; the coworker only consumes
  status + counts. `processor_payload_raw` content is OUT OF SCOPE for any
  Gemini prompt body — the readonly-db wrapper still permits reading the
  column, but the governance layer's output-safety scan plus prompt
  construction for this family MUST exclude raw payment payloads.

---

## Source 5 — Gemini Usage Stats

**Purpose:** Tell ops how heavily the platform is leaning on Gemini today —
which families call it most, what the fallback rate looks like, and whether
governance rate-limits are kicking in.

**Primary stores**

- **Watchdog DB (closest to "Gemini ran X" data):**
  `watchdog_issues`, `watchdog_user_struggles`, `watchdog_auto_fixes`,
  `watchdog_checkout_monitoring`, `watchdog_registration_monitoring`,
  `watchdog_user_journeys` — all in `shared/schema-gemini-watchdog.ts`.
  Each row implies one or more Gemini calls performed by
  `server/services/GeminiWatchdogService.ts` (`getStatus()` at line ~878
  is the existing aggregator).
- **Coworker governance counters (in-memory, per Cloud Run replica):**
  `server/services/coworker/governance.ts` rate-limit windows per
  `(actorUserId, family)`. Not persisted to DB — surfaced via logs only.
- **Gemini client logs:** `server/gemini.ts` and `server/lib/gemini-client.ts`
  emit structured logs around every Vertex AI call (`gemini-2.5-flash`,
  `gemini-2.5-pro`). Cloud Logging is the source of truth for raw call
  counts and latency.
- **No dedicated `gemini_usage` table exists** (confirmed by repo-wide
  search). PR-27 explicitly does NOT add one.

**Read shape**

```sql
-- Watchdog activity proxy (counts as a lower bound on Gemini calls)
SELECT date_trunc('hour', detected_at) AS bucket,
       count(*) AS watchdog_events
FROM watchdog_issues
WHERE detected_at >= now() - interval '24 hours'
GROUP BY bucket
ORDER BY bucket;
```

For per-call latency, token counts, and fallback ratio, the coworker would
read **Cloud Logging**, not SQL. PR-27 plan-only note: persisting
per-call usage to a `gemini_call_log` table is a candidate for a later PR;
**out of scope here**.

**Coworker consumption**

- Anomaly: fallback rate (governance log signal) > 20% in last 1h.
- Anomaly: watchdog activity spike vs 7-day baseline.

**Hard stops**

- MUST NOT call Gemini reflectively to summarize Gemini usage. The Gemini
  usage card is built from logs/SQL counts only — never via another Gemini
  prompt. (Avoids feedback loop + cost runaway.)

---

## Source 6 — Env Validation Surface

**Purpose:** Tell ops which environment variables are required, which are
optional, and which are currently missing in the running deploy.

**Primary store**

- File: `server/lib/env-validation.ts` — Zod-based `EnvSchema`. All keys
  carry `.describe(...)` strings that explain what each var does. Required
  vs optional is encoded by `.min(...)` vs `.optional()` on each field.
- Loaded at process start; missing required fields make the process crash
  early (per the file header: "ensures the app crashes immediately if
  critical config is missing").

**Read shape**

The schema itself is the source of truth — there is **no DB table**. The
coworker's "env health" card is built from:

1. The static schema (parsed once at boot, exposable via a small read-only
   admin endpoint — to be added in a follow-up PR, **not in PR-27**).
2. The set of keys actually present in `process.env` at boot, intersected
   with the required-key list. Missing required keys would have already
   crashed the process; missing **optional** keys disable features.

Conceptual JSON shape the coworker would render:

```json
{
  "required": [
    { "key": "DATABASE_URL", "present": true },
    { "key": "JWT_SECRET", "present": true, "minLength": 32 },
    { "key": "VITE_FIREBASE_PROJECT_ID", "present": true }
  ],
  "optional_disabled": [
    { "key": "NAYAX_API_KEY", "feature": "nayax_payments" },
    { "key": "ITA_CLIENT_ID", "feature": "israeli_tax_authority" }
  ],
  "generatedAt": "<iso8601>"
}
```

**Coworker consumption**

- Anomaly: a high-priority feature flag (e.g. NAYAX_*) is missing → warn.
- Recommendation: link to the deploy console / GitHub secrets page;
  never auto-set a secret.

**Hard stops**

- MUST NOT log or echo secret values (only key names + presence boolean).
- MUST NOT call any "set env" / "rotate secret" endpoint.
- The redaction guarantee is enforced at the prompt-construction layer
  before any Gemini call.

---

## Cross-cutting: where this lands in the existing architecture

| Concern              | Existing surface                                                | PR-27 changes |
|----------------------|-----------------------------------------------------------------|---------------|
| Auth gate            | `server/middleware/requireBrainAccess`                          | none          |
| SQL safety           | `server/services/coworker/readonly-db.ts`                       | none          |
| Output safety        | `server/services/coworker/governance.ts`                        | none          |
| Output contract      | `shared/coworker-types.ts` (`CoworkerOutput`, families enum)    | none          |
| Mount point          | `server/routes/coworker.ts` (`/api/admin/coworker/...`)         | none          |
| Schema               | Drizzle tables listed above, all already present                | **none**      |
| Dependencies         | existing `node-cron`, `drizzle-orm`, `zod`, Vertex AI client    | **none**      |

The only change in PR-27 is **this docs file** under `docs/coworker/`.

---

## Out of scope (explicitly)

- No new `coworker family` enum entry (`'platform_ops'` would be added in a
  later wiring PR; `shared/coworker-types.ts` is unchanged here).
- No new Drizzle tables (`job_runs`, `gemini_call_log`, `cron_runs`, etc.).
- No new endpoints. No `/api/admin/coworker/platform-ops/*` route file.
- No Gemini prompt templates. No fallback summarizer code.
- No K9000 commands. No Nayax retries. No webhook replays. No cron triggers.
- No env-rotation, no secret reads beyond presence checks.

---

## Acceptance for PR-27

- [x] One markdown file added under `docs/coworker/`.
- [x] Each of the 6 data sources has: where it lives, the read shape, what
      the coworker consumes, hard stops.
- [x] No code, schema, or dependency changes.
- [x] No `attached_assets` or unrelated files staged.
