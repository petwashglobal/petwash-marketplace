import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Schema-migration drift 2026-08-20 — regression pins for migration 0121.
 *
 * Four tables the code has been INSERT-ing / SELECT-ing against for months
 * without any migration ever creating them. Three of the errors were
 * swallowed by best-effort try/catch so metrics were quiet, but the
 * guarantee the caller relied on (idempotency, durable retry, audit
 * anchor) was silently violated.
 *
 *   #1 google_sheets_idempotency  — form-submission dupe suppression
 *   #2 google_sheets_retry_queue  — durable retry for failed Sheets appends
 *   #3 campaign_trigger_log       — marketing-send de-dupe + wash-reminder audit
 *   #4 message_reactions          — booking-chat emoji reactions (500 per click)
 *
 * These pins fail PR CI if a refactor:
 *   - removes the CREATE TABLE from 0121
 *   - removes the drizzle pgTable definition
 *   - removes the UNIQUE index that backs an ON CONFLICT elsewhere
 */

const ROOT           = join(__dirname, '..', '..');
const MIGRATION_PATH = join(ROOT, 'migrations', '0121_schema_migration_drift_2026_08_20.sql');
const MIGRATION      = readFileSync(MIGRATION_PATH, 'utf8');
const SCHEMA         = readFileSync(join(ROOT, 'shared', 'schema.ts'), 'utf8');

const expectTable = (raw: string) => {
  const migRe     = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${raw}\\b`, 'i');
  const drizzleRe = new RegExp(`pgTable\\(\\s*["']${raw}["']\\s*,\\s*\\{`);
  expect(MIGRATION, `migration must CREATE TABLE IF NOT EXISTS ${raw}`).toMatch(migRe);
  expect(SCHEMA,    `shared/schema.ts must define pgTable('${raw}', {...})`).toMatch(drizzleRe);
};

describe('schema-migration drift 2026-08-20 — migration 0121 regression pins', () => {
  // ─── #1 google_sheets_idempotency ──────────────────────────────────────────
  it('#1 creates google_sheets_idempotency + UNIQUE(idempotency_key) that backs the anchor SELECT', () => {
    expectTable('google_sheets_idempotency');
    // The idempotency-key short-circuit at googleSheetsIntegration.ts:787 is a
    // point lookup; the ON CONFLICT DO NOTHING at :806 needs a UNIQUE index.
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]{0,120}?ON google_sheets_idempotency\s*\(idempotency_key\)/,
    );
  });

  // ─── #2 google_sheets_retry_queue ──────────────────────────────────────────
  it('#2 creates google_sheets_retry_queue with the columns the retry worker writes', () => {
    expectTable('google_sheets_retry_queue');
    // The worker SELECT is `WHERE status = 'pending' AND next_retry_at <= NOW()`.
    expect(MIGRATION).toMatch(/status\s+text\s+NOT NULL DEFAULT 'pending'/);
    expect(MIGRATION).toMatch(/next_retry_at\s+timestamp\s+NOT NULL DEFAULT NOW\(\)/);
    // Hot-path partial index for the worker's due-now scan.
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS[\s\S]{0,200}?ON google_sheets_retry_queue\s*\(status,\s*next_retry_at\)\s*WHERE\s+status = 'pending'/,
    );
  });

  // ─── #3 campaign_trigger_log ──────────────────────────────────────────────
  it('#3 creates campaign_trigger_log + partial UNIQUEs for null-safe de-dupe', () => {
    expectTable('campaign_trigger_log');
    // CampaignDeliveryService uses ON CONFLICT (campaign_type, user_id, coupon_id)
    // — must be UNIQUE when coupon_id is set. Wash-reminder writes coupon_id=NULL
    // and relies on de-dupe by (campaign_type, user_id) — must be UNIQUE when
    // coupon_id is null, because PG treats NULLs as distinct in plain UNIQUE.
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]{0,200}?ON campaign_trigger_log\s*\(campaign_type,\s*user_id,\s*coupon_id\)\s*WHERE\s+coupon_id IS NOT NULL/,
    );
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]{0,200}?ON campaign_trigger_log\s*\(campaign_type,\s*user_id\)\s*WHERE\s+coupon_id IS NULL/,
    );
    // wash-reminder recency probe reads (campaign_type, user_id, sent_at).
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS[\s\S]{0,200}?ON campaign_trigger_log\s*\(campaign_type,\s*user_id,\s*sent_at DESC\)/,
    );
  });

  // ─── #4 message_reactions ─────────────────────────────────────────────────
  it('#4 creates message_reactions with UNIQUE(message_id, user_id, reaction)', () => {
    expectTable('message_reactions');
    // Toggle logic + `ON CONFLICT DO NOTHING` at booking-chat.ts:1681 rely on
    // this triplet being unique (double-tap race safety).
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]{0,200}?ON message_reactions\s*\(message_id,\s*user_id,\s*reaction\)/,
    );
    // Count aggregation at :1687 (GROUP BY reaction WHERE message_id=$).
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS[\s\S]{0,120}?ON message_reactions\s*\(message_id\)/,
    );
  });

  // ─── Caller-shape pins — the source-of-truth for each column list ─────────
  it('googleSheetsIntegration.ts still writes the columns the migration declares', () => {
    const src = readFileSync(join(ROOT, 'server', 'services', 'googleSheetsIntegration.ts'), 'utf8');
    // Idempotency: (idempotency_key, sheet_name, created_at) — verify all three appear together.
    expect(src).toMatch(
      /INSERT INTO google_sheets_idempotency \(idempotency_key, sheet_name, created_at\)/,
    );
    // Retry queue: (sheet_name, data, attempts, status, error_message, next_retry_at)
    expect(src).toMatch(
      /INSERT INTO google_sheets_retry_queue[\s\S]{0,200}?\(sheet_name, data, attempts, status, error_message, next_retry_at\)/,
    );
  });

  it('CampaignDeliveryService.ts still writes the columns the migration declares', () => {
    const src = readFileSync(join(ROOT, 'server', 'services', 'CampaignDeliveryService.ts'), 'utf8');
    expect(src).toMatch(
      /INSERT INTO campaign_trigger_log \(campaign_type, user_id, coupon_id, channel, status, sent_at\)/,
    );
    expect(src).toMatch(
      /ON CONFLICT \(campaign_type, user_id, coupon_id\) DO NOTHING/,
    );
  });

  it('booking-chat.ts still writes the columns the migration declares', () => {
    const src = readFileSync(join(ROOT, 'server', 'routes', 'booking-chat.ts'), 'utf8');
    expect(src).toMatch(
      /INSERT INTO message_reactions \(message_id, user_id, reaction\)/,
    );
    expect(src).toMatch(/ON CONFLICT DO NOTHING/);
  });
});
