/**
 * moderationEvidence — regression pin (FLY MODE III correction).
 *
 * CEO DEEP-LOGIC §1-§3.
 *
 * The prior wire falsely reported PASS. It routed raw bodies to
 * `logger.child({channel:'moderation-evidence'})`, but
 * server/lib/logger.ts has no .child(), so the fallback executed
 * `logger.warn(..., { rawBody })` — the same stdout / Cloud Logging
 * transport as every other log.
 *
 * These pins lock the corrected discipline:
 *   • The module exposes NO API that logs a raw body.
 *   • Metadata-only decision log.
 *   • Retention state is explicit (`METADATA_ONLY` today;
 *     `RESTRICTED_EVIDENCE` reserved but must NOT be wired to the
 *     general logger).
 *   • No `.child(...)` fake-channel trick.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'moderationEvidence.ts'),
  'utf8',
);

describe('CEO DEEP-LOGIC §1 — module exposes NO raw-body log path', () => {
  it('no exported function accepts a rawBody parameter', () => {
    // Every exported entry point is metadata-only.
    expect(SRC).not.toMatch(/rawBody:\s*string/);
    // The recordModerationDecision signature takes ONE ctx arg.
    expect(SRC).toMatch(
      /export function recordModerationDecision\(\s*ctx: ModerationLogContext,\s*\): \{ messageAttemptId: string \}/,
    );
  });

  it('logs contain no reference to a rawBody / body / message text field', () => {
    // The log payload keys are the safe metadata set only.
    const idx = SRC.indexOf('logger.info(`${ctx.route} message evaluated`');
    expect(idx).toBeGreaterThan(0);
    const end = SRC.indexOf('});', idx);
    const payload = SRC.slice(idx, end);
    expect(payload).not.toMatch(/rawBody/);
    expect(payload).not.toMatch(/\bbody\b/);
    // Rule identifiers (source labels) also stay out of the log per §29.
    expect(payload).not.toMatch(/ctx\.matches\[/);
    expect(payload).not.toMatch(/matches:\s*ctx\.matches\b/);
  });
});

describe('CEO DEEP-LOGIC §2 — no fake "dedicated logger channel"', () => {
  it('does NOT try to use logger.child() as a security boundary', () => {
    expect(SRC).not.toMatch(/logger\.child\(/);
    expect(SRC).not.toMatch(/channel:\s*'moderation-evidence'/);
  });

  it('there is no retainModerationEvidence function anymore', () => {
    // The prior "retain to a moderation-evidence channel" path is gone.
    // A real evidence store lands in a separate design with a
    // different sink, not routed through the app logger.
    expect(SRC).not.toMatch(/export function retainModerationEvidence/);
  });
});

describe('CEO DEEP-LOGIC §3 — explicit retention state', () => {
  it('exports an EvidenceRetentionState type with both values enumerated', () => {
    expect(SRC).toMatch(
      /export type EvidenceRetentionState = 'METADATA_ONLY' \| 'RESTRICTED_EVIDENCE'/,
    );
  });

  it('production default is METADATA_ONLY — never silently upgrades', () => {
    expect(SRC).toMatch(
      /export const CURRENT_EVIDENCE_RETENTION: EvidenceRetentionState = 'METADATA_ONLY'/,
    );
  });

  it('the retention state is stamped on every decision line for auditability', () => {
    expect(SRC).toMatch(/evidenceRetention:\s*CURRENT_EVIDENCE_RETENTION/);
  });
});

describe('safe metadata shape (§1 allowed fields only)', () => {
  it('logs messageAttemptId + threadId + bookingId + senderUidTail + policyVersion + decision + category + confidence + integritySignal + matchCount + timestamp', () => {
    const idx = SRC.indexOf('logger.info(`${ctx.route} message evaluated`');
    const end = SRC.indexOf('});', idx);
    const payload = SRC.slice(idx, end);
    for (const key of [
      'messageAttemptId',
      'threadId',
      'bookingId',
      'senderUidTail',
      'policyVersion',
      'decision',
      'primaryCategory',
      'confidence',
      'integritySignal',
      'matchCount',
      'timestamp',
    ]) {
      expect(payload).toMatch(new RegExp(`\\b${key}\\b`));
    }
  });

  it('senderUidTail is `tail(uid)`, never the full uid', () => {
    expect(SRC).toMatch(/senderUidTail:\s*tail\(ctx\.senderUid\)/);
  });
});
