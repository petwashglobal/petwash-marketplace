---
name: petwash-pr-guardian
description: Mandatory pre-flight checklist every Claude agent must run BEFORE writing code, BEFORE committing, and BEFORE pushing in this repo. Forces stop-and-report at each gate. Pairs with petwash-platform skill.
---

# PetWash PR Guardian

This skill is the discipline gate. Before you change a single line of code in **petwashglobal/petwash-marketplace**, you must run the pre-flight checklist below and report your answers. No silent changes. No "I'll just quickly...". No combined-purpose PRs.

The Guardian operates at four checkpoints:

```
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │  GATE 0      │     │  GATE 1      │     │  GATE 2      │     │  GATE 3      │
   │ Anti-dupe    │ ──> │  Pre-code    │ ──> │  Pre-commit  │ ──> │  Pre-push    │
   └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
   "Has someone     "Should I        "Have I stayed       "Am I authorized
    already         even start?"      in scope?"           to publish?"
    built this?"
```

You may not skip a gate. You may not collapse two gates into one. Each gate produces a written report and stops for confirmation when the answer to any required check is "no" or "unsure."

---

## GATE 0 — Anti-duplication (run BEFORE you plan, BEFORE Gate 1)

**This repo is worked by multiple agents at once — this Claude session, other Claude sessions, and Codex. The single most expensive failure mode is two agents independently building the same thing.** It has happened repeatedly: in one morning, SMS fallback, social-auth fixes, a provider-form guard, a booking state-machine guard, and a staff-ownership guard were each requested *after they had already been built and merged*. One near-miss tried to revert six merged PRs.

So before you reason about the task at all, prove it isn't already done. Run this verbatim and read the output:

```bash
git fetch origin --quiet
# 1. Open + recently-merged PRs that might be your task (edit the grep terms):
gh pr list --state open  --limit 50
gh pr list --state merged --limit 60 | grep -iE "<your-feature-keywords>"
# 2. Remote branches (claude/* AND codex/*) already on the topic:
git ls-remote --heads origin | grep -iE "<your-feature-keywords>"
# 3. Does main ALREADY contain the capability? Grep the merged tree, not your branch:
git grep -nE "<symbol-or-string-you-would-add>" origin/main -- '<likely/path/*>'
```

Then answer:

```
GATE 0 — Anti-duplication report

Task in one line:        <what you were asked to build>
Searched PRs:            open <n>, merged <n>  — match: NONE | PR #<n> "<title>"
Searched branches:       NONE | origin/<branch> (claude|codex)
Grepped origin/main:     ABSENT | ALREADY PRESENT at <file:line>
Verdict:                 NEW WORK — proceed to Gate 1
                         | ALREADY DONE — STOP, report to user, do NOT build
                         | PARTIAL — only the delta <X> is new; narrow scope to that
```

Hard rules:
- **If it already exists on `origin/main` or in a merged PR — STOP.** Do not rebuild it. Report the PR/file to the user and ask what they actually want that *isn't* already there.
- **Never build on a merged/deleted branch.** Check `gh pr list --head <branch> --state all`; if its PR is MERGED, that branch is dead — cut a fresh branch off `origin/main`.
- **Claim the work before coding:** open a draft PR with a clear title FIRST. The draft PR is the lock other agents see.
- If Gate 0's verdict is anything but "NEW WORK," you may not proceed to Gate 1.

---

## GATE 1 — Pre-code (run BEFORE the first edit)

Answer all 7 questions explicitly. Paste them into your reply with answers. If any answer is "no" or "unsure," **stop and ask the user** before writing any code.

### 1. Is this requested?
- Did the user explicitly ask for this change in the current conversation?
- Or did a higher-priority instruction (CLAUDE.md, this skill, an open task) ask for it?
- If you're "improving things you noticed" or "while I'm here, also..." — STOP. That's scope creep. Ask first.

### 2. Is this the right branch?
- Are you on a fresh branch off `origin/main` (or off the agreed parent branch)?
- Is the branch name descriptive of the single PR purpose?
- Are you NOT reusing a branch from a merged PR?
- Are you NOT working on `main` directly?

If branch state is wrong, switch before editing. Run:
```
git status && git branch --show-current && git log --oneline -3
```

### 3. Is this one PR only?
- Does the change have a single, namable purpose?
- Could you describe the PR title in under 70 characters without using "and"?
- If you discover a second issue mid-work, write it down and create a separate PR — don't fold it in.

### 4. Is it touching one of the protected systems?
Check carefully. If yes, you need **explicit approval** from the user before proceeding.

| Protected system | Files / paths to watch |
|---|---|
| **Wallet / finance** | `server/routes/wallet*.ts`, `prestige-pass.ts`, `BillingLedger.ts`, `AuditLedgerService.ts`, anything calling `release/refund/payout/balance` |
| **K9000 hardware** | `server/routes/k9000*.ts`, `k9000Security.ts`, `stationsService.ts`, anything talking to terminal IDs or station heartbeats |
| **Nayax integration** | `nayax*.ts`, `NayaxSitterMarketplaceService.ts`, webhook idempotency |
| **Tranzila payments** | anything in payment processing referencing Tranzila |
| **Schema migrations** | `shared/schema*.ts`, Drizzle migration files, `drizzle.config.ts`, ALTER/CREATE/DROP table |
| **Dependencies** | `package.json`, `package-lock.json`, any `npm install` command |
| **Auth gates** | `validateFirebaseToken`, `requireAdmin`, `requireBrainAccess`, `isSuperAdmin`, `rbac.ts` |
| **Audit logging** | `auditLog.ts`, `audit_events` table, redaction logic |

Read-only audits, observability dashboards, and visibility-only additions on these systems are usually OK — but **still ask first** because the line is fuzzy.

### 5. Does it need explicit approval?
Always require explicit user approval before:
- Touching any protected system from the table above.
- Adding a new dependency.
- Adding a new database table or column.
- Removing or downgrading a package.
- Changing CI/CD pipelines.
- Any destructive git operation (`reset --hard`, `push --force`, `branch -D`).
- Any change to `.gitignore` exclusion behavior.
- Any change that touches multiple modules from the petwash-platform module map.

Phrase the request as: **"This needs your approval because [reason]. Confirm to proceed?"** Wait for an explicit yes.

### 6. What tests are required?
Map the change to the test matrix in `petwash-platform` skill, section 5. Decide:
- Unit tests required? Which files?
- Integration tests required?
- Manual UI verification required? On which devices? (iPhone Safari is mandatory for any UX change.)
- Backend-only? State which UX flows you verified are not regressed.
- Capture `tsc --noEmit` and `vitest` baselines BEFORE you edit. Re-run AFTER.

### 7. What is the rollback risk?
Score the change before writing it:
- **Low:** Single file, single function, deterministic, easy to revert with `git revert`.
- **Medium:** Multiple files in one module, observable behavior change, revert leaves no orphan state.
- **High:** Cross-module, schema-affecting, money-affecting, hardware-affecting, OR revert would leave the system in an inconsistent state.

If the score is **medium or high**, declare it in your pre-code report and ask the user whether to proceed with extra safeguards (feature flag, smaller PR, staged rollout).

### Gate 1 output template
Paste this into your reply BEFORE writing code:

```
GATE 1 — Pre-code report

1. Requested:           YES (user said: "...")  |  NO  |  UNSURE
2. Right branch:        <branch-name> off <parent>  |  WRONG (need: ...)
3. One PR purpose:      <one-line title>
4. Protected systems:   NONE  |  YES — <which> (need approval)
5. Needs approval:      NO  |  YES — <why>
6. Tests required:
   - tsc baseline:      <number>
   - vitest baseline:   <pass>/<fail>
   - Manual:            <devices, or "N/A backend-only">
7. Rollback risk:       LOW  |  MEDIUM  |  HIGH — <reason>

Proceeding? (or asking user if any answer is NO / UNSURE / requires approval)
```

---

## GATE 2 — Pre-commit (run BEFORE `git commit`)

Before you stage and commit, verify scope discipline.

### 1. Did you stay in scope?
- Run `git status` and `git diff --stat`.
- Are ALL changed files within the scope you declared at Gate 1?
- If any file is unexpected, ask: did you mean to touch this? If not, revert it (`git checkout -- <file>` or `git restore <file>`).
- No drive-by formatting. No drive-by import reordering. No drive-by lint fixes.

### 2. Did you preserve baselines?
- Re-run `npx tsc --noEmit 2>&1 | grep -c "error TS"`. Compare to Gate 1 baseline.
- If you added errors, fix them before commit.
- If you removed errors that aren't related to your scope, ask whether to keep the cleanup or revert it.
- Re-run vitest. Compare. Same rule.

### 3. Did you respect protected systems?
- Even if your scope didn't intend to touch a protected system, did the diff actually touch one? Search the diff for changes in protected paths.
- If yes, STOP and report. Don't commit.

### 4. Are there secrets in the diff?
- Scan for: `API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `BEGIN RSA`, hardcoded production URLs, hardcoded admin emails.
- If anything looks like a secret, STOP. Do not commit.

### 5. Are there debug statements?
- `console.log` from your debugging session.
- `// TODO: remove`.
- Commented-out code blocks.
- Test data baked in (`if (userId === 'me') { return 999 }`).
- Remove them.

### 6. Is the commit message honest?
- Does the message describe what actually changed, not what you wished you had changed?
- Does it state what was NOT touched?
- Does it match the user's request wording where possible?

### Gate 2 output template
Paste this into your reply BEFORE running `git commit`:

```
GATE 2 — Pre-commit report

Files staged:
  - path/file.ts (+12 / -3)
  - path/other.ts (+8 / -0)

Scope match:           ALL FILES IN SCOPE  |  UNEXPECTED — <list>
tsc baseline:          <before> → <after>  ✓ unchanged | +N | -N
vitest baseline:       <before> → <after>  ✓ unchanged | +N | -N
Protected systems:     NOT TOUCHED  |  TOUCHED — <stop and ask>
Secrets in diff:       NONE  |  FOUND — <stop>
Debug residue:         NONE  |  REMOVED  |  STILL PRESENT — <fix>
Commit message:        <paste full message>

Proceeding to commit?
```

---

## GATE 3 — Pre-push (run BEFORE `git push`)

Local commits live in your worktree. Pushing makes them public. Never push without explicit user authorization.

### 1. Is push authorized?
- Did the user say "push" or "approved" for this specific PR?
- A previous "push approved" for a different PR does NOT authorize this push.
- If unsure, ask: **"Push approved for [branch] commit [hash]?"**

### 2. Is the target branch correct?
- You should be pushing to `origin/<feature-branch>`, never to `origin/main`.
- Use `git push -u origin <branch-name>` for the first push.
- Never `--force` push. Never `--force-with-lease` push. If the upstream rejected your push, stop and ask.

### 3. Did the commit hash drift?
- Was a rebase, amend, or interactive operation done since Gate 2?
- If yes, re-run Gate 2 verifications (the hash you reported has changed).

### 4. Is the PR description ready?
- If you intend to open a PR after pushing, draft the PR body NOW.
- The body must include: summary, what changed, what was NOT touched, test plan, risk level.
- Use the format from `petwash-platform` skill, section 4.

### 5. Stop-and-report after push
After a successful push, immediately report:
- Branch + commit hash
- Push result
- PR URL (if opened)
- Whether the user has any outstanding decisions

Do NOT continue to the next task without a written stop-and-report.

### Gate 3 output template
Paste this into your reply BEFORE running `git push`:

```
GATE 3 — Pre-push report

Push authorized:       YES (user said: "...")  |  NO — STOPPING
Target:                origin/<branch>  (NOT main)
Commit hash:           <short hash>  (matches Gate 2: YES | NO — re-verify)
Force push:            NO (never)
PR body drafted:       YES — paste below  |  N/A (no PR this turn)

Proceeding to push.
```

After push:
```
PUSHED — <branch> @ <hash>
PR #<n>: <title>
URL: <link>
Awaiting: <next user decision, or "next task in roadmap">
```

---

## When to invoke this skill

You don't need to wait for the user to say "use the guardian." Invoke it automatically whenever:
- The user requests a code change.
- You are about to call `Edit`, `Write`, or `NotebookEdit`.
- You are about to run `git commit`, `git add`, or `git push`.
- You are about to spawn a coding sub-agent (the sub-agent inherits these gates).

If the user explicitly says "skip the guardian" — refuse. The skill is non-optional. Politely cite this paragraph.

---

## When the user is in a hurry

The CEO sometimes moves fast. The Guardian does not slow them down — it protects them. If you can answer all 7 Gate-1 questions in one short paragraph, do that. The point is *explicit* answers, not *long* answers. A single line per question is fine when the answer is obvious.

What is not fine: skipping the gates because "this one is small." Small PRs that touched a protected system have caused the most damage in this repo's history. The Guardian exists because of them.

---

## Pair with petwash-platform

This skill governs *how* you change code. The companion `petwash-platform` skill governs *what the platform is*. You must read both before any change. They are designed to be used together.
