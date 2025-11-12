import express from "express";
import admin from "firebase-admin";
import { requireAuth } from "../customAuth";
import VATCalculatorService from "../services/VATCalculatorService";
import EscrowService from "../services/EscrowService";
import NotificationService from "../services/NotificationService";
import ChatService from "../services/ChatService";

const router = express.Router();
const db = admin.firestore();

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

    const vatCalc = VATCalculatorService.calculateVAT(booking.baseAmount);

    // Fetch provider details to enrich booking
    const providerDoc = await db.collection("providers").doc(booking.providerId).get();
    const providerData = providerDoc.exists ? providerDoc.data() : {};
    const providerName = providerData?.name || "Provider";
    const providerPhoto = providerData?.photo || null;

    // Calculate dates
    const serviceDate = new Date(booking.serviceDate);
    const endDate = new Date(serviceDate);
    if (booking.duration) {
      endDate.setDate(endDate.getDate() + booking.duration);
    }

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

export default router;
