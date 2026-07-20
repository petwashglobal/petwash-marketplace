/**
 * DOT QR payload — the string the black Nayax reader scans at the bay.
 *
 * A scan is processed by the terminal exactly like a card tap, so the payload
 * must BE the prepaid-card presentation string:
 *
 *     NYXPP;<CardUniqueIdentifier>
 *
 * Why this is pinned so tightly: a malformed code fails SILENTLY. The reader
 * simply doesn't respond — no error at the machine, nothing in Nayax Core,
 * nothing in our logs. A customer stands at the bay with a free wash on their
 * phone and it just does nothing. That is close to undiagnosable in the field,
 * so every rule is enforced at generation time instead of trusted.
 *
 * The single most common way to get this wrong is encoding a URL: most QR
 * generators default to making a link. The DOT would read the link text and find
 * no card.
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  buildDotQrPayload,
  isValidDotQrPayload,
  generateDotQrDataUrl,
  generateDotQrPngBuffer,
  DOT_QR_PREFIX,
  DotQrError,
} from '../services/DotQrService';

/** Mirrors LynxCardService.newCardUid so we test the shape actually minted. */
function newCardUid(userId: string): string {
  const rand = randomBytes(8).toString('hex');
  const safeUserPart = userId.replace(/[^A-Za-z0-9]/g, '').slice(-8) || 'ANON';
  return `PWWASH-${safeUserPart}-${Date.now().toString(36)}-${rand}`.toUpperCase();
}

describe('DOT QR — exact wire format', () => {
  it('builds NYXPP;<uid> with no spaces anywhere', () => {
    expect(buildDotQrPayload('PWKS-GIFT-2026-000001')).toBe('NYXPP;PWKS-GIFT-2026-000001');
  });

  it('uses exactly one semicolon and the NYXPP prefix', () => {
    const p = buildDotQrPayload('PWKS-GIFT-2026-000002');
    expect(p.split(';')).toHaveLength(2);
    expect(p.startsWith(`${DOT_QR_PREFIX};`)).toBe(true);
    expect(p).not.toMatch(/\s/);
  });

  it('never emits a URL — the classic silent-failure mistake', () => {
    expect(() => buildDotQrPayload('https://petwash.co.il/v/ABC123')).toThrow(DotQrError);
    expect(() => buildDotQrPayload('www.petwash.co.il')).toThrow(DotQrError);
  });
});

describe('DOT QR — rejects anything the reader would silently refuse', () => {
  it('rejects whitespace', () => {
    expect(() => buildDotQrPayload('PWKS GIFT 001')).toThrow(DotQrError);
    expect(() => buildDotQrPayload(' PWKS-GIFT-001')).toThrow(DotQrError);
    expect(() => buildDotQrPayload('PWKS-GIFT-001 ')).toThrow(DotQrError);
  });

  it('rejects an embedded separator', () => {
    expect(() => buildDotQrPayload('PWKS;GIFT')).toThrow(DotQrError);
  });

  it('rejects quotes and free text', () => {
    expect(() => buildDotQrPayload('"PWKS-GIFT-001"')).toThrow(DotQrError);
    expect(() => buildDotQrPayload('Free wash for Kenzo!')).toThrow(DotQrError);
  });

  it('rejects empty input', () => {
    expect(() => buildDotQrPayload('')).toThrow(DotQrError);
    expect(() => buildDotQrPayload(undefined as any)).toThrow(DotQrError);
  });
});

describe('DOT QR — validator agrees with the builder', () => {
  it('accepts what we build', () => {
    expect(isValidDotQrPayload(buildDotQrPayload('PWKS-GIFT-2026-000003'))).toBe(true);
  });

  it('rejects payloads that would not scan', () => {
    expect(isValidDotQrPayload('https://petwash.co.il/PWKS-001')).toBe(false);
    expect(isValidDotQrPayload('NYXPP;')).toBe(false);
    expect(isValidDotQrPayload('NYXPP PWKS-001')).toBe(false);   // space, not semicolon
    expect(isValidDotQrPayload('WRONG;PWKS-001')).toBe(false);   // wrong prefix
    expect(isValidDotQrPayload('PWKS-001')).toBe(false);         // no prefix
  });
});

describe('DOT QR — every real minted card UID is scannable', () => {
  it('handles normal and hostile user ids without throwing', () => {
    // A '.' or '_' in a user id used to leak into the UID and would have made the
    // payload invalid — failing the mint. The generator now sanitises it.
    for (const uid of ['k2Jd8fLpQr3sTuVwXyZa1bCdEfGh', 'user.name.42', 'user_9a8b', '!!!', '', 'a b c']) {
      const cardUid = newCardUid(uid);
      expect(() => buildDotQrPayload(cardUid)).not.toThrow();
      expect(isValidDotQrPayload(buildDotQrPayload(cardUid))).toBe(true);
    }
  });
});

describe('DOT QR — renders a real image', () => {
  it('produces a PNG data URL', async () => {
    const url = await generateDotQrDataUrl('PWKS-GIFT-2026-000004');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(500);
  });

  it('produces a PNG buffer with the PNG magic header', async () => {
    const buf = await generateDotQrPngBuffer('PWKS-GIFT-2026-000005');
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // \x89PNG
  });

  it('refuses to render an invalid payload rather than print a dead code', async () => {
    await expect(generateDotQrDataUrl('https://petwash.co.il/x')).rejects.toThrow(DotQrError);
  });
});
