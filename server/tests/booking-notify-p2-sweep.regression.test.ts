/**
 * PR-BOOKING-NOTIFY-P2-SWEEP — regression pin for three counterparty-notify
 * gaps found by the 2026-08-18 audit:
 *   1. /start — provider starts service, customer never told
 *   2. /arriving — provider signals arrival, only WS (offline owners miss it)
 *   3. /photo-update — provider sends photo, owner never notified
 *
 * Each fix adds an additive fire-and-forget dispatchNotification. Push +
 * inbox for the two provider→customer signals (fast, non-blocking). No SMS
 * or email on high-frequency events (would be spammy).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

function block(anchorRegex: RegExp, endAnchor: RegExp): string {
  const start = SRC.search(anchorRegex);
  expect(start).toBeGreaterThan(-1);
  const rest = SRC.slice(start);
  const endRel = rest.search(endAnchor);
  return endRel > 0 ? rest.slice(0, endRel) : rest;
}

describe('/start — customer notified that service began', () => {
  const b = block(/router\.post\(\s*['"]\/:requestId\/start['"]/, /router\.post\(\s*['"]\/:requestId\/complete['"]/);
  it('dispatchNotification fires to booking.ownerId', () => {
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.ownerId/);
  });
  it('service_started title (bilingual) + push + inbox channels', () => {
    expect(b).toMatch(/Service started/);
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]push['"]\s*\]/);
  });
  it('runs AFTER the UPDATE (never notifies unless status flipped)', () => {
    const updateIdx = b.search(/db\.update\(bookingRequests\)/);
    const notifyIdx = b.search(/dispatchNotification\(/);
    expect(updateIdx).toBeGreaterThan(-1);
    expect(notifyIdx).toBeGreaterThan(updateIdx);
  });
});

describe('/arriving — persistent push+inbox (was WS-only)', () => {
  const b = block(/router\.post\(\s*['"]\/:requestId\/arriving['"]/, /router\.post\(\s*['"]\/:requestId\/confirm['"]|async function handleConfirmCompletion/);
  it('dispatchNotification fires to booking.ownerId', () => {
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.ownerId/);
  });
  it('carries "on the way" title and ETA context', () => {
    expect(b).toMatch(/on the way/);
    expect(b).toMatch(/etaMinutes/);
  });
  it('channels are inbox + push only (no SMS/email — real-time signal)', () => {
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]push['"]\s*\]/);
  });
});

describe('/photo-update — owner notified of new photo', () => {
  const b = block(/router\.post\(\s*['"]\/:requestId\/photo-update['"]/, /router\.post\(\s*['"]\/:requestId\/reprice['"]/);
  it('dispatchNotification fires to booking.ownerId', () => {
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.ownerId/);
  });
  it('carries a photo preview in the body (up to 140 chars)', () => {
    expect(b).toMatch(/slice\(0,\s*140\)/);
  });
  it('channels are inbox + push (photo updates are frequent — no email/SMS spam)', () => {
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]push['"]\s*\]/);
  });
});
