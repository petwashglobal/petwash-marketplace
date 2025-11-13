# Quick Start Integration Guide - Pet Wash™

## 🚀 **5-Minute Quick Start**

This is your EXPRESS guide to working with the Pet Wash™ platform.

---

## ⚡ **Golden Rule**

**Before writing ANY code:**

```bash
# 1. Check global architecture (ALWAYS FIRST)
cat shared/petwashGlobal.ts

# 2. Search for existing functionality
grep -r "YourFeature" server/services/

# 3. Document what you found
# 4. Propose integration approach
# 5. Only then build
```

---

## 📋 **Common Tasks Cheat Sheet**

### **Task: Create a Booking**

```typescript
// ✅ Use existing service - DON'T create new one
import BookingService from '@/services/booking-service';

const booking = await BookingService.createBooking({
  platform: 'sitter-suite',
  providerId: 'provider-123',
  customerId: 'customer-456',
  serviceDate: '2025-11-20',
  petIds: ['pet-789'],
  baseAmount: 250.00,
});
```

### **Task: Process Payment**

```typescript
// ✅ Nayax ONLY - NO STRIPE
import NayaxSparkService from '@/services/NayaxSparkService';
import EscrowService from '@/services/EscrowService';

// 1. Create payment
const payment = await NayaxSparkService.createPaymentIntent({
  amount: 250.00,
  currency: 'ILS',
  metadata: { bookingId: 'booking-123' },
});

// 2. Hold in escrow (72 hours)
await EscrowService.createEscrowPayment(
  'booking-123',
  customerId,
  providerId,
  250.00,
  payment.id
);
```

### **Task: Add Authentication**

```typescript
// ✅ Use existing auth - DON'T create new auth system
import { useAuth } from '@/hooks/useAuth';
import { useAutoFaceID } from '@/hooks/useAutoFaceID';

function MyPage() {
  const { user, loading } = useAuth();
  const { autoFaceIDAvailable } = useAutoFaceID();
  
  // Use existing auth state
  if (loading) return <Loading />;
  if (!user) return <SignIn />;
  
  return <Dashboard />;
}
```

### **Task: Show Date Picker**

```typescript
// ✅ Use existing world-class component
import MobileDatePicker from '@/components/ui/mobile-date-picker';

<MobileDatePicker
  value={selectedDate}
  onChange={setSelectedDate}
  minDate={new Date()}
  locale="he" // Hebrew support
/>
```

### **Task: Calculate VAT**

```typescript
// ✅ Use existing calculator
import VATCalculatorService from '@/services/VATCalculatorService';

const pricing = VATCalculatorService.calculateVAT(250.00);
// {
//   baseAmount: 250.00,
//   commission: 37.50, // 15%
//   vatOnCommission: 6.375, // 17%
//   totalCharged: 256.375
// }
```

---

## 🗺️ **Service Quick Reference**

| Need to... | Use this service | File |
|-----------|------------------|------|
| Create booking | `BookingService` | `booking-service.ts` |
| Sitter booking (advanced) | `SitterAdvancedBookingEngine` | `SitterAdvancedBookingEngine.ts` |
| Process payment | `NayaxSparkService` | `NayaxSparkService.ts` |
| Hold payment (escrow) | `EscrowService` | `EscrowService.ts` |
| Calculate VAT | `VATCalculatorService` | `VATCalculatorService.ts` |
| Send notification | `NotificationService` | `NotificationService.ts` |
| Chat system | `ChatService` | `ChatService.ts` |
| Authenticate user | `AuthService` | `AuthService.ts` |
| WebAuthn/Passkey | `WebAuthnService` | `webauthn/service.ts` |
| AI moderation | `ContentModerationService` | `ContentModerationService.ts` |
| Translation | `geminiTranslation` | `geminiTranslation.ts` |
| Weather data | `MultiSourceWeatherService` | `MultiSourceWeatherService.ts` |
| GPS tracking | `GPSTrackingService` | `GPSTrackingService.ts` |
| Document signing | `DocuSealService` | `DocuSealService.ts` |

---

## 🎨 **Component Quick Reference**

| Need to... | Use this component | File |
|-----------|-------------------|------|
| Date picker | `MobileDatePicker` | `mobile-date-picker.tsx` |
| Location search | `GooglePlacesAutocomplete` | `google-places-autocomplete.tsx` |
| Mobile input | `MobileInput` | `mobile-input.tsx` |
| Dialog/Modal | `ResponsiveDialogShell` | `ResponsiveDialogShell.tsx` |
| Face ID consent | `BiometricConsentDialog` | `BiometricConsentDialog.tsx` |
| Loading state | `FaceIDLoadingState` | `FaceIDLoadingState.tsx` |

---

## 🚦 **Decision Tree**

### **"I need to add a booking feature..."**

```
1. Does it exist in BookingService?
   ├─ YES → Extend existing method or add new method to BookingService
   └─ NO → Is it sitter-specific with surge pricing?
        ├─ YES → Use SitterAdvancedBookingEngine
        └─ NO → Add to BookingService

DO NOT create NewBookingService
```

### **"I need to process a payment..."**

```
1. Is it in Israel?
   ├─ YES → Use NayaxSparkService (ONLY option)
   └─ NO → STILL use Nayax (platform is Israel-only currently)

NEVER use Stripe
NEVER create alternative payment service
```

### **"I need a date picker..."**

```
1. Check if MobileDatePicker exists
   ├─ EXISTS → Use it (world-class iOS/Android native feel)
   └─ MISSING → Impossible, it exists

DO NOT create new date picker
DO NOT use basic <input type="date">
```

### **"I need authentication..."**

```
1. Is it Face ID/Touch ID?
   ├─ YES → Use useAutoFaceID hook
   └─ NO → Is it WebAuthn/Passkey?
        ├─ YES → Use webauthn/service.ts
        └─ NO → Use Firebase Auth (AuthService)

DO NOT create parallel auth system
```

---

## 📂 **File Location Map**

```
Need booking logic?
→ server/services/booking-service.ts (742 lines)
→ server/services/SitterAdvancedBookingEngine.ts

Need payment logic?
→ server/services/NayaxSparkService.ts
→ server/services/EscrowService.ts

Need auth logic?
→ server/services/AuthService.ts
→ server/webauthn/service.ts (700 lines)

Need AI logic?
→ server/services/ChatService.ts
→ server/services/GeminiWatchdogService.ts

Need booking UI?
→ client/src/pages/sitter-suite/BookingFlow.tsx
→ client/src/pages/walk-my-pet/BookingFlow.tsx
→ client/src/pages/pettrek/BookingFlow.tsx

Need date picker UI?
→ client/src/components/ui/mobile-date-picker.tsx

Need types/schemas?
→ shared/petwashGlobal.ts (670 lines - SINGLE SOURCE OF TRUTH)
→ shared/schema.ts
→ shared/schema-*.ts (27 domain schemas)
```

---

## ⚠️ **Top 5 Mistakes to Avoid**

### **1. Creating New Services Instead of Using Existing**

```typescript
// ❌ WRONG
class NewBookingService { ... }

// ✅ CORRECT
import BookingService from '@/services/booking-service';
```

### **2. Using Stripe Instead of Nayax**

```typescript
// ❌ WRONG
import stripe from 'stripe';

// ✅ CORRECT
import NayaxSparkService from '@/services/NayaxSparkService';
```

### **3. Creating New UI Components**

```typescript
// ❌ WRONG
<input type="date" />

// ✅ CORRECT
import MobileDatePicker from '@/components/ui/mobile-date-picker';
```

### **4. Creating New Types**

```typescript
// ❌ WRONG
interface MyBooking { ... }

// ✅ CORRECT
import type { BookingCreationPayload } from '@shared/petwashGlobal';
```

### **5. Building Without Research**

```bash
# ❌ WRONG
*immediately starts coding*

# ✅ CORRECT
cat shared/petwashGlobal.ts
grep -r "MyFeature" server/services/
# Research first, then build
```

---

## ✅ **Pre-Code Checklist**

Before writing ANY code, check these:

- [ ] Searched `shared/petwashGlobal.ts`
- [ ] Searched `server/services/` for similar service
- [ ] Searched `client/src/pages/` for similar page
- [ ] Searched `client/src/components/` for similar component
- [ ] Documented what exists
- [ ] Documented what's missing
- [ ] Planned integration approach
- [ ] Got approval

**If you skip this checklist, you WILL duplicate existing work.**

---

## 🎯 **3 Golden Rules**

1. **Search first, build second**
2. **Extend existing systems, never replace**
3. **Use `shared/petwashGlobal.ts` as single source of truth**

---

## 📖 **Next Steps**

**Just getting started?**
→ Read `ONBOARDING_GUIDE_FOR_DEVELOPERS.md`

**Need full inventory?**
→ Read `EXISTING_SYSTEMS_REFERENCE.md`

**Need integration details?**
→ Read `DEVELOPER_INTEGRATION_GUIDE.md`

**Working on bookings?**
→ Read `BOOKING_SYSTEM_ARCHITECTURE.md`

**Working on payments?**
→ Read `PAYMENT_ARCHITECTURE.md`

---

## 🚀 **You're Ready!**

Use this guide as your quick reference. Always search first, build second.

**Remember: This platform has 41,313 lines of backend code. It exists. Use it.**
