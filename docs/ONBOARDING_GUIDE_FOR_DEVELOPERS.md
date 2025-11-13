# Developer Onboarding Guide - Pet Wash™ Platform

## 👋 **Welcome to Pet Wash™**

This guide will help you understand the existing platform architecture and how to work effectively with the codebase.

**⚠️ CRITICAL FIRST PRINCIPLE:**
This is a **production enterprise platform** with **months of development**. You are joining an established system. Your job is to **extend and polish**, not rebuild.

---

## 📚 **Required Reading (In Order)**

1. **THIS FILE** - Start here
2. `EXISTING_SYSTEMS_REFERENCE.md` - Complete inventory of all systems
3. `DEVELOPER_INTEGRATION_GUIDE.md` - How to use existing architecture
4. `BOOKING_SYSTEM_ARCHITECTURE.md` - Booking system deep dive
5. `PAYMENT_ARCHITECTURE.md` - Payment flows
6. `AUTHENTICATION_GUIDE_FRIDAY_LAUNCH.md` - Auth system

**Estimated Reading Time:** 2-3 hours

**DO NOT skip this reading. It will save you days of confusion.**

---

## 🏗️ **Platform Overview**

### **What is Pet Wash™?**

Pet Wash™ is a **super-app ecosystem** operating under **Pet Wash Ltd** with 6 independent business units:

1. 🛁 **K9000 Wash Stations** - Premium IoT self-service wash stations (flagship)
2. 🏠 **The Sitter Suite™** - Pet sitting marketplace (Airbnb for pets)
3. 🐕 **Walk My Pet™** - Dog walking marketplace
4. 🚗 **PetTrek™** - Pet transport marketplace
5. ✂️ **Grooming Marketplace** - Professional grooming services
6. 🏢 **Shared Services Hub** - Enterprise management

### **Tech Stack**

```
Frontend:
├── React 18 + TypeScript
├── Wouter (routing)
├── TanStack Query v5 (state management)
├── shadcn/ui (UI components)
└── Tailwind CSS (styling)

Backend:
├── Node.js + Express
├── Firebase Admin (auth, Firestore, storage)
├── Neon PostgreSQL + Drizzle ORM
└── Redis (caching with graceful fallback)

Integrations:
├── Firebase Authentication + WebAuthn/Passkeys
├── Nayax Israel (EXCLUSIVE payment gateway - NO STRIPE)
├── Google Gemini 2.5 Flash (AI)
├── Google Cloud Platform (Vision, Translation, Storage, etc.)
└── HubSpot, SendGrid, Twilio, DocuSeal, etc.
```

---

## 📊 **Codebase Statistics**

Understanding the scale:

- **Backend Services:** 118 files (41,313 lines)
- **Frontend Pages:** 192 files
- **UI Components:** 155 files
- **API Routes:** 115 files
- **Custom Hooks:** 16 files
- **Shared Schemas:** 27 files
- **Documentation:** 50+ guides

**This is an ENTERPRISE platform, not a weekend project.**

---

## 🗂️ **Directory Structure**

```
pet-wash-platform/
│
├── client/                    # Frontend (React)
│   ├── src/
│   │   ├── pages/            # 192 page components
│   │   │   ├── sitter-suite/ # Sitter marketplace
│   │   │   ├── walk-my-pet/  # Dog walking marketplace
│   │   │   ├── pettrek/      # Pet transport marketplace
│   │   │   ├── academy/      # Training academy
│   │   │   ├── franchise/    # Franchise management
│   │   │   ├── admin/        # Admin pages
│   │   │   └── legal/        # Legal pages
│   │   │
│   │   ├── components/       # 155 UI components
│   │   │   ├── ui/          # shadcn/ui + custom components
│   │   │   ├── admin/       # Admin-specific
│   │   │   ├── messaging/   # Chat components
│   │   │   └── security/    # Security components
│   │   │
│   │   ├── hooks/           # 16 custom React hooks
│   │   ├── lib/             # 37 utility libraries
│   │   ├── auth/            # Auth utilities (passkey.ts, etc.)
│   │   └── App.tsx          # Main app entry
│   │
│   └── index.html           # HTML entry point
│
├── server/                   # Backend (Node.js + Express)
│   ├── services/            # 118 business logic services (41,313 lines)
│   ├── routes/              # 115 API route files
│   ├── middleware/          # 20+ middleware (auth, rate limiting, etc.)
│   ├── webauthn/            # WebAuthn/Passkey implementation
│   ├── compliance/          # Compliance services
│   └── server.cjs           # Express server entry
│
├── shared/                  # Shared between client & server
│   ├── petwashGlobal.ts    # ⭐ SINGLE SOURCE OF TRUTH (670 lines)
│   ├── schema.ts           # Main database schema
│   ├── super-app-schema*.ts # Super-app schemas
│   └── schema-*.ts         # 27 domain-specific schemas
│
├── docs/                    # 50+ documentation files
│   ├── DEVELOPER_INTEGRATION_GUIDE.md
│   ├── BOOKING_SYSTEM_ARCHITECTURE.md
│   ├── EXISTING_SYSTEMS_REFERENCE.md
│   └── ... (47 more)
│
└── public/                  # Static assets
```

---

## ⭐ **The Single Source of Truth**

### **`shared/petwashGlobal.ts` (670 lines)**

**ALWAYS CHECK THIS FILE FIRST BEFORE DOING ANYTHING.**

This file defines:
- ✅ All platform IDs and configurations
- ✅ User roles and permissions
- ✅ Booking states and workflows
- ✅ Payment configuration (Nayax only)
- ✅ Multi-currency support
- ✅ KYC levels and requirements
- ✅ Deep navigation structure
- ✅ Type definitions for the entire platform

**Example:**

```typescript
import { 
  PLATFORMS, 
  getPlatformById, 
  getKycLevelForRole,
  formatAmount 
} from '@shared/petwashGlobal';

// Get platform configuration
const sitterPlatform = getPlatformById('sitter-suite');

// Check KYC requirements for role
const kycLevel = getKycLevelForRole('provider'); // 'STANDARD'

// Format currency
const formatted = formatAmount(25000, 'ILS'); // '₪250.00'
```

---

## 🔍 **How to Find Existing Code**

### **Step 1: Check Global Architecture**

```bash
# Read the single source of truth
cat shared/petwashGlobal.ts

# Check if functionality exists in schemas
ls shared/schema*.ts
```

### **Step 2: Search Services**

```bash
# Search all services
grep -r "functionName" server/services/

# List all services
ls server/services/*.ts

# Count service lines
wc -l server/services/*.ts | tail -1
```

### **Step 3: Search Components**

```bash
# Find similar components
find client/src/components -name "*ComponentName*"

# Search component content
grep -r "ComponentLogic" client/src/components/
```

### **Step 4: Check Routes**

```bash
# List all routes
ls server/routes/*.ts

# Search for route functionality
grep -r "/api/endpoint" server/routes/
```

### **Step 5: Document Findings**

Create a document:

```markdown
## Feature Research: [Name]

### Existing Systems:
- ✅ Found: BookingService in `server/services/booking-service.ts`
- ✅ Found: BookingFlow UI in `client/src/pages/sitter-suite/BookingFlow.tsx`
- ❌ Missing: Recurring booking functionality

### Integration Plan:
1. Extend BookingService with `createRecurringBooking()` method
2. Add UI toggle to existing BookingFlow component
3. Update schema to add `recurrence` field to bookings table
```

---

## 🚦 **Development Workflow**

### **Before Writing Any Code:**

1. **Research** (30 minutes minimum)
   - Check `shared/petwashGlobal.ts`
   - Search `server/services/`
   - Search `client/src/pages/` and `client/src/components/`
   - Search `server/routes/`

2. **Document** (15 minutes)
   - What exists?
   - What's missing?
   - How will new code integrate?

3. **Propose** (Get approval)
   - Share research findings
   - Explain integration approach
   - Confirm no duplication

4. **Build** (Only after approval)
   - Extend existing services
   - Use existing components
   - Follow established patterns

5. **Test** (Required)
   - Unit tests for services
   - Integration tests for routes
   - E2E tests with Playwright

---

## 📝 **Code Examples**

### **Example 1: Extending Existing Service**

```typescript
// ✅ CORRECT - Extending existing BookingService
// File: server/services/booking-service.ts

export class BookingService {
  // ... existing methods ...

  // Add new method to existing service
  static async createRecurringBooking(params: RecurringBookingParams) {
    const bookings = [];
    
    for (const date of params.dates) {
      // Reuse existing createBooking method
      const booking = await this.createBooking({
        ...params,
        serviceDate: date,
      });
      bookings.push(booking);
    }
    
    return bookings;
  }
}
```

```typescript
// ❌ WRONG - Creating new service
// File: server/services/NewBookingService.ts

class NewBookingService {
  createBooking() {
    // Duplicates existing functionality - DON'T DO THIS
  }
}
```

### **Example 2: Extending Existing Component**

```typescript
// ✅ CORRECT - Extending existing BookingFlow
// File: client/src/pages/sitter-suite/BookingFlow.tsx

export function BookingFlow() {
  const [isRecurring, setIsRecurring] = useState(false);
  
  // ... existing booking logic ...

  return (
    <div>
      {/* Existing booking form */}
      
      {/* Add new feature to existing component */}
      <Switch
        checked={isRecurring}
        onCheckedChange={setIsRecurring}
        label="Recurring Booking"
      />
      
      {isRecurring && (
        <RecurrenceSelector onSelect={handleRecurrence} />
      )}
    </div>
  );
}
```

```typescript
// ❌ WRONG - Creating new component
// File: client/src/components/marketplace/NewBookingCalendar.tsx

export function NewBookingCalendar() {
  // Duplicates MobileDatePicker - DON'T DO THIS
}
```

### **Example 3: Using Existing Types**

```typescript
// ✅ CORRECT - Using existing types
import type { 
  BookingCreationPayload,
  SelectBooking 
} from '@shared/petwashGlobal';
import type { SelectUser } from '@shared/schema';

async function createBooking(payload: BookingCreationPayload): Promise<SelectBooking> {
  // ...
}
```

```typescript
// ❌ WRONG - Creating new types
interface MyBooking {
  id: string;
  date: string;
  // Duplicates existing types - DON'T DO THIS
}
```

---

## 🎯 **Key Systems to Know**

### **1. Booking System**

**Services:**
- `booking-service.ts` (742 lines) - General marketplace bookings
- `SitterAdvancedBookingEngine.ts` - Airbnb-level sitter bookings

**Frontend:**
- `sitter-suite/BookingFlow.tsx`
- `walk-my-pet/BookingFlow.tsx`
- `pettrek/BookingFlow.tsx`
- `academy/BookingFlow.tsx`

**When to use:**
- Creating bookings → Use `BookingService.createBooking()`
- Sitter bookings with surge pricing → Use `SitterAdvancedBookingEngine`
- Date selection UI → Use `MobileDatePicker` component

### **2. Payment System**

**🚨 CRITICAL: Nayax Israel ONLY - NO STRIPE**

**Services:**
- `NayaxSparkService.ts` - Nayax Spark API
- `EscrowService.ts` - 72hr payment hold
- `VATCalculatorService.ts` - Israeli VAT (17%)

**When to use:**
- Payment intents → `NayaxSparkService.createPaymentIntent()`
- Escrow → `EscrowService.createEscrowPayment()`
- VAT calculation → `VATCalculatorService.calculateVAT()`

### **3. Authentication System**

**Services:**
- `AuthService.ts` - Firebase auth orchestration
- `server/webauthn/service.ts` (700 lines) - WebAuthn/Passkey

**Frontend:**
- `client/src/auth/passkey.ts` - Passkey client
- `client/src/hooks/useAutoFaceID.ts` - Auto Face ID

**When to use:**
- Authentication → Use existing Firebase/WebAuthn system
- Face ID → Use `useAutoFaceID` hook
- Login UI → Extend `SignIn.tsx`

### **4. AI Services**

**Services:**
- `ChatService.ts` - AI chat assistant
- `GeminiEmailMonitor.ts` - Email validation
- `GeminiWatchdogService.ts` - System monitoring
- `smartWeatherAdvisor.ts` - Weather insights

**When to use:**
- Chat → `ChatService.createConversation()`
- Moderation → `ContentModerationService.moderate()`
- Translation → `geminiTranslation.translate()`

---

## 🛠️ **Common Tasks**

### **Task: Add New Booking Feature**

```bash
# 1. Research
cat server/services/booking-service.ts
grep -r "booking" client/src/pages/sitter-suite/

# 2. Extend service
# Add method to server/services/booking-service.ts

# 3. Extend UI
# Modify client/src/pages/sitter-suite/BookingFlow.tsx

# 4. Test
npm run test
npm run dev
```

### **Task: Add New Payment Flow**

```bash
# 1. Research
cat server/services/NayaxSparkService.ts
cat server/services/EscrowService.ts

# 2. Use existing services
# Import and use NayaxSparkService in your route

# 3. Add route
# Extend server/routes/bookings.ts or similar

# 4. Test
npm run test
```

### **Task: Add New UI Component**

```bash
# 1. Research
find client/src/components/ui -name "*.tsx"

# 2. Check if exists
# Use MobileDatePicker, GooglePlacesAutocomplete, etc.

# 3. Only if truly missing
# Create in client/src/components/ui/
# Follow existing patterns

# 4. Test
npm run dev
```

---

## 📖 **Documentation Index**

Must read:
1. `EXISTING_SYSTEMS_REFERENCE.md` - Complete inventory
2. `DEVELOPER_INTEGRATION_GUIDE.md` - How to integrate
3. `BOOKING_SYSTEM_ARCHITECTURE.md` - Booking deep dive

Important:
4. `PAYMENT_ARCHITECTURE.md` - Payment flows
5. `AUTHENTICATION_GUIDE_FRIDAY_LAUNCH.md` - Auth system
6. `UNIFIED_PLATFORM_ARCHITECTURE.md` - Platform overview

Reference:
7. `NAYAX_PRODUCTION_SETUP_GUIDE.md` - Nayax setup
8. `FIREBASE_DEPLOYMENT_GUIDE.md` - Firebase setup
9. `ISRAELI_VAT_SYSTEM.md` - Tax compliance

---

## ⚠️ **Common Mistakes to Avoid**

### **Mistake #1: Building Without Research**

```typescript
// ❌ WRONG
// *starts building new BookingService without checking*

// ✅ CORRECT
// 1. Search: grep -r "Booking" server/services/
// 2. Found: booking-service.ts exists
// 3. Decision: Extend existing service
```

### **Mistake #2: Creating Parallel Systems**

```typescript
// ❌ WRONG
class MyNewPaymentService {
  processPayment() { ... }
}

// ✅ CORRECT
import NayaxSparkService from '@/services/NayaxSparkService';
NayaxSparkService.createPaymentIntent(...);
```

### **Mistake #3: Ignoring Existing UI Components**

```typescript
// ❌ WRONG
<input type="date" />

// ✅ CORRECT
import MobileDatePicker from '@/components/ui/mobile-date-picker';
<MobileDatePicker ... />
```

### **Mistake #4: Creating New Types**

```typescript
// ❌ WRONG
interface Booking {
  id: string;
  date: string;
}

// ✅ CORRECT
import type { BookingCreationPayload } from '@shared/petwashGlobal';
```

---

## ✅ **Onboarding Checklist**

Day 1:
- [ ] Read this guide completely
- [ ] Read `EXISTING_SYSTEMS_REFERENCE.md`
- [ ] Read `DEVELOPER_INTEGRATION_GUIDE.md`
- [ ] Explore `shared/petwashGlobal.ts`
- [ ] Browse `server/services/` directory
- [ ] Browse `client/src/pages/` directory

Day 2:
- [ ] Read `BOOKING_SYSTEM_ARCHITECTURE.md`
- [ ] Read `PAYMENT_ARCHITECTURE.md`
- [ ] Read `AUTHENTICATION_GUIDE_FRIDAY_LAUNCH.md`
- [ ] Set up local development environment
- [ ] Run the application: `npm run dev`

Day 3:
- [ ] Make a small test change to existing component
- [ ] Extend an existing service with new method
- [ ] Create a pull request for review
- [ ] Get feedback from team

Week 1:
- [ ] Complete first real feature (extending existing system)
- [ ] Write tests for your changes
- [ ] Document your work
- [ ] Understand 3 major systems (booking, payment, auth)

---

## 🎯 **Core Principles**

1. **Search first, build second**
2. **Extend existing systems, never replace**
3. **Use `shared/petwashGlobal.ts` as single source of truth**
4. **Respect existing architecture**
5. **Document integration approach before building**
6. **Test thoroughly**
7. **Get code review before merging**

---

## 📞 **Getting Help**

**Before asking:**
1. Search documentation (50+ guides)
2. Search codebase (`grep -r "term"`)
3. Read related source files

**When asking:**
1. Show what you've researched
2. Explain what you're trying to achieve
3. Show your proposed integration approach
4. Ask specific questions

---

## 🎓 **Learning Path**

### **Week 1: Understand Architecture**
- Read all core documentation
- Explore codebase structure
- Run and test application locally
- Make small modifications to existing code

### **Week 2: Master Booking System**
- Deep dive into `booking-service.ts`
- Understand `SitterAdvancedBookingEngine.ts`
- Explore booking UI flows
- Create test booking end-to-end

### **Week 3: Master Payment System**
- Understand Nayax integration
- Learn escrow flow (72hr hold)
- Study VAT calculation
- Test payment flow end-to-end

### **Week 4: Master Auth System**
- Understand Firebase auth
- Learn WebAuthn/Passkey implementation
- Test Face ID flow on mobile
- Implement auth in new feature

### **Month 2+: Build Features**
- Extend existing systems with new features
- Write comprehensive tests
- Document new functionality
- Mentor other developers

---

## 🚀 **You're Ready!**

You now understand:
- ✅ Platform architecture and scale
- ✅ How to find existing code
- ✅ How to extend existing systems
- ✅ Key systems (booking, payment, auth, AI)
- ✅ Development workflow
- ✅ Common mistakes to avoid

**Remember:**
- This is an **enterprise platform** with **months of development**
- Your job is to **extend and polish**, not rebuild
- **Search first, build second**
- **Respect existing architecture**

**Welcome to Pet Wash™. Let's build something amazing together! 🐾**
