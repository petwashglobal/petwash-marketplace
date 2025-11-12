import { db } from '../db';
import { contractorBadges, providerApplications, contractorEarnings } from '@shared/schema';
import { eq, and, count, sum } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

/**
 * Digital Badge Issuance System (2026 Spec)
 * 
 * Badge Types:
 * - certification: Pet First Aid, CPR, Grooming
 * - milestone: 100 bookings, 5-star rating, 1 year active
 * - achievement: Top earner, Perfect attendance, Customer favorite
 * 
 * Features:
 * - Automatic badge awarding based on triggers
 * - Manual admin issuance
 * - Expiration tracking for time-sensitive badges
 * - Verification system
 */

export type BadgeType = 'certification' | 'milestone' | 'achievement';
export type BadgeCategory = 
  | 'pet_first_aid'
  | 'cpr_certified'
  | 'grooming_expert'
  | 'driving_pro'
  | '100_bookings'
  | '500_bookings'
  | '1000_bookings'
  | 'five_star_pro'
  | 'one_year_active'
  | 'three_years_active'
  | 'top_earner'
  | 'customer_favorite'
  | 'perfect_attendance'
  | 'verified_identity'
  | 'background_cleared';

interface IssueBadgeParams {
  contractorId: string;
  badgeType: BadgeType;
  badgeCategory: BadgeCategory;
  badgeName: string;
  description: string;
  iconUrl?: string;
  expiresAt?: Date; // For certifications that need renewal
  metadata?: Record<string, any>;
  issuedBy?: string; // Admin user ID
}

/**
 * Issue a new badge to a contractor
 */
export async function issueBadge(params: IssueBadgeParams) {
  try {
    const {
      contractorId,
      badgeType,
      badgeCategory,
      badgeName,
      description,
      iconUrl,
      expiresAt,
      metadata,
      issuedBy,
    } = params;

    // Check if badge already exists
    const existingBadges = await db
      .select()
      .from(contractorBadges)
      .where(
        and(
          eq(contractorBadges.contractorId, contractorId),
          eq(contractorBadges.badgeCategory, badgeCategory)
        )
      );

    if (existingBadges.length > 0) {
      logger.warn('[BadgeIssuance] Badge already exists', {
        contractorId,
        badgeCategory,
      });
      return existingBadges[0];
    }

    // Generate unique badge ID
    const badgeId = `BADGE-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

    // Insert badge record
    const [badge] = await db
      .insert(contractorBadges)
      .values({
        badgeId,
        contractorId,
        badgeType,
        badgeCategory,
        badgeName,
        description,
        iconUrl: iconUrl || null,
        issuedAt: new Date(),
        expiresAt: expiresAt || null,
        isActive: true,
        metadata: metadata || null,
        issuedBy: issuedBy || 'system',
      })
      .returning();

    logger.info('[BadgeIssuance] Badge issued', {
      badgeId,
      contractorId,
      badgeCategory,
      badgeName,
    });

    // TODO: Send push notification to contractor
    // TODO: Send email congratulation

    return badge;
  } catch (error) {
    logger.error('[BadgeIssuance] Error issuing badge', { error });
    throw error;
  }
}

/**
 * Check and award milestone badges automatically
 */
export async function checkAndAwardMilestoneBadges(contractorId: string): Promise<void> {
  try {
    // Get contractor info
    const [contractor] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.userId, contractorId))
      .limit(1);

    if (!contractor) {
      throw new Error(`Contractor ${contractorId} not found`);
    }

    // Get total bookings count (from earnings records)
    const earningsCount = await db
      .select({ count: count() })
      .from(contractorEarnings)
      .where(eq(contractorEarnings.contractorId, contractorId));

    const totalBookings = earningsCount[0]?.count || 0;

    // Award booking milestone badges
    if (totalBookings >= 100 && totalBookings < 500) {
      await issueBadge({
        contractorId,
        badgeType: 'milestone',
        badgeCategory: '100_bookings',
        badgeName: '100 Bookings Club',
        description: 'Completed 100 successful bookings',
        iconUrl: '/badges/100-bookings.png',
      });
    } else if (totalBookings >= 500 && totalBookings < 1000) {
      await issueBadge({
        contractorId,
        badgeType: 'milestone',
        badgeCategory: '500_bookings',
        badgeName: '500 Bookings Elite',
        description: 'Completed 500 successful bookings',
        iconUrl: '/badges/500-bookings.png',
      });
    } else if (totalBookings >= 1000) {
      await issueBadge({
        contractorId,
        badgeType: 'milestone',
        badgeCategory: '1000_bookings',
        badgeName: '1000 Bookings Legend',
        description: 'Completed 1000 successful bookings',
        iconUrl: '/badges/1000-bookings.png',
      });
    }

    // Check for perfect 5-star rating
    if (contractor.publicTrustScore && parseFloat(contractor.publicTrustScore) === 5.0) {
      await issueBadge({
        contractorId,
        badgeType: 'achievement',
        badgeCategory: 'five_star_pro',
        badgeName: '5-Star Professional',
        description: 'Maintained perfect 5.0 rating',
        iconUrl: '/badges/five-star.png',
      });
    }

    // Check for tenure badges
    if (contractor.createdAt) {
      const accountAge = Date.now() - new Date(contractor.createdAt).getTime();
      const yearsActive = accountAge / (1000 * 60 * 60 * 24 * 365);

      if (yearsActive >= 1 && yearsActive < 3) {
        await issueBadge({
          contractorId,
          badgeType: 'milestone',
          badgeCategory: 'one_year_active',
          badgeName: '1 Year Veteran',
          description: 'Active contractor for 1 year',
          iconUrl: '/badges/one-year.png',
        });
      } else if (yearsActive >= 3) {
        await issueBadge({
          contractorId,
          badgeType: 'milestone',
          badgeCategory: 'three_years_active',
          badgeName: '3 Year Legend',
          description: 'Active contractor for 3 years',
          iconUrl: '/badges/three-years.png',
        });
      }
    }

    logger.info('[BadgeIssuance] Milestone badges checked and awarded', {
      contractorId,
      totalBookings,
    });
  } catch (error) {
    // Don't throw error if badge already exists
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.debug('[BadgeIssuance] Skipping duplicate badge', { contractorId });
    } else {
      logger.error('[BadgeIssuance] Error checking milestone badges', { contractorId, error });
    }
  }
}

/**
 * Issue certification badge with expiration
 */
export async function issueCertificationBadge(
  contractorId: string,
  certType: 'pet_first_aid' | 'cpr_certified' | 'grooming_expert' | 'driving_pro',
  certNumber: string,
  expiresAt: Date,
  issuedBy: string
) {
  try {
    const badgeNames: Record<string, string> = {
      pet_first_aid: 'Pet First Aid Certified',
      cpr_certified: 'CPR Certified Professional',
      grooming_expert: 'Certified Grooming Expert',
      driving_pro: 'Professional Driver Certified',
    };

    const badgeDescriptions: Record<string, string> = {
      pet_first_aid: 'Certified in Pet First Aid & Emergency Care',
      cpr_certified: 'Certified in CPR and Life-Saving Techniques',
      grooming_expert: 'Certified Professional Pet Groomer',
      driving_pro: 'Professional Driver with Clean Record',
    };

    return await issueBadge({
      contractorId,
      badgeType: 'certification',
      badgeCategory: certType,
      badgeName: badgeNames[certType],
      description: badgeDescriptions[certType],
      iconUrl: `/badges/${certType}.png`,
      expiresAt,
      metadata: {
        certificationNumber: certNumber,
        verifiedBy: issuedBy,
      },
      issuedBy,
    });
  } catch (error) {
    logger.error('[BadgeIssuance] Error issuing certification badge', { error });
    throw error;
  }
}

/**
 * Revoke a badge (e.g., due to violations or expiration)
 */
export async function revokeBadge(badgeId: string, reason: string): Promise<void> {
  try {
    await db
      .update(contractorBadges)
      .set({
        isActive: false,
        metadata: { revokedReason: reason, revokedAt: new Date().toISOString() },
      })
      .where(eq(contractorBadges.badgeId, badgeId));

    logger.info('[BadgeIssuance] Badge revoked', { badgeId, reason });
  } catch (error) {
    logger.error('[BadgeIssuance] Error revoking badge', { badgeId, error });
    throw error;
  }
}

/**
 * Check and deactivate expired certification badges
 */
export async function deactivateExpiredCertifications(): Promise<void> {
  try {
    const now = new Date();

    // Find all expired certification badges
    const expiredBadges = await db
      .select()
      .from(contractorBadges)
      .where(
        and(
          eq(contractorBadges.badgeType, 'certification'),
          eq(contractorBadges.isActive, true)
        )
      );

    let deactivatedCount = 0;
    for (const badge of expiredBadges) {
      if (badge.expiresAt && new Date(badge.expiresAt) < now) {
        await revokeBadge(badge.badgeId, 'Certification expired');
        deactivatedCount++;

        // TODO: Send renewal reminder to contractor
      }
    }

    logger.info('[BadgeIssuance] Expired certifications deactivated', {
      count: deactivatedCount,
    });
  } catch (error) {
    logger.error('[BadgeIssuance] Error deactivating expired certifications', { error });
    throw error;
  }
}

/**
 * Get all active badges for a contractor
 */
export async function getContractorBadges(contractorId: string) {
  try {
    const badges = await db
      .select()
      .from(contractorBadges)
      .where(
        and(
          eq(contractorBadges.contractorId, contractorId),
          eq(contractorBadges.isActive, true)
        )
      );

    return badges;
  } catch (error) {
    logger.error('[BadgeIssuance] Error fetching contractor badges', { contractorId, error });
    throw error;
  }
}

/**
 * Award background check badges after successful verification
 */
export async function awardBackgroundCheckBadges(contractorId: string): Promise<void> {
  try {
    const [contractor] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.userId, contractorId))
      .limit(1);

    if (!contractor) {
      throw new Error(`Contractor ${contractorId} not found`);
    }

    // Award verified identity badge
    if (contractor.identityVerified) {
      await issueBadge({
        contractorId,
        badgeType: 'certification',
        badgeCategory: 'verified_identity',
        badgeName: 'Verified Identity',
        description: 'Identity verified by PetWash™ security team',
        iconUrl: '/badges/verified-identity.png',
      });
    }

    // Award background cleared badge
    if (contractor.backgroundCheckStatus === 'cleared') {
      await issueBadge({
        contractorId,
        badgeType: 'certification',
        badgeCategory: 'background_cleared',
        badgeName: 'Background Check Cleared',
        description: 'Passed comprehensive background check with 10-year history',
        iconUrl: '/badges/background-cleared.png',
        metadata: {
          clearanceDate: contractor.backgroundCheckCompletedAt,
          verifiedBy: 'PetWash™ Security Team',
        },
      });
    }

    logger.info('[BadgeIssuance] Background check badges awarded', { contractorId });
  } catch (error) {
    logger.error('[BadgeIssuance] Error awarding background check badges', {
      contractorId,
      error,
    });
    throw error;
  }
}
