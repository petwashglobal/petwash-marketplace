/**
 * PetWash™ Google Wallet Service — 2026
 *
 * Architecture (official Google Wallet spec):
 *   Generic Pass model: Class + Object
 *   Auth: google.auth.JWT (service account)
 *   Web/email/SMS: signed JWT → pay.google.com/gp/v/save/{jwt}
 *   Android in-app: Google Wallet Android SDK (frontend responsibility)
 *   Live updates: REST PATCH on the object when balance / tier changes
 *   Rotating barcodes: 45-second cadence via rotatingBarcode
 *   Expiry notifications: expiryNotification.enableNotification
 *
 * Env vars required:
 *   GOOGLE_WALLET_ISSUER_ID      — numeric issuer ID from Google Pay & Wallet Console
 *   GOOGLE_WALLET_SA_KEY         — service account JSON string
 *                                   (also accepts GOOGLE_SERVICE_ACCOUNT_JSON)
 *   GOOGLE_WALLET_CLASS_ID       — optional class suffix (default: petwash_premium_v1)
 */

import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { buildQrRedeemToken } from '../lib/passTokens';
import { logger } from '../lib/logger';

const ISSUER_ID    = process.env.GOOGLE_WALLET_ISSUER_ID;
const CLASS_SUFFIX = process.env.GOOGLE_WALLET_CLASS_ID || 'petwash_premium_v1';
const SA_RAW       = process.env.GOOGLE_WALLET_SA_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const BASE_URL     = process.env.BASE_URL || 'https://petwash.co.il';

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

type ServiceAccount = { client_email: string; private_key: string };

function getServiceAccount(): ServiceAccount | null {
  if (!SA_RAW) return null;
  try {
    return JSON.parse(SA_RAW) as ServiceAccount;
  } catch {
    logger.error('[GoogleWallet] GOOGLE_WALLET_SA_KEY is not valid JSON');
    return null;
  }
}

export function isGoogleWalletConfigured(): boolean {
  return !!(ISSUER_ID && getServiceAccount());
}

function classId(): string {
  return `${ISSUER_ID}.${CLASS_SUFFIX}`;
}

function objectId(passId: string): string {
  return `${ISSUER_ID}.${passId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

// google.auth.JWT — per spec (direct, explicit service account)
function getAuth() {
  const sa = getServiceAccount();
  if (!sa) throw new Error('GOOGLE_WALLET_NOT_CONFIGURED');
  return new google.auth.JWT(
    sa.client_email,
    undefined,
    sa.private_key,
    ['https://www.googleapis.com/auth/wallet_object.issuer'],
  );
}

async function getWalletClient() {
  return google.walletobjects({ version: 'v1', auth: getAuth() });
}

function buildObjectBody(visual: PassVisual): Record<string, unknown> {
  const isDark   = ['BLACK', 'ELITE', 'DIAMOND'].includes(visual.tier.toUpperCase());
  const qrToken  = buildQrRedeemToken(visual.passId, visual.userId, visual.qrTokenVersion);
  const header   = visual.primaryPetName
    ? `${visual.ownerName} • ${visual.primaryPetName}`
    : visual.ownerName;

  const textModules: { id: string; header: string; body: string }[] = [
    { id: 'credit',   header: 'Available Credit', body: `₪${visual.availableCreditIls.toFixed(0)}` },
    { id: 'memberId', header: 'Member ID',         body: visual.passId },
    ...(visual.validUntil ? [{ id: 'validUntil', header: 'Valid Until', body: visual.validUntil }] : []),
  ];

  const body: Record<string, unknown> = {
    id:      objectId(visual.passId),
    classId: classId(),
    state:   'ACTIVE',
    cardTitle:  { defaultValue: { language: 'en-US', value: 'PetWash' } },
    subheader:  { defaultValue: { language: 'en-US', value: `${visual.tier} Tier` } },
    header:     { defaultValue: { language: 'en-US', value: header } },
    logo: {
      sourceUri: { uri: 'https://petwash.co.il/logo.png' },
      contentDescription: { defaultValue: { language: 'en-US', value: 'PetWash logo' } },
    },
    hexBackgroundColor: isDark ? '#000000' : '#B48728',
    // Primary barcode: 45-second signed QR redeem token
    barcode: {
      type:          'QR_CODE',
      value:         qrToken,
      alternateText: visual.passId,
    },
    // Rotating barcode support (refreshes automatically every 45s on device)
    rotatingBarcode: {
      type:                        'QR_CODE',
      initialRotatingBarcodeValues: {
        startDateTime: new Date().toISOString(),
        values:        [qrToken],
        periodMillis:  '45000',
      },
    },
    textModulesData: textModules,
    linksModuleData: {
      uris: [{
        uri:         `${BASE_URL}/dashboard`,
        description: 'Open PetWash',
        id:          'app_link',
      }],
    },
    expiryNotification: { enableNotification: true },
  };

  if (visual.validUntil) {
    body['validTimeInterval'] = { end: { date: visual.validUntil } };
  }

  return body;
}

// ─── Class management ─────────────────────────────────────────────────────────

export async function ensureClassExists(): Promise<void> {
  if (!isGoogleWalletConfigured()) return;
  try {
    const client = await getWalletClient();
    const cid    = classId();
    try {
      await client.genericclass.get({ resourceId: cid });
      logger.info('[GoogleWallet] Class already exists', { cid });
    } catch {
      await client.genericclass.insert({
        requestBody: {
          id:           cid,
          issuerName:   'PetWash',
          reviewStatus: 'UNDER_REVIEW',
        },
      });
      logger.info('[GoogleWallet] ✅ Generic class created', { cid });
    }
  } catch (err) {
    logger.warn('[GoogleWallet] Could not ensure class exists', { err });
  }
}

// ─── Object create / update ───────────────────────────────────────────────────

export async function upsertObject(visual: PassVisual): Promise<void> {
  if (!isGoogleWalletConfigured()) return;
  try {
    const client  = await getWalletClient();
    const oid     = objectId(visual.passId);
    const body    = buildObjectBody(visual);
    try {
      await client.genericobject.get({ resourceId: oid });
      await client.genericobject.update({ resourceId: oid, requestBody: body });
      logger.info('[GoogleWallet] Object updated', { oid });
    } catch {
      await client.genericobject.insert({ requestBody: body });
      logger.info('[GoogleWallet] ✅ Object created', { oid });
    }
  } catch (err) {
    logger.warn('[GoogleWallet] upsertObject failed', { passId: visual.passId, err });
  }
}

// ─── Save URL (email / SMS / web distribution) ────────────────────────────────

export function buildSaveUrl(visual: PassVisual): string | null {
  const sa = getServiceAccount();
  if (!ISSUER_ID || !sa) {
    logger.warn('[GoogleWallet] Not configured — returning null save URL');
    return null;
  }
  try {
    const qrToken = buildQrRedeemToken(visual.passId, visual.userId, visual.qrTokenVersion);
    const objBody = buildObjectBody({ ...visual });

    const payload = {
      iss:     sa.client_email,
      aud:     'google',
      typ:     'savetowallet',
      origins: [BASE_URL],
      payload: {
        genericClasses: [{ id: classId(), issuerName: 'PetWash', reviewStatus: 'UNDER_REVIEW' }],
        genericObjects: [objBody],
      },
    };

    // jwt.sign uses the private key; algorithm RS256 per Google spec
    const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
  } catch (err) {
    logger.error('[GoogleWallet] buildSaveUrl failed', { err });
    return null;
  }
}

export async function pushUpdate(visual: PassVisual): Promise<void> {
  await upsertObject(visual);
}
