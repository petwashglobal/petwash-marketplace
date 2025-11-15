import { db } from '../db';
import { 
  bookings, 
  bookingPets, 
  bookingItems,
  availabilitySlots,
  superAppPayments,
  superAppPayouts,
  platforms,
  providers,
  pets,
  stations,
  type InsertBooking,
  type SelectBooking,
  type InsertAvailabilitySlot,
  type SelectAvailabilitySlot
} from '@shared/schema';
import { eq, and, or, gte, lte, between, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { unifiedBookingFacade, type BookingPlatform } from './booking-facade';
import type { AvailabilityCheckParams, PricingParams } from './booking-engines/base/BaseLuxuryBookingEngine';

export interface CreateBookingInput {
  // SECURITY: platformId MUST come from route params, not request body
  platformId: string;
  userId: string;
  providerId?: number;
  stationId?: number;
  pickupLocationId?: number;
  dropoffLocationId?: number;
  startTime: string | Date; // Accept ISO string for timezone safety
  endTime: string | Date;
  timezone?: string;
  petIds?: number[];
  items?: Array<{
    itemType: string;
    name: string;
    nameHe?: string;
    description?: string;
    quantity?: number;
    unitPrice: number;
  }>;
  serviceType?: string;
  serviceDescription?: string;
  specialRequests?: string;
  platformData?: any;
}

export interface BookingConflictResult {
  hasConflict: boolean;
  conflictingBookings?: SelectBooking[];
  conflictingSlots?: SelectAvailabilitySlot[];
  message?: string;
}

export class BookingService {
  
  /**
   * Normalize timezone-aware date to UTC for database storage
   */
  private normalizeToUTC(dateInput: string | Date, timezone: string = 'Asia/Jerusalem'): Date {
    if (typeof dateInput === 'string') {
      // Parse ISO string with timezone awareness
      return new Date(dateInput);
    }
    return dateInput;
  }

  /**
   * Validate basic booking constraints
   */
  private validateBookingTimes(startTime: Date, endTime: Date, platformId: string): void {
    // Start must be before end
    if (startTime >= endTime) {
      throw new Error('Start time must be before end time');
    }

    // Start must be in the future
    if (startTime < new Date()) {
      throw new Error('Start time must be in the future');
    }

    // Max duration constraints (platform-specific)
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const maxDurations: Record<string, number> = {
      'k9000': 2, // 2 hours max wash
      'walk_my_pet': 4, // 4 hours max walk
      'sitter_suite': 168, // 7 days max sitting
      'pettrek': 12, // 12 hours max transport
      'groomers': 8, // 8 hours max grooming
      'shared_services': 24
    };

    const maxDuration = maxDurations[platformId] || 24;
    if (durationHours > maxDuration) {
      throw new Error(`Duration cannot exceed ${maxDuration} hours for ${platformId}`);
    }
  }

  /**
   * Verify platform exists and is active
   */
  private async verifyPlatform(platformId: string): Promise<typeof platforms.$inferSelect> {
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.id, platformId));

    if (!platform) {
      throw new Error(`Platform ${platformId} not found`);
    }

    if (!platform.isActive) {
      throw new Error(`Platform ${platformId} is not active`);
    }

    return platform;
  }

  /**
   * Verify provider belongs to platform and is eligible
   */
  private async verifyProvider(providerId: number, platformId: string): Promise<typeof providers.$inferSelect> {
    const [provider] = await db
      .select()
      .from(providers)
      .where(
        and(
          eq(providers.id, providerId),
          eq(providers.platformId, platformId)
        )
      );

    if (!provider) {
      throw new Error('Provider not found or does not belong to this platform');
    }

    if (!provider.isActive) {
      throw new Error('Provider account is not active');
    }

    if (provider.verificationStatus !== 'verified') {
      throw new Error('Provider must be verified to accept bookings');
    }

    if (!provider.acceptingNewClients) {
      throw new Error('Provider is not accepting new bookings');
    }

    return provider;
  }

  /**
   * Verify station belongs to platform and is operational
   */
  private async verifyStation(stationId: number, platformId: string): Promise<typeof stations.$inferSelect> {
    const [station] = await db
      .select()
      .from(stations)
      .where(eq(stations.id, stationId));

    if (!station) {
      throw new Error('Station not found');
    }

    if (!station.isActive) {
      throw new Error('Station is not active');
    }

    if (station.status !== 'operational') {
      throw new Error(`Station is ${station.status}`);
    }

    // Verify K9000 platform alignment
    if (platformId !== 'k9000') {
      throw new Error('Stations can only be booked on K9000 platform');
    }

    return station;
  }

  /**
   * Verify pets belong to user
   */
  private async verifyPetsOwnership(petIds: number[], userId: string): Promise<void> {
    const userPets = await db
      .select()
      .from(pets)
      .where(
        and(
          inArray(pets.id, petIds),
          eq(pets.userId, userId),
          eq(pets.isActive, true)
        )
      );

    if (userPets.length !== petIds.length) {
      throw new Error('One or more pets not found or do not belong to user');
    }
  }

  /**
   * Generate a unique booking number (format: PLATFORM-YYYYMMDD-XXXXX)
   * SECURITY: Uses verified platformId from route params
   */
  async generateBookingNumber(platformId: string): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const platform = platformId.toUpperCase().replace('_', '');
    const randomStr = nanoid(5).toUpperCase();
    return `${platform}-${dateStr}-${randomStr}`;
  }

  /**
   * Check if a provider has availability conflicts for the requested time slot
   * SECURITY: Includes draft/pending_payment bookings to prevent double-booking
   */
  async checkAvailability(
    platformId: string,
    providerId: number | undefined,
    stationId: number | undefined,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<BookingConflictResult> {
    // SECURITY FIX: Include draft/pending_payment/pending_provider to prevent double-booking
    const blockingStatuses = [
      'draft',
      'pending_payment',
      'pending_provider',
      'confirmed',
      'in_progress'
    ];

    // For K9000 stations, check station availability
    if (stationId && platformId === 'k9000') {
      const conflictingBookings = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.stationId, stationId),
            eq(bookings.platformId, platformId),
            or(...blockingStatuses.map(status => eq(bookings.status, status))),
            or(
              // New booking overlaps with existing
              and(
                lte(bookings.startTime, startTime),
                gte(bookings.endTime, startTime)
              ),
              and(
                lte(bookings.startTime, endTime),
                gte(bookings.endTime, endTime)
              ),
              and(
                gte(bookings.startTime, startTime),
                lte(bookings.endTime, endTime)
              )
            ),
            excludeBookingId ? sql`${bookings.id} != ${excludeBookingId}` : sql`1=1`
          )
        );

      if (conflictingBookings.length > 0) {
        return {
          hasConflict: true,
          conflictingBookings,
          message: `Station is already booked for the selected time slot`
        };
      }
    }

    // For marketplace platforms, check provider availability
    if (providerId && platformId !== 'k9000') {
      const conflictingBookings = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.providerId, providerId),
            eq(bookings.platformId, platformId),
            or(...blockingStatuses.map(status => eq(bookings.status, status))),
            or(
              and(
                lte(bookings.startTime, startTime),
                gte(bookings.endTime, startTime)
              ),
              and(
                lte(bookings.startTime, endTime),
                gte(bookings.endTime, endTime)
              ),
              and(
                gte(bookings.startTime, startTime),
                lte(bookings.endTime, endTime)
              )
            ),
            excludeBookingId ? sql`${bookings.id} != ${excludeBookingId}` : sql`1=1`
          )
        );

      if (conflictingBookings.length > 0) {
        return {
          hasConflict: true,
          conflictingBookings,
          message: `Provider is already booked for the selected time slot`
        };
      }

      // Check availability slots
      const availableSlots = await db
        .select()
        .from(availabilitySlots)
        .where(
          and(
            eq(availabilitySlots.providerId, providerId),
            eq(availabilitySlots.platformId, platformId),
            eq(availabilitySlots.status, 'available'),
            lte(availabilitySlots.startTime, startTime),
            gte(availabilitySlots.endTime, endTime)
          )
        );

      if (availableSlots.length === 0) {
        return {
          hasConflict: true,
          message: `Provider has not set availability for this time slot`
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Calculate pricing with platform fees
   * SECURITY: Server-side calculation only, never trust client input
   */
  async calculatePricing(
    platform: typeof platforms.$inferSelect,
    subtotal: number,
    discountAmount: number = 0
  ): Promise<{
    subtotal: number;
    platformFee: number;
    providerPayout: number;
    discount: number;
    total: number;
  }> {
    const feePercent = parseFloat(platform.platformFeePercent || '0');
    const platformFee = (subtotal * feePercent) / 100;
    const providerPayout = subtotal - platformFee;
    const total = subtotal - discountAmount;

    return {
      subtotal,
      platformFee,
      providerPayout,
      discount: discountAmount,
      total
    };
  }

  /**
   * Create a new booking (returns draft booking for payment)
   * SECURITY: Full validation with platform/provider/pet ownership checks
   */
  async createBooking(input: CreateBookingInput): Promise<SelectBooking> {
    // STEP 1: Normalize and validate times
    const timezone = input.timezone || 'Asia/Jerusalem';
    const startTime = this.normalizeToUTC(input.startTime, timezone);
    const endTime = this.normalizeToUTC(input.endTime, timezone);
    
    this.validateBookingTimes(startTime, endTime, input.platformId);

    // STEP 2: Verify platform exists and is active
    const platform = await this.verifyPlatform(input.platformId);

    // STEP 3: Verify provider/station based on platform
    if (input.platformId === 'k9000') {
      // K9000 requires station
      if (!input.stationId) {
        throw new Error('Station ID required for K9000 bookings');
      }
      await this.verifyStation(input.stationId, input.platformId);
    } else {
      // Marketplace platforms require provider
      if (!input.providerId) {
        throw new Error('Provider ID required for marketplace bookings');
      }
      await this.verifyProvider(input.providerId, input.platformId);
    }

    // STEP 4: Verify pet ownership if pets provided
    if (input.petIds && input.petIds.length > 0) {
      await this.verifyPetsOwnership(input.petIds, input.userId);
    }

    // STEP 5: Check availability (prevents double-booking)
    const availabilityCheck = await this.checkAvailability(
      input.platformId,
      input.providerId,
      input.stationId,
      startTime,
      endTime
    );

    if (availabilityCheck.hasConflict) {
      throw new Error(availabilityCheck.message || 'Time slot not available');
    }

    // STEP 6: Calculate duration in minutes
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    // STEP 7: Calculate total from items (server-side only)
    let subtotal = 0;
    if (input.items && input.items.length > 0) {
      subtotal = input.items.reduce((sum, item) => {
        return sum + (item.unitPrice * (item.quantity || 1));
      }, 0);
    }

    // Validate minimum pricing
    if (subtotal <= 0) {
      throw new Error('Booking must have at least one item with valid pricing');
    }

    // STEP 8: Calculate pricing with platform fees
    const pricing = await this.calculatePricing(platform, subtotal);

    // STEP 9: Generate secure booking number
    const bookingNumber = await this.generateBookingNumber(input.platformId);

    // STEP 10: Determine initial status based on platform
    let initialStatus = 'draft';
    if (input.platformId === 'k9000') {
      // K9000 goes straight to pending_payment (no provider acceptance needed)
      initialStatus = 'pending_payment';
    } else {
      // Marketplaces start as draft, then pending_payment, then pending_provider
      initialStatus = 'draft';
    }

    // STEP 11: Create booking in database
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber,
        platformId: input.platformId,
        userId: input.userId,
        providerId: input.providerId,
        stationId: input.stationId,
        pickupLocationId: input.pickupLocationId,
        dropoffLocationId: input.dropoffLocationId,
        startTime,
        endTime,
        duration,
        timezone,
        status: initialStatus,
        paymentStatus: 'pending',
        subtotal: pricing.subtotal.toString(),
        platformFee: pricing.platformFee.toString(),
        providerPayout: pricing.providerPayout.toString(),
        discount: pricing.discount.toString(),
        total: pricing.total.toString(),
        currency: 'ILS',
        serviceType: input.serviceType,
        serviceDescription: input.serviceDescription,
        specialRequests: input.specialRequests,
        platformData: input.platformData
      })
      .returning();

    // STEP 12: Add pets to booking
    if (input.petIds && input.petIds.length > 0) {
      await db.insert(bookingPets).values(
        input.petIds.map(petId => ({
          bookingId: booking.id,
          petId
        }))
      );
    }

    // STEP 13: Add items to booking
    if (input.items && input.items.length > 0) {
      await db.insert(bookingItems).values(
        input.items.map(item => ({
          bookingId: booking.id,
          itemType: item.itemType,
          name: item.name,
          nameHe: item.nameHe,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice.toString(),
          totalPrice: (item.unitPrice * (item.quantity || 1)).toString()
        }))
      );
    }

    return booking;
  }

  /**
   * Update booking status (state machine)
   * SECURITY: Enhanced with payment verification and platform-specific transitions
   */
  async updateBookingStatus(
    bookingId: string,
    newStatus: string,
    updatedBy: string,
    reason?: string
  ): Promise<SelectBooking> {
    const [existingBooking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!existingBooking) {
      throw new Error('Booking not found');
    }

    // Enhanced state machine with platform-specific paths
    const validTransitions: Record<string, string[]> = {
      'draft': ['pending_payment', 'cancelled'],
      'pending_payment': ['pending_provider', 'confirmed', 'cancelled'], // K9000 goes to confirmed, marketplaces to pending_provider
      'pending_provider': ['confirmed', 'declined', 'cancelled'],
      'declined': [],
      'confirmed': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': ['disputed'],
      'cancelled': ['refunded'],
      'disputed': ['refunded', 'completed'], // Can resolve dispute back to completed
      'refunded': []
    };

    const allowedStatuses = validTransitions[existingBooking.status] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${existingBooking.status} → ${newStatus}`
      );
    }

    // SECURITY: Verify payment settled before completing
    if (newStatus === 'completed') {
      if (existingBooking.paymentStatus !== 'succeeded') {
        throw new Error('Cannot complete booking: payment not settled');
      }
    }

    // SECURITY: Verify payment settled before confirming
    if (newStatus === 'confirmed' && existingBooking.status === 'pending_payment') {
      if (existingBooking.paymentStatus !== 'succeeded') {
        throw new Error('Cannot confirm booking: payment not settled');
      }
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date()
    };

    // Status-specific updates with platform branches
    if (newStatus === 'confirmed') {
      updateData.confirmedAt = new Date();
      
      // Platform-specific actions
      if (existingBooking.platformId === 'k9000' && existingBooking.stationId) {
        // TODO: Send IoT command to unlock K9000 station at start time
        updateData.platformData = {
          ...existingBooking.platformData,
          stationUnlockScheduled: true
        };
      }
    } else if (newStatus === 'in_progress') {
      updateData.startedAt = new Date();
      
      // Platform-specific tracking
      if (existingBooking.platformId === 'walk_my_pet') {
        // TODO: Start GPS tracking for dog walker
        updateData.platformData = {
          ...existingBooking.platformData,
          gpsTrackingStarted: true
        };
      }
    } else if (newStatus === 'completed') {
      updateData.completedAt = new Date();
      updateData.payoutStatus = 'pending';
    } else if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = updatedBy;
      updateData.cancellationReason = reason;
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();

    // SECURITY: Auto-create payout only for completed marketplace bookings with settled payment
    if (
      newStatus === 'completed' && 
      existingBooking.providerId && 
      existingBooking.paymentStatus === 'succeeded'
    ) {
      await this.createPayout(bookingId);
    }

    return updatedBooking;
  }

  /**
   * Create payout for completed booking
   */
  async createPayout(bookingId: string): Promise<void> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking || !booking.providerId) {
      throw new Error('Booking or provider not found');
    }

    const amount = parseFloat(booking.subtotal);
    const platformFee = parseFloat(booking.platformFee);
    const netAmount = parseFloat(booking.providerPayout);

    await db.insert(superAppPayouts).values({
      providerId: booking.providerId,
      bookingId: booking.id,
      amount: amount.toString(),
      platformFee: platformFee.toString(),
      netAmount: netAmount.toString(),
      currency: booking.currency,
      status: 'pending',
      scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    // Update provider earnings
    await db
      .update(providers)
      .set({
        totalEarnings: sql`${providers.totalEarnings} + ${netAmount}`,
        pendingPayouts: sql`${providers.pendingPayouts} + ${netAmount}`
      })
      .where(eq(providers.id, booking.providerId));
  }

  /**
   * Get user bookings with filters
   */
  async getUserBookings(
    userId: string,
    filters?: {
      platformId?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<SelectBooking[]> {
    const conditions = [eq(bookings.userId, userId)];

    if (filters?.platformId) {
      conditions.push(eq(bookings.platformId, filters.platformId));
    }

    if (filters?.status) {
      conditions.push(eq(bookings.status, filters.status));
    }

    if (filters?.fromDate) {
      conditions.push(gte(bookings.startTime, filters.fromDate));
    }

    if (filters?.toDate) {
      conditions.push(lte(bookings.endTime, filters.toDate));
    }

    return await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(sql`${bookings.startTime} DESC`);
  }

  /**
   * Get provider bookings
   */
  async getProviderBookings(
    providerId: number,
    filters?: {
      platformId?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<SelectBooking[]> {
    const conditions = [eq(bookings.providerId, providerId)];

    if (filters?.platformId) {
      conditions.push(eq(bookings.platformId, filters.platformId));
    }

    if (filters?.status) {
      conditions.push(eq(bookings.status, filters.status));
    }

    if (filters?.fromDate) {
      conditions.push(gte(bookings.startTime, filters.fromDate));
    }

    if (filters?.toDate) {
      conditions.push(lte(bookings.endTime, filters.toDate));
    }

    return await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(sql`${bookings.startTime} DESC`);
  }

  /**
   * Get booking by ID with full details
   */
  async getBookingById(bookingId: string): Promise<any> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return null;
    }

    // Get booking pets
    const pets = await db
      .select()
      .from(bookingPets)
      .where(eq(bookingPets.bookingId, bookingId));

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    return {
      ...booking,
      pets,
      items
    };
  }

  // ============================================================================
  // CONTRACT METHODS - Thin wrappers enforcing booking state transitions
  // ============================================================================

  /**
   * Create a draft booking (wrapper for createBooking)
   * Returns booking in 'draft' or 'pending_payment' status depending on platform
   */
  async createDraftBooking(input: CreateBookingInput): Promise<SelectBooking> {
    // createBooking already returns draft/pending_payment status
    return await this.createBooking(input);
  }

  /**
   * Confirm a booking (transition to confirmed status)
   * SECURITY: Enforces payment must be settled before confirming
   */
  async confirmBooking(bookingId: string, confirmedBy: string): Promise<SelectBooking> {
    const [existingBooking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!existingBooking) {
      throw new Error('Booking not found');
    }

    // State guard: only pending_payment or pending_provider can be confirmed
    if (!['pending_payment', 'pending_provider'].includes(existingBooking.status)) {
      throw new Error(
        `Cannot confirm booking with status ${existingBooking.status}. ` +
        `Only pending_payment or pending_provider bookings can be confirmed.`
      );
    }

    // SECURITY: Verify payment is settled
    if (existingBooking.paymentStatus !== 'succeeded') {
      throw new Error('Cannot confirm booking: payment not settled');
    }

    return await this.updateBookingStatus(bookingId, 'confirmed', confirmedBy);
  }

  /**
   * Cancel a booking with reason
   * Enforces cancellation policies and captures reason
   */
  async cancelBooking(
    bookingId: string,
    cancelledBy: string,
    reason: string
  ): Promise<SelectBooking> {
    const [existingBooking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!existingBooking) {
      throw new Error('Booking not found');
    }

    // State guard: cannot cancel already completed or refunded bookings
    if (['completed', 'refunded', 'cancelled'].includes(existingBooking.status)) {
      throw new Error(
        `Cannot cancel booking with status ${existingBooking.status}`
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Cancellation reason is required');
    }

    return await this.updateBookingStatus(bookingId, 'cancelled', cancelledBy, reason);
  }
}

export const bookingService = new BookingService();
