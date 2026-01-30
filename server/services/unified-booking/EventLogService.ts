/**
 * EVENT LOG SERVICE
 * ==================
 * Audit trail for all booking-related actions
 * 
 * GUARANTEES:
 * - All admin actions are logged
 * - All status changes are recorded
 * - HR and Finance can audit any booking
 * - Logs are append-only (never modified)
 */

import { nanoid } from 'nanoid';
import { db } from '../../db';
import { bookingStatusHistory, auditLedger } from '@shared/schema';
import { logger } from '../../lib/logger';
import type { EventLog, Role } from './types';

export class EventLogService {
  
  /**
   * Log any booking-related event
   */
  async log(params: {
    actorId: string;
    actorRole: Role;
    action: string;
    bookingId?: string;
    transactionId?: string;
    description?: string;
    meta?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<EventLog> {
    const event: EventLog = {
      id: `evt_${nanoid(16)}`,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      bookingId: params.bookingId,
      transactionId: params.transactionId,
      description: params.description,
      meta: params.meta,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt: new Date()
    };

    try {
      await db.insert(auditLedger).values({
        id: event.id,
        actorId: params.actorId,
        action: params.action,
        targetType: 'booking',
        targetId: params.bookingId || params.transactionId || 'system',
        details: {
          actorRole: params.actorRole,
          transactionId: params.transactionId,
          description: params.description,
          ...params.meta
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      });

      logger.debug('[EventLog] Recorded event', {
        eventId: event.id,
        action: params.action,
        actorId: params.actorId,
        bookingId: params.bookingId
      });

      return event;
    } catch (error: any) {
      logger.error('[EventLog] Failed to record event', {
        error: error.message,
        action: params.action
      });
      throw error;
    }
  }

  /**
   * Log booking status change with before/after
   */
  async logStatusChange(params: {
    bookingId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
    changedByRole: Role;
    reason?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await db.insert(bookingStatusHistory).values({
        bookingId: params.bookingId,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        changedBy: params.changedBy,
        reason: params.reason
      });

      await this.log({
        actorId: params.changedBy,
        actorRole: params.changedByRole,
        action: 'BOOKING_STATUS_CHANGED',
        bookingId: params.bookingId,
        description: `Status changed from ${params.previousStatus} to ${params.newStatus}`,
        meta: {
          previousStatus: params.previousStatus,
          newStatus: params.newStatus,
          reason: params.reason
        },
        ipAddress: params.ipAddress
      });

      logger.info('[EventLog] Status change recorded', {
        bookingId: params.bookingId,
        from: params.previousStatus,
        to: params.newStatus,
        by: params.changedBy
      });
    } catch (error: any) {
      logger.error('[EventLog] Failed to log status change', {
        error: error.message,
        bookingId: params.bookingId
      });
    }
  }

  /**
   * Log admin-granted free wash
   */
  async logAdminFreeWash(params: {
    adminId: string;
    bookingId: string;
    machineId: string;
    bay?: string;
    minutes: number;
    reason?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      actorId: params.adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_GRANTED_FREE_WASH',
      bookingId: params.bookingId,
      description: `Admin granted free ${params.minutes}-minute wash`,
      meta: {
        machineId: params.machineId,
        bay: params.bay,
        minutes: params.minutes,
        reason: params.reason
      },
      ipAddress: params.ipAddress
    });
  }

  /**
   * Log booking creation
   */
  async logBookingCreated(params: {
    bookingId: string;
    userId: string;
    userRole: Role;
    serviceId: string;
    resourceId: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      actorId: params.userId,
      actorRole: params.userRole,
      action: 'BOOKING_CREATED',
      bookingId: params.bookingId,
      description: 'Booking draft created',
      meta: {
        serviceId: params.serviceId,
        resourceId: params.resourceId
      },
      ipAddress: params.ipAddress
    });
  }

  /**
   * Log payment received
   */
  async logPaymentReceived(params: {
    bookingId: string;
    transactionId: string;
    userId: string;
    amount: number;
    provider: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      actorId: params.userId,
      actorRole: 'USER',
      action: 'PAYMENT_RECEIVED',
      bookingId: params.bookingId,
      transactionId: params.transactionId,
      description: `Payment of ${params.amount} ILS received via ${params.provider}`,
      meta: {
        amount: params.amount,
        provider: params.provider
      },
      ipAddress: params.ipAddress
    });
  }

  /**
   * Log refund processed
   */
  async logRefundProcessed(params: {
    bookingId: string;
    transactionId: string;
    processedBy: string;
    processedByRole: Role;
    amount: number;
    reason: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      actorId: params.processedBy,
      actorRole: params.processedByRole,
      action: 'REFUND_PROCESSED',
      bookingId: params.bookingId,
      transactionId: params.transactionId,
      description: `Refund of ${params.amount} ILS processed`,
      meta: {
        amount: params.amount,
        reason: params.reason
      },
      ipAddress: params.ipAddress
    });
  }
}

export const eventLogService = new EventLogService();
