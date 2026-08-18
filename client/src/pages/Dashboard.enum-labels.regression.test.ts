import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'Dashboard.tsx'), 'utf8');

// Regression pin for audit findings #10 + #11 (2026-08-18): the upcoming
// bookings row on the customer dashboard rendered raw enum keys for
// booking.platform ("walk_my_pet", "sitter_suite") and booking.status
// ("in_progress", "pending_provider") directly into visible UI, shipping
// programmer-jargon to end users.

describe('Dashboard.tsx booking enum labels (agent findings #10 + #11)', () => {
  it('platformLabel and bookingStatusLabel helpers exist and are bilingual', () => {
    expect(SRC).toMatch(/function platformLabel\(platform: string, he: boolean\)/);
    expect(SRC).toMatch(/function bookingStatusLabel\(status: string, he: boolean\)/);
    expect(SRC).toMatch(/walk_my_pet:\s*\['Walk My Pet',\s*'הליכת חיה'\]/);
    expect(SRC).toMatch(/in_progress:\s*\['In progress',\s*'בתהליך'\]/);
  });

  it('upcoming-bookings row passes booking.platform through platformLabel', () => {
    expect(SRC).toMatch(/platformLabel\(booking\.platform, he\)/);
  });

  it('upcoming-bookings row passes booking.status through bookingStatusLabel', () => {
    expect(SRC).toMatch(/bookingStatusLabel\(booking\.status, he\)/);
  });

  it('does not reintroduce the raw {booking.platform} or {booking.status} leaks', () => {
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/>\{booking\.platform\}</);
    expect(stripped).not.toMatch(/<span className="capitalize">\{booking\.status\}<\/span>/);
  });
});
