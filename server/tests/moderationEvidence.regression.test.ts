/**
 * moderationEvidence — regression pin (source-anchored).
 *
 * CEO DEEP-LOGIC §20 + Integrity §6.12 + §29.
 *
 * The general application `logger.info` is the WRONG place for raw
 * blocked-message bodies. This sink owns the retention decision and
 * splits the two surfaces:
 *   • Standard log: metadata only, no raw text, no rule ids.
 *   • Dedicated moderation-evidence channel: raw body IFF
 *     shouldRetainBody(outcome) is true.
 *
 * These pins lock the split so no route can drift back to writing raw
 * bodies to the standard logger.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'moderationEvidence.ts'),
  'utf8',
);

describe('logModerationDecision — safe metadata only', () => {
  it('is exported and takes a ModerationLogContext', () => {
    expect(SRC).toMatch(/export function logModerationDecision\(ctx: ModerationLogContext\): void/);
  });

  it('logs matchCount, NOT the raw matches[] array (§29 — rule ids never leak)', () => {
    const idx = SRC.indexOf('export function logModerationDecision');
    const end = SRC.indexOf('\n}\n', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/matchCount:\s*ctx\.matches\.length/);
    // No raw match array in the standard log.
    expect(body).not.toMatch(/matches:\s*ctx\.matches/);
  });

  it('redacts the sender uid to a tail, never the full uid', () => {
    const idx = SRC.indexOf('export function logModerationDecision');
    const end = SRC.indexOf('\n}\n', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/senderUidTail:\s*tail\(ctx\.senderUid\)/);
    // Full uid must never enter the log body.
    expect(body).not.toMatch(/senderUid:\s*ctx\.senderUid/);
  });
});

describe('retainModerationEvidence — dedicated sink, not the standard logger', () => {
  it('honors shouldRetainBody — no-ops when retention is not required', () => {
    expect(SRC).toMatch(/if \(!shouldRetainBody\(ctx\.outcome\)\) return/);
  });

  it('routes to a NAMED evidence channel, never to the standard logger.info', () => {
    // The evidence path uses logger.child({channel: 'moderation-evidence'})
    // so a transport-layer binding can attach different ACLs.
    expect(SRC).toMatch(/channel: 'moderation-evidence'/);
    // And it MUST NOT call the plain logger.info with the raw body.
    const idx = SRC.indexOf('export function retainModerationEvidence');
    const end = SRC.indexOf('\n}\n', idx);
    const body = SRC.slice(idx, end);
    expect(body).not.toMatch(/logger\.info\(/);
  });
});

describe('recordModerationDecision — the ONE call site both routes use', () => {
  it('is exported and calls both log + retain', () => {
    expect(SRC).toMatch(/export function recordModerationDecision\(/);
    expect(SRC).toMatch(/logModerationDecision\(withId\)/);
    expect(SRC).toMatch(/retainModerationEvidence\(withId, rawBody\)/);
  });

  it('assigns a stable messageAttemptId so log + evidence rows correlate', () => {
    expect(SRC).toMatch(
      /const messageAttemptId = ctx\.messageAttemptId \?\? crypto\.randomBytes\(6\)\.toString\('hex'\)/,
    );
  });
});
