/**
 * Legal Stamps API
 *
 * Immutable audit stamps — cryptographically signed, hash-chained, GCS + Firestore backed.
 * DELETE is permanently blocked (405). Stamps are retained for 7 years (Israeli law §17 VAT).
 *
 * Endpoints:
 *   GET  /api/legal-stamps/me                        — current user's stamps
 *   GET  /api/legal-stamps/entity/:type/:id          — stamps for a specific entity
 *   GET  /api/legal-stamps/:stampId                  — single stamp
 *   GET  /api/legal-stamps/:stampId/verify           — verify hash + signature
 *   GET  /api/legal-stamps/chain/:type/:id/verify    — verify full entity chain
 *   POST /api/legal-stamps                           — create stamp (admin/system only)
 *   DELETE /*  → 405 PERMANENTLY BLOCKED
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { legalStamps } from '@shared/schema-finance';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../adminAuth';
import { ImmutableStampService } from '../services/ImmutableStampService';
import { logger } from '../lib/logger';
import admin from '../lib/firebase-admin';

const router = Router();

// ── Block ALL delete attempts — stamps are immutable by law ─────────────────
router.delete('*', (_req, res) => {
  res.status(405).json({
    error: 'IMMUTABLE_RECORD',
    message: 'Legal stamps cannot be deleted. Retention: 7 years minimum (IL VAT Law §17).',
  });
});

// ── Auth helper ──────────────────────────────────────────────────────────────
async function verifyFirebaseUid(req: any): Promise<string | null> {
  if (req.firebaseUser?.uid) return req.firebaseUser.uid;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token, true);
      return decoded.uid;
    } catch {
      return null;
    }
  }
  return null;
}

// ── GET /api/legal-stamps/me ─────────────────────────────────────────────────
router.get('/me', async (req: any, res) => {
  try {
    const uid = await verifyFirebaseUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const stamps = await ImmutableStampService.getStampsForActor(uid, 50);
    res.json({ success: true, stamps, count: stamps.length });
  } catch (err) {
    logger.error('[LegalStamps] GET /me error', err);
    res.status(500).json({ error: 'Failed to fetch stamps' });
  }
});

// ── GET /api/legal-stamps/entity/:type/:id ───────────────────────────────────
router.get('/entity/:entityType/:entityId', async (req: any, res) => {
  try {
    const uid = await verifyFirebaseUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const { entityType, entityId } = req.params;
    const stamps = await ImmutableStampService.getStampsForEntity(entityType, entityId);
    res.json({ success: true, stamps, count: stamps.length });
  } catch (err) {
    logger.error('[LegalStamps] GET /entity error', err);
    res.status(500).json({ error: 'Failed to fetch entity stamps' });
  }
});

// ── GET /api/legal-stamps/chain/:type/:id/verify ─────────────────────────────
router.get('/chain/:entityType/:entityId/verify', requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await ImmutableStampService.verifyChain(entityType, entityId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[LegalStamps] GET /chain verify error', err);
    res.status(500).json({ error: 'Chain verification failed' });
  }
});

// ── GET /api/legal-stamps/:stampId/verify ───────────────────────────────────
router.get('/:stampId/verify', async (req: any, res) => {
  try {
    const uid = await verifyFirebaseUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const result = await ImmutableStampService.verifyStamp(req.params.stampId);
    res.json({ success: true, stampId: req.params.stampId, ...result });
  } catch (err) {
    logger.error('[LegalStamps] GET /:id/verify error', err);
    res.status(500).json({ error: 'Stamp verification failed' });
  }
});

// ── GET /api/legal-stamps/:stampId ──────────────────────────────────────────
router.get('/:stampId', async (req: any, res) => {
  try {
    const uid = await verifyFirebaseUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const [stamp] = await db
      .select()
      .from(legalStamps)
      .where(eq(legalStamps.stampId, req.params.stampId))
      .limit(1);

    if (!stamp) return res.status(404).json({ error: 'Stamp not found' });
    res.json({ success: true, stamp });
  } catch (err) {
    logger.error('[LegalStamps] GET /:id error', err);
    res.status(500).json({ error: 'Failed to fetch stamp' });
  }
});

// ── POST /api/legal-stamps (admin/system only) ───────────────────────────────
const createStampSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  eventType: z.string().min(1),
  actorUid: z.string().optional(),
  actorRole: z.enum(['user', 'provider', 'admin', 'system']).optional(),
  amountCents: z.number().int().optional(),
  currency: z.string().default('ILS'),
  metadata: z.record(z.unknown()).optional(),
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const parsed = createStampSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const result = await ImmutableStampService.createStamp(parsed.data as any);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    logger.error('[LegalStamps] POST error', err);
    res.status(500).json({ error: 'Failed to create stamp' });
  }
});

export default router;
