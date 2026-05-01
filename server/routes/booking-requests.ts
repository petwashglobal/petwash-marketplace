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
  providerProfiles,
  createBookingRequestSchema,
  providerBookingResponseSchema,
  type BookingRequest
} from '@shared/schema';
import { eq, and, desc, sql, or, inArray, ne } from 'drizzle-orm';
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
import { applyTransition, type BookingStatus } from '@shared/lib/bookingStateMachine';
import { cityKey, stripHebrewStreetPrefix, normalizeIsraeliPostalCode } from '@shared/lib/address';
import { BLOCKING_STATUSES } from '@shared/lib/bookingOverlap';
import { walletService } from '../services/WalletService';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { eventBus } from '../services/EventBus';
import { recomputeCustomerProfile, advanceJourneyState } from '../services/CustomerIntelligenceService';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';
import VATCalculatorService from '../services/VATCalculatorService';

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

    // ARCHITECTURE BLOCK (Phase B6): K9000 self-service kiosks must NEVER
    // create a marketplace booking_request row. K9000 is the Nayax + QR
    // self-service flow — two bays as kiosk capacity, no appointment, no
    // accept/decline cycle, no provider lifecycle. Walk-up customers tap
    // the Nayax terminal directly; registered customers redeem credit /
    // loyalty / e-gift via the Nayax QR reader.
    //
    // The legacy `'k9000'` value in the providerType enum exists for
    // reporting compatibility only. Reject it explicitly here so future
    // code can never accidentally pull K9000 into the marketplace flow.
    const rawProviderType = req.body?.providerType;
    if (rawProviderType === 'k9000' || rawServiceType === 'k9000_wash') {
      logger.warn('[BookingRequests] K9000 booking attempt rejected — kiosk flow only', {
        userId, providerType: rawProviderType, serviceType: rawServiceType,
      });
      return res.status(400).json({
        error: 'K9000 stations are self-service kiosks — no booking required.',
        code: 'K9000_NOT_A_BOOKING',
        message: 'Use the Nayax terminal at the station (tap-to-pay) or the mobile QR / numeric code redemption flow. K9000 sessions are not appointments.',
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
    
    // ── Phase B6 — customer address snapshot ──────────────────────────────────
    // Freeze the customer's address at booking-create time so the booking
    // row has a permanent record of WHERE the service was requested,
    // independent of the customer's mutable profile address. All fields
    // optional — legacy callers without the autocomplete keep working.
    const addrSrc = (data as any).customerAddress ?? null;
    const addressSnapshot = addrSrc ? {
      customerAddress:      addrSrc.formattedAddress?.slice(0, 5000) ?? null,
      customerStreet:       addrSrc.street ? stripHebrewStreetPrefix(addrSrc.street).slice(0, 200) : null,
      customerStreetNumber: addrSrc.streetNumber?.toString().slice(0, 40) ?? null,
      customerApartment:    addrSrc.apartment?.toString().slice(0, 80) ?? null,
      customerCity:         addrSrc.city?.toString().slice(0, 120) ?? null,
      customerCityKey:      addrSrc.city ? cityKey(addrSrc.city).slice(0, 60) : null,
      customerCountry:      addrSrc.country?.toString().slice(0, 2).toUpperCase() ?? null,
      customerPostalCode:   normalizeIsraeliPostalCode(addrSrc.postalCode ?? null),
      customerLatitude:     typeof addrSrc.latitude === 'number' && Number.isFinite(addrSrc.latitude)
                              ? String(addrSrc.latitude) : null,
      customerLongitude:    typeof addrSrc.longitude === 'number' && Number.isFinite(addrSrc.longitude)
                              ? String(addrSrc.longitude) : null,
      customerPlaceId:      addrSrc.placeId?.toString().slice(0, 200) ?? null,
    } : {};

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
      ...addressSnapshot,
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

    // Notify provider of new booking request — in-app + email + SMS (non-blocking, best-effort)
    if (booking.providerId) {
      // Fetch provider contact details for email/SMS channels
      const [providerUser] = await db
        .select({ email: users.email, phone: users.phone })
        .from(users)
        .where(eq(users.id, booking.providerId))
        .limit(1)
        .catch(() => []);

      const serviceLabel = data.serviceType?.replace(/_/g, ' ') || 'service';
      const notifBody = `You have a new ${serviceLabel} booking request. Check your dashboard to accept or decline.`;

      dispatchNotification({
        uid: booking.providerId,
        email: providerUser?.email ?? undefined,
        phone: providerUser?.phone ?? undefined,
        type: 'booking_request',
        title: '📅 New Booking Request',
        bodyHtml: `<p>You have a new <strong>${serviceLabel}</strong> booking request.</p><p>Please <a href="${process.env.APP_URL || 'https://petwash.co.il'}/provider/bookings/${requestId}">review and respond</a> within 24 hours.</p>`,
        bodyText: notifBody,
        ctaText: 'View Booking',
        ctaUrl: `${process.env.APP_URL || 'https://petwash.co.il'}/provider/bookings/${requestId}`,
        channels: ['in_app', 'email', 'sms'],
        priority: 10,
      }).catch((notifErr: any) =>
        logger.warn('[BookingRequests] Provider notification failed (non-blocking)', { error: notifErr?.message, requestId })
      );
    }

    // Intelligence — advance customer journey state to ready_to_book
    if (booking.ownerId) {
      advanceJourneyState(booking.ownerId, 'ready_to_book').catch(err => logger.warn('[BookingRequests] advanceJourneyState ready_to_book failed', { ownerId: booking.ownerId, err: err?.message }));
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
    
    // role determines which side of the booking to filter on (owner vs provider).
    // Either way, the query is scoped to the authenticated user's own UID — no IDOR risk.
    const role = req.query.role as string; // 'provider' or anything else → defaults to owner
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

    // T10: BGC enforcement — provider must have an approved background check before accepting
    if (data.action === 'accept') {
      const [profile] = await db
        .select({ backgroundCheckStatus: providerProfiles.backgroundCheckStatus })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId!))
        .limit(1);
      if (!profile || profile.backgroundCheckStatus !== 'approved') {
        logger.warn('[BookingRequests] Provider accept blocked — BGC not approved', { providerId: userId, backgroundCheckStatus: profile?.backgroundCheckStatus });
        return res.status(403).json({
          error: 'BACKGROUND_CHECK_REQUIRED',
          message: 'Your background check must be approved before you can accept bookings.',
        });
      }
    }

    const statusHistory = (booking.statusHistory as any[]) || [];
    let meetGreetDate = null;
    let meetGreetLocation = null;
    let newStatus: BookingStatus;

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

    // Centralised state-machine guard (Phase B2). Replaces the previous
    // bare `if (booking.status !== 'pending')` check. The machine knows
    // which actor is allowed to drive each transition AND which terminal
    // states block any further movement.
    const transition = applyTransition({
      from: booking.status,
      to: newStatus,
      actor: 'provider',
      actorId: userId ?? null,
      note: data.response || `Provider ${data.action}ed the request`,
    });
    if (!transition.result.ok) {
      logger.warn('[BookingRequests] Provider response rejected by state machine', {
        requestId, from: booking.status, to: newStatus, code: transition.result.code,
      });
      return res.status(transition.result.statusCode).json({
        error: transition.result.error,
        code: transition.result.code,
      });
    }
    statusHistory.push(transition.historyEntry);
    
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

    // ── Phase B4 — Provider double-booking lock ──────────────────────────────
    // Wrap the status flip in a Postgres transaction with SELECT FOR UPDATE
    // so two parallel /respond accepts can never both succeed against the
    // same booking AND so we can atomically check whether the provider
    // already holds a conflicting active booking.
    //
    // For 'decline' we skip the overlap check entirely — declining never
    // conflicts with anything.
    if (data.action === 'accept') {
      try {
        await db.transaction(async (tx) => {
          // 1. Lock the row we are about to update — prevents a parallel
          //    accept from beating us to the status flip.
          const [locked] = await tx.select()
            .from(bookingRequests)
            .where(eq(bookingRequests.requestId, requestId))
            .for('update')
            .limit(1);
          if (!locked) throw new Error('BOOKING_NOT_FOUND_AFTER_LOCK');
          if (locked.status !== 'pending') {
            // Someone else moved the booking after our state-machine
            // check above. Re-throw a structured conflict.
            throw Object.assign(new Error('BOOKING_RACE_CONDITION'), {
              petwashCode: 'RACE_CONDITION',
              currentStatus: locked.status,
            });
          }

          // 2. Look for other ACTIVE bookings on the same provider whose
          //    [start, end) overlaps the candidate's [start, end).
          //    BLOCKING_STATUSES from shared/lib/bookingOverlap.
          const conflicts = await tx.select({
              requestId: bookingRequests.requestId,
              status:    bookingRequests.status,
              startDate: bookingRequests.startDate,
              endDate:   bookingRequests.endDate,
            })
            .from(bookingRequests)
            .where(and(
              eq(bookingRequests.providerId, booking.providerId),
              ne(bookingRequests.requestId, requestId),
              inArray(bookingRequests.status, BLOCKING_STATUSES as any),
              // half-open overlap — ranges touch (cand.end === existing.start)
              // do NOT count as conflict.
              sql`${bookingRequests.startDate} < ${locked.endDate}`,
              sql`${bookingRequests.endDate} > ${locked.startDate}`,
            ))
            .limit(1);

          if (conflicts.length > 0) {
            throw Object.assign(new Error('PROVIDER_DOUBLE_BOOKING'), {
              petwashCode: 'PROVIDER_DOUBLE_BOOKING',
              conflictingBookingId: conflicts[0].requestId,
              conflictingStatus:    conflicts[0].status,
            });
          }

          // 3. Status flip — INSIDE the transaction.
          await tx.update(bookingRequests)
            .set(updateData)
            .where(eq(bookingRequests.requestId, requestId));
        });
      } catch (lockErr: any) {
        const code = lockErr?.petwashCode;
        if (code === 'PROVIDER_DOUBLE_BOOKING') {
          logger.warn('[BookingRequests] Accept rejected — provider already booked at this time', {
            requestId,
            providerId: booking.providerId,
            conflictingBookingId: lockErr.conflictingBookingId,
          });
          return res.status(409).json({
            error: 'You already have another booking that overlaps this time slot.',
            code: 'PROVIDER_DOUBLE_BOOKING',
            conflictingBookingId: lockErr.conflictingBookingId,
          });
        }
        if (code === 'RACE_CONDITION') {
          logger.warn('[BookingRequests] Accept rejected — booking was modified concurrently', {
            requestId, currentStatus: lockErr.currentStatus,
          });
          return res.status(409).json({
            error: `Cannot respond — booking is already in status '${lockErr.currentStatus}'.`,
            code: 'RACE_CONDITION',
          });
        }
        // Anything else propagates up to the outer catch.
        throw lockErr;
      }
    } else {
      // 'decline' branch — single update, no overlap check.
      await db.update(bookingRequests)
        .set(updateData)
        .where(eq(bookingRequests.requestId, requestId));
    }

    // ── Calendar sync on provider ACCEPT (Phase B1) ──────────────────────────
    // Create a Google Calendar event tagged with petwash_booking_id so:
    //   • the provider sees the booking on their work calendar
    //   • the customer (if email available) receives an invitation
    //   • re-running this handler is idempotent (no duplicate events)
    //   • a missing GOOGLE_SERVICE_ACCOUNT_JSON quietly skips — never blocks
    // The platform_calendar_event_id column stores the Google event id so
    // we can target updates / deletes precisely later.
    if (data.action === 'accept') {
      setImmediate(async () => {
        try {
          const eventStart = meetGreetDate ?? booking.startDate;
          const eventEnd = booking.endDate ?? new Date(new Date(eventStart).getTime() + 60 * 60 * 1000);
          // Best-effort fetch of attendee emails (owner + provider).
          let ownerEmail: string | undefined;
          let providerEmail: string | undefined;
          try {
            const [owner] = await db.select({ email: users.email })
              .from(users).where(eq(users.id, booking.ownerId)).limit(1);
            ownerEmail = owner?.email ?? undefined;
            const [prov] = await db.select({ email: users.email })
              .from(users).where(eq(users.id, booking.providerId)).limit(1);
            providerEmail = prov?.email ?? undefined;
          } catch { /* non-fatal — calendar event still creates without invites */ }
          const attendeeEmails = [ownerEmail, providerEmail].filter((e): e is string => !!e);

          const result = await calendarIntegrationService.createBookingEvent({
            platform: booking.providerType || booking.serviceType || 'PetWash',
            bookingId: requestId,
            title: `PetWash™ — ${booking.serviceType || 'Booking'}`,
            description: data.response || booking.ownerMessage || `Booking ${requestId}`,
            startTime: new Date(eventStart),
            endTime: new Date(eventEnd),
            location: meetGreetLocation || undefined,
            customerName: booking.ownerId,
            providerName: booking.providerId,
            attendeeEmails,
          });

          if (result?.eventId) {
            await db.update(bookingRequests)
              .set({
                platformCalendarEventId: result.eventId,
                calendarAttendeesSynced: attendeeEmails.length > 0,
                updatedAt: new Date(),
              })
              .where(eq(bookingRequests.requestId, requestId));
            logger.info('[BookingRequests] Calendar event linked to booking', {
              requestId, eventId: result.eventId, attendees: attendeeEmails.length,
            });
          }
        } catch (calErr: any) {
          // Never block the accept response on a calendar failure.
          logger.warn('[BookingRequests] Calendar create failed (non-blocking)', {
            requestId, error: calErr?.message,
          });
        }
      });
    }

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

    // ── Non-blocking: email + SMS to customer on acceptance ──────────────────
    if (data.action === 'accept') {
      (async () => {
        try {
          const [ownerUser] = await db
            .select({ email: users.email, phone: users.phone, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, booking.ownerId))
            .limit(1);
          if (ownerUser) {
            const customerName = ownerUser.firstName || 'לקוח';
            const serviceDateStr = booking.startDate
              ? new Date(booking.startDate).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—';
            const amountStr = holdCents > 0 ? `₪${(holdCents / 100).toFixed(2)}` : `₪${(booking.totalCents / 100).toFixed(2)}`;
            const confirmUrl = `https://petwash.co.il/booking/confirmation/${requestId}`;
            const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;background:#fff;color:#000;">
<h2 style="color:#000;">✅ ההזמנה שלך אושרה! — PetWash™</h2>
<p>שלום ${customerName},</p>
<p>${providerName} אישר/ה את בקשתך. כל הפרטים נמצאים למטה:</p>
<table style="border-collapse:collapse;width:100%;max-width:480px;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;">שירות</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${booking.serviceType || '—'}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;">ספק</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${providerName}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;">תאריך</td><td style="padding:8px;border-bottom:1px solid #eee;">${serviceDateStr}</td></tr>
  <tr><td style="padding:8px;">סכום</td><td style="padding:8px;font-weight:bold;">${amountStr}</td></tr>
</table>
<p><a href="${confirmUrl}" style="background:#000;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">פתח/י את ההזמנה</a></p>
<p style="margin-top:24px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il</p>
</body></html>`;
            await dispatchNotification({
              uid: booking.ownerId,
              email: ownerUser.email || undefined,
              phone: ownerUser.phone || undefined,
              type: 'booking_accepted',
              title: `✅ ${providerName} אישר את הבקשה! – PetWash™`,
              bodyHtml: htmlBody,
              bodyText: `ההזמנה שלך אושרה!\nספק: ${providerName}\nתאריך: ${serviceDateStr}\nסכום: ${amountStr}\nפרטים: ${confirmUrl}`,
              channels: ['email', 'sms'],
            });
          }
        } catch (multiChanErr: any) {
          logger.warn('[BookingRequests] email/SMS dispatch failed on acceptance (non-fatal)', { error: multiChanErr.message });
        }
      })();
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
        advanceJourneyState(booking.ownerId, 'booked').catch(err => logger.warn('[BookingRequests] advanceJourneyState booked failed', { ownerId: booking.ownerId, err: err?.message }));
        recomputeCustomerProfile(booking.ownerId).catch(err => logger.warn('[BookingRequests] recomputeCustomerProfile failed', { ownerId: booking.ownerId, err: err?.message }));
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
    
    // Initiate a real Nayax hosted payment session.
    // Booking transitions to 'payment_pending' here.
    // It becomes 'confirmed' ONLY when Nayax calls POST /api/webhooks/nayax/booking-request-payment
    // with event = 'payment.success'.  No fake transaction IDs are generated.
    const { NayaxOnlinePaymentService } = await import('../services/NayaxOnlinePaymentService');
    const appUrl = process.env.APP_URL || 'https://petwash.co.il';

    // Fetch owner email for the payment session (optional — enriches Nayax receipt).
    const [ownerUser] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, booking.ownerId))
      .limit(1);

    const sessionResult = await NayaxOnlinePaymentService.createPaymentSession({
      bookingId: requestId,
      bookingNumber: requestId,
      amountCents: booking.totalCents,
      customerEmail: ownerUser?.email || undefined,
      customerName: ownerUser?.firstName || undefined,
      description: `PetWash™ ${booking.serviceType} — ${booking.petCount ?? 1} pet(s)`,
      returnUrl: `${appUrl}/booking/confirmation/${requestId}?payment=success`,
      cancelUrl: `${appUrl}/booking/confirmation/${requestId}?payment=cancelled`,
      webhookUrl: `${appUrl}/api/webhooks/nayax/booking-request-payment`,
    });

    if (!sessionResult.success) {
      logger.error('[BookingRequests] Nayax payment session creation failed', {
        requestId, error: sessionResult.error,
      });
      return res.status(502).json({
        error: 'Payment gateway unavailable. Please try again.',
        errorCode: 'PAYMENT_SESSION_FAILED',
      });
    }

    const sessionId = sessionResult.sessionId || `SESSION-${requestId}`;
    if (!sessionResult.sessionId) {
      logger.warn('[BookingRequests] Nayax session created without a sessionId — using fallback placeholder; webhook reconciliation may be affected', { requestId });
    }

    // Create the Firestore escrow record with the session ID as a placeholder.
    // The webhook will update it to the real transaction ID on confirmation.
    try {
      const escrow = await EscrowService.createEscrowPayment(
        requestId,
        booking.ownerId,
        booking.providerId,
        booking.totalCents / 100,
        sessionId, // placeholder until real txId arrives from webhook
        {
          serviceType: booking.serviceType,
          providerType: booking.providerType,
          startDate: booking.startDate,
          endDate: booking.endDate,
        }
      );
      logger.info('[BookingRequests] Escrow record created (pending payment confirmation)', {
        requestId, escrowId: escrow.id, amount: booking.totalCents / 100,
      });
    } catch (escrowError: any) {
      logger.error('[BookingRequests] Escrow creation FAILED — aborting payment initiation', {
        error: escrowError.message, requestId,
      });
      return res.status(500).json({
        error: 'Payment processing failed — escrow could not be established. No charge was made. Please retry.',
        errorCode: 'ESCROW_CREATION_FAILED',
      });
    }

    // Transition booking to payment_pending — NOT confirmed until webhook fires.
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'payment_pending',
      timestamp: new Date().toISOString(),
      note: `Payment session created via Nayax. Awaiting customer payment of ₪${(booking.totalCents / 100).toFixed(2)}.`,
    });

    await db.update(bookingRequests)
      .set({
        status: 'payment_pending',
        paymentMethod: paymentMethod || 'nayax',
        paymentTransactionId: sessionId, // placeholder; real txId set by webhook
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logger.info('[BookingRequests] Payment session initiated — awaiting Nayax confirmation', {
      requestId, sessionId: sessionResult.sessionId, demoMode: sessionResult.demoMode,
    });

    logBookingEvent('payment_initiated', buildEventPayload({ ...booking, status: 'payment_pending' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      paymentInitiatedAt: new Date().toISOString(),
    }).catch(() => {});

    res.json({
      success: true,
      status: 'payment_pending',
      requiresRedirect: true,
      paymentUrl: sessionResult.paymentUrl,
      sessionId: sessionResult.sessionId,
      demoMode: sessionResult.demoMode,
      message: sessionResult.demoMode
        ? 'Demo payment — complete to confirm booking.'
        : 'Redirecting to secure payment page...',
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
 /**
 * POST /api/booking-requests/:requestId/complete - Provider marks service as done
 *
 * Dual-approval gate (blueprint §13):
 *   Step 1 (this endpoint): Provider marks complete → status = provider_marked_complete
 *   Step 2 (/confirm or /approve-completion): Customer approves → status = completed + escrow released
 *
 * Auto-approval: if customer does nothing for 24 h, the cron job auto-approves.
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
      return res.status(403).json({ error: 'Only provider can mark service as complete' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot mark complete for booking with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const now = new Date();
    statusHistory.push({
      status: 'provider_marked_complete',
      timestamp: now.toISOString(),
      actorType: 'provider',
      actorId: userId,
      note: 'Provider marked service as done. Awaiting customer approval or 24-hour auto-approval.',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'provider_marked_complete',
        serviceCompletedAt: now,
        providerCompletedAt: now,
        statusHistory,
        updatedAt: now,
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_completed', buildEventPayload({ ...booking, status: 'provider_marked_complete' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || now.toISOString(),
      serviceStartedAt: booking.serviceStartedAt?.toISOString() || undefined,
      serviceCompletedAt: now.toISOString(),
    }).catch(() => {});

    // Notify owner to approve or dispute within 24 hours
    try {
      await db.insert(superAppNotifications).values({
        userId: booking.ownerId,
        type: 'booking_completion_approval',
        title: '✅ השירות הושלם — אשרי את ההזמנה',
        titleHe: '✅ השירות הושלם — אשרי את ההזמנה',
        body: `הספק דיווח שהשירות הסתיים. אשרי כדי לשחרר את התשלום, או פתחי מחלוקת תוך 24 שעות.`,
        bodyHe: `הספק דיווח שהשירות הסתיים. אשרי כדי לשחרר את התשלום, או פתחי מחלוקת תוך 24 שעות.`,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: 'approve_completion',
        channels: ['in_app'],
        isRead: false,
        createdAt: now,
      } as any);
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Completion approval notification failed', { error: notifErr.message });
    }

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

    // ── Non-blocking: Refresh provider trust metrics cache ───────────────────
    setImmediate(async () => {
      try {
        const { refreshAndCacheProviderTrustMetrics } = await import('../utils/providerTrustMetrics');
        await refreshAndCacheProviderTrustMetrics(booking.providerId);
      } catch (metricsErr: any) {
        logger.warn(`[BookingRequests] Trust metrics refresh failed for provider=${booking.providerId}: ${metricsErr?.message}`);
      }
    });

    // ── Non-blocking: Google Sheets sync ─────────────────────────────────────
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId: requestId,
          customerName: `${(booking as any).ownerFirstName || ''} ${(booking as any).ownerLastName || ''}`.trim() || 'Owner',
          email: (booking as any).ownerEmail || '',
          phone: (booking as any).ownerPhone || '',
          petName: (booking as any).petNames || '',
          petType: (booking as any).petType || 'pet',
          sitterName: booking.providerName || booking.providerId || 'Provider',
          startDate: booking.startDate?.toISOString?.()?.slice(0, 10) || String(booking.startDate),
          endDate: booking.endDate?.toISOString?.()?.slice(0, 10) || String(booking.endDate),
          durationDays: booking.totalDays || 1,
          totalAmount: (booking.totalCents || 0) / 100,
          status: 'provider_marked_complete',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[BookingRequests] Google Sheets sync failed (complete) bookingId=${requestId} reason=${sheetsErr?.message}`);
      }
    });
    
    res.json({ 
      success: true,
      status: 'provider_marked_complete',
      message: 'Service marked as completed. Customer has 24 hours to approve or open a dispute. Payment will be auto-released if no action is taken.',
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
async function handleConfirmCompletion(req: any, res: any): Promise<void> {
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
    
    if (booking.status !== 'provider_marked_complete') {
      return res.status(400).json({ error: `Cannot confirm booking with status: ${booking.status}. Provider must mark the service as complete first.` });
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
    const emailRegex = /^[^@\s]{1,64}@[^@\s.]{1,63}(?:\.[^@\s.]{1,63})+$/;
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
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Pet Wash™ Ltd | ${CANONICAL_SUPPORT_EMAIL}</p>
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

    // ── Real escrow release: update Firestore escrow status to 'released' ────
    // This keeps Firestore and PostgreSQL in sync.  A DB-only paymentReleasedAt
    // without the Firestore counterpart would cause admin reconciliation drift.
    try {
      const escrows = await EscrowService.getEscrowsByBooking(requestId);
      for (const escrow of escrows) {
        if (escrow.status === 'held') {
          await EscrowService.releaseEscrowPayment(escrow.id, userId);
          logger.info('[BookingRequests] Firestore escrow released', { requestId, escrowId: escrow.id });
        }
      }
    } catch (escrowReleaseErr: any) {
      // Non-blocking: DB state is the source of truth; Firestore drift is surfaced
      // as a 'warn' in admin reconciliation and can be patched by an admin.
      logger.warn('[BookingRequests] Firestore escrow release failed (non-blocking)', {
        error: escrowReleaseErr.message, requestId,
      });
    }

    // ── Write canonical pw_payments + pw_provider_payouts rows ───────────────
    // These tables are the financial audit trail.  Without them, the admin
    // reconciliation report is vacuously clean (no rows = no mismatches).
    try {
      const { writeBookingLedgerEntries } = await import('../services/bookingLedgerWriter');
      await writeBookingLedgerEntries({
        requestId,
        ownerId: booking.ownerId,
        providerId: booking.providerId,
        providerType: booking.providerType,
        totalCents: booking.totalCents,
        subtotalCents: booking.subtotalCents,
        serviceFeeCents: booking.serviceFeeCents,
        paymentTransactionId: booking.paymentTransactionId,
        paymentMethod: booking.paymentMethod,
      });
    } catch (ledgerErr: any) {
      // Non-blocking: missing ledger rows trigger a reconciliation warning,
      // not a booking failure.  Ops can replay from audit log.
      logger.warn('[BookingRequests] Ledger write failed (non-blocking)', {
        error: ledgerErr.message, requestId,
      });
    }
    
    await db.update(bookingRequests)
      .set({
        status: finalStatus,
        ownerConfirmedAt: new Date(),
        customerApprovedAt: new Date(),
        ownerRating: rating?.toString() || null,
        ownerReview: review || null,
        paymentReleasedAt: new Date(), // Release escrow
        statusHistory,
        updatedAt: new Date(),
      } as any)
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Owner confirmed with enterprise integration', {
      requestId,
      rating,
      paymentReleased: booking.subtotalCents,
      platformFee: booking.serviceFeeCents,
    });

    // ── VAT accounting: record marketplace VAT obligation at escrow release ─
    // Israeli law מועד החיוב: מע"מ is owed when the taxable transaction is
    // completed and funds are released — this is the canonical accounting event.
    // Use recordTransactionFromGross() with the actual customer-paid total
    // (totalCents includes subtotal + service fee) to avoid the back-calculation
    // understatement in recordTransaction().
    // Non-blocking — a failure here must never roll back the confirmed booking.
    {
      const vatPlatform = (
        booking.providerType === 'sitter' ? 'sitter-suite' :
        booking.providerType === 'walker' ? 'walk-my-pet' :
        'sitter-suite' // default for trainer and other service types
      ) as 'sitter-suite' | 'walk-my-pet' | 'pettrek' | 'pet-wash-hub' | 'paw-finder' | 'plush-lab' | 'enterprise';
      const grossCollectedILS = (booking.totalCents || booking.subtotalCents || 0) / 100;
      try {
        await VATCalculatorService.recordTransactionFromGross(
          vatPlatform,
          requestId,
          grossCollectedILS,
          requestId,
          { serviceType: booking.serviceType, bookingFlow: 'booking_requests', confirmedAt: new Date().toISOString() }
        );
      } catch (vatErr: any) {
        logger.warn('[BookingRequests] VAT ledger recording failed (non-blocking)', { error: vatErr.message, requestId });
      }
    }

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
}

router.post('/:requestId/confirm', handleConfirmCompletion);

/**
 * POST /api/booking-requests/:requestId/approve-completion
 * Blueprint-aligned alias for /confirm — customer approves completion and releases escrow.
 * Delegates directly to handleConfirmCompletion() (same logic, same auth, same DB writes).
 */
router.post('/:requestId/approve-completion', handleConfirmCompletion);

/**
 * POST /api/booking-requests/:requestId/dispute
 * Customer opens a dispute during the 24-hour approval window after provider marks complete.
 * Freezes escrow — no payout until admin resolves. (blueprint §14)
 */
router.post('/:requestId/dispute', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { requestId } = req.params;
    const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (!rawReason) {
      return res.status(400).json({ error: 'A dispute reason is required.' });
    }

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the booking owner can open a dispute' });
    }

    // Dispute is only valid while waiting for customer approval
    if (booking.status !== 'provider_marked_complete') {
      return res.status(400).json({
        error: `Disputes can only be opened when the booking is in the completion approval window (current status: ${booking.status}).`,
      });
    }

    const now = new Date();
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'disputed',
      timestamp: now.toISOString(),
      actorType: 'owner',
      actorId: userId,
      note: `Customer opened dispute: ${rawReason}`,
    });

    await db.update(bookingRequests)
      .set({
        status: 'disputed',
        disputeOpenedAt: now,
        disputeOpenedBy: 'owner',
        disputeReason: rawReason,
        statusHistory,
        updatedAt: now,
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    // Notify provider and admin
    try {
      await db.insert(superAppNotifications).values({
        userId: booking.providerId,
        type: 'booking_disputed',
        title: '⚠️ לקוח פתח מחלוקת',
        titleHe: '⚠️ לקוח פתח מחלוקת',
        body: `הלקוח פתח מחלוקת על הזמנה ${requestId}. התשלום מוקפא עד לפתרון.`,
        bodyHe: `הלקוח פתח מחלוקת על הזמנה ${requestId}. התשלום מוקפא עד לפתרון.`,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: 'open_booking',
        channels: ['in_app'],
        isRead: false,
        createdAt: now,
      } as any);
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Dispute notification failed', { error: notifErr.message });
    }

    logBookingEvent('dispute_opened' as any, buildEventPayload({ ...booking, status: 'disputed' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || now.toISOString(),
      disputeOpenedAt: now.toISOString(),
    }, { reason: rawReason, openedBy: 'owner' }).catch(() => {});

    logger.info('[BookingRequests] Dispute opened by customer', { requestId, userId });
    return res.json({
      success: true,
      status: 'disputed',
      message: 'Dispute opened. Escrow is frozen — our team will review within 48 hours.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Dispute error', { error: error.message });
    return res.status(500).json({ error: 'Failed to open dispute' });
  }
});

/**
 * POST /api/booking-requests/:requestId/provider-emergency-cancel
 *
 * Emergency cancellation by the provider (sudden illness, force majeure, safety concern).
 * Blueprint §9: distinguished from a normal cancellation.
 *
 * Rules:
 *   - Customer always receives full refund regardless of timing.
 *   - 1st emergency in 90 days: logged, no financial penalty.
 *   - 2nd in 90 days: ₪50 deducted from next provider payout.
 *   - 3rd in 90 days: booking pause pending admin review.
 */
router.post('/:requestId/provider-emergency-cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { requestId } = req.params;
    const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (!rawReason) {
      return res.status(400).json({ error: 'An emergency cancellation reason is required.' });
    }

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned provider can submit an emergency cancellation' });
    }

    const nonCancellableStatuses = ['completed', 'reviewed', 'cancelled', 'disputed', 'refunded_full', 'refunded_partial'];
    if (nonCancellableStatuses.includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
    }

    // Count provider emergency cancellations in last 90 days using statusHistory audit trail
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentEmergencyBookings = await db
      .select({ requestId: bookingRequests.requestId })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.providerId, userId),
          eq(bookingRequests.status, 'cancelled'),
          sql`${bookingRequests.cancellationTier} LIKE 'provider_emergency%'`,
          sql`${bookingRequests.cancelledAt} > ${ninetyDaysAgo.toISOString()}::timestamp`,
        )
      );
    const offenseCount = recentEmergencyBookings.length; // prior offenses

    // Policy: financial penalty tiers
    const EMERGENCY_PENALTY_CENTS = 5000; // ₪50
    let penaltyCents = 0;
    let accountAction: string;
    let providerMessage: string;

    if (offenseCount === 0) {
      // First offense — warning only
      penaltyCents = 0;
      accountAction = 'warning_logged';
      providerMessage = 'Emergency cancellation logged. First offence — no penalty. Please ensure you can commit before accepting future bookings.';
    } else if (offenseCount === 1) {
      // Second offense in 90 days — ₪50 penalty from next payout
      penaltyCents = EMERGENCY_PENALTY_CENTS;
      accountAction = 'penalty_applied';
      providerMessage = `Emergency cancellation logged. Second offence in 90 days — ₪${(EMERGENCY_PENALTY_CENTS / 100).toFixed(2)} will be deducted from your next payout.`;
    } else {
      // Third+ offense — account review + bookings paused
      penaltyCents = EMERGENCY_PENALTY_CENTS;
      accountAction = 'booking_pause_review';
      providerMessage = 'Emergency cancellation logged. Third offence in 90 days — your account has been flagged for review. New booking requests are paused until resolved.';
    }

    const now = new Date();
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'cancelled',
      timestamp: now.toISOString(),
      actorType: 'provider',
      actorId: userId,
      note: `EMERGENCY CANCEL by provider. Reason: ${rawReason}. Offense #${offenseCount + 1} in 90 days. Action: ${accountAction}.`,
    });

    // Customer always gets full refund on emergency cancel
    const refundCents = booking.paymentHeldAt ? booking.totalCents : 0;

    await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: 'provider',
        cancellationReason: rawReason,
        cancellationTier: `provider_emergency_offense_${offenseCount + 1}`,
        cancellationPenaltyCents: penaltyCents,
        emergencyCancelReason: rawReason,
        refundCents,
        refundProcessedAt: refundCents > 0 ? now : null,
        statusHistory,
        updatedAt: now,
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    // Real Firestore escrow refund — customer always gets full refund on emergency cancel
    if (refundCents > 0) {
      setImmediate(async () => {
        try {
          const escrows = await EscrowService.getEscrowsByBooking(requestId);
          for (const escrow of escrows) {
            if (escrow.status === 'held') {
              await EscrowService.refundEscrowPayment(
                escrow.id,
                `Provider emergency cancel. Reason: ${rawReason}. Full refund: ₪${(refundCents / 100).toFixed(2)}.`,
                userId,
              );
              logger.info('[BookingRequests] Firestore escrow refunded on emergency cancel', { requestId, escrowId: escrow.id });
            }
          }
        } catch (escrowRefundErr: any) {
          logger.warn('[BookingRequests] Firestore escrow refund failed on emergency cancel (non-blocking)', {
            error: escrowRefundErr.message, requestId,
          });
        }
      });
    }

    // Wallet/escrow refund to customer (same logic as normal cancel)
    const financeState = (booking as any).financeState as string | null;
    const holdCents = Number((booking as any).walletHoldCents) || 0;
    const debitedCents = Number((booking as any).walletDebitedCents) || 0;
    if (financeState === 'hold_active' && holdCents > 0) {
      setImmediate(async () => {
        try {
          const r = await walletService.releaseBookingHold({
            userId: booking.ownerId, amountCents: holdCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType), ipAddress: null,
          });
          await db.update(bookingRequests)
            .set({ walletReleaseKey: r.txnId, financeState: 'released', updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet release failed on emergency cancel', { requestId, error: e.message });
        }
      });
    } else if (financeState === 'debited' && debitedCents > 0) {
      setImmediate(async () => {
        try {
          const r = await walletService.refundBookingWallet({
            userId: booking.ownerId, amountCents: debitedCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType),
            reason: 'provider_emergency_cancel', ipAddress: null,
          });
          await db.update(bookingRequests)
            .set({ walletRefundedCents: debitedCents, walletRefundKey: r.txnId, financeState: 'refunded', updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet refund failed on emergency cancel', { requestId, error: e.message });
        }
      });
    }

    // Notify customer with full refund message and rebook suggestion
    try {
      await db.insert(superAppNotifications).values({
        userId: booking.ownerId,
        type: 'booking_cancelled',
        title: '🚨 הספק ביטל בחירום — החזר מלא',
        titleHe: '🚨 הספק ביטל בחירום — החזר מלא',
        body: `הספק דיווח על נסיבות חירום ולא יכול לתת שירות. קיבלת החזר מלא. נוכל לחפש ספק חלופי בשבילך.`,
        bodyHe: `הספק דיווח על נסיבות חירום ולא יכול לתת שירות. קיבלת החזר מלא. נוכל לחפש ספק חלופי בשבילך.`,
        actionUrl: `/search`,
        actionType: 'open_search',
        channels: ['in_app'],
        isRead: false,
        createdAt: now,
      } as any);
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Emergency cancel customer notification failed', { error: notifErr.message });
    }

    // Schedule rebook nudge for customer (1 h later)
    scheduleRebookTrigger('cancelled_recovery', {
      userId: booking.ownerId, requestId, providerId: booking.providerId,
      providerName: booking.providerName || undefined, serviceType: booking.serviceType,
      serviceDate: booking.startDate ?? undefined, delayMs: 60 * 60 * 1000,
    }).catch((e: any) => logger.warn('[RebookScheduler] emergency_cancel recovery failed', { error: e.message }));

    logBookingEvent('cancelled' as any, buildEventPayload({ ...booking, status: 'cancelled' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || now.toISOString(),
      cancelledAt: now.toISOString(),
    }, { cancelledBy: 'provider', reason: rawReason, emergencyCancel: true, offenseCount: offenseCount + 1, penaltyCents, accountAction }).catch(() => {});

    logger.info('[BookingRequests] Emergency cancel processed', {
      requestId, userId, offenseCount: offenseCount + 1, penaltyCents, accountAction,
    });

    return res.json({
      success: true,
      status: 'cancelled',
      refundAmount: refundCents / 100,
      accountAction,
      message: providerMessage,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Emergency cancel error', { error: error.message });
    return res.status(500).json({ error: 'Failed to process emergency cancellation' });
  }
});

/**
 * POST /api/booking-requests/:requestId/cancel - Cancel booking
 */
router.post('/:requestId/cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    // Validate and sanitize the optional reason to prevent HTML/log injection
    const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;
    const reason = rawReason || null;
    
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
    
    // If provider_marked_complete, customer should dispute instead of cancel
    if (booking.status === 'provider_marked_complete' && booking.ownerId === userId) {
      return res.status(400).json({
        error: 'The provider has already marked this service as complete. Use /dispute to open a dispute, or /confirm to approve and release payment.',
      });
    }

    const cancelledBy = booking.ownerId === userId ? 'owner' : 'provider';
    const statusHistory = (booking.statusHistory as any[]) || [];

    // Centralised state-machine guard (Phase B2). Rejects cancels from
    // terminal states (cancelled / declined / reviewed) and any actor
    // not permitted at the current status.
    const transitionCheck = applyTransition({
      from: booking.status,
      to: 'cancelled',
      actor: cancelledBy,
      actorId: userId ?? null,
      note: reason || null,
    });
    if (!transitionCheck.result.ok) {
      logger.warn('[BookingRequests] Cancel rejected by state machine', {
        requestId, from: booking.status, actor: cancelledBy, code: transitionCheck.result.code,
      });
      return res.status(transitionCheck.result.statusCode).json({
        error: transitionCheck.result.error,
        code: transitionCheck.result.code,
      });
    }

    // ── Time-based cancellation policy (blueprint §8) ─────────────────────────
    // Hours until service start (can be negative if service already started or passed)
    const hoursUntilService = booking.startDate
      ? (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60)
      : 0;

    let refundCents = 0;
    let cancellationTier = 'no_payment';
    let cancellationPenaltyCents = 0;
    const PROVIDER_LATE_CANCEL_PENALTY_CENTS = 5000; // ₪50

    if (booking.paymentHeldAt) {
      if (cancelledBy === 'owner') {
        // Customer cancellation tiers
        if (hoursUntilService > 72) {
          refundCents = booking.totalCents;   // Full refund — ample notice
          cancellationTier = 'customer_72h_plus';
        } else if (hoursUntilService > 24) {
          refundCents = Math.round(booking.totalCents * 0.5); // 50% refund — moderate notice
          cancellationTier = 'customer_24_to_72h';
        } else if (booking.status === 'in_progress') {
          refundCents = 0;  // Service already started — no refund
          cancellationTier = 'customer_in_progress';
        } else {
          refundCents = 0;  // Short notice — no refund; provider compensated
          cancellationTier = 'customer_under_24h';
        }
      } else {
        // Provider cancellation — customer always gets full refund
        refundCents = booking.totalCents;
        if (hoursUntilService <= 24) {
          cancellationPenaltyCents = PROVIDER_LATE_CANCEL_PENALTY_CENTS;
          cancellationTier = 'provider_under_24h';
        } else if (hoursUntilService <= 72) {
          cancellationTier = 'provider_24_to_72h';
        } else {
          cancellationTier = 'provider_72h_plus';
        }
      }
    }
    
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      actorType: cancelledBy,
      actorId: userId,
      note: `Cancelled by ${cancelledBy}. Tier: ${cancellationTier}. Hours until service: ${hoursUntilService.toFixed(1)}. Refund: ₪${(refundCents / 100).toFixed(2)}${cancellationPenaltyCents > 0 ? `. Provider penalty: ₪${(cancellationPenaltyCents / 100).toFixed(2)}` : ''}. Reason: ${reason || 'No reason provided'}`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason || null,
        cancellationTier,
        cancellationPenaltyCents,
        refundCents,
        refundProcessedAt: refundCents > 0 ? new Date() : null,
        statusHistory,
        updatedAt: new Date(),
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    // ── Calendar sync on CANCEL (Phase B1) ───────────────────────────────────
    // Remove the Google Calendar event so a stale invite doesn't sit on
    // the provider's calendar after the booking is dead. Lookup is by
    // booking_id (extendedProperties), so we don't need to read the event
    // id back from the row. Non-blocking, never throws.
    setImmediate(async () => {
      try {
        const removed = await calendarIntegrationService.deleteBookingEvent(requestId);
        if (removed) {
          await db.update(bookingRequests)
            .set({ platformCalendarEventId: null, updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
        }
      } catch (calErr: any) {
        logger.warn('[BookingRequests] Calendar delete failed on cancel (non-blocking)', {
          requestId, error: calErr?.message,
        });
      }
    });

    // ── Real escrow refund: update Firestore escrow status to 'refunded' ─────
    // For card-based bookings, the Firestore escrow document must be updated to
    // 'refunded' so admin reconciliation shows the correct state.
    // Wallet-only bookings may have no Firestore escrow; getEscrowsByBooking()
    // returns [] in that case and this block is a no-op.
    if (refundCents > 0) {
      setImmediate(async () => {
        try {
          const escrows = await EscrowService.getEscrowsByBooking(requestId);
          for (const escrow of escrows) {
            if (escrow.status === 'held') {
              await EscrowService.refundEscrowPayment(
                escrow.id,
                `Booking cancelled by ${cancelledBy}. Tier: ${cancellationTier}. Refund: ₪${(refundCents / 100).toFixed(2)}.`,
                userId,
              );
              logger.info('[BookingRequests] Firestore escrow refunded on cancel', { requestId, escrowId: escrow.id, refundCents });
            }
          }
        } catch (escrowRefundErr: any) {
          // Non-blocking: Firestore drift surfaced in admin reconciliation as a warn.
          logger.warn('[BookingRequests] Firestore escrow refund failed on cancel (non-blocking)', {
            error: escrowRefundErr.message, requestId,
          });
        }
      });
    }

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
      cancellationTier,
      refundAmount: refundCents / 100,
      penaltyAmount: cancellationPenaltyCents / 100,
      message: refundCents > 0
        ? `Booking cancelled. Refund of ₪${(refundCents / 100).toFixed(2)} will be processed.${cancellationPenaltyCents > 0 ? ` A penalty of ₪${(cancellationPenaltyCents / 100).toFixed(2)} will be deducted from the provider's next payout.` : ''}`
        : `Booking cancelled. No refund applies (${cancellationTier}).`,
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
