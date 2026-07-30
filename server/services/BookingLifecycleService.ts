import { db } from '../db';
import { 
  bookings, 
  bookingPets, 
  bookingItems,
  bookingStatusHistory,
  escrowHoldings,
  providerRateCards,
  providerAvailability,
  quoteRequests,
  users,
  BOOKING_STATUS_TRANSITIONS,
  type BookingLifecycleStatus,
  PETWASH_COMMISSION_RATE
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import { planEscrowOnCreate, planEscrowOnTerminal } from '../lib/escrowSettlement';
import { GoogleSheetsService } from './googleSheetsIntegration';
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

const VAT_RATE = ISRAEL_VAT_RATE; // PR-W13: shared/israel-compliance-config.ts
const ESCROW_HOURS = 72;

const PLATFORM_ADDON_PRICING: Record<string, number> = {
  pickup:   3500,
  dropoff:  3500,
  grooming: 8500,
};

// Loyalty tier thresholds and discounts (aligned with schema-loyalty.ts canonical source)
const LOYALTY_TIERS = {
  bronze: { minBookings: 0, minRating: 0, discountPercent: 5 },
  silver: { minBookings: 5, minRating: 4.0, discountPercent: 6 },
  gold: { minBookings: 15, minRating: 4.2, discountPercent: 7 },
  platinum: { minBookings: 30, minRating: 4.5, discountPercent: 8 },
  diamond: { minBookings: 50, minRating: 4.7, discountPercent: 9 },
  emerald: { minBookings: 80, minRating: 4.8, discountPercent: 10 },
  royal: { minBookings: 100, minRating: 4.9, discountPercent: 15 },
};

// Multi-pet + long-stay combo discount
const COMBO_DISCOUNTS = {
  // pets >= 2 AND nights >= 7 = 5% extra
  multiPetWeekly: { minPets: 2, minNights: 7, discountPercent: 5 },
  // pets >= 3 AND nights >= 14 = 10% extra
  multiPetBiweekly: { minPets: 3, minNights: 14, discountPercent: 10 },
  // pets >= 2 AND nights >= 30 = 12% extra
  multiPetMonthly: { minPets: 2, minNights: 30, discountPercent: 12 },
};

export interface LoyaltyInfo {
  tier: string;
  completedBookings: number;
  averageRating: number;
  discountPercent: number;
}

export interface QuoteCalculation {
  baseAmountCents: number;
  additionalPetsCents: number;
  addonsCents: number;
  weekendSurchargeCents: number;
  holidaySurchargeCents: number;
  peakSurchargeCents: number;
  durationDiscountCents: number;
  comboDiscountCents: number;
  loyaltyDiscountCents: number;
  cleaningFeeCents: number;
  subtotalCents: number;
  depositCents: number;
  platformFeeCents: number;
  vatCents: number;
  totalCents: number;
  providerEarningsCents: number;
  appliedDiscounts: string[];
  loyaltyInfo?: LoyaltyInfo;
}

export interface CreateBookingInput {
  customerId: string;
  providerId: string;
  providerProfileId?: number;
  platformId: string;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  petIds: number[];
  selectedAddons?: string[];
  specialRequests?: string;
  quoteId?: string;
}

class BookingLifecycleService {
  // NOTE: getCustomerLoyaltyInfo() was removed (2026-06-22). It mapped a customer's
  // K9000-earned loyalty tier into a marketplace-checkout discount — but per policy
  // the club/senior discount applies ONLY to K9000 station washes, never to
  // marketplace/platform services. See the loyaltyDiscountCents=0 note in calculateQuote.

  private calculateComboDiscount(petCount: number, nights: number): { discountPercent: number; discountName: string | null } {
    // Check for combo discounts (multi-pet + long-stay)
    if (petCount >= COMBO_DISCOUNTS.multiPetMonthly.minPets && nights >= COMBO_DISCOUNTS.multiPetMonthly.minNights) {
      return { discountPercent: COMBO_DISCOUNTS.multiPetMonthly.discountPercent, discountName: 'Multi-pet monthly package (12% off)' };
    }
    if (petCount >= COMBO_DISCOUNTS.multiPetBiweekly.minPets && nights >= COMBO_DISCOUNTS.multiPetBiweekly.minNights) {
      return { discountPercent: COMBO_DISCOUNTS.multiPetBiweekly.discountPercent, discountName: 'Multi-pet bi-weekly package (10% off)' };
    }
    if (petCount >= COMBO_DISCOUNTS.multiPetWeekly.minPets && nights >= COMBO_DISCOUNTS.multiPetWeekly.minNights) {
      return { discountPercent: COMBO_DISCOUNTS.multiPetWeekly.discountPercent, discountName: 'Multi-pet weekly package (5% off)' };
    }
    return { discountPercent: 0, discountName: null };
  }

  async calculateQuote(
    providerId: string,
    platform: string,
    serviceType: string,
    startDate: Date,
    endDate: Date,
    petCount: number = 1,
    addons: string[] = [],
    customerId?: string
  ): Promise<QuoteCalculation> {
    const rateCard = await db.select()
      .from(providerRateCards)
      .where(and(
        eq(providerRateCards.providerId, providerId),
        eq(providerRateCards.platform, platform),
        eq(providerRateCards.serviceType, serviceType),
        eq(providerRateCards.isActive, true)
      ))
      .limit(1);

    if (!rateCard.length) {
      throw new Error(`No rate card found for provider ${providerId} on ${platform}`);
    }

    const card = rateCard[0];
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format provided');
    }
    if (endDate <= startDate) {
      throw new Error('End date must be after start date');
    }
    
    // Validate pet count
    if (petCount < 1) {
      throw new Error('At least 1 pet is required');
    }
    if (petCount > 10) {
      throw new Error('Maximum 10 pets per booking');
    }

    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const hours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));

    const perNightRate = card.baseRatePerNightCents || 0;
    let baseAmountCents = 0;
    if (perNightRate && nights > 0) {
      // Tiered nightly progression (Build C): when configured, each night is priced by its
      // stay-length bucket as a % of the base rate; otherwise flat rate × nights (unchanged).
      const prog = card.nightlyRateProgression as
        | { night1Percent?: number; nights2to7Percent?: number; nights8to30Percent?: number; night31PlusPercent?: number }
        | null;
      if (prog && (prog.night1Percent || prog.nights2to7Percent || prog.nights8to30Percent || prog.night31PlusPercent)) {
        for (let n = 1; n <= nights; n++) {
          const pct = n === 1 ? (prog.night1Percent ?? 100)
            : n <= 7 ? (prog.nights2to7Percent ?? 100)
            : n <= 30 ? (prog.nights8to30Percent ?? 100)
            : (prog.night31PlusPercent ?? 100);
          baseAmountCents += Math.round(perNightRate * (pct / 100));
        }
      } else {
        baseAmountCents = perNightRate * nights;
      }
    } else if (card.baseRatePerHourCents && hours > 0) {
      baseAmountCents = card.baseRatePerHourCents * hours;
    } else if (card.baseRatePerVisitCents) {
      baseAmountCents = card.baseRatePerVisitCents;
    }

    // Additional-pet surcharge. For overnight (per-night) bookings it must apply for
    // EVERY night — the base rate above is per-night × nights, so the surcharge has to
    // mirror it, otherwise a multi-pet, multi-night stay is silently undercharged
    // (e.g. 2 pets × 5 nights would bill the surcharge once instead of 5×). For
    // per-hour / per-visit services the surcharge is a single charge.
    const isPerNightBooking = !!(card.baseRatePerNightCents && nights > 0);
    const additionalPetUnitCents = petCount > 1
      ? (petCount - 1) * (card.additionalPetSurchargeCents || 0)
      : 0;
    const additionalPetsCents = isPerNightBooking
      ? additionalPetUnitCents * nights
      : additionalPetUnitCents;

    let addonsCents = 0;
    const addonPricing = card.addonPricing as Record<string, number> || {};
    for (const addon of addons) {
      if (addonPricing[addon]) {
        addonsCents += addonPricing[addon];
      }
    }

    const startDay = startDate.getDay();
    const isWeekend = startDay === 5 || startDay === 6;
    const weekendSurchargeCents = isWeekend && card.weekendSurchargePercent
      ? Math.round(baseAmountCents * (card.weekendSurchargePercent / 100))
      : 0;

    const holidaySurchargeCents = 0;

    // Per-day peak surcharge (Build C): applied for each night that falls in a configured peak range.
    let peakSurchargeCents = 0;
    const peakRanges = (card.peakDateRanges as Array<{ start: string; end: string; surchargePercent: number }>) || [];
    if (isPerNightBooking && peakRanges.length && perNightRate) {
      for (let n = 0; n < nights; n++) {
        const d = new Date(startDate.getTime() + n * 24 * 60 * 60 * 1000);
        const ymd = d.toISOString().slice(0, 10);
        const hit = peakRanges.find(r => r && r.start && r.end && ymd >= r.start && ymd <= r.end && r.surchargePercent > 0);
        if (hit) peakSurchargeCents += Math.round(perNightRate * (hit.surchargePercent / 100));
      }
    }

    // One-time cleaning fee (Build C): overnight/per-night stays only; flat, not discountable.
    const cleaningFeeCents = isPerNightBooking ? (card.cleaningFeeCents || 0) : 0;

    const appliedDiscounts: string[] = [];

    // Duration discount (provider-defined)
    let durationDiscountCents = 0;
    if (nights >= 30 && card.monthlyDiscountPercent) {
      durationDiscountCents = Math.round(baseAmountCents * (card.monthlyDiscountPercent / 100));
      appliedDiscounts.push(`Monthly stay discount (${card.monthlyDiscountPercent}% off)`);
    } else if (nights >= 14 && card.biweeklyDiscountPercent) {
      durationDiscountCents = Math.round(baseAmountCents * (card.biweeklyDiscountPercent / 100));
      appliedDiscounts.push(`Bi-weekly stay discount (${card.biweeklyDiscountPercent}% off)`);
    } else if (nights >= 7 && card.weeklyDiscountPercent) {
      durationDiscountCents = Math.round(baseAmountCents * (card.weeklyDiscountPercent / 100));
      appliedDiscounts.push(`Weekly stay discount (${card.weeklyDiscountPercent}% off)`);
    }

    // Combo discount (multi-pet + long-stay)
    const combo = this.calculateComboDiscount(petCount, nights);
    const preComboTotal = baseAmountCents + additionalPetsCents + addonsCents + weekendSurchargeCents + peakSurchargeCents - durationDiscountCents;
    const comboDiscountCents = combo.discountPercent > 0 
      ? Math.round(preComboTotal * (combo.discountPercent / 100))
      : 0;
    if (combo.discountName) {
      appliedDiscounts.push(combo.discountName);
    }

    // POLICY (CEO, 2026-06-22): the loyalty CLUB / senior discounts apply ONLY to
    // K9000 self-service dual-station washes — NEVER to marketplace/platform
    // services (pet-sitting, walk-my-pet, PetWash Academy, pet training, grooming).
    // Applying the K9000-earned tier discount here was leaking club perks into
    // marketplace pricing and silently reducing BOTH provider earnings and platform
    // commission on services that are not eligible for it. Force it to 0.
    // (Provider-defined duration + multi-pet combo package discounts above still apply —
    //  those are the provider's own pricing, not the club discount.)
    const postComboTotal = preComboTotal - comboDiscountCents;
    const loyaltyDiscountCents = 0;

    // Cleaning fee is a flat, non-discountable line added after all discounts.
    const subtotalCents = postComboTotal - loyaltyDiscountCents + cleaningFeeCents;

    // Refundable security deposit (Build C): a HOLD, returned after the stay — NOT part of
    // the charge total, commission or VAT. Surfaced separately for the UI/payment hold.
    const depositCents = Math.round(subtotalCents * ((card.securityDepositPercent || 0) / 100));

    const platformFeeCents = Math.round(subtotalCents * PETWASH_COMMISSION_RATE);
    const vatCents = Math.round(platformFeeCents * VAT_RATE);
    const totalCents = subtotalCents + vatCents;
    const providerEarningsCents = subtotalCents - platformFeeCents;

    return {
      baseAmountCents,
      additionalPetsCents,
      addonsCents,
      weekendSurchargeCents,
      holidaySurchargeCents,
      peakSurchargeCents,
      durationDiscountCents,
      comboDiscountCents,
      loyaltyDiscountCents,
      cleaningFeeCents,
      subtotalCents,
      depositCents,
      platformFeeCents,
      vatCents,
      totalCents,
      providerEarningsCents,
      appliedDiscounts,
      // loyaltyInfo intentionally omitted: the K9000 club discount never applies to
      // marketplace services (loyaltyDiscountCents is forced to 0 above), and the old
      // getCustomerLoyaltyInfo() lookup was removed 2026-06-22. The dangling
      // `loyaltyInfo: loyaltyInfo` reference here threw ReferenceError on EVERY quote
      // (latent only because marketplace bookings are off pre-launch).
    };
  }

  async createBooking(input: CreateBookingInput, tx?: any): Promise<{ bookingId: string; bookingNumber: string }> {
    // Defense-in-depth: self-booking guard. The route layer checks this too,
    // but we repeat here because createBooking can be called from other paths.
    if (input.customerId === input.providerId && process.env.ALLOW_SELF_BOOKING !== 'true') {
      throw new Error('Self-booking is not permitted: customer and provider cannot be the same user');
    }

    const dbOrTx = tx ?? db;
    const bookingId = nanoid(16);
    const bookingNumber = `PW-${Date.now().toString(36).toUpperCase()}-${nanoid(4).toUpperCase()}`;

    const quote = await this.calculateQuote(
      input.providerId,
      input.platformId,
      input.serviceType,
      input.startTime,
      input.endTime,
      input.petIds.length,
      input.selectedAddons
    );

    // Cross-rail slot lock (2026-07-30): this engine used availabilitySlots
    // only, a namespace no other rail sees — a marketplace-checkout booking
    // and a booking_requests booking could hold the SAME provider hour. Join
    // the shared EXCLUDE-constraint lock (same provider-UID key space as
    // every other creator). 409-equivalent behavior: conflict throws.
    const { acquireSlotLock } = await import('../lib/marketplaceSlotLock');
    await acquireSlotLock(db, {
      providerId: input.providerId,
      startAt: input.startTime,
      endAt: input.endTime,
      bookingRef: bookingId,
      serviceType: input.serviceType,
    });

    await dbOrTx.insert(bookings).values({
      id: bookingId,
      bookingNumber,
      platformId: input.platformId.toUpperCase() as any,
      userId: input.customerId,
      // 2026-07-24 FIX: this wrote the numeric provider-PROFILE id while every
      // reader (provider-dashboard-v2 job inbox, marketplace-ranking, and this
      // service's own getBookingsForUser) queries bookings.provider_id by the
      // provider's FIREBASE UID — so every marketplace-checkout booking was
      // invisible to the provider forever. providerId IS the uid here (see the
      // self-booking guard above). The profile id is kept in metadata.
      providerId: input.providerId,
      platformData: { providerProfileId: input.providerProfileId ?? null } as any,
      startTime: input.startTime,
      endTime: input.endTime,
      serviceType: input.serviceType,
      subtotal: (quote.subtotalCents / 100).toFixed(2),
      platformFee: (quote.platformFeeCents / 100).toFixed(2),
      providerPayout: (quote.providerEarningsCents / 100).toFixed(2),
      total: (quote.totalCents / 100).toFixed(2),
      status: 'inquiry',
      paymentStatus: 'pending',
      specialRequests: input.specialRequests,
      currency: 'ILS',
    });

    for (const petId of input.petIds) {
      await dbOrTx.insert(bookingPets).values({
        bookingId,
        petId,
      });
    }

    if (input.selectedAddons?.length) {
      for (const addon of input.selectedAddons) {
        const unitPriceCents = PLATFORM_ADDON_PRICING[addon] ?? 0;
        const unitPrice = (unitPriceCents / 100).toFixed(2);
        await dbOrTx.insert(bookingItems).values({
          bookingId,
          itemType: 'addon',
          name: addon,
          quantity: 1,
          unitPrice,
          totalPrice: unitPrice,
        });
      }
    }

    await this.recordStatusChange(bookingId, null, 'inquiry', input.customerId, 'customer', 'Booking created', dbOrTx);

    logger.info('[BookingLifecycle] Booking created', { bookingId, bookingNumber });

    const totalAmount = (quote.totalCents / 100).toFixed(2);

    (async () => {
      try {
        let customerName = input.customerId;
        let customerEmail = '';
        let customerPhone = '';

        try {
          const [customer] = await db.select({
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            phone: users.phone,
          }).from(users).where(eq(users.id, input.customerId)).limit(1);

          if (customer) {
            customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || input.customerId;
            customerEmail = customer.email || '';
            customerPhone = customer.phone || '';
          }
        } catch { /* fallback to customerId */ }

        const platformBookingLoggers: Record<string, (data: any) => Promise<any>> = {
          sitter_suite: GoogleSheetsService.logSitterBooking,
          walk_my_pet: GoogleSheetsService.logWalkerBooking,
          pettrek: GoogleSheetsService.logPetTrekBooking,
          k9000: GoogleSheetsService.logK9000Booking,
          academy: GoogleSheetsService.logAcademyBooking,
        };

        const logFn = platformBookingLoggers[input.platformId] || GoogleSheetsService.logSitterBooking;

        await logFn({
          bookingId: bookingNumber,
          customerName,
          email: customerEmail,
          phone: customerPhone,
          petName: `${input.petIds.length} pet(s)`,
          stationLocation: input.platformId,
          washType: input.serviceType,
          dateTime: input.startTime.toISOString(),
          amount: parseFloat(totalAmount),
          paymentStatus: 'Pending',
          notes: input.specialRequests || '',
        });
      } catch (err: any) {
        logger.error('[BookingLifecycle] Google Sheets logging failed - DB record saved', err);
      }
    })();

    return { bookingId, bookingNumber };
  }

  async transitionStatus(
    bookingId: string,
    newStatus: BookingLifecycleStatus,
    actorUserId: string,
    actorRole: 'customer' | 'provider' | 'system' | 'admin',
    reason?: string
  ): Promise<void> {
    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const currentStatus = booking.status as BookingLifecycleStatus;
    const allowedTransitions = BOOKING_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid transition from ${currentStatus} to ${newStatus}`);
    }

    // SERVICE-LAYER GUARD (item 5): The state machine allows owner_completion_review → completed
    // and provider_completion_review → completed, but that must ONLY happen via the system
    // auto-advance that verifies both sides confirmed by distinct actors. Any direct call
    // to transitionStatus('completed') from outside that path is rejected at the service layer —
    // not just the route layer — so new code paths cannot bypass it.
    if (newStatus === 'completed' && actorRole !== 'system' && actorRole !== 'admin') {
      throw new Error(
        `Direct transition to 'completed' is not allowed for role '${actorRole}'. ` +
        `Completion must be triggered by the system after both parties confirm independently.`
      );
    }

    await db.update(bookings)
      .set({ 
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === 'provider_confirmed' && { confirmedAt: new Date() }),
        ...(newStatus === 'in_progress' && { startedAt: new Date() }),
        ...(newStatus === 'completed' && { completedAt: new Date() }),
        ...(newStatus === 'cancelled' && { 
          cancelledAt: new Date(), 
          cancelledBy: actorUserId,
          cancellationReason: reason 
        }),
      })
      .where(eq(bookings.id, bookingId));

    await this.recordStatusChange(bookingId, currentStatus, newStatus, actorUserId, actorRole, reason);

    if (newStatus === 'deposit_received') {
      await this.createEscrowHolding(bookingId, actorUserId, actorRole);
    }

    if (newStatus === 'completed') {
      await this.scheduleEscrowRelease(bookingId, actorUserId, actorRole);
    }

    // R3: a cancelled/refunded booking must settle (refund) its escrow holding —
    // otherwise held funds are stranded with no release path. Idempotent.
    if (newStatus === 'cancelled' || newStatus === 'refunded') {
      await this.settleEscrowTerminal(bookingId, actorUserId, actorRole, reason);
    }

    logger.info('[BookingLifecycle] Status transitioned', { 
      bookingId, 
      from: currentStatus, 
      to: newStatus 
    });
  }

  private async recordStatusChange(
    bookingId: string,
    fromStatus: string | null,
    toStatus: string,
    userId: string,
    role: string,
    reason?: string,
    dbOrTx?: any
  ): Promise<void> {
    await (dbOrTx ?? db).insert(bookingStatusHistory).values({
      bookingId,
      fromStatus,
      toStatus,
      changedByUserId: userId,
      changedByRole: role,
      reason,
    });
  }

  private async createEscrowHolding(
    bookingId: string,
    actorUserId?: string,
    actorRole?: string,
  ): Promise<void> {
    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return;

    const grossAmountCents = Math.round(parseFloat(booking.total) * 100);
    const platformFeeCents = Math.round(parseFloat(booking.platformFee || '0') * 100);
    const vatCents = Math.round(platformFeeCents * VAT_RATE);
    const netProviderAmountCents = grossAmountCents - platformFeeCents - vatCents;

    // R2: a booking has at most one escrow holding. There is no UNIQUE(booking_id)
    // constraint yet and a 'pending'/'pending_payment' row may already exist (created at
    // /book time), so capture is idempotent: insert once, promote a pending row to 'held',
    // and skip if already held/processed — never create a duplicate (stranded) row.
    const [existing] = await db.select({ id: escrowHoldings.id, status: escrowHoldings.status })
      .from(escrowHoldings)
      .where(eq(escrowHoldings.bookingId, bookingId))
      .limit(1);

    const plan = planEscrowOnCreate(existing?.status);
    if (plan === 'skip') {
      logger.info('[BookingLifecycle] Escrow already captured, skipping', { bookingId, status: existing?.status });
      return;
    }

    const captureFields = {
      grossAmountCents,
      platformFeeCents,
      vatCents,
      netProviderAmountCents,
      status: 'held' as const,
      capturedAt: new Date(),
    };

    if (plan === 'promote' && existing) {
      await db.update(escrowHoldings)
        .set({ ...captureFields, updatedAt: new Date() })
        .where(eq(escrowHoldings.id, existing.id));
    } else {
      await db.insert(escrowHoldings).values({
        escrowId: `ESC-${nanoid(12)}`,
        bookingId,
        customerId: booking.userId,
        providerId: String(booking.providerId || ''),
        ...captureFields,
      });
    }

    await this.auditMoney(bookingId, 'BOOKING_ESCROW_CAPTURED', actorUserId, actorRole, {
      grossAmountCents, platformFeeCents, vatCents, netProviderAmountCents, mode: plan,
    });
    logger.info('[BookingLifecycle] Escrow holding captured', { bookingId, grossAmountCents, mode: plan });
  }

  private async scheduleEscrowRelease(
    bookingId: string,
    actorUserId?: string,
    actorRole?: string,
  ): Promise<void> {
    const releaseTime = new Date(Date.now() + ESCROW_HOURS * 60 * 60 * 1000);

    // Only a currently-'held' holding becomes eligible for release — never resurrect a
    // refunded/released row into the payout pipeline.
    const updated = await db.update(escrowHoldings)
      .set({
        serviceCompletedAt: new Date(),
        releaseEligibleAt: releaseTime,
        status: 'releasing',
        updatedAt: new Date(),
      })
      .where(and(eq(escrowHoldings.bookingId, bookingId), eq(escrowHoldings.status, 'held')))
      .returning({ id: escrowHoldings.id });

    if (updated.length > 0) {
      await this.auditMoney(bookingId, 'BOOKING_ESCROW_RELEASE_SCHEDULED', actorUserId, actorRole, {
        releaseEligibleAt: releaseTime.toISOString(),
      });
    }
    logger.info('[BookingLifecycle] Escrow release scheduled', {
      bookingId,
      releaseEligibleAt: releaseTime,
      scheduled: updated.length > 0,
    });
  }

  // R3: settle (refund) the escrow holding when a booking is cancelled or refunded.
  // Idempotent — never refunds twice and never claws back an already-released payout.
  private async settleEscrowTerminal(
    bookingId: string,
    actorUserId?: string,
    actorRole?: string,
    reason?: string,
  ): Promise<void> {
    const [escrow] = await db.select()
      .from(escrowHoldings)
      .where(eq(escrowHoldings.bookingId, bookingId))
      .limit(1);
    if (!escrow) return;

    if (planEscrowOnTerminal(escrow.status) === 'skip') {
      logger.info('[BookingLifecycle] Escrow already terminal, skipping settle', { bookingId, status: escrow.status });
      return;
    }

    const now = new Date();
    await db.update(escrowHoldings)
      .set({
        status: 'refunded',
        refundProcessedAt: now,
        refundAmountCents: escrow.grossAmountCents,
        refundReason: reason ?? 'Booking cancelled',
        updatedAt: now,
      })
      .where(eq(escrowHoldings.id, escrow.id));

    await this.auditMoney(bookingId, 'BOOKING_ESCROW_REFUNDED', actorUserId, actorRole, {
      escrowId: escrow.escrowId,
      refundAmountCents: escrow.grossAmountCents,
      fromStatus: escrow.status,
      reason: reason ?? 'Booking cancelled',
    });
    logger.info('[BookingLifecycle] Escrow refunded on terminal transition', {
      bookingId, fromStatus: escrow.status, refundAmountCents: escrow.grossAmountCents,
    });
  }

  // R5: every money mutation is audited (actor + action + before/after amounts).
  // Non-blocking: an audit failure must never break the booking flow.
  private async auditMoney(
    bookingId: string,
    actionType: string,
    actorUserId: string | undefined,
    actorRole: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { logAuditEvent } = await import('../middleware/auditLog');
      await logAuditEvent({
        actorUserId: actorUserId ?? 'system',
        actorRole: actorRole ?? 'system',
        actionType,
        targetType: 'booking',
        targetId: bookingId,
        severity: 'info',
        metadata,
      });
    } catch (err) {
      logger.warn('[BookingLifecycle] audit log failed (non-blocking)', {
        bookingId, actionType, error: (err as Error)?.message,
      });
    }
  }

  async getBookingWithHistory(bookingId: string) {
    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return null;

    const history = await db.select()
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, bookingId))
      .orderBy(desc(bookingStatusHistory.changedAt));

    const pets = await db.select()
      .from(bookingPets)
      .where(eq(bookingPets.bookingId, bookingId));

    const items = await db.select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const [escrow] = await db.select()
      .from(escrowHoldings)
      .where(eq(escrowHoldings.bookingId, bookingId))
      .limit(1);

    return {
      ...booking,
      statusHistory: history,
      pets,
      items,
      escrow,
    };
  }

  async getUserBookings(userId: string, role: 'customer' | 'provider', limit = 50) {
    const field = role === 'customer' ? bookings.userId : sql`${bookings.providerId}::text`;
    
    return db.select()
      .from(bookings)
      .where(eq(role === 'customer' ? bookings.userId : sql`${bookings.providerId}::text`, userId))
      .orderBy(desc(bookings.createdAt))
      .limit(limit);
  }

  async processEscrowReleases(): Promise<number> {
    const now = new Date();
    
    const eligibleEscrows = await db.select()
      .from(escrowHoldings)
      .where(and(
        eq(escrowHoldings.status, 'releasing'),
        lte(escrowHoldings.releaseEligibleAt, now)
      ));

    let releasedCount = 0;

    for (const escrow of eligibleEscrows) {
      try {
        // R4: release the holding and mark the booking payout in ONE transaction so a crash
        // can't leave escrow 'released' while the booking payout is unset (or vice-versa).
        await db.transaction(async (tx) => {
          await tx.update(escrowHoldings)
            .set({
              status: 'released',
              releasedAt: now,
              updatedAt: now,
            })
            .where(eq(escrowHoldings.id, escrow.id));

          await tx.update(bookings)
            .set({
              payoutStatus: 'completed',
              payoutDate: now,
              updatedAt: now,
            })
            .where(eq(bookings.id, escrow.bookingId));
        });

        releasedCount++;
        await this.auditMoney(escrow.bookingId, 'BOOKING_ESCROW_RELEASED', 'system', 'system', {
          escrowId: escrow.escrowId,
          netProviderAmountCents: escrow.netProviderAmountCents,
        });
        logger.info('[BookingLifecycle] Escrow released', {
          escrowId: escrow.escrowId,
          bookingId: escrow.bookingId,
          amountCents: escrow.netProviderAmountCents
        });
      } catch (error) {
        logger.error('[BookingLifecycle] Escrow release failed', error, {
          escrowId: escrow.escrowId });
      }
    }

    return releasedCount;
  }
}

export const bookingLifecycleService = new BookingLifecycleService();
export default bookingLifecycleService;
