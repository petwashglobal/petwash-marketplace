/**
 * PushPermissionValueGate — CEO P0-CEP Batch §5.
 *
 * Doctrine: "Never ask the user for push-notification permission the
 * moment they open the app. That is the fastest way to get REFUSED —
 * and iOS gives you exactly one chance."
 *
 * The user has to have SEEN VALUE first — completed something real
 * that would obviously benefit from a live notification (booked a
 * service, joined a waitlist, saved a favourite that has arrivals to
 * announce, submitted a provider application waiting on approval).
 * Only then does the ask land as "yes, let me know" instead of
 * "why are you interrupting me".
 *
 * This file is a PURE evaluator. It takes a snapshot of the user's
 * observable value-signals and the current permission state, and
 * returns a typed verdict on whether the client may PROMPT NOW. The
 * client's job is (a) collect the snapshot, (b) obey the verdict.
 *
 * Placed in shared/ so the same rules govern web-push, iOS APNs,
 * Android FCM, and any future channel — there is exactly one place
 * where "may we ask?" is answered.
 */

/**
 * Every signal we accept as evidence the user has seen value. The
 * union is closed on purpose — a well-meaning engineer cannot invent
 * "opened the app 3 times" as a value signal to satisfy the gate.
 */
export type PushValueSignal =
  | 'FIRST_BOOKING_CONFIRMED'
  | 'FIRST_SHOP_ORDER_CONFIRMED'
  | 'FIRST_EGIFT_PURCHASED_OR_REDEEMED'
  | 'PROVIDER_APPLICATION_SUBMITTED'
  | 'PRESTIGE_JOINED'
  | 'FAVOURITE_SAVED'
  | 'SAVED_SEARCH_CREATED'
  | 'WAITLIST_JOINED'
  | 'MEET_AND_GREET_SCHEDULED';

/**
 * Live OS-level permission state as reported by the browser or the
 * native shell. UNAVAILABLE = we have no way to prompt (no Push API,
 * user in incognito, embedded webview without permission plumbing).
 */
export type PushOsPermissionState = 'GRANTED' | 'DENIED' | 'DEFAULT' | 'UNAVAILABLE';

export interface PushValueGateInput {
  osState: PushOsPermissionState;
  /**
   * Distinct value signals observed for this user, ordered by
   * caller convenience (we deduplicate). Empty = no value seen yet.
   */
  valueSignals: readonly PushValueSignal[];
  /**
   * When (if ever) we last prompted this user in-app for push
   * permission. Undefined = never prompted.
   */
  lastPromptAt?: Date;
  /**
   * When (if ever) the user actively DECLINED the in-app pre-prompt
   * (the "Not now" gentle-ask, before the OS prompt). Undefined =
   * never declined. A hard OS DENIED is separate — see osState.
   */
  lastDeclinedAt?: Date;
  now: Date;
  /**
   * Minimum cool-down between in-app prompts, in ms. Defaults to
   * 30 days — the CEO doctrine on "not a dark pattern".
   */
  minCooldownMs?: number;
}

export type PushValueGateVerdict =
  | { code: 'PROMPT_NOW' }
  | { code: 'HOLD'; reasonCode:
      | 'NO_VALUE_YET'          // user hasn't done anything push-worthy
      | 'ALREADY_GRANTED'       // no need to ask
      | 'ALREADY_DENIED_BY_OS'  // OS-level DENIED — asking again is worthless
      | 'COOLDOWN_ACTIVE'       // in-app cooldown since last ask
      | 'USER_DECLINED_RECENTLY'// user said "not now" recently
      | 'OS_UNAVAILABLE'        // no Push API on this surface
    };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Decide whether the client may show the in-app pre-prompt right now.
 *
 * Refusal ORDER (pinned by tests): OS_UNAVAILABLE → ALREADY_GRANTED →
 * ALREADY_DENIED_BY_OS → NO_VALUE_YET → USER_DECLINED_RECENTLY →
 * COOLDOWN_ACTIVE → PROMPT_NOW. The client must report the reasonCode
 * to the caller so telemetry can distinguish "we never ask because
 * OS DENIED" from "we chose not to ask yet because no value".
 */
export function evaluatePushPermissionGate(input: PushValueGateInput): PushValueGateVerdict {
  const cooldownMs = input.minCooldownMs ?? THIRTY_DAYS_MS;

  if (input.osState === 'UNAVAILABLE') {
    return { code: 'HOLD', reasonCode: 'OS_UNAVAILABLE' };
  }
  if (input.osState === 'GRANTED') {
    return { code: 'HOLD', reasonCode: 'ALREADY_GRANTED' };
  }
  if (input.osState === 'DENIED') {
    return { code: 'HOLD', reasonCode: 'ALREADY_DENIED_BY_OS' };
  }
  // From here on: osState === 'DEFAULT' (may prompt if allowed).
  const distinctSignals = new Set(input.valueSignals);
  if (distinctSignals.size === 0) {
    return { code: 'HOLD', reasonCode: 'NO_VALUE_YET' };
  }
  if (input.lastDeclinedAt && input.now.getTime() - input.lastDeclinedAt.getTime() < cooldownMs) {
    return { code: 'HOLD', reasonCode: 'USER_DECLINED_RECENTLY' };
  }
  if (input.lastPromptAt && input.now.getTime() - input.lastPromptAt.getTime() < cooldownMs) {
    return { code: 'HOLD', reasonCode: 'COOLDOWN_ACTIVE' };
  }
  return { code: 'PROMPT_NOW' };
}
