/**
 * The OTP budget must only be spent by things that actually send an OTP.
 *
 * otpLimiter is 5 requests per 5 minutes per IP — deliberately tight, because
 * a bot rotating phone numbers can otherwise burn the 150 SMS/day Twilio cap
 * and lock out real customers for the rest of the day (SECURITY 2026-05-24).
 * That reasoning applies to routes that SEND something. It was also being
 * applied to `GET /status`, a read-only config check that sends nothing.
 *
 * SignUpLuxury calls /api/auth/sms/status on mount, so opening the signup page
 * spent one of the five. A few page loads — or several people sharing one
 * carrier NAT, which is the norm on Israeli mobile — exhausted the window
 * before anyone typed a phone number, and POST /start then answered 429.
 * Production logs for the 24h to 2026-09-19: 245 rejections on /status alone.
 */
import type { Request, Response, NextFunction } from 'express';
import { otpLimiter } from './rateLimiter';

/**
 * Paths (relative to the mount) that spend no quota. Keep this list tiny and
 * keep it to GETs: anything that sends an SMS or an email must not be here.
 */
const FREE_READS = new Set(['/status']);

export function otpLimiterExceptReadOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' && FREE_READS.has(req.path)) {
    next();
    return;
  }
  otpLimiter(req, res, next);
}

export default otpLimiterExceptReadOnly;
