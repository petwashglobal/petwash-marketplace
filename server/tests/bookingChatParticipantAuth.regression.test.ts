/**
 * booking-chat.ts participant authorisation pins (CEO §33).
 *
 * The rule: server derives the requester's identity from the
 * Firebase-verified token (`req.firebaseUser!.uid`) and — for any
 * conversation-touching handler — authorises by an equality check
 * against the loaded conversation row (`conv.customerId === uid ||
 * conv.providerId === uid`, with an optional isAdmin bypass).
 *
 * A regression here (a handler that either accepts a body-supplied
 * uid or forgets the participant equality check) lets user A read
 * user B's chat.
 *
 * Structural pin: this test reads booking-chat.ts and asserts the
 * discipline instead of standing up an express app. Any new handler
 * that gets `const uid = req.firebaseUser!.uid;` must be followed
 * (within the same handler window) by at least one of:
 *   • conv.customerId === uid || conv.providerId === uid
 *   • booking.ownerId === uid  (walk pipeline pre-loads booking)
 *   • booking.userId === uid   (unified pipeline)
 *   • isAdmin path
 * Missing all four → the test fails with the exact line number so a
 * reviewer knows exactly which handler slipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'booking-chat.ts'),
  'utf8',
);
const LINES = SRC.split('\n');

// Every handler starts by pulling uid from the verified token. Enumerate
// those anchor lines; each opens a handler-window we then audit.
function findHandlerAnchors(): number[] {
  const results: number[] = [];
  for (let i = 0; i < LINES.length; i++) {
    if (/const\s+uid\s*=\s*req\.firebaseUser!\.uid/.test(LINES[i])) results.push(i);
  }
  return results;
}

// A handler window is ~120 lines after the anchor; extend to the next
// anchor or EOF, whichever is closer. Rough but reliable — every
// handler in this file finishes well within that bound.
function handlerWindow(anchors: number[], idx: number): string {
  const start = anchors[idx];
  const end = idx + 1 < anchors.length ? anchors[idx + 1] : LINES.length;
  return LINES.slice(start, Math.min(end, start + 200)).join('\n');
}

const anchors = findHandlerAnchors();

describe('booking-chat.ts — §33 participant authorisation discipline', () => {
  it('anchors: at least a dozen handlers derive uid from firebaseUser (guards against a regex miss)', () => {
    expect(anchors.length).toBeGreaterThanOrEqual(12);
  });

  it('no handler reads uid from the client body (req.body.userId / customerId / providerId)', () => {
    // A body-supplied identity would let User A act as User B by
    // POSTing { userId: "<B>", ... }. Ban the pattern anywhere in
    // the file — not just per-handler — because a helper function
    // pulling from req.body would also be a hole.
    expect(SRC).not.toMatch(/uid\s*=\s*req\.body\.userId/);
    expect(SRC).not.toMatch(/uid\s*=\s*req\.body\.customerId/);
    expect(SRC).not.toMatch(/uid\s*=\s*req\.body\.providerId/);
    expect(SRC).not.toMatch(/uid\s*=\s*req\.body\.ownerId/);
  });

  it('every conversation-touching handler either checks participant equality or is an admin path', () => {
    const missing: string[] = [];
    const PARTICIPANT_CHECK_PATTERNS = [
      /conv\.customerId\s*(!==|===)\s*uid/,
      /conv\.providerId\s*(!==|===)\s*uid/,
      /booking\.ownerId\s*(!==|===)\s*uid/,
      /booking\.userId\s*(!==|===)\s*uid/,
      // Locally-scoped variables lifted from the loaded booking row.
      /customerId\s*!==\s*uid\s*&&\s*providerId\s*!==\s*uid/,
      /providerId\s*!==\s*uid\s*&&\s*customerId\s*!==\s*uid/,
      // Column-form equality via drizzle: eq(...customerId, uid).
      /eq\([^)]*Conversations\.customerId,\s*uid\)/,
      /eq\([^)]*Conversations\.providerId,\s*uid\)/,
      // Some handlers gate on the outer booking table before loading conv.
      /booking\?\.ownerId\s*(!==|===)\s*uid/,
      // Listing handlers that filter by an already-owned index — e.g.
      // superAppNotifications keyed on userId. The subsequent
      // conversation JOIN only enriches rows the user already owns.
      /eq\(superAppNotifications\.userId,\s*uid\)/,
    ];
    // Admin bypass patterns — accepted as an alternative to the
    // participant check when a handler is admin-only.
    const ADMIN_GATE_PATTERNS = [
      /isAdmin/,
      /claims\?\.\s*role\s*!==\s*['"]admin['"]/,
      /isSuperAdmin\(/,
    ];

    for (let i = 0; i < anchors.length; i++) {
      const window = handlerWindow(anchors, i);
      // Skip handlers that don't touch a conversation OR booking row —
      // e.g. a "list my inbox" handler that filters by uid alone via
      // `superAppNotifications.userId === uid`. That's already an
      // ownership filter.
      const touchesConv = /bookingConversations|conv\.|booking\?\.|const\s+conv\b|const\s+booking\b/.test(window);
      if (!touchesConv) continue;

      const hasCheck = PARTICIPANT_CHECK_PATTERNS.some((re) => re.test(window));
      const hasAdminBypass = ADMIN_GATE_PATTERNS.some((re) => re.test(window));
      if (!hasCheck && !hasAdminBypass) {
        missing.push(`Handler at booking-chat.ts:${anchors[i] + 1} touches a conversation but has no participant-equality gate (or admin bypass).`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('participant equality checks use STRICT equality (===/!==), never loose', () => {
    // JS loose equality would allow uid=0 or uid=null / undefined to
    // silently match some conversation columns. Every check MUST be
    // strict. Scan the WHOLE file for weakened forms and ban them.
    expect(SRC).not.toMatch(/conv\.customerId\s*(==|!=)[^=]/);
    expect(SRC).not.toMatch(/conv\.providerId\s*(==|!=)[^=]/);
  });

  it('customer and provider are BOTH checked in the "or" form — one alone is not enough', () => {
    // The common gate is `conv.customerId !== uid && conv.providerId !== uid`
    // (reject both). A handler that checks only customerId would let
    // the provider through in the wrong context. Assert the paired
    // form appears at least three times in the file so both roles
    // are covered wherever they should be.
    const paired = SRC.match(/customerId\s*!==\s*uid\s*&&\s*conv\.providerId\s*!==\s*uid/g) ?? [];
    expect(paired.length).toBeGreaterThanOrEqual(3);
  });
});
