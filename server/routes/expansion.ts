/**
 * Phase 12.20 — Expansion Decision & Board Pack
 * Routes under /api/expansion
 *
 * All economics come from the Phase 12.19 unit-economics engine.
 * No financial calculations happen here — only orchestration.
 */

import { Router, Request, Response } from 'express';
import { computeStationEconomics, aggregateNetworkEconomics, ownershipComparison } from '../lib/unit-economics';
import { buildExpansionDecisionPack, toStationRow, toNetworkRow, toOwnershipRow } from '../lib/expansion-decision';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/expansion/board-pack
// Full board pack: KPIs + station scores + network grades + ownership decision + flags
// ---------------------------------------------------------------------------
router.get('/board-pack', async (req: Request, res: Response) => {
  try {
    // 1. Pull raw economics from 12.19 engine — single pass
    const stationEconomics = await computeStationEconomics();
    const networkEconomics = aggregateNetworkEconomics(stationEconomics);
    const ownershipBlocks = ownershipComparison(stationEconomics);

    // 2. Adapt to normalised input rows (cents → ILS, string risk → numeric)
    const stationRows = stationEconomics.map(toStationRow);
    const networkRows = networkEconomics.map(toNetworkRow);
    const ownershipRows = [ownershipBlocks.company_owned, ownershipBlocks.franchise_owned].map(toOwnershipRow);

    // 3. Build the decision pack
    const pack = buildExpansionDecisionPack({ stationRows, networkRows, ownershipRows });

    return res.json(pack);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/station-ranking
// Investment priority ranking — sorted by expansion readiness score
// ---------------------------------------------------------------------------
router.get('/station-ranking', async (req: Request, res: Response) => {
  try {
    const stationEconomics = await computeStationEconomics();
    const networkEconomics = aggregateNetworkEconomics(stationEconomics);
    const ownershipBlocks = ownershipComparison(stationEconomics);

    const stationRows = stationEconomics.map(toStationRow);
    const networkRows = networkEconomics.map(toNetworkRow);
    const ownershipRows = [ownershipBlocks.company_owned, ownershipBlocks.franchise_owned].map(toOwnershipRow);

    const pack = buildExpansionDecisionPack({ stationRows, networkRows, ownershipRows });

    const ranked = [...pack.stations].sort(
      (a, b) => b.scores.expansionReadinessScore - a.scores.expansionReadinessScore
    );

    return res.json({ stations: ranked });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/board-flags
// Red-flag entities requiring board or treasury intervention — standalone endpoint
// ---------------------------------------------------------------------------
router.get('/board-flags', async (req: Request, res: Response) => {
  try {
    const stationEconomics = await computeStationEconomics();
    const networkEconomics = aggregateNetworkEconomics(stationEconomics);
    const ownershipBlocks = ownershipComparison(stationEconomics);

    const stationRows = stationEconomics.map(toStationRow);
    const networkRows = networkEconomics.map(toNetworkRow);
    const ownershipRows = [ownershipBlocks.company_owned, ownershipBlocks.franchise_owned].map(toOwnershipRow);

    const pack = buildExpansionDecisionPack({ stationRows, networkRows, ownershipRows });

    return res.json({ flags: pack.boardFlags, count: pack.boardFlags.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
