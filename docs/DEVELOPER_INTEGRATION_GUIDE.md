# Developer Integration Guide - Pet Wash™ Platform

## 🚨 **CRITICAL RULE: SEARCH FIRST, BUILD SECOND**

**Before adding ANY new code:**

1. ✅ Check `shared/petwashGlobal.ts` (670 lines) - Single source of truth for platform architecture
2. ✅ Check `shared/schema*.ts` - All database schemas and types
3. ✅ Check `server/services/` - 118 production services (41,313 lines)
4. ✅ Check existing pages and components for similar functionality
5. ✅ Only if truly missing, propose integration with existing architecture

**This platform represents MONTHS of enterprise-grade development. Respect it.**

---

## 📚 **Table of Contents**

1. [Platform Overview](#platform-overview)
2. [Global Architecture Module](#global-architecture-module)
3. [Booking System](#booking-system)
4. [Payment Integration (Nayax Only)](#payment-integration)
5. [Authentication & Security](#authentication-security)
6. [AI Services](#ai-services)
7. [Navigation & UX](#navigation-ux)
8. [Adding New Features](#adding-new-features)

---

## 🏗️ **Platform Overview**

### Corporate Structure

**Pet Wash Ltd** - Parent holding company with 6 independent business units:

1. 🛁 **K9000 Wash Stations** - Premium IoT self-service wash stations (flagship)
2. 🏠 **The Sitter Suite™** - Pet sitting marketplace
3. 🐕 **Walk My Pet™** - Dog walking marketplace
4. 🚗 **PetTrek™** - Pet transport marketplace
5. ✂️ **Grooming Marketplace** - Professional grooming services
6. 🏢 **Shared Services Hub** - Enterprise management

### Tech Stack

- **Frontend**: React 18 + TypeScript + Wouter + TanStack Query
- **Backend**: Node.js + Express + Firebase Admin
- **Database**: Neon serverless PostgreSQL + Drizzle ORM + Firestore
- **Auth**: Firebase Authentication + WebAuthn/Passkeys
- **Payments**: Nayax Israel (EXCLUSIVE - NO STRIPE)
- **AI**: Google Gemini 2.5 Flash
- **Cache**: Redis with graceful fallback

---

## 🌐 **Global Architecture Module**

### **File: `shared/petwashGlobal.ts` (670 lines)**

This is the **SINGLE SOURCE OF TRUTH** for the entire platform. Always check here first.

#### What It Contains:

1. **Type System**
   - `PlatformId` - All 6 business units
   - `UserRole` - Complete role hierarchy (8 roles)
   - `BookingState` - Booking lifecycle states
   - `CurrencyCode` - Multi-currency support
   - `KycLevel` - 3-tier KYC (LIGHT/STANDARD/ENHANCED)
   - `DeviceType` - IoT device classification
   - `LocaleCode` - 6+ language support

2. **Platform Catalog**
   ```typescript
   export const PLATFORMS: PlatformConfig[] = [
     { id: 'k9000', name: 'K9000 Wash Stations', path: '/k9000', ... },
     { id: 'walk-my-pet', name: 'Walk My Pet™', path: '/walk-my-pet', ... },
     { id: 'sitter-suite', name: 'The Sitter Suite™', path: '/sitter-suite', ... },
     // etc.
   ]
   ```

3. **Deep Navigation Model**
   - Multi-layer hamburger menu structure
   - Role-based access control (RBAC)
   - Platform-specific menu items
   - Public vs authenticated routes

4. **KYC Engine**
   ```typescript
   export function getKycLevelForRole(role: UserRole): KycLevel
   export function getRequiredKycFields(level: KycLevel): string[]
   ```

5. **Payment Configuration**
   - Nayax gateway settings
   - Multi-currency support (ILS, USD, EUR, GBP, CAD, AUD)
   - Tax rules (17% Israeli VAT)
   - Escrow timing (72hr hold)

6. **Booking Contracts**
   ```typescript
   export interface BookingCreationPayload
   export interface BookingPaymentIntent
   export type BookingStateTransition
   ```

7. **Helper Utilities**
   ```typescript
   export function getPlatformById(id: PlatformId): PlatformConfig | undefined
   export function getPlatformByPath(path: string): PlatformConfig | undefined
   export function getNavigationForRole(role: UserRole): NavigationItem[]
   export function formatAmount(cents: number, currency: CurrencyCode): string
   export function toCents(amount: number): number
   ```

### **Usage Example:**

```typescript
import { PLATFORMS, getPlatformById, getKycLevelForRole } from '@shared/petwashGlobal';

// Get platform config
const sitterPlatform = getPlatformById('sitter-suite');
console.log(sitterPlatform?.name); // "The Sitter Suite™"

// Check KYC requirements
const kycLevel = getKycLevelForRole('provider');
console.log(kycLevel); // "STANDARD"
```

---

## 📅 **Booking System**

### **Architecture Overview**

The booking system is **ALREADY BUILT** with two production-ready engines:

1. **General Booking Service** - `server/services/booking-service.ts` (742+ lines)
2. **Advanced Sitter Engine** - `server/services/SitterAdvancedBookingEngine.ts` (Airbnb-level)

### **DO NOT CREATE NEW BOOKING SERVICES**

### **Key Services:**

#### 1. **BookingService** (`server/services/booking-service.ts`)

**Features:**
- Multi-platform support (K9000, Walk My Pet, Sitter Suite, PetTrek, Academy)
- Real-time conflict detection
- Automatic VAT calculation (17% Israeli)
- Escrow payment integration
- Provider payout automation (72hr release)
- Chat conversation creation
- Push notifications
- Calendar availability management

**Usage:**

```typescript
import BookingService from '@/services/booking-service';

// Create booking
const booking = await BookingService.createBooking({
  platform: 'sitter-suite',
  providerId: 'provider-123',
  customerId: 'customer-456',
  serviceDate: '2025-11-20',
  petIds: ['pet-789'],
  baseAmount: 250.00,
});

// Check provider availability
const isAvailable = await BookingService.checkProviderAvailability(
  'provider-123',
  new Date('2025-11-20'),
  new Date('2025-11-22')
);
```

#### 2. **SitterAdvancedBookingEngine** (`server/services/SitterAdvancedBookingEngine.ts`)

**Features:**
- Dynamic pricing (surge pricing for holidays)
- Multi-day booking support
- Cancellation policy enforcement
- Refund calculation
- Automated reviews scheduling
- Advanced conflict detection
- Holiday detection and pricing
- Weather-based recommendations

**Usage:**

```typescript
import SitterAdvancedBookingEngine from '@/services/SitterAdvancedBookingEngine';

// Create advanced booking with dynamic pricing
const result = await SitterAdvancedBookingEngine.createBooking({
  sitterId: 'sitter-123',
  customerId: 'customer-456',
  startDate: '2025-12-25', // Holiday - surge pricing
  endDate: '2025-12-27',
  petIds: ['pet-789'],
  services: ['overnight', 'feeding', 'medication'],
});

console.log(result.pricing.surgePricing); // Holiday surge applied
```

### **Frontend Booking Flows**

Each platform has its own **BookingFlow** component:

1. `client/src/pages/sitter-suite/BookingFlow.tsx`
2. `client/src/pages/walk-my-pet/BookingFlow.tsx`
3. `client/src/pages/pettrek/BookingFlow.tsx`
4. `client/src/pages/academy/BookingFlow.tsx`

**DO NOT create new booking components. Extend these.**

### **Date Selection UI**

**Use Existing Component:**

```typescript
import MobileDatePicker from '@/components/ui/mobile-date-picker';

// iOS/Android native-style date picker with luxury animations
<MobileDatePicker
  value={selectedDate}
  onChange={setSelectedDate}
  minDate={new Date()}
  disabledDates={bookedDates}
  locale="he" // Hebrew support
/>
```

**Features:**
- Apple-style spring animations
- iOS/Android native feel
- RTL support (Hebrew, Arabic)
- Disabled date handling
- Range selection
- Luxury glassmorphism design

---

## 💳 **Payment Integration (Nayax Only)**

### **🚨 CRITICAL: NAYAX ISRAEL EXCLUSIVE**

**NO STRIPE. NO OTHER PAYMENT PROCESSORS.**

All customer payments MUST go through Nayax Israel gateway.

### **Key Services:**

1. **NayaxSparkService** (`server/services/NayaxSparkService.ts`)
   - Primary Nayax Spark API integration
   - Payment intent creation
   - Transaction verification
   - Refund processing

2. **NayaxMonitoringService** (`server/services/NayaxMonitoringService.ts`)
   - Real-time transaction monitoring
   - Fraud detection
   - Alert system

3. **Platform-Specific Payment Services:**
   - `NayaxSitterMarketplaceService.ts` - Sitter payments
   - `NayaxWalkMarketplaceService.ts` - Walker payments
   - `NayaxJobDispatchPaymentService.ts` - General job dispatch

4. **EscrowService** (`server/services/EscrowService.ts`)
   - 72-hour payment hold
   - Automatic release after service completion
   - Dispute management
   - Refund processing

### **Payment Flow:**

```typescript
import NayaxSparkService from '@/services/NayaxSparkService';
import EscrowService from '@/services/EscrowService';

// 1. Create payment intent
const paymentIntent = await NayaxSparkService.createPaymentIntent({
  amount: 250.00,
  currency: 'ILS',
  description: 'Pet sitting service',
  metadata: {
    bookingId: 'booking-123',
    platform: 'sitter-suite',
  },
});

// 2. Create escrow hold (72 hours)
await EscrowService.createEscrowPayment(
  'booking-123',
  'customer-id',
  'provider-id',
  250.00,
  paymentIntent.id,
  { bookingPlatform: 'sitter-suite' }
);

// 3. After service completion, release payment
await EscrowService.releasePayment('booking-123');
```

### **Tax Calculation:**

```typescript
import VATCalculatorService from '@/services/VATCalculatorService';

const vatCalc = VATCalculatorService.calculateVAT(250.00);
console.log(vatCalc);
// {
//   baseAmount: 250.00,
//   commission: 37.50, // 15%
//   vatOnCommission: 6.375, // 17% VAT
//   providerPayout: 212.50,
//   totalCharged: 256.375
// }
```

---

## 🔐 **Authentication & Security**

### **Banking-Level Security Stack**

The platform has a **COMPLETE** authentication system. DO NOT create parallel auth systems.

### **Key Components:**

#### 1. **Firebase Authentication**
- `AuthService.ts` - Main auth orchestration
- `client/src/lib/firebase.ts` - Firebase client config
- Multiple providers: Email, Google, Apple, Phone

#### 2. **WebAuthn / Passkey System**

**Backend:**
- `server/webauthn/service.ts` (700+ lines) - Complete WebAuthn implementation
- `server/webauthn/deviceRegistry.ts` - Device management
- `server/webauthn/csrfProtection.ts` - CSRF protection

**Frontend:**
- `client/src/auth/passkey.ts` - Passkey registration/authentication
- `client/src/hooks/useAutoFaceID.ts` - Automatic Face ID on iOS/Android
- `client/src/lib/webauthn.ts` - WebAuthn utilities

#### 3. **Biometric Security**

**Services:**
- `BiometricSecurityMonitor.ts` - Banking-level monitoring
- `BiometricVerificationService.ts` - ID/Passport verification
- `DeviceSecurityAlertsService.ts` - Security alerts

**UI Components:**
- `BiometricConsentDialog.tsx` - Face ID consent
- `FaceIDLoadingState.tsx` - Auto Face ID loading
- `EnableFaceIDCard.tsx` - Face ID promotion

#### 4. **Auto Face ID Flow**

**Usage:**

```typescript
import { useAutoFaceID } from '@/hooks/useAutoFaceID';

function SignIn() {
  const { autoFaceIDAvailable, attemptAutoLogin } = useAutoFaceID();

  useEffect(() => {
    if (autoFaceIDAvailable) {
      attemptAutoLogin();
    }
  }, [autoFaceIDAvailable]);

  return (
    <>
      {autoFaceIDAvailable && <FaceIDLoadingState />}
      {/* Regular login form */}
    </>
  );
}
```

**Features:**
- Automatic Face ID/Touch ID on returning users
- iOS/Android platform detection
- Graceful fallback to password
- Security compliance (FIDO2 Level 2)

#### 5. **KYC Verification**

**Passport Scanning:**

```typescript
import PassportOCRService from '@/services/PassportOCRService';

// Google Vision API-powered passport verification
const result = await PassportOCRService.scanPassport(imageFile);
console.log(result);
// {
//   firstName: 'John',
//   lastName: 'Doe',
//   passportNumber: 'AB123456',
//   nationality: 'IL',
//   dateOfBirth: '1990-01-01',
//   expiryDate: '2030-01-01',
// }
```

---

## 🤖 **AI Services**

### **Google Gemini 2.5 Flash Integration**

Multiple AI-powered services are already implemented:

#### 1. **Gemini Chat Assistant**
- File: `server/services/ChatService.ts`
- Features: Context-aware, bilingual (Hebrew/English), emotion detection

#### 2. **Email Quality Monitor**
- File: `server/services/GeminiEmailMonitor.ts`
- Validates emails display correctly across iOS Mail, Android Gmail, Outlook

#### 3. **Watchdog System**
- File: `server/services/GeminiWatchdogService.ts`
- Automated system monitoring and health checks

#### 4. **AI Triage**
- File: `server/services/SitterAITriageService.ts`
- Intelligent booking request routing

#### 5. **Content Moderation**
- File: `server/services/ContentModerationService.ts`
- Review moderation: `server/services/ReviewModerationService.ts`

#### 6. **Translation Service**
- File: `server/services/geminiTranslation.ts`
- Real-time translation across 6+ languages

#### 7. **Smart Weather Advisor**
- File: `server/services/smartWeatherAdvisor.ts`
- Pet-focused weather insights

### **Usage Example:**

```typescript
import { GeminiWatchdogService } from '@/services/GeminiWatchdogService';

// AI-powered system health check
const healthReport = await GeminiWatchdogService.runHealthCheck();
console.log(healthReport.status); // 'healthy' | 'warning' | 'critical'
```

---

## 🧭 **Navigation & UX**

### **Deep Navigation System**

Navigation is defined in `shared/petwashGlobal.ts` and implemented in `client/src/lib/navigationStructure.ts`.

### **Hamburger Menu Structure:**

Each platform has multi-layer navigation:

```typescript
import { getNavigationForRole } from '@shared/petwashGlobal';

const navigation = getNavigationForRole('provider');
// Returns full navigation tree with role-based filtering
```

### **Mobile-First Design:**

All UI components support:
- iOS/Android gestures
- RTL layouts (Hebrew, Arabic)
- Glassmorphism design
- Apple-style spring animations
- Dark mode

### **Key UI Components:**

```typescript
// World-class date picker
import MobileDatePicker from '@/components/ui/mobile-date-picker';

// Google Maps autocomplete
import GooglePlacesAutocomplete from '@/components/ui/google-places-autocomplete';

// Mobile-optimized input
import MobileInput from '@/components/ui/mobile-input';

// Responsive dialog
import ResponsiveDialogShell from '@/components/ui/ResponsiveDialogShell';
```

---

## ➕ **Adding New Features**

### **Step-by-Step Process:**

#### 1. **Research Existing Code (MANDATORY)**

```bash
# Check global architecture
cat shared/petwashGlobal.ts

# Search for similar functionality
grep -r "functionName" server/services/

# Check existing schemas
ls shared/schema*.ts

# Look for similar pages
find client/src/pages -name "*YourFeature*"
```

#### 2. **Document Your Findings**

Create a proposal:

```markdown
## Feature: [Name]

### Existing Systems Found:
- Service X in `server/services/X.ts` does Y
- Component Z in `client/src/components/Z.tsx` handles UI

### Gap Analysis:
- Missing: [specific functionality]
- Can extend: [existing service/component]

### Integration Plan:
1. Extend service X with method Y
2. Add new route to existing `server/routes/Z.ts`
3. Update UI component A with new props
```

#### 3. **Get Approval Before Building**

**DO NOT build without confirming:**
- No existing solution exists
- Integration approach is clean
- Schemas won't be duplicated

#### 4. **Integration Guidelines**

**Extend, Don't Replace:**

```typescript
// ❌ WRONG - Creating new service
class NewBookingService {
  createBooking() { ... }
}

// ✅ CORRECT - Extending existing service
// In server/services/booking-service.ts
export class BookingService {
  // ... existing methods ...
  
  // Add new method to existing service
  createRecurringBooking() { ... }
}
```

**Use Existing Types:**

```typescript
// ❌ WRONG - Creating new types
interface MyBooking {
  id: string;
  date: string;
}

// ✅ CORRECT - Using existing types
import type { BookingCreationPayload } from '@shared/petwashGlobal';
import type { SelectBooking } from '@shared/schema';
```

---

## 📖 **Quick Reference Checklist**

Before adding ANY new code:

- [ ] Checked `shared/petwashGlobal.ts`
- [ ] Checked `shared/schema*.ts`
- [ ] Searched `server/services/` for similar functionality
- [ ] Searched `client/src/pages/` for similar pages
- [ ] Searched `client/src/components/` for similar UI
- [ ] Documented findings and integration plan
- [ ] Confirmed gap truly exists
- [ ] Planned integration with existing architecture
- [ ] Got approval before building

---

## 🎯 **Core Principle**

**This is an ENTERPRISE PLATFORM with MONTHS of development.**

Your job is to:
- ✅ Stabilize existing systems
- ✅ Document architecture
- ✅ Polish UX
- ✅ Complete missing pieces INSIDE existing architecture

Your job is NOT to:
- ❌ Rebuild from scratch
- ❌ Create parallel systems
- ❌ Ignore existing code
- ❌ Bypass existing integrations

---

## 📞 **Support**

Questions? Check these docs:
- `BOOKING_SYSTEM_ARCHITECTURE.md` - Deep dive into booking
- `PAYMENT_ARCHITECTURE.md` - Payment flow details
- `AUTHENTICATION_GUIDE_FRIDAY_LAUNCH.md` - Auth system guide
- `UNIFIED_PLATFORM_ARCHITECTURE.md` - Overall architecture

**Remember: Search first, build second. Respect the existing work.**
