import { describe, it, expect } from 'vitest';
import { COMMERCE_FLAGS, isCommerceFlagEnabled } from '../../shared/purchase-lifecycle/flags';
import { PRODUCT_TYPES } from '../../shared/purchase-lifecycle/types';

describe('Commerce OS flags — default OFF, opt-in only', () => {
  it('every flag is OFF when no env is set', () => {
    const env: NodeJS.ProcessEnv = {};
    for (const key of Object.values(COMMERCE_FLAGS)) {
      expect(isCommerceFlagEnabled(key, env)).toBe(false);
    }
  });

  it('a flag turns ON only with the exact derived env var = "true"', () => {
    const env: NodeJS.ProcessEnv = {
      FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED: 'true',
    };
    expect(isCommerceFlagEnabled(COMMERCE_FLAGS.enabled, env)).toBe(true);
    // other flags remain off
    expect(isCommerceFlagEnabled(COMMERCE_FLAGS.routerEnabled, env)).toBe(false);
  });

  it('"1" / "yes" / "" do NOT enable (must be exactly "true")', () => {
    for (const v of ['1', 'yes', 'TRUE', '', undefined]) {
      const env = { FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED: v } as NodeJS.ProcessEnv;
      expect(isCommerceFlagEnabled(COMMERCE_FLAGS.enabled, env)).toBe(false);
    }
  });

  it('exposes all 8 product types', () => {
    expect(PRODUCT_TYPES).toHaveLength(8);
    expect(PRODUCT_TYPES).toContain('SINGLE_WASH');
    expect(PRODUCT_TYPES).toContain('SAAS_SUBSCRIPTION');
  });
});
