/**
 * providerReadiness.ts — CEO §23 provider "search/booking eligibility"
 * derived from real prerequisites.
 *
 * The admin approve endpoint seeds a starter rate card and a weekly
 * availability template at approval time (CEO §73 #13/#14), but the
 * CEO §73 audit (2026-08-28) called out that those values must NOT be
 * treated as authoritative until the provider explicitly confirms them
 * on their dashboard — otherwise search would advertise schedules and
 * rates the provider never chose (product + financial risk).
 *
 * This module answers the question "may I quote / advertise this
 * provider?" from the CANONICAL flags:
 *   • providers.platform_data.weeklyAvailability.confirmed
 *   • provider_rate_cards.pricing_rules.confirmed
 *
 * Callers: quote engine, marketplace search, provider dashboard's
 * "you can be booked" banner. Every reader that treats the seeded
 * values as bookable must gate on these functions.
 *
 * Fail-safe: any read failure returns `false` (not bookable). Better
 * to under-advertise a provider than to advertise a schedule they
 * never chose.
 */
import { pool } from '../db';

type Platform = 'walk_my_pet' | 'sitter_suite' | 'pet_trek' | 'academy' | 'k9000';

/**
 * Did the provider explicitly confirm their weekly availability template
 * on this platform? Reads providers.platform_data.weeklyAvailability
 * .confirmed. Returns false for missing rows, missing keys, and errors.
 */
export async function isProviderAvailabilityConfirmed(
  userId: string,
  platform: Platform,
): Promise<boolean> {
  try {
    const r = await pool.query<{ platform_data: unknown }>(
      `SELECT platform_data FROM providers
        WHERE user_id = $1 AND platform_id = $2
        LIMIT 1`,
      [userId, platform],
    );
    const row = r.rows[0];
    if (!row) return false;
    const pd = row.platform_data as Record<string, unknown> | null;
    if (!pd || typeof pd !== 'object') return false;
    const wa = (pd as any).weeklyAvailability;
    return !!wa && typeof wa === 'object' && wa.confirmed === true;
  } catch {
    return false;
  }
}

/**
 * Did the provider explicitly confirm their pricing on this platform?
 * Reads provider_rate_cards.pricing_rules.confirmed. Any row for the
 * (userId, platform) counts — the provider dashboard operates on a
 * single active rate card per service.
 */
export async function isProviderPricingConfirmed(
  userId: string,
  platform: Platform,
): Promise<boolean> {
  try {
    const r = await pool.query<{ pricing_rules: unknown }>(
      `SELECT pricing_rules FROM provider_rate_cards
        WHERE provider_id = $1 AND platform = $2
        ORDER BY updated_at DESC
        LIMIT 1`,
      [userId, platform],
    );
    const row = r.rows[0];
    if (!row) return false;
    const pr = row.pricing_rules as Record<string, unknown> | null;
    if (!pr || typeof pr !== 'object') return false;
    return (pr as any).confirmed === true;
  } catch {
    return false;
  }
}

export interface ProviderReadiness {
  pricingConfirmed: boolean;
  availabilityConfirmed: boolean;
  bookingEligible: boolean;
  reasons: string[];
}

/**
 * Composite readiness: bookingEligible === true only when BOTH
 * pricing and availability are provider-confirmed. Adds diagnostic
 * reason strings so a UI can render "waiting on the provider to
 * confirm their rates" instead of an empty state.
 */
export async function getProviderReadiness(
  userId: string,
  platform: Platform,
): Promise<ProviderReadiness> {
  const [pricingConfirmed, availabilityConfirmed] = await Promise.all([
    isProviderPricingConfirmed(userId, platform),
    isProviderAvailabilityConfirmed(userId, platform),
  ]);
  const reasons: string[] = [];
  if (!pricingConfirmed)      reasons.push('pricing_not_confirmed');
  if (!availabilityConfirmed) reasons.push('availability_not_confirmed');
  return {
    pricingConfirmed,
    availabilityConfirmed,
    bookingEligible: pricingConfirmed && availabilityConfirmed,
    reasons,
  };
}

/**
 * Provider-invoked confirmation: flip the `confirmed` flag on the
 * pricing rules jsonb. Preserves any existing pricing_rules keys so
 * a later refinement doesn't stomp on a schedule the provider tuned.
 * Idempotent — a second confirmation is a no-op.
 */
export async function confirmProviderPricing(
  userId: string,
  platform: Platform,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE provider_rate_cards
        SET pricing_rules = COALESCE(pricing_rules, '{}'::jsonb)
                            || jsonb_build_object(
                                 'confirmed',   true,
                                 'confirmedAt', NOW()::text,
                                 'source',      'provider_confirmed'
                               ),
            updated_at = NOW()
      WHERE provider_id = $1 AND platform = $2`,
    [userId, platform],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Provider-invoked confirmation for availability: flip
 * platform_data.weeklyAvailability.confirmed. Preserves the
 * `template` sub-object so a later refinement doesn't lose the
 * schedule the provider already tuned.
 */
export async function confirmProviderAvailability(
  userId: string,
  platform: Platform,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE providers
        SET platform_data = COALESCE(platform_data, '{}'::jsonb)
                            || jsonb_build_object(
                                 'weeklyAvailability',
                                   COALESCE(platform_data->'weeklyAvailability', '{}'::jsonb)
                                   || jsonb_build_object(
                                        'confirmed',   true,
                                        'confirmedAt', NOW()::text,
                                        'source',      'provider_confirmed'
                                      )
                               ),
            updated_at = NOW()
      WHERE user_id = $1 AND platform_id = $2`,
    [userId, platform],
  );
  return (r.rowCount ?? 0) > 0;
}
