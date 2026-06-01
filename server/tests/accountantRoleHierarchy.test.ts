import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY } from '../middleware/rbac';

describe('M8 accountant role — hierarchy placement', () => {
  it('accountant is in the hierarchy', () => {
    expect(ROLE_HIERARCHY).toHaveProperty('accountant');
  });

  it('accountant sits between staff and admin', () => {
    expect(ROLE_HIERARCHY.accountant).toBe(5);
    expect(ROLE_HIERARCHY.staff).toBe(4);
    expect(ROLE_HIERARCHY.admin).toBe(6);
    expect(ROLE_HIERARCHY.accountant).toBeGreaterThan(ROLE_HIERARCHY.staff);
    expect(ROLE_HIERARCHY.accountant).toBeLessThan(ROLE_HIERARCHY.admin);
  });

  it('existing access-level-8 admin checks still exclude accountants', () => {
    // The supplier-invoice + admin-sumit routes use checkAccessLevel(8).
    // Accountant (5) must NOT pass those — they're below the threshold.
    expect(ROLE_HIERARCHY.accountant).toBeLessThan(8);
  });

  it('existing access-level-6 admin checks still exclude accountants', () => {
    expect(ROLE_HIERARCHY.accountant).toBeLessThan(ROLE_HIERARCHY.admin);
  });

  it('super_admin still tops the hierarchy', () => {
    expect(ROLE_HIERARCHY.super_admin).toBe(10);
    expect(ROLE_HIERARCHY.super_admin).toBeGreaterThan(ROLE_HIERARCHY.accountant);
  });

  it('provider role is unaffected by the insertion', () => {
    expect(ROLE_HIERARCHY.provider).toBe(2);
  });

  it('all pre-existing roles retain their level', () => {
    expect(ROLE_HIERARCHY.public).toBe(1);
    expect(ROLE_HIERARCHY.pet_parent).toBe(1);
    expect(ROLE_HIERARCHY.provider).toBe(2);
    expect(ROLE_HIERARCHY.franchise_owner).toBe(3);
    expect(ROLE_HIERARCHY.pending_staff).toBe(3);
    expect(ROLE_HIERARCHY.staff).toBe(4);
    expect(ROLE_HIERARCHY.admin).toBe(6);
    expect(ROLE_HIERARCHY.hr).toBe(7);
    expect(ROLE_HIERARCHY.management).toBe(8);
    expect(ROLE_HIERARCHY.super_admin).toBe(10);
  });
});
