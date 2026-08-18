/**
 * Task 12 — CEO fire order 101-140.
 *
 * Remaining customer-engagement route files. Sanitise 5xx/4xx
 * response-body error.message / err.message / ternary / message: leaks.
 *
 * Sanitised (92 total leaks across 6 files):
 *   - routes/chat-history.ts   (14 message: error.message inside 5xx blocks)
 *   - routes/notifications.ts  (14 one-liner res.status(4xx/5xx).json)
 *   - routes/social.ts         (12 return res.status(500).json)
 *   - routes/events.ts         (6 message: error.message inside 5xx blocks)
 *   - routes/pettrek.ts        (15 instanceof Error ternary)
 *   - routes/paw-finder.ts     (3 err.message || fallback)
 *
 * D12 firewall: none of these files touch money code. No change to
 * business logic (dispatch, GPS, notifications delivery, chat storage,
 * social graph, event replay).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  'routes/chat-history.ts',
  'routes/notifications.ts',
  'routes/social.ts',
  'routes/events.ts',
  'routes/pettrek.ts',
  'routes/paw-finder.ts',
];

function extractResponseBodies(src: string): string[] {
  const out: string[] = [];
  const rx = /res\.status\(\d{3}\)\s*\.json\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('Customer route 4xx/5xx bodies are generic', () => {
  for (const rel of FILES) {
    it(`${rel}: every res.status(...).json body is clean`, () => {
      const src = R(rel);
      const bodies = extractResponseBodies(src);
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) {
        expect(body).not.toMatch(/\berror\.message\b/);
        expect(body).not.toMatch(/\berr\.message\b/);
        expect(body).not.toMatch(/\berror\.stack\b/);
        expect(body).not.toMatch(/\berr\.stack\b/);
        expect(body).not.toMatch(/instanceof\s+Error\s*\?\s*(error|err|e)\.message/);
        expect(body).not.toMatch(/\bmessage:\s*(error|err|e)\.message\b/);
      }
    });
  }
});

describe('Discriminator codes present per file', () => {
  it('notifications.ts declares NOTIF_* codes', () => {
    const src = R('routes/notifications.ts');
    for (const c of [
      "'NOTIF_SEND_400'",
      "'NOTIF_TEMPLATES_500'",
      "'NOTIF_TEMPLATE_GET_500'",
      "'NOTIF_TEMPLATE_CREATE_400'",
      "'NOTIF_TEMPLATE_UPDATE_400'",
      "'NOTIF_TEMPLATE_DELETE_500'",
      "'NOTIF_LOGS_400'",
      "'NOTIF_STATS_500'",
      "'NOTIF_MARK_DELIVERED_400'",
      "'NOTIF_MARK_FAILED_400'",
      "'NOTIF_UNREAD_500'",
      "'NOTIF_USER_LIST_500'",
      "'NOTIF_MARK_READ_500'",
      "'NOTIF_MARK_ALL_READ_500'",
    ]) expect(src).toContain(c);
  });

  it('social.ts declares SOCIAL_*_500 codes', () => {
    const src = R('routes/social.ts');
    // Every touched site got a distinct SOCIAL_*_500 code from its
    // logger.error tag; count them.
    const matches = src.match(/'SOCIAL_[A-Z0-9_]+_500'/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(10);
  });

  it('pettrek.ts declares PETTREK_*_500 codes', () => {
    const src = R('routes/pettrek.ts');
    const matches = src.match(/'PETTREK_[A-Z0-9_]+_500'/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(10);
  });

  it('paw-finder.ts declares PAWFINDER_*_ERR codes', () => {
    const src = R('routes/paw-finder.ts');
    for (const c of [
      "'PAWFINDER_CREATE_ERR'",
      "'PAWFINDER_CONTACT_ERR'",
      "'PAWFINDER_RESOLVE_ERR'",
    ]) expect(src).toContain(c);
  });
});

describe('logger tags survive (internal trace intact)', () => {
  it('notifications.ts keeps all [Notifications] Error * tags', () => {
    const src = R('routes/notifications.ts');
    for (const tag of [
      '[Notifications] Error sending notification',
      '[Notifications] Error fetching templates',
      '[Notifications] Error fetching template',
      '[Notifications] Error creating template',
      '[Notifications] Error updating template',
      '[Notifications] Error deleting template',
      '[Notifications] Error fetching logs',
      '[Notifications] Error fetching stats',
      '[Notifications] Error marking as delivered',
      '[Notifications] Error marking as failed',
      '[Notifications] Error fetching unread count',
      '[Notifications] Error fetching user notifications',
      '[Notifications] Error marking as read',
      '[Notifications] Error marking all as read',
    ]) expect(src).toContain(tag);
  });

  it('events.ts keeps all [Events API] Failed to * tags', () => {
    const src = R('routes/events.ts');
    for (const tag of [
      '[Events API] Failed to fetch events',
      '[Events API] Failed to fetch event',
      '[Events API] Failed to fetch events by type',
      '[Events API] Failed to replay event',
      '[Events API] Failed to fetch events by aggregate',
      '[Events API] Failed to fetch event statistics',
    ]) expect(src).toContain(tag);
  });
});

describe('D12 firewall: no money code disturbed', () => {
  it('none of the sanitised files reference wallet/escrow/refund/credit', () => {
    for (const rel of FILES) {
      const src = R(rel);
      // These files are supposed to be non-money. A stray reference would
      // signal that the wrong file got included in this batch.
      expect(src).not.toMatch(/\bcreditWallet\b/);
      expect(src).not.toMatch(/\bescrowService\b/i);
      expect(src).not.toMatch(/\bNayaxSparkService\b/);
    }
  });
});
