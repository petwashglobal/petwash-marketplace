import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../lib/logger';
import { sendSecurityAlert } from './alerts';

/**
 * Nayax transaction-feed staleness watchdog.
 *
 * WHY THIS EXISTS
 * ---------------
 * PetWash runs its own 5+1 punch card (`monyx_punch_cards`) because Nayax gates
 * the Campaign module server-side and it is absent from our operator account.
 * We therefore compute the offer ourselves off the Nayax transaction webhook we
 * already ingest at POST /api/webhooks/nayax-events.
 *
 * That makes the webhook a LOAD-BEARING dependency with no alarm on it. If the
 * payload shape changes, the handler answers `400 Missing transaction_id` and
 * punches simply stop. Nothing breaks loudly. Nobody finds out until a customer
 * says their sixth wash was not free — by which time the evidence is gone.
 *
 * The handler is already tolerant of naming (`transaction_id` /
 * `transactionId` / `external_id`), so this is not a prediction that Nayax will
 * break it. It is insurance, and the timing is specific: Nayax is migrating
 * Monyx to Wallyx during September 2026 and has told operators that "nothing
 * changes on your side". That claim is about PAYMENTS. Our punch card does not
 * ride payments — it rides their event payload.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not verify punches are correct, only that events are still ARRIVING.
 * A feed that arrives with renamed fields would still be silent here if the
 * handler accepted it — that is deliberate. This watchdog answers exactly one
 * question, "have we heard from Nayax recently", and answers it reliably.
 */

/** Hours of silence before we alert. Deliberately generous — see isQuietHours. */
const STALE_AFTER_HOURS = Number(process.env.NAYAX_FEED_STALE_HOURS || 12);

/**
 * Overnight silence is NORMAL, not a fault.
 *
 * The Kfar Saba bays are self-service dog wash. Nobody washes a dog at 04:00,
 * so a "no events for 12 hours" alert fired at dawn would be noise — and an
 * alert that cries wolf is worse than no alert, because it trains everyone to
 * ignore the one that matters. We only evaluate during hours when a real
 * customer plausibly would have used a bay.
 *
 * Israel local time. The server runs UTC, so this converts explicitly rather
 * than trusting the host timezone — a lesson from the fiscal-dating bug where
 * a zone-less parse silently used the host's zone.
 */
function isQuietHours(now: Date): boolean {
  // Asia/Jerusalem is UTC+2 (IST) or UTC+3 (IDT). Using the larger offset is
  // the safe direction: it can only make us evaluate slightly later, never
  // alert during genuine night hours.
  const israelHour = (now.getUTCHours() + 3) % 24;
  return israelHour < 9 || israelHour >= 22;
}

export interface FeedCheckResult {
  checked: boolean;
  reason?: string;
  lastEventAt?: Date | null;
  hoursSilent?: number;
  alerted?: boolean;
}

/** Alert at most once per silent stretch — reset when an event finally lands. */
let alreadyAlertedForThisSilence = false;

export async function checkNayaxFeedFreshness(now: Date = new Date()): Promise<FeedCheckResult> {
  if (isQuietHours(now)) {
    return { checked: false, reason: 'quiet_hours' };
  }

  let lastEventAt: Date | null = null;
  try {
    const rows = await db.execute(
      sql`SELECT MAX(transaction_time) AS last_at FROM nayax_transaction_events`,
    );
    const raw = (rows as any)?.rows?.[0]?.last_at ?? (rows as any)?.[0]?.last_at ?? null;
    lastEventAt = raw ? new Date(raw) : null;
  } catch (error: any) {
    // A DB failure is NOT feed staleness. Reporting it as such would send the
    // wrong person to look at the wrong system.
    logger.error('[NayaxFeedWatchdog] could not read the feed', { error: error?.message });
    return { checked: false, reason: 'db_unavailable' };
  }

  if (!lastEventAt) {
    // No rows at all. On a fresh environment this is normal, not an incident,
    // and alerting here would fire forever in staging.
    return { checked: true, lastEventAt: null, reason: 'no_events_ever' };
  }

  const hoursSilent = (now.getTime() - lastEventAt.getTime()) / 3_600_000;

  if (hoursSilent < STALE_AFTER_HOURS) {
    if (alreadyAlertedForThisSilence) {
      logger.info('[NayaxFeedWatchdog] feed recovered', { hoursSilent: Math.round(hoursSilent) });
    }
    alreadyAlertedForThisSilence = false;
    return { checked: true, lastEventAt, hoursSilent, alerted: false };
  }

  if (alreadyAlertedForThisSilence) {
    return { checked: true, lastEventAt, hoursSilent, alerted: false };
  }

  const whole = Math.round(hoursSilent);
  logger.error('[NayaxFeedWatchdog] Nayax transaction feed is silent', {
    hoursSilent: whole,
    lastEventAt: lastEventAt.toISOString(),
  });

  await sendSecurityAlert(
    `Nayax transaction feed silent for ${whole}h`,
    `<h2>The Nayax transaction feed has gone quiet</h2>
     <p>No transaction event has been received at
     <code>POST /api/webhooks/nayax-events</code> for <strong>${whole} hours</strong>.</p>
     <p>Last event: <strong>${lastEventAt.toISOString()}</strong></p>
     <h3>Why this matters</h3>
     <p>The PetWash 5+1 punch card is computed from this feed, not from Nayax's
     Campaign module. While the feed is silent, <strong>washes are not being
     punched</strong> — a customer's sixth wash will not come up free.</p>
     <h3>Most likely causes, in order</h3>
     <ol>
       <li>The webhook payload changed and the handler is answering
           <code>400 Missing transaction_id</code> — check the Nayax
           <strong>Monyx → Wallyx migration</strong>, which is scheduled for
           September 2026.</li>
       <li>Nayax stopped calling the endpoint (webhook config lost or disabled).</li>
       <li>The bays genuinely had no customers — check MoMa before assuming a fault.</li>
     </ol>
     <p>Machines: 182403, 182374, 182443, 182462.</p>`,
  );

  alreadyAlertedForThisSilence = true;
  return { checked: true, lastEventAt, hoursSilent, alerted: true };
}

/** Test seam — the module-level latch would otherwise leak between tests. */
export function __resetFeedWatchdogLatch(): void {
  alreadyAlertedForThisSilence = false;
}
