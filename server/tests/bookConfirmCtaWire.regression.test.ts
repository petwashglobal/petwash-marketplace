/**
 * BOOK_CONFIRM CTA wire — regression pin (post-release 2026-09-04).
 *
 * Every booking-flow "confirm" submit button on Pet-Parent-side
 * wizards MUST carry the semantic `data-action-id="BOOK_CONFIRM"`
 * and fire `emitCtaEvent('BOOK_CONFIRM', { domain: <JourneyDomain> })`
 * BEFORE it hands off to the network call. This is the CEO Lane D
 * ruling — CTA identity survives i18n label swaps, CSS refactors,
 * and copy tweaks that a `data-testid` alone cannot pin.
 *
 * The wire has THREE required properties:
 *
 *   1. The file imports `emitCtaEvent` from `@/lib/ctaActions`.
 *   2. The confirm button carries `data-action-id="BOOK_CONFIRM"`.
 *   3. The click handler calls `emitCtaEvent('BOOK_CONFIRM', ...)`
 *      with the correct domain tag.
 *
 * Failing this pin means one of:
 *   • A refactor dropped the observability wire.
 *   • Someone renamed the CTA id (silent analytics gap).
 *   • Someone wired the wrong domain (mis-attributed conversion).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

interface Wire {
  label: string;
  file: string;
  domain: 'sitter_book' | 'walk_book' | 'marketplace_book';
}

const WIRES: readonly Wire[] = [
  {
    label: 'sitter booking · confirm',
    file: 'client/src/pages/sitter-suite/BookingFlow.tsx',
    domain: 'sitter_book',
  },
  {
    label: 'walk booking · confirm',
    file: 'client/src/pages/walk-my-pet/BookingFlow.tsx',
    domain: 'walk_book',
  },
  {
    label: 'marketplace booking · confirm',
    file: 'client/src/pages/MarketplaceBookingFlow.tsx',
    domain: 'marketplace_book',
  },
];

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('BOOK_CONFIRM CTA wire · regression', () => {
  for (const wire of WIRES) {
    describe(wire.label, () => {
      const src = read(wire.file);

      it('imports emitCtaEvent from @/lib/ctaActions', () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bemitCtaEvent\b[^}]*\}\s*from\s*["']@\/lib\/ctaActions["']/,
        );
      });

      it('confirm button carries data-action-id="BOOK_CONFIRM"', () => {
        expect(src).toMatch(/data-action-id\s*=\s*["']BOOK_CONFIRM["']/);
      });

      it(`emits BOOK_CONFIRM with domain: ${wire.domain}`, () => {
        const rx = new RegExp(
          `emitCtaEvent\\(\\s*['"]BOOK_CONFIRM['"]\\s*,\\s*\\{[^}]*domain\\s*:\\s*['"]${wire.domain}['"]`,
        );
        expect(src).toMatch(rx);
      });

      it('emits BEFORE any real network / navigation call — a thrown sink never blocks the submit', () => {
        // The wire we require is:
        //   onClick={() => { emitCtaEvent('BOOK_CONFIRM', ...); handleXxx(); }}
        // The registry's emitCtaEvent is try/catch-fire-and-forget,
        // so an error inside the sink never surfaces. The pin below
        // guards the source pattern that puts the emit call as the
        // FIRST statement of the arrow before handleConfirmBooking /
        // handleSubmitBooking. A later refactor that flips the order
        // ("handle...(); emitCtaEvent(...)") makes analytics miss any
        // click that also throws inside the handler — the whole
        // reason the emit runs first.
        const rx = new RegExp(
          `onClick=\\{\\(\\)\\s*=>\\s*\\{\\s*emitCtaEvent\\(\\s*['"]BOOK_CONFIRM['"]\\s*,\\s*\\{[^}]*domain\\s*:\\s*['"]${wire.domain}['"][^}]*\\}\\)\\s*;\\s*handle`,
        );
        expect(src).toMatch(rx);
      });
    });
  }

  it('covers every Pet-Parent booking domain — no silent gap on a new wizard', () => {
    const wiredDomains = new Set(WIRES.map((w) => w.domain));
    // Any Pet-Parent booking JourneyDomain that ends `_book` MUST
    // have a wire. If a new domain like `academy_book` gets added,
    // this pin flags it until the wire lands.
    const enumSrc = read('server/services/journeyCheckpoints.ts');
    const bookDomains = Array.from(enumSrc.matchAll(/['"](\w+_book)['"]/g)).map(
      (m) => m[1],
    );
    const uniqueBookDomains = new Set(bookDomains);
    for (const d of uniqueBookDomains) {
      expect(wiredDomains, `no BOOK_CONFIRM wire for domain ${d}`).toContain(d);
    }
  });
});
