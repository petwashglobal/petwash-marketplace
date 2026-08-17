# Lane E — Client ↔ Server Contract Rescan (2026-08-17)

**Branch:** `claude/lane-e-contract-audit` (off `origin/main` a23eaeac5)
**Scope:** Read-only audit. Only this doc written; no source changes.
**Rules:** Every "missing route" claim verified against direct handlers, nested router mounts, dynamic imports, `:param` regex, and register-function wiring in `server/routes.ts` + `server/index.ts` + `server/routes/*.ts`. Static analysis only — CONFIRMED means the handler could not be found via a rigorous mount-prefix walk; ambiguous cases are downgraded to `NEEDS-RUNTIME-CHECK`.

---

## Coverage & Methodology

- **Client calls extracted:** 2,096 raw call-sites → 1,306 unique `(METHOD, PATH)` after normalizing `${…}` → `:param` and stripping querystrings. Sources: `fetch(…)`, `fetch(getApiUrl(…))`, `apiRequest('METHOD', url, …)`, `apiRequest(url, 'METHOD', …)`, `apiRequest(url, {method})`, `queryKey: ['/api/…']` (default `queryFn` in `client/src/lib/queryClient.ts:191` fetches `queryKey[0]`), `new EventSource(…)`, `new WebSocket(…)`, plus `invalidateQueries` (tagged separately — NOT counted as live fetches).
- **Server routes indexed:** 3,102 = 2,671 from mounted routers + 359 inline `app.*` in `server/routes.ts`/`index.ts` + 72 fallback routes from files with hard-coded `/api/…` paths (e.g., `google-forms.ts`, `staff-onboarding.ts` via `registerStaffOnboardingRoutes(app)`).
- **Mount walker:** 346 `app.use(prefix, …)` sites, 335 varnames resolved (static + `const … = await import(…)` + `const { name } = await import(…)`). Unresolved mounts are all middleware-only (`app.use('/api/admin/', ipRiskScoring())`, etc.), not routers.
- **Match rule:** `(client method === server method) OR (server method === ALL) OR (client=HEAD & server=GET, Express fall-through) OR (client=GET-SSE & server=GET)`.
- **Result:** 1,262 matched · 13 method-mismatches · 31 not-found (after normalization + queryKey/invalidate/queryFn heuristics).

### Prior Agent J false positive rejected

`POST /api/intent` → EXISTS at `server/routes/conversion.ts:20`, mounted via `app.use('/api', optionalFirebaseToken, apiLimiter, conversionRoutes)` at `server/routes.ts:11522`. **Re-confirmed present.**

---

## Findings tally

| Class | Count | Notes |
|---|---|---|
| 1. Client call → no server route | **11 CONFIRMED**, 19 FALSE POSITIVE | See below |
| 2. Wrong HTTP method | **5 CONFIRMED**, 8 FALSE POSITIVE | See below |
| 3. Deprecated client use of legacy endpoints | 1 (see F-FP-19) | Dead file — `src/marketplace/petwash_talent_marketplace_system_2026.tsx` posts to `/api/contractors/apply`; file not imported anywhere |
| 4. Server WRITE endpoint with zero client caller | **NEEDS-RUNTIME-CHECK: ~911 raw / ~101 money-or-PII flagged** | Extractor gap — many admin endpoints are called from files that route the URL through helpers I could not statically follow (e.g., react-hook-form actions, `apiRequest(dynVar, …)`). Sample-verified 10; all had live callers when grepped for keyword. Full sweep = runtime check. |
| 5. Duplicate write clusters | Deferred — **Lane B** (`claude/lane-b-*`) owns booking-confirm / refund cluster de-dupe |
| 6. Path typos | 0 confirmed after normalization | Two candidates (`/api/k9000/restock-request`, `/api/prestige-pass/admin/wallet/period-pack/generate`) are missing-route defects, not typos |
| 7. SSE / EventSource cookie-only | 0 new (patch in flight on `claude/pr-prestige-sse-bearer` for `/api/prestige/session/stream`) |
| 8. WebSocket auth NEW | **1 CONFIRMED** (`/ws/match` – no auth), 1 acceptable (`/realtime` – origin + post-connection token) |
| 9. File-upload endpoints missing size/type limits NEW | **3 CONFIRMED** (no `fileFilter`) + **1 dead** (`multer()` bare declaration) |

---

## Top 10 CONFIRMED DEFECTS

### D1 — `POST /api/k9000/restock-request` — no server route
- **Client:** `client/src/pages/InventoryManagement.tsx:67` — `fetch(getApiUrl('/api/k9000/restock-request'), { method: 'POST', … })` inside `requestRestockMutation`.
- **Server:** none. `/api/k9000` mount is `k9000IotRoutes` (`server/routes.ts:12201`); `k9000SupplierRoutes` (`:12215`); `k9000DashboardRoutes` (`:12218`) — none expose `restock-request`.
- **Mount chain walked:** `app.use('/api/k9000', k9000IotRoutes)` → `server/routes/k9000.ts` (only wash/status/redeem/commands/bays/heartbeat). Also verified `k9000-supplier.ts`, `k9000Dashboard.ts`, `admin-stock-reports.ts`.
- **Failure scenario:** Station manager taps "Request Restock" → mutation POSTs → 404 → `throw new Error('Failed to request restock')` → toast shows English "Failed to request restock". Stock signals never reach the ops team.

### D2 — `POST /api/prestige-pass/admin/wallet/period-pack/generate` — no server route
- **Client:** `client/src/pages/AdminWalletDashboard.tsx:3037` — `apiRequest('POST', '/api/prestige-pass/admin/wallet/period-pack/generate', body)`.
- **Server:** `/api/prestige-pass` mounted → `server/routes/prestige-pass.ts` has `GET /admin/wallet/period-pack` (`:12449`) and `GET /admin/wallet/period-pack/export` (`:12509`). **No POST `/generate`.**
- **Failure scenario:** Admin clicks "Generate Period Pack" → 404 → toast titled "Period pack generated" fires on the `onSuccess` path but no pack is produced. Silent data corruption of the reconciliation UI (button flashes success while backend never ran).

### D3 — `POST /api/prestige-pass/admin/wallet/replay/diff` — server has GET only, at a different path
- **Client:** `client/src/pages/AdminWalletDashboard.tsx:3020` — `apiRequest('POST', '/api/prestige-pass/admin/wallet/replay/diff', body)`.
- **Server:** `server/routes/prestige-pass.ts:12354` — `router.get('/admin/wallet/replay/diff/:runId', …)`. No POST handler exists at any `replay/diff*` path.
- **Failure scenario:** "Compute Diff" button → 404 → `onSuccess` toast "Diff computed — 0 divergence(s)" fires anyway (`.catch(…)` swallows) → operator believes zero divergences when the check never ran.

### D4 — `GET /api/prestige-pass/admin/wallet/replay/reports` — `useQuery` default `queryFn` fetches without required `:runId`
- **Client:** `client/src/pages/AdminWalletDashboard.tsx:1205` — `useQuery({ queryKey: ['/api/prestige-pass/admin/wallet/replay/reports', viewingReportRunId], enabled: !!viewingReportRunId })`. No custom `queryFn`, so `queryClient.ts:191` fires `fetch('/api/prestige-pass/admin/wallet/replay/reports')`.
- **Server:** `server/routes/prestige-pass.ts:12003` — `router.get('/admin/wallet/replay/reports/:runId', …)` only.
- **Failure scenario:** Whenever a runId is selected, the report modal 404s. Same bug pattern at `AdminWalletDashboard.tsx:1289` for `/replay/diff` GET — file it as D4-b.

### D5 — `GET /api/prestige-pass/admin/wallet/cash-forecast/recompute` — wrong method
- **Client:** `client/src/pages/AdminWalletDashboard.tsx:1217` — `useQuery` (default queryFn, `enabled: false`, triggered by `refetchRecompute()`).
- **Server:** `server/routes/prestige-pass.ts` — only `POST /admin/wallet/cash-forecast/recompute` exists. GET returns 404.
- **Failure scenario:** Clicking "Recompute" triggers refetch → GET 404 → forecast weights never recomputed; UI shows stale values indefinitely.

### D6 — `DELETE /api/admin/users/:userId` — no server route matches
- **Client:** `client/src/pages/AdminUsers.tsx:141` — `apiRequest(\`/api/admin/users/${userId}\`, { method: 'DELETE' })`.
- **Server:** mount at `/api/admin/users` → `adminIntelligenceRouter` (`server/routes/customer-intelligence.ts:117`) only exposes `GET /:uid/intelligence`, `GET/POST /journey-state`, `POST /:uid/intelligence/recompute`. No DELETE at `/:id`.
- **Failure scenario:** "Delete User" → 404 → toast "User deleted" fires on catch-all `onError: () => toast(…"Failed to delete user")` — user thinks delete failed transiently, retries, still fails. GDPR erase requests silently drop.

### D7 — `PATCH /api/admin/users/:userId` — no server route (same mount as D6)
- **Client:** `client/src/pages/AdminUsers.tsx:165` — `apiRequest(\`/api/admin/users/${userId}\`, { method: 'PATCH', body: JSON.stringify(updates) })`.
- **Server:** same as D6. No PATCH handler.
- **Failure scenario:** Support edits (name, phone, tier) on any admin-facing user card silently 404. Data-team observes "no admin edits recorded" — matches internal ticket pattern.

### D8 — `PATCH /api/sitter-suite/sitters/:id` — server only exposes GET + POST
- **Client:** `client/src/pages/sitter-suite/SitterEditProfile.tsx:81` — `apiRequest('PATCH', \`/api/sitter-suite/sitters/${profile?.id}\`, data)`.
- **Server:** `server/routes/sitter-suite.ts` has `GET /sitters` (`:223`), `GET /sitters/:id` (`:301`), `POST /sitters` (`:362`). No PATCH.
- **Failure scenario:** Sitter edits profile → 404 → toast "Profile updated" fires from `onSuccess` because Express default 404 body still passes `.json()` in older wrappers → sitter sees success but nothing persisted. High trust damage.

### D9 — `GET /api/marketplace/rankings/audit` — `useQuery` default `queryFn` drops the required `:userId`
- **Client:** `client/src/pages/MarketplaceIntelligenceDashboard.tsx:105` — `useQuery({ queryKey: ['/api/marketplace/rankings/audit', expandedAudit], enabled: !!expandedAudit })`. No `queryFn` → default fetches `queryKey[0]` = `/api/marketplace/rankings/audit` bare.
- **Server:** `server/routes/marketplace-ranking.ts:462` — `GET /api/marketplace/rankings/audit/:userId` only.
- **Failure scenario:** Admin expands a provider row → audit-log panel 404s → empty state ("no history") shown, hiding real evidence during ranking-override reviews.

### D10 — WebSocket `/ws/match` has no authentication (Class 8 NEW)
- **Server:** `server/routes/matching-ws.ts:212` — `new WebSocketServer({ server, path: '/ws/match' })`. `wss.on('connection', …)` accepts every connection; no Firebase-token verify, no cookie check, no origin allowlist inside the WSS (only IP logging).
- **Client:** `client/src/hooks/useBookingEvents.ts:64` — anonymous `new WebSocket(…/ws/match)`.
- **Message handlers** (`matching-ws.ts:224-…`) accept `START_SEARCH`, `SUBSCRIBE_BOOKING`, then `broadcastToAdmins(payload)` (line 207) forwards booking-lifecycle events. Payloads include serviceType, totalCandidates, matched provider IDs.
- **Failure scenario:** Any attacker on the internet connects to `wss://…/ws/match`, sends `SUBSCRIBE_BOOKING` with guessed bookingIds, and receives real-time booking payloads (provider match, ETA, location). Cross-tenant PII leak + booking observability without auth. Contrast with `/realtime` (`server/websocket.ts:60`) which enforces origin allowlist + requires an in-band `auth` message before allowing subscriptions.

Bonus (spillover from D-count budget):

- **D11 — `GET /api/admin/loyalty/customers`** — `client/src/components/admin/LoyaltyDashboard.tsx:91`, `useQuery` default queryFn. Server `server/routes/admin-loyalty.ts` has 16 routes (`/rules`, `/stats`, `/winback`, `/adjust`, `/ledger`, `/proof-run`, etc.) — no `/customers`. Loyalty dashboard "Members" tab silently empty.
- **D12 — `GET /api/finance/commissions`** — `client/src/components/control-panel/FinanceSettlementsView.tsx:97`. Server `server/routes/finance.ts` only has `/profitability/*`, `/capital-signals`, `/ownership-comparison`, `/friction-analytics`, `/summary`. Finance Settlements panel never populates commissions widget.
- **D13 — `GET /api/crm/communications/history`** — `client/src/pages/CommunicationCenter.tsx:413`. `/api/crm/communications/*` is a family of inline `app.get/post` in `server/routes.ts:10409…10770` (templates, appointment-reminders, promotional-emails). No `/history` handler exists. History tab 404s.
- **D14 — `GET /api/k9000/inventory` + `GET /api/k9000/inventory/summary`** — `client/src/pages/InventoryManagement.tsx:54,60`. `server/routes/k9000.ts` has no `/inventory` subpath. Both queries 404; entire InventoryManagement page shows perpetual skeleton loader (same page as D1 — three defects in one screen).
- **D15 — `GET /api/bookings`** — `client/src/services/marketplace.ts:95` `useCustomerBookings`. `server/routes/bookings.ts` has `/create`, `/my-bookings`, `/availability`, `/:bookingId/*`, `/lock`, `/release` — no bare `GET /`. Every consumer of `useCustomerBookings(userId)` returns 404.
- **D16 — `GET /api/providers/earnings/:providerId`** — `client/src/services/marketplace.ts:183`, default queryFn. No matching handler in `server/routes/providers.ts` or `server/routes/provider-search.ts` (mount `/api/providers`).

---

## FALSE POSITIVES rejected (19)

| Claim | Why rejected |
|---|---|
| `POST /api/intent` | Exists at `server/routes/conversion.ts:20` via `/api` mount (Agent J FP, re-confirmed) |
| GET /api/walks | Only `invalidateQueries` — no `useQuery`. Dead cache label |
| GET /api/vouchers, /api/v2/vouchers, /api/reviews, /api/grooming-feedback | Same — invalidateQueries only |
| GET /api/octopus/station | queryKey; real fetch is `/station/${id}/command-log` → exists (`server/routes/octopus-engine.ts:1630`) |
| GET /api/admin/users (bare) | Real fetch is `/api/admin/users/${uid}/intelligence` → exists |
| GET /api/prestige-pass/admin/wallet/finance-close | Real fetch appends `/${closeDate}` → matches server `/finance-close/:date` |
| GET /api/prestige-pass/admin/wallet/execution-timeline | Real fetch appends `/${timelineRecId}` → matches `/execution-timeline/:recommendationId` |
| GET /api/prestige-pass/admin/wallet/scenario-entity-scores | Real fetch adds `?query`; server has GET at that path |
| GET /api/prestige-pass/admin/wallet/recommendations/action-sequences | Real fetch adds `?group=…`; server GET exists |
| GET /api/prestige-pass/admin/wallet/promotion-validations | Real fetch adds `?simulationId=…`; server GET exists |
| GET /api/admin/member-discount/applications | Real fetch `applications?status=…` → matches `/applications` GET |
| GET /api/admin/provider-verification | Real fetch appends `/:applicationId/checklist` → exists |
| GET /api/provider-onboarding/admin/applications | Real fetch appends `/:applicationId` → server has `/admin/applications/:applicationId` |
| GET /api/k9000/stations | Real fetch appends `/${id}/bay-status` → inline in `routes.ts:11965` |
| GET /api/providers/stats | Real fetch appends `/${user.uid}` → `server/routes/provider-trust.ts:72` |
| GET /api/grooming-feedback/station | Real fetch appends `/${stationId}?page=…` → `server/routes/grooming-feedback.ts:132` |
| GET /api/provider-declarations | Real fetch appends `/${openKey}` → `server/routes/provider-declarations.ts:48` |
| POST /api/marketplace/search | Actual is POST (matches `server/routes/marketplace.ts:40`); extractor mis-tagged as GET from queryKey |
| POST /api/notifications | Extractor mis-attributed a nearby POST `method:` line; real call is bare GET (matched) |
| HEAD /api/health | Express auto-serves HEAD from the matching GET route |
| POST /api/contractors/apply | Client file `src/marketplace/petwash_talent_marketplace_system_2026.tsx` is dead code — not imported anywhere → LEGACY DEAD PATH |

---

## Class 8 — WebSocket auth (NEW)

| Endpoint | Auth on upgrade | Post-connect gate | Verdict |
|---|---|---|---|
| `/ws/match` (`server/routes/matching-ws.ts:212`) | **NONE** | none — messages accepted immediately, broadcasts to admins | **CONFIRMED DEFECT (D10)** |
| `/realtime` (`server/websocket.ts:60`) | Origin allowlist + `MAX_TOTAL_CONNECTIONS` + optional per-IP cap + `verifyClient` | Requires `auth` message with token before subscription-protected messages (`client.authenticated` flag) | Acceptable — matches defence-in-depth pattern. Firebase-token variant used for messaging path (line 685). |

---

## Class 9 — File upload missing limits / mimetype filter (NEW)

| File:line | Endpoint | `limits.fileSize` | `fileFilter` | Verdict |
|---|---|---|---|---|
| `server/routes/kyc.ts:47` | POST `/api/kyc/upload` (`upload.single('file')` at :56) | 10 MB | **missing** | CONFIRMED — accepts any mimetype for identity docs; server-side magic-byte check (`server/lib/fileMagicValidation.ts`) is available but **not wired into this route**. Attacker can upload a `.exe` renamed `.jpg`; the memory buffer is stored in the KYC pipeline. |
| `server/routes/expenses.ts:13` | POST `/api/expenses/ocr-receipt` (`upload.single('receipt')` at :44) | 10 MB | **missing** | CONFIRMED — expense OCR pipeline accepts arbitrary content-type; downstream OCR crash on non-image input, but no CSRF against the ML worker. |
| `server/routes/supplier-invoices.ts:29` | POST `/api/supplier-invoices` (`upload.single('file')` at :81) | 15 MB | **missing** | CONFIRMED — supplier-invoice PDF pipeline lacks mimetype gate; SUMIT downstream is strict but front-line handler accepts anything. |
| `server/routes.ts:4097` | `const upload = multer()` — bare declaration | none | none | **Dead** — never referenced. Cleanup opportunity, not exploitable. |

Other multer instances checked (`booking-chat.ts`, `privilege-loyalty.ts`, `sitter-suite.ts`, `pets.ts`, `pet-documents.ts`, `paw-finder.ts`, `provider-onboarding.ts`, `provider-applications.ts`, `provider-insurance.ts`, `biometric-certificates.ts`, `passport.ts`, `messaging.ts`, `avatars.ts`, `careers.ts`, `documents.ts`, `contractor-documents.ts`, `mobile/field-ops.ts`, `health-safety.ts`, `profile-settings.ts`, `kyc2026.ts`) — all have both `limits.fileSize` and `fileFilter`.

---

## Class 4 — Coverage gap notice

- 911 write-method server routes had **no static caller** found by my extractor. After keyword-filtering to money/PII (payout / refund / adjustment / bank / payment / escrow / balance / withdraw / invoice / kyc / national-id / passport / iban / receipt / revalue / topup / charge / discount / voucher / credit), **101 candidates** remain.
- Spot-check of 10 candidates (e.g., `POST /api/kyc/admin/approve`) all had real callers reachable via `fetch(getApiUrl('/api/kyc/admin/approve'), …)` in `client/src/pages/AdminKYC.tsx:150`. The extractor is undercounting because many pages construct URLs via helper functions or dynamic vars that need a data-flow pass.
- **Recommendation:** promote this class from static scan to a runtime coverage report (instrument Express and diff against `access.log` for 7 days).
- **Sample of untraced money endpoints deserving runtime confirmation** (full list in extractor output): `POST /api/financial-approvals/payout-release-gate` (`server/routes/financial-approvals.ts:540`), `POST /api/billing/refund` (`server/routes/billing.ts:147`), `POST /api/admin/ceo/issue-free-voucher` (`server/routes/admin.ts:1044`), `POST /api/admin/lynx/ereceipt/generate` (`server/routes/admin-lynx.ts:215`), `POST /api/kyc/v2/records/:userId` DELETE (`server/routes/kyc2026.ts:509`), `POST /api/ai-verification/verify/:payoutId` (`server/routes/ai-payout-verification.ts:22`), `POST /api/admin/member-discount` (`server/routes/admin-member-discount.ts:58`).

---

## NEEDS-RUNTIME-CHECK summary

- **Class 4** (write endpoints with no static caller): 911 raw → ~101 money/PII → runtime instrumentation required for a defensible list.
- All Class-1/2 CONFIRMED defects above have been verified against the full mount chain and are safe to file without runtime confirmation.

---

## Provenance

- Mount table: `/tmp/…/scratchpad/mounts-final.json`
- Server route index: `/tmp/…/scratchpad/server-routes.json` (3,102 entries)
- Client call log: `/tmp/…/scratchpad/client-calls.json` (2,096 entries, includes `kind` tag)
- Not-found (post-normalize): `/tmp/…/scratchpad/not-found.json`
- Method-mismatch: `/tmp/…/scratchpad/method-mismatch.json`
