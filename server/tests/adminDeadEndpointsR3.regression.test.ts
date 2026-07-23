/**
 * Admin dead-endpoints round 3 — hunter-2 leftovers closed: repointed the
 * stations tabs to real routes, retired two generations whose buttons could
 * never work, removed a no-backend card.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('admin dead endpoints closed', () => {
  it('AdminStations tabs hit real routes', () => {
    const s = R('client/src/pages/AdminStations.tsx');
    expect(s).toContain("'/api/admin/alerts?status=open'");
    expect(s).toContain("'/api/admin/stations/health/stations'");
  });

  it('dead generations retired via redirect', () => {
    const app = R('client/src/App.tsx');
    const users = app.indexOf('path="/admin/users"');
    expect(app.slice(users, users + 130)).toMatch(/Redirect to="\/admin\/customers"/);
    const hq = app.indexOf('path="/hq/classic"');
    expect(app.slice(hq, hq + 130)).toMatch(/Redirect to="\/admin\/octopus"/);
  });

  it('the no-backend departments card is gone', () => {
    const u = R('client/src/pages/UnifiedEntityManagement.tsx');
    expect(u).not.toContain("queryKey: ['/api/enterprise/hr/departments']");
    expect(u).not.toContain('data-testid="card-departments"');
  });
});
