/**
 * attachmentPolicy — CEO DEEP-LOGIC §19.
 *
 * The prior send schema accepted `attachments: { url, mime, name }[]`
 * with any URL. A user could bypass text moderation by sending a
 * WhatsApp QR screenshot, a bank-transfer screenshot, an external URL
 * to a phone-number image, or a filename encoding contact/payment
 * instructions. Text-only moderation is not enough.
 *
 * This module owns the "attachment must reference a PetWash-owned
 * object" gate:
 *
 *   • Only URLs whose origin matches one of the explicit
 *     PW_OWNED_ORIGINS is accepted.
 *   • The public-storage hosts we allow are Firebase Storage
 *     (`storage.googleapis.com/petwash-*` buckets), the app's own
 *     apex (`petwash.co.il`) and a small set of documented Cloud
 *     Run backends. Everything else — unpkg, imgur, gdrive links,
 *     WhatsApp media, telegram, dropbox — is rejected.
 *   • Names are stripped of anything that looks like a phone number
 *     or an @handle so a filename cannot carry the payload the
 *     policy blocked in the body.
 *
 * The server does NOT fetch attacker URLs. Rejection is by URL
 * shape, never by dereference — pulling arbitrary URLs from an
 * SSRF-adjacent surface would be a bigger foot-gun than the leak.
 *
 * The list of allowed hosts is env-configurable via
 * `PETWASH_ASSET_ORIGINS` (comma-separated) so a deploy can add its
 * own signed-upload host without a code change.
 */

const DEFAULT_OWNED_ORIGINS: string[] = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  'https://app.petwash.co.il',
  'https://storage.googleapis.com',        // Firebase Storage (path-based auth checked below)
  'https://firebasestorage.googleapis.com',
];

// Path prefixes required when the origin is a shared multi-tenant host
// like storage.googleapis.com. Anything under a bucket that is not
// prefixed `petwash-` is rejected — a share URL from someone else's
// GCS bucket is not a PetWash asset.
const SHARED_ORIGIN_PATH_ALLOWLIST: Record<string, RegExp[]> = {
  'https://storage.googleapis.com': [/^\/petwash-[a-z0-9-]+\//],
  'https://firebasestorage.googleapis.com': [/^\/v0\/b\/petwash-[a-z0-9-]+\.appspot\.com\//, /^\/v0\/b\/petwash-[a-z0-9-]+\.firebasestorage\.app\//],
};

function ownedOrigins(): string[] {
  const extra = (process.env.PETWASH_ASSET_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_OWNED_ORIGINS, ...extra];
}

/**
 * A single canonical check. Returns null on ok; otherwise a stable
 * rejection code the send route surfaces (never the raw URL).
 */
export function classifyAttachmentUrl(url: string): 'ok' | 'not_petwash_owned' | 'malformed' {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'malformed';
  }
  const origin = `${u.protocol}//${u.host}`.toLowerCase();
  if (!ownedOrigins().map((o) => o.toLowerCase()).includes(origin)) {
    return 'not_petwash_owned';
  }
  const pathAllowlist = SHARED_ORIGIN_PATH_ALLOWLIST[origin];
  if (pathAllowlist) {
    const okPath = pathAllowlist.some((rx) => rx.test(u.pathname));
    if (!okPath) return 'not_petwash_owned';
  }
  return 'ok';
}

/**
 * Filename sanitiser. Strips PII-shaped runs (phone numbers, @handles)
 * from an attachment name so a "call me: 050-1234567.png" filename can
 * never carry the payload that policy blocked in the body.
 */
const PHONE_RUN = /(?:\+?972[- .]?)?0?5\d[- .]?\d{3}[- .]?\d{4}|\d{9,}/g;
const HANDLE_RUN = /@[A-Za-z0-9_]{2,}/g;
export function sanitiseAttachmentName(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .replace(PHONE_RUN, '[redacted]')
    .replace(HANDLE_RUN, '[redacted]')
    .slice(0, 200);
}
