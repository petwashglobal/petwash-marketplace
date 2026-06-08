# Blueprint Reconciliation — externally-generated blueprints vs. what's actually built

**Date:** 2026-06-09
**Author:** Claude (CLO/eng session)
**Status:** Index / status snapshot. **NOT a new roadmap.** Execution follows the existing
`docs/architecture/00-master-roadmap.md` + `docs/architecture/execution-pr-roadmap.md`.

## Why this exists

The CEO pasted 8 blueprint documents generated in a *separate* Claude session
(platform blueprint, 360° verification map, verification architecture spec, compliance
master reference, email migration, trust one-pager, website certification copy, process
tracing / records architecture) and asked to "build all of those — check what's done by
any agents."

**Key finding:** those 8 documents are a **parallel re-derivation** of plans this repo
*already holds* in more rigorous, governance-bound form. Building "from the pasted MDs"
would duplicate existing internal roadmaps and risk two agents (Claude + Codex) writing
competing plans — the failure mode `petwash-pr-guardian` Gate 0 exists to prevent.

This table reconciles each pasted blueprint to (a) the existing repo doc that owns it,
(b) the **actual build status** verified by code audit on 2026-06-09, and (c) the next step.

## Reconciliation

| Pasted blueprint | Already owned by (repo doc) | Build status (audited 2026-06-09) | Next step |
|---|---|---|---|
| **Website Certifications / Trust copy** | (none — gap) | ✅ **BUILT today** — public `/trust` page | PR #627 (draft); iPhone-Safari QA then publish |
| **Trust & Compliance one-pager (HTML)** | superseded by `/trust` page | ✅ Content now lives in PR #627 | keep HTML as a print/export asset only |
| **Compliance master reference** (no "organic") | `docs/legal/CLO-israel-2026-compliance-report.md` | ✅ **DONE** — overclaims removed | PR #623 (site), #624 (SKILL.md, merged) |
| **Email migration `hello@`→`support@`** | `docs/COMPREHENSIVE_E2E_TEST_PLAN.md` (asserts 0) | ✅ **DONE in code** — 1 ref left, in a test asserting 0; 114 `support@` refs | mail-provider mailbox redirect = Ops, outside repo |
| **Process tracing / records architecture** (event ledger) | `00-master-roadmap.md` §append-only ledger | 🟡 **~60%** — `AuditLedgerService` + `WalletLedger` hash-chained; booking state machine; e-voucher events. Missing: hash-chain on `domainEvents`, explicit shop-order/payout/refund state machines, 3-party `visibleTo` | sequence via execution-pr-roadmap; **money domain — Codex-owned, coordinate** |
| **Platform blueprint (Rover/Mad Paws)** | `docs/UNIFIED_PLATFORM_ARCHITECTURE.md` + `docs/IMPLEMENTATION_STATUS.md` | 🟡 **PARTIAL** — `APIGateway`, `EventBus`, `UnifiedWalletService` exist; "shared services" refactor incomplete | follow existing architecture sections |
| **360° verification map** + **Verification architecture spec** | `docs/TRUST_PLATFORM_BLUEPRINT.md` (marked *DESIGN ONLY*), `docs/AUTH_REBUILD_AUDIT.md` | 🔴 **~15% — NOT BUILT.** 4 separate OTP impls (`auth-sms.ts`, `onboarding-verification.ts`, `transaction-otp.ts`, `RegistrationOTPService.ts`); codes NOT bound to a purpose/action (the root bug); rate-limit + audit DO exist | **biggest unbuilt item; auth domain — Codex-active, coordinate before touching** |

## Hard constraints carried from existing governance

- **One PR = one risk** (`00-master-roadmap.md §0.2`). No mixed payments+auth+schema PRs.
- **Spec PR before runtime PR.** The verification + records work needs a spec PR first.
- **Money/auth = single-owner per change.** Wallet/ledger/verification is actively worked by
  Codex (the Apple-pass commit chain #614–#621). Do not fork — claim via draft PR first.
- **Append-only ledger semantics** already enforced; new event types must hash-chain.

## Recommended execution order (highest value, lowest collision first)

1. ✅ Trust page (#627) — done, awaiting QA + publish.
2. **Records gap (safe slice):** add `prevHash`/`currentHash` to `domainEvents` — spec PR first, then a single schema-migration PR. Coordinate with Codex (money domain).
3. **Verification unification:** spec PR consolidating the 4 OTP impls behind one purpose-bound `Challenge` service (per `TRUST_PLATFORM_BLUEPRINT.md`). Auth domain — coordinate with Codex; do NOT rebuild the parts already shipped (rate-limit, `otpEvents` audit).

Each step is a separate, reversible PR gated by CEO approval, not a single mega-change.
