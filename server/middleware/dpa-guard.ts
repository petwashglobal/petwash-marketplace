/**
 * server/middleware/dpa-guard.ts
 * Blocks biometric / KYC endpoints until the Google Cloud DPA is signed.
 *
 * Requirement: Israeli Privacy Protection Law (Amendment 13, 2025) + GDPR Article 28.
 * Set GOOGLE_CLOUD_DPA_ACCEPTED=true after signing the DPA at:
 *   https://cloud.google.com/terms/data-processing-addendum
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

const DPA_ACCEPTED = process.env.GOOGLE_CLOUD_DPA_ACCEPTED === 'true';

if (!DPA_ACCEPTED) {
  logger.warn(
    '[DPA Guard] GOOGLE_CLOUD_DPA_ACCEPTED is not set — biometric/KYC endpoints are BLOCKED. ' +
    'Sign the Google Cloud DPA and set GOOGLE_CLOUD_DPA_ACCEPTED=true to enable.'
  );
}

export function requireDpaAccepted(req: Request, res: Response, next: NextFunction) {
  if (DPA_ACCEPTED) return next();

  logger.warn('[DPA Guard] Blocked biometric request — DPA not signed', {
    path: req.path,
    ip: (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress,
  });

  return res.status(451).json({
    error: 'DPA_REQUIRED',
    message:
      'Biometric / KYC processing is disabled until the Google Cloud Data Processing Agreement is signed. ' +
      'Set GOOGLE_CLOUD_DPA_ACCEPTED=true after signing at https://cloud.google.com/terms/data-processing-addendum',
    legalBasis: 'Google Cloud DPA — GDPR Article 28 / Israeli Privacy Protection Law Amendment 13',
  });
}
