# AI QA Watchtower — MVP Phase 1 Implementation Sequencing

**Status:** Planning. No code ships from this doc.
**Parent:** `docs/AI_QA_WATCHTOWER_PROPOSAL.md` (architecture proposal,
approved as planning direction).
**Mission:** Sequence the MVP Phase 1 work into independently revertible
PRs, gated on staging + Firebase confirmation. AI is the reviewer, never
the actor. Playwright runs the browser. AI reviews evidence only.
**Audience:** Engineering lead executing Phase 1, CEO approving each gate.
**Date stamped:** 2026-05-15.

---

## §0 Status

**Proposal approved as planning direction.** Decisions A–G locked below.
**Code work blocked** until pre-flight gates G1 + G2 + G3 are confirmed
(§2). No PR ships until then.

---

## §1 Locked decisions A–G (from CEO, verbatim)

### A. Staging environment
> Confirm whether `staging.petwash.co.il` exists first. If it does not
> exist, Phase 1 must create staging before Watchtower runs.

### B. Synthetic accounts
> Use a separate staging Firebase project. No synthetic bot accounts in
> production Firebase.

### C. AI provider posture
> Claude-primary for reasoning and visual review. Gemini Flash optional
> as low-cost pre-screen only. Both behind `ai-client.ts` wrapper.

### D. Daily report recipients
> CEO + engineering lead for MVP. Add design lead only when visual luxury
> agent ships.

### E. Legal / compliance copy scanning
> Do not let AI make legal conclusions. Before Phase 5, review the Agent
> 4 prompt. Until then, Agent 4 only flags low-risk items:
> - PetWash™ trademark misuse
> - Outdated accessibility / cookies / legal page dates
> - Missing Hebrew / English strings
> - Obviously risky words (guaranteed, ROI, passive income)

### F. Visual baseline
> Use today's `main` branch as baseline. Update baseline only after the
> Mobile-First 2026 rebuild ships.

### G. Hourly canary
> Only 3 core flows: sign-in, booking, eGift. Not all 30 routes.

### Hard constraints (re-affirmed by CEO)

- AI audits and reports only.
- No auto-merge.
- No production writes.
- No real customer data.
- No payment / VAT / legal / wallet / K9000 / Nayax / Tranzila changes
  by AI.
- Playwright runs the browser. AI reviews evidence only.

---

## §2 Pre-flight gates — must be confirmed before any code PR

No code PR (PR-W2 onward) ships until all three gates clear. Eng lead
answers G1 + G2; CEO authorizes G3.

### Gate G1 — staging environment status

**Question:** Does `staging.petwash.co.il` exist today as a working
deploy-mirror of production?

Possible answers:

| Answer                          | What unblocks                                                                 | Time impact |
|---------------------------------|-------------------------------------------------------------------------------|--------------|
| Yes — fully working             | PR-W2 starts immediately                                                       | 0 days       |
| Partially (deploys but stale)   | PR-W2 starts; one-time refresh script needed                                  | +1 day       |
| No — needs creation              | Phase 1 begins with creating staging (new Cloud Run service + DNS)            | +3 days      |
| Don't know                       | Eng lead checks today, reports back                                            | +0.5 day     |

**How to confirm:** open a browser to `https://staging.petwash.co.il`.
- If it loads with current marketing copy → "Yes — fully working"
- If it loads with copy from 30+ days ago → "Partially"
- If it doesn't resolve or returns Cloud Run "service not found" → "No"

**Eng lead reports:** the answer, with a screenshot or curl output.

### Gate G2 — staging Firebase project status

**Question:** Does a separate staging Firebase project exist today
(distinct from the production Firebase project that holds real customer
accounts)?

Possible answers:

| Answer                          | What unblocks                                                                 | Time impact |
|---------------------------------|-------------------------------------------------------------------------------|--------------|
| Yes — staging project exists    | PR-W2 uses existing project; synthetic accounts created in it                 | 0 days       |
| No — only production project    | Create staging Firebase project (~1 hour of CEO+eng work; requires Google billing account access) | +0.5 day |
| Don't know                       | Eng lead checks Firebase Console, reports back                                 | +0.5 day     |

**How to confirm:** open Firebase Console → project picker → look for a
project named `petwash-staging`, `petwash-dev`, or similar.

**If creating new staging project:**
- Same Google Cloud billing account as production (so we can read shared
  config, but data is isolated).
- Anonymous Authentication enabled, Email/Password enabled, no other
  providers (matches MVP scope).
- Web app config (`firebaseConfig`) generated and saved to 1Password.
- Service account JSON generated and saved to 1Password.
- **Never** check Firebase config files into the public-facing client
  bundle. Use environment variables: `VITE_FIREBASE_API_KEY_STAGING`
  etc., loaded only on `staging.petwash.co.il`.

### Gate G3 — GitHub secrets authorization

**Question:** Will the CEO authorize the following GitHub Secrets to be
added to the repository's Actions environment?

| Secret name                   | Purpose                                                        | Source                              |
|-------------------------------|----------------------------------------------------------------|-------------------------------------|
| `STAGING_BASE_URL`            | Base URL of staging environment                                | `https://staging.petwash.co.il`     |
| `QA_BOT_EMAIL_1` … `_5`        | 5 synthetic bot accounts                                       | Created in staging Firebase (G2)    |
| `QA_BOT_PASSWORD_1` … `_5`    | Bot passwords (32-char random per bot)                         | Generated, stored in 1Password      |
| `CLAUDE_API_KEY`              | Anthropic API key — Watchtower workspace, $200/mo cap          | Created at console.anthropic.com    |
| `GEMINI_API_KEY` (optional)   | Google AI API key — Flash pre-screen                           | Created at aistudio.google.com      |
| `QA_REPORT_PAT`               | Restricted PAT for committing daily reports                    | Scoped only to `qa-reports/*` branch|
| `SENDGRID_API_KEY` (optional) | Email summary to CEO + eng lead                                | Reuse existing PetWash SendGrid     |
| `CEO_EMAIL`, `ENG_LEAD_EMAIL` | Daily summary recipients                                        | Per Decision D                      |

**Authorization is one-time** at the start of Phase 1. After approval,
eng lead adds the secrets via GitHub Settings UI; no further CEO
involvement needed for additions of the same scope.

---

## §3 PR sequence (MVP Phase 1)

Six PRs. Each independently revertible. None depends on a previous PR
being merged to main — they can stack on top of each other on a single
working branch, or merge sequentially. Sequential merge is recommended.

```
PR-W1  ─── docs(qa): MVP sequencing + decisions locked + pre-flight gates
              │
              │  (this doc)
              ▼
        ┌─────────────────────────────────────────────────┐
        │  G1, G2, G3 confirmed — STOP HERE OTHERWISE     │
        └─────────────────────────────────────────────────┘
              │
              ▼
PR-W2  ─── feat(qa): Watchtower scaffolding (no AI, no journeys)
              │
              ▼
PR-W3  ─── feat(qa): 5 Playwright journeys + local triage
              │
              ▼
PR-W4  ─── feat(qa): AI review layer (Agents 1 + 5 only)
              │
              ▼
PR-W5  ─── feat(ci): GitHub Actions nightly workflow
              │
              ▼
PR-W6  ─── docs(qa): SKILL.md §3 + §7 update + privacy impact assessment

Day 0:  PR-W1 (this doc) merges. Pre-flight gates open.
Days 1-5:  PR-W2 → PR-W6 in sequence.
Days 6-12: Stabilization window. Nightly runs observed, severity rubric tuned.
Day 13:  Phase 2 go/no-go decision (CEO).
```

---

## §4 Per-PR detail

### PR-W1 — this document (docs only)

- **Scope:** This MVP sequencing doc. Locks decisions A–G as record.
- **Files:** `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md` (new, this file).
- **Tests:** N/A docs-only.
- **Risk:** very low.
- **Rollback:** revert single commit; no behavior change.
- **Merge gate:** CEO confirms decisions verbatim are accurate.

### PR-W2 — Watchtower scaffolding (no AI, no journeys)

**Scope:** Create the `qa-watchtower/` folder with skeletons. No
Playwright tests, no AI calls, no GitHub Actions. Folder is excluded
from production builds.

**Files:**
```
qa-watchtower/
  package.json              (own deps: @playwright/test, sharp for image work)
  tsconfig.json             (separate from client/server tsconfigs)
  playwright.config.ts      (config only, no tests yet)
  README.md                 (governance summary, links to parent docs)
  SEVERITY.md               (rubric: P0/P1/P2/P3 definitions)
  prompts/
    .gitkeep                (placeholder; prompts added in PR-W4)
  lib/
    redact.ts               (PII redaction with unit tests)
    ai-client.ts            (stub — throws "not wired" if called)
  scripts/
    triage.ts               (stub)
    ai-review.ts            (stub)
    file-issues.ts          (stub)
    commit-daily-report.ts  (stub)

docs/qa-reports/
  .gitkeep                  (placeholder)
  PRIVACY_IMPACT_ASSESSMENT.md  (initial skeleton, completed in PR-W6)

.gitignore additions:
  qa-watchtower/artifacts/
  qa-watchtower/.test-results/
  qa-watchtower/playwright-report/
  qa-watchtower/node_modules/
```

**Build isolation:**
- Add `qa-watchtower` to `client/tsconfig.json` `exclude` array.
- Add `qa-watchtower` to `server/tsconfig.json` `exclude` array.
- Add `qa-watchtower` to `vite.config.ts` `build.rollupOptions.external`.
- Verify with `npm run build && npm run check`: zero new errors, zero
  Watchtower code in production bundle.

**Dependencies:**
- `@playwright/test` — new dep, but **only in `qa-watchtower/package.json`**
  (a sub-package). Does NOT modify root `package.json` or `package-lock.json`.
- `sharp` — already in repo for image handling. Reused.

**Tests:**
- `qa-watchtower/lib/redact.test.ts` — vitest, 12 cases covering:
  - Israeli phone `+972 50 123 4567` → `+972 ** *** ****`
  - Israeli ID 9 digits → `*********`
  - Email → `***@***`
  - IBAN → `**** **** **** ****`
  - JWT → `<jwt-redacted>`
  - Firebase ID token → `<firebase-token-redacted>`
  - Hebrew name with RTL marks preserved → name redacted
  - Empty string, null, undefined → safe no-op
- Run `tsc --noEmit` baseline + after: should be unchanged.
- Run `vitest` baseline + after: should be unchanged (12 new tests passing).

**Risk:** low. Pure addition, isolated folder.
**Rollback:** revert single PR.
**Merge gate:** CI green, build size unchanged, no production code touched.

### PR-W3 — 5 Playwright journeys + local triage

**Scope:** Implement the 5 MVP journeys against staging. Run locally
via `npm --prefix qa-watchtower run test`. No CI yet.

**Files:**
```
qa-watchtower/journeys/
  01-public-home-to-signup.spec.ts        (LTR + RTL)
  02-returning-signin-to-home.spec.ts     (LTR + RTL)
  03-booking-create-to-confirmation.spec.ts  (LTR)
  04-egift-purchase-tranzila-sandbox.spec.ts (LTR)
  05-pawfinder-browse-to-lost-detail.spec.ts (LTR + RTL)

qa-watchtower/scripts/triage.ts           (implemented)
qa-watchtower/lib/severity-rules.ts       (deterministic predicates)

qa-watchtower/fixtures/
  staging-seed.json                       (deterministic fixture data
                                            for Watchtower runs)
```

**Triage rules (deterministic only, no AI):**
- HTTP non-2xx in main document → P1
- Console error during journey → P1
- Console warning during journey → P3
- Network error (any subresource) → P2
- Lighthouse LCP > 2.5s → P2
- Lighthouse a11y score < 90 → P2
- Missing i18n key detected → P3
- Journey timeout > 30s → P1
- Journey assertion failure (e.g., expected URL after sign-in) → P0

**Output:**
- `qa-watchtower/artifacts/<run-id>/screenshots/` per journey per viewport
- `qa-watchtower/artifacts/<run-id>/traces/` Playwright traces
- `qa-watchtower/artifacts/<run-id>/triaged-findings.json` final triage
- `qa-watchtower/artifacts/<run-id>/redacted-logs.json` console + network,
  PII redacted

**Constraints enforced:**
- Bot accounts log into staging Firebase ONLY. Test fails fast if
  `STAGING_BASE_URL` does not contain `staging.petwash.co.il`.
- All mutating routes hit `/api/checkout/tranzila-sandbox` (not prod).
- All console + network output passes through `lib/redact.ts` before
  being persisted to disk.

**Tests:**
- 5 journeys × LTR+RTL where applicable = 8 test runs per execution.
- Run locally with `qa-watchtower/scripts/run-local.sh`.
- Each journey must pass green in two consecutive runs before merge.
- `tsc --noEmit`: zero new errors.
- `vitest`: unchanged baseline + 4 new triage rule unit tests.

**Risk:** low. Watchtower has no path to production at this stage; no
network egress to non-allowlisted hosts.
**Rollback:** revert single PR.
**Merge gate:** all 5 journeys green twice in a row; redacted-logs.json
verified PII-free by manual spot check on three random samples.

### PR-W4 — AI review layer (Agents 1 + 5 only)

**Scope:** Wire Claude API + optional Gemini Flash. Implement system
prompts for Agent 1 (Primary Engineering) and Agent 5 (Booking /
Onboarding Flow). Generate the daily report.

**Files:**
```
qa-watchtower/lib/ai-client.ts            (real implementation)
qa-watchtower/prompts/
  agent-1-engineering.md                  (system prompt, versioned)
  agent-5-booking-onboarding.md           (system prompt, versioned)
  schema.ts                               (Zod schemas for AI output)

qa-watchtower/scripts/ai-review.ts        (implemented)
qa-watchtower/scripts/file-issues.ts      (implemented — uses GitHub MCP)
qa-watchtower/scripts/render-report.ts    (Markdown template)

qa-watchtower/lib/cost-ceiling.ts         (hard stop at $5/day during MVP)
qa-watchtower/lib/cross-validate.ts       (P0 AI finding requires
                                            deterministic predicate too)
```

**Cross-validation rule (per proposal §16.5):**
- AI flags P0 + deterministic predicate exists → ship as P0
- AI flags P0 + no deterministic predicate → downgrade to P2, label
  `ai-judgement-unconfirmed`
- AI flags P1 + deterministic predicate → ship as P1
- AI flags P1 + no deterministic predicate → ship as P2
- AI flags P2/P3 → ship as labeled (no upgrade without deterministic)

**Cost ceiling enforcement:**
- Per-run hard stop at $5 (MVP).
- If exceeded, AI calls halt; deterministic findings still ship.
- Daily report carries banner `Cost ceiling hit, AI review partial.`

**Provider switching (per Decision C):**
- `ai-client.ts` accepts `model: 'claude-sonnet' | 'claude-opus' |
  'gemini-flash' | 'gemini-pro'`.
- Default for MVP: `claude-sonnet` (Sonnet 4.6).
- Gemini Flash callable but not used in MVP. Reserved for Phase 2
  pre-screen.

**Tests:**
- Mocked AI responses for `ai-review.ts` unit tests.
- One live integration test against staging with a known-good journey
  (one journey, ~$0.10 cost). Run manually before merge, not in CI.
- Schema validation: any malformed AI response → deterministic fallback.
- `tsc --noEmit`: zero new errors.
- `vitest`: 8 new tests passing.

**Risk:** medium. First live AI calls + GitHub issue creation.
**Rollback:** revert single PR. Mid-flight kill switch: set env var
`WATCHTOWER_AI_ENABLED=false` → deterministic-only mode.
**Merge gate:** one successful end-to-end local run (staging → triage →
AI → draft report → GitHub draft issue) verified manually by eng lead.

### PR-W5 — GitHub Actions nightly workflow

**Scope:** Move the local Watchtower into CI. Nightly at 03:00 IDT. First
runs are `workflow_dispatch` only; cron is enabled after 3 successful
manual runs.

**Files:**
```
.github/workflows/ai-qa-watchtower-nightly.yml
.github/workflows/README-watchtower.md    (permissions explanation)
```

**Permissions (per proposal §9, explicitly minimal):**
- `contents: read` (no write)
- `issues: write` (file QA findings)
- `pull-requests: write` (comment only, never merge)
- No `contents: write`

**Daily report commit path:** uses separate `QA_REPORT_PAT` scoped only
to a protected branch `qa-reports-live` that auto-merges via a separate
auto-merge rule (configured by eng lead, not by AI). The branch can only
modify files under `docs/qa-reports/*`.

**Cron disabled by default:**
```yaml
on:
  schedule:
    - cron: '0 1 * * *'  # 03:00 IDT — DISABLED until 3 successful
                          #              workflow_dispatch runs
  workflow_dispatch:
```
Enable cron via a separate one-line PR after stabilization.

**Concurrency:** `cancel-in-progress: false` — never cancel mid-flight.

**Tests:**
- 3 manual `workflow_dispatch` runs must complete green before cron
  enables.
- Each manual run emails CEO + eng lead with the report summary.
- Each manual run commits to `docs/qa-reports/<YYYY-MM-DD>.md` via PAT.
- Verify no `contents: write` permission ever needed.

**Risk:** medium (CI surface change).
**Rollback:** revert the workflow file. Existing CI unaffected.
**Merge gate:** 3 consecutive green manual runs.

### PR-W6 — SKILL.md update + privacy impact assessment

**Scope:** Pure docs. Update platform skill to reflect the Watchtower
as the QA arm of the AI governance model. Complete the privacy
assessment.

**Files:**
```
.claude/skills/petwash-platform/SKILL.md
  - §3 update: add Watchtower as "QA arm" of AI governance, with
    pointer to qa-watchtower/README.md
  - §7 update: add the 6 Watchtower PRs to the Merged list, mark
    MVP Phase 1 as shipped, update "Last updated" date

docs/qa-reports/PRIVACY_IMPACT_ASSESSMENT.md
  - Complete the assessment with operating data from the 3 manual runs
  - Counsel sign-off line (if obtained) or "pending counsel review"
```

**Risk:** very low.
**Rollback:** revert single PR.
**Merge gate:** eng lead + (ideally) counsel sign off on the privacy
assessment.

---

## §5 Parallelism + dependencies

PRs can be developed in parallel on stacked branches, but **must merge
sequentially** to keep history clean and rollback simple.

```
Gate G1 + G2 + G3
       │
       ▼
   PR-W2 ────────────┐
       │            (can prep PR-W3 in parallel)
       ▼
   PR-W3 ────────────┐
       │            (can prep PR-W4 in parallel)
       ▼
   PR-W4 ────────────┐
       │            (can prep PR-W5 + PR-W6 in parallel)
       ▼
   PR-W5
       │
       ▼
   PR-W6
       │
       ▼
   Stabilization 7 days
       │
       ▼
   Phase 2 go / no-go
```

Total calendar time, sequential: **5 working days** from G1+G2+G3
green to PR-W6 merged.

If staging needs to be created (G1 = "No"): add **+3 days** at the
start. Eng lead provisions Cloud Run + DNS + first deploy of current
main to staging. Out of scope for this Watchtower doc; opens as its own
mini-project.

---

## §6 Stabilization window (Days 6–12)

Watchtower runs nightly. No new PRs. Eng lead observes:

**Daily checks:**
- Did the run complete in < 30 min?
- Did the report email arrive at 09:00 IDT?
- Did `docs/qa-reports/<date>.md` commit successfully?
- Did any P0 issues file in GitHub? If yes, were they real?
- Cost spent: < $3 per night?

**KPI targets (for Phase 2 go/no-go on Day 13):**
- ≥ 5 of 7 nightly runs completed successfully.
- 0 P0 false positives (false positive = bug filed that engineer marks
  "won't fix — not a bug").
- ≤ 2 P1 false positives per week.
- Mean run cost ≤ $3/night.
- Mean run duration ≤ 25 min.
- 0 incidents of real customer data appearing in any artifact.

**If KPIs miss:**
- 0 P0 false positives missed (e.g., 1 false P0 in 7 days): root-cause,
  tighten rubric, stay in stabilization +7 days.
- Cost ceiling exceeded: investigate; if AI is the cause, downgrade Agent
  1 prompt to require shorter responses.
- Real customer data leak: **immediate halt**, post-mortem, do not
  proceed to Phase 2.

---

## §7 What stops the plan (kill switches)

Any of these triggers a pause and reassessment, before continuing or
proceeding to Phase 2:

| Trigger                                                        | Action                                                           |
|----------------------------------------------------------------|------------------------------------------------------------------|
| G1/G2/G3 not confirmed                                          | PR-W2 onward does not start                                       |
| PII detected in any Watchtower artifact                         | All runs halt; redact.ts fix in emergency PR                     |
| Cost exceeds $200 in a calendar month                           | All runs halt; CEO notified; Agent 1 prompt revised               |
| Anthropic API outage > 24h                                      | Deterministic fallback runs; report ships marked `wired: false`  |
| Production traffic seen from Watchtower (any non-staging URL)   | All runs halt; network egress rules audited                       |
| False positive P0 rate > 5% in stabilization                    | Phase 2 blocked; severity rubric tightened                        |
| Israeli Privacy Authority inquiry                                | All runs halt; counsel review; resume only with counsel sign-off |
| CEO instruction to halt                                          | All runs halt within 1 hour                                       |

---

## §8 SKILL.md updates required at each PR

| PR    | SKILL.md change                                                                                                     |
|-------|---------------------------------------------------------------------------------------------------------------------|
| PR-W1 | None (this doc).                                                                                                    |
| PR-W2 | None. Folder is scaffold-only.                                                                                       |
| PR-W3 | None.                                                                                                                |
| PR-W4 | §3 — note AI client wrapper and provider switching capability.                                                       |
| PR-W5 | §7 — add `.github/workflows/ai-qa-watchtower-nightly.yml` to known-status list.                                       |
| PR-W6 | §3 — formally introduce "QA Watchtower" as the QA arm of AI governance, with pointer to `qa-watchtower/README.md`.    |
|       | §7 — mark MVP Phase 1 as shipped, list the 6 merged PRs, update "Last updated" date.                                  |

---

## §9 What the AI assistant (me) will NOT do without further CEO approval

Even with decisions A–G locked, I will not:

- Open PR-W2 (or any code PR) before G1 + G2 + G3 are confirmed.
- Add or modify root `package.json` / `package-lock.json` — only the
  sub-package `qa-watchtower/package.json` is touched.
- Add Watchtower routes to the customer-facing app (it's CI-only at
  MVP).
- Create the staging Firebase project (Decision B + the credentials
  needed for that touch CEO infrastructure).
- Create the synthetic bot accounts (CEO/eng lead provisions them).
- Add the GitHub Secrets (CEO/eng lead adds via UI).
- Enable cron in PR-W5 — `workflow_dispatch` only until 3 green manual
  runs.
- Touch any of the protected systems listed in platform skill §2:
  wallet, K9000, Nayax, Tranzila, schema migrations, dependencies,
  auth gates beyond read-only inspection.
- Send any artifact to an AI provider that contains the string
  patterns guarded in `redact.ts`. The redactor is the contract.
- Auto-merge any Watchtower PR, even my own.

---

## §10 First action — confirm staging.petwash.co.il status

This is the **only** action the plan asks of the eng lead today.

1. Open a browser tab to `https://staging.petwash.co.il`.
2. Capture the result (loads / loads stale / 404 / doesn't resolve).
3. Open Firebase Console → check for a `petwash-staging` (or similar)
   project.
4. Report both answers in chat.

Once reported, the next step is either:
- (G1 = Yes, G2 = Yes) → I draft PR-W2 immediately.
- (G1 = No or G2 = No) → I draft a mini-spec for creating staging
  first, CEO reviews, then we proceed.

No code work proceeds until this report lands.

---

## §11 References

- `docs/AI_QA_WATCHTOWER_PROPOSAL.md` — architecture proposal (parent).
- `.claude/skills/petwash-platform/SKILL.md` — platform conventions
  inherited by Watchtower.
- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — UX rebuild context.
- `docs/APPLE_DEVELOPER_SETUP_PLAN.md` — iOS native shell readiness.

---

**End of sequencing plan.** No code ships from this PR. Eng lead's first
action is §10. CEO's first action is to confirm decisions A–G are
captured verbatim in §1 (already done — confirmation read-only).
