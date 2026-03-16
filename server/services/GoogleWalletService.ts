/**
 * PetWash™ Google Wallet Service — 2026
 *
 * Architecture (from official Google Wallet docs):
 *   - Generic Pass model: Class + Object
 *   - REST API for web / email / SMS distribution
 *   - Android SDK recommended for native in-app save (not handled here — handled by frontend)
 *   - Rotating barcodes: seeded via initialRotatingBarcodeValues on the object
 *   - Expiry notifications: enabled via expiryNotification field
 *   - Updates: REST PATCH on the object when balance / tier changes
 *
 * Env vars required:
 *   GOOGLE_WALLET_ISSUER_ID   — numeric issuer ID from Google Pay & Wallet Console
 *   GOOGLE_WALLET_SA_KEY      — service account JSON string (also accepts GOOGLE_SERVICE_ACCOUNT_JSON)
 *   GOOGLE_WALLET_CLASS_ID    — optional class suffix (default: petwash_premium_pass_v1)
 */

import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { logger } from '../lib/logger';

const ISSUER_ID    = process.env.GOOGLE_WALLET_ISSUER_ID;
const CLASS_SUFFIX = process.env.GOOGLE_WALLET_CLASS_ID || 'petwash_premium_pass_v1';
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
  qrToken: string;
}

type ServiceAccount = { client_email: string; private_key: string };

function getServiceAccount(): ServiceAccount | null {
  if (!SA_RAW) return null;
  try {
    return JSON.parse(SA_RAW) as ServiceAccount;
  } catch {
    logger.error('[GoogleWallet] SA key is not valid JSON');
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
  const safe = passId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${ISSUER_ID}.${safe}`;
}

function buildClassPayload() {
  return {
    id:           classId(),
    issuerName:   'PetWash',
    reviewStatus: 'UNDER_REVIEW',
    enableSmartTap: false,
  };
}

function buildObjectPayload(visual: PassVisual): Record<string, unknown> {
  const oid     = objectId(visual.passId);
  const isDark  = ['BLACK', 'ELITE', 'DIAMOND'].includes(visual.tier.toUpperCase());
  const header  = visual.primaryPetName
    ? `${visual.ownerName} • ${visual.primaryPetName} 🐾`
    : visual.ownerName;

  const textModules: { id: string; header: string; body: string }[] = [
    { id: 'credit', header: 'Available Credit', body: `₪${visual.availableCreditIls.toFixed(0)}` },
    { id: 'tier',   header: 'Tier',             body: visual.tier },
    { id: 'member', header: 'Member ID',         body: visual.passId },
  ];
  if (visual.validUntil) {
    textModules.push({ id: 'valid', header: 'Valid Until', body: visual.validUntil });
  }

  const obj: Record<string, unknown> = {
    id:      oid,
    classId: classId(),
    state:   'ACTIVE',
    cardTitle:  { defaultValue: { language: 'en-US', value: 'PetWash' } },
    subheader:  { defaultValue: { language: 'en-US', value: `${visual.tier} Member` } },
    header:     { defaultValue: { language: 'en-US', value: header } },
    logo: {
      sourceUri: { uri: 'https://petwash.co.il/logo.png' },
      contentDescription: { defaultValue: { language: 'en-US', value: 'PetWash logo' } },
    },
    hexBackgroundColor: isDark ? '#000000' : '#B48728',
    barcode: {
      type:          'QR_CODE',
      value:         visual.qrToken,
      alternateText: visual.passId,
    },
    rotatingBarcode: {
      type:                        'QR_CODE',
      initialRotatingBarcodeValues: {
        startDateTime: new Date().toISOString(),
        values:        [visual.qrToken],
        periodMillis:  '45000',
      },
    },
    textModulesData: textModules,
    linksModuleData: {
      uris: [{
        uri:         `${BASE_URL}/dashboard/pass/${encodeURIComponent(visual.passId)}`,
        description: 'Open PetWash Pass',
        id:          'app_link',
      }],
    },
    expiryNotification: { enableNotification: true },
  };

  if (visual.validUntil) {
    obj['validTimeInterval'] = { end: { date: visual.validUntil } };
  }

  return obj;
}

function getAuth() {
  const sa = getServiceAccount();
  if (!sa) throw new Error('GOOGLE_WALLET_NOT_CONFIGURED');
  return new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });
}

async function getWalletClient() {
  return google.walletobjects({ version: 'v1', auth: getAuth() });
}

export async function ensureClassExists(): Promise<void> {
  if (!isGoogleWalletConfigured()) return;
  try {
    const client = await getWalletClient();
    const cid = classId();
    try {
      await client.genericclass.get({ resourceId: cid });
      logger.info('[GoogleWallet] Class already exists', { cid });
    } catch (e: any) {
      if (e?.code === 404) {
        await client.genericclass.insert({ requestBody: buildClassPayload() });
        logger.info('[GoogleWallet] ✅ Generic class created', { cid });
      } else {
        throw e;
      }
    }
  } catch (err) {
    logger.warn('[GoogleWallet] Could not ensure class exists', { err });
  }
}

export async function upsertObject(visual: PassVisual): Promise<void> {
  if (!isGoogleWalletConfigured()) return;
  try {
    const client = await getWalletClient();
    const oid    = objectId(visual.passId);
    const body   = buildObjectPayload(visual);
    try {
      await client.genericobject.get({ resourceId: oid });
      await client.genericobject.patch({ resourceId: oid, requestBody: body });
      logger.info('[GoogleWallet] Object patched', { oid });
    } catch (e: any) {
      if (e?.code === 404) {
        await client.genericobject.insert({ requestBody: body });
        logger.info('[GoogleWallet] ✅ Object created', { oid });
      } else {
        throw e;
      }
    }
  } catch (err) {
    logger.warn('[GoogleWallet] upsertObject failed', { passId: visual.passId, err });
  }
}

export function buildSaveUrl(visual: PassVisual): string | null {
  const sa = getServiceAccount();
  if (!ISSUER_ID || !sa) {
    logger.warn('[GoogleWallet] Not configured — returning null save URL');
    return null;
  }
  try {
    const classPayload  = buildClassPayload();
    const objectPayload = buildObjectPayload(visual);
    const payload = {
      iss:     sa.client_email,
      aud:     'google',
      typ:     'savetowallet',
      iat:     Math.floor(Date.now() / 1000),
      origins: [BASE_URL],
      payload: {
        genericClasses: [classPayload],
        genericObjects: [objectPayload],
      },
    };
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
