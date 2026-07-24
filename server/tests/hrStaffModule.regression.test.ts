/**
 * HR / staff module (CEO 2026-07-24 "build go"): greenfield roster — table,
 * super-admin CRUD, all-Hebrew admin page, Control Tower tile. Replaces the
 * honest "not built" flag with the real thing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('staff table', () => {
  it('migration 0102 creates staff with the pay/station/status fields', () => {
    const m = R('migrations/0102_staff.sql');
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS staff/);
    for (const c of ['full_name', 'role', 'station_code', 'employment', 'pay_type', 'pay_rate_ils', 'status', 'hired_at']) {
      expect(m).toContain(c);
    }
  });
});

describe('staff API', () => {
  it('full CRUD, super-admin gated, mounted', () => {
    const api = R('server/routes/admin-staff.ts');
    expect(api).toMatch(/router\.get\('\/', requireSuperAdmin/);
    expect(api).toMatch(/router\.post\('\/', requireSuperAdmin/);
    expect(api).toMatch(/router\.patch\('\/:id', requireSuperAdmin/);
    expect(api).toMatch(/router\.delete\('\/:id', requireSuperAdmin/);
    expect(R('server/routes.ts')).toMatch(/app\.use\('\/api\/admin\/staff', apiLimiter, adminStaffRoutes\)/);
  });

  it('delete is a soft deactivate, never a hard row delete', () => {
    const api = R('server/routes/admin-staff.ts');
    expect(api).toMatch(/UPDATE staff SET status = 'inactive'/);
    expect(api).not.toMatch(/DELETE FROM staff/);
  });
});

describe('staff page', () => {
  it('routed once behind the guard and linked from the tower', () => {
    const app = R('client/src/App.tsx');
    expect(app.match(/path="\/admin\/staff"/g)?.length).toBe(1);
    expect(R('client/src/pages/AdminOctopus.tsx')).toContain("to: '/admin/staff'");
  });

  it('has create + inline save + confirm-gated deactivate', () => {
    const p = R('client/src/pages/AdminStaff.tsx');
    expect(p).toContain('staff-create-form');
    expect(p).toMatch(/staff-save-/);
    expect(p).toMatch(/window\.confirm/);
  });
});
