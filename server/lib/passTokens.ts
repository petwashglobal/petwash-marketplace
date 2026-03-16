/**
 * PetWash™ Pass Token Utilities — 2026
 *
 * Two distinct token types — never mix them:
 *
 *   wallet-link  (72 hours)  — embedded in email / SMS / web links.
 *                               Routes: /api/pass/:token, /api/wallet/apple/:token, /api/wallet/google/:token
 *                               Secret: PASS_LINK_SECRET
 *
 *   qr-redeem    (45 seconds) — lives inside the wallet barcode only.
 *                               Validated by K9000 kiosk at scan time.
 *                               Secret: PRESTIGE_QR_SECRET
 *
 * Token format: base64url(JSON payload) + "." + HMAC-SHA256 signature
 * Timing-safe comparison on verify. Token version bumped to invalidate outstanding tokens on revoke.
 */

import crypto from 'crypto';
import { logger } from './logger';

const PASS_LINK_SECRET = process.env.PASS_LINK_SECRET || process.env.PRESTIGE_QR_SECRET || '';
const PRESTIGE_QR_SECRET = process.env.PRESTIGE_QR_SECRET || '';

export interface PassTokenPayload {
  passId: string;
  userId: string;
  tokenVersion: number;
  purpose: 'wallet-link' | 'qr-redeem';
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  machineId?: string | null;
  bayId?: 'LEFT' | 'RIGHT' | null;
}

function sign(payload: PassTokenPayload, secret: string): string {
  if (!secret || secret.length < 16) {
    throw new Error('PASS_TOKEN_SECRET_TOO_SHORT: set PASS_LINK_SECRET and PRESTIGE_QR_SECRET (min 16 chars)');
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig   = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token: string, secret: string): PassTokenPayload {
  if (!secret || secret.length < 16) throw new Error('TOKEN_SECRET_NOT_CONFIGURED');
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new Error('INVALID_TOKEN_FORMAT');

  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expected.length) throw new Error('INVALID_SIGNATURE');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('INVALID_SIGNATURE');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PassTokenPayload;
  if (payload.expiresAt < Math.floor(Date.now() / 1000)) throw new Error('TOKEN_EXPIRED');
  return payload;
}

// ─── Wallet Link Token (72h, for email / SMS / web distribution) ──────────────

export function buildPassLinkToken(
  passId: string,
  userId: string,
  qrTokenVersion: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    passId,
    userId,
    tokenVersion: qrTokenVersion,
    purpose:      'wallet-link',
    nonce:        crypto.randomUUID(),
    issuedAt:     now,
    expiresAt:    now + 60 * 60 * 24 * 3,   // 72 hours
  }, PASS_LINK_SECRET);
}

export function verifyPassLinkToken(token: string): PassTokenPayload {
  const payload = verify(token, PASS_LINK_SECRET);
  if (payload.purpose !== 'wallet-link') throw new Error('INVALID_PURPOSE');
  return payload;
}

// ─── QR Redeem Token (45s, for kiosk barcode) ────────────────────────────────

export function buildQrRedeemToken(
  passId: string,
  userId: string,
  qrTokenVersion: number,
  machineId?: string,
  bayId?: 'LEFT' | 'RIGHT',
): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    passId,
    userId,
    tokenVersion: qrTokenVersion,
    purpose:      'qr-redeem',
    nonce:        crypto.randomUUID(),
    issuedAt:     now,
    expiresAt:    now + 45,
    machineId:    machineId || null,
    bayId:        bayId || null,
  }, PRESTIGE_QR_SECRET);
}

export function verifyQrRedeemToken(token: string): PassTokenPayload {
  const payload = verify(token, PRESTIGE_QR_SECRET);
  if (payload.purpose !== 'qr-redeem') throw new Error('INVALID_PURPOSE');
  return payload;
}

// ─── SendGrid member pass payload ─────────────────────────────────────────────

export interface MemberPassRecord {
  passId: string;
  userId: string;
  ownerName: string;
  ownerEmail?: string;
  primaryPetName?: string;
  tier: string;
  availableCreditIls: number;
  validUntil?: string;
  qrTokenVersion: number;
}

export function buildPassLinkUrls(record: MemberPassRecord): {
  appleLink: string;
  googleLink: string;
  universalLink: string;
} {
  const BASE_URL = process.env.BASE_URL || 'https://petwash.co.il';
  const token = buildPassLinkToken(record.passId, record.userId, record.qrTokenVersion);
  const enc   = encodeURIComponent(token);
  return {
    appleLink:     `${BASE_URL}/api/pass/apple/${enc}`,
    googleLink:    `${BASE_URL}/api/pass/google/${enc}`,
    universalLink: `${BASE_URL}/api/pass/${enc}`,
  };
}

export function buildSendGridMemberPassData(record: MemberPassRecord) {
  const { appleLink, googleLink, universalLink } = buildPassLinkUrls(record);
  return {
    to:   record.ownerEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'support@petwash.co.il',
      name:  process.env.SENDGRID_FROM_NAME  || 'PetWash',
    },
    templateId: process.env.SENDGRID_TEMPLATE_ID_MEMBER_PASS || '',
    dynamicTemplateData: {
      name:               record.ownerName,
      member_id:          record.passId,
      credit_balance:     record.availableCreditIls.toFixed(0),
      expiry_date:        record.validUntil || 'No expiry',
      apple_wallet_link:  appleLink,
      google_wallet_link: googleLink,
      universal_pass_link: universalLink,
    },
  };
}

export function buildTwilioPassMessage(record: MemberPassRecord): string {
  const { universalLink } = buildPassLinkUrls(record);
  return [
    'PetWash',
    `Hello ${record.ownerName}, your digital pass is ready.`,
    `Open here: ${universalLink}`,
    `Member ID: ${record.passId}`,
  ].join(' ');
}
