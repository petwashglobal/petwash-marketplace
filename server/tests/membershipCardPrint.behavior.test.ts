import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { code128Pattern, code128Symbols, code128Bars, luhnCheckDigit, luhnValid } from '../../shared/lib/code128';
import { buildMembershipCardPdf, printBatchCsvRow, tierPrintLabel, validThruLabel, PRINT_BATCH_CSV_HEADER, CR80_WIDTH_PT, CR80_HEIGHT_PT } from '../services/MembershipCardPrintService';

/**
 * Member-card system (CEO design 2026-09-12): a REAL Code-128, a Luhn-valid
 * card number, a CR-80 print file, a card back with QR + barcode, and a
 * member-side lost-card action. The old "barcode" (server/qrCode.ts) was
 * parity bars nobody could scan.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

/** Independent checksum per the spec: (104 + Σ value_i × i) mod 103. */
function refChecksum(text: string): number {
  let sum = 104;
  Array.from(text).forEach((ch, i) => { sum += (ch.charCodeAt(0) - 32) * (i + 1); });
  return sum % 103;
}

describe('Code 128B encoder', () => {
  it('symbols = START-B, values, checksum, STOP', () => {
    const s = code128Symbols('PW2026791520X9');
    expect(s[0]).toBe(104);
    expect(s[s.length - 1]).toBe(106);
    expect(s[s.length - 2]).toBe(refChecksum('PW2026791520X9'));
    expect(s.length).toBe('PW2026791520X9'.length + 3);
  });
  it('pattern is 11 modules per symbol + 13 for stop, starts with a bar, ends with the termination bar', () => {
    const text = 'PWPLT000128X9';
    const p = code128Pattern(text);
    expect(p.length).toBe(11 * (text.length + 2) + 13);
    expect(p[0]).toBe('1');
    expect(p.endsWith('11')).toBe(true);
    expect(/^[01]+$/.test(p)).toBe(true);
    // the classic START-B pattern 211214 → 11 0 1 0 1 0000
    expect(p.startsWith('11010010000')).toBe(true);
  });
  it('bars are contiguous runs of 1s', () => {
    const bars = code128Bars('AB');
    expect(bars.length).toBeGreaterThan(5);
    for (const b of bars) expect(b.width).toBeGreaterThanOrEqual(1);
  });
  it('rejects control characters and empty input', () => {
    expect(() => code128Pattern('')).toThrow();
    expect(() => code128Pattern('a\nb')).toThrow();
  });
});

describe('Luhn', () => {
  it('matches the textbook example and validates round-trip numbers', () => {
    expect(luhnCheckDigit('7992739871')).toBe('3');
    expect(luhnValid('79927398713')).toBe(true);
    expect(luhnValid('79927398710')).toBe(false);
    expect(luhnValid('2318 4721 8506 1193'.replace(/\s/g, '').slice(0, 15) + luhnCheckDigit('231847218506119'))).toBe(true);
  });
  it('the service issues 15 digits + a Luhn check digit', () => {
    const s = R('server/services/MembershipCardService.ts');
    expect(s).toContain('const payload = randomDigits(15);');
    expect(s).toContain('(payload + luhnCheckDigit(payload))');
  });
});

describe('print file', () => {
  it('builds a two-page CR-80 PDF with the member data', async () => {
    const pdf = await buildMembershipCardPdf({
      memberId: 'PW-2026-791520', cardNumberDisplay: '2318 4721 8506 1193', ownerName: 'Nir Hadad', tier: 'platinum',
      validUntil: new Date('2031-09-30T23:59:59Z'), qrUrl: 'https://petwash.co.il/m/abc', barcodeValue: 'PW2026791520X9',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdf.toString('latin1');
    expect((text.match(/\/Type \/Page\b/g) || []).length).toBe(2);
    expect(pdf.length).toBeGreaterThan(5000);
    expect(CR80_WIDTH_PT).toBeCloseTo(242.6, 0);
    expect(CR80_HEIGHT_PT).toBeCloseTo(153.1, 0);
  });
  it('labels + csv row', () => {
    expect(tierPrintLabel('platinum')).toEqual({ top: 'PLATINUM', bottom: 'PRIVILEGE' });
    expect(tierPrintLabel('vip').top).toBe('BLACK RESERVE');
    expect(validThruLabel(new Date('2031-09-30T00:00:00Z'))).toBe('09/31');
    expect(validThruLabel(null)).toBe('—');
    const row = printBatchCsvRow({ memberId: 'PW-2026-1', cardNumberDisplay: '1', ownerName: 'A "B"', tier: 'gold', validUntil: null, qrUrl: 'u', barcodeValue: 'b' });
    expect(row).toBe('"PW-2026-1","1","A ""B""","GOLD","—","b","u"');
    expect(PRINT_BATCH_CSV_HEADER.split(',').length).toBe(7);
  });
});

describe('wiring pins', () => {
  it('routes: member print + report-lost, admin print + batch', () => {
    const r = R('server/routes/membership-cards.ts');
    expect(r).toContain('router.get("/card/print.pdf", requireAuth,');
    expect(r).toContain('router.post("/card/report-lost", requireAuth,');
    expect(r).toContain('membershipAdminRouter.get("/:userId/print.pdf", requireAdmin,');
    expect(r).toContain('membershipAdminRouter.get("/print-batch.csv", requireAdmin,');
    const s = R('server/services/MembershipCardService.ts');
    expect(s).toContain('static async reportLost(userId: string)');
    expect(s).toContain('await this.setStatus(userId, "lost", "reported_by_member");');
  });
  it('the dashboard renders the back of the card from the server codes', () => {
    const d = R('client/src/pages/Dashboard.tsx');
    expect(d).toContain("import { MemberCardBack } from '@/components/MemberCardBack';");
    expect(d).toMatch(/<MemberCardBack[\s\S]{0,300}barcodeValue=\{memberCard\.barcodeValue\}/);
    const c = R('client/src/components/MemberCardBack.tsx');
    expect(c).toContain("from '@shared/lib/code128'");
    expect(c).toContain("apiRequest('POST', '/api/membership/card/report-lost', {})");
    expect(c).toContain('כרטיס חבר בלבד — לא כרטיס אשראי');
  });
});
