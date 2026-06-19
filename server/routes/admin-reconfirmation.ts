/**
 * admin-reconfirmation.ts — routes for the 6-MONTH PROVIDER RECONFIRMATION
 * engine (spec §17). New file; mounted with a 2-line footprint in routes.ts.
 *
 *   GET  /api/admin/reconfirmation   (admin)    — read-only due/overdue list
 *   POST /api/provider/reconfirm     (provider) — provider re-confirms (1 insert
 *                                                  + a consent record)
 *
 * Auth is enforced INSIDE the router (same defence-in-depth pattern as
 * admin-provider-review.ts) so the routes.ts mount stays a plain app.use('/api').
 * The admin list and the advisory overdue helper come from reconfirmationService;
 * this file adds NO new gate to payout/booking.
 */
import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import {
  getProvidersNeedingReconfirmation,
  recordReconfirmation,
  computeReconfirmationDue,
} from '../services/reconfirmationService';

const router = Router();

// ── Auth middlewares (mirror admin-provider-review.ts) ───────────────────────
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);

    const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes((decodedToken.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'הרשאות מנהל נדרשות' });
    }
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error) {
    logger.error('[Reconfirmation Routes] Admin auth error', error);
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'נדרשת התחברות' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error) {
    logger.error('[Reconfirmation Routes] Auth error', error);
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

// ── ADMIN: read-only due/overdue list ────────────────────────────────────────
/**
 * GET /api/admin/reconfirmation
 *   ?onlyDue=true → exclude providers that are still OK (not yet in a reminder
 *   window). Pure SELECT; nothing is written.
 */
router.get('/admin/reconfirmation', requireAdmin, async (req: any, res) => {
  try {
    const onlyDue = String(req.query.onlyDue ?? '').toLowerCase() === 'true';
    const providers = await getProvidersNeedingReconfirmation({ includeOk: !onlyDue });

    const summary = providers.reduce(
      (acc, p) => {
        acc[p.status] += 1;
        return acc;
      },
      { ok: 0, due_soon: 0, overdue: 0 } as Record<'ok' | 'due_soon' | 'overdue', number>,
    );

    res.json({
      generatedAt: new Date().toISOString(),
      intervalMonths: 6,
      count: providers.length,
      summary,
      providers,
    });
  } catch (error: any) {
    logger.error('[Reconfirmation Routes] Error listing reconfirmation status', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטוס אישור מחדש' });
  }
});

// ── PROVIDER: re-confirm ─────────────────────────────────────────────────────
const reconfirmSchema = z.object({
  // The signed-in provider re-confirms for themselves. We accept an optional
  // explicit confirmation flag the client UI sets when the provider ticks the
  // declaration box; default true to keep the contract simple.
  confirmed: z.boolean().optional().default(true),
});

/**
 * POST /api/provider/reconfirm
 * The authenticated provider re-confirms their declarations. Records a consent
 * (via the existing consent engine, best-effort) and ONE additive
 * reconfirmation_records row. Identity is taken from the verified token — a
 * provider can only re-confirm as themselves.
 */
router.post('/provider/reconfirm', requireAuth, async (req: any, res) => {
  try {
    const parsed = reconfirmSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || 'נתונים לא תקינים' });
    }
    if (!parsed.data.confirmed) {
      return res.status(400).json({ error: 'נדרש אישור מפורש', errorEn: 'Explicit confirmation required' });
    }

    const providerId: string = req.userId; // verified Firebase UID — self only

    // Best-effort consent record via the existing consent engine. If it is
    // unavailable we STILL record the reconfirmation (the legal act happened);
    // we never fail the provider's re-confirmation on a consent-write hiccup.
    let consentRecordId: string | null = null;
    try {
      const { recordConsent } = await import('../services/consentEngine');
      const record = await recordConsent({
        userId: providerId,
        consentType: 'provider_reconfirmation',
        version: '2026-06',
        locale: (req.headers['accept-language']?.toString().startsWith('en') ? 'en' : 'he'),
        method: 'in_app',
        ip: (req.ip || req.headers['x-forwarded-for'] || '').toString(),
        userAgent: (req.headers['user-agent'] || '').toString(),
        traceId: req.traceId,
      });
      consentRecordId = record?.id != null ? String(record.id) : null;
    } catch (consentErr: any) {
      logger.warn('[Reconfirmation Routes] consent record failed (continuing)', {
        providerId,
        error: consentErr?.message,
      });
    }

    const result = await recordReconfirmation(providerId, consentRecordId);

    // Compute the new due date to echo back to the UI.
    const next = computeReconfirmationDue({
      approvedAt: null,
      lastReconfirmedAt: new Date(),
    });

    res.json({
      ok: true,
      alreadyRecorded: result.alreadyRecorded ?? false,
      recordId: result.recordId ?? null,
      consentRecordId,
      nextDueAt: result.dueAt ?? next?.dueAt ?? null,
      messageHe: 'אישרת מחדש בהצלחה ✓',
      messageEn: 'Reconfirmation recorded successfully ✓',
    });
  } catch (error: any) {
    logger.error('[Reconfirmation Routes] Error recording provider reconfirmation', error);
    res.status(500).json({ error: 'שגיאה ברישום האישור מחדש' });
  }
});

export default router;
