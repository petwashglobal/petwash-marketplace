/**
 * Booking-system breaks, batch 1 (CEO 2026-07-24 "booking not wired best...
 * old hidden evil"). A 4-world audit found several; these two are the
 * customer-blocking ones with contained fixes.
 *
 * 1) Pet Wash Academy could not take ANY booking: the create route parsed the
 *    full ROW schema (insertTrainerBookingSchema), which requires sessionDate,
 *    petName and the money fields the server computes AFTER the parse — so
 *    every request 400'd. Now a REQUEST schema (client-supplied fields only);
 *    the server still owns every price field.
 * 2) Sitter browse → detail used providers.id against a route resolving
 *    sitter_profiles.id — different tables → wrong sitter or 404.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const academy = R('server/routes/academy.ts');
const browse = R('client/src/pages/sitter-suite/BrowseSitters.tsx');

describe('academy booking accepts a real request', () => {
  it('parses a REQUEST schema, not the full row schema', () => {
    expect(academy).toContain('const bookingRequestSchema = z.object({');
    expect(academy).not.toMatch(/insertTrainerBookingSchema\.parse\(\{\s*\.\.\.req\.body/);
  });

  it('accepts either sessionDate or the legacy serviceDate the client sends', () => {
    expect(academy).toMatch(/sessionDate: z\.coerce\.date\(\)\.optional\(\)/);
    expect(academy).toMatch(/serviceDate: z\.coerce\.date\(\)\.optional\(\)/);
    expect(academy).toMatch(/parsedReq\.sessionDate \?\? parsedReq\.serviceDate/);
  });

  it('the server still owns every money field (client cannot inject a price)', () => {
    // money values come from the trainer row + commission constant, after parse
    expect(academy).toMatch(/hourlyRate: trainer\.hourlyRate/);
    expect(academy).toMatch(/totalAmount: totalAmount\.toFixed\(2\)/);
    expect(academy).toMatch(/PETWASH_COMMISSION_RATE/);
  });
});

describe('sitter browse opens the right sitter', () => {
  it('routes by provider userId through the healthy marketplace detail path', () => {
    expect(browse).toContain('/marketplace/sitter_suite/${provider.userId || provider.id}');
    expect(browse).not.toContain('/sitter-suite/sitters/${provider.id}');
  });
});
