/**
 * A member card must not draw its own QR out of the number printed on it.
 * Regression pin — 2026-09-19.
 *
 * WHAT WAS WRONG
 * PremiumMemberCard rendered `<QRCodeSVG value={cardId} />`. `cardId` is the
 * member number — "PW-2026-261554" — which is printed in readable text a few
 * pixels below that QR and appears in every screenshot anyone takes of the
 * card. Anyone who could see the number could regenerate the code, so it
 * identified nobody. It was also a THIRD QR competing with the two real ones on
 * the same screen:
 *
 *   1. the signed one-time redemption token (45s TTL, refreshes)   — real
 *   2. the server-minted identity QR, walletData.memberCard.qrUrl  — real
 *   3. this one, minted in the browser from a public string        — removed
 *
 * Three QR codes that look identical to someone holding a phone, meaning three
 * different things, is how "I'm not sure the QR works" happens.
 *
 * THE RULE
 * The card shows the SERVER-MINTED value or no QR at all. A missing QR is an
 * obvious, honest failure that a person reports; a forgeable one looks exactly
 * like a working credential and is never reported.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CARD = readFileSync(path.join(ROOT, 'client/src/components/PremiumMemberCard.tsx'), 'utf8');
const PAGE = readFileSync(path.join(ROOT, 'client/src/pages/PrestigePassWallet.tsx'), 'utf8');

describe('the premium card QR is server-minted or absent', () => {
  it('never encodes cardId — the number printed on the card itself', () => {
    expect(CARD).not.toMatch(/<QRCodeSVG[^>]*value=\{cardId\}/);
  });

  it('never encodes any other locally-available identity field', () => {
    for (const field of ['ownerName', 'cardDisplay', 'petName']) {
      expect(
        CARD,
        `QR encoding ${field} would be forgeable from what is printed on the card`,
      ).not.toMatch(new RegExp(`<QRCodeSVG[^>]*value=\\{${field}\\}`));
    }
  });

  it('draws the QR only from the server-minted qrValue prop', () => {
    expect(CARD).toMatch(/<QRCodeSVG[^>]*value=\{qrValue\}/);
  });

  it('renders NO QR when the server did not supply one', () => {
    // The guard must be on the QR itself — an unguarded QRCodeSVG would render
    // an empty/garbage code rather than nothing.
    expect(CARD).toMatch(/\{qrValue \? \(/);
    expect(CARD).toMatch(/\) : null\}/);
  });

  it('the page feeds it the same identity QR the identity block uses', () => {
    expect(PAGE).toMatch(/qrValue=\{walletData\?\.memberCard\?\.qrUrl\}/);
    // …which is exactly the source the dedicated "scan to identify" block reads.
    expect(PAGE).toMatch(/qrUrl=\{walletData\.memberCard\.qrUrl\}/);
  });

  it('leaves the two real QR sources on the page untouched', () => {
    // the signed one-time redemption token
    expect(PAGE).toMatch(/<QRCodeSVG value=\{qrToken\.token\}/);
    // and the identity block still gated on the server having minted one
    expect(PAGE).toMatch(/walletData\?\.memberCard\?\.qrUrl &&/);
  });
});
