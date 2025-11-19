# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is an enterprise platform for the pet care industry, integrating business units like IoT wash stations, pet sitting, walking, and avatar creation. It leverages shared infrastructure for authentication, payments, AI services, compliance, and franchise management. The platform aims for global expansion, starting with the Israeli luxury market, and features a 7-Star Loyalty System, robust security, and a Unified Control Panel for enterprise orchestration.

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

### 🚨 CRITICAL DEVELOPER RULE: SEARCH FIRST, BUILD SECOND
Before adding ANY new code, you MUST:
1. Check `shared/petwashGlobal.ts` (Single source of truth)
2. Search `server/services/`, `client/src/pages/`, `client/src/components/`
3. Document what exists, what's missing, and integration approach
4. Only build if gap truly confirmed

### Core Features & Design Decisions
- **Global Architecture Module**: `shared/petwashGlobal.ts` for core platform catalog, KYC, wallet, payments, booking, and mobile contracts.
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite. Responsive, mobile-first, luxury designs with glassmorphism, Apple-style animations, and bilingual direction-aware layouts.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching.
- **Authentication & User Management**: Firebase Auth, WebAuthn/Passkey, RBAC, biometrics, GDPR-compliant data handling.
- **AI Chat Assistant**: Production-ready Google Dialogflow CX powered by Gemini 2.5 Flash with Kenzo mascot, bilingual Hebrew/English, WCAG 2.1 AA compliant.
- **Marketplaces**: The Sitter Suite™, Walk My Pet™, PetTrek™.
- **The Plush Lab™**: AI-powered pet avatar creator.
- **Loyalty Program**: 7-tier luxury progressive system, e-gift cards, wash packages, Apple Wallet integration.
- **E-Signature**: DocuSeal with Hebrew RTL support.
- **Enterprise Features**: Multi-country/currency, franchise management, IoT monitoring, secure document management, KYC.
- **Financial Management**: Automated bookkeeping (Google Vision OCR + Gemini 2.5 Flash), Israeli Tax Compliance, bank reconciliation, invoicing, VAT reclaim.
- **Payment Gateway Architecture**: Nayax Israel is the mandatory and exclusive payment gateway, with 72-hour escrow.
- **K9000 IoT Integration**: Cloud-based management, real-time status, remote control, AI predictive maintenance.
- **Passport Verification (KYC)**: Google Vision API-powered passport verification with MRZ parsing.
- **Security & Compliance**: Firebase App Check, performance monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025, AI monitoring, GDPR consent, blockchain-style audit trail.
- **Unified Luxury Booking System**: Enterprise-grade booking using a strategy pattern, supporting loyalty tiers, booking policies, 72-hour escrow, GPS activation, multi-driver dispatch, IoT unlock tokens, dynamic surge pricing, and progressive provider payouts.
- **Employee Expense Management System**: Production-ready with Israeli Tax Authority compliance, OCR receipt scanning, and cryptographic audit trail.
- **Document Management System**: Production-ready with RBAC, Google Cloud Storage integration, access audit logging, and DocuSeal e-signature.
- **Legal & Compliance Systems**: Comprehensive routes and services for privacy settings, data rights, GDPR, Israeli Privacy Law 2025, e-signature workflows, and contract management.
- **HR & Employee Systems**: Routes and services for employee management, hierarchy, and onboarding, including auto-approval workflows and WhatsApp notifications.
- **Enterprise Route Infrastructure**: Extensive set of 119 route files covering franchise management, finance, HR, operations, sales CRM, accounting, expenses, documents, compliance, audit, contracts, and signatures, organized into Head Office, Franchise, Customer, and Shared units.
- **Authentication & Authorization**: RBAC middleware with hardcoded super admins and database-driven role assignments, enforcing access levels and department permissions.
- **Israeli Contractor Compliance System**: Comprehensive marketplace broker model (like Airbnb) preventing employee misclassification. Features Osek Patur/Murshe tax verification, National Insurance tracking, 15-25% commission calculation (Israeli VAT compliant), independence scoring algorithm, monthly compliance audits, risk monitoring, SHA-256 audit trails. Includes **11 database tables** (provider_tax_compliance, provider_commissions, provider_independence_score, compliance_verification_logs, contractor_profiles, contractor_documents, contractor_insurance, contractor_background_checks, contractor_bank_details, contractor_service_areas, contractor_capabilities) and comprehensive service layer with **rule engine** (`shared/petwashIsraeliContractors.ts` + `IsraeliContractorComplianceService.ts`). Supports 7 service types: Self-Service Station Cleaning, Mobile Grooming, Pet Sitting, Dog Walking, Pet Taxi, Training, Vet Visit Assist. Each service has specific requirements (insurance, background checks, documents, tax profile). **⚠️ PRODUCTION REQUIREMENTS**: (1) Integrate with Israeli Tax Authority (Mas Hachnasa) API for real tax ID verification, (2) Integrate with National Insurance (Bituach Leumi) API for insurance verification, (3) Encrypt sensitive PII (tax IDs, National Insurance numbers, bank account numbers) at rest using AES-256 encryption, (4) Implement document upload to Google Cloud Storage with admin verification workflow.

### Unified Control Panel - Enterprise Orchestration Layer
- **RBAC Foundation**: 16 Departments, 11 Roles, 10 Platforms with scoped permissions, Control Panel Registry Service, 6 API endpoints.
- **Core Infrastructure**: Logistics & Fleet (14 API endpoints), Finance & Settlements (7 API endpoints, automated monthly settlements with Israeli VAT, SHA-256 audit hashing), Israeli CPI Service (8 API endpoints for indexation calculations, Bank of Israel data source, monthly updates), Event-Driven Architecture (23 domain event types, event store, EventPublisher service, critical event handlers, K9000 & Nayax integration).
- **Mobile & Advanced Features**: Mobile Field Operations (8 API endpoints, photo uploads, Waze deep linking, GPS station search, FCM push notifications), Health & Safety (9 API endpoints, incident reporting, photo documentation, email notifications), Inventory Management (11 API endpoints, supply tracking, low-stock alerts, purchase order generation), Unified Notifications (12 API endpoints, multi-channel orchestration, template management, EventBus integration).
- **Database Impact**: 14 new tables for departments, roles, user roles, logistics, partners, settlements, events, field updates, health/safety, inventory, notifications, and CPI history.
- **API Summary**: 72 new REST endpoints across 9 modules.
- **Legal Compliance**: Israeli VAT, SHA-256 audit hashing, tamper-proof settlement records, H&S incident documentation, complete notification audit trail, automatic CPI indexation per Israeli law.

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