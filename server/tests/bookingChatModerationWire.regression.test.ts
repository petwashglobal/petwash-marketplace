/**
 * booking-chat send path — moderation wire regression pin (§23 + DEEP-LOGIC §20).
 *
 * CEO NEXT-AUTO §23 + Integrity §13, §14, §15, §23, §29 + DEEP-LOGIC §20.
 * The MessagePolicyEngine runs BEFORE persistence on the real
 * booking chat send path — the existing scanChatRisk stays as
 * ADVISORY escalation, but the doctrine engine is the layer that
 * can BLOCK (403).
 *
 * Retention discipline is now centralized in the dedicated
 * moderationEvidence sink — raw bodies never touch the general
 * application logger.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'booking-chat.ts'),
  'utf8',
);

describe('CEO §23 — MessagePolicyEngine wired into booking-chat send', () => {
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

  it('policy runs on the SANITIZED content (safeContent), not raw body', () => {
    expect(SRC).toMatch(/text:\s*safeContent/);
  });
});

describe('policy call precedes persistence — enforcement, not advisory', () => {
  it('evaluateMessage() precedes the idempotency step + insert', () => {
    const evalIdx = SRC.indexOf('const policyResult = evaluateMessage({');
    const idempoIdx = SRC.indexOf('// 6. Idempotency');
    expect(evalIdx).toBeGreaterThan(0);
    expect(idempoIdx).toBeGreaterThan(evalIdx);
  });

  it('BLOCK / BLOCK_AND_REVIEW / SAFETY_ESCALATION → 403 MODERATION_BLOCK', () => {
    expect(SRC).toMatch(
      /outcome === 'BLOCK'[\s\S]{0,80}outcome === 'BLOCK_AND_REVIEW'[\s\S]{0,80}outcome === 'SAFETY_ESCALATION'/,
    );
    expect(SRC).toMatch(/reasonCode:\s*['"]MODERATION_BLOCK['"]/);
  });
});

describe('§29 — response body never leaks detection rules or raw text', () => {
  it('the 403 response body has only reasonCode + category — no matches, no body echo', () => {
    const idx = SRC.indexOf("reasonCode: 'MODERATION_BLOCK'");
    const braceEnd = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, braceEnd);
    expect(body).not.toMatch(/safeContent/);
    expect(body).not.toMatch(/matches:/);
    expect(body).not.toMatch(/RE_|\bregex\b/);
  });
});

describe('CEO DEEP-LOGIC §20 — no raw body in general logger.info', () => {
  it('route delegates to recordModerationDecision — never inlines retention', () => {
    expect(SRC).toMatch(/recordModerationDecision\(/);
    // The old inlined pattern is banned.
    expect(SRC).not.toMatch(/auditPayload\.retainedBody/);
    expect(SRC).not.toMatch(/logger\.info\('\[BookingChat\.policy\]'/);
  });

  it('the raw safeContent is handed ONLY to recordModerationDecision, not to any logger call', () => {
    const loggerLines = SRC.match(/logger\.(info|warn|error)\([\s\S]{0,400}?\)/g) ?? [];
    for (const line of loggerLines) {
      // safeContent is the sanitized body — retention still means it
      // must not travel through the general application logger.
      expect(line).not.toMatch(/safeContent/);
    }
  });

  it('integritySignal is passed through the sink ctx', () => {
    expect(SRC).toMatch(/integritySignalFor\(policyResult\.primaryCategory\)/);
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
    expect(SRC).toMatch(/hashSafeContent\(safeContent\)/);
    expect(SRC).toMatch(/verifyWarningToken\(incoming, bindings\)/);
  });
});

describe('existing scanChatRisk stays as ADVISORY escalation (not removed)', () => {
  it('scanChatRisk still runs after the doctrine policy layer', () => {
    expect(SRC).toMatch(/scanChatRisk\(/);
    const policyIdx = SRC.indexOf('// 5b. CEO Integrity §13');
    const riskIdx = SRC.indexOf('// 7. Contact info');
    expect(policyIdx).toBeGreaterThan(0);
    expect(riskIdx).toBeGreaterThan(policyIdx);
  });
});
