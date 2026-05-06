/**
 * PR-W34h — enterprise-operations admin audit_events coverage.
 *
 * 10 mutators wired (tasks, incidents, SLA tracking):
 *   POST  /tasks                          OPS_TASK_CREATE
 *   PATCH /tasks/:id                      OPS_TASK_UPDATE
 *   POST  /tasks/:id/complete             OPS_TASK_COMPLETE
 *   POST  /incidents                      OPS_INCIDENT_CREATE
 *   PATCH /incidents/:id                  OPS_INCIDENT_UPDATE
 *   POST  /incidents/:id/resolve          OPS_INCIDENT_RESOLVE
 *   POST  /incidents/:id/close            OPS_INCIDENT_CLOSE
 *   POST  /incidents/:id/escalate         OPS_INCIDENT_ESCALATE
 *   POST  /sla                            OPS_SLA_CREATE
 *   PATCH /sla/:id                        OPS_SLA_UPDATE
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'enterprise-operations.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34h — enterprise-operations admin audit coverage', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('declares emitOpsAudit wrapper with setImmediate', () => {
    const idx = text.indexOf('function emitOpsAudit');
    expect(idx).toBeGreaterThan(0);
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  describe('10 mutators each emit an audit event', () => {
    function sliceHandler(method: 'post' | 'patch', routePath: string): string {
      const idx = text.indexOf(`router.${method}("${routePath}"`);
      if (idx < 0) throw new Error(`router.${method} ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4500);
    }

    function assertAudit(handler: string, action: string, target: string) {
      expect(handler, `${action}: emitOpsAudit missing`).toMatch(/emitOpsAudit\s*\(/);
      expect(handler, `${action}: actionType missing`).toMatch(
        new RegExp(`actionType:\\s*['"]${action}['"]`),
      );
      expect(handler, `${action}: targetType ${target} missing`).toMatch(
        new RegExp(`targetType:\\s*['"]${target}['"]`),
      );
    }

    it('POST /tasks → OPS_TASK_CREATE', () => {
      assertAudit(sliceHandler('post', '/tasks'), 'OPS_TASK_CREATE', 'ops_task');
    });
    it('PATCH /tasks/:id → OPS_TASK_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/tasks/:id'), 'OPS_TASK_UPDATE', 'ops_task');
    });
    it('POST /tasks/:id/complete → OPS_TASK_COMPLETE', () => {
      assertAudit(sliceHandler('post', '/tasks/:id/complete'), 'OPS_TASK_COMPLETE', 'ops_task');
    });

    it('POST /incidents → OPS_INCIDENT_CREATE', () => {
      assertAudit(sliceHandler('post', '/incidents'), 'OPS_INCIDENT_CREATE', 'ops_incident');
    });
    it('PATCH /incidents/:id → OPS_INCIDENT_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/incidents/:id'), 'OPS_INCIDENT_UPDATE', 'ops_incident');
    });
    it('POST /incidents/:id/resolve → OPS_INCIDENT_RESOLVE', () => {
      assertAudit(sliceHandler('post', '/incidents/:id/resolve'), 'OPS_INCIDENT_RESOLVE', 'ops_incident');
    });
    it('POST /incidents/:id/close → OPS_INCIDENT_CLOSE', () => {
      assertAudit(sliceHandler('post', '/incidents/:id/close'), 'OPS_INCIDENT_CLOSE', 'ops_incident');
    });
    it('POST /incidents/:id/escalate → OPS_INCIDENT_ESCALATE', () => {
      assertAudit(sliceHandler('post', '/incidents/:id/escalate'), 'OPS_INCIDENT_ESCALATE', 'ops_incident');
    });

    it('POST /sla → OPS_SLA_CREATE', () => {
      assertAudit(sliceHandler('post', '/sla'), 'OPS_SLA_CREATE', 'ops_sla');
    });
    it('PATCH /sla/:id → OPS_SLA_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/sla/:id'), 'OPS_SLA_UPDATE', 'ops_sla');
    });
  });

  describe('actor captured from req.adminUser (set by requireAdmin middleware)', () => {
    it('every emitOpsAudit reads req.adminUser?.id', () => {
      // Count emit calls and their actorUserId source.
      const emits = text.match(/emitOpsAudit\s*\(\s*\{[^}]*\}/gs) ?? [];
      expect(emits.length).toBeGreaterThanOrEqual(10);
      for (const e of emits) {
        expect(e).toMatch(/actorUserId:\s*req\.adminUser\?\.id/);
      }
    });
  });

  describe('read-only handlers emit no audit events', () => {
    it('GET /tasks list has no emitOpsAudit', () => {
      const idx = text.indexOf('router.get("/tasks"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).not.toMatch(/emitOpsAudit\s*\(/);
    });
    it('GET /incidents list has no emitOpsAudit', () => {
      const idx = text.indexOf('router.get("/incidents"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).not.toMatch(/emitOpsAudit\s*\(/);
    });
  });
});
