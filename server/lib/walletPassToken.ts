/**
 * Shared wallet pass token utilities
 * Used by both gift-cards.ts route and gift-cards-helpers.ts
 */
import crypto from 'crypto';
import { logger } from './logger';

const WALLET_TOKEN_SECRET = process.env.WALLET_LINK_SECRET || process.env.COOKIE_SECRET;

export function isWalletPassConfigured(): boolean {
  return Boolean(WALLET_TOKEN_SECRET && WALLET_TOKEN_SECRET.length >= 32);
}

export function generateWalletPassToken(
  voucherId: string,
  expiresInHours = 72
): { token: string; expiresAt: number } | null {
  if (!isWalletPassConfigured()) {
    logger.error('[Wallet Token] Cannot generate token — WALLET_LINK_SECRET not configured (min 32 chars)');
    return null;
  }
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payload = `${voucherId}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', WALLET_TOKEN_SECRET!)
    .update(payload)
    .digest('base64url');
  return {
    token: `${Buffer.from(payload).toString('base64url')}.${signature}`,
    expiresAt,
  };
}

export function verifyWalletPassToken(token: string): string | null {
  if (!isWalletPassConfigured()) {
    logger.error('[Wallet Token] Cannot verify token — secret not configured');
    return null;
  }
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const [voucherId, expiresAtStr] = payload.split('|');
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) {
      logger.warn('[Wallet Token] Token expired', { voucherId });
      return null;
    }
    const expectedSig = crypto
      .createHmac('sha256', WALLET_TOKEN_SECRET!)
      .update(payload)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      logger.warn('[Wallet Token] Invalid signature', { voucherId });
      return null;
    }
    return voucherId;
  } catch (error) {
    logger.error('[Wallet Token] Verification error', error);
    return null;
  }
}

export function buildWalletUrls(
  voucherId: string,
  baseUrl: string
): { appleWalletUrl: string | null; googleWalletUrl: string | null } {
  const tokenResult = generateWalletPassToken(voucherId);
  if (!tokenResult) return { appleWalletUrl: null, googleWalletUrl: null };
  const base = `${baseUrl}/api/gift-cards/${voucherId}/wallet`;
  return {
    appleWalletUrl: `${base}/apple?token=${tokenResult.token}`,
    googleWalletUrl: `${base}/google?token=${tokenResult.token}`,
  };
}
