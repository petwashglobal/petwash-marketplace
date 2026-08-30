/**
 * /api/marketplace/journey/:kind/:id — CEO DEEP-LOGIC §84-§87.
 *
 * The dispatch endpoint for the JourneyState projection: one URL
 * that, given a kind + id, returns the actor's projection of that
 * entity through the correct resolver.
 *
 * Contract:
 *   GET /api/marketplace/journey/:kind/:id
 *
 *   200 → { journey: JourneyState }
 *   400 → invalid_kind
 *   401 → auth_required (handled upstream by validateFirebaseToken)
 *   403 → not_a_party
 *   404 → not_found
 *   501 → not_implemented (the kind has no registered loader yet;
 *         the client must not treat this as an empty answer)
 *
 * Discipline (§29, §37):
 *   • ActorUid derives from Firebase token — never the request body.
 *   • Loaders enforce ownership; the endpoint never fabricates an
 *     empty JourneyState for an unwired kind (§72 "when in doubt,
 *     block").
 *   • Response leaks no persistence internals — a stable error slug
 *     is returned for every non-200 outcome.
 */
import { Router, type Request, type Response } from 'express';
import { getDefaultJourneyStateService } from '../services/marketplace/JourneyStateService';
import { logger } from '../lib/logger';

const router = Router();

router.get('/journey/:kind/:id', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });

    const kind = String(req.params.kind ?? '').trim();
    const id = String(req.params.id ?? '').trim();
    if (!kind || !id) return res.status(400).json({ error: 'invalid_params' });

    const svc = getDefaultJourneyStateService();
    const out = await svc.resolveJourney(kind, id, uid);

    switch (out.code) {
      case 'OK':
        return res.json({ journey: out.journey });
      case 'INVALID_KIND':
        return res.status(400).json({ error: 'invalid_kind', kind: out.kind });
      case 'NOT_FOUND':
        return res.status(404).json({ error: 'not_found' });
      case 'NOT_A_PARTY':
        return res.status(403).json({ error: 'not_a_party' });
      case 'NOT_IMPLEMENTED':
        return res.status(501).json({ error: 'not_implemented', kind: out.kind });
      default:
        return res.status(500).json({ error: 'journey_unavailable' });
    }
  } catch (err: any) {
    logger.error('[MarketplaceJourney] Unhandled error', { error: err?.message });
    return res.status(500).json({ error: 'journey_unavailable' });
  }
});

export default router;
