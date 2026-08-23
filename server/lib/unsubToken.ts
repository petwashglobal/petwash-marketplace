/**
 * Marketing-Unsubscribe Token — CAN-SPAM / DMA-13 compliance helper.
 *
 * Every marketing email carries a one-click unsubscribe link that leads to
 * a Petwash-hosted page. The link embeds an opaque signed token that binds
 * the user's Firebase UID to an "unsubscribe" purpose, keyed on the shared
 * `EMAIL_UNSUB_SECRET` env. Tokens are:
 *
 *   - Domain-scoped ("marketing_unsubscribe")   — a token issued for one
 *     purpose cannot be replayed against another endpoint;
 *   - Time-bounded (default 90 days)           — long enough for every
 *     marketing email in the inbox to keep working, short enough to bound
 *     a leaked token's usefulness;
 *   - Constant-time compared                   — verifyUnsubToken uses
 *     `crypto.timingSafeEqual`;
 *   - Base64URL-safe                            — the token is a single
 *     path segment, no query-string escaping surprises.
 *
 * The DB write itself lives in server/routes/marketing-unsubscribe.ts —
 * this file is a pure crypto helper with no DB / network dependencies.
 */

import crypto from 'crypto';

const DEFAULT_TTL_DAYS = 90;
const PURPOSE = 'marketing_unsubscribe';

function getSecret(): string {
  const s = process.env.EMAIL_UNSUB_SECRET || '';
  if (!s || s.length < 32) {
    // Fail-loud in prod so we never silently sign with an empty key.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[unsubToken] EMAIL_UNSUB_SECRET missing or < 32 chars — refusing to sign / verify.',
      );
    }
  }
  return s;
}

interface UnsubClaims {
  uid: string;
  purpose: typeof PURPOSE;
  expiresAt: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromBase64url(str: string): Buffer {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

/**
 * Sign an unsubscribe token for the given Firebase UID.
 * Returns a URL-safe string suitable for pasting into a link path or query.
 */
export function signUnsubToken(uid: string, ttlDays: number = DEFAULT_TTL_DAYS): string {
  const secret = getSecret();
  if (!uid) throw new Error('[unsubToken] uid required');
  const claims: UnsubClaims = {
    uid,
    purpose: PURPOSE,
    expiresAt: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  };
  const body = base64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const sig = base64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Verify a token that came in from a marketing-email click. Returns the
 * uid on success, null on any failure (bad shape, bad sig, expired,
 * wrong purpose). Never throws for a bad token — callers should treat
 * null uniformly as "unauthorised".
 */
export function verifyUnsubToken(token: unknown): string | null {
  if (typeof token !== 'string' || !token || token.length > 4096) return null;
  const dot = token.indexOf('.');
  if (dot < 8 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  if (!secret) return null;

  const expected = base64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let claims: UnsubClaims;
  try {
    claims = JSON.parse(fromBase64url(body).toString('utf8')) as UnsubClaims;
  } catch {
    return null;
  }

  if (!claims || claims.purpose !== PURPOSE) return null;
  if (typeof claims.uid !== 'string' || claims.uid.length === 0) return null;
  if (typeof claims.expiresAt !== 'number' || claims.expiresAt <= Date.now()) return null;

  return claims.uid;
}

/**
 * Build the customer-facing unsubscribe URL for a given uid.
 * Emails call this instead of hand-composing the URL so the path stays
 * consistent everywhere.
 *
 * HOTFIX 2026-08-23 — fail-soft when EMAIL_UNSUB_SECRET is missing.
 *
 * Callers embed this INLINE in HTML email templates
 * (server/lib/notificationDispatcher.ts:134,
 *  server/services/CampaignDeliveryService.ts:253,
 *  server/email/templates/luxury-club-2026.ts:308) via string
 * interpolation. Before this change, if EMAIL_UNSUB_SECRET was
 * missing in production, signUnsubToken() threw synchronously — and
 * that throw propagated out of the template-render call, out of the
 * request handler, and returned 500 to the client. On a fleet where
 * every notification-heavy endpoint (booking accept, cancel, KYC
 * update, provider payout, etc.) touches this template, that
 * looked like a 100% server error rate from the outside even though
 * the site's homepage was still green.
 *
 * A missing signing secret is an ops-config problem, not a request
 * problem — the customer should never see it. Fail-soft to the same
 * mailto: fallback the callers already use when `uid` is missing:
 * the user can still unsubscribe, and the caller's request completes.
 * Ops still gets the "refusing to sign" alert from getSecret() in
 * the process log so the incident is visible.
 */
const MAILTO_FALLBACK =
  'mailto:support@petwash.co.il?subject=' +
  encodeURIComponent('Unsubscribe from PetWash marketing');

export function buildUnsubscribeUrl(uid: string, baseUrl?: string): string {
  const base = baseUrl || process.env.BASE_URL || 'https://petwash.co.il';
  try {
    const token = signUnsubToken(uid);
    return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
  } catch (err) {
    // getSecret() threw (EMAIL_UNSUB_SECRET missing/too short in prod)
    // or signUnsubToken threw on a bad uid. Log once per request and
    // return the mailto: fallback so the email template still renders
    // and the request returns 200. See getSecret() above for the
    // details of the underlying error.
    // eslint-disable-next-line no-console
    console.error(
      '[unsubToken] buildUnsubscribeUrl fell back to mailto — signer failed',
      { message: err instanceof Error ? err.message : String(err) },
    );
    return MAILTO_FALLBACK;
  }
}
