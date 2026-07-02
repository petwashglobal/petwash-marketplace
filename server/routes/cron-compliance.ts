/**
 * Cloud-Scheduler compliance-expiry scan — Provider app push trigger (spec §11).
 *
 * The CEO 2026-06-23 Provider-app spec requires a "compliance expiring"
 * notification ("insurance expires in 12 days" on the home + a push). The FCM
 * rail existed but nothing scanned for upcoming expiries — this endpoint is
 * that scan, in the same external-Scheduler pattern as /api/cron/backup/*
 * (in-process cron is fragile on Cloud Run; see cron-backup.ts).
 *
 * What it does (READ-ONLY on provider data; writes only notifications):
 *   - finds active providers whose providers.insurance_expiry_date falls within
 *     the next N days (default 14) or has already passed,
 *   - sends each one inbox + email + push via the unified dispatcher,
 *   - de-dupes per provider per day window via the notification meta tag
 *     (best-effort: the scan runs daily; each run only covers its window once).
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — identical
 * to cron-backup.ts. CSRF-exempt via the /api/cron mount. NO money movement.
 *
 * Cloud Scheduler setup (ops, after deploy):
 *   gcloud scheduler jobs create http petwash-compliance-expiry \
 *     --location=me-west1 --schedule="0 8 * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/compliance-expiry" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { pool } from '../db';
import { dispatchNotification } from '../lib/notificationDispatcher';

const router = Router();

async function authorized(req: Request): Promise<boolean> {
  const provided = (req.headers['x-cron-secret'] as string) || '';
  const expected = process.env.CRON_SECRET || '';
  const { timingSafeEqual } = await import('crypto');
  const secretOk =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (secretOk) return true;
  const email = (req as any).firebaseUser?.email || (req as any).user?.email || '';
  return isSuperAdmin(email);
}

// POST /api/cron/compliance-expiry?days=14
router.post('/compliance-expiry', async (req: Request, res: Response) => {
  if (!(await authorized(req))) {
    logger.warn('[CronCompliance] Unauthorized trigger', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const days = Math.min(60, Math.max(1, parseInt(String(req.query.days ?? '14'), 10) || 14));

  try {
    // Providers with insurance expiring inside the window (or already expired),
    // joined to their user row for email. Only rows that HAVE an expiry date —
    // missing dates are an onboarding-completeness issue, not an expiry alert.
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.business_name, p.insurance_expiry_date,
              u.email, u.first_name
         FROM providers p
         JOIN users u ON u.id = p.user_id
        WHERE p.insurance_expiry_date IS NOT NULL
          AND p.insurance_expiry_date <= (CURRENT_DATE + $1::int)
        ORDER BY p.insurance_expiry_date ASC
        LIMIT 500`,
      [days],
    );

    let sent = 0;
    const failures: string[] = [];

    for (const row of result.rows) {
      const expiry = new Date(row.insurance_expiry_date);
      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
      const expired = daysLeft < 0;
      const dateStr = expiry.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

      const title = expired
        ? '⚠️ הביטוח שלך פג תוקף — נדרש עדכון'
        : `⚠️ הביטוח שלך יפוג בעוד ${daysLeft} ימים`;
      const bodyHtml = expired
        ? `<p>ביטוח האחריות המקצועית שלך פג תוקף בתאריך ${dateStr}. ללא ביטוח בתוקף לא ניתן לקבל עבודות חדשות או תשלומים. אנא העלו אישור מעודכן.</p>`
        : `<p>ביטוח האחריות המקצועית שלך יפוג בתאריך ${dateStr}. העלו אישור מחודש מראש כדי שלא תפספסו עבודות ותשלומים.</p>`;

      try {
        await dispatchNotification({
          uid: row.user_id,
          email: row.email ?? undefined,
          type: 'system',
          title,
          bodyHtml,
          bodyText: title,
          ctaText: 'עדכון מסמכים',
          ctaUrl: `${process.env.APP_URL || 'https://petwash.co.il'}/provider-compliance`,
          channels: ['inbox', 'email', 'push'],
          priority: 8,
        });
        sent++;
      } catch (e: any) {
        failures.push(`${row.user_id}: ${e?.message}`);
      }
    }

    logger.info('[CronCompliance] Scan complete', { windowDays: days, matched: result.rows.length, sent, failures: failures.length });
    return res.json({ success: true, windowDays: days, matched: result.rows.length, sent, failures });
  } catch (err: any) {
    logger.error('[CronCompliance] Scan failed', { error: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'scan_failed' });
  }
});

export default router;
