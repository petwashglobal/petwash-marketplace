import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17, CEO's Chrome: "Google Sign-In Failed — Server rejected the
 * sign-in [HTTP 429] — Auth rate limit exceeded". /api/auth/session and
 * /api/auth/post-login (token exchange, called on every page load and every
 * sign-in) shared one 10/min-per-IP bucket with the SMS/email code routes.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('sign-in token exchange has its own, roomier limit', () => {
  const lim = R('server/middleware/rateLimiter.ts');
  const block = lim.slice(lim.indexOf('export const sessionLimiter'), lim.indexOf('// KYC submission endpoint limiter'));
  it('60 per minute per IP, its own Redis bucket and key', () => {
    expect(block).toContain('windowMs: 60 * 1000,');
    expect(block).toContain('max: 60,');
    expect(block).toContain("store: redisRateLimitStore('auth-session'),");
    expect(block).toContain('`auth-session:${getClientIP(req)}`');
  });
  it('session + post-login use it', () => {
    const routes = R('server/routes.ts');
    expect(routes).toContain("app.post('/api/auth/session', sessionLimiter, async (req, res) => {");
    expect(routes).toMatch(/app\.post\('\/api\/auth\/post-login', sessionLimiter, requireAuth,/);
  });
  it('the code-guessing routes keep the strict limiter', () => {
    const routes = R('server/routes.ts');
    // 2026-09-19: the SMS mount now uses otpLimiterExceptReadOnly instead of
    // otpLimiter directly. That wrapper exempts exactly one thing — the
    // read-only GET /status, which sends no SMS and was burning the same
    // 5-per-5-minutes budget as actually sending one (429 x245 in production
    // logs for the 24h to 2026-09-19, because SignUpLuxury calls it on every
    // page load). Everything that can send or guess a code still goes through
    // otpLimiter untouched, which is what this test is really pinning. The
    // assertion below checks that property rather than the literal line.
    expect(routes).toContain("app.use('/api/auth/sms', authLimiter, otpLimiterExceptReadOnly, authSmsRoutes);");
    const wrapper = R('server/middleware/otpLimiterExceptReadOnly.ts');
    expect(wrapper).toContain("const FREE_READS = new Set(['/status']);");
    expect(wrapper).toMatch(/req\.method === 'GET' && FREE_READS\.has\(req\.path\)/);
    expect(wrapper).toContain('otpLimiter(req, res, next);');

    expect(routes).toContain("app.use('/api/auth/email', authLimiter, otpLimiter, authEmailRoutes);");
    expect(lim).toMatch(/export const authLimiter = rateLimit\(\{\s*windowMs: 60 \* 1000, \/\/ 1 minute\s*max: 10,/);
  });
});
