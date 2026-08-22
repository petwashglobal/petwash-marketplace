# Feature Flag Inventory (2026-08-22)

**Owner:** parent Claude session
**Source:** Lane D audit 2026-08-22 §5
**Purpose:** Every `*_ENABLED / FEATURE_ / ENABLE_ / DISABLE_` grep hit, one row each, classified so the CEO can decide the ones that need decisions and ops can fix the ones that are technical config gaps.

## Classification vocabulary (exact, per CEO §49)

| Class | Meaning |
|---|---|
| `INTENTIONAL-OFF` | The flag is off by design; do not activate |
| `MISSING-PROD-ENV` | Technical: env var probably meant to be `true` in prod, not `false` — fix in a config PR |
| `DEAD-FLAG` | Reachable code but no meaningful path if flipped; delete |
| `SAFETY-KILL-SWITCH` | Off = disable; on by default; flipped only during incident |
| `UNACTIVATED` | Feature built but not yet launched — needs CEO business decision |
| `UNKNOWN` | Real answer requires domain input from CEO |

## Server flags

| Flag | Default | Read at | Effect when OFF | Class | Action |
|---|---|---|---|---|---|
| `AI_CRONS_ENABLED` | off | `routes.ts:490`, `index.ts:1770,1780`, `backgroundJobs.ts:114,2218`, `services/GeminiWatchdogService.ts:115`, `services/ProductionWebsiteMonitorService.ts:360` | AI cron jobs (watchdog, website monitor) don't run | SAFETY-KILL-SWITCH | Keep off — governance (Gemini limits) |
| `LEGACY_MULTI_SERVICE_GIFT_ENABLED` | off | `routes.ts:7374` | Legacy multi-service gift path blocked | INTENTIONAL-OFF | No action |
| `FLASH_DEALS_ENABLED` | off | `routes.ts:12719-12723`; client `App.tsx:1780` via `VITE_FLASH_DEALS_ENABLED` | Server returns 503 FEATURE_DISABLED; client route unmounted | UNACTIVATED | **CEO decision** — dual gate confirmed |
| `CAPTCHA_PROBE_ENABLED` | off | `routes.ts:13005` | Captcha probe not exposed | INTENTIONAL-OFF | No action |
| `EXCEPTION_EMAIL_ENABLED` | off | `jobs/exception-email.ts:21` | Exception emails silenced | SAFETY-KILL-SWITCH | Keep off — spam prevention (ops runs the crank manually if needed) |
| `DAILY_CLOSE_REMINDER_ENABLED` | off | `jobs/daily-close-reminder.ts:21` | No daily close reminders | **MISSING-PROD-ENV likely** | **CEO decision** — is the daily close cadence still active? |
| `EXECUTIVE_DIGEST_ENABLED` | off | `jobs/daily-close-reminder.ts:410` | No exec digest | **MISSING-PROD-ENV likely** | **CEO decision** |
| `WASH_REMINDER_CRON_ENABLED` | off (`!== 'true'`) | `cron/wash-reminder.ts:110` | Wash reminder cron doesn't fire | UNKNOWN | **CEO decision** — customer-facing reminders being off is suspicious |
| `PETWASH_EGIFT_PURCHASE_ENABLED` | off | `routes/egift-guest.ts:33`, `routes/gift-cards.ts:358` | eGift purchase path returns 4xx | INTENTIONAL-OFF | Kill-switch during eGift issue |
| `CARE_NOTES_REMINDER_CRON_ENABLED` | off | `cron/care-notes-reminder.ts:214` | Care notes reminders don't send | **MISSING-PROD-ENV likely** | **CEO decision** |
| `HEALTH_WATCHDOG_DISABLED` | off (i.e. watchdog runs by default) | `cron/health-watchdog.ts:77` | Watchdog paused | SAFETY-KILL-SWITCH | Leave |
| `IDENTITY_UNIFIED_ENABLED` | off | `routes/post-login.ts:248` | Identity unification path skipped | UNACTIVATED | Awaiting CEO plan |
| `GOOGLE_WEATHER_ENABLED` | off | `services/unifiedLocationWeather.ts:150` | Falls back to non-Google source | INTENTIONAL-OFF | Cost |
| `SMS_EMERGENCY_DISABLED` | off (SMS on) | `TwilioSMSService.ts:316`, `SmsAbuseDetector.ts:111,132,316`, `integrationHealth.ts:135`, `routes/admin.ts:1448` | SMS sending killswitched | SAFETY-KILL-SWITCH (abuse-detector flips it) | Leave |
| `MAYA_OPS_TASKS_ENABLED` | off | `services/MayaOpsTasksService.ts:69` | Maya ops task creation skipped | UNACTIVATED | Awaiting CEO |
| `NAYAX_SUMIT_BRIDGE_ENABLED` | off | `services/nayaxSumitBridge.ts:40` | Bridge skipped | UNACTIVATED | Awaiting CEO — depends on SUMIT_ENABLED |
| `UNIFIED_VERIFICATION_DIAGNOSTIC_ENABLED` | off | `services/UnifiedVerificationService.ts:263` | Diagnostic no-op skipped | INTENTIONAL-OFF | Test-only |
| `BRIDGE_MVP_ENABLED` | off | `routes/admin-bridge.ts:36`; client `App.tsx:2578` via `VITE_BRIDGE_MVP_ENABLED` | Bridge admin UI unmounted | UNACTIVATED | Awaiting CEO |
| `PROVIDER_APP_API_ENABLED` | off | `routes/provider-app.ts:25` | Provider app API returns disabled | UNACTIVATED | Awaiting CEO (part of provider mobile) |
| `SUMIT_CUSTOMER_SYNC_ENABLED` | off | `services/SumitCustomerService.ts:56`, `routes/admin-sumit.ts:414` | Sumit customer sync doesn't run | **MISSING-PROD-ENV likely** | **CEO decision** — production billing needs it |
| `LYNX_CARD_MINT_ENABLED` | off | `services/LynxCardService.ts:43` | Card minting off | UNACTIVATED | Awaiting CEO |
| `LYNX_ENABLED` | off | `services/LynxClient.ts:55`, `routes/admin-lynx.ts:61` | Whole Lynx integration off | UNACTIVATED | Awaiting CEO |
| `LYNX_REFUND_ENABLED` | off | `services/LynxRefundService.ts:27` | Lynx refunds off | UNACTIVATED | Awaiting CEO |
| `CARD_VAULT_ENABLED` | off | `services/SumitCardVault.ts:22` | Card vault off | **MISSING-PROD-ENV likely** | **CEO decision** — payment retention |
| `SUMIT_DAILY_RECONCILE_ENABLED` | off | `services/SumitReconciliationService.ts:60` | Daily reconciliation skipped | **MISSING-PROD-ENV likely** | **CEO decision** — CPA-audit concern |
| `NAYAX_ENABLED` | off | `lib/integrationHealth.ts:209` (only used to require webhook secret) | If on w/o secret, missing-secret alert | UNKNOWN | Verify against `.env` |
| `SUMIT_ENABLED` | off | `SumitClient.ts:70`, `admin-brain.ts:389`, `integrationHealth.ts:210` | Sumit client returns disabled | **MISSING-PROD-ENV likely** | **CEO decision** — payments off |
| `SHOP_SHIPPING_WOLT_ENABLED` | off | `services/shop/DeliveryRouter.ts:153` | Wolt shipping option unavailable | UNACTIVATED | Awaiting CEO |
| `KIOSK_PRESTIGE_SYNC_ENABLED` | off | `routes/nayax-monyx-events.ts:44` | No prestige sync on kiosk events | UNACTIVATED (per code comment: "at launch the bay runs Nayax's Monyx 5+1 punch card, not our tier ladder") | Intentional Phase-16 gate |
| `NAYAX_CORTINA_ENABLED` | off | `routes/nayax-cortina.ts:68`, `NayaxCortinaClient.ts:44` | Cortina integration off | UNACTIVATED | Awaiting Nayax creds + per-bay TerminalId mapping |
| `BOOKING_REMINDER_CRON_ENABLED` | **ON by default** (`!== 'false'`) | `backgroundJobs.ts:276` | Only disabled if explicitly set to 'false' | SAFETY-KILL-SWITCH ✓ | Leave |
| `DAILY_REVENUE_REPORT_ENABLED` | off | `backgroundJobs.ts:366` | No daily revenue report | **MISSING-PROD-ENV likely** | **CEO decision** |
| `SHOP_ENABLED` | off | `routes/shop.ts:79` | Shop off | UNACTIVATED | Awaiting CEO |
| `SHOP_CHECKOUT_ENABLED` | off | `routes/shop.ts:290` | Shop checkout returns 4xx | UNACTIVATED | Awaiting CEO — matches client |
| `UNIFIED_BOOKING_ENABLED` | off | `routes/unified-booking.ts:44` | Unified booking route rejects | UNACTIVATED | Awaiting CEO |

## Client flags (`VITE_*`)

| Flag | Default | Read at | Effect when OFF | Class | Action |
|---|---|---|---|---|---|
| `VITE_SHOP_LIVE_ENABLED` | off | `App.tsx:1260,1265`, `pages/ShopStore.tsx`, `ShopOrders.tsx` | Shop routes not mounted | UNACTIVATED | Matches server SHOP_ENABLED |
| `VITE_PET_ONBOARDING_SHELL_ENABLED` | off | `App.tsx:1518` | Shell route not mounted | UNACTIVATED | Awaiting CEO |
| `VITE_FLASH_DEALS_ENABLED` | off | `App.tsx:1780` | Flash deals route not mounted | UNACTIVATED | Matches server |
| `VITE_BRIDGE_MVP_ENABLED` | off | `App.tsx:2578` | Bridge admin UI not mounted | UNACTIVATED | Matches server |
| `VITE_PREMIUM_PLATFORM_CARDS_ENABLED` | **ON** (`!== 'false'`) | `pages/Landing.tsx:230` | Premium cards on by default | SAFETY-KILL-SWITCH | Leave |
| `VITE_FEATURE_SOCIAL_AUTH_FIXES` | **ON** (`!== 'false'`) | `lib/firebase.ts:102` | Social auth fixes active by default | SAFETY-KILL-SWITCH | Leave |
| `VITE_FIREBASE_PERFORMANCE_ENABLED` | off | `lib/firebase.ts:103` | Firebase Perf monitoring off | INTENTIONAL-OFF | Comment says "verify first" |
| `VITE_PET_ICONS_ENABLED` | off | `lib/petIconRegistry.ts:95` | Uses emoji fallback | UNACTIVATED | Waiting on cut-out assets |

---

## Priority CEO decision list

Only flags whose CEO answer would meaningfully move money or ops, in the order the CEO benefits most from deciding:

1. **`SUMIT_ENABLED`** — is Sumit actually live in prod? Zero receipts / customer-sync / reconciliation are running if false.
2. **`SUMIT_DAILY_RECONCILE_ENABLED`** — CPA-audit blocker if not on.
3. **`SUMIT_CUSTOMER_SYNC_ENABLED`** — every new customer in prod invisible to Sumit's directory if not on.
4. **`CARD_VAULT_ENABLED`** — required for recurring / saved-card flows.
5. **`DAILY_REVENUE_REPORT_ENABLED`** — the exec team's daily number.
6. **`DAILY_CLOSE_REMINDER_ENABLED`** + **`EXECUTIVE_DIGEST_ENABLED`** — CEO-facing daily reminders.
7. **`WASH_REMINDER_CRON_ENABLED`** + **`CARE_NOTES_REMINDER_CRON_ENABLED`** — customer engagement crons.

CEO answer for each is one of: (a) YES — turn on in prod env vars; (b) NO — mark INTENTIONAL-OFF here and leave; (c) NEEDS-INVESTIGATION — investigate before deciding. Everything else in the tables above is either already correctly classified or awaiting a bigger business decision (Flash Deals, Shop, Lynx, Bridge — all UNACTIVATED features).

## No-merge freeze

Docs only. No app-code delta. No env-var change until CEO answers above.
