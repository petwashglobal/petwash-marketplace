/**
 * Task 17 — CEO fire order 101-140.
 *
 * STAFF APPLICATION double-send audit. Current state:
 *
 *   - server/services/StaffOnboardingService.ts createApplication()
 *     performs the DB insert only. NO email is dispatched here.
 *   - server/routes/staff-onboarding.ts POST /api/staff/applications
 *     performs the DB insert + a Google Sheets log — NO email.
 *   - server/routes/careers.ts (the /careers frontend endpoint) also
 *     performs no email dispatch on staff-application submission.
 *
 * Because no email is sent at all, there is NO current double-send
 * risk. This pin freezes that: if anyone later adds an email
 * dispatch to any of these three files WITHOUT an idempotency guard,
 * the test breaks so the guard can be added at the same time.
 *
 * The expected shape of that future guard is a claim on the
 * staff_applications.id primary key using the same pattern the
 * booking + provider handlers use in NotificationEventHandlers.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('Staff application flow has no unguarded email dispatch (Task 17)', () => {
  it('StaffOnboardingService.createApplication does not call sgMail / mail helpers', () => {
    const src = R('services/StaffOnboardingService.ts');
    expect(src).not.toMatch(/sgMail\.send/);
    expect(src).not.toMatch(/createMailService/);
    expect(src).not.toMatch(/sendGuardedEmail/);
    expect(src).not.toMatch(/sendWelcomeEmail/);
  });

  it('routes/staff-onboarding.ts /applications POST does not call sgMail / mail helpers', () => {
    const src = R('routes/staff-onboarding.ts');
    // Find the /applications POST body region and inspect it.
    const idx = src.indexOf("app.post('/api/staff/applications'");
    expect(idx).toBeGreaterThan(-1);
    // Look forward until the next `app.post(` — the region for /applications.
    const nextPost = src.indexOf('app.post(', idx + 1);
    const region = src.slice(idx, nextPost > 0 ? nextPost : idx + 4000);
    expect(region).not.toMatch(/sgMail\.send/);
    expect(region).not.toMatch(/createMailService/);
    expect(region).not.toMatch(/sendGuardedEmail/);
  });

  it('routes/careers.ts does not call sgMail / mail helpers', () => {
    const src = R('routes/careers.ts');
    expect(src).not.toMatch(/sgMail\.send/);
    expect(src).not.toMatch(/createMailService/);
    expect(src).not.toMatch(/sendGuardedEmail/);
  });
});
