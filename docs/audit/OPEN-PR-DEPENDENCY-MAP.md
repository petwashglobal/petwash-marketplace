# OPEN PR DEPENDENCY MAP

Generated: 2026-09-05 · against `main` @ `548be1878` (Completion Matrix — Public homepage TESTED, #2233)

**Status: IN PROGRESS — first commit. Do not act on this version.**

Total open PRs at scan time: **9** (verified via REST `pulls?state=open`, pages 1-2).

The suspected large clusters from the sprint brief are **ALL ALREADY CLOSED**:
`#1758`, `#1819`-`#1828`, `#1846`-`#1854`, `#1857`-`#1861`, `#1863`-`#1869`.

## Working note (in progress)
- #2239 auth pin-auth: VERIFIED-SOURCE — main is a strict SUPERSET. Merging would REVERT two later fixes.
- #2238 money M1-M4: VERIFIED-SOURCE — substance NOT in main (no EscrowConcurrentTransitionError, no ATOMIC CLAIM in booking-expiry, no derivedIdempotencyKey). Genuine new work, mergeable=clean.
- #2241 k9000: VERIFIED-SOURCE — 2 of 3 fixes still needed; the Cortina inbound-secret fix is ALREADY in main (assertCortinaSecret on all 4 callback routes) and is the conflict source.
