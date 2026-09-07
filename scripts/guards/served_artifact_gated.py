#!/usr/bin/env python3
"""
The bundle Firebase Hosting serves must be the bundle the gates inspected.

THE BUG (2026-09-08). petwash-ci.yml builds the client TWICE from one commit
(see vite_build_env_parity.py for the sibling failure). Two artifacts existed,
and every mechanism that claimed to verify "the client half" read the WRONG one:

  write-build-config.mjs           ran only in deploy-backend
  turnstile-release-invariant.mjs  ran only in deploy-backend

Both inspected deploy-backend's dist/public, which is baked into the Cloud Run
container. Firebase Hosting serves deploy-frontend's dist/public. So the
release gate validated a bundle no customer downloads, and
/api/health/bot-check reported metadata describing a build no browser sees.

Worse, build-config.json was never uploaded to Hosting at all:

  curl https://petwash.co.il/build-config.json  ->  the SPA index.html

so the served build's own verdict was not observable from outside CI. The
container copy was the only copy, and it described the other build.

This asserts both run in deploy-frontend, against dist/public, BEFORE the
Hosting upload. Ordering matters: writing the metadata after `firebase deploy`
would ship an artifact without it and pass a naive presence check.

  python3 scripts/guards/served_artifact_gated.py [--fail]
"""
import sys

import yaml

WF = ".github/workflows/petwash-ci.yml"
FAIL = "--fail" in sys.argv
JOB = "deploy-frontend"

# script fragment -> why it has to run against the served artifact
REQUIRED = {
    "write-build-config.mjs":
        "the served bundle must carry its own verdict, or /api/health/bot-check "
        "can only report the container's different build",
    "turnstile-release-invariant.mjs":
        "the release gate must inspect the bundle customers download, not the "
        "one baked into the API image",
}
UPLOAD = "firebase deploy"


def steps(wf, job):
    return wf.get("jobs", {}).get(job, {}).get("steps", []) or []


def index_of(run_steps, fragment):
    for i, step in enumerate(run_steps):
        if fragment in (step.get("run") or ""):
            return i
    return -1


def main() -> int:
    with open(WF, encoding="utf-8") as fh:
        wf = yaml.safe_load(fh)

    run_steps = steps(wf, JOB)
    if not run_steps:
        print(f"FAIL {JOB} has no steps — the job was renamed or removed.")
        return 1 if FAIL else 0

    problems = []
    upload_at = index_of(run_steps, UPLOAD)
    if upload_at == -1:
        problems.append(
            f"no step in {JOB} runs `{UPLOAD}` — this guard can no longer tell "
            "what ships or when, so it cannot vouch for the served artifact."
        )

    for fragment, why in REQUIRED.items():
        at = index_of(run_steps, fragment)
        if at == -1:
            problems.append(f"{JOB} never runs {fragment} — {why}.")
        elif upload_at != -1 and at > upload_at:
            problems.append(
                f"{JOB} runs {fragment} AFTER `{UPLOAD}`. The artifact is already "
                f"live by then, so the check cannot affect what shipped — {why}."
            )

    for p in problems:
        print(f"FAIL {p}")
    if not problems:
        print("OK   the served artifact is written and gated before it is uploaded.")
        return 0

    print(
        "\nThe bundle Firebase Hosting serves is a DIFFERENT build from the one in "
        "the Cloud Run image. Gating only the container's copy is how signup shipped "
        "broken twice with a green pipeline (#2301, #2303)."
    )
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
