/**
 * Consent Center + Notification Preferences (Phase 1, 2026-06-20)
 * ===============================================================
 * Customer-facing screens to (a) VIEW accepted consents and WITHDRAW marketing
 * consent per channel, and (b) manage notification preferences.
 *
 * REUSES existing infrastructure — no new tables:
 *  - userConsents (Postgres, append-only ledger with evidence hashes)
 *    via server/services/consentEngine (recordConsent / withdrawConsent / getConsentLedger)
 *  - notificationPreferences (Postgres, shared/schema-unified-platform) — the
 *    canonical store. Its marketing*ConsentAt timestamps are the gate the senders
 *    already honour ("MUST NOT send unless timestamp is non-null").
 *
 * STRICT GUARANTEES:
 *  - Marketing consent is SEPARATE from essential (terms/privacy) and is the
 *    ONLY thing withdrawable here. Essential consents are read-only.
 *  - Marketing withdrawal is recorded with evidence (consentEngine.withdrawConsent)
 *    AND clears the matching notificationPreferences timestamp so no further
 *    marketing is sent on that channel. Both are audit-logged.
 *  - Essential transactional channels (security / payment / booking) cannot be
 *    fully disabled — the UI omits them and the API ignores attempts to set them.
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { notificationPreferences } from '@shared/schema-unified-platform';
import { requireAuth, getUserId } from '../middleware/gates';
import { logAuditEvent } from '../middleware/auditLog';
import { getClientIP } from '../services/alerts';
import { logger } from '../lib/logger';

const router = Router();
router.use(requireAuth);

const CONSENT_VERSION = '1.0';

// Marketing channels the member can independently grant/withdraw.
const MARKETING_CHANNELS = ['email', 'sms', 'push'] as const;
type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

const CHANNEL_TO_TIMESTAMP: Record<MarketingChannel, 'marketingEmailConsentAt' | 'marketingSmsConsentAt' | 'marketingPushConsentAt'> = {
  email: 'marketingEmailConsentAt',
  sms: 'marketingSmsConsentAt',
  push: 'marketingPushConsentAt',
};

/** Lazily fetch (creating defaults if missing) the user's notification prefs row. */
async function getOrCreatePrefs(userId: string) {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (existing) return existing;

  // Default: marketing OFF (timestamps null), transactional ON. This matches the
  // schema's "consent not yet given" semantics — opt-in, never opt-out.
  const [created] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      marketing: false,
      marketingEmailConsentAt: null,
      marketingSmsConsentAt: null,
      marketingPushConsentAt: null,
    })
    .returning();
  return created;
}

// ───────────────────────────────────────────────────────────────────────────
// GET /api/consent-center  — accepted consents + current marketing state
// ───────────────────────────────────────────────────────────────────────────
router.get('/', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { getConsentLedger } = await import('../services/consentEngine');
    const ledger = await getConsentLedger(userId);
    const prefs = await getOrCreatePrefs(userId);

    // Essential consents are read-only; marketing is withdrawable per channel.
    const essential = ledger.filter((c) => ['terms', 'privacy', 'provider_terms', 'kyc', 'staff_policy'].includes(c.consentType));
    const marketingLedger = ledger.find((c) => c.consentType === 'marketing');

    res.json({
      essential,
      marketing: {
        // Per-channel current state derived from the canonical prefs timestamps.
        email: { consented: !!prefs.marketingEmailConsentAt, since: prefs.marketingEmailConsentAt },
        sms: { consented: !!prefs.marketingSmsConsentAt, since: prefs.marketingSmsConsentAt },
        push: { consented: !!prefs.marketingPushConsentAt, since: prefs.marketingPushConsentAt },
        ledger: marketingLedger || null,
      },
    });
  } catch (error) {
    logger.error('[ConsentCenter] Get failed', error);
    res.status(500).json({ error: 'Failed to load consent center' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /api/consent-center/marketing  — grant OR withdraw a marketing channel
// body: { channel: 'email'|'sms'|'push', granted: boolean }
// ───────────────────────────────────────────────────────────────────────────
router.post('/marketing', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { channel, granted } = req.body || {};
    if (!MARKETING_CHANNELS.includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel. Use email | sms | push.' });
    }
    if (typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'granted must be a boolean' });
    }

    await getOrCreatePrefs(userId); // ensure the row exists
    const tsCol = CHANNEL_TO_TIMESTAMP[channel as MarketingChannel];
    const ip = getClientIP(req);
    const ua = req.headers['user-agent'] || '';

    // 1) Update the canonical gate (timestamp non-null = may send; null = stop).
    await db
      .update(notificationPreferences)
      .set({ [tsCol]: granted ? new Date() : null, updatedAt: new Date() } as any)
      .where(eq(notificationPreferences.userId, userId));

    // 2) Record evidence in the append-only consent ledger.
    const { recordConsent, withdrawConsent } = await import('../services/consentEngine');
    const consentType = `marketing_${channel}`;
    const args = {
      userId,
      consentType,
      version: CONSENT_VERSION,
      locale: (req.body.locale as string) || 'he',
      method: 'in_app' as const,
      ip,
      userAgent: ua,
      deviceId: req.body.deviceId || '',
      traceId: req.traceId || '',
    };
    if (granted) await recordConsent(args);
    else await withdrawConsent(args);

    await logAuditEvent({
      actorUserId: userId,
      actionType: granted ? 'MARKETING_CONSENT_GRANTED' : 'MARKETING_CONSENT_WITHDRAWN',
      targetType: 'notification_preferences',
      targetId: userId,
      ip,
      userAgent: ua,
      metadata: { channel },
    });

    logger.info('[ConsentCenter] Marketing consent change', { userId, channel, granted });
    res.json({ success: true, channel, granted });
  } catch (error) {
    logger.error('[ConsentCenter] Marketing change failed', error);
    res.status(500).json({ error: 'Failed to update marketing consent' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/notification-preferences-v2  — full preference set
// ───────────────────────────────────────────────────────────────────────────
router.get('/notification-preferences', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const prefs = await getOrCreatePrefs(userId);
    res.json({
      // Essential — surfaced but cannot be turned off (informational toggles).
      essential: {
        securityAndPayment: true, // always on; not user-disable-able
        bookingTransactional: prefs.transactionalPushEnabled,
      },
      care: {
        // "care" = non-marketing helpful nudges (care timeline reminders).
        push: prefs.push,
        petBirthday: (prefs.platformPreferences as any)?.petBirthday !== false,
        passportExpiry: (prefs.platformPreferences as any)?.passportExpiry !== false,
      },
      marketing: {
        email: !!prefs.marketingEmailConsentAt,
        sms: !!prefs.marketingSmsConsentAt,
        push: !!prefs.marketingPushConsentAt,
      },
    });
  } catch (error) {
    logger.error('[NotificationPrefsV2] Get failed', error);
    res.status(500).json({ error: 'Failed to load notification preferences' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// PATCH /api/notification-preferences-v2  — update non-essential toggles
// body: { care?: { push?, petBirthday?, passportExpiry? },
//         marketing?: { email?, sms?, push? } }
// Essential (security/payment) is never accepted here.
// ───────────────────────────────────────────────────────────────────────────
router.patch('/notification-preferences', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const prefs = await getOrCreatePrefs(userId);
    const body = req.body || {};
    const ip = getClientIP(req);
    const ua = req.headers['user-agent'] || '';

    const updates: Record<string, any> = { updatedAt: new Date() };
    const platformPrefs: any = { ...(prefs.platformPreferences as any) };

    if (body.care) {
      if (typeof body.care.push === 'boolean') updates.push = body.care.push;
      if (typeof body.care.petBirthday === 'boolean') platformPrefs.petBirthday = body.care.petBirthday;
      if (typeof body.care.passportExpiry === 'boolean') platformPrefs.passportExpiry = body.care.passportExpiry;
      updates.platformPreferences = platformPrefs;
    }

    // Marketing toggles route through the same consent-evidence path.
    const { recordConsent, withdrawConsent } = await import('../services/consentEngine');
    if (body.marketing) {
      for (const ch of MARKETING_CHANNELS) {
        if (typeof body.marketing[ch] === 'boolean') {
          const granted: boolean = body.marketing[ch];
          updates[CHANNEL_TO_TIMESTAMP[ch]] = granted ? new Date() : null;
          const args = {
            userId, consentType: `marketing_${ch}`, version: CONSENT_VERSION,
            locale: (body.locale as string) || 'he', method: 'in_app' as const,
            ip, userAgent: ua, deviceId: body.deviceId || '', traceId: req.traceId || '',
          };
          if (granted) await recordConsent(args); else await withdrawConsent(args);
        }
      }
    }

    await db
      .update(notificationPreferences)
      .set(updates as any)
      .where(eq(notificationPreferences.userId, userId));

    await logAuditEvent({
      actorUserId: userId,
      actionType: 'NOTIFICATION_PREFERENCES_UPDATE',
      targetType: 'notification_preferences',
      targetId: userId,
      ip,
      userAgent: ua,
      metadata: { fields: Object.keys(updates), marketing: body.marketing || null },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[NotificationPrefsV2] Update failed', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

export default router;
