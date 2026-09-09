# `/admin/wallet/*` authority census — `server/routes/prestige-pass.ts`

**Date:** 2026-09-10 · **Scope:** every `/admin/wallet/*` route in
`server/routes/prestige-pass.ts` (~21k lines) · **Companion to:**
`docs/security/money-authority-census-2026-09-08.md`, which mapped the
value-moving surface. This one maps everything else on it: policy, config,
reporting.

---

## 1. What the surface is

`server/routes.ts:13045` mounts the router as

```ts
app.use('/api/prestige-pass', apiLimiter, optionalFirebaseToken, prestigePassRoutes);
```

`optionalFirebaseToken` is **authentication, not authorization** — and optional
at that. Authority on this router is therefore established *after* the mount or
not at all. That is the bug class of #2331 (five financial-approval routes
readable by any signed-in customer) and of the 2026-09-06 optional-auth sweep.

Two gates run before any handler:

| line | gate | effect |
|--:|---|---|
| 244 | operating-control gate | five legacy money routes must clear `assertOperatingControl` |
| **320** | **`router.use('/admin', …)`** | **`isSuperAdminVerified(req)` — SUPER_ADMIN_EMAILS allowlist + Firebase `email_verified`** — or, for four explicitly listed legacy routes only, a valid `ADMIN_SECRET` |
| 3463 | `adminWalletAuditMiddleware` | writes audit rows and calls `next()`. **Not a gate.** |

The umbrella gate at line 320 is the load-bearing one, and it is already
pinned by `server/tests/prestigeAdminRouteGate.regression.test.ts`.

## 2. Census

| class | routes |
|---|--:|
| MONEY | 8 |
| POLICY | 58 |
| CONFIG | 10 |
| READ | 122 |
| ACTION | 97 |
| **total** | **295** |

| authority enforced inside the handler | routes |
|---|--:|
| isSuperAdminVerified (inline) | 176 |
| umbrella gate only | 96 |
| requireFinanceRole | 14 |
| approval band + isSuperAdminVerified (inline) | 7 |
| approval band + requireFinanceRole | 1 |
| requireFinanceRole + isSuperAdminVerified (inline) | 1 |

"Authority enforced inside the handler" is *additional* to the umbrella gate —
every route in the table also has to clear `isSuperAdminVerified` at line 320.

## 3. Findings

### 3.1 — FIXED HERE. 25 handlers gated on a claim nothing writes (P0, fail-closed)

Twenty-five `/admin/wallet/*` handlers — seven of them the value movers —
carried this:

```ts
const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });
```

**Nothing in this codebase has written a boolean `admin` custom claim since
`grantAdminClaim()` was deleted on 2026-06-12** (`server/lib/adminCheck.ts:95`,
removed as "a latent privilege-escalation surface"). Every remaining writer sets
a `role` **string**:

| writer | writes |
|---|---|
| `server/routes.ts:1555` | `role: 'super_admin'` (allowlisted + `email_verified`) |
| `server/routes.ts:4427` | `role: 'admin', accountType: 'internal'` |
| `server/routes.ts:15011` | `role: <internalRole>` |
| `server/lib/syncFirebaseClaims.ts:80` | `role`, `blocked`, `accountType`, … |
| `server/lib/adminCheck.ts:112` | `revokeAdminClaim` — **deletes** `admin` |

So the field read by those 25 gates is `undefined` for every account, and each
handler returned **403 to everyone, the verified super admin included**. This is
the same phantom-field class as the session `isAdmin` flag that #240 swept out
of this very file: a gate that reads like "admins only" and means "nobody,
ever".

The seven value movers among them are exactly the routes #2321 / #2324 / #2334
had just fitted with approval bands — **bands behind a gate that never opened**:

`POST /admin/wallet/release` · `/refund` · `/adjust` · `/support/release-hold` ·
`/support/issue-refund` · `/support/credit` · `/payout-entries/mark-paid`

The other eighteen are the wallet audit and export surface (`user-audit`,
`booking-audit`, `division-report`, `export.csv`, `payout-ledger`,
`action-history`, `anomalies`, `exception-summary`, …) plus `proof-pass`,
`reverse-action` and the two academy force-transitions.

**Fix:** all 25 now call `isSuperAdminVerified(req)` — the router's canonical
authority, identical to the umbrella gate and to the other ~176 handlers. This
also removes 25 per-request Firebase Admin `getUser()` round trips.

**This does not widen anything.** Effective authority goes from
`super-admin ∧ (a claim nobody has)` to `super-admin`. `franchise_owner` could
not reach these routes before and cannot now.

### 3.2 — Policy routes are already narrower than #2317 requires

#2317 made `POST/PATCH/DELETE /api/financial-approvals/matrix` require
`requirePolicyAdmin` (admin/executive) rather than `requireFinancialAdmin`,
because the latter admits `franchise_owner` — and someone subject to approval
rules must not rewrite the rules governing their own authority.

That reasoning **does not translate into a change here**. This router's umbrella
demands `isSuperAdminVerified`, which is *strictly stronger* than
admin-or-executive and excludes `franchise_owner` outright. Mounting a
`requirePolicyAdmin`-alike on the 58 policy routes would only widen them.

Verified for all 58 (kill switches, approval chains, payout-release policies,
payout schedules, dispute-routing rules, finance roles, policy simulation and
promotion, escalation adjustments, workload reassignment):

- every one is under the `/admin/` prefix the umbrella matches;
- none references `requireFinancialAdmin` or `franchise_owner`;
- none takes `owner_scope` / `owner_id` from the request body — the #2317
  bypass. This router has no franchise-scoped policy model at all; its
  `owner_id` occurrences are the `booking_requests.owner_id` column.

Pinned, so a later relaxation of the umbrella cannot silently drop policy to a
franchise-visible role.

### 3.3 — Read routes exposing money aggregates: covered

#2331 found four read routes leaking pending refunds, payout batch totals,
requester UIDs and the approval log to any signed-in user. The equivalent reads
here — `settlement-summary`, `payout-ledger`, `finance-today`, `clawback-summary`,
`reserve`-style aggregates, `finance-roles/audit`, `action-history` — are all
behind the umbrella, i.e. super-admin, which is above the "at least
financial-admin" bar. Nothing to raise.

### 3.4 — Idiom inconsistency (reported, not churned)

After the fix, the surface enforces authority in three idioms:

- **176** handlers repeat `isSuperAdminVerified(req)` inline;
- **96** rely on the umbrella alone;
- **16** go through `requireFinanceRole(req, res, 'read'|'write'|'admin')`,
  which itself calls `isSuperAdminVerified` first and then applies a finance
  sub-role.

All three resolve to the same floor, so this is style, not exposure — but it is
why a phantom could hide here for months. Consolidating 96+176 handlers onto one
shared guard is a mechanical change worth doing on its own, not inside a
security fix to a 21k-line file.

## 4. Found in passing — NOT fixed here

Each is a separate defect on this surface, recorded so it is not lost.

### 4.1 `req.session.user` is a second phantom identity (CONFIRMED in code)

`server/index.ts:997` installs `NullSessionStore()` — "no session is ever read
back" (#2341, after Firebase Hosting stripped the session cookie). Nothing in
`server/` ever assigns `session.user`. Yet this router dereferences it
**without optional chaining at 73 sites**, including the authority helper
itself:

```ts
// server/routes/prestige-pass.ts — requireFinanceRole
const uid = session.user.uid ?? session.user.id ?? '';
```

`session.user` is `undefined`, so this throws `TypeError`, the handler's `catch`
turns it into a 500, and every route behind `requireFinanceRole` fails for the
super admin who just passed the gate. Same class as 3.1, different field.
**Unverified against production** — this is a code reading, not a live probe.

### 4.2 Raw string interpolation into SQL on two admin routes

`POST /admin/wallet/run-money-checks` and
`POST /admin/wallet/remediation-plans/generate` build `INSERT`s by template
literal — `VALUES ('${r.owner_id}', …)` and `VALUES ('${issueType}', …)`. The
first interpolates a value read back out of `transactions`; the second
interpolates request input (with a hand-rolled `'` escape on one field only).
Super-admin-only, so not remotely reachable, but neither is parameterised and
both sit beside code that is.

## 5. What is pinned

`server/tests/prestigeAdminWalletAuthority.regression.test.ts` (registered in
`test:money`; see #2336 for why that registration matters):

1. the parser sees the real router — ≥380 routes, ≥280 of them `/admin/wallet`,
   and the comment stripper provably loses **no** route declaration;
2. no handler reads a boolean `admin` claim, and no claim writer in `server/`
   creates one — root cause as well as symptom;
3. `grantAdminClaim` stays deleted;
4. the umbrella gate exists, demands `isSuperAdminVerified`, and is registered
   before **every** `/admin` route — not merely the first;
5. no wallet route escapes the `/admin/` prefix the gate matches;
6. `MACHINE_CREDENTIAL_ROUTES` still lists only its four legacy routes, none of
   them a wallet, policy or kill-switch path — a shared secret is not an admin
   identity;
7. the eight value movers each still consult the approval matrix **and** still
   establish authority for themselves;
8. no policy route carries a franchise-visible guard or takes its owner scope
   from the request body;
9. behaviourally: the old gate shape refuses a verified super admin holding the
   claims Firebase actually issues; the new shape admits them and refuses
   everyone else.

Each was confirmed to fail RED by reverting the fix or mutating the router —
including the stripper pin, which catches the regex that silently ate 33 route
declarations while writing this.

### A note on the comment stripper

The pin strips comments with a character scanner, not a regex. Two constructs in
this file defeat the naive `/\*[\s\S]*?\*\//` approach used elsewhere:

- the line comment `… any /admin/wallet/* route handler …`, whose
  `/*` opens a block comment as far as a regex is concerned and deletes the next
  33 route declarations, the banded money block included;
- `.replace(/'/g, "''")`, whose regex literal contains a quote and
  desynchronises a naive string tracker, losing the following 76 routes.

Either failure makes "no offenders found" mean "nothing was read". Hence pin #1.

## 6. Full route table

| line | route | class | authority |
|--:|---|---|---|
| 3104 | `GET /admin/wallet/division-report` | READ | isSuperAdminVerified (inline) |
| 3146 | `GET /admin/wallet/booking-audit` | READ | isSuperAdminVerified (inline) |
| 3238 | `GET /admin/wallet/user-audit` | READ | isSuperAdminVerified (inline) |
| 3477 | `POST /admin/wallet/proof-pass` | ACTION | isSuperAdminVerified (inline) |
| 3731 | `GET /admin/wallet/reconciliation-history` | READ | isSuperAdminVerified (inline) |
| 3785 | `GET /admin/wallet/adjustments` | READ | isSuperAdminVerified (inline) |
| 3869 | `GET /admin/wallet/export.csv` | READ | isSuperAdminVerified (inline) |
| 3957 | `GET /admin/wallet/bookings-export.csv` | READ | isSuperAdminVerified (inline) |
| 4080 | `POST /admin/wallet/release` | MONEY | approval band + isSuperAdminVerified (inline) |
| 4180 | `POST /admin/wallet/refund` | MONEY | approval band + isSuperAdminVerified (inline) |
| 4312 | `POST /admin/wallet/adjust` | MONEY | approval band + isSuperAdminVerified (inline) |
| 4441 | `POST /admin/wallet/support/release-hold` | MONEY | approval band + isSuperAdminVerified (inline) |
| 4533 | `POST /admin/wallet/support/issue-refund` | MONEY | approval band + isSuperAdminVerified (inline) |
| 4716 | `POST /admin/wallet/support/credit` | MONEY | approval band + isSuperAdminVerified (inline) |
| 4786 | `GET /admin/wallet/finance-today` | READ | isSuperAdminVerified (inline) |
| 4897 | `GET /admin/wallet/reconciliation-history/export.csv` | READ | isSuperAdminVerified (inline) |
| 4959 | `POST /admin/wallet/academy/:id/force-confirm` | ACTION | isSuperAdminVerified (inline) |
| 5052 | `POST /admin/wallet/academy/:id/force-cancel` | ACTION | isSuperAdminVerified (inline) |
| 5273 | `GET /admin/wallet/action-history` | READ | isSuperAdminVerified (inline) |
| 5294 | `GET /admin/wallet/action-history/export` | READ | isSuperAdminVerified (inline) |
| 5365 | `GET /admin/wallet/audit-bundle/:subjectType/:subjectId` | READ | umbrella gate only |
| 5623 | `GET /admin/wallet/anomalies` | READ | isSuperAdminVerified (inline) |
| 5771 | `POST /admin/wallet/reverse-action` | ACTION | isSuperAdminVerified (inline) |
| 5920 | `GET /admin/wallet/exception-summary` | READ | isSuperAdminVerified (inline) |
| 6194 | `GET /admin/wallet/payout-ledger` | READ | isSuperAdminVerified (inline) |
| 6284 | `POST /admin/wallet/payout-entries/mark-paid` | MONEY | approval band + isSuperAdminVerified (inline) |
| 6490 | `GET /admin/wallet/settlement-summary` | READ | isSuperAdminVerified (inline) |
| 6615 | `GET /admin/wallet/settlement-summary/export` | READ | isSuperAdminVerified (inline) |
| 6746 | `POST /admin/wallet/disputes` | ACTION | isSuperAdminVerified (inline) |
| 6800 | `GET /admin/wallet/disputes` | READ | isSuperAdminVerified (inline) |
| 6858 | `PATCH /admin/wallet/disputes/:caseRef` | ACTION | isSuperAdminVerified (inline) |
| 6909 | `POST /admin/wallet/disputes/:caseRef/resolve` | ACTION | isSuperAdminVerified (inline) |
| 6974 | `POST /admin/wallet/disputes/:caseRef/apply-resolution` | MONEY | approval band + requireFinanceRole |
| 7221 | `POST /admin/wallet/refund-requests` | ACTION | isSuperAdminVerified (inline) |
| 7308 | `GET /admin/wallet/refund-requests/pending` | READ | isSuperAdminVerified (inline) |
| 7329 | `POST /admin/wallet/refund-requests/:id/approve` | ACTION | isSuperAdminVerified (inline) |
| 7383 | `POST /admin/wallet/refund-requests/:id/reject` | ACTION | isSuperAdminVerified (inline) |
| 7425 | `POST /admin/wallet/payout-batches/create` | ACTION | requireFinanceRole |
| 7545 | `GET /admin/wallet/payout-batches` | READ | isSuperAdminVerified (inline) |
| 7580 | `GET /admin/wallet/payout-batches/:batchId` | READ | isSuperAdminVerified (inline) |
| 7766 | `GET /admin/wallet/payout-batches/:batchId/export` | READ | isSuperAdminVerified (inline) |
| 7801 | `GET /admin/wallet/payout-batches/:batchId/provider-export` | READ | isSuperAdminVerified (inline) |
| 7969 | `GET /admin/wallet/finance-close/history` | READ | isSuperAdminVerified (inline) |
| 8002 | `GET /admin/wallet/finance-close/month-export` | READ | isSuperAdminVerified (inline) |
| 8143 | `GET /admin/wallet/finance-close/:date` | READ | isSuperAdminVerified (inline) |
| 8206 | `POST /admin/wallet/finance-close/:date/close` | ACTION | requireFinanceRole |
| 8318 | `GET /admin/wallet/finance-close/:date/export` | READ | isSuperAdminVerified (inline) |
| 8522 | `GET /admin/wallet/clawback-summary` | READ | isSuperAdminVerified (inline) |
| 8573 | `POST /admin/wallet/payout-batches/:batchId/send-remittances` | ACTION | requireFinanceRole |
| 8697 | `GET /admin/wallet/payout-batches/:batchId/remittance-log` | READ | isSuperAdminVerified (inline) |
| 8737 | `POST /admin/wallet/payout-batches/:batchId/reconcile` | ACTION | requireFinanceRole + isSuperAdminVerified (inline) |
| 8900 | `GET /admin/wallet/payout-batches/:batchId/reconciliation` | READ | isSuperAdminVerified (inline) |
| 8973 | `POST /admin/wallet/payout-batches/:batchId/resend-remittance/:providerUid` | ACTION | requireFinanceRole |
| 9080 | `POST /admin/wallet/payout-batches/:batchId/retry-failed` | ACTION | requireFinanceRole |
| 9176 | `POST /admin/wallet/disputes/:caseRef/escalate` | ACTION | requireFinanceRole |
| 9223 | `POST /admin/wallet/disputes/auto-escalate` | POLICY | isSuperAdminVerified (inline) |
| 9290 | `GET /admin/wallet/alerts` | READ | isSuperAdminVerified (inline) |
| 9350 | `POST /admin/wallet/alerts/:alertId/acknowledge` | ACTION | requireFinanceRole |
| 9372 | `POST /admin/wallet/alerts/acknowledge-all` | ACTION | requireFinanceRole |
| 9394 | `GET /admin/wallet/reconciliation-exceptions` | READ | isSuperAdminVerified (inline) |
| 9431 | `PATCH /admin/wallet/reconciliation-exceptions/:id` | ACTION | requireFinanceRole |
| 9477 | `POST /admin/wallet/reconciliation-exceptions/:id/match` | ACTION | requireFinanceRole |
| 9523 | `GET /admin/wallet/alerts/delivery-log` | READ | isSuperAdminVerified (inline) |
| 9550 | `POST /admin/wallet/alerts/:id/escalate-now` | ACTION | requireFinanceRole |
| 9582 | `GET /admin/wallet/alerts/digest-preview` | READ | isSuperAdminVerified (inline) |
| 9614 | `GET /admin/wallet/monthly-signoff` | READ | isSuperAdminVerified (inline) |
| 9645 | `POST /admin/wallet/monthly-signoff` | ACTION | requireFinanceRole |
| 9699 | `GET /admin/wallet/variance-commentary` | READ | isSuperAdminVerified (inline) |
| 9721 | `POST /admin/wallet/variance-commentary` | ACTION | requireFinanceRole |
| 9753 | `GET /admin/wallet/monthly-signoff/:month/export` | READ | isSuperAdminVerified (inline) |
| 9966 | `GET /admin/wallet/board-pack` | READ | isSuperAdminVerified (inline) |
| 10087 | `POST /admin/wallet/integrity/run` | ACTION | isSuperAdminVerified (inline) |
| 10209 | `GET /admin/wallet/integrity/history` | READ | isSuperAdminVerified (inline) |
| 10229 | `GET /admin/wallet/capabilities` | READ | isSuperAdminVerified (inline) |
| 10258 | `POST /admin/wallet/capabilities` | CONFIG | requireFinanceRole |
| 10290 | `GET /admin/wallet/dispute-sla-report` | READ | isSuperAdminVerified (inline) |
| 10362 | `GET /admin/wallet/variance-analysis` | READ | isSuperAdminVerified (inline) |
| 10449 | `GET /admin/wallet/finance-audit` | READ | isSuperAdminVerified (inline) |
| 10507 | `GET /admin/wallet/finance-roles` | POLICY | isSuperAdminVerified (inline) |
| 10538 | `POST /admin/wallet/finance-roles/:uid` | POLICY | isSuperAdminVerified (inline) |
| 10580 | `DELETE /admin/wallet/finance-roles/:uid` | POLICY | isSuperAdminVerified (inline) |
| 10610 | `GET /admin/wallet/finance-roles/audit` | POLICY | isSuperAdminVerified (inline) |
| 10643 | `GET /admin/wallet/cash-forecast` | READ | isSuperAdminVerified (inline) |
| 10737 | `GET /admin/wallet/payout-schedules` | POLICY | isSuperAdminVerified (inline) |
| 10764 | `POST /admin/wallet/payout-schedules` | POLICY | isSuperAdminVerified (inline) |
| 10792 | `PATCH /admin/wallet/payout-schedules/:id` | POLICY | isSuperAdminVerified (inline) |
| 10823 | `POST /admin/wallet/payout-schedules/:id/run-now` | POLICY | isSuperAdminVerified (inline) |
| 10887 | `GET /admin/wallet/payout-schedules/runs` | POLICY | isSuperAdminVerified (inline) |
| 10916 | `GET /admin/wallet/dispute-routing-rules` | POLICY | isSuperAdminVerified (inline) |
| 10934 | `POST /admin/wallet/dispute-routing-rules` | POLICY | isSuperAdminVerified (inline) |
| 10959 | `PATCH /admin/wallet/dispute-routing-rules/:id` | POLICY | isSuperAdminVerified (inline) |
| 10990 | `POST /admin/wallet/disputes/:caseRef/route` | ACTION | isSuperAdminVerified (inline) |
| 11062 | `GET /admin/wallet/control-center` | READ | isSuperAdminVerified (inline) |
| 11147 | `GET /admin/wallet/executive-kpis` | READ | isSuperAdminVerified (inline) |
| 11262 | `GET /admin/wallet/archive-policies` | POLICY | isSuperAdminVerified (inline) |
| 11279 | `POST /admin/wallet/archive-policies` | POLICY | isSuperAdminVerified (inline) |
| 11304 | `PATCH /admin/wallet/archive-policies/:id` | POLICY | isSuperAdminVerified (inline) |
| 11332 | `GET /admin/wallet/archive-runs` | READ | isSuperAdminVerified (inline) |
| 11351 | `POST /admin/wallet/archive-runs/dry-run` | ACTION | isSuperAdminVerified (inline) |
| 11496 | `POST /admin/wallet/replay/dry-run` | ACTION | isSuperAdminVerified (inline) |
| 11521 | `POST /admin/wallet/replay/execute` | ACTION | isSuperAdminVerified (inline) |
| 11550 | `GET /admin/wallet/replay-runs` | READ | isSuperAdminVerified (inline) |
| 11575 | `GET /admin/wallet/cash-forecast/accuracy` | READ | isSuperAdminVerified (inline) |
| 11617 | `POST /admin/wallet/cash-forecast/accuracy/score` | ACTION | isSuperAdminVerified (inline) |
| 11702 | `POST /admin/wallet/payout-batches/:batchId/release-request` | ACTION | isSuperAdminVerified (inline) |
| 11777 | `GET /admin/wallet/payout-release-approvals/pending` | READ | isSuperAdminVerified (inline) |
| 11801 | `POST /admin/wallet/payout-release-approvals/:id/approve` | ACTION | isSuperAdminVerified (inline) |
| 11847 | `POST /admin/wallet/payout-release-approvals/:id/reject` | ACTION | isSuperAdminVerified (inline) |
| 11883 | `POST /admin/wallet/dispute-routing-rules/simulate` | POLICY | isSuperAdminVerified (inline) |
| 11940 | `GET /admin/wallet/dispute-routing-rules/test-cases` | POLICY | umbrella gate only |
| 11959 | `GET /admin/wallet/control-subscriptions` | READ | isSuperAdminVerified (inline) |
| 11981 | `POST /admin/wallet/control-subscriptions` | CONFIG | isSuperAdminVerified (inline) |
| 12003 | `PATCH /admin/wallet/control-subscriptions/:id` | CONFIG | isSuperAdminVerified (inline) |
| 12033 | `GET /admin/wallet/executive-digest/preview` | READ | isSuperAdminVerified (inline) |
| 12104 | `POST /admin/wallet/executive-digest/send` | ACTION | isSuperAdminVerified (inline) |
| 12152 | `GET /admin/wallet/executive-digest/log` | READ | isSuperAdminVerified (inline) |
| 12176 | `POST /admin/wallet/archive/execute` | ACTION | isSuperAdminVerified (inline) |
| 12255 | `GET /admin/wallet/archive/artifacts` | READ | isSuperAdminVerified (inline) |
| 12285 | `POST /admin/wallet/replay/request-execute` | ACTION | isSuperAdminVerified (inline) |
| 12328 | `GET /admin/wallet/replay/approvals/pending` | READ | isSuperAdminVerified (inline) |
| 12353 | `POST /admin/wallet/replay/approvals/:id/approve` | ACTION | isSuperAdminVerified (inline) |
| 12419 | `GET /admin/wallet/replay/reports/:runId` | READ | isSuperAdminVerified (inline) |
| 12442 | `GET /admin/wallet/cash-forecast/weights` | READ | isSuperAdminVerified (inline) |
| 12462 | `POST /admin/wallet/cash-forecast/weights` | ACTION | isSuperAdminVerified (inline) |
| 12485 | `PATCH /admin/wallet/cash-forecast/weights/:id` | ACTION | isSuperAdminVerified (inline) |
| 12507 | `POST /admin/wallet/cash-forecast/recompute` | ACTION | isSuperAdminVerified (inline) |
| 12543 | `GET /admin/wallet/payout-release-policies` | POLICY | isSuperAdminVerified (inline) |
| 12561 | `POST /admin/wallet/payout-release-policies` | POLICY | isSuperAdminVerified (inline) |
| 12579 | `PATCH /admin/wallet/payout-release-policies/:id` | POLICY | isSuperAdminVerified (inline) |
| 12600 | `POST /admin/wallet/payout-batches/:batchId/evaluate-release-policy` | POLICY | isSuperAdminVerified (inline) |
| 12648 | `GET /admin/wallet/digest-preferences` | READ | isSuperAdminVerified (inline) |
| 12665 | `POST /admin/wallet/digest-preferences` | CONFIG | isSuperAdminVerified (inline) |
| 12683 | `PATCH /admin/wallet/digest-preferences/:id` | CONFIG | isSuperAdminVerified (inline) |
| 12705 | `POST /admin/wallet/archive/retrieve` | ACTION | isSuperAdminVerified (inline) |
| 12731 | `GET /admin/wallet/archive/retrievals` | READ | isSuperAdminVerified (inline) |
| 12748 | `POST /admin/wallet/archive/retrievals/:id/mark-ready` | ACTION | isSuperAdminVerified (inline) |
| 12770 | `GET /admin/wallet/replay/diff/:runId` | READ | isSuperAdminVerified (inline) |
| 12804 | `GET /admin/wallet/policies` | POLICY | isSuperAdminVerified (inline) |
| 12821 | `POST /admin/wallet/policies` | POLICY | isSuperAdminVerified (inline) |
| 12843 | `PATCH /admin/wallet/policies/:policyKey` | POLICY | isSuperAdminVerified (inline) |
| 12865 | `GET /admin/wallet/period-pack` | READ | isSuperAdminVerified (inline) |
| 12925 | `GET /admin/wallet/period-pack/export` | READ | isSuperAdminVerified (inline) |
| 12950 | `POST /admin/wallet/policy-simulation/run` | POLICY | isSuperAdminVerified (inline) |
| 13024 | `GET /admin/wallet/policy-simulation/history` | POLICY | isSuperAdminVerified (inline) |
| 13040 | `GET /admin/wallet/approval-chains` | POLICY | isSuperAdminVerified (inline) |
| 13056 | `POST /admin/wallet/approval-chains` | POLICY | isSuperAdminVerified (inline) |
| 13075 | `PATCH /admin/wallet/approval-chains/:id` | POLICY | isSuperAdminVerified (inline) |
| 13098 | `POST /admin/wallet/approval-chains/:id/steps` | POLICY | isSuperAdminVerified (inline) |
| 13118 | `DELETE /admin/wallet/approval-chain-steps/:stepId` | POLICY | isSuperAdminVerified (inline) |
| 13131 | `GET /admin/wallet/approval-requests` | READ | isSuperAdminVerified (inline) |
| 13158 | `POST /admin/wallet/approval-requests` | ACTION | isSuperAdminVerified (inline) |
| 13177 | `POST /admin/wallet/approval-requests/:id/act` | ACTION | isSuperAdminVerified (inline) |
| 13249 | `GET /admin/wallet/forecast-scenarios` | READ | isSuperAdminVerified (inline) |
| 13261 | `POST /admin/wallet/forecast-scenarios` | ACTION | isSuperAdminVerified (inline) |
| 13279 | `PATCH /admin/wallet/forecast-scenarios/:id` | ACTION | isSuperAdminVerified (inline) |
| 13304 | `POST /admin/wallet/forecast-scenarios/:id/run` | ACTION | isSuperAdminVerified (inline) |
| 13356 | `GET /admin/wallet/exception-suggestions` | READ | isSuperAdminVerified (inline) |
| 13373 | `POST /admin/wallet/exception-suggestions/generate` | ACTION | isSuperAdminVerified (inline) |
| 13445 | `POST /admin/wallet/exception-suggestions/:id/apply` | ACTION | isSuperAdminVerified (inline) |
| 13463 | `POST /admin/wallet/exception-suggestions/:id/dismiss` | ACTION | isSuperAdminVerified (inline) |
| 13478 | `GET /admin/wallet/governance-report` | READ | isSuperAdminVerified (inline) |
| 13606 | `POST /admin/wallet/approval-requests/:id/retry-execution` | ACTION | isSuperAdminVerified (inline) |
| 13633 | `GET /admin/wallet/approval-requests/:id` | READ | isSuperAdminVerified (inline) |
| 13656 | `POST /admin/wallet/policy-simulations/:id/promote` | POLICY | isSuperAdminVerified (inline) |
| 13760 | `GET /admin/wallet/policy-promotions` | POLICY | isSuperAdminVerified (inline) |
| 13772 | `POST /admin/wallet/policy-promotions/:id/rollback` | POLICY | isSuperAdminVerified (inline) |
| 13805 | `GET /admin/wallet/forecast-backtests` | READ | isSuperAdminVerified (inline) |
| 13823 | `POST /admin/wallet/forecast-backtests/run` | ACTION | isSuperAdminVerified (inline) |
| 13903 | `GET /admin/wallet/forecast-scenarios/:id/accuracy` | READ | isSuperAdminVerified (inline) |
| 13931 | `POST /admin/wallet/assistant/execute` | ACTION | isSuperAdminVerified (inline) |
| 13975 | `GET /admin/wallet/assistant/actions` | READ | isSuperAdminVerified (inline) |
| 14026 | `GET /admin/wallet/governance-pack` | READ | isSuperAdminVerified (inline) |
| 14041 | `POST /admin/wallet/governance-pack/send` | ACTION | isSuperAdminVerified (inline) |
| 14069 | `GET /admin/wallet/governance-pack/log` | READ | isSuperAdminVerified (inline) |
| 14083 | `GET /admin/wallet/playbooks` | READ | isSuperAdminVerified (inline) |
| 14099 | `POST /admin/wallet/playbooks` | ACTION | isSuperAdminVerified (inline) |
| 14117 | `PATCH /admin/wallet/playbooks/:id` | ACTION | isSuperAdminVerified (inline) |
| 14142 | `GET /admin/wallet/entities` | READ | isSuperAdminVerified (inline) |
| 14154 | `POST /admin/wallet/entities` | ACTION | isSuperAdminVerified (inline) |
| 14173 | `PATCH /admin/wallet/entities/:entityCode` | ACTION | isSuperAdminVerified (inline) |
| 14197 | `POST /admin/wallet/finance-assistant` | ACTION | isSuperAdminVerified (inline) |
| 14243 | `GET /admin/wallet/orchestration-runs` | READ | isSuperAdminVerified (inline) |
| 14267 | `POST /admin/wallet/orchestration-runs/:id/retry` | ACTION | isSuperAdminVerified (inline) |
| 14301 | `GET /admin/wallet/promotion-validations` | READ | isSuperAdminVerified (inline) |
| 14320 | `GET /admin/wallet/forecast-templates` | READ | isSuperAdminVerified (inline) |
| 14334 | `POST /admin/wallet/forecast-templates` | CONFIG | isSuperAdminVerified (inline) |
| 14353 | `PATCH /admin/wallet/forecast-templates/:id` | CONFIG | isSuperAdminVerified (inline) |
| 14369 | `POST /admin/wallet/forecast-templates/:id/apply` | CONFIG | isSuperAdminVerified (inline) |
| 14406 | `GET /admin/wallet/assistant/queue` | READ | isSuperAdminVerified (inline) |
| 14420 | `POST /admin/wallet/assistant/queue/:id/assign` | ACTION | isSuperAdminVerified (inline) |
| 14443 | `POST /admin/wallet/assistant/queue/:id/approve` | ACTION | isSuperAdminVerified (inline) |
| 14472 | `POST /admin/wallet/assistant/queue/:id/execute` | ACTION | isSuperAdminVerified (inline) |
| 14535 | `GET /admin/wallet/governance/recipient-groups` | READ | isSuperAdminVerified (inline) |
| 14547 | `POST /admin/wallet/governance/recipient-groups` | ACTION | isSuperAdminVerified (inline) |
| 14566 | `PATCH /admin/wallet/governance/recipient-groups/:id` | ACTION | isSuperAdminVerified (inline) |
| 14587 | `GET /admin/wallet/governance/distribution-rules` | READ | isSuperAdminVerified (inline) |
| 14603 | `POST /admin/wallet/governance/distribution-rules` | ACTION | isSuperAdminVerified (inline) |
| 14622 | `PATCH /admin/wallet/governance/distribution-rules/:id` | ACTION | isSuperAdminVerified (inline) |
| 14643 | `GET /admin/wallet/orchestration-trace/:entityType/:entityId` | READ | isSuperAdminVerified (inline) |
| 14710 | `GET /admin/wallet/policy-outcomes` | POLICY | umbrella gate only |
| 14729 | `POST /admin/wallet/policy-outcomes/recompute` | POLICY | umbrella gate only |
| 14770 | `GET /admin/wallet/policy-outcomes/:policyKey/latest` | POLICY | umbrella gate only |
| 14786 | `GET /admin/wallet/orchestration-retry-policies` | POLICY | umbrella gate only |
| 14807 | `POST /admin/wallet/orchestration-retry-policies` | POLICY | umbrella gate only |
| 14822 | `PATCH /admin/wallet/orchestration-retry-policies/:id` | POLICY | umbrella gate only |
| 14841 | `GET /admin/wallet/approval-bottlenecks` | READ | isSuperAdminVerified (inline) |
| 14909 | `GET /admin/wallet/approval-bottlenecks/:requestId` | READ | umbrella gate only |
| 14928 | `GET /admin/wallet/governance-pack-subscriptions` | POLICY | umbrella gate only |
| 14937 | `POST /admin/wallet/governance-pack-subscriptions` | POLICY | umbrella gate only |
| 14953 | `PATCH /admin/wallet/governance-pack-subscriptions/:id` | POLICY | umbrella gate only |
| 14970 | `GET /admin/wallet/scenario-entity-scores` | READ | umbrella gate only |
| 14991 | `POST /admin/wallet/scenario-entity-scores` | ACTION | umbrella gate only |
| 15017 | `GET /admin/wallet/anomaly-clusters` | READ | umbrella gate only |
| 15026 | `POST /admin/wallet/anomaly-clusters/recompute` | ACTION | umbrella gate only |
| 15048 | `GET /admin/wallet/ops-command-center` | READ | umbrella gate only |
| 15095 | `GET /admin/wallet/recommendation-scores` | READ | isSuperAdminVerified (inline) |
| 15124 | `GET /admin/wallet/recommendation-scores/:entityType/:entityId` | READ | umbrella gate only |
| 15137 | `POST /admin/wallet/recommendation-scores/recompute` | ACTION | umbrella gate only |
| 15160 | `GET /admin/wallet/command-center/drillthrough/:widgetKey` | READ | umbrella gate only |
| 15180 | `GET /admin/wallet/remediation-plans` | READ | umbrella gate only |
| 15219 | `POST /admin/wallet/remediation-plans/generate` | ACTION | umbrella gate only |
| 15242 | `PATCH /admin/wallet/remediation-plans/:id` | ACTION | umbrella gate only |
| 15257 | `GET /admin/wallet/approval-workload` | READ | umbrella gate only |
| 15300 | `POST /admin/wallet/approval-workload/rebalance-preview` | POLICY | umbrella gate only |
| 15325 | `POST /admin/wallet/approval-workload/reassign` | POLICY | umbrella gate only |
| 15353 | `GET /admin/wallet/governance-delivery-analytics` | READ | umbrella gate only |
| 15389 | `POST /admin/wallet/governance-delivery-analytics/record` | ACTION | umbrella gate only |
| 15405 | `GET /admin/wallet/scenario-quality` | READ | umbrella gate only |
| 15424 | `POST /admin/wallet/scenario-quality/recompute` | ACTION | umbrella gate only |
| 15453 | `GET /admin/wallet/operating-review-pack` | READ | umbrella gate only |
| 15500 | `GET /admin/wallet/operating-review-pack/export` | READ | umbrella gate only |
| 15520 | `GET /admin/wallet/recommendation-actions` | READ | umbrella gate only |
| 15554 | `POST /admin/wallet/recommendation-actions` | ACTION | umbrella gate only |
| 15585 | `PATCH /admin/wallet/recommendation-actions/:id` | ACTION | umbrella gate only |
| 15600 | `GET /admin/wallet/remediation-outcomes` | READ | umbrella gate only |
| 15627 | `POST /admin/wallet/remediation-outcomes` | ACTION | umbrella gate only |
| 15668 | `GET /admin/wallet/policy-learning-suggestions` | POLICY | umbrella gate only |
| 15686 | `POST /admin/wallet/policy-learning-suggestions` | POLICY | umbrella gate only |
| 15708 | `PATCH /admin/wallet/policy-learning-suggestions/:id` | POLICY | umbrella gate only |
| 15744 | `POST /admin/wallet/policy-learning-suggestions/auto-generate` | POLICY | umbrella gate only |
| 15790 | `GET /admin/wallet/reviewer-performance` | READ | umbrella gate only |
| 15820 | `POST /admin/wallet/reviewer-performance/snapshot` | ACTION | umbrella gate only |
| 15854 | `GET /admin/wallet/review-follow-up-actions` | READ | umbrella gate only |
| 15875 | `POST /admin/wallet/review-follow-up-actions` | ACTION | umbrella gate only |
| 15894 | `PATCH /admin/wallet/review-follow-up-actions/:id` | ACTION | umbrella gate only |
| 15922 | `GET /admin/wallet/unified-recommendations` | READ | umbrella gate only |
| 15942 | `POST /admin/wallet/unified-recommendations` | ACTION | umbrella gate only |
| 15965 | `PATCH /admin/wallet/unified-recommendations/:id` | ACTION | umbrella gate only |
| 15993 | `POST /admin/wallet/execution-feedback` | ACTION | umbrella gate only |
| 16050 | `GET /admin/wallet/execution-feedback/summary` | READ | umbrella gate only |
| 16078 | `GET /admin/wallet/recommendations/prioritized` | READ | umbrella gate only |
| 16113 | `POST /admin/wallet/recommendations/recompute-priority` | ACTION | umbrella gate only |
| 16177 | `GET /admin/wallet/outcomes/effectiveness` | READ | umbrella gate only |
| 16231 | `PATCH /admin/wallet/outcomes/:id/effectiveness` | ACTION | umbrella gate only |
| 16252 | `GET /admin/wallet/followups` | READ | umbrella gate only |
| 16285 | `POST /admin/wallet/followups/auto-generate` | ACTION | umbrella gate only |
| 16339 | `PATCH /admin/wallet/followups/:id` | ACTION | umbrella gate only |
| 16366 | `POST /admin/wallet/followups/escalate-overdue` | ACTION | umbrella gate only |
| 16399 | `GET /admin/wallet/bottlenecks` | READ | umbrella gate only |
| 16494 | `GET /admin/wallet/reviewer-analytics` | READ | umbrella gate only |
| 16543 | `GET /admin/wallet/reviewer-analytics/:uid` | READ | umbrella gate only |
| 16581 | `POST /admin/wallet/reviewer-analytics/compute-quality` | ACTION | umbrella gate only |
| 16647 | `GET /admin/wallet/execution-timeline/:recommendationId` | READ | umbrella gate only |
| 16729 | `GET /admin/wallet/execution-review` | READ | umbrella gate only |
| 16855 | `POST /admin/wallet/recommendations/apply-feedback-loop` | ACTION | umbrella gate only |
| 16914 | `GET /admin/wallet/recommendations/priority-adjustments` | READ | umbrella gate only |
| 16932 | `GET /admin/wallet/recommendations/action-sequences` | READ | umbrella gate only |
| 16945 | `POST /admin/wallet/recommendations/simulate-sequence` | ACTION | umbrella gate only |
| 16994 | `GET /admin/wallet/policies/escalation-adjustments` | POLICY | umbrella gate only |
| 17023 | `POST /admin/wallet/policies/escalation-adjustments/generate` | POLICY | umbrella gate only |
| 17058 | `POST /admin/wallet/policies/escalation-adjustments/:id/approve` | POLICY | umbrella gate only |
| 17077 | `POST /admin/wallet/policies/escalation-adjustments/:id/reject` | POLICY | umbrella gate only |
| 17090 | `GET /admin/wallet/reviewers/workload-suggestions` | READ | umbrella gate only |
| 17114 | `POST /admin/wallet/reviewers/generate-workload-suggestions` | ACTION | umbrella gate only |
| 17147 | `POST /admin/wallet/reviewers/apply-workload-adjustment` | POLICY | umbrella gate only |
| 17162 | `POST /admin/wallet/execution-review/send` | ACTION | umbrella gate only |
| 17189 | `GET /admin/wallet/execution-review/deliveries` | READ | umbrella gate only |
| 17202 | `GET /admin/wallet/execution-trends` | READ | umbrella gate only |
| 17272 | `GET /admin/wallet/governance-alerts` | READ | umbrella gate only |
| 17289 | `POST /admin/wallet/governance-alerts/:id/ack` | ACTION | umbrella gate only |
| 17300 | `POST /admin/wallet/governance-alerts/trigger` | ACTION | umbrella gate only |
| 17371 | `GET /admin/wallet/kill-switches` | POLICY | umbrella gate only |
| 17389 | `POST /admin/wallet/kill-switches/:key/toggle` | POLICY | umbrella gate only |
| 17406 | `GET /admin/wallet/kill-switches/:key/check` | POLICY | umbrella gate only |
| 17425 | `POST /admin/wallet/test-retry-safety` | ACTION | umbrella gate only |
| 17453 | `GET /admin/wallet/idempotency-keys` | READ | umbrella gate only |
| 17482 | `GET /admin/wallet/permission-audit` | READ | umbrella gate only |
| 17504 | `POST /admin/wallet/run-money-checks` | ACTION | umbrella gate only |
| 17611 | `GET /admin/wallet/money-check-results` | READ | umbrella gate only |
| 17641 | `GET /admin/wallet/security-audit` | READ | umbrella gate only |
| 17665 | `GET /admin/wallet/consistency-check` | READ | umbrella gate only |
| 17739 | `GET /admin/wallet/go-live-checklist` | READ | umbrella gate only |
| 17751 | `POST /admin/wallet/go-live-checklist/:id/verify` | CONFIG | umbrella gate only |
| 17768 | `POST /admin/wallet/go-live-checklist/:id/unverify` | CONFIG | umbrella gate only |
| 17779 | `GET /admin/wallet/rollback-plan` | READ | umbrella gate only |
