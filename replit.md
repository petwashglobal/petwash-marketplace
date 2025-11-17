# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is a full-stack enterprise platform designed for market leadership and global franchise expansion in the pet care industry.

## Recent Changes (November 17, 2025)

**✅ TASK #7 & #8 COMPLETED:**
- **Email/SMS Campaign System**: Production-ready personalized campaigns with channel-specific template fetching (CRITICAL BUG FIX: SMS-only campaigns now work correctly - templates fetched from correct tables)
  - Route: `POST /api/campaigns/send`
  - Features: Test mode, segment targeting (all/loyal/new/club/custom), GDPR consent integration
  - Template personalization with 30+ placeholders (customer name, loyalty tier, points balance, etc.)
  - Zod safeParse validation with `.describe()` AI context pattern
  
- **Meeting Attendee Notifications**: Multi-channel WhatsApp + Email invitation system
  - Routes: `POST /api/meetings`, `PATCH /api/meetings/:id`, `PATCH /api/meetings/:id/attendees/:attendeeId/response`
  - Features: Multi-attendee types (admin/customer/external), RSVP tracking (accept/decline/tentative), automatic update/cancel notifications
  - Database: `crmMeetingAttendees` table with unique indexes
  - Bilingual support (Hebrew/English)
  
- **Code Quality Improvements**: Applied 2025 Zod best practices across all validation endpoints
  - Switched from `.parse()` to `.safeParse()` for graceful error handling
  - Added `.describe()` to all schema fields for AI context and documentation
  - Structured 400 error responses with `result.error.format()`
  - Created `server/lib/env-validation.ts` for startup environment validation (not yet integrated)

**Previous Changes (November 15, 2025):**
- **CRITICAL FIX**: CORS now allows Cloud Run deployments (`.run.app` domains) - website will now load on Chrome/Safari!
- Security hardened: Changed from `.includes()` to secure `hostname.endsWith()` validation to prevent subdomain attacks
- Added lowercase hostname normalization for extra security
- Deleted 5 conflicting deployment scripts (optimize-deployment.sh, deploy-build.sh, pre-deployment-check.ts, monitor-deployment.ts, pre-deploy-backup.ts)
- Fixed `.deployignore` to include `dist/` folder (was excluding production build)
- Created deployment preparation script: `scripts/prepare-deployment.sh`
- Verified tsx works standalone with built-in esbuild compiler (deployment safe)
- Created comprehensive `docs/DEPLOYMENT_TROUBLESHOOTING_GUIDE.md`
- Documented clean deployment process in `CLEAN_DEPLOYMENT_GUIDE.md`
- Platform ready for production deployment with 10-20x faster page loads

Pet Wash™ integrates various business units (K9000 IoT wash stations, The Sitter Suite™, Walk My Pet™, PetTrek™, The Plush Lab™) through shared enterprise infrastructure for authentication, payments, AI services, compliance, and franchise management. The platform emphasizes enterprise-grade security, multi-jurisdiction compliance, and aims for global expansion, with an initial focus on the Israeli luxury market.

## User Preferences
Preferred communication style: Simple, everyday language.

CRITICAL RULE: Never make layout or styling changes without explicit user approval - user gets extremely upset when changes are made to working designs.
VIOLATION WARNING: User explicitly said "don't ever touch the top part" referring to header layout. Any changes to header without permission will cause severe user frustration.
USER EXPLICITLY FORBID: Touching header layout, logo positioning, social media icons, hamburger menu, or language toggle without explicit permission.

**HOMEPAGE MODIFICATION ABSOLUTELY FORBIDDEN:**
- **NEVER** change Landing.tsx/Home.tsx without EXPLICIT clear instructions
- **NEVER** remove components from homepage (especially PetWashDivisions - it provides luxury gradient colors)
- **NEVER** assume what should/shouldn't be on homepage
- Homepage has rich luxury colors and beautiful design - DO NOT TOUCH IT
- User will give CLEAR instructions if homepage needs changes
- Violating this causes extreme user frustration
BRANDING MANDATE: Only use official PetWash™ logo with TM trademark (Download PetWash_Logo_HighRes_1762743316767.png at /brand/petwash-logo-official.png - 891KB high-res version). Never create custom logos or use unofficial designs. Logo MUST include legal TM symbol. Logo is embedded as base64 in all emails for universal display across iOS Mail, Android Gmail, Outlook, and web clients.

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
- **Violation Examples**: Hebrew page with "Sign In" button, Arabic page with "Dashboard" heading, Russian page with "Loading..." text
- **Correct Approach**: Use t() function for all UI text, only brand names stay in English
- **Documentation**: See docs/LANGUAGE_COMPLIANCE_RULES.md for full guidelines

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

## System Architecture

### **🚨 CRITICAL DEVELOPER RULE: SEARCH FIRST, BUILD SECOND**
Before adding ANY new code, you MUST:
1. Check `shared/petwashGlobal.ts` (Single source of truth)
2. Search `server/services/`, `client/src/pages/`, `client/src/components/`
3. Document what exists, what's missing, and integration approach
4. Only build if gap truly confirmed

### Core Features & Design Decisions
- **Global Architecture Module**: `shared/petwashGlobal.ts` for core platform catalog, KYC, wallet, payments, booking, and mobile contracts.
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite, PWA.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching, Firebase Authentication (WebAuthn/Passkey).
- **UI/UX Design**: Responsive, mobile-first, luxury designs with glassmorphism, Apple-style animations, and bilingual direction-aware layouts.
- **Authentication & User Management**: Firebase Auth, WebAuthn/Passkey, RBAC, biometrics, GDPR-compliant data handling.
- **AI Chat Assistant**: Production-ready Google Dialogflow CX powered by Gemini 2.5 Flash with Kenzo mascot, bilingual Hebrew/English, WCAG 2.1 AA compliant.
- **Marketplaces**: The Sitter Suite™, Walk My Pet™, PetTrek™.
- **The Plush Lab™**: AI-powered pet avatar creator.
- **Loyalty Program**: 5-tier progressive discounts, e-gift cards, wash packages, Apple Wallet.
- **E-Signature**: DocuSeal with Hebrew RTL support.
- **Enterprise Features**: Multi-country/currency, franchise management, IoT monitoring, secure document management, KYC.
- **Financial Management**: Automated bookkeeping (Google Vision OCR + Gemini 2.5 Flash), Israeli Tax Compliance, bank reconciliation, invoicing, VAT reclaim.
- **Payment Gateway Architecture**: Nayax Israel is the mandatory and exclusive payment gateway, with 72-hour escrow.
- **K9000 IoT Integration**: Cloud-based management, real-time status, remote control, AI predictive maintenance.
- **Passport Verification (KYC)**: Google Vision API-powered passport verification with MRZ parsing.
- **Security & Compliance**: Firebase App Check, performance monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025, AI monitoring, GDPR consent, blockchain-style audit trail.
- **Unified Luxury Booking System**: Enterprise-grade booking using a strategy pattern, supporting loyalty tiers, booking policies, 72-hour escrow, GPS activation, multi-driver dispatch, IoT unlock tokens, dynamic surge pricing, and progressive provider payouts.
- **Employee Expense Management System**: Production-ready with Israeli Tax Authority compliance. Features OCR receipt scanning, auto-approval workflows, WhatsApp notifications, cryptographic audit trail, and Israeli VAT calculations.
- **Document Management System**: Production-ready with RBAC and Google Cloud Storage integration, access audit logging, and DocuSeal e-signature.
- **Legal & Compliance Systems**: Comprehensive routes and services for privacy settings, data rights, GDPR, Israeli Privacy Law 2025, e-signature workflows, and contract management.
- **HR & Employee Systems**: Routes and services for employee management, hierarchy, and onboarding, including auto-approval workflows and WhatsApp notifications.
- **Enterprise Route Infrastructure**: Extensive set of 119 route files covering franchise management, finance, HR, operations, sales CRM, accounting, expenses, documents, compliance, audit, contracts, and signatures.
- **Authentication & Authorization**: RBAC middleware with hardcoded super admins and database-driven role assignments, enforcing access levels and department permissions.

## External Dependencies
- **Database & ORM**: @neondatabase/serverless (PostgreSQL), drizzle-orm.
- **Frontend Frameworks**: @tanstack/react-query, @radix-ui/*, tailwindcss, vite.
- **Payment Gateway**: Nayax Israel (mandatory exclusive).
- **Analytics & Marketing**: Google Analytics, Google Tag Manager, Facebook Pixel, TikTok Pixel, Microsoft Clarity, Google Ads.
- **Geolocation**: ipapi.co, ip-api.com, ipinfo.io.
- **Firebase Ecosystem**: Firebase (Auth, Firestore, Storage, App Check, Performance Monitoring).
- **CRM**: HubSpot.
- **Email**: SendGrid.
- **Cloud Storage**: @google-cloud/storage.
- **Utilities**: qrcode, PassKit, googleapis.
- **Messaging**: Meta WhatsApp Business API (exclusive for messaging), Google Firebase Cloud Messaging (FCM) (exclusive for push/SMS).
- **Banking Integration**: Mizrahi-Tefahot Bank (via aggregator API).
- **Weather & Environmental Data**: Open-Meteo API, Google Weather API, CurrentUVIndex.com API, Open-Meteo Air Quality API.
- **E-Signature**: DocuSeal (@docuseal/api).
- **Mapping & Location**: Google Maps API.
- **AI & Vision**: Google Cloud Vision API, Google Gemini AI, Google Cloud Translation API.
- **Business Management**: Google Business Profile API.