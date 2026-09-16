/**
 * THE PROVIDER MUST BE ABLE TO RECORD THEIR OWN INVOICE (gross model, #2496).
 *
 * #2496 made the provider the legal seller: they invoice the customer for the
 * full price, Pet Wash documents only its fee, and a job with no provider
 * invoice on file is reported as PROVIDER_INVOICE_MISSING — which BLOCKS the
 * payout. The endpoints shipped; no screen did. Every completed job would have
 * sat blocked forever, and a walker could not even SEE a finished walk: the
 * walker dashboard queried `pending_provider` and nothing else.
 *
 * These pins are on the surfaces, not the rules — the rules are covered by
 * jobEvidence.behavior.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('marketplace jobs (booking_requests) — /provider-os/jobs', () => {
  const src = repo('client/src/pages/provider-os/POSJobs.tsx');

  it('a finished job shows the invoice box, not hidden behind "expand"', () => {
    const i = src.indexOf('<ProviderInvoiceBox booking={booking} />');
    expect(i).toBeGreaterThan(0);
    // The block sits ABOVE the `{expanded && (` detail panel, so it is visible
    // on the collapsed card.
    expect(i).toBeLessThan(src.indexOf('{/* Expanded detail */}'));
    expect(src).toMatch(/\['provider_marked_complete', 'completed', 'reviewed'\]\.includes\(booking\.status\)/);
  });

  it('posts to the real endpoint with the request id, and shows a recorded number instead', () => {
    expect(src).toContain('/api/booking-requests/${encodeURIComponent(jobRef)}/provider-invoice');
    expect(src).toMatch(/const jobRef: string = booking\.requestId \|\| booking\.bookingNumber \|\| booking\.id/);
    expect(src).toMatch(/data-testid=\{`provider-invoice-recorded-\$\{booking\.id\}`\}/);
    expect(src).toMatch(/data-testid=\{`provider-invoice-input-\$\{booking\.id\}`\}/);
  });

  it('the input is 16px so iOS Safari does not zoom the page on focus', () => {
    const i = src.indexOf('provider-invoice-input-');
    expect(src.slice(i, i + 400)).toMatch(/text-base/);
  });

  it('the server actually sends the recorded number back to the card', () => {
    const api = repo('server/routes/provider-dashboard-v2.ts');
    expect(api).toContain("to_jsonb(booking_requests)->>'provider_invoice_number'");
    expect(api).toMatch(/providerInvoiceNumber:\s+row\.provider_invoice_number/);
  });
});

describe('walks (walk_bookings) — the walker dashboard', () => {
  const src = repo('client/src/pages/walk-my-pet/WalkerDashboard.tsx');
  const api = repo('server/routes/walk-my-pet.ts');

  it('a walker can now SEE their finished walks (the dashboard only listed pending_provider)', () => {
    const i = api.indexOf("router.get('/bookings/provider-completed'");
    expect(i).toBeGreaterThan(0);
    const body = api.slice(i, i + 900);
    expect(body).toContain("eq(walkBookings.status, 'completed')");
    // Scoped to the caller's own walker profile — never a global list.
    expect(body).toContain('eq(walkBookings.walkerId, walker.walkerId)');
    expect(src).toContain("queryKey: ['/api/walk-my-pet/bookings/provider-completed']");
  });

  it('each finished walk offers the invoice field and posts it to the walk route', () => {
    expect(src).toContain('/api/walk-my-pet/walks/${encodeURIComponent(booking.bookingId)}/provider-invoice');
    expect(src).toMatch(/data-testid=\{`walk-invoice-input-\$\{booking\.bookingId\}`\}/);
    expect(src).toMatch(/data-testid=\{`walk-invoice-recorded-\$\{booking\.bookingId\}`\}/);
  });

  it('walks still needing an invoice are listed first', () => {
    expect(src).toContain('const awaitingInvoice = completedBookings.filter((b) => !b.providerInvoiceNumber)');
    expect(src).toMatch(/\[\.\.\.awaitingInvoice, \.\.\.completedBookings\.filter\(\(b\) => b\.providerInvoiceNumber\)\]/);
  });
});

describe('no surface promises money that has not moved', () => {
  it('the completed-job subline no longer says "released · arriving in 72h"', () => {
    const src = repo('client/src/pages/provider-os/POSJobs.tsx');
    expect(src).not.toMatch(/arriving in 72h/);
    expect(src).toContain('held for you · Pet Wash approves it after review');
  });
});
