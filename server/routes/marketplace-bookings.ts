import { Router } from 'express';
import { db } from '../db';
import { 
  bookings,
  bookingPets,
  bookingStatusHistory,
  escrowHoldings,
  providerRateCards,
  availabilitySlots,
  providers,
  quoteRequests,
  pets,
  sitterProfiles,
  walkerProfiles,
  trainers,
  users,
  BOOKING_STATUS_TRANSITIONS,
  type BookingLifecycleStatus
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import { requireIdempotency, requireStrictIdempotency } from '../middleware/idempotency';
import bookingLifecycleService from '../services/BookingLifecycleService';
import { EmailService } from '../emailService';
import { NayaxOnlinePaymentService } from '../services/NayaxOnlinePaymentService';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * Route-level requireAuth (Phase B7).
 *
 * Mount middleware on this router is `optionalFirebaseToken` so public
 * endpoints (`/quote`, `/search/providers`, public rate-cards, public
 * availability lookups) keep working without a token. Authenticated
 * endpoints must declare this middleware in their route signature so
 * the auth check runs in middleware, not as `if (!userId)` inside the
 * handler. Defense-in-depth: the inside-handler check stays as a
 * second line of defence.
 */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as any).user?.uid || (req as any).firebaseUser?.uid;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// P0-FIX: Booking ownership enforcement
// ---------------------------------------------------------------------------
// Fetches the booking and determines whether the authenticated user is the
// customer, the provider, or an admin. Returns the booking + derived role,
// or throws a 403 if the caller has no stake in the booking.
//
// BEFORE: role was accepted from req.body — any authenticated user could
//         drive any booking they knew the ID of.
// AFTER:  role is derived exclusively from booking.userId (customer) and
//         booking.providerId (provider), or from admin claims.
// ---------------------------------------------------------------------------
async function assertBookingParty(
  bookingId: string,
  userId: string,
  userRole?: string,
  res?: any
): Promise<{ booking: typeof bookings.$inferSelect; derivedRole: 'customer' | 'provider' | 'admin' } | null> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

  if (!booking) {
    if (res) res.status(404).json({ error: 'Booking not found' });
    return null;
  }

  // Admin bypass — requires admin role in user claims
  if (userRole === 'admin') {
    return { booking, derivedRole: 'admin' };
  }

  const isCustomer = booking.userId === userId;
  const isProvider = booking.providerId === userId;

  if (!isCustomer && !isProvider) {
    if (res) res.status(403).json({ error: 'Access denied — you are not a party to this booking' });
    return null;
  }

  return { booking, derivedRole: isCustomer ? 'customer' : 'provider' };
}

// Helper to generate friendly display names from provider IDs
function formatProviderName(providerId: string): string {
  // Extract meaningful name from provider ID patterns like "user-ido", "demo-sitter-1", etc.
  const id = providerId.replace(/^(user-|demo-|provider-)/i, '');
  const parts = id.split(/[-_]/);
  // Capitalize first part and return
  if (parts.length > 0 && parts[0].length > 1) {
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return 'Pet Care Pro';
}

router.post('/quote', async (req, res) => {
  try {
    const { 
      providerId, 
      platform, 
      serviceType, 
      startDate, 
      endDate, 
      petCount = 1, 
      addons = [],
      customerId,
      slotId,
      lockToken
    } = req.body;

    // Also check header for authenticated user
    const userId = customerId || req.user?.uid || req.firebaseUser?.uid;

    const quote = await bookingLifecycleService.calculateQuote(
      providerId,
      platform,
      serviceType,
      new Date(startDate),
      new Date(endDate),
      petCount,
      addons,
      userId
    );

    // Persist the quote to database and generate a quoteId
    const quoteId = `QUOTE-${nanoid(12)}`;
    
    // IMPORTANT — quoteRequests DB schema uses three combined monetary columns.
    // Do NOT split these back into separate named fields; Drizzle will silently
    // discard any key that does not match the schema column name exactly.
    //   surchargeCents  = weekend + holiday surcharges combined  (DB: surcharge_cents)
    //   discountCents   = duration + combo + loyalty discounts summed (DB: discount_cents)
    //   taxCents        = VAT amount — NOT vatCents             (DB: tax_cents)
    await db.insert(quoteRequests).values({
      quoteId,
      customerId: userId || 'anonymous',
      providerId: String(providerId),
      platform,
      serviceType: serviceType || 'standard',
      startDate: new Date(startDate).toISOString().split('T')[0],
      endDate: new Date(endDate).toISOString().split('T')[0],
      petCount,
      baseAmountCents: quote.baseAmountCents,
      additionalPetsCents: quote.additionalPetsCents,
      addonsCents: quote.addonsCents,
      // Schema has one combined surcharge column — store weekend surcharge here
      surchargeCents: quote.weekendSurchargeCents,
      // Schema has one combined discount column — sum all discount types
      discountCents: (quote.durationDiscountCents || 0) + (quote.comboDiscountCents || 0) + (quote.loyaltyDiscountCents || 0),
      subtotalCents: quote.subtotalCents,
      platformFeeCents: quote.platformFeeCents,
      taxCents: quote.vatCents,   // T4 fix: schema column is taxCents not vatCents
      totalCents: quote.totalCents,
      providerEarningsCents: quote.providerEarningsCents,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minute expiry
    });

    logger.info('[MarketplaceBookings] Quote created', { quoteId, userId, providerId, totalCents: quote.totalCents });

    res.json({ 
      success: true, 
      quoteId,
      quote,
      breakdown: {
        baseAmount: (quote.baseAmountCents / 100).toFixed(2),
        additionalPets: (quote.additionalPetsCents / 100).toFixed(2),
        addons: (quote.addonsCents / 100).toFixed(2),
        weekendSurcharge: (quote.weekendSurchargeCents / 100).toFixed(2),
        durationDiscount: (quote.durationDiscountCents / 100).toFixed(2),
        comboDiscount: (quote.comboDiscountCents / 100).toFixed(2),
        loyaltyDiscount: (quote.loyaltyDiscountCents / 100).toFixed(2),
        subtotal: (quote.subtotalCents / 100).toFixed(2),
        platformFee: (quote.platformFeeCents / 100).toFixed(2),
        vat: (quote.vatCents / 100).toFixed(2),
        total: (quote.totalCents / 100).toFixed(2),
        providerEarnings: (quote.providerEarningsCents / 100).toFixed(2),
      },
      appliedDiscounts: quote.appliedDiscounts,
      loyaltyInfo: quote.loyaltyInfo
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Quote error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/create', requireAuth, requireIdempotency, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { 
      providerId, 
      providerProfileId,
      platformId, 
      serviceType, 
      startTime, 
      endTime, 
      petIds,
      selectedAddons,
      specialRequests,
      quoteId
    } = req.body;

    const result = await bookingLifecycleService.createBooking({
      customerId: userId,
      providerId,
      providerProfileId,
      platformId,
      serviceType,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      petIds,
      selectedAddons,
      specialRequests,
      quoteId
    });

    res.json({ 
      success: true, 
      booking: result,
      nextStatus: 'quote_sent'
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Create error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:quoteId/checkout', requireAuth, requireStrictIdempotency, async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user?.uid || req.firebaseUser?.uid;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const { slotId, lockToken, petIds, specialInstructions, addons } = req.body;

    // Validate required fields
    if (!slotId || !lockToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing slot reservation details' 
      });
    }

    // Fetch the quote to verify it exists and get pricing data
    // Query by quoteId field (the QUOTE-xxx string), not the serial id
    const [quote] = await db.select()
      .from(quoteRequests)
      .where(eq(quoteRequests.quoteId, quoteId))
      .limit(1);

    if (!quote) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quote not found or expired' 
      });
    }

    // Check if quote is expired (quotes expire after 15 minutes)
    const quoteAge = Date.now() - new Date(quote.createdAt!).getTime();
    const QUOTE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
    if (quoteAge > QUOTE_EXPIRY_MS) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quote expired. Please request a new quote.' 
      });
    }

    // ── Verify slot lock — query availability_slots (the lock-aware table) ─────
    const [slot] = await db.select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.id, slotId))
      .limit(1);

    if (!slot) {
      return res.status(400).json({ 
        success: false, 
        error: 'Time slot not found' 
      });
    }

    // Verify slot belongs to the quoted provider.
    // availabilitySlots.providerId is a numeric FK to providers.id, while
    // quote.providerId is the provider's Firebase UID (varchar).
    // Bridge: look up providers.userId to compare apples-to-apples.
    const [providerRow] = await db.select({ userId: providers.userId })
      .from(providers)
      .where(eq(providers.id, slot.providerId))
      .limit(1);

    if (providerRow && providerRow.userId !== quote.providerId) {
      logger.warn('[MarketplaceBookings] Slot providerId mismatch', {
        slotProviderId: slot.providerId,
        slotProviderUid: providerRow.userId,
        quoteProviderId: quote.providerId,
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Slot does not match the quoted provider' 
      });
    }

    // Soft expiry pre-check (fast path before the atomic UPDATE)
    if (slot.lockExpiresAt && new Date(slot.lockExpiresAt) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Slot reservation expired. Please select a new time.' 
      });
    }

    // ── Self-booking guard ────────────────────────────────────────────────────
    // quote.providerId is the provider's Firebase UID (varchar); userId is the
    // customer's Firebase UID. If they are the same account, reject — money
    // would flow from the user to themselves through escrow, enabling loyalty
    // abuse and balance inflation. Set ALLOW_SELF_BOOKING=true for test accounts.
    if (quote.providerId && userId === quote.providerId && process.env.ALLOW_SELF_BOOKING !== 'true') {
      logger.warn('[MarketplaceBookings] Self-booking rejected', { userId });
      return res.status(409).json({
        success: false,
        error: 'Self-booking is not permitted. You cannot book yourself as a provider.',
      });
    }

    // ── Atomic slot claim (race condition protection) ─────────────────────────
    // Single UPDATE … WHERE lockToken = :lockToken AND status = 'held' RETURNING id
    // If 0 rows → another concurrent request already claimed this slot, or token wrong.
    // Eliminates the TOCTOU window between the SELECT above and the booking INSERT below.
    const [claimed] = await db
      .update(availabilitySlots)
      .set({ status: 'booked', updatedAt: new Date() })
      .where(
        and(
          eq(availabilitySlots.id, slotId),
          eq(availabilitySlots.lockToken, lockToken),
          eq(availabilitySlots.status, 'held')
        )
      )
      .returning({ id: availabilitySlots.id });

    if (!claimed) {
      logger.warn('[MarketplaceBookings] Slot claim failed — lockToken mismatch or slot already booked', {
        slotId,
        userId,
      });
      return res.status(409).json({
        success: false,
        error: 'This time slot is no longer available. Please select a new time.',
      });
    }

    // ── Atomic booking + escrow creation (DB transaction) ────────────────────
    // Wraps createBooking + slot stamp + escrow INSERT so all three succeed or
    // all three roll back. If the transaction fails the slot is reverted to
    // 'available' so the customer can retry with a new lock.
    //
    // SCOPING NOTE: releaseEligibleAt is declared HERE (outer scope) so it is
    // accessible after the try block for the confirmation email.
    // It is assigned inside the tx callback before the escrow INSERT.
    // Default value guards against accidental undefined if tx throws mid-way.
    let bookingId: string;
    let bookingNumber: string;
    let releaseEligibleAt: Date = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 h default

    try {
      const txResult = await db.transaction(async (tx) => {
        const bookingResult = await bookingLifecycleService.createBooking({
          customerId: userId,
          providerId: quote.providerId!,
          providerProfileId: quote.providerId!,
          platformId: quote.platform as any,
          serviceType: quote.serviceType || 'standard',
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          petIds: petIds || [],
          selectedAddons: Array.isArray(addons) ? addons : [],
          specialRequests: specialInstructions || '',
          quoteId
        }, tx);

        const bid = bookingResult.bookingId;

        // Stamp slot with confirmed bookingId
        await tx.update(availabilitySlots)
          .set({ bookingId: bid, lockToken: null, lockExpiresAt: null, lockedByUid: null, updatedAt: new Date() })
          .where(eq(availabilitySlots.id, slotId));

        // Create escrow record (72-hour hold).
        // releaseEligibleAt is assigned to the OUTER variable (declared above)
        // so it survives this callback and is available for the email below.
        const escrowId = nanoid(16);
        releaseEligibleAt = new Date();
        releaseEligibleAt.setHours(releaseEligibleAt.getHours() + 72);

        const platformFeeCents = quote.platformFeeCents || 0;
        // T4: Use the stored taxCents from the quote record (DB column: tax_cents).
        // Do NOT recompute — the quote was already persisted with the canonical VAT value.
        const vatCents = quote.taxCents || Math.round(platformFeeCents * 0.18);

        await tx.insert(escrowHoldings).values({
          escrowId,
          bookingId: bid,
          customerId: userId,
          providerId: String(quote.providerId || ''),
          grossAmountCents: quote.totalCents || 0,
          platformFeeCents,
          vatCents,
          netProviderAmountCents: quote.providerEarningsCents || 0,
          status: 'pending_payment',
          releaseEligibleAt,
          createdAt: new Date()
        });

        return bookingResult;
      });

      bookingId = txResult.bookingId;
      bookingNumber = txResult.bookingNumber;
    } catch (txErr: any) {
      // Roll back slot so customer can retry
      await db.update(availabilitySlots)
        .set({ status: 'available', lockToken: null, lockExpiresAt: null, lockedByUid: null, updatedAt: new Date() })
        .where(eq(availabilitySlots.id, slotId));
      logger.error('[MarketplaceBookings] Booking transaction failed — slot reverted to available', {
        slotId, userId, error: txErr.message
      });
      throw txErr;
    }

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `INV-${datePart}-${nanoid(6).toUpperCase()}`;

    // Look up customer and provider details for email
    const [customer] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Try to get provider name from sitter or walker profiles
    let providerName = 'Your Service Provider';
    const [sitterProfile] = await db.select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.userId, quote.providerId!))
      .limit(1);
    if (sitterProfile?.displayName) {
      providerName = sitterProfile.displayName;
    } else {
      const [walkerProfile] = await db.select()
        .from(walkerProfiles)
        .where(eq(walkerProfiles.userId, quote.providerId!))
        .limit(1);
      if (walkerProfile?.displayName) {
        providerName = walkerProfile.displayName;
      }
    }

    // Platform name mapping
    const platformNames: Record<string, string> = {
      sitter_suite: '⁦The Sitter Suite™⁩',
      walk_my_pet: '⁦Walk My Pet™⁩',
      pet_trek: '⁦PetTrek™⁩',
      grooming: 'Premium Grooming',
      training_academy: 'Training Academy',
      daycare: 'Pet Daycare',
      k9000: '⁦K9000™⁩ Self-Wash'
    };
    const platformName = platformNames[quote.platform || ''] || quote.platform || '⁦Pet Wash™⁩ Service';

    // Persist invoice number to booking record (in platformData JSON field)
    await db.update(bookings)
      .set({ 
        platformData: sql`COALESCE(platform_data, '{}'::jsonb) || ${JSON.stringify({ invoiceNumber, invoiceGeneratedAt: new Date().toISOString() })}::jsonb`
      })
      .where(eq(bookings.id, bookingId));
    
    logger.info('[MarketplaceBookings] Invoice number persisted', { bookingId, invoiceNumber });

    // Send booking confirmation email (async, don't block response)
    if (customer?.email) {
      const customerName = customer.displayName || customer.firstName || customer.email.split('@')[0];
      const customerPhone = (customer as any).phone || (customer as any).phoneNumber || undefined;
      const vatCentsCalc = quote.vatCents
        ? (quote.vatCents as number)
        : Math.round((quote.totalCents || 0) - (quote.totalCents || 0) / 1.18);
      EmailService.sendBookingConfirmation({
        email: customer.email,
        customerName,
        customerPhone,
        petName: (quote as any).petName || (slot as any).petName || undefined,
        bookingId,
        bookingNumber,
        invoiceNumber,
        platformName,
        serviceType: quote.serviceType || 'Standard Service',
        providerName,
        providerAddress: (sitterProfile as any)?.address || (quote as any).address || undefined,
        startDate: new Date(slot.startTime!),
        endDate: new Date(slot.endTime!),
        totalAmountCents: quote.totalCents || 0,
        vatCents: vatCentsCalc,
        loyaltyDiscountCents: quote.loyaltyDiscountCents || 0,
        paymentStatus: 'התקבל — מוחזק בנאמנות',
        escrowReleaseDate: releaseEligibleAt,
        language: 'he'
      }).catch(err => {
        logger.error('[MarketplaceBookings] Failed to send confirmation email', { error: err.message });
      });
    }

    // Generate Nayax payment session (real or demo depending on env vars)
    const customerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.displayName
      : undefined;

    const paymentSession = await NayaxOnlinePaymentService.createPaymentSession({
      bookingId,
      bookingNumber,
      amountCents: quote.totalCents || 0,
      currency: 'ILS',
      customerEmail: customer?.email,
      customerName: customerName || undefined,
      description: `PetWash™ ${platformName} — ${providerName} — הזמנה ${bookingNumber}`,
    });

    if (!paymentSession.success) {
      logger.error('[MarketplaceBookings] Payment session creation failed', {
        bookingId,
        error: paymentSession.error,
      });
      return res.status(502).json({
        success: false,
        error: 'Failed to create payment session. Please try again.',
        bookingId,
        bookingNumber,
        invoiceNumber,
      });
    }

    const mode = paymentSession.demoMode ? 'demo' : 'live';
    logger.info(`[MarketplaceBookings] Checkout complete — payment session created (${mode})`, {
      bookingId,
      bookingNumber,
      invoiceNumber,
      paymentMode: mode,
    });

    res.json({
      success: true,
      bookingId,
      bookingNumber,
      invoiceNumber,
      paymentUrl: paymentSession.paymentUrl,
      paymentSessionId: paymentSession.sessionId,
      paymentMode: mode,
    });

  } catch (error: any) {
    logger.error('[MarketplaceBookings] Checkout error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-bookings', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = (req.query.role as string) || 'customer';
    const limit = parseInt(req.query.limit as string) || 50;

    const userBookings = await bookingLifecycleService.getUserBookings(
      userId, 
      role as 'customer' | 'provider',
      limit
    );

    res.json({ success: true, bookings: userBookings });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Fetch error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:bookingId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    const booking = await bookingLifecycleService.getBookingWithHistory(bookingId);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, booking });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Get error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:bookingId/transition', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const { newStatus, reason } = req.body;

    // P0-FIX: role is no longer accepted from request body.
    // It is derived from the booking record — only the actual customer or provider may act.
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    // P0-FIX: Block direct user transitions to 'completed'.
    // 'completed' can only be reached via the /complete endpoint after both parties
    // have independently confirmed — enforced by the system actor.
    // Admin may override via admin tools, not this endpoint.
    if (newStatus === 'completed' && party.derivedRole !== 'admin') {
      return res.status(403).json({
        error: 'Direct transition to completed is not allowed. Use the /complete endpoint.'
      });
    }

    await bookingLifecycleService.transitionStatus(
      bookingId,
      newStatus as BookingLifecycleStatus,
      userId,
      party.derivedRole,
      reason
    );

    const updatedBooking = await bookingLifecycleService.getBookingWithHistory(bookingId);

    res.json({ 
      success: true, 
      booking: updatedBooking,
      message: `Status updated to ${newStatus}`
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Transition error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:bookingId/confirm', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;

    // P0-FIX: role no longer accepted from body — derived from booking record.
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    const targetStatus = party.derivedRole === 'provider' ? 'provider_confirmed' : 'owner_confirmed';

    await bookingLifecycleService.transitionStatus(
      bookingId,
      targetStatus as BookingLifecycleStatus,
      userId,
      party.derivedRole,
      'Booking confirmed'
    );

    res.json({ success: true, status: targetStatus });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Confirm error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:bookingId/start', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;

    // P0-FIX: Only the actual provider of this booking may start it.
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    if (party.derivedRole !== 'provider' && party.derivedRole !== 'admin') {
      return res.status(403).json({ error: 'Only the provider can start a service' });
    }

    await bookingLifecycleService.transitionStatus(
      bookingId,
      'in_progress',
      userId,
      'provider',
      'Service started'
    );

    res.json({ success: true, status: 'in_progress' });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Start error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:bookingId/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;

    // P0-FIX: role is no longer accepted from request body.
    // Derived from booking record. This also prevents the same user from
    // self-completing both sides: their role is fixed by who they are in the booking.
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    const targetStatus = party.derivedRole === 'provider'
      ? 'provider_completion_review'
      : 'owner_completion_review';

    await bookingLifecycleService.transitionStatus(
      bookingId,
      targetStatus as BookingLifecycleStatus,
      userId,
      party.derivedRole === 'admin' ? 'system' : party.derivedRole,
      'Service marked complete'
    );

    const booking = await bookingLifecycleService.getBookingWithHistory(bookingId);

    // P0-FIX: Verify that the two completion events came from DIFFERENT users.
    // Without this, a single user who is both customer and provider (e.g. demo/test data)
    // could trigger escrow release unilaterally.
    const ownerEntry = booking?.statusHistory.find((h: any) => h.toStatus === 'owner_completion_review');
    const providerEntry = booking?.statusHistory.find((h: any) => h.toStatus === 'provider_completion_review');
    const ownerReviewed = !!ownerEntry;
    const providerReviewed = !!providerEntry;
    const distinctActors = ownerEntry && providerEntry && ownerEntry.changedByUserId !== providerEntry.changedByUserId;

    if (ownerReviewed && providerReviewed && distinctActors) {
      await bookingLifecycleService.transitionStatus(
        bookingId,
        'completed',
        'system',
        'system',
        'Both parties confirmed completion'
      );
    }

    const updatedBooking = await bookingLifecycleService.getBookingWithHistory(bookingId);
    res.json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Complete error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:bookingId/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const { reason } = req.body;

    // P0-FIX: role no longer accepted from body — derived from booking record.
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    await bookingLifecycleService.transitionStatus(
      bookingId,
      'cancelled',
      userId,
      party.derivedRole === 'admin' ? 'system' : party.derivedRole,
      reason || 'Booking cancelled'
    );

    // Calendar sync on CANCEL (Phase B1) — non-blocking, idempotent.
    setImmediate(async () => {
      try {
        const { calendarIntegrationService } = await import('../services/CalendarIntegrationService');
        await calendarIntegrationService.deleteBookingEvent(bookingId);
      } catch (calErr: any) {
        logger.warn('[MarketplaceBookings] Calendar delete failed on cancel (non-blocking)', {
          bookingId, error: calErr?.message,
        });
      }
    });

    res.json({ success: true, status: 'cancelled' });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Cancel error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:bookingId/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    const history = await db.select()
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, bookingId))
      .orderBy(desc(bookingStatusHistory.changedAt));

    res.json({ success: true, history });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] History error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:bookingId/escrow', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;
    const party = await assertBookingParty(bookingId, userId, userRole, res);
    if (!party) return;

    const [escrow] = await db.select()
      .from(escrowHoldings)
      .where(eq(escrowHoldings.bookingId, bookingId))
      .limit(1);

    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    res.json({ 
      success: true, 
      escrow: {
        ...escrow,
        grossAmount: (escrow.grossAmountCents / 100).toFixed(2),
        platformFee: (escrow.platformFeeCents / 100).toFixed(2),
        vat: (escrow.vatCents / 100).toFixed(2),
        providerAmount: (escrow.netProviderAmountCents / 100).toFixed(2),
        hoursUntilRelease: escrow.releaseEligibleAt 
          ? Math.max(0, Math.ceil((new Date(escrow.releaseEligibleAt).getTime() - Date.now()) / (1000 * 60 * 60)))
          : null
      }
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Escrow error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/provider/:providerId/rate-card', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { platform, serviceType } = req.query;

    let query = db.select()
      .from(providerRateCards)
      .where(eq(providerRateCards.providerId, providerId));

    const rateCards = await query;

    res.json({ 
      success: true, 
      rateCards: rateCards.map(card => ({
        ...card,
        baseRatePerNight: card.baseRatePerNightCents ? (card.baseRatePerNightCents / 100).toFixed(2) : null,
        baseRatePerHour: card.baseRatePerHourCents ? (card.baseRatePerHourCents / 100).toFixed(2) : null,
        baseRatePerVisit: card.baseRatePerVisitCents ? (card.baseRatePerVisitCents / 100).toFixed(2) : null,
        additionalPetSurcharge: card.additionalPetSurchargeCents ? (card.additionalPetSurchargeCents / 100).toFixed(2) : null,
      }))
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Rate card error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pet Wash™ provider search with proximity sorting
router.get('/search/providers', async (req, res) => {
  try {
    const {
      platform,
      serviceType,
      startDate,
      endDate,
      city,
      lat,
      lng,
      street,
      streetNumber,
      radius = 50,
      minRating = 0,
      maxPrice,
      sortBy = 'distance',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const platformStr = platform as string;
    const cityStr = city as string;
    
    let whereConditions = [eq(providerRateCards.isActive, true)];
    if (platform) {
      whereConditions.push(sql`lower(${providerRateCards.platform}) = ${platformStr.toLowerCase()}`);
    }
    if (serviceType) {
      whereConditions.push(eq(providerRateCards.serviceType, serviceType as string));
    }

    // Fetch rate cards
    const rateCards = await db.select()
      .from(providerRateCards)
      .where(and(...whereConditions))
      .limit(Number(limit) * 5) // Fetch more to filter by city later
      .offset(offset);

    // Filter by availability if dates provided
    let availableRateCards = rateCards;
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const providerIds = rateCards.map(rc => rc.providerId);
      
      if (providerIds.length > 0) {
        // Find providers unavailable during requested dates
        const unavailableProviders = await db.selectDistinct({ providerId: providerAvailability.providerId })
          .from(providerAvailability)
          .where(
            and(
              sql`${providerAvailability.providerId} IN (${sql.join(providerIds.map(id => sql`${id}`), sql`, `)})`,
              gte(providerAvailability.date, start),
              lte(providerAvailability.date, end),
              eq(providerAvailability.isAvailable, false)
            )
          );
        
        const unavailableIds = new Set(unavailableProviders.map(p => p.providerId));
        availableRateCards = rateCards.filter(rc => !unavailableIds.has(rc.providerId));
      }
    }

    const _rawLat = lat ? parseFloat(lat as string) : null;
    const _rawLng = lng ? parseFloat(lng as string) : null;
    const searchLat = (_rawLat !== null && !isNaN(_rawLat) && _rawLat >= -90 && _rawLat <= 90) ? _rawLat : null;
    const searchLng = (_rawLng !== null && !isNaN(_rawLng) && _rawLng >= -180 && _rawLng <= 180) ? _rawLng : null;
    const searchRadius = Math.min(Math.max(Number(radius) || 50, 1), 200);

    // Enrich with profile data based on platform
    const providerIds = availableRateCards.map(rc => rc.providerId);
    interface ProfileData {
      displayName: string;
      bio: string | null;
      profilePhotoUrl: string | null;
      city: string | null;
      postalCode: string | null;
      streetAddress: string | null;
      latitude: number | null;
      longitude: number | null;
      serviceRadiusKm: number | null;
      rating: number | null;
      reviewCount: number;
    }
    let profileMap = new Map<string, ProfileData>();
    
    if (providerIds.length > 0) {
      const normalizedPlatform = platformStr?.toLowerCase();
      const idParams = providerIds.map(id => sql`${id}`);
      
      try {
        if (!normalizedPlatform || normalizedPlatform === 'sitter_suite') {
          const profiles = await db.select({
            userId: sitterProfiles.userId,
            firstName: sitterProfiles.firstName,
            lastName: sitterProfiles.lastName,
            bio: sitterProfiles.bio,
            profilePhotoUrl: sitterProfiles.profilePictureUrl,
            city: sitterProfiles.city,
            postalCode: sitterProfiles.postalCode,
            streetAddress: sitterProfiles.streetAddress,
            latitude: sitterProfiles.latitude,
            longitude: sitterProfiles.longitude,
            rating: sitterProfiles.rating,
            totalBookings: sitterProfiles.totalBookings,
          })
          .from(sitterProfiles)
          .where(sql`${sitterProfiles.userId} IN (${sql.join(idParams, sql`, `)})`);
          
          profiles.forEach(p => {
            profileMap.set(p.userId, {
              displayName: `${p.firstName} ${p.lastName || ''}`.trim(),
              bio: p.bio,
              profilePhotoUrl: p.profilePhotoUrl,
              city: p.city,
              postalCode: p.postalCode || null,
              streetAddress: p.streetAddress || null,
              latitude: p.latitude ? parseFloat(p.latitude) : null,
              longitude: p.longitude ? parseFloat(p.longitude) : null,
              serviceRadiusKm: null,
              rating: p.rating ? parseFloat(p.rating) : null,
              reviewCount: p.totalBookings || 0,
            });
          });
        }
      } catch (err: any) {
        logger.warn('[MarketplaceBookings] Sitter profile enrichment error', { error: err?.message });
      }

      try {
        if (!normalizedPlatform || normalizedPlatform === 'walk_my_pet') {
          const profiles = await db.select({
            walkerId: walkerProfiles.walkerId,
            userId: walkerProfiles.userId,
            firstName: walkerProfiles.firstName,
            lastName: walkerProfiles.lastName,
            bio: walkerProfiles.bio,
            profilePhotoUrl: walkerProfiles.profilePhotoUrl,
            city: walkerProfiles.city,
            currentLatitude: walkerProfiles.currentLatitude,
            currentLongitude: walkerProfiles.currentLongitude,
            serviceRadiusKm: walkerProfiles.serviceRadiusKm,
            rating: walkerProfiles.averageRating,
            totalWalks: walkerProfiles.totalWalks,
          })
          .from(walkerProfiles)
          .where(sql`(${walkerProfiles.userId} IN (${sql.join(idParams, sql`, `)}) OR ${walkerProfiles.walkerId} IN (${sql.join(idParams, sql`, `)}))`);
          
          profiles.forEach(p => {
            const profileData: ProfileData = {
              displayName: `${p.firstName} ${p.lastName || ''}`.trim(),
              bio: p.bio,
              profilePhotoUrl: p.profilePhotoUrl,
              city: p.city,
              postalCode: null,
              streetAddress: null,
              latitude: p.currentLatitude ? parseFloat(p.currentLatitude) : null,
              longitude: p.currentLongitude ? parseFloat(p.currentLongitude) : null,
              serviceRadiusKm: p.serviceRadiusKm ?? 5,
              rating: p.rating ? parseFloat(p.rating) : null,
              reviewCount: p.totalWalks || 0,
            };
            if (!profileMap.has(p.userId)) profileMap.set(p.userId, profileData);
            if (p.walkerId && !profileMap.has(p.walkerId)) profileMap.set(p.walkerId, profileData);
          });
        }
      } catch (err: any) {
        logger.warn('[MarketplaceBookings] Walker profile enrichment error', { error: err?.message });
      }

      try {
        if (!normalizedPlatform || normalizedPlatform === 'academy' || normalizedPlatform === 'groomers') {
          const trainerProfiles = await db.select({
            userId: trainers.userId,
            firstName: trainers.firstName,
            lastName: trainers.lastName,
            bio: trainers.bio,
            profilePhotoUrl: trainers.profilePhotoUrl,
            serviceArea: trainers.serviceArea,
            rating: trainers.averageRating,
            totalSessions: trainers.totalSessions,
          })
          .from(trainers)
          .where(sql`${trainers.userId} IN (${sql.join(idParams, sql`, `)})`);

          trainerProfiles.forEach(p => {
            if (!profileMap.has(p.userId)) {
              profileMap.set(p.userId, {
                displayName: `${p.firstName} ${p.lastName || ''}`.trim(),
                bio: p.bio,
                profilePhotoUrl: p.profilePhotoUrl,
                city: p.serviceArea || null,
                postalCode: null,
                streetAddress: null,
                latitude: null,
                longitude: null,
                serviceRadiusKm: null,
                rating: p.rating ? parseFloat(p.rating) : null,
                reviewCount: p.totalSessions || 0,
              });
            }
          });
        }
      } catch (err: any) {
        logger.warn('[MarketplaceBookings] Trainer profile enrichment error', { error: err?.message });
      }

      try {
        const unmatchedIds = providerIds.filter(id => !profileMap.has(id));
        if (unmatchedIds.length > 0) {
          const unmatchedParams = unmatchedIds.map(id => sql`${id}`);
          const userProfiles = await db.select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(sql`${users.id} IN (${sql.join(unmatchedParams, sql`, `)})`);
          
          userProfiles.forEach(u => {
            if (!profileMap.has(u.id)) {
              profileMap.set(u.id, {
                displayName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || formatProviderName(u.id),
                bio: null,
                profilePhotoUrl: u.profileImageUrl,
                city: null,
                postalCode: null,
                streetAddress: null,
                latitude: null,
                longitude: null,
                serviceRadiusKm: null,
                rating: null,
                reviewCount: 0,
              });
            }
          });
        }
      } catch (err: any) {
        logger.warn('[MarketplaceBookings] User profile fallback error', { error: err?.message });
      }
    }

    // Format response with distance calculation and deduplicate by provider ID
    const seenProviderIds = new Set<string>();
    const results: any[] = [];
    for (const provider of availableRateCards) {
      if (seenProviderIds.has(provider.providerId)) continue;
      seenProviderIds.add(provider.providerId);

      const profile = profileMap.get(provider.providerId);
      
      let distanceKm: number | null = null;
      let distanceMeters: number | null = null;
      let proximityLabel: string | null = null;
      const searchStreet = (street as string | undefined)?.trim().toLowerCase() || null;
      const searchBuildingNum = (streetNumber as string | undefined)?.trim() || null;
      const providerStreetAddress = (profile?.streetAddress || '').toLowerCase();

      if (searchLat !== null && searchLng !== null && profile?.latitude && profile?.longitude) {
        const rawKm = haversineDistanceKm(searchLat, searchLng, profile.latitude, profile.longitude);
        distanceMeters = Math.round(rawKm * 1000);
        distanceKm = distanceMeters < 100
          ? Math.round(rawKm * 1000) / 1000   // sub-100m: three decimal places for sorting precision
          : Math.round(rawKm * 10) / 10;       // ≥100m: one decimal place

        // Hyper-local proximity tier labels
        const sameBuilding =
          distanceMeters <= 50 ||
          (searchBuildingNum && searchStreet &&
            providerStreetAddress.includes(searchBuildingNum) &&
            providerStreetAddress.includes(searchStreet));
        const sameStreet =
          !sameBuilding &&
          distanceMeters <= 300 &&
          searchStreet &&
          providerStreetAddress.includes(searchStreet);

        if (sameBuilding) {
          proximityLabel = 'same_building';
        } else if (sameStreet) {
          proximityLabel = 'same_street';
        } else if (distanceMeters <= 500) {
          proximityLabel = 'nearby';
        } else if (distanceMeters < 1000) {
          proximityLabel = `${distanceMeters}m`;
        } else if (rawKm <= 2) {
          proximityLabel = 'neighbourhood';
        } else if (rawKm <= 15) {
          proximityLabel = 'same_city';
        } else if (rawKm <= 50) {
          proximityLabel = 'metro_area';
        } else {
          proximityLabel = null;
        }
      }

      results.push({
        id: provider.providerId,
        platform: provider.platform,
        serviceType: provider.serviceType,
        displayName: profile?.displayName || formatProviderName(provider.providerId),
        bio: profile?.bio || null,
        profilePhotoUrl: profile?.profilePhotoUrl || null,
        location: profile?.city || null,
        suburb: profile?.streetAddress ? profile.streetAddress.split(',')[0]?.trim() : null,
        postalCode: profile?.postalCode || null,
        distanceKm,
        distanceMeters,
        proximityLabel,
        serviceRadiusKm: profile?.serviceRadiusKm ?? null,
        rating: profile?.rating || null,
        reviewCount: profile?.reviewCount || 0,
        pricing: {
          perNight: provider.baseRatePerNightCents ? (provider.baseRatePerNightCents / 100).toFixed(2) : null,
          perHour: provider.baseRatePerHourCents ? (provider.baseRatePerHourCents / 100).toFixed(2) : null,
          additionalPet: provider.additionalPetSurchargeCents ? (provider.additionalPetSurchargeCents / 100).toFixed(2) : null,
          currency: 'ILS'
        },
        maxPets: provider.maxPets || 4,
        acceptedPetTypes: ['dog', 'cat'],
        addons: Array.isArray(provider.enabledAddons) && provider.enabledAddons.length > 0 
          ? provider.enabledAddons 
          : provider.platform?.toLowerCase() === 'sitter_suite' 
            ? ['medication_admin', 'daily_photos', 'grooming']
            : provider.platform?.toLowerCase() === 'walk_my_pet'
              ? ['extra_walk', 'training_tips', 'gps_tracking']
              : ['premium_shampoo', 'blow_dry'],
        instantBooking: provider.minBookingHours === 0,
        cancellationPolicy: 'flexible',
      });
    }

    const CITY_ALIASES: Record<string, string[]> = {
      'tel aviv': ['תל אביב', 'tel-aviv', 'tlv', 'תל-אביב', 'תל אביב יפו', 'tel aviv-yafo', 'tel aviv yafo', 'tel aviv jaffa'],
      'jerusalem': ['ירושלים', 'yerushalayim'],
      'haifa': ['חיפה'],
      'herzliya': ['הרצליה'],
      'ramat gan': ['רמת גן', 'רמת-גן'],
      'petah tikva': ['פתח תקווה', 'פתח-תקווה', 'petach tikva'],
      'rishon lezion': ['ראשון לציון', 'rishon le zion', 'rishon'],
      'netanya': ['נתניה'],
      'beer sheva': ['באר שבע', 'beer-sheva', 'beersheva', 'באר-שבע'],
      'ashdod': ['אשדוד'],
      'holon': ['חולון'],
      'bat yam': ['בת ים', 'בת-ים'],
      'kfar saba': ['כפר סבא', 'כפר-סבא'],
      'hod hasharon': ['הוד השרון', 'הוד-השרון'],
      'rehovot': ['רחובות'],
      'ashkelon': ['אשקלון'],
      'raanana': ['רעננה', "ra'anana"],
      'givatayim': ['גבעתיים', 'givataim'],
      'modiin': ['מודיעין', "modi'in", 'modiin maccabim reut'],
      'eilat': ['אילת'],
      'nahariya': ['נהריה'],
      'tiberias': ['טבריה'],
    };

    function normalizeCitySearch(searchTerm: string): string[] {
      const lower = searchTerm.trim().toLowerCase();
      const candidates = [lower];
      for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
        if (canonical === lower || aliases.some(a => a === lower || lower.includes(a) || a.includes(lower))) {
          candidates.push(canonical, ...aliases);
        }
      }
      return [...new Set(candidates)];
    }

    let filteredResults = results;

    // Geo-proximity matching: closest providers first, respecting each provider's own service radius
    if (searchLat !== null && searchLng !== null) {
      filteredResults = results.filter(r => {
        if (r.distanceKm === null) {
          // Provider has no coordinates — keep but rank last
          return true;
        }
        // Walkers travel to the customer — match only if customer is within the walker's own service radius
        // (the "Uber driver is near you" model: walker sets their territory, customer must be inside it)
        if (r.serviceRadiusKm !== null && r.serviceRadiusKm > 0) {
          return r.distanceKm <= r.serviceRadiusKm;
        }
        // Sitters / trainers / stations — use customer's search radius preference
        return r.distanceKm <= searchRadius;
      });
    } else if (cityStr && cityStr.trim().length > 0) {
      // Fallback: text-based city matching when no coordinates
      const searchVariants = normalizeCitySearch(cityStr);
      filteredResults = results.filter(r => {
        if (!r.location) return false;
        const providerCity = r.location.toLowerCase();
        return searchVariants.some(variant =>
          providerCity.includes(variant) || variant.includes(providerCity)
        );
      });
    }
    
    // Filter by minimum rating
    if (Number(minRating) > 0) {
      filteredResults = filteredResults.filter(r => (r.rating || 0) >= Number(minRating));
    }

    // Filter by max price
    if (maxPrice) {
      const maxPriceNum = Number(maxPrice);
      filteredResults = filteredResults.filter(r => {
        const nightPrice = r.pricing.perNight ? parseFloat(r.pricing.perNight) : null;
        const hourPrice = r.pricing.perHour ? parseFloat(r.pricing.perHour) : null;
        const lowestPrice = nightPrice || hourPrice || 0;
        return lowestPrice <= maxPriceNum;
      });
    }

    // When the customer provided coordinates, default to proximity-first ordering
    const hasCoords = searchLat !== null && searchLng !== null;
    const sortByStr = (sortBy as string) || (hasCoords ? 'distance' : 'bestMatch');
    
    const computeMatchScore = (provider: typeof filteredResults[0]) => {
      let score = 0;
      const rating = provider.rating || 0;
      if (hasCoords) {
        // Proximity-first: south Tel Aviv providers beat north Tel Aviv providers for a south Tel Aviv customer
        // Distance is 60% of score — closest provider wins; rating breaks ties (30%), completeness (10%)
        if (provider.distanceKm !== null) {
          const maxDist = Math.max(searchRadius, provider.serviceRadiusKm || searchRadius, 1);
          const distScore = Math.max(0, 1 - (provider.distanceKm / maxDist));
          score += distScore * 60;
        }
        // No coordinates → treat as very far away (score 0 for distance, appears last)
        score += (rating / 5) * 30;
        if (provider.bio && provider.bio.length > 50) score += 5;
        if (provider.profilePhotoUrl) score += 5;
      } else {
        // No coordinates: rating-first mode
        score += (rating / 5) * 40;
        const reviews = Math.min(provider.reviewCount, 100);
        score += (reviews / 100) * 20;
        score += 30; // No distance penalty
        if (provider.bio && provider.bio.length > 50) score += 5;
        if (provider.profilePhotoUrl) score += 5;
      }
      return score;
    };

    filteredResults.sort((a, b) => {
      if (sortByStr === 'distance' || sortByStr === 'proximity' || sortByStr === 'bestMatch') {
        // Primary: closest first (providers without coordinates go to the bottom)
        const distA = a.distanceKm ?? 9999;
        const distB = b.distanceKm ?? 9999;
        // Hyper-local: providers more than 50m apart are sorted purely by distance.
        // Only within 50m (same building/entrance) does rating break the tie.
        if (Math.abs(distA - distB) > 0.05) return distA - distB;
        // Within 50m (same building or adjacent entrance) → sort by match score
        return computeMatchScore(b) - computeMatchScore(a);
      }
      if (sortByStr === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortByStr === 'price') {
        const priceA = parseFloat(a.pricing.perNight || a.pricing.perHour || '9999');
        const priceB = parseFloat(b.pricing.perNight || b.pricing.perHour || '9999');
        return priceA - priceB;
      }
      if (sortByStr === 'reviews') {
        return b.reviewCount - a.reviewCount;
      }
      return computeMatchScore(b) - computeMatchScore(a);
    });
    
    // Apply pagination
    const paginatedResults = filteredResults.slice(offset, offset + Number(limit));

    res.json({
      success: true,
      providers: paginatedResults,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredResults.length,
        hasMore: filteredResults.length > offset + Number(limit)
      },
      searchLocation: searchLat !== null && searchLng !== null ? { lat: searchLat, lng: searchLng } : null,
      filters: { platform, serviceType, startDate, endDate, city, lat, lng, radius: searchRadius, minRating, maxPrice, sortBy: sortByStr }
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Provider search error', { error: error?.message || String(error) });
    res.status(500).json({ success: false, error: error?.message || 'Search failed' });
  }
});

// Get provider availability calendar
router.get('/provider/:providerId/availability', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { startDate, endDate, platform } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const availability = await db.select()
      .from(providerAvailability)
      .where(
        and(
          eq(providerAvailability.providerId, providerId),
          gte(providerAvailability.date, start),
          lte(providerAvailability.date, end),
          platform ? eq(providerAvailability.platform, platform as string) : sql`true`
        )
      )
      .orderBy(providerAvailability.date);

    // Create date map for easy lookup
    const dateMap: Record<string, { available: boolean; price?: number; bookingsCount?: number }> = {};
    availability.forEach(slot => {
      const dateStr = slot.date.toISOString().split('T')[0];
      dateMap[dateStr] = {
        available: slot.isAvailable || false,
        price: slot.customPriceCents ? slot.customPriceCents / 100 : undefined,
        bookingsCount: slot.currentBookingsCount || 0
      };
    });

    res.json({
      success: true,
      providerId,
      availability: dateMap,
      range: { start: start.toISOString(), end: end.toISOString() }
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Availability error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Provider updates their availability
router.post('/provider/:providerId/availability', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { providerId } = req.params;
    const { dates, isAvailable, customPrice, platform, maxBookings, notes } = req.body;

    // P1-FIX: Enforce that the caller IS the provider — or is an admin.
    // Before this fix the ownership check was commented out ("for testing"),
    // meaning any authenticated user could block/unblock any provider's calendar.
    const callerIsAdmin = req.user?.customClaims?.admin === true ||
      req.user?.email?.endsWith('@petwash.co.il');
    if (userId !== providerId && !callerIsAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized to modify this provider\'s availability' });
    }

    const results = [];
    for (const dateStr of dates as string[]) {
      const date = new Date(dateStr);
      
      const [existing] = await db.select()
        .from(providerAvailability)
        .where(
          and(
            eq(providerAvailability.providerId, providerId),
            eq(providerAvailability.date, date),
            eq(providerAvailability.platform, platform || 'sitter_suite')
          )
        )
        .limit(1);

      if (existing) {
        await db.update(providerAvailability)
          .set({
            isAvailable,
            customPriceCents: customPrice ? Math.round(customPrice * 100) : null,
            maxBookingsPerDay: maxBookings,
            notes,
            updatedAt: new Date()
          })
          .where(eq(providerAvailability.id, existing.id));
        results.push({ date: dateStr, action: 'updated' });
      } else {
        await db.insert(providerAvailability).values({
          providerId,
          platform: platform || 'sitter_suite',
          date,
          isAvailable,
          customPriceCents: customPrice ? Math.round(customPrice * 100) : null,
          maxBookingsPerDay: maxBookings || 1,
          notes
        });
        results.push({ date: dateStr, action: 'created' });
      }
    }

    res.json({ success: true, updates: results });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Update availability error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Provider creates/updates their rate card
router.post('/provider/rate-card', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      platform,
      serviceType,
      baseRatePerNight,
      baseRatePerHour,
      baseRatePerVisit,
      additionalPetSurcharge,
      weekendSurchargePercent,
      holidaySurchargePercent,
      maxPets,
      acceptedPetTypes,
      addons,
      instantBooking,
      cancellationPolicy,
      displayName,
      bio,
      profilePhotoUrl,
      location
    } = req.body;

    // Check if rate card exists
    const [existing] = await db.select()
      .from(providerRateCards)
      .where(
        and(
          eq(providerRateCards.providerId, userId),
          eq(providerRateCards.platform, platform),
          eq(providerRateCards.serviceType, serviceType)
        )
      )
      .limit(1);

    const rateCardData = {
      baseRatePerNightCents: baseRatePerNight ? Math.round(baseRatePerNight * 100) : null,
      baseRatePerHourCents: baseRatePerHour ? Math.round(baseRatePerHour * 100) : null,
      baseRatePerVisitCents: baseRatePerVisit ? Math.round(baseRatePerVisit * 100) : null,
      additionalPetSurchargeCents: additionalPetSurcharge ? Math.round(additionalPetSurcharge * 100) : null,
      weekendSurchargePercent: weekendSurchargePercent || 0,
      holidaySurchargePercent: holidaySurchargePercent || 0,
      maxPets: maxPets || 4,
      acceptedPetTypes: acceptedPetTypes || ['dog', 'cat'],
      addonsAvailable: addons || [],
      instantBooking: instantBooking || false,
      cancellationPolicy: cancellationPolicy || 'flexible',
      displayName,
      bio,
      profilePhotoUrl,
      location,
      isActive: true,
      updatedAt: new Date()
    };

    if (existing) {
      await db.update(providerRateCards)
        .set(rateCardData)
        .where(eq(providerRateCards.id, existing.id));

      res.json({ success: true, action: 'updated', rateCardId: existing.rateCardId });
    } else {
      const rateCardId = `RATE-${nanoid(12)}`;
      await db.insert(providerRateCards).values({
        rateCardId,
        providerId: userId,
        platform,
        serviceType,
        ...rateCardData
      });

      res.json({ success: true, action: 'created', rateCardId });
    }
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Rate card error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/process-escrow-releases', async (req, res) => {
  try {
    // SECURITY FIX (item 25): Plain === comparison is vulnerable to timing attacks.
    // BEFORE: adminKey !== process.env.ADMIN_API_KEY  — leaks secret length and prefix via timing.
    // AFTER:  timingSafeEqual with fixed-length buffers eliminates the timing oracle.
    const { timingSafeEqual } = await import('crypto');
    const adminKey = (req.headers['x-admin-key'] as string) || '';
    const expectedKey = process.env.ADMIN_API_KEY || '';
    const adminKeyMatches = expectedKey.length > 0 &&
      adminKey.length === expectedKey.length &&
      timingSafeEqual(Buffer.from(adminKey), Buffer.from(expectedKey));
    if (!adminKeyMatches) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const releasedCount = await bookingLifecycleService.processEscrowReleases();

    res.json({ 
      success: true, 
      message: `Released ${releasedCount} escrow holdings` 
    });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Escrow release error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
