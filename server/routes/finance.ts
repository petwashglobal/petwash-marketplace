/**
 * Phase 12.19 — Profitability, Unit Economics & Capital Allocation
 * Routes under /api/finance
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  computeStationEconomics,
  aggregateNetworkEconomics,
  ownershipComparison,
  computeFrictionAnalytics,
  networkKPIs,
} from '../lib/unit-economics';

const router = Router();

// ---------------------------------------------------------------------------
// P0-SEC: Per-router role guard (defense-in-depth).
// Outer mount in routes.ts now requires validateFirebaseToken, so req.firebaseUser
// is guaranteed to be set here. This guard additionally enforces that only
// admin, executive, or franchise_owner roles can see financial P&L data.
// Before: GET /profitability/stations (and all other routes) were publicly readable.
// After:  Requires authenticated Firebase token + privileged role.
// ---------------------------------------------------------------------------
const FINANCE_ALLOWED_ROLES = new Set(['admin', 'executive', 'franchise_owner']);

function requireFinanceRole(req: Request, res: Response, next: NextFunction) {
  const fbUser = (req as any).firebaseUser;
  if (!fbUser?.uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const role: string = fbUser?.claims?.role ?? fbUser?.role ?? '';
  if (!FINANCE_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({
      error: 'Insufficient role — requires admin, executive, or franchise_owner',
      userRole: role,
    });
  }
  next();
}

// Apply to all routes in this module
router.use(requireFinanceRole);

// Shared computation (all endpoints use the same station economics base)
// Cached per request cycle — computed once, used by multiple endpoints
async function getStationEconomics() {
  return computeStationEconomics();
}

// ---------------------------------------------------------------------------
// T192 — Station profitability
// GET /api/finance/profitability/stations
// ---------------------------------------------------------------------------
router.get('/profitability/stations', async (req: Request, res: Response) => {
  try {
    const { sort = 'contribution' } = req.query as Record<string, string>;
    const stations = await getStationEconomics();

    const sorted = [...stations].sort((a, b) => {
      switch (sort) {
        case 'margin':        return b.contributionMarginPct - a.contributionMarginPct;
        case 'friction':      return b.frictionCostCents - a.frictionCostCents;
        case 'reserve':       return b.heldAmountCents - a.heldAmountCents;
        case 'contribution':
        default:              return b.netReleasableContributionCents - a.netReleasableContributionCents;
      }
    });

    return res.json({ stations: sorted, count: sorted.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T193 — Network profitability (by franchise / company network)
// GET /api/finance/profitability/network
// ---------------------------------------------------------------------------
router.get('/profitability/network', async (req: Request, res: Response) => {
  try {
    const stations = await getStationEconomics();
    const network = aggregateNetworkEconomics(stations);
    return res.json({ network, count: network.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T194 — Capital allocation signals
// GET /api/finance/capital-signals
// ---------------------------------------------------------------------------
router.get('/capital-signals', async (req: Request, res: Response) => {
  try {
    const stations = await getStationEconomics();
    const signals = stations.map(s => ({
      entityType: 'station',
      entityId: s.stationId,
      entityName: s.stationName,
      ownershipType: s.ownershipType,
      signal: s.capitalSignal.signal,
      confidence: s.capitalSignal.confidence,
      reasonCodes: s.capitalSignal.reasonCodes,
      explanation: s.capitalSignal.explanation,
      grossRevenueCents: s.grossRevenueCents,
      contributionMarginPct: s.contributionMarginPct,
      frictionCostCents: s.frictionCostCents,
      capitalPriority: s.capitalPriority,
    }));

    // Sort: treasury_attention_required first, then by confidence desc
    const signalOrder: Record<string, number> = {
      treasury_attention_required: 0,
      freeze_expansion: 1,
      operational_fix_first: 2,
      review_franchise: 3,
      maintain: 4,
      invest_more: 5,
    };
    signals.sort((a, b) => (signalOrder[a.signal] ?? 9) - (signalOrder[b.signal] ?? 9) || b.confidence - a.confidence);

    return res.json({ signals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T195 — Ownership model comparison
// GET /api/finance/ownership-comparison
// ---------------------------------------------------------------------------
router.get('/ownership-comparison', async (req: Request, res: Response) => {
  try {
    const stations = await getStationEconomics();
    const comparison = ownershipComparison(stations);
    return res.json(comparison);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T196 — Economic friction analytics
// GET /api/finance/friction-analytics
// ---------------------------------------------------------------------------
router.get('/friction-analytics', async (req: Request, res: Response) => {
  try {
    const friction = await computeFrictionAnalytics();
    // Network totals
    const totals = friction.reduce(
      (acc, f) => ({
        disputeBlockedCents: acc.disputeBlockedCents + f.disputeBlockedCents,
        reserveHeldCents: acc.reserveHeldCents + f.reserveHeldCents,
        approvalPendingCents: acc.approvalPendingCents + f.approvalPendingCents,
        payoutFailureCents: acc.payoutFailureCents + f.payoutFailureCents,
        mismatchAffectedCents: acc.mismatchAffectedCents + f.mismatchAffectedCents,
        frictionTotalCents: acc.frictionTotalCents + f.frictionTotalCents,
      }),
      { disputeBlockedCents: 0, reserveHeldCents: 0, approvalPendingCents: 0, payoutFailureCents: 0, mismatchAffectedCents: 0, frictionTotalCents: 0 }
    );
    return res.json({ stations: friction, totals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Combined summary for dashboard KPI strip (avoids duplicate roundtrips)
// GET /api/finance/summary
// ---------------------------------------------------------------------------
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const stations = await getStationEconomics();
    const kpis = networkKPIs(stations);
    const network = aggregateNetworkEconomics(stations);
    const ownership = ownershipComparison(stations);
    return res.json({ kpis, network, ownership, stationCount: stations.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
