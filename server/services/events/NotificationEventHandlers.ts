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
  
  eventBus.subscribe('INCIDENT_REPORTED', async (event: PlatformEvent) => {
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
  
  eventBus.subscribe('INVENTORY_LOW', async (event: PlatformEvent) => {
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
  
  eventBus.subscribe('SETTLEMENT_GENERATED', async (event: PlatformEvent) => {
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
  
  eventBus.subscribe('LOGISTICS_TASK_ASSIGNED', async (event: PlatformEvent) => {
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
  
  eventBus.subscribe('STATION_HEARTBEAT_MISSED', async (event: PlatformEvent) => {
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
