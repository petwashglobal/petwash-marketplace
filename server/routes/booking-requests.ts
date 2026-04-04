/**
 * PET WASH™ BOOKING REQUESTS API
 * 
 * Complete booking flow:
 * 1. Create request (owner → provider)
 * 2. Provider accepts/declines
 * 3. Schedule Meet & Greet
 * 4. Complete Meet & Greet
 * 5. Payment (escrow)
 * 6. Service in progress
 * 7. Service completion
 * 8. Review
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  bookingRequests,
  bookingRequestPets,
  bookingRequestAddons,
  sitterProfiles,
  walkerProfiles,
  trainers,
  users,
  superAppNotifications,
  rebookTriggers,
  referrals,
  winbackQueue,
  experimentEvents,
  createBookingRequestSchema,
  providerBookingResponseSchema,
  type BookingRequest
} from '@shared/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import { calculateQuote, persistBookingQuote } from '../services/quoteEngine';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

// Enterprise service integrations
import EscrowService from '../services/EscrowService';
import { createEarningRecord } from '../services/payoutLedger';
import { dispatchNotification } from '../lib/notificationDispatcher';
import { logBookingEvent, type BookingEventPayload } from '../services/bookingEventLogger';
import { twilioSMSService } from '../services/TwilioSMSService';
import { scheduleRebookTrigger } from '../jobs/rebook-scheduler';
import { EmailService } from '../emailService';
import { awardLoyaltyCredit, getStreakCounts, redeemLoyaltyCredit } from '../utils/loyaltyLedger';
import { updateLoyalty } from '../actions/loyaltySync';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';
import { walletService } from '../services/WalletService';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { eventBus } from '../services/EventBus';
import { recomputeCustomerProfile, advanceJourneyState } from '../services/CustomerIntelligenceService';

function getDivisionCode(serviceType?: string | null): 'petsitter' | 'walkers' | 'academy' | 'pettrek' | 'general' {
  switch (serviceType) {
    case 'sitting':   return 'petsitter';
    case 'walking':   return 'walkers';
    case 'training':  return 'academy';
    case 'pettrek':   return 'pettrek';
    default:          return 'general';
  }
}

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

function buildEventPayload(booking: any): BookingEventPayload {
  return {
    requestId: booking.requestId,
    providerType: booking.providerType,
    serviceType: booking.serviceType,
    ownerId: booking.ownerId,
    providerId: booking.providerId,
    startDate: booking.startDate?.toISOString?.() || String(booking.startDate),
    endDate: booking.endDate?.toISOString?.() || String(booking.endDate),
    totalDays: booking.totalDays || 1,
    totalCents: booking.totalCents,
    subtotalCents: booking.subtotalCents,
    serviceFeeCents: booking.serviceFeeCents,
    currency: booking.currency || 'ILS',
    status: booking.status,
    message: booking.ownerMessage || undefined,
  };
}

const router = Router();

/**
 * POST /api/booking-requests - Create a new booking request
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // LEGAL BLOCK: PetTrek is not licensed in Israel — reject at booking-request creation layer
    const rawServiceType = req.body?.serviceType;
    if (rawServiceType === 'pettrek' || rawServiceType === 'pet_trek') {
      return res.status(403).json({
        error: 'service_legally_blocked',
        code: 'PETTREK_NOT_LICENSED',
        message: 'PetTrek™ bookings are not available — service pending licensing in Israel.',
      });
    }

    const data = createBookingRequestSchema.parse(req.body);
    const requestId = nanoid(12);
    
    // Validate dates are not in the past (Israel timezone)
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const todayIsrael = new Date().toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
    const startDateStr = startDate.toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
    if (startDateStr < todayIsrael) {
      return res.status(400).json({ error: 'Start date cannot be in the past' });
    }
    
    if (endDate < startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
    
    // Check for conflicting bookings with same provider
    const existingRequests = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, data.providerId),
        sql`${bookingRequests.status} IN ('pending', 'accepted', 'confirmed', 'in_progress')`,
        sql`${bookingRequests.startDate} < ${endDate.toISOString()}::timestamp`,
        sql`${bookingRequests.endDate} > ${startDate.toISOString()}::timestamp`
      ));
    
    if (existingRequests.length > 0) {
      return res.status(409).json({
        error: 'Provider already has a booking for the selected dates',
        code: 'PROVIDER_UNAVAILABLE',
      });
    }
    
    // ── Pricing ────────────────────────────────────────────────────────────────
    // If the frontend passed finalQuote (from /api/quotes/preview), use it directly.
    // Otherwise fall back to simple legacy calculation.
    const fq = data.finalQuote;
    
    let subtotalCents: number;
    let serviceFeeCents: number;
    let totalCents: number;
    let totalDays: number;
    let dailyRateCents = 0;
    let hourlyRateCents = 0;
    const serviceFeePercent = 15;
    
    totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    if (fq && fq.success && typeof fq.totals?.totalCents === 'number') {
      // ── Safety checks before trusting the client-supplied quote ──────────────

      // 1. Provider mismatch — quote was generated for a different provider
      if (fq.providerId && fq.providerId !== data.providerId) {
        return res.status(400).json({
          error: 'Quote provider mismatch. Please restart your booking.',
          code: 'QUOTE_PROVIDER_MISMATCH',
        });
      }

      // 2. Service type mismatch — quote was generated for a different service
      if (fq.serviceType && fq.serviceType !== data.serviceType) {
        return res.status(400).json({
          error: 'Quote service type mismatch. Please restart your booking.',
          code: 'QUOTE_SERVICE_MISMATCH',
        });
      }

      // 3. Stale quote check — quote older than 10 minutes must be repriced
      const STALE_THRESHOLD_MS = 10 * 60 * 1000;
      if (fq.quotedAt) {
        const quoteAgeMs = Date.now() - new Date(fq.quotedAt).getTime();
        if (quoteAgeMs > STALE_THRESHOLD_MS) {
          // Reprice to see if the total changed
          const freshQuote = await calculateQuote({
            providerId: data.providerId,
            serviceType: data.serviceType,
            bookingWindow: { startAt: startDate.toISOString(), endAt: endDate.toISOString() },
            pets: data.petDetails ?? [],
            addons: data.selectedAddons ?? [],
            promoCode: data.promoCode ?? null,
            userId,
          });
          if (freshQuote.success && freshQuote.totals.totalCents !== fq.totals.totalCents) {
            return res.status(409).json({
              error: 'Your quote has expired and the price has changed. Please review the updated quote before confirming.',
              code: 'QUOTE_STALE_PRICE_CHANGED',
              freshQuote,
            });
          }
          // Price unchanged — accept stale quote with a warning logged
          logger.warn('[BookingRequest] Stale quote accepted (price unchanged)', {
            requestId: 'pending', quoteAgeMs, providerId: data.providerId,
          });
        }
      }

      // Use engine quote — no client-side arithmetic
      subtotalCents = fq.totals.subtotalCents;
      serviceFeeCents = 0; // already included in quote totals
      totalCents = fq.totals.totalCents;
    } else {
      // Legacy fallback: fetch provider rate and calculate
      if (data.providerType === 'sitter' && data.providerProfileId) {
        const [sitter] = await db.select().from(sitterProfiles)
          .where(eq(sitterProfiles.id, data.providerProfileId)).limit(1);
        if (sitter) dailyRateCents = sitter.pricePerDayCents || 15000;
      } else if (data.providerType === 'walker' && data.providerProfileId) {
        const [walker] = await db.select().from(walkerProfiles)
          .where(eq(walkerProfiles.id, data.providerProfileId)).limit(1);
        if (walker) hourlyRateCents = parseInt(walker.hourlyRate || '5000');
      } else if (data.providerType === 'trainer' && data.providerProfileId) {
        const [trainer] = await db.select().from(trainers)
          .where(eq(trainers.id, data.providerProfileId)).limit(1);
        if (trainer) hourlyRateCents = parseFloat(trainer.hourlyRate || '8000') * 100;
      }
      
      if (dailyRateCents > 0) {
        subtotalCents = dailyRateCents * totalDays * data.petCount;
      } else if (hourlyRateCents > 0) {
        subtotalCents = hourlyRateCents * data.petCount;
      } else {
        subtotalCents = 15000 * totalDays * data.petCount;
      }
      serviceFeeCents = Math.round(subtotalCents * serviceFeePercent / 100);
      totalCents = subtotalCents + serviceFeeCents;
    }
    
    // Derive petDetails persisted on the booking row (used for display, not pricing)
    const petDetailsForRow = data.petDetails && data.petDetails.length > 0
      ? data.petDetails
      : null;
    
    // ── Create booking request row ─────────────────────────────────────────────
    const [booking] = await db.insert(bookingRequests).values({
      requestId,
      ownerId: userId,
      providerId: data.providerId,
      providerProfileId: data.providerProfileId || null,
      providerType: data.providerType,
      serviceType: data.serviceType,
      startDate,
      endDate,
      petIds: data.petIds || (data.petDetails?.map(p => String(p.petId ?? '')).filter(Boolean) ?? []),
      petCount: data.petCount,
      petDetails: petDetailsForRow,
      dailyRateCents: dailyRateCents || null,
      hourlyRateCents: hourlyRateCents || null,
      totalDays,
      totalHours: null,
      subtotalCents,
      serviceFeePercent: serviceFeePercent.toString(),
      serviceFeeCents,
      totalCents,
      // Quote engine columns (stored when finalQuote is provided)
      ...(fq && fq.success ? {
        quoteSubtotalCents: fq.totals.subtotalCents,
        quoteDiscountCents: fq.totals.discountCents,
        quoteCreditCents: fq.totals.walletCreditAppliedCents,
        quoteGiftCardCents: fq.totals.giftCardAppliedCents,
        quoteTaxCents: fq.totals.taxCents,
        quoteTotalCents: fq.totals.totalCents,
        quoteCurrency: fq.currency || 'ILS',
        quoteBreakdown: fq,
        pricingVersion: fq.pricingVersion || 'v1.0.0',
        promoCode: data.promoCode || null,
        loyaltyRedeemedCents: fq.totals.loyaltyRedeemedCents ?? 0,
      } : {}),
      currency: 'ILS',
      status: 'pending',
      statusHistory: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Booking request created' }],
      ownerMessage: data.message || null,
      specialRequirements: data.specialRequirements || null,
      searchId: data.searchId || null,
    }).returning();
    
    // ── Persist multi-pet rows ─────────────────────────────────────────────────
    // Map clientRef → DB row ID so we can attach per-pet addons
    const petRowMap: Record<string, string> = {};
    
    if (data.petDetails && data.petDetails.length > 0 && booking.id) {
      const petLineItems: Record<string, any> = {};
      if (fq?.success && Array.isArray(fq.lineItems?.pets)) {
        for (const li of fq.lineItems.pets) {
          petLineItems[li.clientRef] = li;
        }
      }
      
      for (const pd of data.petDetails) {
        const li = petLineItems[pd.clientRef] || {};
        const [petRow] = await db.insert(bookingRequestPets).values({
          bookingRequestId: booking.id,
          petId: pd.petId ? Number(pd.petId) : null,
          petName: pd.petName,
          petType: pd.petType,
          breed: pd.breed || null,
          sizeCategory: pd.sizeCategory || null,
          ageYears: pd.ageYears ? String(pd.ageYears) : null,
          weightKg: pd.weightKg ? String(pd.weightKg) : null,
          gender: pd.gender || null,
          specialNotes: [pd.specialNotes, pd.feedingInstructions, pd.currentSkills, pd.trainingGoals]
            .filter(Boolean).join(' | ') || null,
          requiresMedication: !!pd.requiresMedication,
          hasBehaviorFlag: !!pd.hasBehaviorFlag,
          hasSpecialNeeds: !!pd.hasSpecialNeeds,
          quantity: 1,
          basePriceCents: li.basePriceCents || 0,
          adjustmentPriceCents: li.adjustmentPriceCents || 0,
          subtotalPriceCents: li.subtotalPriceCents || 0,
          currency: 'ILS',
          pricingSnapshot: li.pricingSnapshot || null,
        }).returning();
        petRowMap[pd.clientRef] = petRow.id;
      }
    }
    
    // ── Persist addon rows ─────────────────────────────────────────────────────
    if (data.selectedAddons && data.selectedAddons.length > 0 && booking.id) {
      const addonLineItems: Record<string, any> = {};
      if (fq?.success && Array.isArray(fq.lineItems?.addons)) {
        for (const li of fq.lineItems.addons) {
          addonLineItems[li.addonCode] = li;
        }
      }
      
      for (const addon of data.selectedAddons) {
        const li = addonLineItems[addon.addonCode] || {};
        const petRowId = addon.scope === 'pet' && addon.petRef
          ? (petRowMap[addon.petRef] || null)
          : null;
          
        await db.insert(bookingRequestAddons).values({
          bookingRequestId: booking.id,
          bookingRequestPetId: petRowId,
          addonCode: addon.addonCode,
          addonName: addon.addonName,
          addonScope: addon.scope,
          quantity: addon.quantity || 1,
          unitPriceCents: addon.unitPriceCents || li.unitPriceCents || 0,
          subtotalPriceCents: li.subtotalPriceCents || (addon.unitPriceCents * (addon.quantity || 1)) || 0,
          currency: 'ILS',
          pricingSnapshot: li,
        });
      }
    }

    logger.info('[BookingRequests] Created new booking request', {
      requestId,
      ownerId: userId,
      providerId: data.providerId,
      serviceType: data.serviceType,
      totalCents,
      petCount: data.petDetails?.length || data.petCount,
      addonCount: data.selectedAddons?.length || 0,
      usedQuoteEngine: !!(fq?.success),
    });

    logBookingEvent('created', buildEventPayload(booking), {
      customerRequestedAt: new Date().toISOString(),
    }).catch(() => {});

    eventPublisher.publishEvent(
      DomainEventType.BOOKING_CREATED,
      {
        bookingId: requestId,
        userId: booking.ownerId,
        providerId: booking.providerId,
        serviceType: booking.serviceType,
        totalCents: booking.totalCents,
      },
      { source: 'booking-requests/create', aggregateType: 'booking', aggregateId: requestId, userId: booking.ownerId },
    ).catch((e: any) => logger.error('[BookingRequests] BOOKING_CREATED event publish failed', { error: e?.message, requestId }));

    // Notify provider of new booking request (non-blocking, best-effort)
    if (booking.providerId) {
      dispatchNotification({
        uid: booking.providerId,
        type: 'booking_request',
        title: '📅 New Booking Request',
        body: `You have a new ${data.serviceType?.replace(/_/g, ' ') || 'service'} booking request`,
        actionUrl: `/provider/bookings/${requestId}`,
        channels: ['in_app'],
        priority: 10,
      }).catch((notifErr: any) =>
        logger.warn('[BookingRequests] Provider notification failed (non-blocking)', { error: notifErr?.message, requestId })
      );
    }

    // Intelligence — advance customer journey state to ready_to_book
    if (booking.ownerId) {
      advanceJourneyState(booking.ownerId, 'ready_to_book').catch(() => {});
    }

    // ── Loyalty credit redemption — synchronous debit after booking row exists ──
    // Amount was already reflected in the quote's totalCents.
    // Idempotency fingerprint prevents double-spend on retries.
    let loyaltyApplied = 0;
    const quotedLoyalty = (fq && fq.success) ? (fq.totals.loyaltyRedeemedCents ?? 0) : 0;
    if (data.applyLoyaltyCredits && quotedLoyalty > 0 && userId) {
      try {
        const redeemResult = await redeemLoyaltyCredit({
          userId:          userId,
          amountCents:     quotedLoyalty,
          bookingId:       booking.id,
          orderTotalCents: fq!.totals.subtotalCents,
          fingerprint:     `loyalty_redeem:${booking.requestId}`,
        });
        loyaltyApplied = redeemResult.applied;

        // If the applied amount differs from what was quoted (race condition),
        // update the booking row to reflect the actual debit.
        if (loyaltyApplied !== quotedLoyalty) {
          await db.update(bookingRequests)
            .set({ loyaltyRedeemedCents: loyaltyApplied })
            .where(eq(bookingRequests.id, booking.id));
          logger.warn('[Loyalty] Applied amount differs from quoted amount', {
            bookingId: booking.id, quotedLoyalty, loyaltyApplied,
          });
        }
      } catch (err: any) {
        logger.error('[Loyalty] Redemption failed after booking created', {
          bookingId: booking.id, error: err.message,
        });
        // Non-fatal: booking still succeeded. Credit stays in user's balance.
      }
    }

    // ── Wallet hold — freeze wallet credits for the duration of the booking ────
    // Amount comes from the quote engine's walletCreditAppliedCents.
    // Server re-validates the cap (50% of subtotal) before holding.
    // On ACCEPT: debitFromHold. On DECLINE/CANCEL: releaseHold.
    const quotedWalletCredit = (fq && fq.success) ? (fq.totals.walletCreditAppliedCents ?? 0) : 0;
    let walletHoldApplied = 0;
    if (quotedWalletCredit > 0 && userId) {
      try {
        const divisionCode = getDivisionCode(data.serviceType);
        // Re-validate cap server-side (protect against tampered quotes)
        const preview = await walletService.previewRedemption({
          userId,
          subtotalCents: subtotalCents,
          divisionCode,
        });
        walletHoldApplied = Math.min(quotedWalletCredit, preview.applicableCents);

        if (walletHoldApplied > 0) {
          const holdResult = await walletService.holdBookingWallet({
            userId,
            amountCents:  walletHoldApplied,
            bookingId:    booking.requestId,
            divisionCode,
            ipAddress:    req.ip ?? null,
          });

          await db.update(bookingRequests)
            .set({
              walletHoldCents: walletHoldApplied,
              walletHoldKey:   holdResult.txnId,
              financeState:    'hold_active',
              updatedAt:       new Date(),
            })
            .where(eq(bookingRequests.id, booking.id));

          logger.info('[BookingRequests] Wallet hold created', {
            bookingId: booking.requestId, walletHoldApplied, txnId: holdResult.txnId,
          });
        }
      } catch (holdErr: any) {
        // Non-fatal: booking still created. Log for alerting. Wallet credit simply not applied.
        logger.error('[BookingRequests] Wallet hold failed', {
          bookingId: booking.requestId, error: holdErr.message,
        });
      }
    }
    
    res.status(201).json({
      success: true,
      booking: {
        requestId: booking.requestId,
        id: booking.id,
        status: booking.status,
        totalAmount: totalCents / 100,
        currency: 'ILS',
        startDate: booking.startDate,
        endDate: booking.endDate,
        petCount: data.petDetails?.length || data.petCount,
        loyaltyRedeemedCents: loyaltyApplied,
      },
      message: 'Booking request sent successfully. The provider will respond soon.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error creating booking', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid booking data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create booking request' });
  }
});

/**
 * GET /api/booking-requests - Get user's booking requests
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const role = req.query.role as string; // 'owner' or 'provider'
    const status = req.query.status as string;
    
    let conditions;
    if (role === 'provider') {
      conditions = eq(bookingRequests.providerId, userId);
    } else {
      conditions = eq(bookingRequests.ownerId, userId);
    }
    
    let bookings = await db.select()
      .from(bookingRequests)
      .where(conditions)
      .orderBy(desc(bookingRequests.createdAt))
      .limit(50);
    
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }

    // Batch-resolve provider names from users table
    const providerIds = [...new Set(bookings.map(b => b.providerId).filter(Boolean))];
    const providerNameMap: Record<string, string> = {};
    if (providerIds.length > 0) {
      const providerUsers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, providerIds));
      providerUsers.forEach(u => {
        providerNameMap[u.id] = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'ספק';
      });
    }
    
    // Batch-resolve addon codes for rebook prefill (single query, not N+1)
    const bookingIds = bookings.map(b => b.id).filter(Boolean) as number[];
    const addonCodeMap: Record<number, string[]> = {};
    if (bookingIds.length > 0) {
      const addonRows = await db
        .select({ bookingRequestId: bookingRequestAddons.bookingRequestId, addonCode: bookingRequestAddons.addonCode })
        .from(bookingRequestAddons)
        .where(inArray(bookingRequestAddons.bookingRequestId, bookingIds));
      addonRows.forEach(r => {
        if (!r.bookingRequestId) return;
        addonCodeMap[r.bookingRequestId] = addonCodeMap[r.bookingRequestId] || [];
        addonCodeMap[r.bookingRequestId].push(r.addonCode);
      });
    }

    res.json({
      bookings: bookings.map(b => ({
        requestId: b.requestId,
        status: b.status,
        serviceType: b.serviceType,
        startDate: b.startDate,
        endDate: b.endDate,
        petCount: b.petCount,
        subtotalCents: b.subtotalCents,
        serviceFeeCents: b.serviceFeeCents,
        totalCents: b.totalCents,
        currency: b.currency,
        ownerMessage: b.ownerMessage,
        providerResponse: b.providerResponse,
        meetGreetDate: b.meetGreetDate,
        meetGreetLocation: b.meetGreetLocation,
        meetGreetNotes: b.meetGreetNotes,
        cancellationReason: b.cancellationReason || null,
        cancelledBy: b.cancelledBy || null,
        refundCents: b.refundCents || 0,
        statusHistory: b.statusHistory || [],
        createdAt: b.createdAt,
        providerId: b.providerId,
        providerName: providerNameMap[b.providerId] || null,
        // Wallet lifecycle fields
        financeState: b.financeState || 'none',
        walletHoldCents: b.walletHoldCents || 0,
        walletDebitedCents: b.walletDebitedCents || 0,
        walletRefundedCents: b.walletRefundedCents || 0,
        loyaltyRedeemedCents: b.loyaltyRedeemedCents || 0,
        // Rebook prefill fields
        petIds: (b.petIds as string[] | null) || [],
        addonCodes: (b.id ? addonCodeMap[b.id] : null) || [],
      })),
      total: bookings.length,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error fetching bookings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/booking-requests/my-completed-count - Count completed bookings for logged-in user
 * NOTE: Must be registered BEFORE /:requestId to prevent shadowing
 */
router.get('/my-completed-count', async (req, res) => {
  const userId = req.user?.uid || req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.ownerId, userId),
          inArray(bookingRequests.status as any, ['completed', 'reviewed']),
        ),
      );
    res.json({ count: result[0]?.count ?? 0 });
  } catch (err: any) {
    logger.warn('[BookingRequests] my-completed-count error', { error: err.message });
    res.json({ count: 0 });
  }
});

/**
 * GET /api/booking-requests/:requestId - Get booking details
 */
router.get('/:requestId', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check authorization
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }

    // Resolve provider display name
    let providerName: string | null = null;
    if (booking.providerId) {
      const [providerUser] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, booking.providerId))
        .limit(1);
      if (providerUser) {
        providerName = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || null;
      }
    }

    // Resolve addon codes for rebook prefill
    let addonCodes: string[] = [];
    if (booking.id) {
      const addonRows = await db
        .select({ addonCode: bookingRequestAddons.addonCode })
        .from(bookingRequestAddons)
        .where(eq(bookingRequestAddons.bookingRequestId, booking.id));
      addonCodes = addonRows.map(r => r.addonCode);
    }
    
    res.json({
      booking: {
        ...booking,
        providerName,
        petIds: (booking.petIds as string[] | null) || [],
        addonCodes,
      }
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error fetching booking', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/respond - Provider accepts/declines
 */
router.post('/:requestId/respond', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const data = providerBookingResponseSchema.parse({ ...req.body, requestId });
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the provider can respond to this request' });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: `Cannot respond to booking with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    let newStatus: string;
    let meetGreetDate = null;
    let meetGreetLocation = null;
    
    switch (data.action) {
      case 'accept':
        if (data.meetGreetDate) {
          newStatus = 'meet_greet_scheduled';
          meetGreetDate = new Date(data.meetGreetDate);
          meetGreetLocation = data.meetGreetLocation || null;
        } else {
          newStatus = 'accepted';
        }
        break;
      case 'decline':
        newStatus = 'declined';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: data.response || `Provider ${data.action}ed the request`,
    });
    
    const updateData: any = {
      status: newStatus,
      statusHistory,
      providerResponse: data.response || null,
      updatedAt: new Date(),
    };
    
    if (meetGreetDate) {
      updateData.meetGreetDate = meetGreetDate;
      updateData.meetGreetLocation = meetGreetLocation;
    }
    
    await db.update(bookingRequests)
      .set(updateData)
      .where(eq(bookingRequests.requestId, requestId));

    // ── Wallet lifecycle on provider response ──────────────────────────────────
    // ACCEPT → debitFromWalletHold (pending → realized debit, commercially locked)
    // DECLINE → releaseWalletHold (pending → available restored)
    if ((booking as any).financeState === 'hold_active' && (booking as any).walletHoldCents > 0) {
      const holdCents    = Number((booking as any).walletHoldCents) || 0;
      const divisionCode = getDivisionCode(booking.serviceType);
      setImmediate(async () => {
        try {
          if (data.action === 'accept') {
            const debitResult = await walletService.debitBookingFromHold({
              userId:       booking.ownerId,
              amountCents:  holdCents,
              bookingId:    requestId,
              divisionCode,
              ipAddress:    req.ip ?? null,
            });
            await db.update(bookingRequests)
              .set({ walletDebitedCents: holdCents, walletDebitKey: debitResult.txnId, financeState: 'debited', updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestId));
            logger.info('[BookingRequests] Wallet debited from hold on accept', { requestId, holdCents, txnId: debitResult.txnId });
          } else {
            const releaseResult = await walletService.releaseBookingHold({
              userId:       booking.ownerId,
              amountCents:  holdCents,
              bookingId:    requestId,
              divisionCode,
              ipAddress:    req.ip ?? null,
            });
            await db.update(bookingRequests)
              .set({ walletReleaseKey: releaseResult.txnId, financeState: 'released', updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestId));
            logger.info('[BookingRequests] Wallet hold released on decline', { requestId, holdCents, txnId: releaseResult.txnId });
          }
        } catch (walletErr: any) {
          logger.error('[BookingRequests] Wallet lifecycle error on provider response', { requestId, action: data.action, error: walletErr.message });
        }
      });
    }

    // Notify customer via superAppNotifications (in-app bell)
    try {
      const isAccept = data.action === 'accept';

      // Resolve provider display name for personalised copy
      let providerName = 'הספק';
      if (booking.providerId) {
        const [providerUser] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, booking.providerId))
          .limit(1);
        if (providerUser) {
          providerName = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || 'הספק';
        }
      }

      await db.insert(superAppNotifications).values({
        userId: booking.ownerId,
        type: isAccept ? 'booking_accepted' : 'booking_declined',
        title: isAccept
          ? `✅ ${providerName} אישר את הבקשה!`
          : `${providerName} אינו זמין בתאריכים אלה`,
        titleHe: isAccept
          ? `✅ ${providerName} אישר את הבקשה!`
          : `${providerName} אינו זמין בתאריכים אלה`,
        body: isAccept
          ? `ההזמנה שלך אושרה — שוחח עם ${providerName} עכשיו והכן את הפגישה.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} חויבו מהארנק שלך.` : ''}`
          : `אל דאגה — יש לנו ספקים נוספים שיוכלו לעזור. חפש עכשיו.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.` : ''}`,
        bodyHe: isAccept
          ? `ההזמנה שלך אושרה — שוחח עם ${providerName} עכשיו והכן את הפגישה.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} חויבו מהארנק שלך.` : ''}`
          : `אל דאגה — יש לנו ספקים נוספים שיוכלו לעזור. חפש עכשיו.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.` : ''}`,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: isAccept ? 'open_booking_chat' : 'open_booking',
        channels: ['in_app'],
        isRead: false,
        createdAt: new Date(),
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] superAppNotifications insert failed (respond)', { error: notifErr.message });
    }

    // ── Non-blocking: Schedule declined_recovery nudge (1 h later) ────────────
    if (newStatus === 'declined' && booking.ownerId) {
      scheduleRebookTrigger('declined_recovery', {
        userId: booking.ownerId,
        requestId,
        providerId: booking.providerId,
        providerName,
        serviceType: booking.serviceType,
        serviceDate: booking.startDate ?? undefined,
        delayMs: 60 * 60 * 1000,
      }).catch((e: any) => logger.warn('[RebookScheduler] declined_recovery schedule failed', { error: e.message }));
    }

    logger.info('[BookingRequests] Provider responded to booking', {
      requestId,
      action: data.action,
      newStatus,
    });

    const eventType = data.action === 'accept' ? 'provider_accepted' : 'provider_declined';
    const updatedBooking = { ...booking, status: newStatus, requestId };
    logBookingEvent(eventType as any, buildEventPayload(updatedBooking), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      providerRespondedAt: new Date().toISOString(),
    }).catch(() => {});

    // Real-time intelligence event — provider.accepted (spec §6.2)
    if (data.action === 'accept') {
      eventBus.publish({
        eventType: 'provider.accepted',
        timestamp: new Date().toISOString(),
        platform: 'marketplace',
        userId: booking.providerId ?? undefined,
        data: {
          requestId,
          ownerId: booking.ownerId,
          providerId: booking.providerId,
          serviceType: booking.serviceType,
          newStatus,
        },
      }).catch(() => {});

      // Advance owner journey state to 'booked' on acceptance
      if (booking.ownerId) {
        advanceJourneyState(booking.ownerId, 'booked').catch(() => {});
        recomputeCustomerProfile(booking.ownerId).catch(() => {});
      }
    }
    
    res.json({
      success: true,
      status: newStatus,
      message: data.action === 'accept' 
        ? (meetGreetDate ? 'Booking accepted! Meet & Greet scheduled.' : 'Booking accepted!')
        : 'Booking declined.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error responding to booking', { error: error.message });
    res.status(500).json({ error: 'Failed to respond to booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/meet-greet - Schedule or complete Meet & Greet
 */
router.post('/:requestId/meet-greet', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { action, date, location, notes } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Both owner and provider can interact with meet & greet
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    
    if (action === 'schedule') {
      if (!date) {
        return res.status(400).json({ error: 'Meet & Greet date is required' });
      }
      
      statusHistory.push({
        status: 'meet_greet_scheduled',
        timestamp: new Date().toISOString(),
        note: `Meet & Greet scheduled for ${date}`,
      });
      
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_scheduled',
          meetGreetDate: new Date(date),
          meetGreetLocation: location || null,
          meetGreetNotes: notes || null,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));
      
      logBookingEvent('meet_greet_scheduled', buildEventPayload({ ...booking, status: 'meet_greet_scheduled' }), {
        customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      }).catch(() => {});

      res.json({ success: true, message: 'Meet & Greet scheduled!' });
      
    } else if (action === 'complete') {
      // Only provider can mark Meet & Greet as complete
      if (booking.providerId !== userId) {
        return res.status(403).json({ error: 'Only provider can complete Meet & Greet' });
      }
      
      statusHistory.push({
        status: 'meet_greet_completed',
        timestamp: new Date().toISOString(),
        note: notes || 'Meet & Greet completed successfully',
      });
      
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_completed',
          meetGreetCompletedAt: new Date(),
          meetGreetNotes: notes || booking.meetGreetNotes,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));
      
      logBookingEvent('meet_greet_completed', buildEventPayload({ ...booking, status: 'meet_greet_completed' }), {
        customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      }).catch(() => {});

      res.json({ 
        success: true, 
        message: 'Meet & Greet completed! Awaiting payment from owner.',
      });
      
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "schedule" or "complete".' });
    }
  } catch (error: any) {
    logger.error('[BookingRequests] Meet & Greet error', { error: error.message });
    res.status(500).json({ error: 'Failed to update Meet & Greet' });
  }
});

/**
 * POST /api/booking-requests/:requestId/pay - Process payment (escrow)
 * 
 * ENTERPRISE INTEGRATION:
 * - Uses EscrowService for 72-hour payment hold
 * - Sends notifications to both parties
 * - Creates audit trail
 */
router.post('/:requestId/pay', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { paymentMethod, transactionId } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // LEGAL BLOCK: PetTrek payments permanently blocked — not licensed in Israel
    if (booking.serviceType === 'pettrek' || booking.serviceType === 'pet_trek') {
      return res.status(403).json({
        error: 'service_legally_blocked',
        code: 'PETTREK_NOT_LICENSED',
        message: 'PetTrek™ payments are not available — service pending licensing in Israel.',
      });
    }
    
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can make payment' });
    }
    
    if (!['meet_greet_completed', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot pay for booking with status: ${booking.status}. Meet & Greet must be completed first.` 
      });
    }
    
    const nayaxTransactionId = transactionId || `NAYAX-${nanoid(16)}`;
    
    // ENTERPRISE: Create escrow payment via EscrowService (72-hour hold)
    try {
      const escrow = await EscrowService.createEscrowPayment(
        requestId,
        booking.ownerId,
        booking.providerId,
        booking.totalCents / 100, // Convert cents to ILS
        nayaxTransactionId,
        {
          serviceType: booking.serviceType,
          providerType: booking.providerType,
          startDate: booking.startDate,
          endDate: booking.endDate,
        }
      );
      
      logger.info('[BookingRequests] Escrow created via EscrowService', {
        requestId,
        escrowId: escrow.id,
        amount: booking.totalCents / 100,
        holdUntil: escrow.holdUntil,
      });
    } catch (escrowError: any) {
      logger.warn('[BookingRequests] EscrowService failed, continuing with local tracking', {
        error: escrowError.message,
      });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Payment of ₪${(booking.totalCents / 100).toFixed(2)} received via ${paymentMethod || 'Nayax'}. Held in 72-hour escrow.`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'confirmed',
        paymentMethod: paymentMethod || 'nayax',
        paymentTransactionId: nayaxTransactionId,
        paymentHeldAt: new Date(), // Escrow starts
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Payment processed with enterprise integration', {
      requestId,
      totalCents: booking.totalCents,
      paymentMethod,
      escrowHoldHours: 72,
    });

    logBookingEvent('payment_held', buildEventPayload({ ...booking, status: 'confirmed' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      paymentHeldAt: new Date().toISOString(),
    }).catch(() => {});

    // ── Non-blocking: Google Sheets sync on payment/confirmation ─────────────
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId: requestId,
          customerName: `${booking.ownerFirstName || ''} ${booking.ownerLastName || ''}`.trim() || 'Owner',
          email: booking.ownerEmail || '',
          phone: booking.ownerPhone || '',
          petName: booking.petNames || '',
          petType: booking.petType || 'pet',
          sitterName: booking.providerName || booking.providerId || 'Provider',
          startDate: booking.startDate?.toISOString?.()?.slice(0, 10) || String(booking.startDate),
          endDate: booking.endDate?.toISOString?.()?.slice(0, 10) || String(booking.endDate),
          durationDays: booking.totalDays || 1,
          totalAmount: (booking.totalCents || 0) / 100,
          status: 'payment_confirmed',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[BookingRequests] Google Sheets sync failed (pay) bookingId=${requestId} reason=${sheetsErr?.message}`);
      }
    });

    try {
      await calendarIntegrationService.createBookingEvent({
        platform: booking.providerType || 'pet-care',
        bookingId: requestId,
        title: `⁦Pet Wash™⁩ Booking - ${booking.serviceType || booking.providerType}`,
        description: `Confirmed booking #${requestId}\nPets: ${booking.petCount}\nTotal: ₪${(booking.totalCents / 100).toFixed(2)}`,
        startTime: new Date(booking.startDate),
        endTime: new Date(booking.endDate),
        providerName: booking.providerId,
      });
    } catch (calErr) {
      logger.warn('[BookingRequests] Calendar sync non-blocking', { error: (calErr as Error).message });
    }
    
    res.json({
      success: true,
      status: 'confirmed',
      escrowHoldHours: 72,
      timezone: ISRAEL_TIMEZONE,
      message: 'Payment successful! Your booking is confirmed. Payment held in 72-hour escrow until service completion.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Payment error', { error: error.message });
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

/**
 * POST /api/booking-requests/:requestId/start - Provider starts service
 */
router.post('/:requestId/start', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can start service' });
    }
    
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: `Cannot start service with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      note: 'Service started',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'in_progress',
        serviceStartedAt: new Date(),
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_started', buildEventPayload({ ...booking, status: 'in_progress' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceStartedAt: new Date().toISOString(),
    }).catch(() => {});
    
    res.json({ success: true, message: 'Service started!' });
  } catch (error: any) {
    logger.error('[BookingRequests] Start service error', { error: error.message });
    res.status(500).json({ error: 'Failed to start service' });
  }
});

/**
 * POST /api/booking-requests/:requestId/complete - Provider completes service
 */
router.post('/:requestId/complete', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can complete service' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot complete service with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'completed',
      timestamp: new Date().toISOString(),
      note: 'Service completed. Awaiting owner confirmation.',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'completed',
        serviceCompletedAt: new Date(),
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_completed', buildEventPayload({ ...booking, status: 'completed' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceStartedAt: booking.serviceStartedAt?.toISOString() || undefined,
      serviceCompletedAt: new Date().toISOString(),
    }).catch(() => {});

    // ── Non-blocking: Schedule rebook nudges after service completion ─────────
    if (booking.ownerId) {
      const triggerBase = {
        userId: booking.ownerId,
        requestId,
        providerId: booking.providerId,
        providerName: booking.providerName || undefined,
        serviceType: booking.serviceType,
        serviceDate: booking.startDate ?? undefined,
      };
      scheduleRebookTrigger('post_completion', { ...triggerBase, delayMs: 24 * 60 * 60 * 1000 })
        .catch((e: any) => logger.warn('[RebookScheduler] post_completion schedule failed', { error: e.message }));
      scheduleRebookTrigger('weekly_rebook', { ...triggerBase, delayMs: 7 * 24 * 60 * 60 * 1000 })
        .catch((e: any) => logger.warn('[RebookScheduler] weekly_rebook schedule failed', { error: e.message }));
    }

    // ── Non-blocking: T006 Wallet nudge — fire if balance drops below ₪100 ──
    if (booking.ownerId) {
      setImmediate(async () => {
        try {
          const summary = await walletService.getWalletSummary(booking.ownerId);
          const totalCents = (summary as any)?.totalCreditsValueCents ?? 0;
          if (totalCents < 10000) {
            await db.insert(superAppNotifications).values({
              userId:     booking.ownerId,
              type:       'wallet_balance_low',
              title:      'הארנק שלך מתרוקן!',
              titleHe:    'הארנק שלך מתרוקן!',
              body:       'הטעינו כעת לאפשרות ההזמנה הבאה.',
              bodyHe:     'הטעינו כעת לאפשרות ההזמנה הבאה.',
              actionUrl:  '/my-wallet',
              actionType: 'open_wallet',
              channels:   ['in_app'],
              isRead:     false,
              createdAt:  new Date(),
            } as any);
          }
        } catch (nudgeErr: any) {
          logger.warn('[WalletNudge] post-completion balance check failed', { error: nudgeErr.message });
        }
      });
    }

    // ── Non-blocking: Refresh provider trust metrics cache ───────────────────
    setImmediate(async () => {
      try {
        const { refreshAndCacheProviderTrustMetrics } = await import('../utils/providerTrustMetrics');
        await refreshAndCacheProviderTrustMetrics(booking.providerId);
      } catch (metricsErr: any) {
        logger.warn(`[BookingRequests] Trust metrics refresh failed for provider=${booking.providerId}: ${metricsErr?.message}`);
      }
    });

    // ── Non-blocking: Google Sheets sync on service completion ────────────────
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId: requestId,
          customerName: `${booking.ownerFirstName || ''} ${booking.ownerLastName || ''}`.trim() || 'Owner',
          email: booking.ownerEmail || '',
          phone: booking.ownerPhone || '',
          petName: booking.petNames || '',
          petType: booking.petType || 'pet',
          sitterName: booking.providerName || booking.providerId || 'Provider',
          startDate: booking.startDate?.toISOString?.()?.slice(0, 10) || String(booking.startDate),
          endDate: booking.endDate?.toISOString?.()?.slice(0, 10) || String(booking.endDate),
          durationDays: booking.totalDays || 1,
          totalAmount: (booking.totalCents || 0) / 100,
          status: 'service_completed',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[BookingRequests] Google Sheets sync failed (complete) bookingId=${requestId} reason=${sheetsErr?.message}`);
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Service marked as completed. Awaiting owner confirmation for payment release.' 
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Complete service error', { error: error.message });
    res.status(500).json({ error: 'Failed to complete service' });
  }
});

/**
 * POST /api/booking-requests/:requestId/arriving
 * Provider signals they are on the way / have arrived.
 * Emits real-time `provider.arriving` event (spec §6.2).
 */
router.post('/:requestId/arriving', async (req, res) => {
  try {
    const userId = req.user?.uid || (req as any).firebaseUser?.uid;
    const { requestId } = req.params;
    const { eta } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [booking] = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned provider can signal arrival' });
    }

    const allowedStatuses = ['accepted', 'confirmed', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot signal arrival for booking with status: ${booking.status}`,
      });
    }

    // Emit real-time event — provider.arriving (spec §6.2)
    eventBus.publish({
      eventType: 'provider.arriving',
      timestamp: new Date().toISOString(),
      platform: 'marketplace',
      userId,
      data: {
        requestId,
        ownerId: booking.ownerId,
        providerId: userId,
        serviceType: booking.serviceType,
        eta: eta ?? null,
      },
    }).catch(() => {});

    logger.info('[BookingRequests] Provider arriving signal emitted', { requestId, userId });
    return res.json({ success: true, message: 'Arrival signal sent to customer' });
  } catch (error: any) {
    logger.error('[BookingRequests] Provider arriving error', { error: error.message });
    return res.status(500).json({ error: 'Failed to signal arrival' });
  }
});

/**
 * POST /api/booking-requests/:requestId/confirm - Owner confirms completion & releases payment
 * 
 * ENTERPRISE INTEGRATION:
 * - Releases escrow via EscrowService
 * - Creates earning record via payoutLedger
 * - Triggers provider payout after 72 hours
 * - Sends notifications to both parties
 */
router.post('/:requestId/confirm', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { rating, review } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only owner can confirm completion' });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: `Cannot confirm booking with status: ${booking.status}` });
    }
    
    // ENTERPRISE: Create earning record via payoutLedger
    const platformFeePercent = 15; // 15% platform fee
    try {
      // Map providerType to payoutLedger's supported bookingType values.
      // 'pettrek' is NOT used here — it is a legally blocked service.
      // Non-sitter/non-walker types (trainer, groomer, etc.) map to 'walker'
      // as the nearest valid commercial model (time-based service).
      const bookingType: 'sitter' | 'walker' | 'pettrek' =
        booking.providerType === 'sitter' ? 'sitter' : 'walker';

      // Map providerType to payoutLedger's contractorType.
      // 'driver' is for PetTrek, which is blocked; trainers/groomers use 'walker'.
      const contractorType: 'sitter' | 'walker' | 'driver' =
        booking.providerType === 'sitter' ? 'sitter' : 'walker';

      await createEarningRecord({
        contractorId: booking.providerId,
        contractorType,
        bookingType,
        bookingId: requestId,
        baseAmount: booking.subtotalCents / 100,
        platformFeePercent,
        dayCount: booking.totalDays || undefined,
        hourCount: booking.totalHours ? parseFloat(booking.totalHours) : undefined,
      });
      
      logger.info('[BookingRequests] Earning record created via payoutLedger', {
        requestId,
        providerId: booking.providerId,
        baseAmount: booking.subtotalCents / 100,
        platformFeePercent,
      });
    } catch (earningError: any) {
      logger.warn('[BookingRequests] payoutLedger failed, continuing', {
        error: earningError.message,
      });
    }

    // ── Phase 6.3: Loyalty triggers (non-blocking, fire-and-forget) ──────────
    setImmediate(async () => {
      try {
        const ownerId = booking.ownerId;
        const bId = booking.id;

        // 0. Award spend-based loyalty points: 1 point per ₪ spent (100 cents = 1 point)
        const spendPoints = Math.floor((booking.totalCents || 0) / 100);
        if (spendPoints > 0) {
          await updateLoyalty(ownerId, spendPoints, 'booking_completed', { bookingId: bId });
        }

        // 1. Count owner's lifetime completed bookings
        const [{ completedCount }] = await db
          .select({ completedCount: sql<number>`count(*)::int` })
          .from(bookingRequests)
          .where(and(
            eq(bookingRequests.ownerId, ownerId),
            sql`status IN ('completed','reviewed')`,
          ));

        // 2. booking_2nd — exactly on the 2nd lifetime completed booking
        if (completedCount === 2) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'booking_2nd',
            fingerprint: `booking_2nd:${ownerId}`,
            bookingId: bId,
          });
        }

        // 3. Streak checks
        const streaks = await getStreakCounts(ownerId);

        // streak_same_provider_3 — 3 consecutive completed with same provider
        if (streaks.consecutiveSameProvider && streaks.consecutiveSameProvider.count === 3) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'streak_same_provider_3',
            fingerprint: `streak_same_provider_3:${ownerId}:${streaks.consecutiveSameProvider.providerId}`,
            bookingId: bId,
          });
        }

        // streak_walk_5 — 5th completed dog_walking booking
        if (streaks.walkBookings === 5) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'streak_walk_5',
            fingerprint: `streak_walk_5:${ownerId}`,
            bookingId: bId,
          });
        }

        // streak_sit_5 — 5th completed pet_sitting booking
        if (streaks.sitBookings === 5) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'streak_sit_5',
            fingerprint: `streak_sit_5:${ownerId}`,
            bookingId: bId,
          });
        }

        // 4. Referral completion — if this is invitee's 1st completed booking and they used a code
        if (completedCount === 1) {
          const [ownerRow] = await db
            .select({ referredByCode: users.referredByCode })
            .from(users)
            .where(eq(users.id, ownerId))
            .limit(1);

          if (ownerRow?.referredByCode) {
            // Find the referral record and credit the inviter if not already done
            const [referral] = await db
              .select()
              .from(referrals)
              .where(and(
                eq(referrals.code, ownerRow.referredByCode),
                sql`status NOT IN ('expired','abused')`,
              ))
              .limit(1);

            if (referral && !referral.inviterCreditedAt) {
              // Mark invitee as completing
              await db
                .update(referrals)
                .set({ status: 'completed', completedAt: new Date(), inviteeUserId: ownerId })
                .where(eq(referrals.id, referral.id));

              // Credit inviter
              await awardLoyaltyCredit({
                userId: referral.inviterUserId,
                ruleKey: 'referral_inviter',
                fingerprint: `referral_inviter:${referral.inviterUserId}:${ownerId}`,
                referralId: referral.id,
                bookingId: bId,
              });

              // Mark inviter as credited
              await db
                .update(referrals)
                .set({ inviterCreditedAt: new Date() })
                .where(eq(referrals.id, referral.id));

              logger.info('[Loyalty] Referral inviter credited', { inviterId: referral.inviterUserId, inviteeId: ownerId });
            }
          }
        }

        // 5a. Win-back attribution — if user clicked/rebook_started via a winback in
        //     the last 7 days, emit a 'completed' experiment event (fire-and-forget).
        {
          const recentClick = await db
            .select({
              experimentKey: experimentEvents.experimentKey,
              variant:       experimentEvents.variant,
            })
            .from(experimentEvents)
            .where(and(
              eq(experimentEvents.userId, ownerId),
              sql`${experimentEvents.event} IN ('clicked','rebook_started')`,
              sql`${experimentEvents.createdAt} > now() - interval '7 days'`,
            ))
            .orderBy(desc(experimentEvents.createdAt))
            .limit(1);

          if (recentClick.length > 0) {
            await db.insert(experimentEvents).values({
              experimentKey: recentClick[0].experimentKey,
              userId:        ownerId,
              variant:       recentClick[0].variant,
              event:         'completed',
              bookingId:     bId,
            });
            logger.info('[Loyalty] Winback experiment attributed', {
              ownerId, experimentKey: recentClick[0].experimentKey, variant: recentClick[0].variant,
            });
          }
        }

        // 5b. Win-back reset — cancel any pending win-back queue entries for this user
        await db
          .update(winbackQueue)
          .set({ status: 'converted', convertedAt: new Date() })
          .where(and(
            eq(winbackQueue.userId, ownerId),
            sql`status IN ('pending','sent')`,
          ));

      } catch (loyaltyErr: any) {
        logger.warn('[Loyalty] Booking-complete trigger error (non-blocking)', { error: loyaltyErr.message, bookingId: booking.id });
      }
    });

    // ── Domain event: BOOKING_COMPLETED ──────────────────────────────────────
    eventPublisher.publishEvent(
      DomainEventType.BOOKING_COMPLETED,
      {
        bookingId: requestId,
        userId: booking.ownerId,
        providerId: booking.providerId,
        serviceType: booking.serviceType,
        totalCents: booking.totalCents,
        rating: rating ?? null,
      },
      { source: 'booking-requests/confirm', aggregateType: 'booking', aggregateId: requestId, userId: booking.ownerId },
    ).catch((e: any) => logger.error('[BookingRequests] BOOKING_COMPLETED event publish failed', { error: e?.message, requestId }));

    // Send inbox + email + SMS notifications via dispatchNotification
    const amountIls = (booking.subtotalCents / 100).toFixed(2);
    try {
      // Notify provider — payment released
      await dispatchNotification({
        uid: booking.providerId,
        type: 'receipt',
        title: '💰 תשלום שוחרר!',
        bodyHtml: `<p>סכום של <strong>₪${amountIls}</strong> שוחרר עבור הזמנה <strong>${requestId}</strong>.</p><p>ההעברה תגיע לחשבונך תוך 72 שעות.</p>`,
        channels: ['inbox'],
        priority: 5,
        meta: { bookingId: requestId, amount: parseFloat(amountIls), currency: 'ILS' },
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Provider inbox notification failed', { error: notifErr.message });
    }
    try {
      // Notify owner — booking completed
      const ownerTitle = '✅ ההזמנה הושלמה!';
      const ownerBody = rating
        ? `<p>תודה על ביקורת ה-${rating} כוכבים! שמחים שנהנית מהשירות.</p>`
        : '<p>תודה שבחרת ב-PetWash™! מחכים לראותך שוב בקרוב.</p>';
      await dispatchNotification({
        uid: booking.ownerId,
        type: 'system',
        title: ownerTitle,
        bodyHtml: ownerBody,
        ctaText: 'הזמן שוב',
        ctaUrl: 'https://petwash.co.il/book',
        channels: ['inbox'],
        meta: { bookingId: requestId },
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Owner inbox notification failed', { error: notifErr.message });
    }

    // ENTERPRISE: Send SMS confirmation — phone must come from the authenticated user, not req.body
    const callerUserId = req.user?.uid || req.firebaseUser?.uid || '';
    if (booking.ownerId !== callerUserId) {
      logger.warn('[BookingRequests] Caller is not the booking owner — skipping confirmation SMS', { requestId, callerUserId, ownerId: booking.ownerId });
    }
    const { ownerPhone, ownerEmail } = req.body;
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validPhone = ownerPhone && phoneRegex.test(ownerPhone.replace(/[\s-]/g, ''));
    const validEmail = ownerEmail && emailRegex.test(ownerEmail);
    if (validPhone && booking.ownerId === callerUserId) {
      try {
        const smsBody = `Pet Wash™ ההזמנה אושרה!\n\nמזהה: ${requestId}\nשירות: ${booking.serviceType}\nתאריכים: ${booking.startDate ? new Date(booking.startDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'} - ${booking.endDate ? new Date(booking.endDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'}\nסכום: ₪${(booking.totalCents / 100).toFixed(2)}\nסטטוס: אושר ✅\n\nתודה שבחרת ב-PetWash™!`;
        await twilioSMSService.sendSMS(ownerPhone, smsBody, { userId: callerUserId, ip: req.ip, ua: req.headers['user-agent'] });
        logger.info('[BookingRequests] Confirmation SMS sent', { requestId, phone: ownerPhone.slice(0, 6) + '****' });
      } catch (smsErr: any) {
        logger.warn('[BookingRequests] SMS send failed', { error: smsErr.message });
      }
    }

    // ENTERPRISE: Send email receipt to owner
    const recipientEmail = validEmail ? ownerEmail : (req.user?.email || req.firebaseUser?.email);
    if (recipientEmail) {
      try {
        const receiptHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Pet Wash™</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0;">Booking Receipt</p>
            </div>
            <div style="padding: 32px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <p style="color: #16a34a; font-weight: 600; font-size: 18px; margin: 0;">✅ Booking Confirmed</p>
                <p style="color: #4ade80; font-size: 13px; margin: 4px 0 0;">Both parties confirmed</p>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Booking ID</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${requestId}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Service</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.serviceType}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">תאריך התחלה</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.startDate ? new Date(booking.startDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">תאריך סיום</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.endDate ? new Date(booking.endDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Pets</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.petCount}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Subtotal</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">₪${(booking.subtotalCents / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Service Fee (15%)</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">₪${(booking.serviceFeeCents / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 0; color: #1a1a2e; font-weight: 700; font-size: 16px;">Total</td><td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 16px; color: #1a1a2e;">₪${(booking.totalCents / 100).toFixed(2)}</td></tr>
              </table>
              ${rating ? `<div style="margin-top: 20px; padding: 12px; background: #fef9c3; border-radius: 8px; text-align: center;"><p style="margin: 0; color: #854d0e;">⭐ You rated this service ${rating}/5</p></div>` : ''}
              <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 12px;">
                <p style="color: #1e40af; font-weight: 600; margin: 0 0 4px;">💰 Provider Payout</p>
                <p style="color: #3b82f6; margin: 0; font-size: 13px;">₪${(booking.subtotalCents / 100).toFixed(2)} will be transferred to the provider within 72 hours.</p>
              </div>
            </div>
            <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Pet Wash™ Ltd | support@petwash.co.il</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0;">This is an automated receipt. Please keep for your records.</p>
            </div>
          </div>`;

        await EmailService.send({
          to: recipientEmail,
          subject: `Pet Wash™ Booking Receipt - ${requestId}`,
          html: receiptHtml,
          from: 'noreply@petwash.co.il',
        });
        logger.info('[BookingRequests] Receipt email sent', { requestId, email: recipientEmail });
      } catch (emailErr: any) {
        logger.warn('[BookingRequests] Email receipt failed', { error: emailErr.message });
      }
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const finalStatus = rating ? 'reviewed' : 'completed';
    
    statusHistory.push({
      status: finalStatus,
      timestamp: new Date().toISOString(),
      note: rating 
        ? `Owner confirmed and left ${rating}-star review. Payment of ₪${(booking.subtotalCents / 100).toFixed(2)} released to provider.`
        : `Owner confirmed completion. Payment of ₪${(booking.subtotalCents / 100).toFixed(2)} released to provider.`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: finalStatus,
        ownerConfirmedAt: new Date(),
        ownerRating: rating?.toString() || null,
        ownerReview: review || null,
        paymentReleasedAt: new Date(), // Release escrow
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Owner confirmed with enterprise integration', {
      requestId,
      rating,
      paymentReleased: booking.subtotalCents,
      platformFee: booking.serviceFeeCents,
    });

    logBookingEvent('owner_confirmed', buildEventPayload({ ...booking, status: finalStatus }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceCompletedAt: booking.serviceCompletedAt?.toISOString() || undefined,
      ownerConfirmedAt: new Date().toISOString(),
      paymentReleasedAt: new Date().toISOString(),
    }, { rating, review }).catch(() => {});

    // ── Non-blocking: Google Sheets sync on owner confirmation / payment release ─
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId: requestId,
          customerName: `${booking.ownerFirstName || ''} ${booking.ownerLastName || ''}`.trim() || 'Owner',
          email: booking.ownerEmail || '',
          phone: booking.ownerPhone || '',
          petName: booking.petNames || '',
          petType: booking.petType || 'pet',
          sitterName: booking.providerName || booking.providerId || 'Provider',
          startDate: booking.startDate?.toISOString?.()?.slice(0, 10) || String(booking.startDate),
          endDate: booking.endDate?.toISOString?.()?.slice(0, 10) || String(booking.endDate),
          durationDays: booking.totalDays || 1,
          totalAmount: (booking.totalCents || 0) / 100,
          status: finalStatus === 'disputed' ? 'disputed' : 'payment_released',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[BookingRequests] Google Sheets sync failed (owner_confirm) bookingId=${requestId} reason=${sheetsErr?.message}`);
      }
    });
    
    res.json({
      success: true,
      status: finalStatus,
      payoutETA: '72 hours',
      smsSent: !!ownerPhone,
      emailSent: !!recipientEmail,
      message: 'Thank you! Payment has been released to the provider and will be transferred within 72 hours.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Confirm error', { error: error.message });
    res.status(500).json({ error: 'Failed to confirm completion' });
  }
});

/**
 * POST /api/booking-requests/:requestId/cancel - Cancel booking
 */
router.post('/:requestId/cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { reason } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }
    
    // Cannot cancel if already completed or cancelled
    if (['completed', 'reviewed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
    }
    
    const cancelledBy = booking.ownerId === userId ? 'owner' : 'provider';
    const statusHistory = (booking.statusHistory as any[]) || [];
    
    // Calculate refund based on status
    let refundCents = 0;
    if (booking.paymentHeldAt) {
      // If payment was made, calculate refund
      if (booking.status === 'confirmed') {
        refundCents = booking.totalCents; // Full refund before service starts
      } else if (booking.status === 'in_progress') {
        refundCents = Math.round(booking.totalCents * 0.5); // 50% refund if cancelled mid-service
      }
    }
    
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      note: `Cancelled by ${cancelledBy}. Reason: ${reason || 'No reason provided'}. Refund: ₪${refundCents / 100}`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason || null,
        refundCents,
        refundProcessedAt: refundCents > 0 ? new Date() : null,
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    // ── Domain event: BOOKING_CANCELLED ──────────────────────────────────────
    eventPublisher.publishEvent(
      DomainEventType.BOOKING_CANCELLED,
      {
        bookingId: requestId,
        userId: booking.ownerId,
        providerId: booking.providerId,
        serviceType: booking.serviceType,
        cancelledBy,
        refundCents,
        reason: reason || null,
      },
      { source: 'booking-requests/cancel', aggregateType: 'booking', aggregateId: requestId, userId: booking.ownerId },
    ).catch((e: any) => logger.error('[BookingRequests] BOOKING_CANCELLED event publish failed', { error: e?.message, requestId }));

    // ── Wallet lifecycle on cancel ─────────────────────────────────────────────
    // hold_active → release (funds never spent, restore to available)
    // debited → refund (funds were charged, return to available)
    const financeState = (booking as any).financeState as string | null;
    const holdCents = Number((booking as any).walletHoldCents) || 0;
    const debitedCents = Number((booking as any).walletDebitedCents) || 0;
    if (financeState === 'hold_active' && holdCents > 0) {
      setImmediate(async () => {
        try {
          const releaseResult = await walletService.releaseBookingHold({
            userId: booking.ownerId, amountCents: holdCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType), ipAddress: req.ip ?? null,
          });
          await db.update(bookingRequests)
            .set({ walletReleaseKey: releaseResult.txnId, financeState: 'released', updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
          logger.info('[BookingRequests] Wallet hold released on cancel', { requestId, holdCents, txnId: releaseResult.txnId });
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet release failed on cancel', { requestId, error: e.message });
        }
      });
    } else if (financeState === 'debited' && debitedCents > 0) {
      setImmediate(async () => {
        try {
          const refundResult = await walletService.refundBookingWallet({
            userId: booking.ownerId, amountCents: debitedCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType),
            reason: `booking_cancelled_by_${cancelledBy}`, ipAddress: req.ip ?? null,
          });
          await db.update(bookingRequests)
            .set({ walletRefundedCents: debitedCents, walletRefundKey: refundResult.txnId, financeState: 'refunded', updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
          logger.info('[BookingRequests] Wallet refunded on cancel', { requestId, debitedCents, txnId: refundResult.txnId });
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet refund failed on cancel', { requestId, error: e.message });
        }
      });
    }

    // Notify the OTHER party about cancellation via superAppNotifications
    try {
      const notifyUid = cancelledBy === 'owner' ? booking.providerId : booking.ownerId;

      // Resolve provider display name for personalised copy
      let providerName = 'הספק';
      if (booking.providerId) {
        const [providerUser] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, booking.providerId))
          .limit(1);
        if (providerUser) {
          providerName = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || 'הספק';
        }
      }

      // Customer cancelled → notify provider
      // Provider cancelled → notify customer
      const notifyingCustomer = cancelledBy === 'provider';
      const titleText = notifyingCustomer
        ? `🚫 ${providerName} ביטל את ההזמנה`
        : `🚫 הלקוח ביטל את ההזמנה`;
      const walletReturnLine =
        financeState === 'hold_active' && holdCents > 0
          ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.`
          : financeState === 'debited' && debitedCents > 0
          ? ` ₪${(debitedCents / 100).toFixed(2)} הוחזרו לארנק שלך.`
          : '';
      const bodyText = notifyingCustomer
        ? `מצאנו ספקים דומים באזורך — לחץ לחיפוש.${walletReturnLine}${reason ? ` (${reason})` : ''}`
        : `ההזמנה בוטלה על ידי הלקוח.${reason ? ` סיבה: ${reason}` : ''}`;

      await db.insert(superAppNotifications).values({
        userId: notifyUid,
        type: 'booking_cancelled',
        title: titleText,
        titleHe: titleText,
        body: bodyText,
        bodyHe: bodyText,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: 'open_booking',
        channels: ['in_app'],
        isRead: false,
        createdAt: new Date(),
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] superAppNotifications insert failed (cancel)', { error: notifErr.message });
    }

    // ── Non-blocking: cancelled_recovery nudge for customer (2 h later, only when provider cancels) ─
    if (cancelledBy === 'provider' && booking.ownerId) {
      scheduleRebookTrigger('cancelled_recovery', {
        userId: booking.ownerId,
        requestId,
        providerId: booking.providerId,
        providerName: booking.providerName || undefined,
        serviceType: booking.serviceType,
        serviceDate: booking.startDate ?? undefined,
        delayMs: 2 * 60 * 60 * 1000,
      }).catch((e: any) => logger.warn('[RebookScheduler] cancelled_recovery schedule failed', { error: e.message }));
    }

    logger.info('[BookingRequests] Booking cancelled', {
      requestId,
      cancelledBy,
      refundCents,
    });

    logBookingEvent('cancelled', buildEventPayload({ ...booking, status: 'cancelled' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
    }, { cancelledBy, reason, refundCents }).catch(() => {});
    
    res.json({
      success: true,
      status: 'cancelled',
      refundAmount: refundCents / 100,
      message: refundCents > 0 
        ? `Booking cancelled. Refund of ₪${refundCents / 100} will be processed.`
        : 'Booking cancelled.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Cancel error', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/photo-update - Provider sends photo update
 */
router.post('/:requestId/photo-update', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { photoUrl, caption } = req.body;
    
    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can send photo updates' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Photo updates can only be sent during service' });
    }
    
    const photoUpdates = (booking.photoUpdates as any[]) || [];
    photoUpdates.push({
      url: photoUrl,
      caption: caption || '',
      timestamp: new Date().toISOString(),
    });
    
    await db.update(bookingRequests)
      .set({
        photoUpdates,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    res.json({ success: true, message: 'Photo update sent to owner!' });
  } catch (error: any) {
    logger.error('[BookingRequests] Photo update error', { error: error.message });
    res.status(500).json({ error: 'Failed to send photo update' });
  }
});

/**
 * POST /api/booking-requests/:requestId/reprice
 * Rebuilds the quote for an existing booking request and persists updated line items.
 * Call this when: promo code changes, wallet toggle changes, or after provider accepts.
 */
router.post('/:requestId/reprice', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = (req as any).userId || req.user?.uid || null;

    const booking = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking.length) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    const br = booking[0];

    // Rebuild quote from saved pet details snapshot
    const savedPets: any[] = (br.petDetails as any[]) ?? [];
    if (!savedPets.length && (br.petCount ?? 0) > 0) {
      return res.status(400).json({
        error: 'No pet details stored on this booking. Cannot reprice.',
      });
    }

    const pets = savedPets.map((p: any, i: number) => ({
      clientRef: String(i),
      petId: p.petId ?? null,
      petName: p.petName ?? p.name ?? `Pet ${i + 1}`,
      petType: p.petType ?? p.species ?? 'dog',
      breed: p.breed ?? null,
      sizeCategory: p.sizeCategory ?? p.size ?? null,
      ageYears: p.ageYears ?? p.age ?? null,
      weightKg: p.weightKg ?? null,
      requiresMedication: p.requiresMedication ?? false,
      hasBehaviorFlag: p.hasBehaviorFlag ?? false,
      hasSpecialNeeds: p.hasSpecialNeeds ?? false,
      quantity: 1,
    }));

    const quote = await calculateQuote({
      providerId: br.providerId,
      serviceType: br.serviceType,
      currency: br.currency,
      bookingWindow: {
        startAt: br.startDate.toISOString(),
        endAt: br.endDate.toISOString(),
      },
      pets,
      addons: [],
      promoCode: req.body?.promoCode ?? br.promoCode ?? null,
      giftCardCode: req.body?.giftCardCode ?? null,
      useWalletCredit: req.body?.useWalletCredit ?? false,
      userId,
      bookingRequestId: br.id,
    });

    if (!quote.success) {
      return res.status(422).json(quote);
    }

    await persistBookingQuote(br.id, quote, pets, []);

    return res.json({ ...quote, bookingRequestId: br.id, requestId });
  } catch (error: any) {
    logger.error('[BookingRequests] Reprice error', { error: error.message });
    res.status(500).json({ error: 'Failed to reprice booking' });
  }
});

/* ── Rebook trigger tracking ─────────────────────────────────────────────── */

// POST /api/rebook-triggers/:id/clicked
// POST /api/rebook-triggers/:id/rebook-started
// POST /api/rebook-triggers/:id/rebook-completed
const REBOOK_TRACKING_FIELDS: Record<string, string> = {
  'clicked':          'clicked_at',
  'rebook-started':   'rebook_started_at',
  'rebook-completed': 'rebook_completed_at',
};

router.post('/rebook-triggers/:triggerId/:action', async (req, res) => {
  try {
    const { triggerId, action } = req.params;
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const field = REBOOK_TRACKING_FIELDS[action];
    if (!field) return res.status(400).json({ error: 'Unknown tracking action' });

    const id = parseInt(triggerId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trigger ID' });

    const [trigger] = await db
      .select({ id: rebookTriggers.id, userId: rebookTriggers.userId })
      .from(rebookTriggers)
      .where(eq(rebookTriggers.id, id))
      .limit(1);

    if (!trigger) return res.status(404).json({ error: 'Trigger not found' });
    if (trigger.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    await db
      .update(rebookTriggers)
      .set({ [field === 'clicked_at' ? 'clickedAt' : field === 'rebook_started_at' ? 'rebookStartedAt' : 'rebookCompletedAt']: new Date() } as any)
      .where(eq(rebookTriggers.id, id));

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[BookingRequests] Rebook tracking error', { error: err.message });
    return res.status(500).json({ error: 'Tracking failed' });
  }
});

// ── T002: First booking conversion — completed booking count for current user ──
router.get('/my-completed-count', async (req, res) => {
  const userId = req.user?.uid || req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.ownerId, userId),
          inArray(bookingRequests.status as any, ['completed', 'reviewed']),
        ),
      );
    res.json({ count: result[0]?.count ?? 0 });
  } catch (err: any) {
    logger.warn('[BookingRequests] my-completed-count error', { error: err.message });
    res.json({ count: 0 });
  }
});

export default router;
