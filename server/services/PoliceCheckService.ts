/**
 * Police Check Badge Service - Israeli תעודת יושר
 * 
 * Manages police clearance certificate verification and badge issuance
 * for Pet Wash™ service providers.
 * 
 * Hebrew-dominant with English brand touches
 * Israeli Law 2025 compliance
 */

import { db } from '../db';
import { 
  providerPoliceChecks,
  type InsertProviderPoliceCheck,
  type ProviderPoliceCheck,
  providerApprovalQueue,
} from '@shared/schema';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

// Police check status types
export type PoliceCheckStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired';

// Document upload result
export interface PoliceCheckUploadResult {
  success: boolean;
  checkId: number;
  status: PoliceCheckStatus;
  messageHe: string;
  messageEn: string;
}

// Badge verification result
export interface BadgeVerificationResult {
  valid: boolean;
  providerId?: string;
  providerName?: string;
  platform?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  badgeType?: string;
  reasonHe?: string;
  reasonEn?: string;
}

// Provider police check summary
export interface PoliceCheckSummary {
  providerId: string;
  hasValidPoliceCheck: boolean;
  hasBadge: boolean;
  latestCheck: ProviderPoliceCheck | null;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
}

class PoliceCheckService {
  
  // Police check validity period (6 months for Israeli תעודת יושר)
  private readonly VALIDITY_MONTHS = 6;
  
  // Badge validity period (matches police check)
  private readonly BADGE_VALIDITY_MONTHS = 6;

  /**
   * Submit a new police check document for verification
   */
  async submitPoliceCheck(
    providerId: string,
    documentUrl: string,
    documentFileName: string,
    documentIssuedAt: Date
  ): Promise<PoliceCheckUploadResult> {
    try {
      // Check for existing pending/under_review checks
      const existingChecks = await db
        .select()
        .from(providerPoliceChecks)
        .where(
          and(
            eq(providerPoliceChecks.providerId, providerId),
            sql`${providerPoliceChecks.status} IN ('pending', 'under_review')`
          )
        );

      if (existingChecks.length > 0) {
        return {
          success: false,
          checkId: existingChecks[0].id,
          status: existingChecks[0].status as PoliceCheckStatus,
          messageHe: 'כבר קיימת בקשה בטיפול. אנא המתן לתוצאות הבדיקה.',
          messageEn: 'A check is already in progress. Please wait for results.',
        };
      }

      // Calculate expiry date (6 months from document issue date)
      const expiresAt = new Date(documentIssuedAt);
      expiresAt.setMonth(expiresAt.getMonth() + this.VALIDITY_MONTHS);

      // Check if document is already expired
      if (expiresAt < new Date()) {
        return {
          success: false,
          checkId: 0,
          status: 'rejected',
          messageHe: 'המסמך שהועלה פג תוקף. אנא הפק תעודת יושר חדשה.',
          messageEn: 'The uploaded document has expired. Please obtain a new police clearance.',
        };
      }

      // Insert new police check record
      const insertData: InsertProviderPoliceCheck = {
        providerId,
        documentType: 'police_clearance',
        documentUrl,
        documentFileName,
        status: 'pending',
        issuedAt: documentIssuedAt,
        expiresAt,
      };

      const result = await db
        .insert(providerPoliceChecks)
        .values(insertData)
        .returning();

      logger.info('[PoliceCheck] New check submitted', { 
        providerId, 
        checkId: result[0].id 
      });

      return {
        success: true,
        checkId: result[0].id,
        status: 'pending',
        messageHe: 'תעודת היושר הועלתה בהצלחה! היא תיבדק תוך 24-48 שעות.',
        messageEn: 'Police clearance uploaded successfully! It will be reviewed within 24-48 hours.',
      };
    } catch (error) {
      logger.error('[PoliceCheck] Error submitting check', { error });
      throw error;
    }
  }

  /**
   * Get provider's police check status
   */
  async getProviderPoliceCheckStatus(providerId: string): Promise<PoliceCheckSummary> {
    try {
      // Get latest police check
      const checks = await db
        .select()
        .from(providerPoliceChecks)
        .where(eq(providerPoliceChecks.providerId, providerId))
        .orderBy(desc(providerPoliceChecks.createdAt))
        .limit(1);

      const latestCheck = checks[0] || null;

      if (!latestCheck) {
        return {
          providerId,
          hasValidPoliceCheck: false,
          hasBadge: false,
          latestCheck: null,
          expiresAt: null,
          daysUntilExpiry: null,
        };
      }

      const now = new Date();
      const expiresAt = latestCheck.expiresAt;
      const isExpired = expiresAt && expiresAt < now;
      const isApproved = latestCheck.status === 'approved';
      const hasValidPoliceCheck = isApproved && !isExpired;

      // Calculate days until expiry
      let daysUntilExpiry = null;
      if (expiresAt && !isExpired) {
        const diffTime = expiresAt.getTime() - now.getTime();
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        providerId,
        hasValidPoliceCheck,
        hasBadge: latestCheck.badgeIssued || false,
        latestCheck,
        expiresAt,
        daysUntilExpiry,
      };
    } catch (error) {
      logger.error('[PoliceCheck] Error getting status', { error });
      throw error;
    }
  }

  /**
   * Admin: Approve a police check and issue badge
   */
  async approvePoliceCheck(
    checkId: number,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<{ success: boolean; messageHe: string; messageEn: string }> {
    try {
      const check = await db
        .select()
        .from(providerPoliceChecks)
        .where(eq(providerPoliceChecks.id, checkId))
        .limit(1);

      if (!check[0]) {
        return {
          success: false,
          messageHe: 'הבקשה לא נמצאה',
          messageEn: 'Check not found',
        };
      }

      if (check[0].status !== 'pending' && check[0].status !== 'under_review') {
        return {
          success: false,
          messageHe: 'הבקשה כבר טופלה',
          messageEn: 'Check already processed',
        };
      }

      // Update police check record
      await db
        .update(providerPoliceChecks)
        .set({
          status: 'approved',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
          badgeIssued: true,
          badgeIssuedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(providerPoliceChecks.id, checkId));

      // Update provider approval queue if exists
      await db
        .update(providerApprovalQueue)
        .set({
          policeCheckApproved: true,
          updatedAt: new Date(),
        })
        .where(eq(providerApprovalQueue.providerId, check[0].providerId));

      logger.info('[PoliceCheck] Check approved, badge issued', {
        checkId,
        providerId: check[0].providerId,
        reviewerId,
      });

      return {
        success: true,
        messageHe: 'תעודת היושר אושרה ותג האבטחה הונפק בהצלחה!',
        messageEn: 'Police check approved and security badge issued!',
      };
    } catch (error) {
      logger.error('[PoliceCheck] Error approving check', { error });
      throw error;
    }
  }

  /**
   * Admin: Reject a police check
   */
  async rejectPoliceCheck(
    checkId: number,
    reviewerId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; messageHe: string; messageEn: string }> {
    try {
      const check = await db
        .select()
        .from(providerPoliceChecks)
        .where(eq(providerPoliceChecks.id, checkId))
        .limit(1);

      if (!check[0]) {
        return {
          success: false,
          messageHe: 'הבקשה לא נמצאה',
          messageEn: 'Check not found',
        };
      }

      await db
        .update(providerPoliceChecks)
        .set({
          status: 'rejected',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(providerPoliceChecks.id, checkId));

      logger.info('[PoliceCheck] Check rejected', {
        checkId,
        providerId: check[0].providerId,
        reviewerId,
        reason: rejectionReason,
      });

      return {
        success: true,
        messageHe: 'הבקשה נדחתה. הספק יקבל הודעה.',
        messageEn: 'Check rejected. Provider will be notified.',
      };
    } catch (error) {
      logger.error('[PoliceCheck] Error rejecting check', { error });
      throw error;
    }
  }

  /**
   * Get all pending police checks for admin review
   */
  async getPendingChecks(limit: number = 50): Promise<ProviderPoliceCheck[]> {
    try {
      return await db
        .select()
        .from(providerPoliceChecks)
        .where(
          sql`${providerPoliceChecks.status} IN ('pending', 'under_review')`
        )
        .orderBy(desc(providerPoliceChecks.createdAt))
        .limit(limit);
    } catch (error) {
      logger.error('[PoliceCheck] Error getting pending checks', { error });
      throw error;
    }
  }

  /**
   * Check for expiring police checks (run as cron job)
   */
  async getExpiringChecks(daysBeforeExpiry: number = 30): Promise<ProviderPoliceCheck[]> {
    try {
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + daysBeforeExpiry);

      return await db
        .select()
        .from(providerPoliceChecks)
        .where(
          and(
            eq(providerPoliceChecks.status, 'approved'),
            lt(providerPoliceChecks.expiresAt, expiryThreshold)
          )
        )
        .orderBy(providerPoliceChecks.expiresAt);
    } catch (error) {
      logger.error('[PoliceCheck] Error getting expiring checks', { error });
      throw error;
    }
  }

  /**
   * Mark expired police checks (run as cron job)
   */
  async markExpiredChecks(): Promise<number> {
    try {
      const now = new Date();

      const result = await db
        .update(providerPoliceChecks)
        .set({
          status: 'expired',
          badgeIssued: false,
          updatedAt: now,
        })
        .where(
          and(
            eq(providerPoliceChecks.status, 'approved'),
            lt(providerPoliceChecks.expiresAt, now)
          )
        )
        .returning();

      if (result.length > 0) {
        logger.info('[PoliceCheck] Marked expired checks', { count: result.length });
      }

      return result.length;
    } catch (error) {
      logger.error('[PoliceCheck] Error marking expired checks', { error });
      throw error;
    }
  }

  /**
   * Verify if a provider has a valid police check badge
   * Used for payout verification and booking eligibility
   */
  async verifyProviderBadge(providerId: string): Promise<BadgeVerificationResult> {
    try {
      const status = await this.getProviderPoliceCheckStatus(providerId);

      if (!status.hasValidPoliceCheck || !status.hasBadge) {
        return {
          valid: false,
          reasonHe: 'לספק אין תעודת יושר בתוקף או תג אבטחה',
          reasonEn: 'Provider does not have valid police check or security badge',
        };
      }

      return {
        valid: true,
        providerId,
        issuedAt: status.latestCheck?.badgeIssuedAt || undefined,
        expiresAt: status.expiresAt || undefined,
        badgeType: 'police_clearance_verified',
      };
    } catch (error) {
      logger.error('[PoliceCheck] Error verifying badge', { error });
      return {
        valid: false,
        reasonHe: 'שגיאה באימות התג',
        reasonEn: 'Error verifying badge',
      };
    }
  }
}

export const policeCheckService = new PoliceCheckService();
