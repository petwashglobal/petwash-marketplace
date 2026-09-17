/**
 * 2026-09-17 sweep: routes that made Pet Wash send branded email / push, or
 * exposed ops data, to callers who were not admins (several with NO login).
 * Bearer requests skip CSRF, so "anonymous" meant plain curl.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const routes = read('routes.ts');

describe('server/routes.ts inline routes are admin-gated', () => {
  for (const path of [
    '/api/send-membership-confirmation',
    '/api/send-egift-activation',
    '/api/email/send-partner-invitation',
    '/api/email/send-partner-invitation-hebrew',
    '/api/email/welcome',
    '/api/send-platform-report',
  ]) {
    it(path, () => {
      expect(routes).toContain(`app.post('${path}', requireAdmin, async`);
    });
  }

  it('/api/logistics and /api/gmail mounts require admin', () => {
    expect(routes).toContain("app.use('/api/logistics', validateFirebaseToken, apiLimiter, requireAdmin, logisticsRoutes);");
    expect(routes).toContain("app.use('/api/gmail', apiLimiter, requireAdmin, gmailRoutes);");
  });

  it('birthday vouchers are owner-only', () => {
    const i = routes.indexOf("app.get('/api/birthday-voucher/user/:uid'");
    const h = routes.slice(i, i + 600);
    expect(h).toContain('requireAuth');
    expect(h).toContain("if (callerUid !== uid) return res.status(403)");
  });

  it('bare /api mounts carry NO blanket admin guard (it would block the whole API)', () => {
    expect(routes).not.toMatch(/app\.use\('\/api', [^)]*requireAdmin/);
  });
});

describe('router files', () => {
  it('thank-you + signature invite + investor event are admin-gated per route', () => {
    const t = read('routes/send-thank-you.ts');
    expect(t).toContain("router.post('/send-signature-invite', requireAdmin,");
    expect(t).toContain("router.post('/send-thank-you', requireAdmin,");
    expect(t).not.toMatch(/router\.use\(/);
    const inv = read('routes/send-investor-event-email.ts');
    expect(inv).toContain("router.post('/send-investor-event-email', requireAdmin,");
    expect(inv).not.toMatch(/router\.use\(/);
  });

  it('platform seed is admin-gated', () => {
    expect(read('routes/platform-api.ts')).toContain('router.post("/platforms/seed", requireAdmin,');
  });

  it('a push to anyone but yourself needs a verified super-admin', () => {
    const p = read('routes/push-notifications.ts');
    expect(p).toContain('if (targetUserIds.some((id) => id !== senderId) && !isSuperAdminVerified(req))');
  });
});
