/**
 * Dynamic Pricing Service - 2025
 * פונקציית תמחור דינמית עם הנחות משתנות
 * 
 * Discount Logic:
 * 1. E-gift cards: NO discount (full price)
 * 2. Regular loyalty club: 5% fixed discount
 * 3. Certified disabled (verified): Variable discount from database
 * 4. Future: VIP, annual members, etc.
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db as firestore } from '../lib/firebase-admin';

interface PriceCalculationResult {
  basePrice: number;
  discountRate: number;
  discountAmount: number;
  finalPrice: number;
  discountReason: string;
}

export class PricingService {
  /**
   * Calculate final price with dynamic discounts
   * פונקציה לבדיקה וחישוב מחיר סופי
   */
  async calculateFinalPrice(
    basePrice: number,
    userId: string,
    isEGift: boolean = false
  ): Promise<PriceCalculationResult> {
    try {
      // 1. E-Gift cards - NO discount
      if (isEGift) {
        return {
          basePrice,
          discountRate: 0,
          discountAmount: 0,
          finalPrice: basePrice,
          discountReason: 'e-gift_no_discount'
        };
      }

      // 2. Get user profile from PostgreSQL
      const [userProfile] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!userProfile) {
        // User not found - return full price
        return {
          basePrice,
          discountRate: 0,
          discountAmount: 0,
          finalPrice: basePrice,
          discountReason: 'user_not_found'
        };
      }

      let discountRate = 0.00;
      let discountReason = 'no_discount';

      // 3. Fixed discount for regular loyalty club (5%)
      if (userProfile.isClubMember && !userProfile.isDisabilityVerified && !userProfile.isSeniorVerified) {
        discountRate = 0.05; // 5% קבוע
        discountReason = 'loyalty_club_5percent';
      }

      // 4. Variable discount for certified disabled (verified תעודת נכה)
      else if (userProfile.isDisabilityVerified) {
        discountRate = await this.getVariableDiscount('certified_disabled');
        discountReason = 'certified_disabled_verified';
      }

      // 5. Variable discount for certified seniors (verified גימלאים)
      else if (userProfile.isSeniorVerified) {
        discountRate = await this.getVariableDiscount('certified_senior');
        discountReason = 'certified_senior_verified';
      }

      // 6. Future: VIP annual members, etc.
      // else if (userProfile.discountGroup === 'VIP_annual') { ... }

      // Calculate final price
      const discountAmount = basePrice * discountRate;
      const finalPrice = basePrice - discountAmount;

      logger.info('[Pricing] Price calculated', {
        userId,
        basePrice,
        discountRate,
        finalPrice,
        discountReason
      });

      return {
        basePrice,
        discountRate,
        discountAmount,
        finalPrice,
        discountReason
      };

    } catch (error: any) {
      logger.error('[Pricing] Failed to calculate price', error);
      // On error, return full price to avoid blocking purchase
      return {
        basePrice,
        discountRate: 0,
        discountAmount: 0,
        finalPrice: basePrice,
        discountReason: 'calculation_error'
      };
    }
  }

  /**
   * Get variable discount rate from Firestore admin panel
   * משיכת ההנחה המשתנה (אותה ניתן לשנות באדמין פאנל)
   */
  private async getVariableDiscount(discountGroup: string): Promise<number> {
    try {
      // Get from Firestore settings document
      const settingsRef = firestore.collection('settings').doc('discounts');
      const doc = await settingsRef.get();

      if (!doc.exists) {
        // Default discounts if not configured
        logger.warn('[Pricing] Discount settings not found, using defaults');
        return this.getDefaultDiscount(discountGroup);
      }

      const data = doc.data();
      const discount = data?.[discountGroup];

      if (typeof discount === 'number') {
        logger.info('[Pricing] Variable discount retrieved', { discountGroup, discount });
        return discount;
      }

      // Fallback to default
      return this.getDefaultDiscount(discountGroup);

    } catch (error: any) {
      logger.error('[Pricing] Failed to get variable discount', error);
      return this.getDefaultDiscount(discountGroup);
    }
  }

  /**
   * Default discount rates (fallback)
   */
  private getDefaultDiscount(discountGroup: string): number {
    const defaults: Record<string, number> = {
      'certified_disabled': 0.10, // 10% default for תעודת נכה
      'certified_senior': 0.10,   // 10% default for גימלאים
      'loyalty_club': 0.05,       // 5% default for regular members
      'VIP_annual': 0.15          // 15% for future VIP
    };

    return defaults[discountGroup] || 0.00;
  }

  /**
   * Admin: Update variable discount rate
   * עדכון ההנחה המשתנה דרך פאנל הניהול
   */
  async updateVariableDiscount(
    discountGroup: string,
    newRate: number,
    adminUid: string
  ): Promise<void> {
    try {
      // Validate rate
      if (newRate < 0 || newRate > 1) {
        throw new Error('Discount rate must be between 0 and 1');
      }

      // Update in Firestore
      const settingsRef = firestore.collection('settings').doc('discounts');
      await settingsRef.set({
        [discountGroup]: newRate,
        lastUpdated: new Date(),
        updatedBy: adminUid
      }, { merge: true });

      // Audit log
      await firestore.collection('auditLogs').add({
        eventType: 'discount_rate_updated',
        discountGroup,
        oldRate: await this.getVariableDiscount(discountGroup),
        newRate,
        adminUid,
        timestamp: new Date()
      });

      logger.info('[Pricing] Discount rate updated', {
        discountGroup,
        newRate,
        adminUid
      });

    } catch (error: any) {
      logger.error('[Pricing] Failed to update discount rate', error);
      throw error;
    }
  }

  /**
   * Get all current discount rates (for admin dashboard)
   */
  async getAllDiscountRates(): Promise<Record<string, number>> {
    try {
      const settingsRef = firestore.collection('settings').doc('discounts');
      const doc = await settingsRef.get();

      if (!doc.exists) {
        return {
          certified_disabled: this.getDefaultDiscount('certified_disabled'),
          certified_senior: this.getDefaultDiscount('certified_senior'),
          loyalty_club: this.getDefaultDiscount('loyalty_club'),
          VIP_annual: this.getDefaultDiscount('VIP_annual')
        };
      }

      return doc.data() as Record<string, number>;

    } catch (error: any) {
      logger.error('[Pricing] Failed to get discount rates', error);
      return {};
    }
  }

  /**
   * Prevent duplicate usage / shared accounts
   * איסור כפילויות/שימוש משותף
   */
  async validateDiscountEligibility(
    userId: string,
    discountGroup: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { eligible: false, reason: 'User not found' };
      }

      // Check if verified for special discount groups
      if (discountGroup === 'certified_disabled' && !user.isDisabilityVerified) {
        return { eligible: false, reason: 'Disability certificate not verified' };
      }

      if (discountGroup === 'certified_senior' && !user.isSeniorVerified) {
        return { eligible: false, reason: 'Senior status not verified' };
      }

      // Check for duplicate accounts (same verification used multiple times)
      // This would require additional logic to track document numbers, etc.
      // For now, we trust the biometric verification to prevent duplicates

      return { eligible: true };

    } catch (error: any) {
      logger.error('[Pricing] Failed to validate eligibility', error);
      return { eligible: false, reason: 'Validation error' };
    }
  }
}

// Export singleton instance
export const pricingService = new PricingService();
