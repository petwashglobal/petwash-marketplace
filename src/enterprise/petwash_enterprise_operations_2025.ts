/**
 * PetWash™ Enterprise Operations System 2025
 * 
 * Comprehensive operational logic covering:
 * - Booking Engine (unified across all platforms)
 * - Availability & Capacity Management
 * - Pricing & Surge Engine
 * - Dispatch & Matching
 * - Payouts & Settlements
 * - Compliance & KYC
 * - Fraud Detection
 * - Notifications Hub
 * - Analytics Events
 * 
 * Designed for Firebase Functions v2 / Node.js 18+
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================
// 1. PLATFORM CONFIGURATION
// ============================================

export const PLATFORMS = {
  SMART_HUB: {
    id: "smart_hub",
    name: "K9000 Smart Hub",
    nameHe: "תחנת שטיפה חכמה",
    modes: ["diy_station", "outdoor_station"],
    requiresProvider: false,
    hasPhysicalLocation: true,
    escrowHours: 0, // Instant - machine-based
  },
  PET_SITTER: {
    id: "pet_sitter",
    name: "The Sitter Suite™",
    nameHe: "פנסיון לחיות מחמד",
    modes: ["overnight", "in_home", "daycare"],
    requiresProvider: true,
    hasPhysicalLocation: false,
    escrowHours: 72,
  },
  WALK_MY_PET: {
    id: "walk_my_pet",
    name: "Walk My Pet™",
    nameHe: "טיול לכלבים",
    modes: ["walk_30", "walk_60", "group_walk"],
    requiresProvider: true,
    hasPhysicalLocation: false,
    escrowHours: 24,
  },
  PET_TREK: {
    id: "pet_trek",
    name: "PetTrek™ Transport",
    nameHe: "הסעות חיות מחמד",
    modes: ["one_way", "round_trip", "airport"],
    requiresProvider: true,
    hasPhysicalLocation: false,
    escrowHours: 48,
  },
  ACADEMY: {
    id: "academy",
    name: "Pet Wash Academy™",
    nameHe: "אקדמיה לאילוף",
    modes: ["private_training", "group_training", "behavior_consult"],
    requiresProvider: true,
    hasPhysicalLocation: true,
    escrowHours: 24,
  },
  TALENT_MARKETPLACE: {
    id: "talent_marketplace",
    name: "Talent Marketplace",
    nameHe: "שוק כישרונות",
    modes: ["apply", "hire"],
    requiresProvider: false,
    hasPhysicalLocation: false,
    escrowHours: 0,
  },
} as const;

export type PlatformId = keyof typeof PLATFORMS;

// ============================================
// 2. BOOKING ENGINE
// ============================================

export type BookingStatus = 
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED";

export interface Booking {
  id: string;
  platformId: PlatformId;
  mode: string;
  customerId: string;
  providerId?: string;
  stationId?: string;
  
  // Scheduling
  scheduledStartAt: FirebaseFirestore.Timestamp;
  scheduledEndAt: FirebaseFirestore.Timestamp;
  actualStartAt?: FirebaseFirestore.Timestamp;
  actualEndAt?: FirebaseFirestore.Timestamp;
  
  // Location
  location?: {
    lat: number;
    lng: number;
    address: string;
    city: string;
  };
  pickupLocation?: { lat: number; lng: number; address: string };
  dropoffLocation?: { lat: number; lng: number; address: string };
  
  // Pets
  petIds: string[];
  petDetails: {
    id: string;
    name: string;
    species: "dog" | "cat" | "other";
    breed?: string;
    weight?: number;
    specialNeeds?: string;
  }[];
  
  // Pricing
  basePriceILS: number;
  surgePriceILS: number;
  discountILS: number;
  creditsAppliedILS: number;
  totalPriceILS: number;
  
  // Payment
  paymentStatus: "PENDING" | "AUTHORIZED" | "CAPTURED" | "REFUNDED";
  paymentTransactionId?: string;
  escrowReleaseAt?: FirebaseFirestore.Timestamp;
  
  // Status
  status: BookingStatus;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  cancelledAt?: FirebaseFirestore.Timestamp;
  cancelReason?: string;
  cancelledBy?: "CUSTOMER" | "PROVIDER" | "SYSTEM";
  
  // Reviews
  customerReviewId?: string;
  providerReviewId?: string;
  
  // Metadata
  referralCode?: string;
  loyaltyTierId?: string;
  source: "APP" | "WEB" | "KIOSK" | "PHONE";
}

export async function createBooking(data: Partial<Booking>): Promise<Booking> {
  const bookingRef = db.collection("bookings").doc();
  const now = admin.firestore.Timestamp.now();
  
  const booking: Booking = {
    id: bookingRef.id,
    platformId: data.platformId!,
    mode: data.mode!,
    customerId: data.customerId!,
    providerId: data.providerId,
    stationId: data.stationId,
    scheduledStartAt: data.scheduledStartAt!,
    scheduledEndAt: data.scheduledEndAt!,
    petIds: data.petIds || [],
    petDetails: data.petDetails || [],
    location: data.location,
    pickupLocation: data.pickupLocation,
    dropoffLocation: data.dropoffLocation,
    basePriceILS: data.basePriceILS || 0,
    surgePriceILS: data.surgePriceILS || 0,
    discountILS: data.discountILS || 0,
    creditsAppliedILS: data.creditsAppliedILS || 0,
    totalPriceILS: data.totalPriceILS || 0,
    paymentStatus: "PENDING",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    source: data.source || "APP",
    referralCode: data.referralCode,
    loyaltyTierId: data.loyaltyTierId,
  };
  
  await bookingRef.set(booking);
  
  // Emit event
  await emitEvent("BOOKING_CREATED", { bookingId: booking.id, platformId: booking.platformId });
  
  return booking;
}

export async function updateBookingStatus(
  bookingId: string, 
  status: BookingStatus,
  metadata?: Record<string, any>
): Promise<void> {
  const bookingRef = db.collection("bookings").doc(bookingId);
  const now = admin.firestore.Timestamp.now();
  
  const updateData: any = {
    status,
    updatedAt: now,
    ...metadata,
  };
  
  if (status === "IN_PROGRESS") {
    updateData.actualStartAt = now;
  } else if (status === "COMPLETED") {
    updateData.actualEndAt = now;
  }
  
  await bookingRef.update(updateData);
  
  await emitEvent(`BOOKING_${status}`, { bookingId, status });
}

// ============================================
// 3. AVAILABILITY ENGINE
// ============================================

export interface AvailabilitySlot {
  id: string;
  providerId?: string;
  stationId?: string;
  platformId: PlatformId;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAvailable: boolean;
  maxCapacity: number;
  currentBookings: number;
}

export async function getAvailableSlots(
  platformId: PlatformId,
  date: string,
  location?: { lat: number; lng: number; radiusKm: number }
): Promise<AvailabilitySlot[]> {
  let query = db.collection("availabilitySlots")
    .where("platformId", "==", platformId)
    .where("date", "==", date)
    .where("isAvailable", "==", true);
  
  const snap = await query.get();
  
  const slots: AvailabilitySlot[] = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AvailabilitySlot[];
  
  // Filter by location if provided (in production, use geohash)
  if (location) {
    // Simplified distance filter - use proper geo library in production
    return slots; // TODO: Implement geo filtering
  }
  
  return slots;
}

export async function blockSlot(slotId: string, bookingId: string): Promise<boolean> {
  const slotRef = db.collection("availabilitySlots").doc(slotId);
  
  return db.runTransaction(async (tx) => {
    const slotSnap = await tx.get(slotRef);
    if (!slotSnap.exists) return false;
    
    const slot = slotSnap.data() as AvailabilitySlot;
    
    if (slot.currentBookings >= slot.maxCapacity) {
      return false; // Slot full
    }
    
    tx.update(slotRef, {
      currentBookings: slot.currentBookings + 1,
      isAvailable: slot.currentBookings + 1 < slot.maxCapacity,
    });
    
    return true;
  });
}

// ============================================
// 4. PRICING ENGINE
// ============================================

export interface PricingResult {
  basePriceILS: number;
  surgePriceILS: number;
  discountILS: number;
  totalPriceILS: number;
  surgeMultiplier: number;
  breakdown: {
    label: string;
    amountILS: number;
  }[];
}

const BASE_PRICES: Record<string, number> = {
  // K9000 Packages
  "diy_station_basic": 55,
  "diy_station_standard": 165,
  "diy_station_premium": 275,
  "diy_station_vip": 550,
  
  // Pet Sitting
  "overnight_per_night": 150,
  "in_home_per_visit": 80,
  "daycare_per_day": 120,
  
  // Dog Walking
  "walk_30": 45,
  "walk_60": 75,
  "group_walk": 35,
  
  // Pet Transport
  "one_way_base": 80,
  "round_trip_base": 140,
  "airport_base": 200,
  "per_km": 4,
  
  // Academy
  "private_training": 250,
  "group_training": 120,
  "behavior_consult": 400,
};

export async function calculatePrice(
  platformId: PlatformId,
  mode: string,
  options: {
    durationMinutes?: number;
    distanceKm?: number;
    petCount?: number;
    date?: Date;
    time?: string;
    loyaltyTierId?: string;
    promoCode?: string;
  }
): Promise<PricingResult> {
  const priceKey = `${mode}`;
  let basePrice = BASE_PRICES[priceKey] || 55;
  
  // Adjust for multiple pets
  if (options.petCount && options.petCount > 1) {
    basePrice *= 1 + (options.petCount - 1) * 0.3; // +30% per additional pet
  }
  
  // Distance-based pricing for transport
  if (options.distanceKm && platformId === "PET_TREK") {
    basePrice += options.distanceKm * (BASE_PRICES["per_km"] || 4);
  }
  
  // Calculate surge
  const surgeMultiplier = await calculateSurge(platformId, options.date, options.time);
  const surgePrice = basePrice * (surgeMultiplier - 1);
  
  // Calculate discounts
  let discount = 0;
  if (options.promoCode) {
    discount = await applyPromoCode(options.promoCode, basePrice);
  }
  
  // Loyalty discount
  if (options.loyaltyTierId) {
    const loyaltyDiscount = getLoyaltyDiscount(options.loyaltyTierId);
    discount += basePrice * loyaltyDiscount;
  }
  
  const totalPrice = Math.max(0, basePrice + surgePrice - discount);
  
  return {
    basePriceILS: Math.round(basePrice),
    surgePriceILS: Math.round(surgePrice),
    discountILS: Math.round(discount),
    totalPriceILS: Math.round(totalPrice),
    surgeMultiplier,
    breakdown: [
      { label: "מחיר בסיס", amountILS: Math.round(basePrice) },
      ...(surgePrice > 0 ? [{ label: "תוספת שעות עמוסות", amountILS: Math.round(surgePrice) }] : []),
      ...(discount > 0 ? [{ label: "הנחה", amountILS: -Math.round(discount) }] : []),
    ],
  };
}

async function calculateSurge(
  platformId: PlatformId,
  date?: Date,
  time?: string
): Promise<number> {
  // Check demand vs supply
  const demandSnap = await db.collection("demandMetrics")
    .where("platformId", "==", platformId)
    .where("date", "==", date?.toISOString().split("T")[0])
    .limit(1)
    .get();
  
  if (demandSnap.empty) return 1.0;
  
  const demand = demandSnap.docs[0].data();
  const ratio = demand.bookings / demand.availableSlots;
  
  if (ratio > 0.9) return 1.5; // 50% surge
  if (ratio > 0.7) return 1.25; // 25% surge
  if (ratio > 0.5) return 1.1; // 10% surge
  
  return 1.0;
}

async function applyPromoCode(code: string, basePrice: number): Promise<number> {
  const promoSnap = await db.collection("promoCodes")
    .where("code", "==", code.toUpperCase())
    .where("isActive", "==", true)
    .limit(1)
    .get();
  
  if (promoSnap.empty) return 0;
  
  const promo = promoSnap.docs[0].data();
  
  if (promo.type === "PERCENTAGE") {
    return basePrice * (promo.value / 100);
  } else if (promo.type === "FIXED") {
    return Math.min(promo.value, basePrice);
  }
  
  return 0;
}

function getLoyaltyDiscount(tierId: string): number {
  const discounts: Record<string, number> = {
    "BRONZE": 0,
    "SILVER": 0.05,
    "GOLD": 0.10,
    "PLATINUM": 0.15,
    "DIAMOND": 0.20,
    "ELITE": 0.25,
    "LEGEND": 0.30,
  };
  
  return discounts[tierId] || 0;
}

// ============================================
// 5. DISPATCH & MATCHING ENGINE
// ============================================

export interface ProviderMatch {
  providerId: string;
  name: string;
  rating: number;
  completedBookings: number;
  distanceKm: number;
  estimatedArrivalMinutes: number;
  priceILS: number;
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
}

export async function findProviders(
  platformId: PlatformId,
  location: { lat: number; lng: number },
  scheduledAt: Date,
  petDetails: { species: string; weight?: number }[]
): Promise<ProviderMatch[]> {
  // Get active providers for this platform
  const providersSnap = await db.collection("providers")
    .where("platformIds", "array-contains", platformId)
    .where("status", "==", "ACTIVE")
    .where("isAvailable", "==", true)
    .limit(20)
    .get();
  
  const matches: ProviderMatch[] = [];
  
  for (const doc of providersSnap.docs) {
    const provider = doc.data();
    
    // Calculate distance (simplified - use proper geo library)
    const distanceKm = calculateDistance(
      location.lat, location.lng,
      provider.location.lat, provider.location.lng
    );
    
    // Skip if too far
    if (distanceKm > 25) continue;
    
    // Check if provider accepts these pets
    if (petDetails.some(pet => 
      provider.excludedSpecies?.includes(pet.species) ||
      (pet.weight && provider.maxPetWeight && pet.weight > provider.maxPetWeight)
    )) continue;
    
    matches.push({
      providerId: doc.id,
      name: provider.displayName,
      rating: provider.averageRating || 5.0,
      completedBookings: provider.completedBookings || 0,
      distanceKm: Math.round(distanceKm * 10) / 10,
      estimatedArrivalMinutes: Math.round(distanceKm * 3), // ~3 min per km
      priceILS: provider.basePrice || BASE_PRICES[platformId] || 100,
      availability: "AVAILABLE",
    });
  }
  
  // Sort by rating and distance
  return matches.sort((a, b) => {
    const scoreA = a.rating * 10 - a.distanceKm;
    const scoreB = b.rating * 10 - b.distanceKm;
    return scoreB - scoreA;
  });
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================
// 6. ESCROW & PAYOUTS
// ============================================

export interface Payout {
  id: string;
  providerId: string;
  bookingId: string;
  grossAmountILS: number;
  platformFeeILS: number;
  vatILS: number;
  netAmountILS: number;
  status: "PENDING" | "RELEASED" | "PAID" | "FAILED";
  escrowReleaseAt: FirebaseFirestore.Timestamp;
  paidAt?: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

const PLATFORM_FEE_PERCENT = 15; // 15% platform fee
const VAT_PERCENT = 17; // 17% Israeli VAT

export async function createEscrowPayout(
  bookingId: string,
  providerId: string,
  grossAmountILS: number,
  escrowHours: number
): Promise<Payout> {
  const payoutRef = db.collection("payouts").doc();
  const now = admin.firestore.Timestamp.now();
  
  const platformFee = grossAmountILS * (PLATFORM_FEE_PERCENT / 100);
  const netBeforeVat = grossAmountILS - platformFee;
  const vat = netBeforeVat * (VAT_PERCENT / 100);
  const netAmount = netBeforeVat - vat;
  
  const escrowReleaseAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + escrowHours * 60 * 60 * 1000
  );
  
  const payout: Payout = {
    id: payoutRef.id,
    providerId,
    bookingId,
    grossAmountILS,
    platformFeeILS: Math.round(platformFee * 100) / 100,
    vatILS: Math.round(vat * 100) / 100,
    netAmountILS: Math.round(netAmount * 100) / 100,
    status: "PENDING",
    escrowReleaseAt,
    createdAt: now,
  };
  
  await payoutRef.set(payout);
  
  return payout;
}

export async function releaseEscrow(payoutId: string): Promise<void> {
  const payoutRef = db.collection("payouts").doc(payoutId);
  
  await payoutRef.update({
    status: "RELEASED",
  });
  
  await emitEvent("PAYOUT_RELEASED", { payoutId });
}

// ============================================
// 7. COMPLIANCE & KYC
// ============================================

export interface KYCRecord {
  id: string;
  userId: string;
  type: "PROVIDER" | "CUSTOMER" | "CONTRACTOR";
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  documents: {
    type: "ID_CARD" | "PASSPORT" | "DRIVING_LICENSE" | "BUSINESS_LICENSE" | "INSURANCE";
    url: string;
    uploadedAt: FirebaseFirestore.Timestamp;
    verifiedAt?: FirebaseFirestore.Timestamp;
    expiresAt?: FirebaseFirestore.Timestamp;
  }[];
  verifiedAt?: FirebaseFirestore.Timestamp;
  rejectionReason?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export async function checkKYCStatus(userId: string): Promise<{
  isCompliant: boolean;
  missingDocuments: string[];
  expiringDocuments: { type: string; expiresAt: Date }[];
}> {
  const kycSnap = await db.collection("kycRecords")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  
  if (kycSnap.empty) {
    return {
      isCompliant: false,
      missingDocuments: ["ID_CARD", "BUSINESS_LICENSE", "INSURANCE"],
      expiringDocuments: [],
    };
  }
  
  const kyc = kycSnap.docs[0].data() as KYCRecord;
  const requiredDocs = ["ID_CARD", "BUSINESS_LICENSE", "INSURANCE"];
  const uploadedTypes = kyc.documents.map(d => d.type);
  const missingDocuments = requiredDocs.filter(t => !uploadedTypes.includes(t as any));
  
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringDocuments = kyc.documents
    .filter(d => d.expiresAt && d.expiresAt.toDate() < thirtyDaysFromNow)
    .map(d => ({ type: d.type, expiresAt: d.expiresAt!.toDate() }));
  
  return {
    isCompliant: kyc.status === "VERIFIED" && missingDocuments.length === 0,
    missingDocuments,
    expiringDocuments,
  };
}

// ============================================
// 8. FRAUD DETECTION
// ============================================

export interface FraudSignal {
  id: string;
  userId: string;
  signalType: 
    | "MULTIPLE_ACCOUNTS_SAME_DEVICE"
    | "SUSPICIOUS_PAYMENT_PATTERN"
    | "FAKE_REVIEW"
    | "LOCATION_MISMATCH"
    | "VELOCITY_ABUSE"
    | "REFERRAL_FRAUD";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: Record<string, any>;
  createdAt: FirebaseFirestore.Timestamp;
  resolvedAt?: FirebaseFirestore.Timestamp;
  resolution?: string;
}

export async function checkFraudSignals(userId: string): Promise<{
  hasActiveSignals: boolean;
  signals: FraudSignal[];
  riskScore: number;
}> {
  const signalsSnap = await db.collection("fraudSignals")
    .where("userId", "==", userId)
    .where("resolvedAt", "==", null)
    .get();
  
  const signals: FraudSignal[] = signalsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FraudSignal[];
  
  // Calculate risk score
  const severityScores = { LOW: 10, MEDIUM: 25, HIGH: 50, CRITICAL: 100 };
  const riskScore = signals.reduce((sum, s) => sum + severityScores[s.severity], 0);
  
  return {
    hasActiveSignals: signals.length > 0,
    signals,
    riskScore: Math.min(100, riskScore),
  };
}

export async function reportFraudSignal(
  userId: string,
  signalType: FraudSignal["signalType"],
  severity: FraudSignal["severity"],
  details: Record<string, any>
): Promise<void> {
  const signalRef = db.collection("fraudSignals").doc();
  
  await signalRef.set({
    id: signalRef.id,
    userId,
    signalType,
    severity,
    details,
    createdAt: admin.firestore.Timestamp.now(),
    resolvedAt: null,
  });
  
  // Alert if critical
  if (severity === "CRITICAL") {
    await emitEvent("FRAUD_ALERT_CRITICAL", { userId, signalType });
  }
}

// ============================================
// 9. NOTIFICATIONS HUB
// ============================================

export type NotificationChannel = "PUSH" | "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";

export interface NotificationTemplate {
  id: string;
  eventType: string;
  channels: NotificationChannel[];
  titleHe: string;
  titleEn: string;
  bodyHe: string;
  bodyEn: string;
  data?: Record<string, string>;
}

export async function sendNotification(
  userId: string,
  templateId: string,
  variables: Record<string, string>,
  preferredChannels?: NotificationChannel[]
): Promise<void> {
  // Get template
  const templateSnap = await db.collection("notificationTemplates").doc(templateId).get();
  if (!templateSnap.exists) return;
  
  const template = templateSnap.data() as NotificationTemplate;
  
  // Get user preferences
  const userSnap = await db.collection("users").doc(userId).get();
  const user = userSnap.data();
  const language = user?.preferredLanguage || "he";
  
  const title = language === "he" ? template.titleHe : template.titleEn;
  const body = language === "he" ? template.bodyHe : template.bodyEn;
  
  // Replace variables
  let finalTitle = title;
  let finalBody = body;
  for (const [key, value] of Object.entries(variables)) {
    finalTitle = finalTitle.replace(`{{${key}}}`, value);
    finalBody = finalBody.replace(`{{${key}}}`, value);
  }
  
  // Send to each channel
  const channels = preferredChannels || template.channels;
  
  for (const channel of channels) {
    await db.collection("notificationQueue").add({
      userId,
      channel,
      title: finalTitle,
      body: finalBody,
      data: { ...template.data, ...variables },
      status: "PENDING",
      createdAt: admin.firestore.Timestamp.now(),
    });
  }
}

// ============================================
// 10. ANALYTICS EVENTS
// ============================================

export async function emitEvent(
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  await db.collection("analyticsEvents").add({
    eventType,
    data,
    timestamp: admin.firestore.Timestamp.now(),
    environment: process.env.NODE_ENV || "development",
  });
}

// Pre-defined event types for consistency
export const EVENT_TYPES = {
  // Booking events
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_STARTED: "BOOKING_STARTED",
  BOOKING_COMPLETED: "BOOKING_COMPLETED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  
  // Payment events
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  
  // Payout events
  PAYOUT_CREATED: "PAYOUT_CREATED",
  PAYOUT_RELEASED: "PAYOUT_RELEASED",
  PAYOUT_PAID: "PAYOUT_PAID",
  
  // User events
  USER_SIGNUP: "USER_SIGNUP",
  USER_LOGIN: "USER_LOGIN",
  PROVIDER_APPROVED: "PROVIDER_APPROVED",
  KYC_VERIFIED: "KYC_VERIFIED",
  
  // Referral events
  REFERRAL_LINK_SHARED: "REFERRAL_LINK_SHARED",
  REFERRAL_SIGNUP: "REFERRAL_SIGNUP",
  REFERRAL_COMPLETED: "REFERRAL_COMPLETED",
  
  // Fraud events
  FRAUD_DETECTED: "FRAUD_DETECTED",
  FRAUD_ALERT_CRITICAL: "FRAUD_ALERT_CRITICAL",
  
  // IoT events
  STATION_ACTIVATED: "STATION_ACTIVATED",
  STATION_ERROR: "STATION_ERROR",
  CONSUMABLE_LOW: "CONSUMABLE_LOW",
} as const;

// ============================================
// EXPORTS
// ============================================

export default {
  PLATFORMS,
  createBooking,
  updateBookingStatus,
  getAvailableSlots,
  blockSlot,
  calculatePrice,
  findProviders,
  createEscrowPayout,
  releaseEscrow,
  checkKYCStatus,
  checkFraudSignals,
  reportFraudSignal,
  sendNotification,
  emitEvent,
  EVENT_TYPES,
};
