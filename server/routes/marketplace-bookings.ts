import { Router } from 'express';
import { db } from '../db';
import { 
  bookings,
  bookingPets,
  bookingStatusHistory,
  escrowHoldings,
  providerRateCards,
  quoteRequests,
  pets,
  BOOKING_STATUS_TRANSITIONS,
  type BookingLifecycleStatus
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import bookingLifecycleService from '../services/BookingLifecycleService';

const router = Router();

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
      customerId
    } = req.body;

    // Also check header for authenticated user
    const userId = customerId || req.headers['x-user-id'] as string;

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

    res.json({ 
      success: true, 
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

router.post('/create', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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

router.get('/my-bookings', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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

router.get('/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
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

router.post('/:bookingId/transition', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const { newStatus, role = 'customer', reason } = req.body;

    await bookingLifecycleService.transitionStatus(
      bookingId,
      newStatus as BookingLifecycleStatus,
      userId,
      role as 'customer' | 'provider' | 'system' | 'admin',
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

router.post('/:bookingId/confirm', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const { role = 'customer' } = req.body;

    const targetStatus = role === 'provider' ? 'provider_confirmed' : 'owner_confirmed';
    
    await bookingLifecycleService.transitionStatus(
      bookingId,
      targetStatus as BookingLifecycleStatus,
      userId,
      role as 'customer' | 'provider',
      'Booking confirmed'
    );

    res.json({ success: true, status: targetStatus });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Confirm error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:bookingId/start', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    
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

router.post('/:bookingId/complete', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const { role = 'provider' } = req.body;

    const targetStatus = role === 'provider' 
      ? 'provider_completion_review' 
      : 'owner_completion_review';
    
    await bookingLifecycleService.transitionStatus(
      bookingId,
      targetStatus as BookingLifecycleStatus,
      userId,
      role as 'customer' | 'provider',
      'Service marked complete'
    );

    const booking = await bookingLifecycleService.getBookingWithHistory(bookingId);
    
    const ownerReviewed = booking?.statusHistory.some(h => h.toStatus === 'owner_completion_review');
    const providerReviewed = booking?.statusHistory.some(h => h.toStatus === 'provider_completion_review');

    if (ownerReviewed && providerReviewed) {
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

router.post('/:bookingId/cancel', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { bookingId } = req.params;
    const { reason, role = 'customer' } = req.body;

    await bookingLifecycleService.transitionStatus(
      bookingId,
      'cancelled',
      userId,
      role as 'customer' | 'provider',
      reason || 'Booking cancelled'
    );

    res.json({ success: true, status: 'cancelled' });
  } catch (error: any) {
    logger.error('[MarketplaceBookings] Cancel error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:bookingId/history', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
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

router.get('/:bookingId/escrow', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
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

router.post('/process-escrow-releases', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_API_KEY) {
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
