# Pet Wash™ - Premium Organic Pet Care Ecosystem

## Overview
Pet Wash™ is a full-stack enterprise platform ecosystem operating under **Pet Wash Ltd** (parent holding company). The platform features multiple independent business units: K9000 IoT wash stations (flagship), The Sitter Suite™ (pet sitting marketplace), Walk My Pet™ (dog walking marketplace), PetTrek™ (pet transport marketplace), and The Plush Lab™ (AI avatar creator). Each business operates independently while sharing enterprise infrastructure for authentication, payments, AI services, compliance, and franchise management. The platform is designed for market leadership and global franchise expansion with enterprise-grade security, multi-jurisdiction tax compliance, and complete legal protection.

## Corporate Structure
**Pet Wash Ltd** - Parent holding company with independent business units:
- 🛁 **K9000 Wash Stations** - Premium organic self-service IoT wash stations (flagship product)
- 🏠 **The Sitter Suite™** - Pet sitting marketplace (competing with Rover/Care.com model)
- 🐕 **Walk My Pet™** - Dog walking marketplace (competing with Wag!/Rover model)
- 🚗 **PetTrek™** - Pet transport marketplace (competing with Uber Pets model)
- 🎨 **The Plush Lab™** - AI-powered pet avatar creator with multilingual TTS

Each business unit is fully independent with separate branding, operations, and revenue tracking, but all share centralized enterprise systems (auth, payments, compliance, AI, franchise management).

## User Preferences
Preferred communication style: Simple, everyday language.

CRITICAL RULE: Never make layout or styling changes without explicit user approval - user gets extremely upset when changes are made to working designs.
VIOLATION WARNING: User explicitly said "don't ever touch the top part" referring to header layout. Any changes to header without permission will cause severe user frustration.
USER EXPLICITLY FORBID: Touching header layout, logo positioning, social media icons, hamburger menu, or language toggle without explicit permission.
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

### Frontend
- **Framework**: React 18 with TypeScript, Wouter for routing, TanStack Query for state management.
- **UI**: shadcn/ui components (Radix UI primitives), Tailwind CSS with a custom design system.
- **Build**: Vite.
- **PWA Features**: Comprehensive PWA functionality including Badge API, Background Sync, Wake Lock.

### Backend
- **Runtime**: Node.js with Express.js.
- **Database**: Neon serverless PostgreSQL with Drizzle ORM and Modular Schema Architecture.
- **Caching**: Redis with graceful fallback.
- **Architecture**: Clean separation of concerns (e.g., AuthService, PaymentsService, LoyaltyService).
- **Authentication**: Firebase Authentication with Firestore user profiles, WebAuthn/Passkey support.
- **Testing**: Vitest with unit and integration tests.

### Core Features & Design Decisions
- **UI/UX Design**: Brand-compliant, responsive mobile-first, luxury redesigns, glassmorphism, Apple-style spring animations, bilingual support with direction-aware layouts.
- **Authentication & User Management**: Firebase Auth, WebAuthn/Passkey, RBAC, biometrics, GDPR-compliant data deletion.
- **AI Chat Assistant**: Google Gemini 2.5 Flash-powered with Kenzo mascot personality, bilingual, context-aware, real-time avatar animations, emotion detection, session management, multi-avatar system.
- **Marketplaces**: "The Sitter Suite™", "Walk My Pet™", "PetTrek™".
- **The Plush Lab™**: Premium pet avatar creator with AI landmark detection and multilingual TTS.
- **Loyalty Program**: 5-tier progressive discount, e-gift cards, wash packages, Apple Wallet integration.
- **Digital Wallet Integration**: Apple Wallet & Google Wallet for loyalty cards and e-vouchers.
- **E-Signature**: DocuSeal with full Hebrew RTL support.
- **Enterprise Features**: Multi-country/currency, franchise management, per-station tracking, IoT monitoring, secure document management, KYC.
- **Financial Management**: Automated bookkeeping (Google Vision OCR + Gemini 2.5 Flash), Israeli Tax Compliance, Bank Reconciliation, Automated Monthly Invoicing, Israeli VAT Reclaim System.
- **K9000 IoT Wash Station Integration**: Cloud-based management, real-time status, remote control, AI predictive maintenance.
- **Passport Verification (KYC)**: Google Vision API-powered passport verification with MRZ parsing.
- **Security & Compliance**: Firebase App Check, Performance Monitoring, GA4, rate limiting, daily backups, admin logs, WebAuthn Level 2, Israeli Privacy Law 2025 compliance, AI-powered monitoring, enterprise-grade GDPR consent management.
- **Blockchain-Style Audit Trail**: Immutable, cryptographically hash-chained ledger for fraud prevention.
- **Chat History Management**: Enterprise-grade PostgreSQL-based chat storage with full-text search, analytics, 7-year retention, event-driven architecture, and immutable audit trails.
- **Franchise-Based Authorization System**: Enterprise-grade multi-tenant security with employee-franchise linkage, RBAC, and per-record authorization.
- **Smart Gemini Weather Backend**: Intelligent, actionable pet-focused weather advice powered by Gemini 2.5 Flash, generating smart insights and automated notifications.
- **Role-Aware Weather Planner**: Full-stack weather intelligence system with 4 specialized views (Public, Client, Employee Station, Employee Executive), real Open-Meteo forecast data, multi-language support, luxury glassmorphism UI, and role-based filtering.
- **Compliance Control Tower**: Enterprise-grade AI-driven legal compliance and regulatory management system.
- **Load Testing & Performance Monitoring**: Enterprise-grade performance testing infrastructure with Grafana k6, real-time performance monitoring dashboard.
- **Gemini AI Email Quality Monitor**: Automated email validation service ensuring display consistency across all email clients.
- **Luxury Environmental Monitoring System**: Comprehensive environmental intelligence platform combining Air Quality, Pollen, Weather, and Gemini AI insights.
- **Comprehensive Multi-Language System**: Enterprise-grade language detection and context management across the entire platform. Includes a centralized LanguageContext Service, multi-language staff manuals, and Gemini AI language integration.
- **Staff Onboarding & Fraud Prevention System**: Comprehensive onboarding workflow for staff with fraud prevention, document management, e-signature, biometric verification, background checks, GPS-verified logbook, and expense management.
- **Domain Verification & Deployment Optimization**: Configuration adjustments for Replit custom domain verification, including CORS, security headers, and rate limiting.

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL connectivity.
- **drizzle-orm**: Type-safe database ORM.
- **@tanstack/react-query**: Server state management.
- **@radix-ui/***: Accessible UI component primitives.
- **tailwindcss**: Utility-first CSS framework.
- **vite**: Build tool.
- **Nayax Israel**: Payment gateway integration.
- **Google Analytics, Google Tag Manager, Facebook Pixel, TikTok Pixel, Microsoft Clarity, Google Ads**: Marketing and analytics.
- **ipapi.co, ip-api.com, ipinfo.io**: IP geolocation services.
- **Firebase**: Authentication, Firestore, Storage, App Check, Performance Monitoring.
- **HubSpot**: CRM integration.
- **SendGrid**: Email services.
- **@google-cloud/storage**: Google Cloud Storage client.
- **qrcode**: QR code generation.
- **PassKit**: Apple Wallet integration.
- **googleapis**: Google Wallet integration.
- **Meta webhook**: WhatsApp Business integration.
- **Mizrahi-Tefahot Bank (via aggregator API)**: Bank reconciliation.
- **Open-Meteo API**: Weather forecast integration.
- **DocuSeal (@docuseal/api)**: Open-source e-signature platform.
- **Google Maps API**: Navigation, geocoding, places autocomplete.
- **Google Cloud Vision API**: Passport OCR for KYC, receipt scanning.
- **Google Gemini AI**: AI chat assistant, content moderation, triage.
- **Google Cloud Translation API**: Real-time multilingual support.
- **Google Business Profile API**: Franchise location and review management.
- **Google Weather API**: Official Google Weather integration.
- **CurrentUVIndex.com API**: UV index monitoring with current readings, 5-day hourly forecast, and 24-hour history (no API key required, unlimited requests).
- **Open-Meteo Air Quality API**: Real-time air quality monitoring (PM2.5, PM10, NO₂, O₃, SO₂, CO) and pollen forecasts (alder, birch, grass, olive, ragweed) - no API key required, 10,000+ requests/day.