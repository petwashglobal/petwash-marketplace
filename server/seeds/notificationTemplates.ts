/**
 * Notification Templates Seed Data
 * Default templates for common notification events
 */

import { db } from '../db';
import { notificationTemplates } from '@shared/schema';
import type { InsertNotificationTemplate } from '@shared/schema';
import { logger } from '../lib/logger';
import { eq } from 'drizzle-orm';

const defaultTemplates: InsertNotificationTemplate[] = [
  // 1. INCIDENT REPORTED
  {
    key: 'incident_reported',
    name: 'Incident Reported',
    description: 'Notification sent to health & safety team when an incident is reported',
    channels: ['email', 'push'],
    emailSubject: '🚨 New Incident Reported: {{incident.title}}',
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">🚨 New Incident Reported</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p><strong>Incident ID:</strong> {{incident.id}}</p>
            <p><strong>Title:</strong> {{incident.title}}</p>
            <p><strong>Severity:</strong> <span style="color: #dc3545; font-weight: bold;">{{incident.severity}}</span></p>
            <p><strong>Location:</strong> {{incident.location}}</p>
            <p><strong>Reported By:</strong> {{incident.reportedBy}}</p>
            <p><strong>Time:</strong> {{timestamp}}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dee2e6;">
            <p style="margin-top: 20px;">
              <a href="https://petwash.co.il/admin/incidents/{{incident.id}}" 
                 style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Incident Details
              </a>
            </p>
          </div>
        </body>
      </html>
    `,
    pushTitle: '🚨 New Incident: {{incident.title}}',
    pushBody: 'Severity: {{incident.severity}} | Location: {{incident.location}}',
    defaultRecipients: ['role:health_safety_manager', 'department:operations'],
    isActive: true,
  },
  
  // 2. INVENTORY LOW
  {
    key: 'inventory_low',
    name: 'Inventory Low Alert',
    description: 'Notification sent when inventory falls below minimum stock level',
    channels: ['email', 'whatsapp'],
    emailSubject: '⚠️ Low Stock Alert: {{item.name}}',
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #333; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">⚠️ Low Stock Alert</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p><strong>Item:</strong> {{item.name}}</p>
            <p><strong>Current Stock:</strong> <span style="color: #dc3545; font-weight: bold;">{{item.currentStock}}</span></p>
            <p><strong>Minimum Required:</strong> {{item.minStock}}</p>
            <p><strong>Location:</strong> {{item.location}}</p>
            <p style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0;">
              <strong>⚠️ Action Required:</strong> Please reorder this item as soon as possible to avoid service disruption.
            </p>
            <p style="margin-top: 20px;">
              <a href="https://petwash.co.il/admin/inventory/{{item.id}}" 
                 style="background: #ffc107; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Reorder Now
              </a>
            </p>
          </div>
        </body>
      </html>
    `,
    whatsappBody: `🐾 *⁦Pet Wash™⁩ - Low Stock Alert*\n\n⚠️ Item: {{item.name}}\nCurrent Stock: {{item.currentStock}}\nMin Required: {{item.minStock}}\nLocation: {{item.location}}\n\n⚠️ Action Required: Please reorder immediately.`,
    defaultRecipients: ['department:operations', 'role:inventory_manager'],
    isActive: true,
  },
  
  // 3. SETTLEMENT GENERATED
  {
    key: 'settlement_generated',
    name: 'Settlement Generated',
    description: 'Notification sent to finance team when a settlement is generated',
    channels: ['email'],
    emailSubject: '💰 Settlement Report Ready: {{settlement.period}}',
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">💰 Settlement Report Ready</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p><strong>Settlement ID:</strong> {{settlement.id}}</p>
            <p><strong>Period:</strong> {{settlement.period}}</p>
            <p><strong>Total Amount:</strong> <span style="color: #28a745; font-weight: bold; font-size: 1.2em;">{{settlement.currency}} {{settlement.totalAmount}}</span></p>
            <p><strong>Franchise ID:</strong> {{settlement.franchiseId}}</p>
            <p><strong>Generated:</strong> {{timestamp}}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dee2e6;">
            <p style="margin-top: 20px;">
              <a href="https://petwash.co.il/admin/finance/settlements/{{settlement.id}}" 
                 style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Settlement Details
              </a>
            </p>
          </div>
        </body>
      </html>
    `,
    defaultRecipients: ['department:finance', 'role:cfo'],
    isActive: true,
  },
  
  // 4. LOGISTICS TASK ASSIGNED
  {
    key: 'logistics_task_assigned',
    name: 'Logistics Task Assigned',
    description: 'Notification sent to field technician when a task is assigned',
    channels: ['email', 'push', 'sms'],
    emailSubject: '🔧 New Task Assigned: {{task.type}} at {{task.stationName}}',
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">🔧 New Task Assigned</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p><strong>Task ID:</strong> {{task.id}}</p>
            <p><strong>Type:</strong> {{task.type}}</p>
            <p><strong>Station:</strong> {{task.stationName}}</p>
            <p><strong>Priority:</strong> <span style="color: #dc3545; font-weight: bold;">{{task.priority}}</span></p>
            <p><strong>Due Date:</strong> {{task.dueDate}}</p>
            <p><strong>Assigned To:</strong> {{technician.name}}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dee2e6;">
            <p style="margin-top: 20px;">
              <a href="https://petwash.co.il/technician/tasks/{{task.id}}" 
                 style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Task Details
              </a>
            </p>
          </div>
        </body>
      </html>
    `,
    pushTitle: '🔧 New Task: {{task.type}}',
    pushBody: 'Station: {{task.stationName}} | Priority: {{task.priority}}',
    smsBody: '🐾 ⁦Pet Wash™⁩: New {{task.type}} task assigned at {{task.stationName}}. Priority: {{task.priority}}. View details in app.',
    isActive: true,
  },
  
  // 5. STATION HEARTBEAT MISSED
  {
    key: 'station_heartbeat_missed',
    name: 'Station Heartbeat Missed',
    description: 'Alert sent when a station stops sending heartbeat signals',
    channels: ['email', 'sms', 'push'],
    emailSubject: '🚨 URGENT: Station Offline - {{station.name}}',
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">🚨 URGENT: Station Offline</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin-bottom: 20px;">
              <strong>⚠️ CRITICAL:</strong> Station has not sent heartbeat signal
            </p>
            <p><strong>Station ID:</strong> {{station.id}}</p>
            <p><strong>Station Name:</strong> {{station.name}}</p>
            <p><strong>Location:</strong> {{station.location}}</p>
            <p><strong>Last Heartbeat:</strong> {{station.lastHeartbeat}}</p>
            <p><strong>Missed Count:</strong> <span style="color: #dc3545; font-weight: bold;">{{station.missedCount}}</span></p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dee2e6;">
            <p style="margin-top: 20px;">
              <a href="https://petwash.co.il/admin/stations/{{station.id}}" 
                 style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Check Station Status
              </a>
            </p>
          </div>
        </body>
      </html>
    `,
    pushTitle: '🚨 Station Offline: {{station.name}}',
    pushBody: 'Last heartbeat: {{station.lastHeartbeat}} | Check immediately!',
    smsBody: '🚨 URGENT: Station {{station.name}} offline. Last heartbeat: {{station.lastHeartbeat}}. Check status immediately.',
    defaultRecipients: ['department:operations', 'role:on_call_technician'],
    isActive: true,
  },
  
  // 6. WASH COMPLETED
  {
    key: 'wash_completed',
    name: 'Wash Completed',
    description: 'In-app notification sent to customer when wash is completed',
    channels: ['in_app', 'push'],
    inAppTitle: '✨ Wash Complete!',
    inAppBody: 'Your pet\'s wash at {{wash.stationName}} is complete! Thank you for using ⁦Pet Wash™⁩.',
    pushTitle: '✨ Wash Complete at {{wash.stationName}}',
    pushBody: 'Package: {{wash.packageName}} | Duration: {{wash.duration}}',
    isActive: true,
  },
  
  // 7. BOOKING CONFIRMED (bonus template)
  {
    key: 'booking_confirmed',
    name: 'Booking Confirmed',
    description: 'Confirmation sent when a booking is confirmed',
    channels: ['email', 'push', 'in_app'],
    emailSubject: '✅ Booking Confirmed: {{booking.serviceType}}',
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">✅ Booking Confirmed!</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear {{customer.name}},</p>
            <p>Your booking has been confirmed!</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dee2e6;">
            <p><strong>Booking ID:</strong> {{booking.id}}</p>
            <p><strong>Service:</strong> {{booking.serviceType}}</p>
            <p><strong>Date:</strong> {{booking.date}}</p>
            <p><strong>Time:</strong> {{booking.time}}</p>
            <p><strong>Location:</strong> {{booking.location}}</p>
            <p><strong>Provider:</strong> {{booking.providerName}}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dee2e6;">
            <p style="margin-top: 20px;">
              <a href="https://petwash.co.il/bookings/{{booking.id}}" 
                 style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Booking
              </a>
            </p>
          </div>
        </body>
      </html>
    `,
    pushTitle: '✅ Booking Confirmed!',
    pushBody: '{{booking.serviceType}} on {{booking.date}} at {{booking.time}}',
    inAppTitle: 'Booking Confirmed!',
    inAppBody: 'Your {{booking.serviceType}} booking on {{booking.date}} has been confirmed.',
    isActive: true,
  },
];

/**
 * Seed notification templates
 */
export async function seedNotificationTemplates() {
  try {
    logger.info('[Seed] Starting notification templates seed...');
    
    for (const template of defaultTemplates) {
      // Check if template already exists
      const existing = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.key, template.key))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing template
        await db.update(notificationTemplates)
          .set({
            ...template,
            updatedAt: new Date(),
          })
          .where(eq(notificationTemplates.key, template.key));
        
        logger.info(`[Seed] Updated template: ${template.key}`);
      } else {
        // Insert new template
        await db.insert(notificationTemplates).values(template);
        logger.info(`[Seed] Created template: ${template.key}`);
      }
    }
    
    logger.info(`[Seed] Notification templates seed completed. ${defaultTemplates.length} templates processed.`);
    
  } catch (error: any) {
    logger.error('[Seed] Failed to seed notification templates', {
      error: error.message,
    });
    throw error;
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seedNotificationTemplates()
    .then(() => {
      logger.info('[Seed] Seed script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Seed] Seed script failed', error);
      process.exit(1);
    });
}
