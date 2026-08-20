import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Modernity SEV-1 five-gaps audit (2026-08-20).
//
// Each pin locks the ONE exact anchor a prior audit identified. If any of
// these regress, we get back the exact SEV-1 the fix closed:
//
//   #1 Money endpoints not wrapped in auditLogMiddleware
//      → super-admin credit / refund / top-up / burn had no discrete
//        audit_events row, so admin dashboards could not filter on
//        action_type and forensic investigations relied on inline logger
//        calls that were easy to miss.
//
//   #2 Unified booking flow never synced to Google Calendar
//      → SUMIT return handler confirmed + paid the booking but the
//        provider's Google Calendar never learned about it — the parallel
//        Nayax rail already did this correctly.
//
//   #3 SLACK_WEBHOOK_URL never in .env.example
//      → prod-critical alerts silently no-op'd when the secret was missing
//        because operators didn't know they needed to set it.
//
//   #4 alertManager.triggerAlert never fed by real-time error stream
//      → 7 runtime errors fired every 60s for 24h and nobody was paged.
//        logger.error forwarded to Sentry but never to alertManager.
//
//   #5 PetOnboardingShell Save was a stubbed toast
//      → the whole flow ended in a console.log; the collected draft was
//        discarded and no pet was ever created.

const REPO = join(__dirname, '..', '..');

const READ = (p: string) => readFileSync(join(REPO, p), 'utf8');

describe('modernity 2026-08-20 SEV-1 five-gaps fixes', () => {
  // ── #1 audit-log middleware on money-mutating routes ────────────────
  describe('SEV-1 #1 — auditLogMiddleware wraps money-mutating POST routes', () => {
    it('server/routes/wallet.ts wraps /nayax/redeem-loyalty with WALLET_BURN', () => {
      const src = READ('server/routes/wallet.ts');
      expect(src).toMatch(/from ['"]\.\.\/middleware\/auditLog['"]/);
      expect(src).toMatch(
        /router\.post\(\s*['"]\/nayax\/redeem-loyalty['"]\s*,\s*auditLogMiddleware\(\s*['"]WALLET_BURN['"]\s*\)/,
      );
    });

    it('server/routes/credit-wallet.ts wraps money-mutating POSTs with the right labels', () => {
      const src = READ('server/routes/credit-wallet.ts');
      expect(src).toMatch(/from ['"]\.\.\/middleware\/auditLog['"]/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]WALLET_TOPUP['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]WALLET_BURN['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]REFUND['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]CREDIT_WALLET_ADJUST['"]\s*\)/);
    });

    it('server/routes/prestige-pass.ts wraps money-mutating POSTs with the right labels', () => {
      const src = READ('server/routes/prestige-pass.ts');
      // The file already imported logAuditEvent; the wiring adds the middleware
      // export alongside it. Both must be present.
      expect(src).toMatch(/auditMiddleware as auditLogMiddleware/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]PRESTIGE_ISSUE['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]PRESTIGE_JOIN['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]EGIFT_ISSUE['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]EGIFT_REDEEM['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]REFUND['"]\s*\)/);
      expect(src).toMatch(/auditLogMiddleware\(\s*['"]CREDIT_WALLET_ADJUST['"]\s*\)/);
    });

    it('server/routes/egift-guest.ts wraps /guest/start with EGIFT_ISSUE', () => {
      const src = READ('server/routes/egift-guest.ts');
      expect(src).toMatch(/from ['"]\.\.\/middleware\/auditLog['"]/);
      expect(src).toMatch(
        /router\.post\(\s*['"]\/guest\/start['"]\s*,[\s\S]*?auditLogMiddleware\(\s*['"]EGIFT_ISSUE['"]\s*\)/,
      );
    });
  });

  // ── #2 booking-requests confirmed+paid creates the calendar event ──
  describe('SEV-1 #2 — booking-requests SUMIT return creates the calendar event', () => {
    it('the sumit-return handler calls createBookingEvent inside setImmediate, after the confirmed write', () => {
      const src = READ('server/routes/booking-requests.ts');
      // Isolate the sumit-return handler by its route prefix and stop at the
      // next router. mount.
      const start = src.indexOf("router.get('/:requestId/sumit-return'");
      expect(start).toBeGreaterThan(-1);
      const nextRoute = src.indexOf('router.', start + 1);
      const handler = nextRoute > start ? src.slice(start, nextRoute) : src.slice(start);

      // The confirmed DB write is present.
      const confirmedIdx = handler.indexOf("status: 'confirmed'");
      expect(confirmedIdx).toBeGreaterThan(-1);

      // createBookingEvent is present, sits AFTER the confirmed write, and
      // is inside a setImmediate block so a slow calendar call never delays
      // or rolls back payment confirmation.
      const calendarIdx = handler.search(/calendarIntegrationService\.createBookingEvent\s*\(/);
      expect(calendarIdx).toBeGreaterThan(confirmedIdx);
      const between = handler.slice(confirmedIdx, calendarIdx);
      expect(between).toMatch(/setImmediate\(/);
    });

    it('the guard test allows the exception and names this PR', () => {
      const guard = READ('server/tests/booking-calendar-after-payment.guard.test.ts');
      // The guard must document that Modernity SEV-1 #2 relaxes its ban.
      expect(guard).toMatch(/MODERNITY SEV-1 #2 EXCEPTION/);
      // The guard must still enforce that createBookingEvent is banned
      // outside the sumit-return handler.
      expect(guard).toMatch(/withoutAllowedHandler.*not\.toMatch\(\/createBookingEvent\/\)/s);
    });
  });

  // ── #3 SLACK_WEBHOOK_URL documented in .env.example ────────────────
  describe('SEV-1 #3 — SLACK_WEBHOOK_URL is documented in .env.example', () => {
    it('.env.example carries SLACK_WEBHOOK_URL with the prod-critical-alerts comment', () => {
      const src = READ('.env.example');
      expect(src).toMatch(/^SLACK_WEBHOOK_URL=/m);
      expect(src).toMatch(/Alert manager no-ops when unset/);
    });
  });

  // ── #4 logger.error feeds alertManager on sustained rates ──────────
  describe('SEV-1 #4 — logger.error forwards sustained rates to alertManager', () => {
    it('server/lib/logger.ts adds a rolling per-minute counter and calls checkServerErrorRate', () => {
      const src = READ('server/lib/logger.ts');
      // The forwarder helper is called from the error() body.
      expect(src).toMatch(/forwardToAlertManagerIfSustained\(\)/);
      // The helper computes a minute-bucket, caps at 20/min, and dispatches
      // via the existing checkServerErrorRate helper — no new alerts helper.
      expect(src).toMatch(/_ERR_ALERT_THRESHOLD_PER_MIN\s*=\s*20/);
      expect(src).toMatch(/import\(['"]\.\/alerts['"]\)/);
      expect(src).toMatch(/checkServerErrorRate\(\s*_errBucketCount\s*,\s*_errBucketCount\s*\)/);
    });
  });

  // ── #5 PetOnboardingShell Save posts to /api/pets ──────────────────
  describe('SEV-1 #5 — PetOnboardingShell Save actually persists the pet', () => {
    it('client/src/pages/onboarding/PetOnboardingShell.tsx POSTs to /api/pets with the draft', () => {
      const src = READ('client/src/pages/onboarding/PetOnboardingShell.tsx');
      // The old stubbed component is gone.
      expect(src).not.toMatch(/StubbedSaveButton/);
      expect(src).not.toMatch(/data-pr-pet-4-save-stub/);
      // The new component uses apiRequest and toast and navigates to /pets.
      expect(src).toMatch(/from ['"]\.\.\/\.\.\/lib\/queryClient['"]/);
      expect(src).toMatch(/from ['"]\.\.\/\.\.\/hooks\/use-toast['"]/);
      expect(src).toMatch(/apiRequest\(\s*['"]\/api\/pets['"]\s*,\s*['"]POST['"]/);
      expect(src).toMatch(/setLocation\(\s*['"]\/pets['"]\s*\)/);
      expect(src).toMatch(/variant:\s*['"]destructive['"]/);
    });
  });
});
