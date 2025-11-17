import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  crmTasks,
  crmMeetingAttendees,
  adminUsers,
  customers,
  type InsertCrmTask,
  type InsertCrmMeetingAttendee,
} from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import { EmailService } from '../emailService';
import { GoogleMessagingService } from '../services/GoogleMessagingService';

const router = Router();

// =================== SCHEMAS ===================

const attendeeSchema = z.object({
  attendeeType: z.enum(['admin', 'customer', 'external']),
  adminUserId: z.string().optional(),
  customerId: z.number().int().optional(),
  externalName: z.string().optional(),
  externalEmail: z.string().email().optional(),
  externalPhone: z.string().optional(),
  role: z.enum(['organizer', 'presenter', 'participant', 'optional']).optional(),
});

const createMeetingSchema = z.object({
  // Basic meeting info
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  
  // Scheduling
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  
  // Location / Link
  location: z.string().optional(), // physical address or virtual link
  
  // Related entities
  leadId: z.number().int().optional(),
  customerId: z.number().int().optional(),
  opportunityId: z.number().int().optional(),
  
  // Organizer (must be admin user)
  createdBy: z.string(), // admin user ID
  
  // Attendees
  attendees: z.array(attendeeSchema).min(1, 'At least one attendee required'),
  
  // Notification preferences
  sendInvitations: z.boolean().default(true),
  locale: z.enum(['he', 'en']).default('he'),
});

const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  location: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  
  // If true, notify all attendees of changes
  notifyAttendees: z.boolean().default(true),
  locale: z.enum(['he', 'en']).default('he'),
});

const updateAttendeeResponseSchema = z.object({
  responseStatus: z.enum(['accepted', 'declined', 'tentative']),
});

type CreateMeetingRequest = z.infer<typeof createMeetingSchema>;
type UpdateMeetingRequest = z.infer<typeof updateMeetingSchema>;
type Attendee = z.infer<typeof attendeeSchema>;

// =================== HELPER FUNCTIONS ===================

/**
 * Send meeting invitation to attendees
 */
async function sendMeetingInvitations(
  meeting: any,
  attendees: any[],
  locale: 'he' | 'en' = 'he'
): Promise<void> {
  const correlationId = nanoid();
  
  logger.info(`[Meetings ${correlationId}] Sending invitations to ${attendees.length} attendees`);
  
  for (const attendee of attendees) {
    try {
      // Get attendee contact info
      let email: string | null = null;
      let phone: string | null = null;
      let name: string = 'there';
      
      if (attendee.attendeeType === 'admin' && attendee.adminUserId) {
        const [admin] = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.id, attendee.adminUserId))
          .limit(1);
        
        if (admin) {
          email = admin.email;
          phone = admin.phoneNumber;
          name = admin.fullName || admin.email;
        }
      } else if (attendee.attendeeType === 'customer' && attendee.customerId) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, attendee.customerId))
          .limit(1);
        
        if (customer) {
          email = customer.email;
          phone = customer.phone;
          name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
        }
      } else if (attendee.attendeeType === 'external') {
        email = attendee.externalEmail;
        phone = attendee.externalPhone;
        name = attendee.externalName || 'Guest';
      }
      
      if (!email && !phone) {
        logger.warn(`[Meetings ${correlationId}] No contact info for attendee ${attendee.id}`);
        continue;
      }
      
      // Format meeting times
      const startDate = new Date(meeting.scheduledStart);
      const endDate = new Date(meeting.scheduledEnd);
      const dateStr = startDate.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = `${startDate.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })} - ${endDate.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
      
      // Send Email Invitation
      if (email) {
        const emailSubject = locale === 'he'
          ? `הזמנה לפגישה: ${meeting.title}`
          : `Meeting Invitation: ${meeting.title}`;
        
        const emailBody = locale === 'he'
          ? `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1976d2;">הזמנה לפגישה</h2>
              <p>שלום ${name},</p>
              <p>הוזמנת לפגישה הבאה:</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">${meeting.title}</h3>
                ${meeting.description ? `<p>${meeting.description}</p>` : ''}
                <p><strong>תאריך:</strong> ${dateStr}</p>
                <p><strong>שעה:</strong> ${timeStr}</p>
                ${meeting.location ? `<p><strong>מיקום:</strong> ${meeting.location}</p>` : ''}
              </div>
              
              <p style="color: #666; font-size: 14px;">פגישה זו נוצרה על ידי Pet Wash™ CRM</p>
            </div>
          `
          : `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1976d2;">Meeting Invitation</h2>
              <p>Hello ${name},</p>
              <p>You've been invited to the following meeting:</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">${meeting.title}</h3>
                ${meeting.description ? `<p>${meeting.description}</p>` : ''}
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Time:</strong> ${timeStr}</p>
                ${meeting.location ? `<p><strong>Location:</strong> ${meeting.location}</p>` : ''}
              </div>
              
              <p style="color: #666; font-size: 14px;">This meeting was created by Pet Wash™ CRM</p>
            </div>
          `;
        
        await EmailService.sendEmail(
          email,
          emailSubject,
          emailBody,
          locale
        );
        
        logger.info(`[Meetings ${correlationId}] Email invitation sent to ${email}`);
      }
      
      // Send WhatsApp Invitation
      if (phone) {
        const whatsappMessage = locale === 'he'
          ? `🗓️ הזמנה לפגישה\n\n${meeting.title}\n${dateStr}\n${timeStr}${meeting.location ? `\nמיקום: ${meeting.location}` : ''}\n\n${meeting.description || ''}`
          : `🗓️ Meeting Invitation\n\n${meeting.title}\n${dateStr}\n${timeStr}${meeting.location ? `\nLocation: ${meeting.location}` : ''}\n\n${meeting.description || ''}`;
        
        try {
          await GoogleMessagingService.sendWhatsAppMessage(
            phone,
            whatsappMessage
          );
          
          logger.info(`[Meetings ${correlationId}] WhatsApp invitation sent to ${phone}`);
        } catch (whatsappError: any) {
          logger.error(`[Meetings ${correlationId}] WhatsApp failed for ${phone}`, whatsappError);
        }
      }
      
      // Update attendee record
      await db
        .update(crmMeetingAttendees)
        .set({
          invitationSent: true,
          invitationSentAt: new Date(),
        })
        .where(eq(crmMeetingAttendees.id, attendee.id));
      
    } catch (error: any) {
      logger.error(`[Meetings ${correlationId}] Failed to send invitation to attendee ${attendee.id}`, error);
    }
  }
}

/**
 * Send meeting update notification to attendees
 */
async function sendMeetingUpdateNotifications(
  meeting: any,
  attendees: any[],
  changes: string[],
  locale: 'he' | 'en' = 'he'
): Promise<void> {
  const correlationId = nanoid();
  
  logger.info(`[Meetings ${correlationId}] Sending updates to ${attendees.length} attendees`);
  
  const changesList = changes.join(', ');
  
  for (const attendee of attendees) {
    try {
      // Get attendee contact info (same as sendMeetingInvitations)
      let email: string | null = null;
      let phone: string | null = null;
      let name: string = 'there';
      
      if (attendee.attendeeType === 'admin' && attendee.adminUserId) {
        const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, attendee.adminUserId)).limit(1);
        if (admin) {
          email = admin.email;
          phone = admin.phoneNumber;
          name = admin.fullName || admin.email;
        }
      } else if (attendee.attendeeType === 'customer' && attendee.customerId) {
        const [customer] = await db.select().from(customers).where(eq(customers.id, attendee.customerId)).limit(1);
        if (customer) {
          email = customer.email;
          phone = customer.phone;
          name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
        }
      } else if (attendee.attendeeType === 'external') {
        email = attendee.externalEmail;
        phone = attendee.externalPhone;
        name = attendee.externalName || 'Guest';
      }
      
      if (!email && !phone) continue;
      
      // Send update notifications
      if (email) {
        const subject = locale === 'he'
          ? `עדכון פגישה: ${meeting.title}`
          : `Meeting Updated: ${meeting.title}`;
        
        const body = locale === 'he'
          ? `<div dir="rtl"><h3>הפגישה עודכנה</h3><p>שלום ${name},</p><p>הפגישה "${meeting.title}" עודכנה.</p><p><strong>שינויים:</strong> ${changesList}</p></div>`
          : `<div><h3>Meeting Updated</h3><p>Hello ${name},</p><p>The meeting "${meeting.title}" has been updated.</p><p><strong>Changes:</strong> ${changesList}</p></div>`;
        
        await EmailService.sendEmail(email, subject, body, locale);
      }
      
      if (phone) {
        const message = locale === 'he'
          ? `📝 עדכון פגישה: ${meeting.title}\nשינויים: ${changesList}`
          : `📝 Meeting Update: ${meeting.title}\nChanges: ${changesList}`;
        
        try {
          await GoogleMessagingService.sendWhatsAppMessage(phone, message);
        } catch (err) {
          logger.error(`[Meetings ${correlationId}] WhatsApp update failed`, err);
        }
      }
    } catch (error: any) {
      logger.error(`[Meetings ${correlationId}] Failed to send update to attendee`, error);
    }
  }
}

/**
 * Send meeting cancellation notification to attendees
 */
async function sendMeetingCancellationNotifications(
  meeting: any,
  attendees: any[],
  locale: 'he' | 'en' = 'he'
): Promise<void> {
  const correlationId = nanoid();
  
  logger.info(`[Meetings ${correlationId}] Sending cancellation to ${attendees.length} attendees`);
  
  for (const attendee of attendees) {
    try {
      let email: string | null = null;
      let phone: string | null = null;
      let name: string = 'there';
      
      if (attendee.attendeeType === 'admin' && attendee.adminUserId) {
        const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, attendee.adminUserId)).limit(1);
        if (admin) {
          email = admin.email;
          phone = admin.phoneNumber;
          name = admin.fullName || admin.email;
        }
      } else if (attendee.attendeeType === 'customer' && attendee.customerId) {
        const [customer] = await db.select().from(customers).where(eq(customers.id, attendee.customerId)).limit(1);
        if (customer) {
          email = customer.email;
          phone = customer.phone;
          name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
        }
      } else if (attendee.attendeeType === 'external') {
        email = attendee.externalEmail;
        phone = attendee.externalPhone;
        name = attendee.externalName || 'Guest';
      }
      
      if (!email && !phone) continue;
      
      if (email) {
        const subject = locale === 'he'
          ? `פגישה בוטלה: ${meeting.title}`
          : `Meeting Cancelled: ${meeting.title}`;
        
        const body = locale === 'he'
          ? `<div dir="rtl"><h3 style="color: #d32f2f;">הפגישה בוטלה</h3><p>שלום ${name},</p><p>הפגישה "${meeting.title}" בוטלה.</p></div>`
          : `<div><h3 style="color: #d32f2f;">Meeting Cancelled</h3><p>Hello ${name},</p><p>The meeting "${meeting.title}" has been cancelled.</p></div>`;
        
        await EmailService.sendEmail(email, subject, body, locale);
      }
      
      if (phone) {
        const message = locale === 'he'
          ? `❌ הפגישה "${meeting.title}" בוטלה`
          : `❌ Meeting Cancelled: ${meeting.title}`;
        
        try {
          await GoogleMessagingService.sendWhatsAppMessage(phone, message);
        } catch (err) {
          logger.error(`[Meetings ${correlationId}] WhatsApp cancellation failed`, err);
        }
      }
    } catch (error: any) {
      logger.error(`[Meetings ${correlationId}] Failed to send cancellation to attendee`, error);
    }
  }
}

// =================== ROUTES ===================

/**
 * POST /api/meetings
 * Create new meeting with attendees and send invitations
 */
router.post('/', async (req: Request, res: Response) => {
  const correlationId = nanoid();
  
  try {
    logger.info(`[Meetings ${correlationId}] Creating new meeting`);
    
    // Use safeParse to check data without crashing the app
    const result = createMeetingSchema.safeParse(req.body);
    
    if (!result.success) {
      // If validation fails, return specific errors
      logger.warn(`[Meetings ${correlationId}] Validation failed`, result.error.format());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.format(),
      });
    }
    
    const validated = result.data;
    
    // Create the meeting task
    const [meeting] = await db
      .insert(crmTasks)
      .values({
        title: validated.title,
        description: validated.description,
        taskType: 'meeting',
        priority: 'medium',
        leadId: validated.leadId,
        customerId: validated.customerId,
        opportunityId: validated.opportunityId,
        assignedTo: validated.createdBy,
        createdBy: validated.createdBy,
        scheduledStart: new Date(validated.scheduledStart),
        scheduledEnd: new Date(validated.scheduledEnd),
        status: 'pending',
        notes: validated.location ? `Location: ${validated.location}` : undefined,
      })
      .returning();
    
    logger.info(`[Meetings ${correlationId}] Meeting created: ${meeting.id}`);
    
    // Create attendees
    const attendeeInserts: InsertCrmMeetingAttendee[] = validated.attendees.map((att) => ({
      meetingId: meeting.id,
      attendeeType: att.attendeeType,
      adminUserId: att.adminUserId,
      customerId: att.customerId,
      externalName: att.externalName,
      externalEmail: att.externalEmail,
      externalPhone: att.externalPhone,
      role: att.role || 'participant',
      responseStatus: 'pending',
    }));
    
    const attendees = await db
      .insert(crmMeetingAttendees)
      .values(attendeeInserts)
      .returning();
    
    logger.info(`[Meetings ${correlationId}] ${attendees.length} attendees added`);
    
    // Send invitations
    if (validated.sendInvitations) {
      await sendMeetingInvitations(
        { ...meeting, location: validated.location },
        attendees,
        validated.locale
      );
    }
    
    res.status(201).json({
      success: true,
      meeting,
      attendees,
      message: `Meeting created with ${attendees.length} attendees`,
    });
    
  } catch (error: any) {
    logger.error(`[Meetings ${correlationId}] Failed to create meeting`, error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create meeting',
    });
  }
});

/**
 * PATCH /api/meetings/:id
 * Update meeting and notify attendees of changes
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const correlationId = nanoid();
  const meetingId = parseInt(req.params.id);
  
  try {
    logger.info(`[Meetings ${correlationId}] Updating meeting ${meetingId}`);
    
    const validated = updateMeetingSchema.parse(req.body);
    
    // Get existing meeting
    const [existing] = await db
      .select()
      .from(crmTasks)
      .where(and(
        eq(crmTasks.id, meetingId),
        eq(crmTasks.taskType, 'meeting')
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }
    
    // Track changes
    const changes: string[] = [];
    if (validated.title && validated.title !== existing.title) changes.push('title');
    if (validated.description !== undefined && validated.description !== existing.description) changes.push('description');
    if (validated.scheduledStart && new Date(validated.scheduledStart).getTime() !== existing.scheduledStart?.getTime()) changes.push('start time');
    if (validated.scheduledEnd && new Date(validated.scheduledEnd).getTime() !== existing.scheduledEnd?.getTime()) changes.push('end time');
    if (validated.location && validated.location !== existing.notes) changes.push('location');
    if (validated.status && validated.status !== existing.status) changes.push('status');
    
    // Update meeting
    const updateData: any = {};
    if (validated.title) updateData.title = validated.title;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.scheduledStart) updateData.scheduledStart = new Date(validated.scheduledStart);
    if (validated.scheduledEnd) updateData.scheduledEnd = new Date(validated.scheduledEnd);
    if (validated.status) updateData.status = validated.status;
    if (validated.location) updateData.notes = `Location: ${validated.location}`;
    updateData.updatedAt = new Date();
    
    const [updated] = await db
      .update(crmTasks)
      .set(updateData)
      .where(eq(crmTasks.id, meetingId))
      .returning();
    
    logger.info(`[Meetings ${correlationId}] Meeting updated with changes: ${changes.join(', ')}`);
    
    // Notify attendees if requested
    if (validated.notifyAttendees && changes.length > 0) {
      const attendees = await db
        .select()
        .from(crmMeetingAttendees)
        .where(eq(crmMeetingAttendees.meetingId, meetingId));
      
      await sendMeetingUpdateNotifications(
        { ...updated, location: validated.location },
        attendees,
        changes,
        validated.locale
      );
    }
    
    res.json({
      success: true,
      meeting: updated,
      changes,
      message: `Meeting updated (${changes.length} changes)`,
    });
    
  } catch (error: any) {
    logger.error(`[Meetings ${correlationId}] Failed to update meeting`, error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update meeting',
    });
  }
});

/**
 * DELETE /api/meetings/:id
 * Cancel meeting and notify all attendees
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const correlationId = nanoid();
  const meetingId = parseInt(req.params.id);
  
  try {
    logger.info(`[Meetings ${correlationId}] Cancelling meeting ${meetingId}`);
    
    const { locale = 'he', notifyAttendees = true } = req.query;
    
    // Get meeting
    const [meeting] = await db
      .select()
      .from(crmTasks)
      .where(and(
        eq(crmTasks.id, meetingId),
        eq(crmTasks.taskType, 'meeting')
      ))
      .limit(1);
    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }
    
    // Get attendees before deletion
    const attendees = await db
      .select()
      .from(crmMeetingAttendees)
      .where(eq(crmMeetingAttendees.meetingId, meetingId));
    
    // Update meeting status to cancelled
    await db
      .update(crmTasks)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(crmTasks.id, meetingId));
    
    logger.info(`[Meetings ${correlationId}] Meeting cancelled`);
    
    // Notify attendees
    if (notifyAttendees === 'true') {
      await sendMeetingCancellationNotifications(
        meeting,
        attendees,
        locale as 'he' | 'en'
      );
    }
    
    res.json({
      success: true,
      message: `Meeting cancelled and ${attendees.length} attendees notified`,
    });
    
  } catch (error: any) {
    logger.error(`[Meetings ${correlationId}] Failed to cancel meeting`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel meeting',
    });
  }
});

/**
 * GET /api/meetings/:id/attendees
 * Get all attendees for a meeting
 */
router.get('/:id/attendees', async (req: Request, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id);
    
    const attendees = await db
      .select()
      .from(crmMeetingAttendees)
      .where(eq(crmMeetingAttendees.meetingId, meetingId));
    
    res.json({
      success: true,
      attendees,
    });
    
  } catch (error: any) {
    logger.error('[Meetings] Failed to fetch attendees', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendees',
    });
  }
});

/**
 * PATCH /api/meetings/:id/attendees/:attendeeId/response
 * Update attendee's response status (accept/decline/tentative)
 */
router.patch('/:id/attendees/:attendeeId/response', async (req: Request, res: Response) => {
  try {
    const attendeeId = parseInt(req.params.attendeeId);
    
    const validated = updateAttendeeResponseSchema.parse(req.body);
    
    const [updated] = await db
      .update(crmMeetingAttendees)
      .set({
        responseStatus: validated.responseStatus,
        respondedAt: new Date(),
      })
      .where(eq(crmMeetingAttendees.id, attendeeId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Attendee not found',
      });
    }
    
    logger.info(`[Meetings] Attendee ${attendeeId} response: ${validated.responseStatus}`);
    
    res.json({
      success: true,
      attendee: updated,
      message: `Response updated to ${validated.responseStatus}`,
    });
    
  } catch (error: any) {
    logger.error('[Meetings] Failed to update attendee response', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update response',
    });
  }
});

export default router;
