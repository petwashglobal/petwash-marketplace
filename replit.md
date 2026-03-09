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

### Core Features & Design Decisions
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite. Emphasizes responsive, mobile-first, luxury design with glassmorphism and Apple-style animations, supporting bilingual direction-aware layouts. iOS PWA support is included.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching.
- **Authentication & User Management**: Firebase Auth with Twilio SMS, WebAuthn/Passkey, RBAC, biometrics, GDPR compliance. Includes mandatory MFA for admin roles and email verification for critical actions. Features a robust user status state machine, authorization gates for roles and MFA, and an audit trail for critical actions.
- **AI Chat Assistant**: Google Dialogflow CX with Gemini 2.5 Flash, bilingual (Hebrew/English), WCAG 2.1 AA compliant.
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

## Money Flow Classification System (March 2026 Session 6)
- **Type system**: `shared/finance-flow-types.ts` — 14 `TRANSACTION_TYPES` constants, `isMarketplaceFlow` / `isDirectSaleFlow` / `hasProvider` guards, `MarketplaceFeeBreakdown`, `DirectSaleFeeBreakdown`, `ReceiptMetadata`, `MoneyFlowSummary` interfaces, `ISRAELI_TAX_2026` constants
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
  1. `POSDashboard.tsx` — real-time pulse: new requests (Accept/Decline), today's jobs, active now, finance strip, KPI row, quick actions grid
  2. `POSJobs.tsx` — full booking pipeline: 7-status tabs (New/Pending/Confirmed/Active/Done/Cancelled/Dispute), platform filter, expandable job cards with all actions (accept, decline, start, finish, report, cancel-with-reason)
  3. `POSCalendar.tsx` — 3-tab: calendar (tap to block dates, vacation mode, pause bookings), weekly recurring schedule builder, advanced settings (buffer, max jobs/day, min notice, radius, instant booking)
  4. `POSWallet.tsx` — 4-tab: overview (wallet explainer + fee breakdown), transactions (per-booking gross/fee/net ledger), payout request (IBAN/bank form), monthly reports (CSV/Excel)
  5. `POSProfile.tsx` — 4-tab: basic info (name, bio, languages, service areas, radius), per-platform services (toggle + price + description for each service under PetSitter/Walker/Washer/Trainer), business details (type, VAT number, bank account), badges (verified/insurance/premium/background)
  6. `POSSettings.tsx` — 4-tab: operational toggles (15 settings), notification alerts (6 channels), privacy settings (3 toggles), pet restrictions (5 toggles + max pets)
  7. `POSDocuments.tsx` — 3-tab: click-to-accept (6 docs with checkbox + audit trail), e-signature (8 docs with embedded DocuSign modal stub), provider uploads (5 doc types with camera/file upload + status badge)
  8. `POSNotifications.tsx` — filtered notification feed (All/Unread/Jobs/Payments/Documents/System), mark-all-read, per-notification delete, action CTAs
  9. `POSSafety.tsx` — 4-tab: report client (incident type form), block clients/addresses (with list management), emergency contacts + check-in timer, safety guidelines
  10. `POSAssistant.tsx` — full Gemini AI chat: 8 suggestion chips (Summarize day/Which job/Explain payout/Draft reply/Check docs/Pricing/Bio/Cancellation), provider stats injected into system prompt, typing indicator
- **Design**: white/gray functional theme consistent with PersonalInbox/Settings design system
- **Document workflow**: Click-to-accept = checkbox + SHA-256 audit trail. E-sign = DocuSign embedded iframe (no redirect). Both types clearly separated in UI.
- **Wallet logic**: marketplace flow (escrow → 48h hold → platform fee 18% + VAT 18% on fee → net payout). Direct platform revenue (K9000/e-gift) never shown in provider wallet.
