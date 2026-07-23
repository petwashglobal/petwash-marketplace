/**
 * "Little evils hiding in the codebase" — the 2026-07-24 four-hunter sweep.
 * Pins for every fixed evil: dead client→server endpoints, shadowed routes,
 * zombie timers/polls. Each pin asserts the CLIENT calls a path the SERVER
 * actually serves (or that ordering/cleanup is correct).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const app = R('client/src/App.tsx');

describe('dead endpoints repointed to real rails', () => {
  it('Vouchers page uses /api/v2/vouchers (the -2025 namespace never existed)', () => {
    const v = R('client/src/pages/Vouchers.tsx');
    expect(v).not.toMatch(/(queryKey|apiRequest|invalidateQueries)[^\n]*vouchers-2025/);
    expect(v).toContain("'/api/v2/vouchers/my'");
    expect(v).toContain('/api/v2/vouchers/redeem/web');
    expect(R('server/routes/unified-vouchers.ts')).toMatch(/router\.get\("\/my"/);
  });

  it('reviews display + submit hit real routes', () => {
    expect(R('client/src/components/ReviewDisplay.tsx')).toContain('`/api/reviews/${contractorId}`');
    expect(R('client/src/services/marketplace.ts')).toContain("'/api/reviews/submit'");
    expect(R('server/routes/reviews.ts')).toMatch(/router\.post\('\/submit'/);
  });

  it('provider stats use the live trust-score rail', () => {
    expect(R('client/src/pages/ProviderDetail.tsx')).toContain('/api/reviews/trust-score/');
  });

  it('payment success verifies via /api/payment-status', () => {
    expect(R('client/src/pages/PaymentSuccess.tsx')).toContain('/api/payment-status?ref=');
    expect(R('client/src/pages/PaymentSuccess.tsx')).not.toMatch(/getApiUrl\(`\/api\/payment-success/);
  });

  it('walk tracking, k9000 doc view, google reviews, synthetic, octopus prefixes', () => {
    expect(R('client/src/pages/walks/TrackWalk.tsx')).toContain('/api/walk-session/${walkId}/active');
    expect(R('client/src/pages/K9000Documents.tsx')).toContain('/download');
    expect(R('client/src/components/GoogleReviewsWidget.tsx')).toContain('`/api/google/places/${placeId}`');
    expect(R('client/src/pages/OpsDashboard.tsx')).toContain('/api/synthetic/synthetic/auth-check');
    for (const f of ['AdminCompensation', 'AdminBayMap', 'AdminCommandLog']) {
      expect(R(`client/src/pages/${f}.tsx`)).not.toContain('/api/octopus/v1/');
    }
  });
});

describe('shadow routes killed', () => {
  it('/groomers/hub and /marketplace/review before their parametric traps; one /admin/hr', () => {
    expect(app.indexOf('path="/groomers/hub"')).toBeLessThan(app.indexOf('path="/groomers/:id"'));
    expect(app.indexOf('path="/marketplace/review/:bookingId"')).toBeLessThan(app.indexOf('path="/marketplace/:platform/:id"'));
    expect(app.match(/path="\/admin\/hr"/g)?.length).toBe(1);
    expect(app).toMatch(/path="\/admin\/hr-erp"/);
  });
});

describe('zombies leashed', () => {
  it('tracker navigation is event-driven; lazyLoader observer stoppable; walk poll gated; chat timer cleaned', () => {
    const t = R('client/src/lib/interactionTracker.ts');
    expect(t).toContain("window.addEventListener('popstate'");
    expect(t).not.toMatch(/setInterval\(\(\) => \{\n\s+if \(window\.location\.pathname/);
    expect(R('client/src/lib/lazyLoader.ts')).toContain('this.mutationObserver = new MutationObserver');
    expect(R('client/src/components/TrackMyPet.tsx')).toMatch(/visibilityState === 'hidden'/);
    expect(R('client/src/pages/BookingChat.tsx')).toMatch(/useEffect\(\(\) => \(\) => \{\n\s+if \(recordingTimerRef\.current\) clearInterval/);
  });
});
