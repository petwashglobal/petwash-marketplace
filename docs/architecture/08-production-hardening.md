# 08 — Production Hardening Roadmap

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 10 (Observability & Operational Safety) covers some of this; the rest is engineering-only and not financial.

---

## 1. Objective

Lock in the production-grade controls a regulated financial platform must have in place before scale-up: secrets governance, environment isolation, deploy protections, rollback procedures, incident recovery, audit retention, and the operational discipline to apply them.

---

## 2. Current state

| Surface | Today |
|---|---|
| Secrets store | GCP Secret Manager (deploy step in `petwash-ci.yml` ensures required secrets exist) |
| Secret rotation | Ad-hoc; not on schedule |
| Env isolation | Production / staging / development split via `NODE_ENV`; partial GCP-project separation |
| Deploy pipeline | `.github/workflows/petwash-ci.yml` — Cloud Run + Firebase Hosting; smoke test gate (PR-CI-PAYMENT-MODE injects mock-mode env) |
| Rollback procedure | Cloud Run revision rollback; Firebase Hosting channel rollback |
| Incident recovery | No formal runbook |
| Audit retention | 7-year requirement declared (Part 9.2) but warm-tier storage class not configured |
| Dependency hygiene | 60 vulnerabilities open per Dependabot (visible in last push log) |
| Build SHA verification | `getBuildInfo()` exposes (PR-CI-SMOKE-HOTFIX) |
| Branch protection | `main` is the deploy branch; PR + review required |

---

## 3. Target architecture

### 3.1 Secrets governance

| Class | Storage | Rotation cadence | Access |
|---|---|---|---|
| Acquirer credentials (NAYAX_*, SUMIT_*, UPAY_*) | GCP Secret Manager | per-vendor schedule (typically annual) | Cloud Run service account only |
| Bank API keys (Mizrahi-Tefahot) | GCP Secret Manager | annual | One service account; access logged |
| Webhook signing secrets | GCP Secret Manager | annual or on incident | Cloud Run service account |
| Database credentials | GCP Secret Manager | quarterly | Cloud Run service account |
| KYC encryption keys (DOCUMENT_ENCRYPTION_KEY) | GCP Secret Manager | rotation requires key-migration job; never silent | Cloud Run service account |
| Test bypass token (TEST_BYPASS_TOKEN) | NEVER set in production secret manager | n/a | test environment only |

Rules:
- No secret value in git. Names only.
- No secret in a CI step's plaintext env block.
- No secret in `.env.example` (placeholder values only).
- Rotation events are audit-logged.
- Annual review attests every secret has an active owner.

### 3.2 Environment isolation

| Environment | Purpose | GCP project | Bank | Acquirer mode |
|---|---|---|---|---|
| Production | live customers | `signinpetwash` | live trust account | live |
| Staging | pre-prod soak | separate project (TBD) | sandbox / test | live or sandbox per acquirer |
| Development | local + ephemeral | n/a | n/a | mock |
| CI smoke | container boot test | runner | n/a | mock (PR-CI-PAYMENT-MODE) |

Hard rule: **production secrets never reach staging or dev.** Staging has its own secret set, even if functionally similar.

### 3.3 Deploy protections

- `main` is the only deploy branch. Direct push to `main` blocked; merges only via PR.
- PR requires: passing tests, passing CI smoke, code review approval (per `petwash-platform` skill).
- Production deploy gated on smoke test passing in CI.
- `/health/strict` returns 503 on active security violations — Cloud Run promotion blocked.
- Deploy windows (avoid weekends / holidays) — Ops policy.
- Canary / progressive rollout (deferred — Cloud Run supports traffic split; v1 will use 100% cutover with fast rollback instead).

### 3.4 Rollback procedures

| What | How | Time-to-rollback target |
|---|---|---|
| Backend code | Cloud Run "revert to previous revision" | < 2 min |
| Frontend code | Firebase Hosting "rollback to previous version" | < 2 min |
| Schema migration | Reverse migration PR + data backfill (per migration's rollback plan) | varies; typically < 1 hour for non-destructive |
| Feature flag flip | env var change + redeploy OR runtime config refresh | < 5 min |
| Kill switch | admin click (Section 07) | < 30s |
| Bank batch (Masav) | bank cancellation / recall request + offsetting payout entry | bank-dependent (hours) |

Each rollback path has a runbook (Section 3.6).

### 3.5 Incident recovery

Incident classes + runbooks:

| Class | Trigger | Runbook |
|---|---|---|
| **Production down** | /health → 5xx for > 2 min | revert to last known good revision; postmortem |
| **Security violation** | /health/strict 503 | block traffic; investigate; CEO + Sec notified |
| **Trust-account drift** | reconciliation P0 alert | freeze payouts (kill switch); finance triage; CPA notified |
| **Acquirer outage** | acquirer 5xx > N | bypass to alternate acquirer (Section 1 resolver) or freeze flow; status-page update |
| **Webhook flood / replay** | event-id de-dup table fills abnormally fast | rate-limit + investigate; Sec triage |
| **Bank API rejection** | Masav file fails | freeze new payouts; manual review; escalate to bank |
| **KYC encryption-key failure** | DOCUMENT_ENCRYPTION_KEY validation fails on boot | refuse to boot (fail-closed); Ops manual recovery |

Each runbook lives in `docs/ops/runbooks/` (separate PR class).

### 3.6 Audit retention

- 7-year minimum for financial documents (Part 9.2)
- Hot tier: GCP Drive / Cloud Storage Standard for last 12 months
- Warm tier: Cloud Storage Coldline / Archive for months 13–84
- Daily integrity job: hash-chain verification (Part 9.6)
- Quarterly export: signed package to off-platform archive (CPA-held copy)

### 3.7 Dependency hygiene

- Weekly Dependabot review
- Critical / high CVEs patched within SLA (CEO + Sec set):
  - Critical: 7 days
  - High: 14 days
  - Moderate: 30 days
- New dependency adoption requires explicit approval (per `petwash-pr-guardian` skill)
- Lockfile changes go in their own PR class

### 3.8 Production-secret validation (separate from CI smoke)

Per CEO PR-CI-PAYMENT-MODE direction: a pre-deploy check verifies GCP Secret Manager contains all required production secrets BEFORE the deploy starts. Distinct from CI smoke (which boots in mock). This pre-deploy check is its own GitHub workflow gated by manual approval for production deploys.

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| 60 open Dependabot vulnerabilities (1 critical, 17 high) | high |
| No formal incident runbooks | high |
| Staging environment not fully separated | medium |
| Secret rotation schedule not enforced | medium |
| Warm-tier audit storage class not configured | medium |
| Pre-deploy production-secret validation workflow missing | high |
| Canary / progressive rollout not in place | low (v1 uses fast rollback instead) |
| Annual secrets ownership attestation not in calendar | low |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- Patch all critical + high CVEs (multi-PR cleanup)
- Incident runbooks for the 7 classes (Section 3.5)
- Pre-deploy production-secret validation workflow
- Warm-tier storage class for audit archive
- Secret rotation schedule documented + first round executed
- Staging environment isolation hardened (separate GCP project)

**Deferred scope:**
- Canary / progressive rollout (Cloud Run traffic split)
- Multi-region failover
- Third-party SOC 2 audit
- ISO 27001 path

---

## 6. Legal / regulatory / financial assumptions

- Israeli Privacy Protection Regulations (Data Security) 5777-2017 governs encryption + access controls
- 7-year retention is the floor under Israeli accounting law
- PCI scope is minimised — we do NOT store card numbers; acquirers do (Nayax / UPay / SUMIT). Tokenised references only.
- GDPR-equivalent: any non-Israeli customer interactions trigger data-handling obligations (deferred until cross-border launch — Section 10)

---

## 7. Open questions for human decision

1. **Staging environment** — separate GCP project? Costs vs isolation tradeoff. Ops + CEO decide.
2. **Secret rotation cadence** — quarterly for DB, annual for vendors — confirm.
3. **Incident on-call rotation** — who carries pager v1? Ops sets.
4. **Pre-deploy approval threshold** — every production deploy requires manual approval, or only payment-related changes?
5. **Off-platform archive copy** — CPA's storage, vault, or GCP-second-account?
6. **CVE patch SLA** — 7/14/30 days reasonable? Sec recommends.

---

## 8. Dependency graph

**This section blocks:**
- Live launch (cannot launch on a platform with 60 open vulns + no runbooks)
- Section 09 (fraud) — security controls overlap
- Section 07 (admin observability) — alert routing depends on incident-class definitions

**This section is blocked by:**
- Nothing material; can proceed in parallel

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Production secret leaks in CI logs | Compromise | Workflow review; secret masking; audit |
| Wrong revision rolled back to | Data inconsistency | Revision tagging + admin rollback UI shows what each revision contains |
| Schema migration rollback corrupts data | Worse than the original problem | Every migration PR includes a tested rollback; dry-run on staging before prod |
| Incident runbook outdated | Wrong action taken under pressure | Quarterly runbook drill |
| Dependency patch breaks runtime | Worse than the CVE | CVE patch PR has its own test gate; canary deploy where possible |
| Audit archive corrupted | 7-year retention violation | Daily integrity job; off-platform CPA copy as second source |
| Pre-deploy secret validator wrongly passes | Production boots without secret | Validator + boot-time `_startupConfigErrors` check are belt + suspenders |

---

## 10. Reconciliation strategy

- Per-week: Dependabot count delta tracked; CVEs aged into SLA buckets
- Per-month: secrets audit log reviewed
- Per-quarter: rotation cadence executed + attested
- Per-year: ownership attestation of every secret + every runbook

---

## 11. Rollback / offset strategy

This section IS the rollback strategy for the rest of the platform. It defines the procedures the rest of the roadmap depends on.

For changes within this section: each runbook update is its own PR; runbooks are versioned; old runbooks remain accessible for incident postmortem accuracy.

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-HARDEN-SPEC` | This document | spec |
| `PR-HARDEN-1..N` | CVE patches (one PR per package or per cohort, per dependency hygiene rules) | runtime + dependency |
| `PR-HARDEN-RUNBOOKS-1..7` | Each incident runbook (one per class) under `docs/ops/runbooks/` | docs |
| `PR-HARDEN-2` | Pre-deploy production-secret validation workflow | runtime (CI) |
| `PR-HARDEN-3` | Warm-tier audit storage class + archival job | runtime + Ops |
| `PR-HARDEN-4` | Staging environment isolation + separate GCP project | Ops |
| `PR-HARDEN-5` | Secret rotation schedule + first round | Ops |
| `PR-HARDEN-6` | Annual ownership attestation calendar + tracking | docs |

Each PR carries the full 12-field metadata.
