/**
 * PetWash™ Apple Wallet Service — 2026
 *
 * Generates a signed .pkpass bundle using passkit-generator@3.5.2.
 * Uses PKPass.from() with the ./wallet/apple-model directory (file-based approach).
 * The model directory contains pass.json (storeCard structure) + placeholder icon/logo PNGs.
 *
 * Pass type: storeCard (stored-value / loyalty / membership)
 * Live updates: Apple pass update web service at BASE_URL/api/pass/apple/v1/...
 *
 * Env vars required:
 *   APPLE_PASS_TYPE_IDENTIFIER   — e.g. pass.il.petwash.prestige
 *   APPLE_TEAM_IDENTIFIER        — 10-char Apple Team ID
 *   APPLE_SIGNER_CERT_PEM        — PEM of the pass signing certificate
 *   APPLE_SIGNER_KEY_PEM         — PEM of the signing private key
 *   APPLE_WWDR_PEM               — Apple WWDR (Worldwide Developer Relations) CA cert PEM
 *   APPLE_SIGNER_KEY_PASSPHRASE  — passphrase for the private key (optional)
 */

import path from 'path';
import { PKPass } from 'passkit-generator';
import { buildQrRedeemToken } from '../lib/passTokens';
import { logger } from '../lib/logger';

const PASS_TYPE_IDENTIFIER  = process.env.APPLE_PASS_TYPE_IDENTIFIER  || 'pass.il.petwash.prestige';
const TEAM_IDENTIFIER       = process.env.APPLE_TEAM_IDENTIFIER;
const WWDR_PEM              = process.env.APPLE_WWDR_PEM;
const SIGNER_CERT_PEM       = process.env.APPLE_SIGNER_CERT_PEM;
const SIGNER_KEY_PEM        = process.env.APPLE_SIGNER_KEY_PEM;
const SIGNER_KEY_PASSPHRASE = process.env.APPLE_SIGNER_KEY_PASSPHRASE || '';
const BASE_URL              = process.env.BASE_URL || 'https://petwash.co.il';

// Model directory relative to server working directory (repo root)
const MODEL_PATH = path.resolve(process.cwd(), 'wallet/apple-model');

export interface PassVisual {
  passId: string;
  userId: string;
  ownerName: string;
  primaryPetName?: string;
  tier: string;
  availableCreditIls: number;
  validUntil?: string;
  qrTokenVersion: number;
}

export function isAppleWalletConfigured(): boolean {
  return !!(TEAM_IDENTIFIER && WWDR_PEM && SIGNER_CERT_PEM && SIGNER_KEY_PEM);
}

/**
 * Generate a signed .pkpass buffer ready to stream to the browser.
 * Content-Type: application/vnd.apple.pkpass
 */
export async function generateAppleWalletPass(visual: PassVisual): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error('APPLE_WALLET_NOT_CONFIGURED: set APPLE_TEAM_IDENTIFIER, APPLE_WWDR_PEM, APPLE_SIGNER_CERT_PEM, APPLE_SIGNER_KEY_PEM');
  }

  const isDark  = ['BLACK', 'ELITE', 'DIAMOND'].includes(visual.tier.toUpperCase());
  const qrToken = buildQrRedeemToken(visual.passId, visual.userId, visual.qrTokenVersion);

  const pass = await PKPass.from(
    {
      model: MODEL_PATH,
      certificates: {
        wwdr:               WWDR_PEM!,
        signerCert:         SIGNER_CERT_PEM!,
        signerKey:          SIGNER_KEY_PEM!,
        signerKeyPassphrase: SIGNER_KEY_PASSPHRASE,
      },
    },
    {
      serialNumber:         visual.passId,
      passTypeIdentifier:   PASS_TYPE_IDENTIFIER,
      teamIdentifier:       TEAM_IDENTIFIER!,
      organizationName:     'Pet Wash Ltd',
      description:          `PetWash ${visual.tier} Pass`,
      logoText:             'PetWash™',
      backgroundColor:      isDark ? 'rgb(0,0,0)'      : 'rgb(255,255,255)',
      foregroundColor:      isDark ? 'rgb(212,175,55)'  : 'rgb(26,26,26)',
      labelColor:           isDark ? 'rgb(212,175,55)'  : 'rgb(120,90,20)',
      // Apple pass update web service — Apple sends a push token here on device add
      webServiceURL:        `${BASE_URL}/api/pass/apple`,
      authenticationToken:  visual.userId,
    },
  );

  // Primary: available credit
  pass.primaryFields.push({
    key:   'credit',
    label: 'Available Credit',
    value: `₪${visual.availableCreditIls.toFixed(0)}`,
  } as any);

  // Secondary: member name (+ pet name if set)
  pass.secondaryFields.push({
    key:   'member',
    label: 'Member',
    value: visual.ownerName,
  } as any);

  // Auxiliary: tier + member ID
  pass.auxiliaryFields.push({
    key:   'tier',
    label: 'Tier',
    value: `${visual.tier} Tier`,
  } as any);

  pass.auxiliaryFields.push({
    key:   'memberId',
    label: 'Member ID',
    value: visual.passId,
  } as any);

  // Back fields
  if (visual.primaryPetName) {
    pass.backFields.push({
      key:   'pet',
      label: 'Primary Pet',
      value: visual.primaryPetName,
    } as any);
  }

  if (visual.validUntil) {
    pass.backFields.push({
      key:   'validUntil',
      label: 'Valid Until',
      value: visual.validUntil,
    } as any);
  }

  pass.backFields.push({
    key:   'support',
    label: 'Support',
    value: 'support@petwash.co.il',
  } as any);

  // Barcode — 45-second signed QR redeem token (never the raw passId or userId)
  pass.setBarcodes({
    message:         qrToken,
    format:          'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText:         visual.passId,
  });

  logger.info('[AppleWallet] Generating pkpass', { passId: visual.passId, tier: visual.tier });
  return pass.getAsBuffer();
}

/**
 * Return the pass.json structure (unsigned) for debugging and admin previews.
 * Safe to return as JSON from an API endpoint when certs are not yet configured.
 */
export function buildPassJson(visual: PassVisual): Record<string, unknown> {
  const qrToken = `QR_REDEEM_TOKEN_${visual.passId}_PREVIEW`;
  return {
    formatVersion:        1,
    passTypeIdentifier:   PASS_TYPE_IDENTIFIER,
    serialNumber:         visual.passId,
    teamIdentifier:       TEAM_IDENTIFIER || 'APPLE_TEAM_ID_NOT_SET',
    organizationName:     'Pet Wash Ltd',
    description:          `PetWash ${visual.tier} Pass`,
    logoText:             'PetWash™',
    webServiceURL:        `${BASE_URL}/api/pass/apple`,
    authenticationToken:  visual.userId,
    storeCard: {
      primaryFields:   [{ key: 'credit',    label: 'Available Credit', value: `₪${visual.availableCreditIls.toFixed(0)}` }],
      secondaryFields: [{ key: 'member',    label: 'Member',           value: visual.ownerName }],
      auxiliaryFields: [
        { key: 'tier',     label: 'Tier',      value: `${visual.tier} Tier` },
        { key: 'memberId', label: 'Member ID', value: visual.passId },
      ],
    },
    barcodes: [{
      message:         qrToken,
      format:          'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText:         visual.passId,
    }],
  };
}
