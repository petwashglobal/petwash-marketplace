/**
 * NotificationPriorityService — CEO PROGRAM 34 (Quiet Hours / Load).
 *
 * Pure evaluator. Given a proposed notification (kind + JourneyPriority
 * + optional deadline), decides:
 *   • whether to DELIVER now, DEFER to a later window, or DROP.
 *   • which channel(s) (push / email / sms) are appropriate.
 *   • whether the message is high-priority enough to punch through
 *     quiet hours.
 *
 * Doctrine rules the evaluator encodes:
 *   § "Server Inbox remains truth" — this evaluator never mutates
 *     inbox items; it only picks delivery channels for OUT-OF-APP
 *     notifications (push/email/sms).
 *   § Safety / payment / booking deadlines PUNCH THROUGH quiet hours.
 *   § Marketing never displaces a REQUIRED obligation (§75).
 *   § No 10-reminders storm — the evaluator refuses to redeliver the
 *     same notification (kind + entityRef) inside the deliveryFloor.
 */
import type { JourneyPriority } from '@shared/marketplace/journeyState';

/** All notification kinds the marketplace produces. */
export type NotificationKind =
  | 'BOOKING_REQUEST_NEW'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_CHANGE_PROPOSED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_STARTING_SOON'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_UNCERTAIN'
  | 'REFUND_STATUS_CHANGED'
  | 'MESSAGE_NEW'
  | 'DOCUMENT_READY'
  | 'PROVIDER_KYC_MISSING'
  | 'PET_KYA_STALE'
  | 'INCIDENT_UPDATE'
  | 'SAFETY_ALERT'
  | 'MARKETING_OFFER'
  | 'PRESTIGE_MILESTONE'
  | 'K9000_SESSION_UPDATE'
  | 'WALLET_TOPUP_STATUS';

export type Channel = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP';

export type DeliveryDecision =
  | { verdict: 'DELIVER'; channels: Channel[]; punchThroughQuietHours: boolean }
  | { verdict: 'DEFER'; deferUntil: string; reasonCode: string }
  | { verdict: 'DROP'; reasonCode: string };

export interface QuietHoursWindow {
  /** 24-hour local hour when quiet hours start (inclusive). */
  fromHour: number;
  /** 24-hour local hour when quiet hours end (exclusive). */
  toHour: number;
  /** IANA timezone the hours are interpreted in. */
  timezone?: string;
}

export interface UserNotificationPreferences {
  quietHours?: QuietHoursWindow;
  disabledChannels?: Channel[];
  disabledKinds?: NotificationKind[];
  marketingConsent: boolean;
}

export interface EvaluateNotificationInput {
  kind: NotificationKind;
  journeyPriority: JourneyPriority;
  entityRef: { kind: string; id: string };
  now?: Date;
  /** ISO string of the most-recent identical delivery, if any. */
  lastDeliveredAt?: string;
  preferences: UserNotificationPreferences;
}

/** Minimum gap between two identical (kind + entityRef) deliveries — anti-storm. */
const DELIVERY_FLOOR_MS: Record<NotificationKind, number> = {
  BOOKING_REQUEST_NEW:       10 * 60 * 1000,
  BOOKING_ACCEPTED:          60 * 60 * 1000,
  BOOKING_CHANGE_PROPOSED:   10 * 60 * 1000,
  BOOKING_CANCELLED:         60 * 60 * 1000,
  BOOKING_STARTING_SOON:      5 * 60 * 1000,
  PAYMENT_REQUIRED:          15 * 60 * 1000,
  PAYMENT_UNCERTAIN:          5 * 60 * 1000,
  REFUND_STATUS_CHANGED:     30 * 60 * 1000,
  MESSAGE_NEW:                    30 * 1000,
  DOCUMENT_READY:            60 * 60 * 1000,
  PROVIDER_KYC_MISSING:      24 * 60 * 60 * 1000,
  PET_KYA_STALE:             48 * 60 * 60 * 1000,
  INCIDENT_UPDATE:            5 * 60 * 1000,
  SAFETY_ALERT:                    0,
  MARKETING_OFFER:           24 * 60 * 60 * 1000,
  PRESTIGE_MILESTONE:        24 * 60 * 60 * 1000,
  K9000_SESSION_UPDATE:       5 * 60 * 1000,
  WALLET_TOPUP_STATUS:       15 * 60 * 1000,
};

/** Kinds that ALWAYS punch through quiet hours (safety / money / imminent). */
const ALWAYS_PUNCH_THROUGH: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  'SAFETY_ALERT',
  'PAYMENT_UNCERTAIN',
  'PAYMENT_REQUIRED',
  'BOOKING_STARTING_SOON',
  'INCIDENT_UPDATE',
]);

function isDuringQuietHours(now: Date, qh: QuietHoursWindow): boolean {
  // The evaluator uses the LOCAL hour of `now`. Callers can pre-translate
  // to the user's timezone before calling; that keeps this pure.
  const h = now.getHours();
  if (qh.fromHour === qh.toHour) return false;
  if (qh.fromHour < qh.toHour) return h >= qh.fromHour && h < qh.toHour;
  // Overnight window (e.g. 22 → 7).
  return h >= qh.fromHour || h < qh.toHour;
}

function deferToEndOfQuietHours(now: Date, qh: QuietHoursWindow): string {
  const end = new Date(now);
  end.setMinutes(0, 0, 0);
  if (qh.fromHour < qh.toHour) {
    end.setHours(qh.toHour);
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  } else {
    end.setHours(qh.toHour);
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  }
  return end.toISOString();
}

function channelsFor(kind: NotificationKind, priority: JourneyPriority): Channel[] {
  if (kind === 'SAFETY_ALERT') return ['PUSH', 'SMS', 'IN_APP'];
  if (kind === 'PAYMENT_UNCERTAIN' || kind === 'PAYMENT_REQUIRED') return ['PUSH', 'IN_APP', 'EMAIL'];
  if (kind === 'MARKETING_OFFER') return ['EMAIL', 'IN_APP'];
  if (priority === 'URGENT') return ['PUSH', 'SMS', 'IN_APP', 'EMAIL'];
  if (priority === 'HIGH') return ['PUSH', 'IN_APP', 'EMAIL'];
  return ['PUSH', 'IN_APP'];
}

export function evaluateNotification(input: EvaluateNotificationInput): DeliveryDecision {
  const now = input.now ?? new Date();
  const prefs = input.preferences;

  // Kind explicitly disabled by the user → DROP unless it's SAFETY.
  if (input.kind !== 'SAFETY_ALERT' && prefs.disabledKinds?.includes(input.kind)) {
    return { verdict: 'DROP', reasonCode: 'USER_DISABLED_KIND' };
  }

  // Marketing requires explicit consent.
  if (input.kind === 'MARKETING_OFFER' && !prefs.marketingConsent) {
    return { verdict: 'DROP', reasonCode: 'MARKETING_CONSENT_REVOKED' };
  }

  // Anti-storm: same-kind delivery inside the floor → DROP.
  if (input.lastDeliveredAt) {
    const last = new Date(input.lastDeliveredAt).getTime();
    const floor = DELIVERY_FLOOR_MS[input.kind] ?? 0;
    if (Number.isFinite(last) && now.getTime() - last < floor) {
      return { verdict: 'DROP', reasonCode: 'DELIVERY_FLOOR' };
    }
  }

  const punchThrough = ALWAYS_PUNCH_THROUGH.has(input.kind) || input.journeyPriority === 'URGENT';

  // Quiet hours: DEFER unless we punch through.
  if (prefs.quietHours && isDuringQuietHours(now, prefs.quietHours) && !punchThrough) {
    return {
      verdict: 'DEFER',
      deferUntil: deferToEndOfQuietHours(now, prefs.quietHours),
      reasonCode: 'QUIET_HOURS',
    };
  }

  const wanted = channelsFor(input.kind, input.journeyPriority);
  const disabled = new Set(prefs.disabledChannels ?? []);
  const channels = wanted.filter((c) => !disabled.has(c));
  // Marketing during INFO priority when the marketing-safe channels are
  // all disabled → DROP rather than surprise-push.
  if (channels.length === 0) {
    return { verdict: 'DROP', reasonCode: 'NO_ENABLED_CHANNEL' };
  }

  return { verdict: 'DELIVER', channels, punchThroughQuietHours: punchThrough };
}
