/**
 * generateOtpCode — task #186.
 */
import { describe, it, expect } from 'vitest';
import { generateOtpCode } from '@shared/auth/otpCodeGeneration';

describe('generateOtpCode', () => {
  it('always returns a 6-character digit string', () => {
    for (let i = 0; i < 100; i++) {
      const c = generateOtpCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('never starts with a leading zero', () => {
    // 100 samples: none should be < 100000
    for (let i = 0; i < 100; i++) {
      const c = generateOtpCode();
      expect(Number(c)).toBeGreaterThanOrEqual(100_000);
      expect(Number(c)).toBeLessThan(1_000_000);
    }
  });

  it('produces distinct values across a sample (probabilistic — collisions must be rare)', () => {
    const seen = new Set<string>();
    let duplicates = 0;
    for (let i = 0; i < 500; i++) {
      const c = generateOtpCode();
      if (seen.has(c)) duplicates++;
      seen.add(c);
    }
    // 500 draws from 900k values — expected collisions ≈ 0.14. Allow a
    // slack of 3 (birthday-paradox tail); a broken generator returning
    // a constant would give 499.
    expect(duplicates).toBeLessThanOrEqual(3);
  });
});
