# Copilot Agent Operations

Reference for anyone investigating a Copilot coding-agent failure in this repo.

---

## What `copilot-setup-steps.yml` does

GitHub executes the `copilot-setup-steps` job automatically **before** the
Copilot agent starts work on any task.  It runs in a normal, unrestricted
network environment — before the agent's egress firewall is activated.

This repo's setup file does exactly three things:

1. Checks out the repository.
2. Installs Node 20 (matching `petwash-ci.yml` and `package.json` engine target).
3. Runs `npm ci --legacy-peer-deps` to pre-populate the npm cache with all
   workspace dependencies.

The result: the agent never needs to reach out to `registry.npmjs.org` or any
other package host at runtime, so a blocked npm call cannot crash an agent run.

### Critical constraint — default branch only

> **This file only takes effect once it is merged into the default branch
> (`main`).**  A version that only exists on a feature branch is completely
> inert.  Always merge changes to this file to `main` before expecting them to
> affect agent runs.

---

## When a Copilot run fails — what to check first

Work through this checklist before drawing conclusions.

| Step | What to check | Where to look |
|------|--------------|---------------|
| 1 | Is the failure in a **setup step** or in the **Processing Request** step? | Job step list in the Actions tab |
| 2 | Which **runtime version** was used? | `COPILOT_AGENT_RUNTIME_VERSION` in the cleanup env dump at the end of the job log |
| 3 | Is the failure **before or after** the firewall is enabled? | Timestamp of first blocked-network warning vs. timestamp of failure |
| 4 | Was `COPILOT_AGENT_PR_NUMBER` empty? | Cleanup env dump — empty value is normal for task-triggered runs |
| 5 | Did the agent try to call `generatePRDescription`? | Search log for `generatePRDescription` or `Invalid response from PR description` |
| 6 | Was npm or a registry blocked? | Search log for `blocked by firewall rules` — note the URLs |
| 7 | Was Playwright or a browser binary missing? | Search log for `browserType.launch`, `Executable doesn't exist`, or `playwright` |

---

## Failure triage table

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Invalid response from PR description request: {}` / `Failed to get a valid PR summary after N attempts` | GitHub-side Copilot runtime bug — the agent's `generatePRDescription` call returned an empty response | **GitHub-side fix only.** Check whether a newer runtime version resolves it on the next run.  No repo change can fix this. |
| `⚠️ I tried to connect to … but was blocked by firewall rules` (npm registry, GitHub raw, etc.) | `copilot-setup-steps.yml` not on `main`, or a new dependency was added without updating the setup | Merge `copilot-setup-steps.yml` to `main`.  If a new tool is needed, add its install step to the setup file. |
| `browserType.launch` error / Playwright executable missing | Agent task needs Playwright browser binaries, which are not installed by default | Add `npx playwright install --with-deps chromium` to `copilot-setup-steps.yml` **only if** the task genuinely requires browser tests. |
| Agent exits non-zero but no clear error | Check `COPILOT_AGENT_RUNTIME_VERSION` and compare with the last known-good run | If the runtime changed, wait for the next GitHub rollout.  If the runtime is the same, investigate the `Processing Request` step logs. |
| Setup steps workflow shows `action_required` | Branch protection or environment approval rules require manual approval for non-main branch runs | Approve in the Actions UI, or merge to main first. |

---

## When NOT to add something to `copilot-setup-steps.yml`

- **Browser binaries** — omit unless a Copilot task explicitly needs `playwright test`.
- **Build artefacts** — do not run `npm run build`; the agent does that itself.
- **Secrets or env vars** — the setup job has only `contents: read` and
  `pull-requests: read`.  Any secret needed for building must be handled inside
  the agent's own steps.
- **Additional package managers** — do not add `pip install`, `gem install`,
  etc. unless a specific future task requires them.

Keep the file minimal.  Every extra step adds latency to every agent run.

---

## Background: the original PR-summary crash (April 2026)

A Copilot agent run on branch `copilot/petwash-marketplace-production-audit`
(run 24060041892) failed with:

```
Invalid response from PR description request: {}
Failed to get a valid PR summary after 3 attempts.
Error: Failed to get a valid PR summary after 3 attempts.
  at qve.generatePRDescription (…dist/index.js:152:58817)
```

Root cause: the Copilot runtime at the time (`runtime-copilot-8150f94d`)
unconditionally called `generatePRDescription()` as a separate API call at the
end of every task run.  When that API returned `{}` (empty response, likely due
to output size or a transient model timeout), the agent exited 1.

The fix was deployed by GitHub in a subsequent runtime update
(`runtime-copilot-9aa42e70`), which changed the result-reporting path so
`generatePRDescription` is no longer called as a separate step.  No repo-level
config can trigger or prevent this kind of GitHub-side runtime failure.

This PR (`copilot/fix-copilot-workflow-failure`) added `copilot-setup-steps.yml`
to harden the environment layer independently — pre-installing Node and npm
dependencies before the firewall activates.  That change is orthogonal to the
PR-summary crash but prevents a separate class of failures.
