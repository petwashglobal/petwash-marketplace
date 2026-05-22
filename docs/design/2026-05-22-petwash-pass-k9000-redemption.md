# SDD: PetWash Pass / K9000 Redemption

| | |
|---|---|
| **Status** | Draft (design only — no code) |
| **Date** | 2026-05-22 |
| **Author** | SDD Writer Agent (PetWash) |
| **Feature flag** | `ff.redemption.unified.enabled` (default **OFF**) |
| **Method** | `.github/skills/sdd-writer-iterative/SKILL.md` |

---

## 1. Summary

Customers must be able to redeem a wash at a **K9000 machine** using their **mobile PetWash Pass** (a signed, rotating QR/token), and also redeem **eGift balance, prepaid wash packages, and loyalty/Prestige credits**, with **Apple Wallet / Google Wallet** support. The **backend is the single source of truth**; the K9000/Nayax machine only ever receives an *authorization to start*. No static QR, no screenshot reuse, no double-spend, no client-side balance decisions.

**Key finding from repository review:** this capability is **already implemented — three separate times** — across uncoordinated modules with conflicting schemas, plus a legacy voucher path. The fraud-safe primitives the vision asks for (rotating HMAC tokens, anti-replay JTI, idempotency, double-entry hash-chained ledger, holds, immutable audit, machine-authorize-with-compensation, Apple/Google Wallet) **all exist today**. Therefore this design is a **consolidation**, not a green-field build. The main work is to converge on one token verifier, one balance-truth ledger, one audit ledger, and one machine-authorization path — and to fix two real defects found during review.

## 2. Goals / Non-goals

**Goals**
- One fraud-safe redemption path for: PetWash Pass (mobile QR), eGift, prepaid wash packages, loyalty/Prestige credits.
- Backend is source of truth; machine receives an authorization only.
- Rotating, single-use, short-TTL tokens; no static redeemable QR.
- No double-spend, no replay/screenshot reuse, no client-side balance trust.
- Every redemption recorded immutably in the append-only audit ledger.
- Apple/Google Wallet remain supported.

**Non-goals (explicitly out of scope for this SDD / first PRs)**
- Building any new ledger or token scheme (reuse existing).
- Migrating historical balances between the three legacy stores (separate, approval-gated data migration).
- New machine firmware / Nayax contract changes.
- Maya, booking rebuild, marketplace discovery, signup — unrelated.

## 3. Repository context (what already exists)

Three parallel "redeem at K9000" implementations plus a legacy voucher path:

| # | Flow | Entry route | Token | Balance / ledger | Anti-replay |
|---|------|------------|-------|------------------|-------------|
| 1 | K9000 wallet redemption | `server/routes/k9000.ts:804` `POST /api/k9000/redeem-wash` | `server/lib/signedRedeemToken.ts` (HMAC, 45s) | `walletAccounts` columns + `creditTransactions` + `k9000WashEvents` via `K9000RedemptionService` | in-memory nonce `Map` + Redis SETNX |
| 2 | PetWash Pass account | `server/routes/pass-redeem.ts:173` `POST /api/pass/redeem` | `server/lib/passTokens.ts` `buildQrRedeemToken` (HMAC, 45s; in Apple/Google barcodes) | `petwashPassAccounts.availableCreditIls` + `petwashPassTransactions` | Postgres `petwash_pass_nonce_registry` INSERT ON CONFLICT |
| 3 | Prestige Pass | `server/routes/prestige-pass.ts:508` `/token/redeem` (mint `:360`) | own HMAC w/ `PRESTIGE_QR_SECRET` (45s, real `jti`) | **`WalletLedger`** (`wallet_ledger_entries`, hash-chain, holds) | dual: PG `walletJtiRegistry` + Firestore |
| 4 | Legacy e-voucher / Nayax | `K9000TransactionService`, `voucherService.redeemVoucher`, many `routes.ts` | **static** JSON QR (`server/qrCode.ts`) | `eVouchers.status` flip + `eVoucherRedemptions` | status guard only |

**The strongest, safest stack already exists: `WalletLedger` (Flow #3).**
- `server/services/WalletLedger.ts` — double-entry, SHA-256 hash chain (`computeEntryHash` `:64`), `SELECT … FOR UPDATE` (`:241`), atomic `UPDATE … WHERE balance >= amount` floor guard (`:285`), idempotency w/ request-hash misuse detection (`:196`), JTI first-writer-wins `INSERT … ON CONFLICT DO NOTHING` (`:428`), velocity limiter, fraud log, `verifyChainIntegrity` (`:803`).
- Hold→capture primitives already present: `holdWallet` (`:921`), `releaseWalletHold` (`:1039`), `debitFromWalletHold` (`:1130`), `refundToWallet` (`:1214`) — currently used for **online bookings, not K9000**.
- `server/services/AuditLedgerService.ts` — canonical hash-chained `audit_ledger`; `recordEvent` (`:59`) takes a `FOR UPDATE` chain-tail lock; `recordVoucherRedemption` (`:137`) prevents double-spend via `voucher_redemptions.voucherId` UNIQUE + Postgres `23505` catch (`:212`).
- `MachineCommandService.dispatch` (`server/routes/k9000.ts:956`) sends `START_PUMP` to the machine with retries + `autoCompensateSession` refund-on-no-ACK; gated by `isK9000MachineConfigured()` (`k9000.ts:855`, "no fake success").
- Apple/Google Wallet built: `AppleWalletService.ts:62`, `GoogleWalletService.ts:83` embed `buildQrRedeemToken`; Google `rotatingBarcode periodMillis:'45000'` (`GoogleWalletService.ts:113`).

**Two real defects found during review (must be addressed):**
1. **Silent audit failure (correctness/fraud-visibility bug).** `K9000RedemptionService.debitAndLog` inserts into `auditLedger` with a string `id` and **omits the required `blockNumber`** (`K9000RedemptionService.ts:940`); the compensation path writes nonexistent columns (`:1129`). The real table (`shared/schema.ts:3583`) has `id serial`, `blockNumber NOT NULL UNIQUE`, `currentHash NOT NULL`. These writes **throw at runtime** but are swallowed by try/catch ("non-fatal", `:962`) — so **K9000 redemptions currently proceed with no audit row**. The only correct path is `AuditLedgerService.recordEvent`.
2. **Replay surface + weak secret.** Flow #1's nonce store is an **in-memory `Map`** (`signedRedeemToken.ts:50`, comment warns it must be Redis for multi-instance Cloud Run). Prestige's token verifier **falls back to a hardcoded `'dev-only-insecure-…'` secret if `PRESTIGE_QR_SECRET` is unset** (`prestige-pass.ts:157`).

## 4. Users, roles & accessibility scoping

| Actor | May | May NOT |
|---|---|---|
| **Customer** | Present their mobile pass; trigger a redemption attempt; see their own balance | Decide their own balance client-side; reuse a screenshot; redeem the same token twice |
| **K9000 machine / Nayax** | Receive a backend-issued `START_PUMP` authorization for a specific bay/session | Self-authorize; read or decide balance; start a wash without backend authorization |
| **Provider / operator** | View station/bay state | Mint customer redemption tokens |
| **Admin** | View audit ledger, reconcile, revoke a pass (`tokenVersion` bump) | Edit ledger history (append-only) |
| **System (cron)** | Drift detection, compensation, reconciliation | — |

**Accessibility / localization:** Hebrew-first / RTL UI for the pass and redemption screens; large-tap QR display; clear offline and "token expired, refresh" states; screen-reader labels on the rotating barcode and balance.

## 5. Architecture

**Happy path (authorize → capture):**
1. App requests a fresh **rotating redeem token** (≤45s TTL, single-use `jti`, bound to `passId`/`userId` and — when scanning at a fixed bay — `machineId`/`bayId`). Token shown as QR / wallet barcode.
2. Bay scans token → backend `POST /redeem` verifies HMAC (fail-closed), TTL, and **burns the `jti`** (single-use).
3. Backend selects the funding source (wash package → eGift → cash → loyalty, per policy) and places a **hold** on `WalletLedger` (`holdWallet`).
4. Backend checks bay readiness and dispatches `START_PUMP` via `MachineCommandService.dispatch` (only if `isK9000MachineConfigured()`).
5. On machine **ACK** → **capture** the hold (`debitFromWalletHold`) and `AuditLedgerService.recordEvent` (immutable). On **no-ACK/timeout** → **release** the hold (`releaseWalletHold`) — wash never charged.

**Why hold→capture (not debit-then-refund):** the current K9000 flow debits *before* firing `START_PUMP` and relies on `autoCompensateSession` to reverse a failed start. Converting to hold-on-authorize / capture-on-ACK / release-on-no-ACK removes the window where a customer is debited for a wash that never ran.

**Failure paths:** expired/replayed token → reject (no hold); machine offline/unreachable → no authorization, hold released, clear UX (backend is source of truth, never a fake success); backend unreachable → machine cannot self-authorize (by design).

## 6. Data model (additive-first)

No new ledger is introduced. Reuse:
- **Truth:** `wallet_ledger_entries` (`schema.ts:11675`), `walletHolds` (`:11823`), `walletJtiRegistry` (`:11777`), `walletIdempotencyKeys` (`:11760`).
- **Audit:** `audit_ledger` (`:3583`), `voucher_redemptions` (`:3634`, `voucherId` UNIQUE).
- **Usage log:** `k9000WashEvents` (`:803`, `idempotencyKey` UNIQUE).
- **Pass:** `petwashPassAccounts` (`:13071`, `qrTokenVersion` = revocation lever), `petwashPassNonceRegistry` (`:13101`).

**Open data decision (see §14):** prepaid packages and eGift are modeled **three ways today** — `walletAccounts.washPackageCredits`/`packageServiceUnitsRemaining` (`:11501`), `eVouchers.washCount`/`remainingWashes`, and `petwashPassAccounts.availableCreditIls`. The design must pick **one** canonical balance model. Recommendation: represent prepaid washes and eGift as **buckets within `WalletLedger`** (it already supports `bucket`/`divisionCode`), so the drift detector and hash chain cover them. Any migration is additive + approval-gated, not in the first PR.

## 7. Security & fraud model

| Threat | Control (existing primitive) |
|---|---|
| Screenshot reuse / replay | ≤45s TTL **rotating** token + single-use `jti` burned via `INSERT … ON CONFLICT` (`WalletLedger:428` / `petwash_pass_nonce_registry`) |
| Double-spend (concurrency) | `SELECT … FOR UPDATE` + atomic `UPDATE … WHERE balance >= amount` (`WalletLedger:241,285`) + idempotency key |
| Forged token | HMAC-SHA256 fail-closed, min secret length; **remove the hardcoded dev-secret fallback** (`prestige-pass.ts:157`) |
| Client-side balance tampering | Backend authorizes and debits; machine only gets `START_PUMP` after a successful hold |
| Charge for a wash that never ran | Hold-on-authorize → capture-on-ACK → release-on-no-ACK |
| Voucher/eGift double redeem | `AuditLedgerService.recordVoucherRedemption` UNIQUE + `23505` (stop bare `eVouchers.status` flip race) |
| Missing audit trail | Route **all** redemption audit through `AuditLedgerService.recordEvent` (fixes the silent-failure bug §3.1) |
| Multi-instance replay | Replace in-memory nonce `Map` with the DB `jti`/nonce registry |

## 8. APIs / interfaces

- `POST /redeem` (unified): input = `{ token, machineId?, bayId?, idempotencyKey }`; verifies token + jti, selects funding source, holds, dispatches, captures/releases; returns `{ status, sessionId, remainingBalance }`. Idempotent on `idempotencyKey` (e.g. `jti:{jti}`).
- Token mint: short-TTL rotating token endpoint bound to `passId`/`userId` (+ optional bay binding).
- All existing Apple/Google Wallet barcode minting continues to call the unified token builder.

## 9. Money & audit

- Funding precedence (policy, to confirm in §14): prepaid wash package → eGift → cash wallet → loyalty/Prestige credits.
- Movement: `holdWallet` (authorize) → `debitFromWalletHold` (capture on ACK) → double-entry rows + hash-chain entry; or `releaseWalletHold` (no-ACK).
- Audit: one `AuditLedgerService.recordEvent` per terminal outcome (captured / released / refunded) with actor, machine/bay, amount, funding source, jti.
- Reconciliation: existing `wallet-ledger-drift-detector` + `walletReconciliationRuns` cover the unified path once K9000 stops using bespoke `walletAccounts` column updates.

## 10. Rollout

- `ff.redemption.unified.enabled` default **OFF**: legacy flows (#1/#2/#4) remain live and unchanged.
- Phase A (defect fixes, safe with flag OFF): route K9000 audit through `AuditLedgerService`; replace in-memory nonce with DB registry; remove dev-secret fallback.
- Phase B (flag ON in staging): unified `/redeem` using `WalletLedger` hold→capture for one funding source (wash package), behind flag, with shadow-audit comparison.
- Phase C: extend to eGift / loyalty / Prestige; deprecate duplicate stacks; (separate, approval-gated) balance migration.

## 11. Test plan

- **Unit:** token verify (valid/expired/forged/wrong-secret); jti single-use; funding-source selection; hold→capture/release transitions.
- **Integration:** concurrent double-redeem of one token → exactly one debit; screenshot replay → rejected; machine no-ACK → hold released, no charge; offline machine → no authorization.
- **Fraud/abuse:** velocity limits; forged HMAC; reused voucher → `23505` blocked; client-sent balance ignored.
- **Audit:** every terminal outcome writes one immutable `audit_ledger` row; chain integrity verified.

## 12. Rollback plan

- Set `ff.redemption.unified.enabled` = OFF → instantly reverts to legacy flows.
- Phase-A defect fixes are non-behavioral (audit routing, nonce store, secret hardening) — revert the individual commit if needed.
- No destructive data changes in Phases A–B; balance migration (Phase C) carries its own reversible plan and is not bundled here.

## 13. First implementation PR (smallest safe slice)

**PR-1: Restore the K9000 redemption audit trail (no balance behavior change).**
Route `K9000RedemptionService` audit writes through `AuditLedgerService.recordEvent` (correct `audit_ledger` columns + chain lock), replacing the broken direct inserts (`K9000RedemptionService.ts:940,1129`). Add tests proving every redemption + compensation produces exactly one immutable audit row. This fixes a live fraud-visibility gap, is contained, and is independent of the flag.

(PR-2: replace the in-memory nonce `Map` with the DB `jti`/nonce registry. PR-3: remove the hardcoded `PRESTIGE_QR_SECRET` dev fallback → fail-closed.)

## 14. Open questions (need a human decision)

1. **Canonical balance model** for prepaid washes + eGift: consolidate the three stores (`walletAccounts` columns vs `eVouchers` vs `petwashPassAccounts`) into `WalletLedger` buckets? Are there live customer balances in each that require migration?
2. **Token standard:** standardize on `passTokens.ts` (carries `machineId`/`bayId`) with Prestige-style DB `jti`? Retire `signedRedeemToken.ts`'s in-memory nonce?
3. **Funding precedence** order and whether customers may choose.
4. **Nayax/K9000 authorize-capture:** does the machine contract support a true authorize→capture, or only start+compensate? (Affects whether hold→capture maps 1:1.)
5. **Secret management:** confirm `PRESTIGE_QR_SECRET` / `PASS_TOKEN_SECRET` are set in production Secret Manager (no dev fallback).
6. **Duplicate `stations` tables** (`schema.ts:7995` + super-app schema) — which is canonical for bay binding?

## 15. Risks

- Three uncoordinated stacks → high regression risk if cutover is not flag-gated and phased.
- Silent audit failure means today's K9000 redemptions may lack an audit trail (compliance exposure).
- In-memory nonce → replay possible across Cloud Run instances if Redis SETNX is unavailable.
- Hardcoded dev-secret fallback → forgeable tokens if env unset in prod.
- Balance migration between stores is the highest-risk step (money) — must be separate and approval-gated.

---

## 16. Appendix — Original request (verbatim)

> **Task instruction (this session):**
> "Use the SDD Writer Agent to create a Software Design Document for PetWash Pass / K9000 Redemption. Do not write code yet. Use repository context. Preserve my original request in the appendix. Output the SDD to: docs/design/YYYY-MM-DD-petwash-pass-k9000-redemption.md … Do not create PRs. Do not edit production code. Only create the design document. Save it as: docs/design/2026-05-22-petwash-pass-k9000-redemption.md"

> **Original intent (user's own words, earlier):**
> "she should handle redeem at k9000 with user mobile and mobile pet wash pass, no fraud, like blockchain, gift redeem as well and regular wash packages, sorry"

> **Context provided (user-approved framing):**
> "Customers must redeem washes at K9000 using mobile PetWash Pass, QR, eGift, prepaid packages, loyalty/Prestige credits, and later Apple Wallet / Google Wallet. Backend must be source of truth. Nayax/K9000 only receives authorization. No static QR. Use signed rotating tokens, anti-replay, idempotency, append-only audit ledger, no double-spend, no screenshot reuse, no fake gift card, no client-side balance decision."
