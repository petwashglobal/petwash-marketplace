/**
 * Failure Recovery invariants — CEO MASTER 2026-08-28 §28 §29 §30
 * §31 §32 §33 §70.
 *
 * These types describe the SERVER-SIDE STATE the app must expose
 * during and after connectivity / device failures. The rule is: a
 * dead battery, a lost GPS, a delayed webhook must NEVER cause an
 * automatic cancellation, a fake "job complete", or a double
 * charge. Instead the server presents a resumable state.
 *
 * The client's job is to render these states honestly:
 *   * "Live location temporarily unavailable — last update 7 min ago"
 *   * "Payment received. Your receipt is still being prepared."
 *   * "You have a booking request waiting."
 *
 * NO fake GPS interpolation presented as truth. NO invented ETA.
 * NO invented cancellation fee.
 */

/** Where a service session sits from the SERVER's viewpoint. */
export type ServiceSessionState =
  | 'scheduled'          // not started yet
  | 'in_progress'        // provider tapped Start
  | 'gps_unavailable'    // in progress + no GPS in > 60s
  | 'provider_offline'   // heartbeat lost
  | 'suspended_review'   // system requested a manual look
  | 'completed_pending_customer' // provider marked done; customer confirms
  | 'completed'
  | 'cancelled';

/** GPS liveness — belongs on every live-tracking response. */
export type GpsLiveness = 'live' | 'stale' | 'unavailable' | 'not_started';

export interface FailureRecoveryState {
  sessionState: ServiceSessionState;
  gpsLiveness: GpsLiveness;
  /** ISO — the last real GPS ping. Absent when GPS never started. */
  lastGpsAtIso: string | null;
  /** Seconds since the last ping when the projection was taken. Null
   *  when the state is not_started. */
  lastGpsAgeSeconds: number | null;
  /** ISO — the last provider heartbeat. Absent when provider never
   *  came online. */
  lastProviderHeartbeatIso: string | null;
  /** Customer-safe reason to render on the tracking screen. */
  reasonEn: string;
  reasonHe: string;
}

/** Response envelope for /api/session/:id/live-state. */
export interface LiveStateResponse {
  ok: true;
  state: FailureRecoveryState;
}

/** Server-facing rule: GPS is "live" when the last ping is within
 *  this many seconds. */
export const GPS_LIVE_WINDOW_SECONDS = 60;
/** "stale" when older than live but under this many seconds. Beyond,
 *  "unavailable". */
export const GPS_STALE_WINDOW_SECONDS = 300;
/** Provider heartbeat window — if the provider hasn't checked in for
 *  longer than this, the session goes provider_offline. */
export const PROVIDER_HEARTBEAT_WINDOW_SECONDS = 180;

/**
 * Given raw signals from the tracking store, produce the safe
 * customer-facing state. NEVER invents a GPS point. NEVER completes
 * a session on the customer's behalf.
 */
export function deriveFailureRecoveryState(input: {
  storedSessionState: ServiceSessionState;
  lastGpsAtIso: string | null;
  lastProviderHeartbeatIso: string | null;
  nowIso: string;
}): FailureRecoveryState {
  const now = new Date(input.nowIso).getTime();
  const gpsAt = input.lastGpsAtIso ? new Date(input.lastGpsAtIso).getTime() : null;
  const providerAt = input.lastProviderHeartbeatIso
    ? new Date(input.lastProviderHeartbeatIso).getTime()
    : null;
  const gpsAge = gpsAt != null ? Math.max(0, Math.floor((now - gpsAt) / 1000)) : null;
  const providerAge = providerAt != null ? Math.floor((now - providerAt) / 1000) : null;

  let liveness: GpsLiveness;
  if (gpsAge == null) liveness = 'not_started';
  else if (gpsAge <= GPS_LIVE_WINDOW_SECONDS) liveness = 'live';
  else if (gpsAge <= GPS_STALE_WINDOW_SECONDS) liveness = 'stale';
  else liveness = 'unavailable';

  let sessionState: ServiceSessionState = input.storedSessionState;
  if (sessionState === 'in_progress') {
    if (providerAge != null && providerAge > PROVIDER_HEARTBEAT_WINDOW_SECONDS) {
      sessionState = 'provider_offline';
    } else if (liveness === 'unavailable') {
      sessionState = 'gps_unavailable';
    }
  }

  let reasonEn: string;
  let reasonHe: string;
  switch (sessionState) {
    case 'gps_unavailable':
      reasonEn = gpsAge != null
        ? `Live location temporarily unavailable. Last update ${Math.floor(gpsAge / 60)} min ago.`
        : 'Live location temporarily unavailable.';
      reasonHe = gpsAge != null
        ? `מיקום בזמן אמת אינו זמין. עדכון אחרון לפני ${Math.floor(gpsAge / 60)} דקות.`
        : 'מיקום בזמן אמת אינו זמין.';
      break;
    case 'provider_offline':
      reasonEn = 'The provider is temporarily offline. The service is still active.';
      reasonHe = 'הספק לא מחובר כרגע. השירות עדיין פעיל.';
      break;
    case 'completed_pending_customer':
      reasonEn = 'Service marked done — please confirm to release.';
      reasonHe = 'השירות סומן כמסתיים — אשרו לשחרור.';
      break;
    case 'in_progress':
      reasonEn = liveness === 'stale'
        ? 'Live location is a few minutes behind. The service is still in progress.'
        : 'Service in progress.';
      reasonHe = liveness === 'stale'
        ? 'המיקום מתעדכן באיחור. השירות עדיין פעיל.'
        : 'השירות בתהליך.';
      break;
    case 'completed': reasonEn = 'Service completed.'; reasonHe = 'השירות הסתיים.'; break;
    case 'cancelled': reasonEn = 'Service cancelled.'; reasonHe = 'השירות בוטל.'; break;
    case 'suspended_review':
      reasonEn = 'Service paused for review — no action needed on your side.';
      reasonHe = 'השירות מושהה לבדיקה — אין צורך לפעול מצדך.';
      break;
    case 'scheduled':
      reasonEn = 'Service is scheduled and has not started yet.';
      reasonHe = 'השירות מתוזמן ועדיין לא החל.';
      break;
  }

  return {
    sessionState,
    gpsLiveness: liveness,
    lastGpsAtIso: input.lastGpsAtIso,
    lastGpsAgeSeconds: gpsAge,
    lastProviderHeartbeatIso: input.lastProviderHeartbeatIso,
    reasonEn,
    reasonHe,
  };
}

/**
 * Payment resolution helper — the small companion type §12 needs.
 * Downstream code queries the processor + wallet reservations and
 * maps to one of these four states. NEVER invents a state.
 */
export type PaymentResolutionState =
  | 'payment_confirmed'
  | 'payment_pending'
  | 'payment_failed'
  | 'no_payment';

export interface PaymentResolutionResult {
  state: PaymentResolutionState;
  /** ISO — when the observation was made. */
  observedAtIso: string;
  /** Provider transaction ref (Nayax etc.), if any. Absent when
   *  no_payment. */
  processorRef: string | null;
  /** Customer-safe HE + EN copy. */
  copyEn: string;
  copyHe: string;
}

/**
 * CEO §70 world-class UX copy per state. Callers hand the customer
 * these strings; the server never invents "Pay again" when the
 * state cannot be resolved.
 */
export function paymentResolutionCopy(state: PaymentResolutionState): { en: string; he: string } {
  switch (state) {
    case 'payment_confirmed':
      return {
        en: 'We received your payment. Your booking is confirmed.',
        he: 'התשלום התקבל. ההזמנה מאושרת.',
      };
    case 'payment_pending':
      return {
        en: 'We received your payment. Your receipt is still being prepared. You do not need to pay again.',
        he: 'התשלום התקבל. החשבונית עדיין בהכנה. אין צורך לשלם שוב.',
      };
    case 'payment_failed':
      return {
        en: 'Your last payment did not go through. Please retry.',
        he: 'התשלום האחרון לא עבר. יש לנסות שוב.',
      };
    case 'no_payment':
      return {
        en: 'No payment on file for this booking yet. Continue when you are ready.',
        he: 'אין תשלום מתועד בהזמנה זו. ניתן להמשיך כשמוכנים.',
      };
  }
}
