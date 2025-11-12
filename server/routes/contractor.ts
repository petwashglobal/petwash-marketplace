import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  providerApplications,
  contractorViolations,
  contractorBadges,
  contractorEarnings,
  contractorReviews
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { calculateTrustScores, updateContractorTrustScores } from '../services/trustScoring';

const router = Router();

// Firebase authentication middleware
async function requireAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user'
    };
    next();
  } catch (error) {
    logger.error('Auth error', error);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// Admin-only middleware
async function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    await requireAuth(req, res, () => {
      // If headers were sent by requireAuth, it already responded with 401
      if (res.headersSent) {
        return;
      }

      const user = (req as any).user;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
      }
      
      next();
    });
  } catch (error) {
    logger.error('Admin auth error', error);
    if (!res.headersSent) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
}

// =================== TRUST SCORING ===================

/**
 * GET /api/contractor/:contractorId/trust-score
 * Get trust scores for a contractor (public + internal)
 */
router.get('/:contractorId/trust-score', requireAuth, async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    // Calculate fresh trust scores
    const scores = await calculateTrustScores(contractorId);

    // If requester is admin, return full breakdown
    // If requester is the contractor themselves, return full breakdown
    // Otherwise, only return public score
    const isAdmin = req.user.role === 'admin';
    const isContractor = req.user.uid === contractorId;

    if (isAdmin || isContractor) {
      res.json({
        contractorId,
        publicScore: scores.publicScore,
        internalRiskScore: scores.internalRiskScore,
        breakdown: scores.breakdown,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      // Public view - only show public score
      res.json({
        contractorId,
        publicScore: scores.publicScore,
      });
    }

    logger.info('[Contractor] Trust score fetched', {
      contractorId,
      requesterId: req.user.uid,
      isAdmin,
    });
  } catch (error: any) {
    logger.error('[Contractor] Error fetching trust score', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/contractor/:contractorId/update-trust-score
 * Manually trigger trust score recalculation (admin only)
 */
router.post('/:contractorId/update-trust-score', requireAdmin, async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    await updateContractorTrustScores(contractorId);

    res.json({
      success: true,
      message: 'Trust scores updated successfully',
    });

    logger.info('[Contractor] Trust score manually updated', {
      contractorId,
      updatedBy: req.user.uid,
    });
  } catch (error: any) {
    logger.error('[Contractor] Error updating trust score', { error });
    res.status(500).json({ error: error.message });
  }
});

// =================== EARNINGS & PAYOUTS ===================

/**
 * GET /api/contractor/:contractorId/earnings
 * Get earnings summary for a contractor
 */
router.get('/:contractorId/earnings', requireAuth, async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    // Check authorization: contractor can only view their own earnings
    if (req.user.uid !== contractorId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get all earnings
    const earnings = await db
      .select()
      .from(contractorEarnings)
      .where(eq(contractorEarnings.contractorId, contractorId))
      .orderBy(desc(contractorEarnings.createdAt));

    // Calculate totals
    const totalEarned = earnings.reduce(
      (sum, e) => sum + parseFloat(e.baseAmount),
      0
    );
    const totalBonus = earnings.reduce(
      (sum, e) => sum + parseFloat(e.bonusAmount || '0'),
      0
    );
    const totalFees = earnings.reduce(
      (sum, e) => sum + parseFloat(e.platformFee),
      0
    );
    const totalNet = earnings.reduce(
      (sum, e) => sum + parseFloat(e.netEarnings),
      0
    );

    // Group by payout status
    const inEscrow = earnings.filter((e) => e.payoutStatus === 'in_escrow');
    const pendingPayout = earnings.filter((e) => e.payoutStatus === 'released');
    const paidOut = earnings.filter((e) => e.payoutStatus === 'paid_out');

    const escrowAmount = inEscrow.reduce(
      (sum, e) => sum + parseFloat(e.netEarnings),
      0
    );
    const pendingAmount = pendingPayout.reduce(
      (sum, e) => sum + parseFloat(e.netEarnings),
      0
    );
    const paidAmount = paidOut.reduce(
      (sum, e) => sum + parseFloat(e.netEarnings),
      0
    );

    res.json({
      contractorId,
      summary: {
        totalEarnings: totalEarned,
        totalBonus,
        totalPlatformFees: totalFees,
        totalNet,
        currency: earnings[0]?.currency || 'ILS',
      },
      byStatus: {
        inEscrow: {
          count: inEscrow.length,
          amount: escrowAmount,
        },
        pendingPayout: {
          count: pendingPayout.length,
          amount: pendingAmount,
        },
        paidOut: {
          count: paidOut.length,
          amount: paidAmount,
        },
      },
      recentEarnings: earnings.slice(0, 10), // Last 10 earnings
    });

    logger.info('[Contractor] Earnings fetched', {
      contractorId,
      totalNet,
      earningsCount: earnings.length,
    });
  } catch (error: any) {
    logger.error('[Contractor] Error fetching earnings', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/contractor/:contractorId/tax-summary
 * Get tax summary for Israeli tax reporting (admin or contractor only)
 */
router.get('/:contractorId/tax-summary', requireAuth, async (req: any, res) => {
  try {
    const { contractorId } = req.params;
    const { year } = req.query;

    // Check authorization
    if (req.user.uid !== contractorId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const taxYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Get earnings for the tax year
    const earnings = await db
      .select()
      .from(contractorEarnings)
      .where(
        and(
          eq(contractorEarnings.contractorId, contractorId),
          eq(contractorEarnings.taxYear, taxYear),
          eq(contractorEarnings.includeInTaxReport, true)
        )
      )
      .orderBy(contractorEarnings.taxQuarter);

    // Group by quarter
    const byQuarter = {
      Q1: earnings.filter((e) => e.taxQuarter === 1),
      Q2: earnings.filter((e) => e.taxQuarter === 2),
      Q3: earnings.filter((e) => e.taxQuarter === 3),
      Q4: earnings.filter((e) => e.taxQuarter === 4),
    };

    const quarterSummaries = Object.entries(byQuarter).map(([quarter, items]) => ({
      quarter,
      totalGross: items.reduce((sum, e) => sum + parseFloat(e.baseAmount), 0),
      totalNet: items.reduce((sum, e) => sum + parseFloat(e.netEarnings), 0),
      totalVAT: items.reduce((sum, e) => sum + parseFloat(e.vatAmount || '0'), 0),
      platformFees: items.reduce((sum, e) => sum + parseFloat(e.platformFee), 0),
      earningsCount: items.length,
    }));

    const yearTotal = {
      totalGross: earnings.reduce((sum, e) => sum + parseFloat(e.baseAmount), 0),
      totalNet: earnings.reduce((sum, e) => sum + parseFloat(e.netEarnings), 0),
      totalVAT: earnings.reduce((sum, e) => sum + parseFloat(e.vatAmount || '0'), 0),
      platformFees: earnings.reduce((sum, e) => sum + parseFloat(e.platformFee), 0),
      earningsCount: earnings.length,
    };

    res.json({
      contractorId,
      taxYear,
      currency: 'ILS',
      byQuarter: quarterSummaries,
      yearTotal,
    });

    logger.info('[Contractor] Tax summary fetched', {
      contractorId,
      taxYear,
      earningsCount: earnings.length,
    });
  } catch (error: any) {
    logger.error('[Contractor] Error fetching tax summary', { error });
    res.status(500).json({ error: error.message });
  }
});

// =================== VIOLATIONS ===================

/**
 * GET /api/contractor/:contractorId/violations
 * Get violation history for a contractor
 */
router.get('/:contractorId/violations', requireAuth, async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    // Check authorization: contractor can only view their own violations
    if (req.user.uid !== contractorId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const violations = await db
      .select()
      .from(contractorViolations)
      .where(eq(contractorViolations.contractorId, contractorId))
      .orderBy(desc(contractorViolations.createdAt));

    // Group by status and severity
    const byStatus = {
      under_review: violations.filter((v) => v.status === 'under_review').length,
      confirmed: violations.filter((v) => v.status === 'confirmed').length,
      dismissed: violations.filter((v) => v.status === 'dismissed').length,
    };

    const bySeverity = {
      critical: violations.filter((v) => v.severity === 'critical').length,
      severe: violations.filter((v) => v.severity === 'severe').length,
      moderate: violations.filter((v) => v.severity === 'moderate').length,
      minor: violations.filter((v) => v.severity === 'minor').length,
    };

    res.json({
      contractorId,
      violations,
      summary: {
        total: violations.length,
        byStatus,
        bySeverity,
      },
    });

    logger.info('[Contractor] Violations fetched', {
      contractorId,
      count: violations.length,
    });
  } catch (error: any) {
    logger.error('[Contractor] Error fetching violations', { error });
    res.status(500).json({ error: error.message });
  }
});

// =================== BADGES ===================

/**
 * GET /api/contractor/:contractorId/badges
 * Get digital badges for a contractor
 */
router.get('/:contractorId/badges', async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    const badges = await db
      .select()
      .from(contractorBadges)
      .where(
        and(
          eq(contractorBadges.contractorId, contractorId),
          eq(contractorBadges.isVisible, true),
          sql`${contractorBadges.revokedAt} IS NULL` // Not revoked
        )
      )
      .orderBy(desc(contractorBadges.isPrimary), desc(contractorBadges.createdAt));

    // Filter out expired certifications
    const now = new Date();
    const validBadges = badges.filter((badge) => {
      if (badge.expiresAt) {
        return new Date(badge.expiresAt) > now;
      }
      return true; // Permanent badges
    });

    res.json({
      contractorId,
      badges: validBadges,
      count: validBadges.length,
    });

    logger.info('[Contractor] Badges fetched', {
      contractorId,
      count: validBadges.length,
    });
  } catch (error: any) {
    logger.error('[Contractor] Error fetching badges', { error });
    res.status(500).json({ error: error.message });
  }
});

// =================== DASHBOARD SUMMARY ===================

/**
 * GET /api/contractor/:contractorId/dashboard
 * Get comprehensive dashboard data for contractor
 */
router.get('/:contractorId/dashboard', requireAuth, async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    // Check authorization
    if (req.user.uid !== contractorId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch all data in parallel
    const [
      trustScores,
      earningsSummary,
      recentEarnings,
      violations,
      badges,
      reviews,
    ] = await Promise.all([
      calculateTrustScores(contractorId),
      db
        .select()
        .from(contractorEarnings)
        .where(eq(contractorEarnings.contractorId, contractorId)),
      db
        .select()
        .from(contractorEarnings)
        .where(eq(contractorEarnings.contractorId, contractorId))
        .orderBy(desc(contractorEarnings.createdAt))
        .limit(5),
      db
        .select()
        .from(contractorViolations)
        .where(eq(contractorViolations.contractorId, contractorId)),
      db
        .select()
        .from(contractorBadges)
        .where(
          and(
            eq(contractorBadges.contractorId, contractorId),
            eq(contractorBadges.isVisible, true),
            sql`${contractorBadges.revokedAt} IS NULL`
          )
        )
        .limit(5),
      db
        .select()
        .from(contractorReviews)
        .where(eq(contractorReviews.revieweeId, contractorId))
        .orderBy(desc(contractorReviews.createdAt))
        .limit(5),
    ]);

    // Calculate earnings totals
    const totalNet = earningsSummary.reduce(
      (sum, e) => sum + parseFloat(e.netEarnings),
      0
    );
    const inEscrow = earningsSummary
      .filter((e) => e.payoutStatus === 'in_escrow')
      .reduce((sum, e) => sum + parseFloat(e.netEarnings), 0);
    const pendingPayout = earningsSummary
      .filter((e) => e.payoutStatus === 'released')
      .reduce((sum, e) => sum + parseFloat(e.netEarnings), 0);

    res.json({
      contractorId,
      trustScores: {
        publicScore: trustScores.publicScore,
        internalRiskScore: trustScores.internalRiskScore,
        breakdown: trustScores.breakdown,
      },
      earnings: {
        totalNet,
        inEscrow,
        pendingPayout,
        recentTransactions: recentEarnings,
      },
      violations: {
        total: violations.length,
        critical: violations.filter((v) => v.severity === 'critical').length,
        underReview: violations.filter((v) => v.status === 'under_review').length,
      },
      badges: {
        total: badges.length,
        badges: badges.slice(0, 3), // Top 3 badges
      },
      reviews: {
        total: reviews.length,
        averageRating:
          reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length || 0,
        recent: reviews,
      },
    });

    logger.info('[Contractor] Dashboard data fetched', { contractorId });
  } catch (error: any) {
    logger.error('[Contractor] Error fetching dashboard', { error });
    res.status(500).json({ error: error.message });
  }
});

export default router;
