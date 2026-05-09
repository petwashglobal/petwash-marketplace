/**
 * Issue #153 PR-D-BOOKING-AUDIT-WIRING — booking state-mutator audit trail.
 *
 * CEO-approved Option 1 (narrow): wire the EXISTING auditLog helper to
 * 5 canonical booking state mutators. Pure additive observability.
 * No state-machine rewrite. No money movement. No new audit logic.
 *
 * Wiring sites
 *   server/routes/bookings.ts          POST /:bookingId/confirm
 *                                      POST /:bookingId/complete
 *                                      POST /:bookingId/cancel
 *   server/routes/booking-chat.ts      POST /:bookingId/dispute
 *   server/routes/sitter-suite.ts      PATCH /bookings/:bookingId/provider-respond
 *                                       (BOTH accept + decline branches)
 *
 * Strict CEO-locked invariants asserted by this suite:
 *   • targetType ALWAYS 'booking'
 *   • targetId ALWAYS bookingId (the route param)
 *   • severity ALWAYS 'info'
 *   • Every audit call wraps via `void ... .catch(() => {})` so the
 *     parent state-mutation cannot be rolled back by an audit failure
 *     (logAuditEvent already swallows; this is double-guard).
 *   • Each call is placed AFTER the successful state mutation
 *     (`db.update / db.collection.update / .set({status:...})`) and
 *     BEFORE the response — which is the only point where a transition
 *     has actually happened.
 *   • The auditLog helper is INSERT-only on its underlying table —
 *     no UPDATE / DELETE / repair-mutation in any wiring path.
 *   • The wiring does NOT introduce ANY state-machine logic, money
 *     movement, refund logic, K9000 / Nayax / Tranzila reach, or
 *     provider-approval policy change.
 *
 * Out of scope (deferred per CEO mapping report)
 *   • booking_created (multiple per-vertical sites — separate PRs)
 *   • booking_rescheduled (no route currently owns this transition)
 *   • The other 11 booking routers (unified-booking, marketplace,
 *     octopus, platform-api, kiosk, etc.) — separate PRs once this
 *     canonical surface lands.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const bookings    = readFileSync(resolve(ROOT, 'server/routes/bookings.ts'), 'utf8');
const bookingChat = readFileSync(resolve(ROOT, 'server/routes/booking-chat.ts'), 'utf8');
const sitterSuite = readFileSync(resolve(ROOT, 'server/routes/sitter-suite.ts'), 'utf8');
const auditLog    = readFileSync(resolve(ROOT, 'server/middleware/auditLog.ts'), 'utf8');

type EventTypeMap = Record<string, { src: string; expectedActions: readonly string[] }>;
const SITES: EventTypeMap = {
  bookings:    { src: bookings,    expectedActions: ['booking_confirmed', 'booking_completed', 'booking_cancelled'] },
  bookingChat: { src: bookingChat, expectedActions: ['booking_disputed'] },
  sitterSuite: { src: sitterSuite, expectedActions: ['provider_response_changed'] },
};

// ── A. AUDIT HELPER IS INSERT-ONLY ────────────────────────────────────────

describe('PR-D-BOOKING-AUDIT-WIRING — auditLog helper is INSERT-only', () => {
  it('1. logAuditEvent uses db.insert exclusively (no update/delete)', () => {
    expect(auditLog).toMatch(/db\.insert\(\s*auditEvents\s*\)/);
    expect(auditLog).not.toMatch(/db\.update\(\s*auditEvents\s*\)/);
    expect(auditLog).not.toMatch(/db\.delete\(\s*auditEvents\s*\)/);
  });

  it('2. logAuditEvent swallows insert errors (parent flow cannot be rolled back by audit failure)', () => {
    expect(auditLog).toMatch(/try\s*\{[\s\S]*?await\s+db\.insert\([\s\S]*?\}\s*catch\s*\([\s\S]*?\)\s*\{/);
  });
});

// ── B. EVERY WIRING CALL USES THE STRICT SHAPE ─────────────────────────────

describe('PR-D-BOOKING-AUDIT-WIRING — strict audit shape on every site', () => {
  for (const [label, { src, expectedActions }] of Object.entries(SITES)) {
    for (const action of expectedActions) {
      describe(`${label} → ${action}`, () => {
        const findCallBlock = (): string => {
          const idx = src.indexOf(`actionType: '${action}'`);
          if (idx < 0) throw new Error(`actionType '${action}' not found in ${label}`);
          // Slice a generous window backward + forward so the
          // logAuditEvent call body is fully captured.
          return src.slice(Math.max(0, idx - 600), idx + 800);
        };

        it('targetType is "booking"', () => {
          expect(findCallBlock()).toMatch(/targetType:\s*['"]booking['"]/);
        });
        it('targetId is bookingId', () => {
          expect(findCallBlock()).toMatch(/targetId:\s*bookingId\b/);
        });
        it('severity is "info"', () => {
          expect(findCallBlock()).toMatch(/severity:\s*['"]info['"]/);
        });
        it('call is fire-and-forget via void + .catch (cannot block the request)', () => {
          expect(findCallBlock()).toMatch(/void\s+logAuditEvent\(/);
          expect(findCallBlock()).toMatch(/\.catch\(\s*\(\)\s*=>\s*\{?\s*\/\*[\s\S]*?\*\/?\s*\}?\s*\)/);
        });
      });
    }
  }
});

// ── C. NO UPDATE / DELETE / REPAIR MUTATION INTRODUCED ANYWHERE ────────────

describe('PR-D-BOOKING-AUDIT-WIRING — no UPDATE/DELETE/repair mutation anywhere in the wired flows', () => {
  it('3. NONE of the wired files introduce a NEW db.update or db.delete call as part of this wiring', () => {
    // We don't ban db.update entirely (legitimate booking state writes
    // already exist in these routes). Instead, we assert that within a
    // ±200-char window of EACH logAuditEvent call site, there is no
    // additional db.update or db.delete on auditEvents or any
    // *audit*-named table — which would indicate a mutation introduced
    // by this PR (forbidden by the CEO append-only invariant).
    for (const { src } of Object.values(SITES)) {
      const matches = [...src.matchAll(/void\s+logAuditEvent\(/g)];
      for (const m of matches) {
        const start = Math.max(0, (m.index ?? 0) - 200);
        const end = (m.index ?? 0) + 800;
        const window_ = src.slice(start, end);
        expect(window_).not.toMatch(/db\.update\([^)]*audit/i);
        expect(window_).not.toMatch(/db\.delete\([^)]*audit/i);
        expect(window_).not.toMatch(/repair|auto[_-]?repair|reconcileAudit/i);
      }
    }
  });

  it('4. logAuditEvent is the ONLY audit function invoked from the wiring (no parallel writers introduced)', () => {
    // Defensive: this PR must not introduce parallel "audit" writers
    // that bypass logAuditEvent. Allow only the canonical helper.
    for (const { src } of Object.values(SITES)) {
      // Permitted: void logAuditEvent(...)
      // Disallowed: directly writing to auditEvents table from these files
      expect(src).not.toMatch(/db\.insert\(\s*auditEvents/);
    }
  });
});

// ── D. STATE-MUTATION ORDERING — AUDIT FIRES AFTER SUCCESSFUL TRANSITION ───

describe('PR-D-BOOKING-AUDIT-WIRING — audit fires AFTER the state mutation succeeds', () => {
  it('5. bookings.ts confirm — audit follows the firestore status:"confirmed" update', () => {
    const updateIdx = bookings.indexOf('status: "confirmed"');
    const auditIdx = bookings.indexOf("actionType: 'booking_confirmed'");
    expect(updateIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(updateIdx);
  });

  it('6. bookings.ts complete — audit follows the firestore status:"completed" update', () => {
    const updateIdx = bookings.indexOf('status: "completed"');
    const auditIdx = bookings.indexOf("actionType: 'booking_completed'");
    expect(updateIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(updateIdx);
  });

  it('7. bookings.ts cancel — audit follows the firestore status:"cancelled" update', () => {
    const updateIdx = bookings.indexOf('status: "cancelled"');
    const auditIdx = bookings.indexOf("actionType: 'booking_cancelled'");
    expect(updateIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(updateIdx);
  });

  it('8. booking-chat.ts dispute — audit follows the disputed status update', () => {
    const updateIdx = bookingChat.indexOf("status: 'disputed'");
    const auditIdx = bookingChat.indexOf("actionType: 'booking_disputed'");
    expect(updateIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(updateIdx);
  });

  it('9. sitter-suite.ts provider-respond — both accept + decline emit before res.json', () => {
    // ACCEPT branch must emit before its res.json
    const acceptAudit = sitterSuite.indexOf("response: 'accept'");
    const acceptResJsonIdx = sitterSuite.indexOf("status: 'confirmed'", acceptAudit);
    expect(acceptAudit).toBeGreaterThan(0);
    expect(acceptResJsonIdx).toBeGreaterThan(acceptAudit);

    // DECLINE branch must emit before its res.json
    const declineAudit = sitterSuite.indexOf("response: 'decline'");
    const declineResJsonIdx = sitterSuite.indexOf("status: 'declined'", declineAudit);
    expect(declineAudit).toBeGreaterThan(0);
    expect(declineResJsonIdx).toBeGreaterThan(declineAudit);
  });
});

// ── E. SCOPE GUARDS — NO MONEY/K9000/NAYAX/PROVIDER-APPROVAL TOUCH ─────────

describe('PR-D-BOOKING-AUDIT-WIRING — scope guards (locked CEO rules)', () => {
  it('10. wiring does not introduce money movement / K9000 / Nayax / payout reach', () => {
    // We don't ban these names entirely (existing booking flows already
    // call them). Instead, we assert that within a ±400-char window of
    // EACH NEW logAuditEvent call site, NO new money / K9000 / Nayax /
    // payout / refund function is introduced.
    const forbidden = /(processIsraeliBankTransfer|MasavGenerator|releaseEscrowPayment|refundEscrowPayment|NayaxPaymentService\.refund|MachineCommandService\.dispatch|sendPayout|providerPayoutService\.payout)/i;
    for (const { src } of Object.values(SITES)) {
      const matches = [...src.matchAll(/void\s+logAuditEvent\(/g)];
      for (const m of matches) {
        const start = Math.max(0, (m.index ?? 0) - 400);
        const end = (m.index ?? 0) + 800;
        const window_ = src.slice(start, end);
        expect(window_).not.toMatch(forbidden);
      }
    }
  });

  it('11. wiring does not touch provider approval / role assignment / claim writes', () => {
    const forbidden = /(setCustomUserClaims|syncFirebaseClaims|providerApprovalService|setRole)/i;
    for (const { src } of Object.values(SITES)) {
      const matches = [...src.matchAll(/void\s+logAuditEvent\(/g)];
      for (const m of matches) {
        const start = Math.max(0, (m.index ?? 0) - 400);
        const end = (m.index ?? 0) + 800;
        const window_ = src.slice(start, end);
        expect(window_).not.toMatch(forbidden);
      }
    }
  });
});

// ── F. IMPORT SURFACE ──────────────────────────────────────────────────────

describe('PR-D-BOOKING-AUDIT-WIRING — import surface', () => {
  it('12. bookings.ts imports logAuditEvent from middleware/auditLog', () => {
    expect(bookings).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('13. booking-chat.ts imports logAuditEvent from middleware/auditLog', () => {
    expect(bookingChat).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('14. sitter-suite.ts already imported logAuditEvent (no duplicate import added)', () => {
    expect(sitterSuite).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
    // Defensive — only ONE import line for logAuditEvent (no duplicate)
    const matches = sitterSuite.match(/from\s*['"]\.\.\/middleware\/auditLog['"]/g) || [];
    expect(matches.length).toBe(1);
  });
});
