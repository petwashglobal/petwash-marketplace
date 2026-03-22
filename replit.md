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

### Phase 2 — Multi-Division Wallet Hold/Release/Debit/Refund Lifecycle (March 2026)

**Commercial rule (locked):** Wallet debit happens on provider ACCEPT (not at booking creation or payment).

**Four atomic operations added to `WalletLedger.ts`:**
- `holdWallet` — available ↓, pending ↑ (eventType=hold). Called on booking CREATE if walletCreditAppliedCents > 0.
- `releaseWalletHold` — available ↑, pending ↓ (eventType=release). Called on DECLINE or CANCEL before debit.
- `debitFromWalletHold` — pending ↓ only (eventType=debit). Called on provider ACCEPT. Available already moved at hold time.
- `refundToWallet` — available ↑ (eventType=refund). Called on CANCEL after debit.

**`wallet_accounts` new columns:** `pending_balance_cents`, `lifetime_earned_cents`, `lifetime_redeemed_cents`

**`booking_requests` new columns:** `wallet_hold_cents`, `wallet_debited_cents`, `wallet_refunded_cents`, `wallet_hold_key`, `wallet_debit_key`, `wallet_release_key`, `wallet_refund_key`, `finance_state` (none|hold_active|debited|released|refunded)

**`WalletService.ts` Phase 2 public interface:**
- `previewRedemption(userId, subtotalCents, divisionCode)` — server-side cap: 50% for bookings, 100% for K9000/Academy
- `holdBookingWallet / releaseBookingHold / debitBookingFromHold / refundBookingWallet` — division wrappers

**`booking-requests.ts` lifecycle integration:**
- POST / (create): holdWallet if quote has walletCreditAppliedCents > 0
- POST /:id/respond (accept): debitFromWalletHold via setImmediate
- POST /:id/respond (decline): releaseWalletHold via setImmediate
- POST /:id/cancel: releaseWalletHold (if hold_active) or refundToWallet (if debited)

**Admin finance reporting (`prestige-pass.ts`):**
- `GET /api/prestige-pass/admin/wallet/division-report` — SUM grouped by division_code + event_type
- `GET /api/prestige-pass/admin/wallet/booking-audit?bookingId=XXX` — full hold timeline per booking

**Frontend (`PrestigePassWallet.tsx` WalletBalanceSection):**
- Pending balance chip (amber, inside dark hero card) shown only when holds exist
- Lifetime earned/redeemed two-column stat grid shown when history exists

### Phase 2.1 — Reconciliation Job + Proof-Pass Endpoint (March 2026)

**Edge case sealed:** Server crash between `booking.status = accepted` (HTTP 200 returned) and `setImmediate(debitFromWalletHold)` completing leaves `finance_state = hold_active` on an accepted booking. Now healed automatically.

**`server/jobs/wallet-reconciliation.ts`** — `ReconciliationReport` interface + `runWalletReconciliation()` + `startWalletReconciliationJob()`:
- Startup run (deferred 10 s for pool stability) + cron every 5 min
- Queries `status='accepted' AND finance_state='hold_active' AND wallet_hold_cents>0`
- Resets velocity limiter per user before replay (idempotency key prevents double-charge regardless)
- Calls `walletService.debitBookingFromHold` — fully idempotent via `wallet:booking:debit:{bookingId}`
- Updates `finance_state='debited'` on success, logs `healed | already_idempotent | error` per booking

**`server/routes.ts`** wiring — `startWalletReconciliationJob()` called after `startDailyReconciliationJob()`

### Phase 2.2 — Academy Wallet Integration + Admin Finance Dashboard (March 2026)

**Academy (`server/routes/academy.ts`) — full wallet lifecycle wired:**
- `POST /api/academy/bookings` (create): accepts `walletCreditAppliedCents`; calls `previewRedemption` (100% cap for academy); calls `holdBookingWallet` with idempotency key `wallet:booking:hold:{bookingId}`; saves `walletHoldCents`, `walletHoldKey`, `financeState='hold_active'` on `trainer_bookings`
- `POST /api/academy/bookings/:id/confirm` (**new route**): trainer-only; if `financeState='hold_active'` calls `debitBookingFromHold`; sets `financeState='debited'`, `walletDebitedCents`, `walletDebitKey`; also sets `bookingStatus='confirmed'`, `paymentStatus='completed'`, `escrowStatus='held'`
- `POST /api/academy/bookings/:id/cancel`: if `financeState='hold_active'` → `releaseBookingHold`→`financeState='released'`; if `financeState='debited'` → `refundBookingWallet`→`financeState='refunded'`; all idempotent via standard `wallet:booking:{release|refund}:{bookingId}` keys

**Schema — `trainer_bookings` table extended (8 new columns via `executeSql`):**
`wallet_hold_cents`, `wallet_debited_cents`, `wallet_refunded_cents`, `wallet_hold_key`, `wallet_debit_key`, `wallet_release_key`, `wallet_refund_key`, `finance_state` (default `'none'`)

**Reconciliation job extended** (`server/jobs/wallet-reconciliation.ts`):
- Now covers both `booking_requests` (walkers/sitters) AND `trainer_bookings` (academy) in a single pass
- Removed early-return on zero booking_requests drifted — always continues to academy query
- Academy heal path: `booking_status='confirmed' AND finance_state='hold_active'` → `debitBookingFromHold` + `finance_state='debited'`

**Admin Wallet Finance Dashboard** (`client/src/pages/AdminWalletDashboard.tsx`):
- Route: `/admin/wallet-finance` (admin-guarded)
- Tab 1 "Proof Pass": run button → 6-step audit with PASS/WARN/FAIL badges per step
- Tab 2 "Division Report": wallet volume table grouped by division_code (K9000/Sitter/Walkers/Academy/PetTrek)
- Tab 3 "Booking Audit": search by booking ID → shows `financeState`, hold/debit amounts, full ledger entry timeline with idempotency keys

**`POST /api/prestige-pass/admin/wallet/proof-pass`** — admin-only system audit (6 steps, returns `PASS | WARN | FAIL`):
- Step 1 Reconciliation: runs `runWalletReconciliation()` live
- Step 2 Finance-state distribution: breakdown of hold_active/debited/released/refunded counts
- Step 3 Balance integrity: queries any wallet with negative bucket values  
- Step 4 Pending consistency: compares `pending_balance_cents` vs ledger-derived pending
- Step 5 Idempotency coverage: counts operations missing their expected key columns
- Step 6 Verdict: `FAIL` (negative balance or unhealable drift), `WARN` (healed drift or missing keys), `PASS`

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

### Database schema additions — Step 5 (Smart Ranking, March 2026)
**Additional `provider_profiles` columns (via executeSql, schema.ts updated):**
- `ranking_score integer` — 0-100 composite display rank (null = not computed)
- `ranking_override integer` — admin-set full score override (null = use computed)
- `ranking_boosted_until timestamp` — temporary +15 admin boost expiry
- `ranking_updated_at timestamp` — last recomputed

**Ranking formula (`server/utils/providerRanking.ts`):**
- `trust_score × 0.40 + (rating/5×100) × 0.25 + completion_rate × 0.15 + recency (max 10) + profile completeness (max 10) − penalties`
- Recency: ≤7d=+10, ≤14d=+6, ≤30d=+3
- Profile completeness: bio=+3, avatar=+3, working hours set=+4
- Penalties: acceptance_rate<50%=−10; cancellation>20%=−20, >10%=−10, >5%=−5
- Admin boost: +15 if `ranking_boosted_until` in future
- New provider floor: completedBookingsCount=0 → base score 50 (listed but not top)
- Admin override replaces computed score entirely (boost still applies on top)

**New API routes (`server/routes/provider-trust.ts`):**
- `GET /api/admin/ranking/overview` — all providers sorted by effective ranking score with tier labels
- `PATCH /api/admin/providers/:userId/ranking` — set override (0-100) and/or boostDays (0-365)
- `DELETE /api/admin/providers/:userId/ranking-override` — clear override + boost, revert to computed
- `POST /api/admin/ranking/backfill` — recompute all stale ranking scores

**Browse endpoint (`GET /api/providers/browse`):**
- Default `sortBy` changed from `rating` → `ranking` (`COALESCE(ranking_override, ranking_score) DESC NULLS LAST`)
- New sort options: `ranking` (Recommended), `trust` (Most Trusted), `price_asc`, `price_desc`
- Browse result now includes: `rankingScore`, `rankingOverride`, `effectiveRankingScore`

**Backfill on startup:** `server/index.ts` runs `backfillAllProviderRankingScores()` 500ms after startup (non-blocking, idempotent). Trust refresh automatically triggers ranking refresh via `setImmediate`.

**UI (ProviderBrowseGrid.tsx):**
- Default sort: "Recommended" (ranking)
- New sort options in dropdown: Recommended, Most Trusted, Price: Low→High, Price: High→Low
- Card badge hierarchy: "Top Provider" (gold, ≥80) > "Rising" (blue, ≥65) > "New" (rose) — mutually exclusive
- `effectiveRankingScore` and `rankingScore` added to `ProviderCardData` type

### Database schema additions — Step 4 (Trust Upgrade, March 2026)
**Additional `provider_profiles` columns (via executeSql, schema.ts updated):**
- `acceptance_rate_pct` integer — % of requests accepted (null if < 5 requests)
- `completion_rate_pct` integer — % of accepted bookings completed
- `cancellation_rate_pct` integer — % cancelled by provider
- `trust_score` integer — composite 0–100 score (null if < 5 total requests)

**Trust score formula (providerTrustMetrics.ts):**
- completion × 0.30 + acceptance × 0.20 + response × 0.15 + repeat rate × 0.15 + badge bonus (5pts each, max 20) − cancellation penalty (−15 if >20%, −8 if >10%, −3 if >5%)
- Requires totalRequests ≥ 5 to compute; returns null otherwise

**Verified badge IDs:** `id_verified`, `insured`, `licensed`, `background_check` (auto-granted if `backgroundCheckStatus === 'approved'`)

### API routes: `server/routes/provider-trust.ts`
All filters are now DB-backed — no client-side post-filtering anywhere.
- `GET /api/providers/stats/:userId` — returns `trustScore`, `acceptanceRatePct`, `completionRatePct`, `cancellationRatePct`, `responseRatePct`, `badges` + 6-hour cache auto-refresh
- `GET /api/providers/browse` — DB-backed filter search; now also returns `trustScore`, `acceptanceRatePct`, `completionRatePct`, `cancellationRatePct`, `badges`:
  - minRating, fencedYardOnly, noPetsAtHomeOnly, backgroundCheckOnly, availableThisWeek, sortBy (all proven)
  - **minPrice, maxPrice** — DB predicate on `price_from_cents` (ILS × 100 → agorot)
  - **petType** — DB predicate on `accepted_pets` TEXT[] with whitelist injection guard
- `GET /api/saved-providers` — list saved providers for current user
- `POST /api/saved-providers/:providerId` — save a provider (provider existence check, ON CONFLICT DO NOTHING)
- `DELETE /api/saved-providers/:providerId` — unsave a provider
- `POST /api/admin/providers/backfill-trust-metrics` — super-admin only (UID check); triggers async backfill; returns 202
- `GET /api/admin/providers/trust-overview` — admin overview of all providers' trust metrics
- `PATCH /api/admin/providers/:userId/badges` — grant/revoke verified badges, auto-refreshes trust score

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

---

## Step 6 — Loyalty Credits System (March 2026, Phases 6.1–6.3)

### Phase 6.1 — DB Schema + Seed

**Schema additions to existing tables:**
- `users`: `loyalty_balance_cents integer DEFAULT 0`, `referral_code varchar`, `referred_by_code varchar`
- `provider_profiles`: `is_winback_suppressed boolean DEFAULT false`

**New tables created (all via `executeSql`):**
| Table | Purpose |
|---|---|
| `loyalty_rules` | Rule catalogue (key, reward_cents, expiry_days, enabled) |
| `reward_claims` | Idempotency guard (`unique_fingerprint` UNIQUE) |
| `loyalty_ledger` | Append-only credit/debit log |
| `referrals` | Referral tracking (inviter→invitee code lifecycle) |
| `experiments` | A/B test definitions |
| `experiment_assignments` | User↔variant assignments |
| `experiment_events` | Conversion event log |
| `winback_queue` | Re-engagement targeting queue |

**9 rules seeded (all `enabled=false`):**
`welcome(₪25/90d)`, `referral_inviter(₪50/180d)`, `booking_2nd(₪15/90d)`, `streak_same_provider_3(₪20/90d)`, `streak_walk_5(₪30/90d)`, `streak_sit_5(₪30/90d)`, `winback_14d(₪20/14d)`, `winback_30d(₪35/14d)`, `winback_60d(₪50/14d)`.

**Drizzle schema updated** in `shared/schema.ts` with all new table types/insert schemas.

---

### Phase 6.2 — Ledger Service + Balance Endpoints

**`server/utils/loyaltyLedger.ts`** — core service:
- `awardLoyaltyCredit({ userId, ruleKey, fingerprint, bookingId?, referralId? })` — idempotent credit (checks `reward_claims`, appends ledger, updates `users.loyalty_balance_cents`, respects ₪300 cap)
- `redeemLoyaltyCredit({ userId, amountCents, bookingId })` — debit (min ₪10, max 50% of order, appends ledger, updates balance)
- `expireLoyaltyCredits()` — nightly sweep; expires rules past their `expiry_days` window by reversing outstanding credits
- `getLoyaltyBalance(userId)` — returns balance in cents + ILS
- `getLoyaltyHistory(userId, limit)` — paginated ledger entries
- `getStreakCounts(userId)` — returns `{ walkBookings, sitBookings, consecutiveSameProvider: { providerId, count } }`

**`server/routes/loyalty-credits.ts`** — REST endpoints:
- `GET /api/loyalty-credits/balance` — current balance for authenticated user
- `GET /api/loyalty-credits/history?limit=N` — ledger entries (default 20)
- `GET /api/loyalty-credits/streaks` — streak counts

Route mounted in `server/routes.ts`:
```
app.use('/api/loyalty-credits', apiLimiter, loyaltyCreditsRoutes);
```

Auth: `validateFirebaseToken` from `server/middleware/firebase-auth` (sets `req.firebaseUser`).

---

### Phase 6.3 — Booking Completion Triggers

**Wired into `server/routes/booking-requests.ts`** immediately after `createEarningRecord` try/catch block, wrapped in `setImmediate` (non-blocking, fire-and-forget).

**5 triggers fired on every booking completion:**

1. **`booking_2nd`** — awards ₪15 credit exactly when `completedCount === 2` (2nd lifetime completed booking for owner). Fingerprint: `booking_2nd:{userId}`.

2. **`streak_same_provider_3`** — awards ₪20 when `consecutiveSameProvider.count === 3`. Fingerprint includes `providerId` so each provider streak is independent.

3. **`streak_walk_5`** — awards ₪30 on the 5th completed `dog_walking` booking. Fingerprint prevents re-award.

4. **`streak_sit_5`** — awards ₪30 on the 5th completed `pet_sitting` booking. Fingerprint prevents re-award.

5. **Referral completion** — fires on invitee's 1st ever completed booking (`completedCount === 1`). Looks up `users.referred_by_code`, finds the matching `referrals` row, credits the inviter (₪50 via `referral_inviter` rule), and marks `referrals.inviter_credited_at`.

6. **Win-back reset** — any `winback_queue` rows for this user in `pending`/`sent` status are marked `converted` so they don't receive further re-engagement outreach.

**Imports added to `booking-requests.ts`:** `awardLoyaltyCredit`, `getStreakCounts` from `loyaltyLedger`; `referrals`, `winbackQueue` from `@shared/schema`.

**Invariants preserved:**
- All triggers are non-blocking (errors logged as WARN, response unaffected)
- Idempotency guaranteed by `reward_claims.unique_fingerprint` UNIQUE index
- All amounts flow from `loyalty_rules` table (not hardcoded)
- `users.loyalty_balance_cents` stays consistent as ledger cache

---

### Phase 6.4 — Win-back Queue Processing

**New files:**
| File | Role |
|---|---|
| `server/jobs/winback-populator.ts` | Nightly scan → inserts `winback_queue` rows |
| `server/jobs/winback-processor.ts` | Processes pending queue → awards credit + notifies |
| `server/cron/winback.ts` | Cron schedule wrapper (23:00 UTC populator, 23:30 UTC processor) |

**Populator logic (`runWinbackPopulator`):**
- Loops over 3 tiers: `winback_14d` (14–21 days dormant), `winback_30d` (30–37d), `winback_60d` (60–67d)
- Uses `booking_requests.updated_at` on `completed`/`reviewed` status as completion timestamp
- Deduplicates: skips insert if row already exists for same `(user_id, trigger)` with status not in `converted`/`suppressed`
- Provider suppression: if most recent provider has `provider_profiles.is_winback_suppressed=true`, inserts with `status='suppressed'` immediately

**Processor logic (`runWinbackProcessor`):**
- Fetches up to 50 pending rows with `scheduled_at <= now()`
- For each row:
  1. Confirms user is still dormant (no newer completed booking since `last_booking_at`)
  2. Looks up `loyalty_rules` by trigger key — skips if `enabled=false` (marks `suppressed`)
  3. Awards credit via `awardLoyaltyCredit` (idempotent fingerprint: `winback_14d:{userId}` etc.)
  4. Dispatches Hebrew notification via `dispatchNotification` (`inbox` + `email` channels)
  5. Marks `status='sent'`, `sent_at=now()`
- Per-row errors logged as ERROR and do not abort the batch

**Notification copy (Hebrew, per tier):**
- Title: `"{firstName}, התגעגענו אליך! 🐾"`
- Body: announces time away (שבועיים / חודש / חודשיים) and credit amount
- CTA: "הזמן עכשיו" → `https://petwash.co.il/marketplace`

**Cron schedule (`startWinbackCron`):**
- Wired in `server/index.ts` alongside `startMonthlySettlementsCron`
- Runs daily: populator at 23:00 UTC, processor at 23:30 UTC (≈ 01:00–01:30 Israel time)
- All cron errors caught and logged — never crash the server

**Suppression rules live:**
- Provider-level: `provider_profiles.is_winback_suppressed` → row inserted as `suppressed`
- Rule-level: `loyalty_rules.enabled=false` for the tier → row marked `suppressed` at process time
- User already re-engaged: newer completed booking detected → row marked `converted` at process time
- Booking-completion hook (Phase 6.3) → also marks any `pending`/`sent` rows `converted` on first booking back

**Key invariants:**
- Win-back credit is awarded immediately on notification send (incentive to return), with tier expiry from `loyalty_rules.expiry_days`
- Each tier fires at most once per user per lifecycle (dedup in populator + `reward_claims` idempotency)
- All rules remain `enabled=false` until explicitly flipped — system is dormant until activation

## Wallet Finance Admin — Phase 2.9 Series (March 2026)

All endpoints under `/api/prestige-pass/admin/wallet/`. Admin-only. All schema changes applied via `executeSql` (not drizzle-kit).

### Phase 2.9A — Provider Payout Ledger
- `provider_payout_entries` table (13 cols): `payout_batch_id`, `provider_uid`, `division_code`, `gross_cents`, `commission_rate_bps`, `net_cents`, `status` (earned/held/paid/reversed), `booking_id`, etc.
- 5 endpoints: POST record-payout, GET ledger, GET summary, POST mark-paid, POST reverse-payout
- Net math: `net_cents = gross_cents - FLOOR(gross_cents × commission_rate_bps / 10000)` — locked rule

### Phase 2.9B — Settlement Summary + CSV Export
- `GET /settlement-summary` + `GET /settlement-summary/export` (BOM-prefixed CSV)
- `COLLECTED_EVENTS` tuple + `VAT_RATE = 0.18` constants (locked)
- `GET /exception-summary` — cron exception email + inline summary for dashboard banner
- Finance anomaly banner: `GET /anomalies` (negative_balance, stale_hold, refund_exceeds_hold, double_debit)
- Signed audit bundles: `POST /booking-audit/bundle`

### Phase 2.9C — Dispute Cases
- `dispute_cases` table (13 cols, 8 indexes): `case_ref = DSP-${nanoid(10)}`, `notes` append-only JSONB, `resolved_at` only set by resolve endpoint
- 4 endpoints: POST open, GET list (filters), PATCH update/assign/note, POST resolve
- AdminWalletDashboard Disputes tab: filter bar, open-case form, list table, detail drawer with timeline/assign/status-update/add-note/resolve panel

### Phase 2.9D — Refund Approval Threshold
- `refund_approvals` table (13 cols, 6 indexes): `refund_request_id = RRA-${nanoid(12)}` (UNIQUE), `status` (pending/auto_approved/approved/rejected)
- `REFUND_AUTO_APPROVE_LIMIT_CENTS` env (default 5000 = ₪50): below → auto_approve, above → pending
- `executeApprovalRefund` internal helper: `fetchSupportBooking` + `refundToWallet` — NOT walletService.supportIssueRefund
- Self-approve guard: 403 if reviewer UID === requester UID. Reject: zero wallet mutations.
- 4 endpoints: POST /refund-requests, GET /pending (polls 20s), POST /:id/approve, POST /:id/reject
- Frontend: Approvals tab with live pending badge, full queue card, `supportRefund` rerouted to `/refund-requests`
- Result panel: emerald for auto-approved, amber for pending (with pointer to Approvals tab)
- `linked_dispute_case_ref` optional field in Issue Refund form

### Phase 2.9E — Daily Finance Close
- `finance_close_records` table (10 cols, 3 indexes): `close_date DATE UNIQUE`, `division_snapshots JSONB`, `vat_liability_cents`, `exception_count`, `status` (open/closed), immutable after close
- Jerusalem calendar date (`Asia/Jerusalem` timezone for all date boundaries)
- `buildChecklist()` helper: 4 gates — noOpenAnomalies, noStaleHolds (>72h), noPendingDisputes, noPendingRefundApprovals
- `buildDivisionSnapshots()` helper: reuses settlement math — walkers/petsitter/academy/station_k9000 × collectedCents/providerPayableCents/pendingHoldsCents/marginCents/marginPct
- 3 endpoints:
  - `GET /finance-close/history` (last 30, newest first) — registered BEFORE `/:date` to avoid shadow
  - `GET /finance-close/:date` — fetch existing or scaffold live view
  - `POST /finance-close/:date/close` — checklist enforced (422 + full `blocked` payload if not clear), idempotent (returns existing if already closed)
- Close endpoint returns exact checklist failure payload on block (not just "cannot close")
- Frontend: Daily Close card in Finance Today tab — date picker, 4-row checklist, Close button (disabled unless all clear), notes textarea, locked state with snapshot chips; Close History table (Date/Status/Closed By/Closed At/VAT/Exceptions)

### Phase 3.0A — Payout Batch Engine (COMPLETE)
- `payout_batches` table (8 cols, 3 indexes): `batch_id VARCHAR(64) UNIQUE`, `created_by_uid`, `status` (open/exported/completed), `total_providers`, `total_net_cents`, `notes`; indexes: UNIQUE(batch_id), idx_pb_status, idx_pb_created_at
- `payout_batch_id` anchor: all finance operations reference this as the object of record
- 4 endpoints:
  - `POST /admin/wallet/payout-batches/create` — validates entryIds (must be earned/held), generates batch_id, marks entries paid, writes payout_batches row, returns summary. Idempotent: if all entries already paid under same batch, returns that batch
  - `GET /admin/wallet/payout-batches` — list (newest first, last 50) with aggregated entry count + gross total
  - `GET /admin/wallet/payout-batches/:batchId` — header + entries + byProvider grouping + totals
  - `GET /admin/wallet/payout-batches/:batchId/export` — BOM-prefixed CSV: provider_uid,division_code,booking_id,gross_ils,commission_ils,net_ils
- CSV: commission_ils = gross - net (computed at export, never stored separately)
- Frontend: Payout Batches tab in AdminWalletDashboard — 4 totals cards, create panel (entry IDs + notes), batch list table (status badge, providers, entries, net, CSV export link), batch detail drawer with byProvider breakdown and per-entry table, Export CSV button

### Phase 3.0B — Provider Remittance & Statements (COMPLETE)
- `GET /provider/wallet/payout-statement?batchId=...` — provider's own paid entries, grouped by batch then by booking; returns `byBatch[]`, `totals`, `batches[]` (selector list)
- `GET /admin/wallet/payout-batches/:batchId/provider-export` — grouped multi-provider CSV (one section per provider, subtotal line per provider, batch header row)
- commissionCents = grossCents − netCents computed at response time (not stored)
- Frontend (ProviderDashboard, earnings tab): "הצהרת תשלום" section above full ledger — batch selector dropdown (populated from API), totals cards (gross/commission/net), per-batch breakdown table (division/booking/gross/commission/net), client-side CSV download button (BOM-prefixed, works without server round-trip for CSV)

### Phase 3.0C — Dispute to Financial Actions Bridge (COMPLETE)
- `dispute_cases` extended: `linked_payout_batch_id VARCHAR(64)`, `resolution_action VARCHAR(20) DEFAULT 'none'` (refund/clawback/none); `idx_dc_resolution_action` index
- `POST /admin/wallet/disputes/:caseRef/apply-resolution` — routes dispute to financial outcome:
  - `refund`: internal HTTP call to 2.9D `/refund-requests` with `linkedDisputeCaseRef`; audit trail via refundRequestId
  - `clawback`: creates new NEGATIVE `provider_payout_entries` row (status=`clawed_back`, net_cents=−abs(clawbackCents)); original entry is NEVER mutated
  - `none`: records decision only, no wallet/payout mutations
  - 409 guard: resolution already applied cannot be re-applied
  - `resolution_action` + audit metadata written back to `dispute_cases.metadata.resolutionApplied`
- Frontend: "Apply Financial Resolution" section inside dispute case drawer — action selector (none/refund/clawback), conditional sub-forms for refund (booking + amount + note) and clawback (provider UID + amount + division + note), linked batch ID field, result panel shows refundRequestId or clawbackId after apply

### Phase 3.0D — Daily Close Notifications (COMPLETE)
- `server/jobs/daily-close-reminder.ts` — hourly cron (`0 * * * *`, `timezone: 'Asia/Jerusalem'`)
- Checkpoints: 18:00, 20:00, 22:00 IL — 2-hour windows each
- Per-checkpoint deduplication: in-memory `SENT` Set with key `${dateIso}:${checkpoint}` — no duplicate emails
- Stops immediately when `finance_close_records` shows closed for today
- Email payload: 4-gate checklist table (anomalies/staleHolds/pendingDisputes/pendingApprovals) with counts, clear/blocked status, summary line, checkpoint time
- Gate: `DAILY_CLOSE_REMINDER_ENABLED=true` (disabled by default — zero risk in dev)
- SendGrid delivery, `FINANCE_ALERT_EMAIL` destination
- Registered in `server/index.ts` non-blocking with `.catch()`

### Phase 3.0E — Finance Close Export Bundle (COMPLETE)
- `GET /admin/wallet/finance-close/:date/export` — daily audit pack endpoint (admin-only)
- 5 sections: `settlementSummary` (division snapshots + VAT), `payoutBatches` (with JOIN to compute gross_cents + entry_count), `actionHistory` (all wallet_ledger_entries for date), `anomalyLog` (negative balances + stale holds), `disputeSummary` (dispute_cases for date)
- Finance close record `meta` embedded: status, closedByUid, closedAt, vatLiabilityCents, totalCollectedCents
- SHA-256 integrity hash via `crypto.createHash('sha256')` → response field `_sha256` + `X-Bundle-SHA256` header
- `Content-Disposition: attachment; filename="petwash-finance-{date}.json"` 
- Frontend: "Download Audit Pack" button inside the "Day Closed & Locked" panel — client-side blob download via `URL.createObjectURL`, error toast on failure

### Phase 3.0F — Month-end Finance Pack (COMPLETE)
- `GET /admin/wallet/finance-close/month-export?month=YYYY-MM` (inserted BEFORE `/:date` route to avoid collision)
- Admin-only guard. Validates `month=YYYY-MM` query param.
- 6 sections: `dailyCloseRecords` (all finance_close_records for month), `divisionTotals` (aggregated across closed days), `payoutBatches` (with gross_cents JOIN), `payoutSummary` (batchCount/gross/net/commission totals), `disputesByResolution` (grouped by resolution_action), `refundSummary` (grouped by status)
- `meta`: totalDays, daysClosed, daysOpen, totalVatLiabilityCents
- SHA-256 + `X-Bundle-SHA256` header + `Content-Disposition: attachment; filename="petwash-finance-month-{YYYY-MM}.json"`
- Frontend: month selector (`<input type="month">`) + "Month-end Pack" button in Close History card header — client-side blob download, error toast on failure

### Phase 3.0G — Role-based Finance Permissions (COMPLETE)
- `finance_roles` table: `user_uid VARCHAR UNIQUE`, `role VARCHAR(32) CHECK (read|write|admin)`, `granted_by`, timestamps; `idx_fr_user_uid`, `idx_fr_role`
- `requireFinanceRole(req, res, minRole)` helper with `FINANCE_ROLE_RANK` hierarchy (read < write < admin). Bootstrapping: admins with no explicit role default to `finance_admin` (preserves existing workflows, no lockout)
- 3 sensitive endpoints now require finance role:
  - `POST /payout-batches/create` → `finance_write`
  - `POST /disputes/:caseRef/apply-resolution` → `finance_write`  
  - `POST /finance-close/:date/close` → `finance_admin`
- Role management CRUD endpoints (all admin-gated):
  - `GET /admin/wallet/finance-roles` — list all explicit role assignments
  - `POST /admin/wallet/finance-roles/:uid` — assign or update (UPSERT) role for a user
  - `DELETE /admin/wallet/finance-roles/:uid` — remove explicit role (user reverts to default)
- Frontend: "Finance Roles" tab in AdminWalletDashboard — role hierarchy cards (read/write/admin), assign/update form (UID input + role selector), role list table with Remove action, empty state with bootstrapping message

---

## Phase 3.1 — Finance Operations Layer II (COMPLETE)

### Phase 3.1A — Payout File Formats (COMPLETE)
- 6 export serializers: `csv`, `tranzilla`, `hapoalim`, `mizrahi`, `iban_csv`, `quickbooks_iif`
- `GET /admin/wallet/payout-batches/:batchId/export?format=` — content-type & filename set per format
- `allowedFormats[]` on finance-roles GET response
- Frontend: format selector dropdown in batch detail drawer

### Phase 3.1G — Role Audit Logs (COMPLETE)
- `role_audit_log` table: `id`, `grantor_uid`, `target_uid`, `old_role`, `new_role`, `action` (grant|update|revoke), `created_at`; indexes: idx_ral_target, idx_ral_grantor, idx_ral_created_at
- POST/DELETE `/finance-roles/:uid` write audit rows (reads old role first for update detection)
- `GET /admin/wallet/finance-roles/audit` — last 200 changes
- Frontend: "Role Change Audit Log" card in Finance Roles tab

### Phase 3.1D — Finance Activity Timeline (COMPLETE)
- `finance_audit_log` table: `id`, `actor_uid`, `action`, `entity_type`, `entity_id`, `prev_state` JSONB, `new_state` JSONB, `ip_address`, `created_at`; 4 indexes
- `recordFinanceAction()` helper — fire-and-forget, never throws
- 3 instrumented mutations: `payout_batch_create`, `dispute_resolution_{action}`, `finance_day_close`; also `remittance_send` (Phase 3.1C)
- `GET /admin/wallet/finance-audit` — filters: actor/action/entityType/from/to; 50/page pagination
- Frontend: "Finance Activity" tab — filter bar, event list, action badges, JSON detail expand

### Phase 3.1B — Provider Clawback History (COMPLETE)
- `clawback_reason VARCHAR(256)` on `provider_payout_entries` (nullable)
- Negative-batch guard: `POST /payout-batches/create` returns 422 if totalNetCents < 0
- `GET /provider/wallet/clawback-history` — provider-facing, grouped by month, clawbackCents per entry
- `GET /admin/wallet/clawback-summary` — admin, totals by provider; filters: from/to/divisionCode
- Frontend (ProviderDashboard): Clawback History card in Earnings tab (Hebrew, red accent, monthly groups)
- Frontend (AdminWalletDashboard): Clawback Summary card in Batches tab

### Phase 3.1C — Automated Remittance Emails (COMPLETE)
- `remittance_email_log` table: `id`, `batch_id`, `provider_uid`, `status CHECK(pending|sent|failed)`, `sent_at`, `error_detail`, `created_at`; UNIQUE(batch_id, provider_uid) enforces idempotency
- Email lookup: tries `users.email` → fallback `provider_applications.email`; HTML statement with gross/commission/net breakdown
- `POST /admin/wallet/payout-batches/:batchId/send-remittances` — finance_write, idempotent (skips already-sent), writes finance audit log
- `GET /admin/wallet/payout-batches/:batchId/remittance-log` — admin, delivery status per provider
- Frontend: "✉ Send Remittances" button in batch detail header; Remittance Delivery Log table with status badges

### Phase 3.1F — Dispute SLA Reporting (COMPLETE)
- SLA thresholds: amount_disputed_cents ≥ 50000 (₪500) = 24h; standard = 72h
- `GET /admin/wallet/dispute-sla-report` — admin; filters: from/to/divisionCode/status; returns compliancePct, avgDurationHours, per-case slaMet/slaBreached/durationHours
- Frontend: SLA Compliance Report card in Disputes tab — 4-metric summary grid, progress bar (green/amber/red by threshold), case table (top 20)

### Phase 3.1E — Monthly Variance Analysis (COMPLETE)
- `GET /admin/wallet/variance-analysis?month=YYYY-MM` — admin; compares current vs previous month
- 8 metrics: grossPayoutCents, netPayoutCents, commissionCents, entryCount, providerCount, disputeCount, resolvedDisputeCount, disputedCents
- Returns changePct per metric; dispute metrics: negative changePct = good (green)
- Frontend: Monthly Variance Analysis card at top of fin-activity tab — month picker, 2-column grid, color-coded %Δ badges

## Phase 3.2 — Finance Operations Layer III (COMPLETE)

### Phase 3.2A — Bank Reconciliation (COMPLETE)
- DB: `bank_reconciliation_uploads` table; `settled_at TIMESTAMPTZ`, `bank_ref VARCHAR(128)` on `provider_payout_entries`
- `POST /admin/wallet/payout-batches/:batchId/reconcile` — CSV upload (multer, memStorage, 4MB max); matches by provider_uid, ±1 ILS tolerance; marks entries `settled`; writes to bank_reconciliation_uploads + audit log
- `GET /admin/wallet/payout-batches/:batchId/reconciliation` — upload history + per-provider settlement state + summary counts
- Frontend: CSV upload zone in batch detail drawer; settlement progress bar; per-provider settlement table; upload history

### Phase 3.2B — Remittance Resend & Failure Recovery (COMPLETE)
- DB: `retry_count INTEGER DEFAULT 0`, `last_retry_at TIMESTAMPTZ` on `remittance_email_log`
- `POST .../resend-remittance/:providerUid` — single retry; 409 if already sent successfully; increments retry_count; audited
- `POST .../retry-failed` — bulk retry all failed entries; increments retry_count; audited
- Frontend: "Retry" button per row (non-sent entries); "↺ Retry All Failed (N)" button in log header; retry_count column

### Phase 3.2C — Dispute Escalation Automation (COMPLETE)
- DB: `escalated_at TIMESTAMPTZ`, `escalated_by VARCHAR(128)`, `escalation_note TEXT` on `dispute_cases`
- `POST /admin/wallet/disputes/:caseRef/escalate` — manual escalation; 409 if already escalated; fires finance_alert; audited
- `POST /admin/wallet/disputes/auto-escalate` — internal cron endpoint; scans SLA-breached open/investigating cases
- Scheduler: `autoEscalateSlaBreachedDisputes()` runs at :15 every hour via daily-close-reminder job; 24h for ≥₪500, 72h otherwise
- Frontend: Escalate panel in dispute drawer (purple); escalation info badge if already escalated

### Phase 3.2D — Finance Alerts (COMPLETE)
- DB: `finance_alerts` table (id, alert_type, severity CHECK(info|warning|critical), entity_type, entity_id, detail JSONB, acknowledged_at, acknowledged_by, created_at)
- `GET /admin/wallet/alerts` — all unacknowledged (or ?includeAcknowledged=true); with unacknowledged count summary
- `POST /admin/wallet/alerts/:alertId/acknowledge` — single ack; finance_write required
- `POST /admin/wallet/alerts/acknowledge-all` — bulk ack; finance_write required
- Alert sources: dispute escalation, SLA breach auto-escalation, monthly sign-off confirmation
- Frontend: Finance Alerts card in fin-activity tab; severity badges (critical=red, warning=amber); per-alert Ack button; "Acknowledge All" bulk; auto-refreshes every 60s

### Phase 3.2E — Monthly Sign-off Workflow (COMPLETE)
- DB: `monthly_signoffs` table (id, month VARCHAR(7) UNIQUE, signed_off_by, signed_off_at, notes, is_final BOOLEAN DEFAULT TRUE)
- `GET /admin/wallet/monthly-signoff?month=YYYY-MM` — returns signedOff bool + sign-off record
- `POST /admin/wallet/monthly-signoff` — irreversible; 409 if already signed off; fires finance_alert; audited
- Frontend: Sign-off section inside variance card; confirmation dialog; green banner if already signed off

### Phase 3.2F — Close-to-Close Variance Commentary (COMPLETE)
- DB: `variance_comments` table (id, month, metric, comment, author_uid, created_at, updated_at; UNIQUE on month+metric)
- `GET /admin/wallet/variance-commentary?month=YYYY-MM` — all comments for month
- `POST /admin/wallet/variance-commentary` — upsert (mutable, unlike sign-off); ≤2000 chars; audited
- Frontend: Inline comment fields per metric inside variance card; dirty-state Save buttons per field

## Phase 3.3 — Finance Operations Layer IV (COMPLETE)

### Phase 3.3A — Reconciliation Exception Workflow (COMPLETE)
- DB: `bank_reconciliation_exceptions` (upload_id, batch_id, provider_uid, raw_row JSONB, detected_reason, status CHECK(open|matched_manually|ignored|escalated), matched_payout_entry_id, assigned_admin_uid, resolution_note, resolved_at)
- Extended `POST /reconcile` — unmatched rows now create exception records automatically; fires finance_alert if ≥1 exception
- `GET /admin/wallet/reconciliation-exceptions` — filterable by status/batchId/providerUid/assignedAdminUid/from/to
- `PATCH /admin/wallet/reconciliation-exceptions/:id` — actions: assign, ignore, escalate, note; all audited
- `POST /admin/wallet/reconciliation-exceptions/:id/match` — manual match to payout entry; settles the entry; closes exception
- Frontend: New "Recon Exceptions" tab; filter bar; status-chip table; right-side drawer with raw-row viewer, note field, manual match section; inline ignore/escalate buttons

### Phase 3.3B — Alert Digests & Escalation Ladders (COMPLETE)
- DB: `finance_alert_deliveries` (alert_id, delivery_type CHECK(digest|escalation), recipient_uid, recipient_email, sent_at, status, error_detail); `escalated_at`, `escalation_level` columns added to `finance_alerts`
- Cron jobs added to daily-close-reminder.ts: daily digest at 07:30 IL, escalation ladder every 30 min (L1@30min, L2@2h, L3@6h for unacknowledged critical alerts)
- `GET /admin/wallet/alerts/delivery-log` — filterable by alertId/from/to; joins finance_alerts for type/severity
- `POST /admin/wallet/alerts/:id/escalate-now` — manual escalation; increments level; records delivery; audited
- `GET /admin/wallet/alerts/digest-preview` — grouped count of unacknowledged alerts for current day
- Frontend: "📬 Delivery Log" button opens right-side drawer with delivery history + digest preview; ESC L{n} badge per alert; "↑ Escalate" button for unacknowledged critical alerts

### Phase 3.3C — Sign-off Export Pack (COMPLETE)
- `GET /admin/wallet/monthly-signoff/:month/export` — deterministic JSON pack with SHA-256 manifest
- Pack includes: sign-off metadata, settlement summary, batch summary, recon exception summary, dispute SLA summary, alerts summary, variance commentary
- Frontend: "⬇ Download Sign-off Pack" button appears in the variance card's sign-off section once month is signed off

### Phase 3.3D — Provider Settlement Self-Service (COMPLETE)
- `GET /provider/wallet/settlement-status` — provider-scoped: entries with batch status + settled_at + bank_ref + remittance status; summary tile counts
- `GET /provider/wallet/remittance-log` — provider-scoped remittance history
- `GET /provider/wallet/payout-batch/:batchId` — provider-specific batch + entries + remittance status; 403 if no entries for that provider
- Frontend (ProviderDashboard): New "פירוט תשלומים" card under earnings tab; 3-tile summary; entries table with Earned/Batched/Remittance/Bank-Settled status columns; remittance history list

### Phase 3.3E — Monthly Board Pack (COMPLETE)
- `GET /admin/wallet/board-pack?month=YYYY-MM` — management summary: financials (gross/net/commission/VAT/netMargin), provider count, remittance coverage, recon exceptions, dispute SLA compliance, variance vs prior month, commentary rollup, sign-off state, key risks array
- Frontend: New "Board Pack" tab in AdminWalletDashboard; month picker + Load button; 8-tile summary grid; risk callout panel (red); commentary rollup; sign-off state badge

### Phase 3.3F — Cross-Check Integrity Jobs (COMPLETE)
- DB: `integrity_job_runs` (job_name, started_at, completed_at, status CHECK(running|passed|failed|error), findings_count, summary JSONB)
- `POST /admin/wallet/integrity/run` — runs 5 jobs: batch_vs_entries, remittance_coverage, settled_without_reconciliation, signoff_open_exceptions, close_continuity; writes finance_alerts on failure; audited
- `GET /admin/wallet/integrity/history` — DISTINCT ON (job_name) latest run per job
- Frontend: New "Integrity" tab; "▶ Run All Checks Now" button; per-job pass/fail cards with findings count

### Phase 3.3G — Permission Hardening (COMPLETE)
- DB: `finance_role_capabilities` (role_name, capability; UNIQUE); seeded with default grants per role
- Capabilities: payout_batch_create, payout_batch_reconcile, remittance_send, dispute_resolve, refund_approve, finance_close, monthly_signoff, finance_role_manage
- `GET /admin/wallet/capabilities?roleName=...` — capabilities for role (or all roles grouped)
- `POST /admin/wallet/capabilities` — grant/revoke capability (finance_admin only); audited
- finance_write cannot grant monthly_signoff or finance_role_manage; finance_read has no write capabilities

## Phase 3.4 — Automation, Forecasting & Executive Controls (COMPLETE)

### Phase 3.4A — Cash Forecasting (COMPLETE)
- `GET /admin/wallet/cash-forecast?horizon=7|14|30` — deterministic forecast with no DB mutations
- Inputs: pending payout entries, open batches, pending refund approvals, 30-day avg VAT and gross from close records
- Response: totals (payouts/refunds/VAT/netCashNeed) + per-day breakdown + assumptions array
- DB: `cash_forecast_snapshots` (optional cache table; not currently written to on each request)
- Frontend: "Forecast" tab; horizon selector (7/14/30d); 4 KPI tiles; day-by-day table; assumptions panel

### Phase 3.4B — Payout Scheduling Automation (COMPLETE)
- DB: `payout_schedules` (cadence: daily|weekly|fortnightly|monthly; minBatchNetCents; dayOfWeek/dayOfMonth) + `payout_schedule_runs`
- `GET/POST/PATCH /admin/wallet/payout-schedules` — CRUD for schedules; all mutations audited
- `POST /admin/wallet/payout-schedules/:id/run-now` — creates batch immediately if eligible entries exist; skips and logs if below threshold
- `GET /admin/wallet/payout-schedules/runs` — run history (filterable by scheduleId)
- Cron: every 15 min, checks enabled schedules; idempotency guard prevents double-batching within cadence window
- Frontend: "Schedules" tab; create form; schedule list with enable/disable + run-now; recent runs table

### Phase 3.4C — Dispute SLA Auto-Routing (COMPLETE)
- DB: `dispute_routing_rules` (divisionCode, min/maxAmountCents, assignToUid, queueName, priority, enabled); dispute_cases extended with routing columns
- `GET/POST/PATCH /admin/wallet/dispute-routing-rules` — CRUD; ordered by priority ascending
- `POST /admin/wallet/disputes/:caseRef/route` — matches best rule by div+amount; fires finance_alert if unroutable; supports manual override via body params; audited
- Frontend: "Routing" tab; manual route-by-ref input; add-rule form; rules table with enable/disable toggles

### Phase 3.4D — Finance Control Center (COMPLETE)
- `GET /admin/wallet/control-center` — single aggregation: cashNeeded, openBatchCount, pendingRefunds, openReconExceptions, criticalUnackedAlerts, todayCloseStatus
- Each widget has: label, value/count, status (critical|warning|ok), link target tab
- Frontend: "Control Center" tab; 6-widget grid with status-color borders; auto-refreshes every 60s; last-updated timestamp

### Phase 3.4E — Executive KPI Snapshots (COMPLETE)
- `GET /admin/wallet/executive-kpis?period=daily|weekly|monthly` — derives from finance_close_records, dispute_cases, refund_approvals, monthly_signoffs, finance_alerts
- Returns: gross/net/VAT/commission/payouts/refunds, refundRatePct, marginPct, disputeBreachRatePct, reconExceptionsOpen, signoffStatus, criticalAlertsUnacked, topRisks[], topImprovement
- Caches snapshot to `executive_kpi_snapshots` table (ON CONFLICT DO NOTHING)
- Frontend: "Executive" tab; period selector; 8-tile KPI grid; risk callout panel (red); improvement suggestion (green)

### Phase 3.4F — Retention & Archive Policy (COMPLETE)
- DB: `finance_archive_policies` (entityType, retentionDays, archiveAfterDays, enabled) + `finance_archive_runs`; seeded with 5 default policies
- `GET/POST/PATCH /admin/wallet/archive-policies` — CRUD; all mutations audited
- `GET /admin/wallet/archive-runs` — run history
- `POST /admin/wallet/archive-runs/dry-run` — simulation only; counts eligible rows per policy; writes dry_run entry to archive_runs; NO destructive deletes in 3.4
- Frontend: "Archive" tab; warning banner (simulation-only); policies table; dry-run button; recent runs table

### Phase 3.4G — Disaster Recovery & Replay (COMPLETE)
- DB: `finance_replay_runs` (replayType, dryRun, status, findingsJson, appliedCount, initiatedBy)
- 4 replay types: rebuild_payout_batch_totals, rebuild_remittance_status, rebuild_close_snapshots, recheck_reconciliation_links
- `POST /admin/wallet/replay/dry-run` — async (202); writes run record; fires background replay; returns runId
- `POST /admin/wallet/replay/execute` — finance_admin only; same logic with dryRun=false; only touches derived state never immutable facts
- `GET /admin/wallet/replay-runs` — full history with findings JSON
- Frontend: "Recovery" tab; replay type radio selector; dry-run + execute buttons; collapsible findings viewer per run

## Phase 3.5 — Advanced Finance Intelligence Layer (COMPLETE)
- Model weights engine: `finance_model_weights` table; GET/POST/PATCH routes; frontend "forecast" tab weight editor
- Release policy designer: `batch_release_policies` table; CRUD routes; "batches" tab policy designer
- Digest preferences: `finance_digest_prefs` table; GET/PATCH routes; "control-center" digest section
- Archive retrieval: GET `/admin/wallet/archive-entries`, `/archive-entries/:id/restore`; "archive" tab

## Phase 3.6 — Intelligence & Governance Layer (COMPLETE)
### 3.6A — Model Weights
- `finance_model_weights` table: modelType, featureKey, weightValue, isActive, divisionCode
- Frontend: weight editor in "forecast" tab; per-feature sliders & save

### 3.6B — Release Policies  
- `batch_release_policies` table: policy conditions + actions
- Frontend: policy designer in "batches" tab

### 3.6C — Digest Preferences
- `finance_digest_prefs` table: channel, frequency, recipientUid, divisionCode
- Frontend: subscription manager in "control-center" tab

### 3.6D — Archive Retrieval
- Soft-delete archive browsing + restore endpoint
- Frontend: "archive" tab with restore action

### 3.6E — Diff Viewer
- Period-over-period comparison: `/admin/wallet/archive-diff`
- Frontend: "recovery" tab diff renderer (JSON tree view)

### 3.6F — Policy Engine
- `finance_policy_rules` table: policyKey, value, divisionCode, isActive
- Seeded 5 default policies (refund_auto_approve_limit, payout_auto_release_limit, dispute_sla_hours, forecast_default_horizon, archive_protected_entities)
- Frontend: "policies" tab; policy table; edit/enable/disable; add rule form

### 3.6G — Period Close Packs
- `finance_close_records` table + `period_close_packs` table
- `/admin/wallet/period-pack/generate` + `/admin/wallet/period-pack/export`
- Frontend: "executive" tab close pack generator

## Phase 3.7 — Finance Decision Support Layer (COMPLETE)
### 3.7A — Policy Simulation Engine
- `policy_simulations` table: records every simulation run with risk score, affected entities, outcome detail
- `POST /admin/wallet/policy-simulation/run` — models impact of proposed policy change against live data
- `GET /admin/wallet/policy-simulation/history` — full simulation audit trail
- Frontend: "Simulation" tab — policy key selector, proposed value input, risk score badge, history table

### 3.7B — Approval Chain Designer
- `approval_chains` + `approval_chain_steps` + `approval_requests` + `approval_request_actions` tables
- Full CRUD for chains and steps; `POST /approval-requests/:id/act` (approve / reject / escalate)
- Frontend: "policies" tab — chain designer with expandable step editor, pending requests queue with approve/reject/escalate buttons

### 3.7C — Forecast Scenario Planner
- `forecast_scenarios` table: revenueAdjustmentPct, bookingVolumeAdjustmentPct, baseHorizonDays, weightOverrides, lastRunResult
- `POST /forecast-scenarios/:id/run` — computes projected revenue vs. base using live wallet transaction data
- Frontend: "Simulation" tab — scenario cards with run button, inline result display (base, projected, delta)

### 3.7D — Exception Suggestion Engine
- `exception_suggestions` table: exceptionType, entityId, suggestedAction, confidenceScore, status
- `POST /exception-suggestions/generate` — scans for overdue disputes, negative balances, stale payout batches
- `POST /exception-suggestions/:id/apply|dismiss`
- Frontend: "control-center" tab — suggestion cards with Apply/Dismiss; confidence score display

### 3.7E — Board-Level Governance Report
- `GET /admin/wallet/governance-report` — cross-entity aggregation: wallets, refunds, payouts, disputes, approvals, open exceptions, recent simulations
- Frontend: "governance" tab — metric grid, exception type badges, recent simulation history table

### 3.7F — Finance Decision Assistant
- `POST /admin/wallet/finance-assistant` — scans live system state; surfaces prioritised action recommendations by context (forecast, period-close, policy, disputes)
- Frontend: "governance" tab — context selector, optional question input, priority-coded recommendation list


### Phase 4.0 — Outcome Intelligence, Self-Healing & Operations Command (COMPLETE)

#### New Tables (7)
- `policy_outcome_scores` — ROI scoring: baseline vs actual across 6 weighted metrics (payout delay, refund cycle, dispute breach, anomaly rate, margin, manual intervention)
- `orchestration_retry_policies` — allowlist-based auto-retry rules per failure class (email_send, archive_retrieval, downstream_timeout)
- `orchestration_retry_attempts` — immutable audit trail of every auto-retry attempt
- `approval_bottleneck_snapshots` — periodic snapshots of pending/stuck approval requests for trend analysis
- `governance_pack_subscriptions` — audience routing rules for governance pack distribution
- `scenario_entity_scores` — per-entity ROI scores for a given simulation scenario
- `anomaly_clusters` — grouped anomaly signals with type, severity, and size metadata

#### Routes (4.0A–4.0G) — all in `server/routes/prestige-pass.ts`
- 4.0A: Policy outcome CRUD + `/recompute` (auto-scores ROI from actual vs baseline)
- 4.0B: Retry policy CRUD + PATCH enable/disable; recent attempts log
- 4.0C: Bottleneck analytics — avg time to first/final approval, stuck requests (&gt;24h), by-chain-type breakdown, per-request timeline
- 4.0D: Pack subscription CRUD + PATCH enable/disable
- 4.0E: Scenario entity scores — filter by scenario ID, auto-tags top/weakest entity
- 4.0F: Anomaly cluster recompute + read
- 4.0G: Command center aggregator — single endpoint combining alerts, approvals, orchestration, anomaly, governance, disputes into one summary payload

#### Frontend UI (AdminWalletDashboard.tsx)
- 4.0A → Policies tab: Policy Outcome & ROI Scoring card
- 4.0E → Simulation tab (top): Scenario Entity Impact Scores card
- 4.0D → Governance tab: Pack Subscriptions by Audience card
- 4.0B → Orchestration tab: Self-Healing Retry Policies card
- 4.0C → Orchestration tab: Approval Bottleneck Analytics card
- 4.0F → Control-Center tab: Anomaly Clusters card (from T004 initial session)
- 4.0G → New "Command Center" tab: Finance Operations Command Center (KPI tiles + 6 drill-through panes)

### Phase 4.5 — Business Survival Hardening (COMPLETE)

#### New Tables (4)
- `system_kill_switches` — 5 keys (payouts, remittances, automation, policy_execution, assistant_execution), boolean enabled + timestamp
- `idempotency_keys` — tracks key+endpoint+response_hash to prevent duplicate financial operations
- `money_flow_checks` — audit log of every money integrity check run (check_type, entity_id, expected vs actual, status)
- `go_live_checklist` — 9 pre-launch checklist items with per-item verify/unverify + verified_by tracking

#### Backend Routes (7 sections, all in `server/routes/prestige-pass.ts`)
- 4.5C: `GET/POST /kill-switches` — list all 5 switches; `/toggle` flips and logs; `/check` returns blocked state
- 4.5D: `POST /test-retry-safety` — idempotency header/body key test; `GET /idempotency-keys` — recent records
- 4.5A: `GET /permission-audit` — static map of 12 critical endpoint groups → required role + guard type; returns 0-unprotected summary
- 4.5B: `POST /run-money-checks` + `GET /money-check-results` — 4 financial integrity checks (negative wallets, batch sum, refund overflow, settled/recon mismatch)
- 4.5E: `GET /security-audit` — 12 static security surface checks returning pass/review/critical breakdown
- 4.5F: `GET /consistency-check` — 4 cross-table mismatch detectors (booking↔wallet, dispute↔refund, settled↔tx, recon↔batch)
- 4.5G: `GET/POST /go-live-checklist` + `/verify` + `/unverify` + `GET /rollback-plan` — 9-step rollback runbook with urgency levels and data protection rules

#### Frontend UI (AdminWalletDashboard.tsx)
- 4.5C → Control-Center tab: Kill Switches card — per-switch enable/disable with instant visual feedback
- 4.5D → Control-Center tab: Idempotency & Retry Safety card — test key entry, result badge, recent records table
- 4.5A → Governance tab: Permission Audit card — protected/unprotected counts, full endpoint table
- 4.5E → Governance tab: Security Audit card — per-check pass/review/critical badges with risk level
- 4.5G → Governance tab: Go-Live Checklist + Rollback Plan card — item-level verify/reset, rollback drawer with 9 steps + urgency levels
- 4.5B → Command Center tab: Money Flow Integrity card — run checks button, per-check pass/fail display
- 4.5F → Command Center tab: Consistency Check card — on-demand scan, mismatch type breakdown with sample IDs
