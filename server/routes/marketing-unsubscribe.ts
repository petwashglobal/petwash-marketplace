/**
 * Marketing-Unsubscribe Endpoint — CAN-SPAM / DMA-13 compliance.
 *
 * Every marketing email now carries a one-click unsubscribe link built by
 * `buildUnsubscribeUrl(uid)` (server/lib/unsubToken.ts). The link lands on
 * the client `/unsubscribe` page which auto-POSTs the token here. This
 * handler validates the HMAC-signed token, resolves it to a Firebase UID,
 * and clears `users.marketing_consent` in Postgres.
 *
 * Deliberately does NOT require Firebase auth — the token IS the
 * credential (regulators mandate the click work even for a signed-out
 * user). Token binding to uid + expiry + purpose makes replay against
 * anyone else impossible.
 *
 * Also intentionally responds 200 with `{ ok: true }` when the token is
 * VALID but the user's `marketing_consent` was already false — so an
 * accidental double-click never surfaces a confusing "already
 * unsubscribed / no such user" error to a real person.
 */

import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { verifyUnsubToken } from '../lib/unsubToken';
import { logger } from '../lib/logger';

const router = Router();

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token } = (req.body ?? {}) as { token?: string };
    const uid = verifyUnsubToken(token);
    if (!uid) {
      // Also don't log the raw token — it is a bearer-ish credential.
      logger.warn('[Marketing] Unsubscribe rejected — invalid or expired token');
      return res.status(401).json({ error: 'invalid_token' });
    }

    // Clear both marketing_consent flags PetWash tracks. Two exist because
    // the schema evolved; keeping them in sync avoids the "unsubscribed
    // but campaigns keep coming" bug.
    const result = await db
      .update(users)
      .set({ marketingConsent: false })
      .where(eq(users.id, uid))
      .returning({ id: users.id });

    if (result.length === 0) {
      // Token was valid (signed by us) but no matching row — user was
      // deleted after the email was sent. Still return ok so the customer
      // sees a friendly page instead of "user not found".
      logger.warn('[Marketing] Unsubscribe: valid token but user row missing', { uid });
      return res.json({ ok: true, alreadyOff: true });
    }

    logger.info('[Marketing] Unsubscribe recorded', { uid });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Marketing] Unsubscribe handler failed', { error: err?.message });
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
