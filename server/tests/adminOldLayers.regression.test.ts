/**
 * "Old layers of old back end" — the 107-route admin audit's five verified
 * breaks, fixed (CEO 2026-07-23). Pins so no layer regresses to a dead path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const crm = readFileSync(resolve(ROOT, 'client/src/pages/CrmDashboard.tsx'), 'utf8');
const inbox = readFileSync(resolve(ROOT, 'client/src/pages/AdminInbox.tsx'), 'utf8');
const comm = readFileSync(resolve(ROOT, 'client/src/pages/CommunicationCenter.tsx'), 'utf8');
const app = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');

describe('admin old-layers fixes', () => {
  it('CrmDashboard hits the real mounted prefix (was 404 on every call)', () => {
    expect(crm).not.toContain('/api/enterprise/sales/crm');
    expect(crm).toContain('/api/enterprise/sales-crm');
  });

  it('AdminInbox broadcasts to the real route and is honest about franchises', () => {
    expect(inbox).toContain("'/api/admin/broadcast-users'");
    expect(inbox).not.toContain('/api/admin/broadcast/users');
    expect(inbox).toMatch(/Franchise broadcast is not wired yet/);
  });

  it('CommunicationCenter cancels reminders via the real PATCH rail', () => {
    expect(comm).not.toContain('/api/communication/reminders');
    expect(comm).toMatch(/'PATCH', `\/api\/crm\/communications\/appointment-reminders\/\$\{reminder\.id\}`/);
  });

  it('the duplicate /admin/suppliers registration is gone; ERP view has its own path', () => {
    expect(app.match(/path="\/admin\/suppliers"/g)?.length).toBe(1);
    expect(app).toMatch(/path="\/admin\/suppliers-erp"/);
  });

  it('verified orphan pages are deleted', () => {
    expect(existsSync(resolve(ROOT, 'client/src/pages/AdminFinancial.tsx'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'client/src/pages/admin/ProviderReview.tsx'))).toBe(false);
  });
});
