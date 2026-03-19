# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is an enterprise platform aiming to be the leading global luxury pet care provider, starting in Israel. It offers a scalable ecosystem for IoT wash stations, pet sitting, walking, and AI-powered pet avatar creation. The platform centralizes authentication, payments, AI services, compliance, and franchise management, supported by a 7-Star Loyalty System and robust security. The business vision is to be the global leader in luxury pet care, with initial market focus and operations in Israel.

## User Preferences
Preferred communication style: Simple, everyday language.

CRITICAL RULE: Never make layout or styling changes without explicit user approval - user gets extremely upset when changes are made to working designs.
BUTTON TEXT CONTRAST RULE: Dark/black background buttons MUST ALWAYS have white text. Never use text-gray-* on default variant shadcn Buttons (which have dark gradient backgrounds). If a button needs gray text on a light background, use variant="ghost" or variant="outline". This applies site-wide as an absolute rule.
BACKGROUND COLOR RULE: User explicitly requires PURE WHITE backgrounds only - NO cream, off-white, warm tones, or gradients. Always use bg-white (#FFFFFF).
VIOLATION WARNING: User explicitly said "don't ever touch the top part" referring to header layout. Any changes to header without permission will cause severe user frustration.
USER EXPLICITLY FORBID: Touching header layout, logo positioning, social media icons, hamburger menu, or language toggle without explicit permission.

**HOMEPAGE MODIFICATION ABSOLUTELY FORBIDDEN:**
- **NEVER** change Landing.tsx/Home.tsx without EXPLICIT clear instructions
- **NEVER** remove components from homepage (especially PetWashDivisions - it provides luxury gradient colors)
- **NEVER** assume what should/shouln't be on homepage
- Homepage has rich luxury colors and beautiful design - DO NOT TOUCH IT
- User will give CLEAR instructions if homepage needs changes
- Violating this causes extreme user frustration
BRANDING MANDATE: Only use official PetWash™ logo with TM trademark (Download PetWash_Logo_HighRes_1762743316767.png at /brand/petwash-logo-official.png - 891KB high-res version). Never create custom logos or use unofficial designs. Logo MUST include legal TM symbol. Logo is embedded as base64 in all emails for universal display across iOS Mail, Android Gmail, Outlook, and web clients.

HOMEPAGE CONTENT GUARD - CRITICAL:
- **Master Source**: `src/brand/petwash-homepage-content-guard-2025.ts` contains ALL approved homepage wording
- **Hebrew Hero Text**: "מהפכה בטיפוח ושטיפת חיות המחמד בשירות עצמי" (title), "מהיר, קל, 24/7" (subtitle), "שמפו אורגני 100% עם שמן עץ התה האוסטרלי. דוחה מזיקים, אנטיבקטריאלי ומרגיע לחבר הטוב ביותר שלך." (description)
- **Implementation**: All homepage text rendered via `client/src/lib/i18n.ts` translation keys
- **Rule**: NEVER change these exact Hebrew phrases without explicit user approval - they are final creative direction, not suggestions

LANGUAGE STRATEGY FOR ISRAELI MARKET:
- **Primary Language**: Messages, notifications, and communications to Israeli users and local partners should be MAINLY in Hebrew
- **Brand Touches**: Include touches of English to maintain cool, luxury, leading lifestyle, global brand image
- **Target Balance**: Primarily Hebrew content with strategic English phrases/terms that enhance the premium brand positioning
- **Current Operations**: Israel only (expanding globally in future)
- **PR & Blog Coverage**: Actively seeking international blog mentions and press coverage in approved countries, with focus on Israel where operations currently exist

LANGUAGE COMPLIANCE RULE:
- **English ONLY** can mix other languages minimally for branding/PR/luxury positioning
- **Hebrew, Arabic, Russian, French, Spanish**: Must be 100% pure translations - NO English words except brand names (Pet Wash™, K9000™, etc.)
- **Rationale**: Israeli users deserve full Hebrew experience. English can show off globally, but Hebrew/other languages must respect native speakers
- **Correct Approach**: Use t() function for all UI text, only brand names stay in English

FRANCHISE MARKETING CRITICAL RULE:
- **Franchise Success Stories**: MUST ONLY feature international clients from Canada, USA, Australia, England - NEVER Israel
- **Reason**: PetWash™ is not yet officially open for franchise operations in Israel
- **Currency Formats**: Use appropriate local currencies (CAD, USD, AUD, GBP) - NO Israeli Shekels (₪) in franchise materials
- **Geographic Focus**: All franchise location examples, testimonials, and revenue figures must reflect international markets only
- **Copy Language**: Use "global franchise opportunity" not "Israel-specific" language in franchise materials

ABSOLUTE REQUIREMENT: Layout must remain 100% consistent across ALL 6 languages and pages:
- Language changes (Hebrew, Arabic, Russian, French, Spanish, etc.) MUST NEVER affect position of ANY object on ANY page
- Hamburger menu ALWAYS stays in top right position on all devices (desktop, tablet, mobile)
- Mobile menu sheet ALWAYS slides in from RIGHT side regardless of language (Hebrew RTL or English LTR)
- Social media icons, logo, buttons, content blocks must NEVER move when language changes
- All UI elements maintain exact same positioning, spacing, and alignment across all languages
- Text direction changes (RTL/LTR) must ONLY affect text flow, NOT layout positioning
- Navigation structure must provide unified, predictable experience for all users
- NO future updates should change or interfere with this layout consistency rule

**GOOGLE PLACES AUTOCOMPLETE RULE:**
- **ALWAYS** use `GooglePlacesAutocomplete` component (`client/src/components/ui/google-places-autocomplete.tsx`) for ALL address input fields
- **NEVER** use regular Input for address fields - users expect instant autocomplete with auto-fill
- Component auto-fills: street, city, postal code, country from Google Places API
- Default restriction: Israel (`country={['il']}`) - expand as needed for international forms
- Import: `import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";`

## System Architecture

### Production Deployment
- **Development Environment**: Replit workspace (DEV ONLY).
- **Production Pipeline**: GitHub → Google Cloud (Firebase Hosting / Cloud Run).
- **Source Control**: GitHub repository `petwashglobal/petwash-marketplace`.
- **CI/CD Pipeline**: Automated GitHub Actions deployment (`.github/workflows/petwash-ci.yml`) with a 5-guard protection system.
- **CRITICAL DEPLOYMENT RULE**: Replit URLs are for development only and must not be connected to production domains. Production domains point to Firebase Hosting.

### Feature Additions (March 2026)

**Flash Deals Marketplace** — `server/routes/provider-flash-deals.ts` + `client/src/pages/FlashDeals.tsx`
- In-memory store (Map) with 9 demo deals seeded at startup (2 dogs + 1 cat weekly scenarios)
- Urgency scoring, slot-claim endpoint (`POST /api/flash-deals/:id/claim`)
- Airbnb-style urgency UI, slot fill bar, pet/service filters, animated card grid
- For multi-instance production: move store to Redis

**Daycare Smart Calculator** — `server/routes/daycare-calculator.ts` + `client/src/pages/DaycareCalculator.tsx`
- Multi-pet pricing (dogs + cats), multi-pet discount (8–18%), weekly discount (12%)
- Flash deal stacking, VAT 18%, Gemini AI Hebrew/English explanation
- `GET /api/daycare-calculator/rates` — public rate table
- `POST /api/daycare-calculator/calculate` — compute + AI breakdown

**Google Sheets Booking Sync** — wired non-blocking in `server/routes/bookings.ts` confirm route
- On `POST /:bookingId/confirm`, calls `logSitterBooking` via `setImmediate` (non-blocking)
- Failures are logged as WARN — never block the confirmation response

**SEO 2026 Upgrade** — `client/index.html`
- Expanded `@graph` JSON-LD: Organization + WebSite (SearchAction) + LocalBusiness (OfferCatalog) + MobileApplication + FAQPage
- Flash Deals + Daycare Calculator FAQs for featured snippet eligibility
- Twitter/OG cards updated: flash deals, daycare calculator, `@petwashltd` attribution
- Keywords: flash deals pets, daycare calculator pets, K9000 pet wash, pet care app israel

### Stabilization Changes (March 2026)
Addresses Phase 1 of the formal stabilization plan:

**Fixed: Duplicate API route** — `GET /api/locations` was registered twice in routes.ts (lines 4033 + 8829). The dead copy at 8829 (which used `super-app-schema` DB join) was removed. The live route at 4033 (using `stationsService.getAllStations()`) remains.

**Fixed: replitAuth.ts startup crash** — The module previously threw `Error("REPLIT_DOMAINS not provided")` at import time, crashing the server on Cloud Run/Docker. Now gracefully disables Replit OAuth with a warning and registers 503 stub routes for `/api/login`, `/api/callback`, `/api/logout`. Firebase Auth is the production identity provider.

**Fixed: Replit connector graceful degradation** — Five services used `REPLIT_CONNECTORS_HOSTNAME` + `X_REPLIT_TOKEN` to proxy Google APIs and would crash requests in non-Replit environments:
  - `server/routes/gmail.ts` — `getGmailAccessToken()` now returns `null` (logs warning, `sendViaGmail` returns `false`)
  - `server/services/CalendarIntegrationService.ts` — returns `null`, caller methods return `null`/`false`
  - `server/services/GoogleCalendarIntegrationService.ts` — returns `null`
  - `server/services/googleSheetsIntegration.ts` — returns `null`
  - `server/services/googleDriveBackupService.ts` — throws descriptive error (caught by existing try-catch in backup routes)
  - Added `server/lib/replitConnector.ts` — shared utility for Replit connector auth with clear Cloud Run migration docs.

**Fixed: Marketplace booking payment (Blocker 1)** — The checkout endpoint had a `TODO: Generate real Nayax payment URL` comment and returned a hardcoded placeholder path. Now:
  - `server/services/NayaxOnlinePaymentService.ts` — new service for hosted Nayax payment pages. Calls `https://api.nayax.com/online-payment/v1/sessions`. HMAC-SHA256 webhook verification. Demo mode when `NAYAX_API_KEY` + `NAYAX_MERCHANT_ID` absent.
  - `server/routes/marketplace-bookings.ts` — checkout endpoint now calls `NayaxOnlinePaymentService.createPaymentSession()` and returns real `paymentUrl` + `paymentSessionId`.
  - `server/routes/nayax-webhooks.ts` — added `POST /api/webhooks/nayax/payment` handler. Verifies signature, updates booking to `pending_confirmation` on success, records status history.

**Required env vars for live marketplace payments:**
```
NAYAX_API_KEY         — merchant API key
NAYAX_MERCHANT_ID     — merchant account ID
NAYAX_WEBHOOK_SECRET  — HMAC secret for webhook verification (optional, strongly recommended for production)
NAYAX_ONLINE_API_URL  — (optional) override, default: https://api.nayax.com/online-payment/v1
APP_URL               — public base URL (e.g. https://petwash.co.il)
```

**For Cloud Run deployment (replace Replit connectors):**
```
GOOGLE_SERVICE_ACCOUNT_JSON  — Google service account JSON for Drive/Sheets/Docs backup
GOOGLE_CLIENT_ID             — OAuth client ID for Gmail integration
GOOGLE_CLIENT_SECRET         — OAuth client secret for Gmail integration
```

### Core Features & Design Decisions
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite. Emphasizes responsive, mobile-first, luxury design with glassmorphism and Apple-style animations, supporting bilingual direction-aware layouts. iOS PWA support is included.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching.
- **Authentication & User Management**: Firebase Auth with Twilio SMS, WebAuthn/Passkey, RBAC, biometrics, GDPR compliance. Includes mandatory MFA for admin roles and email verification for critical actions. Features a robust user status state machine, authorization gates for roles and MFA, and an audit trail for critical actions.
- **AI Chat Assistant**: Google Dialogflow CX with Gemini 2.5 Flash, bilingual (Hebrew/English), WCAG 2.1 AA compliant.
- **Real-Time Booking Chat** (570-line spec, fully implemented): Production-grade WebSocket chat per spec §1-19.
  - **Inbox** (`BookingChatInbox.tsx`): Active/Archived tabs, unread pills, platform badges, skeleton loaders, empty states.
  - **Chat** (`BookingChat.tsx`): Typing indicators (WS `chat_typing_start/stop` + `chat_typing_presence`), read receipts (CheckCheck), image upload (multer → Firebase Storage → `POST /:bookingId/upload` → `imageUrl` sent as `messageType: "image"`), full-screen image viewer, AI Draft (Gemini last 10 msgs prefills composer), AI Summarize (Gemini last 30 msgs → SummaryPanel), overflow MoreVertical menu (report/block/help), Block User Sheet (standalone bottom sheet), Report Message Dialog, service type badge in header, provider quick actions bar (6 buttons, collapsible), system message chips, rate limiting (10/60s), contact info detection + flagging (§7), soft delete, iOS safe-area padding.
  - **Backend routes**: `open`, `send`, `read`, `upload`, `ai-draft`, `ai-summarize`, `report`, `provider-arriving`, `no-show`, `dispute`, admin moderation.
  - **WebSocket events**: `chat_typing_start/stop` → `broadcastTypingInternal` → `chat_typing_presence`; `booking_chat_message`, `booking_chat_read`, `booking_chat_status`; auto-expire typing after 5s.
  - Routes: `/booking-chat/inbox` and `/booking-chat/:bookingId`.
- **Marketplaces**: Unified system for The Sitter Suite™, Walk My Pet™, PetTrek™, and The Plush Lab™ (AI avatar creator).
- **Loyalty Program**: 7-tier system, e-gift cards, wash packages, Apple Wallet integration.
- **E-Signature**: DocuSeal with Hebrew RTL support; custom system for Israeli subcontractor agreements.
- **Enterprise Features**: Multi-country/currency support, franchise management, IoT monitoring (K9000 integration), secure document management, KYC workflow, automated bookkeeping, Israeli Tax Compliance, bank reconciliation, invoicing, and VAT reclaim.
- **Payment Gateway Architecture**: Nayax Israel is the exclusive payment gateway with a 72-hour escrow period. Includes a prepaid wallet model where K9000 terminal payments credit the in-app wallet.
- **Unified Luxury Booking System**: Enterprise-grade booking with loyalty tiers, policies, 72-hour escrow, GPS activation, multi-driver dispatch, IoT unlock tokens, dynamic surge pricing, and progressive provider payouts. All financial writes utilize the "Octopus Global Brain Engine" with atomic wallet debit/credit, immutable financial ledger, and idempotency protection.
- **Employee Expense Management System**: Israeli Tax Authority compliant with OCR receipt scanning and cryptographic audit trail.
- **Document Management System**: RBAC, Google Cloud Storage integration, access audit logging, and DocuSeal e-signature.
- **Legal & Compliance Systems**: Routes for privacy, data rights, GDPR, Israeli Privacy Law 2025, e-signature, contract management. Includes a GDPR/Israeli Privacy Law 2025 automated purge engine.
- **HR & Employee Systems**: Routes for employee management, hierarchy, onboarding, auto-approval workflows, and WhatsApp notifications.
- **Enterprise Route Infrastructure**: Extensive route files for various business units (franchise, finance, HR, operations, sales CRM, accounting, expenses, documents, compliance, audit, contracts, and signatures), organized into Head Office, Franchise, Customer, and Shared units.
- **Israeli Contractor Compliance System**: Marketplace broker model designed to prevent employee misclassification, including tax verification, National Insurance tracking, commission calculation, independence scoring, compliance audits, risk monitoring, and SHA-256 audit trails.
- **Security & Compliance**: Google reCAPTCHA v3, Firebase App Check, performance monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025, AI monitoring, GDPR consent, blockchain-style audit trail. Optional/Mandatory 2FA (SMS + Email, TOTP authenticator). Transaction OTP verification for high-value operations. A dedicated security events service logs various security-related incidents.
- **Consent Engine**: Manages user consents with SHA-256 evidence hash generation, immutable snapshots, and role-based consent requirements.
- **File Storage**: Google Cloud Storage bucket `petwash-secure-documents` for documents, Firebase Storage bucket `signinpetwash.firebasestorage.app` for biometrics. Admin users with `view_documents` permission can access documents via `/api/documents`.
- **Membership ID System**: 3-Class Membership ID (PWM, PWP, PWS) with collision-safe generation.
- **OTP Phone Verification**: Multi-channel (SMS/WhatsApp) with SHA-256 hash storage, rate limiting, Redis caching.
- **Google Places Backend Proxy**: All Places API calls proxied through backend endpoints to restrict Google Maps JS SDK usage on the frontend.
- **Unified Voucher System**: Production-grade fintech engine for WASH_PACKAGE and PLATFORM_CREDIT instruments, using ES256 JWS signatures, 3-minute QR tokens with anti-replay, and a hash-chained append-only ledger.

## External Dependencies
- **Database & ORM**: @neondatabase/serverless (PostgreSQL), drizzle-orm.
- **Frontend Frameworks**: @tanstack/react-query, @radix-ui/*, tailwindcss, vite.
- **Payment Gateway**: Nayax Israel.
- **Analytics & Marketing**: Google Analytics, Google Tag Manager, Facebook Pixel, TikTok Pixel, Microsoft Clarity, Google Ads.
- **Geolocation**: ipapi.co, ip-api.com, ipinfo.io.
- **Firebase Ecosystem**: Firebase (Auth, Firestore, Storage, App Check, Performance Monitoring).
- **CRM**: HubSpot.
- **Email**: SendGrid.
- **Cloud Storage**: @google-cloud/storage.
- **Utilities**: qrcode, PassKit, googleapis.
- **Messaging**: Meta WhatsApp Business API, Google Firebase Cloud Messaging (FCM), Twilio (for SMS/WhatsApp).
- **Banking Integration**: Mizrahi-Tefahot Bank (via aggregator API).
- **Weather & Environmental Data**: Open-Meteo API, Google Weather API, CurrentUVIndex.com API, Open-Meteo Air Quality API.
- **E-Signature**: DocuSeal (@docuseal/api).
- **Mapping & Location**: Google Maps API.
- **AI & Vision**: Google Cloud Vision API, Google Gemini AI, Google Cloud Translation API, Google Dialogflow CX.
- **Business Management**: Google Business Profile API.
- **Google Forms Integration**: Admin-configurable embedded Google Forms (`GOOGLE_FORM_WALKER`, `GOOGLE_FORM_SITTER`, `GOOGLE_FORM_DRIVER`, `GOOGLE_FORM_GROOMER`, `GOOGLE_FORM_TRAINER`, `GOOGLE_FORM_STATION`, `GOOGLE_FORM_GENERAL` env vars; returns `null` if not configured).

## Known Configuration Items
- **SendGrid**: API key valid but zero email credits — requires billing plan activation at SendGrid dashboard
- **DKIM propagation**: `em193.petwash.co.il`, `s1._domainkey.petwash.co.il`, `s2._domainkey.petwash.co.il` CNAMEs propagating via Internic (30min–48hr)
- **Click tracking DNS**: Add `url5717.click.petwash.co.il` and `56671012.click.petwash.co.il` CNAME → `sendgrid.net` at Internic
- **Twilio SMS**: `SMS_EMERGENCY_DISABLED=true` still set; remove once Twilio account reinstated
- **Google Cloud DPA**: Set `GOOGLE_CLOUD_DPA_ACCEPTED=true` after signing Google Cloud DPA (required for Vision API, Cloud Storage biometric, receipt OCR)
- **Nayax payments**: `NAYAX_API_KEY` not configured — payment terminal features disabled
- **ITA integration**: `CLIENT_ID`/`CLIENT_SECRET` not set — Israeli Tax Authority integration disabled
- **DocuSeal**: `DOCUSEAL_API_KEY` not configured — demo mode only
- **ReceiptOCR**: `GOOGLE_APPLICATION_CREDENTIALS_JSON` is an API key, not service account JSON — non-blocking error
- **Redis**: `REDIS_URL` not configured — using in-memory fallback for rate limiting/caching

## Firestore Indexes (Created March 2026)
The following composite indexes were created via REST API and may still be building:
- `bookings`: `customerId ASC + createdAt DESC`
- `bookings`: `providerId ASC + createdAt DESC`
- `bookings`: `customerId ASC + platform ASC + createdAt DESC`
- `bookings`: `providerId ASC + platform ASC + createdAt DESC`
- `pets` (collection group): `deletedAt ASC + createdAt DESC`

## QA Verified (March 2026)
- Health endpoint ✅
- Firebase Admin SDK (Gemini 2.5 Flash, Vision API, K9000 LED) ✅
- Booking create/list/availability ✅ (Firestore + PostgreSQL)
- Pet profiles (Firestore `users/{uid}/pets`) ✅
- Privilege Club registration (`PWP-XXXX-XXXXXX` → `privilege_members`) ✅
- Provider intake (auto-approve → `provider_intake_queue` → Google Sheets) ✅
- Onboarding email verification (503 when SendGrid unavailable) ✅
- Referral link generation ✅
- Calendar (Google Calendar connected) ✅
- Notifications ✅

## Critical Bugs Fixed (March 2026 Session 3)
- **Loyalty gate removed from first-time booking**: `requireLoyaltyMember` removed from `POST /api/sitter-suite/bookings`, `POST /api/academy/bookings`, `POST /api/walks/book`, `POST /api/walks/emergency-request` — new users on all 3 platforms can now make their first booking without a prior loyalty record
- **Walker Dashboard 9 missing API endpoints added** to `server/routes/walk-my-pet.ts`: `GET /walker/requests`, `/walker/active`, `/walker/completed`, `/walker/earnings`, `/walker/reviews`, `/walker/achievements`, `POST /walker/accept/:walkId`, `/walker/reject/:walkId`, `/walker/start/:walkId` — all query `bookingRequests` table with `providerType='walker'`, returns formatted Walk objects
- **SitterDashboard 3 missing API endpoints added** to `server/routes/sitter-suite.ts`: `GET /sitter/requests`, `/sitter/earnings`, `/sitter/stats` — query `sitterBookings` + `sitterReviews` for the authenticated sitter provider

## Critical Bugs Fixed (March 2026)
- **Firestore pets path**: Fixed from invalid 2-segment `pets/{uid}` to valid 3-segment `users/{uid}/pets`
- **Booking create undefined metadata**: Fixed with conditional spread (`booking.metadata` could be undefined, Firestore rejects undefined values)
- **Booking notification method**: Fixed `NotificationService.sendBookingConfirmation` (non-existent) → `NotificationService.sendNotification`
- **Booking availability route order**: Moved `/availability` before `/:bookingId` to prevent Express dynamic param shadowing
- **Onboarding email 500 → 503**: Returns proper 503 Service Unavailable with `retryAfter: 30` when SendGrid fails
- **Provider intake placeholder URLs**: Replaced hardcoded `https://forms.gle/your-*-form` placeholders with `null` (controlled by env vars)
- **Firestore ignoreUndefinedProperties**: Added globally to Firestore settings in `firebase-admin.ts`

## Routing Regressions Fixed (March 2026 Session 2)
- **WalkerDashboard routing**: `App.tsx` now correctly routes `/walk-my-pet/walker/dashboard` → `client/src/pages/WalkerDashboard.tsx` (1050 lines, full walker tools) instead of the regressed `walk-my-pet/WalkerDashboard.tsx` (105 lines)
- **WalkTracking routing**: `WalkTracking` and `TrackMyPetLive` now correctly import `client/src/pages/WalkTracking.tsx` (622 lines, real GPS + Leaflet map) instead of the alias to the shallow `walks/TrackWalk.tsx` (96 lines)
- **walk-my-pet/OwnerDashboard**: Restored from original commit to full 370-line implementation with real API calls, active walk tracking, tabs for upcoming/past/recurring walks
- **All 4 Groomer pages built** (were always 37-line placeholder stubs): `GroomersProviderDashboard.tsx` (7-tab dashboard: today/requests/upcoming/history/earnings/clients/services), `GroomersCustomerDashboard.tsx` (upcoming/history/cancelled with review/rebook flow), `GroomersBook.tsx` (4-step booking wizard: service→date/time→pet→confirm), `Groomers.tsx` (browse/search marketplace with service and pet type filters)
## Performance Optimizations (March 2026)
- **Vite bundle splitting configured** (`vite.config.ts`): `rollupOptions.output.manualChunks` splits output into 7 named chunks — `vendor-firebase` (Firebase SDK), `vendor-react` (React + Wouter), `vendor-query` (TanStack), `vendor-ui` (Radix UI + lucide-react + react-icons), `vendor-maps` (Leaflet), `vendor-i18n` (i18next), `vendor-forms` (Zod + react-hook-form). Each chunk can be cached by the browser independently and downloaded in parallel; maps chunk is only loaded when navigating to WalkTracking
- **Leaflet CSS on-demand in WalkTracking** (`client/src/pages/WalkTracking.tsx`): Map initialization `useEffect` now calls `window.__loadLeafletCSS?.()` before creating the `L.Map` instance — Leaflet styles are injected lazily instead of blocking the initial render via `<head>`
- **GA4 measurement ID fallback** (`server/routes.ts`): Both Firebase config endpoints now fall back to `'G-B5W5GHJ5EN'` when `VITE_FIREBASE_MEASUREMENT_ID` env var is not set, ensuring Analytics always initializes correctly in all environments

## Booking & Engagement Improvements (March 2026 Session 4)
- **Manifest PWA compliance** (`client/public/manifest.json`): `lang` changed `"he"→"en"`, `dir` changed `"rtl"→"auto"` (RTL is UI concern not manifest); added `"id":"/"` for Android installability; split combined `"purpose":"any maskable"` into separate `"any"` + `"maskable"` icon objects (required by Lighthouse/Apple/Android); `"platform"` key replaced with `"form_factor"` per current W3C spec
- **SitterSuite pending_match step added** (`sitter-suite/BookingFlow.tsx`): Added 4th step `"pending_match"` between summary and confirmation matching WalkMyPet pattern; polls `GET /api/sitter-suite/bookings/:id/status` every 5s; stepper now shows 4 steps: פרטים / סיכום / התאמה / אישור; prevents booking confirming without provider acceptance
- **Pet auto-selection** (both BookingFlows): `useEffect` auto-selects the pet when user has exactly 1 registered pet, removing an unnecessary tap from the booking flow
- **Payment disclosure UI** (both BookingFlows): Summary step now shows payment method section with credit card icon, escrow protection banner ("no charge until after service"), and localized text from `paymentConfig.ts`
- **weather_consent orphaned step removed** (`walk-my-pet/BookingFlow.tsx`): Removed from `BookingStep` type and state machine — it was in the type but had no render block, causing dead-state risk
- **"What happens next?" added to confirmation screens**: Both flows now show post-booking instructions (walker confirms within 2hrs, SMS notifications sent)
- **Provider card trust signals** (`ProviderSearch.tsx`): Added `instantBook` (green/grey badge), `available` (pulsing green dot / grey "Busy today"), `responseTime` ("Responds in ~2 hrs") props with defaults; `BrowseWalkers` and `BrowseSitters` pass these through
- **Notification permission Apple compliance** (`useFCMNotifications.ts`, `NotificationPermissionPrompt.tsx`): `autoRequest` default changed `true→false` so push permission is never triggered on page load; prompt now hidden until `petwash_first_booking_complete` localStorage flag is set; flag is set when first booking confirmation completes in either flow

## TransactionEngine — Central Payment Orchestrator (March 2026 Session 7)
- **Engine**: `server/services/TransactionEngine.ts` — single orchestrator for all 4 monetary flows; delegates VAT math to `VATCalculatorService` and wallet ops to `WalletEngine` (no duplication)
- **4 flows implemented**:
  - **Flow A** `processK9000DirectSale()` — K9000 Nayax sale; VAT on full gross (MACHINE_DIRECT_SALE)
  - **Flow B** `processWalletTopUp()` — wallet credit; VAT DEFERRED at top-up, event fires at redemption (WALLET_TOPUP)
  - **Flow C** `processWalletRedeemK9000()` — Prestige Pass/wallet → K9000; VAT event triggered NOW (WALLET_REDEEM_K9000)
  - **Flow D** `processProviderBooking()` — two sub-modes per `VERTICAL_CONFIG`:
    - D1 `MARKETPLACE_COMMISSION` — VAT on platform commission only (Wolt/Uber model)
    - D2 `PRINCIPAL` — VAT on full gross; provider is sub-contractor
- **Mutations**: `processReversal()`, `processExpiryBreakage()` (breakage = platform revenue, VAT applied conservatively)
- **Idempotency**: all flows check `idempotency_key` before inserting; duplicate calls return cached row
- **Per-vertical config**: `VERTICAL_CONFIG` record in TransactionEngine.ts — one place for commissionRate, commercialModel, vatMode, processorFeeRate
- **New DB tables** (created via direct SQL):
  - `pw_payments` — one row per customer-facing money movement across ALL 4 flows; amounts in INTEGER CENTS
  - `pw_provider_payouts` — one row per provider settlement; tracks escrow release time (+72h), requires_tax_invoice, provider_is_exempt
  - Schema: `shared/schema-payments.ts` — includes Drizzle table defs, Zod insert schemas, type exports
  - Tables imported into `db.ts` combinedSchema + re-exported from `schema.ts` tail for drizzle-kit visibility
- **Finance-flow-types extended**: added `MACHINE_DIRECT_SALE`, `WALLET_REDEEM_K9000`, `WALLET_REDEEM_ONLINE`, `PROVIDER_BOOKING_CHARGE`, `PROVIDER_COMMISSION`, `REVERSAL`, `EXPIRY_BREAKAGE`, `CANCELLATION` (22 total transaction types); `isMarketplaceFlow` / `isDirectSaleFlow` guards updated

## Money Flow Classification System (March 2026 Session 6)
- **Type system**: `shared/finance-flow-types.ts` — 22 `TRANSACTION_TYPES` constants (extended in Session 7), `isMarketplaceFlow` / `isDirectSaleFlow` / `hasProvider` guards, `MarketplaceFeeBreakdown`, `DirectSaleFeeBreakdown`, `ReceiptMetadata`, `MoneyFlowSummary` interfaces, `ISRAELI_TAX_2026` constants
- **Two flows — never mixed**:
  - Flow A (marketplace_booking): Customer → Processor → VAT(on fee) → PlatformFee → Escrow → ProviderPayout — provider exists, escrow exists, provider tax section shown
  - Flow B (direct_platform_sale / egift_sale / wallet_topup): Customer → Processor → VAT(on full sale) → PetWash Revenue — no provider, no escrow, no provider tax explanation
- **DB changes**: `flow_type VARCHAR` column added to `transaction_records` and `nayax_transactions`, backfilled (is_gift_card=true → egift_sale, else direct_platform_sale)
- **Backend API**: `server/routes/finance/money-flow.ts` mounted at `/api/finance` — `GET /money-flow-summary` (aggregated KPIs split by flow), `GET /transaction-types` (counts per type). Protected by `requireRole` (admin/management/staff)
- **Visual page**: `/admin/money-flow` → `client/src/pages/MoneyFlow.tsx` — 4 tabs: Flow diagrams (A+B with formulas), KPI cards per flow, Transaction type glossary, VAT guide; Flow A shows provider tax explanation, Flow B explicitly labels what does NOT happen (no provider, no escrow, no provider tax)
- **AdminFinancial new tab**: "זרימת כסף / Money Flow" tab in `/admin/financial` — separated KPI grids for Flow A and Flow B, link to visual page, critical rule reminder
- **InsuranceAndProtection**: New `flowType` prop (default: `"marketplace_booking"`); provider tax section gated by `isMarketplaceFlow` — never shown for egift_sale / wallet_topup / direct_platform_sale receipts

## Provider Operations Console 2026 (March 2026 Session 5)
- **New route**: `/provider/console` (protected, minRole=provider) → `client/src/pages/ProviderConsole.tsx`
- **8-tab unified console**: Dashboard / Calendar / Bookings / Pricing / Settings / Performance / Safety / Kenzo AI
- **4 new DB tables created**: `provider_operational_settings` (PK: provider_uid, 24 fields covering all booking behaviour + notifications + capacity), `provider_blocked_list`, `booking_actions_log`, `provider_safety_notes` (unique index on provider_uid+subject_type+subject_id)
- **provider_rate_cards extended**: night/urgent/travel surcharges, repeat discount, cancellation policy (24/48/72h %), promo participation, size adjustments (S/L/XL)
- **Backend API file**: `server/routes/provider-console.ts` mounted at `/api/provider-console` — GET/PUT settings, CRUD blocked-list, CRUD safety-notes, GET/POST booking-actions (cascades status to walk/sitter booking tables), GET/PUT pricing per-platform, GET performance aggregate (completion/cancellation/acceptance rates + flagged messages count), POST `/ai/query` (Gemini 2.5 Flash with live context injection: upcoming bookings + settings)
- **Dashboard tab**: KPI cards (today/week/completion/acceptance rate), emergency alerts (holiday mode, emergency unavailable), Kenzo quick-query buttons + live chat input
- **Calendar tab**: Monthly grid (green=available, red=blocked, amber=holiday), emergency unavailable toggle, holiday mode date range picker, recurring weekly schedule grid (7 days × 3 slots), capacity controls (max jobs, buffer, simultaneous)
- **Bookings tab**: Sub-tabs (pending/active/completed/cancelled/disputed), per-booking action panel with all 10 actions (accept/reject/arrived/start/complete/cancel/unsafe-report) + reason code selector for cancellations/rejections
- **Pricing tab**: Per-platform rate card editor — base rates (hourly/visit/nightly), all surcharges, discounts, cancellation policy, promo toggle
- **Settings tab**: Full toggle controls for all 24 operational settings + notification preferences + capacity inputs
- **Performance tab**: KPI grid + bar chart (bookings by period) + rate progress bars + Gemini analysis paragraph
- **Safety tab**: Blocked list CRUD (block customer/address/pet with reason), safety notes CRUD (per customer/pet with risk level low/medium/high)
- **Kenzo AI tab**: 8 quick-action prompts + full chat interface with provider-context injection (live bookings + settings + today's date injected into Gemini system prompt)

## Provider OS — Full Operating System (March 2026 Session 7)
- **Route**: `/provider-os` — unified provider shell replacing scattered provider dashboards
- **Shell** (`provider-os/ProviderOS.tsx`): sticky top header with platform switcher (PetSitter/Walk My Pet/PetWash/Academy), availability quick-toggle, unread notification badge, user avatar. Desktop: 56px left sidebar. Mobile: bottom nav (Home/Jobs/Calendar/Wallet/More) + slide-up "More" menu.
- **10 modules built**:
  1. `POSDashboard.tsx` — real-time pulse: new requests (Accept/Decline), today's jobs, active now, finance strip, KPI row, **completeness card** (live score from `/api/provider-profile/me`, tappable → navigates to Profile tab, hidden when 100%), quick actions grid
  2. `POSJobs.tsx` — full booking pipeline: 7-status tabs (New/Pending/Confirmed/Active/Done/Cancelled/Dispute), platform filter, expandable job cards with all actions (accept, decline, start, finish, report, cancel-with-reason)
  3. `POSCalendar.tsx` — 3-tab: calendar (tap to block dates, vacation mode, pause bookings), weekly recurring schedule builder, advanced settings (buffer, max jobs/day, min notice, radius, instant booking)
  4. `POSWallet.tsx` — 4-tab: overview (wallet explainer + fee breakdown), transactions (per-booking gross/fee/net ledger), payout request (IBAN/bank form), monthly reports (CSV/Excel)
  5. `POSProfile.tsx` — **Real API** (GET/PATCH `/api/provider-profile/me`). 4-tab: Basic (bio, availability state selector, languages, service areas), Services (starting price in ILS → stored as agorot, pet type pills: dog/cat/rabbit/bird), My Home (fenced yard + no pets at home Yes/No toggles), Badges (background check + premium + top-rated — all driven by live DB data). Live completeness score bar (0-100%) with per-check breakdown. Header stats pulled from real `provider_profiles` row (rating, jobs, reviews). Save invalidates browse + stats caches.
  6. `POSSettings.tsx` — 4-tab: operational toggles (15 settings), notification alerts (6 channels), privacy settings (3 toggles), pet restrictions (5 toggles + max pets)
  7. `POSDocuments.tsx` — 3-tab: click-to-accept (6 docs with checkbox + audit trail), e-signature (8 docs with embedded DocuSign modal stub), provider uploads (5 doc types with camera/file upload + status badge)
  8. `POSNotifications.tsx` — filtered notification feed (All/Unread/Jobs/Payments/Documents/System), mark-all-read, per-notification delete, action CTAs
  9. `POSSafety.tsx` — 4-tab: report client (incident type form), block clients/addresses (with list management), emergency contacts + check-in timer, safety guidelines
  10. `POSAssistant.tsx` — full Gemini AI chat: 8 suggestion chips (Summarize day/Which job/Explain payout/Draft reply/Check docs/Pricing/Bio/Cancellation), provider stats injected into system prompt, typing indicator
- **Design**: white/gray functional theme consistent with PersonalInbox/Settings design system
- **Document workflow**: Click-to-accept = checkbox + SHA-256 audit trail. E-sign = DocuSign embedded iframe (no redirect). Both types clearly separated in UI.
- **Wallet logic**: marketplace flow (escrow → 48h hold → platform fee 18% + VAT 18% on fee → net payout). Direct platform revenue (K9000/e-gift) never shown in provider wallet.

## Financial Architecture — 19-Section Spec (March 2026 Sessions 8-9)
- **15 mandatory transactionType values** (all enforced): `marketplace_booking`, `direct_platform_sale`, `k9000_terminal_sale`, `provider_payout`, `platform_fee`, `egift_sale`, `egift_redemption`, `wallet_topup`, `wallet_redemption`, `refund`, `chargeback`, `escrow_hold`, `escrow_release`, `adjustment`, `tax_remittance`
- **schema-finance.ts**: `general_ledger` table has mandatory `transactionType` + `vatMode` columns; index `idx_gl_tx_type`
- **EGiftVatMode type**: `deferred_liability | taxable_sale` — default `deferred_liability` pending CPA confirmation
- **MoneyFlowSummary**: includes `totalWalletRedemptions`, `totalWalletRedemptionValueILS`, `totalPlatformRevenue`
- **VAT fix**: marketplace bookings now compute VAT as `platform_fee × 18%` (was hardcoded 0)
- **Transaction engine architect audit (2026-03-13)** — 5 issues found and fixed:
  1. **[CRITICAL] Escrow ownership gap** — `POST /:escrowId/release|refund|dispute` and `GET /:escrowId` now enforce that caller is the customer or provider of that specific escrow; 403 returned otherwise. `GET /booking/:bookingId` filters results to caller's own escrows only.
  2. **[CRITICAL] Prestige QR secret forgeable** — `PRESTIGE_QR_SECRET` env var now fails-fast with a startup `throw` in `NODE_ENV=production`; logs a `WARN` in dev with a clearly non-production fallback string.
  3. **[HIGH] K9000 double-charge** — `POST /api/k9000/wash/start_cycle` now checks `auditLedger` for any existing `k9000_wash_activated` event with the same `transactionId` before activating; returns HTTP 409 `ALREADY_ACTIVATED` if found.
  4. **[HIGH] K9000 revenue split** — `VATCalculatorService.calculateK9000Revenue()` and `recordK9000Transaction()` added. Every paid K9000 wash now writes to `k9000_revenue_ledger` Firestore collection with `netToProvider: 0`, `netToPlatform: netRevenue`, `revenueOwner: "petwash"`. VAT back-calculated from consumer-inclusive price: `vat = price × (0.18/1.18)`.
  5. **[HIGH] K9000 schema import gap** — `stations` table was used but not imported in `server/routes/k9000.ts`; fixed.
- **EscrowService**: `disputeEscrowPayment` sets `autoReleaseBlocked: true`; `autoReleaseExpiredHolds` skips disputed/blocked holds
- **Section 14 Finance Guards** (`server/middleware/financeGuards.ts`): 5 hard-block guards
  1. `requireProviderIdForPayout` — blocks `provider_payout` without `providerId`
  2. `blockProviderIdOnEgiftWallet` — blocks `egift_sale`/`wallet_topup`/`wallet_redemption` with `providerId`
  3. `blockPayoutIntentOnDirectSale` — blocks `direct_platform_sale` with payout intent
  4. `blockNegativeWalletBalance` — blocks wallet credit going negative (cents level)
  5. `requireVatAmountOnTaxableTypes` — blocks `direct_platform_sale`/`k9000_terminal_sale`/`platform_fee` with missing/zero `vatAmount`
  - **Wired in routes.ts**: `app.post('/api/finance/*', ...allFinanceGuards)` + `app.patch('/api/finance/*', ...allFinanceGuards)` — mounted before all `/api/finance/` sub-routers
- **MoneyFlow.tsx** (`/money-flow`): wallet_redemption KPI card, 3 new summary cards, eGift VAT mode advisory panel

## Immutable Legal Stamp System + User Dashboard Enrichment (March 2026 Session 10)

### Immutable Legal Stamps
- **`legal_stamps` table** (`shared/schema-finance.ts`): append-only, no updatedAt, no deletedAt — 7-year retention (IL VAT §17)
  - Fields: stampId (UUID PK), entityType, entityId, eventType, actorUid, actorRole, amountCents, currency, metadata (jsonb), previousStampHash, contentHash (SHA-256), signature (ES256), gcsPath, firestorePath, createdAt
  - Indexes: entity, actor, event, created
- **`ImmutableStampService`** (`server/services/ImmutableStampService.ts`):
  - Hash chain: SHA-256 of canonical string per entity (tamper detection)
  - ES256 signing (EC P-256 key pair)
  - GCS backup to `gs://petwash-legal-stamps/{year}/{month}/{entityType}/{stampId}.json` (async, non-blocking)
  - Firestore mirror to `legal_stamps/{stampId}` collection (async, non-blocking)
  - Methods: `createStamp()`, `verifyStamp()`, `verifyChain()`, `getStampsForEntity()`, `getStampsForActor()`
- **`server/routes/legal-stamps.ts`** mounted at `/api/legal-stamps`:
  - DELETE permanently blocked with 405 and legal retention message
  - GET /me, GET /entity/:type/:id, GET /:stampId, GET /:stampId/verify, GET /chain/:type/:id/verify, POST (admin only)
- **Auto-stamp triggers**:
  - Booking completion → `booking_completed` stamp (bookings.ts)
  - Settlement paid → `payout_sent` stamp (finance/settlements.ts)

### User Activity API
- **`server/routes/user-activity.ts`** mounted at `/api/user/activity`:
  - GET /summary — pets, upcoming bookings (sitter+walk), recent wallet transactions, stamp count
  - GET /bookings — full booking history across sitter + walk platforms
  - GET /pets — user's pets from customerPets table

### User Dashboard Enhancement (`/dashboard`)
- Query: `/api/user/activity/summary` — feeds new dynamic sections
- **My Pets section**: horizontal scroll cards with pet photo/name/species; Add button if empty
- **Upcoming Bookings section**: next 3 bookings with platform, date, status, amount (hidden if none)
- **Document Vault card**: shows stamp count with legal retention note; links to /my-account (shown only if stamps exist)
- All sections appear/disappear based on real data (no placeholder zeros)

### MyAccount Page Enhancement (`/my-account`)
- **Activity History section** (below existing tabs): full booking history with status color-coded badges, dates, amounts across sitter + walk platforms
- **Document Vault section** (below Activity): legal stamp list with SHA-256 hash preview, GCS badge, event labels in Hebrew/English, cryptographic verification info

## 2026 Codebase Audit & Modernisation (March 2026)

### VAT Rate Correction (Critical)
- Corrected Israeli VAT from 17% → **18%** (effective Jan 2025) across all 8 affected files:
  - `server/services/unified-booking/TransactionStampService.ts` — `ISRAEL_VAT_RATE = 0.18`
  - `server/services/unified-booking/UnifiedBookingEngine.ts` — `ISRAEL_VAT_RATE = 0.18`
  - `server/services/unified-booking/types.ts` — all 5 `SERVICE_CONFIGS` entries
  - `server/routes/unified-booking.ts` — fallback `vatRate: 0.18`
  - `server/routes/accounting-export.ts` — Hebrew VAT note updated
  - `server/services/BookingExportService.ts` — type, AI default, vatRate, column header, AI prompt context
  - `server/utils/walkFeeCalculator.ts` — comment updated

### Security Upgrades
- **MD5 → SHA-256** for ETag generation in `server/middleware/performance-2025.ts`
- **http:// → https://** for two external API calls:
  - `server/services/GeolocationService.ts` — `ip-api.com`
  - `server/services/MultiSourceWeatherService.ts` — `api.weatherapi.com`

### Copyright & Date Updates (© 2025 → © 2026)
- `client/src/components/LegalFooter.tsx`
- `client/src/pages/legal/PrivacyPolicy.tsx`
- `client/src/pages/legal/Disclaimer.tsx`
- `client/src/pages/legal/TermsConditions.tsx`
- `client/src/pages/PlatformHub.tsx`
- `server/email/templates/backend-team-invitation-2025.ts`

### Promotions Calendar (SPECIAL_DAYS_2025 → SPECIAL_DAYS_2026)
- All 12 promotion entries in `server/services/globalPromotions.ts` updated to 2026 calendar dates
- Floating holidays correctly recalculated: UK Mother's Day (Mar 22), US Mother's Day (May 10), Father's Day (Jun 21), Black Friday (Nov 27), Cyber Monday (Nov 30)
- Export renamed to `SPECIAL_DAYS_2026`; `server/routes/promotions.ts` updated to import via alias

### Other Stale Data
- `client/src/lib/i18n.ts` — privilege club milestone date `'2025'` → `'2026'`
- `server/routes/ceo-wallet.ts` — default launch date `'November 7, 2025'` → `'November 7, 2026'`

## Routing & Security Hardening (March 2026 Session 8)

### Route Double-Nesting Fixes
The following route files had hardcoded `/api/` prefixes in their route handlers while also being mounted under `/api/...` paths, causing all routes to become inaccessible (double-nested):
- **`security-status.ts`**: `router.get('/api/security/status')` → `router.get('/status')`, mount changed `/api/security-status` → `/api/security`. Effective path: `/api/security/status` ✓
- **`send-report.ts`**: `router.post('/api/send-platform-report')` → `router.post('/send-platform-report')`. Effective path: `/api/send-report/send-platform-report` ✓
- **`walk-payment-flow.ts`**: All 6 routes had `/api/` prefix while mounted at `/api/walk-payment-flow`. Rewrote file: stripped all prefixes, mount changed to `/api`, removed broken `walk_slot_holds` DB dependency (table doesn't exist), replaced with graceful validation. Effective paths: `/api/payments/nayax/walk-session`, `/api/payments/nayax/redirect/:sessionId`, `/api/payments/nayax/webhook`, `/api/payments/nayax/webhook-simulate`, `/api/walks/by-payment/:sessionId` ✓
- **`expenses.ts`**: All 7 expense routes had `/expenses/` prefix while mounted at `/api/expenses` (e.g. `/expenses/ocr-receipt` → `/api/expenses/expenses/ocr-receipt`). Stripped all `/expenses/` prefixes. Also renamed `/config/tax-rates` → `/tax-rates`. Added `app.use('/api/config', ...)` mount so frontend's `/api/config/tax-rates` now resolves correctly ✓

### Missing Backend Routes Added
- **`/api/accounting/summary`** (GET): Returns monthly metrics (totalRevenue, platformFees, providerPayouts, escrowHeld), taxes (VAT at 18%), and compliance status. Used by `AccountingDashboard.tsx`
- **`/api/accounting/export/transactions`** (POST): Returns stub response (Google Sheets export pending integration)
- **`/api/accounting/export/compliance`** (POST): Returns stub response
- **`/api/accounting/export/escrow`** (POST): Returns stub response

### Security: Math.random() → Cryptographic APIs
Replaced ALL `Math.random()` usage in security-sensitive code with `crypto` module equivalents. Total: 17 instances across 13 files:
- **IDs & tokens (UUID/hex)**: `webauthn/service.ts` (challenge key), `KYCOrchestrator.ts` (verification ID), `voucherService.ts` (transaction ID), `websocket.ts` (client ID), `ProviderIntakeService.ts` (intake ID + invite code), `EmergencyWalkService.ts` (booking ID), `provider-intake.ts` (intake ID), `email/luxury-email-service.ts` (gift code), `observanceEvaluator.ts` (voucher code), `routes.ts` (contact ID)
- **Numeric IDs (randomInt)**: `ElectronicInvoicingService.ts` (invoice numbers ×2), `K9000StationBookingEngine.ts` (unlock token), `JobDispatchService.ts` (audit ID), `accounting.ts` (expense ID), `storage.ts` (application ID), `qrCode.ts` (barcode suffix)
- **Hash input entropy**: `provider-applications.ts` (SHA-256 token now seeded with `randomBytes(32)` instead of `Math.random()`)

## Phase 2 Monyx / Nayax Transaction Events (March 2026 Session 9)

### New DB Table: `nayax_transaction_events`
Created directly via raw SQL (not drizzle-kit migration). Schema also added to `shared/schema.ts`.
- Stores every Nayax payment event (Monyx QR, tap card, Apple Pay, PetWash wallet QR, Google Pay)
- `external_transaction_id` UNIQUE — primary dedup key
- `customer_phone_hash` — SHA-256 hashed, never raw phone
- `linked_petwash_user_id` — Firebase UID set by identity mapping
- 7 indexes covering machine, station, user, channel, status, transaction time

### New Webhook Handler: `server/routes/nayax-monyx-events.ts`
Registered at `POST /api/webhooks/nayax-events` and `POST /api/webhooks/nayax-events/identity-link`.
- HMAC-SHA256 signature validation via `NAYAX_WEBHOOK_SECRET` (already set as placeholder)
- **5-Rule loyalty award logic**: (1) approved status; (2) PetWash-owned machine; (3) not refunded/cancelled; (4) `linked_petwash_user_id` set; (5) deduplicated via UNIQUE constraint
- Points: 1 point per ₪1 ILS gross
- Refund reversal: deducts previously awarded points, sets `refund_reversed=true`
- Channel classifier: monyx_qr | petwash_wallet_qr | apple_pay | google_pay | tap_card | unknown
- Identity link endpoint: maps Monyx customer IDs + phone hashes to Firebase UIDs retroactively
- All 4 award updates atomic: `wallet_accounts.loyalty_points_balance` + `users.loyalty_points` (GREATEST 0 guard on reversals)

### Next Steps (Nayax coordination pending)
- Send 6 questions to Nayax: webhook delivery endpoint, event schema, auth header name, retry policy, test mode, Operator API access
- Add `NAYAX_API_KEY`, `NAYAX_MERCHANT_ID`, `NAYAX_SECRET`, `NAYAX_BASE_URL` to Cloud Run Secret Manager when received
- Replace `NAYAX_WEBHOOK_SECRET` placeholder with production value from Nayax

## routesReady Fix (March 2026 Session 9 — same session)

### Root Cause
Production Cloud Run revision `petwash-api-00281-jbz` showed `routesReady: false` indefinitely.
The 120-second `Promise.race` timeout in `server/index.ts` was firing before `registerRoutes(app)` completed.
routes.ts is ~14,000 lines with many GCP service initialisations that legitimately take >120s on a cold start.
When the timeout fired, the outer try-catch ran in production mode, silently set `serverReady = false`,
left `routesReady = false`, and the health endpoint continued to return HTTP 200 (misleadingly).
All non-health API routes were returning 503 `SERVICE_STARTING` indefinitely.

### Fix Applied (server/index.ts)
- Removed `Promise.race([routeRegistrationPromise, routeTimeoutPromise])` and the 120s timeout entirely
- Replaced with direct `await registerRoutes(app)` — Cloud Run's `--timeout=600` is the real safety net
- Added explicit `startupError` + `startupErrorAt` fields to `healthState.app` in the catch block
  so any future startup failure is visible in `/api/health` without needing Cloud Run log access
- Dev verification confirmed: `routesReady: true` immediately after the fix

## Prestige Pass / Wallet Engine Refactor (March 2026 — Multi-session)

### WalletEngine.ts (`server/services/WalletEngine.ts`)
Shared atomic wallet service extracted from prestige-pass.ts. All wallet deductions now go through one place:
- `computeDeductionOrder(amountCents, balances)` — applies deduction order: promo → egift → package_wash (kiosk) → cash_wallet → card_fallback
- `applyDeduction(db, userId, amountGross, serviceType, bookingId)` — atomic PostgreSQL transaction; returns breakdown with each source used
- `topUpCashWallet`, `creditWashPackage`, `adminManualCredit`, `getWalletBalances`, `getOrCreateWallet`

### Schema: `wallet_accounts` table additions
- `cashWalletBalanceCents` (int, default 0) — moved from Firestore `cashWalletCents` to PostgreSQL for atomicity
- `packageServiceUnitsRemaining` (int, default 0) — kiosk wash package counter
- Both added via raw `ALTER TABLE` (schema.ts updated accordingly)

### prestige-pass.ts refactored
- Removed inline deduction engine; imports WalletEngine for all deductions
- All balance reads/writes use PostgreSQL `cashWalletBalanceCents` (Firestore `cashWalletCents` is legacy-read-only)
- New endpoints added: `POST /generate-wallet-links`, `POST /issue-gift`, `POST /claim-gift`, `POST /revoke-pass`, `POST /admin/manual-credit`, `POST /admin/reissue`
- Admin endpoints require `X-Admin-Secret` header matching `ADMIN_SECRET` or `PRESTIGE_ADMIN_SECRET` env var

### PrestigePassPaymentOption.tsx (`client/src/components/PrestigePassPaymentOption.tsx`)
Premium dark/gold UI payment component. Shows balance breakdown, deduction preview, applies wallet payment via `/api/prestige-pass/redeem-online`.

### Booking Flow Wiring
`PrestigePassPaymentOption` inserted into checkout summary step of:
- `client/src/pages/sitter-suite/BookingFlow.tsx` (before Payment Method Disclosure, ~line 691)
- `client/src/pages/walk-my-pet/BookingFlow.tsx` (before Payment Method Disclosure, ~line 561)
Uses pending booking ref (`PENDING-SITTER-{uid}` / `PENDING-WALKER-{uid}`) when booking doesn't exist yet.

### Anti-Fraud Architecture — Production 2026 (WalletLedger.ts)

All wallet mutations now route through `server/services/WalletLedger.ts` which implements 9 protection layers:

**5 new PostgreSQL tables (created March 2026):**
- `wallet_ledger_entries` — append-only double-entry ledger (24 columns, SHA-256 hash chain). NEVER updated/deleted.
- `wallet_idempotency_keys` — prevents duplicate processing; stores request hash + full response for replay
- `wallet_jti_registry` — PostgreSQL secondary layer for JTI anti-replay (primary = Firestore)
- `wallet_fraud_log` — immutable audit trail for all suspicious/blocked events
- `wallet_holds` — hold-before-capture for online bookings (active → captured/released/expired)

**9 Protection Layers:**
1. Append-only double-entry ledger (`wallet_ledger_entries`)
2. Idempotency keys — outer fast-path + inner tx-level guard
3. PostgreSQL JTI registry — dual layer on top of Firestore
4. Fraud log — every blocked event, admin credit, and velocity breach
5. In-memory velocity limiter — 10 ops/60s per user (sliding window)
6. DB transaction + `SELECT FOR UPDATE` — serializes concurrent deductions per wallet
7. Atomic `UPDATE WHERE balance >= amount` — floor guard, mathematically impossible to go negative
8. SHA-256 hash chain — `entry_hash = SHA256(prevHash|walletId|direction|amount|currency|idempKey|ts)`
9. Holds before capture for online bookings

**WalletEngine.ts integration:**
- `applyDeduction()` now delegates to `WalletLedger.deductFromWallet()` internally
- `topUpCashWallet()` now delegates to `WalletLedger.topUpWithLedger()` internally
- `DeductionResult` extended with `newCashWalletCents`, `deductedCents`, `source`, `idempotent` convenience fields
- `DeductionContext` extended with `idempotencyKey`, `jti`, `ipAddress`, `userAgent`, `staffId`, `endpoint`
- `creditTransactions` kept as compatibility/reporting layer (WalletLedger is truth)

**prestige-pass.ts updates:**
- `/token/redeem` — dual JTI check (PostgreSQL first, then Firestore); threads `jti`, `ipAddress`, `userAgent`, `X-Idempotency-Key` header into `applySmartRedemption`
- `/staff/charge` — passes `staffId`, `ipAddress`, `userAgent` to `applyDeduction`; result fields now correct
- `applySmartRedemption()` — returns `newCashWalletCents` for SSE push; accepts `SmartRedemptionCtx` anti-fraud params

### March 2026 Cleanup & Feature Sprint

**Services deleted (zero imports, dead code):**
`AustralianTaxComplianceService`, `CanadianTaxComplianceService`, `UKTaxComplianceService`, `USTaxComplianceService`, `LanguageContextService`, `SocialAuthVerificationService`, `BackgroundCheckService`, `AIMonitoringService` → 175 services remain

**GoogleFormsCreatorService rebuilt:** Exports `FORMS_DEFINITIONS` (5 form types: club-registration, provider-registration, quick-booking, legal-agreement, grooming-feedback) and `createAllForms()`. Used by `/api/google-forms` admin routes.

**SitterProximitySearch upgraded:**
- Geocoding fallback: providers without stored lat/lng get geocoded by city name via `MapsService.geocodeAddress()` (region=IL)
- Results are persisted back to DB so subsequent searches are instant
- In-process city coordinate cache to avoid repeated API calls
- `isEligibleToBook()` checks all 7 loyalty tiers (bronze→silver→gold→platinum→diamond→emerald→royal)

**POSJobs.tsx "Finish" button wired:**
- Opens a completion modal (pre-fills amount from booking, ILS input, 5 Israeli payment methods: cash/credit/Bit/Paybox/bank transfer)
- Calls `POST /api/orchestrator/job-complete` → auto-sends: tax invoice (חשבונית מס) + receipt email + Google Drive backup + Google Sheets log
- Falls back to marking booking `complete` in provider-dashboard API

**Orchestrator v2.0 — 9 handlers, all Google-integrated (March 2026):**
- `handleBookingSubmission` → Calendar + email + Drive
- `handleJobCompletion` → חשבונית מס + קבלה + Drive + Sheets
- `handleClubRegistration` → Welcome email + Drive + Sheets
- `handleProviderRegistration` → Contract + email + Drive + Calendar
- `handleLegalAgreementSigning` → Drive + email
- `handleKYCSubmission` → Sheets (Identity Verifications) + Drive audit record + compliance email
- `handleKYBSubmission` → Sheets (Onboarding Cases) + Drive + compliance email
- `handleBookingConfirmed` → Calendar (confirmed event) + Sheets + customer confirmation email
- `handleEsignComplete` → Drive backup + Sheets (E-Signatures) + signer email with doc link
- `handleOnboardingApproved` → Drive contract + Sheets (Provider Applications) + Calendar + welcome email
- `handleContractGenerated` → Drive + Sheets (E-Signatures) + party email

**Route fire-and-forget wiring (all setImmediate, non-blocking):**
- `kyc.ts` POST `/upload` → `handleKYCSubmission` (v1)
- `kyc2026.ts` POST `/verify` → `handleKYCSubmission` (v2, with risk level + face match verdict)
- `bookings.ts` POST `/:id/confirm` → `handleBookingConfirmed` (fetches full booking from Firestore)
- `contracts.ts` POST `/generate/offer-letter` → `handleContractGenerated`
- `contracts.ts` POST `/generate/contractor-agreement` → `handleContractGenerated`
- `esign.ts` POST `/webhook` `submission.completed` → `handleEsignComplete`
- `provider-intake.ts` POST `/:id/approve` → `handleOnboardingApproved` (fetches intake record)

**Confirmed working:**
- `/api/orchestrator/health` → 200 OK (version 2.0, 9 handlers listed)
- `/api/google/places-autocomplete` — Israel-only (`country:il`), Hebrew language support
- `GooglePlacesAutocomplete` component (`client/src/components/ui/google-places-autocomplete.tsx`): defaults to Israel, Hebrew sub-fields (בניין/דירה/מיקוד), portal dropdown
- Only 3 unmounted route files: `gift-cards-helpers.ts`, `head-office/`, `vouchers-2025.ts`

### Pending Items
- Legacy Firestore `cashWalletCents` → PostgreSQL migration for existing users
- Cloud Run secrets: `PASS_TOKEN_SECRET`, `GOOGLE_WALLET_TOTP_SECRET`, `MACHINE_SECRET_KEY`, `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_CREDENTIALS_JSON`, `PRESTIGE_QR_SECRET`, `GOOGLE_FORMS_SPREADSHEET_ID`, `ADMIN_SECRET`
- Apple Wallet production pass path
- Google Wallet production pass path
- SendGrid domain verification for petwash.co.il
- Share Sheets `14mRX4qJSABg-EcfONomk-fksegYrcIF_sFaEi3Bm2ss` with Firebase SA as Editor (BLOCKING for Sheets logging)

## Apple Wallet + Google Wallet — Real Implementation (March 2026)

### Architecture

Full production-ready wallet pass system replacing all stubs.

**Google Wallet: Generic Pass model (Class + Object)**
- `server/services/GoogleWalletService.ts` — complete REST + JWT implementation
- `buildSaveUrl(visual)` — signs a proper Generic Class + Generic Object JWT for `pay.google.com/gp/v/save/{jwt}` using RS256
- `upsertObject(visual)` — REST API create/patch of the Generic Object for live balance pushes
- `ensureClassExists()` — idempotent class creation (call once at startup)
- `pushUpdate(visual)` — patches the object when balance/tier changes
- Env vars: `GOOGLE_WALLET_ISSUER_ID` + `GOOGLE_WALLET_SA_KEY` (also accepts `GOOGLE_SERVICE_ACCOUNT_JSON`)
- Rotating barcodes via `initialRotatingBarcodeValues` (45-second rotation cadence)
- Expiry notifications via `expiryNotification.enableNotification: true`

**Apple Wallet: Signed .pkpass (passkit-generator@3.5.2)**
- `server/services/AppleWalletService.ts` — complete pkpass generation
- `generateAppleWalletPass(visual)` → returns `Buffer` ready to stream as `application/vnd.apple.pkpass`
- `buildPassJson(visual)` → returns JSON structure (for debugging when certs not set)
- Pass type: `storeCard` (stored-value + loyalty)
- `webServiceURL` = `${BASE_URL}/api/pass/apple` for live balance updates via APNs
- Env vars: `APPLE_PASS_TYPE_IDENTIFIER`, `APPLE_TEAM_IDENTIFIER`, `APPLE_SIGNER_CERT_PEM`, `APPLE_SIGNER_KEY_PEM`, `APPLE_WWDR_PEM`, `APPLE_SIGNER_KEY_PASSPHRASE`

### Universal Pass Distribution

`server/routes/pass-universal.ts` mounted at both `/api/pass` and Apple update web service:

- `GET /api/pass/:passId` — detects iOS/Android/desktop, redirects to correct wallet or shows HTML chooser page (both Hebrew/English aware)
- `GET /api/pass/apple/pass/:passId` — serves signed `.pkpass` file for iOS download
- `POST /api/pass/apple/v1/devices/:did/registrations/:ptid/:serial` — registers device for push updates (persists to `apple_wallet_device_registrations` table)
- `DELETE /api/pass/apple/v1/devices/:did/registrations/:ptid/:serial` — unregisters device
- `GET /api/pass/apple/v1/devices/:did/registrations/:ptid` — lists passes for device
- `GET /api/pass/apple/v1/passes/:ptid/:serial` — serves latest pass when Apple requests update
- `POST /api/pass/apple/v1/log` — Apple log endpoint (logs to server)

### New DB Tables (March 2026)

Created directly via SQL (drizzle-kit was too slow on 12k-line schema):

**`petwash_pass_accounts`** — canonical pass record (one per user)
- `passId` (unique) — human-readable ID e.g. `PW-4587-2043`
- `userId` — Firebase UID (unique index)
- `appleSerialNumber` — PKPass serialNumber (same as passId)
- `googleObjectId` — `{issuerId}.{passId}`
- `availableCreditIls` — cosmetic display field (source of truth: wallet_accounts)
- `qrTokenVersion` — bumped to rotate/invalidate outstanding QR tokens

**`apple_wallet_device_registrations`** — APNs push token registry
- Unique on `(device_library_identifier, serial_number)` — upserted on each registration

### prestige-pass.ts Refactor

- Added imports for `GoogleWalletService` + `AppleWalletService`
- `/apple-wallet` route: now calls `generateAppleWalletPass()` (real pkpass) or returns JSON preview on 503
- `buildGoogleWalletSaveUrl()` internal helper: replaced with thin adapter over `GoogleWalletService.buildSaveUrl()`
- New Google Wallet uses proper `genericClasses + genericObjects` structure (spec-compliant)
- Old code used `genericObjects` only (non-compliant) — fixed

### Pending to Go Live

1. **Google Wallet**: Set `GOOGLE_WALLET_ISSUER_ID` + `GOOGLE_WALLET_SA_KEY` in Cloud Run secrets
2. **Apple Wallet**: Set 5 Apple cert env vars in Cloud Run secrets (obtain pass cert from Apple Developer Portal, pass type `pass.il.petwash.prestige`)
3. **APNs push** for live balance updates: requires `APNS_KEY_P8` + `APNS_KEY_ID` + `APNS_TEAM_ID` (implement `sendApnsPush()` in `AppleWalletService.ts`)
4. **`petwashPassAccounts` population**: `/api/prestige-pass/activate` should also create a row in this table so `/api/pass/:passId` can serve the universal link

## 360° Security Hardening (March 2026 — Session 9)

Full security audit + three-engineer hardening sprint. All findings closed.

### Finding 1 — CRITICAL: Tax Document Atomicity (Off-Books Financial Events)

Every regulated financial event (`processReversal`, `processChargeback`, `processProviderBooking`) now throws and DB-rolls-back if `issueTaxDocument()` returns null. No payment row can survive without its corresponding tax document.

- `processReversal`: `reversalTaxDocId` checked — throws inside `db.transaction()` → reversal row + original status update both rollback
- `processChargeback`: `taxDocId` checked — throws inside `db.transaction()` → chargeback row + original status update both rollback
- `processProviderBooking`: Entire body wrapped in `db.transaction(async (tx) => {...})` using `tx.insert()`. Both `customerTaxDocId` and `commissionTaxDocId` checked — throws rollback both `pw_payments` and `pw_provider_payouts`
- `processManualAdjustment`: Already guarded by engineer T002

### Finding 2 — HIGH: Cross-User Idempotency Key Collision

**Database (production):**
- Dropped global `UNIQUE(idempotency_key)` constraint (`pw_payments_idempotency_key_key`)
- Created `idx_pw_pay_idem_customer`: `UNIQUE(customer_id, idempotency_key) WHERE customer_id IS NOT NULL`
- Created `idx_pw_pay_idem_anon`: `UNIQUE(idempotency_key) WHERE customer_id IS NULL`

**Code (`server/services/TransactionEngine.ts`):**
- `findByIdempotencyKey(key, customerId?)` — scoped lookup with composite index
- Flows A, B, C, D: pass `params.customerId` to scope checks per authenticated user
- `processReversal` + `processChargeback`: idempotency check moved **inside the DB transaction**, runs after `SELECT ... FOR UPDATE` on the original payment, then scopes by `original.customerId`

### Finding 3 — MEDIUM: Admin Secret Timing Attack

**New `server/middleware/adminAuth.ts`:**
- `timingSafeAdminSecretMatch(req)`: SHA-256 hashes both values then uses `crypto.timingSafeEqual()` — constant time regardless of where strings differ. Fail-closed if `ADMIN_SECRET` env var is unset.
- Applied to all 4 admin secret check sites: `manual-adjustment.ts`, `payout-reconciliation.ts`, `routes.ts` (2 endpoints)

### T002: Double-Refund & Wallet Hardening (Engineer)
- `processReversal` + `processChargeback`: `SELECT ... FOR UPDATE` on original payment, status guards reject `reversed → reversed`, `chargeback → reversed`, `reversed → chargeback`
- WalletEngine delegates to `WalletLedger.deductFromWallet()` which uses `SELECT ... FOR UPDATE` + JTI deduplication + velocity limits
- `processManualAdjustment`: throws on null `taxDocId` before returning — DB transaction rollback guaranteed

### T003: Passkey / Face ID + Consent Hardening (Engineer)
- `server/routes/webauthn.ts`: `userVerification: "required"` on both registration + authentication options; consent gate checks `user_consents` for `biometric_auth` before issuing registration options
- `server/routes/mobile-biometric.ts`: `MOBILE_CONFIG.userVerification = 'required'`; same consent gate pattern; `expectedOrigin` validated against `rpID`
- Consent version centralized: `server/lib/consentConstants.ts` exports `CURRENT_BIOMETRIC_CONSENT_VERSION = '2025.1'` — both files import from there; update one place to enforce new terms globally

### Cleanup
- Deleted `server/middleware/security.ts.LEGACY_DO_NOT_USE`
- Removed dead `userConsents` imports from `webauthn.ts` and `mobile-biometric.ts` (both use raw SQL for the consent check)
- Dropped stale global idempotency DB constraint

## Quote Engine v1.0.0 (Multi-Pet Booking Architecture)

### Core principle
A booking is a CONTAINER. Not a single pet. The backend is the single source of truth for all pricing. Frontend renders backend response — never calculates final totals.

### New DB tables (created March 2026)
- `booking_request_pets` — one row per pet per booking request, stores per-pet line items + pricing snapshot
- `booking_request_addons` — one row per add-on per booking (booking-level or pet-level scope)
- `quote_engine_logs` — audit trail of every quote returned, keyed by pricing_version

### Extended tables
- `booking_requests` — added 13 quote columns: `quote_subtotal_cents`, `quote_discount_cents`, `quote_credit_cents`, `quote_gift_card_cents`, `quote_tax_cents`, `quote_total_cents`, `quote_currency`, `quote_breakdown` (JSONB), `pricing_version`, `promo_code`, `coupon_id`, `gift_card_id`, `wallet_credit_used_cents`
- `provider_rate_cards` — added `pricing_rules` (JSONB: base price, additional pet price, species multipliers, size multipliers, surcharges) and `addons_catalog` (JSONB array)

### New files
- `server/services/quoteEngine.ts` — core engine: `calculateQuote()`, `persistBookingQuote()`
- `server/routes/quotes.ts` — `POST /api/quotes/preview`

### New endpoints
- `POST /api/quotes/preview` — unauthenticated preview, returns full deterministic quote with per-pet line items, add-on line items, discount/credit/gift stacking
- `POST /api/booking-requests/:requestId/reprice` — rebuilds quote for existing booking, persists updated line items to DB

### Apply order (enforced in backend)
1. Provider base pricing per service
2. Per-pet: species multiplier × size multiplier × duration units
3. Additional pet pricing (50% of base by default if no rate card rule)
4. Per-pet surcharges (medication, behavior flag, special needs)
5. Add-ons (booking-level and pet-level)
6. Promo/coupon validation (server-side only)
7. Gift card (egift balance from wallet_accounts)
8. Wallet credit (cash + promo + referral balances)
9. Tax (currently 0 — marketplace services VAT exempt at booking level)
10. Final payable total (never negative)

### Pricing version
Every quote carries `pricingVersion: "v1.0.0"` — stored in both the booking row and the audit log for reproducibility.

## Trust Metrics Infrastructure (March 2026)

### Database schema additions (via executeSql — no drizzle migration)
**`provider_profiles` new columns (all added, schema.ts updated):**
- `completed_bookings_count` integer — real count from booking_requests
- `repeat_client_count` integer — null when < 2 completed bookings (never fake)
- `response_rate_pct` integer — null when < 5 requests (never fake)
- `avg_response_time_minutes` integer — null when < 5 requests (never fake)
- `trust_metrics_updated_at` timestamp — last time cache was refreshed
- `has_fenced_yard` boolean — nullable (provider may not have filled in)
- `has_no_pets_at_home` boolean — nullable (provider may not have filled in)
- `price_from_cents` integer — lowest service price in agorot (÷100 = ILS); null = not set
- `accepted_pets` TEXT[] — e.g. `['dog','cat']`; null/empty = accepts all pet types

**`saved_providers` table:** id, user_id, provider_id, platform, created_at + UNIQUE CONSTRAINT `uq_saved_provider_pair(user_id, provider_id)`

### Server utilities: `server/utils/providerTrustMetrics.ts`
- `computeProviderTrustMetrics(providerId)` — queries booking_requests for real stats
- `refreshAndCacheProviderTrustMetrics(providerId)` — computes + writes to DB
- `formatResponseTime(minutes)` — human label (e.g. "within 1 hour")
- `backfillAllProviderTrustMetrics()` — batch refresh all stale providers (> 6h or null); called on startup + admin endpoint
- Null thresholds enforced: `responseRatePct`/`avgResponseTimeMinutes` require ≥5 requests; `repeatClientCount` requires ≥2 bookings

### API routes: `server/routes/provider-trust.ts`
All filters are now DB-backed — no client-side post-filtering anywhere.
- `GET /api/providers/stats/:userId` — 6-hour cached trust stats with auto-refresh
- `GET /api/providers/browse` — DB-backed filter search:
  - minRating, fencedYardOnly, noPetsAtHomeOnly, backgroundCheckOnly, availableThisWeek, sortBy (all proven)
  - **minPrice, maxPrice** — DB predicate on `price_from_cents` (ILS × 100 → agorot)
  - **petType** — DB predicate on `accepted_pets` TEXT[] with whitelist injection guard
- `GET /api/saved-providers` — list saved providers for current user
- `POST /api/saved-providers/:providerId` — save a provider (provider existence check, ON CONFLICT DO NOTHING)
- `DELETE /api/saved-providers/:providerId` — unsave a provider
- `POST /api/admin/providers/backfill-trust-metrics` — super-admin only (UID check); triggers async backfill; returns 202

### Trust metrics backfill
- **Startup**: Non-blocking `setImmediate` in `server/index.ts` calls `backfillAllProviderTrustMetrics()` on every cold start
- **Admin endpoint**: `POST /api/admin/providers/backfill-trust-metrics` — SUPER_ADMIN_UID gated, async, returns 202 immediately
- **On booking completion**: `setImmediate(() => refreshAndCacheProviderTrustMetrics(booking.providerId))` in booking-requests.ts
- **On profile view**: auto-refresh if cached value > 6h old (self-healing)

### ProviderBrowseGrid save heart — fully API-backed with rollback
- `onMutate`: captures `prev` Set snapshot before optimistic update
- `onError`: rolls back to `prev` snapshot + shows toast
- `onSuccess`: invalidates `/api/saved-providers` query cache
- Zero client-side post-filtering remains

## Phase 3: booking_requests Migration (March 2026)

### Goal
Move provider dashboard reads from `bookings` (old system) to `booking_requests` (new system, Firebase-UID-based provider reference). Dual-read safety phase: V1 routes stay live until migration-diff confirms parity.

### DB changes (via executeSql — no drizzle-kit migration)
**`booking_requests` new columns:**
- `provider_payout_cents integer` — net provider payout after 15% platform fee (= subtotalCents - serviceFeeCents)
- `payout_status varchar(32) DEFAULT 'pending'` — pending | released | paid_out | failed
- `payout_date timestamp` — when funds released to provider
- Backfilled: all 13 existing rows populated with `providerPayoutCents = subtotalCents - serviceFeeCents`

### New routes: `server/routes/provider-dashboard-v2.ts`
Mounted at `/api/provider-dashboard/v2/...` — RBAC guard covered by existing `/api/provider-dashboard` prefix.
- `GET /v2/bookings` — reads from `booking_requests` WHERE `provider_id = user.uid` (Firebase UID direct, no integer join). Returns same shape as V1 (cents → ILS conversion). Status filter supports both raw enum values and V1 group names (new_request, active, completed, cancelled).
- `GET /v2/upcoming` — confirmed/in_progress jobs within next 7 days
- `GET /v2/booking-counts` — count per status + group totals for tab badges
- `GET /v2/earnings` — paid/pending/this-month earnings from `booking_requests`
- `GET /v2/migration-diff` — shadow comparison: v1 count vs v2 count + parity flag + recommendation

### Backfill script: `scripts/migrate-bookings-to-requests.ts`
- Reads all `bookings`, joins to `providers` (p.id::text = b.provider_id) to get Firebase UID
- Maps old statuses → booking_request_status enum
- Converts ILS decimals → cents
- ON CONFLICT (request_id) DO NOTHING — idempotent, safe to re-run
- Result: 38/39 old bookings had NULL provider_id (test/simulation data never properly linked), 1 row migrated
- Rollback: `DELETE FROM booking_requests WHERE status_history::text LIKE '%migrated_from_bookings%'`

### Status group mapping
```
new_request  → pending, accepted, meet_greet_scheduled, meet_greet_completed, payment_pending
active       → confirmed, in_progress
completed    → completed, reviewed
cancelled    → cancelled, declined, disputed
```

### Migration roadmap
- [x] Phase 3 routes live (V2 endpoints)
- [x] Payout fields added to booking_requests
- [x] Backfill script written + dry-run verified
- [x] Switch UI query keys — POSDashboard + POSJobs now read from `/api/provider-dashboard/v2/...`
  - bookings, booking-counts, upcoming, earnings → all v2
  - invalidateAll() in both components → v2 keys
  - STATUS_STYLES in both components expanded to all V2 enum values + V1 compat aliases
  - JobCard action guards updated: accepted added to accept/decline gate; disputed/declined/reviewed added to terminal list
  - STATUS_GROUP_MAP in v2 route: added `dispute → ['disputed']` + `provider_confirmed → ['confirmed']` aliases
  - Action writes migrated to V2 in Phase 4 (see below)
- [x] Phase 4 — V2 action routes live, UI writes to `booking_requests`
  - POST `/v2/bookings/:id/accept|decline|cancel|start|complete|report` all writing to `booking_requests`
  - Status transition table enforced server-side (ALLOWED_FROM guard)
  - `status_history` JSONB appended on every action: `{status, prevStatus, timestamp, actor, uid, action, note?}`
  - `cancellation_reason` written with semantic prefix: `DECLINED:` / `CANCELLED:` / `DISPUTE:`
  - `cancelled_by = 'provider'` set on cancel/decline
  - `service_started_at` / `service_completed_at` set on start/complete
  - Ownership double-check in UPDATE WHERE (TOCTOU-safe)
  - POSJobs.tsx + POSDashboard.tsx mutation URLs → `/api/provider-dashboard/v2/bookings/:id/:action`
  - Reads and writes now hit the same table — split resolved
- [x] Phase 5 — V1 action routes deprecated (2026-03-19)
  - All 6 V1 action routes now return `410 ROUTE_DEPRECATED` with `Deprecation:`, `Sunset:`, `Link:` headers
  - Routes: `start | complete | accept | decline | cancel | report` under `/api/provider-dashboard/bookings/:id/`
  - Sunset date: 2026-04-30. Remove handlers entirely after production cutover confirmed.
  - Dev-only bypass added to RBAC guard + V2 `getAuthenticatedUser`: `x-test-provider-uid` header (hard-rejected in production)
- [x] Phase 4+5 real authenticated HTTP proofs
  - accept id=13 pending→confirmed: HTTP 200 ✓
  - start  id=13 confirmed→in_progress: HTTP 200 ✓
  - complete id=13 in_progress→completed: HTTP 200 ✓
  - decline id=19 pending→declined + DECLINED: reason prefix: HTTP 200 ✓
  - report  id=20 pending→disputed + DISPUTE: reason prefix: HTTP 200 ✓
  - invalid transition: 400 with currentStatus + allowedFrom list ✓
  - wrong owner: 404 "not found or not yours" ✓
  - unknown action: 400 with valid action list ✓
  - report on terminal booking: 400 with allowedFrom list ✓
- [ ] Monitor `/v2/migration-diff` — confirm parity when real bookings flow in
- [ ] Remove V1 action route handlers entirely after 2026-04-30 sunset

### Phase 4 — Status transition table
```
accept:   [pending, accepted]                                       → confirmed
decline:  [pending, accepted]                                       → declined
cancel:   [accepted, confirmed, in_progress, meet_greet_*,          → cancelled
           payment_pending]
start:    [confirmed]                                               → in_progress
complete: [in_progress]                                             → completed
report:   [pending, accepted, confirmed, in_progress]               → disputed
```

## Competitive Deep-Review Build v2 (March 2026 — Airbnb + Rover + MadPaws micro-UX)

### Research performed
Full deep-dive across Rover.com, MadPaws.com.au, Airbnb.com and PetWash.co.il covering profile design, filter UX, notification center, provider cards, trust signals, scarcity widgets, and conversion micro-copy.

### ProviderBrowseGrid.tsx — complete competitive upgrade
**New ProviderCardData fields:**
- `repeatClientCount` — violet chip "5 repeat clients" (Rover Star Sitter signal)
- `responseRate` — drives "Responds quickly" emerald chip (≥90%)
- `isNew` — rose "New" badge (Airbnb new-host pattern)
- `isAvailableThisWeek` — green/gray availability dot on card image
- `lastReviewSnippet` — italic review snippet under name (MadPaws social proof)
- `hasFencedYard`, `hasNoPetsAtHome`, `hasBackgroundCheck`, `isSavedByUser`

**Filter panel overhaul (Rover-inspired):**
- **Pet Type chips** — Dog / Cat / Rabbit / Bird (horizontal Airbnb-style shortcuts in hero)
- **Price range** — min + max dual inputs (was max-only)
- **Rating** — pill selector (Any / 4+ / 4.5+ / 4.8+) not dropdown
- **Trust & Safety toggles** — Background check 🛡️, Fenced yard 🏡, No other pets 🐾 (custom toggle switches)
- **"Available Now" toggle** — green dot quick-filter in filter bar
- **"New Providers" sort** — added to sort dropdown
- **Active filter count badge** — red circle on Filters button

**Card micro-UX (Airbnb/Rover level):**
- Heart/Save button (top-right on image), filled rose when saved, state persisted in Set
- "New" rose badge (Sparkles icon) on newly joined providers
- Availability dot (green "Available" / gray "Limited") bottom-left of image
- "Responds quickly" emerald chip (⚡ Zap icon)
- "X repeat clients" violet chip (CheckCircle icon)
- "Background checked" blue chip (🛡️)
- Review snippet italic under name
- Price moved to top-right of card content (right-aligned)

### ProviderProfilePage.tsx — complete competitive upgrade (v2: real API data)
**Required prop:** `providerId` (used to fetch live trust stats from `/api/providers/stats/:userId`)
**Removed props (now API-sourced):** `repeatClientCount`, `responseRate`, `isNew`, `hasFencedYard`, `hasNoPetsAtHome`, `hasBackgroundCheck`, `completedBookings`

**Trust data truth audit — nothing is faked:**
- `completedBookingsCount` — real DB count from booking_requests
- `repeatClientCount` — null hidden (requires ≥2 completed bookings)
- `responseRatePct` — null hidden (requires ≥5 requests)
- `avgResponseTimeMinutes / responseTimeLabel` — null hidden (requires ≥5 requests)
- `hasBackgroundCheck` — from background_check_status = 'approved' in DB
- `hasFencedYard / hasNoPetsAtHome` — from provider_profiles columns, null = hide
- `isNew` — completedBookings < 3 (real count, not time-based)

**Mobile sticky fixed bottom bar:**
- On small screens: fixed bottom bar with price + message icon + "Check Availability" CTA
- `pb-24 lg:pb-0` on root to prevent content hidden behind bar
- Desktop: right-column sidebar unchanged (sticky top-8)

**Save heart:**
- Wired to `POST/DELETE /api/saved-providers/:providerId`
- Optimistic update with rollback on error
- Initial state loaded from `GET /api/saved-providers`

**Hero section:**
- "New to PetWash" badge — only when API confirms completedBookings < 3
- Trust signals all conditional on non-null API data

**About my home section:**
- Only rendered when at least one of hasFencedYard/hasNoPetsAtHome/hasBackgroundCheck is non-null
- Each row only shown when its value is non-null

**Booking widget (both desktop sidebar and mobile bar):**
- Response time row hidden when null
- Repeat clients row hidden when null or 0
- Scarcity signal only when `bookingsThisMonth` prop ≥ 3 (caller must ensure this is real)

### NotificationCenterPanel.tsx — complete competitive upgrade
**Category tabs (Airbnb-style):**
- All / Bookings / Messages — pill tabs with unread count badges
- Filters `groups` in real-time as user switches tabs

**Notification type differentiation:**
- 7 types: `booking_request` (amber, Calendar, "Accept"), `booking_confirmed` (green, CheckCircle, "View"), `booking_cancelled` (red, AlertCircle), `message` (blue, MessageCircle, "Reply"), `review_received` (violet, Star, "View"), `meet_greet` (orange, Dog, "Details"), `reminder` (gray, Bell)
- Each type gets its own color chip + icon in the notification row
- Platform chip still shown alongside type chip

**Inline action buttons (Airbnb CTAs inside notifications):**
- Shown when notification has a `bookingId` and the type has an `actionLabel`
- Color matches notification type (amber Accept, blue Reply, green View, orange Details)
- Tapping the action navigates + marks read

**Bell pulse animation:**
- CSS keyframe `bell-pulse` — bell swings when new notifications arrive
- `badge-glow` animation — badge glows blue for 2 cycles
- Tracks prev count with useRef, only fires when count increases

**Hebrew support:** Header text "התראות" (was hardcoded "Notifications")

**PetTrek and Groomers platforms** added to PLATFORM_CONFIG (Car + Scissors icons)

## Competitive Parity Build (March 2026 — Rover + MadPaws gap analysis)

### New shared components
- **`client/src/components/TrustBar.tsx`** — Reusable trust/safety badge strip with 3 variants:
  - `horizontal` (scrollable strip) — for provider profile header
  - `grid` (2-col grid with desc) — for landing pages and onboarding
  - `compact` (badge row) — for booking confirmation
  - Badges: ID Verified (green) · 1 in 5 Accepted (gold) · PetWash Guarantee (blue) · Trained & Certified (violet) · 10,000+ Bookings (sky)

- **`client/src/components/StarProviderBadge.tsx`** — Rover-inspired provider rank badge:
  - `Elite Provider` (gold star): rating ≥ 4.8, ≥5 reviews, ≥90% response rate, ≥30% repeat clients
  - `Verified Provider` (green star): rating ≥ 4.5, ≥2 reviews
  - `showDetails` prop renders: star rating, response rate %, repeat client %

### CustomerBookings.tsx upgrade
- **Provider avatar**: Gold circle with initials when `providerName` is resolved from API
- **Provider name** shown as primary text on each booking card (service label drops to subtitle)
- **Meet & Greet badge**: Violet badge shown on upcoming bookings when `meetGreetDate` or `meetGreetLocation` is set
- **"Book Again" CTA**: Visible only on Past tab — routes to appropriate platform (sitter-suite, walk-my-pet, groomers etc.)
- **Rounded-2xl cards** with subtle shadow and hover elevation

### CustomerFavourites.tsx upgrade
- **Tab count badges**: Shows count on Shortlisted and Previously Booked tabs
- **"Book" button**: Gold Zap CTA on each shortlisted provider card (routes to their platform)
- **"Rebook" button**: Gold ring CTA on each previously booked card (routes to platform)
- **Provider avatars**: Gold initials circles on both tabs (pulls from API providerName)
- **Updated empty states**: Better copy matching Rover/MadPaws phrasing

### Backend: Booking list API upgrade
- `GET /api/booking-requests` now batch-resolves provider names from `users` table (one extra query)
- Response now includes: `providerId`, `providerName` (resolved first+last name or null)

### SEO Discovery Engine — ServiceLandingPage.tsx
- Route: `/services/:service` and `/services/:service/:city`
- Services covered: pet-sitting, dog-walking, grooming, k9000-wash, pet-taxi, training
- Cities covered: 12 Israeli cities (Tel Aviv, Jerusalem, Haifa, Beer Sheva, Rishon, Petah Tikva, Ashdod, Netanya, Holon, Bnei Brak, Ramat Gan, Herzliya)
- Each page: hero CTA, TrustBar grid, star reviews, FAQ accordion, city cross-links, service cross-links
- Full SEO: `react-helmet-async` title/description/og/canonical, robots: index,follow
- Example URLs: `/services/dog-walking`, `/services/pet-sitting/tel-aviv`

## Quote Engine v1.1.0 (March 2026 hardening)

### Changes shipped this session
- **`quotedAt` ISO timestamp** on every `QuoteResponse` (stale detection in UI)
- **`rateUnit` in `pricingSnapshot`** — `per_night` / `per_hour` / `per_trip` / `per_session` for each pet line item
- **`pet_taxi` billing fix** — changed from `per_hour` to `per_trip` (1 unit always)
- **SYSTEM_ADDON_CATALOG expanded** — 35 codes now covering K9000 wash (blow_dry, cologne_spray, flea_treatment, paw_balm), PetTrek taxi (carrier_rental, extra_stop), and sitter suite (report_card)
- **Dev rate limiter bypassed** — `apiLimiter` skips all requests in development mode; production limit unchanged at 200/15min

### ConfirmStep new props (MultiPetBookingWizard)
- `startTime: string` — HH:MM time string from schedule step
- `endTime: string` — HH:MM time string from schedule step
- `serviceType: string` — passed to display correct rateUnit label
- `onApplyPromo: () => void` — triggers quote re-fetch after promo code entry

### AddonsStep UX improvements
- Booking-scope addons: gold dot + "חיוב אחד" badge, rounded-2xl, gold hover border
- Pet-scope addons: blue dot + "חיוב לכל חיה" badge, indented per-pet groups with divider line, blue selection color

### Test suite: 12/12 PASS
All quote engine scenarios verified after each fix cycle.
