# PetWash deployment discipline — canonical doctrine

> **Status:** Canonical. Approved by CEO. Last updated 2026-05-18.

## §1 The only valid path

```
GitHub main  →  GitHub Actions CI/CD  →  Cloud Run production (petwash-api)
```

**No other path is valid.** Every production change goes through this pipeline. This document is the authoritative rule. If a future operational decision contradicts this doctrine, that decision must be either justified explicitly in a written exception or rolled back.

## §2 What is prohibited

The following operations are **prohibited** on production unless documented as an emergency override (see §6):

- `gcloud run deploy` from any machine other than the GitHub Actions runner
- Manual `gcloud run services update --image=…` to point at an image not built by GitHub Actions
- Manual `gcloud run services update-traffic` to a revision that did not come from GitHub Actions main
- Editing Cloud Run service config from the GCP Console in a way that creates a new revision (env-var changes, secret-mapping changes, scaling changes) **without** also creating a corresponding GitHub Actions deploy or follow-up commit
- Pushing container images directly to Artifact Registry (`me-west1-docker.pkg.dev/signinpetwash/petwash-api/backend`) from anywhere other than GitHub Actions
- Deploying from a Replit environment, local laptop, or any other ad-hoc machine
- Mixing pre-built artifacts from one source with deploys from another

## §3 Gates a deploy must pass

Defined in `.github/workflows/petwash-ci.yml`. The deploy job runs only after **all** of these pass:

1. **Lint + type-check** — tsc error count must not increase relative to base branch.
2. **Unit / integration tests** — existing test suites pass.
3. **`smoke-test-routes-load`** — `npx tsx scripts/smoke-test-routes-load.ts` exits 0 (no module-load throws, boot under threshold).
4. **`audit-required-env-vars --check`** — `docs/PRODUCTION_REQUIRED_ENV_VARS.md` is up to date with the source tree. If a PR introduces a new required env var without updating this file, the PR is blocked.
5. **Workflow concurrency guard** — `concurrency: { group: production-deploy, cancel-in-progress: false }` ensures only one deploy runs at a time. Already in place (`.github/workflows/petwash-ci.yml` line 17).

Failing any one gate blocks the deploy. No bypass. No `--no-verify` flag exists for production.

## §4 Required environment variable contract

Every required env var (those whose absence would crash the server at module load) is enumerated in `docs/PRODUCTION_REQUIRED_ENV_VARS.md`. This file is **auto-generated** by `scripts/audit-required-env-vars.ts`.

When a PR introduces a new required env var:

1. The audit script will detect it in CI.
2. Reviewer must verify that:
   - The var has a value defined in GCP Secret Manager (if sensitive) OR is a literal env var on the Cloud Run service.
   - The var is mapped into the `petwash-api` Cloud Run service's `Variables & Secrets` configuration.
   - (If applicable) the same var is set in GitHub Actions secrets / workflow env.
3. The regenerated `PRODUCTION_REQUIRED_ENV_VARS.md` file is committed in the same PR.

Failure to follow this protocol = blocked merge.

## §5 Revision discipline

- The Cloud Run service `petwash-api` (region `me-west1`, project `signinpetwash`) should have **at most one revision receiving traffic**. The CI/CD pipeline always shifts 100% to the newest revision after a successful deploy.
- Stale revisions older than 7 days SHOULD be deleted to avoid accidental rollbacks and to keep the revision list scannable. (Cloud Run keeps the underlying image; rollback by tag is still possible.)
- Manual rollback to an older revision is permitted in emergencies (see §6) but the post-rollback state must be reconciled: either revert the offending commit on `main` (so the pipeline re-deploys a known-good revision) OR document the divergence as a tracked incident.

## §6 Emergency overrides

In a true production emergency (active outage, security incident, payment loss in progress) you may bypass §2 if:

1. The action is taken with explicit CEO acknowledgment (chat / SMS / call — any persistent record).
2. The override is documented within 24 hours as a tracked incident, including:
   - What was done outside the pipeline
   - Why pipeline path was not acceptable in that window
   - When the divergence will be reconciled (revert / re-deploy / commit chain)
3. The reconciliation completes within 7 days. After 7 days the override becomes a normal deploy by way of a follow-up PR that codifies whatever was done manually.

## §7 What this doctrine does NOT govern

- Cloud Run **infrastructure** decisions that do not change the running image — e.g. region failover, min-instance count tuning, memory bumps, CPU allocation — are operational decisions. They should still be tracked in writing but do not require a code PR.
- GCP Secret Manager secret value rotations are operational. They do not require a code PR. They DO require a follow-up to ensure the matching Cloud Run env mapping points to the new version.
- Cloud Run IAM changes (granting roles to the service account) are operational.

For all of the above, prefer Terraform / IaC if available; otherwise log the change in an ops doc.

## §8 Cloud Run stabilization-phase knobs (currently recommended)

While the system is in stabilization (post-restore from the 24-hour module-load incident series), the Cloud Run service `petwash-api` should temporarily run with:

- `min-instances=1` — eliminates cold-start risk during the diagnostic window
- `memory=2Gi` (or higher if metrics support) — eliminates OOM-class boot failures
- `cpu-boost=true` (startup CPU boost) — reduces boot time variance
- `timeout=600s` for request timeout — accommodates legacy long-running endpoints

These are TEMPORARY. Revisit and likely scale back after 14 consecutive days of green deploys.

## §9 Auditability

This doctrine is the audit reference. If a production incident occurs:
- The first question is: did the failing deploy follow §1?
- The second question is: did all §3 gates pass for that deploy?
- If either answer is "no", the incident response must include reconciling the pipeline drift before any new feature work resumes.

---

## Change log

- 2026-05-18 — Initial doctrine (PR-STARTUP-HARDEN-1, after 24-hour module-load incident series).
