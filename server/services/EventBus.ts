/**
 * 🔄 Event-Driven Integration Bus
 * Central event orchestration for cross-platform workflows
 * Enables services to communicate asynchronously
 */

import { EventEmitter } from 'events';
import { logger } from '../lib/logger';
import { db } from '../db';
import { platformEvents } from '../../shared/schema-unified-platform';
import { eq, and, desc, gte } from 'drizzle-orm';

export interface PlatformEvent {
  eventType: string;
  timestamp: string;
  platform: string;
  userId?: string;
  data: Record<string, any>;
  triggers?: string[];
}

export interface EventHandler {
  event: string;
  handler: (event: PlatformEvent) => Promise<void> | void;
  priority?: number;
}

export class EventBus {
  private emitter: EventEmitter;
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventHistory: PlatformEvent[] = [];
  private readonly MAX_HISTORY = 1000;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Support many handlers
    this.registerCoreEventTypes();
  }

  /**
   * Register core event types for the platform
   */
  private registerCoreEventTypes() {
    const coreEvents = [
      // User lifecycle
      'user.registered',
      'user.updated',
      'user.deleted',
      'user.verified',
      
      // Booking lifecycle
      'booking.created',
      'booking.confirmed',
      'booking.started',
      'booking.completed',
      'booking.cancelled',
      
      // Payment lifecycle
      'payment.initiated',
      'payment.processed',
      'payment.failed',
      'payment.refunded',
      
      // Wallet events
      'wallet.funded',
      'wallet.withdrawn',
      'wallet.balance_low',
      
      // Loyalty events
      'loyalty.points_earned',
      'loyalty.points_redeemed',
      'loyalty.tier_upgraded',
      
      // Wash station events
      'wash.started',
      'wash.completed',
      'wash.failed',
      
      // Walk events
      'walk.booked',
      'walk.started',
      'walk.completed',
      'walk.emergency',
      
      // Sitter events
      'sitter.booking_requested',
      'sitter.booking_accepted',
      'sitter.service_completed',
      
      // Transport events
      'transport.requested',
      'transport.assigned',
      'transport.pickup',
      'transport.dropoff',
      'transport.completed',
      
      // Franchise events
      'franchise.opened',
      'franchise.performance_alert',
      'franchise.compliance_issue',
      
      // Enterprise events
      'employee.hired',
      'expense.submitted',
      'invoice.generated',
      'inventory.low_stock',
      'incident.reported',
      
      // Compliance events
      'compliance.violation',
      'audit.required',
      'kyc.completed',
    ];

    logger.info(`[Event Bus] Registered ${coreEvents.length} core event types`);
  }

  /**
   * Publish an event to the bus
   */
  async publish(event: PlatformEvent): Promise<void> {
    try {
      // Add timestamp if not present
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }

      // Persist event to database
      await db.insert(platformEvents).values({
        eventType: event.eventType,
        platform: event.platform,
        userId: event.userId || null,
        data: event.data,
        triggers: event.triggers || null,
        processed: false
      });

      // Store in history
      this.eventHistory.push(event);
      if (this.eventHistory.length > this.MAX_HISTORY) {
        this.eventHistory.shift();
      }

      // Emit event
      this.emitter.emit(event.eventType, event);
      
      // Execute any automatic triggers
      if (event.triggers && event.triggers.length > 0) {
        await this.executeTriggers(event);
      }

      logger.info('[Event Bus] Event published', {
        type: event.eventType,
        platform: event.platform,
        userId: event.userId,
        triggers: event.triggers?.length || 0
      });
    } catch (error) {
      logger.error('[Event Bus] Failed to publish event', { error, event });
      throw error;
    }
  }

  /**
   * Subscribe to an event
   */
  subscribe(eventType: string, handler: (event: PlatformEvent) => Promise<void> | void, priority: number = 0): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.push({ event: eventType, handler, priority });
    
    // Sort by priority (higher priority first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.emitter.on(eventType, handler);
    
    logger.info(`[Event Bus] Subscribed to ${eventType}`, { priority });
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(eventType: string, handler: (event: PlatformEvent) => Promise<void> | void): void {
    this.emitter.off(eventType, handler);
    
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Execute automatic triggers for an event
   */
  private async executeTriggers(event: PlatformEvent): Promise<void> {
    if (!event.triggers) return;

    for (const trigger of event.triggers) {
      try {
        await this.publish({
          eventType: trigger,
          timestamp: new Date().toISOString(),
          platform: event.platform,
          userId: event.userId,
          data: {
            triggeredBy: event.eventType,
            originalData: event.data
          }
        });
      } catch (error) {
        logger.error(`[Event Bus] Failed to execute trigger: ${trigger}`, { error, event });
      }
    }
  }

  /**
   * Get recent event history
   */
  getHistory(limit: number = 100): PlatformEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events for a specific user
   */
  getUserEvents(userId: string, limit: number = 50): PlatformEvent[] {
    return this.eventHistory
      .filter(e => e.userId === userId)
      .slice(-limit);
  }

  /**
   * Get events for a specific platform
   */
  getPlatformEvents(platform: string, limit: number = 50): PlatformEvent[] {
    return this.eventHistory
      .filter(e => e.platform === platform)
      .slice(-limit);
  }

  /**
   * Clear event history (for testing/maintenance)
   */
  clearHistory(): void {
    this.eventHistory = [];
    logger.info('[Event Bus] Event history cleared');
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Example event workflows
export function setupEventWorkflows() {
  // User registration workflow
  eventBus.subscribe('user.registered', async (event) => {
    logger.info('[Workflow] New user registered - sending welcome email', {
      userId: event.userId
    });
    // Trigger welcome email
    await eventBus.publish({
      eventType: 'notification.send_email',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      userId: event.userId,
      data: {
        template: 'welcome',
        language: event.data.language || 'he'
      }
    });
    
    // Award initial loyalty points
    await eventBus.publish({
      eventType: 'loyalty.points_earned',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      userId: event.userId,
      data: {
        points: 100,
        reason: 'signup_bonus'
      }
    });
  });

  // Booking completion workflow
  eventBus.subscribe('booking.completed', async (event) => {
    logger.info('[Workflow] Booking completed - processing payment and rewards', {
      bookingId: event.data.bookingId
    });
    
    // Release escrow
    await eventBus.publish({
      eventType: 'escrow.release',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      userId: event.userId,
      data: {
        bookingId: event.data.bookingId,
        providerId: event.data.providerId,
        amount: event.data.amount
      }
    });
    
    // Award loyalty points
    await eventBus.publish({
      eventType: 'loyalty.points_earned',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      userId: event.userId,
      data: {
        points: Math.floor(event.data.amount * 0.05), // 5% back
        reason: 'booking_completed'
      }
    });
    
    // Request review
    await eventBus.publish({
      eventType: 'notification.request_review',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      userId: event.userId,
      data: {
        bookingId: event.data.bookingId,
        providerId: event.data.providerId
      }
    });
  });

  // Loyalty tier upgrade workflow
  eventBus.subscribe('loyalty.tier_upgraded', async (event) => {
    logger.info('[Workflow] User upgraded loyalty tier - sending congratulations', {
      userId: event.userId,
      newTier: event.data.newTier
    });
    
    await eventBus.publish({
      eventType: 'notification.send_whatsapp',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      userId: event.userId,
      data: {
        template: 'tier_upgrade',
        tier: event.data.newTier,
        perks: event.data.perks
      }
    });
  });

  // Franchise performance alert workflow
  eventBus.subscribe('franchise.performance_alert', async (event) => {
    logger.info('[Workflow] Franchise performance alert - notifying management', {
      franchiseId: event.data.franchiseId,
      metric: event.data.metric
    });
    
    await eventBus.publish({
      eventType: 'notification.send_email',
      timestamp: new Date().toISOString(),
      platform: event.platform,
      data: {
        template: 'franchise_alert',
        to: event.data.managerEmail,
        franchiseId: event.data.franchiseId,
        metric: event.data.metric,
        threshold: event.data.threshold
      }
    });
  });

  logger.info('[Event Bus] Core event workflows configured');
}
