import { DomainEvent, DomainEventType, StationStatusChangedPayload } from '@shared/events';
import { logger } from '../../lib/logger';
import { db } from '../../db';
import { stations } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function handleStationStatusChanged(event: DomainEvent<StationStatusChangedPayload>): Promise<void> {
  const { stationId, oldStatus, newStatus, reason } = event.payload;

  logger.info('[StationStatusChangedHandler] Processing station status change', {
    eventId: event.id,
    stationId,
    oldStatus,
    newStatus,
    reason,
  });

  try {
    if (newStatus === 'offline' || newStatus === 'maintenance') {
      logger.warn('[StationStatusChangedHandler] Station went offline or into maintenance', {
        stationId,
        newStatus,
        reason,
      });
    }

    if (newStatus === 'online' && oldStatus !== 'online') {
      logger.info('[StationStatusChangedHandler] Station is back online', {
        stationId,
        previousStatus: oldStatus,
      });
    }

    logger.info('[StationStatusChangedHandler] Successfully processed station status change', {
      eventId: event.id,
      stationId,
    });
  } catch (error: any) {
    logger.error('[StationStatusChangedHandler] Failed to process station status change', {
      eventId: event.id,
      stationId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
