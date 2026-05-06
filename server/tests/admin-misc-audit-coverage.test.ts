/** PR-W34t — admin-misc admin audit (admin-notifications + contractor + events). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const adminNotif = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'admin-notifications.ts'), 'utf8');
const contractor = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'contractor.ts'), 'utf8');
const events = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'events.ts'), 'utf8');

describe('PR-W34t — admin-misc small admin endpoints', () => {
  it('admin-notifications retry-sweep emits NOTIFICATION_RETRY_SWEEP', () => {
    expect(adminNotif).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(adminNotif).toMatch(/actionType:\s*['"]NOTIFICATION_RETRY_SWEEP['"]/);
    expect(adminNotif).toMatch(/setImmediate\s*\(/);
  });
  it('contractor update-trust-score emits CONTRACTOR_TRUST_SCORE_UPDATE', () => {
    expect(contractor).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(contractor).toMatch(/actionType:\s*['"]CONTRACTOR_TRUST_SCORE_UPDATE['"]/);
    expect(contractor).toMatch(/setImmediate\s*\(/);
  });
  it('events replay emits DOMAIN_EVENT_REPLAY', () => {
    expect(events).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(events).toMatch(/actionType:\s*['"]DOMAIN_EVENT_REPLAY['"]/);
    expect(events).toMatch(/setImmediate\s*\(/);
  });
});
