/**
 * PetWash™ Apple Wallet Service — 2026
 *
 * Generates a signed .pkpass bundle using passkit-generator@3.5.2.
 * Uses PKPass.from() with the ./wallet/apple-model.pass directory (file-based approach).
 * The model directory contains pass.json (storeCard structure) + luxury icon/logo/strip PNGs.
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
import { buildApplePassAuthToken, buildQrRedeemToken } from '../lib/passTokens';
import { logger } from '../lib/logger';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';

const PASS_TYPE_IDENTIFIER  = process.env.APPLE_PASS_TYPE_IDENTIFIER  || 'pass.il.petwash.prestige';
const TEAM_IDENTIFIER       = process.env.APPLE_TEAM_IDENTIFIER;
const WWDR_PEM              = process.env.APPLE_WWDR_PEM;
const SIGNER_CERT_PEM       = process.env.APPLE_SIGNER_CERT_PEM;
const SIGNER_KEY_PEM        = process.env.APPLE_SIGNER_KEY_PEM;
const SIGNER_KEY_PASSPHRASE = process.env.APPLE_SIGNER_KEY_PASSPHRASE || '';
const BASE_URL              = process.env.BASE_URL || 'https://petwash.co.il';
const PUBLIC_SITE_URL       = process.env.PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL || 'https://petwash.co.il';
const APP_STORE_IDS_RAW     = process.env.APPLE_ASSOCIATED_STORE_IDS || process.env.APPLE_APP_STORE_ID || '';

// Model directory relative to server working directory (repo root)
const MODEL_PATH = path.resolve(process.cwd(), 'wallet/apple-model.pass');

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

interface WalletPassLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  relevantText?: string;
}

export function isAppleWalletConfigured(): boolean {
  return !!(TEAM_IDENTIFIER && WWDR_PEM && SIGNER_CERT_PEM && SIGNER_KEY_PEM);
}

function configuredAppStoreIds(): number[] {
  return APP_STORE_IDS_RAW
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function configuredPassLocations(): WalletPassLocation[] {
  const raw = process.env.PETWASH_PASS_LOCATIONS_JSON;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => ({
        latitude: Number(entry?.latitude),
        longitude: Number(entry?.longitude),
        altitude: entry?.altitude === undefined ? undefined : Number(entry.altitude),
        relevantText: typeof entry?.relevantText === 'string' ? entry.relevantText.slice(0, 120) : undefined,
      }))
      .filter((entry) => Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude))
      .slice(0, 10);
  } catch {
    logger.warn('[AppleWallet] Ignoring invalid PETWASH_PASS_LOCATIONS_JSON');
    return [];
  }
}

function configuredMaxDistance(): number {
  const parsed = Number(process.env.PETWASH_PASS_MAX_DISTANCE_METERS || 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.round(parsed), 1), 1_000);
}

/**
 * Generate a signed .pkpass buffer ready to stream to the browser.
 * Content-Type: application/vnd.apple.pkpass
 */
export async function generateAppleWalletPass(visual: PassVisual): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error('APPLE_WALLET_NOT_CONFIGURED: set APPLE_TEAM_IDENTIFIER, APPLE_WWDR_PEM, APPLE_SIGNER_CERT_PEM, APPLE_SIGNER_KEY_PEM');
  }

  const qrToken = buildQrRedeemToken(visual.passId, visual.userId, visual.qrTokenVersion);
  const authToken = buildApplePassAuthToken(visual.passId, visual.userId, visual.qrTokenVersion);
  const locations = configuredPassLocations();
  const appStoreIds = configuredAppStoreIds();
  const certificates: {
    wwdr: string;
    signerCert: string;
    signerKey: string;
    signerKeyPassphrase?: string;
  } = {
    wwdr: WWDR_PEM!,
    signerCert: SIGNER_CERT_PEM!,
    signerKey: SIGNER_KEY_PEM!,
  };

  if (SIGNER_KEY_PASSPHRASE) {
    certificates.signerKeyPassphrase = SIGNER_KEY_PASSPHRASE;
  }

  const pass = await PKPass.from(
    {
      model: MODEL_PATH,
      certificates,
    },
    {
      serialNumber:               visual.passId,
      passTypeIdentifier:         PASS_TYPE_IDENTIFIER,
      teamIdentifier:             TEAM_IDENTIFIER!,
      organizationName:           'Pet Wash Ltd',
      description:                `PetWash ${visual.tier} Pass`,
      logoText:                   'PetWash',
      backgroundColor:            'rgb(255,255,255)',
      foregroundColor:            'rgb(0,0,0)',
      labelColor:                 'rgb(176,132,28)',
      suppressStripShine:         true,
      appLaunchURL:               `${PUBLIC_SITE_URL}/prestige-pass?pass=${encodeURIComponent(visual.passId)}`,
      userInfo:                   { passVersion: 'petwash-prestige-2026-v2', tier: visual.tier },
      ...(appStoreIds.length ? { associatedStoreIdentifiers: appStoreIds } : {}),
      ...(locations.length ? { locations, maxDistance: configuredMaxDistance() } : {}),
      // Apple pass update web service — Apple sends a push token here on device add
      webServiceURL:              `${BASE_URL}/api/pass/apple`,
      authenticationToken:        authToken,
    },
  );

  pass.primaryFields.push({
    key:   'memberName',
    label: 'MEMBER',
    value: visual.ownerName,
    textAlignment: 'PKTextAlignmentLeft',
  } as any);

  pass.secondaryFields.push({
    key:   'tier',
    label: 'TIER',
    value: `${visual.tier} TIER`,
    textAlignment: 'PKTextAlignmentLeft',
  } as any);

  pass.secondaryFields.push({
    key:   'storedCredit',
    label: 'STORED CREDIT',
    value: `₪${visual.availableCreditIls.toFixed(0)} verified`,
    textAlignment: 'PKTextAlignmentRight',
  } as any);

  pass.auxiliaryFields.push({
    key:   'memberId',
    label: 'MEMBER ID',
    value: visual.passId,
    textAlignment: 'PKTextAlignmentCenter',
  } as any);

  if (visual.primaryPetName) {
    pass.backFields.push({
      key:   'primaryPet',
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
    value: CANONICAL_SUPPORT_EMAIL,
  } as any);

  pass.backFields.push({
    key: 'website',
    label: 'PetWash Website',
    value: PUBLIC_SITE_URL,
  } as any);

  pass.backFields.push({
    key: 'bookServices',
    label: 'Book Services',
    value: `${PUBLIC_SITE_URL}/book`,
  } as any);

  pass.backFields.push({
    key: 'prestigePortal',
    label: 'Prestige Member Portal',
    value: `${PUBLIC_SITE_URL}/prestige-pass`,
  } as any);

  pass.backFields.push({
    key: 'walletNotice',
    label: 'Notice',
    value: 'Front is for membership identity and QR scan. Details and action links are available on this page.',
  } as any);

  pass.backFields.push({
    key: 'legal',
    label: 'Terms',
    value: 'This pass is non-transferable and remains subject to Pet Wash Ltd terms, verification rules, and membership conditions.',
  } as any);

  // Barcode — 45-second signed QR redeem token (never the raw passId or userId)
  pass.setBarcodes({
    message:         qrToken,
    format:          'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText:         visual.passId,
  } as any, {
    message:         qrToken,
    format:          'PKBarcodeFormatPDF417',
    messageEncoding: 'iso-8859-1',
    altText:         visual.passId,
  } as any);

  logger.info('[AppleWallet] Generating pkpass', { passId: visual.passId, tier: visual.tier });
  return pass.getAsBuffer();
}

/**
 * Return the pass.json structure (unsigned) for debugging and admin previews.
 * Safe to return as JSON from an API endpoint when certs are not yet configured.
 */
export function buildPassJson(visual: PassVisual): Record<string, unknown> {
  const qrToken = `QR_REDEEM_TOKEN_${visual.passId}_PREVIEW`;
  const locations = configuredPassLocations();
  const appStoreIds = configuredAppStoreIds();
  return {
    formatVersion:        1,
    passTypeIdentifier:   PASS_TYPE_IDENTIFIER,
    serialNumber:         visual.passId,
    teamIdentifier:       TEAM_IDENTIFIER || 'APPLE_TEAM_ID_NOT_SET',
    organizationName:     'Pet Wash Ltd',
    description:          `PetWash ${visual.tier} Pass`,
    logoText:             'PetWash',
    backgroundColor:      'rgb(255,255,255)',
    foregroundColor:      'rgb(0,0,0)',
    labelColor:           'rgb(176,132,28)',
    suppressStripShine:   true,
    appLaunchURL:         `${PUBLIC_SITE_URL}/prestige-pass?pass=${encodeURIComponent(visual.passId)}`,
    associatedStoreIdentifiers: appStoreIds.length ? appStoreIds : undefined,
    locations:            locations.length ? locations : undefined,
    maxDistance:          locations.length ? configuredMaxDistance() : undefined,
    webServiceURL:        `${BASE_URL}/api/pass/apple`,
    authenticationToken:  'APPLE_PASS_AUTH_TOKEN_PREVIEW',
    storeCard: {
      primaryFields: [{
        key: 'memberName',
        label: 'MEMBER',
        value: visual.ownerName,
        textAlignment: 'PKTextAlignmentLeft',
      }],
      secondaryFields: [
        { key: 'tier', label: 'TIER', value: `${visual.tier} TIER`, textAlignment: 'PKTextAlignmentLeft' },
        { key: 'storedCredit', label: 'STORED CREDIT', value: `₪${visual.availableCreditIls.toFixed(0)} verified`, textAlignment: 'PKTextAlignmentRight' },
      ],
      auxiliaryFields: [
        { key: 'memberId', label: 'MEMBER ID', value: visual.passId, textAlignment: 'PKTextAlignmentCenter' },
      ],
      backFields: [
        ...(visual.primaryPetName ? [{ key: 'primaryPet', label: 'Primary Pet', value: visual.primaryPetName }] : []),
        { key: 'support', label: 'Support', value: CANONICAL_SUPPORT_EMAIL },
        { key: 'website', label: 'PetWash Website', value: PUBLIC_SITE_URL },
        { key: 'bookServices', label: 'Book Services', value: `${PUBLIC_SITE_URL}/book` },
        { key: 'prestigePortal', label: 'Prestige Member Portal', value: `${PUBLIC_SITE_URL}/prestige-pass` },
        { key: 'walletNotice', label: 'Notice', value: 'Front is for membership identity and QR scan. Details and action links are available on this page.' },
        { key: 'legal', label: 'Terms', value: 'This pass is non-transferable and remains subject to Pet Wash Ltd terms, verification rules, and membership conditions.' },
      ],
    },
    barcodes: [{
      message:         qrToken,
      format:          'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText:         visual.passId,
    }, {
      message:         qrToken,
      format:          'PKBarcodeFormatPDF417',
      messageEncoding: 'iso-8859-1',
      altText:         visual.passId,
    }],
  };
}
