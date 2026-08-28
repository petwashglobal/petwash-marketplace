/**
 * CEO §6 + §12 (2026-08-28) — walker Today card renders the KYA safety
 * snapshot with the NEUTRAL "not shared" phrasing when consent is
 * withheld.
 *
 * Chain of custody (all landed on this branch):
 *   BookingFlow.tsx sends client snapshot →
 *   walk-my-pet.ts calls buildServerSafetySnapshot with authoritative
 *     medicalShareConsent →
 *   legacyBookingBridge writes safety into booking_requests.pet_details →
 *   /walker/requests + /walker/active re-project against CURRENT
 *     consent via projectStoredSafetyForProvider →
 *   petSafety lands on the walker card →
 *   THIS COMPONENT renders it.
 *
 * CEO §6 explicitly bans the "medical data withheld — ask owner"
 * phrasing that undermines the owner's explicit choice. The neutral
 * "Medical details were not shared for this booking" replaces it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'walk-my-pet', 'WalkerDashboard.tsx'),
  'utf8',
);

describe('WalkerDashboard renders KYA safety snapshot (CEO §6/§12)', () => {
  it('declares petSafety on the WalkBooking interface, including the medicalConsented flag', () => {
    // Field names must match the wire shape from
    // buildServerSafetySnapshot + projectStoredSafetyForProvider.
    expect(SRC).toMatch(/petSafety\?:\s*\{/);
    for (const key of [
      'aggressionWarning', 'escapeRisk', 'behaviourNotes',
      'feedingInstructions', 'handlingInstructions', 'sensitiveSkin',
      'medicalConsented', 'allergies', 'medicationNotes', 'vetName', 'vetPhone',
    ]) {
      expect(SRC).toMatch(new RegExp(`${key}\\??:`));
    }
  });

  it('renders the KYA safety block with a testid anchor', () => {
    // E2E tests + the scanner CTA guard can then pin this element.
    expect(SRC).toMatch(/data-testid=\{`kya-safety-\$\{booking\.bookingId\}`\}/);
  });

  it('medical block is gated on medicalConsented === true — never on `medicalConsented !== false` (which would leak on undefined)', () => {
    // A defensive `!== false` check would still show medical when the
    // server didn't return the flag at all. Explicit === true is
    // the fail-closed pattern.
    expect(SRC).toMatch(/booking\.petSafety\.medicalConsented === true \?/);
  });

  it('the withheld branch uses the CEO §6 NEUTRAL phrasing — no "ask owner" language', () => {
    // The exact HE + EN phrasing CEO §6 approved.
    expect(SRC).toContain('פרטים רפואיים לא שותפו להזמנה הזו');
    expect(SRC).toContain('Medical details were not shared for this booking');
    // And explicitly ban the earlier draft phrasing from user-visible
    // JSX text. Comments explaining the rule are allowed (they anchor
    // the discipline for future authors), but the "ask owner" string
    // must not appear in JSX text nodes. Approximate by requiring
    // every occurrence to sit on a comment line.
    const askOwner = SRC.split('\n').map((l, i) => ({ l, i }))
      .filter(x => x.l.includes('ask owner'))
      .map(x => x.l.trim());
    for (const line of askOwner) {
      expect(line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')).toBe(true);
    }
  });

  it('the safety block only mounts when at least one field is present', () => {
    // A card for a booking with an entirely-empty safety snapshot must
    // NOT render an empty amber banner. Anchor to the ternary gate.
    expect(SRC).toMatch(/booking\.petSafety && \(booking\.petSafety\.aggressionWarning\s*\|\|/);
  });

  it('escape risk gets its own high-visibility red row (physical-harm signal)', () => {
    // Behaviour notes are text; escape risk is a hard "leash-holder must
    // know" red-flag. Render style must reflect that (text-red-700).
    expect(SRC).toMatch(/escapeRisk && \(\s*\n\s*<div className="text-red-700 font-semibold">/);
  });
});
