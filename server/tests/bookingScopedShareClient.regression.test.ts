/**
 * CEO §5 (2026-08-28) — client wire for booking-scoped medical share.
 *
 * Server accepts the flag and consentScope resolves it against the
 * canonical pet record (see server/lib/petPrivacy.ts +
 * consentScopePriority.regression.test.ts). This test pins the CLIENT
 * half: both booking flows render an explicit opt-in checkbox and
 * pass the flag on the request payload so it can be honoured.
 *
 * NEUTRAL phrasing per CEO §6/§25 — no "recommended" / "you should
 * share" pressure. HE + EN parity. Default OFF.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WALK   = fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'walk-my-pet',   'BookingFlow.tsx'), 'utf8');
const SITTER = fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'sitter-suite', 'BookingFlow.tsx'), 'utf8');

describe('booking-scoped medical share — client wire (CEO §5)', () => {
  for (const [name, src, suffix] of [
    ['walk-my-pet',   WALK,   'walker'],
    ['sitter-suite',  SITTER, 'sitter'],
  ] as const) {
    describe(`${name}/BookingFlow.tsx`, () => {
      it('declares a bookingScopedShare state hook defaulted to false (never inherits from previous booking)', () => {
        expect(src).toMatch(/const \[bookingScopedShare, setBookingScopedShare\] = useState\(false\)/);
      });

      it('passes bookingScopedShare on the outgoing payload so the server can honour it', () => {
        expect(src).toMatch(/bookingScopedShare,/);
      });

      it(`renders the checkbox with a stable testid section-booking-scoped-share-${suffix}`, () => {
        expect(src).toContain(`data-testid="section-booking-scoped-share-${suffix}"`);
        expect(src).toContain(`data-testid="checkbox-booking-scoped-share-${suffix}"`);
      });

      it('uses CEO §6/§25 neutral phrasing — no "recommended" / "you should share" pressure', () => {
        // HE + EN parity present.
        expect(src).toMatch(/שיתוף פרטים רפואיים ל(טיול|שהות) הזה?/);
        expect(src).toMatch(/Share medical details for this (walk|stay) only/);
        // Never uses pressure phrasing.
        expect(src).not.toContain('recommended');
        expect(src).not.toContain('you should share');
        expect(src).not.toContain('please share');
      });

      it('explicitly labels the scope as THIS booking (never global) so the owner understands the boundary', () => {
        expect(src).toMatch(/THIS booking only/);
        expect(src).toMatch(/only|בלבד/);
      });
    });
  }
});
