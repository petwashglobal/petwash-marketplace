import { db } from "../db";
import { bookings, bookingItems, domainEvents, superAppPayments, superAppPayouts, providers } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import type { PlatformConfig } from "../middleware/platformContext";

export const BOOKING_STATUS = {
  DRAFT: "draft",
  QUOTED: "quoted",
  MEET_GREET_REQUESTED: "meet_greet_requested",
  MEET_GREET_SCHEDULED: "meet_greet_scheduled",
  MEET_GREET_COMPLETED: "meet_greet_completed",
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DISPUTED: "disputed",
  REFUNDED: "refunded",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const PAYMENT_STATUS = {
  PENDING: "pending",
  AUTHORIZED: "authorized",
  IN_ESCROW: "in_escrow",
  RELEASED: "released",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export interface BookingCreateInput {
  platformId: string;
  userId: string;
  providerId?: number;
  stationId?: number;
  pickupLocationId?: number;
  dropoffLocationId?: number;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  serviceType?: string;
  serviceDescription?: string;
  specialRequests?: string;
  petIds?: number[];
  items?: Array<{
    itemType: string;
    name: string;
    nameHe?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface BookingQuote {
  subtotal: number;
  platformFee: number;
  providerPayout: number;
  discount: number;
  total: number;
  currency: string;
  breakdown: Array<{ label: string; labelHe?: string; amount: number }>;
  escrowReleaseDate?: Date;
}

export interface StatusTransition {
  from: BookingStatus;
  to: BookingStatus;
  allowedRoles: Array<"user" | "provider" | "admin" | "system">;
  requiresPayment?: boolean;
  requiresMeetGreet?: boolean;
}

const STATUS_TRANSITIONS: StatusTransition[] = [
  { from: BOOKING_STATUS.DRAFT, to: BOOKING_STATUS.QUOTED, allowedRoles: ["system", "provider"] },
  { from: BOOKING_STATUS.QUOTED, to: BOOKING_STATUS.MEET_GREET_REQUESTED, allowedRoles: ["user"], requiresMeetGreet: true },
  { from: BOOKING_STATUS.QUOTED, to: BOOKING_STATUS.PENDING_PAYMENT, allowedRoles: ["user"] },
  { from: BOOKING_STATUS.MEET_GREET_REQUESTED, to: BOOKING_STATUS.MEET_GREET_SCHEDULED, allowedRoles: ["provider", "admin"] },
  { from: BOOKING_STATUS.MEET_GREET_SCHEDULED, to: BOOKING_STATUS.MEET_GREET_COMPLETED, allowedRoles: ["provider", "user", "admin"] },
  { from: BOOKING_STATUS.MEET_GREET_COMPLETED, to: BOOKING_STATUS.PENDING_PAYMENT, allowedRoles: ["user"] },
  { from: BOOKING_STATUS.MEET_GREET_COMPLETED, to: BOOKING_STATUS.CANCELLED, allowedRoles: ["user", "provider"] },
  { from: BOOKING_STATUS.PENDING_PAYMENT, to: BOOKING_STATUS.CONFIRMED, allowedRoles: ["system"], requiresPayment: true },
  { from: BOOKING_STATUS.CONFIRMED, to: BOOKING_STATUS.IN_PROGRESS, allowedRoles: ["provider", "system"] },
  { from: BOOKING_STATUS.IN_PROGRESS, to: BOOKING_STATUS.COMPLETED, allowedRoles: ["provider", "system"] },
  { from: BOOKING_STATUS.CONFIRMED, to: BOOKING_STATUS.CANCELLED, allowedRoles: ["user", "provider", "admin"] },
  { from: BOOKING_STATUS.COMPLETED, to: BOOKING_STATUS.DISPUTED, allowedRoles: ["user"] },
  { from: BOOKING_STATUS.DISPUTED, to: BOOKING_STATUS.REFUNDED, allowedRoles: ["admin"] },
  { from: BOOKING_STATUS.DISPUTED, to: BOOKING_STATUS.COMPLETED, allowedRoles: ["admin"] },
  { from: BOOKING_STATUS.CANCELLED, to: BOOKING_STATUS.REFUNDED, allowedRoles: ["admin", "system"] },
];

export class EnhancedBookingService {
  private static instance: EnhancedBookingService;

  private constructor() {}

  static getInstance(): EnhancedBookingService {
    if (!EnhancedBookingService.instance) {
      EnhancedBookingService.instance = new EnhancedBookingService();
    }
    return EnhancedBookingService.instance;
  }

  async createBooking(input: BookingCreateInput, platform: PlatformConfig): Promise<typeof bookings.$inferSelect> {
    if (isNaN(input.startTime.getTime()) || isNaN(input.endTime.getTime())) {
      throw new Error("Invalid date format for startTime or endTime");
    }

    if (input.endTime <= input.startTime) {
      throw new Error("endTime must be after startTime");
    }

    if (input.providerId) {
      const [provider] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);
      
      if (!provider) {
        throw new Error("Provider not found");
      }
      
      if (provider.platformId && provider.platformId !== input.platformId) {
        throw new Error("Provider does not belong to this platform");
      }
    }

    const bookingNumber = this.generateBookingNumber(input.platformId);
    
    const subtotal = input.items?.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) || 0;
    const platformFeePercent = platform.platformFeePercent / 100;
    const platformFee = Math.round(subtotal * platformFeePercent * 100) / 100;
    const providerPayout = subtotal - platformFee;

    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingNumber,
          platformId: input.platformId,
          userId: input.userId,
          providerId: input.providerId,
          stationId: input.stationId,
          pickupLocationId: input.pickupLocationId,
          dropoffLocationId: input.dropoffLocationId,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone || "Asia/Jerusalem",
          status: BOOKING_STATUS.DRAFT,
          paymentStatus: PAYMENT_STATUS.PENDING,
          subtotal: subtotal.toString(),
          platformFee: platformFee.toString(),
          providerPayout: providerPayout.toString(),
          total: subtotal.toString(),
          currency: "ILS",
          serviceType: input.serviceType,
          serviceDescription: input.serviceDescription,
          specialRequests: input.specialRequests,
          platformData: {
            requiresMeetGreet: platform.features.includes("meet_greet"),
            escrowEnabled: platform.features.includes("escrow"),
          },
        })
        .returning();

      if (input.items?.length) {
        await tx.insert(bookingItems).values(
          input.items.map((item) => ({
            bookingId: booking.id,
            itemType: item.itemType,
            name: item.name,
            nameHe: item.nameHe,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: (item.quantity * item.unitPrice).toString(),
          }))
        );
      }

      const eventId = crypto.randomUUID();
      await tx.insert(domainEvents).values({
        eventId,
        eventType: "booking.created",
        aggregateType: "booking",
        aggregateId: booking.id,
        payload: {
          platformId: input.platformId,
          userId: input.userId,
          providerId: input.providerId,
          total: subtotal,
        },
        occurredAt: sql`NOW()`,
      });

      return booking;
    });
  }

  async getQuote(bookingId: string, platform: PlatformConfig): Promise<BookingQuote | null> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return null;

    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice || "0"), 0);
    const platformFeePercent = platform.platformFeePercent / 100;
    const platformFee = Math.round(subtotal * platformFeePercent * 100) / 100;
    const providerPayout = subtotal - platformFee;

    const escrowReleaseDate = platform.features.includes("escrow")
      ? new Date(booking.endTime.getTime() + 72 * 60 * 60 * 1000)
      : undefined;

    const breakdown = [
      { label: "Subtotal", labelHe: "סכום ביניים", amount: subtotal },
      { label: `Platform Fee (${platform.platformFeePercent}%)`, labelHe: `עמלת פלטפורמה (${platform.platformFeePercent}%)`, amount: platformFee },
    ];

    if (escrowReleaseDate) {
      breakdown.push({
        label: "Escrow Hold (72h)",
        labelHe: "החזקה בנאמנות (72 שעות)",
        amount: 0,
      });
    }

    return {
      subtotal,
      platformFee,
      providerPayout,
      discount: 0,
      total: subtotal,
      currency: "ILS",
      breakdown,
      escrowReleaseDate,
    };
  }

  async transitionStatus(
    bookingId: string,
    newStatus: BookingStatus,
    actorRole: "user" | "provider" | "admin" | "system",
    actorUserId?: string,
    metadata?: Record<string, unknown>,
    requiredPlatformId?: string
  ): Promise<{ success: boolean; error?: string; booking?: typeof bookings.$inferSelect }> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (requiredPlatformId && booking.platformId !== requiredPlatformId) {
      return { success: false, error: "Booking belongs to another platform" };
    }

    const currentStatus = booking.status as BookingStatus;
    const transition = STATUS_TRANSITIONS.find(
      (t) => t.from === currentStatus && t.to === newStatus && t.allowedRoles.includes(actorRole)
    );

    if (!transition) {
      return {
        success: false,
        error: `Cannot transition from '${currentStatus}' to '${newStatus}' as '${actorRole}'`,
      };
    }

    if (transition.requiresPayment && booking.paymentStatus !== PAYMENT_STATUS.IN_ESCROW) {
      return { success: false, error: "Payment required before confirmation" };
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: sql`NOW()`,
    };

    if (newStatus === BOOKING_STATUS.CONFIRMED) {
      updateData.confirmedAt = sql`NOW()`;
    } else if (newStatus === BOOKING_STATUS.IN_PROGRESS) {
      updateData.startedAt = sql`NOW()`;
    } else if (newStatus === BOOKING_STATUS.COMPLETED) {
      updateData.completedAt = sql`NOW()`;
    } else if (newStatus === BOOKING_STATUS.CANCELLED) {
      updateData.cancelledAt = sql`NOW()`;
      updateData.cancelledBy = actorUserId;
      if (metadata?.reason) {
        updateData.cancellationReason = metadata.reason;
      }
    }

    const [updated] = await db
      .update(bookings)
      .set(updateData as any)
      .where(eq(bookings.id, bookingId))
      .returning();

    await this.logEvent("booking.status_changed", "booking", bookingId, {
      from: currentStatus,
      to: newStatus,
      actorRole,
      actorUserId,
      metadata,
    });

    if (newStatus === BOOKING_STATUS.COMPLETED && booking.providerId) {
      await this.scheduleEscrowRelease(booking);
    }

    return { success: true, booking: updated };
  }

  async processPayment(
    bookingId: string,
    paymentMethod: string,
    gateway: string = "nayax",
    requiredPlatformId?: string
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (requiredPlatformId && booking.platformId !== requiredPlatformId) {
      return { success: false, error: "Booking belongs to another platform" };
    }

    const paymentId = `pay_${crypto.randomBytes(12).toString("hex")}`;

    await db.insert(superAppPayments).values({
      bookingId,
      userId: booking.userId,
      gateway,
      amount: booking.total,
      currency: booking.currency || "ILS",
      status: "pending",
      paymentMethod,
      metadata: {
        platformId: booking.platformId,
        bookingNumber: booking.bookingNumber,
      },
    });

    await db
      .update(bookings)
      .set({
        paymentStatus: PAYMENT_STATUS.IN_ESCROW,
        paymentMethod,
        updatedAt: sql`NOW()`,
      })
      .where(eq(bookings.id, bookingId));

    await this.logEvent("booking.payment_processed", "booking", bookingId, {
      paymentId,
      amount: booking.total,
      gateway,
    });

    return { success: true, paymentId };
  }

  private async scheduleEscrowRelease(booking: typeof bookings.$inferSelect) {
    if (!booking.providerId) return;

    const escrowReleaseDate = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await db.insert(superAppPayouts).values({
      providerId: booking.providerId,
      bookingId: booking.id,
      amount: booking.total,
      platformFee: booking.platformFee || "0",
      netAmount: booking.providerPayout || booking.total,
      currency: booking.currency || "ILS",
      status: "in_escrow",
      escrowReleaseDate,
    });

    await this.logEvent("escrow.scheduled", "booking", booking.id, {
      providerId: booking.providerId,
      releaseDate: escrowReleaseDate.toISOString(),
      amount: booking.providerPayout,
    });
  }

  async getBookingWithDetails(bookingId: string, requiredPlatformId?: string) {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return null;

    if (requiredPlatformId && booking.platformId !== requiredPlatformId) {
      return null;
    }

    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    let provider = null;
    if (booking.providerId) {
      const [p] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, booking.providerId))
        .limit(1);
      provider = p;
    }

    return {
      ...booking,
      items,
      provider,
    };
  }

  async getUserBookings(userId: string, platformId: string, status?: BookingStatus) {
    const conditions = [eq(bookings.userId, userId), eq(bookings.platformId, platformId)];
    
    if (status) {
      conditions.push(eq(bookings.status, status));
    }

    return await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.createdAt));
  }

  async getProviderBookings(providerId: number, status?: BookingStatus, platformId?: string) {
    const conditions = [eq(bookings.providerId, providerId)];
    
    if (platformId) {
      conditions.push(eq(bookings.platformId, platformId));
    }
    
    if (status) {
      conditions.push(eq(bookings.status, status));
    }

    return await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.startTime));
  }

  private generateBookingNumber(platformId: string): string {
    const prefix = platformId.substring(0, 2).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private async logEvent(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>
  ) {
    const eventId = crypto.randomUUID();
    await db.insert(domainEvents).values({
      eventId,
      eventType,
      aggregateType,
      aggregateId,
      payload,
      occurredAt: sql`NOW()`,
    });
  }
}

export const enhancedBookingService = EnhancedBookingService.getInstance();
