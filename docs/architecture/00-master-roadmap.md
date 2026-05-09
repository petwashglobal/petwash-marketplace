# PetWash Master Architecture Roadmap

**Status:** Docs-only spec pack. No runtime change introduced by the PR that ships this document.

**Phase:** Transition from emergency forensic remediation to scalable operating infrastructure.

**Owner:** CEO; reviewed by counsel + CPA + engineering. Implementation PRs follow this roadmap section by section.

---

## 0.1 Why this document exists

PetWash has just completed an emergency forensic remediation phase (PRs #198–#210) that closed concrete legal, financial, and operational risks the prior implementation had introduced:

- canonical legal-identity centralisation (PR-G #205)
- production fail-closed when payment secrets are missing (PR-CI-PAYMENT-MODE #203)
- ESM correctness in startup boot (PR-CI-SMOKE-HOTFIX #207)
- auth + ownership + rate-limit on completion routes (PR-F #204)
- K9000 env-presence guard with no fake-success states (PR-K #206)
- Asia/Jerusalem DST-immune calendar-day billing (PR-I #208)
- Nayax verification before wallet credit (PR-J #209)
- provider self-exclusion in marketplace search (PR-H #210)

The remediation was **patching** acute risk. This roadmap is **building** the operating infrastructure that the platform needs to scale safely as Pet Wash Ltd (פט וואש בע"מ, Israeli Company № 517145033) moves toward live commercial activity.

It is intentionally architectural, not implementation. Code lives in implementation PRs sequenced by this document.

---

## 0.2 Hard rules (govern every section + every future PR)

These are non-negotiable across the rest of the roadmap:

1. **One PR = one risk.** No mixed-purpose PRs touching payments + bookings + schema + UX together.
2. **Architecture first. Runtime later.** Every code PR is preceded by a docs/spec PR that this roadmap references.
3. **Spec-only PRs and runtime PRs are distinct.** A spec PR introduces zero runtime change.
4. **No fake success.** No log-only payouts; no receipt-before-payment; no customer-balance mutation without a verified payment source.
5. **No unverified money movement.** Live charges, refunds, payouts, settlements require a documented vendor contract, signed credentials in GCP Secret Manager, source-pin tests, and explicit CEO + CPA approval before code lands.
6. **No schema migration without a separate migration PR with rollback plan.** Migrations are their own runtime PR class with their own risk profile.
7. **Mock mode must always return `ok:false`.** PR-CI-PAYMENT-MODE rule preserved verbatim.
8. **Append-only ledger semantics for any financial record.** No `UPDATE`/`DELETE` on financial transactions; corrections are offsetting entries.
9. **Centralised legal identity** (`shared/finance-identity.ts`) and **centralised banking identity** (`server/services/TreasuryConfigService.ts`, encrypted at rest). Never re-hardcode.
10. **No secret values in git, ever.** Names only.

---

## 0.3 Where the prior Financial Core spec sits

This roadmap sits on top of the Financial Core Architecture Spec parts that already shipped (PR #201):

- `docs/finance/00-platform-role-model.md` — Pet Wash Ltd legal role per channel, agent vs principal, VAT obligation map, trust-fund segregation, provider master agreement dependency map
- `docs/finance/02-money-object-model.md` — canonical `Money` type, append-only ledger, immutable transactions, numbering authority, locked-nine field set

This roadmap **extends** those parts toward execution. It does not replace them. Where a section here references a Financial Core part by number (e.g. "Part 4 Provider Payouts"), that is the spec part that owns the legal/accounting truth; this roadmap owns the engineering plan to implement it.

---

## 0.4 Roadmap index

| File | Section | Owner | Spec → Implementation lead time |
|------|---------|-------|-------------------------------------|
| `01-unified-payment-abstraction.md` | Unified payment abstraction layer (Nayax + UPay/SUMIT + deprecated Stripe/Tranzila + future) | Eng | spec-PR pre-req for PR-UPAY-3 |
| `02-wallet-redesign.md` | Wallet system redesign (bucket separation, escrow ledger, audit immutability) | Eng + CPA | spec-PR pre-req for PR-WALLET-1 |
| `03-nayax-reconciliation.md` | Nayax reconciliation architecture (auth vs capture, reversals, abandoned, settlement mismatch) | Eng + Finance | spec-PR pre-req for PR-NAYAX-1, PR-NAYAX-2 |
| `04-israeli-compliance.md` | Israeli financial compliance (invoice/receipt/credit-note lifecycle, SHAAM, B2B vs B2C) | Counsel + CPA | spec-PR pre-req for invoice-issuance code |
| `05-marketplace-payouts.md` | Marketplace payout architecture (sitter/walker payouts, escrow release, dispute freezes, fraud controls) | Eng + Finance + Counsel | spec-PR pre-req for live payout code |
| `06-booking-consistency.md` | Booking consistency architecture (Postgres vs Firestore truth, calendar sync authority, double-book prevention) | Eng | spec-PR pre-req for any booking-truth refactor |
| `07-admin-observability.md` | Admin observability architecture (finance dashboards, fraud monitoring, alerts) | Eng + Ops | spec-PR pre-req for PR-ADMIN-1 |
| `08-production-hardening.md` | Production hardening roadmap (secrets governance, env isolation, rollback, incident recovery) | Eng + Ops + Sec | spec-PR pre-req for any deploy-pipeline change |
| `09-fraud-risk-matrix.md` | Fraud / risk matrix (wallet abuse, replay, fake refs, collusion, coupon / wash / referral abuse) | Eng + Sec + Finance | continuous; informs all other sections |
| `10-global-scaling.md` | Global scaling preparation (multi-country tax, currency, provider adapter, region-aware pricing) | Eng + Counsel | informational; no near-term PR |
| `execution-pr-roadmap.md` | The 11 future code PRs with full per-PR spec metadata | Eng | gates each runtime PR |

---

## 0.5 Universal section template

Every architecture section in this pack uses the same structure so reviewers can scan consistently:

```
1. Objective
2. Current state (cited by file:line where executable code is at issue)
3. Target architecture
4. Gaps from current to target
5. v1 launch scope vs deferred scope
6. Legal / regulatory / financial assumptions
7. Open questions for human decision (CEO / counsel / CPA / vendor)
8. Dependency graph (what blocks this section, what this section blocks)
9. Failure modes
10. Reconciliation strategy (where applicable)
11. Rollback / offset strategy
12. Owning Financial Core Part (or "n/a — engineering-only")
```

---

## 0.6 Universal PR-spec metadata template

Every future code PR specified in `execution-pr-roadmap.md` includes the 12 fields the CEO mandated:

```
PR-XXX: <one-line title>
  Objective:                  <single-sentence purpose>
  Exact scope:                <files / endpoints / functions touched>
  Explicit out-of-scope:      <bullet list — what this PR does NOT do>
  Runtime risk:               <none | low | medium | high — with cause>
  Fraud risk:                 <none | low | medium | high — with cause>
  Migration risk:             <none | schema-included (separate PR) | data-shape>
  Rollback strategy:          <single revert | offsetting entries | feature flag>
  Monitoring requirements:    <metrics / alerts / dashboards added>
  Rollout order:              <prerequisite PRs by id; blocks PRs by id>
  Dependency graph:           <vendor / counsel / CPA / Ops / Sec items>
  Docs-only vs runtime PR:    <one of: spec | runtime | schema-migration>
  Estimated blast radius:     <files / endpoints / users / money-paths affected>
```

---

## 0.7 Sequencing principles

The roadmap is delivered in this order, but **execution is gated** by external dependencies declared in each section:

1. **Spec-PR layer (no runtime risk):** complete every architecture section in this pack first. The PR you are reviewing now closes that layer.
2. **Schema-migration layer (independent risk class):** any spec section that requires schema migrations spawns its own PR class. Each migration is its own runtime PR with rollback plan and source-pin test pinning the prior schema state.
3. **Runtime layer:** code PRs that consume the new schema. Each one single-purpose, source-pin tested, behind a feature flag where possible.
4. **Live-money cutover:** the smallest possible diff that flips traffic from mock/legacy to the new pipeline, with kill-switch (Part 10.5 of Financial Core) primed.
5. **Observability gating:** no live-money cutover ships without the relevant Part 10 dashboards + alerts wired (covered in `07-admin-observability.md`).

---

## 0.8 Audit trail

Every section in this roadmap will be cited from the implementation PRs that follow. The PR template footer carries the section reference:

```
Implements: docs/architecture/<NN>-<section>.md §X.Y
```

This is how a future engineer reading commit history can answer "why did this change?" by walking up to the spec, and a regulator reading the spec can walk down to the code.

---

## 0.9 What this PR explicitly does NOT do

- ❌ No runtime code change
- ❌ No schema migration / new column / new table
- ❌ No new dependency / package.json change
- ❌ No deployment pipeline change
- ❌ No secret rotation or new env var consumed by runtime
- ❌ No live payment integration code
- ❌ No feature implementation
- ❌ No money-flow side effect

This is documentation. It changes how we plan. It does not change how the platform behaves.

---

## 0.10 What approval of this PR means

Approval signals:

- The 10 architectural sections describe the right target system.
- The 11-PR execution sequence in `execution-pr-roadmap.md` is the agreed work order.
- Every future runtime PR will reference this pack and follow its rules.

Approval does **not** authorise any specific runtime PR yet. Each future PR will be its own decision against the spec metadata.
