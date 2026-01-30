/**
 * PETWASH UNIFIED BOOKING SYSTEM - DOMAIN TYPES
 * Based on reference implementation (2025)
 * 
 * GUARANTEES:
 * - Every wash, paid or free, has a Booking
 * - Every Booking has exactly one primary Transaction
 * - Transactions are immutable
 * - Admin actions are logged as Events
 * - Human and Machine are both Resources
 */

export type Role =
  | "PUBLIC"
  | "USER"
  | "PROVIDER"
  | "EMPLOYEE"
  | "ADMIN"
  | "SUPER_ADMIN";

export type ResourceType = "HUMAN" | "MACHINE";

export type PricingType = "HOURLY" | "SESSION" | "MINUTES" | "DISTANCE" | "FIXED";

export type UnifiedBookingStatus =
  | "DRAFT"
  | "QUOTED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type TransactionType =
  | "PAID"
  | "COMPLIMENTARY"
  | "PROMO"
  | "ADMIN"
  | "REFUND"
  | "PARTIAL_REFUND";

export type Currency = "ILS" | "USD" | "EUR" | "GBP" | "AUD" | "CAD";

export interface PricingSnapshot {
  gross: number;
  vat: number;
  net: number;
  currency: Currency;
  vatRate: number;
  breakdown: Record<string, number>;
  loyaltyDiscount?: number;
  promoDiscount?: number;
  platformFee?: number;
  providerPayout?: number;
}

export interface UnifiedBooking {
  id: string;
  bookingNumber: string;
  platform: string;
  serviceId: string;
  resourceId: string;
  resourceType: ResourceType;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: UnifiedBookingStatus;
  priceSnapshot: PricingSnapshot;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnifiedTransaction {
  id: string;
  bookingId: string;
  type: TransactionType;
  gross: number;
  vat: number;
  net: number;
  currency: Currency;
  provider: string;
  providerRef?: string;
  stampedAt: Date;
  stampedBy: string;
  isImmutable: true;
}

export interface EventLog {
  id: string;
  actorId: string;
  actorRole: Role;
  bookingId?: string;
  transactionId?: string;
  action: string;
  description?: string;
  meta?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface ServiceConfig {
  id: string;
  serviceType: string;
  pricingType: PricingType;
  basePrice: number;
  currency: Currency;
  vatRate: number;
  rules: {
    maxMinutes?: number;
    maxHours?: number;
    maxDays?: number;
    requiresProvider?: boolean;
    requiresStation?: boolean;
    allowAdminFreeRun?: boolean;
    [key: string]: any;
  };
}

export const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  K9000_WASH: {
    id: "K9000_WASH",
    serviceType: "self_service_wash",
    pricingType: "MINUTES",
    basePrice: 35,
    currency: "ILS",
    vatRate: 0.17,
    rules: {
      requiresStation: true,
      allowAdminFreeRun: true,
      maxMinutes: 30
    }
  },
  PET_ACADEMY: {
    id: "PET_ACADEMY",
    serviceType: "academy_session",
    pricingType: "SESSION",
    basePrice: 200,
    currency: "ILS",
    vatRate: 0.17,
    rules: {
      requiresProvider: true
    }
  },
  PET_SITTER: {
    id: "PET_SITTER",
    serviceType: "pet_sitting",
    pricingType: "HOURLY",
    basePrice: 50,
    currency: "ILS",
    vatRate: 0.17,
    rules: {
      requiresProvider: true,
      maxHours: 168
    }
  },
  PET_WALK: {
    id: "PET_WALK",
    serviceType: "pet_walking",
    pricingType: "HOURLY",
    basePrice: 40,
    currency: "ILS",
    vatRate: 0.17,
    rules: {
      requiresProvider: true,
      maxHours: 4
    }
  },
  PET_TREK: {
    id: "PET_TREK",
    serviceType: "pet_transport",
    pricingType: "DISTANCE",
    basePrice: 15,
    currency: "ILS",
    vatRate: 0.17,
    rules: {
      requiresProvider: true,
      maxHours: 12
    }
  }
};

export interface CreateBookingParams {
  serviceId: string;
  resourceId: string;
  resourceType: ResourceType;
  userId: string;
  startTime: Date;
  endTime: Date;
  metadata?: Record<string, any>;
}

export interface QuoteParams {
  booking: UnifiedBooking;
  price: number;
  breakdown?: Record<string, number>;
  loyaltyDiscount?: number;
  promoCode?: string;
}

export interface ConfirmParams {
  booking: UnifiedBooking;
  paymentProvider: string;
  paymentReference?: string;
  confirmedBy: string;
}

export interface AdminFreeWashParams {
  adminId: string;
  machineId: string;
  bay?: string;
  startTime: Date;
  minutes: number;
  reason?: string;
}
