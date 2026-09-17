import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 2026-09-17: the admin provider-review screens answered 500 in production —
 * /admin/applications/pending-review and /admin/applications/queue join
 * provider_review_queue, a table that existed only in code (created by
 * `drizzle push` on a dev DB, never in a migration). The audit trail and the
 * applicant message thread were in the same state: every write was swallowed
 * by a try/catch, so nobody saw it. Migration 0162 creates them.
 */
const ROOT = resolve(__dirname, '..', '..');
const SQL = readdirSync(join(ROOT, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(ROOT, 'migrations', f), 'utf8'))
  .join('\n');

const TABLES = [
  'provider_review_queue',
  'provider_review_audit',
  'provider_application_threads',
  'provider_application_messages',
];

describe('the provider-review tables are created by a migration, not by drizzle push', () => {
  it.each(TABLES)('%s has a CREATE TABLE', (t) => {
    expect(SQL).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${t}"|CREATE TABLE "${t}"`));
  });

  it('every column the queue code reads exists in the migration', () => {
    const m = SQL.slice(SQL.indexOf('CREATE TABLE IF NOT EXISTS "provider_review_queue"'));
    const block = m.slice(0, m.indexOf(');') + 2);
    for (const col of ['application_id', 'status', 'priority', 'review_reasons', 'due_at', 'assigned_to', 'assigned_at', 'completed_at', 'unread_count', 'created_at']) {
      expect(block).toContain(`"${col}"`);
    }
  });

  it('the message log has its thread pointer column', () => {
    expect(SQL).toMatch(/ALTER TABLE "provider_applications"\s+ADD COLUMN IF NOT EXISTS "communication_thread_id"/);
  });

  it('0162 is runner-safe: no DO blocks (the runner splits on ";")', () => {
    const f = readFileSync(join(ROOT, 'migrations', '0162_provider_review_queue_and_messages.sql'), 'utf8');
    expect(f).not.toMatch(/\$\$/);
    expect(f).not.toMatch(/\bDO\s+\$/);
  });
});
