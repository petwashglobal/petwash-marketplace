/**
 * Admin Provider Review Service - ⁦Pet Wash™⁩
 * 
 * Provider approval workflow with checklist verification
 * for ⁦Pet Wash™⁩ service providers.
 * 
 * Hebrew-dominant with English brand touches
 * Israeli Law 2025 compliance
 */

import { db } from '../db';
import {
  providerApprovalQueue,
  providerPoliceChecks,
  providerCertificates,
  providerApplications,
  walkerProfiles,
  sitterProfiles,
  trainers,
  users,
  superAppNotifications,
  type InsertProviderApprovalQueue,
  type ProviderApprovalQueue,
} from '@shared/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { FinancialDocumentService } from './FinancialDocumentService';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';
import {
  dispatchNotifications,
  buildProviderApprovedSms,
  buildProviderRejectedSms,
} from './PetWashNotificationEngine';

// Approval queue status types
export type ApprovalStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'on_hold';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

// Provider application checklist
export interface ProviderChecklist {
  photoApproved: boolean;
  certificateApproved: boolean;
  idVerified: boolean;
  addressVerified: boolean;
  policeCheckApproved: boolean;
  insuranceVerified: boolean;
  pricingApproved: boolean;
}

// Full application data for review
export interface ProviderApplicationReview {
  application: ProviderApprovalQueue;
  checklist: ProviderChecklist;
  checklistComplete: boolean;
  completedItems: number;
  totalItems: number;
  readyForApproval: boolean;
  backgroundCheckDetails: {
    // Whether the admin has ticked the police check box in the checklist
    adminCheckedPoliceApproval: boolean;
    // Whether a real document record exists in providerPoliceChecks table
    hasRealPoliceCheckRecord: boolean;
    // Combined trust level shown to admin — 'verified' | 'admin_checked_only' | 'not_completed'
    trustLevel: 'verified' | 'admin_checked_only' | 'not_completed';
    // Explicit warning when no real third-party BGC API has been called
    warning: string | null;
  };
}

// Queue statistics
export interface QueueStatistics {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  onHold: number;
  byPlatform: Record<string, number>;
  avgReviewTimeHours: number | null;
}

class AdminProviderReviewService {

  /**
   * Create a new provider application in the queue
   */
  async createApplication(
    providerId: string,
    platform: string,
    priority: PriorityLevel = 'normal'
  ): Promise<ProviderApprovalQueue> {
    try {
      // Check if already in queue
      const existing = await db
        .select()
        .from(providerApprovalQueue)
        .where(
          and(
            eq(providerApprovalQueue.providerId, providerId),
            eq(providerApprovalQueue.platform, platform)
          )
        )
        .limit(1);

      if (existing[0]) {
        logger.info('[AdminReview] Application already exists', { 
          providerId, 
          platform,
          status: existing[0].status 
        });
        return existing[0];
      }

      const insertData: InsertProviderApprovalQueue = {
        providerId,
        platform,
        status: 'pending',
        priority,
        photoApproved: false,
        certificateApproved: false,
        idVerified: false,
        addressVerified: false,
        policeCheckApproved: false,
        insuranceVerified: false,
        pricingApproved: false,
      };

      const result = await db
        .insert(providerApprovalQueue)
        .values(insertData)
        .returning();

      logger.info('[AdminReview] Application created', { 
        providerId, 
        platform,
        applicationId: result[0].id 
      });

      return result[0];
    } catch (error) {
      logger.error('[AdminReview] Error creating application', error);
      throw error;
    }
  }

  /**
   * Get application with checklist status
   */
  async getApplicationReview(applicationId: number): Promise<ProviderApplicationReview | null> {
    try {
      const application = await db
        .select()
        .from(providerApprovalQueue)
        .where(eq(providerApprovalQueue.id, applicationId))
        .limit(1);

      if (!application[0]) {
        return null;
      }

      const app = application[0];
      const checklist: ProviderChecklist = {
        photoApproved: app.photoApproved || false,
        certificateApproved: app.certificateApproved || false,
        idVerified: app.idVerified || false,
        addressVerified: app.addressVerified || false,
        policeCheckApproved: app.policeCheckApproved || false,
        insuranceVerified: app.insuranceVerified || false,
        pricingApproved: app.pricingApproved || false,
      };

      const completedItems = Object.values(checklist).filter(Boolean).length;
      const totalItems = Object.keys(checklist).length;
      const checklistComplete = completedItems === totalItems;

      // ── Background check trust assessment ──────────────────────────────────
      // Background checks have TWO levels:
      //   Level 1 (admin_checked_only) — admin ticked policeCheckApproved on checklist.
      //   Level 2 (verified)           — real document record exists in providerPoliceChecks
      //                                  with status 'approved' (set by PoliceCheckService).
      // The system currently has NO third-party BGC API, so Level 2 requires an admin
      // to manually upload and approve a clearance document.  This warning must remain
      // visible until a real integration exists.
      let hasRealPoliceCheckRecord = false;
      try {
        const policeCheck = await db
          .select({ id: providerPoliceChecks.id, status: providerPoliceChecks.status })
          .from(providerPoliceChecks)
          .where(
            and(
              eq(providerPoliceChecks.providerId, String(app.providerId)),
              eq(providerPoliceChecks.status, 'approved'),
            )
          )
          .limit(1);
        hasRealPoliceCheckRecord = policeCheck.length > 0;
      } catch {
        hasRealPoliceCheckRecord = false;
      }

      const adminCheckedPoliceApproval = checklist.policeCheckApproved;
      let trustLevel: 'verified' | 'admin_checked_only' | 'not_completed';
      let warning: string | null;

      if (hasRealPoliceCheckRecord) {
        trustLevel = 'verified';
        warning = null;
      } else if (adminCheckedPoliceApproval) {
        trustLevel = 'admin_checked_only';
        warning = 'Police check box is ticked but no approved document record exists in providerPoliceChecks. ' +
          'No third-party BGC API is integrated — a human admin must upload and approve the actual clearance document. ' +
          'Do NOT mark this as verified or show a police-check badge to customers until a real document is on file.';
      } else {
        trustLevel = 'not_completed';
        warning = 'Background check has NOT been completed. policeCheckApproved is false. ' +
          'Provider must NOT be activated or shown as trusted until this is resolved.';
      }

      return {
        application: app,
        checklist,
        checklistComplete,
        completedItems,
        totalItems,
        readyForApproval: checklistComplete && app.status !== 'approved' && app.status !== 'rejected',
        backgroundCheckDetails: {
          adminCheckedPoliceApproval,
          hasRealPoliceCheckRecord,
          trustLevel,
          warning,
        },
      };
    } catch (error) {
      logger.error('[AdminReview] Error getting application', error);
      throw error;
    }
  }

  /**
   * Get queue for admin dashboard
   */
  async getQueue(
    status?: ApprovalStatus,
    platform?: string,
    limit: number = 50
  ): Promise<ProviderApprovalQueue[]> {
    try {
      let query = db.select().from(providerApprovalQueue);
      
      const conditions = [];
      if (status) {
        conditions.push(eq(providerApprovalQueue.status, status));
      }
      if (platform) {
        conditions.push(eq(providerApprovalQueue.platform, platform));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      return await (query as any)
        .orderBy(
          sql`CASE 
            WHEN ${providerApprovalQueue.priority} = 'urgent' THEN 1 
            WHEN ${providerApprovalQueue.priority} = 'high' THEN 2 
            WHEN ${providerApprovalQueue.priority} = 'normal' THEN 3 
            ELSE 4 
          END`,
          desc(providerApprovalQueue.createdAt)
        )
        .limit(limit);
    } catch (error) {
      logger.error('[AdminReview] Error getting queue', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<QueueStatistics> {
    try {
      const allApps = await db.select().from(providerApprovalQueue);

      const stats: QueueStatistics = {
        total: allApps.length,
        pending: allApps.filter(a => a.status === 'pending').length,
        underReview: allApps.filter(a => a.status === 'under_review').length,
        approved: allApps.filter(a => a.status === 'approved').length,
        rejected: allApps.filter(a => a.status === 'rejected').length,
        onHold: allApps.filter(a => a.status === 'on_hold').length,
        byPlatform: {},
        avgReviewTimeHours: null,
      };

      // Count by platform
      for (const app of allApps) {
        if (!stats.byPlatform[app.platform]) {
          stats.byPlatform[app.platform] = 0;
        }
        stats.byPlatform[app.platform]++;
      }

      // Calculate average review time for completed reviews
      const reviewedApps = allApps.filter(a => a.reviewedAt && a.createdAt);
      if (reviewedApps.length > 0) {
        let totalHours = 0;
        for (const app of reviewedApps) {
          const reviewTime = new Date(app.reviewedAt!).getTime() - new Date(app.createdAt!).getTime();
          totalHours += reviewTime / (1000 * 60 * 60);
        }
        stats.avgReviewTimeHours = Math.round(totalHours / reviewedApps.length * 10) / 10;
      }

      return stats;
    } catch (error) {
      logger.error('[AdminReview] Error getting statistics', error);
      throw error;
    }
  }

  /**
   * Assign application to reviewer
   */
  async assignToReviewer(
    applicationId: number,
    reviewerId: string
  ): Promise<{ success: boolean; messageHe: string; messageEn: string }> {
    try {
      await db
        .update(providerApprovalQueue)
        .set({
          status: 'under_review',
          assignedTo: reviewerId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(providerApprovalQueue.id, applicationId));

      logger.info('[AdminReview] Application assigned', { applicationId, reviewerId });

      return {
        success: true,
        messageHe: 'הבקשה הוקצתה לבודק בהצלחה',
        messageEn: 'Application assigned to reviewer',
      };
    } catch (error) {
      logger.error('[AdminReview] Error assigning application', error);
      throw error;
    }
  }

  /**
   * Update checklist item
   */
  async updateChecklistItem(
    applicationId: number,
    itemKey: keyof ProviderChecklist,
    approved: boolean,
    reviewerId: string
  ): Promise<{ success: boolean; checklist: ProviderChecklist }> {
    try {
      const updateData: any = {
        [itemKey]: approved,
        updatedAt: new Date(),
      };

      await db
        .update(providerApprovalQueue)
        .set(updateData)
        .where(eq(providerApprovalQueue.id, applicationId));

      // Get updated checklist
      const review = await this.getApplicationReview(applicationId);
      
      logger.info('[AdminReview] Checklist item updated', { 
        applicationId, 
        itemKey, 
        approved,
        reviewerId 
      });

      return {
        success: true,
        checklist: review!.checklist,
      };
    } catch (error) {
      logger.error('[AdminReview] Error updating checklist', error);
      throw error;
    }
  }

  /**
   * Approve provider application
   */
  async approveApplication(
    applicationId: number,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<{ success: boolean; messageHe: string; messageEn: string }> {
    try {
      const review = await this.getApplicationReview(applicationId);
      
      if (!review) {
        return {
          success: false,
          messageHe: 'הבקשה לא נמצאה',
          messageEn: 'Application not found',
        };
      }

      if (review.application.status === 'approved') {
        return {
          success: false,
          messageHe: 'הבקשה כבר אושרה',
          messageEn: 'Application already approved',
        };
      }

      // Israel-safe approval gate (2026 spec). Replaces the previous hard
      // police-check gate. Two paths:
      //   1. Provider opted into a high-risk service
      //      (requires_enhanced_verification = true) → police check IS still
      //      required. Admin MUST tick policeCheckApproved.
      //   2. Provider only offers low-risk services → the signed
      //      self_declaration_no_relevant_convictions checkbox is sufficient.
      //      Admin can approve without a police clearance document.
      const providerUserId = String(review.application.providerId);
      const [providerApp] = await db
        .select({
          requiresEnhancedVerification: providerApplications.requiresEnhancedVerification,
          selfDeclarationNoRelevantConvictions: providerApplications.selfDeclarationNoRelevantConvictions,
          selfDeclarationAt: providerApplications.selfDeclarationAt,
        })
        .from(providerApplications)
        .where(eq(providerApplications.userId, providerUserId))
        .limit(1);

      if (!providerApp) {
        logger.warn('[AdminReview] Approval blocked — no provider_applications row for queue entry', {
          applicationId,
          providerUserId,
        });
        return {
          success: false,
          messageHe: 'לא ניתן לאשר — לא נמצאה בקשת ספק תואמת.',
          messageEn: 'Approval blocked — no matching provider application was found.',
        };
      }

      if (!providerApp.selfDeclarationNoRelevantConvictions || !providerApp.selfDeclarationAt) {
        logger.warn('[AdminReview] Approval blocked — provider self-declaration missing', {
          applicationId,
          reviewerId,
          providerUserId,
        });
        return {
          success: false,
          messageHe: 'לא ניתן לאשר — הצהרת הספק על היעדר הרשעות רלוונטיות חסרה.',
          messageEn: 'Approval blocked — provider self-declaration of no relevant convictions is missing.',
        };
      }

      if (providerApp.requiresEnhancedVerification && !review.checklist.policeCheckApproved) {
        logger.warn('[AdminReview] Approval blocked — enhanced verification required but police check not approved', {
          applicationId,
          reviewerId,
          providerUserId,
        });
        return {
          success: false,
          messageHe: 'לא ניתן לאשר — שירותי סיכון גבוה מחייבים בדיקת משטרה מאושרת בנוסף להצהרה.',
          messageEn: 'Approval blocked — high-risk services require an approved police check in addition to the self-declaration.',
        };
      }

      await db
        .update(providerApprovalQueue)
        .set({
          status: 'approved',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(providerApprovalQueue.id, applicationId));

      logger.info('[AdminReview] Application approved', { 
        applicationId, 
        reviewerId,
        providerId: review.application.providerId,
        platform: review.application.platform,
      });

      // Look up the provider's Firebase UID and set their role claim to 'provider'
      try {
        const { providerId, platform } = review.application;
        let firebaseUid: string | null = null;

        if (platform === 'walk_my_pet') {
          // providerId in the queue is the Firebase UID — join on userId, not walkerId
          const [walker] = await db.select({ userId: walkerProfiles.userId })
            .from(walkerProfiles).where(eq(walkerProfiles.userId, providerId)).limit(1);
          if (walker) {
            firebaseUid = walker.userId;
            await db.update(walkerProfiles)
              .set({ verificationStatus: 'verified', isAvailable: true, isActive: true })
              .where(eq(walkerProfiles.userId, providerId));
          }
        } else if (platform === 'sitter_suite') {
          // providerId is Firebase UID — must join on userId, NOT parseInt(id)
          const [sitter] = await db.select({ userId: sitterProfiles.userId })
            .from(sitterProfiles).where(eq(sitterProfiles.userId, providerId)).limit(1);
          if (sitter) {
            firebaseUid = sitter.userId;
            await db.update(sitterProfiles)
              .set({ verificationStatus: 'active', isActive: true })
              .where(eq(sitterProfiles.userId, providerId));
          }
        } else if (platform === 'academy') {
          // providerId is Firebase UID — join on userId, not trainerId (TR-YYYY-NNNN)
          const [trainer] = await db.select({ userId: trainers.userId })
            .from(trainers).where(eq(trainers.userId, providerId)).limit(1);
          if (trainer) {
            firebaseUid = trainer.userId;
            await db.update(trainers)
              .set({ verificationStatus: 'approved', isActive: true })
              .where(eq(trainers.userId, providerId));
          }
        }

        if (firebaseUid) {
          const existingClaims = (await firebaseAuth.getUser(firebaseUid)).customClaims || {};
          await firebaseAuth.setCustomUserClaims(firebaseUid, {
            ...existingClaims,
            role: 'provider',
            accountType: 'provider',
            providerApprovedAt: new Date().toISOString(),
          });
          logger.info('[AdminReview] Firebase claims set for approved provider', { firebaseUid, platform });

          // ── Financial document + multi-channel notification (fire-and-forget) ──
          (async () => {
            try {
              const [provUser] = await db.select({ phone: users.phone, email: users.email, firstName: users.firstName })
                .from(users).where(eq(users.id, firebaseUid)).limit(1);

              const providerName = provUser?.firstName || 'ספק';
              const approvalHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — בקשת הצטרפות אושרה ✅</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">שם</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${providerName}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">פלטפורמה</td><td style="padding:8px;border-bottom:1px solid #eee;">${review.application.platform}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">סטטוס</td><td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;font-weight:bold;">מאושר</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך אישור</td><td style="padding:8px;">${new Date().toLocaleDateString('he-IL')}</td></tr>
</table>
<p style="margin-top:16px;"><a href="https://petwash.co.il/provider/onboarding" style="background:#000;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">התחל/י כספק</a></p>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il</p>
</body></html>`;

              await FinancialDocumentService.create({
                userId: firebaseUid,
                documentType: 'booking_earnings_notice',
                issuedByEntity: 'PetWash',
                documentPayloadJson: {
                  event: 'provider_approved',
                  platform: review.application.platform,
                  providerId: review.application.providerId,
                  approvedAt: new Date().toISOString(),
                },
                renderedHtml: approvalHtml,
              });

              await dispatchNotifications({
                userId: firebaseUid,
                eventType: 'provider_approved',
                templateKey: 'provider_registration_approved',
                channels: ['sms', 'push'],
                sms: provUser?.phone ? {
                  to: provUser.phone,
                  text: buildProviderApprovedSms({ providerName }),
                } : undefined,
                push: {
                  userId: firebaseUid,
                  title: `בקשתך אושרה! – Pet Wash™ ✅`,
                  body: `חשבון הספק שלך אושר. לחץ/י להתחיל את תהליך ה-Onboarding.`,
                  data: { type: 'provider_approved', platform: review.application.platform },
                },
                debugPayload: { applicationId, platform: review.application.platform },
              });

              // ── force_token_refresh: tells the frontend to call getIdToken(true) ──
              // Firebase custom claims are set above but the provider's session token
              // won't see the new 'provider' role until it naturally expires (~60 min).
              // This in-app notification signals the frontend to force an immediate refresh.
              await db.insert(superAppNotifications).values({
                userId: firebaseUid,
                type: 'force_token_refresh',
                title: '✅ בקשתך אושרה! — PetWash™',
                titleHe: '✅ בקשתך אושרה! — PetWash™',
                body: 'חשבון הספק שלך אושר. לחץ/י כאן כדי לפתוח את לוח הבקרה שלך.',
                bodyHe: 'חשבון הספק שלך אושר. לחץ/י כאן כדי לפתוח את לוח הבקרה שלך.',
                actionType: 'force_token_refresh',
                actionUrl: '/provider-os',
                channels: ['in_app'],
                isRead: false,
                createdAt: new Date(),
              });

              // ── schedule_setup: guides newly approved providers to set availability ──
              // Without availability slots the provider never appears in search results.
              // A dedicated nudge immediately after approval ensures they don't miss this.
              await db.insert(superAppNotifications).values({
                userId: firebaseUid,
                type: 'setup_schedule',
                title: '📅 הגדר/י את לוח הזמינות שלך',
                titleHe: '📅 הגדר/י את לוח הזמינות שלך',
                body: 'על מנת שלקוחות יוכלו לראות ולהזמין אותך — יש להגדיר את שעות הפעילות שלך בלוח הזמנים.',
                bodyHe: 'על מנת שלקוחות יוכלו לראות ולהזמין אותך — יש להגדיר את שעות הפעילות שלך בלוח הזמנים.',
                actionType: 'setup_schedule',
                actionUrl: '/provider-os?tab=calendar',
                channels: ['in_app'],
                isRead: false,
                createdAt: new Date(),
              });
            } catch (notifErr: any) {
              logger.warn('[AdminReview] Post-approval notification failed (non-fatal)', { error: notifErr?.message });
            }
          })();
        }
      } catch (claimsErr) {
        logger.warn('[AdminReview] Could not set Firebase claims (non-fatal)', { claimsErr });
      }

      return {
        success: true,
        messageHe: 'הבקשה אושרה! הספק יכול להתחיל לעבוד 🎉',
        messageEn: 'Application approved! Provider can start working 🎉',
      };
    } catch (error) {
      logger.error('[AdminReview] Error approving application', error);
      throw error;
    }
  }

  /**
   * Reject provider application
   */
  async rejectApplication(
    applicationId: number,
    reviewerId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; messageHe: string; messageEn: string }> {
    try {
      const review = await this.getApplicationReview(applicationId);
      
      if (!review) {
        return {
          success: false,
          messageHe: 'הבקשה לא נמצאה',
          messageEn: 'Application not found',
        };
      }

      await db
        .update(providerApprovalQueue)
        .set({
          status: 'rejected',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          rejectionReason,
          rejectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(providerApprovalQueue.id, applicationId));

      logger.info('[AdminReview] Application rejected', { 
        applicationId, 
        reviewerId,
        reason: rejectionReason,
      });

      // ── Provider rejection document + notifications (fire-and-forget) ──
      (async () => {
        try {
          const { providerId, platform } = review.application;
          let firebaseUid: string | null = null;

          if (platform === 'walk_my_pet') {
            const [walker] = await db.select({ userId: walkerProfiles.userId })
              .from(walkerProfiles).where(eq(walkerProfiles.userId, providerId)).limit(1);
            if (walker) firebaseUid = walker.userId;
          } else if (platform === 'sitter_suite') {
            const [sitter] = await db.select({ userId: sitterProfiles.userId })
              .from(sitterProfiles).where(eq(sitterProfiles.userId, providerId)).limit(1);
            if (sitter) firebaseUid = sitter.userId;
          } else if (platform === 'pettrek') {
            const [trainer] = await db.select({ userId: trainers.userId })
              .from(trainers).where(eq(trainers.userId, providerId)).limit(1);
            if (trainer) firebaseUid = trainer.userId;
          }

          if (!firebaseUid) return;

          const [provUser] = await db.select({ phone: users.phone, email: users.email, firstName: users.firstName })
            .from(users).where(eq(users.id, firebaseUid)).limit(1);

          const providerName = provUser?.firstName || 'ספק';
          const issuedAt = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

          const rejectionHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — הודעה על דחיית בקשה</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">שם</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${providerName}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">פלטפורמה</td><td style="padding:8px;border-bottom:1px solid #eee;">${platform}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">סיבת הדחייה</td><td style="padding:8px;border-bottom:1px solid #eee;">${rejectionReason}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">השלב הבא</td><td style="padding:8px;border-bottom:1px solid #eee;">צור/י קשר עם ${CANONICAL_SUPPORT_EMAIL} לבירורים</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${issuedAt}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL}</p>
</body></html>`;

          const docRef = await FinancialDocumentService.create({
            userId: firebaseUid,
            documentType: 'provider_rejection_notice',
            issuedByEntity: 'PetWash',
            documentPayloadJson: {
              applicationId,
              providerId,
              platform,
              rejectionReason,
              reviewerId,
              nextStep: `Contact ${CANONICAL_SUPPORT_EMAIL}`,
            },
            renderedHtml: rejectionHtml,
            idempotencyKey: `provider_rejection_notice:${applicationId}:${firebaseUid}`,
          });

          const smsText = buildProviderRejectedSms({ providerName });
          await dispatchNotifications({
            userId: firebaseUid,
            eventType: 'provider_rejected',
            templateKey: 'provider_application_rejected',
            channels: ['sms', 'push'],
            sms: provUser?.phone ? { to: provUser.phone, text: smsText } : undefined,
            push: {
              userId: firebaseUid,
              title: `PetWash™ — בקשת הספק לא אושרה`,
              body: `לצערנו לא ניתן לאשר את בקשתך בשלב זה. פנה/י לתמיכה.`,
              data: { applicationId: String(applicationId), documentRef: docRef, type: 'provider_rejected' },
            },
            debugPayload: {
              applicationId,
              providerName,
              rejectionReason,
              smsText,
              pushTitle: `PetWash™ — בקשת הספק לא אושרה`,
              pushBody: `לצערנו לא ניתן לאשר את בקשתך`,
              documentRef: docRef,
            },
          });
        } catch (notifErr: any) {
          logger.error('[AdminReview] Post-rejection notification failed silently', { error: notifErr?.message });
        }
      })();

      return {
        success: true,
        messageHe: 'הבקשה נדחתה. הספק יקבל הודעה.',
        messageEn: 'Application rejected. Provider will be notified.',
      };
    } catch (error) {
      logger.error('[AdminReview] Error rejecting application', error);
      throw error;
    }
  }

  /**
   * Put application on hold
   */
  async putOnHold(
    applicationId: number,
    reviewerId: string,
    reason: string
  ): Promise<{ success: boolean; messageHe: string; messageEn: string }> {
    try {
      await db
        .update(providerApprovalQueue)
        .set({
          status: 'on_hold',
          reviewedBy: reviewerId,
          reviewNotes: reason,
          updatedAt: new Date(),
        })
        .where(eq(providerApprovalQueue.id, applicationId));

      logger.info('[AdminReview] Application put on hold', { 
        applicationId, 
        reviewerId,
        reason,
      });

      return {
        success: true,
        messageHe: 'הבקשה הועברה להמתנה',
        messageEn: 'Application put on hold',
      };
    } catch (error) {
      logger.error('[AdminReview] Error putting on hold', error);
      throw error;
    }
  }

  /**
   * Check if provider is fully approved for a platform
   */
  async isProviderApproved(providerId: string, platform: string): Promise<boolean> {
    try {
      const application = await db
        .select()
        .from(providerApprovalQueue)
        .where(
          and(
            eq(providerApprovalQueue.providerId, providerId),
            eq(providerApprovalQueue.platform, platform),
            eq(providerApprovalQueue.status, 'approved')
          )
        )
        .limit(1);

      return application.length > 0;
    } catch (error) {
      logger.error('[AdminReview] Error checking approval status', error);
      return false;
    }
  }

  /**
   * Get all approved providers for a platform
   */
  async getApprovedProviders(platform: string, limit: number = 100): Promise<ProviderApprovalQueue[]> {
    try {
      return await db
        .select()
        .from(providerApprovalQueue)
        .where(
          and(
            eq(providerApprovalQueue.platform, platform),
            eq(providerApprovalQueue.status, 'approved')
          )
        )
        .orderBy(desc(providerApprovalQueue.approvedAt))
        .limit(limit);
    } catch (error) {
      logger.error('[AdminReview] Error getting approved providers', error);
      throw error;
    }
  }
}

export const adminProviderReviewService = new AdminProviderReviewService();
