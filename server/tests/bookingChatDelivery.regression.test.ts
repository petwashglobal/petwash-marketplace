/**
 * Booking chat — does a sent message actually REACH the other side?
 *
 * 2026-09-18 audit of "chat is not perfect": the customer's message was stored
 * and the UI said "sent", and there were three independent ways the recipient
 * never heard about it. Each is pinned here as a structural test on the source
 * (same discipline as bookingChatParticipantAuth.regression.test.ts — these
 * handlers need Postgres, Firestore and a socket server to run for real).
 *
 * 1. SITTER UID. booking_conversations.providerId is a Firebase UID. The
 *    sitter_bookings fallback stored sitter_bookings.sitterId — the serial PK
 *    of sitter_profiles — as a string. Every recipient-side check (send 403,
 *    inbox filter, socket subscribe, push tokens, email lookup) compared the
 *    sitter's real UID with "42" and failed. The resolver must read the UID
 *    from sitter_profiles.user_id.
 *
 * 2. ONLINE GATE. Push + email were skipped when isUserConnected(uid) — any
 *    open socket for that user. The realtime broadcast only reaches sockets
 *    subscribed to THIS conversation. A recipient parked on another screen got
 *    neither. The gate must ask the per-conversation question.
 *
 * 3. EMAIL FALLBACK. The offline email was a direct SendGrid call from a
 *    hardcoded address, bypassing the spend guard and the verified sender
 *    (SENDGRID_FROM_EMAIL). It must go through sendGuardedEmail with the
 *    configured sender, and skip cleanly when SendGrid is not configured.
 *
 * 4. SUPPORT → CUSTOMER. POST /api/inbox/admin/send-user wrote one Firestore
 *    document and nothing else: a PetWash support message reached the customer
 *    only if they opened the in-app inbox. It must dispatch through the unified
 *    notification dispatcher with email on by default.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const CHAT = read('routes', 'booking-chat.ts');
const WS = read('websocket.ts');
const INBOX = read('routes', 'inbox.ts');
const SENDGRID_BASELINE = read('lib', 'sendgrid-direct-baseline.txt');

function window(src: string, anchor: RegExp, lines = 40): string {
  const all = src.split('\n');
  const i = all.findIndex((l) => anchor.test(l));
  expect(i, `anchor ${anchor} not found`).toBeGreaterThanOrEqual(0);
  return all.slice(i, i + lines).join('\n');
}

describe('booking-chat — the sitter conversation is addressed to the sitter\'s Firebase UID', () => {
  const w = window(CHAT, /SITTER-CHAT-UID \(2026-09-18\): sitter_bookings\.sitterId/, 30);

  it('resolves providerId from sitter_profiles.user_id', () => {
    expect(w).toMatch(/leftJoin\(sitterProfiles,\s*eq\(sitterProfiles\.id,\s*sitterBookings\.sitterId\)\)/);
    expect(w).toMatch(/sitterUid:\s*sitterProfiles\.userId/);
    expect(w).toMatch(/providerId\s*=\s*sitterB\.sitterUid/);
  });

  it('never stores the numeric sitter_profiles PK as the provider UID again', () => {
    expect(CHAT).not.toMatch(/sitterId\?*\.toString\(\)/);
  });

  it('imports sitterProfiles from the shared schema (a join on an unimported table is a runtime crash)', () => {
    expect(CHAT).toMatch(/import\s*\{[^}]*\bsitterProfiles\b[^}]*\}\s*from\s*'@shared\/schema'/s);
  });
});

describe('booking-chat — push/email gate asks "live in THIS thread", not "any socket open"', () => {
  it('websocket exports a per-conversation subscription check that uses bookingChatSubscriptions', () => {
    const w = window(WS, /export function isUserSubscribedToBookingChat\(/, 15);
    expect(w).toMatch(/client\.userId === uid/);
    expect(w).toMatch(/readyState === WebSocket\.OPEN/);
    expect(w).toMatch(/bookingChatSubscriptions\.has\(key\)/);
  });

  it('the send handler gates on that check with the conversation id', () => {
    expect(CHAT).toMatch(/if\s*\(\s*!isUserSubscribedToBookingChat\(recipientUid,\s*conv\.conversationId\)\s*\)/);
  });

  it('the coarse isUserConnected() no longer decides chat delivery', () => {
    const code = CHAT.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(code).not.toMatch(/isUserConnected\(/);
    expect(code).not.toMatch(/\bisUserConnected\b/);
  });

  it('every sitter-rail handler compares the sitter UID, never the numeric PK', () => {
    // /open, /provider-arriving and /no-show all read sitter_bookings; each must join
    // sitter_profiles for the UID. Count the joins against the reads.
    const reads = (CHAT.match(/\.from\(sitterBookings\)/g) ?? []).length;
    const joins = (CHAT.match(/\.leftJoin\(sitterProfiles,\s*eq\(sitterProfiles\.id,\s*sitterBookings\.sitterId\)\)/g) ?? []).length;
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(joins).toBe(reads);
    expect(CHAT).toMatch(/booking\.walkerId : booking\.sitterUid\) === uid/);
  });
});

describe('booking-chat — offline email fallback is guarded and sent from the verified sender', () => {
  const cascade = CHAT.slice(CHAT.indexOf('Notification cascade'), CHAT.indexOf('Notification cascade') + 5000);

  it('goes through sendGuardedEmail (EmailSpendGuard sees it)', () => {
    expect(cascade).toMatch(/sendGuardedEmail\(\{\s*service:\s*'booking-chat-offline'/);
    expect(cascade).not.toMatch(/sgMail\s*\.\s*send\s*\(/);
  });

  it('uses SENDGRID_FROM_EMAIL rather than a hardcoded from address', () => {
    expect(cascade).toMatch(/from:\s*\{\s*email:\s*process\.env\.SENDGRID_FROM_EMAIL/);
  });

  it('skips loudly when SendGrid is not configured instead of throwing into a warn', () => {
    expect(cascade).toMatch(/if\s*\(!isSendGridConfigured\(\)\)/);
  });

  it('the file is no longer grandfathered in the direct-SendGrid baseline', () => {
    expect(SENDGRID_BASELINE).not.toMatch(/server\/routes\/booking-chat\.ts/);
  });

  it('the control-char sanitiser is written with escapes, so the file is text (grep/diff/review can read it)', () => {
    expect(CHAT).toMatch(/\/\[\\x00-\\x1f\\x7f\]\/g/);
    // No raw C0 control bytes anywhere in the source (tab/LF/CR excepted).
    // eslint-disable-next-line no-control-regex
    expect(CHAT).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/);
  });
});

describe('inbox — a support message to one user leaves the app', () => {
  const w = window(INBOX, /router\.post\('\/admin\/send-user'/, 90);

  it('dispatches through the unified notification dispatcher', () => {
    expect(w).toMatch(/dispatchNotification\(\{/);
    expect(INBOX).toMatch(/import\s*\{[^}]*dispatchNotification[^}]*\}\s*from\s*'\.\.\/lib\/notificationDispatcher'/);
  });

  it('email is on by default; sms and push are opt-in per send', () => {
    expect(w).toMatch(/data\.channels\s*\?\?\s*\['inbox',\s*'email'\]/);
    expect(w).toMatch(/z\.array\(z\.enum\(\['inbox',\s*'email',\s*'sms',\s*'push'\]\)\)/);
  });

  it('resolves the address from the Firebase account, so a users-row without email still gets mail', () => {
    expect(w).toMatch(/firebaseAuth\.getUser\(data\.uid\)/);
    expect(w).toMatch(/email:\s*account\?\.email/);
    expect(w).toMatch(/phone:\s*account\?\.phoneNumber/);
  });

  it('tells the admin what was actually delivered', () => {
    expect(w).toMatch(/emailSent:\s*result\.emailSent/);
    expect(w).toMatch(/errors:\s*result\.errors/);
  });
});
