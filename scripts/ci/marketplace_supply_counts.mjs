/**
 * Marketplace supply truth (read-only, counts only) — 2026-09-18.
 *
 * The live search returns ZERO walkers and ZERO sitters for every city. Either
 * nobody has signed up, or people signed up and a gate hides them. Guessing
 * costs weeks, so this counts rows per gate. No names, emails or phones — only
 * counts, so it is safe to print in a CI log.
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const show = async (label, query) => {
  try {
    const rows = await query();
    console.log(`\n## ${label}`);
    if (rows.length === 0) console.log('   (no rows)');
    for (const r of rows) console.log('   ' + Object.entries(r).map(([k, v]) => `${k}=${v}`).join('  '));
  } catch (e) {
    console.log(`\n## ${label}\n   ERROR ${e.message.slice(0, 160)}`);
  }
};

await show('providers by platform + active', () => sql`
  SELECT platform_id, is_active, COUNT(*)::int AS n FROM providers GROUP BY 1,2 ORDER BY 1,2`);
await show('walker_profiles by verification + availability', () => sql`
  SELECT verification_status, is_available, COUNT(*)::int AS n FROM walker_profiles GROUP BY 1,2 ORDER BY 1,2`);
await show('sitter_profiles by verification + availability', () => sql`
  SELECT verification_status, is_available, COUNT(*)::int AS n FROM sitter_profiles GROUP BY 1,2 ORDER BY 1,2`);
await show('trainer_profiles by status', () => sql`
  SELECT COALESCE(verification_status,'(null)') AS verification_status, COUNT(*)::int AS n FROM trainer_profiles GROUP BY 1 ORDER BY 1`);
await show('provider applications by status', () => sql`
  SELECT COALESCE(status,'(null)') AS status, COUNT(*)::int AS n FROM provider_applications GROUP BY 1 ORDER BY 2 DESC`);
await show('users by role (top 10)', () => sql`
  SELECT COALESCE(role,'(null)') AS role, COUNT(*)::int AS n FROM users GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
await show('signups per week (last 8)', () => sql`
  SELECT date_trunc('week', created_at)::date AS week, COUNT(*)::int AS n FROM users
  WHERE created_at > now() - interval '8 weeks' GROUP BY 1 ORDER BY 1`);
await show('booking_requests by status', () => sql`
  SELECT status, COUNT(*)::int AS n FROM booking_requests GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);
await show('walk_bookings / sitter_bookings totals', () => sql`
  SELECT (SELECT COUNT(*)::int FROM walk_bookings) AS walks,
         (SELECT COUNT(*)::int FROM sitter_bookings) AS sitter_stays,
         (SELECT COUNT(*)::int FROM trainer_bookings) AS academy`);
await show('rate cards present (price gate)', () => sql`
  SELECT (SELECT COUNT(*)::int FROM provider_rate_cards) AS rate_cards,
         (SELECT COUNT(*)::int FROM provider_operational_settings) AS operational_settings`);
await show('station_registry (after 0163)', () => sql`
  SELECT station_id, city, is_active, jsonb_array_length(COALESCE(bays,'[]'::jsonb)) AS bays FROM station_registry ORDER BY station_id`);
console.log('\n(counts only — no personal data was read)');
