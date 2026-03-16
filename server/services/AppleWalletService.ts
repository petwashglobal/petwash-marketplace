/**
 * PetWash™ Apple Wallet Service — 2026
 *
 * Architecture (from official Apple Wallet docs):
 *   - Best distribution: app (PKAddPassButton), email, web
 *   - Artifact: signed .pkpass (zip of pass.json + images + manifest + PKCS#7 sig)
 *   - Live updates: Apple pass update web service (webServiceURL + authenticationToken)
 *   - Pass type: storeCard (stored-value / loyalty pass)
 *
 * Env vars required:
 *   APPLE_PASS_TYPE_IDENTIFIER   — e.g. pass.il.petwash.prestige
 *   APPLE_TEAM_IDENTIFIER        — 10-char Apple Team ID
 *   APPLE_SIGNER_CERT_PEM        — PEM of the pass signing certificate
 *   APPLE_SIGNER_KEY_PEM         — PEM of the signing private key
 *   APPLE_WWDR_PEM               — Apple WWDR (Worldwide Developer Relations) CA cert PEM
 *   APPLE_SIGNER_KEY_PASSPHRASE  — passphrase for the private key (optional)
 *
 * Also accepts P12 bundle via APPLE_PASS_CERT_P12 (base64) for backwards compat —
 * but PEM is preferred so no crypto conversion is needed at runtime.
 */

import { PKPass } from 'passkit-generator';
import { logger } from '../lib/logger';

const PASS_TYPE_IDENTIFIER  = process.env.APPLE_PASS_TYPE_IDENTIFIER  || 'pass.il.petwash.prestige';
const TEAM_IDENTIFIER       = process.env.APPLE_TEAM_IDENTIFIER;
const WWDR_PEM              = process.env.APPLE_WWDR_PEM;
const SIGNER_CERT_PEM       = process.env.APPLE_SIGNER_CERT_PEM;
const SIGNER_KEY_PEM        = process.env.APPLE_SIGNER_KEY_PEM;
const SIGNER_KEY_PASSPHRASE = process.env.APPLE_SIGNER_KEY_PASSPHRASE || '';
const BASE_URL              = process.env.BASE_URL || 'https://petwash.co.il';

export interface PassVisual {
  passId: string;
  userId: string;
  ownerName: string;
  primaryPetName?: string;
  tier: string;
  availableCreditIls: number;
  validUntil?: string;
  qrToken: string;
}

export function isAppleWalletConfigured(): boolean {
  return !!(TEAM_IDENTIFIER && WWDR_PEM && SIGNER_CERT_PEM && SIGNER_KEY_PEM);
}

/**
 * Minimal 1×1 solid PNG helpers.
 * These are used as placeholder icons when custom branded PNGs are not yet
 * placed in server/assets/petwash.pass/. Replace by adding real 87×87,
 * 174×174, and 522×522 PNG files to that directory and loading them here.
 */
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const GOLD_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Generate a signed .pkpass buffer ready to stream to the browser with
 * Content-Type: application/vnd.apple.pkpass
 */
export async function generateAppleWalletPass(visual: PassVisual): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error('APPLE_WALLET_NOT_CONFIGURED: set APPLE_TEAM_IDENTIFIER, APPLE_WWDR_PEM, APPLE_SIGNER_CERT_PEM, APPLE_SIGNER_KEY_PEM');
  }

  const isDark = ['BLACK', 'ELITE', 'DIAMOND'].includes(visual.tier.toUpperCase());

  const certificates = {
    wwdr:               WWDR_PEM!,
    signerCert:         SIGNER_CERT_PEM!,
    signerKey:          SIGNER_KEY_PEM!,
    signerKeyPassphrase: SIGNER_KEY_PASSPHRASE,
  };

  const pass = new PKPass(
    {
      'icon.png':     GOLD_PNG,
      'icon@2x.png':  GOLD_PNG,
      'icon@3x.png':  GOLD_PNG,
      'logo.png':     TRANSPARENT_PNG,
      'logo@2x.png':  TRANSPARENT_PNG,
      'logo@3x.png':  TRANSPARENT_PNG,
    },
    certificates,
    {
      formatVersion:        1,
      passTypeIdentifier:   PASS_TYPE_IDENTIFIER,
      serialNumber:         visual.passId,
      teamIdentifier:       TEAM_IDENTIFIER!,
      organizationName:     'PetWash Ltd',
      description:          `PetWash ${visual.tier} Pass`,
      logoText:             'PetWash™',
      backgroundColor:      isDark ? 'rgb(0,0,0)'   : 'rgb(255,255,255)',
      foregroundColor:      isDark ? 'rgb(212,175,55)' : 'rgb(30,30,30)',
      labelColor:           isDark ? 'rgb(212,175,55)' : 'rgb(120,90,20)',
      // Apple pass update web service — sends APNs push when we PATCH the pass
      webServiceURL:        `${BASE_URL}/api/pass/apple`,
      authenticationToken:  visual.userId,   // Opaque token Apple sends back on each update request
    },
  );

  pass.type = 'storeCard';

  pass.primaryFields.push({
    key:   'credit',
    label: 'Available Credit',
    value: `₪${visual.availableCreditIls.toFixed(0)}`,
    textAlignment: 'PKTextAlignmentNatural',
  } as any);

  pass.secondaryFields.push({
    key:   'owner',
    label: visual.primaryPetName ? `${visual.ownerName} · ${visual.primaryPetName} 🐾` : 'Member',
    value: visual.ownerName,
  } as any);

  pass.auxiliaryFields.push({
    key:   'member_id',
    label: 'Member ID',
    value: visual.passId,
  } as any);

  pass.auxiliaryFields.push({
    key:   'tier',
    label: 'Tier',
    value: visual.tier,
  } as any);

  if (visual.validUntil) {
    pass.backFields.push({
      key:   'expiry',
      label: 'Valid Until',
      value: visual.validUntil,
    } as any);
  }

  pass.backFields.push({
    key:   'terms',
    label: 'Terms',
    value: 'This pass is non-transferable. Issued by PetWash Ltd (Ch.P. 516458396).',
  } as any);

  pass.setBarcodes({
    message:         visual.qrToken,
    format:          'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText:         visual.passId,
  });

  logger.info('[AppleWallet] Generating pkpass', { passId: visual.passId, tier: visual.tier });
  return pass.getAsBuffer();
}

/**
 * Return the pass.json structure (without signing) for debugging / admin preview.
 * This is safe to return as JSON from an API endpoint.
 */
export function buildPassJson(visual: PassVisual): Record<string, unknown> {
  return {
    formatVersion:        1,
    passTypeIdentifier:   PASS_TYPE_IDENTIFIER,
    serialNumber:         visual.passId,
    teamIdentifier:       TEAM_IDENTIFIER || 'APPLE_TEAM_ID',
    organizationName:     'PetWash Ltd',
    description:          `PetWash ${visual.tier} Pass`,
    logoText:             'PetWash™',
    storeCard: {
      primaryFields:   [{ key: 'credit',    label: 'Available Credit', value: `₪${visual.availableCreditIls.toFixed(0)}` }],
      secondaryFields: [{ key: 'owner',     label: 'Member',           value: visual.ownerName }],
      auxiliaryFields: [
        { key: 'member_id', label: 'Member ID', value: visual.passId },
        { key: 'tier',      label: 'Tier',      value: visual.tier },
      ],
    },
    barcodes: [{
      message:         visual.qrToken,
      format:          'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText:         visual.passId,
    }],
    webServiceURL:       `${BASE_URL}/api/wallet/apple`,
    authenticationToken: visual.userId,
  };
}
