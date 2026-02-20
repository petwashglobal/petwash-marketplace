# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is an enterprise platform aiming to be the leading global luxury pet care provider, starting in Israel. It offers a scalable ecosystem for IoT wash stations, pet sitting, walking, and AI-powered pet avatar creation. The platform centralizes authentication, payments, AI services, compliance, and franchise management, supported by a 7-Star Loyalty System and robust security.

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
- **Firebase Project**: `signinpetwash`.
- **CI/CD Pipeline**: Automated GitHub Actions deployment (`.github/workflows/petwash-ci.yml`) with a 5-guard protection system.
- **CRITICAL DEPLOYMENT RULE**: Replit URLs are for development only and must not be connected to production domains. Production domains point to Firebase Hosting.

### Core Features & Design Decisions
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite. Focuses on responsive, mobile-first, luxury design with glassmorphism and Apple-style animations, supporting bilingual direction-aware layouts.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching.
- **Authentication & User Management**: Firebase Auth with Twilio SMS, WebAuthn/Passkey, RBAC, biometrics, GDPR compliance. Mandatory MFA for admin roles. Email verification required for critical actions.
- **AI Chat Assistant**: Google Dialogflow CX with Gemini 2.5 Flash, bilingual (Hebrew/English), WCAG 2.1 AA compliant.
- **Marketplaces**: Includes The Sitter Suite™, Walk My Pet™, PetTrek™, The Plush Lab™ (AI avatar creator), unified under a single system covering 7 platforms.
- **Loyalty Program**: 7-tier system, e-gift cards, wash packages, Apple Wallet integration.
- **E-Signature**: DocuSeal with Hebrew RTL support; custom system for Israeli subcontractor agreements.
- **Enterprise Features**: Multi-country/currency, franchise management, IoT monitoring, secure document management, KYC, automated bookkeeping, Israeli Tax Compliance, bank reconciliation, invoicing, VAT reclaim.
- **Payment Gateway Architecture**: Nayax Israel is the exclusive payment gateway with 72-hour escrow.
- **K9000 IoT Integration**: Cloud management, real-time status, remote control, AI predictive maintenance, 7-star luxury LED ecosystem.
- **Security & Compliance**: Google reCAPTCHA v3, Firebase App Check, performance monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025, AI monitoring, GDPR consent, blockchain-style audit trail. Optional/Mandatory 2FA (SMS + Email, TOTP authenticator). Transaction OTP verification for high-value operations.
- **Unified Luxury Booking System**: Enterprise-grade booking with loyalty tiers, policies, 72-hour escrow, GPS activation, multi-driver dispatch, IoT unlock tokens, dynamic surge pricing, and progressive provider payouts. All financial writes flow through the "Octopus Global Brain Engine" with atomic wallet debit/credit, immutable financial ledger, and idempotency protection.
- **Employee Expense Management System**: Israeli Tax Authority compliant with OCR receipt scanning and cryptographic audit trail.
- **Document Management System**: RBAC, Google Cloud Storage integration, access audit logging, and DocuSeal e-signature.
- **Legal & Compliance Systems**: Routes for privacy, data rights, GDPR, Israeli Privacy Law 2025, e-signature, contract management.
- **HR & Employee Systems**: Routes for employee management, hierarchy, onboarding, auto-approval workflows, and WhatsApp notifications.
- **Enterprise Route Infrastructure**: Extensive route files for franchise, finance, HR, operations, sales CRM, accounting, expenses, documents, compliance, audit, contracts, and signatures, organized into Head Office, Franchise, Customer, and Shared units.
- **Israeli Contractor Compliance System**: Marketplace broker model preventing employee misclassification, with tax verification, National Insurance tracking, commission calculation, independence scoring, compliance audits, risk monitoring, and SHA-256 audit trails.
- **Data Retention Service**: GDPR/Israeli Privacy Law 2025 automated purge engine with defined retention policies and legal hold management.
- **iOS PWA**: Progressive Web App with service worker, manifest.json with role-based shortcuts, iOS Safari install prompt, Android beforeinstallprompt native prompt.

### File Storage & Admin Access
- **Document Storage**: Google Cloud Storage bucket `petwash-secure-documents`.
- **Biometric Storage**: Firebase Storage bucket `signinpetwash.firebasestorage.app`.
- **Admin File Access**: Admin users with `view_documents` permission can view documents via `/api/documents`, controlled by RBAC.

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
- **Messaging**: Meta WhatsApp Business API, Google Firebase Cloud Messaging (FCM).
- **Banking Integration**: Mizrahi-Tefahot Bank (via aggregator API).
- **Weather & Environmental Data**: Open-Meteo API, Google Weather API, CurrentUVIndex.com API, Open-Meteo Air Quality API.
- **E-Signature**: DocuSeal (@docuseal/api).
- **Mapping & Location**: Google Maps API.
- **AI & Vision**: Google Cloud Vision API, Google Gemini AI, Google Cloud Translation API, Google Dialogflow CX.
- **Business Management**: Google Business Profile API.
- **Google Forms Integration**: Admin-configurable embedded Google Forms.