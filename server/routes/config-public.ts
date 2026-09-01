/**
 * /api/config/public — auth-rebuild Phase 11.b (server-cohort rollout).
 *
 * A tiny, unauthenticated read of the runtime flags the CLIENT needs
 * to make an eligibility decision it cannot make on its own (i.e.
 * "am I in the returning-user door cohort?").
 *
 * ONLY the two returning-user-door flags are exposed here. If a
 * future rollout needs another public flag, add it explicitly — the
 * default posture is "no server config is visible to unauthenticated
 * callers".
 *
 * ─── WHY THIS ENDPOINT IS SAFE ─────────────────────────────────────
 *   * No PII, no user record, no per-user branching.
 *   * The two flags are UI-cosmetic — they gate WHICH sign-in door
 *     renders, not any authorisation decision. A caller who lies
 *     about their cohort gains only a different loading screen.
 *   * Cached client-side; the endpoint is called once per page load.
 *   * Never emits any other SystemConfig key, and never enumerates.
 */
import { Router, type Request, type Response } from 'express';
import { getFeatureFlag } from '../services/SystemConfig';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Fixed allowlist. If a caller wants to know a different flag, the
 * ONLY way to add it is here (and via the pin), so a subtle diff
 * cannot silently leak an internal flag.
 */
const PUBLIC_KEYS = [
  'ff.returning_user.new_door.enabled',
  'ff.returning_user.new_door.percent',
] as const;

router.get('/public', async (_req: Request, res: Response) => {
  try {
    const [enabled, percent] = await Promise.all([
      getFeatureFlag('ff.returning_user.new_door.enabled'),
      getFeatureFlag('ff.returning_user.new_door.percent'),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({
      returningUser: {
        newDoor: {
          enabled: enabled === true,
          // Percent is stored numeric but SystemConfig types it loose;
          // coerce and clamp so the client never has to defend.
          percent: Math.max(0, Math.min(100, Number(percent) || 0)),
        },
      },
    });
  } catch (err: any) {
    logger.error('[config/public] read failed', { error: err?.message });
    // Fail SAFE — legacy door is the default when config is unreachable.
    return res.json({
      returningUser: {
        newDoor: { enabled: false, percent: 0 },
      },
    });
  }
});

export { PUBLIC_KEYS };
export default router;
