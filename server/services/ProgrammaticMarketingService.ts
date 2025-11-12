/**
 * 🎯 Programmatic Marketing Service
 * Automated, data-driven marketing campaigns
 * Based on 2025 best practices (HubSpot, ActiveCampaign, Mailchimp)
 */

import { logger } from '../lib/logger';
import { eventBus } from './EventBus';
import { messagingHub } from './UnifiedMessagingHub';
import { cdp } from './CDPService';
import { db } from '../db';
import { marketingCampaigns } from '../../shared/schema-unified-platform';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'whatsapp' | 'push' | 'display-ads' | 'retargeting';
  platform?: string;
  
  targetSegment: Record<string, any>;
  content: string;
  subject?: string;
  callToAction?: string;
  
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  scheduledFor?: Date;
  
  performance: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'event' | 'schedule' | 'segment_entry';
  triggerConfig: Record<string, any>;
  actions: AutomationAction[];
  enabled: boolean;
}

export interface AutomationAction {
  type: 'send_message' | 'add_to_segment' | 'update_profile' | 'trigger_campaign';
  config: Record<string, any>;
  delay?: number; // Delay in minutes
}

export class ProgrammaticMarketingService {
  /**
   * Create automated marketing campaign
   */
  async createCampaign(campaign: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
    try {
      const result = await db.insert(marketingCampaigns).values({
        name: campaign.name || 'Untitled Campaign',
        type: campaign.type || 'email',
        platform: campaign.platform || null,
        targetSegment: campaign.targetSegment || {},
        content: campaign.content || '',
        subject: campaign.subject || null,
        callToAction: campaign.callToAction || null,
        status: campaign.status || 'draft',
        scheduledFor: campaign.scheduledFor || null,
        createdBy: 'system'
      }).returning();

      const newCampaign: MarketingCampaign = {
        id: result[0].id,
        name: result[0].name,
        type: result[0].type as any,
        platform: result[0].platform || undefined,
        targetSegment: result[0].targetSegment as any,
        content: result[0].content,
        subject: result[0].subject || undefined,
        callToAction: result[0].callToAction || undefined,
        status: result[0].status as any,
        scheduledFor: result[0].scheduledFor || undefined,
        performance: {
          sent: result[0].sent,
          delivered: result[0].delivered,
          opened: result[0].opened,
          clicked: result[0].clicked,
          converted: result[0].converted,
          revenue: parseFloat(result[0].revenue)
        }
      };

      logger.info('[Programmatic] Campaign created', { campaignId: newCampaign.id, name: newCampaign.name });
      return newCampaign;
    } catch (error) {
      logger.error('[Programmatic] Failed to create campaign', { error });
      throw error;
    }
  }

  /**
   * Launch campaign to targeted segment
   */
  async launchCampaign(campaignId: string): Promise<void> {
    try {
      // Get campaign from database
      const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, campaignId)).limit(1);
      if (!campaigns[0]) {
        throw new Error('Campaign not found');
      }

      const campaign = campaigns[0];
      
      // Get targeted users from CDP
      const segmentName = (campaign.targetSegment as any).segmentName;
      const users = segmentName ? await cdp.getUsersBySegment(segmentName) : [];

      let sent = 0;
      // Send messages
      for (const userId of users) {
        try {
          const success = await messagingHub.sendMessage({
            userId,
            channel: campaign.type === 'email' ? 'email' : campaign.type === 'sms' ? 'sms' : campaign.type === 'whatsapp' ? 'whatsapp' : 'push',
            template: campaign.content,
            data: {
              subject: campaign.subject,
              cta: campaign.callToAction
            },
            platform: campaign.platform || undefined
          });
          
          if (success) sent++;
        } catch (err) {
          logger.error('[Programmatic] Failed to send to user', { userId, error: err });
        }
      }

      // Update campaign status
      await db.update(marketingCampaigns)
        .set({
          status: 'active',
          startedAt: new Date(),
          sent
        })
        .where(eq(marketingCampaigns.id, campaignId));

      logger.info('[Programmatic] Campaign launched', { campaignId, targetUsers: users.length, sent });
    } catch (error) {
      logger.error('[Programmatic] Failed to launch campaign', { error, campaignId });
      throw error;
    }
  }

  /**
   * Set up automation rule
   * Example: "When user books walk, send thank you email after 2 hours"
   */
  async createAutomation(rule: Partial<AutomationRule>): Promise<AutomationRule> {
    try {
      const automation: AutomationRule = {
        id: `automation_${Date.now()}`,
        name: rule.name || 'Untitled Automation',
        trigger: rule.trigger || 'event',
        triggerConfig: rule.triggerConfig || {},
        actions: rule.actions || [],
        enabled: rule.enabled !== false
      };

      // Subscribe to events if event-triggered
      if (automation.trigger === 'event' && automation.triggerConfig.eventType) {
        eventBus.subscribe(automation.triggerConfig.eventType, async (event) => {
          if (automation.enabled) {
            await this.executeAutomation(automation, event);
          }
        });
      }

      logger.info('[Programmatic] Automation created', { 
        automationId: automation.id, 
        trigger: automation.trigger 
      });
      return automation;
    } catch (error) {
      logger.error('[Programmatic] Failed to create automation', { error });
      throw error;
    }
  }

  /**
   * Execute automation actions
   */
  private async executeAutomation(automation: AutomationRule, event: any): Promise<void> {
    try {
      logger.info('[Programmatic] Executing automation', { automationId: automation.id });

      for (const action of automation.actions) {
        // Apply delay if specified
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay * 60 * 1000));
        }

        switch (action.type) {
          case 'send_message':
            await messagingHub.sendMessage({
              userId: event.userId,
              channel: action.config.channel,
              template: action.config.template,
              data: { ...event.data, ...action.config.data }
            });
            break;

          case 'add_to_segment':
            // TODO: Add user to segment
            break;

          case 'update_profile':
            await cdp.updateProfile(event.userId, action.config.updates);
            break;

          case 'trigger_campaign':
            await this.launchCampaign(action.config.campaignId);
            break;
        }
      }

      logger.info('[Programmatic] Automation executed', { automationId: automation.id });
    } catch (error) {
      logger.error('[Programmatic] Automation execution failed', { error, automationId: automation.id });
    }
  }

  /**
   * Setup pre-built automation workflows
   */
  setupDefaultAutomations(): void {
    // Welcome series
    this.createAutomation({
      name: 'Welcome New Users',
      trigger: 'event',
      triggerConfig: { eventType: 'user.registered' },
      actions: [
        {
          type: 'send_message',
          config: {
            channel: 'email',
            template: 'welcome',
            data: {}
          },
          delay: 0
        },
        {
          type: 'send_message',
          config: {
            channel: 'whatsapp',
            template: 'welcome_tips',
            data: {}
          },
          delay: 1440 // 24 hours later
        }
      ],
      enabled: true
    });

    // Abandoned cart recovery
    this.createAutomation({
      name: 'Abandoned Booking Recovery',
      trigger: 'event',
      triggerConfig: { eventType: 'booking.abandoned' },
      actions: [
        {
          type: 'send_message',
          config: {
            channel: 'whatsapp',
            template: 'abandoned_booking_reminder',
            data: { discount: '10%' }
          },
          delay: 60 // 1 hour later
        }
      ],
      enabled: true
    });

    // Post-purchase thank you
    this.createAutomation({
      name: 'Post-Purchase Thank You',
      trigger: 'event',
      triggerConfig: { eventType: 'booking.completed' },
      actions: [
        {
          type: 'send_message',
          config: {
            channel: 'whatsapp',
            template: 'thank_you',
            data: {}
          },
          delay: 120 // 2 hours later
        },
        {
          type: 'send_message',
          config: {
            channel: 'email',
            template: 'request_review',
            data: {}
          },
          delay: 2880 // 48 hours later
        }
      ],
      enabled: true
    });

    logger.info('[Programmatic] Default automations configured');
  }

  /**
   * A/B test campaigns
   */
  async createABTest(campaignA: Partial<MarketingCampaign>, campaignB: Partial<MarketingCampaign>): Promise<{ campaignAId: string; campaignBId: string }> {
    try {
      const a = await this.createCampaign({ ...campaignA, name: `${campaignA.name} (A)` });
      const b = await this.createCampaign({ ...campaignB, name: `${campaignB.name} (B)` });

      logger.info('[Programmatic] A/B test created', { campaignAId: a.id, campaignBId: b.id });
      return { campaignAId: a.id, campaignBId: b.id };
    } catch (error) {
      logger.error('[Programmatic] Failed to create A/B test', { error });
      throw error;
    }
  }

  /**
   * Get campaign performance
   */
  async getCampaignPerformance(campaignId: string): Promise<MarketingCampaign['performance']> {
    try {
      const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, campaignId)).limit(1);
      
      if (!campaigns[0]) {
        throw new Error('Campaign not found');
      }

      return {
        sent: campaigns[0].sent,
        delivered: campaigns[0].delivered,
        opened: campaigns[0].opened,
        clicked: campaigns[0].clicked,
        converted: campaigns[0].converted,
        revenue: parseFloat(campaigns[0].revenue)
      };
    } catch (error) {
      logger.error('[Programmatic] Failed to get campaign performance', { error, campaignId });
      throw error;
    }
  }

  /**
   * Get all campaigns
   */
  async getAllCampaigns(): Promise<MarketingCampaign[]> {
    try {
      const campaigns = await db.select().from(marketingCampaigns);
      
      return campaigns.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type as any,
        platform: c.platform || undefined,
        targetSegment: c.targetSegment as any,
        content: c.content,
        subject: c.subject || undefined,
        callToAction: c.callToAction || undefined,
        status: c.status as any,
        scheduledFor: c.scheduledFor || undefined,
        performance: {
          sent: c.sent,
          delivered: c.delivered,
          opened: c.opened,
          clicked: c.clicked,
          converted: c.converted,
          revenue: parseFloat(c.revenue)
        }
      }));
    } catch (error) {
      logger.error('[Programmatic] Failed to get campaigns', { error });
      throw error;
    }
  }
}

// Singleton instance
export const programmatic = new ProgrammaticMarketingService();
