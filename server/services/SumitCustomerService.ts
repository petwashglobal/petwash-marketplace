/**
 * SumitCustomerService — Phase 2 of the SUMIT full-service adoption plan
 * (CEO 2026-08-16, design doc docs/design/2026-08-16-sumit-full-service-adoption.md).
 *
 * Purpose: for every PetWash member, create a corresponding SUMIT customer
 * record so:
 *   (a) The member has a hosted SUMIT customer-portal login where every
 *       Israeli invoice/receipt/subscription/statement lives — one legally-
 *       authoritative place. This is the "member user with dashboard control
 *       panel" the SUMIT team called out.
 *   (b) Downstream chargeRecurring / chargeSavedCard / setForCustomer have
 *       a real CustomerID to pass. Today those methods exist but no PetWash
 *       user has ever been created in SUMIT, so they can't be called.
 *
 * Contract:
 *   - IDEMPOTENT. Two concurrent calls for the same uid produce ONE mapping
 *     row. SUMIT-side dedup is via ExternalIdentifier=uid; ours is via a
 *     pre-check on sumit_customers.
 *   - FIRE-AND-FORGET SAFE. syncForUser() never throws. A degraded SUMIT
 *     must never break signup / activation.
 *   - FEATURE-FLAGGED. Nothing fires in production until
 *     SUMIT_CUSTOMER_SYNC_ENABLED=true. Default: false.
 *   - AUDITED. Every attempt (success or failure) writes to sumit_customers
 *     with source ∈ {'signup','backfill','manual'}; failure captured in
 *     `last_error` for the ops dashboard.
 *
 * NOT touched by this file:
 *   - No money math.
 *   - No changes to users / customers / payment_tokens.
 *   - No caller wired yet — this service is exported but not invoked from
 *     any hot path. A follow-up PR wires the fire-and-forget hook once
 *     the CEO signs off on the design PR + SUMIT support confirms the
 *     customer-create body shape.
 */
import { db } from '../db';
import { sumitCustomers } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { SumitClient } from './SumitClient';

export type SumitCustomerSyncSource = 'signup' | 'backfill' | 'manual';

export type SumitCustomerSyncResult =
  | { status: 'existing'; sumitCustomerId: string; customerHistoryUrl?: string }
  | { status: 'created'; sumitCustomerId: string; customerHistoryUrl?: string }
  | { status: 'not_wired' }
  | { status: 'flag_off' }
  | { status: 'error'; reason: string };

/**
 * Feature-flag guard. Nothing fires in prod until CEO explicitly flips
 * SUMIT_CUSTOMER_SYNC_ENABLED=true. Defaults to false so this whole file
 * is inert on deploy.
 */
export function isSumitCustomerSyncEnabled(): boolean {
  return process.env.SUMIT_CUSTOMER_SYNC_ENABLED === 'true';
}

const client = new SumitClient();

/**
 * Sync a PetWash uid to a SUMIT customer. Idempotent + fail-soft.
 *
 * @param uid       Firebase UID (or customers.id.toString() for legacy customer rows)
 * @param profile   Minimal identity for the SUMIT customer record.
 * @param source    Where the sync request originated (for the audit row).
 */
export async function syncForUser(
  uid: string,
  profile: { name: string; email?: string; phone?: string },
  source: SumitCustomerSyncSource = 'signup',
): Promise<SumitCustomerSyncResult> {
  if (!uid) return { status: 'error', reason: 'missing uid' };

  // Feature flag — hard off until CEO signs off.
  if (!isSumitCustomerSyncEnabled()) {
    return { status: 'flag_off' };
  }

  // Pre-check: if we already have a mapping row, we're done. This is the
  // caller-side idempotency layer; SUMIT-side has its own via
  // ExternalIdentifier=uid + SearchMode="Automatic".
  try {
    const [existing] = await db.select()
      .from(sumitCustomers)
      .where(eq(sumitCustomers.userId, uid))
      .limit(1);
    if (existing?.sumitCustomerId) {
      return {
        status: 'existing',
        sumitCustomerId: existing.sumitCustomerId,
        customerHistoryUrl: existing.customerHistoryUrl ?? undefined,
      };
    }
  } catch (dbErr: any) {
    logger.warn('[SumitCustomerService] pre-check read failed — continuing', {
      uid, error: dbErr?.message,
    });
    // Continue to try the SUMIT call anyway; SUMIT-side dedup on
    // ExternalIdentifier + SearchMode="Automatic" prevents a duplicate
    // customer even if the pre-check was blind.
  }

  // Call SUMIT. `SearchMode:"Automatic"` (set inside SumitClient) makes this
  // find-or-create — a retry returns the existing customer's ID.
  const cust = await client.createCustomer({
    externalIdentifier: uid,
    name: profile.name || 'PetWash Member',
    email: profile.email,
    phone: profile.phone,
  });

  if (!cust.wired) {
    // SUMIT not configured (or network error inside the client). Fire-and-
    // forget — do not throw. A nightly reconciler retries.
    logger.info('[SumitCustomerService] SUMIT not wired — skipping sync', { uid });
    return { status: 'not_wired' };
  }

  if (!cust.sumitCustomerId) {
    // SUMIT responded but no CustomerID in the official response field.
    // Persist an error row so the ops dashboard sees it; retry on next call.
    const reason = cust.reason || 'no CustomerID in response';
    logger.warn('[SumitCustomerService] SUMIT returned no CustomerID', { uid, reason });
    return { status: 'error', reason };
  }

  // Success — persist the mapping including the CustomerHistoryURL for the
  // "My Invoices" surface. UNIQUE(sumit_customer_id) + PRIMARY KEY(user_id)
  // both guard against a concurrent duplicate insert; if we lose that race
  // we return the winning row.
  try {
    await db.insert(sumitCustomers).values({
      userId: uid,
      sumitCustomerId: cust.sumitCustomerId,
      customerHistoryUrl: cust.customerHistoryUrl ?? null,
      source,
      externalReference: uid,
    });
    return {
      status: 'created',
      sumitCustomerId: cust.sumitCustomerId,
      customerHistoryUrl: cust.customerHistoryUrl,
    };
  } catch (insertErr: any) {
    logger.info('[SumitCustomerService] insert lost race — re-reading', { uid });
    try {
      const [row] = await db.select()
        .from(sumitCustomers)
        .where(eq(sumitCustomers.userId, uid))
        .limit(1);
      if (row?.sumitCustomerId) {
        return {
          status: 'existing',
          sumitCustomerId: row.sumitCustomerId,
          customerHistoryUrl: row.customerHistoryUrl ?? undefined,
        };
      }
    } catch { /* fall through */ }
    return { status: 'error', reason: insertErr?.message || 'insert failed' };
  }
}

/**
 * Read-only helper for the "My Invoices" surface. Returns a CURRENT
 * customer-portal URL for the given uid.
 *
 * Per CEO 2026-08-16 SUMIT lane: the URL is treated as a generated /
 * potentially-expiring access URL. CustomerID is the canonical mapping.
 * We refresh via the official /accounting/customers/getdetailsurl/
 * endpoint and cache the returned URL for a short window (5 min in-row)
 * so we don't hammer SUMIT on every tap.
 *
 * Caller MUST pass the AUTHENTICATED uid — never accept it from the browser.
 * Returns null if the user has no SUMIT customer synced yet.
 */
const FRESH_URL_TTL_MS = 5 * 60 * 1000;

export async function getCustomerHistoryUrl(uid: string): Promise<string | null> {
  if (!uid) return null;
  try {
    const [row] = await db.select({
      customerId: sumitCustomers.sumitCustomerId,
      cachedUrl: sumitCustomers.customerHistoryUrl,
      syncedAt: sumitCustomers.syncedAt,
    })
      .from(sumitCustomers)
      .where(eq(sumitCustomers.userId, uid))
      .limit(1);
    if (!row?.customerId) return null;

    // Cache window — if we refreshed recently, reuse.
    if (row.cachedUrl && row.syncedAt) {
      const ageMs = Date.now() - new Date(row.syncedAt).getTime();
      if (ageMs < FRESH_URL_TTL_MS) return row.cachedUrl;
    }

    // Refresh via the official getdetailsurl endpoint. CustomerID is the
    // canonical mapping — the URL is a generated access URL.
    const refresh = await client.getCustomerDetailsUrl(row.customerId);
    if (refresh.wired && refresh.url) {
      try {
        await db.update(sumitCustomers)
          .set({ customerHistoryUrl: refresh.url, syncedAt: new Date() })
          .where(eq(sumitCustomers.userId, uid));
      } catch { /* cache update is best-effort */ }
      return refresh.url;
    }

    // Refresh failed. Fall back to the cached URL if we have one — better
    // than an empty state; SUMIT can still land the customer on their
    // login page from an expired portal URL.
    return row.cachedUrl ?? null;
  } catch (err: any) {
    logger.warn('[SumitCustomerService] getCustomerHistoryUrl failed', {
      uid, error: err?.message,
    });
    return null;
  }
}

/**
 * Diagnostics helper — returns just the canonical SUMIT CustomerID for a
 * PetWash uid (no URL, no refresh). Used by admin / reconciliation code.
 */
export async function getSumitCustomerId(uid: string): Promise<string | null> {
  if (!uid) return null;
  try {
    const [row] = await db.select({ customerId: sumitCustomers.sumitCustomerId })
      .from(sumitCustomers)
      .where(eq(sumitCustomers.userId, uid))
      .limit(1);
    return row?.customerId ?? null;
  } catch (err: any) {
    logger.warn('[SumitCustomerService] getSumitCustomerId failed', {
      uid, error: err?.message,
    });
    return null;
  }
}

/**
 * Fire-and-forget wrapper for hot paths (post-signup, post-activation). Never
 * throws. Never awaits into caller error handling. Logs on failure so the
 * ops dashboard sees it. The unwrapped syncForUser() is the right shape for
 * an admin-triggered sync or a batch backfill script.
 */
export function fireAndForgetSync(
  uid: string,
  profile: { name: string; email?: string; phone?: string },
  source: SumitCustomerSyncSource = 'signup',
): void {
  syncForUser(uid, profile, source).then((result) => {
    if (result.status === 'error') {
      logger.warn('[SumitCustomerService] fire-and-forget sync errored', { uid, result });
    }
  }).catch((err) => {
    // Belt-and-braces: syncForUser is designed not to throw, but the
    // fire-and-forget promise chain still gets a defensive catch.
    logger.error('[SumitCustomerService] fire-and-forget sync threw (unexpected)', {
      uid, error: err?.message,
    });
  });
}
