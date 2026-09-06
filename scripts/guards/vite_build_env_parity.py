#!/usr/bin/env python3
"""
The two client builds must be given the same VITE_* variables.

THE BUG. petwash-ci.yml builds the client TWICE from one commit:

  deploy-backend  -> "Pre-build frontend (outside Docker)"  (goes into the image)
  deploy-frontend -> "Build production bundle"              (goes to Firebase Hosting)

Firebase Hosting is what a browser downloads. On 2026-09-06 the frontend step
was missing VITE_TURNSTILE_SITE_KEY, VITE_FIREBASE_APPCHECK_SITE_KEY and
VITE_GOOGLE_PLACES_LIVE — so the served bundle had no Turnstile site key, the
widget was dead-code-eliminated, and signup could not mint a token.

It was invisible twice over: the deploy was green, and /api/health/bot-check
read build-config.json from the CONTAINER copy, which DID have the key. One
commit, two artifacts, and the healthy-looking one was the one nobody loads.

VITE_* is inlined at compile time, so this can only be caught by comparing the
build environments — not by inspecting either bundle alone.

  python3 scripts/guards/vite_build_env_parity.py [--fail]
"""
import sys

import yaml

WF = ".github/workflows/petwash-ci.yml"
FAIL = "--fail" in sys.argv

# (job, step name) pairs that each produce a client bundle.
BUILDS = [
    ("deploy-backend", "Pre-build frontend (outside Docker)"),
    ("deploy-frontend", "Build production bundle"),
]


def vite_env(wf, job, step_name):
    for step in wf["jobs"][job]["steps"]:
        if step.get("name") == step_name:
            env = step.get("env") or {}
            return {k for k in env if k.startswith("VITE_")}
    raise SystemExit(f"  step not found: {job} :: {step_name} — this guard needs updating")


def main():
    with open(WF, encoding="utf-8") as fh:
        wf = yaml.safe_load(fh)

    envs = {f"{j}::{s}": vite_env(wf, j, s) for j, s in BUILDS}
    names = list(envs)
    union = set().union(*envs.values())

    problems = []
    for name in names:
        missing = sorted(union - envs[name])
        if missing:
            problems.append((name, missing))

    if not problems:
        print(f"VITE_* build parity OK — both client builds receive the same {len(union)} vars.")
        return 0

    for name, missing in problems:
        print(f"  {name} is missing: {', '.join(missing)}", file=sys.stderr)
    print(
        "\nBoth steps build the client from the same commit. A VITE_* var present in one\n"
        "and absent in the other ships two different artifacts, and the one Firebase\n"
        "Hosting serves is the one users get.",
        file=sys.stderr,
    )
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
