# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is an enterprise platform for the luxury pet care industry, offering a global, scalable ecosystem for services such as IoT wash stations, pet sitting, walking, and AI-powered pet avatar creation. It centralizes authentication, payments, AI services, compliance, and franchise management, incorporating a 7-Star Loyalty System and robust security. The platform's ambition is to become the leading global provider of luxury pet care, with an initial focus on the Israeli market.

## User Preferences
Preferred communication style: Simple, everyday language.

CRITICAL RULE: Never make layout or styling changes without explicit user approval - user gets extremely upset when changes are made to working designs.
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

**CRITICAL DEPLOYMENT RULE:**
- We develop on Replit, push to GitHub, and deploy ONLY to Google Firebase.
- Replit URLs are development-only and MUST NEVER be connected to DNS or production domains.
- Production domains (petwash.co.il, www.petwash.co.il) always point to Firebase Hosting IP: 199.36.158.100.
- NEVER use Replit Publishing "Domains" feature for production - it causes conflicts with Firebase.
- The Replit "Publish" feature is for development preview only.

### Core Features & Design Decisions
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite. Emphasizes responsive, mobile-first, luxury design with glassmorphism and Apple-style animations, supporting bilingual direction-aware layouts.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching.
- **Authentication & User Management**: Firebase Auth with Twilio SMS, WebAuthn/Passkey, RBAC, biometrics, GDPR compliance.
- **AI Chat Assistant**: Google Dialogflow CX with Gemini 2.5 Flash, bilingual (Hebrew/English), WCAG 2.1 AA compliant.
- **Marketplaces**: The Sitter Suite™, Walk My Pet™, PetTrek™, The Plush Lab™ (AI avatar creator).
- **Loyalty Program**: 7-tier system, e-gift cards, wash packages, Apple Wallet integration.
- **E-Signature**: DocuSeal with Hebrew RTL support; custom system for Israeli subcontractor agreements.
- **Enterprise Features**: Multi-country/currency, franchise management, IoT monitoring, secure document management, KYC, automated bookkeeping, Israeli Tax Compliance, bank reconciliation, invoicing, VAT reclaim.
- **Payment Gateway Architecture**: Nayax Israel is the exclusive payment gateway, with 72-hour escrow.
- **K9000 IoT Integration**: Cloud management, real-time status, remote control, AI predictive maintenance, 7-star luxury LED ecosystem.
- **Security & Compliance**: Google reCAPTCHA v3, Firebase App Check, performance monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025, AI monitoring, GDPR consent, blockchain-style audit trail. Optional Two-Factor Authentication (2FA) via SMS + Email.
- **Unified Luxury Booking System**: Enterprise-grade booking with loyalty tiers, policies, 72-hour escrow, GPS activation, multi-driver dispatch, IoT unlock tokens, dynamic surge pricing, and progressive provider payouts.
- **Employee Expense Management System**: Israeli Tax Authority compliant with OCR receipt scanning and cryptographic audit trail.
- **Document Management System**: RBAC, Google Cloud Storage integration, access audit logging, and DocuSeal e-signature.
- **Legal & Compliance Systems**: Routes for privacy, data rights, GDPR, Israeli Privacy Law 2025, e-signature, contract management.
- **HR & Employee Systems**: Routes for employee management, hierarchy, onboarding, auto-approval workflows, and WhatsApp notifications.
- **Enterprise Route Infrastructure**: Extensive route files for franchise, finance, HR, operations, sales CRM, accounting, expenses, documents, compliance, audit, contracts, and signatures, organized into Head Office, Franchise, Customer, and Shared units.
- **Authentication & Authorization**: RBAC middleware with hardcoded super admins and database-driven role assignments. Optional 2FA (SMS + Email OTP) for management and providers.
- **Registration Confirmation Emails**: Luxury confirmation emails from support@petwash.co.il for all registration types.
- **Israeli Contractor Compliance System**: Marketplace broker model preventing employee misclassification, with tax verification, National Insurance tracking, commission calculation, independence scoring, compliance audits, risk monitoring, and SHA-256 audit trails.
- **Unified Talent Marketplace System 2026**: All-in-one marketplace system (`src/marketplace/petwash_talent_marketplace_system_2026.tsx`) covering 7 platforms with backend API registration, frontend React components, route wrappers, and QA validation.
- **Pet Sitter Profile Pages**: Airbnb-style luxury profile component (`src/modules/pet-sitter/PetSitterProfilePage.tsx`) with hero gallery, services toggle, reviews, and booking card.
- **Multi-Platform Marketplace View**: Unified marketplace page (`src/modules/platforms/PetWashTalentMarketplacePage.tsx`) showing contractors across all 7 platforms with color-coded branding, responsive grid layout, and demo profiles.
- **MadPaws-Style Provider Search**: API at `/api/marketplace-bookings/search/providers` with real-time availability filtering, profile enrichment, and pagination. Frontend at `/sitter-suite/browse` displays provider cards with Hebrew names, bios, locations, and pricing.
- **Octopus Global Brain Engine**: Unified backend booking/financial engine at `/api/octopus/v1/*`. All financial writes flow through Octopus Brain. Features: unified booking creation with 15% flat platform fee, atomic wallet debit/credit with race-safe conditional updates, immutable financial ledger, invoice stub generation, provider search with KYC enforcement, idempotency protection on bookings and wallet ops, multi-platform separation.

### File Storage & Admin Access
- **Document Storage**: Google Cloud Storage bucket `petwash-secure-documents`.
- **Biometric Storage**: Firebase Storage bucket `signinpetwash.firebasestorage.app`.
- **Admin File Access**: Admin users with `view_documents` permission can view documents via `/api/documents`.
- **RBAC Permissions**: Document access controlled by role-based permissions.

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