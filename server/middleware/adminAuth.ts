/**
 * PetWash™ Admin Authentication Utilities
 *
 * SECURITY (Architect finding — MEDIUM):
 *   Plain string comparison (`===`) of the admin secret is vulnerable to
 *   timing attacks: an attacker can measure response time byte-by-byte to
 *   reconstruct the secret via statistical analysis.
 *
 *   All admin secret checks MUST use `timingSafeAdminSecretMatch()`.
 *   This function uses Node's `crypto.timingSafeEqual()` which always runs
 *   in constant time regardless of where strings differ.
 */

import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Returns true if the `x-admin-secret` header matches `ADMIN_SECRET`
 * using a constant-time comparison (prevents timing side-channel attacks).
 *
 * If ADMIN_SECRET is not set in the environment, always returns false
 * (fail-closed: never allow auth via a missing secret).
 */
export function timingSafeAdminSecretMatch(req: Request): boolean {
  const envSecret = process.env.ADMIN_SECRET;
  if (!envSecret) return false;

  const provided = req.headers['x-admin-secret'];
  if (!provided || typeof provided !== 'string') return false;

  // Hash both values with SHA-256 so they are always the same byte length,
  // which is required by timingSafeEqual (it throws on length mismatch).
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(envSecret).digest();

  return timingSafeEqual(a, b);
}
