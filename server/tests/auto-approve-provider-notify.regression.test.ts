/**
 * PR-AUTO-APPROVE-PROVIDER-NOTIFY — regression pin for the provider-side
 * "payment released (auto-approved)" notification in the 24h auto-approve cron.
 *
 * Same shape as PR-PROVIDER-CONFIRMED-NOTIFY (the /confirm path fix) but
 * for the DEFAULT completion route: 24h customer inaction. Before the fix,
 * providers who were paid this way learned only via a silent Firestore
 * inbox row.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../cron/auto-approve-completions.ts'),
  'utf8',
);

describe('auto-approve cron — provider payout notification pin', () => {
  it('provider "payment released (auto-approved)" dispatch uses inbox + email + push', () => {
    const idx = SRC.indexOf('תשלום שוחרר (אישור אוטומטי)');
    expect(idx).toBeGreaterThan(-1);
    const window = SRC.slice(idx, idx + 1200);
    expect(window).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]push['"]\s*\]/);
  });

  it('does NOT silently regress to inbox-only', () => {
    const idx = SRC.indexOf('תשלום שוחרר (אישור אוטומטי)');
    const window = SRC.slice(idx, idx + 1200);
    expect(window).not.toMatch(/channels:\s*\[\s*['"]inbox['"]\s*\]/);
  });

  it('carries a booking-scoped CTA (provider deep-links back to the job)', () => {
    const idx = SRC.indexOf('תשלום שוחרר (אישור אוטומטי)');
    const window = SRC.slice(idx, idx + 1200);
    expect(window).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/provider\/jobs\/\$\{booking\.requestId\}`/);
  });

  it('bilingual title so push preview is legible for EN providers', () => {
    const idx = SRC.indexOf('תשלום שוחרר (אישור אוטומטי)');
    const window = SRC.slice(idx, idx + 1200);
    expect(window).toMatch(/Payment released \(auto-approved\)/);
  });

  it('is still fire-and-forget (try/catch swallows failures — no cron abort)', () => {
    const idx = SRC.indexOf('תשלום שוחרר (אישור אוטומטי)');
    const window = SRC.slice(Math.max(0, idx - 400), idx + 1300);
    expect(window).toMatch(/try\s*\{/);
    expect(window).toMatch(/catch\s*\(\s*notifErr:\s*any\s*\)/);
    expect(window).toMatch(/logger\.warn\(/);
  });

  it('review-request email to customer (sendServiceCompletedReview) is still wired', () => {
    // This PR expands provider channels — the customer's review email must NOT
    // regress. Same source-file guard shipped by the 2026-07-30 audit fix.
    expect(SRC).toMatch(/sendServiceCompletedReview/);
  });
});
