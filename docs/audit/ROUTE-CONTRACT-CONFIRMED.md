# Route-contract audit — CONFIRMED defects

Agent 11 (API Contract Engine) · scanner v2 · base `main` @ `548be1878` · 2026-09-05

Produced by `node scripts/audit/route-contract/scan.mjs`. **Audit only — no
application code was changed in this PR.** Each finding names the exact client
`file:line` and the resolved server path, so an owning agent can act on it
without re-deriving anything.

## How this scanner differs from the one that produced false positives

The previous scanner matched `router.get('/foo')` textually and never resolved
**where that router is mounted**. This one builds a real routing table.

| stage | what it does |
|---|---|
| module index | every `server/**/*.ts` (tests excluded): imports, `Router()` declarations, default/named exports, `.use()` and `.get/post/...` calls |
| mount walk | BFS seeded from the express `app` in `server/routes.ts`, `server/index.ts`, `server/enterprise/routes.ts`; follows `app.use(prefix, router)` and nested `router.use(sub, child)`, **composing the prefix transitively** |
| router resolution | static imports, `(await import('./x')).default`, `const { r } = await import('./x')`, and `createXRouter()` factories — all used heavily in `server/routes.ts` |
| client extraction | `apiRequest` (both argument orders + options object), `fetch`/`fetchWithRetry`, `getApiUrl()`, axios, `EventSource`/`WebSocket`, and TanStack `queryKey` |
| matching | positional — `:id`/`:userId`/`:runId` match any single segment; template literals normalise to `:p` |

Every finding carries a provenance chain (`mountChain`) showing which
`app.use`/`router.use` lines produced its prefix, so a "CONFIRMED" claim can be
re-checked in one read.

### Coverage

| metric | value |
|---|---|
| server routes resolved | **3188** |
| **unresolved mounts** | **0** |
| handlers never mounted | 12 (all of `server/routes/social.ts`, a router nothing `use()`s) |
| wildcard guards / SPA fallbacks excluded from matching | 5 |
| client files scanned | 939 |
| real client API calls | 1516 |
| non-requests correctly rejected | 676 |
| calls that MATCH | 1497 |

Runtime ~12 s, no install, no network.

### The five false-positive classes this scanner had to defeat

Each of these was found by hand-verifying the scanner's own output and each one
had produced at least one bogus finding before it was fixed.

1. **Comment stripping that is not string-aware.** A naive stripper reads the
   `//` inside `'https://…'` as a line comment and blanks the rest of the line.
   On the 14 000-line `server/routes.ts` that silently deleted hundreds of real
   `app.use()` calls — 1940 resolved routes instead of 3188.
2. **Wildcard registrations treated as endpoints.** `app.get('*', …)` is the SPA
   HTML fallback (it `next()`s for `/api/`), and `app.post('/api/finance/*', …allFinanceGuards)`
   is a guard chain. Counting them made `/api/finance/commissions` look like a
   METHOD_MISMATCH instead of the 404 it is.
3. **TanStack `queryKey` read as a request unconditionally.** A bare `queryKey`
   *is* a GET here (the repo's default `queryFn` does `getApiUrl(queryKey[0])`),
   but a key with a sibling `queryFn`, or one passed to `invalidateQueries`, is
   only a cache key. 676 such keys are rejected.
4. **Unbalanced template interpolation.** `/api/x${q ? \`?n=${n}\` : ''}` collapses
   to garbage under `/\$\{.*?\}/`. Interpolations are now brace-balanced, and a
   *glued* trailing interpolation is emitted in **both** readings
   (`/api/expenses${qs}` → query string *or* path segment) — the call passes if
   either resolves.
5. **Auth by fixed token list.** `requireAdminPanelAccess` and
   `requireKYCPermission(...)` are real guards that no allow-list contains.
   Guard names are now matched by pattern, guards inherit down the mount chain,
   and a gate written *inside* the handler body counts. 279 → 183.

## Recall against the known defects

Eleven were handed to me as ground truth. **The scanner reports 10 of 11.**

| # | ground truth | scanner | class emitted |
|---|---|---|---|
| 1 | `POST /api/k9000/restock-request` 404 | **CAUGHT** | CLIENT_ONLY |
| 2 | `POST …/wallet/period-pack/generate` 404 | **CAUGHT** | CLIENT_ONLY |
| 3 | `POST …/wallet/replay/diff` 404 | **CAUGHT** | PARAM_MISMATCH (+ verb note) |
| 4 | `GET …/wallet/replay/reports` drops `:runId` | **CAUGHT** | PARAM_MISMATCH |
| 5 | `cash-forecast/recompute` wrong method | **CAUGHT** | METHOD_MISMATCH |
| 6 | `DELETE /api/admin/users/:userId` 404 | **CAUGHT** | CLIENT_ONLY |
| 7 | `PATCH /api/admin/users/:userId` 404 | **CAUGHT** | CLIENT_ONLY |
| 8 | `PATCH /api/sitter-suite/sitters/:id` 404 | **not reported — ground truth appears wrong** | see below |
| 9 | `GET /api/marketplace/rankings/audit` drops `:userId` | **CAUGHT** | PARAM_MISMATCH |
| 10 | `/api/marketplace/rankings/audit?userId=` vs `/audit/:userId` | **CAUGHT** (same finding as 9) | PARAM_MISMATCH |
| 11 | `/api/finance/commissions` CLIENT_ONLY | **CAUGHT** | CLIENT_ONLY |

**On #8 I disagree with the ground truth, and I checked it by hand.**
`router.patch('/sitters/:id', requireAuth, …)` is at `server/routes/sitter-suite.ts:435`,
the router is mounted once at `app.use('/api/sitter-suite', apiLimiter, sitterSuiteRoutes)`
(`server/routes.ts:13245`), nothing is registered before it that could shadow it,
and `git log -L435,436` shows the handler has been there since PR #999. The
client's `PATCH \`/api/sitter-suite/sitters/${profile?.id}\`` at
`client/src/pages/sitter-suite/SitterEditProfile.tsx:96` resolves to it. I believe
the item is either stale (main has advanced 615 commits) or was inherited from the
old scanner's own false positive.

There **is** a real defect one line-range away, and the scanner found it
independently: `PATCH /api/sitter-suite/sitters/location` (line 524) is
registered *after* `/sitters/:id` (line 435), so express routes `location` into
the `:id` handler and the location endpoint is unreachable. No web client calls
it today, so it surfaces in the shadowing section rather than as a client finding.

## Precision — hand-verified sample

I read both sides of **11** findings (the brief asked for 10). Method: open the
client file at the stated line, then enumerate every resolved server route under
that prefix and grep the server tree for the path.

| # | finding | verdict |
|---|---|---|
| 1 | `GET /api/admin/loyalty/customers` | **HELD** — zero server definitions anywhere |
| 2 | `GET /api/finance/commissions` | **HELD** — zero definitions; the client's own comment says `"recent" was dropped` |
| 3 | `GET /api/crm/communications/history` | **HELD** — no `/history` under any crm mount |
| 4 | `GET /api/k9000/inventory` | **HELD** — only `/api/k9000/inventory-dashboard` exists |
| 5 | `GET /api/k9000/inventory/summary` | **HELD** — same; the whole page is dead |
| 6 | `POST /api/k9000/restock-request` | **HELD** — zero definitions |
| 7 | `GET /api/prestige-pass/admin/wallet/governance-pack` (BODY_MISMATCH) | **FALSE POSITIVE — fixed.** `apiRequest('GET', url, undefined)`; the literal `undefined` was read as a body |
| 8 | `GET /api/account/export` (BODY_MISMATCH) | **HELD** — `apiRequest('GET', url, {})`; `{}` is truthy so the wrapper serialises it, and `fetch` throws *"Request with GET/HEAD method cannot have body"* |
| 9 | `GET /api/provider-onboarding/mgmt/analytics` | **HELD, reclassified.** The route exists; the defect is that the call passes a **4th argument** (a headers object with `Authorization`) to a 3-parameter `apiRequest` — silently dropped. Was BODY_MISMATCH, now AUTH_MISMATCH |
| 10 | `GET /api/expenses` via `MyExpenses.tsx:76` (was LEGACY `/api/:p`) | **FALSE POSITIVE — fixed.** Template mangling; route exists and matches |
| 11 | `GET /api/admin/fiscal-transactions/by-source/:p/:p` | **HELD** — real path is `/api/fiscal/transactions/by-source/:source/:sourceId` (`server/routes/fiscal-passport.ts:87`). The *suggestion* was initially wrong (pointed at an unrelated `/api/case-actions/notes/:a/:b`) and the relocation heuristic was tightened |

**Precision on the sample: 9/11 held as emitted (82%).** Both misses were
mechanical and both are fixed in this PR, so the 19 findings below are the
post-fix set. Two further findings had the right verdict but the wrong class or
wrong suggestion — corrected. Treating the two fixed false positives as no longer
present, the shipped list's estimated precision is **≈ 95%**; I would not claim
100% without reading all 19.

## CONFIRMED findings, grouped by owning agent

### Summary of what to dispatch

| class | count | who acts |
|---|---|---|
| CLIENT_ONLY (live 404) | 9 | domain owner below |
| PARAM_MISMATCH | 4 | domain owner below |
| METHOD_MISMATCH | 1 | prestige lane |
| PATH_MISMATCH (client) | 1 | admin lane |
| BODY_MISMATCH | 1 | privacy/account lane |
| AUTH_MISMATCH (client-side, dropped header) | 1 | provider lane |
| **PATH_MISMATCH (server shadowing, unreachable route)** | **20** | per-domain, listed below |
| AUTH_MISMATCH (server-side, no gate resolved) | 183 | security lane — triage first, see caveat |
| SERVER_ONLY-SENSITIVE | 443 | informational |

**Caveat on the 183 server-side AUTH findings.** These are routes whose path
contains `admin`, sit **outside** the `/api/admin/` guard blanket in
`server/routes.ts:571`, and for which no guard was resolved on the handler line,
on the mount chain, or inline in the handler body. I hand-verified two:
`GET /api/admin-panel/stats` and `GET /api/kyc/v2/admin/health` were **false
positives** (locally-built guards) and drove the pattern-matching rewrite; after
that rewrite I hand-verified
`GET /api/prestige-pass/admin/wallet/policy-outcomes`
(`server/routes/prestige-pass.ts:14347`) and it is **genuinely ungated** — its
mount supplies only `apiLimiter, optionalFirebaseToken`, and the sole
router-level middleware on `/admin/wallet` (`prestige-pass.ts:3262`,
`adminWalletAuditMiddleware`) is an **audit logger that calls `next()` for every
GET**, not an auth check. I have not verified the other 180. Treat this list as a
prioritised queue for the security lane, not as 183 confirmed holes.

### admin — 5 confirmed

**CLIENT_ONLY · `GET /api/admin/loyalty/customers`**

- client: `client/src/components/admin/LoyaltyDashboard.tsx:105` (fetch)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**CLIENT_ONLY · `DELETE /api/admin/users/:p`**

- client: `client/src/pages/AdminUsers.tsx:141` (apiRequest)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**CLIENT_ONLY · `PATCH /api/admin/users/:p`**

- client: `client/src/pages/AdminUsers.tsx:165` (apiRequest)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**CLIENT_ONLY · `GET /api/admin/users`**

- client: `client/src/pages/AdminUsers.tsx:115` (queryKey)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**PATH_MISMATCH · `GET /api/admin/fiscal-transactions/by-source/:p/:p`**

- client: `client/src/pages/admin/AdminTransactionExplorer.tsx:122` (apiRequest)
- server: `GET /api/fiscal/transactions/by-source/:source/:sourceId` — `server/routes/fiscal-passport.ts:87`
- why: no route at /api/admin/fiscal-transactions/by-source/:p/:p; the same handler is mounted at /api/fiscal/transactions/by-source/:source/:sourceId (last 3 segments identical) — the client's mount prefix is wrong


### booking — 1 confirmed

**PARAM_MISMATCH · `GET /api/marketplace/rankings/audit`**

- client: `client/src/pages/MarketplaceIntelligenceDashboard.tsx:112` (fetch)
- server: `GET /api/marketplace/rankings/audit/:userId` — `server/routes/marketplace-ranking.ts:465`
- why: server declares 1 PATH param(s) (/api/marketplace/rankings/audit/:userId); client sends the value as a QUERY STRING


### provider — 2 confirmed

**AUTH_MISMATCH · `GET /api/provider-onboarding/mgmt/analytics`**

- client: `client/src/pages/admin/ManagementKycDashboard.tsx:91` (apiRequest)
- server: `GET /api/provider-onboarding/mgmt/analytics` — `server/routes/provider-onboarding.ts:3713`
- why: apiRequest() takes 3 parameters; this call passes 4. The extra argument is SILENTLY DROPPED and never reaches the server: { ...(token ? { Authorization: `Bearer ${token}` } : {}), }

**CLIENT_ONLY · `GET /api/providers/earnings/:p`**

- client: `client/src/services/marketplace.ts:189` (queryKey)
- server: **no server route resolves**
- why: no server route resolves — this call 404s


### prestige|egift|sumit — 5 confirmed

**PARAM_MISMATCH · `POST /api/prestige-pass/admin/wallet/replay/diff`**

- client: `client/src/pages/AdminWalletDashboard.tsx:3020` (apiRequest)
- server: `GET /api/prestige-pass/admin/wallet/replay/diff/:runId` — `server/routes/prestige-pass.ts:12407`
- why: server requires 1 more path param(s) (/api/prestige-pass/admin/wallet/replay/diff/:runId); client stops at /api/prestige-pass/admin/wallet/replay/diff — AND the verb is wrong: server is GET, client sends POST

**CLIENT_ONLY · `POST /api/prestige-pass/admin/wallet/period-pack/generate`**

- client: `client/src/pages/AdminWalletDashboard.tsx:3037` (apiRequest)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**PARAM_MISMATCH · `GET /api/prestige-pass/admin/wallet/replay/reports`**

- client: `client/src/pages/AdminWalletDashboard.tsx:1205` (queryKey)
- server: `GET /api/prestige-pass/admin/wallet/replay/reports/:runId` — `server/routes/prestige-pass.ts:12056`
- why: server requires 1 more path param(s) (/api/prestige-pass/admin/wallet/replay/reports/:runId); client stops at /api/prestige-pass/admin/wallet/replay/reports

**METHOD_MISMATCH · `GET /api/prestige-pass/admin/wallet/cash-forecast/recompute`**

- client: `client/src/pages/AdminWalletDashboard.tsx:1217` (queryKey)
- server: `POST /api/prestige-pass/admin/wallet/cash-forecast/recompute` — `server/routes/prestige-pass.ts:12144`
- why: server exposes POST at this path, client sends GET

**PARAM_MISMATCH · `GET /api/prestige-pass/admin/wallet/replay/diff`**

- client: `client/src/pages/AdminWalletDashboard.tsx:1289` (queryKey)
- server: `GET /api/prestige-pass/admin/wallet/replay/diff/:runId` — `server/routes/prestige-pass.ts:12407`
- why: server requires 1 more path param(s) (/api/prestige-pass/admin/wallet/replay/diff/:runId); client stops at /api/prestige-pass/admin/wallet/replay/diff


### stations|k9000 — 3 confirmed

**CLIENT_ONLY · `POST /api/k9000/restock-request`**

- client: `client/src/pages/InventoryManagement.tsx:67` (fetch)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**CLIENT_ONLY · `GET /api/k9000/inventory`**

- client: `client/src/pages/InventoryManagement.tsx:54` (queryKey)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**CLIENT_ONLY · `GET /api/k9000/inventory/summary`**

- client: `client/src/pages/InventoryManagement.tsx:60` (queryKey)
- server: **no server route resolves**
- why: no server route resolves — this call 404s


### other — 3 confirmed

**CLIENT_ONLY · `GET /api/finance/commissions`**

- client: `client/src/components/control-panel/FinanceSettlementsView.tsx:104` (queryKey)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**CLIENT_ONLY · `GET /api/crm/communications/history`**

- client: `client/src/pages/CommunicationCenter.tsx:423` (queryKey)
- server: **no server route resolves**
- why: no server route resolves — this call 404s

**BODY_MISMATCH · `GET /api/account/export`**

- client: `client/src/pages/MyAccount.tsx:1339` (apiRequest)
- server: `GET /api/account/export` — `server/routes/account-management.ts:586`
- why: client attaches a request body to a GET — fetch() throws "Request with GET/HEAD method cannot have body", so this call never leaves the browser


### Unreachable server routes (shadowing) — 20 confirmed

| route | declared at | shadowed by |
|---|---|---|
| `GET /api/admin/vouchers/export` | `server/routes.ts:8219` | `GET /api/admin/vouchers/:id` at `server/routes.ts:8171` |
| `GET /api/crm/leads/analytics` | `server/routes.ts:10129` | `GET /api/crm/leads/:id` at `server/routes.ts:9807` |
| `GET /api/admin/customers/export` | `server/routes.ts:10940` | `GET /api/admin/customers/:id` at `server/routes.ts:10555` |
| `GET /api/crm/communications/appointment-reminders/pending` | `server/routes.ts:11345` | `GET /api/crm/communications/appointment-reminders/:id` at `server/routes.ts:11296` |
| `GET /api/crm/communications/appointment-reminders/scheduled` | `server/routes.ts:11356` | `GET /api/crm/communications/appointment-reminders/:id` at `server/routes.ts:11296` |
| `GET /api/pets/intake-forms` | `server/routes/pets.ts:545` | `GET /api/pets/:petId` at `server/routes/pets.ts:99` |
| `GET /api/events/stats` | `server/routes/events.ts:221` | `GET /api/events/:id` at `server/routes/events.ts:59` |
| `GET /api/admin/stations/low-stock` | `server/routes/stations.ts:817` | `GET /api/admin/stations/:id` at `server/routes/stations.ts:131` |
| `GET /api/enterprise/stations/map` | `server/routes/enterprise.ts:735` | `GET /api/enterprise/stations/:id` at `server/routes/enterprise.ts:237` |
| `GET /api/k9000/spare-parts/orders` | `server/routes/k9000-supplier.ts:646` | `GET /api/k9000/spare-parts/:id` at `server/routes/k9000-supplier.ts:80` |
| `GET /api/k9000/spare-parts/summary` | `server/routes/k9000-supplier.ts:699` | `GET /api/k9000/spare-parts/:id` at `server/routes/k9000-supplier.ts:80` |
| `GET /api/prestige-pass/admin/system/e2e/history` | `server/routes/prestige-pass.ts:17611` | `GET /api/prestige-pass/admin/system/e2e/:id` at `server/routes/prestige-pass.ts:17601` |
| `GET /api/google/places/photo` | `server/routes/google-services.ts:81` | `GET /api/google/places/:placeId` at `server/routes/google-services.ts:56` |
| `PATCH /api/sitter-suite/sitters/location` | `server/routes/sitter-suite.ts:524` | `PATCH /api/sitter-suite/sitters/:id` at `server/routes/sitter-suite.ts:435` |
| `GET /api/walk-my-pet/walkers/search` | `server/routes/walk-my-pet.ts:316` | `GET /api/walk-my-pet/walkers/:walkerId` at `server/routes/walk-my-pet.ts:225` |
| `GET /api/walk-my-pet/walks/mine` | `server/routes/walk-my-pet.ts:2013` | `GET /api/walk-my-pet/walks/:bookingId` at `server/routes/walk-my-pet.ts:1274` |
| `GET /api/provider-onboarding/admin/applications/queue` | `server/routes/provider-onboarding.ts:2757` | `GET /api/provider-onboarding/admin/applications/:applicationId` at `server/routes/provider-onboarding.ts:2033` |
| `GET /api/provider-availability/slots` | `server/routes/provider-availability.ts:540` | `GET /api/provider-availability/:providerId` at `server/routes/provider-availability.ts:42` |
| `PATCH /api/operations/tasks/bulk` | `server/routes/operations.ts:370` | `PATCH /api/operations/tasks/:id` at `server/routes/operations.ts:182` |
| `PATCH /api/operations/incidents/bulk` | `server/routes/operations.ts:765` | `PATCH /api/operations/incidents/:id` at `server/routes/operations.ts:577` |

### AUTH_MISMATCH — 183 (by domain)

| domain | count |
|---|---|
| prestige\|egift\|sumit | 165 |
| provider | 9 |
| other | 8 |
| booking | 1 |

First 30:

| route | file:line |
|---|---|
| `GET /api/prestige-pass/admin/wallet/dispute-routing-rules/test-cases` | `server/routes/prestige-pass.ts:11577` |
| `GET /api/prestige-pass/admin/wallet/policy-outcomes` | `server/routes/prestige-pass.ts:14347` |
| `POST /api/prestige-pass/admin/wallet/policy-outcomes/recompute` | `server/routes/prestige-pass.ts:14366` |
| `GET /api/prestige-pass/admin/wallet/policy-outcomes/:policyKey/latest` | `server/routes/prestige-pass.ts:14407` |
| `GET /api/prestige-pass/admin/wallet/orchestration-retry-policies` | `server/routes/prestige-pass.ts:14423` |
| `POST /api/prestige-pass/admin/wallet/orchestration-retry-policies` | `server/routes/prestige-pass.ts:14444` |
| `PATCH /api/prestige-pass/admin/wallet/orchestration-retry-policies/:id` | `server/routes/prestige-pass.ts:14459` |
| `GET /api/prestige-pass/admin/wallet/approval-bottlenecks/:requestId` | `server/routes/prestige-pass.ts:14546` |
| `GET /api/prestige-pass/admin/wallet/governance-pack-subscriptions` | `server/routes/prestige-pass.ts:14565` |
| `POST /api/prestige-pass/admin/wallet/governance-pack-subscriptions` | `server/routes/prestige-pass.ts:14574` |
| `PATCH /api/prestige-pass/admin/wallet/governance-pack-subscriptions/:id` | `server/routes/prestige-pass.ts:14590` |
| `GET /api/prestige-pass/admin/wallet/scenario-entity-scores` | `server/routes/prestige-pass.ts:14607` |
| `POST /api/prestige-pass/admin/wallet/scenario-entity-scores` | `server/routes/prestige-pass.ts:14628` |
| `GET /api/prestige-pass/admin/wallet/anomaly-clusters` | `server/routes/prestige-pass.ts:14654` |
| `POST /api/prestige-pass/admin/wallet/anomaly-clusters/recompute` | `server/routes/prestige-pass.ts:14663` |
| `GET /api/prestige-pass/admin/wallet/ops-command-center` | `server/routes/prestige-pass.ts:14685` |
| `GET /api/prestige-pass/admin/wallet/recommendation-scores/:entityType/:entityId` | `server/routes/prestige-pass.ts:14761` |
| `POST /api/prestige-pass/admin/wallet/recommendation-scores/recompute` | `server/routes/prestige-pass.ts:14774` |
| `GET /api/prestige-pass/admin/wallet/command-center/drillthrough/:widgetKey` | `server/routes/prestige-pass.ts:14797` |
| `GET /api/prestige-pass/admin/wallet/remediation-plans` | `server/routes/prestige-pass.ts:14817` |
| `POST /api/prestige-pass/admin/wallet/remediation-plans/generate` | `server/routes/prestige-pass.ts:14856` |
| `PATCH /api/prestige-pass/admin/wallet/remediation-plans/:id` | `server/routes/prestige-pass.ts:14879` |
| `GET /api/prestige-pass/admin/wallet/approval-workload` | `server/routes/prestige-pass.ts:14894` |
| `POST /api/prestige-pass/admin/wallet/approval-workload/rebalance-preview` | `server/routes/prestige-pass.ts:14937` |
| `POST /api/prestige-pass/admin/wallet/approval-workload/reassign` | `server/routes/prestige-pass.ts:14962` |
| `GET /api/prestige-pass/admin/wallet/governance-delivery-analytics` | `server/routes/prestige-pass.ts:14990` |
| `POST /api/prestige-pass/admin/wallet/governance-delivery-analytics/record` | `server/routes/prestige-pass.ts:15026` |
| `GET /api/prestige-pass/admin/wallet/scenario-quality` | `server/routes/prestige-pass.ts:15042` |
| `POST /api/prestige-pass/admin/wallet/scenario-quality/recompute` | `server/routes/prestige-pass.ts:15061` |
| `GET /api/prestige-pass/admin/wallet/operating-review-pack` | `server/routes/prestige-pass.ts:15090` |

### SERVER_ONLY-SENSITIVE — 443 (informational, needs owner triage)

Mounted routes on a money / admin / identity surface with **no caller in `client/src`**. This is NOT automatically dead code: an iOS or Android app, a cron, or an internal tool may call it. It is a list for owners to confirm or retire.

| domain | count |
|---|---|
| admin | 217 |
| prestige\|egift\|sumit | 84 |
| other | 71 |
| provider | 32 |
| stations\|k9000 | 23 |
| booking | 14 |
| auth\|security | 1 |
| public/marketing | 1 |

Full list: `node scripts/audit/route-contract/scan.mjs --json | jq .serverOnly`.

## FALSE-POSITIVE list (considered and rejected, with reasons)

These are the things the scanner deliberately does **not** report. Each was a
real bogus finding at some point in this PR's history.

| rejected as | count | reason |
|---|---|---|
| `queryKey` with a sibling `queryFn` | 232 | the key is a cache key; the actual request is the `queryFn`'s own `fetch`, which is extracted separately |
| `queryKey` inside `invalidateQueries` / `setQueryData` / `refetchQueries` / … | 444 | cache operations, never HTTP |
| `app.get('*')` SPA fallback (`server/routes.ts:18341`, `server/index.ts:1997`) | 2 | explicitly `next()`s for `/api/` — it never answers an API call |
| `app.post('/api/finance/*')`, `app.patch('/api/finance/*')` | 2 | `…allFinanceGuards` middleware chains, not endpoints |
| `HEAD /api/health` | 1 | express answers HEAD with the GET handler |
| `apiRequest('GET', url, undefined)` | — | the literal `undefined` is not a body |
| `/api/expenses${qs}` → `/api/:p` | — | glued trailing interpolation is ambiguous; both readings are tried |
| `PATCH /api/sitter-suite/sitters/:id` | 1 | supplied as ground truth but demonstrably mounted (see recall section) |
| locally-built guards (`requireAdminPanelAccess`, `requireKYCPermission`) | 96 | real guards a fixed token list cannot know |

## Known limits — stated so nobody over-trusts this

- **RESPONSE_MISMATCH is not decidable** by this scanner. Comparing the client's
  `useQuery<T>` type parameter to the handler's `res.json({…})` shape needs the
  TypeScript type-checker, not regex. No RESPONSE_MISMATCH findings are claimed.
- **BODY_MISMATCH is shallow.** It catches a body on GET and dropped extra
  `apiRequest` arguments. It does **not** verify that a POST's body fields match
  what the handler destructures from `req.body`.
- **Route ordering is approximated by `(file, line)`.** The shadowing pass is
  exact when both handlers live in the same router module (all 20 do). Cross-module
  ordering — the order of two `app.use()` calls in `server/routes.ts` — is not modelled.
- **Native apps are out of scope.** Only `client/src` and `shared` are scanned, so
  a SERVER_ONLY route may well have an iOS/Android or cron caller.
- **Feature flags are not evaluated.** A route mounted behind `if (FLAG)` still
  counts as mounted.

## Reproducing

```bash
node scripts/audit/route-contract/scan.mjs           # grouped human report
node scripts/audit/route-contract/scan.mjs --json    # machine output
node scripts/audit/route-contract/scan.mjs --path /api/prestige-pass
```
