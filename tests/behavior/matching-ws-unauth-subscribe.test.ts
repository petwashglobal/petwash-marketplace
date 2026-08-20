/**
 * Regression pin — /ws/match must gate SUBSCRIBE_ADMIN and SUBSCRIBE_BOOKING
 * on Firebase idToken + role/membership.
 *
 * Evil-hunt 2026-08-20: the server accepted anonymous SUBSCRIBE_ADMIN (streams
 * every marketplace live event: owner IDs, provider IDs, service types) and
 * SUBSCRIBE_BOOKING for ANY bookingId (any anonymous connection could iterate
 * bookingIds and tap the status stream). No auth of any kind.
 *
 * A full WS integration test would need a live http server + ws upgrade. We
 * pin here at the source level: helpers exist, both handlers call them, and
 * the client callers now attach an idToken. Combined with the code-review
 * of the SUBSCRIBE branches themselves (verifyWsToken + isCallerAdmin /
 * isCallerBookingParticipant), that is enough to prevent silent regressions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('/ws/match — SUBSCRIBE_ADMIN + SUBSCRIBE_BOOKING require Firebase auth', () => {
  const server = read('server/routes/matching-ws.ts');
  const admin = read('client/src/pages/admin/AdminLiveEvents.tsx');
  const bookingHook = read('client/src/hooks/useBookingEvents.ts');

  describe('server helpers', () => {
    it('imports firebase-admin auth and getSuperAdmins', () => {
      expect(server).toMatch(/import\s*\{\s*auth as firebaseAdminAuth\s*\}\s*from\s*['"][^'"]*firebase-admin['"]/);
      expect(server).toMatch(/import\s*\{\s*getSuperAdmins\s*\}\s*from\s*['"][^'"]*rbac['"]/);
    });

    it('verifyWsToken calls verifyIdToken with checkRevoked=true', () => {
      expect(server).toMatch(/verifyIdToken\(\s*idToken\s*,\s*true\s*\)/);
    });

    it('isCallerAdmin requires email_verified === true', () => {
      const fn = server.match(/function isCallerAdmin\([\s\S]*?^}/m)?.[0] ?? '';
      expect(fn).toMatch(/emailVerified/);
      expect(fn).toMatch(/getSuperAdmins/);
    });

    it('isCallerBookingParticipant uses parameterized SQL binding uid twice', () => {
      const fn = server.match(/function isCallerBookingParticipant\([\s\S]*?^}/m)?.[0] ?? '';
      expect(fn).toMatch(/owner_id\s*=\s*\$2\s*OR\s*provider_id\s*=\s*\$2/);
      expect(fn).toMatch(/\[requestId,\s*uid\]/);
    });
  });

  describe('server handlers gate on the helpers', () => {
    it('SUBSCRIBE_BOOKING handler calls verifyWsToken and isCallerBookingParticipant', () => {
      const branch = server.match(/msg\.type === 'SUBSCRIBE_BOOKING'[\s\S]{0,1500}/)?.[0] ?? '';
      expect(branch).toMatch(/verifyWsToken\(msg\.idToken\)/);
      expect(branch).toMatch(/isCallerBookingParticipant\(requestId,\s*user\.uid\)/);
      expect(branch).toMatch(/code:\s*['"]UNAUTHORIZED['"]/);
      expect(branch).toMatch(/code:\s*['"]FORBIDDEN['"]/);
    });

    it('SUBSCRIBE_ADMIN handler calls verifyWsToken and isCallerAdmin', () => {
      const branch = server.match(/msg\.type === 'SUBSCRIBE_ADMIN'[\s\S]{0,1200}/)?.[0] ?? '';
      expect(branch).toMatch(/verifyWsToken\(msg\.idToken\)/);
      expect(branch).toMatch(/isCallerAdmin\(user\)/);
      expect(branch).toMatch(/code:\s*['"]UNAUTHORIZED['"]/);
      expect(branch).toMatch(/code:\s*['"]FORBIDDEN['"]/);
    });

    it('handlers no longer add watchers before auth (anonymous path removed)', () => {
      // The exact old shape — adding to Set with no verify — must be gone.
      const stripped = server.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Grab a generous window of the SUBSCRIBE_ADMIN branch (up to the next
      // top-level `if (msg.type ===` marker) so verifyWsToken is inside it.
      const adminBranch = stripped.match(/msg\.type === 'SUBSCRIBE_ADMIN'[\s\S]{0,1500}/)?.[0] ?? '';
      const firstAdd = adminBranch.indexOf('adminWatchers.add');
      const firstVerify = adminBranch.indexOf('verifyWsToken');
      expect(firstVerify, 'verifyWsToken must appear inside the SUBSCRIBE_ADMIN branch').toBeGreaterThan(-1);
      expect(firstAdd, 'adminWatchers.add must appear inside the SUBSCRIBE_ADMIN branch').toBeGreaterThan(-1);
      expect(firstAdd).toBeGreaterThan(firstVerify);
    });
  });

  describe('client callers attach idToken to subscribe', () => {
    it('AdminLiveEvents.tsx imports firebase auth and sends idToken with SUBSCRIBE_ADMIN', () => {
      expect(admin).toMatch(/import\s*\{\s*auth\s*\}\s*from\s*['"]@\/lib\/firebase['"]/);
      expect(admin).toMatch(/JSON\.stringify\(\{\s*type:\s*['"]SUBSCRIBE_ADMIN['"]\s*,\s*idToken\s*\}\)/);
    });

    it('useBookingEvents.ts imports firebase auth and sends idToken with SUBSCRIBE_BOOKING', () => {
      expect(bookingHook).toMatch(/import\s*\{\s*auth\s*\}\s*from\s*['"]@\/lib\/firebase['"]/);
      expect(bookingHook).toMatch(/JSON\.stringify\(\{\s*type:\s*['"]SUBSCRIBE_BOOKING['"]\s*,\s*requestId\s*,\s*idToken\s*\}\)/);
    });
  });
});
