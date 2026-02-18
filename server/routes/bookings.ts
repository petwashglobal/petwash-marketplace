import express from "express";
import { db } from "../lib/firebase-admin";
import { requireAuth } from "../customAuth";
import VATCalculatorService from "../services/VATCalculatorService";
import EscrowService from "../services/EscrowService";
import NotificationService from "../services/NotificationService";
import ChatService from "../services/ChatService";

const router = express.Router();

interface BookingRequest {
  platform: "sitter-suite" | "walk-my-pet" | "pettrek";
  providerId: string;
  serviceDate: string;
  timeSlot?: string;
  duration?: number;
  petIds: string[];
  baseAmount: number;
  metadata?: any;
}

router.post("/create", requireAuth, async (req, res) => {
  try {
    const customerId = req.user!.uid;
    const booking: BookingRequest = req.body;

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

    const vatCalc = VATCalculatorService.calculateVAT(booking.baseAmount);

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
      baseAmount: vatCalc.baseAmount,
      commission: vatCalc.commission,
      vat: vatCalc.vatOnCommission,
      totalAmount: vatCalc.totalCharged,
      totalPrice: vatCalc.totalCharged,
      currency: "ILS",
      status: "confirmed", // Mark as confirmed after payment
      createdAt: new Date(),
      metadata: booking.metadata,
    };

    await bookingRef.set(bookingData);

    if (booking.platform === "sitter-suite") {
      await EscrowService.createEscrowPayment(
        bookingRef.id,
        customerId,
        booking.providerId,
        vatCalc.totalCharged,
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

    await NotificationService.sendBookingConfirmation(customerId, {
      bookingId: bookingRef.id,
      platform: booking.platform,
      date: booking.serviceDate,
      total: vatCalc.totalCharged,
    });

    await NotificationService.sendNotification({
      userId: booking.providerId,
      type: "booking",
      title: "New Booking Request 🎉",
      message: `You have a new booking for ${new Date(booking.serviceDate).toLocaleDateString()}`,
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

    await db.collection("bookings").doc(bookingId).update({
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: userId,
    });

    res.json({ success: true });
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

// import { BookingLockService } from "../services/BookingLockService"; // TODO: Re-enable when service is created
import { db as pgDb } from '../db';
import { availabilitySlots } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

/**
 * GET /api/bookings/availability
 * Get available slots for a provider within date range
 */
router.get("/availability", async (req, res) => {
  try {
    const { platform, providerId, from, to } = req.query;

    if (!platform || !providerId || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query params: platform, providerId, from, to',
      });
    }

    // Parse dates
    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format',
      });
    }

    // Fetch slots from PostgreSQL
    const slots = await pgDb.query.availabilitySlots.findMany({
      where: and(
        eq(availabilitySlots.providerId, Number(providerId)),
        gte(availabilitySlots.startTime, fromDate),
        lte(availabilitySlots.endTime, toDate)
      ),
    });

    // Filter and format slots
    const now = new Date();
    const availableSlots = slots
      .filter((slot) => {
        // Must not be booked
        if (slot.status === 'booked') return false;
        
        // If held, check if lock expired
        if (slot.status === 'held' && slot.lockExpiresAt) {
          if (new Date(slot.lockExpiresAt) > now) return false;
        }

        return true;
      })
      .map((slot) => {
        // Determine status with proper casing
        let status = 'AVAILABLE';
        if (slot.status === 'booked') {
          status = 'BOOKED';
        } else if (slot.status === 'held' && slot.lockExpiresAt && new Date(slot.lockExpiresAt) > now) {
          status = 'HELD';
        }
        
        return {
          id: slot.id,
          providerId: slot.providerId,
          platform: slot.platformId,
          start: slot.startTime.toISOString(),
          end: slot.endTime.toISOString(),
          status,
          timezone: slot.timezone || 'Asia/Jerusalem',
        };
      });

    return res.status(200).json({
      success: true,
      slots: availableSlots,
      count: availableSlots.length,
    });
  } catch (error: any) {
    console.error('[Bookings] Availability error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

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
