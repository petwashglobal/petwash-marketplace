---
name: sdd-writer-iterative
description: >
  Iterative method for writing a Software Design Document (SDD). Forces
  repository-grounded design, role/accessibility scoping, and five internal
  review loops before any code is written. Use for large or risky features
  (money, identity, providers, bookings, K9000 machines, wallet, redemption,
  admin approvals). Do NOT use for urgent fixes, CI failures, deploy blockers,
  or small one-file changes. Pairs with the SDD Writer Agent
  (.claude/agents/00-sdd-writer-agent.md).
---

# SDD Writer — Iterative Method

A Software Design Document is a **design brake**: it makes the team think before
building anything risky. This skill defines exactly how to write one for PetWash.

## 1. When to use / when not to use

**Use it** before building: Maya reception, PetWash Pass / K9000 redemption,
wallet / eGift / prepaid wash packages, provider onboarding, booking engine,
finance / Summit integration, admin approval workflows, and any fraud- or
security-sensitive architecture. Rule of thumb: *if the task changes money,
providers, bookings, K9000 machines, wallet balance, gift redemption, user
identity, or admin approvals — write an SDD first.*

**Do not use it** for urgent production fixes, CI failures, deploy blockers,
small CSS changes, small route fixes, env-doc regeneration, or one-file bug
fixes. Those go straight to a small implementation PR with tests.

## 2. Repository-context checks (do this BEFORE designing)

1. Identify and READ the real code the feature touches: schema tables, services,
   routes, existing primitives (tokens, ledgers, audit, queues).
2. List what ALREADY EXISTS so the design reuses it instead of reinventing.
3. Note the platform invariants that apply (money is sacred, every money
   mutation is audited, idempotency on all financial paths, backend is source of
   truth). Cite real `path:line`.

## 3. Required SDD structure

The document MUST contain these sections, in order:

1. **Header** — title, date, author, status (Draft), feature flag name.
2. **Summary** — 3–6 sentences: what, why, who it is for.
3. **Goals / Non-goals** — explicit in-scope and out-of-scope.
4. **Repository context** — what exists today (cited), what is reused, gaps.
5. **Users & roles / accessibility scoping** — every actor (customer, provider,
   admin, machine/Nayax, system) and what each may and may not do; accessibility
   and localization (Hebrew-first / RTL) considerations.
6. **Architecture** — components, data flow, sequence for the happy path and the
   key failure paths. Diagrams as text/mermaid are fine.
7. **Data model** — new/changed tables and columns (additive-first), indexes.
8. **Security & fraud model** — threat list and the control for each (replay,
   double-spend, screenshot reuse, offline machine, forged token, client-side
   balance tampering). Backend-source-of-truth statement.
9. **APIs / interfaces** — endpoints, request/response, idempotency keys, error
   semantics.
10. **Money & audit** — exact ledger movements, hold/capture, append-only audit
    events, reconciliation.
11. **Rollout** — feature flag (default OFF), phased plan, migration safety.
12. **Test plan** — unit, integration, fraud/abuse, and edge cases.
13. **Rollback plan** — how to disable safely and reverse data if needed.
14. **Open questions** — explicit unknowns needing a human decision.
15. **First implementation PR** — the smallest safe slice to build first.
16. **Appendix: original request (verbatim)** — the user's words, unedited.

## 4. Five review loops (run all before finalizing)

After drafting, re-read the whole document five times, each with a different lens,
and revise:

1. **Correctness loop** — does the design actually achieve the stated goals; are
   the cited repo facts accurate?
2. **Fraud / money loop** — can anyone double-spend, replay, reuse a screenshot,
   forge a token, or force a client-side balance decision? Is every money
   mutation idempotent and audited?
3. **Role / accessibility loop** — is every actor's permission explicit; is the
   experience RTL/Hebrew-first and accessible?
4. **Failure / edge loop** — offline machine, expired token, partial failure,
   concurrency, retries. Is each handled?
5. **Scope / clarity loop** — is anything creeping beyond one feature; is the
   first PR genuinely small; are open questions surfaced not buried?

## 5. Output format & finish

- Write ONE markdown file to `docs/design/YYYY-MM-DD-<short-title>.md`.
- Preserve the user's original request verbatim in the appendix.
- End with: recommended first PR, out-of-scope, open questions, risks, tests
  needed, feature flags, rollback plan.
- Then STOP. Do not write code, open PRs, or create more documents or agents.
