/**
 * PR-CALL-PROVIDER-AFFORDANCE — regression pin for the "Call provider"
 * button on BookingConfirmation.tsx.
 *
 * Server had /api/booking-requests/:requestId/provider-contact live
 * (returns provider phone gated by ownership + contactable status)
 * but ZERO client callers. This PR wires it — customer taps Call,
 * client fetches, opens tel:.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BookingConfirmation.tsx'),
  'utf8',
);

describe('BookingConfirmation — Call provider affordance', () => {
  it('handleCallProvider fetches /provider-contact', () => {
    expect(SRC).toMatch(
      /apiRequest\(\s*['"]GET['"]\s*,\s*`\/api\/booking-requests\/\$\{booking\.requestId\}\/provider-contact`/,
    );
  });

  it('opens tel: with the resolved phone number', () => {
    expect(SRC).toMatch(/window\.open\(\s*`tel:\$\{raw\}`/);
  });

  it('falls back to clipboard copy when window.open is blocked', () => {
    expect(SRC).toMatch(/navigator\.clipboard\?\.writeText\(raw\)/);
  });

  it('shows a toast when the provider has no phone', () => {
    expect(SRC).toContain('Phone unavailable');
    expect(SRC).toContain('טלפון לא זמין');
  });

  it('surfaces the server error message on failure (409/403/404)', () => {
    expect(SRC).toMatch(/err\?\.body\?\.error/);
  });

  it('QuickAction row mounts the Call button with Phone icon', () => {
    expect(SRC).toMatch(/icon=\{<Phone\s+className=[^>]*\/>\}\s*label=\{t\.callProvider\}/);
  });

  it('button is disabled outside the contactable status set', () => {
    // Client mirrors server CONTACTABLE set from provider-contact handler
    expect(SRC).toMatch(/\['accepted',\s*'confirmed',\s*'in_progress',[\s\S]{0,120}'provider_marked_complete',[\s\S]{0,60}'completed'\]/);
  });

  it('bilingual label present (HE + EN)', () => {
    expect(SRC).toContain('callProvider:');
    expect(SRC).toMatch(/callProvider:\s*['"]שיחה['"]/);
    expect(SRC).toMatch(/callProvider:\s*['"]Call['"]/);
  });
});
