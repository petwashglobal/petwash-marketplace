# Existing Systems Reference - Pet Wash™ Platform

## 🎯 **Quick Reference Guide**

This document provides a complete inventory of ALL existing production systems. **Check here FIRST before building anything new.**

---

## 📊 **Platform Statistics**

- **Backend Services:** 118 files (41,313 lines)
- **Frontend Pages:** 192 files
- **UI Components:** 155 files
- **API Routes:** 115 files
- **Custom Hooks:** 16 files
- **Shared Schemas:** 27 files
- **Middleware:** 20+ files

---

## 🏗️ **Core Architecture Files**

### **Single Source of Truth:**

| File | Lines | Purpose |
|------|-------|---------|
| `shared/petwashGlobal.ts` | 670 | Global architecture module - CHECK THIS FIRST |
| `shared/schema.ts` | 500+ | Main database schema |
| `shared/super-app-schema.ts` | 300+ | Super-app unified schema |
| `shared/super-app-schema-v2.ts` | 250+ | Enhanced super-app schema |

### **Domain-Specific Schemas:**

- `schema-enterprise.ts` - Enterprise operations
- `schema-loyalty.ts` - Loyalty program
- `schema-compliance.ts` - Legal compliance
- `schema-franchise.ts` - Franchise management
- `schema-logistics.ts` - Logistics & dispatch
- `schema-chat.ts` - Chat system
- `schema-operations.ts` - Operations management
- `schema-weather-planner.ts` - Weather planning
- `schema-corporate.ts` - Corporate structure
- `schema-hr.ts` - Human resources
- `schema-finance.ts` - Financial management
- `schema-payroll.ts` - Payroll system
- Plus 15 more...

---

## 🔧 **Backend Services (118 Files)**

### **💳 Payment & Financial (18 Services)**

| Service | Purpose | Key Features |
|---------|---------|--------------|
| `NayaxSparkService.ts` | Nayax Spark API integration | Payment intents, refunds, webhooks |
| `NayaxMonitoringService.ts` | Real-time monitoring | Fraud detection, alerts |
| `NayaxSitterMarketplaceService.ts` | Sitter payments | Escrow, payouts |
| `NayaxWalkMarketplaceService.ts` | Walker payments | Job dispatch payments |
| `NayaxJobDispatchPaymentService.ts` | Job dispatch | General marketplace payments |
| `EscrowService.ts` | Payment escrow | 72hr hold, release, disputes |
| `PaymentGatewayService.ts` | Payment orchestration | Multi-currency, gateway routing |
| `ProviderPayoutService.ts` | Provider payouts | Automated disbursement |
| `IsraeliTaxAPIService.ts` | Israeli Tax Authority API | Real-time tax submission |
| `IsraeliVATReclaimService.ts` | VAT reclaim | Automated VAT recovery |
| `ElectronicInvoicingService.ts` | Electronic invoices | Israeli e-invoice compliance |
| `LuxuryInvoiceService.ts` | Premium invoicing | Branded invoice generation |
| `ReceiptOCRService.ts` | Receipt scanning | Google Vision OCR |
| `ReceiptFraudDetection.ts` | Fraud detection | AI-powered validation |
| `AustralianTaxComplianceService.ts` | Australian tax | GST compliance |
| `CanadianTaxComplianceService.ts` | Canadian tax | HST/GST compliance |
| `TaxComplianceService.ts` | General tax | Multi-jurisdiction |
| `CurrencyService.ts` | Multi-currency | Exchange rates, conversion |

**Usage:**
```typescript
import NayaxSparkService from '@/services/NayaxSparkService';
import EscrowService from '@/services/EscrowService';
import VATCalculatorService from '@/services/VATCalculatorService';
```

---

### **📅 Booking & Marketplace (10 Services)**

| Service | Lines | Purpose |
|---------|-------|---------|
| `SitterAdvancedBookingEngine.ts` | 800+ | Airbnb-level sitter bookings |
| `booking-service.ts` | 742 | General marketplace bookings |
| `BookingPolicyEngine.ts` | 400+ | Cancellation policies, refunds |
| `BookingLockService.ts` | ❌ DELETED | Redundant - use above |
| `EmergencyWalkService.ts` | 300+ | Emergency dog walking |
| `PetTrekDispatchService.ts` | 500+ | Pet transport dispatch |
| `PetTrekFareEstimationService.ts` | 300+ | Fare calculation |
| `JobDispatchService.ts` | 600+ | General job dispatch |
| `PricingService.ts` | 400+ | Dynamic pricing engine |
| `SitterProximitySearch.ts` | 250+ | Geospatial search |

**Usage:**
```typescript
import BookingService from '@/services/booking-service';
import SitterAdvancedBookingEngine from '@/services/SitterAdvancedBookingEngine';
```

---

### **🔐 Security & Authentication (12 Services)**

| Service | Lines | Purpose |
|---------|-------|---------|
| `AuthService.ts` | 900+ | Firebase auth orchestration |
| `BiometricSecurityMonitor.ts` | 700+ | Banking-level biometric monitoring |
| `BiometricVerificationService.ts` | 500+ | Passport/ID verification |
| `PassportOCRService.ts` | 400+ | Google Vision passport scanning |
| `CertificateVerificationService.ts` | 300+ | SSL/TLS certificate monitoring |
| `SocialAuthVerificationService.ts` | 250+ | OAuth provider verification |
| `OAuthCertificateMonitor.ts` | 200+ | OAuth cert rotation |
| `DeviceSecurityAlertsService.ts` | 300+ | Device security alerts |
| `devices.ts` | 400+ | Device registry & trust |
| `SitterSecurityManager.ts` | 350+ | Marketplace security |
| `securityEvents.ts` | 250+ | Security event logging |
| `EncryptionService.ts` | 200+ | Data encryption |

**Additional Files:**
- `server/webauthn/service.ts` (700+ lines) - WebAuthn/Passkey implementation
- `server/webauthn/deviceRegistry.ts` - Device management
- `server/webauthn/csrfProtection.ts` - CSRF protection
- `client/src/auth/passkey.ts` - Client-side passkey handling

---

### **🤖 AI & Intelligence (15 Services)**

| Service | Purpose |
|---------|---------|
| `GeminiEmailMonitor.ts` | Email quality validation (iOS Mail, Gmail, Outlook) |
| `GeminiWatchdogService.ts` | Automated system monitoring |
| `GeminiUpdateAdvisor.ts` | Update recommendations |
| `geminiTranslation.ts` | Real-time translation (6+ languages) |
| `SitterAITriageService.ts` | Intelligent booking routing |
| `EmployeeAIFeedbackService.ts` | Performance feedback |
| `ContentModerationService.ts` | Content moderation |
| `ReviewModerationService.ts` | Review moderation |
| `AIMonitoringService.ts` | AI system monitoring |
| `smartWeatherAdvisor.ts` | Pet-focused weather insights |
| `PersonalizedGreetingService.ts` | Personalized user greetings |
| `LanguageContextService.ts` | Language detection & context |
| `ChatService.ts` | AI chat assistant (Kenzo) |
| `GoogleMessagingService.ts` | Google Business messaging |
| `SmartEnvironmentService.ts` | Environmental intelligence |

---

### **🌍 Environmental & Location (8 Services)**

| Service | Purpose |
|---------|---------|
| `SmartEnvironmentService.ts` | Air quality + pollen + weather unified |
| `CurrentUVIndexService.ts` | UV index monitoring (CurrentUVIndex.com API) |
| `OpenMeteoAirQualityService.ts` | Air quality (PM2.5, PM10, NO₂, O₃, etc.) |
| `MultiSourceWeatherService.ts` | Multi-source weather aggregation |
| `smartWeatherAdvisor.ts` | Gemini AI weather insights |
| `GeolocationService.ts` | IP geolocation (ipapi, ip-api, ipinfo) |
| `GPSTrackingService.ts` | Real-time GPS tracking |
| `SitterProximitySearch.ts` | Geospatial proximity search |

---

### **📊 Compliance & Legal (8 Services)**

| Service | Purpose |
|---------|---------|
| `ComplianceControlTower.ts` | AI-driven compliance management |
| `CountryLegalComplianceService.ts` | Multi-country compliance |
| `ITAComplianceMonitoringService.ts` | Israeli Tax Authority monitoring |
| `AuditLedgerService.ts` | Immutable blockchain-style audit trail |
| `ConsentService.ts` | GDPR/Israeli Privacy Law consent |
| `legal-templates.ts` | Legal document templates |
| `ContractGenerationService.ts` | Contract generation |
| `DocuSealService.ts` | E-signature integration |

---

### **🎁 Loyalty & Rewards (3 Services)**

| Service | Purpose |
|---------|---------|
| `loyalty.ts` | 5-tier progressive loyalty system |
| `LoyaltyActivityMonitor.ts` | Activity tracking |
| `badgeIssuance.ts` | Apple Wallet badge issuance |

---

### **🏭 K9000 IoT (2 Services)**

| Service | Purpose |
|---------|---------|
| `K9000PredictiveMaintenanceService.ts` | AI predictive maintenance |
| `K9000TransactionService.ts` | Wash station transactions |

---

### **📧 Communication (8 Services)**

| Service | Purpose |
|---------|---------|
| `ChatService.ts` | Real-time chat system |
| `NotificationService.ts` | Push notifications |
| `FCMService.ts` | Firebase Cloud Messaging |
| `GoogleMessagingService.ts` | Google Business messaging |
| `LuxuryDocumentEmailService.ts` | Branded email delivery |
| `NotificationConsentManager.ts` | Notification consent management |
| `PersonalizedGreetingService.ts` | Personalized greetings |
| `LanguageContextService.ts` | Multi-language context |

---

### **🗃️ Data & Infrastructure (10 Services)**

| Service | Purpose |
|---------|---------|
| `redis.ts` | Redis caching with fallback |
| `gcsBackupService.ts` | Google Cloud Storage backups |
| `EncryptionService.ts` | Data encryption |
| `CDPService.ts` | Customer data platform |
| `EventBus.ts` | Event-driven architecture |
| `APIGateway.ts` | API gateway & routing |
| `analytics.ts` | Analytics tracking |
| `alerts.ts` | System alerts |
| `rbac.ts` | Role-based access control |
| `SystemStatusReportService.ts` | System health reporting |

---

### **🌐 Google Integrations (5 Services)**

| Service | Purpose |
|---------|---------|
| `googleBusinessProfile.ts` | Google Business Profile API |
| `googleMapsPlaces.ts` | Google Maps Places API |
| `GoogleCalendarIntegrationService.ts` | Calendar integration |
| `googleSheetsIntegration.ts` | Sheets API integration |
| `mapkit.ts` | Apple MapKit integration |

---

### **👥 HR & Staff (3 Services)**

| Service | Purpose |
|---------|---------|
| `StaffOnboardingService.ts` | Comprehensive onboarding workflow |
| `expensePolicyService.ts` | Expense management |
| `ManagementAnalyticsService.ts` | Management insights |

---

### **🎯 Other Services (8 Services)**

| Service | Purpose |
|---------|---------|
| `insuranceMonitoring.ts` | Insurance compliance monitoring |
| `globalPromotions.ts` | Global promotions engine |
| `SitterGlobalConfig.ts` | Sitter marketplace configuration |
| `payoutLedger.ts` | Payout accounting |
| `securityEvents.ts` | Security event tracking |
| `devices.ts` | Device management |
| `VATCalculatorService.ts` | VAT calculation (17% Israeli) |
| `CanvasService.ts` | Image manipulation |

---

## 🎨 **Frontend Pages (192 Files)**

### **Platform-Specific Booking Flows:**

```
client/src/pages/sitter-suite/
├── BookingFlow.tsx ✅ Production-ready
├── BrowseSitters.tsx
├── SitterDetail.tsx
├── SitterDashboard.tsx
├── OwnerDashboard.tsx
└── Overview.tsx

client/src/pages/walk-my-pet/
├── BookingFlow.tsx ✅ Production-ready
├── BrowseWalkers.tsx
├── WalkerDashboard.tsx
├── OwnerDashboard.tsx
└── Overview.tsx

client/src/pages/pettrek/
├── BookingFlow.tsx ✅ Production-ready
├── BrowseDrivers.tsx
├── BookTrip.tsx
├── TrackTrip.tsx
├── DriverDashboard.tsx
├── CustomerDashboard.tsx
├── ProviderDashboard.tsx
└── Overview.tsx

client/src/pages/academy/
├── BookingFlow.tsx ✅ Production-ready
└── TrainerProfile.tsx
```

### **Dashboards (12 Pages):**

- `CEODashboard.tsx` - Executive overview
- `AdminDashboard.tsx` - Admin operations
- `FinanceDashboard.tsx` - Financial metrics
- `FranchiseeDashboard.tsx` - Franchise management
- `CrmDashboard.tsx` - Customer relationship
- `OpsDashboard.tsx` - Operations
- `StatusDashboard.tsx` - System status
- `GeminiWatchdogDashboard.tsx` - AI monitoring
- `SitterDashboard.tsx` - Sitter operations
- `WalkerDashboard.tsx` - Walker operations
- `ContractorDashboard.tsx` - Contractor view

### **Enterprise & Admin (25+ Pages):**

- `EnterpriseHQ.tsx` - Enterprise headquarters
- `ComplianceControlTower.tsx` - Compliance management
- `AdminSecurityMonitoring.tsx` - Security monitoring
- `AdminKYC.tsx` - KYC management
- `AdminUsers.tsx` - User management
- `AdminFinancial.tsx` - Financial administration
- `AdminStations.tsx` - Station management
- `AdminVouchers.tsx` - Voucher management
- `AdminSystemLogs.tsx` - System logs
- `AuditTrail.tsx` - Audit trail
- Plus 15 more...

### **Legal & Compliance (8 Pages):**

```
client/src/pages/legal/
├── PrivacyPolicy.tsx
├── TermsConditions.tsx
├── Disclaimer.tsx
└── PlatformLegalFramework.tsx
```

---

## 🎨 **UI Components (155 Files)**

### **Critical Production Components:**

| Component | Purpose | Features |
|-----------|---------|----------|
| `mobile-date-picker.tsx` | ✅ World-class date picker | iOS/Android native feel, RTL, luxury animations |
| `google-places-autocomplete.tsx` | Google Maps autocomplete | Real-time place search, geolocation |
| `BiometricConsentDialog.tsx` | Face ID consent | Banking-level consent flow |
| `WalletConsentDialog.tsx` | Apple Wallet consent | Wallet card consent |
| `FaceIDLoadingState.tsx` | Auto Face ID loading | Automatic Face ID attempt |
| `ConsentManager.tsx` | GDPR compliance | Comprehensive consent management |
| `GoogleOneTap.tsx` | Google One Tap | Seamless Google sign-in |
| `MobileInput.tsx` | Mobile-optimized input | iOS/Android keyboard handling |
| `ResponsiveDialogShell.tsx` | Responsive dialog | Mobile-first dialog system |

### **Shadcn UI Components (48 Files):**

Standard shadcn/ui library with full customization:
- Alert, Badge, Button, Card, Checkbox, Dialog, Dropdown, Form, Input, Label, Select, Sheet, Switch, Table, Tabs, Textarea, Toast, Tooltip, and 30 more...

---

## 🛣️ **API Routes (115 Files)**

### **Marketplace Routes:**

- `bookings.ts` - General marketplace bookings
- `academy.ts` - Academy-specific routes
- `franchise.ts` - K9000 franchise routes
- `franchise-mgmt.ts` - Franchise management
- `contractor.ts` - Contractor routes
- `contracts.ts` - Contract management

### **Enterprise Routes (10 Files):**

- `enterprise.ts` - Main enterprise
- `enterprise-finance.ts` - Financial operations
- `enterprise-hr.ts` - Human resources
- `enterprise-operations.ts` - Operations
- `enterprise-sales.ts` - Sales
- `enterprise-sales-crm.ts` - CRM
- `enterprise-corporate.ts` - Corporate
- `enterprise-policy.ts` - Policies
- `enterprise-franchise.ts` - Franchise
- `enterprise-logistics.ts` - Logistics

### **Authentication Routes:**

- `webauthn.ts` - WebAuthn/Passkey
- `mobile-auth.ts` - Mobile auth
- `mobile-biometric.ts` - Mobile biometrics
- `biometric-certificates.ts` - Certificate management
- `identity-service.ts` - Identity verification

### **Payment & Financial Routes:**

- `escrow.ts` - Escrow management
- `expenses.ts` - Expense tracking
- `accounting.ts` - Accounting
- `bank.ts` - Bank integration
- `ceo-wallet.ts` - Executive wallet

### **Integration Routes:**

- `google-services.ts` - Google APIs
- `google-wallet.ts` - Google Wallet
- `gmail.ts` - Gmail integration
- `gmail-test.ts` - Gmail testing
- `esign.ts` - E-signature
- `gps-tracking.ts` - GPS tracking

---

## 🪝 **Custom Hooks (16 Files)**

| Hook | Purpose |
|------|---------|
| `useAutoFaceID.ts` | ✅ Banking-level auto Face ID |
| `useAuth.ts` | Authentication state |
| `useAdminAuth.ts` | Admin authentication |
| `useMultiFactorAuth.ts` | MFA management |
| `useFCMNotifications.ts` | Push notifications |
| `useAnalytics.ts` | Analytics tracking |
| `usePersonalizedGreeting.ts` | Personalized greetings |
| `useWalletTelemetry.ts` | Wallet analytics |
| `useModernWebFeatures.ts` | PWA features |
| `useTranslate.ts` | Multi-language support |
| `useFranchiseId.ts` | Franchise context |
| `useScrollToTop.ts` | Scroll management |
| `useKeyboardNavigation.ts` | Keyboard navigation |
| `use-mobile.tsx` | Mobile detection |
| `use-toast.ts` | Toast notifications |
| `useSimpleAuth.tsx` | Simple auth flow |

---

## 🔧 **Middleware (20+ Files)**

| Middleware | Purpose |
|------------|---------|
| `firebase-auth.ts` | Firebase authentication |
| `rbac.ts` | Role-based access control |
| `franchiseAuth.ts` | Franchise authorization |
| `enforcePasskey.ts` | Passkey enforcement |
| `appCheckMiddleware.ts` | Firebase App Check |
| `fraudDetection.ts` | Fraud detection |
| `rateLimiter.ts` | Rate limiting |
| `rateLimit.ts` | Alternative rate limiter |
| `loginRateLimiter.ts` | Login rate limiting |
| `securityHeaders.ts` | Security headers |
| `k9000Security.ts` | K9000-specific security |
| `csrfProtection.ts` | CSRF protection |
| `circuit.ts` | Circuit breaker |
| `performance-2025.ts` | Performance monitoring |
| `requestIdAndLogs.ts` | Request logging |
| `ipAllowlist.ts` | IP whitelisting |
| `loyalty.ts` | Loyalty middleware |
| `roleAuth.ts` | Role authentication |

---

## 📚 **Client Libraries (37 Files)**

Located in `client/src/lib/`:

**Core:**
- `firebase.ts` - Firebase initialization
- `queryClient.ts` - TanStack Query config
- `utils.ts` - Utility functions
- `i18n.ts` - Internationalization

**Authentication:**
- `webauthn.ts` - WebAuthn utilities
- `auth.ts` - Auth helpers
- `authUtils.ts` - Auth utilities
- `auth-guardian-2025.ts` - Auth security
- `authErrorHandler.ts` - Error handling
- `authErrorTracker.ts` - Error tracking
- `iosAuthHandler.ts` - iOS-specific auth

**Analytics & Monitoring:**
- `analytics.ts` - Analytics tracking
- `sentry.ts` - Sentry error tracking
- `rum.ts` - Real user monitoring
- `performanceMonitor.ts` - Performance monitoring
- `marketing-pixels.ts` - Marketing pixels
- `deviceTelemetry.ts` - Device telemetry
- `interactionTracker.ts` - User interactions

**Device & Security:**
- `deviceDetection.ts` - Device detection
- `deviceTrust.ts` - Device trust scoring
- `geolocation.ts` - Geolocation
- `modernWebCapabilities.ts` - PWA features

**Business Logic:**
- `loyalty.ts` - Loyalty program
- `loyalty-engine.ts` - Loyalty calculations
- `tierUpgrade.ts` - Tier upgrades
- `currency.ts` - Currency formatting
- `hubspot.ts` - HubSpot integration

**UI & UX:**
- `designTokens.ts` - Design system
- `navigationStructure.ts` - Navigation structure
- `seo.ts` - SEO utilities
- `viewportFix.ts` - Viewport fixes
- `accessibilityChecker.ts` - A11y checks
- `lazyLoader.ts` - Lazy loading

**Infrastructure:**
- `logger.ts` - Logging
- `errorHandler.ts` - Error handling
- `offlineQueue.ts` - Offline support
- `fcm-notifications.ts` - FCM client

---

## 📝 **Documentation Files (50+ Guides)**

Located in `docs/`:

**Production Guides:**
- `DEVELOPER_INTEGRATION_GUIDE.md` - ✅ NEW - How to use existing systems
- `BOOKING_SYSTEM_ARCHITECTURE.md` - ✅ NEW - Booking deep dive
- `PAYMENT_ARCHITECTURE.md` - Payment flows
- `AUTHENTICATION_GUIDE_FRIDAY_LAUNCH.md` - Auth system
- `UNIFIED_PLATFORM_ARCHITECTURE.md` - Platform architecture

**Setup & Deployment:**
- `DEPLOYMENT_GUIDE.md`
- `FIREBASE_DEPLOYMENT_GUIDE.md`
- `SIMPLE_DEPLOYMENT_GUIDE.md`
- `NAYAX_PRODUCTION_SETUP_GUIDE.md`
- `GOOGLE_CLOUD_APIS_STATUS.md`

**System Status:**
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_STATUS.md`
- `COMPREHENSIVE_SYSTEM_AUDIT_2025.md`
- `FINAL_SYSTEM_STATUS_2025.md`

**Domain-Specific:**
- `ISRAELI_VAT_SYSTEM.md`
- `OBSERVANCES_SYSTEM.md`
- `WALLET_SYSTEM_DOCS.md`
- `CONSENT_SYSTEM_2025.md`

Plus 35 more guides...

---

## 🎯 **Quick Search Commands**

Before building ANYTHING:

```bash
# Check global architecture
cat shared/petwashGlobal.ts

# Search for similar service
grep -r "ServiceName" server/services/

# Find similar component
find client/src/components -name "*ComponentName*"

# Check existing routes
ls server/routes/*.ts | grep -i "feature"

# List all schemas
ls shared/schema*.ts

# Search for functionality
grep -r "functionName" server/ client/
```

---

## ✅ **Integration Checklist**

Before adding new code:

- [ ] Checked `shared/petwashGlobal.ts` (670 lines - SINGLE SOURCE OF TRUTH)
- [ ] Checked `shared/schema*.ts` (27 schema files)
- [ ] Searched `server/services/` (118 services, 41,313 lines)
- [ ] Searched `client/src/pages/` (192 pages)
- [ ] Searched `client/src/components/` (155 components)
- [ ] Searched `server/routes/` (115 routes)
- [ ] Searched `client/src/hooks/` (16 hooks)
- [ ] Searched `client/src/lib/` (37 utilities)
- [ ] Documented findings
- [ ] Confirmed gap truly exists
- [ ] Planned integration with existing systems
- [ ] Got approval before building

---

## 🚨 **Critical Rules**

1. **NEVER** create new booking services - use `BookingService` or `SitterAdvancedBookingEngine`
2. **NEVER** create new payment services - use `NayaxSparkService` and related services
3. **NEVER** create new auth systems - use existing WebAuthn/Firebase system
4. **NEVER** create new date pickers - use `MobileDatePicker`
5. **NEVER** create new schemas - extend existing ones
6. **ALWAYS** check `shared/petwashGlobal.ts` first
7. **ALWAYS** search existing code before building
8. **ALWAYS** document integration plan
9. **ALWAYS** extend, never replace

---

**This platform represents MONTHS of enterprise development. Respect it. Use it. Don't rebuild it.**
