/**
 * /api/journey — CEO MASTER 2026-08-28 §7 §9 §10 §11 §12 §13 §34.
 *
 * The wizard-facing write path for Journey Brain Phase 2 (checkpoints)
 * and Phase 3 (saved searches, favourite providers). READ endpoints
 * mirror the composer projections but let the wizard fetch the row
 * it just wrote without going through the aggregated attention feed.
 *
 * Every path is Firebase-authed. userUid is ALWAYS derived from the
 * verified token — never from the body — so a hostile client cannot
 * forge a checkpoint or star under another user (CEO §22 discipline).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import {
  saveCheckpoint,
  getActiveCheckpoint,
  listActiveCheckpoints,
  clearCheckpoint,
} from '../services/journeyCheckpoints';
import {
  saveSearch,
  getActiveSavedSearch,
  listActiveSavedSearches,
  clearSavedSearch,
} from '../services/savedSearches';
import {
  addFavouriteProvider,
  removeFavouriteProvider,
  listFavouriteProviders,
  isFavouriteProvider,
} from '../services/favouriteProviders';

const router = Router();

function callerUid(req: Request): string | null {
  return (req as any).firebaseUser?.uid || (req as any).user?.uid || null;
}

// ─── Checkpoints (Phase 2) ────────────────────────────────────────────

const CheckpointBodySchema = z.object({
  domain: z.string().min(1).max(64),
  entityRef: z.string().max(200).optional().nullable(),
  state: z.string().min(1).max(64),
  lastSafeStep: z.string().min(1).max(64),
  snapshot: z.record(z.unknown()).optional(),
  ttlMs: z.number().int().positive().max(30 * 24 * 60 * 60 * 1000).optional(),
});

router.post('/checkpoints', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const parsed = CheckpointBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', errorCode: 'JOURNEY_BODY_INVALID' });
  }
  try {
    const row = await saveCheckpoint({
      userUid: uid,
      domain: parsed.data.domain,
      entityRef: parsed.data.entityRef ?? null,
      state: parsed.data.state,
      lastSafeStep: parsed.data.lastSafeStep,
      snapshot: parsed.data.snapshot ?? {},
      ttlMs: parsed.data.ttlMs,
    });
    return res.json({ ok: true, checkpoint: row });
  } catch (err: any) {
    logger.error('[Journey] checkpoint save error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'checkpoint_save_failed', errorCode: 'CHECKPOINT_SAVE_FAILED' });
  }
});

router.get('/checkpoints', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
    if (domain) {
      const row = await getActiveCheckpoint(uid, domain);
      return res.json({ ok: true, checkpoint: row });
    }
    const rows = await listActiveCheckpoints(uid);
    return res.json({ ok: true, checkpoints: rows });
  } catch (err: any) {
    logger.error('[Journey] checkpoint read error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'checkpoint_read_failed' });
  }
});

router.delete('/checkpoints/:domain', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const domain = String(req.params.domain ?? '').slice(0, 64);
  if (!domain) return res.status(400).json({ ok: false, error: 'domain_required' });
  try {
    await clearCheckpoint(uid, domain);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Journey] checkpoint clear error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'checkpoint_clear_failed' });
  }
});

// ─── Saved searches (Phase 3) ─────────────────────────────────────────

const SearchBodySchema = z.object({
  domain: z.string().min(1).max(64),
  filters: z.record(z.unknown()),
  label: z.string().max(200).optional(),
  ttlMs: z.number().int().positive().max(180 * 24 * 60 * 60 * 1000).optional(),
});

router.post('/searches', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const parsed = SearchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', errorCode: 'SEARCH_BODY_INVALID' });
  }
  try {
    const row = await saveSearch({
      userUid: uid,
      domain: parsed.data.domain,
      filters: parsed.data.filters,
      label: parsed.data.label,
      ttlMs: parsed.data.ttlMs,
    });
    return res.json({ ok: true, search: row });
  } catch (err: any) {
    logger.error('[Journey] search save error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'search_save_failed' });
  }
});

router.get('/searches', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
    if (domain) {
      const row = await getActiveSavedSearch(uid, domain);
      return res.json({ ok: true, search: row });
    }
    const rows = await listActiveSavedSearches(uid);
    return res.json({ ok: true, searches: rows });
  } catch (err: any) {
    logger.error('[Journey] search read error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'search_read_failed' });
  }
});

router.delete('/searches/:domain', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const domain = String(req.params.domain ?? '').slice(0, 64);
  if (!domain) return res.status(400).json({ ok: false, error: 'domain_required' });
  try {
    await clearSavedSearch(uid, domain);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Journey] search clear error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'search_clear_failed' });
  }
});

// ─── Favourite providers (Phase 3) ────────────────────────────────────

const FavouriteBodySchema = z.object({
  providerId: z.string().min(1).max(200),
  domain: z.string().min(1).max(64),
});

router.post('/favourites', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const parsed = FavouriteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', errorCode: 'FAVOURITE_BODY_INVALID' });
  }
  try {
    const row = await addFavouriteProvider({
      userUid: uid,
      providerId: parsed.data.providerId,
      domain: parsed.data.domain,
    });
    return res.json({ ok: true, favourite: row });
  } catch (err: any) {
    logger.error('[Journey] favourite add error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'favourite_add_failed' });
  }
});

router.delete('/favourites', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const parsed = FavouriteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', errorCode: 'FAVOURITE_BODY_INVALID' });
  }
  try {
    await removeFavouriteProvider({
      userUid: uid,
      providerId: parsed.data.providerId,
      domain: parsed.data.domain,
    });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Journey] favourite remove error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'favourite_remove_failed' });
  }
});

router.get('/favourites', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
    const rows = await listFavouriteProviders(uid, domain);
    return res.json({ ok: true, favourites: rows });
  } catch (err: any) {
    logger.error('[Journey] favourite list error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'favourite_list_failed' });
  }
});

router.get('/favourites/:domain/:providerId', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  const providerId = String(req.params.providerId ?? '').slice(0, 200);
  const domain = String(req.params.domain ?? '').slice(0, 64);
  if (!providerId || !domain) {
    return res.status(400).json({ ok: false, error: 'missing_params' });
  }
  try {
    const starred = await isFavouriteProvider(uid, providerId, domain);
    return res.json({ ok: true, starred });
  } catch (err: any) {
    logger.error('[Journey] favourite check error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'favourite_check_failed' });
  }
});

export default router;
