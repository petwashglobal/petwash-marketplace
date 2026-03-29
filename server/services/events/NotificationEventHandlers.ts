/**
 * Notification Event Handlers
 * Subscribe to EventBus events and trigger notifications
 */

import { eventBus } from '../EventBus';
import type { PlatformEvent } from '../EventBus';
import NotificationService from '../NotificationService';
import { logger } from '../../lib/logger';

/**
 * Register all notification event handlers
 */
export function registerNotificationEventHandlers() {
  
  // ==================== INCIDENT EVENTS ====================
  
  eventBus.subscribe('incident.reported', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Incident reported event received', {
      incidentId: event.data.incidentId,
    });
    
    try {
      await NotificationService.sendNotification({
        templateKey: 'incident_reported',
        variables: {
          incident: {
            id: event.data.incidentId,
            title: event.data.title || 'New Incident',
            severity: event.data.severity || 'medium',
            location: event.data.location || 'Unknown',
            reportedBy: event.data.reportedBy || 'System',
          },
          timestamp: new Date().toLocaleString('he-IL'),
        },
      });
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send incident notification', {
        error: error.message,
      });
    }
  }, 10); // High priority
  
  // ==================== INVENTORY EVENTS ====================
  
  eventBus.subscribe('inventory.low', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Inventory low event received', {
      itemId: event.data.itemId,
    });
    
    try {
      await NotificationService.sendNotification({
        templateKey: 'inventory_low',
        variables: {
          item: {
            id: event.data.itemId,
            name: event.data.itemName || 'Unknown Item',
            currentStock: event.data.currentStock || 0,
            minStock: event.data.minStock || 0,
            location: event.data.location || 'Unknown',
          },
          timestamp: new Date().toLocaleString('he-IL'),
        },
      });
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send inventory notification', {
        error: error.message,
      });
    }
  }, 10);
  
  // ==================== FINANCE EVENTS ====================
  
  eventBus.subscribe('settlement.generated', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Settlement generated event received', {
      settlementId: event.data.settlementId,
    });
    
    try {
      await NotificationService.sendNotification({
        templateKey: 'settlement_generated',
        variables: {
          settlement: {
            id: event.data.settlementId,
            period: event.data.period || 'Unknown',
            totalAmount: event.data.totalAmount || 0,
            currency: event.data.currency || 'ILS',
            franchiseId: event.data.franchiseId,
          },
          timestamp: new Date().toLocaleString('he-IL'),
        },
      });
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send settlement notification', {
        error: error.message,
      });
    }
  }, 10);
  
  // ==================== LOGISTICS EVENTS ====================
  
  eventBus.subscribe('logistics_task.assigned', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Logistics task assigned event received', {
      taskId: event.data.taskId,
      technicianId: event.data.technicianId,
    });
    
    try {
      await NotificationService.sendNotification({
        templateKey: 'logistics_task_assigned',
        userId: event.data.technicianId,
        variables: {
          task: {
            id: event.data.taskId,
            type: event.data.taskType || 'Maintenance',
            stationId: event.data.stationId,
            stationName: event.data.stationName || 'Unknown Station',
            priority: event.data.priority || 'normal',
            dueDate: event.data.dueDate,
          },
          technician: {
            id: event.data.technicianId,
            name: event.data.technicianName,
          },
          timestamp: new Date().toLocaleString('he-IL'),
        },
      });
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send logistics notification', {
        error: error.message,
      });
    }
  }, 10);
  
  // ==================== STATION EVENTS ====================
  
  eventBus.subscribe('station.heartbeat_missed', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Station heartbeat missed event received', {
      stationId: event.data.stationId,
    });
    
    try {
      await NotificationService.sendNotification({
        templateKey: 'station_heartbeat_missed',
        variables: {
          station: {
            id: event.data.stationId,
            name: event.data.stationName || 'Unknown Station',
            location: event.data.location || 'Unknown',
            lastHeartbeat: event.data.lastHeartbeat,
            missedCount: event.data.missedCount || 1,
          },
          timestamp: new Date().toLocaleString('he-IL'),
        },
      });
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send station heartbeat notification', {
        error: error.message,
      });
    }
  }, 10);
  
  // ==================== WASH EVENTS ====================

  eventBus.subscribe('wash.started', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Wash started event received', {
      washId: event.data.washId,
      userId: event.userId,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'wash_started',
          userId: event.userId,
          channelsOverride: ['push', 'in_app'],
          variables: {
            wash: {
              id: event.data.washId,
              stationName: event.data.stationName || 'K9000',
              side: event.data.baySide || '',
            },
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send wash started notification', {
        error: error.message,
      });
    }
  }, 5);

  eventBus.subscribe('wash.failed', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Wash failed event received', {
      washId: event.data.washId,
      userId: event.userId,
      compensationRequired: event.data.compensationRequired,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'wash_failed',
          userId: event.userId,
          channelsOverride: ['push', 'in_app'],
          variables: {
            wash: {
              id:          event.data.washId,
              stationName: event.data.stationName || 'K9000',
              bayId:       event.data.bayId || '',
            },
            refund: {
              amountILS:            event.data.amountCents
                ? `₪${(event.data.amountCents / 100).toFixed(2)}`
                : '',
              compensationRequired: event.data.compensationRequired ?? false,
            },
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send wash failed notification', {
        error: error.message,
      });
    }
  }, 5);

  eventBus.subscribe('wash.completed', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Wash completed event received', {
      washId: event.data.washId,
      userId: event.userId,
    });
    
    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'wash_completed',
          userId: event.userId,
          variables: {
            wash: {
              id: event.data.washId,
              stationName: event.data.stationName || 'Pet Wash Station',
              packageName: event.data.packageName || 'Standard Wash',
              duration: event.data.duration || 'N/A',
            },
            customer: {
              name: event.data.customerName,
            },
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send wash completion notification', {
        error: error.message,
      });
    }
  }, 5); // Lower priority
  
  // ==================== BOOKING EVENTS ====================
  
  eventBus.subscribe('booking.confirmed', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Booking confirmed event received', {
      bookingId: event.data.bookingId,
      userId: event.userId,
    });
    
    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'booking_confirmed',
          userId: event.userId,
          channelsOverride: ['email', 'push', 'in_app'],
          variables: {
            booking: {
              id: event.data.bookingId,
              serviceType: event.data.serviceType,
              date: event.data.date,
              time: event.data.time,
              location: event.data.location,
              providerName: event.data.providerName,
            },
            customer: {
              name: event.data.customerName,
            },
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send booking confirmation notification', {
        error: error.message,
      });
    }
  }, 5);
  
  // ==================== BOOKING COMPLETION EVENTS ====================

  eventBus.subscribe('booking.completed', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Booking completed event received', {
      bookingId: event.data.bookingId,
      userId: event.userId,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'booking_completed',
          userId: event.userId,
          channelsOverride: ['email', 'push', 'in_app'],
          variables: {
            booking: {
              id: event.data.bookingId,
              serviceType: event.data.serviceType,
              providerName: event.data.providerName,
              amount: event.data.amount,
              currency: 'ILS',
            },
            customer: {
              name: event.data.customerName,
            },
            reviewUrl: `https://petwash.co.il/review/${event.data.bookingId}`,
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send booking completion notification', {
        error: error.message,
      });
    }
  }, 5);

  eventBus.subscribe('booking.cancelled', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Booking cancelled event received', {
      bookingId: event.data.bookingId,
      userId: event.userId,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'booking_cancelled',
          userId: event.userId,
          channelsOverride: ['email', 'push', 'in_app'],
          variables: {
            booking: {
              id: event.data.bookingId,
              serviceType: event.data.serviceType,
              date: event.data.date,
              time: event.data.time,
              cancelledBy: event.data.cancelledBy || 'system',
              reason: event.data.reason || 'לא צוין',
            },
            customer: {
              name: event.data.customerName,
            },
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send booking cancellation notification', {
        error: error.message,
      });
    }
  }, 5);

  // ==================== LOYALTY EVENTS ====================

  eventBus.subscribe('loyalty.tier_upgraded', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Loyalty tier upgraded event received', {
      userId: event.userId,
      newTier: event.data.newTier,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'loyalty_tier_upgraded',
          userId: event.userId,
          channelsOverride: ['push', 'in_app'],
          variables: {
            customer: {
              name: event.data.customerName || '',
            },
            tier: {
              name: event.data.newTier,
              previousTier: event.data.previousTier || '',
              perks: event.data.perks || [],
            },
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send loyalty tier upgrade notification', {
        error: error.message,
      });
    }
  }, 3);

  // ==================== PROVIDER APPROVAL EVENTS ====================

  eventBus.subscribe('provider.approved', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Provider approved event received', {
      providerId: event.data.providerId,
      userId: event.userId,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'provider_approved',
          userId: event.userId,
          channelsOverride: ['email', 'push'],
          variables: {
            provider: {
              id: event.data.providerId,
              name: event.data.providerName,
              serviceType: event.data.serviceType,
            },
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send provider approval notification', {
        error: error.message,
      });
    }
  }, 5);

  eventBus.subscribe('provider.rejected', async (event: PlatformEvent) => {
    logger.info('[NotificationEventHandler] Provider rejected event received', {
      providerId: event.data.providerId,
      userId: event.userId,
    });

    try {
      if (event.userId) {
        await NotificationService.sendNotification({
          templateKey: 'provider_rejected',
          userId: event.userId,
          channelsOverride: ['email', 'push'],
          variables: {
            provider: {
              id: event.data.providerId,
              name: event.data.providerName,
              serviceType: event.data.serviceType,
            },
            reason: event.data.reason || 'לא צוין',
            timestamp: new Date().toLocaleString('he-IL'),
          },
        });
      }
    } catch (error: any) {
      logger.error('[NotificationEventHandler] Failed to send provider rejection notification', {
        error: error.message,
      });
    }
  }, 5);

  logger.info('[NotificationEventHandler] All notification event handlers registered');
}

/**
 * Unregister all notification event handlers (for testing/cleanup)
 */
export function unregisterNotificationEventHandlers() {
  // In a production system, you would track handlers and remove them
  // For now, this is a placeholder
  logger.info('[NotificationEventHandler] Notification event handlers unregistered');
}
