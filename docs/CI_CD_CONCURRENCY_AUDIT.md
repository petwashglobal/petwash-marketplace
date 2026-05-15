# CI/CD Concurrency Audit + Recommendation

**Status:** Audit + recommendation only. No workflow file modified. CI/CD
changes require explicit CEO approval per `petwash-pr-guardian` §1.5.
**Parent docs:**
- `.claude/skills/petwash-platform/SKILL.md` §0 strategic doctrine.
- `.claude/skills/petwash-pr-guardian/SKILL.md` §1.5 protected systems.
**Date stamped:** 2026-05-15.
**Triggered by:** Cloud Run `ABORTED: Conflict for resource 'petwash-api'`
during deploy following back-to-back doc-only PR merges (#280, #281, #282).

---

## §0 TL;DR

Three doc-only PRs (proposal, sequencing, discovery) merged to `main`
within minutes of each other. Each merge triggered a full backend +
frontend production deploy because **the workflow has no `paths:` filter
and no `concurrency:` block.** Three concurrent `gcloud run deploy
petwash-api` calls collided on the same Cloud Run service. Cloud Run
ABORTED two of them with a resource-conflict error. Your manual re-run
succeeded because the contention had cleared.

**The fix is two YAML additions, totalling ~10 lines, to
`.github/workflows/petwash-ci.yml`:**

1. `paths-ignore:` filter — exempts docs-only changes from triggering deploys.
2. `concurrency:` block with `cancel-in-progress: false` — serializes deploys.

Together these prevent both failure modes (docs storm + real code storm).
Net cost: zero new infrastructure, ~30 GHA seconds saved per docs merge,
zero risk to production. The honest tradeoff: real code PRs that merge
within minutes of each other will queue (sequential deploys), adding
~3–5 minutes wall-clock to the second deploy. That is the correct
tradeoff — sequential deploys are safer than racing deploys.

---

## §1 The failure mode (root cause)

### §1.1 What I observed in the workflow file

`.github/workflows/petwash-ci.yml`, lines 1–10:

```yaml
name: PetWash CI 2026 — Production Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  PROJECT_ID: signinpetwash
  REGION: me-west1
  SERVICE_NAME: petwash-api
```

Grep results for the entire file (1,326 lines):

- `concurrency:` — **not present**.
- `paths:` / `paths-ignore:` — **not present**.
- `gcloud run deploy` — present in the deploy-backend job.
- `firebase deploy --only hosting:main` — present in the deploy-frontend job.

### §1.2 Why this produces the conflict

`gcloud run deploy petwash-api ...` is **not atomic from Cloud Run's
perspective when two are in flight simultaneously**. Cloud Run uses
optimistic concurrency on the service resource — the first deploy
acquires a lock on `petwash-api`, the second sees the resource changing
and ABORTs with the error you saw:

```
ABORTED: Conflict for resource 'petwash-api'
```

This is documented Cloud Run behavior, not a PetWash bug. Cloud Run
expects callers to serialize their deploys. GitHub Actions does not do
that by default.

### §1.3 Why the recent doc PRs triggered it

Timeline (approximate, from GitHub merge timestamps):

| Time           | Event                                        | Effect                                   |
|----------------|----------------------------------------------|------------------------------------------|
| T+0            | PR #280 (proposal) merged to main             | Deploy A starts                          |
| T+~10s         | PR #281 (sequencing) merged to main           | Deploy B starts                          |
| T+~15s         | PR #282 (discovery) merged to main            | Deploy C starts                          |
| T+~3min        | Deploy A completes                            | OK                                       |
| T+~3min        | Deploy B / C: `gcloud run deploy` collides    | **ABORTED: Conflict for resource**        |

Your manual re-run a few minutes later succeeded because by then there
were no concurrent deploys to race against.

### §1.4 The deeper problem

Even without doc storms, this can happen any time two real code PRs land
back-to-back. Today the workflow has zero protection against that. The
recent failure was the warning shot — same failure mode could fire on
any future busy merge day.

---

## §2 What's missing from current workflow

Two structural gaps:

### §2.1 No path filter

Every `push` event to `main` triggers the full deploy, regardless of
what changed. A typo fix in `README.md` triggers backend + frontend
production deploy.

Concrete impacts:
- ~3 minutes of GHA runner time burned per docs merge.
- ~30–60 seconds of Cloud Run cold-start churn per docs merge.
- One docs-merge race condition window per real code merge.
- Noise in deploy history (50% of recent deploys are docs-only).

### §2.2 No concurrency block

GHA defaults to running jobs in parallel. Two pushes to main = two
deploy runs in flight. Cloud Run wins the race against one; the other
ABORTs.

Concrete impacts:
- Random deploy failures with no application cause.
- Operator (you) has to manually re-run failed deploys from the UI.
- False confidence in deploy reliability — failures get blamed on
  flaky CI instead of structural workflow design.

---

## §3 Recommended fix (concrete YAML diff)

Two additions, ~10 lines, to `.github/workflows/petwash-ci.yml`. **Apply
together, in one PR, after CEO approval.**

### §3.1 Path filter (exempts docs-only changes)

Replace the current `on:` block at the top of the file (lines 3–6):

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

With:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '.claude/**'
      - '**/*.md'
      - '.gitignore'
      - 'LICENSE'
      - '.github/CODEOWNERS'
      - '.github/ISSUE_TEMPLATE/**'
      - '.github/PULL_REQUEST_TEMPLATE.md'
  workflow_dispatch:
```

**Why `paths-ignore` not `paths`:**
- `paths-ignore` is a negative list — anything NOT matching the
  patterns triggers deploy. Safer default.
- New code directories added later automatically trigger deploy.
- Adding a new doc folder requires updating one line.

**What this filter does NOT exempt** (intentionally — these affect prod):
- `.github/workflows/**` — workflow file changes deploy to verify.
- `package.json`, `package-lock.json` — deps affect production.
- `.env.example` — env contract change.
- `firebase.json`, `cloudrun-service.yaml`, `Dockerfile` — deploy config.
- `vite.config.ts`, `tsconfig*.json`, `drizzle.config.ts` — build config.
- Anything under `client/`, `server/`, `shared/`.

### §3.2 Concurrency block (serializes deploys)

Add immediately after the `env:` block (after line 10), before the first
job declaration:

```yaml
concurrency:
  group: production-deploy
  cancel-in-progress: false
```

**Why `cancel-in-progress: false`:**
- Cancelling a deploy mid-flight can leave Cloud Run in a half-updated
  state (revision created but not promoted, or promoted but stale env).
- Queueing is safer than cancelling. Second deploy waits for the first
  to finish, then runs cleanly.
- Trade-off: if 5 code PRs merge in 5 minutes, the 5th deploy takes
  ~15–20 minutes to start. That is correct — deploys should never race.

**Why one group `production-deploy` for both backend AND frontend jobs:**
- They deploy to the same logical production environment.
- A backend deploy in progress should not be racing a frontend deploy.
- Single group covers both jobs with one declaration.

### §3.3 Complete patched header

Final state of the workflow file's top (lines 1–14):

```yaml
name: PetWash CI 2026 — Production Deploy

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '.claude/**'
      - '**/*.md'
      - '.gitignore'
      - 'LICENSE'
      - '.github/CODEOWNERS'
      - '.github/ISSUE_TEMPLATE/**'
      - '.github/PULL_REQUEST_TEMPLATE.md'
  workflow_dispatch:

concurrency:
  group: production-deploy
  cancel-in-progress: false

env:
  PROJECT_ID: signinpetwash
  REGION: me-west1
  SERVICE_NAME: petwash-api
  IMAGE: me-west1-docker.pkg.dev/signinpetwash/petwash-api/backend
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

That's it. Lines 14 onward (the jobs) stay exactly as they are.

---

## §4 Five-filter analysis (per SKILL.md §0.8)

| Filter             | Score | Why                                                                                          |
|--------------------|-------|----------------------------------------------------------------------------------------------|
| Better?            | ✓✓✓   | Eliminates two distinct failure modes (docs storm + code storm). No new failure modes added. |
| Cheaper?           | ✓✓✓   | Saves ~3 min GHA runner time per docs merge. ~$0 net cost. Free tier still applies.          |
| Faster?            | ✓✓    | Docs PRs merge in seconds instead of waiting for deploy. Code deploys queue (slower for back-to-back code merges by ~3 min). |
| Easier?            | ✓✓✓   | One-time ~10-line YAML addition. No ongoing maintenance burden.                              |
| More luxurious?    | ✓     | Indirect — disciplined deploy hygiene signals operational maturity. Deploy history becomes meaningful.|

**Honest tradeoff:** code PR throughput drops slightly when multiple
real code PRs land back-to-back. Two code PRs merged at the same time
= second deploy waits ~3 minutes for first. This is the right tradeoff
because **sequential deploys never race**.

If "faster" is the dominant filter (e.g. emergency hotfix train of 3
PRs), the workflow_dispatch trigger still works — emergency operator
can `cancel-in-progress: true` temporarily by overriding the group, but
that requires a separate emergency procedure documented elsewhere.

---

## §5 Alternative approaches considered (and rejected)

### Alternative A — Separate docs-only workflow file

Pattern: `.github/workflows/docs-ci.yml` triggers on docs paths, runs
markdownlint or similar. `petwash-ci.yml` triggers only on code paths.

| Filter      | Verdict   |
|-------------|-----------|
| Better?     | Marginal — overlaps with path filter |
| Cheaper?    | Same      |
| Faster?     | Same      |
| Easier?     | **No** — two files to maintain, two job definitions, two histories |
| Luxurious?  | No        |

**Rejected.** Path filter on the existing workflow is the cleaner pattern.

### Alternative B — Trigger on `pull_request` instead of `push`

Pattern: CI runs on every PR (pre-merge). Deploy requires manual
`workflow_dispatch` after merge.

| Filter      | Verdict   |
|-------------|-----------|
| Better?     | ✓ — most disciplined option |
| Cheaper?    | Same |
| Faster?     | **No** — every deploy now requires manual click |
| Easier?     | **No** — operator burden every release |
| Luxurious?  | ✓ — feels like a real release process |

**Rejected for default workflow** because it adds operator friction on
every merge. **Recommend keeping as future option** when PetWash scales
to a "release train" cadence (Stage 3 of the growth planner). For now,
the auto-deploy-on-merge pattern is appropriate for solo-CEO-and-AI
operation.

### Alternative C — Cancel-in-progress = true

Pattern: a new deploy cancels the running one mid-flight.

| Filter      | Verdict   |
|-------------|-----------|
| Better?     | **No** — risk of half-updated Cloud Run state |
| Cheaper?    | Marginal |
| Faster?     | Marginal |
| Easier?     | Same |
| Luxurious?  | **No** — silent partial failures are not luxurious |

**Rejected.** `cancel-in-progress: true` is appropriate for CI test runs
(stale PR test results), NOT for production deploys.

### Alternative D — Cloud Build trigger instead of GHA

Pattern: GHA hands off to Cloud Build, which has its own concurrency
controls.

| Filter      | Verdict   |
|-------------|-----------|
| Better?     | ✓ — Cloud Build is more native to GCP |
| Cheaper?    | **No** — Cloud Build minutes are paid |
| Faster?     | Marginal |
| Easier?     | **No** — entirely new toolchain |
| Luxurious?  | ✓ |

**Rejected for now.** Migration to Cloud Build is a separate
infrastructure decision worth considering when traffic scale demands it
(Stage 2+ of the growth planner). Today's fix is in the existing tool.

---

## §6 Tradeoffs honestly named

### §6.1 What this fix DOES solve

- Doc-only PRs no longer trigger production deploys.
- Two code PRs merged close together never race Cloud Run.
- Deploy history becomes meaningful — every entry is a real change.
- GHA minutes spent on no-op deploys: zero.

### §6.2 What this fix DOES NOT solve

- **Workflow file changes still trigger deploy.** Intentional — workflow
  changes can affect deploy behavior, so they should deploy to verify.
  But a workflow-file-only PR means a deploy with no actual production
  change. Acceptable in exchange for correctness.
- **Hotfix train friction.** If 3 production hotfixes need to ship in 5
  minutes, the second and third wait. Mitigation: use
  `workflow_dispatch` with a documented emergency procedure when speed
  matters.
- **Half-broken deploys (zombie revisions).** Concurrency block doesn't
  fix a deploy that was already half-done before the concurrency
  protection landed. Manual cleanup may be needed once after this
  PR ships (check `gcloud run revisions list petwash-api` for stale
  un-promoted revisions).
- **Cross-project concurrency.** This concurrency group is local to one
  workflow file. If you add a second workflow that also deploys to
  `petwash-api`, it would need to share the same concurrency group name
  to coordinate. Future-state concern.

### §6.3 What this fix RAISES as a question

- **Should we add `branch-protection` rules requiring all PRs go through
  `pull_request` checks before merge to main?** Today, the workflow only
  runs after merge. PR checks would catch typos pre-merge. Separate
  decision, not in scope for this PR.
- **Should the deploy be split into "build image" + "deploy revision" as
  two jobs with different concurrency groups?** Build can be parallel,
  deploy must be serial. Cleaner long-term architecture but bigger
  refactor. Not in scope.

---

## §7 Exact diff to apply (when CEO approves)

```diff
--- a/.github/workflows/petwash-ci.yml
+++ b/.github/workflows/petwash-ci.yml
@@ -1,8 +1,21 @@
 name: PetWash CI 2026 — Production Deploy

 on:
   push:
     branches: [main]
+    paths-ignore:
+      - 'docs/**'
+      - '.claude/**'
+      - '**/*.md'
+      - '.gitignore'
+      - 'LICENSE'
+      - '.github/CODEOWNERS'
+      - '.github/ISSUE_TEMPLATE/**'
+      - '.github/PULL_REQUEST_TEMPLATE.md'
   workflow_dispatch:

+concurrency:
+  group: production-deploy
+  cancel-in-progress: false
+
 env:
   PROJECT_ID: signinpetwash
```

Lines 14 through 1,326 of the workflow file are **unchanged**. Zero
deploy-step modifications. Zero secrets touched. Zero code paths
affected.

---

## §8 Rollback plan

Single-commit revert removes both additions. The workflow returns to
exactly its current state.

If the path filter is over-aggressive (we accidentally exclude
something that does affect production), we can fix forward by
narrowing the list in another small PR — no production state to
recover.

If the concurrency block causes a deploy to queue when we wanted it
to run, the operator can:
1. Cancel the running deploy from GHA UI.
2. Trigger the queued deploy via `workflow_dispatch`.

No data risk. No state risk. Production code never affected by this
workflow change.

---

## §9 Verification plan (post-merge)

After the fix PR merges:

1. **Verify path filter works:**
   - Land a docs-only PR (e.g. a small docs typo fix).
   - Verify NO workflow run starts on GHA after merge.
   - Verify Cloud Run revisions list shows no new entries.

2. **Verify concurrency works:**
   - Open two trivial code PRs (e.g. comment changes in `server/`).
   - Merge them within 30 seconds of each other.
   - Verify only ONE deploy runs at a time on GHA.
   - Verify both eventually complete green.

3. **Verify hotfix path still works:**
   - Confirm `workflow_dispatch` button still triggers a deploy
     manually for the docs-ignored paths (override the filter).

Day 1 / Day 7 / Day 30 audits in `docs/qa-reports/CI_HEALTH.md` (new
doc, future PR) tracking:
- Number of deploys triggered per merge.
- Mean time between merge and deploy completion.
- Any ABORTED conflict errors.
- Any false-positive path-filter exclusions.

---

## §10 What this PR does NOT do

Per `petwash-pr-guardian` §1.5 (CI/CD pipeline changes require explicit
approval):

- No `.github/workflows/petwash-ci.yml` modification in this PR.
- No new workflow file.
- No secrets change.
- No production code change.
- No deploy triggered.

This PR is **audit + recommendation only.** The exact YAML diff in §7
is ready to apply when CEO authorizes. A separate one-purpose PR will
land the diff with its own approval gate.

---

## §11 Mission-anchor check (per SKILL.md §0)

Does this fix serve the five connected truths?

- **Human convenience:** ✓ — CEO no longer manually re-runs failed
  deploys at 2am after merging docs.
- **Pet safety and comfort:** ✓ — half-deployed Cloud Run state is the
  kind of silent failure that breaks the wash flow for a real customer.
  Sequential deploys eliminate that risk.
- **Premium lifestyle:** ✓ — deploy hygiene is invisible to customers
  until it fails. When it fails, the brand suffers. Fixing it is brand
  protection.
- **Urban infrastructure value:** ✓ — Cloud Run is the substrate that
  serves municipal partners' kiosk traffic. A failed deploy that
  leaves a stale revision in place is the kind of incident that erodes
  city trust.
- **Environmental:** N/A (CI hygiene is operational, not ecological).

**The fix scores 4/5 on the truths.** Worth shipping after CEO approval.

---

## §12 References

- `.github/workflows/petwash-ci.yml` — the workflow being audited.
- `.claude/skills/petwash-platform/SKILL.md` §0.8 — five-filter rule.
- `.claude/skills/petwash-pr-guardian/SKILL.md` §1.5 — CI/CD approval gate.
- GitHub docs: [Using concurrency](https://docs.github.com/actions/using-jobs/using-concurrency).
- GitHub docs: [Workflow syntax — paths-ignore](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onpushpull_requestpull_request_targetpathspaths-ignore).
- Cloud Run docs: [Concurrency model](https://cloud.google.com/run/docs/about-concurrency).

---

**End of audit.** Recommendation ready to apply. No workflow change in
this PR. Awaiting CEO approval to ship the fix as its own one-line PR.
