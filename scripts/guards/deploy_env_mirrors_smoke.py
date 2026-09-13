#!/usr/bin/env python3
"""
Guard: the Cloud Run deploy's --set-env-vars and the pre-deploy smoke
container must declare the SAME flags with the SAME values.

WHY (2026-09-13). .github/workflows/petwash-ci.yml deliberately declares the
entire production env in git with `gcloud run deploy --set-env-vars=...`, and a
smoke container boots the image with those flags first. `--set-env-vars`
REPLACES the service's plain env on every deploy — so the file is the single
source of truth, and anything set by hand in the Cloud Run console is erased by
the next deploy. That is intentional (a dangerous flag cannot survive quietly),
but it only protects anything if the smoke test really boots with production's
flags. The workflow's own comment says the two "MUST mirror" after a 4-hour
outage where they didn't — and nothing enforced it: on 2026-09-13 two flags
(UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED, UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED)
were already in the deploy and missing from the smoke.

Python/stdlib only so it runs in the PR-time gate without npm ci.
"""
import re
import sys
from pathlib import Path

WF = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "petwash-ci.yml"


def parse(text: str):
    m = re.search(r"--set-env-vars=(\S+)", text)
    if not m:
        return None, None, "could not find --set-env-vars in the deploy step"
    deploy = {}
    for kv in m.group(1).split(","):
        if "=" not in kv:
            return None, None, f"malformed --set-env-vars entry: {kv!r}"
        k, v = kv.split("=", 1)
        deploy[k] = v
    start = text.find("docker run -d --name petwash-smoke")
    if start < 0:
        return None, None, "could not find the petwash-smoke docker run"
    # the docker run is one shell command continued with backslashes
    cmd = []
    for line in text[start:].splitlines():
        cmd.append(line)
        if not line.rstrip().endswith("\\"):
            break
    smoke = dict(re.findall(r"-e ([A-Z][A-Z0-9_]*)=(\S+?)(?:\s|\\|$)", "\n".join(cmd)))
    return deploy, {k: v.strip("'\"") for k, v in smoke.items()}, None


def main() -> int:
    deploy, smoke, err = parse(WF.read_text(encoding="utf-8"))
    if err:
        print(f"FAIL: {err}")
        return 1
    missing = [k for k in deploy if k not in smoke]
    differ = [(k, deploy[k], smoke[k]) for k in deploy if k in smoke and smoke[k] != deploy[k]]
    if missing or differ:
        print("FAIL: the smoke container does not boot with production's flags.")
        for k in missing:
            print(f"  missing from smoke:  -e {k}={deploy[k]}")
        for k, dv, sv in differ:
            print(f"  value differs:       {k}  deploy={dv!r}  smoke={sv!r}")
        print("Add/align them in the `docker run -d --name petwash-smoke` step of petwash-ci.yml.")
        return 1
    print(f"OK: all {len(deploy)} production flags are mirrored in the smoke container.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
