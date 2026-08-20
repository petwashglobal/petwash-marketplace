import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * DB-drift SEV-1 audit 2026-08-20 — regression pins.
 *
 * Six production 500 sources traced to schema drift between prod code and
 * the migration set:
 *   #1 loyalty_activity_log   — loyalty award tx rolled back
 *   #2 coupon_reservations    — confirmReservation() 500'd every coupon apply
 *   #3 system_events          — every ThreatGuard / anomaly stamp swallowed
 *   #4 SLA-monitor cron       — 6 missing tables in one job
 *   #5 stale rename queries   — refunds / payout_entries / kill_switches
 *   #6 remittance_email_log   — monthly payout emails died on upsert
 *
 * PR "Fix: 6 DB drift SEV-1s — 10 missing tables + 3 stale-rename queries".
 * A future refactor that undoes any of the ten CREATE TABLEs, the ON CONFLICT
 * UNIQUE, or the three renames fails PR CI.
 */

const ROOT              = join(__dirname, '..', '..');
const MIGRATION_PATH    = join(ROOT, 'migrations', '0120_db_drift_sev1_2026_08_20.sql');
const MIGRATION         = readFileSync(MIGRATION_PATH, 'utf8');
const PRESTIGE_PASS     = readFileSync(join(ROOT, 'server', 'routes', 'prestige-pass.ts'), 'utf8');
const SCHEMA            = readFileSync(join(ROOT, 'shared', 'schema.ts'), 'utf8');
const SCHEMA_LOYALTY    = readFileSync(join(ROOT, 'shared', 'schema-loyalty.ts'), 'utf8');
const ALL_SCHEMA        = SCHEMA + '\n' + SCHEMA_LOYALTY;

// Helper: assert both a CREATE TABLE IF NOT EXISTS statement and a matching
// drizzle pgTable('X', {...}) definition are present.
const expectTable = (raw: string, pgName: string) => {
  const migRe = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${raw}\\b`, 'i');
  const drizzleRe = new RegExp(`pgTable\\(\\s*["']${raw}["']\\s*,\\s*\\{`);
  expect(MIGRATION,  `migration must CREATE TABLE IF NOT EXISTS ${raw}`).toMatch(migRe);
  expect(ALL_SCHEMA, `shared/schema*.ts must define pgTable('${raw}', {...})`).toMatch(drizzleRe);
};

describe('DB drift SEV-1 2026-08-20 — regression pins', () => {
  // ─── #1 loyalty_activity_log ─────────────────────────────────────────────
  it('#1 migration 0120 creates loyalty_activity_log + drizzle model exists', () => {
    expectTable('loyalty_activity_log', 'loyalty_activity_log');
    // Columns the loyaltySync SELECT + INSERT rely on.
    expect(MIGRATION).toMatch(/user_id\s+text\s+NOT NULL/);
    expect(MIGRATION).toMatch(/points_delta\s+integer\s+NOT NULL/);
    expect(MIGRATION).toMatch(/metadata\s+jsonb/);
    // Supporting index for the (user_id, created_at DESC) queries.
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS[\s\S]{0,120}?ON loyalty_activity_log\s*\(user_id,\s*created_at DESC\)/,
    );
  });

  // ─── #2 coupon_reservations ──────────────────────────────────────────────
  it('#2 migration 0120 creates coupon_reservations + drizzle model exists', () => {
    expectTable('coupon_reservations', 'coupon_reservations');
    // reservation_id is the text PK the code inserts (e.g. `R-${nanoid(16)}`).
    expect(MIGRATION).toMatch(/reservation_id\s+text\s+PRIMARY KEY/);
    // The confirmReservation() FOR UPDATE + status transitions need the status col.
    expect(MIGRATION).toMatch(/status\s+text\s+NOT NULL DEFAULT 'reserved'/);
  });

  // ─── #3 system_events ────────────────────────────────────────────────────
  it('#3 migration 0120 creates system_events + drizzle model exists', () => {
    expectTable('system_events', 'system_events');
    // The three indexes the spec calls out.
    expect(MIGRATION).toMatch(/CREATE INDEX IF NOT EXISTS[\s\S]{0,120}?ON system_events\s*\(created_at DESC\)/);
    expect(MIGRATION).toMatch(/CREATE INDEX IF NOT EXISTS[\s\S]{0,120}?ON system_events\s*\(event_type,\s*created_at DESC\)/);
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS[\s\S]{0,200}?ON system_events\s*\(severity,\s*resolved_at\)\s*WHERE\s+resolved_at IS NULL/,
    );
  });

  // ─── #4 SLA-monitor cron: 6 tables + ON CONFLICT UNIQUE ──────────────────
  it('#4 migration 0120 creates all 6 SLA tables + drizzle models exist', () => {
    for (const t of [
      'case_assignments',
      'teams',
      'team_members',
      'case_sla_states',
      'case_escalation_log',
      'case_notes',
    ]) {
      expectTable(t, t);
    }
  });

  it('#4 case_sla_states has UNIQUE(case_type, case_ref_id) for the ON CONFLICT upsert at sla-monitor.ts:276', () => {
    // Either as an inline CONSTRAINT or a stand-alone UNIQUE(...) — accept both shapes.
    expect(MIGRATION).toMatch(
      /UNIQUE\s*\(\s*case_type\s*,\s*case_ref_id\s*\)/,
    );
    // Drizzle model must express the same constraint.
    expect(SCHEMA).toMatch(/unique\(\s*["']case_sla_states_case_uniq["']\s*\)\.on\(\s*t\.caseType\s*,\s*t\.caseRefId\s*\)/);
  });

  // ─── #5 three renamed queries in prestige-pass.ts ────────────────────────
  it('#5 prestige-pass.ts no longer contains `FROM refunds` (renamed to booking_refunds)', () => {
    // Word-boundary regex avoids false positives on longer names (booking_refunds itself).
    expect(PRESTIGE_PASS).not.toMatch(/FROM\s+refunds\b/);
  });

  it('#5 prestige-pass.ts no longer contains `FROM payout_entries` (renamed to provider_payout_entries)', () => {
    expect(PRESTIGE_PASS).not.toMatch(/FROM\s+payout_entries\b/);
    // Also guard the LEFT JOIN form used in three orphan-payout audits.
    expect(PRESTIGE_PASS).not.toMatch(/JOIN\s+payout_entries\b/);
  });

  it('#5 prestige-pass.ts no longer contains `FROM kill_switches` or `INTO kill_switches` (renamed to system_kill_switches)', () => {
    expect(PRESTIGE_PASS).not.toMatch(/FROM\s+kill_switches\b/);
    expect(PRESTIGE_PASS).not.toMatch(/INTO\s+kill_switches\b/);
  });

  // ─── #6 remittance_email_log ─────────────────────────────────────────────
  it('#6 migration 0120 creates remittance_email_log with composite PK (batch_id, provider_uid)', () => {
    expectTable('remittance_email_log', 'remittance_email_log');
    // ON CONFLICT (batch_id, provider_uid) requires that pair to be a UNIQUE
    // constraint — the migration expresses it as PRIMARY KEY.
    expect(MIGRATION).toMatch(
      /PRIMARY KEY\s*\(\s*batch_id\s*,\s*provider_uid\s*\)/,
    );
  });
});
