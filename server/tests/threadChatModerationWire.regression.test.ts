/**
 * thread-chat send path — moderation wire regression pin.
 *
 * CEO Integrity §13, §14, §15, §23, §24, §29 + DEEP-LOGIC §20.
 * Every user message MUST run through the MarketplaceMessagePolicyEngine
 * BEFORE persistence. Server is authority. Detection rules NEVER leak
 * to the client. Raw blocked-message BODY never touches the general
 * application logger — retention is centralized in the dedicated
 * moderation-evidence sink.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'thread-chat.ts'),
  'utf8',
);

describe('CEO §23, §24 — MessagePolicyEngine runs BEFORE db.insert', () => {
  it('imports evaluateMessage + CURRENT_POLICY_VERSION from shared engine', () => {
    expect(SRC).toMatch(
      /evaluateMessage[\s\S]{0,200}from ['"]@shared\/marketplace\/policyEngine['"]/,
    );
    expect(SRC).toMatch(/CURRENT_POLICY_VERSION/);
  });

  it('imports integritySignalFor + the moderationEvidence sink', () => {
    expect(SRC).toMatch(
      /integritySignalFor[\s\S]{0,120}from ['"]@shared\/marketplace\/moderationAudit['"]/,
    );
    expect(SRC).toMatch(
      /recordModerationDecision[\s\S]{0,120}from ['"]\.\.\/services\/marketplace\/moderationEvidence['"]/,
    );
  });

  it('evaluateMessage() call precedes db.insert(chatThreadMessages) — never the reverse', () => {
    const evalIdx = SRC.indexOf('evaluateMessage({');
    const insertIdx = SRC.indexOf('db\n    .insert(chatThreadMessages)');
    expect(evalIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(evalIdx);
  });
});

describe('CEO §6.10, §29 — blocked message returns policy-neutral response', () => {
  it('BLOCK / BLOCK_AND_REVIEW / SAFETY_ESCALATION → 403 with MODERATION_BLOCK reason code', () => {
    expect(SRC).toMatch(
      /outcome === 'BLOCK'[\s\S]{0,80}outcome === 'BLOCK_AND_REVIEW'[\s\S]{0,80}outcome === 'SAFETY_ESCALATION'/,
    );
    expect(SRC).toMatch(/reasonCode:\s*['"]MODERATION_BLOCK['"]/);
    expect(SRC).toMatch(/res\.status\(403\)/);
  });

  it('response body does NOT include the raw text or match details (§29 detection rules never exposed)', () => {
    const jsonIdx = SRC.indexOf('res.status(403).json({');
    const braceEnd = SRC.indexOf('});', jsonIdx);
    const jsonBody = SRC.slice(jsonIdx, braceEnd);
    expect(jsonBody).not.toMatch(/trimmedBody/);
    expect(jsonBody).not.toMatch(/matches:/);
    expect(jsonBody).not.toMatch(/RE_|\bregex\b/);
  });
});

describe('CEO DEEP-LOGIC §20 — no raw body in general logger.info', () => {
  it('the route delegates to recordModerationDecision — never inlines the retention gate', () => {
    expect(SRC).toMatch(/recordModerationDecision\(/);
    // The route MUST NOT build a `retainedBody` payload directly —
    // that is what the sink is for. And it must not call
    // logger.info('[ThreadChat.policy]', ...) with any body.
    expect(SRC).not.toMatch(/auditPayload\.retainedBody/);
    expect(SRC).not.toMatch(/logger\.info\('\[ThreadChat\.policy\]'/);
  });

  it('the raw trimmedBody is handed ONLY to recordModerationDecision, not to logger', () => {
    // trimmedBody appears in the evaluateMessage call, in the insert,
    // and in the sink call — but never as a value in a logger.info /
    // logger.warn / logger.error payload.
    const loggerLines = SRC.match(/logger\.(info|warn|error)\([\s\S]{0,400}?\)/g) ?? [];
    for (const line of loggerLines) {
      expect(line).not.toMatch(/trimmedBody/);
    }
  });

  it('integritySignal is passed through the sink, not the standard logger', () => {
    expect(SRC).toMatch(/integritySignalFor\(policyResult\.primaryCategory\)/);
    // The sink call carries integritySignal as part of the ctx.
    expect(SRC).toMatch(/integritySignal,[\s\S]{0,120}outcome: policyResult\.outcome/);
  });
});

describe('CEO DEEP-LOGIC §16 — WARN_BEFORE_SEND two-stage handshake', () => {
  it('imports the handshake helpers from moderationDecisions', () => {
    expect(SRC).toMatch(
      /issueWarningToken[\s\S]{0,120}verifyWarningToken[\s\S]{0,120}from '\.\.\/services\/marketplace\/moderationDecisions'/,
    );
  });

  it('WARN_BEFORE_SEND → 409 WARNING_REQUIRED unless a valid token proves the second send', () => {
    expect(SRC).toMatch(/policyResult\.outcome === 'WARN_BEFORE_SEND'/);
    expect(SRC).toMatch(/res\.status\(409\)\.json\(\{[\s\S]{0,200}status: 'WARNING_REQUIRED'/);
    expect(SRC).toMatch(/reasonCode: 'MODERATION_WARN'/);
    // The token bindings must include the sanitized body hash — a
    // client cannot ride a token for a different message.
    expect(SRC).toMatch(/hashSafeContent\(trimmedBody\)/);
    expect(SRC).toMatch(/verifyWarningToken\(incoming, bindings\)/);
  });
});

describe('CEO DEEP-LOGIC §18 — ALLOW_WITH_NOTICE surfaces a notice', () => {
  it('sends the message AND returns a notice payload the UI can render', () => {
    expect(SRC).toMatch(/policyResult\.outcome === 'ALLOW_WITH_NOTICE'/);
    expect(SRC).toMatch(/buildAllowNoticePayload\(policyResult\.primaryCategory\)/);
  });
});

describe('sender + recipient roles derived from server-side thread parties', () => {
  it('senderRole derived from customerUserId / providerUserId — never from body', () => {
    expect(SRC).toMatch(
      /t\.customerUserId === uid[\s\S]{0,80}'BOOKER'[\s\S]{0,120}t\.providerUserId === uid[\s\S]{0,80}'PROVIDER'/,
    );
    const roleIdx = SRC.indexOf('const senderRole');
    const roleEnd = SRC.indexOf(';', roleIdx);
    const roleBlock = SRC.slice(roleIdx, roleEnd);
    expect(roleBlock).not.toMatch(/req\.body/);
  });
});
