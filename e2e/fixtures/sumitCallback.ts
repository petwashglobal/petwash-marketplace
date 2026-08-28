/**
 * sumitCallback — shared helper for the shop-checkout e2e specs.
 *
 * Loads the on-disk template at ./sumit-callback.json, substitutes
 * placeholders (cartId, orderId, transactionId, amountCents), and
 * computes a valid HMAC-SHA256 signature over the exact bytes we POST.
 *
 * The real receiver lives at POST /api/sumit/webhook (see
 * server/routes/sumit-webhook.ts). Signature header is one of:
 *   x-sumit-signature | x-signature | x-hub-signature-256
 * The receiver strips a leading "sha256=" prefix.
 *
 * SECRET DISCIPLINE
 *   - The fixture on disk NEVER contains a real signature or a real
 *     SUMIT secret — only "SIGNATURE_PLACEHOLDER" strings.
 *   - The signing key comes from process.env.SUMIT_WEBHOOK_SECRET at
 *     RUN time (set in the shell that launches Playwright). If it's
 *     unset the helper returns { skip: true, reason } and the spec
 *     calls test.skip(...).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface SignedCallback {
  /** Signature header name to send (matches one the receiver accepts). */
  signatureHeader: string;
  /** Signature value: hex HMAC-SHA256 with a "sha256=" prefix. */
  signatureValue: string;
  /** The exact JSON string body to POST — do NOT re-serialise. */
  bodyString: string;
  /** Parsed body, if the caller needs to inspect a field. */
  body: Record<string, unknown>;
}

export interface SignedCallbackOptions {
  cartId: string;
  transactionId?: string;
  amountCents?: number;
  eventId?: string;
  /** Override the EventType — used by the payment.failed / refund specs. */
  eventType?: string;
  /** When true, force an intentionally-bad signature for the negative spec. */
  tamperSignature?: boolean;
  /** When true, omit the signature header entirely. */
  omitSignature?: boolean;
}

const FIXTURE_PATH = path.resolve(__dirname, 'sumit-callback.json');

function loadTemplate(): Record<string, unknown> {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Build a signed callback payload for a given cart. Returns { skip: true }
 * when SUMIT_WEBHOOK_SECRET is unset so the spec can skip cleanly instead
 * of hitting a deterministic 401.
 */
export function buildSignedCallback(
  opts: SignedCallbackOptions,
): SignedCallback | { skip: true; reason: string } {
  const secret = process.env.SUMIT_WEBHOOK_SECRET;
  if (!secret && !opts.omitSignature) {
    return {
      skip: true,
      reason: 'SUMIT_WEBHOOK_SECRET not set — cannot sign a valid callback',
    };
  }

  const tmpl = loadTemplate();
  // Strip the $-prefixed metadata keys — they are for humans, not the wire.
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(tmpl)) {
    if (k.startsWith('$')) continue;
    body[k] = v;
  }

  const txn = opts.transactionId ?? `TXN_TEST_SHOP_${opts.cartId}`;
  const extId = `shop-${opts.cartId}`;

  body.EventId = opts.eventId ?? `evt_test_${opts.cartId}`;
  if (opts.eventType) body.EventType = opts.eventType;
  body.TransactionID = txn;
  body.ExternalIdentifier = extId;

  const data = { ...(body.Data as Record<string, unknown>) };
  data.TransactionID = txn;
  data.ExternalIdentifier = extId;
  if (typeof opts.amountCents === 'number') {
    data.AmountCents = opts.amountCents;
    data.Amount = opts.amountCents / 100;
  }
  body.Data = data;

  const payment = { ...(body.Payment as Record<string, unknown>) };
  payment.ID = txn;
  body.Payment = payment;

  const bodyString = JSON.stringify(body);

  const header = 'x-sumit-signature';
  let value: string;
  if (opts.omitSignature) {
    value = '';
  } else if (opts.tamperSignature) {
    value = 'sha256=' + '0'.repeat(64);
  } else {
    const mac = crypto.createHmac('sha256', secret!).update(bodyString).digest('hex');
    value = `sha256=${mac}`;
  }

  return {
    signatureHeader: header,
    signatureValue: value,
    bodyString,
    body,
  };
}

/** Convenience: is the receiver plausibly configured to accept our callbacks? */
export function callbackSigningAvailable(): boolean {
  return !!process.env.SUMIT_WEBHOOK_SECRET;
}
