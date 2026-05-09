/**
 * Issue #153 PR-F — auth on booking completion / start / confirm routes.
 *
 * Forensic audit (#202) findings F-02 + F-12: three routes that trigger
 * settlement, withholding, payout queue, P&L ledger, and digital-receipt
 * issuance lacked any auth gate. Anyone with a bookingId could complete
 * a booking; walk-my-pet /confirm trusted a body-supplied walkerId; the
 * walk /start route relied only on a 6-digit numeric confirmation code
 * with no rate limit (brute-forceable).
 *
 * CEO-approved scope (PR-F): add requireAuth + caller-vs-booking
 * ownership check + bookingLimiter on the start route. NO money-flow
 * change. Handler bodies stay identical except for the auth gate at
 * the top.
 *
 * Locked invariants this suite enforces:
 *
 *   A. Each of the three routes uses requireAuth at the route declaration.
 *   B. Each route reads the caller UID from req.user.uid (not from body).
 *   C. Each route performs a caller-vs-booking ownership check that
 *      returns 403 when the caller is not the legitimate participant.
 *   D. The /walks/:bookingId/start route additionally has bookingLimiter.
 *   E. No money-flow keyword (payout, settlement, commission, withholding,
 *      escrow, capture, charge, refund, Nayax, Tranzila, Stripe, SUMIT)
 *      appears as new executable code introduced by this PR — auth-only.
 *   F. The walk-my-pet handlers no longer trust body.walkerId for auth.
 *   G. The bookingLimiter import is wired in walk-my-pet.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const sitterSrc = readFileSync(resolve(ROOT, 'server/routes/sitter-suite.ts'), 'utf8');
const walkSrc = readFileSync(resolve(ROOT, 'server/routes/walk-my-pet.ts'), 'utf8');

// ── A. requireAuth applied at route declarations ─────────────────────────

describe('PR-F — requireAuth on the three previously-unauth routes', () => {
  it('1. PATCH /api/sitter-suite/bookings/:id/complete uses requireAuth', () => {
    expect(sitterSrc).toMatch(
      /router\.patch\(\s*['"]\/bookings\/:id\/complete['"]\s*,\s*requireAuth\s*,/,
    );
  });

  it('2. POST /api/walk-my-pet/walks/:bookingId/confirm uses requireAuth', () => {
    expect(walkSrc).toMatch(
      /router\.post\(\s*['"]\/walks\/:bookingId\/confirm['"]\s*,\s*requireAuth\s*,/,
    );
  });

  it('3. POST /api/walk-my-pet/walks/:bookingId/start uses requireAuth + bookingLimiter', () => {
    expect(walkSrc).toMatch(
      /router\.post\(\s*['"]\/walks\/:bookingId\/start['"]\s*,\s*requireAuth\s*,\s*bookingLimiter\s*,/,
    );
  });
});

// ── B. Caller UID read from req.user.uid, not from body ──────────────────

describe('PR-F — caller UID is sourced from req.user, not body', () => {
  it('4. sitter complete handler reads (req as any).user?.uid', () => {
    // Locate the handler by route + body string match
    const start = sitterSrc.indexOf("router.patch('/bookings/:id/complete'");
    expect(start).toBeGreaterThan(0);
    const slice = sitterSrc.slice(start, start + 2000);
    expect(slice).toMatch(/\(req as any\)\.user\?\.uid/);
  });

  it('5. walk confirm handler reads (req as any).user?.uid (no body.walkerId trust)', () => {
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/confirm'");
    expect(start).toBeGreaterThan(0);
    const slice = walkSrc.slice(start, start + 2500);
    expect(slice).toMatch(/\(req as any\)\.user\?\.uid/);
    // Defensive: the legacy `req.body.walkerId` trust line is gone
    // (the entire pattern of using a body-supplied id as the auth
    // subject is dead).
    expect(slice).not.toMatch(/const\s+walkerId\s*=\s*req\.body\.walkerId/);
  });

  it('6. walk start handler reads (req as any).user?.uid', () => {
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/start'");
    expect(start).toBeGreaterThan(0);
    const slice = walkSrc.slice(start, start + 2500);
    expect(slice).toMatch(/\(req as any\)\.user\?\.uid/);
  });
});

// ── C. Ownership checks return 403 ───────────────────────────────────────

describe('PR-F — caller-vs-booking ownership checks', () => {
  it('7. sitter complete checks isAssignedSitter OR isBookingOwner', () => {
    const start = sitterSrc.indexOf("router.patch('/bookings/:id/complete'");
    const slice = sitterSrc.slice(start, start + 2500);
    expect(slice).toMatch(/sitter\.userId\s*===\s*callerUid/);
    expect(slice).toMatch(/booking\.ownerId\s*===\s*callerUid/);
    expect(slice).toMatch(/status\(403\)/);
  });

  it('8. walk confirm checks walker.userId === callerUid', () => {
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/confirm'");
    const slice = walkSrc.slice(start, start + 2500);
    expect(slice).toMatch(/walker\.userId\s*!==\s*callerUid/);
    expect(slice).toMatch(/status\(403\)/);
  });

  it('9. walk start checks walker.userId === callerUid', () => {
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/start'");
    const slice = walkSrc.slice(start, start + 2500);
    expect(slice).toMatch(/walker\.userId\s*!==\s*callerUid/);
    expect(slice).toMatch(/status\(403\)/);
  });
});

// ── D. bookingLimiter wired on /start ────────────────────────────────────

describe('PR-F — bookingLimiter rate limit on /start defends the 6-digit code path', () => {
  it('10. walk-my-pet imports bookingLimiter from middleware/rateLimiter', () => {
    expect(walkSrc).toMatch(
      /import\s*\{\s*bookingLimiter\s*\}\s*from\s*['"][./]+middleware\/rateLimiter['"]/,
    );
  });

  it('11. /walks/:bookingId/start route has bookingLimiter in the middleware chain', () => {
    expect(walkSrc).toMatch(
      /router\.post\(\s*['"]\/walks\/:bookingId\/start['"]\s*,\s*requireAuth\s*,\s*bookingLimiter\s*,/,
    );
  });
});

// ── E. No money-flow keyword introduced ──────────────────────────────────

describe('PR-F — no money-flow keyword introduced (auth-only PR)', () => {
  // Defence-in-depth: verify the auth gates we added do NOT mention
  // any money concept. The auth slice for each route should be free of
  // payout/settlement/commission/withhold/escrow/nayax/tranzila/etc.
  const FORBIDDEN = /(payout|settlement|commission|withhold|escrow|nayax|tranzila|stripe|sumit|capture|charge|refund)/i;

  it('12. sitter complete auth slice (first 600 chars after route decl) has no money keyword', () => {
    const start = sitterSrc.indexOf("router.patch('/bookings/:id/complete'");
    const authSlice = sitterSrc.slice(start, start + 600);
    expect(authSlice).not.toMatch(FORBIDDEN);
  });

  it('13. walk confirm auth slice has no money keyword', () => {
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/confirm'");
    const authSlice = walkSrc.slice(start, start + 800);
    expect(authSlice).not.toMatch(FORBIDDEN);
  });

  it('14. walk start auth slice has no money keyword', () => {
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/start'");
    const authSlice = walkSrc.slice(start, start + 800);
    expect(authSlice).not.toMatch(FORBIDDEN);
  });
});

// ── F. Body-supplied walkerId is no longer trusted for auth ──────────────

describe('PR-F — body-supplied walkerId is no longer the auth subject', () => {
  it('15. walk confirm handler does not derive walkerId from req.body for auth', () => {
    // The auth section (requireAuth + ownership check) must not contain
    // the legacy "const walkerId = req.body.walkerId" pattern. Body fields
    // for non-auth purposes are allowed elsewhere in the handler; the
    // auth slice (first ~800 chars from route decl) is what we pin.
    const start = walkSrc.indexOf("router.post('/walks/:bookingId/confirm'");
    const authSlice = walkSrc.slice(start, start + 800);
    expect(authSlice).not.toMatch(/req\.body\.walkerId/);
  });
});

// ── G. PR id marker for grepability ──────────────────────────────────────

describe('PR-F — file-level marker comment for traceability', () => {
  it('16. sitter-suite.ts mentions PR-F next to the patched route', () => {
    const start = sitterSrc.indexOf("router.patch('/bookings/:id/complete'");
    expect(start).toBeGreaterThan(0);
    // The block of comments above the route includes the PR-F marker.
    const before = sitterSrc.slice(Math.max(0, start - 800), start);
    expect(before).toMatch(/PR-F/);
  });

  it('17. walk-my-pet.ts mentions PR-F next to each patched route', () => {
    const confirmStart = walkSrc.indexOf("router.post('/walks/:bookingId/confirm'");
    const startStart = walkSrc.indexOf("router.post('/walks/:bookingId/start'");
    expect(confirmStart).toBeGreaterThan(0);
    expect(startStart).toBeGreaterThan(0);
    const beforeConfirm = walkSrc.slice(Math.max(0, confirmStart - 600), confirmStart);
    const beforeStart = walkSrc.slice(Math.max(0, startStart - 600), startStart);
    expect(beforeConfirm).toMatch(/PR-F/);
    expect(beforeStart).toMatch(/PR-F/);
  });
});
