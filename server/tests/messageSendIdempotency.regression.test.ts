/**
 * messageSendIdempotency — CEO DEEP-LOGIC §9, §15.
 *
 * A flaky-network tap-Send / tap-Send-again must NOT create two
 * messages. The pin exercises the actual runtime (this module is pure
 * of DB) plus the wire in thread-chat.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  findPriorSend,
  recordSendResolution,
  _resetSendIdempotencyForTests,
} from '../services/marketplace/messageSendIdempotency';

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'thread-chat.ts'),
  'utf8',
);

beforeEach(() => {
  _resetSendIdempotencyForTests();
});

describe('runtime — first send wins; replay resolves to the same id', () => {
  it('an unseen triple returns null', () => {
    expect(findPriorSend('nir', 't1', 'client-abc')).toBeNull();
  });

  it('recording resolves subsequent lookups to the same message id', () => {
    recordSendResolution('nir', 't1', 'client-abc', 'msg_42');
    expect(findPriorSend('nir', 't1', 'client-abc')).toBe('msg_42');
    // Repeated lookups keep returning the same id.
    expect(findPriorSend('nir', 't1', 'client-abc')).toBe('msg_42');
  });

  it('a different clientMessageId is INDEPENDENT — new intent = new send', () => {
    recordSendResolution('nir', 't1', 'client-abc', 'msg_42');
    expect(findPriorSend('nir', 't1', 'client-xyz')).toBeNull();
  });

  it('a different sender / thread is INDEPENDENT — no cross-user replay', () => {
    recordSendResolution('nir', 't1', 'client-abc', 'msg_42');
    expect(findPriorSend('sarah', 't1', 'client-abc')).toBeNull();
    expect(findPriorSend('nir', 't2', 'client-abc')).toBeNull();
  });

  it('expired entries are dropped on lookup', () => {
    // Record with a past expiry — findPriorSend must return null.
    const past = Date.now() - 25 * 60 * 60 * 1000; // 25h ago
    recordSendResolution('nir', 't1', 'client-abc', 'msg_42', past);
    expect(findPriorSend('nir', 't1', 'client-abc')).toBeNull();
  });
});

describe('thread-chat.ts wire (§9)', () => {
  it('imports the idempotency helpers', () => {
    expect(ROUTE).toMatch(
      /findPriorSend[\s\S]{0,120}recordSendResolution[\s\S]{0,120}from '\.\.\/services\/marketplace\/messageSendIdempotency'/,
    );
  });

  it('schema accepts an optional clientMessageId (min 4, max 128)', () => {
    expect(ROUTE).toMatch(/clientMessageId: z\.string\(\)\.min\(4\)\.max\(128\)\.optional/);
  });

  it('when a prior send exists, returns { deduplicated: true } and skips the insert', () => {
    const idx = ROUTE.indexOf('const prior = findPriorSend(');
    expect(idx).toBeGreaterThan(0);
    const end = ROUTE.indexOf('}', idx + 200);
    const block = ROUTE.slice(idx, end);
    expect(block).toMatch(/deduplicated:\s*true/);
    expect(block).toMatch(/messageId:\s*prior/);
  });

  it('records the resolution AFTER commit, using the inserted row id', () => {
    // The recordSendResolution call must come after the db.transaction
    // block that produced `inserted`. We assert both by name proximity.
    const txIdx = ROUTE.indexOf('const inserted = await db.transaction');
    const recIdx = ROUTE.indexOf('recordSendResolution(');
    expect(txIdx).toBeGreaterThan(0);
    expect(recIdx).toBeGreaterThan(txIdx);
    // The passed id is the DB row id, not the client-supplied string.
    const recSlice = ROUTE.slice(recIdx, recIdx + 200);
    expect(recSlice).toMatch(/String\(inserted\.id\)/);
  });
});
