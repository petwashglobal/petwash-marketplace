/**
 * PR-PROVIDER-CONFIRMED-NOTIFY — regression pin for the provider-side
 * "payment released" notification in handleConfirmCompletion.
 *
 * BEFORE (surfaced by 2026-08-18 audit):
 *   channels: ['inbox']
 *
 * → provider only learned about payout release by opening the Firestore
 *   inbox tab. No email receipt. No push wake-up on their phone. Silent
 *   list-tab flip in POSJobs when they happened to refresh. Zero parity
 *   with Rover / MadPaws / WhatIDog which push + email "You earned ₪X".
 *
 * These pins lock the fix (inbox + email + push) in place and require
 * a booking-scoped CTA so the notification is actionable, not just
 * informational.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

describe('provider payout notification — channel expansion pin', () => {
  it('provider "payment released" dispatch uses inbox + email + push', () => {
    // Find the block anchored on the provider-directed title.
    // Locate the "💰 תשלום שוחרר" title and require ['inbox','email','push']
    // to appear in the same dispatchNotification body.
    const idx = SRC.indexOf('💰 תשלום שוחרר');
    expect(idx).toBeGreaterThan(-1);
    // Look at the ~700 chars after that title for the channels array.
    const window = SRC.slice(idx, idx + 800);
    expect(window).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]push['"]\s*\]/);
  });

  it('does NOT silently regress to inbox-only', () => {
    const idx = SRC.indexOf('💰 תשלום שוחרר');
    const window = SRC.slice(idx, idx + 800);
    expect(window).not.toMatch(/channels:\s*\[\s*['"]inbox['"]\s*\]/);
  });

  it('carries a booking-scoped CTA (provider can tap through to the job)', () => {
    const idx = SRC.indexOf('💰 תשלום שוחרר');
    const window = SRC.slice(idx, idx + 800);
    expect(window).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/provider\/jobs\/\$\{requestId\}`/);
  });

  it('bilingual title (HE + EN) so push preview is legible for EN providers', () => {
    const idx = SRC.indexOf('💰 תשלום שוחרר');
    const window = SRC.slice(idx, idx + 800);
    expect(window).toMatch(/Payment released/);
  });

  it('still non-blocking (try/catch swallows failures)', () => {
    // Grab the block again and require the surrounding catch keeps the
    // handler from failing the confirm on a notification-only error.
    const idx = SRC.indexOf('💰 תשלום שוחרר');
    // Rewind ~200 chars to catch the preceding try {, then look forward
    // for the catch.
    const window = SRC.slice(Math.max(0, idx - 200), idx + 900);
    expect(window).toMatch(/try\s*\{/);
    expect(window).toMatch(/catch\s*\(\s*notifErr:\s*any\s*\)/);
    expect(window).toMatch(/logger\.warn\(/);
  });
});
