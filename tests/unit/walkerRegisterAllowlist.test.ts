import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Regression test for server/routes/walk-my-pet.ts walker registration.
 *
 * Before this fix the route spread req.body into the InsertWalkerProfile
 * insert, which let a client claim:
 *   - backgroundCheckStatus: 'passed'
 *   - bankAccountVerified: true
 *   - nayaxPayoutAccountId: '<attacker-account>'
 *   - commissionRate: '0'
 *   - biometricMatchScore: '100'
 *
 * This test mirrors the strict allowlist Zod schema used in the route and
 * proves that any privileged or unknown key is rejected.
 *
 * NOTE: Keep this schema in sync with walkerRegisterBodySchema in
 *       server/routes/walk-my-pet.ts. If you add a new field to the route
 *       schema, add it here too.
 */
const walkerRegisterBodySchema = z.object({
  captchaToken: z.string().optional(),
  turnstileToken: z.string().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(120).optional(),
  profilePhotoUrl: z.string().url().max(500).optional(),
  bio: z.string().max(2000).optional(),
  city: z.string().min(1).max(120),
  country: z.string().min(2).max(8).default('IL'),
  serviceRadiusKm: z.number().int().min(0).max(200).optional(),
  yearsOfExperience: z.number().int().min(0).max(80).optional(),
  specializations: z.array(z.string().max(60)).max(20).optional(),
  certifications: z.array(z.string().max(80)).max(20).optional(),
  hasBodyCamera: z.boolean().optional(),
  hasDroneAccess: z.boolean().optional(),
  hasFirstAidKit: z.boolean().optional(),
  hasCarTransport: z.boolean().optional(),
  baseHourlyRate: z.union([z.number(), z.string()]),
  minimumMinutes: z.number().int().min(5).max(480).optional(),
  currency: z.enum(['ILS', 'USD', 'GBP', 'AUD', 'CAD']).optional(),
  walkPackages: z.array(z.any()).max(20).optional(),
  extraServices: z.array(z.any()).max(20).optional(),
  maxDailyWalks: z.number().int().min(0).max(50).optional(),
}).strict();

const validBody = {
  captchaToken: 'test-captcha',
  firstName: 'Test',
  lastName: 'Walker',
  city: 'Tel Aviv',
  baseHourlyRate: 80,
};

describe('walker registration allowlist', () => {
  it('accepts a minimal valid body', () => {
    const result = walkerRegisterBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it('rejects backgroundCheckStatus from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      backgroundCheckStatus: 'passed',
    });
    expect(result.success).toBe(false);
  });

  it('rejects bankAccountVerified from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      bankAccountVerified: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects nayaxPayoutAccountId from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      nayaxPayoutAccountId: 'attacker-account-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects commissionRate from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      commissionRate: '0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects biometricMatchScore from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      biometricMatchScore: '100',
    });
    expect(result.success).toBe(false);
  });

  it('rejects verificationStatus from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      verificationStatus: 'verified',
    });
    expect(result.success).toBe(false);
  });

  it('rejects averageRating from client', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      averageRating: '5',
    });
    expect(result.success).toBe(false);
  });

  it('rejects userId from client (server derives from token)', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      userId: 'spoofed-uid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects walkerId from client (server generates)', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      walkerId: 'WALKER-spoofed',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys', () => {
    const result = walkerRegisterBodySchema.safeParse({
      ...validBody,
      __proto__pollute__: 'evil',
    });
    expect(result.success).toBe(false);
  });

  it('requires firstName', () => {
    const { firstName, ...rest } = validBody;
    const result = walkerRegisterBodySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('requires baseHourlyRate', () => {
    const { baseHourlyRate, ...rest } = validBody;
    const result = walkerRegisterBodySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
