# 07 — Admin Observability Architecture

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 9 (Audit, Archival, Legal), Part 10 (Observability & Operational Safety).

---

## 1. Objective

Build the admin-facing observability layer that operations + finance + leadership need to see the platform's true state at all times: finance dashboards, reconciliation status, fraud signals, machine health, payout anomalies, failed activations.

The CEO + CFO + on-call must be able to answer at any moment, without reading raw logs:

- Are we collecting the money we think we are?
- Are providers being paid correctly?
- Are any K9000 machines silently failing?
- Are any reconciliation jobs lagging or alerting?
- Are any wallets / customers showing fraud signals?
- Are deploys healthy?

---

## 2. Current state

| Surface | Today |
|---|---|
| `/health` | OK; reports degraded state when `_startupConfigErrors` non-empty (PR-CI-PAYMENT-MODE) |
| `/health/strict` | 200 / 503 — 503 only on active security violations (Tranzila bypass flag etc.) |
| Build SHA exposure | `getBuildInfo()` (PR-CI-SMOKE-HOTFIX): K_SERVICE / K_REVISION / GIT_SHA |
| Chain verification | Admin HTTP endpoints exist (PR-AUDIT-CHAIN-VERIFY); manual run |
| Finance dashboard | PR-FINANCE-DASH (#193) — exists; partial |
| Real-time admin events | `eventBus` partial wiring |
| K9000 station heartbeats | Schema exists (`station_heartbeat`), monitoring partial |
| Fraud signals surface | NONE consolidated |
| Reconciliation job dashboard | NONE (jobs from Section 03 aren't built yet) |
| Payout anomaly dashboard | NONE (payouts aren't wired yet — Section 05) |

---

## 3. Target architecture

### 3.1 Five admin "rooms" (top-level dashboards)

| Room | Owns visibility for | Powered by |
|---|---|---|
| **Finance** | revenue, VAT collected, refunds, settlement matched / variant, trust account balance | Section 03 + Section 04 + Section 05 |
| **Reconciliation** | per-job status, last-run, variances found, alerts open | Section 03 cron rows |
| **Fraud / Risk** | flagged customers, flagged providers, replay attempts, velocity-cap trips | Section 09 |
| **Operations / Machines** | K9000 station heartbeats, offline machines, failed activations, mid-cycle aborts | existing station tables + Section 03 |
| **Provider Payouts** | per-provider statement status, batch state, failed payouts | Section 05 |

Each room is a typed React route under `/admin/...` gated by `requireAdmin` + `requireBrainAccess` (per `petwash-platform` skill).

### 3.2 Data freshness contract

| Surface | Freshness |
|---|---|
| Live counters (current trust balance, today's revenue) | < 60s lag |
| Reconciliation job status | last run timestamp + completion |
| Fraud signals | < 5 min from event ingest |
| Per-batch payout state | event-driven (websocket / FCM) |
| Historical reports (per-day, per-week, per-month) | end-of-period snapshot, immutable |

### 3.3 Alert classes (paged vs visible-only)

| Class | Triggers | Notification |
|---|---|---|
| **P0 incident** | trust-account drift > N, settlement file missed > 24h, /health/strict 503 in production | PagerDuty / on-call |
| **P1 anomaly** | per-provider payout > 2x rolling average; K9000 machine offline > 1h during operating hours | Slack #ops-alerts |
| **P2 review** | fraud signal flagged; manual reconciliation variance | Admin queue |
| **P3 informational** | daily close summary; weekly trend | Email digest |

Alert thresholds are configurable via env (`ALERT_<CLASS>_<METRIC>_THRESHOLD`) so they can be tuned without code change.

### 3.4 Read-only by default, action-on-click

Every dashboard is read-only. Mutating actions (refund, freeze, override) require:
1. Admin click (no automation)
2. Reason captured
3. Audit event written (PR #198 pattern)
4. Optional second-admin approval for irreversible actions (refund > N, payout-batch override)

This matches Gemini-as-analyst rule from `petwash-platform`: AI suggests, humans decide.

### 3.5 Export package (regulator / accountant)

Per Part 9.7: a one-click export package per period containing:
- Signed CSV of all financial transactions
- Signed PDFs of all issued invoices / receipts / credit notes
- Hash chain proof (Part 9.5/9.6)
- Reconciliation summary
- Provider statements

Export is rate-limited (one per day per user) and audit-logged.

### 3.6 Operational kill switches (Part 10.5)

A locked enum of switches surfaced in admin under Operations / Safety:

| Switch | What it freezes |
|---|---|
| `payout.freeze_all` | Stops all outbound provider payouts |
| `booking.freeze_all` | Stops new booking creation |
| `wallet.freeze_topup` | Stops wallet top-ups |
| `k9000.freeze_activation` | Stops machine activations |
| `refund.freeze_all` | Stops outbound refunds |
| `provider.freeze_id` | Freezes one specific provider |
| `customer.freeze_id` | Freezes one specific customer |

Each flip is itself an audit event with reason. Each switch has an "auto-unfreeze after N hours unless re-confirmed" option to prevent forgotten freezes.

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| 5-room structure not built | high |
| Trust-account live balance read not wired | high |
| Reconciliation job dashboards (Section 03) — depends on Section 03 implementation | high |
| Fraud signal store + dashboards | high |
| K9000 anomaly detection (offline > 1h) | medium |
| Per-batch payout state UI | high |
| Export package endpoint | medium (Part 9.7) |
| Kill-switch UI surface | high |
| Alert thresholds env-driven | medium |
| Second-admin approval flow | medium |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- 5-room scaffolding (read-only)
- Trust-account balance live read
- Reconciliation job status reads (when Section 03 lands)
- Per-provider payout state reads (when Section 05 lands)
- Fraud signal queue (when Section 09 lands)
- Kill switches (locked enum)
- Audit-logged admin actions
- Daily close summary email digest

**Deferred scope:**
- Real-time websocket fan-out (use polling first)
- Custom report builder
- Per-region / multi-tenant filtering
- Mobile admin app

---

## 6. Legal / regulatory / financial assumptions

- Admin actions on financial data are subject to 7-year audit retention (Part 9.2).
- Trust-account balance display reads bank-side data (Mizrahi-Tefahot integration); this is sensitive and never proxied to client without admin auth.
- Kill switches affect customer-visible behaviour and must be audit-logged with admin actor + reason.
- Fraud-signal data may include flagged customers; access restricted by RBAC.

---

## 7. Open questions for human decision

1. **PagerDuty integration** — adopt PagerDuty? Or use Slack + on-call rotation only? Ops decides.
2. **Second-admin approval threshold** — refund > ₪500? Payout-batch > ₪10,000? CEO sets.
3. **Daily close digest recipients** — CEO + CFO only, or wider? CEO sets.
4. **Kill-switch auto-unfreeze default** — 24h reasonable? Per-switch override.
5. **Export package access** — admin-only, or also CPA via signed link? Counsel + CEO.
6. **Drift / anomaly ML** — out of scope v1? Confirm.

---

## 8. Dependency graph

**This section blocks:**
- PR-ADMIN-1 (finance observability dashboard runtime)
- Section 05 cutover to live payouts (cannot ship without per-batch dashboard)
- Section 03 cutover to act-mode jobs (cannot ship without job-status dashboard)

**This section is blocked by:**
- Sections 02, 03, 04, 05, 09 each contribute the data surfaces this section reads
- RBAC (`requireAdmin`, `requireBrainAccess`) already in place per platform skill

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Dashboard shows stale data (cache > freshness contract) | Admin makes wrong decision | Each surface displays "as of T" timestamp; freshness alert if > contract |
| Kill switch flipped accidentally | All-flow freeze | Confirmation step + reason capture + auto-unfreeze + audit alert to second admin |
| Alert fatigue (too many P3 promoted to Slack) | Real signals missed | Alert-class enforcement; weekly review of alert volume |
| Trust-balance display is wrong (stale bank cache) | False "low balance" alarm or false "comfortable" assumption | Reconcile bank read every 15 min; show last-reconciled time |
| Fraud signal queue overflows | Real signals buried | Per-class capacity + auto-archive of resolved cases |
| Export package endpoint abused (large repeated downloads) | Storage / cost spike | Per-user rate limit + audit log |

---

## 10. Reconciliation strategy (within the dashboard layer)

- "What we display" must match "what the underlying tables say". Daily checksum: render the dashboard, snapshot it, diff against the source tables. Material drift → P0.
- Per-display source-pin: each room references its source tables in a comment header so a reader can verify lineage.

---

## 11. Rollback / offset strategy

- Each room can be feature-flagged off independently. Rollback = flip flag.
- Kill-switch UI is on its own emergency path that ALWAYS works (no admin-room dependency); kill-switch state is read directly from a small, isolated table.
- Audit-logged admin actions cannot be rolled back — they are facts. Compensating actions (re-freeze after wrong unfreeze, etc.) leave a clean trail.

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-ADMIN-SPEC` | This document | spec |
| `PR-ADMIN-1` | 5-room scaffolding + RBAC + audit-logged action middleware | runtime |
| `PR-ADMIN-2` | Trust-account live read + reconciliation room (when Section 03 ready) | runtime |
| `PR-ADMIN-3` | Per-provider payout state reads (when Section 05 ready) | runtime |
| `PR-ADMIN-4` | Fraud signal queue + dashboards (when Section 09 ready) | runtime |
| `PR-ADMIN-5` | Kill-switch surface + audit-logged flip + auto-unfreeze | runtime |
| `PR-ADMIN-6` | Export package endpoint (Part 9.7) | runtime |
| `PR-ADMIN-7` | Daily close digest + alert routing | runtime + Ops |
| `PR-ADMIN-8` | Drift / freshness self-check | runtime |

Each carries full 12-field metadata.
