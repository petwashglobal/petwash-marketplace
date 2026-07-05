/**
 * Maintenance page + MAINTENANCE_MODE toggle — pins.
 *
 * CEO-approved bilingual downtime page (2026-07-05). Built from his mockup's
 * structure with three mandatory corrections that must not regress:
 *   - NO phone number (the mockup's +972 54-983-3355 was unverified/invented)
 *   - hand-written Hebrew (mockup image had AI typos)
 *   - a real static HTML page served by the CDN (works when the backend is dead)
 * Plus the operator kill-switch that stops customer money ops server-side.
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

describe('maintenance.html — content + safety', () => {
  it('is bilingual: English + native Hebrew headlines', () => {
    // "temporarily" / "זמנית" are wrapped in a gold <span> — match around it
    expect(PAGE).toMatch(/We're\s*<span[^>]*>temporarily<\/span>\s*unavailable/);
    expect(PAGE).toMatch(/אנחנו\s*<span[^>]*>זמנית<\/span>\s*לא זמינים/);
  });

  it('uses the luxury GOLD PetWash icons, not generic emoji', () => {
    expect(PAGE).toMatch(/\/assets\/icons\/petwash\/gold\/nature\/nature_water_drop\.png/);
    expect(PAGE).toMatch(/\/assets\/icons\/petwash\/gold\/trust\/trust_pet_safe\.png/);
    // brand is WHITE background — no tinted/gray fills, no green
    expect(PAGE).toMatch(/background:#ffffff;\s*\/\* PURE WHITE/);
    expect(PAGE).not.toMatch(/#eaf3ee|green/i);
  });

  it('carries NO phone number (the mockup +972 number was invented)', () => {
    // no +972 / 05x-xxx-xxxx style sequences anywhere
    expect(PAGE).not.toMatch(/\+972/);
    expect(PAGE).not.toMatch(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/);
  });

  it('gives the real support email + site, and only those contacts', () => {
    expect(PAGE).toMatch(/support@petwash\.co\.il/);
    expect(PAGE).toMatch(/PetWash\.co\.il/i);
  });

  it('keeps numbers/emails/URLs LTR inside RTL via an isolate class', () => {
    expect(PAGE).toMatch(/\.ltr\{[^}]*unicode-bidi:\s*isolate/);
    expect(PAGE).toMatch(/dir="rtl"/);
  });

  it('is self-contained: no external script/style/font hosts (works offline of the backend)', () => {
    // only same-origin /brand assets, mailto:, and petwash.co.il links allowed
    const externalSrc = PAGE.match(/(src|href)=["']https?:\/\/(?!petwash\.co\.il)[^"']+/gi) || [];
    expect(externalSrc).toEqual([]);
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
