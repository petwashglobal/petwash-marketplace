/**
 * Phase 12.21 — Intervention & Decision Tracking
 * Phase 12.22 — Outcome Measurement & Effectiveness
 * Routes under /api/expansion/interventions and /api/expansion/outcomes
 *
 * Board flags from 12.20 become accountable cases here.
 * Phase 12.22 adds before/after measurement: snapshot at creation, current state now.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { interventionCases } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { computeStationEconomics, aggregateNetworkEconomics, ownershipComparison } from '../lib/unit-economics';
import { buildExpansionDecisionPack, toStationRow, toNetworkRow, toOwnershipRow } from '../lib/expansion-decision';
import { computeOutcomeSummary, buildEconomicSnapshot, buildCurrentEconomicsMap } from '../lib/outcome-measurement';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/expansion/interventions
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query as Record<string, string>;

    const rows = status
      ? await db.select().from(interventionCases)
          .where(eq(interventionCases.status, status))
          .orderBy(desc(interventionCases.createdAt))
      : await db.select().from(interventionCases)
          .orderBy(desc(interventionCases.createdAt));

    const open       = rows.filter(r => r.status === 'open').length;
    const inProgress = rows.filter(r => r.status === 'in_progress').length;
    const resolved   = rows.filter(r => r.status === 'resolved').length;
    const escalated  = rows.filter(r => r.status === 'escalated').length;

    return res.json({ cases: rows, counts: { open, inProgress, resolved, escalated, total: rows.length } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/interventions — create case manually
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    const createdBy = user?.email ?? user?.uid ?? 'admin';

    const { entityType, entityId, entityName, triggerSignal, triggerFlag, decision, notes } = req.body;

    if (!entityType || !entityId || !entityName) {
      return res.status(400).json({ error: 'entityType, entityId, and entityName are required' });
    }

    const VALID_ENTITY_TYPES = ['station', 'network', 'franchise'];
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}` });
    }

    // Capture economic snapshot at creation time (station entities only)
    let snapshot: any = {};
    if (entityType === 'station') {
      const currentMap = await buildCurrentEconomicsMap();
      snapshot = buildEconomicSnapshot(String(entityId), currentMap);
    }

    // Allow caller to supply snapshot fields explicitly (required for non-station entities)
    const bodySnapshot: any = {};
    if (req.body.snapshot_margin_pct !== undefined)   bodySnapshot.snapshotMarginPct   = req.body.snapshot_margin_pct;
    if (req.body.snapshot_friction_pct !== undefined) bodySnapshot.snapshotFrictionPct = req.body.snapshot_friction_pct;
    if (req.body.snapshot_reserve_risk !== undefined) bodySnapshot.snapshotReserveRisk = req.body.snapshot_reserve_risk;
    if (req.body.snapshot_failure_rate !== undefined) bodySnapshot.snapshotFailureRate = req.body.snapshot_failure_rate;

    const finalSnapshot = { ...snapshot, ...bodySnapshot };

    // ENFORCE: All 4 snapshot fields must be present before a case can be created.
    // This guarantees every case has a baseline for outcome measurement.
    const missingFields: string[] = [];
    if (finalSnapshot.snapshotMarginPct   === undefined || finalSnapshot.snapshotMarginPct   === null) missingFields.push('snapshot_margin_pct');
    if (finalSnapshot.snapshotFrictionPct === undefined || finalSnapshot.snapshotFrictionPct === null) missingFields.push('snapshot_friction_pct');
    if (finalSnapshot.snapshotReserveRisk === undefined || finalSnapshot.snapshotReserveRisk === null) missingFields.push('snapshot_reserve_risk');
    if (finalSnapshot.snapshotFailureRate === undefined || finalSnapshot.snapshotFailureRate === null) missingFields.push('snapshot_failure_rate');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Intervention case blocked: economic snapshot is incomplete',
        missing: missingFields,
        hint: entityType === 'station'
          ? 'Station snapshot could not be built — ensure the station exists in the economics map. Alternatively, supply snapshot fields explicitly in the request body.'
          : 'Non-station entities must supply all snapshot fields in the request body: snapshot_margin_pct, snapshot_friction_pct, snapshot_reserve_risk, snapshot_failure_rate',
      });
    }

    const [newCase] = await db.insert(interventionCases).values({
      entityType, entityId: String(entityId), entityName,
      triggerSignal: triggerSignal ?? null,
      triggerFlag: triggerFlag ?? null,
      decision: decision ?? null,
      status: 'open',
      notes: notes ?? null,
      createdBy,
      ...finalSnapshot,
    }).returning();

    return res.status(201).json({ case: newCase });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/expansion/interventions/:id — update status / decision / notes
// ---------------------------------------------------------------------------
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const { status, decision, notes } = req.body;

    const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'escalated'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const updateValues: any = { updatedAt: new Date() };
    if (status) {
      updateValues.status = status;
      if (status === 'resolved') updateValues.resolvedAt = new Date();
    }
    if (decision !== undefined) updateValues.decision = decision;
    if (notes !== undefined) updateValues.notes = notes;

    const [updated] = await db.update(interventionCases)
      .set(updateValues)
      .where(eq(interventionCases.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Case not found' });
    return res.json({ case: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/interventions/auto-generate
// Idempotent — converts current board flags to cases, skipping duplicates.
// Now captures economic snapshot at creation time for Phase 12.22 measurement.
// ---------------------------------------------------------------------------
router.post('/auto-generate', async (req: Request, res: Response) => {
  try {
    // Pull current board state and current economics simultaneously
    const stationEconomics = await computeStationEconomics();
    const networkEconomics = aggregateNetworkEconomics(stationEconomics);
    const ownershipBlocks  = ownershipComparison(stationEconomics);

    const stationRows  = stationEconomics.map(toStationRow);
    const networkRows  = networkEconomics.map(toNetworkRow);
    const ownershipRows = [ownershipBlocks.company_owned, ownershipBlocks.franchise_owned].map(toOwnershipRow);

    const pack = buildExpansionDecisionPack({ stationRows, networkRows, ownershipRows });

    // Build current economics map for snapshot capture
    const currentMap = new Map(stationEconomics.map(s => [String(s.stationId), s]));

    // Fetch existing open cases to avoid creating duplicates
    const existingOpen = await db.select().from(interventionCases)
      .where(eq(interventionCases.status, 'open'));

    const existingKeys = new Set(existingOpen.map(c => `${c.entityType}:${c.entityId}:${c.triggerFlag}`));

    const toCreate: (typeof interventionCases.$inferInsert)[] = [];
    for (const flag of pack.boardFlags) {
      const key = `${flag.entityType}:${String(flag.entityId)}:${flag.flagType}`;
      if (existingKeys.has(key)) continue;

      const matchingStation = flag.entityType === 'station'
        ? pack.stations.find(s => s.stationId === flag.entityId)
        : null;

      // Capture snapshot for station entities
      const snapshot = flag.entityType === 'station'
        ? buildEconomicSnapshot(String(flag.entityId), currentMap)
        : {};

      // Enforce: only push cases with complete economic snapshots
      const snapshotComplete =
        snapshot.snapshotMarginPct   !== undefined && snapshot.snapshotMarginPct   !== null &&
        snapshot.snapshotFrictionPct !== undefined && snapshot.snapshotFrictionPct !== null &&
        snapshot.snapshotReserveRisk !== undefined && snapshot.snapshotReserveRisk !== null &&
        snapshot.snapshotFailureRate !== undefined && snapshot.snapshotFailureRate !== null;

      if (!snapshotComplete) continue;

      toCreate.push({
        entityType: flag.entityType,
        entityId: String(flag.entityId),
        entityName: flag.entityName,
        triggerSignal: matchingStation?.recommendation ?? null,
        triggerFlag: flag.flagType,
        status: flag.severity === 'critical' ? 'escalated' : 'open',
        notes: flag.explanation,
        createdBy: 'system:auto-generate',
        ...snapshot,
      });
    }

    let created: any[] = [];
    if (toCreate.length > 0) {
      created = await db.insert(interventionCases).values(toCreate).returning();
    }

    const skippedIncompleteSnapshot = pack.boardFlags.length - existingKeys.size - toCreate.length;
    return res.json({
      generated: created.length,
      skippedDuplicates: pack.boardFlags.length - toCreate.length - Math.max(0, skippedIncompleteSnapshot),
      skippedIncompleteSnapshot: Math.max(0, skippedIncompleteSnapshot),
      cases: created,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Phase 12.22 — GET /api/expansion/interventions/outcomes/summary
// Must be registered BEFORE /:id to avoid Express matching "outcomes" as an id
// ---------------------------------------------------------------------------
router.get('/outcomes/summary', async (req: Request, res: Response) => {
  try {
    const summary = await computeOutcomeSummary();
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/interventions/:id — single case
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await db.select().from(interventionCases).where(eq(interventionCases.id, id));
    if (!row.length) return res.status(404).json({ error: 'Case not found' });

    return res.json({ case: row[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
