# Delivery Discipline — PR-W43 (Mega Phase F)

**Date:** 2026-05-05
**Status:** Authoritative process doc. PR template lives at `.github/PULL_REQUEST_TEMPLATE.md`.

---

## 0. Why this exists

PetWash is now a fintech + marketplace + kiosk + wallet + loyalty + operations + compliance platform. The cost of a bad merge isn't just a bug — it's customer money on the wrong side of a ledger, an unaudited admin action, or a Cloud Run revision that won't roll back. **Velocity comes from discipline, not chaos.**

This doc codifies the rules every PR follows. It is enforced by:
1. The PR template at `.github/PULL_REQUEST_TEMPLATE.md` (mandatory sections).
2. The CI guard tests:
   - `server/tests/duplicate-constants-guard.test.ts` (PR-W22 — VAT / wash-price drift)
   - `server/tests/dead-code-scanner.test.ts` (PR-W23 — known-dead-spot regression)
   - All existing wallet / pricing / e-voucher tests
3. The CEO directive of 2026-05.

---

## 1. Rules (apply to every PR)

### 1.1 One PR, one purpose

A PR does ONE of:
- Fix one bug
- Add one feature
- Add one doc
- Add one tooling script
- Refactor one isolated module

A PR does NOT mix:
- A bug-fix with an unrelated refactor
- A feature with a tooling addition
- A migration with a doc update

If you are tempted to mix, **split the PR**. Reviewers can decide on each piece independently.

### 1.2 Mandatory PR sections

The PR template at `.github/PULL_REQUEST_TEMPLATE.md` enforces ten sections:

1. Purpose (one sentence)
2. Risk level (NONE / LOW / MEDIUM / HIGH)
3. Runtime impact (routes / tables / cron / external calls / env vars)
4. Touched surfaces (tables read+write, routes, services, providers)
5. Idempotency / replay safety
6. Audit (logAuditEvent for admin mutations)
7. Hard-stop adherence (Nayax, Tranzila, K9000, schema, money)
8. Tests (test plan + pass proof)
9. Rollback plan (default: `git revert <sha>`)
10. CEO / Operator sign-off required?

**Empty section = block on review.** Even "N/A" requires a one-line reason.

### 1.3 Fintech mutation must-haves

Every financial mutation path **must** carry:

| Required | Why |
|---|---|
| **Ledger row** | `creditTransactions` (or `walletLedgerEntries` for hash-chained legal record). Wallet balance moves and ledger drift detector reconciles. |
| **Idempotency key** | `walletIdempotencyKeys` row. Replay returns the original payload, not a 400. |
| **Audit event** | `audit_events` row via `logAuditEvent(...)` for any admin-initiated mutation. |
| **Deterministic replay behaviour** | Two identical requests = same outcome. Verifiable by a vitest test that calls the route twice. |

PR fails review if a money-touching path lacks any of these.

### 1.4 Hard-stop policy

These are off-limits without explicit CEO sign-off in the PR description:

- Live Nayax runtime change (signature semantics, idempotency, payment URL, pending-transaction state machine)
- Live Tranzila charge wiring (the 502 stub stands until CEO authorises)
- Real chargeback automation
- K9000 redemption math change
- Schema migration with no dry-run plan
- Orphan-balance migration (money movement)
- VAT receipt-timing semantics change

PRs that violate these without sign-off are auto-rejected.

### 1.5 Doc PRs are first-class

A doc PR (architectural map, audit, compliance review) is not "less important" than a code PR. Doc PRs surface action items that prevent fintech-grade bugs. Treat them with the same review rigour. **Empty Risk = NONE doesn't mean empty review.**

---

## 2. Standard PR shape

Every PR title follows: **`PR-Wxx (Phase): one-line summary`** where `Wxx` increments globally.

Body sections (auto-filled from `.github/PULL_REQUEST_TEMPLATE.md`).

Branch naming: `claude/<descriptive-slug>` for Claude-authored work; `<author>/<slug>` for human-authored.

Trailer:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 3. CI guard list (run on every PR)

| Test | Guards |
|---|---|
| `server/tests/duplicate-constants-guard.test.ts` | New duplicate VAT / wash-price / package-price / env-fallback constants |
| `server/tests/dead-code-scanner.test.ts` | Known-dead spots stay flagged correctly |
| `server/tests/wash-pack-bleed-stop.test.ts` | Legacy `washBalance` writers cannot return |
| `server/tests/evoucher-status-mismatch.test.ts` | Voucher writer/reader status alignment |
| `server/tests/legacy-balance-report.test.ts` | Read-only audit endpoint stays read-only |
| `server/tests/vat-rate-single-source.test.ts` | All VAT references derive from canonical |
| `server/tests/wash-package-catalogue.test.ts` | Wash-pack catalogue invariants |
| `server/tests/k9000-wash-price.test.ts` | K9000 wash-price single source |
| `server/tests/admin-credit-idempotency.test.ts` | Admin credit replay returns same payload |
| `server/tests/topup-idempotency.test.ts` | Topup replay returns same payload |
| `server/tests/egift-denominations.test.ts` | E-gift denomination allowlist locked |
| `server/tests/legacy-gift-card-redeem.test.ts` | Legacy `/redeem` route stays 410 |
| `server/tests/egift-purchase-killswitch.test.ts` | E-gift purchase kill switch active |
| `server/tests/ai-chat-price-sync.test.ts` | AI chat strings match catalogue |

A PR cannot land if any of the above goes red.

---

## 4. Risk-level reference

### 🟢 NONE
- Doc PR (markdown only, no code or schema)
- Pure test addition (new test file, no production code change)
- Whitespace / lint-only refactor (only mechanical changes)

### 🟡 LOW
- Pure refactor in a single file (e.g. extract function, rename variable)
- New script in `scripts/` not invoked by build
- New endpoint behind admin-only / read-only flag
- Bug fix isolated to a single non-money path

### 🟠 MEDIUM
- Touches a money path (wallet read / write / ledger / receipt)
- Adds idempotency to an existing endpoint
- Adds audit logging to an admin mutation
- Schema column addition with no migration of existing data
- New cron job
- New env var

### 🔴 HIGH
- Money mutation (wallet write, refund, chargeback reversal)
- Schema migration with data backfill
- Payment-provider runtime change (Nayax, Tranzila, K9000)
- Auth / session / RBAC change
- Cross-domain refactor (e.g. wallet ↔ booking)

HIGH PRs require:
- CEO sign-off in the PR description
- Explicit dry-run plan
- Rollback plan beyond `git revert`
- Extra reviewer (not the author)

---

## 5. Smoke-test checklist for HIGH PRs

After merge, the operator runs:
1. Cold-start force: `gcloud run services update petwash-api --update-labels=force=$(date +%s)`
2. Verify boot log: `GOOGLE_MAPS_API_KEY: ✅ SET` + `[Places] ✅ Places API key valid`
3. Hit `/api/health/strict` → 200
4. Hit `/api/google-services/diagnose` → `apiKeyConfigured: true`
5. For wallet PRs: hit `/api/admin/wallet/legacy-balance-report` → confirm totals stable
6. For ledger PRs: trigger a test wallet topup → confirm `creditTransactions` row written and `walletIdempotencyKeys` row stored
7. Watch Cloud Run logs for 5 min — zero `[Places] ❌`, zero `wallet ledger drift`, zero `Insufficient funds` spike

---

## 6. Out of scope (codified rejections)

The following are NOT acceptable in any PR until explicitly green-lit:

- "While I was in there I also fixed X" (unrelated fix-up)
- "I noticed this could be cleaner" (refactor outside PR purpose)
- "This is just a typo" (no test, untracked)
- "I'll add the test in a follow-up" (PR ships untested)
- "It's the same as PR #X but for Y" (auto-copy without re-review)
- "This is just docs" (still requires the 10 PR-template sections)

---

## 7. Where to find context

| Topic | Doc |
|---|---|
| Route inventory + risk audit | `docs/ROUTE_MAP.md` (PR-W18) |
| Service inventory + P0 findings | `docs/SERVICE_MAP.md` (PR-W19) |
| Database inventory + duplicate names | `docs/DATABASE_MAP.md` (PR-W20) |
| Mermaid sequence diagrams (8 flows) | `docs/EVENT_FLOW_MAP.md` (PR-W21) |
| Legacy column audit | `docs/LEGACY_PURGE_REPORT.md` (PR-W14) |
| Duplicate-constants detector | `scripts/audit-duplicate-constants.ts` (PR-W22) |
| Dead-code scanner | `scripts/audit-dead-code.ts` (PR-W23) |
| **This delivery doc** | `docs/DELIVERY_DISCIPLINE.md` (PR-W43) |

---

End of doc. The PR template is the enforced artefact; this doc is the explanation. Read both before opening your first PR.
