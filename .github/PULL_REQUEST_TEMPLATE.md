<!--
  PetWash PR template — PR-W43 (Mega Phase F: Delivery Discipline)

  RULES (CEO directive 2026-05):
    • One purpose per PR. No mixed scopes.
    • Feature work, refactor, and infra fixes ship as separate PRs.
    • Every section below MUST be filled. Empty = block on review.

  Skip nothing. If a section truly does not apply, write "N/A" with a
  one-line reason. The reviewer will read every line.
-->

## 1. Purpose (one sentence)

<!-- What does this PR do? In one sentence. -->

## 2. Risk level
<!-- Pick exactly one. -->

- [ ] 🟢 NONE — doc-only / test-only / pure refactor with no runtime change
- [ ] 🟡 LOW — bounded scope, isolated module, no money path touched
- [ ] 🟠 MEDIUM — touches a money path, idempotency surface, or admin route
- [ ] 🔴 HIGH — money mutation, schema migration, payment-provider call,
  or anything that interacts with K9000 / Nayax / Tranzila runtime

## 3. Runtime impact
<!-- What changes at runtime once this is deployed? -->

- New routes:
- Removed routes:
- New tables / columns:
- Removed tables / columns:
- Cron jobs added / removed:
- External calls added / removed:
- Env vars added (must also appear in `cloudrun-service.yaml` + Secret Manager):

If "none" anywhere above, write "none" — do not delete the line.

## 4. Touched surfaces

| Surface | List (file paths or "none") |
|---|---|
| Tables (read) | |
| Tables (write) | |
| Routes touched | |
| Services touched | |
| External providers touched | |

## 5. Idempotency / replay safety

For every NEW write path:

- [ ] Writes are atomic (single SQL statement OR wrapped in a `db.transaction`)
- [ ] Either an `Idempotency-Key` header OR a deterministic body fingerprint
      is used to dedupe (`walletIdempotencyKeys` row inserted)
- [ ] Replay returns the original payload (not 400 / 409)
- [ ] N/A — this PR adds no new write path

## 6. Audit

- [ ] Every admin mutation in this PR calls `logAuditEvent(...)` writing
      a row to `audit_events` with actor, target, metadata
- [ ] N/A — this PR adds no admin mutation

## 7. Hard-stop adherence

Confirm with ✅ or "modified — reason":

- [ ] No live Nayax runtime change (signature, idempotency, payment URL,
      pending-transaction state machine untouched)
- [ ] No live Tranzila charge wired
- [ ] No K9000 redemption math change
- [ ] No real chargeback automation wired without CEO sign-off
- [ ] No money movement (orphan migration / batch credit / refund
      reversal) without CEO sign-off
- [ ] No schema migration without explicit dry-run plan attached

## 8. Tests

- [ ] New / updated tests pass locally (`vitest run`)
- [ ] Test plan added below for any uncovered branches:

```
TEST PLAN
  golden path:   ...
  edge case 1:   ...
  edge case 2:   ...
```

## 9. Rollback plan

<!-- One sentence. Default = `git revert <sha>`. If anything more is needed
     (e.g. data clean-up after revert), spell it out. -->

## 10. CEO / Operator sign-off required?

- [ ] No — this PR is within autonomous scope
- [ ] Yes — paste exact CEO instruction below:

```
<paste relevant CEO message verbatim>
```

---

<!-- Append the following auto-link so reviewers can click straight to
     the Claude Code session that produced this PR. -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
