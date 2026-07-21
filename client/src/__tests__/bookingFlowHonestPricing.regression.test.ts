/**
 * Marketplace booking flow — price display must never be fabricated.
 *
 * Board item "MarketplaceBookingFlow missing driver/groomer pricing display".
 * What the code actually did was worse than "missing": drivers were hardcoded at
 * ₪150 and groomers at ₪200 ("placeholder until backend supports it") — but the
 * backend DOES price them, from provider_rate_cards, and checkout charges only
 * the server's persisted quote. The fabricated figures rendered while the quote
 * loaded and, worse, whenever the quote FAILED (the `|| local` fallback), so a
 * customer could be shown an invented base price, fee, VAT and total with no
 * relation to the provider's real rate. §17a all-in-price + the truth rule:
 * show a real number or no number.
 *
 * Pins:
 *  1. No hardcoded driver/groomer prices anywhere in the flow.
 *  2. The client preview returns null (not a number) for server-priced kinds.
 *  3. A dedicated honest branch renders when there is no quote AND no client
 *     estimate — instead of fabricated totals.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const src = readFileSync(resolve(ROOT, 'client/src/pages/MarketplaceBookingFlow.tsx'), 'utf8');

describe('booking flow — no fabricated prices', () => {
  it('has no hardcoded driver/groomer placeholder amounts', () => {
    expect(src).not.toMatch(/15000.*[Pp]laceholder|[Pp]laceholder.*15000/);
    expect(src).not.toMatch(/20000.*[Pp]laceholder|[Pp]laceholder.*20000/);
    // The literal placeholders themselves must be gone.
    expect(src).not.toMatch(/return 15000/);
    expect(src).not.toMatch(/return 20000/);
  });

  it('client preview is nullable — server-priced kinds return null, not a guess', () => {
    expect(src).toMatch(/basePriceCents: number \| null/);
    expect(src).toMatch(/hasClientEstimate/);
  });

  it('renders an honest pending message instead of invented totals', () => {
    expect(src).toMatch(/price-pending/);
    expect(src).toMatch(/rate card and will be shown before payment|תעריף הספק/);
  });

  it('checkout still requires the server quote (the only charged number)', () => {
    expect(src).toMatch(/if \(!quoteId\) throw new Error\('No quote available'\)/);
  });
});
