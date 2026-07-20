/**
 * DOT QR — the codes the black Nayax DOT reader scans at the bay.
 *
 * WHY THIS IS SEPARATE FROM QRCodeService: the existing voucher QR encodes a JSON
 * blob. The DOT cannot read that. It expects the raw prepaid-card presentation
 * string and nothing else — a scan is processed by the terminal exactly like a
 * card tap, so the payload has to BE the card identifier, not a description of it.
 *
 * THE FORMAT (Nayax prepaid QR):
 *
 *     NYXPP;<CardUniqueIdentifier>
 *
 * e.g.  NYXPP;PWKS-GIFT-2026-000001
 *
 * The rules are unforgiving and failure is SILENT — a malformed code makes the
 * reader simply not respond, with no error anywhere, which is close to
 * undiagnosable in the field. So every rule is enforced here rather than trusted:
 *   • no leading/trailing whitespace, no space after the semicolon
 *   • no URL — never https://, never www. (encoding it as a link is the single
 *     most common mistake; QR generators default to it)
 *   • no quotes, no customer-facing text inside the payload
 *   • exactly one semicolon separator
 *
 * The visible artwork around the QR may say whatever you like; the ENCODED VALUE
 * must stay exactly the string above.
 *
 * WHERE THE UID COMES FROM: we generate it ourselves when minting the card
 * (LynxCardService.newCardUid), so the payload is built deterministically. We do
 * NOT fish an unknown field out of the Lynx create response and hope.
 */
import QRCode from 'qrcode';
import { logger } from '../lib/logger';

/** Nayax prepaid-card QR prefix. Not configurable — the reader expects this. */
export const DOT_QR_PREFIX = 'NYXPP';

/** A card UID is our own generated token: letters, digits and dashes only. */
const CARD_UID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,126}$/;

export class DotQrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DotQrError';
  }
}

/**
 * Build the exact string the DOT must read. Throws rather than emit a payload
 * that would scan as nothing — a silently dead voucher in a customer's hand is
 * far worse than a loud failure at generation time.
 */
export function buildDotQrPayload(cardUid: string): string {
  if (typeof cardUid !== 'string' || cardUid.length === 0) {
    throw new DotQrError('cardUid is required');
  }
  const uid = cardUid.trim();

  if (uid !== cardUid) {
    throw new DotQrError(`cardUid has surrounding whitespace: ${JSON.stringify(cardUid)}`);
  }
  if (/\s/.test(uid)) {
    throw new DotQrError('cardUid must not contain whitespace — the reader would fail silently');
  }
  if (/^https?:\/\//i.test(uid) || /^www\./i.test(uid)) {
    throw new DotQrError('cardUid must not be a URL — the DOT reads a card identifier, not a link');
  }
  if (uid.includes(';')) {
    throw new DotQrError('cardUid must not contain ";" — that is the payload separator');
  }
  if (/["'`]/.test(uid)) {
    throw new DotQrError('cardUid must not contain quote characters');
  }
  if (!CARD_UID_RE.test(uid)) {
    throw new DotQrError(`cardUid must be letters, digits and dashes only (got ${JSON.stringify(uid)})`);
  }

  return `${DOT_QR_PREFIX};${uid}`;
}

/**
 * Validate a payload that already exists (e.g. read back from storage or typed
 * by a human) before printing it on something.
 */
export function isValidDotQrPayload(payload: string): boolean {
  if (typeof payload !== 'string') return false;
  const parts = payload.split(';');
  if (parts.length !== 2) return false;
  if (parts[0] !== DOT_QR_PREFIX) return false;
  try {
    buildDotQrPayload(parts[1]);
    return true;
  } catch {
    return false;
  }
}

/** QR settings tuned for the DOT: high error correction + a wide quiet zone,
 *  because these get shown on phone screens and printed on stickers that scuff. */
const QR_OPTS = {
  errorCorrectionLevel: 'H' as const, // survives smudging / partial glare
  margin: 4,                          // quiet zone — readers need it
  width: 512,
  color: { dark: '#000000', light: '#FFFFFF' }, // max contrast; never brand-tint a scannable code
};

/** PNG data URL — for rendering in the app, an e-gift page, or an email. */
export async function generateDotQrDataUrl(cardUid: string): Promise<string> {
  const payload = buildDotQrPayload(cardUid);
  const dataUrl = await QRCode.toDataURL(payload, QR_OPTS);
  logger.info('[DotQr] generated QR', { uidTail: cardUid.slice(-6) });
  return dataUrl;
}

/** PNG buffer — for attaching to email or writing to storage/print. */
export async function generateDotQrPngBuffer(cardUid: string): Promise<Buffer> {
  const payload = buildDotQrPayload(cardUid);
  return QRCode.toBuffer(payload, { ...QR_OPTS, type: 'png' });
}

/** Terminal-renderable QR — handy for a quick physical scan test at the bay. */
export async function generateDotQrTerminal(cardUid: string): Promise<string> {
  const payload = buildDotQrPayload(cardUid);
  return QRCode.toString(payload, { type: 'terminal', small: true });
}
