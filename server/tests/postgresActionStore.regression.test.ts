/**
 * PostgresActionStore — regression pin (source-anchored).
 *
 * CEO §6 durable atomic idempotency. Locks:
 *   • Uses the existing idempotency_keys table (reuse, not new universe).
 *   • claim() is INSERT ... ON CONFLICT (atomic — no SELECT-then-INSERT race).
 *   • finalize() is UPDATE — idempotent re-writes.
 *   • Composite key: `<key>::<uid>::<actionType>` — actor-scoped dedup.
 *   • Pending sibling → PROCESSING stub with IDEMPOTENCY_REPLAY reason.
 *   • Corrupt row → PROCESSING stub, never crash the request.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'PostgresActionStore.ts'),
  'utf8',
);

describe('CEO §6 — reuse existing idempotency_keys table (no new universe)', () => {
  it('references the existing idempotency_keys table', () => {
    expect(SRC).toMatch(/idempotency_keys/);
    // Do NOT create a parallel action_execution_log or similar.
    expect(SRC).not.toMatch(/CREATE TABLE/i);
    expect(SRC).not.toMatch(/action_execution_log|action_store/);
  });

  it('composite key layout is `<key>::<uid>::<actionType>`', () => {
    expect(SRC).toMatch(
      /function composeKey[\s\S]{0,300}\$\{idempotencyKey\}::\$\{actorUid\}::\$\{actionType\}/,
    );
  });
});

describe('claim() is atomic — INSERT ... ON CONFLICT, never SELECT-then-INSERT', () => {
  it('uses INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key', () => {
    expect(SRC).toMatch(
      /INSERT INTO idempotency_keys[\s\S]{0,300}ON CONFLICT \(key\) DO NOTHING[\s\S]{0,80}RETURNING key/,
    );
  });

  it('non-empty RETURNING → claimed:true; empty → read prior', () => {
    expect(SRC).toMatch(/if \(wonRows\.length > 0\) return \{ claimed: true \}/);
  });

  it('pending sibling → PROCESSING stub with IDEMPOTENCY_REPLAY reason', () => {
    expect(SRC).toMatch(/body === PENDING_MARKER/);
    expect(SRC).toMatch(/status:\s*'PROCESSING'/);
    expect(SRC).toMatch(/code:\s*['"]IDEMPOTENCY_REPLAY['"]/);
  });

  it('finalized sibling deserialises stored ActionResult', () => {
    expect(SRC).toMatch(/JSON\.parse\(body\) as ActionResult/);
  });

  it('corrupt row does NOT crash the request — falls back to PROCESSING', () => {
    expect(SRC).toMatch(
      /catch[\s\S]{0,300}status:\s*'PROCESSING'[\s\S]{0,120}code:\s*['"]IDEMPOTENCY_REPLAY['"]/,
    );
  });
});

describe('finalize() is UPDATE — idempotent', () => {
  it('uses UPDATE SET response_hash where key matches', () => {
    expect(SRC).toMatch(
      /UPDATE idempotency_keys[\s\S]{0,120}SET response_hash =[\s\S]{0,120}WHERE key = /,
    );
  });

  it('body is JSON-serialised — deserialiser above must match', () => {
    expect(SRC).toMatch(/JSON\.stringify\(record\.result\)/);
  });
});
