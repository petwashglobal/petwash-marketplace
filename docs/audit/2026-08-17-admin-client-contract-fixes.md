# Admin Client↔Server Contract Fixes — 2026-08-17

Batched follow-up to LANE E's contract rescan (`docs/audit/2026-08-17-lane-e-contract-rescan.md` on `claude/lane-e-contract-audit`). LANE E surfaced 9 candidate defects on admin surfaces. This PR ships fixes for the 6 that were verified as real, rejects 2 that were false positives, and files 1 as NEEDS-DESIGN.

## Verification methodology

For each candidate defect, walked the full mount chain server-side and diffed against every client caller (fetch, apiRequest, useQuery default-queryFn). LANE E's scanner did not resolve mount prefixes accurately; that produced at least one false positive last round (`/api/intent` — actually mounted at conversion.ts:20). This audit adds mount-chain evidence for every claim.

## Ship list

### D2 — false-success "Period pack generated" toast — FIXED
- Client (`client/src/pages/AdminWalletDashboard.tsx:3044`) POSTs `/api/prestige-pass/admin/wallet/period-pack/generate`.
- Server (`server/routes/prestige-pass.ts:12449`) exposes only `GET /admin/wallet/period-pack` (fetches, generates on demand).
- Fix: mutationFn now checks `res.ok`, throws with a specific message on 404, and the onError toast surfaces the real state instead of a lying "generated" toast.

### D3 — false-success "Diff computed — 0 divergence(s)" toast — FIXED
- Client (`client/src/pages/AdminWalletDashboard.tsx:3027`) POSTs `/api/prestige-pass/admin/wallet/replay/diff` with `{ runAId, runBId }`.
- Server (`server/routes/prestige-pass.ts:12354`) has only `GET /admin/wallet/replay/diff/:runId` — per-runId GET, no multi-run POST.
- Fix: same shape as D2 — read the response, throw on 404, surface the real state via toast.

### D4 — replay-reports queryKey drops :runId → 404 → modal empty — FIXED
- Client (`client/src/pages/AdminWalletDashboard.tsx:1204`) uses default queryFn on `['/api/prestige-pass/admin/wallet/replay/reports', viewingReportRunId]`; default queryFn only reads `queryKey[0]`, so it hits `/replay/reports` without `:runId`.
- Server (`server/routes/prestige-pass.ts:12003`) is `GET /admin/wallet/replay/reports/:runId`.
- Fix: explicit queryFn appends `${viewingReportRunId}` and throws on non-2xx.

### D6 — silent GDPR-erase false success — FIXED (client contract half)
- Client (`client/src/pages/AdminUsers.tsx:139`) DELETE `/api/admin/users/:userId` — the mutationFn returned the Response object without checking `res.ok`. react-query treats a resolved promise as success, so the "User deleted — User has been successfully removed" toast fired even when the server returned 404.
- Server: NO handler for DELETE `/api/admin/users/:userId` (verified — grep `router.\(patch|delete\|put\)` across `server/routes/admin*.ts` returns zero user routes).
- Fix: mutationFn now inspects `res.ok`, throws a specific message on 404, and the (already-wired) onError handler shows the real failure. Prevents an admin trusting an untrue erase confirmation.
- **NEEDS-DESIGN**: canonical destructive endpoint. Firebase Auth delete + Postgres cascade + audit trail + PII purge + refund window check are all required — that's a design PR (see LANE A's `PR-AUTH-SECURITY-9-NEEDS-CEO-DESIGN.md` for the equivalent pattern on email/mobile change).

### D7 — silent support-edit false success — FIXED (client contract half)
- Client (`client/src/pages/AdminUsers.tsx:163`) PATCH `/api/admin/users/:userId` — same pattern as D6. Toast said "User updated — User has been successfully updated" for an update that never touched the DB.
- Server: NO handler. Same missing route family as D6.
- Fix: throw-on-!ok same shape as D6. NEEDS-DESIGN for the canonical PATCH.

### D9 — rankings-audit queryKey drops :userId → panel silently empty — FIXED
- Client (`client/src/pages/MarketplaceIntelligenceDashboard.tsx:104`) default queryFn on `['/api/marketplace/rankings/audit', expandedAudit]`.
- Server (`server/routes/marketplace-ranking.ts:462`) is `GET /api/marketplace/rankings/audit/:userId`.
- Fix: explicit queryFn appends the userId.

### D5 — dead code cleanup — FIXED
- Client (`client/src/pages/AdminWalletDashboard.tsx:1216`) had a `useQuery({ queryKey: [...recompute...], enabled: false })` — the returned handle (`recomputeResult`, `recomputeLoading`, `refetchRecompute`) was never used anywhere in the file, and `enabled: false` meant it never fired anyway.
- The real MUTATION `recomputeForecast` at line 2998 correctly POSTs and matches the server route at `prestige-pass.ts:12091`.
- LANE E's scanner flagged this as "wrong HTTP method" because it saw the query URL matched a POST-only server route. **The scanner was correct in principle but the runtime impact was zero — dead code.**
- Fix: delete the dead `useQuery`. Note left in-line explaining the rationale.

## Rejected (LANE E false positives)

### D5 — cash-forecast/recompute "wrong method"
Was really dead code (see ship list above). The live mutation at line 2998 uses POST correctly.

### D8 — sitter-suite/sitters/:id PATCH "404"
- Client (`client/src/pages/sitter-suite/SitterEditProfile.tsx:81`) PATCH `/api/sitter-suite/sitters/${profile?.id}`.
- Server (`server/routes/sitter-suite.ts:424`) `router.patch('/sitters/:id', requireAuth, ...)` — EXISTS.
- **REJECTED** — LANE E was wrong. Both sides match.

## Deferred / NEEDS-DESIGN

### D1 — k9000/restock-request
- Client (`client/src/pages/InventoryManagement.tsx:67`) POSTs `/api/k9000/restock-request`.
- Server: no such endpoint. Inventory router (`server/routes/inventory.ts`) has admin-only POST `/supplies` and POST `/station/:stationId/supplies` and POST `/station-supplies/:id/refill` — all record physical refill events, none represent "request more of this item" (a workflow trigger for the ops team).
- Client already throws on `!res.ok` (line 73) and shows a destructive toast — this is HONEST-FAILURE, not false-success. No code fix required today.
- **NEEDS-DESIGN**: is restock-request a Nayax Lynx integration (they own the physical restock queue) or an internal ticket flow that emails ops? See the `nayax-lynx-inventory` skill for the vendor contract before designing this endpoint.

## Money invariance ledger

None of these fixes touched: refund amount, VAT, commission, wallet math, provider earnings, payout timing, Prestige pricing, eGift value, receipt mapping. All changes are:
- Read-only fetch URL corrections (D4, D9)
- Error-handling additions (D2, D3, D6, D7 all add `throw` on `!res.ok` — a change from silent success to loud failure, never a change to what the successful path produces)
- Dead-code removal (D5)

## PR branch

`claude/pr-admin-client-contracts` — 3 files, +98/-12
