/**
 * Maintenance page + MAINTENANCE_MODE toggle — pins.
 *
 * This page is a faithful HTML replica of the CEO's own green-marble mockup
 * (Pet Wash Ltd, gold paw crest, 7 service tiles with line icons, green
 * shields, green "check again" button, support phone, green footer). Build the
 * CEO's design exactly — the only hard requirements pinned here are the
 * structural/safety ones, not a re-styling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const PAGE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'public', 'maintenance.html'),
  'utf8',
);
const INDEX = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.ts'),
  'utf8',
);

describe('maintenance.html — content + structure', () => {
  it('is bilingual: English + native Hebrew headlines', () => {
    expect(PAGE).toMatch(/We're temporarily unavailable/);
    expect(PAGE).toMatch(/אנו זמנית לא זמינים/);
  });

  it('carries the CEO brand: Pet Wash Ltd + PetWash.co.il + support email', () => {
    expect(PAGE).toMatch(/Pet Wash Ltd/);
    expect(PAGE).toMatch(/PetWash\.co\.il/i);
    expect(PAGE).toMatch(/support@petwash\.co\.il/i);
  });

  it('keeps the support phone the CEO put on the page (LTR-isolated)', () => {
    expect(PAGE).toMatch(/\+972 54-983-3355/);
    expect(PAGE).toMatch(/\.ltr\{[^}]*unicode-bidi:\s*isolate/);
    expect(PAGE).toMatch(/dir="rtl"/);
  });

  it('lists the seven affected services incl. Provider payout', () => {
    for (const s of ['Website access', 'Payment processing', 'Wallet / eGift', 'QR code activation', 'K9000 wash', 'Booking checkout', 'Provider payout']) {
      expect(PAGE).toContain(s);
    }
  });

  it('is self-contained: no external script/style/font hosts (works when the backend is dead)', () => {
    const external = PAGE.match(/(src|href)=["']https?:\/\/(?!petwash\.co\.il)[^"']+/gi) || [];
    expect(external).toEqual([]);
  });

  it('auto-retries via the lightweight health endpoint only', () => {
    expect(PAGE).toMatch(/fetch\(['"]\/api\/health['"]/);
  });
});

describe('MAINTENANCE_MODE middleware — server kill switch', () => {
  it('is gated on MAINTENANCE_MODE === "true" (default OFF)', () => {
    expect(INDEX).toMatch(/process\.env\.MAINTENANCE_MODE !== 'true'\) return next\(\)/);
  });
  it('lets health probes and cron/backups through while down', () => {
    expect(INDEX).toMatch(/startsWith\('\/api\/health'\)[\s\S]*startsWith\('\/api\/cron\/'\)/);
  });
  it('returns 503 + Retry-After for customer API requests', () => {
    expect(INDEX).toMatch(/res\.status\(503\)/);
    expect(INDEX).toMatch(/Retry-After/);
  });
});
