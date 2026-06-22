# K9000 Nayax Wash-Activation — Build Design (evidence-backed)

**Agent investigation 2026-06-23. The real Nayax remote-vend client EXISTS but is unwired. Mostly rewiring.**

## Root cause (one sentence)
Customer activation routes were built against an IMAGINARY generic machine HTTP API (`MACHINE_ACTIVATION_URL` + `MachineCommandService` POSTing to `http://{kioskIP}/api/command`, `MachineCommandService.ts:270`) — which the Nayax-MDB K9000 does NOT expose — while a complete, production-shaped **Nayax Spark/Lynx remote-vend client (`server/services/NayaxSparkService.ts`) already exists** but is wired only to admin/test surfaces, never to the wash path.

## The 4 confirmed failures (file:line)
1. `START_PUMP` posts to non-existent `/api/command` on the kiosk IP (`MachineCommandService.ts:270`); SSRF guard (`:274`) marks real RFC-1918 kiosk IPs `failed` anyway.
2. ACK endpoint exists (`k9000.ts:1140`) but **nothing calls it** (machine has no firmware to POST back) → after ~30s (10s×3) every wash hits compensation (`MachineCommandService.ts:420`).
3. Flow B (wallet) auto-reverses (`autoCompensateSession`, `K9000RedemptionService.ts:1086`); **Flow A (`terminal_card`) is skipped (`:1109`) and NO Nayax void is ever called** — the real card-refund gap, even though `voidTransaction()` exists (`NayaxSparkService.ts:515`).
4. `enterCleanupPhase`/`closeBaySession` have **0 call sites** (grep-proven); the one completion webhook (`/api/payments/nayax/usage-event`, `nayax-payments.ts:642`) only logs analytics → bays go `busy` and never return to `ready` → each side dies after ONE wash (BAY_NOT_READY guard `k9000.ts:394`).

## The unwired REAL integration — `NayaxSparkService.ts`
`initiateWashCycle:163`, `authorizePayment:366`, `executeRemoteVend:419` (starts wash), `settleTransaction:468`, `voidTransaction:515` (**Flow A refund**), `remoteActivateWash:941` (**side-addressable** start w/ ServiceCode+timeout), `remoteStopWash:1064`, `getMachineStatus:557` (Lynx telemetry: water temp/pressure, shampoo/conditioner level). Imported in k9000.ts:55 but used only for redeemQrCode/getMachineStatus — never to start a paid/wallet wash. Real callers today = admin/test (`nayax-payments.ts`, `qr-activation.ts:424`, `k9000Dashboard.ts`).

**Enabler already in schema:** `station_bays.nayaxTerminalId` (`schema.ts:1014`) + `nayaxQrReaderId` (`:1015`) per side, indexed + uq one-bay-per-side (`:1048-1051`). Given a side → exact terminal to remote-vend. This is the missing "which side fired → start that pump" link.

## Correct activation design (keep the command-ledger; change send + ACK source)
1. **Request vend:** on START_PUMP, `bay=findBay(stationId,side)` → `terminalId=bay.nayaxTerminalId` → `NayaxSparkService.remoteActivateWash({terminalId, washProgramId:map(washType), sessionTimeoutSec,...})`. (Flow A card: executeRemoteVend + settle/void; Flow B wallet: amount-0 promotional vend, already debited.)
2. **Nayax fires the correct side** (terminalId = per-bay reader). Spark synchronous SUCCESS/FAILED = fast ACK.
3. **Server-issued ACK on SUCCESS:** call `MachineCommandService.acknowledge(commandId)` server-side (no machine callback needed) — well under the 10s timeout → compensation never falsely trips. On FAILED/timeout: don't ACK → existing retry/compensation runs (Flow B reverses; **Flow A now calls `voidTransaction()`** — closes the card-refund gap).
4. **Wash runs** (bay busy). Optional telemetry poll (Phase 2).
5. **Completion releases bay (dual trigger, defense-in-depth):** (a) Nayax completion webhook → side→bay→currentSessionId → `enterCleanupPhase`→`finalizeCleanup`→ready; (b) server-side `sessionTimeoutSec` timer → enterCleanupPhase if no webhook; `registerCleanupRecovery` covers restarts. Guarantees release even if Nayax never reports.

## Fail-safety / scale
No false compensation (SUCCESS=ACK). Idempotency: stable commandId + Nayax ExternalTransactionId from sessionId/washId (retry can't double-vend) + nonce guard (Flow B) + usage-event idempotencyKey. Flow A card refund via voidTransaction on failure. Keep fail-CLOSED env guard (503 until creds live — Rule H, don't fake success). Scale: per-bay terminal addressing (no global collision; retire NAYAX_TERMINAL_ID_MAIN/SECONDARY); left/right independent; webhook best-effort, server timeout = source of truth; move 15s setInterval timeout-scanner to durable worker for multi-instance; telemetry via push/rate-limited sweep not inline poll; surface WASH_FAILED to admin_alerts.

## Codeable NOW vs CEO/Nayax ops
**Codeable now (in repo):** re-point MachineCommandService send → NayaxSparkService.remoteActivateWash/executeRemoteVend keyed by per-bay terminalId; server-issued ACK on SUCCESS; wire completion webhook + server timeout → enterCleanupPhase/finalizeCleanup; Flow A voidTransaction on failure + redirect autoCompensateSession terminal_card branch; map washType→ServiceCode; retire MACHINE_ACTIVATION_URL/`/api/command` + tests; WASH_FAILED→admin_alerts.
**Needs CEO/Nayax ops (hard blockers):** live `NAYAX_API_KEY` + confirmed Spark base URL; per-bay Nayax terminal/QR-reader IDs populated for Kfar Saba + **Nayax must report WHICH SIDE fired**; register PetWash completion webhook + `NAYAX_WEBHOOK_SECRET`; confirm remote-vend/device-start enabled on these MDB units + ServiceCode catalog; `NAYAX_ALLOWED_IPS`.

## Phased
- **Phase 1 (launch unblocker):** provision creds+terminal IDs (ops) → swap activation transport to NayaxSparkService (keep ledger) → server-issued ACK → bay release (webhook + timeout) → Flow A void refund → keep fail-closed guard.
- **Phase 2:** telemetry/live status (getMachineStatus → bays endpoint already renders waterTempC/shampooLevelPct).
- **Phase 3:** fault detection (Nayax codes → bay_faults+admin_alerts), durable timeout worker, retention/partitioning.

## Exact files
`server/routes/k9000.ts`, `server/services/MachineCommandService.ts`, `server/services/NayaxSparkService.ts`, `server/services/K9000RedemptionService.ts`, `server/routes/nayax-payments.ts`, `server/routes/nayax-webhooks.ts`, `server/routes/k9000Dashboard.ts`, `server/routes/qr-activation.ts`, `server/lib/k9000-env-guard.ts`, `server/lib/configHealth.ts`, `shared/schema.ts:1001-1051`, `server/index.ts:1322`.

See [[k9000-nayax-golive-state-2026-06-22]], [[k9000-hardware-reality-2026-06]], [[refund-rail-design-2026-06-23]] (Flow A void ties into the refund rail).
