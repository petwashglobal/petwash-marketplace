/**
 * Issue #153 PR-W-RETRY — K9000 permanent-failure admin alerts.
 *
 * CEO directive (Track A item 2): visibility only. Do NOT change the
 * K9000 runtime contract. The Lane-3 audit flagged that
 * MachineCommandService logs warnings + writes bay events on permanent
 * failure but provides no persistent admin alert surface. Auto-
 * compensation failure was logged with logger.error only — silent
 * to the admin dashboard.
 *
 * This regression suite locks:
 *   • The audit-log helper accepts a `severity` field that flows to
 *     the audit_events.severity column (additive type change, no
 *     schema migration).
 *   • MachineCommandService writes three audit_events rows at the
 *     correct lifecycle points:
 *       - K9000_COMMAND_PERMANENT_FAIL  (severity=critical) on retry
 *         exhaustion
 *       - K9000_COMPENSATION_TRIGGERED  (severity=warning) on
 *         successful auto-compensation
 *       - K9000_COMPENSATION_FAILED     (severity=critical) when
 *         auto-compensation throws (the silent-failure gap)
 *   • The read-only admin endpoint GET /api/admin/k9000/alerts is
 *     wired with requireAdmin + queries the three actionTypes within
 *     a 24h window.
 *
 * Source-pin tests only. No DB I/O, no Express server boot — just
 * file-string anchors so this stays fast and stable.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('PR-W-RETRY audit-log helper severity passthrough', () => {
  it('1. LogAuditEventParams exposes an optional severity field', () => {
    const src = read('server/middleware/auditLog.ts');
    expect(src).toMatch(/severity\?:\s*AuditSeverity/);
    expect(src).toMatch(/export\s+type\s+AuditSeverity\s*=/);
    // The four canonical levels
    for (const sev of ['info', 'warning', 'error', 'critical']) {
      expect(src).toMatch(new RegExp(`['"]${sev}['"]`));
    }
  });

  it('2. logAuditEvent forwards severity to db.insert when provided', () => {
    const src = read('server/middleware/auditLog.ts');
    expect(src).toMatch(/\.\.\.\(\s*params\.severity\s*\?\s*\{\s*severity:\s*params\.severity\s*\}\s*:\s*\{\s*\}\s*\)/);
  });
});

describe('PR-W-RETRY MachineCommandService audit-log writes', () => {
  const src = read('server/services/MachineCommandService.ts');

  it('3. imports logAuditEvent', () => {
    expect(src).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('4. writes K9000_COMMAND_PERMANENT_FAIL with severity=critical on retry exhaustion', () => {
    expect(src).toMatch(/actionType:\s*['"]K9000_COMMAND_PERMANENT_FAIL['"]/);
    // Anchor severity within the same logAuditEvent call as the actionType
    const idx = src.indexOf("'K9000_COMMAND_PERMANENT_FAIL'");
    expect(idx).toBeGreaterThan(0);
    const window_ = src.slice(Math.max(0, idx - 200), idx + 800);
    expect(window_).toMatch(/severity:\s*['"]critical['"]/);
    expect(window_).toMatch(/targetType:\s*['"]machine_command['"]/);
  });

  it('5. writes K9000_COMPENSATION_TRIGGERED with severity=warning on auto-compensation success', () => {
    expect(src).toMatch(/actionType:\s*['"]K9000_COMPENSATION_TRIGGERED['"]/);
    const idx = src.indexOf("'K9000_COMPENSATION_TRIGGERED'");
    const window_ = src.slice(Math.max(0, idx - 200), idx + 600);
    expect(window_).toMatch(/severity:\s*['"]warning['"]/);
    expect(window_).toMatch(/targetType:\s*['"]wash_session['"]/);
  });

  it('6. writes K9000_COMPENSATION_FAILED with severity=critical when auto-compensation throws', () => {
    expect(src).toMatch(/actionType:\s*['"]K9000_COMPENSATION_FAILED['"]/);
    const idx = src.indexOf("'K9000_COMPENSATION_FAILED'");
    const window_ = src.slice(Math.max(0, idx - 200), idx + 700);
    expect(window_).toMatch(/severity:\s*['"]critical['"]/);
    expect(window_).toMatch(/targetType:\s*['"]wash_session['"]/);
  });

  it('7. preserves the existing retry / dispatch / response contract — only adds visibility writes', () => {
    // The eventPublisher.publishEvent for WASH_FAILED must still exist —
    // PR-W-RETRY adds audit-log calls beside it, not in place of it.
    expect(src).toMatch(/DomainEventType\.WASH_FAILED/);
    // The autoCompensateSession dynamic import must still exist
    expect(src).toMatch(/autoCompensateSession/);
    // The original .catch on the dispatch must still log the manual-review error
    expect(src).toMatch(/Auto-compensation failed — manual review required/);
  });

  it('8. all three audit-log .catch chains are present (helper double-guard)', () => {
    // Each of the 3 logAuditEvent calls must end with .catch(() => {}) so a
    // helper-level throw cannot bubble out of MachineCommandService.
    const matches = src.match(/logAuditEvent\(\{[\s\S]*?\}\)\.catch\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('PR-W-RETRY admin endpoint wiring', () => {
  const src = read('server/routes.ts');

  it('9. GET /api/admin/k9000/alerts is registered with requireAdmin', () => {
    expect(src).toMatch(/app\.get\(\s*['"]\/api\/admin\/k9000\/alerts['"]\s*,\s*requireAdmin\s*,/);
  });

  it('10. endpoint queries the three K9000_* actionTypes via inArray', () => {
    const idx = src.indexOf("'/api/admin/k9000/alerts'");
    const window_ = src.slice(idx, idx + 2000);
    expect(window_).toMatch(/inArray\(\s*auditEvents\.actionType\s*,/);
    expect(window_).toMatch(/'K9000_COMMAND_PERMANENT_FAIL'/);
    expect(window_).toMatch(/'K9000_COMPENSATION_TRIGGERED'/);
    expect(window_).toMatch(/'K9000_COMPENSATION_FAILED'/);
  });

  it('11. endpoint applies a 24h window and respects ?limit (clamped to 500)', () => {
    const idx = src.indexOf("'/api/admin/k9000/alerts'");
    const window_ = src.slice(idx, idx + 2000);
    expect(window_).toMatch(/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(window_).toMatch(/Math\.min\(\s*Number\(req\.query\.limit\)\s*\|\|\s*100\s*,\s*500\s*\)/);
  });

  it('12. endpoint is read-only (no INSERT / UPDATE / DELETE in the handler)', () => {
    const idx = src.indexOf("'/api/admin/k9000/alerts'");
    const handlerEnd = src.indexOf('});', idx + 100) + 3;
    const handlerSrc = src.slice(idx, handlerEnd);
    expect(handlerSrc).not.toMatch(/db\.insert\(/);
    expect(handlerSrc).not.toMatch(/db\.update\(/);
    expect(handlerSrc).not.toMatch(/db\.delete\(/);
  });
});
