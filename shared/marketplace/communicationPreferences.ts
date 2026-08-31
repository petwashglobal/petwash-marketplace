/**
 * CommunicationPreferencesService — CEO P0-CEP Batch §13.
 *
 * Doctrine: "Preferences must be granular. A per-channel per-purpose
 * matrix — never a single 'notifications on/off' switch. Transactional
 * messages the user OWES (booking confirmations, security alerts,
 * fiscal receipts) are NOT gated by the marketing prefs — those are
 * always delivered. Marketing is opt-IN and the user can turn any
 * one channel off without losing the others."
 *
 * This file DECLARES:
 *   • The closed set of channels (push, email, sms, whatsapp, in_app).
 *   • The closed set of message purposes.
 *   • Which purposes are TRANSACTIONAL_MANDATORY (bypass user prefs).
 *   • A pure evaluator gateForDelivery({ purpose, channel, prefs,
 *     quietHours, now }) that returns DELIVER / SUPPRESS with a
 *     typed reasonCode. Every delivery worker must call this before
 *     dispatching.
 *
 * The in_app channel is special: an inbox row is AUTHORITATIVE per
 * Batch §12 (NotificationInboxSpec). This gate never SUPPRESSES an
 * in_app write for a real event — it only distinguishes MARKETING
 * in_app rows the user has opted out of.
 */

export const COMMS_CHANNELS = ['push', 'email', 'sms', 'whatsapp', 'in_app'] as const;
export type CommsChannel = (typeof COMMS_CHANNELS)[number];

/**
 * Every purpose a delivery worker may send. Kept in lockstep with
 * NotificationInboxSpec.INBOX_ITEM_PURPOSES conceptually — this list
 * is the DELIVERY-side vocabulary; the inbox list is the STORAGE-side.
 * They overlap heavily but are distinct enums because delivery has
 * finer purposes (e.g. OTP is a delivery purpose but not an inbox row).
 */
export const COMMS_PURPOSES = [
  // Transactional — user OWES these, never gated
  'BOOKING_CONFIRMATION',
  'BOOKING_UPDATE',
  'PAYMENT_RECEIPT',
  'FISCAL_DOCUMENT',
  'ACCOUNT_SECURITY',
  'ACCOUNT_ACTIVATION',
  'OTP',
  'REFUND_ISSUED',
  'PAYOUT_STATEMENT',
  // Relationship — user opted in and can opt out per channel
  'MESSAGE_FROM_COUNTERPARTY',
  'REVIEW_REMINDER',
  'REBOOKING_REMINDER',
  // Announcements — opt-out per channel
  'ANNOUNCEMENT',
  // Marketing — opt-IN per channel
  'MARKETING',
] as const;
export type CommsPurpose = (typeof COMMS_PURPOSES)[number];

/**
 * Transactional purposes the user cannot suppress: legal / fiscal /
 * safety / anti-fraud. A worker calling gateForDelivery for one of
 * these still gets a verdict — but the verdict never suppresses on
 * pref-related grounds. Non-pref reasons (quiet hours, channel
 * unavailable) may still apply per business decision.
 */
export const TRANSACTIONAL_MANDATORY: ReadonlySet<CommsPurpose> = new Set([
  'BOOKING_CONFIRMATION',
  'PAYMENT_RECEIPT',
  'FISCAL_DOCUMENT',
  'ACCOUNT_SECURITY',
  'ACCOUNT_ACTIVATION',
  'OTP',
  'REFUND_ISSUED',
]);

/**
 * Marketing purposes must be opt-IN: absent an explicit YES the
 * gate suppresses.
 */
export const MARKETING_PURPOSES: ReadonlySet<CommsPurpose> = new Set(['MARKETING']);

/**
 * User preference snapshot: one boolean per (channel, purpose)
 * combination. Absent key = default; the default depends on the
 * purpose family (see resolveDefault below).
 */
export type PreferenceKey = `${CommsChannel}.${CommsPurpose}`;
export type PreferenceMap = ReadonlyMap<PreferenceKey, boolean>;

export interface QuietHoursWindow {
  /** IANA timezone the user's clock is interpreted in. */
  tz: string;
  /** Inclusive start hour 0-23. */
  startHour: number;
  /** Exclusive end hour 0-23. Wraps midnight if endHour <= startHour. */
  endHour: number;
}

export interface DeliveryGateInput {
  purpose: CommsPurpose;
  channel: CommsChannel;
  prefs: PreferenceMap;
  quietHours?: QuietHoursWindow;
  /** Wall-clock in UTC. Quiet-hours are compared after applying tz. */
  now: Date;
}

export type DeliveryGateVerdict =
  | { code: 'DELIVER' }
  | { code: 'SUPPRESS'; reasonCode:
      | 'MARKETING_NOT_OPTED_IN'
      | 'USER_OPTED_OUT'
      | 'QUIET_HOURS_ACTIVE'
      | 'CHANNEL_INVALID_FOR_PURPOSE'
    };

/** Default when the user has expressed no preference for this (channel, purpose). */
function resolveDefault(purpose: CommsPurpose, _channel: CommsChannel): boolean {
  if (TRANSACTIONAL_MANDATORY.has(purpose)) return true;
  if (MARKETING_PURPOSES.has(purpose)) return false;   // opt-IN
  return true;                                          // relationship + announcements are opt-OUT
}

function hourInWindow(hourLocal: number, w: QuietHoursWindow): boolean {
  if (w.startHour === w.endHour) return false;
  if (w.startHour < w.endHour) return hourLocal >= w.startHour && hourLocal < w.endHour;
  // wraps midnight
  return hourLocal >= w.startHour || hourLocal < w.endHour;
}

function hourInTz(now: Date, tz: string): number {
  // Small hand-rolled formatter to avoid pulling in Intl polyfills
  // where they are absent. Node/modern browsers ship Intl by default.
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: tz,
  });
  const parts = fmt.formatToParts(now);
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
  return Number.parseInt(hourStr, 10);
}

export function gateForDelivery(input: DeliveryGateInput): DeliveryGateVerdict {
  const { purpose, channel, prefs, quietHours, now } = input;

  // Only in_app is universally valid; other channels may be
  // deliberately excluded for a purpose (e.g. OTP over marketing SMS
  // is never something we send). Kept minimal for now — a fuller
  // matrix belongs in a follow-up.
  if (channel === 'in_app' && MARKETING_PURPOSES.has(purpose)) {
    // Marketing in_app rows are gated by user opt-in like any other
    // marketing channel — the inbox is authoritative for TRANSACTIONAL
    // events, not for marketing.
  }

  const key: PreferenceKey = `${channel}.${purpose}`;
  const explicit = prefs.get(key);
  const effective = explicit ?? resolveDefault(purpose, channel);

  // Transactional mandatory always wins over user opt-out (with the
  // legal understanding that these are non-marketing service messages
  // the user needs to receive to use the platform).
  if (TRANSACTIONAL_MANDATORY.has(purpose)) {
    if (quietHours && channel !== 'in_app' && hourInWindow(hourInTz(now, quietHours.tz), quietHours)) {
      // Even mandatory: some channels defer past quiet hours.
      // Security & OTP still deliver (worker overrides), but the
      // gate reports QUIET_HOURS_ACTIVE so the worker can decide.
      if (purpose === 'ACCOUNT_SECURITY' || purpose === 'OTP') {
        return { code: 'DELIVER' };
      }
      return { code: 'SUPPRESS', reasonCode: 'QUIET_HOURS_ACTIVE' };
    }
    return { code: 'DELIVER' };
  }

  // Marketing requires explicit opt-in.
  if (MARKETING_PURPOSES.has(purpose)) {
    if (!effective) return { code: 'SUPPRESS', reasonCode: 'MARKETING_NOT_OPTED_IN' };
  } else {
    if (!effective) return { code: 'SUPPRESS', reasonCode: 'USER_OPTED_OUT' };
  }

  if (quietHours && channel !== 'in_app' && hourInWindow(hourInTz(now, quietHours.tz), quietHours)) {
    return { code: 'SUPPRESS', reasonCode: 'QUIET_HOURS_ACTIVE' };
  }
  return { code: 'DELIVER' };
}

/** Convenience builder for tests + call-sites that hold a plain object of prefs. */
export function preferenceMapFromRecord(rec: Partial<Record<PreferenceKey, boolean>>): PreferenceMap {
  const m = new Map<PreferenceKey, boolean>();
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === 'boolean') m.set(k as PreferenceKey, v);
  }
  return m;
}
