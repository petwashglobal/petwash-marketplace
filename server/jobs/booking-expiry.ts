import { db } from '../db';
import { walkBookings, sitterBookings } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { syncChatToBookingStatus } from '../lib/booking-chat-sync';

/**
 * Poller that expires bookings stuck in pending_provider status
 */
export function startBookingExpiryPoller() {
  logger.info('[BookingExpiry] Starting poller (5m interval)');
  
  setInterval(async () => {
    try {
      const now = new Date();
      
      // 1. Walk bookings: expire after 2 hours
      const walkExpiryTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const expiredWalks = await db.select({ bookingId: walkBookings.bookingId })
        .from(walkBookings)
        .where(and(
          eq(walkBookings.status, 'pending_provider'),
          lt(walkBookings.createdAt, walkExpiryTime)
        ));

      for (const walk of expiredWalks) {
        logger.info('[BookingExpiry] Expiring walk booking', { bookingId: walk.bookingId });
        await db.update(walkBookings)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(walkBookings.bookingId, walk.bookingId));
        
        await syncChatToBookingStatus(walk.bookingId, 'expired', 'walk_my_pet');
      }

      // 2. Sitter bookings: expire after 4 hours
      const sitterExpiryTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      const expiredSitters = await db.select({ bookingId: sitterBookings.bookingId })
        .from(sitterBookings)
        .where(and(
          eq(sitterBookings.status, 'pending_provider'),
          lt(sitterBookings.createdAt, sitterExpiryTime)
        ));

      for (const sitter of expiredSitters) {
        logger.info('[BookingExpiry] Expiring sitter booking', { bookingId: sitter.bookingId });
        await db.update(sitterBookings)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(sitterBookings.bookingId, sitter.bookingId));
        
        await syncChatToBookingStatus(sitter.bookingId, 'expired', 'sitter_suite');
      }

    } catch (error) {
      logger.error('[BookingExpiry] Poller error', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}
