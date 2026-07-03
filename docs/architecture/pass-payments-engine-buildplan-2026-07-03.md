# PetWash Pass & Payments Engine — Council-Synthesized Build Plan

**Date:** 2026-07-03 · **Method:** 7-agent council (6 layer reconciliations + synthesis) grounding the CEO's "Pass & Payments Architecture" doc against the real codebase. Every item cites file:line.

> **Headline:** the doc proposes tables/systems that **already exist**. This is evolve + wire + sequence, not build-from-scratch. Pass engine ✅, both wallets ✅, Nayax terminal+pass flows ✅, settlement ledger ~85% ✅, TRUST spine ~70% ✅, Foundation infra shipped tonight ✅.

---

## 1. REUSE MAP — DO NOT REBUILD

**Pass Engine (already the engine)**
- `petwash_pass_accounts` = the "passes" master table — `shared/schema.ts:13535` → **EXTEND** (add typed-variant + lifecycle cols), don't build fresh.
- `petwash_pass_transactions` = "pass_events" immutable ledger (balance before/after) — `schema.ts:13581`.
- Server-validated redemption + nonce burn + machine/bay binding — `pass-redeem.ts:188`, `prestige-pass.ts:720`. Public serial `PW-4587-2043` — `schema.ts:13537`.
- Keep separate, reference-link only: `egift_events`, `booking_handover_events`, `loyalty_ledger`.

**Wallet (plumbing all built)**
- Apple updatable pass (webServiceURL, authToken) — `AppleWalletService.ts:145`; device register/serve/log — `pass-universal.ts:433-554`; reg table `schema.ts:13607`.
- Google class/object + JWT save link + rotatingBarcode + PATCH/pushUpdate + expiry notifs — `GoogleWalletService.ts:116-221`.

**Nayax/K9000 (both terminal-first AND pass-first exist)**
- Cortina PreAuth authorise/settle/void/refund — `nayax-cortina.ts:250`. Pass-first `/redeem-wash` — `k9000.ts:911`. Idempotency + nonces + reservations — `MachineCommandService.ts:153`, migrations `0057/0076`. Bay TTL sweep (1-min cron) — `backgroundJobs.ts:111`. Per-machine HMAC — `k9000MachineSecrets.ts`, migration `0086`.

**Settlement (~85% built)**
- Provider payout ledgers (gross/fee/net/VAT) — `schema-payments.ts:129`, `payoutLedger.ts:55`. Fail-closed gate chain (completion+refund-window+tax+dispute+approval) — `payoutGate.ts:104`. Escrow + dispute-freeze — `EscrowStateMachine.ts:32`.

**TRUST (~70% built, wired)**
- Case type + human IDs + evidence + resolve — `incident-engine.ts:29`, `caseIdGenerator.ts`, `incidentService.ts`. Address-match→case — `addressMatch.ts:43`. Off-platform chat→case — `chatRiskScanner.ts`. Admin case list — `admin-support-incident.ts:218`.

**Foundation + Distribution (shipped tonight)**
- Prod schema snapshot + dump + audit — `schema-snapshot.yml`, `docs/recovery/2026-07-03`. Legacy-baseline walker skip — `apply-pending-migrations.ts:161`. Share primitive — `client/src/lib/share.ts` `shareOrCopy()`. Multi-channel dispatcher — `notificationDispatcher.ts:21`.

---

## 2. PHASED SEQUENCE (hard dependencies)

`P0 Foundation (schema baseline + CI)` → `P1 Pass Engine core` → `P2 Wallet + Distribution` + `P3 Terminal reconciliation` → `P4 Provider settlement` → `P5 TRUST (cross-cuts)` → `P6 KPIs`.

**Conflicts resolved:**
- New unified `passes` table → **REJECTED**; extend `petwash_pass_accounts`.
- Live signed-token model stays for QR; add stored **hash only for long-lived bearer links** (egift/gift).
- "Bay-release broken" → **false**; two release paths wired. Orphan `enterCleanupPhase` has no caller because K9000 emits no finish-signal — quarantine, don't wire.
- "Retire poison 0010/0018" → already neutralized by the drift-skip; just verify 0089 baseline covers them.
- Two settlement ledgers → declare `pw_provider_payouts` **canonical** before building reserve/policy.

---

## 3. ORDERED PR BACKLOG (37, one-purpose each)

**P0 Foundation:** 1) `[buildable-now]` CI fresh-DB migration test · 2) `[protected]` model 24 raw-SQL tables · 3) `[protected]` 0089 baseline + `MIGRATION_BASELINE=89` (needs 2) · 4) `[protected]` fix host_stay_details.id uuid drift · 5) `[protected, ops]` CI stops mutating prod → Neon schema-only branch.

**P1 Pass Engine:** 6) `[protected]` variant+lifecycle enums · 7) `[protected]` opaque public_pass_id + hashed bearer · 8) `[buildable-now]` read-only web viewer (safe-preview vs redeemable) · 9) `[protected]` ledger source_type → typed enum · 10) `[buildable-now]` reference-link egift/handover/loyalty.

**P2 Wallet + Distribution:** 11) `[buildable-now, ops WhatsApp]` whatsapp+secure-link channels · 12) `[buildable-now]` deliver pass via shareOrCopy+dispatcher · 13) `[protected, ops APNs]` wire APNs push to Postgres regs (**the one true wallet hole** — appleWallet.ts:526 queries Firestore, never refreshes) · 14) `[protected]` refresh on balance/tier change · 15) `[protected]` per-pass Google TOTP · 16) `[buildable-now]` Generic Private Pass for sensitive fields · 17) `[buildable-now]` delete dead Firestore stubs.

**P3 Terminal:** 18) `[buildable-now]` quarantine dead enterCleanupPhase · 19) `[protected]` one reservation seam · 20) `[protected]` unify idempotency · 21) `[protected, hardware]` gate executeRemoteVend UNPROVEN · 22) `[buildable-now]` reconciliation-break admin surface.

**P4 Settlement:** 23) `[protected]` **GATE-ZERO: fail-closed V2 earning creation** (booking-requests.ts:2464 — booking can complete with **no escrow row → provider never paid**) · 24) `[protected]` declare pw_provider_payouts canonical · 25) `[protected]` add refund_reserve_cents · 26) `[protected]` resolveDispute() re-arms auto-release · 27) `[protected]` signed clawback rows · 28) `[protected]` configurable Fast/Protected/Manual policy.

**P5 TRUST:** 29) `[buildable-now]` centralize fraud-signal→openIncident bridge · 30) `[buildable-now]` TRUST case on token replay/burn-fail · 31) `[protected, ops Redis]` brute-force counter · 32) `[protected, ops]` terminal-mismatch check · 33) `[protected]` settlement-mismatch from recon job · 34) `[buildable-now]` geo-anomaly rule (the one true BUILD-NEW detector) · 35) `[protected]` evidence-bundle cols on incident_reports · 36) `[buildable-now]` admin evidence bundle view.

**P6:** 37) `[buildable-now]` pass/wallet/settlement/trust KPIs off typed events.

---

## 4. OPS / CEO ACTIONS (gate progress, not code)

- **CEO approvals:** every `[protected]` PR (schema, wallet/finance, K9000 runtime) — batch per one-big-merge rule.
- **Certs/creds:** `APPLE_APNS_KEY`+key-id+team-id (blocks Apple push #13) · Google Wallet issuer ID + service account live · Meta WhatsApp Business API creds (blocks live WhatsApp send — code lands dark).
- **DB/infra:** Neon prod-like schema-only branch + `DATABASE_URL_DIRECT` (non-pooler) · verify 0057/0076/0086 actually in prod · apply P0/P1/P4/P5 schema via `db:push`/Neon console (CI walker won't carry columns) · Redis for multi-instance brute-force.
- **Hardware:** live Nayax sandbox + one physical K9000 bay (blocks remote-vend verify) · per-machine HMAC secrets loaded · station↔terminal-mid map.
- **Legal/ops:** Israeli bank-transfer payout rail still a stub (`ProviderPayoutService.ts:436`); insurance-clearance gate — unchanged, remain money-out blockers.

---

## 5. TOP 5 TO DO FIRST (buildable-now, zero certs/hardware/migrations)

1. **CI fresh-DB migration test** — the current CI step mutates **production directly** (`petwash-ci.yml:401,424`); biggest live risk; unblocks safe schema work. *(Note: run strict only on the PR's NEW migrations over a prod-like base, not fresh-from-zero, to avoid drift false-positives.)*
2. **Fix V2 silent earning-skip** (`booking-requests.ts:2464`) — a booking can complete with **no escrow row → provider is never paid**. Tiny change, highest money-integrity leverage. `[protected]` — needs CEO sign-off.
3. **Fraud-signal→openIncident bridge** — only 2 of 7 signals open cases today; pure wiring on existing schema, no migration.
4. **TRUST case on token replay + burn-fail** — replay is blocked at HTTP but invisible to Trust; small, buildable-now.
5. **Quarantine dead `enterCleanupPhase`** — removes a false-signal implying a K9000 finish-signal that doesn't exist; cheap; clears the deck for Phase 3.
