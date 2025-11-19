# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is a full-stack enterprise platform designed for market leadership and global franchise expansion in the pet care industry. It integrates various business units (K9000 IoT wash stations, The Sitter Suite™, Walk My Pet™, PetTrek™, The Plush Lab™) through shared enterprise infrastructure for authentication, payments, AI services, compliance, and franchise management. The platform emphasizes enterprise-grade security, multi-jurisdiction compliance, and aims for global expansion, with an initial focus on the Israeli luxury market. Key capabilities include a 7-Star Loyalty System, robust security hardening, and a comprehensive Unified Control Panel for enterprise orchestration.

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
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, Vite.
- **Backend**: Node.js, Express.js, Neon serverless PostgreSQL with Drizzle ORM, Redis caching, Firebase Authentication (WebAuthn/Passkey).
- **UI/UX Design**: Responsive, mobile-first, luxury designs with glassmorphism, Apple-style animations, and bilingual direction-aware layouts.
- **Authentication & User Management**: Firebase Auth, WebAuthn/Passkey, RBAC, biometrics, GDPR-compliant data handling.
- **AI Chat Assistant**: Production-ready Google Dialogflow CX powered by Gemini 2.5 Flash with Kenzo mascot, bilingual Hebrew/English, WCAG 2.1 AA compliant.
- **Marketplaces**: The Sitter Suite™, Walk My Pet™, PetTrek™.
- **The Plush Lab™**: AI-powered pet avatar creator.
- **Loyalty Program**: 7-tier luxury progressive system (Bronze→Silver→Gold→Platinum→Diamond→Emerald→Royal), e-gift cards, wash packages, Apple Wallet.
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
- **Enterprise Route Infrastructure**: Extensive set of 119 route files covering franchise management, finance, HR, operations, sales CRM, accounting, expenses, documents, compliance, audit, contracts, and signatures, organized into Head Office, Franchise, Customer, and Shared units.
- **Authentication & Authorization**: RBAC middleware with hardcoded super admins and database-driven role assignments, enforcing access levels and department permissions.

### ✅ Unified Control Panel - Enterprise Orchestration Layer (100% COMPLETE)
**Completion Date**: November 19, 2025
**Implementation**: 8 parallel subagent deployments (3 hours total)
**Blueprint Alignment**: 100% (688-line blueprint fully implemented)

**Phase 1 - RBAC Foundation:**
- ✅ 16 Departments, 11 Roles, 10 Platforms with scoped permissions (global, country, city, station, partner)
- ✅ Control Panel Registry Service with auto-initialization
- ✅ 6 API endpoints for department/role/platform management

**Phase 2 - Core Infrastructure:**
- ✅ **Logistics & Fleet**: 14 API endpoints, auto-generated task numbers (TASK-2025-###), vehicle tracking, driver assignment, mobile-optimized API
- ✅ **Finance & Settlements**: 7 API endpoints, partner revenue sharing, automated monthly settlements (cron: 1st of month at 00:05), Israeli VAT (18%), SHA-256 audit hashing, CSV export
- ✅ **Israeli CPI Service**: Automatic Consumer Price Index tracking per Israeli law, 8 API endpoints for rent/mortgage/wage indexation calculations (הצמדה למדד), Bank of Israel data source, auto-seeding historical data (2024-2025), monthly index updates (15th of month), production-ready with 22 months of historical data
- ✅ **Event-Driven Architecture**: 23 domain event types, event store with versioning, EventPublisher service, 4 critical event handlers, K9000 & Nayax integration

**Phase 3 - Mobile & Advanced Features:**
- ✅ **Mobile Field Operations**: 8 API endpoints, field updates with photo uploads (Firebase Storage, max 10 photos/5MB each), Waze deep linking, GPS-based station search (50km radius), FCM push notifications
- ✅ **Health & Safety**: 9 API endpoints, incident reporting with auto-generated INC-YYYY-### numbers, 4 severity levels, photo documentation, H&S team email notifications, resolution workflows
- ✅ **Inventory Management**: 11 API endpoints, station supply tracking, automated low-stock detection with email alerts, purchase order generation by supplier, refill audit trail
- ✅ **Unified Notifications**: 12 API endpoints, multi-channel orchestration (email, SMS, WhatsApp, push, in-app), template management with variable substitution, EventBus integration for 10+ business events, 7 default production templates, delivery tracking and analytics

**Database Impact (14 New Tables)**:
- `departments`, `roles`, `controlPanelPlatforms`, `userRoles`
- `logisticsTasks`, `logisticsVehicles`
- `partners`, `partnerAgreements`, `settlements`
- `domain_events`, `field_updates`, `field_update_photos`, `staff_devices`
- `healthSafetyIncidents`, `incidentPhotos`
- `supplies`, `stationSupplies`, `inventoryRefills`
- `notificationTemplates`, `notificationLogs`
- `cpi_index_history` (Israeli Consumer Price Index tracking)

**API Summary**: 72 new REST endpoints across 9 modules

**Technology Stack**: Node.js 20+, PostgreSQL (Neon), Drizzle ORM, Redis pub/sub, Firebase Storage, FCM, SendGrid, WhatsApp Business API, node-cron

**Legal Compliance**: Israeli VAT (18%), SHA-256 audit hashing, tamper-proof settlement records, H&S incident documentation, complete notification audit trail, automatic CPI indexation per Israeli law (הצמדה למדד)

**Production Status**: ✅ Server running with zero errors, all routes registered, monthly settlements cron scheduled, EventBus with 45 event types active

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