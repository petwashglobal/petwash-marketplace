/**
 * thread-chat send path — moderation wire regression pin.
 *
 * CEO Integrity §13, §14, §15, §23, §24, §29 + SECURITY §23, §24.
 * Every user message MUST run through the MarketplaceMessagePolicyEngine
 * BEFORE persistence. Server is authority. Detection rules NEVER leak
 * to the client. Body retained only per §6.12 discipline.
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

  it('imports shouldRetainBody + integritySignalFor from shared moderationAudit', () => {
    expect(SRC).toMatch(
      /shouldRetainBody[\s\S]{0,120}integritySignalFor[\s\S]{0,120}from ['"]@shared\/marketplace\/moderationAudit['"]/,
    );
  });

  it('evaluateMessage() call precedes db.insert(chatThreadMessages) — never the reverse', () => {
    const evalIdx = SRC.indexOf('evaluateMessage({');
    const insertIdx = SRC.indexOf('db\n    .insert(chatThreadMessages)');
    // Both must exist and eval must precede insert in file order.
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
    // Zoom into the res.status(403).json({...}) call itself, not the
    // surrounding comment block.
    const jsonIdx = SRC.indexOf('res.status(403).json({');
    const braceEnd = SRC.indexOf('});', jsonIdx);
    const jsonBody = SRC.slice(jsonIdx, braceEnd);
    expect(jsonBody).not.toMatch(/trimmedBody/);
    expect(jsonBody).not.toMatch(/matches:/);
    expect(jsonBody).not.toMatch(/RE_|\bregex\b/);
  });
});

describe('CEO §6.12 — audit log respects retention discipline', () => {
  it('shouldRetainBody gates whether trimmedBody appears in the audit payload', () => {
    expect(SRC).toMatch(/if \(shouldRetainBody\(policyResult\.outcome\)\)/);
    // The audit payload otherwise carries only decision + category
    // metadata — never the raw text unless retention is warranted.
    const idx = SRC.indexOf('const auditPayload');
    const end = SRC.indexOf('logger.info', idx);
    const payload = SRC.slice(idx, end);
    expect(payload).toMatch(/policyVersion/);
    expect(payload).toMatch(/decision/);
    expect(payload).toMatch(/primaryCategory/);
    // Body is added ONLY inside the shouldRetainBody branch — not
    // unconditionally.
    const retainBranchIdx = SRC.indexOf('shouldRetainBody(policyResult.outcome)');
    const retainBranchEnd = SRC.indexOf('}', retainBranchIdx);
    expect(SRC.slice(retainBranchIdx, retainBranchEnd)).toMatch(/retainedBody/);
  });

  it('integritySignal is added only for marketplace-integrity categories (§7.1)', () => {
    expect(SRC).toMatch(/integritySignalFor\(policyResult\.primaryCategory\)/);
    expect(SRC).toMatch(/if \(integritySignal\)/);
  });
});

describe('sender + recipient roles derived from server-side thread parties', () => {
  it('senderRole derived from customerUserId / providerUserId / supportOwnerId — never from body', () => {
    expect(SRC).toMatch(
      /t\.customerUserId === uid[\s\S]{0,80}'BOOKER'[\s\S]{0,120}t\.providerUserId === uid[\s\S]{0,80}'PROVIDER'/,
    );
    // Body never contributes to role decision.
    const roleIdx = SRC.indexOf('const senderRole');
    const roleEnd = SRC.indexOf(';', roleIdx);
    const roleBlock = SRC.slice(roleIdx, roleEnd);
    expect(roleBlock).not.toMatch(/req\.body/);
  });
});
