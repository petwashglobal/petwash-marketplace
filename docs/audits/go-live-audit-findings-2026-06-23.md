# PetWash Go-Live Audit — Consolidated Findings (5 parallel agents, 2026-06-23)

Evidence-backed (file:line). Ranked. SHIPPED items noted. Everything else = actionable backlog.

## 🔴 CRITICAL — go-live blockers

### 1. NO automated daily backup of the real database (Postgres/Neon)
The scheduled "daily backup" (`backgroundJobs.ts:183`) dumps **Firestore only** — it touches **zero Postgres tables**. The system-of-record (Neon Postgres: all bookings, wallet, money, vouchers, providers) has **no automated `pg_dump`, no PITR automation, no tested restore.** Manual scripts (`scripts/export-database-backup.ts` dumps 6 tables to local JSON; `scripts/backup-to-gcs.sh` points at the dead Replit path) are partial and unscheduled. The team's own `docs/BACKUP_RETENTION_ARCHITECTURE.md:3` says "No implementation has been done"; G7 "Neon PITR window unknown/unverified." **A Neon incident, bad migration, or mass-delete has NO recovery path under our control.**
**FIX (ops, highest go-live value):** (a) confirm + document Neon PITR window; (b) nightly `pg_dump` → GCS `me-west1` (Cloud Run Job + Scheduler, or `server/jobs/postgresNightlyBackup.ts` cron); (c) one restore drill before launch.

## 🟠 HIGH — money integrity (wallet fraud sweep)

> Core wallet engine (`WalletLedger`) is SOLID: DB-unique idempotency, FOR UPDATE locks, atomic balance-floor (no negative), JTI PK replay, hash-chain. K9000 debit + unified-voucher redeem race-safe. Exposure is on the EDGES:

- ✅ **SHIPPED (#977):** `/v1/brain/redeem` + `/v1/egift/purchase` were unauth → now `requireAuth`. (The agent's "/v1/wallet/credit mints money" was a FALSE ALARM — `/v1/wallet*` returns 410 Gone, `octopus-engine.ts:106`.)
- **H1 Double-CREDIT:** `WalletService.addCredits` (`WalletService.ts:682-698`) does check-then-write with NO unique constraint on `credit_transactions(wallet_id, source_type, source_id)` (schema.ts:11778-11783 = plain indexes). Concurrent gift/promo/referral retries → double credit. **Fix:** partial UNIQUE(wallet_id,source_type,source_id) WHERE source_id IS NOT NULL + onConflictDoNothing.
- **H2 K9000 auto-compensation not idempotent:** `K9000RedemptionService.ts:1086-1229` never reads a `compensatedAt` flag; restores are unconditional → double-refund / free credit on re-invocation. **Fix:** in-tx `UPDATE bay_sessions SET compensated_at=now() WHERE id=? AND compensated_at IS NULL RETURNING`; restore only if claim wins.
- **H3 Referral = in-memory fake money:** `routes/referral.ts:71-74,345` stores credits in JS Maps, lost on every deploy; DB path dead (`users.referredByCode` never set at signup). **Fix:** delete in-memory route; set referredByCode at signup; route through DB referrals + ledger; UNIQUE(invitee_user_id).
- **H4 Loyalty double-mint:** `loyaltySync.ts:87-160` bare `UPDATE loyalty_points + delta`, no (userId,bookingId) key → any booking-complete re-run double-mints. **Fix:** route through `awardLoyaltyCredit` fingerprint `booking_points:${bookingId}` (reuses reward_claims unique).
- **H5 Grants bypass hash-chain:** addCredits/adminInjectCredits/nayax write walletAccounts+credit_transactions but NEVER wallet_ledger_entries (the chain); adminInjectCredits non-atomic. **Fix:** issue grants through WalletLedger chained path; wrap in tx.
- **H6 Two redeem paths broken on missing DB objects:** `storage.redeemVoucher` calls `redeem_voucher_atomic()` (PL/pgSQL in NO migration → throws); `EgiftFinancialService.purchaseEgift` ON CONFLICT(idempotency_key) but `egift_events.idempotency_key` only a plain index → 42P10. **Fix:** ship redeem_voucher_atomic migration; partial UNIQUE on egift_events(idempotency_key).
- **M1/M2:** wallet hash-chain verified only via manual admin endpoint (no cron); recon never compares cash_wallet_balance_cents vs ledger. **Fix:** nightly verifyChainIntegrity sweep + cash-bucket recon assertion.

## 🟠 HIGH — swallowed-write hotspots (same class as the onboarding 42703 bug)
- **Prestige `/join` returns `ok:true` over a dropped member row** — `prestige-join.ts:90,115,153` (3 catch-and-continue writes, then success). User appears joined with no DB row. **Fix:** wrap in one `db.transaction`, fail response on throw.
- **K9000 Flow A wash-event insert swallowed** — `k9000.ts:599` (caught :621, returns 200). Wash/revenue record vanishes. **Fix:** 5xx or retry-enqueue on failure.
- **K9000 Flow B audit-ledger insert outside money tx, swallowed** — `K9000RedemptionService.ts:1016`. Legal/audit hash row lost. **Fix:** move inside tx.
- **UnifiedWalletService.deductFunds writes no ledger row** (`:110`); **Walk session action log unpersisted** (`WalkSessionService.ts:668` console.log + TODO); **Shop checkout no tx + cancel-never-restocks** (`ShopService.ts:491,610`, dark behind SHOP_ENABLED).

## 🟡 Auth/login-logout UX (the "not clean" feeling)
> Plumbing is strong (passkeys, Google One-Tap, WebOTP, PWA all exist). "Not clean" = logout discoverability + gold drift.
- 🔴 **Providers can't log out** — `ProviderOS.tsx:88` never destructures `logout`; the two LogOut icons (`:227,:292`) are `<Link href="/">` (navigate, don't end session). **Fix:** wire `logout`.
- 🔴 **No logout on desktop header** — only in mobile hamburger (`PetWashHeader.tsx:863`). **Fix:** profile-icon dropdown (Dashboard / My Account / My Pass / **Log out**). Single highest-impact UX fix.
- Off-brand muted gold on passkey button (`SignIn.tsx:2574` `#B8860B/#D9B84C` → `#D4AF37`); signup uses `autoComplete="current-password"` (`SignUpLuxury.tsx:651` → `new-password` so OS offers to save); SignIn redirect race flashes wrong state ~1s (`:283,539`); `AuthAction`/`AccountActivation`/`WelcomeConsent` leak raw errors + English-only + purple.
- One-Tap is coded + mounted but **silently off unless `VITE_GOOGLE_CLIENT_ID` set in prod** — verify env.

## 🟡 Navigation UX + search + PWA (easy surfing)
- **Every desktop header nav is a full page reload** — `PetWashHeader.tsx:410` `window.location.assign`. Biggest "not smooth" cause. **Fix:** wouter `setLocation`/`<Link>` for internal hrefs.
- **PWA "Save to phone" is built but switched OFF** — `App.tsx:3953` `{/* PWAInstallPrompt disabled */}`. Component handles iOS/Android/desktop, bilingual, 7-day cooldown. **Fix:** render `{!isImmersive && <PWAInstallPrompt/>}` + an Account "Save to phone" entry. (Note: SW is force-killed on boot by design — reword manifest "Works Offline" → "Instant home-screen access" unless a versioned SW is built.)
- **No Wallet/Loyalty/Pass tab in bottom nav** — `MobileBottomNav.tsx:20-26` (Home/PawFinder/Bookings/Messages/Account). **Fix:** swap PawFinder for Wallet or add 5th tab.
- **Messages unread badge computed but never shown** in header (`PetWashHeader.tsx:336`). **Global SEARCH:** none today (`/search` = provider filter only). Quick win (~0.5d): header box → `/search?q=` read in `BookingSearch` (also makes the JSON-LD SearchAction truthful). Bigger (~3-4d): `/api/search` coordinator across stations/providers/shop/help.
- ~12 pages with raw-error/English-only/dead-end empty states (Pets, K9000Redeem, Marketplace, MyWallet, UserCoupons…) — add Retry + localized copy + skeletons.

## 🟢 Confirmed SAFE / already-running (certainty for the CEO)
Daily reconciliation, wallet drift-detector, 3-min DB health watchdog, hourly Alerts Center sweep — all scheduled + running. Core wallet spend/hold/refund engine race-safe. eGift recipient-bound on canonical route. Gift-code uniqueness DB-enforced. No in-memory Map-as-DB on any booking/wallet write path (except referral H3).

## 🔴 STRUCTURAL (separate effort): migrations ≠ prod
~110 tables in schema.ts have NO `CREATE TABLE` migration (exist via historical `drizzle-kit push`). A DR restore / fresh region rebuilt from `migrations/` alone would fail (no bookings/wallet/providers tables). **Fix:** `drizzle-kit generate` a full verified baseline, commit it, stop depending on `db:push`. (0072 closed the live fiscal column-drift; this closes the rebuild gap.)

---
**Migration numbers in flight:** 0070 (rate engine, #973), 0071 (onboarding, #975), 0072 (schema-drift fiscal, #977 — SHIPPED). Future builds: refund rail, wallet split → assign 0073+.
See [[schema-drift-deploy-gap-2026-06-23]], [[refund-rail-design-2026-06-23]], [[provider-earnings-wallet-split-design-2026-06-23]], [[nayax-wash-activation-design-2026-06-23]] (in docs/).
