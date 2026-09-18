/**
 * /groomers/book showed hardcoded prices (₪120 / ₪180 / ₪220 …) that belong to
 * no groomer, then POSTed serviceType 'bath_blow' (not in the server enum) with
 * no providerId — createBookingRequestSchema rejected every submit with a 400.
 * Six places linked to it. Booking grooming starts by choosing a groomer; their
 * page routes into the server-quoted flow (/booking/new/grooming/:providerId).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('the dead-end booking page is gone', () => {
  it('the page file no longer exists', () => {
    expect(existsSync(join(ROOT, 'client/src/pages/GroomersBook.tsx'))).toBe(false);
  });

  it('/groomers/book redirects to the list of groomers', () => {
    const app = read('client/src/App.tsx');
    expect(app).toContain('<Route path="/groomers/book">{() => <Redirect to="/groomers/explore" />}</Route>');
    expect(app).not.toContain('GroomersBook');
    expect(app).toMatch(/<Route path="\/groomers\/explore">/);
  });

  it('no screen or menu still sends customers to /groomers/book', () => {
    for (const f of [
      'client/src/pages/Groomers.tsx',
      'client/src/pages/GroomersCustomerDashboard.tsx',
      'client/src/pages/groomers/Overview.tsx',
      'client/src/lib/navigationStructure.ts',
    ]) {
      expect(read(f), f).not.toContain('/groomers/book');
    }
  });

  it('the working flow still needs a chosen groomer', () => {
    expect(read('client/src/pages/groomers/GroomerDetail.tsx'))
      .toContain('navigate(`/booking/new/grooming/${groomer.userId}');
  });
});
