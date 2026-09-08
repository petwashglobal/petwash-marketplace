#!/usr/bin/env python3
"""
Every file the money gate claims to run must exist — and be run.

TWO FAILURES THIS GUARDS, both found on 2026-09-08/09.

1. A TEST THAT IS NOT IN THE GATE PROTECTS NOTHING GOING FORWARD.
   Nine regression suites written across the money-authority sweep — step-up
   currency binding, the financial-authority resolver, the wallet ceiling, the
   route-guard census, the payout destination snapshot — were never added to
   `test:money`, the only vitest invocation CI runs. Each PR said "verified by
   mutation", which was true LOCALLY and meaningless afterwards: a later change
   could break all nine and CI would stay green.

2. A PATH THAT DOES NOT EXIST SILENTLY SHRINKS THE GATE.
   `npm run test:money` with a nonexistent file in the list ran 37 of 38 files
   and reported "37 passed". No error, no warning. A typo, a rename or a
   deleted file quietly removes a suite from the only gate that blocks
   deploys — and it looks exactly like success.

Both are the same shape as the defects the sweep was fixing: a control that
reports OK while inspecting nothing.

  python3 scripts/guards/money_gate_covers_its_files.py [--fail]
"""
import json
import os
import re
import sys

FAIL = "--fail" in sys.argv
PKG = "package.json"
SCRIPT = "test:money"


def main() -> int:
    with open(PKG, encoding="utf-8") as fh:
        pkg = json.load(fh)

    cmd = (pkg.get("scripts") or {}).get(SCRIPT)
    if not cmd:
        print(f"FAIL package.json has no `{SCRIPT}` script — the money gate has no command to run.")
        return 1 if FAIL else 0

    files = [t for t in re.split(r"\s+", cmd) if t.endswith(".test.ts")]
    if not files:
        # A gate that names no files passes every time. Never acceptable.
        print(f"FAIL `{SCRIPT}` lists no test files — the gate would pass vacuously.")
        return 1 if FAIL else 0

    problems = []

    missing = [f for f in files if not os.path.exists(f)]
    for f in missing:
        problems.append(
            f"{f} is listed in {SCRIPT} but does not exist — vitest skips it silently and still "
            "reports success, so the gate is quietly smaller than it looks."
        )

    dupes = sorted({f for f in files if files.count(f) > 1})
    for f in dupes:
        problems.append(f"{f} is listed twice in {SCRIPT}.")

    for p in problems:
        print(f"  FAIL {p}")
    if problems:
        return 1 if FAIL else 0

    print(f"OK   {SCRIPT} lists {len(files)} test files and every one exists.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
