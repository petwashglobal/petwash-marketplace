/**
 * sendForceTokenRefresh.ts
 *
 * Tiny helper used after every server-side Firebase custom-claims
 * mutation. Inserts an in-app notification with
 * `actionType: 'force_token_refresh'` — the sentinel value the
 * frontend (NotificationCenterPanel.tsx:193) watches for, then
 * calls `auth.currentUser.getIdToken(true)` to pull the freshly-
 * minted claims without a logout/login dance.
 *
 * Issue #153 PR-CLAIMS-SYNC. Lane B-B audit found:
 *   • provider-applications.ts:1318-1341 already does this correctly
 *     for the admin-approval path.
 *   • post-login.ts:562-593 (auto-promote on provider_active) writes
 *     claims but DOES NOT push a refresh notification → client
 *     waits up to ~1h for natural Firebase token refresh.
 *   • post-login.ts:866-899 approveAccess writes claims but DOES NOT
 *     push a refresh notification → useWhoami serves stale role for
 *     2 min after admin approval (PR #184 closed half of this; the
 *     other half is the claims propagation gap this notification
 *     closes).
 *
 * Pattern: mirror exactly what provider-applications.ts:1318-1341
 * does so the contract stays uniform across all role-change writers.
 *
 * Best-effort + non-blocking. Logs a warn on failure but never
 * throws — the parent role change has already succeeded; failing the
 * notification must not undo a database mutation.
 */

import { logger } from './logger';

export interface ForceTokenRefreshNotification {
  userId: string;
  /** Notification reason. Drives the title + body the user sees. */
  reason:
    | 'provider_approved'
    | 'staff_approved'
    | 'role_changed'
    | 'account_type_changed';
  /** Where the in-app banner should send the user when tapped. */
  actionUrl?: string;
  /** UI language for the title/body. Falls back to Hebrew. */
  preferredLanguage?: 'he' | 'en' | string | null;
  /** Optional additional metadata to log in audit_events. NEVER include
   *  secret values. */
  meta?: Record<string, unknown>;
}

const TITLES_HE: Record<ForceTokenRefreshNotification['reason'], string> = {
  provider_approved:    '🎉 הבקשה שלך אושרה!',
  staff_approved:       '🎉 הגישה שלך אושרה!',
  role_changed:         '🔄 התפקיד שלך עודכן',
  account_type_changed: '🔄 חשבונך עודכן',
};
const BODIES_HE: Record<ForceTokenRefreshNotification['reason'], string> = {
  provider_approved:    'לחץ כאן כדי לרענן את הסשן ולגשת ללוח הבקרה של הספק.',
  staff_approved:       'לחץ כאן כדי לרענן את הסשן ולגשת לפאנל הצוות.',
  role_changed:         'לחץ כאן כדי לרענן את הסשן ולראות את התפקיד החדש.',
  account_type_changed: 'לחץ כאן כדי לרענן את הסשן ולראות את החשבון המעודכן.',
};
const TITLES_EN: Record<ForceTokenRefreshNotification['reason'], string> = {
  provider_approved:    '🎉 Your application is approved!',
  staff_approved:       '🎉 Your access is approved!',
  role_changed:         '🔄 Your role has been updated',
  account_type_changed: '🔄 Your account has been updated',
};
const BODIES_EN: Record<ForceTokenRefreshNotification['reason'], string> = {
  provider_approved:    'Tap here to refresh your session and access your provider dashboard.',
  staff_approved:       'Tap here to refresh your session and access the staff panel.',
  role_changed:         'Tap here to refresh your session to see your new role.',
  account_type_changed: 'Tap here to refresh your session to see your updated account.',
};

/**
 * Insert a force_token_refresh in-app notification. Fail-soft: any
 * insert error is logged + swallowed so the caller's role-change flow
 * is not undone. Returns a boolean indicating success.
 *
 * IMPORTANT: caller must have already mutated the role / claims —
 * this helper does not gate on that, so misuse could trigger a
 * client refresh that finds the same stale claim. Always call AFTER
 * setCustomUserClaims succeeds.
 */
export async function sendForceTokenRefreshNotification(
  notification: ForceTokenRefreshNotification,
): Promise<boolean> {
  if (!notification.userId) {
    logger.warn('[force_token_refresh] missing userId — skipping');
    return false;
  }

  const isHe =
    notification.preferredLanguage === 'he' || notification.preferredLanguage == null;
  const titles = isHe ? TITLES_HE : TITLES_EN;
  const bodies = isHe ? BODIES_HE : BODIES_EN;

  try {
    const { db } = await import('../db');
    const { superAppNotifications: notifTable } = await import('@shared/schema');
    await db.insert(notifTable).values({
      userId: notification.userId,
      type: notification.reason,
      title: titles[notification.reason],
      body: bodies[notification.reason],
      actionUrl: notification.actionUrl ?? '/home',
      // Sentinel value the frontend NotificationCenterPanel watches for.
      // Receiving it triggers `auth.currentUser.getIdToken(true)` →
      // claims propagate within ~100ms instead of waiting for the
      // natural Firebase token refresh window (~1h).
      actionType: 'force_token_refresh',
      channels: ['in_app'],
      isRead: false,
      createdAt: new Date(),
    });
    return true;
  } catch (err: any) {
    logger.warn('[force_token_refresh] notification insert failed (non-fatal)', {
      userId: notification.userId,
      reason: notification.reason,
      error: err?.message ?? String(err),
    });
    return false;
  }
}
