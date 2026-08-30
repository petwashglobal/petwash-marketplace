/**
 * /api/marketplace/documents/:id — CEO NEXT-AUTO §11.
 *
 * The Document Center detail endpoint. Returns the canonical
 * receipt / invoice / refund / payout projection for the requested
 * document, or a stable error slug.
 *
 * Contract:
 *   GET /api/marketplace/documents/:id
 *
 *   200 → { document: DocumentDetail }
 *   400 → invalid_id
 *   401 → auth_required (handled upstream)
 *   403 → not_a_party
 *   404 → not_found
 *
 * Discipline (§29, §37):
 *   • ActorUid derives from the Firebase token — never the request
 *     body.
 *   • The service does the ownership check against digital_receipts;
 *     the router never fabricates a projection.
 *   • No backing state leaks into error responses.
 */
import { Router, type Request, type Response } from 'express';
import { loadDocumentDetail } from '../services/marketplace/DocumentDetailService';
import { logger } from '../lib/logger';

const router = Router();

router.get('/documents/:id', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });

    const id = String(req.params.id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const email = (req as any).firebaseUser?.email as string | undefined;
    const out = await loadDocumentDetail({ documentId: id, actorUid: uid, actorEmail: email });

    switch (out.code) {
      case 'OK':          return res.json({ document: out.document });
      case 'NOT_FOUND':   return res.status(404).json({ error: 'not_found' });
      case 'NOT_A_PARTY': return res.status(403).json({ error: 'not_a_party' });
      default:            return res.status(500).json({ error: 'document_unavailable' });
    }
  } catch (err: any) {
    logger.error('[MarketplaceDocuments] Unhandled error', { error: err?.message });
    return res.status(500).json({ error: 'document_unavailable' });
  }
});

export default router;
