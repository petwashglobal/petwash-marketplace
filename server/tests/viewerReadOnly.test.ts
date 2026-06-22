import { describe, it, expect, vi } from 'vitest';
import { isReadOnlyAdminRole, isAdminRole, READ_ONLY_ADMIN_ROLES } from '../../shared/adminRoles';

// Mock the heavy deps gates.ts pulls in so we can unit-test the middleware.
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../services/securityEventsService', () => ({ logSecurityEvent: vi.fn() }));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { enforceReadOnlyMutations } from '../middleware/gates';

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('viewer role — shared helpers (security invariants)', () => {
  it('viewer can SEE admin (is an admin role)', () => {
    expect(isAdminRole('viewer')).toBe(true);
  });
  it('viewer is read-only (case-insensitive)', () => {
    expect(isReadOnlyAdminRole('viewer')).toBe(true);
    expect(isReadOnlyAdminRole('VIEWER')).toBe(true);
    expect(READ_ONLY_ADMIN_ROLES).toContain('viewer');
  });
  it('real admin/super roles are NEVER read-only', () => {
    for (const r of ['admin', 'super_admin', 'ops', 'management', 'ceo', 'finance', 'hr', 'staff']) {
      expect(isReadOnlyAdminRole(r)).toBe(false);
    }
  });
  it('undefined/null are not read-only', () => {
    expect(isReadOnlyAdminRole(undefined)).toBe(false);
    expect(isReadOnlyAdminRole(null)).toBe(false);
  });
});

describe('enforceReadOnlyMutations middleware', () => {
  it('lets a viewer READ (GET passes)', () => {
    const req: any = { method: 'GET', firebaseUser: { claims: { role: 'viewer' } }, headers: {} };
    const next = vi.fn();
    enforceReadOnlyMutations(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('BLOCKS a viewer WRITE (POST → 403 READ_ONLY_ACCESS)', () => {
    const req: any = { method: 'POST', firebaseUser: { claims: { role: 'viewer' } }, headers: {}, originalUrl: '/api/admin/refunds' };
    const res = mockRes();
    const next = vi.fn();
    enforceReadOnlyMutations(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'READ_ONLY_ACCESS' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('also blocks viewer DELETE / PUT / PATCH', () => {
    for (const method of ['DELETE', 'PUT', 'PATCH']) {
      const res = mockRes();
      const next = vi.fn();
      enforceReadOnlyMutations({ method, firebaseUser: { claims: { role: 'viewer' } }, headers: {}, originalUrl: '/x' } as any, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('does NOT block a real admin WRITE', () => {
    const req: any = { method: 'POST', firebaseUser: { claims: { role: 'admin' } }, headers: {}, originalUrl: '/api/admin/refunds' };
    const next = vi.fn();
    enforceReadOnlyMutations(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
