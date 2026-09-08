#!/usr/bin/env python3
"""
The gate's lookups and the seeded rules must use the SAME vocabulary.

THE NEAR MISS (2026-09-08). Two sessions worked this in parallel. The seed
migration wrote rules for

    ('wallet_adjust','credit') ('wallet_adjust','debit')
    ('wallet_support','credit') ('wallet_support','issue_refund')
    ('wallet_support','release_hold')

while the route gate looked up

    wallet_adjust/adjust  wallet_support_credit/credit  wallet_support_refund/refund

Not one pair matched. Both pull requests were green and both were correct in
isolation. Merged together they would have produced a control that governs
nothing: getApprovalRule() finds no rule, the gate falls back to its ceiling
forever, and the seeded bands sit inert. Nobody would have seen it, because
"no rule matched" is indistinguishable from "no rule seeded yet" — which is
the gate's designed, non-failing state.

That is the same shape as every other defect in this sweep: a control that
looks installed and is not connected to anything.

This compares the two sides directly.

  python3 scripts/guards/wallet_authority_vocabulary.py [--fail]
"""
import glob
import re
import sys

FAIL = "--fail" in sys.argv
ROUTES = "server/routes/prestige-pass.ts"
MIGRATION_GLOB = "migrations/*financial_approval_matrix*.sql"


def gate_lookups() -> list[tuple[str, str, str]]:
    """(case_type, action_type_or_expr, note) each authoriseWalletMoneyAction asks for."""
    src = open(ROUTES, encoding="utf-8").read()
    out = []
    for m in re.finditer(
        r"authoriseWalletMoneyAction\(\{[\s\S]{0,600}?caseType:\s*'([a-z_]+)'"
        r"[\s\S]{0,600}?actionType:\s*([^,\n]+)",
        src,
    ):
        case_type = m.group(1)
        raw = m.group(2).strip()
        if raw.startswith("'"):
            out.append((case_type, raw.strip("'"), "literal"))
        else:
            # A runtime expression, e.g. `type` -> 'credit' | 'debit'. Both
            # possibilities must be seeded; the identifier is recorded so the
            # waiver below stays explicit rather than silent.
            out.append((case_type, f"<{raw}>", "runtime"))
    return out


def seeded_pairs() -> tuple[set[tuple[str, str]], list[str]]:
    files = sorted(glob.glob(MIGRATION_GLOB))
    pairs: set[tuple[str, str]] = set()
    for f in files:
        text = open(f, encoding="utf-8").read()
        for m in re.finditer(r"\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*\)", text):
            pairs.add((m.group(1), m.group(2)))
    return pairs, files


# A runtime actionType expands to these. Keep explicit so a new branch of the
# expression cannot slip past unseeded.
RUNTIME_EXPANSIONS = {"<type>": ["credit", "debit"]}

# Gate lookups with no seeded rule YET. Each one is a route whose ceiling is
# doing the whole job — safe, but unsupervised by the matrix.
#
# Named rather than silent, and self-expiring: once a rule appears the entry
# below is reported as stale, so this list can only shrink.
#
#   wallet_refund/refund   POST /admin/wallet/refund. The wallet-bands seed
#                          (#2324) covers wallet_adjust and wallet_support but
#                          not this route. Raised with that PR's author rather
#                          than edited into their migration.
KNOWN_UNSEEDED = {("wallet_refund", "refund")}


def main() -> int:
    lookups = gate_lookups()
    src = open(ROUTES, encoding="utf-8").read()
    expected = src.count("authoriseWalletMoneyAction({")
    if len(lookups) != expected:
        # A guard that cannot see a call site is the failure it exists to catch.
        print(f"FAIL parsed {len(lookups)} lookups but {ROUTES} has {expected} "
              "authoriseWalletMoneyAction call sites — the parser missed one.")
        return 1 if FAIL else 0
    if not lookups:
        print(f"FAIL no authoriseWalletMoneyAction call sites found in {ROUTES} — renamed or removed?")
        return 1 if FAIL else 0

    pairs, files = seeded_pairs()
    if not pairs:
        # The gate degrades to its ceiling when nothing is seeded, so this is a
        # legitimate state — but say so out loud rather than passing quietly.
        print("WARN no wallet approval-matrix seed found; every gate lookup falls back to its ceiling.")
        for ct, at, _ in lookups:
            print(f"     unseeded  {ct} / {at}")
        return 0

    print(f"seed files: {', '.join(files)}")
    problems = []
    for case_type, action, kind in lookups:
        actions = RUNTIME_EXPANSIONS.get(action, [action]) if kind == "runtime" else [action]
        if kind == "runtime" and action not in RUNTIME_EXPANSIONS:
            problems.append(
                f"{case_type} uses a runtime actionType {action} with no declared expansion — "
                "add it to RUNTIME_EXPANSIONS so every branch is checked."
            )
            continue
        for a in actions:
            if (case_type, a) in pairs:
                print(f"  ok   {case_type} / {a}")
            elif (case_type, a) in KNOWN_UNSEEDED:
                print(f"  WAIVED {case_type} / {a} — no rule seeded; the route's ceiling applies")
            else:
                problems.append(
                    f"the gate looks up '{case_type}/{a}' but no seeded rule uses that pair — "
                    "getApprovalRule() will never match and the ceiling applies silently."
                )

    # A waiver that is no longer needed must not linger — it would hide the
    # next real gap behind a name that looks deliberate.
    for ct, at in sorted(KNOWN_UNSEEDED):
        if (ct, at) in pairs:
            problems.append(
                f"'{ct}/{at}' is now seeded — remove it from KNOWN_UNSEEDED so the "
                "waiver list keeps meaning something."
            )

    for p in problems:
        print(f"  FAIL {p}")
    if problems:
        print(
            "\nA gate whose vocabulary disagrees with its rules is not a gate. Align the route "
            "lookups with the migration, or add the missing rows."
        )
        return 1 if FAIL else 0
    print("Wallet authority vocabulary: gate and seed agree.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
