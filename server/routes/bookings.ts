import express from "express";
import { db } from "../lib/firebase-admin";
import { db as pgDb } from "../db";
import { requireAuth } from "../customAuth";
import VATCalculatorService from "../services/VATCalculatorService";
import EscrowService from "../services/EscrowService";
import NotificationService from "../services/NotificationService";
import ChatService from "../services/ChatService";
import { ImmutableStampService } from "../services/ImmutableStampService";
import { petWashOrchestrator } from "../services/PetWashOperationsOrchestrator";
import { logger } from "../lib/logger";
import { BookingLockService } from "../services/BookingLockService";
import { isSuperAdmin } from "../middleware/rbac";
import { computeAndPersistSettlement } from "../services/SettlementEngine";
import { stations } from "@shared/schema";
import { eq, and, sql as drizzleSql } from "drizzle-orm";

const router = express.Router();

interface BookingRequest {
  platform: "sitter-suite" | "walk-my-pet"; // "pettrek" removed — legally blocked March 2026
  providerId: string;
  serviceDate: string;
  timeSlot?: string;
  duration?: number;
  petIds: string[];
  baseAmount: number;
  metadata?: any;
  // Phase 10 — T22: optional station assignment
  stationId?: number;
}

router.post("/create", requireAuth, async (req, res) => {
  try {
    const customerId = req.user!.uid;
    const booking: BookingRequest = req.body;

    // LEGAL BLOCK: PetTrek is not licensed in Israel — hard reject at booking layer
    if ((booking as any).platform === 'pettrek' || (booking as any).platform === 'pet_trek') {
      return res.status(403).json({
        error: 'service_legally_blocked',
        code: 'PETTREK_NOT_LICENSED',
        message: 'PetTrek™ bookings are not available — service pending licensing in Israel.',
      });
    }

    // Validate service date is not in the past (Israel timezone)
    const serviceDate = new Date(booking.serviceDate);
    if (isNaN(serviceDate.getTime())) {
      return res.status(400).json({ error: "Invalid service date format" });
    }
    const todayIsrael = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const serviceDateStr = serviceDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    if (serviceDateStr < todayIsrael) {
      return res.status(400).json({ error: "Service date cannot be in the past" });
    }

    // Calculate end date
    const endDate = new Date(serviceDate);
    if (booking.duration) {
      endDate.setDate(endDate.getDate() + booking.duration);
    }

    // Check provider availability - look for conflicting confirmed bookings
    const existingBookings = await db.collection("bookings")
      .where("providerId", "==", booking.providerId)
      .where("status", "in", ["confirmed", "in_progress"])
      .get();

    const hasConflict = existingBookings.docs.some((doc: any) => {
      const b = doc.data();
      const bStart = new Date(b.startDate || b.serviceDate);
      const bEnd = new Date(b.endDate || b.startDate || b.serviceDate);
      return serviceDate < bEnd && endDate > bStart;
    });

    if (hasConflict) {
      return res.status(409).json({
        error: "Provider is not available for the selected dates",
        code: "PROVIDER_UNAVAILABLE",
      });
    }

    // ── Phase 10 T22: Station assignment ──────────────────────────────────────
    // If stationId is provided, validate the station is active.
    // If not provided, auto-assign the station with the most availability.
    let resolvedStationId: number | null = null;
    let resolvedStationName: string | null = null;

    if (booking.stationId != null) {
      const [station] = await pgDb
        .select({ id: stations.id, name: stations.name, isActive: stations.isActive })
        .from(stations)
        .where(eq(stations.id, booking.stationId))
        .limit(1);

      if (!station) {
        return res.status(400).json({ error: 'Station not found', code: 'STATION_NOT_FOUND' });
      }
      if (!station.isActive) {
        return res.status(400).json({ error: 'Station is not active', code: 'STATION_INACTIVE' });
      }
      resolvedStationId = station.id;
      resolvedStationName = station.name;
    } else {
      // Auto-assign: composite score (availability 60% + rankingScore 40%)
      // lat/lng are not present in the booking request, so geo component is omitted.
      // BUSY_THRESHOLD mirrors the recommendation route (20 bookings / 7 days).
      const BUSY_THRESHOLD = 20;
      const autoRows = await pgDb.execute(drizzleSql`
        SELECT s.id, s.name,
               COALESCE(bc.upcoming, 0)::int                            AS upcoming,
               COALESCE(s.ranking_score, 50)::int                       AS ranking_score,
               (1.0 - LEAST(COALESCE(bc.upcoming, 0)::float / ${BUSY_THRESHOLD}, 1.0)) * 0.60
                 + (COALESCE(s.ranking_score, 50)::float / 100.0) * 0.40 AS composite
        FROM stations s
        LEFT JOIN (
          SELECT station_id, COUNT(*)::int AS upcoming
          FROM bookings
          WHERE start_time >= NOW()
            AND start_time < NOW() + INTERVAL '7 days'
            AND status IN ('accepted','confirmed','started','pending')
          GROUP BY station_id
        ) bc ON bc.station_id = s.id
        WHERE s.is_active = true
        ORDER BY composite DESC
        LIMIT 1
      `);
      interface AutoAssignRow { id: number; name: string; upcoming: number; ranking_score: number; composite: number; }
      const best = autoRows.rows[0] as AutoAssignRow | undefined;
      if (best) {
        resolvedStationId = Number(best.id);
        resolvedStationName = best.name;
      }
    }

    const grossCollectedILS = VATCalculatorService.grossFromProviderShare(booking.baseAmount);
    const vatCalc = VATCalculatorService.calculateMarketplaceVAT(grossCollectedILS);

    // Fetch provider details to enrich booking
    const providerDoc = await db.collection("providers").doc(booking.providerId).get();
    const providerData = providerDoc.exists ? providerDoc.data() : {};
    const providerName = providerData?.name || "Provider";
    const providerPhoto = providerData?.photo || null;

    const bookingRef = db.collection("bookings").doc();
    const bookingData = {
      id: bookingRef.id,
      customerId,
      providerId: booking.providerId,
      providerName,
      providerPhoto,
      platform: booking.platform,
      serviceDate,
      startDate: serviceDate.toISOString(),
      endDate: endDate.toISOString(),
      timeSlot: booking.timeSlot,
      duration: booking.duration,
      petIds: booking.petIds,
      baseAmount: vatCalc.providerGross,
      commission: vatCalc.platformFeeGross,
      vat: vatCalc.vatOnPlatformFee,
      totalAmount: vatCalc.grossCollectedILS,
      totalPrice: vatCalc.grossCollectedILS,
      currency: "ILS",
      status: "confirmed", // Mark as confirmed after payment
      createdAt: new Date(),
      // Phase 10 — T22: station assignment
      ...(resolvedStationId != null ? { stationId: resolvedStationId, stationName: resolvedStationName } : {}),
      ...(booking.metadata !== undefined ? { metadata: booking.metadata } : {}),
    };

    await bookingRef.set(bookingData);

    if (booking.platform === "sitter-suite") {
      await EscrowService.createEscrowPayment(
        bookingRef.id,
        customerId,
        booking.providerId,
        vatCalc.grossCollectedILS,
        undefined,
        { bookingPlatform: booking.platform }
      );
    }

    await VATCalculatorService.recordTransaction(
      booking.platform,
      bookingRef.id,
      booking.baseAmount,
      bookingRef.id,
      { type: "booking" }
    );

    await ChatService.createConversation(
      customerId,
      booking.providerId,
      bookingRef.id,
      booking.platform === "sitter-suite" ? "sitter" : booking.platform === "walk-my-pet" ? "walk" : "transport"
    );

    await NotificationService.sendNotification({
      userId: customerId,
      type: "booking",
      title: "Booking Confirmed!",
      message: `Your ${booking.platform} booking has been confirmed for ${new Date(booking.serviceDate).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}. Total: ₪${vatCalc.grossCollectedILS.toFixed(2)}`,
      priority: "high",
      channel: "all",
      data: { bookingId: bookingRef.id, platform: booking.platform },
    });

    await NotificationService.sendNotification({
      userId: booking.providerId,
      type: "booking",
      title: "New Booking Request",
      message: `You have a new booking for ${new Date(booking.serviceDate).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
      priority: "high",
      channel: "all",
      data: { bookingId: bookingRef.id },
    });

    res.json({ booking: bookingData });
  } catch (error: any) {
    console.error("[Bookings] Error creating:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/my-bookings", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { role, platform } = req.query;

    const queryField = role === "provider" ? "providerId" : "customerId";
    let query = db
      .collection("bookings")
      .where(queryField, "==", userId);
    
    if (platform) {
      query = query.where("platform", "==", platform);
    }
    
    const snapshot = await query
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    // Convert Firestore Timestamps to ISO strings for frontend
    const bookings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        serviceDate: data.serviceDate?.toDate ? data.serviceDate.toDate().toISOString() : data.serviceDate,
        startDate: data.startDate || (data.serviceDate?.toDate ? data.serviceDate.toDate().toISOString() : data.serviceDate),
        endDate: data.endDate || (data.serviceDate?.toDate ? data.serviceDate.toDate().toISOString() : data.serviceDate),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      };
    });
    
    res.json({ bookings });
  } catch (error: any) {
    console.error("[Bookings] Error fetching:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bookings/availability — MUST be defined before /:bookingId to avoid param shadowing
router.get("/availability", async (req, res) => {
  try {
    const { platform, providerId, from, to } = req.query;

    if (!platform || !providerId || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query params: platform, providerId, from, to',
      });
    }

    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    const { db: pgDb } = await import('../db');
    const { availabilitySlots } = await import('@shared/schema');
    const { eq, and, gte, lte } = await import('drizzle-orm');

    const slots = await pgDb.query.availabilitySlots.findMany({
      where: and(
        eq(availabilitySlots.providerId, Number(providerId)),
        gte(availabilitySlots.startTime, fromDate),
        lte(availabilitySlots.endTime, toDate)
      ),
    });

    const now = new Date();
    const availableSlots = slots
      .filter((slot) => {
        if (slot.status === 'booked') return false;
        if (slot.status === 'held' && slot.lockExpiresAt && new Date(slot.lockExpiresAt) > now) return false;
        return true;
      })
      .map((slot) => ({
        id: slot.id,
        providerId: slot.providerId,
        platform: slot.platformId,
        start: slot.startTime.toISOString(),
        end: slot.endTime.toISOString(),
        status: slot.status === 'booked' ? 'BOOKED' : (slot.status === 'held' && slot.lockExpiresAt && new Date(slot.lockExpiresAt) > now ? 'HELD' : 'AVAILABLE'),
        timezone: slot.timezone || 'Asia/Jerusalem',
      }));

    return res.status(200).json({ success: true, slots: availableSlots, count: availableSlots.length });
  } catch (error: any) {
    console.error('[Bookings] Availability error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get("/:bookingId", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const doc = await db.collection("bookings").doc(bookingId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ booking: doc.data() });
  } catch (error: any) {
    console.error("[Bookings] Error fetching booking:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:bookingId/confirm", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.uid;

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const booking = bookingDoc.data()!;

    // SECURITY: Only the assigned provider, the booking owner, or an admin can confirm
    const isBookingProvider = booking.providerId === userId;
    const isBookingOwner = booking.userId === userId || booking.customerId === userId;
    // firebaseUser.claims.role is not a custom claim we set — always use isSuperAdmin()
    const isSuperAdminUser = isSuperAdmin(((req as any).firebaseUser?.email || '').toLowerCase());

    if (!isBookingProvider && !isBookingOwner && !isSuperAdminUser) {
      logger.warn('[Bookings] Unauthorized confirm attempt', { userId, bookingId, providerId: booking.providerId, customerId: booking.userId });
      return res.status(403).json({ error: "Forbidden — you are not the assigned provider or booking owner" });
    }

    // SECURITY: Only confirm bookings in pending/awaiting_confirmation state
    const confirmableStates = ['pending', 'awaiting_confirmation', 'payment_held'];
    if (booking.status && !confirmableStates.includes(booking.status)) {
      return res.status(409).json({ error: `Cannot confirm a booking with status: ${booking.status}` });
    }

    await db.collection("bookings").doc(bookingId).update({
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: userId,
    });

    res.json({ success: true });

    // ── Non-blocking: Google Sheets sync + email notification ───────────────
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId,
          customerName: `${booking.customerFirstName || ''} ${booking.customerLastName || ''}`.trim() || 'Customer',
          email: booking.customerEmail || '',
          phone: booking.customerPhone || '',
          petName: booking.petName || '',
          petType: booking.petType || 'pet',
          sitterName: booking.providerName || 'Provider',
          startDate: booking.startDate || booking.serviceDate || '',
          endDate: booking.endDate || booking.serviceDate || '',
          durationDays: booking.durationDays || 1,
          totalAmount: booking.totalAmount || 0,
          status: 'confirmed',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[Bookings] Google Sheets sync failed (non-blocking) bookingId=${bookingId} reason=${sheetsErr?.message || sheetsErr}`);
      }
    });

    if (booking) {
      const serviceDate = booking.serviceDate?.toDate?.() || new Date(booking.serviceDate || Date.now());
      setImmediate(() => petWashOrchestrator.handleBookingConfirmed({
        bookingId,
        bookingRef: booking.bookingRef || bookingId,
        platform: booking.platform || 'PetWash',
        serviceType: booking.serviceType || booking.service || 'Pet Service',
        customerName: `${booking.customerFirstName || ''} ${booking.customerLastName || ''}`.trim() || 'Customer',
        customerEmail: booking.customerEmail || '',
        customerPhone: booking.customerPhone || booking.phone || '',
        providerName: booking.providerName || 'Provider',
        providerEmail: booking.providerEmail,
        petName: booking.petName,
        scheduledDate: serviceDate.toISOString().slice(0, 10),
        scheduledTime: booking.serviceTime || booking.time || '',
        address: booking.address,
        city: booking.city,
        amountILS: booking.totalAmount || booking.priceILS,
      }).catch(e => logger.warn('[Bookings] Orchestrator hook error', e)));
    }
  } catch (error: any) {
    console.error("[Bookings] Error confirming:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:bookingId/complete", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.uid;

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    const booking = bookingDoc.data();

    await db.collection("bookings").doc(bookingId).update({
      status: "completed",
      completedAt: new Date(),
      completedBy: userId,
    });

    if (booking?.platform === "sitter-suite") {
      const escrows = await EscrowService.getEscrowsByBooking(bookingId);
      for (const escrow of escrows) {
        if (escrow.status === "held") {
          await EscrowService.releaseEscrowPayment(escrow.id, userId);
        }
      }
    }

    // Immutable legal stamp — booking completion event
    void ImmutableStampService.createStamp({
      entityType: 'booking',
      entityId: bookingId,
      eventType: 'booking_completed',
      actorUid: userId,
      actorRole: 'user',
      metadata: { platform: booking?.platform ?? 'unknown', completedAt: new Date().toISOString() },
    }).catch(() => {});

    // Settlement engine — fire-and-forget, non-blocking, idempotent.
    // Source of truth: PostgreSQL bookings table (Drizzle).
    // If the booking has no stationId in PostgreSQL, this is a silent no-op.
    void computeAndPersistSettlement(bookingId).catch((err) => {
      logger.error('[Bookings] Settlement engine error (non-fatal)', { bookingId, error: err?.message });
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Bookings] Error completing:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:bookingId/cancel", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.uid;

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    const booking = bookingDoc.data();

    await db.collection("bookings").doc(bookingId).update({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason: reason,
    });

    if (booking?.platform === "sitter-suite") {
      const escrows = await EscrowService.getEscrowsByBooking(bookingId);
      for (const escrow of escrows) {
        if (escrow.status === "held") {
          await EscrowService.refundEscrowPayment(escrow.id, reason, userId);
        }
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Bookings] Error cancelling:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== AVAILABILITY-BASED BOOKING SYSTEM (2025) ===================
// 5-minute payment lock system for marketplace bookings
// NOTE: router.get("/availability") is defined ABOVE /:bookingId to prevent route shadowing

/**
 * POST /api/bookings/lock
 * Acquire 5-minute lock on availability slot
 */
router.post("/lock", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { slotId, lockDurationSeconds } = req.body;

    if (!slotId || typeof slotId !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid slotId is required',
      });
    }

    const result = await BookingLockService.acquireLock({
      slotId,
      userId,
      lockDurationSeconds,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Calculate seconds remaining
    const secondsLeft = result.expiresAt
      ? Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000))
      : 0;
    
    return res.status(200).json({
      success: true,
      lockToken: result.lockToken,
      expiresAt: result.expiresAt?.toISOString(),
      secondsLeft,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[Bookings] Lock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/bookings/release
 * Manually release a lock
 */
router.post("/release", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { lockToken } = req.body;

    if (!lockToken || typeof lockToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid lockToken is required',
      });
    }

    const result = await BookingLockService.releaseLock(lockToken, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[Bookings] Release error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
