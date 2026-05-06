/** PR-W34l — sales-crm admin audit. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'enterprise-sales-crm.ts'), 'utf8');

describe('PR-W34l — sales-crm admin audit', () => {
  it('imports logAuditEvent + declares emitCrmAudit', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitCrmAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  const expected = [
    'CRM_COMMUNICATION_CREATE', 'CRM_COMMUNICATION_UPDATE',
    'CRM_DEAL_STAGE_CREATE', 'CRM_DEAL_STAGE_UPDATE', 'CRM_DEAL_STAGE_DELETE',
    'CRM_TASK_CREATE', 'CRM_TASK_UPDATE', 'CRM_TASK_COMPLETE',
    'CRM_ACTIVITY_CREATE',
  ];
  for (const action of expected) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
  it('communication-create logs hasContent flag, NOT raw content', () => {
    const idx = text.indexOf('CRM_COMMUNICATION_CREATE');
    const block = text.slice(idx, idx + 1000);
    expect(block).toMatch(/hasContent:/);
    expect(block).not.toMatch(/\bcontent:\s*content\b/);
  });
});
