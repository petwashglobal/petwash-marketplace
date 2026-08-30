/**
 * booking-chat send path — moderation wire regression pin (§23).
 *
 * CEO NEXT-AUTO §23 + Integrity §13, §14, §15, §23, §29 + Security §23.
 * The MessagePolicyEngine now runs BEFORE persistence on the real
 * booking chat send path — the existing scanChatRisk stays as
 * ADVISORY escalation, but the doctrine engine is the layer that
 * can BLOCK (403).
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

  it('imports shouldRetainBody + integritySignalFor', () => {
    expect(SRC).toMatch(
      /shouldRetainBody[\s\S]{0,120}integritySignalFor[\s\S]{0,120}from ['"]@shared\/marketplace\/moderationAudit['"]/,
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

describe('§6.12 — audit + retention discipline', () => {
  it('shouldRetainBody gates the retainedBody payload field', () => {
    expect(SRC).toMatch(/if \(shouldRetainBody\(policyResult\.outcome\)\)/);
    // The retainedBody line lives INSIDE the guard.
    const guardIdx = SRC.indexOf('if (shouldRetainBody(policyResult.outcome))');
    const guardEnd = SRC.indexOf('}', guardIdx);
    expect(SRC.slice(guardIdx, guardEnd)).toMatch(/retainedBody\s*=\s*safeContent/);
  });

  it('integritySignal added only when the mapping returns a slug (§7.1)', () => {
    expect(SRC).toMatch(/integritySignalFor\(policyResult\.primaryCategory\)/);
    expect(SRC).toMatch(/if \(integritySignal\)/);
  });
});

describe('existing scanChatRisk stays as ADVISORY escalation (not removed)', () => {
  it('scanChatRisk still runs after the doctrine policy layer', () => {
    expect(SRC).toMatch(/scanChatRisk\(/);
    // The doctrine block precedes step 7 (the scanChatRisk section).
    const policyIdx = SRC.indexOf('// 5b. CEO Integrity §13');
    const riskIdx = SRC.indexOf('// 7. Contact info');
    expect(policyIdx).toBeGreaterThan(0);
    expect(riskIdx).toBeGreaterThan(policyIdx);
  });
});
