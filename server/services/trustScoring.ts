import { db } from '../db';
import { 
  providerApplications, 
  contractorViolations,
  contractorReviews,
  contractorTrustScores
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * AI Trust Scoring Engine (2026 Spec)
 * 
 * Calculates dual trust scores for contractors:
 * - Public Score (4.0-5.0): Shown to customers
 * - Internal Risk Score (0-100): Used for admin decisions
 * 
 * Factors:
 * 1. Vetting Status (30%): Background checks, certifications, insurance
 * 2. Review Ratings (40%): Average star rating from two-sided reviews
 * 3. Violations (30%): Incident history and severity
 */

interface TrustScoreFactors {
  vettingScore: number; // 0-100
  reviewScore: number; // 0-100
  violationScore: number; // 0-100
  publicScore: number; // 4.0-5.0
  internalRiskScore: number; // 0-100
  breakdown: {
    vetting: {
      criminalCheck: boolean;
      biometricVerified: boolean;
      certificationsValid: boolean;
      insuranceValid: boolean;
    };
    reviews: {
      averageRating: number;
      totalReviews: number;
      flaggedReviews: number;
    };
    violations: {
      totalViolations: number;
      criticalViolations: number;
      severeViolations: number;
      moderateViolations: number;
      minorViolations: number;
    };
  };
}

/**
 * Calculate vetting score based on background checks and certifications
 */
async function calculateVettingScore(contractorId: string): Promise<{
  score: number;
  breakdown: TrustScoreFactors['breakdown']['vetting'];
}> {
  try {
    // Get provider application
    const [application] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.userId, contractorId))
      .limit(1);

    if (!application) {
      return {
        score: 0,
        breakdown: {
          criminalCheck: false,
          biometricVerified: false,
          certificationsValid: false,
          insuranceValid: false,
        },
      };
    }

    let score = 0;
    const breakdown = {
      criminalCheck: false,
      biometricVerified: false,
      certificationsValid: false,
      insuranceValid: false,
    };

    // Criminal background check (25 points)
    if (application.criminalCheckStatus === 'passed') {
      score += 25;
      breakdown.criminalCheck = true;
    }

    // Biometric verification (25 points)
    if (application.biometricStatus === 'verified') {
      score += 25;
      breakdown.biometricVerified = true;
    }

    // Role-specific certifications (25 points)
    const now = new Date();
    if (application.providerType === 'sitter' || application.providerType === 'walker') {
      // Pet First Aid certification
      if (
        application.petFirstAidCertUrl &&
        application.petFirstAidExpiresAt &&
        new Date(application.petFirstAidExpiresAt) > now
      ) {
        score += 25;
        breakdown.certificationsValid = true;
      }
    } else if (application.providerType === 'driver') {
      // Driving record check
      if (
        application.drivingRecordStatus === 'clean' &&
        application.drivingRecordCheckedAt
      ) {
        score += 25;
        breakdown.certificationsValid = true;
      }
    }

    // Insurance policy (25 points)
    if (
      application.insuranceCertUrl &&
      application.insuranceExpiresAt &&
      new Date(application.insuranceExpiresAt) > now
    ) {
      score += 25;
      breakdown.insuranceValid = true;
    }

    return { score, breakdown };
  } catch (error) {
    logger.error('[TrustScoring] Error calculating vetting score', { contractorId, error });
    return {
      score: 0,
      breakdown: {
        criminalCheck: false,
        biometricVerified: false,
        certificationsValid: false,
        insuranceValid: false,
      },
    };
  }
}

/**
 * Calculate review score based on two-sided review ratings
 */
async function calculateReviewScore(contractorId: string): Promise<{
  score: number;
  breakdown: TrustScoreFactors['breakdown']['reviews'];
}> {
  try {
    // Get all reviews WHERE contractor is the reviewee (received reviews)
    const reviews = await db
      .select()
      .from(contractorReviews)
      .where(eq(contractorReviews.revieweeId, contractorId));

    if (reviews.length === 0) {
      return {
        score: 85, // Default score for new contractors (benefit of the doubt)
        breakdown: {
          averageRating: 0,
          totalReviews: 0,
          flaggedReviews: 0,
        },
      };
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.overallRating, 0);
    const averageRating = totalRating / reviews.length;

    // Count flagged reviews
    const flaggedReviews = reviews.filter(
      (review) => review.isFlagged && !review.adminReviewed
    ).length;

    // Convert 1-5 star rating to 0-100 score
    // 5 stars = 100, 4 stars = 80, 3 stars = 60, etc.
    let score = (averageRating / 5) * 100;

    // Penalize for flagged reviews (each flagged review reduces score by 5 points)
    score -= flaggedReviews * 5;

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      breakdown: {
        averageRating,
        totalReviews: reviews.length,
        flaggedReviews,
      },
    };
  } catch (error) {
    logger.error('[TrustScoring] Error calculating review score', { contractorId, error });
    return {
      score: 85,
      breakdown: {
        averageRating: 0,
        totalReviews: 0,
        flaggedReviews: 0,
      },
    };
  }
}

/**
 * Calculate violation score based on incident history
 */
async function calculateViolationScore(contractorId: string): Promise<{
  score: number;
  breakdown: TrustScoreFactors['breakdown']['violations'];
}> {
  try {
    // Get all violations for contractor
    const violations = await db
      .select()
      .from(contractorViolations)
      .where(
        and(
          eq(contractorViolations.contractorId, contractorId),
          eq(contractorViolations.status, 'confirmed') // Only count confirmed violations
        )
      );

    if (violations.length === 0) {
      return {
        score: 100, // Perfect score with no violations
        breakdown: {
          totalViolations: 0,
          criticalViolations: 0,
          severeViolations: 0,
          moderateViolations: 0,
          minorViolations: 0,
        },
      };
    }

    // Count violations by severity
    const criticalViolations = violations.filter((v) => v.severity === 'critical').length;
    const severeViolations = violations.filter((v) => v.severity === 'severe').length;
    const moderateViolations = violations.filter((v) => v.severity === 'moderate').length;
    const minorViolations = violations.filter((v) => v.severity === 'minor').length;

    // Calculate penalty (weighted by severity)
    let score = 100;
    score -= criticalViolations * 40; // Critical: -40 points each
    score -= severeViolations * 20; // Severe: -20 points each
    score -= moderateViolations * 10; // Moderate: -10 points each
    score -= minorViolations * 3; // Minor: -3 points each

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      breakdown: {
        totalViolations: violations.length,
        criticalViolations,
        severeViolations,
        moderateViolations,
        minorViolations,
      },
    };
  } catch (error) {
    logger.error('[TrustScoring] Error calculating violation score', { contractorId, error });
    return {
      score: 100,
      breakdown: {
        totalViolations: 0,
        criticalViolations: 0,
        severeViolations: 0,
        moderateViolations: 0,
        minorViolations: 0,
      },
    };
  }
}

/**
 * Calculate comprehensive trust scores for a contractor
 */
export async function calculateTrustScores(
  contractorId: string
): Promise<TrustScoreFactors> {
  try {
    logger.info('[TrustScoring] Calculating trust scores', { contractorId });

    // Calculate component scores in parallel
    const [vetting, reviews, violations] = await Promise.all([
      calculateVettingScore(contractorId),
      calculateReviewScore(contractorId),
      calculateViolationScore(contractorId),
    ]);

    // Calculate weighted internal risk score (0-100)
    // Vetting: 30%, Reviews: 40%, Violations: 30%
    const internalRiskScore =
      vetting.score * 0.3 + reviews.score * 0.4 + violations.score * 0.3;

    // Convert internal risk score to public score (4.0-5.0)
    // 100 = 5.0, 80 = 4.8, 60 = 4.6, 40 = 4.4, 20 = 4.2, 0 = 4.0
    const publicScore = 4.0 + (internalRiskScore / 100) * 1.0;

    const result: TrustScoreFactors = {
      vettingScore: vetting.score,
      reviewScore: reviews.score,
      violationScore: violations.score,
      publicScore: Math.round(publicScore * 100) / 100, // Round to 2 decimals
      internalRiskScore: Math.round(internalRiskScore * 100) / 100,
      breakdown: {
        vetting: vetting.breakdown,
        reviews: reviews.breakdown,
        violations: violations.breakdown,
      },
    };

    logger.info('[TrustScoring] Trust scores calculated', {
      contractorId,
      publicScore: result.publicScore,
      internalRiskScore: result.internalRiskScore,
    });

    return result;
  } catch (error) {
    logger.error('[TrustScoring] Error calculating trust scores', { contractorId, error });
    throw error;
  }
}

/**
 * Update contractor trust scores in database
 */
export async function updateContractorTrustScores(contractorId: string): Promise<void> {
  try {
    const scores = await calculateTrustScores(contractorId);

    // Update providerApplications with trust scores
    await db
      .update(providerApplications)
      .set({
        trustScorePublic: scores.publicScore.toString(),
        trustScoreInternal: scores.internalRiskScore.toString(),
        trustScoreLastUpdated: new Date(),
      })
      .where(eq(providerApplications.userId, contractorId));

    // Also store in contractorTrustScores for historical tracking
    await db.insert(contractorTrustScores).values({
      contractorId,
      publicScore: scores.publicScore.toString(),
      internalRiskScore: scores.internalRiskScore.toString(),
      vettingScore: scores.vettingScore.toString(),
      reviewScore: scores.reviewScore.toString(),
      violationScore: scores.violationScore.toString(),
      breakdown: JSON.stringify(scores.breakdown),
    });

    logger.info('[TrustScoring] Contractor trust scores updated in database', {
      contractorId,
      publicScore: scores.publicScore,
      internalRiskScore: scores.internalRiskScore,
    });
  } catch (error) {
    logger.error('[TrustScoring] Error updating contractor trust scores', {
      contractorId,
      error,
    });
    throw error;
  }
}

/**
 * Auto-update trust scores when key events happen
 */
export async function triggerTrustScoreUpdate(
  contractorId: string,
  reason: 'review_submitted' | 'violation_created' | 'certification_updated' | 'manual'
): Promise<void> {
  try {
    logger.info('[TrustScoring] Trust score update triggered', { contractorId, reason });
    await updateContractorTrustScores(contractorId);
  } catch (error) {
    logger.error('[TrustScoring] Error in trust score update trigger', {
      contractorId,
      reason,
      error,
    });
  }
}
