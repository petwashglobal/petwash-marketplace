# THE PETWASH MATRIX — Canonical Master Index

**Single source of truth so nothing the CEO has ever specced is lost. "Miss zero / 100%."**
_Synthesized 2026-06-23 by a 9-agent council mapping all 8 PetWash worlds against [[the-big-chain-master-integration-plan-2026-06-23]]._

## 0. ONE-SCREEN OVERVIEW
**Big-Chain build phases:** `0` backup · `1` money leaks · `2` per-platform bookkeeping · `3` money rail · `4` K9000 activation · `5` perfect sync · `6` scale

| # | World | Status | Single biggest gap | Phase |
|---|-------|--------|--------------------|-------|
| 1 | K9000 / Stations / Nayax | Core built, **activation BROKEN** | Wash never physically starts — `MachineCommandService.ts:270` posts to a non-existent kiosk API; real `NayaxSparkService.remoteActivateWash:941` unwired | 4 |
| 2 | Marketplace + provider lifecycle | Foundation built, **FRAGMENTED** | 4 live booking engines + 2 quote paths + 2 escrow tables, never consolidated | 2 |
| 3 | Money chain (wallet/escrow/payout/SUMIT/VAT) | Built, **two rails not live** | No automated refund rail (`ProviderPayoutService.ts:642` TODO) + no live card charging | 3 |
| 4 | Auth / signups / identity | Built (post-fix), **identity not unified** | No duplicate-account merge; phone-session never calls `loginOrLink` → one human = many user_ids | 1 |
| 5 | Legal / compliance / tax / privacy | **DRAFT, pre-counsel** | C2 stored-value/payment licensing (existential) + tax-sequence dup ITA numbers | 1/3 |
| 6 | Ops / admin / alerts / reconcile / backup | Built, **scheduler was NOT booted** | ✅ FIXED #981 (`BackgroundJobProcessor.start()` was dead → no alerts/backup/recon). **Postgres backup still missing.** | 0 |
| 7 | Prestige / loyalty / pass / tiers | Discount engine built, **accrual broken** | Dual contradictory discount law (10% cap vs orphaned tiers) + no loyalty accrual at K9000 redeem | 1 |
| 8 | Global / franchise / SaaS | IL-only built, **multi-tenant partial** | Royalty ledger disconnected from real station revenue; activation gates not wired | 6 (post-launch) |

**Launch-blocking critical path:** Phase 0 (✅ scheduler booted #981 + 🔴 add Postgres backup) → Phase 1 (close money leaks: discount law, identity dupes, consent/spam-law, wallet H1-H6) → Phase 3 (refund rail + card charging) → Phase 4 (K9000 wash activation). Phases 2/5 alongside; 6 (global) explicitly post-launch.

## PER-WORLD KEY FILES + GAPS (navigable — detail lives in the linked docs/memory)
**1 · K9000:** `MachineCommandService.ts:258,270,420`; `NayaxSparkService.ts:419,941,515` (real remote-vend, unwired); `K9000RedemptionService.ts:1086,1109`; `k9000.ts:73,1140`; schema `1001-1051`. Gaps: wash never starts, Flow A charged-not-refunded, bay never auto-releases, false compensation every wash. → [[nayax-wash-activation-design-2026-06-23]], [[k9000-nayax-golive-state-2026-06-22]], [[k9000-hardware-reality-2026-06]].
**2 · Marketplace/providers:** 4 engines (`UnifiedBookingEngine`, `BookingLifecycleService`, `EnhancedBookingService`, +quoteEngine); 2 payout rails (`payoutLedger` UID / `ProviderPayoutService` numeric-id); `payoutLedger.ts:437` auto-release has NO cron. Gaps: engine fragmentation (root cause), no income-tax withholding deducted, full-verification gate not blocking waitlist. → [[booking-platform-bughunt-2026-06-15]], [[provider-onboarding-100-audit-build-2026-06-20]], [[payout-rails-identity-2026-06]].
**3 · Money:** `WalletLedger.ts:285` (atomic), `EscrowStateMachine`, `payoutGate.ts:102`, `ProviderPayoutService.ts:642` (refund TODO), `SumitClient`+`TaxSequenceService` (dup-ITA concurrency bug). Gaps: no refund rail, no live card charging (SUMIT/UPay dormant), wallet/eGift not booked as GL liability. → [[refund-rail-design-2026-06-23]], [[provider-earnings-wallet-split-design-2026-06-23]], [[money-map-audit-2026-06-15]], [[tax-sequence-concurrency-bug-2026]].
**4 · Auth/identity:** built + hardened (verifyIdToken resilient, session cookie `__session`, signup gate + consent). Gap: no duplicate-account merge; phone-session doesn't `loginOrLink` → identity fragmentation. → [[auth-fullsurface-audit-2026-06-18]], [[firebase-hosting-session-cookie-stripping-2026-06-19]].
**5 · Legal:** full draft pack + master Hebrew framework. Gaps (pre-counsel): C2 payments/stored-value licensing (existential), C4 not-insurance, dup-ITA. → master-legal-framework + legal pack in docs/legal/, [[legal-and-ops-gap-roadmap-2026-06-18]].
**6 · Ops:** ✅ scheduler now booted (#981). Critical/health jobs run (wallet+treasury recon, health watchdog). 🔴 STILL no automated **Postgres** backup (only Firestore). → [[go-live-audit-findings-2026-06-23]], [[schema-drift-deploy-gap-2026-06-23]].
**7 · Prestige/loyalty:** 7-tier luxury ladder built (Diamond/Crown #973-era); discount cap 10% (memberDiscount). Gaps: two loyalty systems (points vs credit-cents — see H4 corrected note), no accrual at K9000 redeem. → [[discount-policy-k9000-only-2026-06-22]], [[wallet-fraud-silentevil-audit-2026-06-14]].
**8 · Global:** IL live; multi-tenant + franchise = future epic. → [[master-backlog-and-franchise-2026-06-22]], global multi-tenant master in docs/architecture/.

## BUILD CHECKLIST (consolidated, sequenced — the chain)
- **P0:** ✅ scheduler boot (#981) · 🔴 nightly Postgres pg_dump→GCS + restore drill (ops).
- **P1 (money leaks, each tested PR):** wallet H1-H6 · swallowed-writes (prestige /join, K9000 Flow A) · discount-law reconciliation · identity duplicate-merge/loginOrLink · spam-law/consent gates.
- **P2 (per-platform bookkeeping):** K9000 wash invoice+email · Trainer VAT+receipt · Walk nayaxTx+email · service-division tag every credit row · consolidate the 4 booking engines.
- **P3 (money rail):** provider-earnings wallet split (shadow→authority) · automated refund rail (P1 wallet/eGift → P2 card+SUMIT credit-invoice) · live card charging.
- **P4 (K9000):** wire NayaxSparkService remote-vend + ACK + bay-release + Flow-A void (needs Nayax creds/ops).
- **P5 (perfect sync):** Postgres = single source; reconcile Firestore/Octopus mirrors; nightly assert ledger==balance + every refund matched + every platform invoice issued.
- **P6 (scale, post-launch):** tenant_id everywhere · queue payouts/refunds · partitioning · global expansion.

> Full per-world maps (file:line, 677K-token council run) are in this session's workflow transcript. This index is the navigable map; the linked docs/memory hold the depth.
