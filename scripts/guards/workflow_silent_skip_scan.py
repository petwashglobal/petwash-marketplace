#!/usr/bin/env python3
"""
Find jobs that will SILENTLY SKIP.

THE BUG THIS GENERALISES. deploy-frontend had `needs: deploy-backend` and no
`if`, so it defaulted to success(). A SKIPPED job anywhere in the transitive
needs graph skips every downstream job using that default — and
apply-migrations skips on any deploy that is not a workflow_dispatch or a
[migrate] commit.

So the frontend never deployed. Production served a stale client bundle while
every deploy reported green, because the job said "skipped" — which reads as
"not needed", not "broken".

WHY PYTHON. The first version was Node + js-yaml, and it failed in CI on its
first run: gate-workflow-self-lint only checks out the repo — no npm ci, no
node_modules. Its two sibling steps already use python3 + pyyaml, which is on
the runner. Matching the job's existing convention costs nothing and removes
the install dependency entirely.

  python3 scripts/guards/workflow_silent_skip_scan.py [--fail]
"""
import os
import sys

import yaml

WF_DIR = ".github/workflows"
FAIL = "--fail" in sys.argv


def as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def closure(jobs, name, seen=None):
    """Every job reachable through `needs`, transitively."""
    if seen is None:
        seen = set()
    for dep in as_list(jobs.get(name, {}).get("needs")):
        if dep in seen:
            continue
        seen.add(dep)
        closure(jobs, dep, seen)
    return seen


def main():
    findings = 0
    for fname in sorted(os.listdir(WF_DIR)):
        if not fname.endswith((".yml", ".yaml")):
            continue
        try:
            with open(os.path.join(WF_DIR, fname), encoding="utf-8") as fh:
                wf = yaml.safe_load(fh)
        except Exception:
            continue  # unparseable is a different problem, and other gates own it
        jobs = (wf or {}).get("jobs")
        if not isinstance(jobs, dict):
            continue

        # Jobs that can skip on their own terms.
        conditional = {k for k, j in jobs.items() if isinstance(j, dict) and "if" in j}

        for name, job in jobs.items():
            if not isinstance(job, dict) or "if" in job:
                continue  # has its own guard — the author chose the semantics
            deps = closure(jobs, name)
            risky = sorted(d for d in deps if d in conditional)
            if not risky:
                continue
            findings += 1
            direct = as_list(job.get("needs"))
            hint = direct[0] if direct else "<direct>"
            print(
                f"  {fname} :: {name}\n"
                f"      no explicit `if`, so it defaults to success()\n"
                f"      but these jobs in its needs graph can skip: {', '.join(risky)}\n"
                f"      -> when they skip, {name} skips too, reporting \"skipped\" not \"failed\"\n"
                f"      fix: if: ${{{{ always() && !cancelled() "
                f"&& needs.{hint}.result == 'success' }}}}",
                file=sys.stderr,
            )

    if findings == 0:
        print("No silently-skipping jobs found.")
        return 0
    print(
        f"\n{findings} job(s) will silently skip when a conditional upstream does not fire.",
        file=sys.stderr,
    )
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
