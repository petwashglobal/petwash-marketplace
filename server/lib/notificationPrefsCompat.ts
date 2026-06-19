/**
 * notificationPrefsCompat.ts
 *
 * Canonical read/write for notification preferences, backed by the POSTGRES
 * `notification_preferences` table (shared/schema-unified-platform) — the same
 * store used by /api/consent-center (PR #905).
 *
 * WHY: the legacy /api/user/notification-preferences and
 * /api/monitoring/notifications/preferences/:userId endpoints called
 * NotificationConsentManager.getUserNotificationPreferences /
 * updateNotificationPreferences / recordConsentChange — methods that DO NOT
 * EXIST on that (Firestore-backed) class → every call 500'd. Worse, the class
 * is a SECOND, divergent store (Firestore `notification_preferences`) vs the
 * Postgres table the rest of the platform uses. This helper consolidates those
 * legacy endpoints onto the ONE canonical Postgres store. Marketing toggles set
 * the per-channel consent timestamp (Israeli Privacy Protection + GDPR: no
 * marketing send without a non-null consent timestamp). Every write is audited.
 */
import { db } from '../db';
import { notificationPreferences } from '@shared/schema-unified-platform';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from './logger';

async function getOrCreate(userId: string) {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(notificationPreferences)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // lost the insert race — re-read
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return row;
}

/** Returns the prefs in the legacy response shape the old endpoints exposed. */
export async function readNotificationPrefs(userId: string) {
  const p: any = await getOrCreate(userId);
  return {
    emailEnabled: !!p?.email,
    smsEnabled: !!p?.sms,
    pushEnabled: !!p?.push,
    whatsappEnabled: !!p?.whatsapp,
    marketingEmails: !!p?.marketing && !!p?.marketingEmailConsentAt,
    marketingSms: !!p?.marketing && !!p?.marketingSmsConsentAt,
    marketingPush: !!p?.marketing && !!p?.marketingPushConsentAt,
    transactionalEmails: p?.transactionalEmailEnabled ?? true,
    securityAlerts: true, // essential — never disableable
    loyaltyUpdates: !!p?.marketing,
    appointmentReminders: true,
  };
}

/**
 * Accepts BOTH the legacy body shape ({emailEnabled, smsEnabled, pushEnabled,
 * marketingEmails, loyaltyUpdates, ...}) and the direct column shape
 * ({email, sms, push, marketing, ...}). Only provided keys are changed.
 * Turning a marketing channel ON stamps its consent timestamp; OFF clears it.
 */
export async function writeNotificationPrefs(
  userId: string,
  body: Record<string, any>,
  ctx: { ip?: string; actor?: string } = {},
) {
  await getOrCreate(userId);
  const now = new Date();
  const updates: Record<string, any> = {};

  const channel = (legacyKey: string, directKey: string) => {
    if (legacyKey in body) return !!body[legacyKey];
    if (directKey in body) return !!body[directKey];
    return undefined;
  };

  const email = channel('emailEnabled', 'email');
  const sms = channel('smsEnabled', 'sms');
  const push = channel('pushEnabled', 'push');
  const whatsapp = channel('whatsappEnabled', 'whatsapp');
  if (email !== undefined) updates.email = email;
  if (sms !== undefined) updates.sms = sms;
  if (push !== undefined) updates.push = push;
  if (whatsapp !== undefined) updates.whatsapp = whatsapp;

  // Marketing: a single master flag + per-channel consent timestamps.
  const marketing = channel('marketingEmails', 'marketing');
  if (marketing !== undefined) {
    updates.marketing = marketing;
    updates.marketingEmailConsentAt = marketing ? now : null;
    updates.marketingSmsConsentAt = marketing ? now : null;
    updates.marketingPushConsentAt = marketing ? now : null;
  }

  if (Object.keys(updates).length === 0) return; // nothing to change

  await db
    .update(notificationPreferences)
    .set(updates)
    .where(eq(notificationPreferences.userId, userId));

  try {
    await logAuditEvent({
      actionType: 'NOTIFICATION_PREFERENCES_UPDATED',
      actorUserId: ctx.actor || userId,
      targetType: 'user',
      targetId: userId,
      ip: ctx.ip,
      metadata: { changed: Object.keys(updates) },
    });
  } catch (e: any) {
    logger.warn('[notificationPrefsCompat] audit log failed (non-blocking)', { error: e?.message });
  }
}
