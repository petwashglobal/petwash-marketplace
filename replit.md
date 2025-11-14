# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is a full-stack enterprise platform by Pet Wash Ltd, encompassing multiple business units such as K9000 IoT wash stations, The Sitter Suite™ (pet sitting), Walk My Pet™ (dog walking), PetTrek™ (pet transport), and The Plush Lab™ (AI avatar creator). The platform aims for market leadership and global franchise expansion by sharing enterprise infrastructure for authentication, payments, AI services, compliance, and franchise management, ensuring enterprise-grade security and multi-jurisdiction compliance.

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

**Before adding ANY new code, you MUST:**
1. Check `shared/petwashGlobal.ts` (670 lines) - Single source of truth
2. Search `server/services/` - 118 production services (41,313 lines)
3. Search `client/src/pages/` - 192 existing pages
4. Search `client/src/components/` - 155 existing components
5. Document what exists, what's missing, and integration approach
6. Only build if gap truly confirmed

**This platform represents MONTHS of enterprise development. Respect it. Use it. Don't rebuild it.**

### Core Features & Design Decisions
- **Global Architecture Module**: `shared/petwashGlobal.ts` as the single source of truth for platform catalog, navigation, KYC, wallet, payments, booking, and mobile contracts.
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite, and PWA features.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching, Firebase Authentication (WebAuthn/Passkey).
- **UI/UX Design**: Brand-compliant, responsive, mobile-first, luxury designs with glassmorphism, Apple-style animations, and bilingual direction-aware layouts.
- **Authentication & User Management**: Firebase Auth, WebAuthn/Passkey, RBAC, biometrics, GDPR-compliant data handling.
- **AI Chat Assistant**: Google Gemini 2.5 Flash with Kenzo mascot, bilingual, context-aware, real-time avatar animations, and emotion detection.
- **Marketplaces**: The Sitter Suite™, Walk My Pet™, PetTrek™.
- **The Plush Lab™**: AI-powered pet avatar creator with landmark detection and multilingual TTS.
- **Loyalty Program**: 5-tier progressive discounts, e-gift cards, wash packages, Apple Wallet integration.
- **E-Signature**: DocuSeal with Hebrew RTL support.
- **Enterprise Features**: Multi-country/currency, franchise management, IoT monitoring, secure document management, KYC.
- **Financial Management**: Automated bookkeeping (Google Vision OCR + Gemini 2.5 Flash), Israeli Tax Compliance, bank reconciliation, invoicing, VAT reclaim.
- **Payment Gateway Architecture**: Nayax Israel is the MANDATORY and EXCLUSIVE payment gateway. Provider payouts via Israeli bank transfer after 72-hour escrow.
- **K9000 IoT Integration**: Cloud-based management, real-time status, remote control, AI predictive maintenance.
- **Passport Verification (KYC)**: Google Vision API-powered passport verification with MRZ parsing.
- **Security & Compliance**: Firebase App Check, performance monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025, AI monitoring, GDPR consent.
- **Blockchain-Style Audit Trail**: Immutable, cryptographically hash-chained ledger.
- **Chat History Management**: PostgreSQL-based storage, full-text search, analytics, 7-year retention, immutable audit trails.
- **Franchise-Based Authorization System**: Multi-tenant security, employee-franchise linkage, RBAC, per-record authorization.
- **Smart Gemini Weather Backend**: AI-powered pet-focused weather advice.
- **Role-Aware Weather Planner**: Full-stack weather intelligence, Open-Meteo data, multi-language support.
- **Compliance Control Tower**: AI-driven legal and regulatory management.
- **Load Testing & Performance Monitoring**: Grafana k6.
- **Gemini AI Email Quality Monitor**: Automated email validation.
- **Luxury Environmental Monitoring System**: Air Quality, Pollen, Weather, Gemini AI insights.
- **Comprehensive Multi-Language System**: Enterprise-grade language detection, centralized LanguageContext Service, Gemini AI integration.
- **Staff Onboarding & Fraud Prevention**: Workflow with document management, e-signature, biometric verification, background checks, GPS-verified logbook, expense management.

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL connectivity.
- **drizzle-orm**: Type-safe database ORM.
- **@tanstack/react-query**: Server state management.
- **@radix-ui/***: Accessible UI component primitives.
- **tailwindcss**: Utility-first CSS framework.
- **vite**: Build tool.
- **Nayax Israel**: MANDATORY EXCLUSIVE payment gateway.
- **Google Analytics, Google Tag Manager, Facebook Pixel, TikTok Pixel, Microsoft Clarity, Google Ads**: Marketing and analytics.
- **ipapi.co, ip-api.com, ipinfo.io**: IP geolocation services.
- **Firebase**: Authentication, Firestore, Storage, App Check, Performance Monitoring.
- **HubSpot**: CRM integration.
- **SendGrid**: Email services.
- **@google-cloud/storage**: Google Cloud Storage client.
- **qrcode**: QR code generation.
- **PassKit**: Apple Wallet integration.
- **googleapis**: Google Wallet integration.
- **Meta WhatsApp Business API**: WhatsApp messaging.
- **Google Firebase Cloud Messaging (FCM)**: Push notifications and SMS alternative.
- **Mizrahi-Tefahot Bank (via aggregator API)**: Bank reconciliation.
- **Open-Meteo API**: Weather forecast integration.
- **DocuSeal (@docuseal/api)**: Open-source e-signature platform.
- **Google Maps API**: Navigation, geocoding, places autocomplete.
- **Google Cloud Vision API**: Passport OCR for KYC, receipt scanning.
- **Google Gemini AI**: AI chat assistant, content moderation, triage.
- **Google Cloud Translation API**: Real-time multilingual support.
- **Google Business Profile API**: Franchise location and review management.
- **Google Weather API**: Official Google Weather integration.
- **CurrentUVIndex.com API**: UV index monitoring.
- **Open-Meteo Air Quality API**: Real-time air quality and pollen monitoring.