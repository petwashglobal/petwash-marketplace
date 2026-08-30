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

  it('composite key layout is bounded — namespace prefix + label + sha256 hash', () => {
    // CEO DEEP-LOGIC §27 — plain concatenation of the tuple gave up to
    // 172 chars, which overflowed the middleware's 128 cap. The store
    // now hashes the tuple to a fixed-width form ≤ 85 chars.
    expect(SRC).toMatch(
      /function composeKey[\s\S]{0,500}crypto\.createHash\('sha256'\)\.update\(canonical\)\.digest\('hex'\)\.slice\(0, 40\)/,
    );
    // Namespace prefix is 'act:' so a grep on the shared
    // idempotency_keys table can identify Action Brain rows without
    // needing schema help.
    expect(SRC).toMatch(/ACTION_BRAIN_KEY_PREFIX = 'act:'/);
  });

  it('bounded to ≤85 chars for ANY input tuple (§27 arithmetic fix)', () => {
    // Force-check the compose formula: prefix + label(≤40) + ':' + hash(40)
    // = at most 4 + 40 + 1 + 40 = 85. The pin locks the shape so a
    // later "just add the raw values back for debugging" cannot pass
    // review.
    expect(SRC).toMatch(/const label = actionType\.slice\(0, 40\)/);
    expect(SRC).toMatch(
      /return `\$\{ACTION_BRAIN_KEY_PREFIX\}\$\{label\}:\$\{hash\}`/,
    );
    // Old plain-concat form must NOT reappear in the composer.
    const composeIdx = SRC.indexOf('function composeKey');
    const composeEnd = SRC.indexOf('\n}\n', composeIdx);
    const composerBody = SRC.slice(composeIdx, composeEnd);
    expect(composerBody).not.toMatch(/\$\{idempotencyKey\}::\$\{actorUid\}::\$\{actionType\}/);
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

  it('pending sibling → PROCESSING stub with IDEMPOTENCY_REPLAY reason (fresh lease)', () => {
    // §41 envelope OR legacy string both surface as PROCESSING.
    expect(SRC).toMatch(/if \(pending \|\| body === PENDING_MARKER\)/);
    // Both fresh and expired leases surface PROCESSING; the caller
    // distinguishes via the userMessage.code (IDEMPOTENCY_REPLAY vs
    // LEASE_EXPIRED_RECONCILE_REQUIRED). PROCESSING is the stable
    // ActionStatus until the shared shape carries UNKNOWN_OUTCOME.
    expect(SRC).toMatch(/status:\s*'PROCESSING'/);
    expect(SRC).toMatch(/code:\s*['"]IDEMPOTENCY_REPLAY['"]/);
  });

  it('CEO DEEP-LOGIC §41-§42 — expired lease surfaces as LEASE_EXPIRED_RECONCILE_REQUIRED', () => {
    // The pending envelope carries executionId + leaseUntil; an
    // expired lease surfaces distinctly so the caller (which knows
    // the domain) can reconcile before deciding to reclaim.
    expect(SRC).toMatch(/LEASE_EXPIRED_RECONCILE_REQUIRED/);
    expect(SRC).toMatch(/const leaseExpired = !!pending && pending\.leaseUntil < now/);
    expect(SRC).toMatch(/PENDING_ENVELOPE_MARKER = 'pending_v2'/);
    expect(SRC).toMatch(/interface PendingEnvelope/);
    expect(SRC).toMatch(/executionId: crypto\.randomBytes\(8\)\.toString\('hex'\)/);
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
