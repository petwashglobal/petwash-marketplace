/**
 * CEO §73 #16 (2026-08-28) — the admin review surface must not hide fields
 * the wizard already writes.
 *
 * Three families of "admin-blind" fields survived the Lane A audit and
 * shipped to production without a card on ProviderKycReview.tsx:
 *
 *   • ageConfirmed18Plus — separate from DOB, an explicit 18+ tick;
 *   • kycDocumentExpiry — a real column, distinct from OCR-detected;
 *   • drivingRecordNotes + drivingRecordUrl — walker + driver approval
 *     blocker if the licence lapses or is missing.
 *
 * Pin: the admin surface reads each field off the shape it comes down
 * as (raw field or JSON blob) and renders it. A rename or drop trips CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'admin', 'ProviderKycReview.tsx'),
  'utf8',
);

describe('admin ProviderKycReview surfaces the previously blind fields (CEO §73 #16)', () => {
  it('declares the three new fields on the KycApplication interface', () => {
    expect(SRC).toMatch(/ageConfirmed18Plus\?:\s*boolean\s*\|\s*null/);
    expect(SRC).toMatch(/kycDocumentExpiry\?:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/drivingRecordNotes\?:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/drivingRecordUrl\?:\s*string\s*\|\s*null/);
  });

  it('renders "18+ confirmed" with a real true/false/null tri-state', () => {
    expect(SRC).toMatch(/18\+ confirmed/);
    expect(SRC).toMatch(/app\.ageConfirmed18Plus === true/);
    expect(SRC).toMatch(/app\.ageConfirmed18Plus === false/);
  });

  it('renders the real Document expiry column alongside the OCR-detected boolean', () => {
    // Both must be visible: the real column tells the reviewer WHEN the
    // ID lapses, the OCR boolean tells them whether the OCR picked
    // anything up. Don't collapse them into one row.
    expect(SRC).toMatch(/label:\s*'Document expiry'/);
    expect(SRC).toMatch(/app\.kycDocumentExpiry \?/);
    expect(SRC).toMatch(/label:\s*'Expiry detected'/);
  });

  it('gates the Driving License card on data-present (walker/driver only)', () => {
    // Sitter/trainer applicants don't hand in a licence — the card
    // should be silent for them, not stub out with em-dashes.
    expect(SRC).toMatch(/\(app\.drivingRecordNotes \|\| app\.drivingRecordUrl\) && \(/);
    expect(SRC).toMatch(/uppercase tracking-wide">Driving License</);
  });

  it('parses drivingRecordNotes as JSON and reads licenseNumber / licenseClass / expiryDate', () => {
    expect(SRC).toMatch(/JSON\.parse\(app\.drivingRecordNotes\)/);
    expect(SRC).toMatch(/parsed\.licenseNumber/);
    expect(SRC).toMatch(/parsed\.licenseClass/);
    expect(SRC).toMatch(/parsed\.expiryDate/);
  });

  it('shows a red/amber/green expiry countdown so an about-to-lapse licence is not silently approved', () => {
    // Mirrors the insurance-expiry pattern (line ~880). Approving a
    // walker whose licence expires next week is a payout-eligibility
    // landmine — the countdown makes it visible without the reviewer
    // computing days by hand.
    expect(SRC).toMatch(/expired \$\{Math\.abs\(days\)\}d ago/);
    expect(SRC).toMatch(/days <= 30/);
    // Colouring only when the field is present — no false red when
    // expiryDate is missing on a sitter row.
    expect(SRC).toMatch(/text-red-700/);
    expect(SRC).toMatch(/text-amber-700/);
  });
});
