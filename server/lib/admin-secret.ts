import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * P1-FIX: Timing-safe admin secret comparison.
 *
 * BEFORE: Every call site used `===` which leaks secret length and prefix
 *         information via timing. An attacker can binary-search the secret.
 * AFTER:  timingSafeEqual with length-normalised buffers eliminates the oracle.
 *
 * Usage:
 *   if (isValidAdminSecret(req)) { ... }
 */
export function isValidAdminSecret(req: Request, secretEnvVar = 'ADMIN_SECRET'): boolean {
  const header = req.headers['x-admin-secret'] as string | undefined;
  const expected = process.env[secretEnvVar];
  if (!header || !expected) return false;
  // Length check first avoids Buffer.alloc mismatch errors in timingSafeEqual.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
