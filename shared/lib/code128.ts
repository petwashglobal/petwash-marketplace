/**
 * Code 128 (subset B) — a REAL encoder, shared by the card back (client SVG)
 * and the print file (server PDF).
 *
 * WHY (member-card audit 2026-09-12): server/qrCode.ts emitted '110100' /
 * '100110' per character by charCode parity and called it Code-128. No scanner
 * on earth reads that. A membership barcode that does not scan is a card that
 * does not work at the desk.
 *
 * Output is the module pattern as a string of '1' (bar) / '0' (space), which
 * both an SVG <rect> loop and pdfkit can draw directly. Subset B covers
 * A–Z, a–z, 0–9 and punctuation — everything a PW…X9 barcode value uses.
 */

// 107 patterns (values 0–106): 6 elements each, bar/space widths 1–4.
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];
const START_B = 104;
const STOP = 106;

export const CODE128_MAX_LENGTH = 48;

/** Code 128B value of a character (space..~ → 0..94). Throws on anything else. */
export function code128BValue(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c < 32 || c > 126) throw new Error(`code128: unsupported character ${JSON.stringify(ch)}`);
  return c - 32;
}

/** The symbol values including start, checksum and stop. */
export function code128Symbols(text: string): number[] {
  if (!text || text.length > CODE128_MAX_LENGTH) throw new Error('code128: empty or too long');
  const values = Array.from(text).map(code128BValue);
  let sum = START_B;
  values.forEach((v, i) => { sum += v * (i + 1); });
  const check = sum % 103;
  return [START_B, ...values, check, STOP];
}

/** Module pattern: '1' = bar module, '0' = space module. Includes the 2-module termination bar. */
export function code128Pattern(text: string): string {
  const symbols = code128Symbols(text);
  let out = '';
  symbols.forEach((sym) => {
    const widths = PATTERNS[sym];
    for (let i = 0; i < widths.length; i++) {
      const w = Number(widths[i]);
      out += (i % 2 === 0 ? '1' : '0').repeat(w);
    }
  });
  return out;
}

/** Bars as x/width pairs (in modules) — convenient for SVG rects and PDF fills. */
export function code128Bars(text: string): { x: number; width: number }[] {
  const p = code128Pattern(text);
  const bars: { x: number; width: number }[] = [];
  let i = 0;
  while (i < p.length) {
    if (p[i] === '1') {
      let j = i;
      while (j < p.length && p[j] === '1') j++;
      bars.push({ x: i, width: j - i });
      i = j;
    } else i++;
  }
  return bars;
}

/** Luhn check digit for a run of digits (so a printed card number validates on any QA rig). */
export function luhnCheckDigit(digits: string): string {
  if (!/^\d+$/.test(digits)) throw new Error('luhn: digits only');
  let sum = 0;
  let double = true; // rightmost of the payload gets doubled when a check digit is appended
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

export function luhnValid(number: string): boolean {
  const s = number.replace(/\s+/g, '');
  if (!/^\d{2,}$/.test(s)) return false;
  return luhnCheckDigit(s.slice(0, -1)) === s.slice(-1);
}
