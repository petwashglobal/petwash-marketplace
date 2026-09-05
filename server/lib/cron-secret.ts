import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Timing-safe CRON_SECRET comparison for machine-to-machine job endpoints.
 *
 * Sibling of `isValidAdminSecret` in ./admin-secret.ts, and the canonical
 * form of the check already open-coded in cron-nayax-sumit.ts,
 * cron-compliance.ts and cron-backup.ts (`x-cron-secret` timing-safe vs
 * CRON_SECRET). Extracted so new job routes cannot invent a weaker gate —
 * the failure mode this replaces was a HARDCODED literal
 * (`x-internal-job: petwash-cron`) standing in for a secret, which is
 * published in source and therefore no secret at all.
 *
 * Fail-closed: no header, or CRON_SECRET unset, → false.
 *
 * Usage:
 *   if (!isSuperAdminVerified(req) && !isValidCronSecret(req)) return res.status(403)...
 */
export function isValidCronSecret(req: Request, secretEnvVar = 'CRON_SECRET'): boolean {
  const raw = req.headers['x-cron-secret'];
  const header = (Array.isArray(raw) ? raw[0] : raw) as string | undefined;
  const expected = process.env[secretEnvVar];
  if (!header || !expected) return false;
  // Length check first avoids the throw timingSafeEqual raises on
  // differing buffer lengths — a wrong-length secret is simply invalid.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
