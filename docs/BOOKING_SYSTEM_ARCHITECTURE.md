# Booking System Architecture - Pet Wash™ Platform

## 🎯 **Overview**

The Pet Wash™ platform has **TWO PRODUCTION-READY** booking engines that handle all marketplace transactions across 5 platforms (Sitter Suite, Walk My Pet, PetTrek, K9000, Academy).

**DO NOT create new booking services. Use these.**

---

## 🏗️ **Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT REQUEST (Frontend)                    │
│  Platform-Specific BookingFlow Components                       │
│  - sitter-suite/BookingFlow.tsx                                 │
│  - walk-my-pet/BookingFlow.tsx                                  │
│  - pettrek/BookingFlow.tsx                                      │
│  - academy/BookingFlow.tsx                                      │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API ROUTES (server/routes/)                     │
│  - bookings.ts (General marketplace bookings)                   │
│  - academy.ts (Academy-specific)                                │
│  - franchise.ts (K9000-specific)                                │
└───────────────────┬─────────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
        ▼                        ▼
┌──────────────────┐    ┌────────────────────────────┐
│ BookingService   │    │ SitterAdvancedBookingEngine│
│ (General)        │    │ (Airbnb-Level)             │
│ 742+ lines       │    │ Advanced Features          │
└────────┬─────────┘    └─────────┬──────────────────┘
         │                         │
         │    ┌───────────────────┴─────────────────┐
         │    │                                      │
         ▼    ▼                                      ▼
┌──────────────────────┐                  ┌────────────────────┐
│  SUPPORTING SERVICES │                  │   DATA LAYER       │
│                      │                  │                    │
│ - EscrowService      │────────────────▶ │ Firebase Firestore │
│ - NayaxSparkService  │                  │ - bookings/        │
│ - VATCalculatorService│                 │ - escrow/          │
│ - NotificationService│                  │ - providers/       │
│ - ChatService        │                  │                    │
│ - CalendarService    │                  │ Neon PostgreSQL    │
│ - PricingService     │                  │ - bookings table   │
└──────────────────────┘                  └────────────────────┘
```

---

## 📦 **1. BookingService (General Engine)**

**File:** `server/services/booking-service.ts` (742+ lines)

### **Purpose:**
Handles general marketplace bookings across all platforms with standard features.

### **Supported Platforms:**
- ✅ Sitter Suite
- ✅ Walk My Pet
- ✅ PetTrek
- ✅ K9000
- ✅ Academy

### **Key Features:**

#### ✅ **Multi-Platform Support**
```typescript
createBooking({
  platform: 'sitter-suite' | 'walk-my-pet' | 'pettrek' | 'k9000' | 'academy',
  // ...
})
```

#### ✅ **Real-Time Conflict Detection**
- Checks provider availability
- Prevents double-booking
- Validates time slots
- Handles calendar conflicts

#### ✅ **Automatic VAT Calculation**
```typescript
const vatCalc = VATCalculatorService.calculateVAT(baseAmount);
// Returns: baseAmount, commission, vatOnCommission, totalCharged
```

#### ✅ **Escrow Integration**
- 72-hour payment hold
- Automatic release after service completion
- Dispute management

#### ✅ **Provider Payout Automation**
```typescript
await ProviderPayoutService.schedulePayout({
  providerId,
  bookingId,
  amount: providerPayout,
  releaseDate: 72_hours_from_now,
});
```

#### ✅ **Chat Conversation Creation**
```typescript
await ChatService.createConversation(
  customerId,
  providerId,
  bookingId,
  platform
);
```

#### ✅ **Push Notifications**
- Customer booking confirmation
- Provider new booking alert
- Booking status updates

#### ✅ **Calendar Management**
- Availability checking
- Booking conflict detection
- Time slot validation

### **Usage Example:**

```typescript
import BookingService from '@/services/booking-service';

// Create standard booking
const booking = await BookingService.createBooking({
  platform: 'walk-my-pet',
  providerId: 'walker-123',
  customerId: 'customer-456',
  serviceDate: '2025-11-20',
  timeSlot: '10:00-11:00',
  petIds: ['dog-789'],
  baseAmount: 80.00,
  metadata: {
    walkType: 'group',
    duration: 60,
  },
});

console.log(booking);
// {
//   id: 'booking-abc123',
//   status: 'confirmed',
//   totalAmount: 84.20, // includes VAT
//   escrowId: 'escrow-def456',
//   chatId: 'chat-ghi789',
// }
```

---

## 🚀 **2. SitterAdvancedBookingEngine (Airbnb-Level)**

**File:** `server/services/SitterAdvancedBookingEngine.ts`

### **Purpose:**
Advanced booking engine specifically for Sitter Suite with enterprise-grade features similar to Airbnb.

### **Advanced Features:**

#### 🎯 **Dynamic Pricing**

**Holiday Surge Pricing:**
```typescript
const pricing = calculatePricing({
  baseRate: 200.00,
  startDate: '2025-12-25', // Christmas
  endDate: '2025-12-27',
  petCount: 2,
});

console.log(pricing);
// {
//   baseAmount: 200.00,
//   surgePricing: 50.00, // 25% holiday surge
//   multiPetDiscount: -20.00, // 10% for 2+ pets
//   totalBeforeVAT: 230.00,
// }
```

**Surge Pricing Triggers:**
- Israeli holidays (Passover, Rosh Hashanah, Sukkot, etc.)
- International holidays (Christmas, New Year)
- Weekend surges (Friday-Saturday in Israel)
- Peak season (Summer: June-August)
- Last-minute bookings (<24hr notice)

#### 📅 **Multi-Day Booking Support**

```typescript
const booking = await SitterAdvancedBookingEngine.createBooking({
  sitterId: 'sitter-123',
  customerId: 'customer-456',
  startDate: '2025-11-20',
  endDate: '2025-11-25', // 5 days
  petIds: ['dog-789', 'cat-321'],
  services: ['overnight', 'feeding', 'medication', 'updates'],
});

// Calculates per-day rate with multi-day discount
```

#### 🔄 **Cancellation Policy Engine**

```typescript
const refundAmount = calculateCancellationRefund({
  bookingId: 'booking-123',
  cancellationDate: new Date(),
  serviceStartDate: new Date('2025-11-20'),
  totalAmount: 500.00,
});

// Cancellation Policy:
// - 7+ days before: 100% refund
// - 3-7 days before: 50% refund
// - 1-3 days before: 25% refund
// - <24 hours: No refund
```

#### ⭐ **Automated Review System**

```typescript
// Automatically schedules review requests
await scheduleReviewReminders({
  bookingId: 'booking-123',
  customerId: 'customer-456',
  sitterId: 'sitter-123',
  serviceEndDate: '2025-11-25',
});

// Sends reminders:
// - Day 1 after service
// - Day 3 after service
// - Day 7 after service (final)
```

#### 🌤️ **Weather Integration**

```typescript
// Provides weather-based recommendations
const recommendations = await getWeatherRecommendations({
  location: 'Tel Aviv',
  serviceDate: '2025-11-20',
  petType: 'dog',
});

// Returns:
// - Temperature alerts
// - Rain/storm warnings
// - UV index for outdoor activities
// - Air quality concerns
```

#### 🔒 **Advanced Conflict Detection**

```typescript
const conflicts = await checkAdvancedConflicts({
  sitterId: 'sitter-123',
  startDate: '2025-11-20',
  endDate: '2025-11-25',
  checkBufferTime: true, // Ensures 2hr buffer between bookings
});

// Checks:
// - Overlapping bookings
// - Buffer time between services
// - Maximum concurrent pets
// - Sitter vacation/blackout dates
```

### **Usage Example:**

```typescript
import SitterAdvancedBookingEngine from '@/services/SitterAdvancedBookingEngine';

// Create advanced booking with all features
const result = await SitterAdvancedBookingEngine.createBooking({
  sitterId: 'sitter-123',
  customerId: 'customer-456',
  startDate: '2025-12-25', // Christmas - surge pricing
  endDate: '2025-12-27',
  petIds: ['dog-789', 'cat-321'],
  services: ['overnight', 'feeding', 'medication', 'photo-updates'],
  specialRequests: 'Dog needs medication at 8am and 8pm',
});

console.log(result);
// {
//   booking: { id: 'booking-123', ... },
//   pricing: {
//     baseAmount: 200.00,
//     surgePricing: 50.00, // Holiday surge
//     multiPetDiscount: -20.00,
//     serviceAddons: 15.00,
//     totalBeforeVAT: 245.00,
//     vat: 41.65,
//     totalAmount: 286.65,
//   },
//   escrow: { id: 'escrow-456', releaseDate: '2025-12-30' },
//   chat: { id: 'chat-789' },
//   cancellationPolicy: {
//     deadline: '2025-12-18',
//     refundPercentage: 100,
//   },
// }
```

---

## 🎨 **Frontend Booking Flows**

### **Platform-Specific Components:**

Each platform has its own optimized `BookingFlow.tsx`:

#### 1. **Sitter Suite**
**File:** `client/src/pages/sitter-suite/BookingFlow.tsx`

**Features:**
- Multi-day date range picker
- Pet selection (multiple pets)
- Service add-ons (feeding, medication, updates)
- Photo gallery upload
- Special requests text area
- Real-time pricing calculation
- Cancellation policy display

#### 2. **Walk My Pet**
**File:** `client/src/pages/walk-my-pet/BookingFlow.tsx`

**Features:**
- Single-day date picker
- Time slot selection (30min, 60min, 90min)
- Walk type (individual, group)
- GPS tracking consent
- Real-time walker location
- Emergency contact setup

#### 3. **PetTrek**
**File:** `client/src/pages/pettrek/BookingFlow.tsx`

**Features:**
- Pickup/dropoff location (Google Maps)
- Date & time selection
- Pet crate/carrier requirements
- Special handling instructions
- Real-time fare estimation
- Driver rating display

#### 4. **Academy**
**File:** `client/src/pages/academy/BookingFlow.tsx`

**Features:**
- Course selection
- Session date picker
- Trainer profile view
- Training goals selection
- Progress tracking consent

### **Shared UI Components:**

All booking flows use these standardized components:

```typescript
// World-class mobile date picker
import MobileDatePicker from '@/components/ui/mobile-date-picker';

// Google Maps location picker
import GooglePlacesAutocomplete from '@/components/ui/google-places-autocomplete';

// Mobile-optimized input
import MobileInput from '@/components/ui/mobile-input';

// Responsive dialog
import ResponsiveDialogShell from '@/components/ui/ResponsiveDialogShell';
```

---

## 💳 **Payment Flow Integration**

### **Step-by-Step Process:**

```typescript
// 1. Create booking (reserves time slot)
const booking = await BookingService.createBooking({...});

// 2. Calculate pricing with VAT
const pricing = VATCalculatorService.calculateVAT(booking.baseAmount);

// 3. Create Nayax payment intent
const paymentIntent = await NayaxSparkService.createPaymentIntent({
  amount: pricing.totalCharged,
  currency: 'ILS',
  metadata: { bookingId: booking.id },
});

// 4. Create escrow hold (72 hours)
const escrow = await EscrowService.createEscrowPayment(
  booking.id,
  booking.customerId,
  booking.providerId,
  pricing.totalCharged,
  paymentIntent.id
);

// 5. After service completion, release payment
await EscrowService.releasePayment(booking.id);

// 6. Schedule provider payout
await ProviderPayoutService.processPayout(
  booking.providerId,
  pricing.providerPayout
);
```

---

## 📊 **Database Schema**

### **Firestore Collections:**

```typescript
// /bookings/{bookingId}
{
  id: string;
  customerId: string;
  providerId: string;
  platform: 'sitter-suite' | 'walk-my-pet' | 'pettrek' | 'k9000' | 'academy';
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  
  // Dates
  serviceDate: Timestamp;
  startDate: string; // ISO
  endDate: string; // ISO
  
  // Pricing
  baseAmount: number;
  commission: number;
  vat: number;
  totalAmount: number;
  currency: 'ILS';
  
  // Pets
  petIds: string[];
  
  // Payment
  escrowId: string;
  paymentIntentId: string;
  paymentStatus: 'pending' | 'held' | 'released' | 'refunded';
  
  // Communication
  chatId: string;
  
  // Metadata
  metadata: object;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// /escrow/{escrowId}
{
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  amount: number;
  status: 'held' | 'released' | 'refunded';
  releaseDate: Timestamp; // 72 hours from creation
  createdAt: Timestamp;
}
```

### **PostgreSQL Tables:**

```sql
-- Neon database
CREATE TABLE bookings (
  id VARCHAR PRIMARY KEY,
  customer_id VARCHAR NOT NULL,
  provider_id VARCHAR NOT NULL,
  platform VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_provider ON bookings(provider_id);
CREATE INDEX idx_bookings_platform ON bookings(platform);
CREATE INDEX idx_bookings_status ON bookings(status);
```

---

## 🔔 **Notification Flow**

### **Customer Notifications:**

```typescript
// 1. Booking confirmation
await NotificationService.sendBookingConfirmation(customerId, {
  bookingId,
  platform,
  date: serviceDate,
  total: totalAmount,
});

// 2. Reminder (24hr before)
await NotificationService.scheduleReminder({
  userId: customerId,
  bookingId,
  sendAt: 24_hours_before_service,
  message: 'Your pet sitting appointment is tomorrow',
});

// 3. Service start notification
await NotificationService.send({
  userId: customerId,
  title: 'Service Started',
  message: 'Your sitter has arrived',
  type: 'booking_started',
});

// 4. Service completion
await NotificationService.send({
  userId: customerId,
  title: 'Service Completed',
  message: 'Please leave a review',
  type: 'booking_completed',
});
```

### **Provider Notifications:**

```typescript
// 1. New booking request
await NotificationService.send({
  userId: providerId,
  title: 'New Booking Request',
  message: 'You have a new booking for Nov 20',
  priority: 'high',
  type: 'booking_new',
});

// 2. Payment released
await NotificationService.send({
  userId: providerId,
  title: 'Payment Released',
  message: '₪250.00 has been transferred to your account',
  type: 'payment_released',
});
```

---

## 🛠️ **Extending the Booking System**

### **Adding New Features:**

#### ✅ **DO: Extend Existing Services**

```typescript
// In server/services/booking-service.ts
export class BookingService {
  // ... existing methods ...
  
  // Add new method to existing service
  static async createRecurringBooking(params: RecurringBookingParams) {
    // Implementation that uses existing createBooking method
    const bookings = [];
    for (const date of params.dates) {
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

#### ❌ **DON'T: Create New Booking Services**

```typescript
// ❌ WRONG - Don't do this
class NewBookingService {
  createBooking() {
    // Duplicates existing functionality
  }
}
```

---

## 📋 **Quick Reference**

### **When to Use BookingService:**
- Standard single-day bookings
- Simple pricing (no surge)
- Walk My Pet platform
- PetTrek platform
- Academy platform
- K9000 wash stations

### **When to Use SitterAdvancedBookingEngine:**
- Sitter Suite platform
- Multi-day bookings
- Holiday/weekend bookings (surge pricing)
- Complex cancellation policies
- Multiple pets with discounts

---

## 🎯 **Key Takeaways**

1. **DO NOT create new booking services** - Use existing ones
2. **BookingService** - General marketplace engine (742+ lines)
3. **SitterAdvancedBookingEngine** - Airbnb-level features for Sitter Suite
4. **Frontend flows** - Platform-specific `BookingFlow.tsx` components
5. **Payment integration** - Nayax + Escrow (72hr hold)
6. **Extend, don't replace** - Add methods to existing services

---

**Remember: This booking system represents months of enterprise development. Respect it. Use it. Don't rebuild it.**
