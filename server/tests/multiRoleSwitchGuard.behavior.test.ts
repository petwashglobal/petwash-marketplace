/**
 * MultiRoleSwitchGuard — Program 44.
 */
import { describe, it, expect } from 'vitest';
import { canSwitchTo } from '../services/marketplace/MultiRoleSwitchGuard';

const customerOnly = { hasCustomerCapability: true, hasProviderApplicant: false, hasProviderActive: false };
const customerAndProviderActive = { hasCustomerCapability: true, hasProviderApplicant: false, hasProviderActive: true };
const customerAndProviderApplicant = { hasCustomerCapability: true, hasProviderApplicant: true, hasProviderActive: false };

describe('MultiRoleSwitchGuard', () => {
  it('customer-only trying to switch to PROVIDER → BLOCKED_CAPABILITY', () => {
    const out = canSwitchTo('PROVIDER', 'PET_PARENT', customerOnly);
    expect(out.code).toBe('BLOCKED_CAPABILITY');
    if (out.code !== 'BLOCKED_CAPABILITY') throw new Error();
    expect(out.reasonCode).toBe('PROVIDER_CAPABILITY_MISSING');
  });

  it('active provider switching to PROVIDER → ALLOWED', () => {
    const out = canSwitchTo('PROVIDER', 'PET_PARENT', customerAndProviderActive);
    expect(out.code).toBe('ALLOWED');
    if (out.code !== 'ALLOWED') throw new Error();
    expect(out.targetWorkspace).toBe('PROVIDER');
  });

  it('applicant switching to PROVIDER → BLOCKED_INTAKE with resumeRoute', () => {
    const out = canSwitchTo('PROVIDER', 'PET_PARENT', customerAndProviderApplicant);
    expect(out.code).toBe('BLOCKED_INTAKE');
    if (out.code !== 'BLOCKED_INTAKE') throw new Error();
    expect(out.reasonCode).toBe('FINISH_PROVIDER_INTAKE_FIRST');
    expect(out.resumeRoute).toBe('/become-provider');
  });

  it('any customer switching back to PET_PARENT → ALLOWED', () => {
    expect(canSwitchTo('PET_PARENT', 'PROVIDER', customerAndProviderActive).code).toBe('ALLOWED');
  });

  it('same-workspace call is idempotent (ALLOWED, targetWorkspace preserved)', () => {
    const out = canSwitchTo('PET_PARENT', 'PET_PARENT', customerOnly);
    expect(out.code).toBe('ALLOWED');
  });

  it('account without Pet Parent base capability → BLOCKED_CAPABILITY (data anomaly)', () => {
    const out = canSwitchTo('PET_PARENT', 'PROVIDER', { hasCustomerCapability: false, hasProviderApplicant: false, hasProviderActive: true });
    expect(out.code).toBe('BLOCKED_CAPABILITY');
    if (out.code !== 'BLOCKED_CAPABILITY') throw new Error();
    expect(out.reasonCode).toBe('CUSTOMER_CAPABILITY_MISSING');
  });
});
