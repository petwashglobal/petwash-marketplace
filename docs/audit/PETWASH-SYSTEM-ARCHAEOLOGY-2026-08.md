# PetWash System Archaeology — Live Index (2026-08-21)

Purpose: single searchable list of every asset the CEO has built,
where it lives, whether it is actually reachable in production,
what is broken about it, and what has been (or should be) fixed.

Rows are appended as evidence arrives. STATUS values are from the
CEO-approved dictionary:
- LIVE-CONNECTED
- BUILT-BUT-ORPHANED
- ROUTE-UNMOUNTED
- FRONTEND-NO-BACKEND
- BACKEND-NO-FRONTEND
- WRONG-AUTH / WRONG-ROLE / WRONG-METHOD / WRONG-DTO / WRONG-TABLE
- LEGACY-SHADOW
- DUPLICATE-AUTHORITY
- FEATURE-FLAGGED-OFF
- LOCALSTORAGE-FAKE
- DOC-ONLY
- MIGRATION-ONLY
- DEAD-CODE
- STALE-BUILD-ARTIFACT
- MOBILE-BUNDLE-STALE
- PARTIALLY-CONNECTED
- FUNCTIONAL-E2E

---

## SECTION A — CONFIRMED ORPHAN PAGES (built, never reachable)

| File | STATUS | Action |
|---|---|---|
| `client/src/pages/pettrek/Overview.tsx` | BUILT-BUT-ORPHANED | Whole `pettrek/` folder (5 files) has zero routes; server `routes/pettrek.ts` IS mounted → backend live, frontend dark. Either wire or delete. |
| `client/src/pages/pettrek/BookingFlow.tsx` | BUILT-BUT-ORPHANED | Same. |
| `client/src/pages/pettrek/CustomerDashboard.tsx` | BUILT-BUT-ORPHANED | Same. |
| `client/src/pages/pettrek/DriverDashboard.tsx` | BUILT-BUT-ORPHANED | Same. |
| `client/src/pages/pettrek/DriverDetail.tsx` | BUILT-BUT-ORPHANED | Same. |
| `client/src/pages/StandaloneDivisions.tsx` | BUILT-BUT-ORPHANED | No importer, no route. |
| `client/src/pages/PlatformShowcase.tsx` | BUILT-BUT-ORPHANED | No importer, no route. |
| `client/src/pages/DocumentSigning.tsx` | BUILT-BUT-ORPHANED | No route mounted; signing backend exists. |
| `client/src/pages/Privacy.tsx` | LEGACY-SHADOW | Live path routes to `PrivacyPolicy.tsx`; this file is dead duplicate. |
| `client/src/pages/ProviderTimeline.tsx` | ROUTE-UNMOUNTED | `/provider/timeline` redirects to `/provider-os`; file never imported. |
| `client/src/pages/walks/TrackWalk.tsx` | BUILT-BUT-ORPHANED | No importer. |
| `client/src/pages/walk-my-pet/WalkerDashboard.tsx` | ROUTE-UNMOUNTED | Redirect to `/provider-os`. |
| `client/src/pages/BookingChatInbox.tsx` | LEGACY-SHADOW | Two "inbox" implementations live at same URL: `/booking-chat/inbox` renders `PetWashInbox` for most users, `BookingChatInbox` is embedded inside sitter-suite `OwnerDashboard`. Pick one. |

## SECTION B — MOUNT-ORDER / DUPLICATE ROUTE HAZARDS

| Path prefix | Hazard | Location |
|---|---|---|
| `/api/user` | Triple-mounted; loosest auth (`optionalFirebaseToken`) is registered FIRST → any new leaf inherits the loosest gate | `server/routes.ts:12781,12784,12787` |
| `/api/k9000` | IoT router with NO AUTH mounted BEFORE admin (`validateFirebaseToken + requireAdmin`); any overlap is public | `server/routes.ts:12594,12608,12611` |
| `/api/franchise` | Finance router without Firebase token mounted BEFORE the authed one; new finance leaves land on unauth branch | `server/routes.ts:12061,12112` |
| `/api/admin/octopus` | Two independent routers own the CEO-dashboard namespace | `server/routes.ts:12636,12637` |
| `/api/israeli-compliance` | Two implementations, one with token, one with only `apiLimiter` | `server/routes.ts:12244,12747` |
| `/api/pass/:token` | Catch-all GET at 1 segment shadows any future GET on `/api/pass/*` (redeem router) | `server/routes/pass-universal.ts:306` |
| `/api/webhooks/nayax/cortina` | Not in `RAW_BODY_WEBHOOK_PATHS` but caught by `startsWith('/api/webhooks/nayax/')` — cortina bodies bypass `express.json` | `server/index.ts:673` |
| `googleFormsRoutes` | Root-mounted with NO prefix — any relative path added silently gains global authority | `server/routes.ts:12252` |

## SECTION C — MONEY SPLIT-BRAIN (Ledger authority)

| Bypass | Writer | Symptom |
|---|---|---|
| Dispute refunds credit `wallet_accounts` directly, skip `wallet_ledger_entries` | `server/routes/disputes.ts:301-390`, `BookingPolicyEngine.ts:206`, `bookings.ts:855-862` | Hash-chain reconciliation drifts; auditor sees phantom balances |
| eGift lifecycle bumps `walletAccounts.egiftBalanceCents` + `credit_transactions` only, never `wallet_ledger_entries` | `server/services/EgiftFinancialService.ts:127,393` | Every purchased eGift missing from ledger chain |
| Loyalty TRIPLE-store — `loyaltyProfiles.points` + `walletAccounts.loyaltyPointsBalance` + `users.loyaltyPoints` + `users.loyaltyBalanceCents` + `customers.loyaltyPoints` | 12 writers across `loyalty.ts`, `rewardFulfillment.ts`, `prestige-join.ts`, `nayax-monyx-events.ts` | Different quotes / dashboards read different stores; drift permanent |
| K9000 redemption bypass | `server/services/K9000RedemptionService.ts:955-1319` | 10+ direct `.update(walletAccounts)` for cash / egift / wash packages / loyalty / promo — never hits ledger |
| Booking policy engine cash refund | `server/services/BookingPolicyEngine.ts:206` | Raw `UPDATE wallet_accounts SET cash_wallet_balance_cents = ...` |
| WalletService session confirm / restore / add-credits / expire | `server/services/WalletService.ts:453,525,546,568,589,747,934,1196` | Writes `credit_transactions` only, never `wallet_ledger_entries` |
| Escrow Firestore ↔ Postgres | `EscrowService.ts` (Firestore) vs `nayax-webhooks.ts, BookingLifecycleService.ts, disputes.ts` (Postgres `escrow_holdings`) | Neither is a projection of the other; dispute writes hit only Postgres, sitter-suite hits only Firestore |
| Provider approval role write | 4 independent paths in `provider-applications.ts:1410,1609`, `provider-onboarding.ts:1848,2064`, `AdminProviderReviewService.ts:557`, `routes.ts:14481` | Firebase custom claims + Postgres updated in separate steps; no compensator |

## SECTION D — FEATURE FLAGS SILENTLY OFF (visible UI, dead in prod)

Prod env is `.github/workflows/petwash-ci.yml:1711` (`--set-env-vars`) + `cloudrun-service.yaml:204-233`. Anything not listed defaults to OFF.

| Flag | Effect when OFF | Location |
|---|---|---|
| `AI_CRONS_ENABLED` | Every AI cron + Gemini watchdog dark | 6 files including `backgroundJobs.ts:114/2218`, `GeminiWatchdogService.ts:115` |
| `EXCEPTION_EMAIL_ENABLED` | Daily exception email never sent | `server/jobs/exception-email.ts:21` |
| `DAILY_CLOSE_REMINDER_ENABLED` | Daily close reminder cron dead | `server/jobs/daily-close-reminder.ts:21` |
| `EXECUTIVE_DIGEST_ENABLED` | Exec digest email dead | `daily-close-reminder.ts:410` |
| `WASH_REMINDER_CRON_ENABLED` | Customer wash reminders never fire | `server/cron/wash-reminder.ts:110` |
| `CARE_NOTES_REMINDER_CRON_ENABLED` | Care-notes reminders dead | `server/cron/care-notes-reminder.ts:214` |
| `SUMIT_CUSTOMER_SYNC_ENABLED` | Customer→SUMIT sync silently disabled | `SumitCustomerService.ts:56` |
| `SUMIT_DAILY_RECONCILE_ENABLED` | Finance reconciliation NEVER RUNS | `SumitReconciliationService.ts:60` |
| `CARD_VAULT_ENABLED` | Card vault dark | `SumitCardVault.ts:22` |
| `LYNX_REFUND_ENABLED` | Nayax Lynx refund flow inert | `LynxRefundService.ts:27` |
| `LYNX_CARD_MINT_ENABLED` | New card issuance inert | `LynxCardService.ts:43` |
| `PROVIDER_APP_API_ENABLED` | Mobile provider REST API is 404 | `server/routes/provider-app.ts:25` |
| `MAYA_OPS_TASKS_ENABLED` | Maya ops task engine dark | `services/MayaOpsTasksService.ts:69` |
| `NAYAX_CORTINA_ENABLED` | Cortina static-QR client dark | `NayaxCortinaClient.ts:44` |
| `KIOSK_PRESTIGE_SYNC_ENABLED` | Kiosk↔Prestige sync dead | `routes/nayax-monyx-events.ts:44` |
| `NAYAX_SUMIT_BRIDGE_ENABLED` | Bridge dead | `services/nayaxSumitBridge.ts:40` |
| `SHOP_SHIPPING_WOLT_ENABLED` | Wolt shipping router dark | `services/shop/DeliveryRouter.ts:153` |
| `BANK_PAYOUT_LIVE` | Real bank payouts NEVER sent (dry-run only) | `ProviderPayoutService.ts:477` |
| `VITE_PET_ONBOARDING_SHELL_ENABLED` | Pet onboarding shell route dark on client | `App.tsx:1518` |
| `UNIFIED_BOOKING_ENABLED` | Unified booking router dark | `routes/unified-booking.ts:44` |
| `DAILY_REVENUE_REPORT_ENABLED` | Daily revenue email dead | `backgroundJobs.ts:366` |

**INCONSISTENCY:** `GOOGLE_PLACES_LIVE` is `'true'` in `cloudrun-service.yaml:205` but overridden to `false` by CI `--set-env-vars` at `petwash-ci.yml:1711`. Places autocomplete 503s in prod every deploy even though the YAML claims it's on. Client `VITE_GOOGLE_PLACES_LIVE=true` — client asks, server refuses.

## SECTION E — DEAD DEEP-LINKS IN OUTBOUND EMAIL / SMS / PUSH

| Bad URL | Sender | Real route | Fixed? |
|---|---|---|---|
| `/me` | `care-notes-reminder.ts:156,164`, `nayax-webhooks.ts:1754` | `/my-account` | ✅ this PR |
| `/prestige` (bare) | `loyalty.ts:1183,1499,1601`, `PetWashNotificationEngine.ts:417,527,540,552` | `/prestige/home` | ✅ this PR |
| `/complete-registration` | `cron/recovery-automation.ts:101` | `/complete-profile` | ✅ this PR |
| `/book` (bare) | `booking-requests.ts:3595`, `birthday-promo.ts:43`, `notificationDispatcher.ts:418`, `seeds/notificationTemplates.ts:346` | `/booking` | ❌ next |
| `/provider/onboard?token=` | `provider-applications.ts:1441` | `/provider-onboarding` | ❌ next |
| `/provider/settings` | `email/templates/welcome-luxury-2026.ts:74,90` | `/my-account` or new route | ❌ needs CEO |
| `/provider/compliance` | `ComplianceControlTower.ts:596` | `/provider-compliance` | ❌ next |
| `/gift-cards/activate?code=` | `email/templates/egift-activation-2026.ts:274` | `/gift/activate/:voucherId` | ❌ next |
| `/bookings/{id}/modify` | `emailService.ts:3532` | `/bookings/:id` (no modify screen) | ❌ needs CEO |
| `/admin/backups/status` | `gcsBackupService.ts:1053` | none exists | ❌ needs route or removal |
| `/admin/legal/compliance` | `emailService.ts:3083` | none exists | ❌ needs route or removal |
| `/admin/incidents/{id}` | `seeds/notificationTemplates.ts:36` | none exists | ❌ needs route or removal |
| `/admin/finance/settlements/{id}` | `seeds/notificationTemplates.ts:108` | none exists | ❌ needs route or removal |
| `/admin/stations/{id}` | `seeds/notificationTemplates.ts:182` | `/admin/stations/:stationId/(bays|commands|timeline)` — bare not registered | ❌ needs route or removal |

## SECTION F — INSTALLED NATIVE APPS OUT-OF-DATE

Both iOS archives `PetWashCustomer15.xcarchive` and `PetWashProvider15.xcarchive` were signed on **2026-07-02**. Their embedded JS bundles still call the LEGACY endpoints:

- `/api/auth/user` (dead — was `useAuth` shadow hook)
- `/api/auth/phone/*` (superseded by `/api/auth/sms/*`)
- `/api/auth/sms/*` (present, but old bundle may point at old response shape)
- `/api/session/*` (renamed)
- `/provider/dashboard`, `/provider/timeline` (both redirect / dead)
- `signinpetwash.firebaseapp.com` (should be `petwash.co.il`)

**Web fixes do NOT reach installed phones.** Required:
1. Rebuild web (`npm run build:web`) with current source
2. `npx cap sync ios ios-customer`
3. Bump `CFBundleVersion` (both apps stuck at 15, both `CFBundleShortVersionString=1.0`)
4. Archive + upload via Xcode → Team `U22NC3Q5Z4`
5. Repeat for Android

## SECTION G — LEGACY / SHADOW BACKENDS

| Asset | STATUS | Note |
|---|---|---|
| `server/customAuth.ts` | LEGACY-SHADOW | `setupCustomAuth(app)` never called on boot → `/api/auth/user` 404s. Only `requireAuth` export is live and imported by ~30 route files. One accidental call revives 5 dead auth endpoints. |
| `server/services/LedgerService.ts` (v2) | FEATURE-FLAGGED-OFF | `LEDGER_V2_ENABLED`, `LEDGER_V2_DUAL_WRITE`, `LEDGER_V2_READ_DERIVED` all default false — v2 double-entry engine dark |
| Old `/api/auth/phone/*` router | DUPLICATE-AUTHORITY | Runs parallel to new `/api/auth/sms/*` in `publicAuthRoutes.ts:300,472` |
| `walkers.ts` legacy phone-first path | LEGACY-SHADOW | Old walker flow parallel to sitter-suite/walk-my-pet |
| `hubspot.ts` | DEAD-CODE | Every function is a no-op stub since Replit was cut; already removed from signup path in #2003 |

## SECTION H — MISSING NAVIGATION (LIVE but no way to reach)

- `Treasury.tsx`, `TreasuryForecast.tsx`, `BoardPack.tsx`, `MoneyFlow.tsx`, `Interventions.tsx`, `Outcomes.tsx`, `Optimizer.tsx`, `PolicyRollout.tsx`, `FinancialApprovals.tsx`, `NetworkOversight.tsx`, `FinanceProfitability.tsx` — all mounted, all wired to real APIs, NONE listed in `ExecutiveSuiteHome.EXECUTIVE_DASHBOARDS` (6 entries only)
- 30+ legal declarations at `/legal/*` — only 6 linked from `components/Footer.tsx`; the rest (Provider Tax Declaration, No-Circumvention, Independent-Status, Truth-Declaration, Brand-Use, Incident-Reporting, etc.) are reachable only via `/legal` LegalIndex or direct URL
- 8 provider manuals at `/manuals/*` — zero navigation links

---

## APPENDIX — Fixes shipped this session (2026-08-21)

- PR #1999 CSP frame-ancestors `'self'` (Firebase Auth iframe)
- PR #2000 Cloud Run CSP `'unsafe-inline'` (SPA route white-screen)
- PR #2001 ensureServerSession watchdog 6s→15s (cold-start)
- PR #2002 www→apex 308 (POST body preservation)
- PR #2003 DB timeout 8s→20s + drop dead HubSpot signup call
- PR #2004 Email verify chain: specific errors + retryable
- PR #2005 SMS verify chain: specific errors + retryable
- PR #2006 Rewire dead `useAuth` hook → `useFirebaseAuth` (14+ pages)
- PR #2007 iOS `crypto.randomUUID` polyfill (booking button crash)
- PR #2008 Wire `setupWebSocket()` (chat / tracking / alerts alive)
- PR #2009 Israel timezone batch (birthday, paw-finder, 3 crons, finance date filter)
- PR #2010 ILIKE wildcard escape + drop `SELECT p.*` on paw-finder detail
- PR (this) Archaeology doc + safe deep-link corrections

## APPENDIX — Not yet safe to auto-fix (CEO decision)

- Enable/disable each of ~15 silently-OFF feature flags (some are intentional pause: `LEGACY_MULTI_SERVICE_GIFT_ENABLED`, `PETWASH_EGIFT_PURCHASE_ENABLED`, `SHOP_CHECKOUT_ENABLED`, `CAPTCHA_PROBE_ENABLED`, `BANK_PAYOUT_LIVE` — some are genuinely-missed: `SUMIT_DAILY_RECONCILE_ENABLED`, `SUMIT_CUSTOMER_SYNC_ENABLED`, `PROVIDER_APP_API_ENABLED`, `WASH_REMINDER_CRON_ENABLED`)
- Wrap dispute refund + `wallet_ledger_entries` write in single transaction
- Consolidate loyalty triple-store to single authoritative source
- Unify eGift lifecycle onto wallet ledger
- Delete confirmed orphan pages (PetTrek, StandaloneDivisions, PlatformShowcase, DocumentSigning, Privacy.tsx, ProviderTimeline, walks/TrackWalk, walk-my-pet/WalkerDashboard)
- Consolidate `useAuth` and `useFirebaseAuth` imports to single hook name
- Fix `GOOGLE_PLACES_LIVE` inconsistency (CI vs yaml)
- Rebuild + upload native iOS apps


## SECTION I — PROVIDER ONBOARDING FORENSICS (CEO 15-step Israel spec vs reality)

Full trace of every field spec → UI → server → schema → admin.

### Steps entirely missing from UI (client never asks)
- Step 3 — **Right-to-Work in Israel** (foreign / visa). Zero UI. Foreign passports accepted without any legal gate or extra doc upload. Spec calls this "regulated → require legal advice".
- Step 6 — pet safety scenario questions + 6 safety declarations. Only 3 fitness/experience/first-aid checkboxes exist; the 6 CEO-required safety declarations (care / no-violence / follow-rules / stop-if-unsafe / no-unapproved-locations / no-unauthorised-handlers) are absent.
- Step 9 — Bank / payout details. Entirely missing from onboarding UI. `providerBankAccounts` table doesn't exist in schema.
- Step 10 — Address / place safety. No `providerHostPremises` table. Hosting host-place form absent.
- Step 11 — Availability. Not captured at onboarding.
- Step 12 — Pricing. Not captured at onboarding.

### Service types truncated (Step 5)
UI supports 4 (walker/sitter/driver/trainer). Spec lists 12 (adds station_assistant, dog_wash_support, grooming, mobile_grooming, pet_sitting_customer_home, pet_sitting_provider_place, overnight_hosting, transport, photography, delivery).

### Tax status enum truncated (Step 4)
UI dropdown 4 values (osek_patur / osek_murshe / company / not_registered). Spec has 7 (adds שכיר / individual / foreign / unsure). Business number / VAT status / can-issue-receipt / withholding cert all absent from UI.

### ID type enum truncated (Step 2)
UI dropdown 4 values (national_id/passport/drivers_license/disability_certificate). Spec has 7 (adds foreign_passport, permanent_resident, temporary_resident, work_visa, company_rep, other). Only ONE side of ID accepted (spec asks front+back).

### DATA-QUALITY BUG (silent field-name collision)
`server/routes/provider-onboarding.ts:919` — `petFirstAidNumber` (cert serial number) is written into `pet_first_aid_provider` (certifying body name) column. Every provider stored has the wrong data in the wrong column.

### Structured data lost to JSON dump
`provider_applications.internal_notes` receives (as stringified JSON):
- `providerTypes[]` multi-select (spec: structured column)
- Full `declarations{}` per-role checkbox map (13 declarations)
- `drivingLicenseNumber / Class / Expiry`
- Language

**Consequence:** SQL cannot answer "did they accept declarationValidVehicleInsurance vN?" or "list providers offering walker+sitter". Admin queue can't filter.

### ADMIN BLIND SPOTS (`ProviderKycReview.tsx`)
Displays only `kycDocumentType` + `kycIdLastFour`. Silently ignores:
- `taxStatus`, `insurancePolicyNumber`, `insuranceProvider`, `insuranceExpiresAt`, `insurance_cert_url`
- `dateOfBirth`, `ageConfirmed18Plus`, `kycDocumentExpiry`
- `enhancedVerificationReasons`, `requiresEnhancedVerification`
- `selfDeclarationNoRelevantConvictions/At/Ip`
- `declarationAttestation`, `declarationSignatureSha256`
- Every declaration inside `internal_notes` JSON

**Admins are approving providers blind to almost everything the provider filled in.**

### APPLICANT READ-BACK BLIND SPOTS (`/api/provider-onboarding/my/status`)
Returns 22 columns; hides 15 the applicant filled including all insurance data, tax status, residential history, criminal-check consent, declaration attestation, and internal_notes.

**Provider cannot see or verify what PetWash stored about them** (Israeli privacy-law liability).

### DECLARATIONS UNIVERSALLY BLOCKED
Every legal declaration in `shared/providerProtectionDeclarations.ts` is `reviewedByCounsel: false`.
`provider-declarations.ts:229` refuses to accept any unreviewed declaration → returns 409 PENDING_COUNSEL.
`providerDeclarationGate.ts` (consumed by payoutGate/escrow) requires those signatures.

**Payout gate is deadlocked by design until CEO's counsel reviews the declarations.**

### MULTI-ROLE HAZARD (Firebase claims overwrite)
5 endpoints overwrite Firebase custom claim `role: 'provider'` non-additively:
- `provider-onboarding.ts:1849, 2068`
- `provider-applications.ts:1410, 1609`
- `AdminProviderReviewService.ts:560`

DB scalar `users.role` is correctly preserved by post-login. But the Firebase claim is NOT — any client code that reads `claims.role` (e.g. `App.tsx:798`, `ProviderPending.tsx:111`, `useAccountNavigation.ts:115`) will treat a customer-who-became-provider as provider-only.

Symptom: after approval, customer flavor of the app cannot route the user via `role`-based checks — the provider claim wins.

### APPROVAL DOES NOT ACTIVATE CAPABILITY
`server/routes/provider-onboarding.ts:1773-1921` UPDATE-only on `provider_applications`; does NOT insert into `providers` table.
`AdminProviderReviewService.ts:560` only sets custom claims.

**Approved providers are missing from `providers` table** → booking eligibility / listing queries return them empty.

### LEGAL DECLARATION INVENTORY (40 pages)
- 40 pages under `client/src/pages/legal/*.tsx`. All bilingual via `useI18n()` (HE + EN in same file).
- 39 have NO checkbox. Only `CustomerTerms.tsx` has an acceptance gate.
- Every page renders a `DRAFT — pending review by licensed Israeli counsel` banner.
- Only 6 linked from `Footer.tsx`. The 34 deep declarations reachable via direct URL or `/legal` index only.
- 7 contract markdown templates under `server/templates/contracts/` — English only; Hebrew comes from `PROVIDER_DECLARATION_BY_KEY.bodyHe`. DocuSeal path exists but falls back to in-app attestation.

Signing evidence stored: userId, submissionId, templateSlug, documentType (`provider_declaration:{key}:{version}`), documentName, language, status, signerEmail, signerName, signedAt, completedAt, `certificateUrl=inapp-attestation:sha256:{hash}`, ipAddress, userAgent. Missing: device_id, app_version, tenant=IL, PDF snapshot binary.

---

## SECTION J — PROVIDER APPROVAL CHAIN (Agent 5, 2026-08-21)

Three separate admin-approve endpoints, none inserts into the marketplace `providers` table:

| # | Endpoint | Application table WRITTEN | providers row? | Marketplace-searchable? |
|---|---|---|---|---|
| A | `POST /api/provider-applications/admin/:id/approve` | `provider_applicants` (wrong table for capability aggregator) | **NO** | **NO** |
| B | `POST /api/provider-onboarding/admin/applications/approve` | `provider_applications` | **NO** | **NO** (walker/sitter/trainer profiles get flags but `providers.isActive` inner JOIN in `providerSearchService.ts` still fails) |
| C | `AdminProviderReviewService.approveApplication` (via `POST /api/provider-review/admin/approve/:id`) | `provider_approval_queue` + mirror to `provider_applications` | **NO** | Partial (walker/sitter/trainer profiles set, but `provider_services` NEVER seeded → per-service booking gate blocks unless legacy fail-open triggers) |

**Root cause:** `db.insert(providers)` / `INSERT INTO providers` returns ZERO writes anywhere in `server/`. Every "approved" provider is invisible to the marketplace inner-JOIN.

**Firebase custom claim `role: 'provider'` OVERWRITE:** all three endpoints spread `existingClaims` then set `role: 'provider'` — replaces `role: 'customer'` in claims. `users.role` DB scalar correctly preserved (multi-role contract) BUT client consumers (`ProviderPending.tsx:111`, `App.tsx:798`, `useAccountNavigation.ts:173-181`, `AdminRouteGuard.tsx:35,65`) read the claim as canonical.

**Zero transactional rollback.** Every side-effect wrapped in try/catch fallback; partial failure leaves the app row `approved` with no compensator.

Diagnostic SQL to identify historical broken approvals available in agent transcript (union across BOTH application tables — provider_applicants and provider_applications).

## SECTION K — BOOKING UNIVERSE DRIFT (Agent 6, 2026-08-21)

**Three declarations of `bookings` table:**
- `shared/schema.ts:8540` — varchar UUID PK — LIVE (used by marketplace-bookings + BookingLifecycleService)
- `shared/super-app-schema.ts:320` — serial int PK — ghost (imported only by `reviews.ts:22`)
- `shared/super-app-schema-v2.ts:346` — serial int PK — dead (no imports)

**Six first-class per-service tables** (`bookings`, `booking_requests`, `sitter_bookings`, `walk_bookings`, `trainer_bookings`, `pettrek_trips`) plus `octopus_bookings`, `escrow_holdings`, Firestore `bookings` collection. Nine parallel booking stores.

**Groomer bookings recorded in `contractor_earnings` as WALKER earnings** (`booking-requests.ts:3283`) — silent taxonomy corruption of provider earnings.

**PetTrek** is officially LEGAL_BLOCKED at 3 route layers yet `pettrek.ts:168` still inserts `pettrek_trips` and `pettrek.ts:588` still completes them.

**No delivery booking table or route exists** despite Agent 4's inventory listing "Delivery" as a service.

**Trainer_bookings** uses `booking_status` column while every other table uses `status` — bridge writer accounts for it at `legacyBookingBridge.ts:270` but no other consumer knows.

**Every legacy create fans out 3-5 mirror INSERTs**, wrapped in `try {}` — a bridge failure creates a row invisible to the provider inbox forever (mitigated only by an alert).

**Payout linkage split-brain:** `contractor_earnings.booking_id` = `booking_requests.requestId` when canonical `/confirm` fires; = `sitter_bookings.bookingId` / `walk_bookings.bookingId` when legacy `/complete` fires. Same booking, two rows, unique index doesn't dedupe because keys differ.

**No route unions the tables** — a customer with sitter+walker+trainer+marketplace bookings only sees them via 4+ separate endpoints. K9000 washes missing from every `my-bookings` endpoint (they live in `bay_sessions`).

## SECTION L — NOTIFICATION WIRING (Agent 7, 2026-08-21)

**THREE parallel dispatch stacks + one EventBus subscriber layer:**
- Stack A `PetWashNotificationEngine.dispatchNotifications()` — canonical (booking / payout / loyalty), retry, idempotency, consent-gated for marketing
- Stack B `dispatchNotification()` — receipts, promo, generic alerts, no retry, no idempotency, no consent
- Stack C `NotificationService.sendNotification()` — EventBus-driven, no consent, no retry (rows land in `notification_logs` with `retryCount=null` → `NotificationRetryService.sweep()` SKIPS them → every Stack C failure is permanent-and-invisible)

**Stack C bypasses consent entirely** — `booking.confirmed`, `booking.cancelled`, `booking.completed`, `provider_approved/rejected`, `loyalty.tier_upgraded`, `payout.issued`, `inventory.low`, `station.heartbeat_missed` all reach opted-out users. `loyalty.tier_upgraded` is arguably marketing.

**KYC applicant emails** at `provider-onboarding.ts:1432,1449,1462,1474` use raw `sgMail.send()` — no `EmailSpendGuard`, no fallback, no audit; failures only `logger.warn`. If SendGrid returns 5xx or is unconfigured, KYC applicants never hear their status.

**FCM identity mismatch:** `FCMService.ts:32` returns `false` when caller passes internal Postgres id vs Firestore uid mismatch. Multiple Stack A callers pass `providerUserId` where Firestore doc lives under a different key.

**`sendTopicPush()`** defined at `sendPush.ts:357` but has ZERO call sites — franchise/HQ topic broadcast is unimplemented.

**`refund_pending` was NOT transactional** → post-cancel refund notice silently blocked. **Fixed in PR #2020**.

## SECTION M — IDENTITY NAMESPACE DRIFT (Agent 5b, 2026-08-21)

**providerId polymorphism proven** — the column is `varchar` (Firebase UID) in `bookings`, `booking_requests`, `providerServices`, `providerRateCards`; `integer` (providers.id) in `super_app_bookings`, `availabilitySlots`, `providerLicenses`; `WALKER-UUID` / `SITTER-UUID` in walker/sitter profile tables.

**Smoking gun:** `sitter-suite.ts` writes stringified integer PKs into columns whose comment says "Firebase UID":
- line 404: `providerApprovalQueue.providerId = String(newSitter.id)`
- line 883: sitter lock keyed on int-string
- line 1243, 1656: `providerId = booking.sitterId.toString()`

Meanwhile the aggregator + payout gate compare Firebase UID. A sitter approved through the sitter-suite queue therefore appears in `providerApprovalQueue` as `"42"` but in `providerServices` as its Firebase UID. Two rows, two namespaces, same person.

**`approvedServices` custom claim written but NEVER read** — dead claim at `provider-applications.ts:1418, 1613`.

**signupIntent once-set-at-signup contract violated in 3 places:**
- `post-login.ts:532` — returning-customer who taps Become-Provider overwrites intent
- `post-login.ts:1025` (`chooseRole`) — unconditional overwrite on every call
- `access-requests.ts:121` — staff request unconditionally overwrites `signupIntent = 'staff_request'` + `userStatus = 'staff_pending_approval'`

**~14 server files re-implement admin/provider role checks** instead of calling the `userCapabilities` aggregator. List of RE-IMPLEMENTATIONS documented in agent transcript.

---

## APPENDIX — Fixes shipped this cycle (PRs post-CEO-directive)

- **#2009** — Israel timezone batch (birthday cron, paw-finder limit, 3 crons, finance date filter)
- **#2010** — ILIKE wildcard escape + drop `SELECT p.*` on public paw-finder
- **#2011** — Archaeology doc v1 + 3 dead deep-links
- **#2012** — Deep-link round 2 (5 more URLs)
- **#2013** — Admin platform-status dashboard Israel-local calendar day
- **#2014** — HubSpot no-op cleanup
- **#2015** — Provider `/my/status` returns 15 privacy-required fields
- **#2016** — GOOGLE_PLACES_LIVE CI/YAML conflict fix
- **#2017** — Date-picker min uses local calendar day (was UTC)
- **#2018** — Pet-first-aid cert serial no longer stored in provider-name column
- **#2019** — Deep-link round 3 (`/provider/dashboard` → `/provider-os`, admin station alert)
- **#2020** — `refund_pending` added to TRANSACTIONAL_EVENTS
- **#2021** (this) — archaeology doc round 2 (Sections J/K/L/M)

**Total this cycle: 13 PRs opened, 0 merged (per CEO §27 lock).**
